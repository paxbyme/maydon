# Database design

M2 introduces the first reviewed migration. M1 does not pretend to provide a booking schema.

Use UUID IDs, foreign keys, timestamps, constrained enums and ownership indexes. Store instants as UTC `timestamptz`; calendar rules retain facility-local wall time and IANA timezone. Money is integer minor units with ISO currency; JSON transports large values as strings. Booking price and cancellation policies are immutable snapshots.

```mermaid
erDiagram
 USER ||--o{ SESSION : authenticates
 USER ||--o{ USER_ROLE : receives
 USER ||--o{ OWNER_MEMBERSHIP : belongs_to
 OWNER_PROFILE ||--o{ OWNER_MEMBERSHIP : authorizes
 OWNER_PROFILE ||--o{ FACILITY : operates
 USER ||--o{ STAFF_ASSIGNMENT : receives
 BOOKABLE_RESOURCE ||--o{ STAFF_ASSIGNMENT : scopes
 FACILITY ||--o{ FACILITY_TRANSLATION : localizes
 FACILITY ||--o{ BOOKABLE_RESOURCE : contains
 BOOKABLE_RESOURCE ||--o{ RESOURCE_SPORT : supports
 SPORT ||--o{ RESOURCE_SPORT : categorizes
 BOOKABLE_RESOURCE ||--o{ PRICE_RULE : prices
 BOOKABLE_RESOURCE ||--o{ RESOURCE_OCCUPANCY : reserves
 BOOKING ||--|| RESOURCE_OCCUPANCY : occupies
 RESOURCE_BLOCK ||--|| RESOURCE_OCCUPANCY : occupies
 USER o|--o{ BOOKING : places
 BOOKING ||--o{ BOOKING_STATUS_HISTORY : records
 BOOKING o|--o| GAME : anchors
 USER ||--o{ GAME : hosts
 GAME ||--o{ GAME_PARTICIPANT : contains
 USER ||--o{ GAME_PARTICIPANT : joins
 GAME ||--o{ INVITATION : grants_access
 BOOKING ||--o| REVIEW : qualifies
```

Supporting tables: verification/recovery challenges, operating periods/exceptions, favorites, notification inbox, delivery outbox, media/quarantine, reports, audit events and operation-scoped booking idempotency. Offline reservations optionally link a customer account and require the recording actor plus minimal customer name/contact snapshot.

Use `btree_gist` with an exclusion constraint on `(resource_id WITH =, tstzrange(occupied_start, occupied_end, '[)') WITH &&)` for active occupancy. Occupancy covers reservations AND blocks, including buffers. Add checks for positive ranges and an exclusive booking/block source. Lock the resource for all occupancy/scheduling mutations. Review raw SQL for features Prisma cannot represent. Real PostgreSQL tests are mandatory.

Soft-delete published entities with historical references. Expire/delete temporary credentials and invitations. Final retention periods remain a production policy gate.
