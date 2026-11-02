-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('uz', 'ru', 'en');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('PLAYER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "StaffPreset" AS ENUM ('MANAGER', 'BOOKING_CLERK', 'VIEWER');

-- CreateEnum
CREATE TYPE "BookingOrigin" AS ENUM ('CUSTOMER', 'STAFF');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED_BY_USER', 'CANCELLED_BY_OWNER', 'CANCELLED_BY_ADMIN', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "GameVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('OPEN', 'CLOSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'DEAD');

-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'PUSH');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'uz',
    "emailVerifiedAt" TIMESTAMPTZ(3),
    "phone" VARCHAR(20),
    "phoneVerifiedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" UUID NOT NULL,
    "role" "PlatformRole" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","role")
);

-- CreateTable
CREATE TABLE "OwnerProfile" (
    "id" UUID NOT NULL,
    "legalName" VARCHAR(200) NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "OwnerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerMembership" (
    "ownerId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnerMembership_pkey" PRIMARY KEY ("ownerId","userId")
);

-- CreateTable
CREATE TABLE "Facility" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "city" VARCHAR(100) NOT NULL DEFAULT 'Namangan',
    "address" VARCHAR(500) NOT NULL,
    "timezone" VARCHAR(100) NOT NULL DEFAULT 'Asia/Tashkent',
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "status" "ReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityTranslation" (
    "facilityId" UUID NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "FacilityTranslation_pkey" PRIMARY KEY ("facilityId","locale")
);

-- CreateTable
CREATE TABLE "BookableResource" (
    "id" UUID NOT NULL,
    "facilityId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "BookableResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sport" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SportTranslation" (
    "sportId" UUID NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "SportTranslation_pkey" PRIMARY KEY ("sportId","locale")
);

-- CreateTable
CREATE TABLE "ResourceSport" (
    "resourceId" UUID NOT NULL,
    "sportId" UUID NOT NULL,

    CONSTRAINT "ResourceSport_pkey" PRIMARY KEY ("resourceId","sportId")
);

-- CreateTable
CREATE TABLE "StaffAssignment" (
    "userId" UUID NOT NULL,
    "resourceId" UUID NOT NULL,
    "grantedById" UUID NOT NULL,
    "preset" "StaffPreset" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAssignment_pkey" PRIMARY KEY ("userId","resourceId")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(32) NOT NULL,
    "resourceId" UUID NOT NULL,
    "customerId" UUID,
    "recordedById" UUID NOT NULL,
    "origin" "BookingOrigin" NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "priceMinor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'UZS',
    "priceSnapshot" JSONB NOT NULL,
    "cancellationCutoffMinutes" INTEGER NOT NULL,
    "policySnapshot" JSONB NOT NULL,
    "customerName" VARCHAR(100),
    "customerContact" VARCHAR(100),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceBlock" (
    "id" UUID NOT NULL,
    "resourceId" UUID NOT NULL,
    "recordedById" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ResourceBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceOccupancy" (
    "id" UUID NOT NULL,
    "resourceId" UUID NOT NULL,
    "bookingId" UUID,
    "blockId" UUID,
    "occupiedStart" TIMESTAMPTZ(3) NOT NULL,
    "occupiedEnd" TIMESTAMPTZ(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceOccupancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingStatusHistory" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "actorId" UUID,
    "status" "BookingStatus" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" UUID NOT NULL,
    "hostId" UUID NOT NULL,
    "sportId" UUID NOT NULL,
    "bookingId" UUID,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "location" VARCHAR(500) NOT NULL,
    "visibility" "GameVisibility" NOT NULL DEFAULT 'PUBLIC',
    "status" "GameStatus" NOT NULL DEFAULT 'OPEN',
    "venueConfirmed" BOOLEAN NOT NULL DEFAULT true,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "minimumAttendance" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameParticipant" (
    "gameId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameParticipant_pkey" PRIMARY KEY ("gameId","userId")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "operation" VARCHAR(100) NOT NULL,
    "key" VARCHAR(200) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "response" JSONB NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" UUID NOT NULL,
    "eventKey" VARCHAR(200) NOT NULL,
    "recipientId" UUID NOT NULL,
    "channel" "DeliveryChannel" NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseToken" UUID,
    "leaseUntil" TIMESTAMPTZ(3),
    "lastErrorCode" VARCHAR(100),
    "deliveredAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "deliveryKey" VARCHAR(200) NOT NULL,
    "userId" UUID NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "OwnerProfile_status_createdAt_idx" ON "OwnerProfile"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OwnerMembership_userId_idx" ON "OwnerMembership"("userId");

-- CreateIndex
CREATE INDEX "Facility_ownerId_status_idx" ON "Facility"("ownerId", "status");

-- CreateIndex
CREATE INDEX "Facility_city_status_deletedAt_idx" ON "Facility"("city", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "BookableResource_facilityId_deletedAt_idx" ON "BookableResource"("facilityId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Sport_slug_key" ON "Sport"("slug");

-- CreateIndex
CREATE INDEX "ResourceSport_sportId_idx" ON "ResourceSport"("sportId");

-- CreateIndex
CREATE INDEX "StaffAssignment_resourceId_idx" ON "StaffAssignment"("resourceId");

-- CreateIndex
CREATE INDEX "StaffAssignment_grantedById_idx" ON "StaffAssignment"("grantedById");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_reference_key" ON "Booking"("reference");

-- CreateIndex
CREATE INDEX "Booking_customerId_startAt_idx" ON "Booking"("customerId", "startAt");

-- CreateIndex
CREATE INDEX "Booking_resourceId_startAt_status_idx" ON "Booking"("resourceId", "startAt", "status");

-- CreateIndex
CREATE INDEX "Booking_recordedById_idx" ON "Booking"("recordedById");

-- CreateIndex
CREATE INDEX "Booking_status_endAt_idx" ON "Booking"("status", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_id_resourceId_key" ON "Booking"("id", "resourceId");

-- CreateIndex
CREATE INDEX "ResourceBlock_resourceId_startAt_idx" ON "ResourceBlock"("resourceId", "startAt");

-- CreateIndex
CREATE INDEX "ResourceBlock_recordedById_idx" ON "ResourceBlock"("recordedById");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceBlock_id_resourceId_key" ON "ResourceBlock"("id", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceOccupancy_bookingId_key" ON "ResourceOccupancy"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceOccupancy_blockId_key" ON "ResourceOccupancy"("blockId");

-- CreateIndex
CREATE INDEX "ResourceOccupancy_resourceId_occupiedStart_idx" ON "ResourceOccupancy"("resourceId", "occupiedStart");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceOccupancy_bookingId_resourceId_key" ON "ResourceOccupancy"("bookingId", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceOccupancy_blockId_resourceId_key" ON "ResourceOccupancy"("blockId", "resourceId");

-- CreateIndex
CREATE INDEX "BookingStatusHistory_bookingId_createdAt_idx" ON "BookingStatusHistory"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "BookingStatusHistory_actorId_idx" ON "BookingStatusHistory"("actorId");

-- CreateIndex
CREATE INDEX "Game_hostId_startAt_idx" ON "Game"("hostId", "startAt");

-- CreateIndex
CREATE INDEX "Game_sportId_visibility_status_startAt_idx" ON "Game"("sportId", "visibility", "status", "startAt");

-- CreateIndex
CREATE INDEX "Game_bookingId_idx" ON "Game"("bookingId");

-- CreateIndex
CREATE INDEX "GameParticipant_userId_idx" ON "GameParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_gameId_idx" ON "Invitation"("gameId");

-- CreateIndex
CREATE INDEX "Invitation_createdById_idx" ON "Invitation"("createdById");

-- CreateIndex
CREATE INDEX "Invitation_expiresAt_idx" ON "Invitation"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_createdAt_idx" ON "AuditEvent"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "AuditEvent"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_requestId_idx" ON "AuditEvent"("requestId");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_actorId_operation_key_key" ON "IdempotencyRecord"("actorId", "operation", "key");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_eventKey_key" ON "OutboxEvent"("eventKey");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_availableAt_idx" ON "OutboxEvent"("status", "availableAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_leaseUntil_idx" ON "OutboxEvent"("status", "leaseUntil");

-- CreateIndex
CREATE INDEX "OutboxEvent_recipientId_idx" ON "OutboxEvent"("recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_deliveryKey_key" ON "Notification"("deliveryKey");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerMembership" ADD CONSTRAINT "OwnerMembership_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "OwnerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerMembership" ADD CONSTRAINT "OwnerMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facility" ADD CONSTRAINT "Facility_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "OwnerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityTranslation" ADD CONSTRAINT "FacilityTranslation_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookableResource" ADD CONSTRAINT "BookableResource_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SportTranslation" ADD CONSTRAINT "SportTranslation_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceSport" ADD CONSTRAINT "ResourceSport_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "BookableResource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceSport" ADD CONSTRAINT "ResourceSport_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "BookableResource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "BookableResource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceBlock" ADD CONSTRAINT "ResourceBlock_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "BookableResource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceBlock" ADD CONSTRAINT "ResourceBlock_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceOccupancy" ADD CONSTRAINT "ResourceOccupancy_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "BookableResource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceOccupancy" ADD CONSTRAINT "ResourceOccupancy_bookingId_resourceId_fkey" FOREIGN KEY ("bookingId", "resourceId") REFERENCES "Booking"("id", "resourceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceOccupancy" ADD CONSTRAINT "ResourceOccupancy_blockId_resourceId_fkey" FOREIGN KEY ("blockId", "resourceId") REFERENCES "ResourceBlock"("id", "resourceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingStatusHistory" ADD CONSTRAINT "BookingStatusHistory_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingStatusHistory" ADD CONSTRAINT "BookingStatusHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

