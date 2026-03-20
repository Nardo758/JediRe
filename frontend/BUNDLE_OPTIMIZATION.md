# Bundle Size Optimization

## 🎯 Problem

Initial bundle size: **2.7MB**
- Map vendor bundle: **1.7MB** (mapbox-gl + react-map-gl + drawing tools)
- Index bundle: **706KB**
- Too large for optimal initial page load

## ✅ Solution Implemented

### 1. Lazy Loading for Map-Heavy Pages

Converted to `React.lazy()` with `Suspense`:
- **MapPage** - Main mapping interface
- **Design3DPage** - 3D building design tool
- **AssetsOwnedPage** - Asset portfolio with map views

**Impact:**
- Map vendor bundle (1.7MB) now loads **on-demand** when user navigates to map pages
- Initial bundle reduced by **~60%**
- Faster first contentful paint (FCP)
- Better Lighthouse scores

### 2. Improved Code Splitting

Updated `vite.config.ts`:
```typescript
manualChunks: {
  'react-vendor': ['react', 'react-dom', 'react-router-dom'],
  'map-vendor': ['mapbox-gl', 'react-map-gl', '@mapbox/mapbox-gl-draw'],
  'ui-vendor': ['zustand', 'axios', 'socket.io-client']
}
```

**Benefits:**
- Map libraries bundled together in separate chunk
- Only loaded when map components are accessed
- Better browser caching (map bundle changes less frequently)

### 3. Loading Fallback Component

Created `PageLoadingFallback.tsx`:
- Lightweight spinner for lazy-loaded pages
- Smooth user experience during chunk loading
- Reusable across application

## 📊 Expected Results

**Before:**
- Initial load: **2.7MB** (all assets)
- Time to interactive: ~3-5s on 3G

**After:**
- Initial load: **~1.0MB** (without map vendor)
- Map vendor: **1.7MB** (loaded on-demand)
- Time to interactive: ~1-2s on 3G
- Map pages: +200-500ms latency on first access (one-time, then cached)

## 🔄 Files Modified

1. **frontend/src/App.tsx**
   - Added React.lazy imports for MapPage, Design3DPage, AssetsOwnedPage
   - Wrapped routes in Suspense with PageLoadingFallback

2. **frontend/vite.config.ts**
   - Added @mapbox/mapbox-gl-draw to map-vendor chunk
   - Increased chunkSizeWarningLimit (map bundle is legitimately large)
   - Added comments for clarity

3. **frontend/src/components/fallbacks/PageLoadingFallback.tsx** (new)
   - Lightweight loading component for lazy routes

## 🚀 Future Optimizations (if needed)

### Level 2: Lazy-load within pages
If map pages themselves are still too large:
- Split MapPage into sub-components (LayerPanel, DrawingTools, etc.)
- Lazy-load heavy drawing tools (@mapbox/mapbox-gl-draw)
- Progressive enhancement: basic map → advanced tools

### Level 3: CDN for map libraries
- Load mapbox-gl from CDN (external bundle)
- Reduces bundle size further (~500KB savings)
- Trade-off: Extra DNS lookup, no tree-shaking

### Level 4: Alternative map library
- Evaluate lighter alternatives:
  - Leaflet (~140KB vs mapbox-gl ~500KB)
  - MapLibre GL (~400KB, open-source fork of Mapbox GL)
- Only if Mapbox-specific features aren't critical

## 📈 Monitoring

### Build Stats
```bash
npm run build

# Check chunk sizes
ls -lh dist/assets/*.js

# Analyze bundle (if needed)
npx vite-bundle-visualizer
```

### Browser DevTools
1. Network tab → Disable cache
2. Throttle to "Fast 3G"
3. Measure:
   - Initial bundle size (before map access)
   - Map chunk load time (first map page access)
   - Total transferred vs. resources

### Key Metrics
- **Initial bundle:** Should be < 1.5MB
- **Map vendor chunk:** ~1.7MB (acceptable, lazy-loaded)
- **Time to Interactive (TTI):** < 2s on Fast 3G
- **First Contentful Paint (FCP):** < 1s

## ⚠️ Trade-offs

**Pros:**
✅ Faster initial page load (critical for user retention)
✅ Better perceived performance
✅ Reduced bandwidth for users who never visit map pages
✅ Better caching strategy

**Cons:**
⚠️ 200-500ms delay on first map page access (one-time)
⚠️ More complex code (Suspense boundaries)
⚠️ Slightly larger total bundle size due to chunk overhead (~10KB)

**Verdict:** Trade-off is worth it — initial load is more critical than map page access time.

## 🧪 Testing

### Manual Testing
1. Clear browser cache
2. Load dashboard → Verify fast load (no map bundle)
3. Navigate to /map → Verify map loads (200-500ms delay acceptable)
4. Navigate back to dashboard → Verify instant (cached)
5. Navigate to /map again → Verify instant (cached)

### Automated Testing
```bash
# Build and analyze
npm run build

# Serve production build
npm run preview

# Test with Lighthouse
npx lighthouse http://localhost:4173 --view
```

**Target Scores:**
- Performance: > 85
- First Contentful Paint: < 1.5s
- Time to Interactive: < 2.5s
- Total Blocking Time: < 300ms

## 📝 Notes

- Map libraries legitimately large (3D rendering, vector tiles, WebGL)
- Lazy loading is best approach (vs. feature reduction)
- Users who need maps get full functionality
- Users who don't need maps get faster experience
- Win-win optimization

---

**Implemented:** 2026-03-07
**Next Review:** After production deployment (monitor real-world metrics)
