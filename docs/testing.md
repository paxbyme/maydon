# Verification strategy

CI checks formatting (without mutation), static analysis, API tests, Flutter widget tests, contract drift and builds. M2 adds fresh-database migration and integration jobs against real PostgreSQL. Never substitute an in-memory database for occupancy/race acceptance.

Required scenarios before launch:

- 50 distinct customers race for the same interval; exactly one succeeds.
- Customer/staff/block races never commit overlapping occupancy.
- Idempotent creation returns the original booking without duplicate history/outbox.
- Cancellation/rebooking races preserve valid occupancy.
- One remaining game seat under concurrent joins admits exactly one participant.
- Owners/employees cannot access unassigned resources/bookings/contacts.
- Policy edits do not change existing cancellation snapshots.
- Expired/invalid private links expose no private game data.
- Delivery failure cannot lose a committed booking.
- uz/ru/en interfaces are complete; Android/iOS/web finish both main journeys.
- Backup restore yields a working app with verified exclusion constraints.

Load: proposed 100 active sessions; p95 search/availability <1 second, mutations <1.5 seconds excluding delivery. Exercise retries, worker restart, database failures, stale quotes and offline clients. Monitor error/latency, saturation, conflicts, outbox delay, verification failures and backup freshness. Record actual outcomes in milestone reports; never equate configured CI with executed CI.
