# Deploy V2 Pages to Replit - Quick Guide

**Date:** February 8, 2026 19:11 EST

---

## Step 1: Pull Latest Code to Replit

In Replit shell:

```bash
cd /home/runner/JediRe
git pull origin master
```

**Expected:** 6 new files pulled (V2 pages + ThreePanelLayout)

---

## Step 2: Install Dependencies (if needed)

```bash
cd frontend
npm install
```

**Note:** @headlessui/react was already added in earlier commit

---

## Step 3: Start Dev Server

```bash
npm run dev
```

**Expected:** Server starts on port 5173

---

## Step 4: Test Each V2 Page

### Test URLs:

1. **News Intelligence V2**
   - URL: `http://localhost:5173/news-v2`
   - Add route first (see Step 5)

2. **Email V2**
   - URL: `http://localhost:5173/email-v2`
   
3. **Pipeline V2**
   - URL: `http://localhost:5173/deals-v2`

4. **Assets V2**
   - URL: `http://localhost:5173/assets-v2`

5. **Market Data V2**
   - URL: `http://localhost:5173/market-data-v2`

---

## Step 5: Add V2 Routes to App.tsx

**File:** `frontend/src/App.tsx`

Add these routes (inside the `<Route element={<MainLayout />}>` block):

```typescript
<Route path="/news-v2" element={<NewsIntelligencePageV2 />} />
<Route path="/email-v2" element={<EmailPageV2 />} />
<Route path="/deals-v2" element={<DealsPageV2 />} />
<Route path="/assets-v2" element={<AssetsOwnedPageV2 />} />
<Route path="/market-data-v2" element={<MarketDataPageV2 />} />
```

And add imports at top:

```typescript
import NewsIntelligencePageV2 from './pages/NewsIntelligencePageV2';
import EmailPageV2 from './pages/EmailPageV2';
import DealsPageV2 from './pages/DealsPageV2';
import AssetsOwnedPageV2 from './pages/AssetsOwnedPageV2';
import MarketDataPageV2 from './pages/MarketDataPageV2';
```

---

## Step 6: Testing Checklist

### For Each Page:

**✅ Panel 1 (Views Sidebar):**
- [ ] Views sidebar visible on left (64-80px)
- [ ] All view buttons displayed with icons
- [ ] Active view highlighted in blue
- [ ] Count badges show correct numbers
- [ ] Click view → content updates

**✅ Panel 2 (Content):**
- [ ] Content panel displays correctly
- [ ] Scrolling works smoothly
- [ ] Cards/lists formatted properly
- [ ] Interactive elements work (click, star, etc.)

**✅ Panel 3 (Map):**
- [ ] Map loads and renders
- [ ] Markers/boundaries display correctly
- [ ] Map interactions work (zoom, pan, click)
- [ ] Popups show correct data

**✅ Resize Functionality:**
- [ ] Drag handle visible between Panel 2 and 3
- [ ] Drag left/right resizes Panel 2
- [ ] Width stays between 400-800px
- [ ] Refresh page → width persisted

**✅ Toggle Controls:**
- [ ] 3 buttons visible top-right (Views, Content, Map)
- [ ] Click "◀ Views" → hides Panel 1
- [ ] Click "▶ Views" → shows Panel 1
- [ ] Same for Content and Map panels
- [ ] State persists correctly

---

## Step 7: Test Specific Features

### News Intelligence
- [ ] Category filters work (All, Employment, Development, etc.)
- [ ] Event cards display with impact badges
- [ ] Switch to Dashboard view → shows market metrics
- [ ] Switch to Network view → shows contacts
- [ ] Switch to Alerts view → shows alerts

### Email
- [ ] Stats card shows correct counts
- [ ] Email cards display with from/subject
- [ ] Click email → marks as read (blue background → white)
- [ ] Click star → toggles flag
- [ ] Deal badges show on relevant emails

### Pipeline (Deals)
- [ ] Deal cards show tier badges (Basic/Pro/Enterprise)
- [ ] Filter by status works (All, Active, Qualified, etc.)
- [ ] Click deal card → navigates to deal detail
- [ ] Map shows deal boundaries color-coded by tier
- [ ] Click deal boundary on map → navigates to detail

### Assets Owned
- [ ] Portfolio summary card shows totals
- [ ] Asset cards display with units/occupancy/NOI
- [ ] Switch to Performance view → shows detailed metrics
- [ ] Click asset → highlights on map
- [ ] Map markers show asset locations

### Market Data
- [ ] Overview shows market KPIs (rent, vacancy, absorption)
- [ ] Switch to Comparables → shows comp properties
- [ ] Comp markers appear on map
- [ ] Switch to Demographics → shows population/income
- [ ] Switch to Supply/Demand → shows pipeline data

---

## Step 8: Cross-Page Testing

- [ ] Navigate between V2 pages → smooth transitions
- [ ] Panel widths independent per page (email width ≠ news width)
- [ ] LocalStorage keys don't conflict
- [ ] MapTabsBar stays visible on all pages
- [ ] No console errors
- [ ] No memory leaks (map cleanup on unmount)

---

## Step 9: Migration (Once Testing Complete)

### Option A: Gradual Migration (Safer)

1. Keep both old and V2 versions live
2. Add links to test V2 versions
3. Gather feedback
4. Migrate page by page

### Option B: Full Migration (Faster)

1. **Backup old pages:**
   ```bash
   mv frontend/src/pages/NewsIntelligencePage.tsx frontend/src/pages/NewsIntelligencePageOld.tsx
   mv frontend/src/pages/EmailPage.tsx frontend/src/pages/EmailPageOld.tsx
   mv frontend/src/pages/DealsPage.tsx frontend/src/pages/DealsPageOld.tsx
   mv frontend/src/pages/AssetsOwnedPage.tsx frontend/src/pages/AssetsOwnedPageOld.tsx
   mv frontend/src/pages/MarketDataPage.tsx frontend/src/pages/MarketDataPageOld.tsx
   ```

2. **Rename V2 pages to production:**
   ```bash
   mv frontend/src/pages/NewsIntelligencePageV2.tsx frontend/src/pages/NewsIntelligencePage.tsx
   mv frontend/src/pages/EmailPageV2.tsx frontend/src/pages/EmailPage.tsx
   mv frontend/src/pages/DealsPageV2.tsx frontend/src/pages/DealsPage.tsx
   mv frontend/src/pages/AssetsOwnedPageV2.tsx frontend/src/pages/AssetsOwnedPage.tsx
   mv frontend/src/pages/MarketDataPageV2.tsx frontend/src/pages/MarketDataPage.tsx
   ```

3. **Update imports in App.tsx** (remove V2 suffix)

4. **Test production routes**

5. **Delete old pages once confirmed working**

---

## Troubleshooting

### Map Not Loading
- Check VITE_MAPBOX_TOKEN is set in .env
- Open browser console for errors
- Verify mapboxgl CSS is imported

### Panels Not Resizing
- Check browser console for errors
- Try clearing localStorage: `localStorage.clear()`
- Refresh page

### Content Not Updating
- Check view change handlers are wired
- Verify API endpoints are accessible
- Check browser console for errors

### TypeScript Errors
- Run `npm run type-check`
- Fix any type errors
- Restart dev server

---

## Success Criteria

✅ All 5 V2 pages load without errors  
✅ All panel controls work (resize, toggle)  
✅ Views switch correctly  
✅ Maps render with correct data  
✅ Interactive elements work (clicks, hovers)  
✅ LocalStorage persists panel widths  
✅ No console errors  
✅ Smooth navigation between pages  

---

## Next Steps After Testing

1. **Polish:** Add loading skeletons, animations, error boundaries
2. **Mobile:** Make responsive for tablets/phones
3. **Performance:** Lazy loading, virtualization for large lists
4. **Documentation:** Update user guides with new layout
5. **Feedback:** Gather user feedback on new design

---

**Estimated Testing Time:** 1-2 hours  
**Estimated Migration Time:** 30 minutes  
**Total:** ~2.5 hours to production-ready

---

**Last Updated:** February 8, 2026 19:11 EST
