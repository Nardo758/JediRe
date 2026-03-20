#!/usr/bin/env bash
# ============================================================
# JediRe FULL API Smoke Test — Inventory-Driven
# Delegates to run-smoke-test.js which:
#   1. Parses all 174 backend route files to build a canonical inventory
#   2. Tests every route in parallel (25 concurrent) with JWT auth
#   3. Emits a consolidated report with per-route-file stats
#
# Usage:
#   bash backend/tests/smoke-test-full.sh
#   bash backend/tests/smoke-test-full.sh --report /path/to/report.txt
#   BASE_URL=http://localhost:4000 bash backend/tests/smoke-test-full.sh
#
# Exit 0 = zero 500-level failures
# Exit 1 = one or more 500-level failures found
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNNER="$SCRIPT_DIR/run-smoke-test.js"
VERIFY="$SCRIPT_DIR/verify-mount-coverage.js"
REPORT_OUT=""

for arg in "$@"; do
  case $arg in
    --report=*) REPORT_OUT="${arg#*=}" ;;
    --report)   shift; REPORT_OUT="$1" ;;
  esac
done

export BASE_URL="${BASE_URL:-http://localhost:4000}"
export CONCURRENCY="${CONCURRENCY:-25}"
export TIMEOUT_MS="${TIMEOUT_MS:-10000}"
if [[ -n "$REPORT_OUT" ]]; then
  export REPORT_OUT
fi

# Emit mount coverage reconciliation (coverage report vs actual registrations)
if [[ -f "$VERIFY" ]]; then
  echo "=== Mount Coverage Reconciliation ==="
  node "$VERIFY" 2>/dev/null | grep -E "MISSING|STALE|covered|Total|All actual" | head -20
  echo ""
fi

exec node "$RUNNER"
