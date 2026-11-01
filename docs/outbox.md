# Transactional outbox foundation

M2 implements the durable in-app delivery channel. Booking/game services will insert outbox events through `OutboxService.enqueue(tx, input)` inside the same transaction as their business mutation. A unique event key prevents duplicate insertion. This does not yet implement business notifications or external providers.

The worker claims one available event using PostgreSQL `FOR UPDATE SKIP LOCKED`. Each claim increments its attempt count and receives a fresh UUID lease token for 30 seconds. An expired claim can be recovered after a crash. Inbox insertion and marking the event delivered share a transaction, protected by a row lock and an unexpired matching lease token. A stale worker cannot acknowledge, fail or deliver a replacement lease. Inbox delivery keys are unique as a second deduplication boundary.

Failures use bounded exponential backoff (2^attempt seconds, capped at one hour), up to eight attempts. Exhaustion becomes a retained DEAD event, including a crash on the final attempt. Only allowlisted error codes are persisted; exception text and delivery credentials are not stored. Email/SMS/push events currently fail explicitly with DELIVERY_ADAPTER_UNAVAILABLE and retry/dead-letter normally; they never pretend delivery succeeded.

M3/M10 add real adapters and channel-specific idempotency. External sends will be at-least-once unless the provider supports an idempotency key: a crash after external delivery but before database acknowledgement can cause a retry. Durable inbox state remains authoritative.

Worker shutdown stops new claims and waits for the current iteration before disconnecting Prisma. Database polling failures emit a generic code without payloads. Dead-letter review/replay endpoints are not exposed in M2; future administrative replay must be authorized and audited.
