# Command Center - Mission Control for JediRE

**Status:** ✅ DEPLOYED  
**Access:** `/admin/command-center` in the web UI

---

## 🎮 Overview

The Command Center is your **one-stop dashboard** for managing all data synchronization operations across the JediRE platform. No more running shell commands - everything is controllable from the UI.

**Think:** Mission control for your entire data pipeline.

---

## 📊 What It Does

### **1. Quick Actions**
Click-to-execute common operations:
- **Sync Atlanta** - Pull 246 Atlanta properties from Apartment Locator AI
- **Sync All Metros** - Pull 7,337 properties from 17 metros
- **Import Zoning** - (Coming soon) Import municipal zoning data

### **2. Real-Time Job Monitoring**
- Live progress bars for active sync jobs
- Job status: pending → running → completed/failed
- Automatic polling every 5 seconds when jobs are active

### **3. Data Status Dashboard**
See exactly what's in your database:
- Total properties
- Apartment Locator synced count
- Municipal data synced count
- Cities covered
- Breakdown by city with enrichment percentages

### **4. Integration Health**
Monitor all external APIs:
- ✅ Apartment Locator AI - Connection status + properties available
- ✅ Municipal APIs - Configured cities
- ⚠️ Photo Scraper - Status
- ⚠️ M27 Comps - Status

### **5. Data Quality Metrics**
For each city (especially Atlanta):
- % with rent data
- % with coordinates
- % with property type
- % with tax data
- % with unit counts
- % with year built

Color-coded:
- 🟢 Green: 80%+ (good)
- 🟡 Yellow: 40-79% (needs work)
- 🔴 Red: <40% (critical)

### **6. Job History**
Last 10 completed jobs with:
- Status (success/failure)
- Timestamp
- Results (properties inserted/updated)
- Error messages (if failed)

---

## 🚀 How to Use

### **Access the Command Center**

1. Go to `/admin` in your JediRE app
2. Click **"Command Center"** button in top-right (blue button with ⚡ icon)
3. Or navigate directly to `/admin/command-center`

### **Sync Atlanta Properties**

```
1. Click "Sync Atlanta" button
2. Job starts immediately
3. Progress bar shows live updates
4. Completes in 30-60 seconds
5. See "Properties Inserted: X" in job history
```

**What happens:**
- Fetches 246 Atlanta properties from Apartment Locator AI
- Merges with existing properties (by address)
- Enriches with: name, units, rent, beds/baths, sqft
- Calculates occupancy from supply data
- Stores market snapshot

### **Sync All Metros**

```
1. Click "Sync All Metros" button
2. Confirm dialog (17 metros, may take several minutes)
3. Click "OK"
4. Watch progress bar update for each metro
5. Completes in 5-10 minutes
6. See results per metro in job history
```

**What happens:**
- Syncs 17 metros sequentially
- ~7,337 properties total
- Rate-limited to avoid API throttling
- Results show per-metro breakdown

---

## 📊 Dashboard Sections

### **Data Status Card**
```
Total Properties: 246
Apartment Locator Synced: 246
Municipal Synced: 0
Cities Covered: 1
```

### **Integration Status Card**
```
✅ Apartment Locator AI - 246 properties available
✅ Municipal APIs - 17 cities configured
⚠️  Photo Scraper - Not configured
⚠️  M27 Comps Database - Database empty
```

### **Data Quality Grid (Atlanta)**
```
Rent Data:      100%  🟢
Coordinates:    0%    🔴
Property Type:  0%    🔴
Tax Data:       0%    🔴
Unit Count:     100%  🟢
Year Built:     50%   🟡
```

### **City Coverage Table**
```
City            Properties  Enriched  Rent Data
──────────────────────────────────────────────
Atlanta, GA     246         246       100% 🟢
Houston, TX     0           0         0%   🔴
Dallas, TX      0           0         0%   🔴
```

---

## 🔧 Technical Architecture

### **Backend Services**

**`command-center.service.ts`**
- Orchestrates all sync operations
- Manages job queue (in-memory Map)
- Tracks progress and status
- Provides data metrics

**Methods:**
```typescript
getDataStatus()          // Overall platform stats
getIntegrationStatus()   // API health checks
syncAtlanta()           // Start Atlanta sync job
syncAllMetros()         // Start multi-metro sync
getJobStatus(jobId)     // Get specific job
getActiveJobs()         // All running jobs
getJobHistory(limit)    // Recent completed jobs
getDataQuality()        // Quality metrics
```

### **API Routes**

**`command-center.routes.ts`**

```typescript
GET  /api/v1/command-center/status
POST /api/v1/command-center/sync-atlanta
POST /api/v1/command-center/sync-all-metros
GET  /api/v1/command-center/job/:jobId
GET  /api/v1/command-center/jobs/active
GET  /api/v1/command-center/jobs/history
```

All routes require authentication (`requireAuth` middleware).

### **Frontend Component**

**`CommandCenterPage.tsx`**
- Real-time dashboard with live polling
- One-click action buttons
- Progress bars for active jobs
- Color-coded quality metrics
- Responsive grid layout

**Auto-refresh:**
- Polls `/api/v1/command-center/status` every 5 seconds when jobs are active
- Manual refresh button available

---

## 📋 Example Workflow

### **Initial Platform Setup**

```
Day 1:
1. Navigate to /admin/command-center
2. Click "Sync Atlanta"
3. Wait 60 seconds
4. Verify: 246 properties with rent data ✅
5. Data Quality shows: Rent 100%, Coords 0%

Day 2:
1. Run municipal API import (via admin panel or shell)
2. Refresh Command Center
3. Data Quality shows: Rent 100%, Coords 100%, Tax 100% ✅

Day 3:
1. Click "Sync All Metros"
2. Wait 10 minutes
3. Verify: 7,337 properties across 17 cities ✅
```

### **Weekly Maintenance**

```
Every Saturday (after Apartment Locator AI Friday scrape):
1. Open Command Center
2. Check "Last Sync" in job history
3. If >7 days old, click "Sync All Metros"
4. Monitor data quality metrics
5. Investigate any red/yellow metrics
```

---

## 🎯 Data Quality Goals

**For each metro:**
- 🎯 Rent data: 100% (from Apartment Locator)
- 🎯 Coordinates: 100% (from geocoding)
- 🎯 Property type: 100% (from municipal APIs)
- 🎯 Tax data: 80%+ (from municipal APIs)
- 🎯 Unit counts: 100% (from Apartment Locator)
- 🎯 Year built: 80%+ (from municipal APIs)

**Command Center helps track these metrics per city.**

---

## 🔮 Future Enhancements

### **Coming Soon:**
- **Import Zoning button** - One-click zoning data import
- **Import Photos button** - Trigger photo scraper
- **M27 Comp Sync** - Populate comparables database
- **Geocoding button** - Batch geocode missing coords
- **Calculate Metrics button** - Batch calculate NOI/cap rate

### **Advanced Features:**
- **Scheduled Sync** - Auto-run every Saturday at 9 AM
- **Slack/Email Alerts** - Notify when jobs complete
- **Data Quality Trends** - Historical graphs
- **Per-Metro Actions** - Sync individual cities
- **Rollback** - Undo a sync if data is bad
- **Export Reports** - CSV export of sync results

---

## 💡 Pro Tips

1. **Always sync Atlanta first** - Test with one city before syncing all 17
2. **Check integration status before syncing** - Ensure Apartment Locator is connected
3. **Monitor active jobs** - Don't start multiple syncs simultaneously
4. **Review job history** - Check for errors in recent syncs
5. **Use data quality metrics** - Identify which fields need enrichment

---

## 🐛 Troubleshooting

### **"Sync Atlanta" button disabled**
**Cause:** Another job is already running  
**Fix:** Wait for active job to complete, or refresh page

### **Job shows "failed" status**
**Cause:** API connection issue or data error  
**Fix:** Check job history for error message, verify API keys in Replit Secrets

### **Data quality shows 0% for everything**
**Cause:** Sync hasn't run yet or failed silently  
**Fix:** Click "Sync Atlanta" and monitor job completion

### **Integration shows "not connected"**
**Cause:** API key missing or invalid  
**Fix:** Check Replit Secrets, verify APARTMENT_LOCATOR_API_KEY is set

### **Progress bar stuck at same percentage**
**Cause:** Job is processing, may take time for large datasets  
**Fix:** Be patient, check backend logs if stuck >5 minutes

---

## 📊 Success Metrics

After your first sync, you should see:

```
Data Status:
  Total Properties: 246
  Apartment Locator Synced: 246
  Cities Covered: 1

Integration Status:
  ✅ Apartment Locator AI - Connected
  ✅ Municipal APIs - 17 cities configured

Data Quality (Atlanta):
  Rent Data: 100% 🟢
  Unit Count: 100% 🟢

Job History:
  ✅ apartment_locator_atlanta - 2 min ago - +246 properties
```

---

## 🚀 Next Steps After Using Command Center

1. **Verify PropertyDetailsPage** - Check `/properties/{id}` shows rent data
2. **Run Municipal Sync** - Add tax/zoning data via admin panel
3. **Sync More Metros** - Click "Sync All Metros" for full coverage
4. **Set Up Automation** - Schedule Saturday syncs
5. **Monitor Quality** - Check Command Center weekly

---

**Access:** `/admin/command-center`  
**Built:** March 7, 2026  
**Status:** ✅ Production Ready
