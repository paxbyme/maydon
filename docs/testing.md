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

## Database and worker foundation

Run `docker compose -p maydon-m2-test -f infra/compose.test.yaml up --build --abort-on-container-exit --exit-code-from tests` for fresh migrations and real PostgreSQL integrity/recovery tests. Clean up that isolated test project with `docker compose -p maydon-m2-test -f infra/compose.test.yaml down -v`. The test service uses no host ports and no persistent named volume. Direct test execution refuses any database without the `_test` suffix and explicit MAYDON_TEST_DATABASE=true.

Coverage includes 50 distinct customers racing for one interval, booking/block races, half-open buffered occupancy, source/ledger consistency, atomic cancellation, immutable snapshots/audits, transactional outbox rollback, concurrent worker claims, expired lease fencing, retry/dead-letter behavior and scoped idempotency uniqueness. These are foundation tests; full authenticated booking/game journeys remain M7/M8 requirements.
