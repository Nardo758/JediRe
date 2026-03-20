# Phase 10 & 11 Runtime Testing Checklist

**Deal ID:** `e044db04-439b-4442-82df-b36a840f2fd8` (Atlanta Development)  
**Tester:** _______________  
**Date:** _______________

---

## Pre-Flight Setup

### Environment Preparation

- [ ] **Backend Dependencies Installed**
  ```bash
  cd ~/jedire-repo/backend
  npm install
  ```

- [ ] **Frontend Dependencies Installed**
  ```bash
  cd ~/jedire-repo/frontend
  npm install
  ```

- [ ] **Financial Model Import Fixed**
  - Check: Lines 86 & 99 in `index.replit.ts`
  - Verify filename matches import path

- [ ] **Backend Server Started**
  ```bash
  cd ~/jedire-repo/backend
  npm start
  ```
  - Wait for: `🚀 JediRe Backend (Replit Edition)`
  - Health check: `curl http://localhost:3000/health`

- [ ] **Authentication Token Ready**
  ```bash
  export AUTH_TOKEN="your_token_here"
  export DEAL_ID="e044db04-439b-4442-82df-b36a840f2fd8"
  ```

---

## Phase 10: Cross-Module Validation

### Test 1: Validation Status Endpoint

**Endpoint:** `GET /api/v1/deals/:dealId/validation-status`

```bash
curl "http://localhost:3000/api/v1/deals/$DEAL_ID/validation-status" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "isValid": false,
    "summary": "X critical errors, Y warnings",
    "counts": {
      "errors": X,
      "warnings": Y,
      "info": Z
    }
  }
}
```

**Results:**
- [ ] ✅ Endpoint returns 200 OK
- [ ] ✅ Response has `success: true`
- [ ] ✅ Contains `isValid` boolean
- [ ] ✅ Contains counts object
- [ ] ❌ Error: _______________________

**Notes:** _______________________

---

### Test 2: Full Validation Endpoint

**Endpoint:** `POST /api/v1/deals/:dealId/validate`

```bash
curl -X POST "http://localhost:3000/api/v1/deals/$DEAL_ID/validate" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.' > /tmp/validation-result.json
```

**Expected Response Structure:**
```json
{
  "success": true,
  "data": {
    "dealId": "...",
    "dealName": "Atlanta Development",
    "validation": {
      "isValid": false,
      "errors": [...],
      "warnings": [...],
      "info": [...],
      "summary": "..."
    },
    "timestamp": "..."
  }
}
```

**Validation Checks to Verify:**

- [ ] **Acres Mismatch Check**
  - Error code: `ACRES_MISMATCH`
  - Severity: critical
  - Module: deal
  - Notes: _______________________

- [ ] **Unit Mix Consistency Check**
  - Error code: `UNIT_MIX_MISMATCH`
  - Checks: Financial model, 3D design, dev capacity
  - Notes: _______________________

- [ ] **Zoning Compliance Check**
  - Error code: `HEIGHT_VIOLATION` (if exceeded)
  - Expected max: _______________________
  - Actual: _______________________

- [ ] **Parking Requirements Check**
  - Error code: `PARKING_UNNECESSARY` or `PARKING_INSUFFICIENT`
  - Notes: _______________________

- [ ] **FAR Utilization Check**
  - Error code: `FAR_EXCEEDED`
  - Notes: _______________________

**Overall Results:**
- [ ] ✅ Endpoint returns detailed validation results
- [ ] ✅ All expected checks are present
- [ ] ✅ Error messages are clear and actionable
- [ ] ❌ Error: _______________________

**Errors Found:**
1. _______________________
2. _______________________
3. _______________________

**Warnings Found:**
1. _______________________
2. _______________________

---

### Test 3: Bulk Validation (Optional)

**Endpoint:** `POST /api/v1/deals/validate-all`

```bash
curl -X POST "http://localhost:3000/api/v1/deals/validate-all" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"limit": 5}' | jq '.'
```

**Results:**
- [ ] ✅ Validates multiple deals
- [ ] ✅ Returns summary statistics
- [ ] ❌ Error: _______________________

---

## Phase 11: Unit Mix Propagation

### Test 4: Unit Mix Status Endpoint

**Endpoint:** `GET /api/v1/deals/:dealId/unit-mix/status`

```bash
curl "http://localhost:3000/api/v1/deals/$DEAL_ID/unit-mix/status" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "hasUnitMix": true/false,
    "source": "manual|intelligence|path",
    "unitMix": {
      "studio": {"count": X, "avgSF": Y, "percent": Z},
      "oneBR": {...},
      "twoBR": {...},
      "threeBR": {...},
      "total": 300
    }
  }
}
```

**Results:**
- [ ] ✅ Endpoint returns 200 OK
- [ ] ✅ `hasUnitMix` is boolean
- [ ] ✅ `source` is one of: manual/intelligence/path
- [ ] ✅ Unit mix breakdown is present
- [ ] ✅ Total units = 300 (for Atlanta Development)
- [ ] ❌ Error: _______________________

**Current Unit Mix:**
- Studio: _____ (____%)
- 1BR: _____ (____%)
- 2BR: _____ (____%)
- 3BR: _____ (____%)
- **Total:** _____

---

### Test 5: Unit Mix Propagation (Manual Source)

**Endpoint:** `POST /api/v1/deals/:dealId/unit-mix/apply`

```bash
curl -X POST "http://localhost:3000/api/v1/deals/$DEAL_ID/unit-mix/apply" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"source":"manual"}' | jq '.'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "dealId": "...",
    "dealName": "Atlanta Development",
    "result": {
      "success": true,
      "modulesUpdated": [
        "financial_model",
        "3d_design",
        "development_capacity",
        "deal_metadata"
      ],
      "errors": []
    },
    "timestamp": "..."
  }
}
```

**Results:**
- [ ] ✅ Propagation succeeds
- [ ] ✅ All 4 modules updated
- [ ] ✅ No errors reported
- [ ] ❌ Error: _______________________

**Modules Updated:**
- [ ] financial_model
- [ ] 3d_design
- [ ] development_capacity
- [ ] deal_metadata

---

### Test 6: Verify Module Updates in Database

**Check Financial Model:**
```sql
SELECT 
  module_outputs->'financialModel'->'assumptions'->'unitMix' 
FROM deals 
WHERE id = 'e044db04-439b-4442-82df-b36a840f2fd8';
```

**Results:**
- [ ] ✅ Unit mix present in financial model
- [ ] ✅ Matches source data

**Check 3D Design:**
```sql
SELECT 
  module_outputs->'design3D'->'unitMix' 
FROM deals 
WHERE id = 'e044db04-439b-4442-82df-b36a840f2fd8';
```

**Results:**
- [ ] ✅ Unit mix present in 3D design
- [ ] ✅ Matches source data

**Check Development Capacity:**
```sql
SELECT 
  module_outputs->'developmentCapacity'->'unitMix' 
FROM deals 
WHERE id = 'e044db04-439b-4442-82df-b36a840f2fd8';
```

**Results:**
- [ ] ✅ Unit mix present in dev capacity
- [ ] ✅ Matches source data

**Check Deal Metadata:**
```sql
SELECT target_units 
FROM deals 
WHERE id = 'e044db04-439b-4442-82df-b36a840f2fd8';
```

**Results:**
- [ ] ✅ `target_units` updated
- [ ] ✅ Matches total unit count

---

### Test 7: Development Path Selection

**Endpoint:** `POST /api/v1/deals/:dealId/development-path/select`

```bash
# First, get available paths
curl "http://localhost:3000/api/v1/deals/$DEAL_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" | \
  jq '.data.module_outputs.developmentStrategy.paths[0].id'

# Then select a path (replace PATH_ID with actual ID)
curl -X POST "http://localhost:3000/api/v1/deals/$DEAL_ID/development-path/select" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"pathId":"PATH_ID"}' | jq '.'
```

**Results:**
- [ ] ✅ Path selection succeeds
- [ ] ✅ Automatic propagation triggered
- [ ] ✅ Modules updated
- [ ] ❌ Error: _______________________

---

### Test 8: Manual Unit Mix Override

**Endpoint:** `POST /api/v1/deals/:dealId/unit-mix/set`

```bash
curl -X POST "http://localhost:3000/api/v1/deals/$DEAL_ID/unit-mix/set" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "unitMix": {
      "studio": {"count": 30, "avgSF": 550, "percent": 10},
      "oneBR": {"count": 100, "avgSF": 750, "percent": 33.33},
      "twoBR": {"count": 150, "avgSF": 950, "percent": 50},
      "threeBR": {"count": 20, "avgSF": 1200, "percent": 6.67},
      "total": 300,
      "totalSF": 267500,
      "avgSF": 891.67
    }
  }' | jq '.'
```

**Results:**
- [ ] ✅ Manual override accepted
- [ ] ✅ Modules updated
- [ ] ❌ Error: _______________________

---

## Frontend Integration Testing

### Test 9: Unit Mix Status Badge

**Steps:**
1. Open browser to: `http://localhost:4000`
2. Navigate to Atlanta Development deal
3. Find Unit Mix Program section in Overview

**Results:**
- [ ] ✅ Badge is visible
- [ ] ✅ Badge shows correct source (MANUAL/INTELLIGENCE/PATH)
- [ ] ✅ Badge has correct color:
  - Blue = Manual
  - Purple = Intelligence
  - Green = Path

**Current Badge:**
- Source: _______________________
- Color: _______________________
- Screenshot: (optional) _______________________

---

### Test 10: End-to-End Integration Flow

**Scenario:** User selects development path → Verify propagation → Check validation

1. **Select Development Path**
   ```bash
   POST /api/v1/deals/:dealId/development-path/select
   ```
   - [ ] ✅ Path selected successfully

2. **Verify Badge Updates**
   - [ ] ✅ Badge now shows "FROM PATH"
   - [ ] ✅ Badge is green

3. **Check Unit Mix Status**
   ```bash
   GET /api/v1/deals/:dealId/unit-mix/status
   ```
   - [ ] ✅ Source is "path"

4. **Run Validation**
   ```bash
   POST /api/v1/deals/:dealId/validate
   ```
   - [ ] ✅ Unit mix consistency check passes
   - [ ] ✅ Or shows specific errors if data is inconsistent

5. **Manually Override Unit Mix**
   ```bash
   POST /api/v1/deals/:dealId/unit-mix/set
   ```
   - [ ] ✅ Override accepted

6. **Re-run Validation**
   - [ ] ✅ Detects new inconsistencies (if any)

---

## Error Handling & Edge Cases

### Test 11: Invalid Deal ID

```bash
curl -X POST "http://localhost:3000/api/v1/deals/invalid-id/validate" \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

**Expected:** 404 Not Found
- [ ] ✅ Returns 404
- [ ] ✅ Error message: "Deal not found or access denied"

---

### Test 12: Missing Authentication

```bash
curl -X POST "http://localhost:3000/api/v1/deals/$DEAL_ID/validate"
```

**Expected:** 401 Unauthorized
- [ ] ✅ Returns 401
- [ ] ✅ Error message indicates auth required

---

### Test 13: Propagation with Missing Data

**Scenario:** Deal has no unit mix data

```bash
# Create a new deal with no unit mix
# Then try to propagate
curl -X POST "http://localhost:3000/api/v1/deals/NEW_DEAL_ID/unit-mix/apply" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"source":"manual"}'
```

**Expected:** Error or empty result
- [ ] ✅ Handles gracefully
- [ ] ✅ Clear error message

---

## Performance Testing (Optional)

### Test 14: Validation Performance

**Measure:** Time to validate a single deal

```bash
time curl -X POST "http://localhost:3000/api/v1/deals/$DEAL_ID/validate" \
  -H "Authorization: Bearer $AUTH_TOKEN" -o /dev/null -s
```

**Results:**
- Validation time: _____ seconds
- [ ] ✅ < 5 seconds
- [ ] ⚠️ 5-10 seconds (acceptable)
- [ ] ❌ > 10 seconds (needs optimization)

---

### Test 15: Bulk Validation Performance

```bash
time curl -X POST "http://localhost:3000/api/v1/deals/validate-all" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"limit": 10}' -o /dev/null -s
```

**Results:**
- Validation time: _____ seconds
- Deals validated: _____
- Avg per deal: _____ seconds

---

## Issues Found

### Critical Issues 🔴

1. _______________________________________
2. _______________________________________
3. _______________________________________

### Warnings ⚠️

1. _______________________________________
2. _______________________________________

### Recommendations 💡

1. _______________________________________
2. _______________________________________
3. _______________________________________

---

## Sign-Off

**Testing Complete:** [ ] Yes [ ] No

**Phase 10 Status:** [ ] Pass [ ] Fail [ ] Needs Fixes

**Phase 11 Status:** [ ] Pass [ ] Fail [ ] Needs Fixes

**Overall Status:** [ ] Ready for Production [ ] Needs Work

**Tester Signature:** _______________________

**Date:** _______________________

**Additional Notes:**

_________________________________________________________________

_________________________________________________________________

_________________________________________________________________

---

**Next Steps:**

1. _______________________________________
2. _______________________________________
3. _______________________________________
