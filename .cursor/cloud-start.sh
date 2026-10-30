#!/usr/bin/env bash
# Boot-time dev server. Safe to rerun: leave an already-healthy server alone.
# npm run dev binds 0.0.0.0:8080 through scripts/with-app-env.mjs.
set -euo pipefail

cd "$(dirname "$(readlink -f "$0")")/.."

if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi

(npm run dev > /tmp/frank-dev.log 2>&1 &)
