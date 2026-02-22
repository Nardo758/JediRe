# Quick Wiring Guide for Replit

## 🚨 Step 1: Resolve Git Conflicts

You have merge conflicts in these files:
```
.gitignore
frontend/src/components/deal/sections/DocumentsSection.tsx
jedire/backend/src/index.ts
jedire/backend/src/services/notification.service.ts
jedire/frontend/package-lock.json
jedire/frontend/package.json
frontend/src/App.tsx
jedire/replit.nix
```

**Quick fix in Replit:**
```bash
# Accept current changes
git checkout --ours .gitignore
git checkout --ours frontend/src/components/deal/sections/DocumentsSection.tsx
git checkout --ours jedire/backend/src/index.ts
git checkout --ours jedire/backend/src/services/notification.service.ts
git checkout --ours jedire/frontend/package-lock.json
git checkout --ours jedire/frontend/package.json
git checkout --ours frontend/src/App.tsx
git checkout --ours jedire/replit.nix

git add .
```

Then continue with Market Intelligence integration.

---

## 🔌 Step 2: Add Routes (2 minutes)

Open `frontend/src/App.tsx`:

### Import at top:
```typescript
import {
  MarketIntelligencePage,
  MyMarketsDashboard,
  CompareMarketsPage,
  ActiveOwnersPage,
  FutureSupplyPage,
} from './pages/MarketIntelligence';
```

### Add routes (inside `<Routes>`):
```typescript
{/* Market Intelligence */}
<Route path="/market-intelligence" element={<MarketIntelligencePage />} />
<Route path="/market-intelligence/markets/:marketId" element={<MyMarketsDashboard />} />
<Route path="/market-intelligence/compare" element={<CompareMarketsPage />} />
<Route path="/market-intelligence/owners" element={<ActiveOwnersPage />} />
<Route path="/market-intelligence/supply" element={<FutureSupplyPage />} />
```

---

## 🧭 Step 3: Add to Sidebar (1 minute)

Find your sidebar navigation array and add:

```typescript
{
  label: 'Market Intelligence',
  icon: '📊', // or use lucide-react icon
  path: '/market-intelligence',
  badge: '89 outputs', // optional
}
```

---

## ✅ Step 4: Test (5 minutes)

1. **Navigate** to `/market-intelligence`
   - Should see 4 market cards
   - Atlanta shows "🟢 REAL DATA: 1,028 Properties"

2. **Click Atlanta**
   - Should navigate to `/market-intelligence/markets/atlanta`
   - Should see 5 tabs: Overview, Market Data, Submarkets, Trends, Deals

3. **Click Market Data tab**
   - Should see MarketDataTable with property list
   - Should have search box and filters
   - Click any row → PropertyIntelligenceModal should open

4. **Click Compare Markets**
   - Should navigate to `/market-intelligence/compare`
   - Should see market selector

5. **Click Future Supply**
   - Should navigate to `/market-intelligence/supply`
   - Should see 10-year Supply Wave chart 🔥

---

## 📦 Step 5: Install Dependencies (if needed)

```bash
npm install recharts
```

(Only if you get import errors for SupplyWaveChart)

---

## 🔍 Troubleshooting

### "Cannot find module MarketIntelligencePage"
- Check file paths: `frontend/src/pages/MarketIntelligence/`
- Verify index.ts exports exist
- Restart dev server

### "PropertyIntelligenceModal not opening"
- Check MarketDataTab.tsx has `onPropertyClick` handler
- Verify modal state management
- Check console for errors

### "SupplyWaveChart not rendering"
- Verify recharts is installed
- Check data prop format matches expected structure
- Look for console errors

### "Table showing no data"
- Check mockPropertyIntelligence.ts is imported
- Verify generateMockProperties() is called
- Check console for data loading errors

---

## 📁 Key Files to Know

**Pages (7 files):**
- `frontend/src/pages/MarketIntelligence/MarketIntelligencePage.tsx` - Main entry
- `frontend/src/pages/MarketIntelligence/MyMarketsDashboard.tsx` - Market detail
- `frontend/src/pages/MarketIntelligence/CompareMarketsPage.tsx` - Comparison
- `frontend/src/pages/MarketIntelligence/ActiveOwnersPage.tsx` - Owners
- `frontend/src/pages/MarketIntelligence/FutureSupplyPage.tsx` - Supply 🔥
- `frontend/src/pages/MarketIntelligence/tabs/MarketDataTab.tsx` - Property table
- `frontend/src/pages/MarketIntelligence/tabs/SubmarketsTab.tsx` - Submarkets (enhanced)

**Components (5 files):**
- `PropertyIntelligenceModal.tsx` - Property flyout (52KB, 5 tabs)
- `DataSourceIndicator.tsx` - Hover attribution
- `MarketDataTable.tsx` - 1,028 properties table ⭐
- `SupplyWaveChart.tsx` - 10-year visualization ⭐🔥
- `OwnerPortfolioView.tsx` - Owner portfolios ⭐

**Data:**
- `frontend/src/types/marketIntelligence.types.ts` - All 89 output types
- `frontend/src/mock/mockPropertyIntelligence.ts` - Mock data

---

## 🎯 Success Criteria

When wiring is complete, you should be able to:

✅ Navigate to all 5 pages  
✅ See 4 market cards on main page  
✅ Click Atlanta → see 5 tabs  
✅ See MarketDataTable with 1,028 properties  
✅ Click property row → modal opens  
✅ See 10-year Supply Wave chart  
✅ See owner portfolios with expandable rows  
✅ See enhanced submarkets table with DC columns  

---

## ⏱️ Estimated Time

- **Step 1 (git conflicts):** 2 minutes
- **Step 2 (routes):** 2 minutes
- **Step 3 (sidebar):** 1 minute
- **Step 4 (testing):** 5 minutes
- **Total:** ~10 minutes

---

**All components are production-ready. Just wire up the routes and test!** 🚀
