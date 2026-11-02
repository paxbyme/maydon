-- Optimistic concurrency protects owner edits from stale tabs.
ALTER TABLE "Facility" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Facility" ADD CONSTRAINT "Facility_revision_positive" CHECK ("revision" > 0);
