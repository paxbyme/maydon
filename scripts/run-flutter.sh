#!/usr/bin/env bash
set -euo pipefail

# Run from any directory; generate the shared package before compiling a client.
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
app="${1:-player}"
if [ "$#" -gt 0 ]; then shift; fi
case "$app" in
  player|owner|admin) ;;
  *) echo 'Usage: bash scripts/run-flutter.sh [player|owner|admin] [flutter run options]' >&2; exit 2 ;;
esac

cd "$repo_root/packages/localization"
flutter pub get
flutter gen-l10n

cd "$repo_root/apps/$app"
flutter pub get
exec flutter run "$@"
