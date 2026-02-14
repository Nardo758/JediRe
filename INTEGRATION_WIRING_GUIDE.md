# Quick Wiring Guide - JEDI RE + Apartment Locator AI

**Time to Complete:** 15-20 minutes  
**Difficulty:** Easy

---

## Step-by-Step Instructions

### 1. Update Backend Initialization (5 min)

**File:** `backend/src/index.ts` or `backend/src/index.replit.ts`

**Add near the top (after imports):**

```typescript
import { initializeApartmentLocatorIntegration } from './services/apartmentLocatorIntegration';
```

**Add before starting the server (before `app.listen()`):**

```typescript
// Initialize Apartment Locator AI integration
initializeApartmentLocatorIntegration({
  baseUrl: process.env.APARTMENT_LOCATOR_API_URL || 'http://localhost:5000',
  timeout: 10000,
});

console.log('✅ Apartment Locator AI integration initialized');
```

---

### 2. Register API Routes (3 min)

**File:** `backend/src/api/rest/index.ts`

**Add the import:**

```typescript
import marketIntelRoutes from './marketIntel.routes';
```

**Add route registration (with other routes):**

```typescript
// Market Intelligence (Apartment Locator AI integration)
app.use('/api/market-intel', marketIntelRoutes);
```

---

### 3. Add Environment Variable (2 min)

**File:** `.env` (create if it doesn't exist)

**Add:**

```bash
# Apartment Locator AI Integration
APARTMENT_LOCATOR_API_URL=http://localhost:5000
```

**For production/Replit, update to Apartment Locator AI's actual URL:**
```bash
APARTMENT_LOCATOR_API_URL=https://your-apartment-locator-replit.repl.co
```

---

### 4. Install Dependencies (if needed) (2 min)

The integration uses `axios`. If not already installed:

```bash
cd /home/leon/clawd/jedire
npm install axios
```

---

### 5. Restart Backend (1 min)

```bash
cd /home/leon/clawd/jedire
npm run dev
# or
npm start
```

Look for log message:
```
✅ Apartment Locator AI integration initialized
```

---

### 6. Test Integration (5 min)

**Test market data endpoint:**

```bash
curl "http://localhost:3000/api/market-intel/data?city=Atlanta&state=GA" | jq
```

**Expected response:**
```json
{
  "success": true,
  "data": {
    "location": { "city": "Atlanta", "state": "GA" },
    "supply": {
      "total_properties": 52,
      "total_units": 8450,
      "avg_occupancy": 94.5
    },
    "pricing": {
      "rent_growth_90d": 3.2,
      "concession_rate": 35.5
    }
  }
}
```

**Test investment metrics:**

```bash
curl "http://localhost:3000/api/market-intel/investment-metrics?city=Atlanta&state=GA" | jq
```

**Test rent comps:**

```bash
curl "http://localhost:3000/api/market-intel/rent-comps?city=Atlanta&state=GA&unit_type=2BR" | jq
```

---

## Verification Checklist

✅ Backend starts without errors  
✅ Integration initialization log appears  
✅ Market data endpoint returns data  
✅ Investment metrics endpoint works  
✅ Rent comps endpoint returns properties  

---

## Troubleshooting

### Error: "Integration not initialized"
- Check initialization code is before `app.listen()`
- Verify import path is correct
- Restart backend

### Error: "Failed to fetch market data"
- Check Apartment Locator AI is running
- Verify `APARTMENT_LOCATOR_API_URL` in `.env`
- Test Apartment Locator AI directly: `curl http://localhost:5000/api/jedi/market-data?city=Atlanta&state=GA`

### Error: "Module not found: axios"
- Run: `npm install axios`
- Restart backend

### Empty data returned
- Apartment Locator AI might not have data for that location
- Try: `curl http://localhost:5000/api/admin/properties/grouped` to see available locations

---

## Next: Frontend Integration

Once backend is wired up, add UI components:

### Option 1: Add to Deal Analysis Page

```typescript
import { MarketIntelligence } from '../components/MarketIntelligence';

// In your Deal component:
<MarketIntelligence 
  city={deal.city} 
  state={deal.state} 
/>
```

### Option 2: Add to Market Intelligence Tab

Create new tab in JEDI RE that displays comprehensive market data.

### Option 3: Add to Financial Pro Forma

Use investment metrics to populate rent growth assumptions, concession rates, etc.

---

## Files Changed

**Modified:**
- `backend/src/index.ts` (or `index.replit.ts`) - Added initialization
- `backend/src/api/rest/index.ts` - Added route registration
- `.env` - Added API URL

**Created:**
- `backend/src/services/apartmentLocatorIntegration.ts` (integration service)
- `backend/src/api/rest/marketIntel.routes.ts` (API routes)

---

## Success!

Once the backend is wired up and tests pass, the integration is complete! 🎉

JEDI RE can now access real market data from Apartment Locator AI for:
- Deal analysis
- Financial underwriting
- Market intelligence
- Investment decision-making

---

**Questions?** See `APARTMENT_LOCATOR_INTEGRATION.md` for full documentation.
