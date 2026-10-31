# Game management

M8 is mandatory for MVP launch. A game may stand alone or link a booking owned by the host. One active game per booking; initial sport/times fit that booking. The host occupies one seat; minimum attendance is informational. Lifecycle is OPEN → CLOSED → COMPLETED, with cancellation before completion. Capacity is independent of lifecycle.

Lock the game row for join/leave/configuration. Unique `(game_id, user_id)` participation plus capacity checks must hold in the transaction. Repeated joins are idempotent. Join/create requires verified email. Leave only before start. Hosts remove participants with a reason and notification and cannot reduce capacity below occupied places.

Private invitations use high-entropy hashed tokens, expiry and revocation. Authentication plus membership/valid invitation is required for private detail and participant access. A token grants access, never a seat. Do not leak private game existence through search or invalid-link responses.

Cancelled linked bookings leave participants enrolled and mark venue unconfirmed. Joining remains paused until the host explicitly confirms a replacement. Every material change creates durable notifications. No chat, participant payments or cost splitting.
