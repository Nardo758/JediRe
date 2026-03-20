# Phase 3.3: Smoke Test Execution Guide

**Status:** Ready to Run
**Date:** March 20, 2026
**Environment:** Test Infrastructure Complete

---

## Prerequisites

### Backend Requirements
- Node.js + npm installed
- PostgreSQL database running with JEDI RE schema
- Environment variables configured (.env file)
- Backend running on http://localhost:3000

### Authentication
- Valid Bearer token from `/api/v1/auth/login`
- OR test user credentials to generate token

---

## Step 1: Start Backend Server

```bash
cd /home/user/JediRe/backend

# Install dependencies (if needed)
npm install

# Start development server
npm run dev

# Expected output:
# Server running on port 3000
# Connected to PostgreSQL
# All routes mounted
```

**Wait for:** "Server running on port 3000" message

---

## Step 2: Generate Auth Token

### Option A: Use curl to login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword"
  }'

# Expected response:
# {
#   "token": "eyJhbGciOiJIUzI1NiIs...",
#   "user": { ... }
# }
```

### Option B: Use existing token
If you have a valid Bearer token from a previous session:
```bash
export AUTH_TOKEN="eyJhbGciOiJIUzI1NiIs..."
```

### Option C: Bypass auth (if configured)
For development/test purposes, some endpoints may allow unauthenticated requests.

---

## Step 3: Run Smoke Test

### Basic Execution
```bash
cd /home/user/JediRe/backend/tests
bash smoke-test-financial.sh
```

This uses defaults:
- Base URL: http://localhost:3000
- Auth: From TEST_AUTH_TOKEN environment variable (if set)

### With Authentication
```bash
bash smoke-test-financial.sh http://localhost:3000 "$AUTH_TOKEN"
```

### With Custom Base URL
```bash
bash smoke-test-financial.sh http://api.example.com:3000 "$AUTH_TOKEN"
```

### Full Example
```bash
cd /home/user/JediRe/backend/tests

# Generate token
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpassword"}' | jq -r '.token')

# Run smoke tests
bash smoke-test-financial.sh http://localhost:3000 "$TOKEN"
```

---

## Step 4: Monitor Test Execution

### Console Output
You'll see real-time output as tests run:

```
[INFO] Starting smoke tests for ~192 financial & strategy endpoints...

=== Testing proforma.routes.ts (12 endpoints) ===
[PASS] GET /api/v1/proforma/test-deal-1 => HTTP 200
[PASS] POST /api/v1/proforma/test-deal-1/initialize => HTTP 201
[FAIL] POST /api/v1/proforma/test-deal-1/recalculate => HTTP 500 (INTERNAL SERVER ERROR)
[WARN] GET /api/v1/proforma/test-deal-1/history => HTTP 401 (AUTH ISSUE)
...
```

**Expected duration:** 3-5 minutes for all 192 endpoints

---

## Step 5: Review Results

### Console Summary
```
================================================================================
RESULTS SUMMARY
================================================================================
Total Tests:    192
Passed:         185 (96%)
Failed:         7 (4%)
================================================================================

FAILURES DETECTED:
  - POST /api/v1/proforma/test-deal-1/recalculate => HTTP 500
  - POST /api/v1/capital-structure/rate/sensitivity => HTTP 500
  - ...
```

### Results File
```bash
cat smoke-results-financial.txt
```

Output is also saved to: `./smoke-results-financial.txt`

---

## Interpreting Results

### HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | OK | ✅ Endpoint working |
| 201 | Created | ✅ Endpoint working |
| 400 | Bad request | ⚠️ Check test data |
| 401 | Unauthorized | ⚠️ Check auth token |
| 403 | Forbidden | ⚠️ Check permissions |
| 404 | Not found | ⚠️ Check endpoint path |
| 500 | Server error | ❌ **NEEDS FIX** |
| 502 | Bad gateway | ❌ Backend may be down |
| 503 | Unavailable | ❌ Backend unavailable |

### Known 500 Error Pattern

**PostgreSQL NUMERIC columns ↔ TypeScript type mismatch**

Example:
```sql
-- PostgreSQL schema
CREATE TABLE proforma (
  senior_balance NUMERIC(15,2),  -- Allows up to 15 digits, 2 decimal places
  ...
)
```

```typescript
// TypeScript interface (WRONG)
interface Proforma {
  seniorBalance: number;  // ❌ Loses precision
}

// Result: JSON serialization error → 500
```

**Fix Pattern:**
```typescript
// Use BigInt or string for NUMERIC columns
interface Proforma {
  seniorBalance: string | { value: string; scale: number };
}
```

---

## Common Issues & Solutions

### Issue: "Connection refused" (ECONNREFUSED)
**Cause:** Backend not running on localhost:3000

**Solution:**
```bash
# Check if backend is running
ps aux | grep node

# If not, start it
cd backend && npm run dev
```

### Issue: All endpoints returning 401
**Cause:** Invalid or missing auth token

**Solution:**
```bash
# Get new token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpassword"}'

# Use in test
bash smoke-test-financial.sh http://localhost:3000 "$NEW_TOKEN"
```

### Issue: Endpoints returning 404
**Cause:** Route not mounted or incorrect path

**Solution:**
1. Check backend/src/api/rest/index.ts for correct mount prefix
2. Verify route file is imported
3. Check spelling of endpoint path

### Issue: High failure rate (>20% failures)
**Cause:** Likely database connection or schema issues

**Solution:**
1. Verify PostgreSQL is running
2. Check .env configuration
3. Run migrations: `npm run migrate`
4. Seed test data if needed

---

## Test Data Setup

### Create Test Deal (if needed)
```bash
curl -X POST http://localhost:3000/api/v1/deals \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Development Deal",
    "propertyType": "apartment",
    "marketId": "tampa-fl",
    "status": "active"
  }'

# Use the returned dealId in smoke test
export TEST_DEAL_ID="returned-deal-id"
```

### Create Test Property (if needed)
```bash
curl -X POST http://localhost:3000/api/v1/properties \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "123 Test St, Tampa, FL 33602",
    "propertyType": "apartment",
    "units": 250
  }'
```

---

## Next Steps After Testing

### If All Tests Pass ✅
1. Save results: `cp smoke-results-financial.txt smoke-results-baseline-PASSING.txt`
2. Create issue: "Phase 3.3 Complete: All financial endpoints operational"
3. Proceed to Phase 3: Sessions 9-15 (mock-to-API wiring)

### If Some Tests Fail ⚠️
1. Save results: `cp smoke-results-financial.txt smoke-results-baseline-FAILURES.txt`
2. Proceed to Phase 3.4: Triage & Fix
   - Identify which routes have 500 errors
   - Fix PostgreSQL type issues
   - Re-run tests
3. Document fixes in PHASE3_FIXES_LOG.md

### If Most Tests Fail ❌
1. Check backend logs: `npm run dev` (shows error details)
2. Verify database connection
3. Check environment variables (.env)
4. Run migrations: `npm run migrate`
5. Restart backend and re-run tests

---

## Troubleshooting Backend Issues

### View Backend Logs
```bash
# In backend directory
npm run dev 2>&1 | tee backend.log

# View logs in another terminal
tail -f backend.log
```

### Check Database Connection
```bash
# Test PostgreSQL connection
psql $DATABASE_URL

# Should show: psql (14.x, server version ...)
```

### Verify Routes Are Mounted
```bash
# List all mounted routes
curl http://localhost:3000/api/v1/proforma/test \
  -H "Authorization: Bearer $TOKEN"

# Should return either data or 401, not 404
```

---

## Example Full Run

```bash
#!/bin/bash
# Complete smoke test workflow

set -e

# 1. Ensure backend is running
echo "Starting backend..."
cd /home/user/JediRe/backend
npm run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
sleep 5  # Wait for startup

# 2. Get auth token
echo "Getting auth token..."
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpassword"}' | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Failed to get auth token"
  kill $BACKEND_PID
  exit 1
fi

echo "✅ Auth token obtained: ${TOKEN:0:20}..."

# 3. Run smoke tests
echo "Running smoke tests..."
cd /home/user/JediRe/backend/tests
bash smoke-test-financial.sh http://localhost:3000 "$TOKEN"

# 4. Cleanup
kill $BACKEND_PID
echo "✅ Smoke test complete. Results saved to smoke-results-financial.txt"
```

---

## What to Do With Results

### Archive Results
```bash
mkdir -p smoke-test-results
cp smoke-results-financial.txt smoke-test-results/results-$(date +%Y%m%d-%H%M%S).txt
```

### Parse Failures
```bash
# Extract just the failed endpoints
grep "FAIL" smoke-results-financial.txt > failures.txt

# Extract just the warnings
grep "WARN" smoke-results-financial.txt > warnings.txt
```

### Generate Report
```bash
# Count results by type
echo "=== RESULTS SUMMARY ==="
echo "Total tests: $(grep -c "\[" smoke-results-financial.txt)"
echo "Passed: $(grep -c "PASS" smoke-results-financial.txt)"
echo "Failed: $(grep -c "FAIL" smoke-results-financial.txt)"
echo "Warned: $(grep -c "WARN" smoke-results-financial.txt)"
```

---

## Success Criteria for Phase 3.3

✅ **PASS:** If ≥95% of tests pass
- Move to Phase 3.4 (fix remaining issues) OR
- Move directly to Phase 3 Sessions 9-15 (mock-to-API wiring)

⚠️ **INVESTIGATE:** If 80-95% pass
- Identify 500 errors
- Determine if data-related or code-related
- Phase 3.4: Fix issues

❌ **BLOCKED:** If <80% pass
- Backend likely has configuration issues
- Check logs, database connection
- Fix foundation issues before proceeding

---

## Next: Phase 3.4 - Triage & Fix

Once you have results, Phase 3.4 will:
1. Analyze failures
2. Fix PostgreSQL type mismatches
3. Deploy fixes
4. Re-run tests (Phase 3.5)

See: SMOKE_TEST_PHASE3_DOCUMENTATION.md for detailed triaging guide

---

*Phase 3.3: Ready to execute. Follow steps above to run smoke tests against live backend.*
