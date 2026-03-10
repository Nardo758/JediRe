# JediRe Platform API Integration

## ✅ What's Been Wired Up

### 1. **API Service Layer** (`src/services/api.ts`)
- ✅ Connection to JediRe Platform API
- ✅ Bearer token authentication
- ✅ Deal fetching (get_deals, get_deal_by_id)
- ✅ Health check endpoint
- ✅ Analysis task creation (zoning, supply, cashflow, full)
- ✅ Task polling (get_agent_task)
- ✅ Deal → PropertyData transformation

### 2. **DealsPage** (`src/pages/DealsPage.tsx`)
- ✅ Grid view of all deals with Terminal UI
- ✅ Filter by: All / Portfolio / Pipeline
- ✅ Click card → Navigate to PropertyDetailsPage
- ✅ Shows: Budget, Units, Type, Status, Tier, State
- ✅ Color-coded status badges
- ✅ Hover effects & animations
- ✅ Loading & error states

### 3. **PropertyDetailsPage** (Updated)
- ✅ Fetches real deal data from JediRe API
- ✅ Maps Deal object to PropertyData interface
- ✅ Fallback to mock data if API unavailable
- ✅ All 6 tabs with Terminal UI (Overview, Financials, Comps, Zoning, Market, Docs)
- ✅ Real data for: Name, Address, Budget, Units, Type, Status

---

## 🚀 How to Test

### Step 1: Install Dependencies
```bash
cd ~/workspace/jedire/frontend
npm install
```

### Step 2: Set Up Environment Variables
The `.env.local` file should already exist with API credentials. If not, create it:
```bash
# jedire/frontend/.env.local
VITE_API_URL=https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev
VITE_API_TOKEN=69295404e382acd00de4facdaa053fd20ae0a1cf15dc63c0b8a55cffc0e088b6
```

### Step 3: Start Dev Server
```bash
npm run dev -- --port 5173
```

### Step 4: Test the DealsPage
1. Navigate to **`/deals`** in your browser
2. You should see a grid of **20 deals** from the JediRe platform
3. Filter by **Portfolio** or **Pipeline**
4. Click on any deal card

### Step 5: Test PropertyDetailsPage with Real Data
1. After clicking a deal, you'll see PropertyDetailsPage with real data:
   - ✅ Deal name in header
   - ✅ Address from API
   - ✅ Budget, Units, Type, Status
   - ✅ All 6 tabs functional

**Test with Atlanta Development (300 units):**
- Direct URL: `/properties/e044db04-439b-4442-82df-b36a840f2fd8`
- Should show:
  - Budget: $78M
  - Units: 300
  - Type: Multifamily
  - Address: 1950 Piedmont Circle NE, Atlanta, GA 30324

---

## 🔍 API Endpoints Available

### Health Check
```bash
curl -X GET "https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev/api/v1/clawdbot/health" \
  -H "Authorization: Bearer 69295404e382acd00de4facdaa053fd20ae0a1cf15dc63c0b8a55cffc0e088b6"
```

### Get All Deals
```bash
curl -X POST ".../api/v1/clawdbot/command" \
  -H "Authorization: Bearer ..." \
  -H "Content-Type: application/json" \
  -d '{"command": "get_deals"}'
```

### Run Analysis
```bash
curl -X POST ".../api/v1/clawdbot/command" \
  -H "Authorization: Bearer ..." \
  -H "Content-Type: application/json" \
  -d '{
    "command": "run_analysis",
    "dealId": "e044db04-439b-4442-82df-b36a840f2fd8",
    "taskType": "full"
  }'
```

### Get Task Status
```bash
curl -X POST ".../api/v1/clawdbot/command" \
  -H "Authorization: Bearer ..." \
  -H "Content-Type: application/json" \
  -d '{
    "command": "get_agent_task",
    "taskId": "task-uuid-here"
  }'
```

---

## 📊 Real Data vs Mock Data

### Currently Using Real Data:
- ✅ Deal ID
- ✅ Deal Name
- ✅ Address (parsed into street, city, state, zip)
- ✅ Budget (askingPrice)
- ✅ Target Units
- ✅ Project Type (propertyType)
- ✅ Status & State badges
- ✅ Tier level
- ✅ Deal Category (portfolio/pipeline)

### Still Using Mock Data (To Be Wired):
- ⏳ Year Built
- ⏳ Total Sq Ft
- ⏳ Lot Size
- ⏳ Monthly Rent
- ⏳ Annual Income
- ⏳ NOI
- ⏳ Cap Rate (calculated from budget + units)
- ⏳ Occupancy Rate
- ⏳ Rent Roll data
- ⏳ Income/Expense breakdown
- ⏳ Comparables
- ⏳ Zoning details
- ⏳ Market demographics
- ⏳ Documents & notes
- ⏳ Photos (property images)

---

## 🛠 Next Steps

### Phase 1: Enhance Data Mapping (Immediate)
1. **Add property-level data API** to fetch detailed metrics
2. **Wire up rent roll** if available from platform
3. **Connect zoning API** (use run_analysis command)
4. **Add market data** from platform analytics
5. **Photos integration** (if property images available)

### Phase 2: Interactive Features
1. **"Run Analysis" button** on PropertyDetailsPage
   - Click → Trigger zoning/supply/cashflow analysis
   - Show loading state while task runs
   - Poll task status and display results
2. **Real-time updates** with polling/webhooks
3. **Document upload/download** via API
4. **Notes creation** synced to platform

### Phase 3: Advanced Features
1. **Search & Filtering** on DealsPage
2. **Sort options** (budget, units, date, status)
3. **Bulk actions** (select multiple deals)
4. **Export to CSV/PDF**
5. **Analytics dashboard** with charts

---

## 🐛 Known Issues

1. **`get_deal` command has SQL error** - Using `get_deals` + filter instead
2. **Cap Rate is calculated** - Not from real data yet
3. **Occupancy is hardcoded** to 95% - Needs real source
4. **Photos unavailable** - No property images from API yet
5. **Rent roll mocked** - Awaiting unit-level data API

---

## ✅ Testing Checklist

- [ ] DealsPage loads with 20 deals
- [ ] Filter buttons work (All/Portfolio/Pipeline)
- [ ] Click deal card navigates to PropertyDetailsPage
- [ ] PropertyDetailsPage shows real deal data
- [ ] All 6 tabs render without errors
- [ ] Loading states display properly
- [ ] Error handling works (try with invalid deal ID)
- [ ] Terminal UI aesthetic consistent across pages
- [ ] Responsive layout on different screen sizes
- [ ] Performance acceptable with 20 deals

---

## 📝 API Response Example

```json
{
  "success": true,
  "result": {
    "deals": [
      {
        "id": "e044db04-439b-4442-82df-b36a840f2fd8",
        "name": "Atlanta Development",
        "projectType": "multifamily",
        "status": "active",
        "state": "SIGNAL_INTAKE",
        "tier": "basic",
        "budget": "78000000.00",
        "targetUnits": 300,
        "dealCategory": "pipeline",
        "address": "1950 Piedmont Circle Northeast, Atlanta, Georgia 30324, United States",
        "createdAt": "2026-02-24T20:47:41.299Z",
        "updatedAt": "2026-03-08T18:15:29.012Z",
        "propertyCount": 1,
        "pendingTasks": 0
      }
    ],
    "total": 20
  }
}
```

---

## 🎯 Success Criteria

**MVP Complete When:**
- ✅ DealsPage shows all deals from API
- ✅ PropertyDetailsPage displays real deal data
- ✅ Navigation works between pages
- ✅ Terminal UI aesthetic consistent
- ✅ Loading & error states work
- ✅ Environment variables configured

**Ready for Production When:**
- ⏳ All property data fields mapped to real API
- ⏳ Analysis tasks can be triggered from UI
- ⏳ Real-time updates working
- ⏳ Document management functional
- ⏳ Performance optimized
- ⏳ Tests passing

---

**Current Status: MVP COMPLETE ✅**

The Terminal UI is now connected to the JediRe Platform API and ready for testing!
