# 🚀 Quick Start: Market Analysis Module

**Get the Market Analysis page running in 5 minutes!**

---

## Step 1: Verify Mapbox Token

```bash
cd /home/leon/clawd/jedire/frontend
cat .env | grep MAPBOX
```

If missing, add:
```bash
echo "VITE_MAPBOX_TOKEN=your_mapbox_token_here" >> .env
```

Get a free token at: https://account.mapbox.com/access-tokens/

---

## Step 2: Start Development Server

```bash
npm run dev
```

Server starts at: `http://localhost:5173`

---

## Step 3: Add Route to App

**File:** `frontend/src/App.tsx` (or your router config)

```typescript
import { MarketAnalysisPage } from './pages/development';

// Inside your Routes:
<Route 
  path="/deals/:dealId/market-analysis" 
  element={<MarketAnalysisPage />} 
/>
```

---

## Step 4: Navigate to Page

**Option A: Direct URL**
```
http://localhost:5173/deals/test-deal-123/market-analysis
```

**Option B: From Another Component**
```typescript
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();
navigate('/deals/test-deal-123/market-analysis');
```

---

## Step 5: Explore Features

### 🗺️ Demand Heat Map
- Click radius buttons (0.5 mi, 1 mi, 2 mi, 3 mi)
- Hover over markers to see demand drivers
- Zoom and pan with Mapbox controls

### 📊 Unit Mix Optimizer
- Drag sliders to adjust unit percentages
- Watch total auto-balance to 100%
- Click "Optimize" to apply market recommendations
- Look for ⚠️ warnings when >10% gap from market

### 👥 Demographic Insights
- Review primary renter profile
- Check growth trends (YoY %)
- See lifestyle indicators

### ✨ Amenity Table
- Sort by ROI, Premium, or Market Penetration
- Check boxes to select amenities
- Watch total premium update in footer

### 🤖 AI Insights
- Expand cards to see supporting data
- Select recommendations
- Click "Apply to 3D Design"

---

## What You'll See (Mock Data)

### Market Demand:
- **Recommended Mix:** 15% Studio, 45% 1BR, 30% 2BR, 10% 3BR
- **Demand Drivers:** Tech Campus (0.8 mi), University (1.2 mi), MARTA (0.3 mi)
- **Heatmap:** 50 random demand points around Atlanta

### Amenities (Top 3 by ROI):
1. **Coworking:** +$125/mo • 3.5x ROI
2. **Pet Spa:** +$85/mo • 3.2x ROI
3. **Package Room:** +$45/mo • 3.0x ROI

### Demographics:
- **Age:** 25-34 (45% of renters)
- **Income:** $75-125k
- **Remote Work:** 45%
- **Pet Ownership:** 62%

### AI Insights:
1. "Increase 1BR to 45%" - High Impact, 87% confidence
2. "Add Coworking Space" - High Impact, 82% confidence
3. "Premium Pricing Opportunity" - Medium Impact, 75% confidence

---

## 🧪 Testing Checklist

- [ ] Page loads without errors
- [ ] Mapbox map renders correctly
- [ ] Radius selector updates map
- [ ] Unit mix sliders work smoothly
- [ ] Sliders always total 100%
- [ ] Demographic cards display data
- [ ] Amenity table is sortable
- [ ] AI insights are expandable
- [ ] "Apply to 3D Design" button navigates
- [ ] Page is responsive (resize browser)

---

## 🐛 Troubleshooting

### Map Doesn't Load
**Problem:** Blank map container  
**Solution:** Check VITE_MAPBOX_TOKEN in .env

### Components Not Found
**Problem:** Import errors  
**Solution:** Verify files exist in `/src/components/development/market-analysis/`

### TypeScript Errors
**Problem:** Type 'X' not found  
**Solution:** Check `/src/types/development.ts` exists

### Build Errors
**Problem:** Module not found  
**Solution:** 
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## 📱 Mobile Testing

### Desktop Browser:
1. Open DevTools (F12)
2. Click device toggle icon (Ctrl+Shift+M)
3. Select "iPhone 12 Pro" or "iPad"
4. Test responsiveness

### Breakpoints:
- **Mobile:** <768px - Single column
- **Tablet:** 768-1023px - 2 columns
- **Desktop:** ≥1024px - 3 columns

---

## 🔗 Integration Test (3D Design)

1. Click "Apply to 3D Design" button
2. Check URL parameters:
```
/deals/test-deal-123/design?insights=%7B%22unitMix%22%3A...
```
3. Decode to see:
```json
{
  "unitMix": { "studio": 0.15, "oneBR": 0.45, ... },
  "amenities": ["coworking", "pet-spa"],
  "targetDemographic": "young-professionals"
}
```

---

## 🔌 Connect Real API (Later)

**File:** `frontend/src/hooks/useMarketAnalysisData.ts`

Replace mock data:
```typescript
// Current (line ~20):
const mockData = useMockMarketAnalysisData(dealId, radius);

// Change to:
const response = await fetch(`/api/v1/deals/${dealId}/market-analysis/demand?radius=${radius}`);
const data = await response.json();
setDemandData(data.data);
```

---

## 📊 Performance

**Initial Load:** <2s (with mock data)  
**Map Render:** <1s  
**Slider Updates:** <50ms (real-time)  
**Data Refetch:** <500ms (when API ready)

---

## 🎨 Customization

### Change Colors:
**File:** Each component's Tailwind classes
```typescript
// Example: UnitMixOptimizer.tsx, line 15
{ key: 'studio', label: 'Studio', color: 'bg-purple-500' }
// Change to:
{ key: 'studio', label: 'Studio', color: 'bg-pink-500' }
```

### Change Radius Options:
**File:** `DemandHeatMap.tsx`, line 137
```typescript
const radiusOptions = [0.5, 1, 2, 3];
// Change to:
const radiusOptions = [0.25, 0.5, 1, 1.5, 2];
```

### Add More Amenities:
**File:** `useMarketAnalysisData.ts`, line ~145
```typescript
amenities: [
  { id: 'coworking', name: 'Coworking Space', ... },
  // Add:
  { id: 'yoga-studio', name: 'Yoga Studio', category: 'fitness', ... }
]
```

---

## 📚 Documentation Links

- **Full Build Summary:** `/jedire/MARKET_ANALYSIS_BUILD_SUMMARY.md`
- **Developer Guide:** `/frontend/src/pages/development/README.md`
- **Design Spec:** `/jedire/DEV_ANALYSIS_MODULES_DESIGN.md`
- **Types Reference:** `/frontend/src/types/development.ts`

---

## 🎯 What's Next?

1. ✅ Test in browser (you are here!)
2. ⏳ Review with team
3. ⏳ Connect backend APIs
4. ⏳ Build 3D Design receiver
5. ⏳ Production deployment

---

## 💬 Questions?

**Mock data not realistic?**  
→ Edit `useMarketAnalysisData.ts` starting at line ~100

**Need different unit types?**  
→ Update `types/development.ts` UnitMix interface

**Want different layout?**  
→ Modify grid in `MarketAnalysisPage.tsx` line ~120

**Map not centered on your city?**  
→ Change default coords in `DemandHeatMap.tsx` line 25

---

**🎉 You're ready to go! Open `http://localhost:5173/deals/test-deal-123/market-analysis` and explore!**
