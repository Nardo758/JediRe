# Florida Municode Scraper Status

**Date:** February 26, 2026  
**Goal:** Get zoning data for all Florida municipalities from Municode

---

## ✅ Completed

### 1. Cloudflare Worker Deployed
- **URL:** `https://municode-scraper.m-dixon5030.workers.dev`
- **Status:** ✅ Live and responding
- **Florida Cities Added:** 4 initial targets
  - St. Petersburg, FL
  - Hialeah, FL
  - Cape Coral, FL
  - Port St. Lucie, FL

### 2. Florida Cities Catalog Created
- **File:** `/home/leon/clawd/municode-scraper-noclocks/data/fl_town_urls.csv`
- **Count:** 40 major Florida municipalities
- **Includes:**
  - Your 4 target cities
  - All major metros: Miami, Tampa, Orlando, Jacksonville
  - Tourist destinations: Key West, Naples, Sarasota
  - Growing cities: Cape Coral, Port St. Lucie, Palm Coast
  - County seats: Tallahassee, Pensacola, Gainesville

### 3. Alternative Scraper Repo Cloned
- **Repo:** `github.com/noclocks/municode-scraper` 
- **Type:** Python + Selenium (headless browser)
- **Advantage:** Can scrape JavaScript-heavy pages
- **Location:** `/home/leon/clawd/municode-scraper-noclocks/`

---

## ⚠️ Current Issue

### Worker Parsing Problem
The Cloudflare Worker is deployed but returning **0 districts** for all cities (including working ones like Birmingham, AL).

**Root Cause:**
- Simple `fetch()` + regex isn't matching Municode's HTML structure
- Municode likely loads content dynamically via JavaScript
- Worker uses regex pattern `/\b([A-Z]{1,3}[-\s]?\d{1,2}[A-Z]?)\b/g` which isn't finding zoning codes

**Test Results:**
```bash
curl -X POST https://municode-scraper.m-dixon5030.workers.dev/scrape \
  -H "Content-Type: application/json" \
  -d '{"municipalityId":"st-petersburg-fl"}'
  
# Response:
{
  "success": true,
  "municipality": "St. Petersburg",
  "state": "FL",
  "districtsFound": 0,  ⚠️ Should be 20-30+
  "districts": [],
  "scrapedAt": "2026-02-26T23:18:19.800Z"
}
```

---

## 🔧 Solutions

### Option 1: Fix Cloudflare Worker ⭐ Recommended
**Upgrade to Browser Rendering API**

Add Puppeteer to worker:
```javascript
import puppeteer from '@cloudflare/puppeteer';

// In worker
const browser = await puppeteer.launch(env.MYBROWSER);
const page = await browser.newPage();
await page.goto(municodeUrl);
const html = await page.content();
// Parse actual rendered HTML
```

**Requirements:**
- Cloudflare Workers Paid plan ($5/month) ✅ You already have this
- Add Browser Rendering binding to `wrangler.toml`
- Rewrite parser to use actual DOM instead of regex

**Time:** 2-3 hours  
**Benefit:** Scales to all 40+ Florida cities automatically

---

### Option 2: Python Selenium Scraper 
**Use the noclocks repo locally**

Already installed at `/home/leon/clawd/municode-scraper-noclocks/`

**Steps:**
1. Activate venv: `source venv/bin/activate`
2. Modify `main.py` to loop through Florida CSV
3. Run locally: `python main.py`
4. Scrape all 40 cities sequentially (~2-4 hours runtime)
5. Export to JSON/CSV
6. Import to your database

**Requirements:**
- Chrome/Chromium installed ✅ You have `/usr/bin/chromium-browser`
- Python dependencies installed ✅ Done
- Fix Chrome driver initialization (WSL headless issues)

**Time:** 1 hour setup + 3 hours runtime  
**Benefit:** One-time scrape, proven codebase

---

### Option 3: Manual Verification + API Integration
**Verify a few key cities manually**

1. Browse to each Municode page manually
2. Find the correct zoning chapter `nodeId`
3. Update worker with correct paths
4. Test each city individually
5. Scale to remaining cities

**Example for St. Petersburg:**
1. Visit: https://library.municode.com/fl/st._petersburg/codes/code_of_ordinances
2. Navigate to "Chapter 16 - Zoning"
3. Copy the URL parameter: `?nodeId=XXXXX`
4. Update worker:
```javascript
'st-petersburg-fl': {
  zoningChapterPath: '?nodeId=CORRECT_NODE_ID_HERE',
}
```

**Time:** 30 min per city × 40 cities = 20 hours  
**Benefit:** Most accurate, verified paths

---

### Option 4: Direct Database Approach
**Skip Municode, use county GIS APIs instead**

Florida counties with direct APIs:
- **Miami-Dade:** ArcGIS REST API (public)
- **Broward:** Property Appraiser API
- **Palm Beach:** GIS Open Data
- **Hillsborough (Tampa):** Open Data Portal
- **Orange (Orlando):** Data Portal
- **Pinellas (St. Pete/Clearwater):** GIS Services

**Benefit:** 
- More reliable data
- Parcel-level zoning (not just district descriptions)
- No scraping needed
- Real-time updates

**Time:** 2-3 hours per county API integration  
**Coverage:** ~60% of Florida population

---

## 📊 Data Comparison

### What Municode Provides:
- ✅ Zoning district descriptions
- ✅ Permitted uses
- ✅ Max density (units/acre)
- ✅ Height limits (feet/stories)
- ✅ Parking requirements
- ✅ Setback rules
- ❌ Parcel-level zoning (must look up by address)

### What County APIs Provide:
- ❌ General district descriptions (limited)
- ✅ Parcel-level zoning code
- ✅ Current land use
- ✅ Property dimensions
- ✅ Ownership
- ✅ Assessed value
- ✅ Historical sales
- ✅ Real-time updates

---

## 🎯 Recommended Approach

**Hybrid Strategy: County APIs + Municode Fallback**

1. **Phase 1:** Integrate major FL county GIS APIs (1 week)
   - Miami-Dade, Broward, Palm Beach, Hillsborough, Orange, Pinellas
   - Covers 60%+ of Florida population
   - Parcel-level zoning lookups

2. **Phase 2:** Fix Cloudflare Worker with Browser Rendering (3 hours)
   - Upgrade to Puppeteer
   - Test on 5 working cities
   - Scale to all 40 Florida municipalities

3. **Phase 3:** Backend Integration (2 hours)
   - Create zoning lookup API endpoint
   - Auto-populate zoning fields in deal forms
   - Cache Municode data for offline use

---

## 📁 Files Created

1. `/home/leon/clawd/workers/municode-scraper.js` - Cloudflare Worker (deployed)
2. `/home/leon/clawd/municode-scraper-noclocks/` - Python Selenium scraper (cloned)
3. `/home/leon/clawd/municode-scraper-noclocks/data/fl_town_urls.csv` - 40 FL cities catalog
4. This file - Status and recommendations

---

## 🚀 Next Steps (Your Choice)

**Quick Win (Today):**
- [ ] Test worker with Browser Rendering on 1 FL city
- [ ] Verify it finds districts
- [ ] Scale to all 40 cities

**Thorough Approach (This Week):**
- [ ] Integrate Miami-Dade County API (biggest FL metro)
- [ ] Test parcel-level zoning lookups
- [ ] Add auto-populate button to deal forms
- [ ] Expand to other FL counties

**Let me know which direction you want to go!** 🎯
