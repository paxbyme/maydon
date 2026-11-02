#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
if [ "$#" -ne 0 ]; then
  echo 'Usage: bash scripts/verify-m1.sh' >&2
  exit 2
fi
expected_node="$(cat .nvmrc)"
if [ "$(node -p 'process.versions.node')" != "$expected_node" ] && [ -x /usr/local/opt/node@22/bin/node ]; then
  export PATH="/usr/local/opt/node@22/bin:$PATH"
fi
npm run preflight
npm ci
npm run foundation:check
npm run localization:check
npm run secrets:check
npm run format:check
npm run typecheck
npm test
npm run build
npm run openapi

for package in localization design_system api_client; do
  (cd "packages/$package" && flutter pub get --enforce-lockfile)
done
(cd packages/localization && flutter gen-l10n)
for app in player owner admin; do
  (cd "apps/$app" && flutter pub get --enforce-lockfile && flutter analyze && flutter test && flutter build web)
done
for package in localization design_system api_client; do
  (cd "packages/$package" && flutter analyze)
done
dart format --output=none --set-exit-if-changed apps/player/lib apps/player/test apps/owner/lib apps/owner/test apps/admin/lib apps/admin/test packages/api_client/lib/api_client.dart packages/design_system/lib/design_system.dart packages/localization/lib/localization.dart
(cd apps/player && flutter build apk --debug)
if [ "$(uname -s)" != Darwin ]; then
  echo 'M1 iOS verification requires macOS/Xcode. Run the iOS CI job before accepting M1.' >&2
  exit 1
fi
(cd apps/player && flutter build ios --no-codesign)

# Use a dedicated Compose project; cleanup never removes existing development data.
compose=(docker compose --env-file infra/verification.env -p maydon-m1-check -f infra/compose.yaml)
cleanup() {
  result=$?
  trap - EXIT
  if [ "$result" -ne 0 ]; then "${compose[@]}" logs --no-color || true; fi
  "${compose[@]}" down || true
  exit "$result"
}
trap cleanup EXIT
"${compose[@]}" up --build --wait -d
"${compose[@]}" exec -T api node scripts/smoke-api.mjs
printf '\nLocal M1 checks passed. Review dependency advisories and run full Gitleaks/CI before accepting M1.\n'
