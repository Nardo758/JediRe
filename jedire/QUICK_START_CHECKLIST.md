# ⚡ Quick Start Checklist - Data Persistence

## 🎯 Goal
Complete the data persistence implementation (P0 - Critical)

## ✅ What's Already Done
- ✅ Zustand store (`dealData.store.ts`)
- ✅ Auto-save hook (`useAutoSave.ts`)
- ✅ Database migration (`020_deal_state_persistence.sql`)
- ✅ Backend API (`dealState.routes.ts`)
- ✅ Server integration
- ✅ Design3DPage example
- ✅ Complete documentation

## 🚀 To Complete (3 hours)

### Step 1: Run Database Migration (2 minutes)
```bash
cd /home/leon/clawd/jedire/backend

# Connect to database
psql -U postgres -d jedire

# Run migration
\i src/database/migrations/020_deal_state_persistence.sql

# Verify
\dt deals_state
\dt deal_snapshots

# Exit
\q
```

### Step 2: Test Backend (5 minutes)
```bash
# Start backend
npm run dev

# In another terminal, test endpoints
curl http://localhost:3001/health
# Should return: {"status":"ok"}

curl http://localhost:3001/api/v1/deals/test-id/state -H "Authorization: Bearer TOKEN"
# Should return 401 or 404 (not 404 route not found) = routes working
```

### Step 3: Update Pages (2 hours)

Open `PAGE_UPDATE_TEMPLATE.tsx` for reference, then update each page:

#### 3.1: Design3DPage (5 min)
```bash
cd /home/leon/clawd/jedire/frontend/src/pages

# Backup original
cp Design3DPage.tsx Design3DPage.old.tsx

# Use updated version
cp Design3DPage.updated.tsx Design3DPage.tsx
```

#### 3.2: MarketAnalysisPage (20 min)
File: `/frontend/src/pages/development/MarketAnalysisPage.tsx`

**Add at top:**
```typescript
import { useDealDataStore } from '@/stores/dealData.store';
import { useAutoSaveWithGuard } from '@/hooks/useAutoSave';
```

**In component:**
```typescript
const { marketAnalysis, updateMarketAnalysis } = useDealDataStore();
const { hasUnsavedChanges, isSaving, manualSave } = useAutoSaveWithGuard({
  dealId: dealId || '',
  enabled: true,
});
```

**Update data handlers:**
```typescript
const handleDataChange = (newData) => {
  updateMarketAnalysis({
    ...marketAnalysis,
    ...newData,
    lastUpdated: new Date().toISOString(),
  });
};
```

**Add to header:** (Copy from Design3DPage.tsx lines 140-180)

#### 3.3: CompetitionPage (20 min)
File: `/frontend/src/pages/development/CompetitionPage.tsx`

Same pattern, use:
```typescript
const { competitionData, updateCompetitionData } = useDealDataStore();
```

#### 3.4: SupplyPipelinePage (20 min)
File: `/frontend/src/pages/development/SupplyPipelinePage.tsx`

Same pattern, use:
```typescript
const { supplyData, updateSupplyData } = useDealDataStore();
```

#### 3.5: DueDiligencePage (20 min)
File: `/frontend/src/pages/development/DueDiligencePage.tsx`

Same pattern, use:
```typescript
const { dueDiligenceData, updateDueDiligenceData } = useDealDataStore();
```

#### 3.6: ProjectTimelinePage (20 min)
File: `/frontend/src/pages/development/ProjectTimelinePage.tsx`

Same pattern, use:
```typescript
const { timelineData, updateTimelineData } = useDealDataStore();
```

### Step 4: Test Each Page (30 minutes)

For each updated page:

1. **Navigate to page**
   ```
   http://localhost:3000/deals/YOUR_DEAL_ID/[page-route]
   ```

2. **Make changes**
   - Update some data
   - Watch status indicator: "Unsaved changes"

3. **Wait 5 seconds**
   - Should show "Saving..."
   - Then "All changes saved"

4. **Refresh page**
   - Data should persist ✓

5. **Check DevTools**
   - **Application → Local Storage:** Look for `deal-data-storage`
   - **Application → IndexedDB:** Look for `jedire-deal-data`
   - **Network:** Should see POST to `/api/v1/deals/:id/state`

6. **Test navigation guard**
   - Make changes
   - Try to close tab
   - Should see browser warning ✓

### Step 5: End-to-End Test (15 minutes)

Complete workflow:
1. Create new deal
2. Design3DPage → Add design → Auto-save → Navigate away
3. MarketAnalysisPage → Add data → Auto-save → Navigate away
4. CompetitionPage → Add competitors → Auto-save → Navigate away
5. Back to Design3DPage → Design still there ✓
6. Back to MarketAnalysisPage → Data still there ✓
7. Refresh browser → All data persists ✓

### Step 6: Create Snapshot (5 minutes)

Test snapshot functionality:
1. Make some changes
2. Open browser console
3. Run:
   ```javascript
   // Get store
   const store = window.useDealDataStore.getState();
   
   // Create snapshot
   await store.createSnapshot('Baseline Design');
   
   // List snapshots
   await store.loadSnapshots('YOUR_DEAL_ID');
   console.log(store.snapshots);
   ```

## 📋 Verification Checklist

After completing all steps:

- [ ] Database migration ran successfully
- [ ] Backend server starts without errors
- [ ] API endpoints respond (tested with curl)
- [ ] Design3DPage updated and working
- [ ] MarketAnalysisPage updated and working
- [ ] CompetitionPage updated and working
- [ ] SupplyPipelinePage updated and working
- [ ] DueDiligencePage updated and working
- [ ] ProjectTimelinePage updated and working
- [ ] Auto-save works on all pages
- [ ] Manual save works on all pages
- [ ] Data persists across navigation
- [ ] Data persists across refresh
- [ ] Navigation guard shows warnings
- [ ] LocalStorage contains data
- [ ] IndexedDB contains 3D data (if applicable)
- [ ] Snapshots can be created
- [ ] Snapshots can be restored

## 🐛 Troubleshooting

### Backend errors
```bash
# Check logs
npm run dev
# Look for errors in console

# Test database connection
psql -U postgres -d jedire -c "SELECT * FROM deals_state LIMIT 1;"
```

### Frontend errors
```javascript
// Open browser console
// Check for errors

// Test store
const store = window.useDealDataStore.getState();
console.log(store);

// Test auto-save hook
// Should see logs every 5 seconds when changes made
```

### Data not persisting
1. Check Network tab → Should see POST requests
2. Check backend logs → Should see "POST /api/v1/deals/:id/state"
3. Check database → `SELECT * FROM deals_state;`
4. Check LocalStorage → Application tab in DevTools

## 📚 Reference Documents

- **Main guide:** `DATA_PERSISTENCE_IMPLEMENTATION.md`
- **Template:** `PAGE_UPDATE_TEMPLATE.tsx`
- **Example:** `Design3DPage.updated.tsx`
- **Report:** `SUBAGENT_COMPLETION_REPORT.md`

## ⏱️ Time Estimate

- Database migration: 2 min
- Backend test: 5 min
- Update Design3DPage: 5 min
- Update 5 other pages: 5 × 20 min = 100 min
- Test each page: 6 × 5 min = 30 min
- End-to-end test: 15 min
- Snapshot test: 5 min

**Total: ~2.5 hours**

## 🎉 Success!

When all checkboxes are ✅, the data persistence layer is complete and users will no longer lose work!

---

**Need help?** Check the troubleshooting section or review the detailed documentation.
