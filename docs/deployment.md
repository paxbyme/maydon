# Deployment and operations

No provider is selected and no public deployment is authorized. M1 Compose is a local development foundation only. It must not be exposed to the internet. Production requires secrets from an approved secret store, private database/Redis access, TLS, trusted origins, real delivery/media/map adapters and a readiness endpoint that checks required dependencies.

Before launch: approve provider budget/region/retention, domain, certificates, email/SMS coverage, object storage privacy, FCM, signing/store identities, support and privacy/terms. Stage migrations against a restored production-shaped backup; review SQL. Deploy compatible application/worker versions, apply reviewed migrations once, smoke test identity → booking → game and monitor outbox.

Rollback: prefer compatible application rollback; destructive schema changes require staged expand/contract and a reviewed recovery procedure. Rehearse restore and verify row counts, occupancy constraints, auth/session validity policy and notification deduplication. Proposed RPO 1h/RTO 4h must be measured. Alert on backup freshness and conduct restore drills. Exact commands and credentials await the selected hosting provider in M13.
