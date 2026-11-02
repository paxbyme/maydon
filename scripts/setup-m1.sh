#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

expected_node="$(cat .nvmrc)"
if [ "$(node -p 'process.versions.node')" != "$expected_node" ]; then
  # Use the already-installed compatible runtime on this development machine.
  if [ -x /usr/local/opt/node@22/bin/node ] && [ "$(/usr/local/opt/node@22/bin/node -p 'process.versions.node')" = "$expected_node" ]; then
    export PATH="/usr/local/opt/node@22/bin:$PATH"
  else
    echo "Select Node $expected_node before running setup (see .nvmrc)." >&2
    exit 1
  fi
fi
flutter --version

if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Generate platform runners separately so Flutter cannot overwrite app source.
if [ ! -d apps/player/android ] || [ ! -d apps/player/ios ]; then
  platform_tmp="$(mktemp -d "${TMPDIR:-/tmp}/maydon-platforms.XXXXXX")"
  trap 'rm -rf -- "$platform_tmp"' EXIT
  flutter create --platforms=android,ios --project-name maydon_player --org uz.maydon --no-pub "$platform_tmp/player"
  for platform in android ios; do
    if [ ! -e "apps/player/$platform" ]; then
      cp -R "$platform_tmp/player/$platform" "apps/player/$platform"
    fi
  done
  if [ ! -e apps/player/.metadata ]; then
    cp "$platform_tmp/player/.metadata" apps/player/.metadata
  fi
fi

for package in localization design_system api_client; do
  (cd "packages/$package" && flutter pub get)
done
(cd packages/localization && flutter gen-l10n)
for app in player owner admin; do
  (cd "apps/$app" && flutter pub get)
done

# Establish the formatting baseline; subsequent verification is check-only.
npm run format
dart format apps/player/lib apps/player/test apps/owner/lib apps/owner/test apps/admin/lib apps/admin/test packages/api_client/lib/api_client.dart packages/design_system/lib/design_system.dart packages/localization/lib/localization.dart
printf '\nM1 dependencies and platform files prepared. Run bash scripts/verify-m1.sh next.\n'
