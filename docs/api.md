# API contract

All routes are under `/api/v1`; public OpenAPI is generated into `docs/openapi.json`. M3 adds identity and explicit resource staff assignment routes. Booking and game APIs remain pending. Health is process liveness, not database/Redis readiness.

Implemented identity routes: register, email resend/verify, phone request/verify, login, refresh, logout, password forgot/reset, own profile, session revocation and MFA setup/confirm/verify. Staff PUT/DELETE routes are scoped to the owning business. See [identity](identity.md).

Later groups: facilities/resources (search/detail/localization/setup/prices/calendars); availability/quotes; bookings (create/own list/detail/cancel, scoped offline creation/attendance); games (create/discover/edit/join/leave/cancel/invite/replacement); engagement (favorites/reviews/inbox/reports); administration (verification/publication/moderation/sports/audits).

Every business route must document principal, ownership and resource scope. Use validated DTOs, allowlisted sorting, cursor pagination and bounded time ranges. Standard errors contain code, message, requestId and optional field errors, without secrets or contacts. Return 409 for occupancy, capacity, reused idempotency keys with different input, and stale quotes. Booking creation requires `Idempotency-Key` scoped to actor and operation; identical retries replay the original outcome.

Generate Dart models/client from the OpenAPI document and fail CI on drift. Business endpoints and client models must be introduced together. Never accept identity or role claims from client-supplied request bodies as authorization.

M2 adds a server-generated UUID `X-Request-Id` header and consistent `{code, message, requestId}` errors. Unknown errors never echo exception text, database detail, URLs or submitted credentials. PostgreSQL/Prisma integrity conflicts map to HTTP 409. Route-level field errors will be added alongside validated business DTOs.

## Business applications

Owner submission and administrator review endpoints are implemented; see [M5](milestones/M5.md) for routes, scopes and limits. Private evidence is omitted from lists, audited on read and never exposed publicly. Private facility draft creation/listing/editing is available to owning business members; publication, public discovery, booking and game APIs remain pending.
