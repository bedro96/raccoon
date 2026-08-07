#!/usr/bin/env bash
# Smoke test for the Ponpoko production deployment.
# Usage: BASE_URL=https://... ./scripts/smoke-test.sh
# Exit code 0 = all checks passed; non-zero = at least one check failed.

set -euo pipefail

BASE_URL="${BASE_URL:-https://ca-ponpoko-eval.politecliff-3b621d61.koreacentral.azurecontainerapps.io}"

PASS=0
FAIL=0

pass() { echo "  [PASS] $1"; PASS=$((PASS + 1)); }
fail() { echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); }

separator() { echo ""; echo "=== $1 ==="; }

# Run curl, capturing body and HTTP status. On network error, sets status to 000.
http_get() {
  local url="$1"
  local tmpfile
  tmpfile=$(mktemp)
  trap 'rm -f "$tmpfile"' RETURN
  local status
  status=$(curl -sS --max-time 20 -o "$tmpfile" -w "%{http_code}" "$url" 2>/dev/null) || status="000"
  local body
  body=$(cat "$tmpfile")
  RESPONSE_STATUS="$status"
  RESPONSE_BODY="$body"
}

# ---------------------------------------------------------------------------
# 1. GET /play — must return HTTP 200 and contain a <canvas> element
# ---------------------------------------------------------------------------
separator "GET /play"
http_get "${BASE_URL}/play"
PLAY_STATUS="$RESPONSE_STATUS"
PLAY_BODY="$RESPONSE_BODY"

if [ "$PLAY_STATUS" = "200" ]; then
  pass "/play returned HTTP 200"
else
  fail "/play returned HTTP ${PLAY_STATUS} (expected 200)"
fi

if echo "$PLAY_BODY" | grep -qi "<canvas"; then
  pass "/play response body contains <canvas> element"
else
  fail "/play response body does NOT contain <canvas> element"
fi

# ---------------------------------------------------------------------------
# 2. GET /api/scores — must return HTTP 200 and a valid JSON array
# ---------------------------------------------------------------------------
separator "GET /api/scores"
http_get "${BASE_URL}/api/scores"
SCORES_STATUS="$RESPONSE_STATUS"
SCORES_BODY="$RESPONSE_BODY"

if [ "$SCORES_STATUS" = "200" ]; then
  pass "/api/scores returned HTTP 200"
else
  fail "/api/scores returned HTTP ${SCORES_STATUS} (expected 200)"
fi

# Validate that the response body is a JSON object with a "scores" array
if echo "$SCORES_BODY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
assert isinstance(data, dict), f'expected object, got {type(data).__name__}'
assert isinstance(data.get('scores'), list), f'expected \"scores\" to be a list, got {type(data.get(\"scores\")).__name__}'
" 2>/dev/null; then
  pass "/api/scores response is a well-formed JSON object with a \"scores\" array"
else
  fail "/api/scores response is NOT a well-formed JSON object with a \"scores\" array"
  echo "    Body (first 200 chars): ${SCORES_BODY:0:200}"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
separator "Results"
echo "  Passed : ${PASS}"
echo "  Failed : ${FAIL}"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo "Smoke test PASSED ✅"
  exit 0
else
  echo "Smoke test FAILED ❌  (${FAIL} check(s) failed)"
  exit 1
fi
