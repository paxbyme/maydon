ALTER TABLE "FacilityTranslation" ADD COLUMN "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "SportTranslation" ADD COLUMN "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ResourceSport" ADD COLUMN "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE FUNCTION protect_booking_snapshots() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW."priceMinor", NEW."currency", NEW."priceSnapshot", NEW."cancellationCutoffMinutes", NEW."policySnapshot")
    IS DISTINCT FROM
     ROW(OLD."priceMinor", OLD."currency", OLD."priceSnapshot", OLD."cancellationCutoffMinutes", OLD."policySnapshot") THEN
    RAISE EXCEPTION 'Confirmed price and policy snapshots are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Booking_immutable_snapshots" BEFORE UPDATE ON "Booking"
  FOR EACH ROW EXECUTE FUNCTION protect_booking_snapshots();
-- Defaults only backfill existing rows; subsequent update timestamps are managed by Prisma.
ALTER TABLE "FacilityTranslation" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "SportTranslation" ALTER COLUMN "updatedAt" DROP DEFAULT;
