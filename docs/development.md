# Development

## Current state

M0 is documented. M1 is an incomplete, unverified foundation; see [M1 results](milestones/M1.md). There are no functioning booking/game/authentication features. Missing lockfiles and native runners are deliberate failed gates, not files to bypass in CI.

Provisional pins: Node 22.23.1, NestJS 11.2.8, TypeScript 5.9.3, Flutter 3.35.5 / Dart 3.9.2. Node 22.23.1 was executable locally; the other pins require dependency resolution and a clean build before acceptance. Current Nest documentation describes newer releases; these pins are a conservative starting set, not a claim that the newest versions were tested. Review security advisories before accepting pins. Prisma/PostgreSQL integration arrives in M2; Redis/FCM/S3 adapters arrive at their respective milestones.

## Automated M1 setup and verification

Your successful player Chrome launch confirms localization generation works in your terminal. To prepare the other apps and native runners, then execute the local M1 suite, run from the repository root:

```bash
bash scripts/complete-m1.sh
```

This uses the pinned Node runtime (including the existing Homebrew Node 22 installation if needed), installs dependencies, generates missing Android/iOS folders in a temporary project without replacing app source, generates localization, formats source, and runs checks/builds. It stops at the first failure and saves terminal output to `.cache/m1-verification.log`. Flutter, registry access, Android SDK, macOS/Xcode and a running Docker daemon are required. The scripts do not upgrade toolchains, commit files, provision services or publish applications.

Setup and verification can also run separately with `bash scripts/setup-m1.sh` and `bash scripts/verify-m1.sh`. Verification uses lockfiles and check-only formatting. The container smoke test uses the separate `maydon-m1-check` Compose project and cleans up its containers; existing development volumes are retained. Verification allocates free host ports through infra/verification.env, avoiding collisions with existing local services. Full Gitleaks/CI and dependency advisory review remain required before milestone acceptance.

## Complete M1 in an environment with working toolchains

1. Enable repository metadata writes, package registry DNS/network access, a working Flutter SDK and Docker daemon access. Use `.nvmrc` and `.fvmrc` for candidate versions; no global runtime changes are necessary.
2. Run `git init -b main` if `.git` is absent. Install dependencies with `npm install`, review and retain `package-lock.json`. Subsequent installs and CI use `npm ci`.
3. Generate player native runners with `cd apps/player && flutter create --platforms=android,ios --project-name maydon_player --org uz.maydon .`. Review generated changes and retain the existing application source, dependencies and tests. The organization identifier is provisional and must be confirmed before signing/release.
4. In each shared package run `flutter pub get`; in `packages/localization`, run `flutter gen-l10n`. In each application run `flutter pub get`. Retain all lockfiles. Generated localization sources are build output.
5. Format once with `npm run format` and `dart format apps/player/lib apps/player/test apps/owner/lib apps/owner/test apps/admin/lib apps/admin/test packages`. Review diffs; CI only checks formatting.
6. Run `npm run typecheck`, `npm test`, `npm run build`, `npm run openapi`, and the checks below. In each Flutter app run `flutter analyze`, `flutter test` and `flutter build web`; analyze shared packages. Build player Android and iOS (macOS/Xcode required for iOS).
7. Run `docker compose -f infra/compose.yaml up --build --wait -d`; smoke test `/api/v1/health` and `/api/v1/version`; stop with `docker compose -f infra/compose.yaml down`. Retain the local volume unless intentionally resetting development data.
8. Update M1 evidence and proceed to M2 only after all required checks pass. Add real PostgreSQL integration/concurrency CI in M2 and OpenAPI/Dart contract drift checks with generated client integration in M4.

## Run a Flutter app locally

From the repository root, run:

```bash
bash scripts/run-flutter.sh player -d chrome
```

Replace `player` with `owner` or `admin` for those apps. The script resolves the shared localization package, runs `flutter gen-l10n` there, then resolves and launches the selected application. It stops immediately if a prerequisite fails.

Running `flutter pub get` only inside an application does not generate the shared package's `lib/generated/app_localizations.dart`. If launching manually, first run `flutter pub get` and `flutter gen-l10n` inside `packages/localization`, then return to the app directory. Generated localization files remain ignored; do not replace them with handwritten classes.

## Local commands after dependencies are installed

- `npm run preflight`: aggregate environment, lockfile and native-runner checks (nonzero until M1 prerequisites are satisfied).
- `npm run test:smoke`: verify the running API’s health/version responses and absence of unversioned health; set `MAYDON_API_URL` to change the local base URL.
- `npm run dev:api`: NestJS development API on port 3000.
- `npm run worker`: compiled worker foundation (no delivery handlers yet; run build first).
- `npm run openapi`: compiles TypeScript with decorator metadata, then exports the system endpoint specification to `docs/openapi.json`.
- `flutter run -d chrome` from an app directory: web shell.
- `node scripts/check-foundation.mjs`: manifests, runtime pins, documentation presence.
- `node scripts/check-localization.mjs`: current ARB key/nonempty completeness.
- `node scripts/check-secrets.mjs`: basic patterns; CI also runs Gitleaks.

The dependency-free checks do not prove application correctness. ARB placeholder/type checks are required when parameterized strings are added. The M1 client package only configures Dio; generated business models/operations remain M4 work. App shells contain no booking buttons or mock confirmations.

## Environment and boundaries

Copy `.env.example` only for local reference; the backend currently reads the process environment (it does not automatically load dotenv). Compose supplies its own local configuration. Production startup is explicitly rejected until production gates are implemented. Never expose development Compose ports or credentials publicly. No refresh credentials go into browser storage.

Official references: [Node release support](https://nodejs.org/en/about/previous-releases), [Nest migration/runtime requirements](https://docs.nestjs.com/migration-guide), [Flutter archive](https://docs.flutter.dev/install/archive).
