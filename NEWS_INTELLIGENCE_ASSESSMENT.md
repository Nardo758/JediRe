# News Intelligence - Current State & Build Plan

**Assessment Date:** 2026-02-08 01:26 EST  
**Status:** 🟡 Partially Built - UI Complete, Backend Complete, Integration Needed

---

## 📊 Current State

### ✅ COMPLETE

#### Frontend UI (100%)
- **NewsIntelligencePage.tsx** - Full split-view layout
  - 3-column layout (Views sidebar, Content panel, Map)
  - Resizable panels with localStorage persistence
  - Toggle buttons to show/hide panels
  - Interactive map-content sync
  - Event cards with detailed horizontal design
  - Category filters
  - Color-coded event markers on map

#### Backend API (100%)
- **news.routes.ts** - 7 REST endpoints
  - `GET /api/v1/news/events` - List events with filters
  - `GET /api/v1/news/events/:id` - Single event details
  - `GET /api/v1/news/dashboard` - Market dashboard metrics
  - `GET /api/v1/news/alerts` - User alerts
  - `PATCH /api/v1/news/alerts/:id` - Update alert status
  - `GET /api/v1/news/network` - Network intelligence (contact credibility)

#### API Service Layer (100%)
- **news.service.ts** - Complete TypeScript client
  - All 6 methods implemented
  - Proper typing with interfaces
  - Query parameter handling

#### Database Schema (100%)
- **008_news_intelligence.sql** - 7 tables
  - `news_events` - Core event storage
  - `news_event_geo_impacts` - Links events to deals/properties
  - `news_alerts` - User notifications
  - `news_contact_credibility` - Email source tracking
  - `news_sources` - Public source registry
  - `news_event_corroboration` - Event cross-validation
  - Indexes, triggers, helper functions

---

## 🚧 NEEDS WORK

### 1. 🔴 Frontend-Backend Integration (CRITICAL)
**Status:** Mock data only, no API calls

**Current Issue:**
- NewsIntelligencePage uses hardcoded `mockEvents` array
- API service exists but not wired up
- No loading states, error handling, or real data flow

**What's Needed:**
```typescript
// Add to NewsIntelligencePage.tsx:
- useEffect to fetch events on mount
- Wire up category filters to API
- Wire up dashboard metrics to API
- Wire up network intelligence to API
- Wire up alerts to API
- Add loading/error states
- Add pagination (Load More button)
```

**Estimated Work:** 2-3 hours

---

### 2. 🟡 Data Population (HIGH)
**Status:** Database tables exist but empty

**Current Issue:**
- No news events in database
- No test data seeded
- No ingestion pipeline running

**What's Needed:**
- **Option A:** Seed mock data for testing (quick)
  - Create migration with 20-30 sample events
  - Cover all categories (employment, development, transactions, etc.)
  - Link some events to existing deals/properties
  
- **Option B:** Build ingestion pipeline (long-term)
  - Email parser (extract events from Gmail/Outlook)
  - Public source scrapers (news APIs, RSS feeds)
  - AI extraction service (GPT-4 to parse articles)
  - Background job queue

**Estimated Work:**
- Option A: 1-2 hours
- Option B: 1-2 weeks

---

### 3. 🟡 Horizontal Bar Buttons (MEDIUM)
**Status:** UI exists but no functionality

**Current Issue:**
- War Maps button doesn't toggle layers properly
- Custom map buttons are hardcoded
- Create Map button has no modal/action
- Create Deal button doesn't open CreateDealModal
- Search bar doesn't search anything

**What's Needed:**

#### War Maps Button
- Already partially working (toggles LayerControlsPanel)
- Need to actually show/hide map layers based on state

#### Custom Map Buttons
- Wire to real user-created maps from database
- Add CRUD operations for custom maps
- Persist map layer configs

#### Create Map Button
- Build CreateMapModal component
- Allow users to draw custom boundaries
- Name + save custom map layers
- Add to HorizontalBar button list

#### Create Deal Button
- Wire to existing CreateDealModal
- Pass proper callbacks
- Sync with Dashboard state

#### Search Bar
- Implement search endpoint (properties, deals, emails, events)
- Debounced search
- Search results dropdown
- Navigate to result on click

**Estimated Work:** 3-4 hours

---

### 4. 🟢 Map Layer Integration (LOW)
**Status:** Map shows deals but not news events properly

**Current Issue:**
- Event markers are added but not synced with layer controls
- No layer toggle for "News Events"
- No opacity control for event markers

**What's Needed:**
- Add "News Events" to MapLayersContext
- Sync event markers with layer visibility/opacity
- Add to LayerControlsPanel sidebar

**Estimated Work:** 1 hour

---

### 5. 🟢 Alerts System (LOW)
**Status:** Backend complete, UI placeholder

**Current Issue:**
- Alerts view shows "coming soon"
- No UI for alert notifications
- No alert badge in navigation
- No push notification system

**What's Needed:**
- Build AlertsView component (list of alerts)
- Alert notification badge in sidebar (unread count)
- Mark as read/dismissed functionality
- Snooze alerts feature
- (Optional) Browser push notifications

**Estimated Work:** 2-3 hours

---

## 🎯 Priority Build Order

### Phase 1: Make It Work (4-6 hours)
1. **Seed mock data** (1-2 hours)
   - Create migration with 30 sample events
   - Cover all categories and severities
   - Link to existing deals

2. **Wire frontend to backend** (2-3 hours)
   - Replace mockEvents with API calls
   - Add loading states
   - Add error handling
   - Wire up all 4 views (Feed, Dashboard, Network, Alerts)

3. **Fix horizontal bar buttons** (1 hour)
   - Wire Create Deal button to modal
   - Fix War Maps layer toggling

### Phase 2: Polish It (3-4 hours)
4. **Build Alerts view** (2 hours)
   - Alert list UI
   - Mark read/dismissed
   - Snooze functionality

5. **Add search functionality** (2 hours)
   - Backend search endpoint
   - Frontend search dropdown
   - Result navigation

### Phase 3: Scale It (Long-term)
6. **Build ingestion pipeline** (1-2 weeks)
   - Email parsing
   - Public source scrapers
   - AI extraction
   - Background jobs

---

## 📋 Detailed Task Breakdown

### Task 1: Seed Mock Data (1-2 hours)

**File:** `backend/src/database/migrations/009_seed_news_events.sql`

```sql
-- Create 30 sample events covering:
- 8 employment events (Microsoft, Google, Amazon relocations)
- 8 development events (permit approvals, groundbreakings)
- 8 transaction events (property sales, acquisitions)
- 4 government events (zoning changes, tax incentives)
- 2 amenities events (new restaurants, retail)

-- Link some events to existing deals/properties
-- Set realistic impact metrics
-- Vary severities and source types
```

---

### Task 2: Wire Frontend to Backend (2-3 hours)

**File:** `frontend/src/pages/NewsIntelligencePage.tsx`

**Changes:**
```typescript
// Add state for API data
const [events, setEvents] = useState<NewsEvent[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [dashboardData, setDashboardData] = useState<MarketDashboard | null>(null);
const [networkData, setNetworkData] = useState<NetworkIntelligence | null>(null);
const [alerts, setAlerts] = useState<NewsAlert[]>([]);

// Fetch events on mount + category change
useEffect(() => {
  fetchEvents();
}, [selectedCategory]);

const fetchEvents = async () => {
  try {
    setIsLoading(true);
    const response = await newsService.getEvents({
      category: selectedCategory === 'all' ? undefined : selectedCategory,
      limit: 50,
    });
    setEvents(response.data);
  } catch (err) {
    setError('Failed to load events');
  } finally {
    setIsLoading(false);
  }
};

// Fetch dashboard metrics
useEffect(() => {
  if (activeView === 'dashboard') {
    fetchDashboard();
  }
}, [activeView]);

// Fetch network intelligence
useEffect(() => {
  if (activeView === 'network') {
    fetchNetwork();
  }
}, [activeView]);

// Fetch alerts
useEffect(() => {
  if (activeView === 'alerts') {
    fetchAlerts();
  }
}, [activeView]);

// Replace mockEvents with events state everywhere
```

---

### Task 3: Fix Horizontal Bar Buttons (1 hour)

**File:** `frontend/src/components/map/HorizontalBar.tsx`

**Changes:**
```typescript
// Wire Create Deal button
import { CreateDealModal } from '../deal/CreateDealModal';

const [isCreateDealOpen, setIsCreateDealOpen] = useState(false);

<button 
  onClick={() => setIsCreateDealOpen(true)}
  className="..."
>
  <span className="text-lg">➕</span>
  <span>Create Deal</span>
</button>

<CreateDealModal
  isOpen={isCreateDealOpen}
  onClose={() => setIsCreateDealOpen(false)}
  onDealCreated={() => {
    setIsCreateDealOpen(false);
    // Refresh deals list
  }}
/>

// Fix War Maps layer syncing
const toggleWarMaps = () => {
  const newState = !warMapsActive;
  setWarMapsActive(newState);
  
  // Properly sync with MapLayersContext
  layers.forEach(layer => {
    if (newState && !layer.active) {
      toggleLayer(layer.id);
    } else if (!newState && layer.active) {
      toggleLayer(layer.id);
    }
  });
};
```

---

### Task 4: Build Alerts View (2 hours)

**File:** `frontend/src/pages/NewsIntelligencePage.tsx`

**Add AlertsView component:**
```typescript
const renderAlertsView = () => (
  <div className="space-y-3">
    {isLoading ? (
      <div className="text-center py-8 text-gray-500">Loading alerts...</div>
    ) : alerts.length === 0 ? (
      <div className="text-center py-12 text-gray-500">
        <div className="text-4xl mb-2">🔔</div>
        <p>No alerts yet</p>
      </div>
    ) : (
      alerts.map(alert => (
        <div key={alert.id} className="bg-white rounded-lg border p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-gray-900">{alert.headline}</h3>
            <span className={`px-2 py-1 text-xs rounded ${
              alert.severity === 'critical' ? 'bg-red-100 text-red-700' :
              alert.severity === 'high' ? 'bg-orange-100 text-orange-700' :
              alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {alert.severity}
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-3">{alert.summary}</p>
          {alert.suggested_action && (
            <div className="bg-blue-50 p-2 rounded text-sm text-blue-700 mb-2">
              <strong>Suggested Action:</strong> {alert.suggested_action}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => markAlertRead(alert.id)}
              className="text-sm text-blue-600 hover:underline"
            >
              Mark Read
            </button>
            <button
              onClick={() => dismissAlert(alert.id)}
              className="text-sm text-gray-600 hover:underline"
            >
              Dismiss
            </button>
            <button
              onClick={() => snoozeAlert(alert.id, 24)}
              className="text-sm text-gray-600 hover:underline"
            >
              Snooze 24h
            </button>
          </div>
        </div>
      ))
    )}
  </div>
);

const markAlertRead = async (id: string) => {
  await newsService.updateAlert(id, { is_read: true });
  fetchAlerts();
};

const dismissAlert = async (id: string) => {
  await newsService.updateAlert(id, { is_dismissed: true });
  fetchAlerts();
};

const snoozeAlert = async (id: string, hours: number) => {
  await newsService.updateAlert(id, { snooze_hours: hours });
  fetchAlerts();
};
```

---

## 🔧 Technical Debt

### Database Migrations
- Migration 008 not yet run on Replit database
- Need to run: `npm run db:push` or execute SQL manually

### Missing Dependencies
- News ingestion pipeline (future work)
- Email parsing service (future work)
- Public source scrapers (future work)
- AI extraction service (future work)

### Performance Considerations
- Event list pagination (implement offset/limit)
- Map marker clustering for 100+ events
- Real-time updates via WebSocket (future)

---

## 📦 Summary

### What's Built ✅
- Complete UI with split-view layout
- Complete backend API (7 endpoints)
- Complete database schema (7 tables)
- API service layer

### What's Needed 🚧
- Wire frontend to backend (mock → real data)
- Seed test data
- Fix horizontal bar buttons
- Build Alerts view
- Add search functionality

### Time Estimate
- **Phase 1 (Make It Work):** 4-6 hours
- **Phase 2 (Polish It):** 3-4 hours
- **Phase 3 (Scale It):** 1-2 weeks (optional)

### Recommended Next Steps
1. Seed mock data (30 events) - **Start here**
2. Wire frontend Event Feed to API
3. Wire Dashboard metrics to API
4. Fix Create Deal button
5. Build Alerts view

---

**Last Updated:** 2026-02-08 01:26 EST
