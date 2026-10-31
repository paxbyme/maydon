# Product requirements — M0 baseline

The user's implementation instruction authorizes work on the supplied plan. Proposed defaults below are implementation assumptions, not evidence of separate business approval. Public release remains gated.

## Confirmed scope

MAYDON connects players, facilities and games. Launch city is **Namangan**, currency **UZS**, scheduling timezone **Asia/Tashkent**. Player platforms are Android, iOS and responsive web. Owner and administrator interfaces are separate responsive web apps. All interfaces support Uzbek Latin, Russian and English.

Registration uses email/password and verified email. SMS-verified phone is additionally required before customer booking. Owners submit evidence for manual review; each facility needs separate publication approval. Reservations confirm instantly without online payments. Resources have owner-defined durations, start intervals and cancellation cutoffs. Staff can record telephone and walk-in reservations. Public games allow instant join and leave before start; private games use revocable links. Cancellation of a linked reservation keeps the game, marks its venue unconfirmed and pauses joins. Employees receive presets scoped to explicitly assigned resources. No-shows are recorded, audited and reviewed without automatic penalties.

Excluded: payments, commissions, subscriptions, advertising, chat, leagues, recurring customer bookings, cost splitting, and automatic no-show penalties. Hosting and monetization remain undecided. Find Players and synchronized map/list discovery are mandatory MVP features.

## Journeys

| Actor            | Required journey                                                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Player booking   | Browse → filter → inspect availability, quote and policy → authenticate/verify → confirm → receive reference → manage reservation               |
| Player community | Discover public game or open invitation → inspect rules/location/count → join → receive changes → leave before start                            |
| Host             | Create standalone or link owned booking → publish/share → manage participants → explicitly confirm replacement venue after booking cancellation |
| Owner            | Register → submit evidence → configure facilities/resources/calendars/prices/policies → obtain approval → manage app and offline bookings       |
| Administrator    | Review with reasons → moderate reports → investigate with audit trail                                                                           |

Player navigation: Home, Explore, Find Players, Bookings, Profile. Validate representative booking/game tasks before M4 acceptance. Explore filters sport, distance, price, rating, date and availability; location permission is optional and manual city selection always works. Facility detail includes localized information, photos, amenities, resources, hours, price, cancellation terms and reviews. Reports must call totals **booked value**, never received revenue without collection records.

## Permission matrix

| Principal      | Allowed scope                                                                             |
| -------------- | ----------------------------------------------------------------------------------------- |
| Guest          | Published facilities, sports and public games; no private contacts                        |
| Player         | Own profile, bookings, favorites, eligible reviews and game participation                 |
| Host           | Own game configuration, invitations, removal with reason, cancellation                    |
| Owner          | Own business and explicitly assigned facilities/resources; staff management               |
| Manager        | Assigned resource configuration, calendars, bookings and statistics                       |
| Booking clerk  | Assigned calendars, manual bookings, cancellations, attendance                            |
| Viewer         | Assigned read-only operations, without customer contact                                   |
| Platform admin | Explicitly authorized business administration, moderation and investigation; MFA required |
| Engineer       | Controlled infrastructure identity; no automatic business/customer privileges             |

Permissions are additive. Ownership never grants another business's resources. Managers/clerks see contacts only when operationally necessary. Staff assignment cannot exceed the assigning owner's scope.

## Proposed defaults retained from the plan

1. Each resource belongs to one facility and supports one or more database-managed sports.
2. Facility hours constrain resource hours; overnight periods are supported.
3. Publication requires explicit durations, interval, advance window, notice, buffers and cancellation cutoff.
4. Base rates plus weekday/time bands; reject overlapping bands.
5. Confirmations show complete quotes; price changes require renewed confirmation.
6. One host occupies a seat. Minimum attendance includes the host and is informational.
7. Verified email is required to create/join games; booking also requires verified phone.
8. Only the booking customer can link it; one active game per booking, with compatible sport and times.
9. Removal requires a reason/notification; capacity cannot fall below occupancy.
10. No participant payments or cost splitting.
11. One review per completed customer booking; no cancelled/no-show reviews.
12. Ownership/address changes require renewed publication review; existing reservations need explicit resolution.

## Requirements traceability

| Requirement                             | Implementation gate | Evidence required                                              |
| --------------------------------------- | ------------------- | -------------------------------------------------------------- |
| Identity and scoped access              | M3                  | Rotation/reuse, verification abuse, cross-owner denial         |
| Three accessible localized clients      | M4, M12             | Navigation, semantics, locale, layout and device journeys      |
| Reviewed facilities and discovery/map   | M5, M13             | Publication/ownership/media/filter/provider tests              |
| Correct schedules and quotes            | M6                  | Overnight, exceptions, DST, buffer, price and scope tests      |
| Reliable app/offline booking            | M7                  | Real PostgreSQL races, replay, policy snapshots and lifecycle  |
| Public/private Find Players             | M8                  | Final-seat race, invite privacy, revocation, venue replacement |
| Owner operations and booked value       | M9                  | Reconciliation and staff permission boundaries                 |
| Durable notifications/reviews/favorites | M10                 | Outbox recovery and eligibility/authorization                  |
| Moderation and auditing                 | M11                 | Privilege and sensitive-access coverage                        |
| Resilience and launch readiness         | M12–M13             | Load, backup restore, rollback, cross-platform smoke           |
