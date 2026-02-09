# ThreePanelLayout Expandability Fix

**Date:** February 9, 2026  
**Commit:** 4e05090

## Issue Reported

Leon reported glitches with panel expandability on the 6 content pages:
- News Intelligence
- Email
- Pipeline (Deals)
- Assets Owned
- Market Data
- Dashboard

**Symptoms:**
- Some sections not expandable
- Map not visible when content panels were toggled
- Panel visibility states not persisting between sessions

## Root Cause

The ThreePanelLayout component had three issues:

1. **No state persistence** - Panel visibility (showViews, showContent, showMap) was initialized fresh on every page load, causing inconsistent behavior
2. **No safeguards** - Both map and content could be hidden simultaneously, leaving users with a blank screen
3. **Width calculation bug** - Content panel width calculation didn't properly account for views panel when map was hidden

## Changes Made

### 1. Persistent Panel States
```typescript
// Before: Always initialized to true
const [showContent, setShowContent] = useState(true);

// After: Load from localStorage
const [showContent, setShowContent] = useState(() => {
  const saved = localStorage.getItem(`${storageKey}-show-content`);
  return saved ? JSON.parse(saved) : true;
});
```

Now each page remembers its panel visibility states:
- `news-show-views`, `news-show-content`, `news-show-map`
- `email-show-content`, `email-show-map`
- etc.

### 2. Safeguard for Visibility
```typescript
// Ensure at least one panel is visible (map or content)
useEffect(() => {
  if (!showContent && !showMap) {
    // If both are hidden, show the map
    setShowMap(true);
  }
}, [showContent, showMap]);
```

Prevents users from accidentally hiding all panels.

### 3. Fixed Width Calculation
```typescript
// Before: 100% when map hidden
style={{ width: showMap ? `${contentWidth}px` : '100%' }}

// After: Account for views panel width
style={{ width: showMap ? `${contentWidth}px` : 'calc(100% - 80px)' }}
```

## Testing Steps

1. **Pull latest code:**
   ```bash
   cd /home/leon/clawd/jedire
   git pull origin master
   ```

2. **Test each content page:**
   - News Intelligence (/news-intel)
   - Email (/dashboard/email)
   - Pipeline (/deals)
   - Assets Owned (/assets-owned)
   - Market Data (/market-data)
   - Dashboard (/)

3. **For each page, test:**
   - Toggle "Views" button (if visible)
   - Toggle "Content" button
   - Toggle "Map" button
   - Verify at least one panel always visible
   - Refresh page - verify panel states persist
   - Try hiding both content and map - verify map stays visible

## Pages with Views Panel
- **News Intelligence** - Yes (4 views: Feed, Dashboard, Network, Alerts)
- **Email** - No
- **Pipeline** - No
- **Assets Owned** - No
- **Market Data** - No

## Expected Behavior

✅ **Correct:**
- Toggle buttons remember state across page refreshes
- Can hide content to see full-width map
- Can hide map to see full-width content
- Cannot hide both (map will auto-show)
- Pages without views panel don't show "Views" toggle

❌ **Previous Bug:**
- Panel states reset on page load
- Could hide all panels (blank screen)
- Content width calculation wrong when map hidden

## Files Changed

- `frontend/src/components/layout/ThreePanelLayout.tsx` (31 insertions, 6 deletions)

## Next Steps

If issues persist:
1. Clear localStorage: `localStorage.clear()` in browser console
2. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
3. Check browser console for errors
4. Report specific page and toggle sequence that causes issue
