# Quick Setup: Data Coverage Admin Panel

## 5-Minute Setup Guide

### Step 1: Run Migration (2 min)
```bash
cd jedire/backend
psql $DATABASE_URL -f migrations/026_data_coverage_tracking.sql
```

**Expected output:**
```
CREATE TABLE
CREATE INDEX
...
INSERT 0 6
```

### Step 2: Wire Up Routes (1 min)

Edit `backend/src/index.replit.ts`:

```typescript
// Add import at top
import adminDataCoverageRoutes from './api/rest/admin-data-coverage.routes';

// Add route with other API routes (around line 50-60)
app.use('/api/v1/admin/data-coverage', adminDataCoverageRoutes);
```

### Step 3: Restart Backend (30 sec)
```bash
# In Replit, click "Stop" then "Run"
# Or manually:
npm run dev
```

### Step 4: Test It! (1 min)

```bash
# Get coverage summary (should show Fulton County)
curl http://localhost:3000/api/v1/admin/data-coverage \
  -H "Authorization: Bearer YOUR_TOKEN"

# Should return:
{
  "counties": [
    {
      "county": "Fulton",
      "state_code": "GA",
      "total_parcels": 340000,
      "scraped_count": 0,
      "coverage_percentage": 0,
      "api_status": "active"
    },
    ...
  ]
}
```

### Step 5: Trigger First Scrape (30 sec)

```bash
# Import 10 properties to test
curl -X POST http://localhost:3000/api/v1/admin/data-coverage/Fulton/GA/scrape \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10, "minUnits": 1}'
```

## ✅ Success Checklist

- [ ] Migration ran without errors
- [ ] Routes added to main app
- [ ] Backend restarted successfully
- [ ] GET /admin/data-coverage returns Fulton County
- [ ] POST /admin/data-coverage/Fulton/GA/scrape imports properties
- [ ] Coverage percentage updates after scrape
- [ ] Activity log shows recent scrapes

## 🎯 What's Next?

### Option A: Use API Directly
Just call the endpoints from your code:
- Monitor coverage from any backend service
- Trigger scrapes programmatically
- Check data freshness

### Option B: Build Dashboard (Optional, 2 hours)
Create visual admin panel:
1. Copy component from `DATA_COVERAGE_TRACKER.md`
2. Add route: `/admin/data-coverage`
3. Polish UI

### Option C: Automate (Recommended)
Set up cron job to:
- Update stats daily
- Refresh stale properties
- Alert on coverage drops

## 🚨 Troubleshooting

**"Function uuid_generate_v4() does not exist"**
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

**"Permission denied"**
Make sure your user has admin role:
```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

**"Cannot find module"**
Routes file path might be wrong:
```typescript
// Make sure path is correct relative to index.replit.ts
import adminDataCoverageRoutes from './api/rest/admin-data-coverage.routes';
```

## 💡 Quick Tips

**Test with Postman/Insomnia:**
Import the API endpoints for easier testing.

**Start Small:**
Always test with `limit: 10` first.

**Monitor Logs:**
Watch backend logs to see scraping progress.

**Check Database:**
```sql
SELECT * FROM property_data_coverage;
SELECT * FROM scrape_activity_log ORDER BY created_at DESC LIMIT 10;
```

---

**Total Time:** 5 minutes
**Difficulty:** Easy ⭐⭐
**Value:** High - complete data monitoring system
