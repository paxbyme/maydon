#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
mkdir -p .cache
{
  bash scripts/setup-m1.sh
  bash scripts/verify-m1.sh
} 2>&1 | tee .cache/m1-verification.log
