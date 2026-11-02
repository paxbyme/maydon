# Security requirements

M3 implements backend identity, single-use challenges, Argon2id, 15-minute access tokens, rotating 30-day sessions and resource-scoped access. See [identity design](identity.md) for concrete controls and remaining operational gates. Flutter secure credential storage and authentication UI follow in M4.

Admin MFA is mandatory. Engineers use separate audited infrastructure identity. Every protected action checks server-side ownership and explicit resource assignments. Verification uses distributed throttling, resend and attempt limits, expiry and anti-enumeration responses. Log request IDs and structured events, never credentials, OTPs, contacts or invitation links.

Verification evidence is private with authorized short-lived downloads. Images require limits, decode/re-encode, metadata stripping and quarantine. Notifications use a transactional outbox plus durable inbox and delivery deduplication. Production refuses local test adapters. Threat modeling, abuse tests, dependency/secret scanning and restore validation are launch gates. Retention, data location, privacy/terms and support ownership require decisions before release.

## Foundation dependency remediation

NestJS common/core/platform-express are pinned to 11.2.8 and Swagger to 11.4.7. Scoped npm overrides select Multer 2.5.0 and js-yaml 5.5.0 because those Nest packages pin older transitive releases. These stay within the dependencies' existing major versions. Remove the overrides once the parent packages select patched versions themselves; re-run the endpoint, OpenAPI and audit checks on every change.

References: [Multer pending-filter denial of service](https://github.com/advisories/GHSA-q7qp-rjg7-q26m), [js-yaml merge-limit bypass](https://github.com/advisories/GHSA-r3ph-w7gj-g6xm). CI fails on moderate-or-higher npm audit findings. Installation during bootstrap used the existing Node 20 npm with engine strictness disabled only for dependency resolution; application acceptance uses pinned Node 22.23.1 in Docker/CI.

Prisma 6.19.3's configuration helper pins a vulnerable deepmerge-ts 7 release. A scoped override selects 8.0.0, the [patched release](https://github.com/advisories/GHSA-ggr8-5vv4-36mx). This is a transitive major change: its [release notes](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0) change Map merging and custom metadata types. MAYDON uses the Prisma schema configuration, not custom Map-merging configuration; validation, generation, migration and integration tests exercise the CLI before accepting this override. Runtime Prisma remains pinned to 6.19.3. No release-candidate upgrade is used.

Local/test PostgreSQL configurations omit error details and failing SQL statements from server logs, preventing unique/check constraint failures from copying contact values into logs. Application errors also return generic codes and server-generated request IDs.
