# API contract

All routes are under `/api/v1`; public OpenAPI is generated into `docs/openapi.json`. M2 still exposes only health and version; no booking/authentication routes are exposed. Health is process liveness, not database/Redis readiness.

Later groups: authentication (register, verify email/phone, login, refresh, logout, reset, revoke); facilities/resources (search/detail/localization/setup/prices/calendars); availability/quotes; bookings (create/own list/detail/cancel, scoped offline creation/attendance); games (create/discover/edit/join/leave/cancel/invite/replacement); engagement (favorites/reviews/inbox/reports); administration (verification/publication/moderation/sports/audits).

Every business route must document principal, ownership and resource scope. Use validated DTOs, allowlisted sorting, cursor pagination and bounded time ranges. Standard errors contain code, message, requestId and optional field errors, without secrets or contacts. Return 409 for occupancy, capacity, reused idempotency keys with different input, and stale quotes. Booking creation requires `Idempotency-Key` scoped to actor and operation; identical retries replay the original outcome.

Generate Dart models/client from the OpenAPI document and fail CI on drift. Business endpoints and client models must be introduced together. Never accept identity or role claims from client-supplied request bodies as authorization.

M2 adds a server-generated UUID `X-Request-Id` header and consistent `{code, message, requestId}` errors. Unknown errors never echo exception text, database detail, URLs or submitted credentials. PostgreSQL/Prisma integrity conflicts map to HTTP 409. Route-level field errors will be added alongside validated business DTOs.
