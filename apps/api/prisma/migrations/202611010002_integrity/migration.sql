-- Reviewed PostgreSQL features which Prisma's schema language cannot express.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE UNIQUE INDEX "User_email_case_insensitive" ON "User" (lower("email"));
ALTER TABLE "Facility" ADD CONSTRAINT "Facility_coordinates" CHECK (
  ("latitude" IS NULL AND "longitude" IS NULL) OR
  ("latitude" IS NOT NULL AND "longitude" IS NOT NULL AND
   "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180)
);
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_valid_range" CHECK ("endAt" > "startAt");
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_valid_price_policy" CHECK (
  "priceMinor" >= 0 AND "currency" ~ '^[A-Z]{3}$' AND "cancellationCutoffMinutes" >= 0
  AND jsonb_typeof("priceSnapshot") = 'object' AND jsonb_typeof("policySnapshot") = 'object'
);
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customer_origin" CHECK (
  ("origin" = 'CUSTOMER' AND "customerId" IS NOT NULL) OR
  ("origin" = 'STAFF' AND length(trim("customerName")) > 0 AND "customerName" IS NOT NULL
    AND length(trim("customerContact")) > 0 AND "customerContact" IS NOT NULL)
);
ALTER TABLE "ResourceBlock" ADD CONSTRAINT "ResourceBlock_valid_range" CHECK ("endAt" > "startAt");
ALTER TABLE "ResourceOccupancy" ADD CONSTRAINT "ResourceOccupancy_valid_range"
  CHECK ("occupiedEnd" > "occupiedStart");
ALTER TABLE "ResourceOccupancy" ADD CONSTRAINT "ResourceOccupancy_exactly_one_source"
  CHECK (num_nonnulls("bookingId", "blockId") = 1);
ALTER TABLE "ResourceOccupancy" ADD CONSTRAINT "ResourceOccupancy_no_overlap"
  EXCLUDE USING gist (
    "resourceId" WITH =,
    tstzrange("occupiedStart", "occupiedEnd", '[)') WITH &&
  ) WHERE ("active");

-- Every persisted source must retain exactly one ledger entry. Deferral permits the
-- source and ledger to be inserted/updated atomically, in either order where FK permits.
CREATE FUNCTION verify_occupancy(source_kind text, source_id uuid) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  source_start timestamptz; source_end timestamptz; source_active boolean;
  ledger "ResourceOccupancy"%ROWTYPE;
BEGIN
  IF source_kind = 'booking' THEN
    SELECT "startAt", "endAt", "status" NOT IN
      ('CANCELLED_BY_USER', 'CANCELLED_BY_OWNER', 'CANCELLED_BY_ADMIN')
      INTO source_start, source_end, source_active FROM "Booking" WHERE "id" = source_id;
    IF NOT FOUND THEN RETURN; END IF;
    SELECT * INTO ledger FROM "ResourceOccupancy" WHERE "bookingId" = source_id;
  ELSE
    SELECT "startAt", "endAt", "active" INTO source_start, source_end, source_active
      FROM "ResourceBlock" WHERE "id" = source_id;
    IF NOT FOUND THEN RETURN; END IF;
    SELECT * INTO ledger FROM "ResourceOccupancy" WHERE "blockId" = source_id;
  END IF;
  IF NOT FOUND OR ledger."occupiedStart" > source_start OR ledger."occupiedEnd" < source_end
    OR ledger."active" <> source_active THEN
    RAISE EXCEPTION 'Occupancy must cover its source and match its active state'
      USING ERRCODE = '23514', CONSTRAINT = 'ResourceOccupancy_source_consistency';
  END IF;
END;
$$;

CREATE FUNCTION enforce_source_occupancy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'Booking' THEN
    PERFORM verify_occupancy('booking', NEW."id");
  ELSIF TG_TABLE_NAME = 'ResourceBlock' THEN
    PERFORM verify_occupancy('block', NEW."id");
  ELSE
    IF TG_OP <> 'INSERT' THEN
      IF OLD."bookingId" IS NOT NULL THEN PERFORM verify_occupancy('booking', OLD."bookingId"); END IF;
      IF OLD."blockId" IS NOT NULL THEN PERFORM verify_occupancy('block', OLD."blockId"); END IF;
    END IF;
    IF TG_OP <> 'DELETE' THEN
      IF NEW."bookingId" IS NOT NULL THEN PERFORM verify_occupancy('booking', NEW."bookingId"); END IF;
      IF NEW."blockId" IS NOT NULL THEN PERFORM verify_occupancy('block', NEW."blockId"); END IF;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "Booking_occupancy_required" AFTER INSERT OR UPDATE ON "Booking"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_source_occupancy();
CREATE CONSTRAINT TRIGGER "ResourceBlock_occupancy_required" AFTER INSERT OR UPDATE ON "ResourceBlock"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_source_occupancy();
CREATE CONSTRAINT TRIGGER "ResourceOccupancy_source_required" AFTER INSERT OR UPDATE OR DELETE ON "ResourceOccupancy"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_source_occupancy();

ALTER TABLE "Game" ADD CONSTRAINT "Game_valid_range_capacity" CHECK (
  "endAt" > "startAt" AND "capacity" >= 1 AND "minimumAttendance" BETWEEN 1 AND "capacity"
);
CREATE UNIQUE INDEX "Game_one_active_per_booking" ON "Game" ("bookingId")
  WHERE "bookingId" IS NOT NULL AND "status" IN ('OPEN', 'CLOSED');
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_valid_token" CHECK (
  "tokenHash" ~ '^[a-f0-9]{64}$' AND "expiresAt" > "createdAt"
);
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_valid_result" CHECK (
  "requestHash" ~ '^[a-f0-9]{64}$' AND "expiresAt" > "createdAt" AND "statusCode" BETWEEN 200 AND 599
);
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_valid_lease" CHECK (
  "attempts" >= 0 AND
  (("status" = 'PROCESSING' AND "leaseToken" IS NOT NULL AND "leaseUntil" IS NOT NULL) OR
   ("status" <> 'PROCESSING' AND "leaseToken" IS NULL AND "leaseUntil" IS NULL)) AND
  (("status" = 'DELIVERED') = ("deliveredAt" IS NOT NULL)) AND jsonb_typeof("payload") = 'object'
);
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_object_payload" CHECK (jsonb_typeof("payload") = 'object');
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_object_metadata" CHECK (jsonb_typeof("metadata") = 'object');
CREATE FUNCTION reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit events are append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER "AuditEvent_append_only" BEFORE UPDATE OR DELETE ON "AuditEvent"
  FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
