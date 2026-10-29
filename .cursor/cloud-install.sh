#!/usr/bin/env bash
# Idempotent dependency install for Cursor Cloud Agent builds.
# Runs from any working directory. npm ci refreshes node_modules from the lockfile.
# Playwright's Chromium is what scripts/browser-smoke.mjs launches.
set -euo pipefail

cd "$(dirname "$(readlink -f "$0")")/.."

npm ci
npx playwright install chromium
