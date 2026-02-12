# JEDI RE - Replit Deployment Checklist
**Date:** 2026-02-08  
**Status:** Ready to Deploy

---

## 📋 Pre-Deployment Checklist

### 1. Code Status ✅
- [x] All code committed locally
- [x] Map layer system complete (28 files)
- [x] All features working locally
- [ ] Push to GitHub (pending - token issue)
- [ ] Pull in Replit

### 2. Database Migrations Needed
**New migrations to run:**
- `012_map_layers.sql` - Map layers table with helper functions
- `013_map_configurations.sql` - Saved map configurations

**Previously run migrations:**
- 001-011 (should already be in database)

### 3. Environment Variables to Verify
```bash
# Check these in Replit Secrets:
VITE_MAPBOX_TOKEN=your_mapbox_token_here
DATABASE_URL=postgresql://...
NODE_ENV=production
```

### 4. Dependencies to Install
```bash
# Backend - already in package.json
# Frontend - new packages added:
npm install supercluster @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

---

## 🚀 Deployment Steps

### Step 1: Sync Code to Replit (Manual)
Since git push has auth issues, **manually sync:**

1. **Option A: Use Replit Git Integration**
   - In Replit, go to Version Control panel
   - Click "Pull from GitHub"
   - It will sync the latest commits

2. **Option B: Manual File Upload**
   - Copy changed files to Replit
   - Upload via Replit file browser

3. **Option C: Fix Git Auth & Push**
   - Update GitHub token
   - Push from local
   - Pull in Replit

**Files to sync (if manual):**
```
backend/src/database/migrations/
  - 012_map_layers.sql (NEW)
  - 013_map_configurations.sql (NEW)

backend/src/api/rest/
  - layers.routes.ts (UPDATED)
  - map-configs.routes.ts (NEW)
  - index.ts (UPDATED - added new routes)

frontend/src/components/map/
  - LayerRenderer.tsx (NEW)
  - LayersPanel.tsx (NEW)
  - WarMapsComposer.tsx (NEW)
  - LayerRendererAdvanced.tsx (NEW)
  - BubbleLayerRenderer.tsx (NEW)
  - OverlayLayerRenderer.tsx (NEW)
  - LayerRendererFull.tsx (NEW)
  - ClusteredMarkers.tsx (NEW)
  - MapTabsBar.tsx (NEW)
  - LayerFiltersModal.tsx (NEW)
  - LayerSettingsModal.tsx (NEW)

frontend/src/components/layout/
  - SidebarItem.tsx (NEW)
  - MainLayout.tsx (NEW)

frontend/src/services/
  - layers.service.ts (NEW)
  - map-configs.service.ts (NEW)

frontend/src/types/
  - layers.ts (NEW)

frontend/src/hooks/
  - useMarkerClustering.ts (NEW)

frontend/src/pages/
  - DashboardV3.tsx (NEW)

frontend/package.json (UPDATED - new dependencies)
```

---

### Step 2: Install Dependencies
```bash
# In Replit shell (frontend directory):
cd frontend
npm install

# Should install:
# - supercluster (clustering)
# - @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities (drag-drop)
```

---

### Step 3: Run Database Migrations
```bash
# In Replit shell (backend directory):
cd backend

# Connect to database and run migrations:
psql $DATABASE_URL -f src/database/migrations/012_map_layers.sql
psql $DATABASE_URL -f src/database/migrations/013_map_configurations.sql

# Verify migrations ran:
psql $DATABASE_URL -c "\dt" | grep map_layers
psql $DATABASE_URL -c "\dt" | grep map_configurations
```

**Expected output:**
```
 public | map_layers           | table | ...
 public | map_configurations   | table | ...
```

---

### Step 4: Verify Environment Variables
```bash
# In Replit shell:
echo $VITE_MAPBOX_TOKEN
# Should output: pk.ey...

# If empty, add in Replit Secrets tab:
# VITE_MAPBOX_TOKEN = your_token_here
```

---

### Step 5: Start Services
```bash
# Backend (terminal 1):
cd backend
npm run dev
# Should start on port 3000

# Frontend (terminal 2):
cd frontend
npm run dev
# Should start on port 5173
```

---

### Step 6: Test Map Layer System

**1. Access Dashboard**
- Open: `https://your-replit-url.repl.co/`
- Should see map with horizontal tabs bar

**2. Test War Maps Composer**
- Click "War Maps" button (or + Create Map)
- Modal should open with 7 layer templates
- Select "Assets Owned" + "Pipeline"
- Click "Create War Map"
- Should see layers appear on map

**3. Test Sidebar Integration**
- Right-click "Assets Owned (23)" in sidebar
- Context menu should appear
- Click "Show on Map"
- Layer should be created instantly

**4. Test Drag-and-Drop**
- Drag "Pipeline (8)" from sidebar
- Drop onto map canvas
- Blue drop zone should appear
- Layer should be added

**5. Test Layer Controls**
- LayersPanel should float on top-right
- Toggle eye icon → layer disappears/appears
- Drag opacity slider → transparency changes
- Drag layer → reorder works
- Click settings → style modal opens
- Click trash → delete works

**6. Test Map Tabs**
- Create a War Map
- New tab should appear in horizontal bar
- Click between tabs → layers switch
- Right-click tab → Clone/Delete options

---

## ✅ Success Criteria

Map layer system is working if:
- [x] War Maps composer opens and creates layers
- [x] Sidebar right-click adds layers
- [x] Drag-and-drop works
- [x] LayersPanel shows and controls layers
- [x] All 5 layer types render (pin minimum required)
- [x] Map tabs save/load configurations
- [x] No console errors
- [x] Performance is smooth (<1s layer creation)

---

## 🚨 Common Issues & Solutions

### Issue 1: "Mapbox token missing"
**Solution:**
```bash
# Add to Replit Secrets:
VITE_MAPBOX_TOKEN=pk.eyJ1...your_token
# Restart frontend
```

### Issue 2: "map_layers table does not exist"
**Solution:**
```bash
# Run migration:
psql $DATABASE_URL -f backend/src/database/migrations/012_map_layers.sql
```

### Issue 3: "Module not found: supercluster"
**Solution:**
```bash
cd frontend
npm install supercluster
```

### Issue 4: "Cannot find module '@dnd-kit/core'"
**Solution:**
```bash
cd frontend
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### Issue 5: Frontend won't compile
**Solution:**
```bash
# Clear cache and reinstall:
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Issue 6: Layers API returns 404
**Solution:**
```bash
# Check routes are registered:
# backend/src/api/rest/index.ts should have:
# app.use(`${API_PREFIX}/layers`, layersRoutes);
# app.use(`${API_PREFIX}/map-configs`, mapConfigsRoutes);

# Restart backend
```

---

## 📊 Post-Deployment Verification

### 1. Check Backend Health
```bash
curl http://localhost:3000/api/v1/layers
# Should return 401 (auth required) or 200 with data
```

### 2. Check Database Tables
```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM map_layers;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM map_configurations;"
```

### 3. Check Frontend Build
```bash
cd frontend
npm run build
# Should complete without errors
```

### 4. Browser Console Check
- Open DevTools (F12)
- No red errors
- Map should render
- Layers should appear when created

---

## 🎉 Success! What's Next?

Once deployed and verified:
1. ✅ Create your first War Map
2. ✅ Test all features
3. ✅ Share Replit URL with stakeholders
4. ✅ Gather feedback
5. ⏳ Schedule pre-launch hardening (14h tasks)

---

## 📝 Notes

**Commit Status:**
- All code committed locally: ✅
- Git push pending: token auth issue
- Workaround: Manual sync or fix token

**Current Git Commits:**
```
9b76ac0 - Add comprehensive Sidebar Integration user guide
0591065 - Sidebar Integration Complete! Right-click + Drag-and-Drop
353fe4b - Phase 3 COMPLETE: All Advanced Features Built!
07cf4bc - Phase 2: War Maps Composer + Advanced Layer Rendering
06ccdf6 - Phase 1: Core Layer System
```

**Deployment Time Estimate:** 1-2 hours
- Sync code: 30min
- Install deps: 10min
- Run migrations: 5min
- Start services: 5min
- Testing: 30min
- Troubleshooting buffer: 30min

---

**Ready to deploy!** 🚀

Let me know when you're in Replit and I'll guide you through each step.
