# Phase 10 & 11 Quick Fixes Before Runtime Testing

## Critical Fixes (Must Do)

### 1. Fix model-validator.service.ts Syntax Error ✅ DONE
**File:** `~/jedire-repo/backend/src/services/model-validator.service.ts`  
**Line:** 294  
**Status:** ✅ Already fixed by subagent

```typescript
// BEFORE (WRONG):
export function isValid Model(output: FinancialOutput): boolean {

// AFTER (CORRECT):
export function isValidModel(output: FinancialOutput): boolean {
```

---

### 2. Fix Financial Model Route Import Error
**File:** `~/jedire-repo/backend/src/index.replit.ts`  
**Lines:** 86 & 99  
**Issue:** Import path doesn't match actual file name

```typescript
// CURRENT (WRONG):
import financialModelRouter from './api/rest/financial-model.routes';

// SHOULD BE:
import financialModelRouter from './api/rest/financial-models.routes';
// Note the 's' in 'models'
```

**OR** check if the file is actually named `financial-model.routes.ts` (singular) and the other reference to `financial-models.routes.ts` (plural) is wrong.

**Action:**
```bash
# Check which file actually exists:
ls -la ~/jedire-repo/backend/src/api/rest/financial-model*.routes.ts

# Then update index.replit.ts to use the correct name
```

---

## Recommended (Before Runtime Testing)

### 3. Install Missing Frontend Dependencies
```bash
cd ~/jedire-repo/frontend
npm install
```

This will ensure TypeScript compiler and all dependencies are available for frontend build.

---

### 4. Install Missing Backend Dependencies

Many TypeScript errors are caused by missing type declarations. Install:

```bash
cd ~/jedire-repo/backend

# File upload handling
npm install multer @types/multer

# Validation schemas
npm install zod

# AI/LLM integration
npm install @anthropic-ai/sdk

# Excel parsing
npm install xlsx @types/xlsx

# ORM
npm install drizzle-orm drizzle-orm/node-postgres

# Message queue
npm install kafkajs

# Scheduling
npm install node-cron @types/node-cron

# Geospatial
npm install @turf/circle @turf/area @turf/helpers @turf/union

# Google APIs
npm install googleapis google-auth-library
```

**OR** run a single command to update all dependencies:

```bash
cd ~/jedire-repo/backend
npm install
```

---

## Pre-existing Issues (Not Blocking Phase 10/11)

These errors exist in other modules and don't affect Phase 10 & 11 functionality:

| File | Issue | Impact |
|------|-------|--------|
| `admin.routes.ts` | Type comparison errors with 'cancelled' status | Admin routes only |
| `building-envelope.routes.ts` | Missing @anthropic-ai/sdk | Building envelope module |
| `development-scenarios.routes.ts` | Type mismatches | Scenarios module |
| `financial-models.routes.ts` | Validation property name errors | Financial module |
| Various `*.routes.ts` | Missing `multer` types | File upload routes |

**Recommendation:** Address these incrementally, not required for Phase 10/11 testing.

---

## Test Readiness Checklist

Before running `test-phase-10-11.sh`:

- [x] model-validator.service.ts syntax error fixed
- [ ] Financial model import path verified/fixed
- [ ] Frontend dependencies installed (`npm install`)
- [ ] Backend dependencies installed (`npm install`)
- [ ] Backend server starts without fatal errors
- [ ] Database connection verified
- [ ] Auth token obtained for API calls
- [ ] Atlanta Development deal exists in database

---

## Runtime Test Plan

### Step 1: Start Backend
```bash
cd ~/jedire-repo/backend
npm start
```

Wait for: `🚀 JediRe Backend (Replit Edition)`

### Step 2: Get Auth Token
```bash
# Option A: Login via API
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpass"}'

# Option B: Use existing Clawdbot token
export AUTH_TOKEN="69295404e382acd00de4facdaa053fd20ae0a1cf15dc63c0b8a55cffc0e088b6"
```

### Step 3: Run Test Script
```bash
cd /home/leon/clawd
export AUTH_TOKEN="your_token_here"
export DEAL_ID="e044db04-439b-4442-82df-b36a840f2fd8"
bash test-phase-10-11.sh
```

### Step 4: Manual API Testing

**Test Validation:**
```bash
curl -X POST "http://localhost:3000/api/v1/deals/e044db04-439b-4442-82df-b36a840f2fd8/validate" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  | jq '.data.validation.summary'
```

**Test Unit Mix Status:**
```bash
curl "http://localhost:3000/api/v1/deals/e044db04-439b-4442-82df-b36a840f2fd8/unit-mix/status" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  | jq '.'
```

**Test Unit Mix Propagation:**
```bash
curl -X POST "http://localhost:3000/api/v1/deals/e044db04-439b-4442-82df-b36a840f2fd8/unit-mix/apply" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"source":"manual"}' \
  | jq '.data.result.modulesUpdated'
```

---

## Expected Results

### Validation Endpoint
```json
{
  "success": true,
  "data": {
    "dealId": "e044db04-439b-4442-82df-b36a840f2fd8",
    "dealName": "Atlanta Development",
    "validation": {
      "isValid": false,
      "errors": [
        {
          "code": "ACRES_MISMATCH",
          "severity": "critical",
          "module": "deal",
          "field": "acres",
          "message": "Acreage mismatch detected"
        }
      ],
      "warnings": [],
      "summary": "1 critical error found"
    }
  }
}
```

### Unit Mix Status
```json
{
  "success": true,
  "data": {
    "hasUnitMix": true,
    "source": "path",
    "unitMix": {
      "studio": { "count": 30, "avgSF": 550, "percent": 10 },
      "oneBR": { "count": 120, "avgSF": 750, "percent": 40 },
      "twoBR": { "count": 120, "avgSF": 950, "percent": 40 },
      "threeBR": { "count": 30, "avgSF": 1200, "percent": 10 },
      "total": 300
    }
  }
}
```

### Unit Mix Propagation
```json
{
  "success": true,
  "data": {
    "dealId": "e044db04-439b-4442-82df-b36a840f2fd8",
    "result": {
      "success": true,
      "modulesUpdated": [
        "financial_model",
        "3d_design",
        "development_capacity",
        "deal_metadata"
      ],
      "errors": []
    }
  }
}
```

---

## Troubleshooting

### Server Won't Start
```bash
# Check for port conflicts
lsof -i :3000

# Check logs
cd ~/jedire-repo/backend
npm start 2>&1 | tee server.log
```

### Database Connection Errors
```bash
# Verify PostgreSQL is running
psql -h localhost -U your_user -d jedire_db -c "SELECT 1;"

# Check connection string
grep DATABASE_URL ~/jedire-repo/backend/.env
```

### Authentication Failures
```bash
# Verify token is valid
curl http://localhost:3000/api/v1/auth/verify \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

### Deal Not Found
```bash
# Verify deal exists
psql -h localhost -U your_user -d jedire_db \
  -c "SELECT id, name FROM deals WHERE id = 'e044db04-439b-4442-82df-b36a840f2fd8';"
```

---

**Document Version:** 1.0  
**Created:** 2025-01-29  
**Purpose:** Quick reference for applying fixes before runtime testing
