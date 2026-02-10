# Auto-Triage System - Quick Start

## 🚀 What Was Built

A complete auto-triage system that runs after deal creation to automatically:
- ✅ Geocode addresses
- ✅ Look up property data
- ✅ Assign to trade area/submarket
- ✅ Calculate quick metrics (0-50 score, NOT 0-100)
- ✅ Identify strategies
- ✅ Flag risks
- ✅ Assign status: Hot/Warm/Watch/Pass

---

## 📦 Deliverables

### 1. Backend Service
**File:** `src/services/DealTriageService.ts`
- Main orchestrator with 10-step triage process
- Scoring: Location (0-15) + Market (0-15) + Property (0-20) = 0-50 total
- Automatic execution after deal creation

### 2. API Endpoints
**Controller:** `src/deals/deals.controller.ts`
- `POST /api/v1/deals/:id/triage` - Manually trigger triage
- `GET /api/v1/deals/:id/triage` - Get cached triage result

### 3. Database Schema
**Migration:** `src/database/migrations/017_deal_triage_system.sql`
- Added `triage_result` JSONB column to `deals` table
- Created `trade_areas` table with market metrics
- Seeded 5 sample trade areas (Atlanta metro)
- Helper functions for trade area assignment

### 4. Integration
**Service:** `src/deals/deals.service.ts`
- Auto-triage runs after `create()` (async, non-blocking)
- Manual triage methods: `triageDeal()`, `getTriageResult()`

### 5. Documentation
- `docs/TRIAGE_SYSTEM.md` - Complete technical documentation
- `docs/TRIAGE_FRONTEND_INTEGRATION.md` - Frontend integration guide
- `docs/TRIAGE_SUMMARY.md` - Implementation summary
- `TRIAGE_QUICKSTART.md` - This file

---

## ⚡ Quick Deploy

### 1. Verify Everything Is In Place
```bash
cd /home/leon/clawd/jedire/backend
bash scripts/verify-triage-system.sh
```

### 2. Run Database Migration
```bash
# Set your database URL
export DATABASE_URL="postgresql://user:pass@host:5432/database"

# Run migration
psql $DATABASE_URL -f src/database/migrations/017_deal_triage_system.sql

# Verify
psql $DATABASE_URL -c "\d+ deals" | grep triage
psql $DATABASE_URL -c "SELECT COUNT(*) FROM trade_areas;"
```

### 3. Restart Backend
```bash
npm run build
npm start

# Or in development mode
npm run dev
```

### 4. Test It
```bash
# Create a deal (replace $TOKEN with your JWT)
curl -X POST http://localhost:3000/api/v1/deals \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Triage Deal",
    "address": "123 Peachtree St NE, Atlanta, GA 30303",
    "boundary": {
      "type": "Polygon",
      "coordinates": [[
        [-84.3885, 33.7850],
        [-84.3830, 33.7850],
        [-84.3830, 33.7800],
        [-84.3885, 33.7800],
        [-84.3885, 33.7850]
      ]]
    },
    "projectType": "multifamily",
    "deal_category": "pipeline",
    "development_type": "new",
    "targetUnits": 50,
    "budget": 3500000
  }'

# Save the returned deal ID, then wait 2-3 seconds for auto-triage

# Get triage result
curl -X GET http://localhost:3000/api/v1/deals/<DEAL_ID>/triage \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📊 Expected Result

```json
{
  "dealId": "abc-123",
  "score": 28,
  "status": "Warm",
  "metrics": {
    "locationSignals": {
      "score": 12,
      "tradeArea": "Midtown Atlanta",
      "marketStrength": 0.85,
      "proximityScore": 0.90
    },
    "marketSignals": {
      "score": 10,
      "rentGrowth": 0.065,
      "populationGrowth": 0.032,
      "jobGrowth": 0.045,
      "trendVerdict": "Moderate Growth"
    },
    "propertySignals": {
      "score": 6,
      "propertyCount": 12,
      "avgRent": 1650,
      "avgOccupancy": 0.87,
      "qualityScore": 0.65
    }
  },
  "strategies": [
    "Standard Acquisition - Proceed with normal timeline",
    "Negotiate Terms - Room for favorable conditions"
  ],
  "risks": [
    "Limited Comparable Data - Insufficient market intel"
  ],
  "recommendations": [
    "Conduct detailed market research and feasibility study",
    "Gather additional comparable data from adjacent areas"
  ],
  "tradeAreaId": "def-456",
  "geocoded": {
    "lat": 33.785,
    "lng": -84.385,
    "municipality": "Atlanta",
    "state": "GA"
  },
  "triagedAt": "2026-02-09T14:23:45Z"
}
```

---

## 🎯 Scoring Reference

| Component | Max Points | Good Score |
|-----------|-----------|------------|
| **Location Signals** | 15 | 12+ |
| **Market Signals** | 15 | 12+ |
| **Property Signals** | 20 | 15+ |
| **TOTAL** | **50** | **35+** |

### Status Thresholds
- **35-50**: Hot 🔥 (Priority)
- **25-34**: Warm ☀️ (Solid)
- **15-24**: Watch 👀 (Uncertain)
- **0-14**: Pass ❌ (Weak)

---

## 🐛 Troubleshooting

### Migration Fails
```bash
# Check if column already exists
psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name='deals' AND column_name='triage_result';"

# If it exists, you're good!
```

### Auto-Triage Not Running
```bash
# Check logs for errors
tail -f logs/app.log | grep Triage

# Manually trigger triage
curl -X POST http://localhost:3000/api/v1/deals/<DEAL_ID>/triage \
  -H "Authorization: Bearer $TOKEN"
```

### Low Scores Every Time
- Check `properties` table has data in deal boundaries
- Verify trade areas are seeded: `SELECT * FROM trade_areas;`
- Review scoring logic in `DealTriageService.ts`

---

## 📚 Documentation

For more details, see:
1. **Technical Docs**: `docs/TRIAGE_SYSTEM.md`
2. **Frontend Guide**: `docs/TRIAGE_FRONTEND_INTEGRATION.md`
3. **Summary**: `docs/TRIAGE_SUMMARY.md`

---

## ✅ Verification Checklist

- [ ] Migration ran successfully
- [ ] Backend restarted without errors
- [ ] Created test deal
- [ ] Waited 2-3 seconds
- [ ] GET /api/v1/deals/:id/triage returns result
- [ ] Activity log shows "triage_completed"
- [ ] Score is in 0-50 range
- [ ] Status is one of: Hot/Warm/Watch/Pass
- [ ] Trade area assigned (if in Atlanta metro)

---

## 🎉 Success!

If all checks pass, the auto-triage system is live and working!

**Next Steps:**
1. Notify frontend team to start integration
2. Share `TRIAGE_FRONTEND_INTEGRATION.md` with them
3. Monitor logs for any issues
4. Plan user testing

**Questions?** Review the detailed documentation in `docs/TRIAGE_SYSTEM.md`
