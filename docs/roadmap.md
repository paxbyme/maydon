# Roadmap and gates

Each milestone records files changed, data/API changes, executed verification, remaining work and risks. Critical acceptance failures stop progression; a scaffold is not an accepted milestone.

| Gate | Deliverables                                                          | Required acceptance                                              | State                      |
| ---- | --------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------- |
| M0   | PRD, journeys, permissions, architecture, ERD, decisions, roadmap     | Traceability and launch decisions recorded                       | Baseline recorded          |
| M1   | Git, apps/shared packages, CI, Docker, toolchain pins, health/version | Reproducible build, formatting, analysis, secret checks          | See M1 report              |
| M2   | Core schema, SQL constraints, errors, audit/outbox                    | Fresh real-PostgreSQL migration, integrity and retry tests       | Pending                    |
| M3   | Identity, verification/recovery, sessions, scope, locale              | Rotation/reuse/revocation, OTP abuse, cross-owner denial         | Pending                    |
| M4   | Shared design and three navigations, API client                       | Widget, responsive, accessibility, locale and journey navigation | Pending                    |
| M5   | Sports, applications, approvals, media/discovery                      | Publication/ownership, upload validation, filters                | Pending                    |
| M6   | Resources, prices, calendars, exceptions, blocks/availability         | Overnight/timezone/buffer/block/scope tests                      | Pending                    |
| M7   | App/offline bookings, cancellations/history/attendance                | Real concurrent races, idempotency, snapshots, journey           | Pending                    |
| M8   | Public/private games, invites, capacity, linked cancellation          | Final-place race, privacy/revocation, venue changes              | Pending; required for MVP  |
| M9   | Owner operations, staff/calendar/booked-value reports                 | Reconciliation and permission boundaries                         | Pending                    |
| M10  | Inbox, email/push, favorites/reviews                                  | Outbox recovery, authorization and eligibility                   | Pending                    |
| M11  | Administration/moderation/audit                                       | Privileges, complete audit, sensitive access                     | Pending                    |
| M12  | Security/load/resilience/accessibility/recovery                       | Cross-platform suite, load, restore, threat model                | Pending                    |
| M13  | Approved providers, signing, stores, deployment/runbooks              | Staging smoke, rollback, monitoring, launch checklist            | Pending external decisions |

Critical path: identity → facility/resource configuration → booking integrity → games → operational validation. Do not begin later milestones by bypassing failed required checks.
