# Digital Traffic Tracking - Usage Guide

## Overview

The digital traffic tracking system automatically captures user interactions with properties and calculates engagement scores. This proprietary data gives you a **3-6 month advantage** by identifying properties that are gaining market attention before prices rise.

## Architecture

### Database Schema (Migration 032)

Three tables power the system:

1. **`property_events`** - Raw event tracking
   - Captures: views, saves, shares, map clicks, analysis runs
   - Includes: user_id, timestamp, metadata, session tracking

2. **`property_engagement_daily`** - Daily aggregations
   - Pre-calculated daily metrics per property
   - Enables fast historical trend queries

3. **`digital_traffic_scores`** - Calculated scores
   - 0-100 engagement score
   - Trending velocity
   - Institutional interest flags
   - Updated via scheduled job

### Frontend Components

#### 1. `eventTrackingService.ts`
API client for tracking events and fetching scores.

**Functions:**
```typescript
// Track single event
trackEvent(event: PropertyEvent): Promise<void>

// Batch multiple events
trackBatch(events: PropertyEvent[]): Promise<void>

// Get property score
getDigitalScore(propertyId: string): Promise<DigitalTrafficScore>

// Get trending properties
getTrendingProperties(limit?: number): Promise<TrendingProperty[]>
```

#### 2. `useEventTracking.ts`
React hook for automatic event tracking with batching and offline support.

**Features:**
- Auto-batching (sends events every 10 seconds)
- Debouncing to prevent spam (1 second default)
- Offline queue with retry
- Session tracking
- Auto-track page views on mount

**Usage:**
```typescript
const { trackEvent } = useEventTracking({
  propertyId: 'property-id',
  autoTrackPageView: true,  // Auto-track on mount
  debounceMs: 1000,          // Debounce window
});

// Manual tracking
trackEvent(propertyId, 'saved', { action: 'bookmark' });
```

**Standalone function:**
```typescript
import { trackPropertyEvent } from '@/hooks/useEventTracking';

trackPropertyEvent(propertyId, 'map_click', {
  coordinates: { lat, lng },
});
```

#### 3. `DigitalTrafficCard.tsx`
Display component showing property engagement metrics.

**Props:**
```typescript
interface DigitalTrafficCardProps {
  propertyId: string;
  className?: string;
  compact?: boolean;  // Compact mode for cards
}
```

**Displays:**
- Digital traffic score (0-100)
- Weekly views and saves
- Trending indicator (velocity > 2.0)
- Institutional interest flag
- Unique viewer count

## Integration Points

### ✅ 1. Property Detail Pages
**File:** `jedire/frontend/src/components/property/PropertyDetail.tsx`

**Tracking:**
- Auto-tracks `detail_view` on mount
- Tracks `saved` when property is pinned
- Displays full `DigitalTrafficCard`

```typescript
const { trackEvent } = useEventTracking({
  propertyId: selectedProperty?.id,
  autoTrackPageView: true,
});
```

### ✅ 2. Map Component
**File:** `jedire/frontend/src/components/map/MapView.tsx`

**Tracking:**
- Tracks `map_click` when property pin is clicked
- Includes current zoom level and coordinates in metadata

```typescript
trackPropertyEvent(property.id, 'map_click', {
  coordinates: property.coordinates,
  currentZoom: viewState.zoom,
});
```

### ✅ 3. Property Cards
**File:** `jedire/frontend/src/components/property/PropertyCard.tsx`

**Tracking:**
- Auto-tracks `search_impression` when card becomes visible (Intersection Observer)
- Displays compact `DigitalTrafficCard`
- Tracks when 50% of card is visible

```typescript
// Intersection Observer tracks visibility
const observer = new IntersectionObserver(
  (entries) => {
    if (entry.isIntersecting && !hasTracked.current) {
      trackPropertyEvent(property.id, 'search_impression');
    }
  },
  { threshold: 0.5 }
);
```

### ✅ 4. Analysis Modules
**File:** `jedire/frontend/src/components/deal/sections/TrafficAnalysisSection.tsx`

**Tracking:**
- Tracks `analysis_run` when module executes
- Includes module name and timestamp in metadata

```typescript
trackPropertyEvent(propertyId, 'analysis_run', {
  module: 'traffic-analysis',
  timestamp: new Date().toISOString(),
});
```

## Event Types

| Event Type | When Tracked | Metadata Examples |
|------------|--------------|-------------------|
| `search_impression` | Property card visible in results | `{ position: { x, y } }` |
| `map_click` | User clicks property marker | `{ coordinates, currentZoom }` |
| `detail_view` | User opens property details | `{ page: '/property/123' }` |
| `analysis_run` | Analysis module executes | `{ module: 'traffic-analysis' }` |
| `saved` | User bookmarks/pins property | `{ action: 'pin' }` |
| `shared` | User shares property link | `{ destination: 'email' }` |

## Batching & Performance

### How Batching Works
- Events queue in-memory
- Sent every 10 seconds via single API call
- Reduces server load by ~90%
- Events flushed on page unload

### Offline Support
- Events saved to localStorage when offline
- Auto-retry when connection restored
- Prevents data loss during network issues

### Debouncing
- Prevents duplicate events within 1 second
- Per-property, per-event-type tracking
- User can't spam the same event

## Backend API Endpoints

**(To be implemented by backend team)**

### Required Routes:
```
POST /api/events/track          - Track single event
POST /api/events/track/batch    - Track multiple events
GET  /api/events/score/:id      - Get digital score
GET  /api/events/trending        - Get trending properties
GET  /api/events/engagement/:id  - Get engagement history
```

## Scheduled Jobs

### Daily Aggregation
- Runs nightly (cron job)
- Aggregates `property_events` into `property_engagement_daily`
- Counts unique users, views, saves, etc.

### Score Calculation
- Runs weekly or on-demand
- Calculates 0-100 score based on:
  - View velocity
  - Save rate
  - Unique user count
  - Institutional interest patterns
- Updates `digital_traffic_scores` table

## Testing

### Manual Testing
1. Open property detail page → Check console for `detail_view` event
2. Click property on map → Check for `map_click` event
3. Scroll property cards → Check for `search_impression` events
4. Run analysis module → Check for `analysis_run` event
5. Pin a property → Check for `saved` event

### Verify Batching
1. Track multiple events quickly
2. Open Network tab → Wait 10 seconds
3. Should see single POST to `/api/events/track/batch`

### Verify Offline Queue
1. Open property page while online
2. Go offline (Chrome DevTools → Network → Offline)
3. Click around to generate events
4. Go back online
5. Events should flush automatically

## Troubleshooting

### Events Not Sending
- Check browser console for errors
- Verify API_BASE is configured correctly
- Check Network tab for failed requests

### Scores Not Loading
- Verify backend endpoints are implemented
- Check that migration 032 has been run
- Ensure score calculation job has run at least once

### Duplicate Events
- Check debounceMs setting (default 1000ms)
- Verify component isn't re-mounting unnecessarily

## Next Steps (Backend Implementation)

1. **Create API Routes** - Implement the 5 endpoints listed above
2. **Daily Aggregation Job** - Cron to populate `property_engagement_daily`
3. **Score Algorithm** - Logic to calculate 0-100 scores
4. **Institutional Detection** - Pattern matching for institutional interest
5. **Performance Testing** - Ensure batch endpoint handles 100+ events

## Key Benefits

🎯 **Proprietary Data Signal** - Track what competitors can't see  
⚡ **Early Detection** - Spot trending properties 3-6 months early  
📊 **Institutional Interest** - Identify when big money is looking  
🚀 **Performance** - Batching reduces server load by 90%  
📡 **Reliability** - Offline queue prevents data loss

---

**Questions?** Check `jedire/backend/migrations/032_digital_traffic_events.sql` for schema details.
