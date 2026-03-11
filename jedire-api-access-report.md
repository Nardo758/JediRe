# JediRe API Access Report
**Date:** 2026-03-10 20:42 EDT  
**API Base:** https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev

---

## ✅ Successfully Accessed

### 1. **Health Check**
```bash
GET /api/v1/clawdbot/health
```

**Result:**
```json
{
  "status": "healthy",
  "integration": "clawdbot",
  "webhookConfigured": true,
  "secretConfigured": true
}
```

### 2. **System Status**
```bash
POST /api/v1/clawdbot/query
Body: {"query": "status"}
```

**Result:**
```json
{
  "status": "operational",
  "environment": "production",
  "uptime": 1067.6s,
  "deals": 25,
  "completedModels": 1
}
```

### 3. **All Deals List**
```bash
POST /api/v1/clawdbot/command
Body: {"command": "get_deals"}
```

**Result:** 20 deals returned (see `jedire-deals-api-data.json`)

---

## ⚠️ Limited Access

### Available Clawdbot Commands:
1. ✅ `get_deals` - Works, returns list of all deals
2. ❌ `get_deal` - Has SQL error (missing column `p.address_line2`)
3. ❓ `run_analysis` - Not tested
4. ✅ `system_stats` - Works (via query: "status")
5. ❓ `recent_errors` - Not tested

### Available Queries:
1. ✅ `status` - System status
2. ✅ `deals_count` - Total deal count
3. ✅ `recent_errors` - Error log

---

## 🔒 No Access To

The Clawdbot API token **does not grant access** to the main REST API endpoints:

**Blocked Endpoints:**
- ❌ `GET /api/v1/deals/:dealId` - Requires user auth
- ❌ `GET /api/v1/deals/:dealId/financial-models` - Requires user auth
- ❌ `GET /api/v1/deals/:dealId/unit-mix` - Requires user auth
- ❌ `GET /api/v1/deals/:dealId/context` - Requires user auth

**Error:** `{"error":"Unauthorized","message":"Invalid or expired token"}`

---

## 📊 Atlanta Development - Accessible Data

**From `get_deals` command:**

```json
{
  "id": "e044db04-439b-4442-82df-b36a840f2fd8",
  "name": "Atlanta Development ",
  "projectType": "multifamily",
  "status": "active",
  "state": "SIGNAL_INTAKE",
  "tier": "basic",
  "budget": "78000000.00",
  "targetUnits": 300,
  "dealCategory": "pipeline",
  "address": "1950 Piedmont Circle Northeast, Atlanta, Georgia 30324, United States",
  "createdAt": "2026-02-24T20:47:41.299Z",
  "updatedAt": "2026-03-10T02:47:39.364Z",
  "propertyCount": 1,
  "pendingTasks": 0
}
```

---

## ❌ Still Missing (Same as Before)

### 1. Unit Mix Breakdown
- Studios: Count, SF, rent
- 1BR: Count, SF, rent
- 2BR: Count, SF, rent
- 3BR: Count, SF, rent

### 2. Financial Model Details
- Rent assumptions by unit type
- Operating expenses
- NOI projections
- Cap rate
- Exit strategy
- Timeline

### 3. 3D Design Details
- Current story count
- Parking structure details
- Floor-to-floor heights
- Building sections

### 4. Market Analysis
- Competitive supply
- Absorption rates
- Market rents

### 5. Zoning Details (Beyond Basic)
- FAR calculation
- Parking requirements
- Setbacks
- Building envelope

---

## 💡 Recommendations to Get Full Data

### Option 1: User Authentication Token
Need a **user authentication token** (not Clawdbot token) to access:
```bash
POST /api/v1/auth/login
Body: {"email": "...", "password": "..."}
```

This would grant access to all `/api/v1/deals/:dealId/*` endpoints.

### Option 2: Database Direct Access
Direct PostgreSQL query access would allow:
```sql
SELECT * FROM deals WHERE id = 'e044db04-439b-4442-82df-b36a840f2fd8';
SELECT * FROM financial_models WHERE deal_id = 'e044db04-439b-4442-82df-b36a840f2fd8';
SELECT * FROM building_designs_3d WHERE deal_id = 'e044db04-439b-4442-82df-b36a840f2fd8';
-- etc.
```

### Option 3: Fix Clawdbot `get_deal` Command
The `get_deal` command has a known SQL error:
```
SQL error (missing column `p.address_line2`)
```

If this were fixed, it might return more detailed deal data.

### Option 4: Browser Automation
Use browser automation to:
1. Log into JediRe platform
2. Navigate to Atlanta Development deal
3. Extract data from each module tab
4. Export to JSON

---

## 🎯 Current Status

**What We Have:**
- ✅ Basic deal metadata (budget, units, address)
- ✅ Deal status and stage
- ✅ Created/updated timestamps
- ✅ System health status

**What We Still Need:**
- ❌ Detailed financial assumptions
- ❌ Unit mix breakdown
- ❌ 3D design specifics
- ❌ Market analysis data
- ❌ Zoning details beyond basic

**Recommendation:** Proceed with Options 1 or 2 to get full data access.

---

**Files Created:**
- `/home/leon/clawd/jedire-deals-api-data.json` - Raw API response with all 20 deals
- `/home/leon/clawd/jedire-api-access-report.md` - This report
