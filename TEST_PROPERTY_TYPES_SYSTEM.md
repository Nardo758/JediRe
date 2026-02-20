# 🧪 Property Types System - Testing Guide

**Run these tests in Replit to verify the system works!**

---

## ✅ Test 1: Database Verification (Run in Replit Shell)

```bash
# Check if migrations are deployed
cd backend
npx tsx -e "
import { pool } from './src/database/connection';

async function test() {
  // Test 1: Count property types
  const types = await pool.query('SELECT COUNT(*) as count FROM property_types');
  console.log('✅ Property Types:', types.rows[0].count, '(expected: 51)');
  
  // Test 2: Count strategies  
  const strategies = await pool.query('SELECT COUNT(*) as count FROM property_type_strategies');
  console.log('✅ Strategies:', strategies.rows[0].count, '(expected: 204)');
  
  // Test 3: Sample property type
  const sample = await pool.query('SELECT name, category FROM property_types LIMIT 3');
  console.log('✅ Sample Types:', sample.rows);
  
  // Test 4: Sample strategies for one type
  const stratSample = await pool.query(\`
    SELECT pt.name, pts.strategy_name, pts.strength, pts.hold_period_min 
    FROM property_type_strategies pts
    JOIN property_types pt ON pt.id = pts.type_id
    WHERE pt.type_key = 'single_family'
  \`);
  console.log('✅ Single-Family Strategies:', stratSample.rows);
  
  await pool.end();
}

test().catch(console.error);
"
```

**Expected Output:**
```
✅ Property Types: 51 (expected: 51)
✅ Strategies: 204 (expected: 204)
✅ Sample Types: [Array of 3 property types]
✅ Single-Family Strategies: [4 strategies: Build-to-Sell, Flip, Rental, Airbnb]
```

---

## ✅ Test 2: API Endpoints (Run in Replit Shell)

```bash
# Test GET /api/property-types
curl http://localhost:3001/api/property-types | jq '.length'
# Expected: 51

# Test GET /api/property-type-strategies  
curl http://localhost:3001/api/property-type-strategies | jq '.length'
# Expected: 204

# Test strategies for specific type
curl "http://localhost:3001/api/property-type-strategies?propertyTypeId=1" | jq '.'
# Expected: Array of 4 strategies
```

---

## ✅ Test 3: Frontend - Deal Creation Flow

**Manual Test in Browser:**

1. Navigate to: `https://[your-replit-url]/deals/new`
2. **Step 3: Property Type Selection**
   - Should see dropdown with 51 property types
   - Types grouped by 9 categories (Residential, Commercial, etc.)
3. **Step 4: Investment Strategy**
   - Select a property type (e.g., "Class A Multifamily")
   - Should see 4 strategy options:
     - Build-to-Sell
     - Flip  
     - Rental (usually primary)
     - Airbnb/STR
   - Each shows strength badge (Strong/Moderate/Weak/Rare/N/A)
4. **Financial Model Auto-Population**
   - Select "Rental" strategy
   - Check if these fields auto-populate:
     - Hold Period: 60-360 months
     - Key Metrics: "Monthly Rent", "Cap Rate", "Cash-on-Cash", "Rent/SF"

**✅ Pass Criteria:**
- All 51 types visible
- 4 strategies per type
- Strength badges display correctly
- Financial model receives defaults

---

## ✅ Test 4: Settings UI

**Manual Test in Browser:**

1. Navigate to: `https://[your-replit-url]/settings/property-types`
2. **Verify Display:**
   - 9 category sections (Residential, Commercial, Industrial, etc.)
   - Property types grouped under categories
   - Multi-select checkboxes
   - Strategy strength badges (color-coded)
3. **Test Interaction:**
   - Check/uncheck property types
   - Verify state persists
   - Test "Select All" / "Deselect All" (if present)

**✅ Pass Criteria:**
- Clean category grouping
- Icons render (not text strings)
- Checkboxes work
- Settings save properly

---

## 🐛 Quick Fixes if Needed

### If migrations not run:
```bash
cd backend
npx tsx src/scripts/run-migrations.ts
```

### If API returns 0 results:
```sql
-- Check if property_types table exists
SELECT COUNT(*) FROM property_types;

-- If 0, manually run migration 038
\i backend/migrations/038_property_type_strategies.sql
```

### If frontend errors:
```bash
# Check if PropertyTypesSettings route exists
cd frontend
grep -r "PropertyTypesSettings" src/
```

---

## 📊 Test Results Template

**Date:** _______________  
**Tester:** _______________

| Test | Status | Notes |
|------|--------|-------|
| Database Verification | ⬜ Pass / ⬜ Fail | |
| API Endpoints | ⬜ Pass / ⬜ Fail | |
| Deal Creation Flow | ⬜ Pass / ⬜ Fail | |
| Settings UI | ⬜ Pass / ⬜ Fail | |

**Issues Found:**
- 

**Ready for Production:** ⬜ Yes / ⬜ No

---

## 🚀 Next Steps After Testing

1. ✅ Mark tests as passed
2. 📝 Document any issues found
3. 🔧 Fix critical bugs
4. ✅ Deploy to production
5. 👥 Open for beta testing

---

**Created:** 2026-02-20 14:15 EST by RocketMan 🚀
