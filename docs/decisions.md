# Decision register

| ID  | Decision                                                                      | Status                                                       |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------ |
| D01 | Namangan, UZS, Asia/Tashkent; uz/ru/en                                        | Confirmed                                                    |
| D02 | Flutter clients; NestJS/Prisma/PostgreSQL/Redis modular backend               | Confirmed                                                    |
| D03 | Instant reservations without payments; public/private games in MVP            | Confirmed                                                    |
| D04 | Email registration, verified email and booking SMS verification               | Confirmed                                                    |
| D05 | Manual owner evidence and per-facility publication approval                   | Confirmed                                                    |
| D06 | Shared PostgreSQL occupancy exclusion; no Redis correctness dependency        | Required architecture                                        |
| D07 | Business defaults in PRD                                                      | Proposed; retained for implementation, review before release |
| D08 | User's instruction authorizes implementation, not provisioning/public release | Current authorization                                        |
| D09 | Paid providers and monetization                                               | Deferred                                                     |

Launch decisions: hosting budget/provider; SMS coverage/cost; transactional email; map/geocoding integration; private object storage; FCM credentials; data location and retention; privacy/terms; support ownership; store accounts and signing; domain; backup capability. No paid provisioning or public release is authorized.

Proposed operational targets: 99.5% monthly availability, 100 concurrent active sessions, p95 search/availability <1s and reservation mutations <1.5s excluding external delivery, RPO ≤1h, RTO ≤4h. These require validation against budget and are not guarantees.
