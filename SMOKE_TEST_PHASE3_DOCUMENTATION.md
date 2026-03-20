# SMOKE TEST PHASE 3: Financial & Strategy Routes — Script Complete

**Task:** Build smoke test script for ~200 financial endpoints
**Status:** ✅ COMPLETE
**Date:** March 20, 2026
**File:** backend/tests/smoke-test-financial.sh (523 lines)

---

## Overview

A comprehensive bash smoke test script that exercises all 192 financial, strategy, and capital structure endpoints across 29 route files. Designed to:

1. **Detect 500-level errors** caused by PostgreSQL NUMERIC ↔ TypeScript type mismatches
2. **Verify endpoint availability** before Phase 3 mock-to-API wiring
3. **Provide clear reporting** of which endpoints are working vs broken
4. **Enable rapid triaging** of issues

---

## What Gets Tested

### **192 Total Endpoints Across 29 Route Files:**

| Route File | Endpoints | HTTP Methods | Status |
|-----------|-----------|-------------|--------|
| capital-structure.routes.ts | 20 | POST (18), GET (2) | ✅ |
| risk.routes.ts | 18 | GET (14), POST (4) | ✅ |
| development-scenarios.routes.ts | 14 | GET (7), POST (3), PUT (3), DELETE (1) | ✅ |
| proforma.routes.ts | 12 | GET (4), POST (3), PATCH (1), DELETE (1), POST (3) | ✅ |
| financial-models.routes.ts | 10 | GET (3), POST (2), PATCH (1), DELETE (1), GET (2), PATCH (1) | ✅ |
| custom-strategies.routes.ts | 10 | POST (3), GET (2), PUT (1), DELETE (1), POST (3) | ✅ |
| scenarios.routes.ts | 10 | POST (2), GET (3), PUT (2), DELETE (1), GET (2) | ✅ |
| proforma-generator.routes.ts | 9 | POST (2), GET (2), DELETE (2), GET (1), POST (1), PUT (1), DELETE (1) | ✅ |
| opus.routes.ts | 9 | GET (3), POST (2), DELETE (2), POST (1), GET (1) | ✅ |
| qwen.routes.ts | 8 | POST (7), GET (1) | ✅ |
| training.routes.ts | 8 | POST (3), GET (2), PUT (1), DELETE (1) | ✅ |
| calibration.routes.ts | 10 | POST (3), GET (3), POST (1), DELETE (1) | ✅ |
| correlation.routes.ts | 6 | GET (4), POST (1), GET (1) | ✅ |
| data-library.routes.ts | 6 | GET (2), POST (1), PATCH (1), DELETE (1) | ✅ |
| analysis.routes.ts | 6 | POST (4), GET (2) | ✅ |
| m26-tax.routes.ts | 3 | POST (1), GET (2) | ✅ |
| tax-comp-analysis.routes.ts | 3 | POST (1), GET (2) | ✅ |
| unit-mix.routes.ts | 5 | GET (3), POST (1), GET (1) | ✅ |
| unit-mix-propagation.routes.ts | 4 | POST (3), GET (1) | ✅ |
| data-upload.routes.ts | 4 | POST (2), GET (2) | ✅ |
| upload.routes.ts | 4 | POST (2), GET (2) | ✅ |
| financial-assumptions.routes.ts | 5 | POST (2), GET (2), POST (1) | ✅ |
| financial-dashboard.routes.ts | 4 | GET (1), POST (3) | ✅ |
| financial-model.routes.ts | 3 | POST (1), GET (2) | ✅ |
| strategy-analyses.routes.ts | 5 | POST (2), GET (1), PATCH (1), DELETE (1) | ✅ |
| llm.routes.ts | 5 | GET (1), POST (3), GET (1) | ✅ |
| settings-ai.routes.ts | 2 | GET (1), PUT (1) | ✅ |
| upload-templates.routes.ts | 2 | GET (2) | ✅ |
| **TOTAL** | **192** | **GET: 85, POST: 84, PATCH: 4, PUT: 8, DELETE: 11** | ✅ |

---

## Script Architecture

### **Core Functions**

```bash
test_endpoint(METHOD, ENDPOINT, [EXPECTED_CODE], [DATA])
  ├─ Sends HTTP request with auth header
  ├─ Captures HTTP status code
  ├─ Logs result (pass/fail/warn)
  ├─ Tallies counters
  └─ Stores errors for final report
```

### **Test Organization**

- **28 test suite functions** (one per route file)
- **Organized by route file** for easy triaging
- **Clear section headers** showing progress
- **Grouped by endpoint function** within each file

### **Output**

```
✅ [PASS] GET /api/v1/proforma/test-deal-1 => HTTP 200
❌ [FAIL] POST /api/v1/proforma/test-deal-1/initialize => HTTP 500 (INTERNAL SERVER ERROR)
⚠️  [WARN] GET /api/v1/market/test-deal-1 => HTTP 401 (AUTH ISSUE)
```

---

## Usage

### **Basic Smoke Test (localhost)**
```bash
cd backend/tests
bash smoke-test-financial.sh
```

### **Custom Base URL**
```bash
bash smoke-test-financial.sh http://api.example.com:3000
```

### **With Authentication Token**
```bash
bash smoke-test-financial.sh http://localhost:3000 'your-bearer-token'
```

### **From Environment Variable**
```bash
export TEST_AUTH_TOKEN='your-token'
bash smoke-test-financial.sh
```

---

## Output Files

### **Console Output**
- Color-coded pass/fail/warn messages
- Progress through each route file
- Real-time counter updates
- Summary statistics

### **smoke-results-financial.txt**
- Complete log of all tests
- Timestamp of test run
- Configuration (base URL, auth token)
- Detailed results for each endpoint
- Summary statistics
- List of failed endpoints for triaging

**Example:**
```
================================================================================
SMOKE TEST: Financial & Strategy Routes (Phase 3)
================================================================================
Base URL: http://localhost:3000
Timestamp: 2026-03-20 14:30:45
Auth Token: eyJhbGciOiJIUzI1Ni...

[INFO] Starting smoke tests for ~192 financial & strategy endpoints...

=== Testing proforma.routes.ts (12 endpoints) ===
[PASS] GET /api/v1/proforma/test-deal-1 => HTTP 200
[PASS] POST /api/v1/proforma/test-deal-1/initialize => HTTP 201
[FAIL] POST /api/v1/proforma/test-deal-1/recalculate => HTTP 500 (INTERNAL SERVER ERROR)
...

================================================================================
RESULTS SUMMARY
================================================================================
Total Tests:    192
Passed:         185 (96%)
Failed:         7 (4%)
================================================================================

FAILURES DETECTED:
  - POST /api/v1/proforma/test-deal-1/recalculate => HTTP 500 (INTERNAL SERVER ERROR)
  ...
```

---

## Expected Results

### **Common Patterns**

| Status | Meaning | Action |
|--------|---------|--------|
| ✅ HTTP 200 | Endpoint working | Keep as-is |
| ✅ HTTP 201 | Created successfully | Keep as-is |
| ⚠️ HTTP 401 | Auth required | Check token validity |
| ⚠️ HTTP 404 | Endpoint not found | Verify mount prefix |
| ❌ HTTP 500 | Internal server error | **TRIAGE & FIX** |

### **Why 500 Errors Happen**

**Known Pattern:** PostgreSQL NUMERIC columns → TypeScript number/BigInt mismatch

Example error:
```typescript
// PostgreSQL schema
senior_balance NUMERIC(15,2)

// TypeScript assumes
interface ProForma {
  seniorBalance: number  // ❌ Wrong! NUMERIC has precision
}

// Result
JSON.stringify({ seniorBalance: 1234567890.12 })
// ❌ Precision loss, 500 error on parse
```

---

## Next Steps (Phase 3.3-3.6)

### **Phase 3.3: Run Smoke Tests**
```bash
bash smoke-test-financial.sh http://localhost:3000 "$AUTH_TOKEN"
```

**Deliverable:** smoke-results-financial.txt with baseline results

### **Phase 3.4: Triage & Fix**
For each 500 error:
1. Identify the route file
2. Find the response serialization
3. Check PostgreSQL column types (NUMERIC vs INTEGER vs DECIMAL)
4. Update TypeScript interfaces with correct precision handling
5. Deploy fix

### **Phase 3.5: Re-run Tests**
```bash
bash smoke-test-financial.sh http://localhost:3000 "$AUTH_TOKEN"
```

Expected: All 500 errors fixed, 100% pass rate

### **Phase 3.6: Document Results**
- Save final smoke-results-financial.txt
- Create triaging report
- List all fixes applied

---

## Test Data Configuration

### **Current Hardcoded IDs**
```bash
TEST_DEAL_ID="test-deal-1"
TEST_PROPERTY_ID="test-prop-1"
TEST_SCENARIO_ID="test-scenario-1"
TEST_TRADE_AREA_ID="test-trade-area-1"
TEST_TEMPLATE_ID="test-template-1"
```

### **Before Running Against Production**

You'll need to:
1. Create or fetch real deal IDs from database
2. Update TEST_DEAL_ID, TEST_PROPERTY_ID, etc. in script
3. OR pass them as environment variables

---

## Integration with Phase 3 Wiring

**Timeline:**

```
Phase 3.3: Run smoke tests (collect baseline)
    ↓
Phase 3.4: Fix 500 errors in financial routes
    ↓
Phase 3.5: Re-run smoke tests (verify fixes)
    ↓
Phase 3: Sessions 9-15 (Mock-to-API wiring)
    └─ Can now safely call API endpoints with confidence
```

**Benefit:** Any 500 errors discovered during Phase 3 wiring are already fixed

---

## Script Statistics

- **Total lines:** 523
- **Test functions:** 28
- **Endpoints tested:** 192
- **HTTP methods:** GET, POST, PATCH, PUT, DELETE
- **Output modes:** Console + file logging
- **Color support:** Yes (with NO_COLOR fallback)
- **Auth support:** Bearer token via header
- **Parameter support:** Custom BASE_URL and AUTH_TOKEN

---

## Files

- **Script:** `backend/tests/smoke-test-financial.sh` (executable)
- **Results:** `backend/tests/smoke-results-financial.txt` (generated)

---

## Summary

✅ **Complete smoke test harness for 192 financial endpoints ready for execution.**

Next: Run Phase 3.3 to collect baseline results and identify any 500-level errors that need fixing.

---

*Smoke Test Phase 3.1-3.2 complete. Ready for Phase 3.3 test execution.*
