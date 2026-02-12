# 🚀 Quick Test Guide - JEDI RE

**Goal:** Get from code → working demo in 15 minutes

---

## Step 1: Pull Latest Code (1 min)

```bash
git pull origin master
```

**New files:**
- `backend/migrations/004_test_properties.sql` - 30 Atlanta properties
- `backend/migrations/003_analysis_results.sql` - Analysis results table
- `backend/src/services/dealAnalysis.ts` - JEDI Score engine
- `PYTHON_ENGINE_INTEGRATION.md` - Full docs

---

## Step 2: Run Migrations (2 min)

**In Replit DB Console, run these in order:**

### A. Analysis Results Table
```sql
-- Copy from: backend/migrations/003_analysis_results.sql
CREATE TABLE IF NOT EXISTS analysis_results (...);
```

### B. Test Properties
```sql
-- Copy from: backend/migrations/004_test_properties.sql
INSERT INTO properties (...) VALUES (...);
```

**Verify:**
```sql
SELECT COUNT(*) FROM properties WHERE city = 'Atlanta';
-- Should return: 30
```

---

## Step 3: Restart Backend (1 min)

```bash
npm run build
npm run start
# Or just hit the "Run" button in Replit
```

**Check logs for:** "Server running on port 3000"

---

## Step 4: Test Analysis Endpoint (2 min)

### Create a Test Deal First

**In frontend or via API:**
```javascript
POST /api/v1/deals
{
  "name": "Buckhead Tower Development",
  "projectType": "multifamily",
  "boundary": {
    "type": "Polygon",
    "coordinates": [[
      [-84.38, 33.83],   // Southwest corner
      [-84.36, 33.83],   // Southeast corner
      [-84.36, 33.86],   // Northeast corner
      [-84.38, 33.86],   // Northwest corner
      [-84.38, 33.83]    // Close polygon
    ]]
  },
  "targetUnits": 100,
  "budget": 25000000
}
```

**This boundary covers Buckhead area with 5 test properties**

### Run Analysis

```bash
curl -X POST https://your-replit.repl.co/api/v1/deals/{dealId}/analysis/trigger \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "dealId": "uuid",
  "jediScore": 75-85,
  "verdict": "OPPORTUNITY",
  "confidence": 0.85,
  "analysis": {
    "developmentCapacity": {
      "maxUnits": 100-150,
      "constructionCost": 25000000-30000000,
      "developmentPotential": "HIGH",
      "costPerUnit": 250000
    },
    "recommendations": [
      "Strong development opportunity...",
      "High unit capacity..."
    ]
  }
}
```

---

## Step 5: Test in Frontend (5 min)

### A. Create Deal
1. Go to `/dashboard`
2. Click "Create Deal"
3. Draw boundary around Buckhead
4. Name it, fill details
5. Create

### B. View Deal
1. Click on the deal card
2. Navigate to "Properties" tab
3. Verify 5+ properties show up

### C. Run Analysis
1. Go to "Strategy" tab
2. Click "Run Analysis" button
3. Wait ~5 seconds
4. See JEDI Score display
5. Check verdict badge color
6. Read recommendations

### D. Check Lease Intelligence
1. Still on "Strategy" tab
2. Scroll down to "Lease Rollover Analysis"
3. Verify:
   - Expiring next 30 days count
   - Expiring next 90 days count
   - Rollover risk score
   - Rent gap opportunity (if any)
   - 12-month timeline chart

---

## Expected Results

### Properties Tab:
- **5-10 properties** in Buckhead boundary
- Rents: $2,100-$2,800/month
- Building class: A to A+
- Lease data visible

### Strategy Tab - JEDI Score:
- **Score:** 70-85 (OPPORTUNITY range)
- **Verdict:** Green/Blue badge
- **Recommendations:** 3-4 smart insights
- **Capacity:** 100-150 units estimate

### Strategy Tab - Lease Analysis:
- **Expiring 30 days:** 2-3 units
- **Expiring 90 days:** 4-5 units
- **Rollover Risk:** 40-60% (medium-high)
- **Rent Gap:** $500-1000 below market

---

## Troubleshooting

### "No properties found in deal boundary"
**Fix:** Boundary doesn't overlap test properties
- Try Midtown instead: `[-84.39, 33.77]` to `[-84.37, 33.79]`
- Or expand Buckhead boundary

### "Python analysis failed"
**Result:** Should still work with fallback estimates
**Check:** Console logs for Python errors (non-blocking)

### "Analysis results table does not exist"
**Fix:** Run migration Step 2A again

### JEDI Score seems low
**Normal:** Test data is limited
- Real scores come with more properties
- 50-70 is typical for test data

---

## Quick Reference: Test Boundaries

**Buckhead (high-end, 5 properties):**
```json
{
  "type": "Polygon",
  "coordinates": [[
    [-84.38, 33.83],
    [-84.36, 33.83],
    [-84.36, 33.86],
    [-84.38, 33.86],
    [-84.38, 33.83]
  ]]
}
```

**Midtown (mixed, 5 properties):**
```json
{
  "type": "Polygon",
  "coordinates": [[
    [-84.39, 33.77],
    [-84.37, 33.77],
    [-84.37, 33.79],
    [-84.39, 33.79],
    [-84.39, 33.77]
  ]]
}
```

**Virginia Highland (trendy, 4 properties):**
```json
{
  "type": "Polygon",
  "coordinates": [[
    [-84.36, 33.77],
    [-84.34, 33.77],
    [-84.34, 33.79],
    [-84.36, 33.79],
    [-84.36, 33.77]
  ]]
}
```

---

## Success Checklist

- [ ] Migrations run (30 properties in database)
- [ ] Backend restarts without errors
- [ ] Deal created with boundary
- [ ] Properties appear in Properties tab
- [ ] "Run Analysis" button works
- [ ] JEDI Score displays (0-100)
- [ ] Verdict badge shows with color
- [ ] Recommendations list populates
- [ ] Lease rollover section displays
- [ ] Timeline chart renders

---

## Next Steps After Testing

1. ✅ Confirm all features working
2. 🎨 Polish any UI issues
3. 📊 Add more test data if needed
4. 🚀 Deploy to production URL
5. 🎉 Demo ready!

---

**Total Time:** ~15 minutes from pull to working demo

**Questions?** Check `PYTHON_ENGINE_INTEGRATION.md` for detailed docs
