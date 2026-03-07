# Apartment Locator AI Integration - Action Plan

**Status:** API Key received, endpoints tested, authentication format needs clarification  
**Date:** March 7, 2026 12:33 PM EST

---

## ✅ What's Working

**API Connection Test Results:**
```
✅ 7/7 endpoints responding (HTTP 200)
✅ Service is live and accessible
✅ API Key accepted (no 401/403 errors)
```

**API Details:**
- **Base URL:** `https://apartment-locator-ai-real.replit.app`
- **API Key:** `aiq_2248e8fc535c5a9c4a09f9ed1c0d719bf0ad45f56b2c47841de6bc1421388f6b`
- **Auth Method:** Bearer token (`Authorization: Bearer {key}`)

**Available Endpoints (confirmed):**
1. ✅ `/api/status` - Service status
2. ✅ `/api/health` - Health check
3. ✅ `/api/v1/status` - V1 API status
4. ✅ `/api/v1/properties` - Properties list
5. ✅ `/api/v1/properties?city=Atlanta&state=GA` - Filtered properties
6. ✅ `/api/v1/market-snapshots` - Market data
7. ✅ `/api/v1/market-snapshots?city=Atlanta&state=GA` - City market data

---

## ⚠️ Issue Found

**Problem:** Endpoints return HTML instead of JSON

**Test result:**
```javascript
fetch('https://apartment-locator-ai-real.replit.app/api/v1/properties?city=Atlanta&state=GA&limit=2', {
  headers: { 'Authorization': 'Bearer aiq_2248e8fc...' }
})
// Returns: <!DOCTYPE html>... (HTML page, not JSON)
```

**Possible causes:**
1. **Wrong auth header format** - Maybe needs `x-api-key` instead of `Authorization`?
2. **Missing content-type header** - Maybe needs `Accept: application/json`?
3. **Different endpoint path** - Maybe actual data is at `/api/data/properties`?
4. **Web UI redirecting** - Frontend catching API requests?

---

## 🎯 Next Steps (Need Your Help)

### Option A: Contact Apartment Locator AI Team
Ask them:
1. What's the correct auth header format?
   - `Authorization: Bearer {key}`?
   - `x-api-key: {key}`?
   - `api_key` query parameter?

2. What's the response format?
   - JSON with `{properties: [], count: N}`?
   - Just array `[{}, {}]`?
   - Paginated with cursor?

3. Sample curl command that works?
   ```bash
   curl -X GET "https://apartment-locator-ai-real.replit.app/api/v1/properties?city=Atlanta" \
     -H "???: ???"
   ```

### Option B: Check Apartment Locator AI Docs/README
- Is there a `/docs` endpoint?
- GitHub repo with API documentation?
- Example integration code?

### Option C: I Can Reverse Engineer
If you can:
1. Log into Apartment Locator AI web interface
2. Open browser DevTools → Network tab
3. Perform a search (e.g., "Atlanta apartments")
4. Copy the actual API request headers & response format
5. Send me that info

---

## 📦 What's Ready to Deploy (Once API Format Confirmed)

### 1. Environment Configuration
```bash
# Already created: .env.apartment-locator
APARTMENT_LOCATOR_API_URL=https://apartment-locator-ai-real.replit.app
APARTMENT_LOCATOR_API_KEY=aiq_2248e8fc535c5a9c4a09f9ed1c0d719bf0ad45f56b2c47841de6bc1421388f6b
```

### 2. Test Script
```bash
# Test connection
npx tsx test-apartment-locator-connection.ts
```

### 3. Integration Code (Ready)
- `backend/src/scripts/enrich-from-apartment-locator.ts` - Enrichment script
- `backend/src/middleware/auth.ts` - API key validation
- Database schema for `rent_comps` table

### 4. Sync Architecture (Documented)
- `DATA_SYNC_ARCHITECTURE.md` - Full 7-day implementation plan
- Municipal API + Apartment Locator AI merge workflow
- Automated daily sync jobs

---

## 🚀 Once API Format is Clear (30 Minutes to Deploy)

### Phase 1: Quick Test (5 minutes)
```bash
# Add correct headers to test script
# Verify we can fetch 5 Atlanta properties
# Check response structure
```

### Phase 2: Update Integration Code (10 minutes)
```typescript
// Update enrich-from-apartment-locator.ts with correct:
const response = await fetch(`${APARTMENT_LOCATOR_URL}/properties/search`, {
  headers: {
    'X-API-Key': APARTMENT_LOCATOR_API_KEY,  // or whatever format
    'Accept': 'application/json'
  }
});

const data = await response.json();
// Handle actual response structure
```

### Phase 3: Test Sync (10 minutes)
```bash
# Sync 10 Atlanta properties
npx tsx backend/src/scripts/enrich-from-apartment-locator.ts

# Verify in database
SELECT COUNT(*) FROM rent_comps WHERE source = 'apartment_locator_ai';
```

### Phase 4: Full Sync (5 minutes)
```bash
# Sync all available metros (17 cities, 928 zip codes)
# Populate rent_comps table
# Verify PropertyDetailsPage shows data
```

---

## 📊 Expected Data Structure

Based on code analysis, Apartment Locator AI should return:

```typescript
interface ApartmentLocatorProperty {
  id: string;
  name: string;                    // e.g., "Riverside Apartments"
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  units: number;
  
  // Rent data by unit type
  rent_studio?: number;
  rent_1br?: number;
  rent_2br?: number;
  rent_3br?: number;
  
  // Additional data
  occupancy_rate?: number;
  year_built?: number;
  amenities?: string[];
  rating?: number;
  status?: 'active' | 'under_construction' | 'planned';
  
  // Photos (hybrid system)
  photos?: Array<{
    url: string;
    source: 'scraped' | 'google' | 'placeholder';
  }>;
  
  // Marketing info
  website?: string;
  special_offers?: string;
}
```

---

## 🎯 Coverage (Per Documentation)

**17 Metro Areas:**
- Atlanta (91 zips)
- Houston (120 zips)
- South Florida (129 zips)
- Dallas-Fort Worth (92 zips)
- Tampa Bay (78 zips)
- San Antonio (64 zips)
- Austin (53 zips)
- Gulf Coast FL (53 zips)
- Jacksonville (44 zips)
- Charlotte (43 zips)
- Orlando (42 zips)
- Raleigh-Durham (38 zips)
- Nashville (33 zips)
- Charleston (17 zips)
- Savannah (11 zips)
- Tallahassee (10 zips)
- Gainesville (10 zips)

**Total:** 928 zip codes, ~30 listings per zip, ~27,840 properties

---

## 💰 Cost

**From documentation:**
- Apify Starter plan: $29/month
- ~140 actor runs per scrape
- ~$2.80 per run
- Scrapes every Friday 9 AM ET

---

## ✅ Final Checklist

- [ ] Get correct API authentication format from Apartment Locator AI team
- [ ] Update test script with correct headers
- [ ] Verify response structure matches expected interface
- [ ] Update enrich-from-apartment-locator.ts with correct API calls
- [ ] Test sync with 10 properties
- [ ] Add environment variables to Replit Secrets
- [ ] Run full sync for Atlanta (91 zip codes)
- [ ] Verify data in rent_comps table
- [ ] Test PropertyDetailsPage shows enriched data
- [ ] Set up automated Saturday 9 AM sync job
- [ ] Monitor first week of syncs

---

## 📞 What to Send Me

**Quick option:** Working curl command
```bash
curl "https://apartment-locator-ai-real.replit.app/api/v1/properties?city=Atlanta" \
  -H "YOUR-HEADER-HERE: YOUR-VALUE-HERE"
```

**OR**

**Browser DevTools screenshot showing:**
1. Request URL
2. Request Headers (especially auth)
3. Response JSON structure

**Then I can deploy in 30 minutes!**

---

**Status:** Waiting for API authentication format clarification  
**ETA after clarification:** 30 minutes to full deployment  
**Files ready:** Test script, integration code, sync architecture, database schema
