# Booking engine

M6–M7 implement authoritative availability and booking integrity.

1. Require verified identity/contact for customer creation and assigned-resource permission for staff.
2. Validate idempotency key and canonical request fingerprint, scoped to actor/operation.
3. Begin a transaction; lock the resource row. Revalidate publication, allowed duration/start interval, hours/exceptions, advance window, notice, price and buffers.
4. Require the displayed quote to match current price. Persist price/cancellation snapshots, reservation, shared occupancy, history, audit and outbox atomically.
5. Let the PostgreSQL exclusion constraint reject any overlapping active occupied interval. Return conflict without partial history/delivery. Cache/Redis is never authoritative.
6. Replay identical retries with the original booking/reference; reject different input under the same key.

Booking lifecycle: `CONFIRMED → CANCELLED_BY_USER | CANCELLED_BY_OWNER | CANCELLED_BY_ADMIN | COMPLETED | NO_SHOW`. Cancellation is only before start; customer cancellation also respects snapshotted cutoff. Owner/admin require authorization and reason. Worker completion occurs after end. Authorized corrections between completed/no-show are audited; there are no automatic penalties.

Blocks cannot displace bookings. Scheduling edits cannot invalidate confirmed bookings silently. Lock scheduling mutations alongside creation. Hours include overnight periods, local date exceptions, facility/resource intersection, DST gaps/ambiguity (require offset for ambiguity; reject nonexistent times), buffers and bounded booking windows.

Linked cancellation atomically marks the game's venue unconfirmed, pauses joining and creates participant notifications while preserving memberships. Attendance/review eligibility must follow the resulting booking state.
