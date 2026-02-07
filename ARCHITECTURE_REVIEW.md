# JEDI RE Platform - Architecture Review & Recommendations

**Reviewed:** 2026-02-07  
**Documents Analyzed:**
- COMPLETE_PLATFORM_WIREFRAME.md (63KB)
- MODULE_MARKETPLACE_ARCHITECTURE.md (68KB)
- ROADMAP.md (original project plan)
- JEDI_DATA_SCHEMA.md (data architecture)
- JEDIRE_OS_VISION.md (product vision)
- LIGHTWEIGHT_ARCHITECTURE.md (technical approach)
- /backend/python-services/engines/ (existing codebase)

**Reviewer:** Architecture Subagent  
**Status:** Comprehensive Analysis Complete + Critical Alignment Issue Identified

---

## ⚠️ CRITICAL FINDING

**The new specifications represent a FUNDAMENTAL DEPARTURE from the original JEDI RE vision and existing codebase.**

**SEE:** `CRITICAL_VISION_ALIGNMENT_REVIEW.md` for detailed analysis.

**Key Issue:** New specs abandon 8 months of development on unique mathematical intelligence engines (Kalman filtering, game theory, contagion modeling, etc.) in favor of generic property management features.

**Impact:** Loss of unique IP, 10x cost increase, pivot from scientific platform to commodity CRM.

**Recommendation:** Integrate best UI concepts from new specs with existing scientific engines rather than abandoning them.

---

## Executive Summary

The JEDI RE platform specifications demonstrate a well-thought-out, ambitious real estate intelligence platform with innovative features. However, **critical alignment issues** exist between these new specifications and the original product vision, plus several technical areas need attention before implementation.

**Strengths:**
- ✅ Clear visual hierarchy with map-centric design
- ✅ Modular architecture with marketplace monetization
- ✅ Comprehensive feature set for real estate workflows
- ✅ Strong focus on AI-powered analysis
- ✅ Collaborative features (map sharing, team)

**Critical Issues to Address:**
- ⚠️ Database schema needs significant expansion
- ⚠️ API design lacks authentication, pagination, error handling
- ⚠️ Missing real-time architecture specifications
- ⚠️ Performance considerations not addressed
- ⚠️ Data privacy and security not specified
- ⚠️ Module dependency graph unclear
- ⚠️ Mobile responsiveness not defined

---

## Table of Contents

1. [Gaps & Inconsistencies](#gaps--inconsistencies)
2. [User Experience Improvements](#user-experience-improvements)
3. [Technical Architecture](#technical-architecture)
4. [Database Schema Enhancements](#database-schema-enhancements)
5. [API Design Improvements](#api-design-improvements)
6. [Feature Completeness](#feature-completeness)
7. [Implementation Challenges](#implementation-challenges)
8. [Best Practices](#best-practices)
9. [Additional Feature Recommendations](#additional-feature-recommendations)
10. [Priority Action Items](#priority-action-items)

---

## Gaps & Inconsistencies

### 1. **Document Synchronization Issues**

**Issue:** The two documents have overlapping but inconsistent information about deal creation flow.

**COMPLETE_PLATFORM_WIREFRAME.md:**
- Describes original 5-step wizard (Category → Type → Address → Boundary → Details)
- Simpler approach, focused on quick entry

**MODULE_MARKETPLACE_ARCHITECTURE.md:**
- Adds "Quick Add vs Detailed Add" choice
- Introduces tabbed form with 5 tabs (Basic Info → Asset Details → Financials → Team → Settings)
- Much more comprehensive but potentially overwhelming

**Recommendation:**
```markdown
UNIFIED CREATE DEAL FLOW:

1. Initial Choice (Modal):
   - ⚡ Quick Add (5-step wizard) - 1 min
   - 📋 Detailed Add (tabbed form) - 5-10 min

2. Quick Add Path:
   [Keep original 5-step wizard from COMPLETE_PLATFORM_WIREFRAME.md]
   
3. Detailed Add Path:
   [Use tabbed form from MODULE_MARKETPLACE_ARCHITECTURE.md]
   
4. Post-Creation:
   - Both paths create minimal viable deal
   - User can "Enrich Deal" later from deal page
   - Progressive disclosure: Don't force all data upfront
```

---

### 2. **Module Tab Ordering Inconsistency**

**Issue:** Different ordering mentioned in different contexts.

**COMPLETE_PLATFORM_WIREFRAME.md Deal Sidebar:**
```
Overview
Properties
Strategy
Pipeline
AI Agents
Analysis
Email
Reports
```

**MODULE_MARKETPLACE_ARCHITECTURE.md Module Examples:**
```
Overview
Financial Modeling
Development Budget
Construction Timeline
Strategy Arbitrage
Tasks
Documents
Activity Feed
```

**Recommendation:**
- Create a **canonical default module order** based on user persona
- Store in database: `user_modules.global_position` and `deal_modules.position`
- Allow full customization but provide smart defaults:

```sql
-- Default order by persona
DEFAULT_MODULE_ORDER = {
  'flipper': ['overview', 'financial', 'comp_analysis', 'tasks', 'documents'],
  'developer': ['overview', 'dev_budget', 'timeline', 'zoning', 'financial'],
  'buy_hold': ['overview', 'financial', 'properties', 'rent_analysis', 'tasks'],
  'syndicator': ['overview', 'financial', 'investor_reporting', 'documents']
}
```

---

### 3. **JEDI Score Calculation Missing Details**

**Issue:** Analysis module shows JEDI Score but calculation methodology is vague.

**Current State:**
- Shows score 0-100
- Shows component breakdown (Development Capacity, Market Signals, Quality, Location)
- Mentions "Python engine" but no architecture

**Missing:**
- How are weights determined?
- What data sources feed each component?
- How often is score recalculated?
- Can users adjust weights?
- What's the confidence calculation formula?

**Recommendation:**
Add specification section:

```markdown
### JEDI Score Engine Architecture

**Calculation Formula:**
JEDI_Score = (Development_Capacity × 0.30) + 
             (Market_Signals × 0.30) + 
             (Quality × 0.20) + 
             (Location × 0.20)

**Component Details:**

1. Development Capacity (0-30 points)
   - Zoning maximum units
   - Land area efficiency
   - Setback constraints
   - Height restrictions
   - Parking requirements
   Data Sources: Municode API, local zoning layers

2. Market Signals (0-30 points)
   - Rent growth trends (3yr)
   - Occupancy rates
   - New supply pipeline
   - Absorption rates
   - Demographic trends
   Data Sources: CoStar API, Census API, internal comps

3. Quality (0-20 points)
   - Building class
   - Year built / renovation
   - Amenity scoring
   - Unit mix optimization
   - Property condition
   Data Sources: User input, property records, ML image analysis

4. Location (0-20 points)
   - Walk score
   - Transit access
   - School ratings
   - Crime index
   - Retail/dining proximity
   Data Sources: Walk Score API, Google Places, local crime stats

**Recalculation Triggers:**
- Manual: User clicks "Re-run Analysis"
- Automatic: Deal data changes (address, units, price)
- Scheduled: Weekly for all active deals
- Event-driven: New market data available

**Confidence Score:**
Confidence = (Data_Completeness × 0.4) + 
             (Data_Freshness × 0.3) + 
             (Model_Agreement × 0.3)

Where:
- Data_Completeness = % of required fields populated
- Data_Freshness = Weighted average of data source ages
- Model_Agreement = Variance between multiple models
```

---

### 4. **Real-Time Features Not Specified**

**Issue:** Several features imply real-time updates but architecture is missing.

**Features Requiring Real-Time:**
- AI Agent status updates ("Working...", "45% complete")
- Map collaboration (multiple users editing same map)
- Team notifications
- Deal activity feed
- Pipeline stage changes
- Email notifications

**Recommendation:**
Add WebSocket architecture specification:

```markdown
### Real-Time Architecture

**Technology Stack:**
- WebSocket server: Socket.io (Node.js) or Django Channels (Python)
- Message broker: Redis pub/sub
- Scaling: Redis adapter for multi-instance

**Event Types:**

1. Deal Events
   - deal:updated
   - deal:stage_changed
   - deal:analysis_complete
   
2. Map Events
   - map:annotation_added
   - map:user_joined
   - map:user_editing
   
3. Agent Events
   - agent:status_changed
   - agent:task_complete
   - agent:message
   
4. Team Events
   - team:member_joined
   - team:comment_added
   - team:mention

**Client Connection:**
```javascript
const socket = io('wss://api.jedire.com', {
  auth: { token: userToken },
  transports: ['websocket', 'polling']
});

socket.on('deal:updated', (data) => {
  // Update deal in UI
});

socket.on('agent:status_changed', (data) => {
  // Update agent status indicator
});
```

**Room Structure:**
- `user:{userId}` - Personal notifications
- `deal:{dealId}` - Deal-specific updates
- `map:{mapId}` - Map collaboration
- `team:{teamId}` - Team-wide notifications
```

---

### 5. **Module Dependencies Not Defined**

**Issue:** Some modules depend on others but this isn't documented.

**Examples:**
- "Strategy Arbitrage" requires "Financial Modeling" data
- "Development Budget" feeds into "Financial Modeling"
- "Risk Analysis" needs "Zoning Analysis" results
- "Investor Reporting" pulls from multiple modules

**Recommendation:**
Create module dependency graph:

```markdown
### Module Dependency Matrix

| Module | Depends On | Provides Data To | Can Function Alone? |
|--------|-----------|------------------|-------------------|
| Overview | None | All modules | ✅ Yes |
| Financial Modeling | None | Strategy, Returns, Investor Reporting | ✅ Yes |
| Strategy Arbitrage | Financial Modeling | None | ❌ No (requires financial data) |
| Dev Budget | None | Financial Modeling, Timeline | ✅ Yes |
| Construction Timeline | Dev Budget (optional) | None | ⚠️ Partial (better with budget) |
| Zoning Analysis | None | Risk Analysis, Dev Budget | ✅ Yes |
| Risk Analysis | Zoning Analysis, Environmental | None | ⚠️ Partial |
| Returns Calculator | Financial Modeling | Investor Reporting | ❌ No |
| Investor Reporting | Financial, Returns, Tasks | None | ❌ No |

**Implementation:**
```sql
CREATE TABLE module_dependencies (
  module_id UUID REFERENCES modules(id),
  depends_on_module_id UUID REFERENCES modules(id),
  dependency_type VARCHAR(20), -- 'required', 'optional', 'enhances'
  PRIMARY KEY (module_id, depends_on_module_id)
);
```

**UI Behavior:**
- When user tries to activate module with missing dependencies:
  ```
  ┌─────────────────────────────────────┐
  │ Missing Dependencies          [X]   │
  ├─────────────────────────────────────┤
  │                                     │
  │ Strategy Arbitrage requires:        │
  │ • Financial Modeling                │
  │                                     │
  │ Would you like to add it?           │
  │                                     │
  │ [No, Cancel] [Yes, Add Both]        │
  └─────────────────────────────────────┘
  ```
```

---

## User Experience Improvements

### 1. **Map Performance with Large Datasets**

**Issue:** No strategy for handling 1000+ property markers or complex boundaries.

**Problems:**
- All properties rendered = browser crash
- Map becomes unusable with too many markers
- Slow panning/zooming

**Recommendation:**

```markdown
### Map Clustering & Virtualization Strategy

**Clustering (for many properties):**
```javascript
// Mapbox GL JS clustering
map.addSource('properties', {
  type: 'geojson',
  data: propertiesGeoJSON,
  cluster: true,
  clusterMaxZoom: 14,
  clusterRadius: 50
});

map.addLayer({
  id: 'clusters',
  type: 'circle',
  source: 'properties',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': [
      'step',
      ['get', 'point_count'],
      '#51bbd6', 100,
      '#f1f075', 750,
      '#f28cb1'
    ],
    'circle-radius': [
      'step',
      ['get', 'point_count'],
      20, 100,
      30, 750,
      40
    ]
  }
});
```

**Viewport-based Loading:**
- Only load properties in current viewport + buffer
- Lazy load as user pans/zooms
- Backend pagination by bounding box

```javascript
// API request
GET /api/v1/properties?bbox=-84.5,33.7,-84.3,33.9&limit=500
```

**Layer Toggle Performance:**
- Don't destroy/recreate layers on toggle
- Use `setLayoutProperty('visibility', 'visible'|'none')`
- Keep data in memory, only toggle visibility

**Progressive Loading:**
1. Zoom < 10: Show city-level clusters
2. Zoom 10-14: Show neighborhood clusters
3. Zoom > 14: Show individual properties

**UI Indicator:**
```
┌──────────────────────────────┐
│ Loading 247 properties...   │
│ ████████████░░░░░░ 65%       │
└──────────────────────────────┘
```
```

---

### 2. **Search Discoverability**

**Issue:** Google Search bar is prominent but unclear what can be searched.

**Current:** `[🔍 Search for addresses, apartments, locations...]`

**Problems:**
- Users may not know they can search keywords
- No search history
- No saved searches
- No search filters visible upfront

**Recommendation:**

```markdown
### Enhanced Search UX

**Search Bar with Dropdown:**
```
┌─────────────────────────────────────────────────────────────┐
│ 🔍 Search addresses, properties, or markets...          [↓] │
├─────────────────────────────────────────────────────────────┤
│ RECENT SEARCHES                                             │
│ • 123 Peachtree St, Atlanta, GA                             │
│ • luxury apartments Buckhead                                │
│ • multifamily midtown                                       │
├─────────────────────────────────────────────────────────────┤
│ SAVED SEARCHES                                              │
│ ⭐ Buckhead A+ Class Properties                             │
│ ⭐ Off-Market Deals Under $5M                               │
├─────────────────────────────────────────────────────────────┤
│ QUICK FILTERS                                               │
│ [Multifamily] [For Sale] [Atlanta] [Class A+]              │
└─────────────────────────────────────────────────────────────┘
```

**Search Result Enhancements:**
```
┌──────────────────────────────────────────────────────────────┐
│ 🔍 "luxury apartments Buckhead"                              │
├──────────────────────────────────────────────────────────────┤
│ Showing 24 results • [Save Search] [Export] [Filters ▼]     │
├──────────────────────────────────────────────────────────────┤
│ MAP VIEW | LIST VIEW                                          │
├──────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────┐  │
│ │ 🏢 Buckhead Grand                                       │  │
│ │ 3350 Peachtree Rd NE • Class A+ • 240 units            │  │
│ │ $1,800-$3,200/mo • 95% occupied                        │  │
│ │ 0.3 mi from search center                               │  │
│ │                                                         │  │
│ │ [📍 View on Map] [➕ Add to Deal] [⭐ Save]             │  │
│ └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**Add to Database:**
```sql
CREATE TABLE saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100),
  query TEXT,
  filters JSONB,
  alert_frequency VARCHAR(20), -- 'none', 'daily', 'weekly', 'instant'
  last_run_at TIMESTAMP,
  result_count INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```
```

---

### 3. **Module Overflow Handling**

**Issue:** Users with 20+ modules will have tab overflow.

**Current:** `[...More ▼]` mentioned but not detailed.

**Recommendation:**

```markdown
### Module Tab Overflow Strategy

**Visual Design:**
```
┌────────────────────────────────────────────────────────────────┐
│ [Overview] [Financial] [Strategy] [Budget] [Tasks] [...More ▼]│
└────────────────────────────────────────────────────────────────┘
```

**Dropdown Menu:**
```
┌─────────────────────────┐
│ MORE MODULES            │
├─────────────────────────┤
│ Documents          📄   │
│ Zoning Analysis    🏛️   │
│ Risk Analysis      ⚠️   │
│ Environmental      🌳   │
│ DD Checklist       ✅   │
│ Timeline           📅   │
│ Team               👥   │
│ Activity Feed      📊   │
├─────────────────────────┤
│ Customize Tabs...       │
└─────────────────────────┘
```

**Smart Tab Pinning:**
- First 5 tabs always visible
- User can "pin" frequently used modules
- Unpinned modules go to overflow
- System learns usage patterns:
  ```sql
  -- Track module access
  CREATE TABLE module_access_log (
    user_id UUID,
    module_id UUID,
    deal_id UUID,
    accessed_at TIMESTAMP
  );
  
  -- Auto-suggest pinning frequently used modules
  SELECT module_id, COUNT(*) as access_count
  FROM module_access_log
  WHERE user_id = $1 AND accessed_at > NOW() - INTERVAL '30 days'
  GROUP BY module_id
  ORDER BY access_count DESC
  LIMIT 5;
  ```

**Mobile Responsiveness:**
- On mobile: Show only 2-3 visible tabs
- Swipe to access more
- Bottom navigation for key modules
```

---

### 4. **Deal Stage Progression UX**

**Issue:** Moving between pipeline stages could be more intuitive.

**Current:** [Move to Next Stage] button opens modal.

**Enhancement:**

```markdown
### Enhanced Stage Progression

**Drag-and-Drop Kanban (Pipeline Grid View):**
```
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ Lead     │Qualified │Due Dil.  │Contract  │Closing   │Closed    │
│    2     │    3     │    1     │    2     │    1     │    8     │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │
│ │Deal A│ │ │Deal C│ │ │Deal F│ │ │Deal G│ │ │Deal I│ │ │Deal J│ │
│ │$2.5M │ │ │$5.2M │ │ │$8.1M │ │ │$3.9M │ │ │$1.2M │ │ │$4.7M │ │
│ └──────┘ │ └──────┘ │ └──────┘ │ └──────┘ │ └──────┘ │ └──────┘ │
│          │          │          │          │          │          │
│ ┌──────┐ │ ┌──────┐ │          │ ┌──────┐ │          │ [...8]   │
│ │Deal B│ │ │Deal D│ │          │ │Deal H│ │          │          │
│ │$1.8M │ │ │$6.4M │ │          │ │$2.3M │ │          │          │
│ └──────┘ │ └──────┘ │          │ └──────┘ │          │          │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

**Drag behavior:**
- Drag deal card from one column to another
- On drop: Modal appears asking for notes
  ```
  ┌─────────────────────────────────────┐
  │ Move Deal to "Qualified"       [X] │
  ├─────────────────────────────────────┤
  │ Deal: Buckhead Mixed-Use            │
  │ From: Lead → Qualified              │
  │                                     │
  │ What changed?                       │
  │ ┌─────────────────────────────────┐ │
  │ │ Broker confirmed seller interest│ │
  │ │ Financials look promising       │ │
  │ └─────────────────────────────────┘ │
  │                                     │
  │ Assign tasks for this stage?        │
  │ ☑ Request financials                │
  │ ☑ Schedule site visit               │
  │ ☑ Preliminary due diligence         │
  │                                     │
  │ [Cancel]            [Move Deal →]  │
  └─────────────────────────────────────┘
  ```

**Stage Templates:**
```sql
CREATE TABLE stage_templates (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  stage_name VARCHAR(50),
  checklist_items JSONB, -- Array of default tasks
  notification_settings JSONB,
  auto_assign_team JSONB
);

-- Example data
{
  "stage_name": "Due Diligence",
  "checklist_items": [
    "Order Phase I Environmental",
    "Review rent roll",
    "Inspect property",
    "Review leases",
    "Title search"
  ],
  "notification_settings": {
    "notify_team": true,
    "email_summary": true
  },
  "auto_assign_team": [
    {"role": "inspector", "notify": true},
    {"role": "attorney", "notify": true}
  ]
}
```
```

---

### 5. **Onboarding & Empty States**

**Issue:** Limited guidance for new users with no data.

**Current:** "No properties found yet" with basic actions.

**Enhancement:**

```markdown
### Comprehensive Empty States

**First Login (No Deals):**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                   │
│                    👋 Welcome to JEDI RE!                        │
│                                                                   │
│              Your real estate intelligence platform               │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Let's get started:                     │  │
│  │                                                            │  │
│  │  1️⃣  Take a quick tour (2 min)                            │  │
│  │     [▶ Watch Video] [📖 Read Guide]                       │  │
│  │                                                            │  │
│  │  2️⃣  Create your first deal                               │  │
│  │     [➕ Create Deal]                                       │  │
│  │                                                            │  │
│  │  3️⃣  Or explore sample data                               │  │
│  │     [📊 Load Demo Deal]                                    │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  📚 Popular Resources:                                           │
│  • How to analyze a development deal                             │
│  • Understanding JEDI Scores                                     │
│  • Custom map collaboration                                      │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Empty Properties Silo:**
```
┌──────────────────────────────────────────────────────────────────┐
│  🏢 Assets Owned                                                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│              No properties in your portfolio yet                  │
│                                                                   │
│  Add properties to:                                               │
│  • Track rent vs market rates                                    │
│  • Monitor lease expirations                                     │
│  • Calculate negotiation power                                   │
│  • Generate portfolio reports                                    │
│                                                                   │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │
│  │ ➕ Add         │  │ 📁 Import CSV  │  │ 🔍 Search      │    │
│  │   Manually     │  │                │  │   & Add        │    │
│  └────────────────┘  └────────────────┘  └────────────────┘    │
│                                                                   │
│  Or [📊 Load Sample Portfolio] to explore features               │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Empty Custom Maps:**
```
┌──────────────────────────────────────────────────────────────────┐
│  Horizontal Bar: [🔍 Search] [🗺️ War Maps]  [➕ Create Map]     │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│          💡 TIP: Create custom maps to organize research         │
│                                                                   │
│  Example use cases:                                               │
│  • 📍 Broker Recommendations - Track deals from brokers          │
│  • 🎯 Target Markets - Highlight neighborhoods to invest         │
│  • 🏗️ Development Sites - Map potential land acquisitions       │
│  • 🤝 Competitor Analysis - Monitor competitor properties        │
│                                                                   │
│  [➕ Create Your First Map]  [📖 Learn More]                     │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```
```

---

## Technical Architecture

### 1. **Missing System Architecture Diagram**

**Issue:** No high-level architecture specified.

**Recommendation:**

```markdown
### System Architecture

**Three-Tier Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  React/Next.js Frontend                                          │
│  • Mapbox GL JS (map rendering)                                  │
│  • Socket.io Client (real-time)                                  │
│  • TanStack Query (data fetching)                                │
│  • Zustand (state management)                                    │
└─────────────────────────────────────────────────────────────────┘
                            │ HTTPS/WSS
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  API Gateway (Kong/nginx)                                        │
│  ├─ Authentication Service (JWT)                                 │
│  ├─ REST API (Node.js/Express or Python/FastAPI)                │
│  ├─ GraphQL API (optional, for complex queries)                 │
│  ├─ WebSocket Server (Socket.io/Django Channels)                │
│  └─ Background Jobs (Bull/Celery)                               │
│                                                                  │
│  AI/ML Services                                                  │
│  ├─ JEDI Score Engine (Python)                                  │
│  ├─ Strategy Analyzer (Python)                                  │
│  ├─ Agent Orchestrator (LangChain)                              │
│  └─ Market Data Processor                                       │
│                                                                  │
│  Integration Services                                            │
│  ├─ Google Places API                                           │
│  ├─ Mapbox API                                                  │
│  ├─ Municode Scraper                                            │
│  ├─ CoStar API (market data)                                    │
│  ├─ Email Service (IMAP/SMTP)                                   │
│  └─ Payment Gateway (Stripe)                                    │
└─────────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                 │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL (primary database)                                   │
│  ├─ Users, deals, properties, modules                           │
│  ├─ PostGIS extension (geospatial)                              │
│  └─ Full-text search (pg_trgm)                                  │
│                                                                  │
│  Redis (caching & sessions)                                      │
│  ├─ Session store                                               │
│  ├─ API response cache                                          │
│  └─ WebSocket pub/sub                                           │
│                                                                  │
│  S3/Object Storage (files)                                       │
│  ├─ User uploads (docs, images)                                 │
│  ├─ Generated reports                                           │
│  └─ Map annotations/drawings                                    │
│                                                                  │
│  Elasticsearch (optional)                                        │
│  └─ Advanced search & analytics                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Deployment Architecture:**

```
Production Environment:
├─ Load Balancer (AWS ALB / Cloudflare)
├─ Web Servers (3+ instances, auto-scaling)
├─ API Servers (5+ instances, auto-scaling)
├─ WebSocket Servers (2+ instances, sticky sessions)
├─ Background Workers (3+ instances)
├─ Database (PostgreSQL RDS Multi-AZ)
├─ Cache (Redis ElastiCache cluster)
└─ Storage (S3 with CloudFront CDN)

Monitoring & Observability:
├─ Logging: Structured logs → Elasticsearch → Kibana
├─ Metrics: Prometheus → Grafana
├─ Tracing: OpenTelemetry → Jaeger
├─ Error Tracking: Sentry
└─ Uptime Monitoring: Better Uptime / Pingdom
```
```

---

### 2. **Authentication & Authorization Missing**

**Issue:** No auth strategy documented.

**Recommendation:**

```markdown
### Authentication & Authorization

**Authentication Strategy:**

1. **JWT-based Auth**
   ```javascript
   // Login flow
   POST /api/v1/auth/login
   {
     "email": "user@example.com",
     "password": "********"
   }
   
   Response:
   {
     "access_token": "eyJhbGc...",  // 15 min expiry
     "refresh_token": "eyJhbGc...", // 7 day expiry
     "user": { ... }
   }
   
   // Refresh flow
   POST /api/v1/auth/refresh
   {
     "refresh_token": "eyJhbGc..."
   }
   ```

2. **OAuth2 Providers (optional)**
   - Google OAuth
   - Microsoft OAuth
   - LinkedIn OAuth

3. **Session Management**
   ```sql
   CREATE TABLE user_sessions (
     id UUID PRIMARY KEY,
     user_id UUID REFERENCES users(id),
     token_hash VARCHAR(64), -- SHA256 of refresh token
     device_info JSONB,
     ip_address INET,
     last_active_at TIMESTAMP,
     expires_at TIMESTAMP,
     created_at TIMESTAMP
   );
   ```

**Authorization Strategy:**

**Role-Based Access Control (RBAC):**

```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY,
  name VARCHAR(50) UNIQUE, -- 'owner', 'admin', 'member', 'viewer'
  permissions JSONB
);

CREATE TABLE user_roles (
  user_id UUID REFERENCES users(id),
  role_id UUID REFERENCES roles(id),
  resource_type VARCHAR(50), -- 'account', 'deal', 'team'
  resource_id UUID,
  PRIMARY KEY (user_id, role_id, resource_type, resource_id)
);
```

**Permission Matrix:**

| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| Create Deal | ✅ | ✅ | ✅ | ❌ |
| Edit Deal | ✅ | ✅ | ✅ | ❌ |
| Delete Deal | ✅ | ✅ | ❌ | ❌ |
| View Deal | ✅ | ✅ | ✅ | ✅ |
| Invite Team | ✅ | ✅ | ❌ | ❌ |
| Purchase Module | ✅ | ❌ | ❌ | ❌ |
| Manage Billing | ✅ | ❌ | ❌ | ❌ |

**Middleware Example:**
```javascript
// Check permission middleware
const checkPermission = (action, resourceType) => {
  return async (req, res, next) => {
    const userId = req.user.id;
    const resourceId = req.params.id;
    
    const hasPermission = await authService.checkPermission(
      userId,
      action,
      resourceType,
      resourceId
    );
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    next();
  };
};

// Usage
router.delete('/deals/:id', 
  authenticateToken,
  checkPermission('delete', 'deal'),
  dealController.delete
);
```
```

---

### 3. **Data Privacy & Compliance**

**Issue:** No mention of GDPR, data privacy, or user data handling.

**Recommendation:**

```markdown
### Data Privacy & Compliance

**GDPR Compliance:**

1. **User Data Portability**
   ```
   GET /api/v1/user/data-export
   
   Response:
   - Generates ZIP file with all user data
   - JSON format (machine-readable)
   - Includes: deals, properties, maps, notes, emails
   - Async job (large datasets)
   ```

2. **Right to be Forgotten**
   ```sql
   -- Soft delete user
   ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP;
   ALTER TABLE users ADD COLUMN deletion_reason TEXT;
   
   -- Anonymize user data instead of hard delete
   UPDATE users SET
     email = CONCAT('deleted_', id, '@example.com'),
     first_name = 'Deleted',
     last_name = 'User',
     phone = NULL,
     deleted_at = NOW()
   WHERE id = $1;
   
   -- Cascade to related data
   UPDATE deals SET owner_id = NULL WHERE owner_id = $1;
   DELETE FROM user_sessions WHERE user_id = $1;
   ```

3. **Data Processing Agreement (DPA)**
   - Document how user data is processed
   - Third-party data sharing disclosure
   - User consent management

4. **Cookie Consent**
   ```javascript
   // Cookie categories
   const cookieCategories = {
     essential: true,      // Required for auth
     analytics: false,     // Google Analytics (user opt-in)
     marketing: false,     // Marketing cookies (user opt-in)
     preferences: true     // UI preferences (no PII)
   };
   ```

**Sensitive Data Handling:**

```sql
-- Encrypt sensitive fields
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE deals ADD COLUMN asking_price_encrypted BYTEA;
ALTER TABLE deals ADD COLUMN financials_encrypted BYTEA;

-- Encrypt data
UPDATE deals SET asking_price_encrypted = 
  pgp_sym_encrypt(asking_price::TEXT, current_setting('app.encryption_key'));

-- Decrypt data
SELECT pgp_sym_decrypt(asking_price_encrypted, 
  current_setting('app.encryption_key'))::NUMERIC as asking_price
FROM deals;
```

**Audit Logging:**

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(50), -- 'create', 'read', 'update', 'delete'
  resource_type VARCHAR(50),
  resource_id UUID,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
```
```

---

## Database Schema Enhancements

### 1. **Missing Indexes**

**Issue:** Database schema lacks performance indexes.

**Recommendation:**

```sql
-- Deals table indexes
CREATE INDEX idx_deals_owner ON deals(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_deals_stage ON deals(deal_stage);
CREATE INDEX idx_deals_category ON deals(category);
CREATE INDEX idx_deals_created_at ON deals(created_at DESC);
CREATE INDEX idx_deals_updated_at ON deals(updated_at DESC);
CREATE INDEX idx_deals_location ON deals USING GIST(location); -- PostGIS

-- Properties table indexes
CREATE INDEX idx_properties_deal ON properties(deal_id);
CREATE INDEX idx_properties_location ON properties USING GIST(location);
CREATE INDEX idx_properties_building_class ON properties(building_class);
CREATE INDEX idx_properties_lease_expiration ON properties(lease_expiration);

-- User modules indexes
CREATE INDEX idx_user_modules_user_enabled ON user_modules(user_id) WHERE is_enabled = true;
CREATE INDEX idx_user_modules_module ON user_modules(module_id);
CREATE INDEX idx_user_modules_last_used ON user_modules(user_id, last_used_at DESC);

-- Deal modules indexes
CREATE INDEX idx_deal_modules_deal_position ON deal_modules(deal_id, position);
CREATE INDEX idx_deal_modules_module ON deal_modules(module_id);

-- Custom strategies indexes
CREATE INDEX idx_custom_strategies_user_active ON custom_strategies(user_id) WHERE is_active = true;
CREATE INDEX idx_custom_strategies_public ON custom_strategies(is_public) WHERE is_public = true;

-- Full-text search
CREATE INDEX idx_deals_search ON deals USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));
CREATE INDEX idx_properties_search ON properties USING GIN(to_tsvector('english', address || ' ' || COALESCE(notes, '')));
```

---

### 2. **Missing Cascade Rules**

**Issue:** Delete behavior not specified.

**Recommendation:**

```sql
-- Update foreign keys with proper cascade rules

-- Deals: When user deleted, keep deals but anonymize
ALTER TABLE deals DROP CONSTRAINT deals_owner_id_fkey;
ALTER TABLE deals ADD CONSTRAINT deals_owner_id_fkey 
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;

-- Deal modules: Delete when deal deleted
ALTER TABLE deal_modules DROP CONSTRAINT deal_modules_deal_id_fkey;
ALTER TABLE deal_modules ADD CONSTRAINT deal_modules_deal_id_fkey 
  FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;

-- User modules: Delete when user deleted
ALTER TABLE user_modules DROP CONSTRAINT user_modules_user_id_fkey;
ALTER TABLE user_modules ADD CONSTRAINT user_modules_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Custom strategies: Delete when user deleted
ALTER TABLE custom_strategies DROP CONSTRAINT custom_strategies_user_id_fkey;
ALTER TABLE custom_strategies ADD CONSTRAINT custom_strategies_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
```

---

### 3. **Missing Tables**

**Issue:** Several features implied but tables missing.

**Recommendation:**

```sql
-- Properties table (mentioned but not defined)
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  
  -- Address
  address TEXT NOT NULL,
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(20),
  country VARCHAR(50) DEFAULT 'USA',
  location GEOGRAPHY(POINT), -- PostGIS: lat/lng
  
  -- Property details
  building_class VARCHAR(10), -- 'A+', 'A', 'B+', 'B', 'C+'
  year_built INTEGER,
  unit_number VARCHAR(50),
  beds INTEGER,
  baths NUMERIC(3,1),
  square_feet INTEGER,
  parking_spaces INTEGER,
  
  -- Financial
  current_rent NUMERIC(10,2),
  market_rent NUMERIC(10,2),
  rent_gap NUMERIC(10,2) GENERATED ALWAYS AS (market_rent - current_rent) STORED,
  
  -- Lease
  lease_start DATE,
  lease_expiration DATE,
  renewal_status VARCHAR(20), -- 'active', 'expiring', 'renewing', 'vacating'
  
  -- Scoring
  comparable_score INTEGER, -- 0-100
  negotiation_power INTEGER, -- 0-100
  
  -- Metadata
  amenities JSONB,
  notes TEXT,
  documents JSONB,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Comments (for collaboration)
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  resource_type VARCHAR(50), -- 'deal', 'property', 'map'
  resource_id UUID,
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  mentions JSONB, -- Array of user IDs mentioned
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX idx_comments_resource ON comments(resource_type, resource_id, created_at);
CREATE INDEX idx_comments_user ON comments(user_id);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50), -- 'mention', 'deal_update', 'analysis_complete', 'module_trial_expiring'
  title VARCHAR(200),
  message TEXT,
  link VARCHAR(500),
  is_read BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, created_at) WHERE is_read = false;

-- Activity Feed
CREATE TABLE activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  action VARCHAR(50), -- 'created', 'updated', 'analyzed', 'stage_changed'
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activity_feed_deal ON activity_feed(deal_id, created_at DESC);
CREATE INDEX idx_activity_feed_user ON activity_feed(user_id, created_at DESC);

-- Teams
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE team_members (
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50), -- 'owner', 'admin', 'member', 'viewer'
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE deal_team (
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50), -- 'broker', 'lender', 'equity', 'pm', 'legal', 'architect'
  status VARCHAR(20), -- 'active', 'inactive'
  contact_info JSONB,
  PRIMARY KEY (deal_id, user_id, role)
);

-- Tags
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(50) UNIQUE NOT NULL,
  color VARCHAR(7), -- Hex color
  use_count INTEGER DEFAULT 0
);

CREATE TABLE deal_tags (
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (deal_id, tag_id)
);

-- Custom Maps
CREATE TABLE custom_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  is_public BOOLEAN DEFAULT false,
  
  -- Map data
  annotations JSONB, -- GeoJSON FeatureCollection
  settings JSONB, -- Opacity, blend mode, etc.
  
  position INTEGER, -- Order in horizontal bar
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_custom_maps_user_position ON custom_maps(user_id, position);

-- Map Shares
CREATE TABLE map_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID REFERENCES custom_maps(id) ON DELETE CASCADE,
  share_token VARCHAR(64) UNIQUE,
  permissions VARCHAR(20), -- 'view', 'comment', 'edit'
  expires_at TIMESTAMP,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tasks (for deal checklists)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  
  title VARCHAR(200) NOT NULL,
  description TEXT,
  due_date DATE,
  priority VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
  stage VARCHAR(50), -- Associated pipeline stage
  
  completed_at TIMESTAMP,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tasks_deal ON tasks(deal_id, status, due_date);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to, status, due_date);
```

---

### 4. **Data Validation Constraints**

**Issue:** No CHECK constraints for data validation.

**Recommendation:**

```sql
-- Deals table constraints
ALTER TABLE deals ADD CONSTRAINT check_asking_price_positive 
  CHECK (asking_price IS NULL OR asking_price > 0);

ALTER TABLE deals ADD CONSTRAINT check_occupancy_rate_valid 
  CHECK (occupancy_rate IS NULL OR (occupancy_rate >= 0 AND occupancy_rate <= 100));

ALTER TABLE deals ADD CONSTRAINT check_cap_rate_valid 
  CHECK (cap_rate IS NULL OR (cap_rate >= 0 AND cap_rate <= 100));

ALTER TABLE deals ADD CONSTRAINT check_construction_dates 
  CHECK (construction_start IS NULL OR construction_end IS NULL OR construction_end >= construction_start);

-- Properties table constraints
ALTER TABLE properties ADD CONSTRAINT check_rent_positive 
  CHECK (current_rent IS NULL OR current_rent >= 0);

ALTER TABLE properties ADD CONSTRAINT check_beds_valid 
  CHECK (beds IS NULL OR beds >= 0);

ALTER TABLE properties ADD CONSTRAINT check_baths_valid 
  CHECK (baths IS NULL OR baths >= 0);

ALTER TABLE properties ADD CONSTRAINT check_sqft_positive 
  CHECK (square_feet IS NULL OR square_feet > 0);

ALTER TABLE properties ADD CONSTRAINT check_lease_dates 
  CHECK (lease_start IS NULL OR lease_expiration IS NULL OR lease_expiration >= lease_start);

-- Module pricing constraints
ALTER TABLE modules ADD CONSTRAINT check_price_valid 
  CHECK ((is_free = true AND price_monthly = 0) OR (is_free = false AND price_monthly > 0));

-- Custom strategies constraints
ALTER TABLE custom_strategies ADD CONSTRAINT check_hold_period_valid 
  CHECK (hold_period_min IS NULL OR hold_period_target IS NULL OR hold_period_max IS NULL 
    OR (hold_period_min <= hold_period_target AND hold_period_target <= hold_period_max));

ALTER TABLE custom_strategies ADD CONSTRAINT check_confidence_threshold_valid 
  CHECK (confidence_threshold >= 0 AND confidence_threshold <= 100);
```

---

## API Design Improvements

### 1. **Missing API Specifications**

**Issue:** Endpoints listed but no request/response schemas, error codes, or pagination.

**Recommendation:**

```markdown
### Complete API Specification

**API Versioning:**
- Base URL: `https://api.jedire.com/v1`
- Version in URL path (not header)
- Deprecation policy: 6 months notice

**Authentication:**
```http
Authorization: Bearer <access_token>
```

**Standard Response Format:**

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-02-07T10:30:00Z",
    "request_id": "req_abc123"
  }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "asking_price",
        "message": "Must be a positive number"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-02-07T10:30:00Z",
    "request_id": "req_abc123"
  }
}
```

**Standard Error Codes:**

| HTTP Code | Error Code | Description |
|-----------|-----------|-------------|
| 400 | VALIDATION_ERROR | Invalid request data |
| 401 | UNAUTHORIZED | Missing or invalid token |
| 403 | FORBIDDEN | Insufficient permissions |
| 404 | NOT_FOUND | Resource not found |
| 409 | CONFLICT | Resource conflict (e.g., duplicate) |
| 422 | UNPROCESSABLE_ENTITY | Valid syntax but logical error |
| 429 | RATE_LIMIT_EXCEEDED | Too many requests |
| 500 | INTERNAL_ERROR | Server error |
| 503 | SERVICE_UNAVAILABLE | Temporary unavailability |

---

### Pagination

**Query Parameters:**
```
GET /api/v1/deals?page=2&limit=25&sort=-created_at
```

**Response:**
```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "pagination": {
      "current_page": 2,
      "per_page": 25,
      "total_pages": 10,
      "total_count": 237,
      "has_next": true,
      "has_prev": true
    },
    "links": {
      "first": "/api/v1/deals?page=1&limit=25",
      "prev": "/api/v1/deals?page=1&limit=25",
      "next": "/api/v1/deals?page=3&limit=25",
      "last": "/api/v1/deals?page=10&limit=25"
    }
  }
}
```

---

### Detailed Endpoint Specifications

**Example: Create Deal**

```http
POST /api/v1/deals
Content-Type: application/json
Authorization: Bearer <token>

Request Body:
{
  "name": "Buckhead Mixed-Use Development",
  "address": "3350 Peachtree Rd NE, Atlanta, GA 30326",
  "category": "pipeline",
  "deal_type": "development",
  "asset_class": "multifamily",
  "development_type": "ground_up",
  "strategies": ["build_to_sell", "rental"],
  "asking_price": 52500000,
  "land_area_acres": 228.3,
  "zoning": "RG-3",
  "proposed_units": 240,
  "tags": ["off_market", "value_add"],
  "priority": "high",
  "auto_analyze": true,
  "modules": [
    "financial_modeling",
    "dev_budget",
    "construction_timeline",
    "strategy_arbitrage"
  ]
}

Response (201 Created):
{
  "success": true,
  "data": {
    "id": "deal_abc123",
    "name": "Buckhead Mixed-Use Development",
    "slug": "buckhead-mixed-use-development",
    "category": "pipeline",
    "deal_stage": "prospecting",
    "deal_type": "development",
    "address": "3350 Peachtree Rd NE, Atlanta, GA 30326",
    "location": {
      "lat": 33.8490,
      "lng": -84.3719
    },
    "asset_class": "multifamily",
    "asking_price": 52500000,
    "jedi_score": null,
    "analysis_status": "pending",
    "created_at": "2026-02-07T10:30:00Z",
    "updated_at": "2026-02-07T10:30:00Z",
    "modules": [
      {
        "id": "mod_financial",
        "slug": "financial_modeling",
        "name": "Financial Modeling",
        "position": 1
      },
      ...
    ]
  },
  "meta": {
    "timestamp": "2026-02-07T10:30:00Z",
    "request_id": "req_abc123"
  }
}

Validation Errors (400):
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "asking_price",
        "message": "Must be a positive number",
        "value": -100000
      },
      {
        "field": "strategies",
        "message": "At least one strategy required"
      }
    ]
  }
}
```

**Example: List Deals with Filters**

```http
GET /api/v1/deals?
  category=pipeline&
  deal_stage=due_diligence&
  asset_class=multifamily&
  min_price=1000000&
  max_price=10000000&
  tags=off_market&
  sort=-updated_at&
  page=1&
  limit=25

Response (200 OK):
{
  "success": true,
  "data": [
    {
      "id": "deal_abc123",
      "name": "Buckhead Deal",
      "category": "pipeline",
      "deal_stage": "due_diligence",
      "asking_price": 5250000,
      "jedi_score": 72,
      "created_at": "2026-02-07T10:30:00Z"
    },
    ...
  ],
  "meta": {
    "pagination": { ... },
    "filters_applied": {
      "category": "pipeline",
      "deal_stage": "due_diligence",
      "asset_class": "multifamily",
      "price_range": [1000000, 10000000],
      "tags": ["off_market"]
    }
  }
}
```

**Example: Run Deal Analysis**

```http
POST /api/v1/deals/{dealId}/analyze
Authorization: Bearer <token>

Request Body (optional):
{
  "recalculate": true,
  "include_components": ["capacity", "market", "quality", "location"],
  "notify_on_complete": true
}

Response (202 Accepted):
{
  "success": true,
  "data": {
    "analysis_id": "analysis_xyz789",
    "status": "processing",
    "estimated_completion_seconds": 30,
    "progress_url": "/api/v1/analyses/analysis_xyz789"
  }
}

Get Analysis Status:
GET /api/v1/analyses/analysis_xyz789

Response (200 OK - Processing):
{
  "success": true,
  "data": {
    "id": "analysis_xyz789",
    "deal_id": "deal_abc123",
    "status": "processing",
    "progress": 45,
    "current_step": "market_signals",
    "estimated_seconds_remaining": 15
  }
}

Response (200 OK - Complete):
{
  "success": true,
  "data": {
    "id": "analysis_xyz789",
    "deal_id": "deal_abc123",
    "status": "complete",
    "jedi_score": 72,
    "verdict": "OPPORTUNITY",
    "confidence": 85,
    "components": {
      "development_capacity": {
        "score": 28,
        "max": 30,
        "rating": "VERY_HIGH"
      },
      "market_signals": {
        "score": 22,
        "max": 30,
        "rating": "HIGH"
      },
      "quality": {
        "score": 14,
        "max": 20,
        "rating": "GOOD"
      },
      "location": {
        "score": 8,
        "max": 20,
        "rating": "MODERATE"
      }
    },
    "estimates": {
      "units": 240,
      "cost": 52800000,
      "timeline_months": 24,
      "units_per_acre": 1.05
    },
    "recommendations": [
      {
        "title": "Strong Development Opportunity",
        "description": "Site has excellent capacity...",
        "priority": "high"
      },
      ...
    ],
    "completed_at": "2026-02-07T10:31:15Z"
  }
}
```
```

---

### 2. **Rate Limiting**

**Issue:** No rate limiting strategy specified.

**Recommendation:**

```markdown
### Rate Limiting Strategy

**Limits by Tier:**

| Tier | Requests/Minute | Burst | Analysis/Hour | WebSocket Connections |
|------|-----------------|-------|---------------|----------------------|
| Basic | 60 | 100 | 10 | 3 |
| Pro | 300 | 500 | 50 | 10 |
| Enterprise | 1000 | 2000 | Unlimited | 50 |

**Response Headers:**
```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 245
X-RateLimit-Reset: 1675780800
```

**Rate Limit Exceeded (429):**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "API rate limit exceeded",
    "retry_after": 35
  }
}
```

**Implementation:**
- Use Redis for distributed rate limiting
- Algorithm: Token bucket or sliding window
- Bypass for internal services via API keys
```

---

### 3. **API Documentation**

**Issue:** No mention of how API will be documented.

**Recommendation:**

```markdown
### API Documentation Strategy

**Tools:**
- OpenAPI/Swagger 3.0 specification
- Interactive docs: Swagger UI or Redoc
- Hosted at: https://api.jedire.com/docs

**Generate from Code:**
```typescript
// Using TypeScript + Zod for validation & docs
import { z } from 'zod';

export const CreateDealSchema = z.object({
  name: z.string().min(3).max(100).describe('Deal name'),
  address: z.string().describe('Property address'),
  category: z.enum(['portfolio', 'pipeline']),
  asking_price: z.number().positive().optional().describe('Asking price in USD'),
  // ... more fields
});

export type CreateDealRequest = z.infer<typeof CreateDealSchema>;

// Auto-generate OpenAPI spec from schemas
```

**Developer Experience:**
- Code examples in multiple languages (cURL, JavaScript, Python)
- Postman collection export
- SDKs (later): JavaScript/TypeScript, Python
- Webhooks documentation (for future)
```

---

## Feature Completeness

### 1. **Missing Critical Features**

**Issue:** Some essential SaaS features not mentioned.

**Recommendation: Add These Features**

```markdown
### Missing Features to Add

**1. Billing & Subscription Management**

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan VARCHAR(50), -- 'basic', 'pro', 'enterprise'
  status VARCHAR(20), -- 'active', 'cancelled', 'past_due', 'trialing'
  
  trial_ends_at TIMESTAMP,
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT false,
  
  stripe_customer_id VARCHAR(100),
  stripe_subscription_id VARCHAR(100),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  subscription_id UUID REFERENCES subscriptions(id),
  
  amount_due INTEGER, -- cents
  amount_paid INTEGER,
  status VARCHAR(20), -- 'draft', 'open', 'paid', 'void'
  
  invoice_pdf VARCHAR(500), -- URL to Stripe invoice
  stripe_invoice_id VARCHAR(100),
  
  due_date DATE,
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**UI Components:**
- Billing page: Current plan, usage, invoices
- Upgrade/downgrade flows
- Payment method management
- Usage alerts (approaching limits)

**2. Email Integration (Missing Details)**

```sql
CREATE TABLE email_accounts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email_address VARCHAR(255) UNIQUE,
  
  provider VARCHAR(50), -- 'gmail', 'outlook', 'imap'
  
  -- OAuth tokens (encrypted)
  access_token_encrypted BYTEA,
  refresh_token_encrypted BYTEA,
  
  -- IMAP settings (if custom)
  imap_host VARCHAR(100),
  imap_port INTEGER,
  imap_username VARCHAR(100),
  imap_password_encrypted BYTEA,
  
  last_sync_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE emails (
  id UUID PRIMARY KEY,
  email_account_id UUID REFERENCES email_accounts(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  
  message_id VARCHAR(255), -- Email Message-ID header
  thread_id VARCHAR(255),
  
  from_email VARCHAR(255),
  from_name VARCHAR(255),
  to_emails JSONB, -- Array
  cc_emails JSONB,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  
  has_attachments BOOLEAN DEFAULT false,
  attachments JSONB,
  
  received_at TIMESTAMP,
  is_read BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_emails_account_received ON emails(email_account_id, received_at DESC);
CREATE INDEX idx_emails_deal ON emails(deal_id);
CREATE INDEX idx_emails_search ON emails USING GIN(to_tsvector('english', subject || ' ' || body_text));
```

**Email Features:**
- OAuth2 connection to Gmail/Outlook
- Auto-link emails to deals by address/keywords
- AI-powered email categorization
- Email templates (offer letters, LOIs)
- Bulk email to multiple contacts

**3. Export & Reporting**

- PDF reports with company branding
- Excel exports with multiple sheets
- Scheduled reports (weekly/monthly)
- Report templates library
- Custom report builder (drag-drop fields)

**4. Data Import**

```markdown
### Import Flows

**CSV Import:**
- Properties (rent roll)
- Deals (from other CRM)
- Contacts (team members, brokers)
- Market data

**Validation:**
- Preview before import
- Show errors/warnings
- Allow field mapping
- Skip invalid rows or abort

**Example:**
```
┌──────────────────────────────────────────────────────────────┐
│ Import Properties from CSV                               [X] │
├──────────────────────────────────────────────────────────────┤
│ [📁 Choose File] rent_roll.csv (uploaded)                   │
│                                                              │
│ Preview (first 5 rows):                                      │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Address        │ Unit │ Rent  │ Beds │ Lease End       ││
│ ├──────────────────────────────────────────────────────────┤│
│ │ 100 Peachtree  │ 101  │ 2100  │ 2    │ 2026-03-15      ││
│ │ 100 Peachtree  │ 102  │ 2300  │ 2    │ 2026-06-30      ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ Map columns:                                                 │
│ CSV Column       → Database Field                           │
│ Address          → address ✓                                │
│ Unit             → unit_number ✓                            │
│ Rent             → current_rent ✓                           │
│ Beds             → beds ✓                                   │
│ Lease End        → lease_expiration ✓                       │
│                                                              │
│ [Cancel]                           [Import 247 Properties]  │
└──────────────────────────────────────────────────────────────┘
```

**5. Collaboration Enhancements**

- @mentions in comments → notifications
- Task assignments with due dates
- Real-time presence (who's viewing deal)
- Activity timeline per deal
- Deal sharing links (external)
```

---

### 2. **Module Suggestions**

**Issue:** 27 modules listed but some obvious ones missing.

**Recommended Additional Modules:**

```markdown
### Additional Module Ideas

**Financial Category:**
1. **Waterfall Calculator** - LP/GP distributions
2. **Sensitivity Analysis** - Stress testing variables
3. **Amortization Schedule** - Detailed loan payments

**Operations:**
4. **Property Management** - Maintenance requests, tenant portal
5. **Lease Tracking** - Digital lease storage, alerts
6. **Vendor Management** - Contractors, quotes, payments

**Marketing:**
7. **Virtual Tours** - 3D walkthrough integration
8. **Marketing Materials** - Brochure generator
9. **Social Media** - Auto-post listings

**Legal/Compliance:**
10. **Contract Management** - E-signatures, templates
11. **Compliance Tracker** - Permits, inspections
12. **Insurance Tracker** - Policy renewals, claims

**Advanced:**
13. **Predictive Analytics** - ML-based forecasting
14. **Portfolio Optimizer** - Asset allocation recommendations
15. **1031 Exchange Tracker** - Timeline management
```

---

## Implementation Challenges

### 1. **Map Rendering Performance**

**Challenge:** Mapbox GL JS can struggle with:
- 10,000+ property markers
- Complex polygons (deals with 1000+ vertices)
- Multiple custom map layers simultaneously
- Real-time collaboration updates

**Solutions:**

```markdown
### Map Performance Optimization

**1. Clustering (already mentioned)**

**2. Polygon Simplification**
```javascript
// Use Turf.js to simplify complex polygons
import * as turf from '@turf/turf';

function simplifyBoundary(geoJSON, zoomLevel) {
  // More aggressive simplification at lower zoom levels
  const tolerance = zoomLevel < 12 ? 0.001 : 0.0001;
  return turf.simplify(geoJSON, { tolerance, highQuality: false });
}
```

**3. Layer Caching**
- Cache rendered tiles in browser IndexedDB
- Serve static map tiles from CDN for custom maps
- Pre-render common map views server-side

**4. WebGL Custom Layers**
```javascript
// Use Mapbox GL custom layer for very large datasets
const propertyLayer = {
  id: 'properties-webgl',
  type: 'custom',
  renderingMode: '3d',
  onAdd(map, gl) {
    // Initialize WebGL buffers
  },
  render(gl, matrix) {
    // Render 100k+ points efficiently
  }
};
```

**5. Progressive Loading Strategy**
```javascript
// Load critical data first
async function loadMapData(viewport) {
  // 1. Load deal boundaries (high priority)
  const deals = await fetchDeals(viewport);
  renderDeals(deals);
  
  // 2. Load property clusters (medium priority)
  const clusters = await fetchPropertyClusters(viewport);
  renderClusters(clusters);
  
  // 3. Load custom maps (low priority)
  const customMaps = await fetchCustomMaps(viewport);
  renderCustomMaps(customMaps);
  
  // 4. Lazy load details on interaction
}
```

**6. Backend Spatial Optimization**
```sql
-- Use PostGIS spatial indexes
CREATE INDEX idx_deals_location ON deals USING GIST(location);
CREATE INDEX idx_properties_location ON properties USING GIST(location);

-- Bounding box queries
SELECT * FROM properties
WHERE location && ST_MakeEnvelope(-84.5, 33.7, -84.3, 33.9, 4326);

-- Clustering query (for map tiles)
SELECT 
  ST_ClusterKMeans(location, 50) OVER () AS cluster_id,
  COUNT(*) as property_count,
  ST_Centroid(ST_Collect(location)) as center
FROM properties
WHERE location && $1
GROUP BY cluster_id;
```
```

---

### 2. **AI Agent Coordination Complexity**

**Challenge:** 4 specialist agents + orchestrator requires complex state management.

**Solutions:**

```markdown
### Agent Architecture

**Use LangGraph for State Management:**

```python
from langgraph.graph import StateGraph, END

# Define agent state
class DealAnalysisState:
    deal_id: str
    deal_data: dict
    market_data: dict | None = None
    capacity_data: dict | None = None
    financial_data: dict | None = None
    risk_data: dict | None = None
    jedi_score: int | None = None
    status: str = "pending"

# Define workflow graph
workflow = StateGraph(DealAnalysisState)

# Add agent nodes
workflow.add_node("market_agent", market_agent_task)
workflow.add_node("development_agent", development_agent_task)
workflow.add_node("financial_agent", financial_agent_task)
workflow.add_node("risk_agent", risk_agent_task)
workflow.add_node("orchestrator", orchestrator_task)

# Define edges (execution flow)
workflow.add_edge("market_agent", "orchestrator")
workflow.add_edge("development_agent", "orchestrator")
workflow.add_edge("financial_agent", "orchestrator")
workflow.add_edge("risk_agent", "orchestrator")
workflow.add_edge("orchestrator", END)

# Set entry point
workflow.set_entry_point("market_agent")
workflow.set_entry_point("development_agent")  # Parallel execution
workflow.set_entry_point("financial_agent")
workflow.set_entry_point("risk_agent")

# Compile
app = workflow.compile()

# Execute
result = await app.ainvoke({
    "deal_id": "deal_abc123",
    "deal_data": {...}
})
```

**Task Queue for Reliability:**
```python
# Use Celery for background tasks
from celery import group, chain

@celery.task
def analyze_deal(deal_id):
    # Create agent tasks
    agent_tasks = group([
        market_agent_task.s(deal_id),
        development_agent_task.s(deal_id),
        financial_agent_task.s(deal_id),
        risk_agent_task.s(deal_id)
    ])
    
    # Chain: agents → orchestrator → save results
    workflow = chain(
        agent_tasks,
        orchestrator_task.s(),
        save_analysis_results.s(deal_id)
    )
    
    return workflow.apply_async()
```

**WebSocket Progress Updates:**
```python
# Emit progress to client
async def market_agent_task(deal_id):
    await emit_progress(deal_id, "market_agent", "started", 0)
    
    # Fetch market data
    await emit_progress(deal_id, "market_agent", "fetching_data", 25)
    market_data = await fetch_market_data(deal_id)
    
    # Analyze
    await emit_progress(deal_id, "market_agent", "analyzing", 50)
    analysis = await analyze_market(market_data)
    
    await emit_progress(deal_id, "market_agent", "complete", 100)
    
    return analysis
```
```

---

### 3. **Module Marketplace Billing Complexity**

**Challenge:** Users can add/remove modules mid-billing cycle, creating prorated billing complexity.

**Solutions:**

```markdown
### Proration Strategy

**Use Stripe Subscription Items:**
```python
import stripe

# When user adds a module
def add_module_to_subscription(user_id, module_id):
    subscription = get_user_subscription(user_id)
    module = get_module(module_id)
    
    # Add subscription item (Stripe handles proration automatically)
    stripe.SubscriptionItem.create(
        subscription=subscription.stripe_subscription_id,
        price=module.stripe_price_id,
        proration_behavior='create_prorations'  # Charge immediately
    )
    
    # Record in database
    UserModule.create(
        user_id=user_id,
        module_id=module_id,
        subscription_status='active',
        subscription_ends_at=subscription.current_period_end
    )

# When user removes a module
def remove_module_from_subscription(user_id, module_id):
    user_module = get_user_module(user_id, module_id)
    subscription = get_user_subscription(user_id)
    
    # Remove at end of billing period (no refund mid-cycle)
    stripe.SubscriptionItem.modify(
        user_module.stripe_subscription_item_id,
        proration_behavior='none',
        cancel_at_period_end=True
    )
    
    # Update database
    user_module.update(cancel_at_period_end=True)
```

**Usage-Based Billing (for advanced modules):**
```python
# Track module usage
class ModuleUsage:
    user_id: UUID
    module_id: UUID
    usage_type: str  # 'api_call', 'analysis_run', 'report_generated'
    quantity: int
    created_at: datetime

# Report usage to Stripe at end of billing period
def report_usage_to_stripe(user_id, billing_period):
    usage = get_module_usage(user_id, billing_period)
    
    for module_id, quantity in usage.items():
        stripe.SubscriptionItem.create_usage_record(
            subscription_item_id,
            quantity=quantity,
            timestamp=int(time.time())
        )
```

**Trial Management:**
```sql
-- Automatic trial expiration check
CREATE OR REPLACE FUNCTION check_trial_expirations()
RETURNS void AS $$
BEGIN
    -- Mark expired trials
    UPDATE user_modules
    SET subscription_status = 'expired',
        is_enabled = false
    WHERE subscription_status = 'trial'
      AND trial_ends_at <= NOW();
    
    -- Notify users
    INSERT INTO notifications (user_id, type, title, message)
    SELECT um.user_id, 'trial_expired', 
           'Module Trial Expired',
           m.name || ' trial has ended. Subscribe to continue using it.'
    FROM user_modules um
    JOIN modules m ON m.id = um.module_id
    WHERE um.subscription_status = 'expired'
      AND um.trial_ends_at >= NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Run every hour via cron
SELECT cron.schedule('check-trial-expirations', '0 * * * *', 'SELECT check_trial_expirations()');
```
```

---

### 4. **Third-Party API Reliability**

**Challenge:** Platform depends on external APIs (Google Places, Municode, CoStar) that may be unreliable.

**Solutions:**

```markdown
### API Resilience Strategy

**1. Caching Layer**
```python
import redis
from functools import wraps
import hashlib

redis_client = redis.Redis()

def cache_api_response(ttl=3600):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = f"{func.__name__}:{hashlib.md5(str(args).encode()).hexdigest()}"
            
            # Check cache
            cached = redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
            
            # Call API
            result = await func(*args, **kwargs)
            
            # Store in cache
            redis_client.setex(cache_key, ttl, json.dumps(result))
            
            return result
        return wrapper
    return decorator

@cache_api_response(ttl=86400)  # Cache for 24 hours
async def fetch_google_places(address):
    response = await httpx.get(f"https://maps.googleapis.com/maps/api/geocode/json?address={address}")
    return response.json()
```

**2. Fallback Data Sources**
```python
async def get_property_data(address):
    # Try primary source (CoStar)
    try:
        return await fetch_from_costar(address)
    except Exception as e:
        logger.warning(f"CoStar failed: {e}")
        
        # Fallback to secondary (Zillow API)
        try:
            return await fetch_from_zillow(address)
        except Exception as e:
            logger.warning(f"Zillow failed: {e}")
            
            # Fallback to tertiary (scraping)
            try:
                return await scrape_property_data(address)
            except Exception as e:
                logger.error(f"All sources failed: {e}")
                
                # Return cached data (even if stale)
                return get_cached_property_data(address) or None
```

**3. Circuit Breaker Pattern**
```python
from pybreaker import CircuitBreaker

# Configure circuit breaker
municode_breaker = CircuitBreaker(
    fail_max=5,          # Open after 5 failures
    timeout_duration=60  # Stay open for 60 seconds
)

@municode_breaker
async def fetch_municode_data(jurisdiction):
    response = await httpx.get(f"https://municode.com/api/zoning/{jurisdiction}")
    if response.status_code != 200:
        raise Exception("Municode API error")
    return response.json()

# Usage
try:
    zoning_data = await fetch_municode_data("atlanta-ga")
except CircuitBreakerError:
    # Circuit is open, use cached data or show error
    zoning_data = get_cached_zoning_data("atlanta-ga")
```

**4. Webhook Fallback for Real-Time Data**
```python
# Instead of polling, register webhooks where possible
async def register_costar_webhook(user_id):
    webhook_url = f"https://api.jedire.com/webhooks/costar/{user_id}"
    
    await costar_api.register_webhook(
        url=webhook_url,
        events=['property.updated', 'market.data_refreshed']
    )

# Webhook handler
@app.post("/webhooks/costar/{user_id}")
async def costar_webhook(user_id: str, payload: dict):
    # Verify webhook signature
    verify_costar_signature(request.headers['X-CoStar-Signature'], payload)
    
    # Update cached data
    update_market_data_cache(payload)
    
    # Notify relevant users
    notify_users_of_market_update(user_id, payload)
    
    return {"status": "ok"}
```

**5. Rate Limit Management**
```python
from aiolimiter import AsyncLimiter

# Google Places: 1000 requests/day
google_limiter = AsyncLimiter(1000, 86400)

async def geocode_address(address):
    async with google_limiter:
        return await google_places_api.geocode(address)
```
```

---

## Best Practices

### 1. **Code Organization**

```markdown
### Recommended Project Structure

```
jedire/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── map/
│   │   │   │   ├── MapCanvas.tsx
│   │   │   │   ├── PropertyMarker.tsx
│   │   │   │   ├── DealBoundary.tsx
│   │   │   │   └── LayerControls.tsx
│   │   │   ├── deals/
│   │   │   │   ├── DealCard.tsx
│   │   │   │   ├── CreateDealWizard.tsx
│   │   │   │   └── DealModuleTabs.tsx
│   │   │   ├── modules/
│   │   │   │   ├── FinancialModeling.tsx
│   │   │   │   ├── StrategyArbitrage.tsx
│   │   │   │   └── ... (one per module)
│   │   │   └── shared/
│   │   │       ├── Button.tsx
│   │   │       ├── Modal.tsx
│   │   │       └── DataTable.tsx
│   │   ├── hooks/
│   │   │   ├── useDeals.ts
│   │   │   ├── useMap.ts
│   │   │   ├── useWebSocket.ts
│   │   │   └── useModules.ts
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   ├── websocket.ts
│   │   │   └── auth.ts
│   │   ├── store/
│   │   │   ├── dealsStore.ts
│   │   │   ├── mapStore.ts
│   │   │   └── authStore.ts
│   │   ├── types/
│   │   │   ├── Deal.ts
│   │   │   ├── Property.ts
│   │   │   └── Module.ts
│   │   └── utils/
│   │       ├── geocoding.ts
│   │       ├── formatting.ts
│   │       └── validation.ts
│   ├── package.json
│   └── tsconfig.json
│
├── backend/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── deals.py
│   │   │   ├── properties.py
│   │   │   ├── modules.py
│   │   │   └── auth.py
│   │   ├── middleware/
│   │   │   ├── auth.py
│   │   │   ├── rate_limit.py
│   │   │   └── error_handler.py
│   │   ├── schemas/
│   │   │   ├── deal.py
│   │   │   ├── property.py
│   │   │   └── module.py
│   │   └── services/
│   │       ├── deal_service.py
│   │       ├── analysis_service.py
│   │       └── billing_service.py
│   ├── agents/
│   │   ├── orchestrator.py
│   │   ├── market_agent.py
│   │   ├── development_agent.py
│   │   ├── financial_agent.py
│   │   └── risk_agent.py
│   ├── workers/
│   │   ├── analysis_worker.py
│   │   ├── email_sync_worker.py
│   │   └── report_generator.py
│   ├── models/
│   │   ├── deal.py
│   │   ├── property.py
│   │   ├── user.py
│   │   └── module.py
│   ├── migrations/
│   │   └── ... (Alembic migrations)
│   ├── tests/
│   │   ├── test_deals.py
│   │   ├── test_analysis.py
│   │   └── test_modules.py
│   ├── requirements.txt
│   └── pyproject.toml
│
├── database/
│   ├── schema.sql
│   ├── seeds/
│   │   ├── modules.sql
│   │   ├── sample_deals.sql
│   │   └── sample_users.sql
│   └── migrations/
│
├── infrastructure/
│   ├── docker/
│   │   ├── Dockerfile.frontend
│   │   ├── Dockerfile.backend
│   │   └── docker-compose.yml
│   ├── kubernetes/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── ingress.yaml
│   └── terraform/
│       ├── main.tf
│       ├── vpc.tf
│       └── rds.tf
│
├── docs/
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── MODULES.md
│   └── DEPLOYMENT.md
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── deploy-staging.yml
│       └── deploy-production.yml
│
└── README.md
```
```

---

### 2. **Testing Strategy**

```markdown
### Comprehensive Testing

**Test Pyramid:**
```
        /\
       /  \
      / E2E\     ← 10% (Critical user flows)
     /------\
    /        \
   /Integration\ ← 30% (API, database, external services)
  /------------\
 /              \
/      Unit      \ ← 60% (Business logic, utilities)
------------------
```

**Unit Tests:**
```python
# backend/tests/test_analysis.py
import pytest
from services.analysis_service import calculate_jedi_score

def test_jedi_score_calculation():
    deal_data = {
        "development_capacity": 28,
        "market_signals": 22,
        "quality": 14,
        "location": 8
    }
    
    score = calculate_jedi_score(deal_data)
    
    assert score == 72
    assert 0 <= score <= 100

def test_jedi_score_with_missing_data():
    deal_data = {
        "development_capacity": 28,
        "market_signals": None,  # Missing data
        "quality": 14,
        "location": 8
    }
    
    with pytest.raises(ValueError, match="Missing required component"):
        calculate_jedi_score(deal_data)
```

**Integration Tests:**
```python
# backend/tests/test_deals_api.py
import pytest
from fastapi.testclient import TestClient

@pytest.fixture
def authenticated_client():
    client = TestClient(app)
    # Login and get token
    response = client.post("/api/v1/auth/login", json={
        "email": "test@example.com",
        "password": "password123"
    })
    token = response.json()["access_token"]
    client.headers = {"Authorization": f"Bearer {token}"}
    return client

def test_create_deal(authenticated_client):
    response = authenticated_client.post("/api/v1/deals", json={
        "name": "Test Deal",
        "address": "123 Test St, Atlanta, GA",
        "category": "pipeline",
        "asking_price": 1000000
    })
    
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["name"] == "Test Deal"
    assert data["slug"] == "test-deal"

def test_create_deal_validation_error(authenticated_client):
    response = authenticated_client.post("/api/v1/deals", json={
        "name": "T",  # Too short
        "asking_price": -100  # Negative
    })
    
    assert response.status_code == 400
    assert "validation" in response.json()["error"]["code"].lower()
```

**E2E Tests:**
```javascript
// frontend/tests/e2e/create-deal.spec.ts
import { test, expect } from '@playwright/test';

test('user can create a deal', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  
  // Wait for dashboard
  await expect(page).toHaveURL('/dashboard');
  
  // Click Create Deal
  await page.click('button:has-text("Create Deal")');
  
  // Fill wizard
  await page.click('text=Pipeline');
  await page.click('button:has-text("Next")');
  
  await page.click('text=Existing Asset');
  await page.click('button:has-text("Next")');
  
  await page.fill('[name="address"]', '123 Peachtree St, Atlanta, GA');
  await page.click('button:has-text("Next")');
  
  // ... complete wizard
  
  await page.fill('[name="name"]', 'E2E Test Deal');
  await page.click('button:has-text("Create Deal")');
  
  // Verify deal created
  await expect(page).toHaveURL(/\/deals\/[a-z0-9-]+/);
  await expect(page.locator('h1')).toContainText('E2E Test Deal');
});
```

**Performance Tests:**
```python
# backend/tests/test_performance.py
import pytest
from locust import HttpUser, task, between

class DealUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        # Login
        response = self.client.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        self.token = response.json()["access_token"]
        self.client.headers = {"Authorization": f"Bearer {self.token}"}
    
    @task(3)
    def list_deals(self):
        self.client.get("/api/v1/deals?page=1&limit=25")
    
    @task(1)
    def create_deal(self):
        self.client.post("/api/v1/deals", json={
            "name": "Performance Test Deal",
            "address": "123 Test St",
            "asking_price": 1000000
        })
    
    @task(2)
    def get_deal(self):
        self.client.get("/api/v1/deals/test-deal-id")

# Run: locust -f test_performance.py --host=https://api.jedire.com
```
```

---

### 3. **Security Best Practices**

```markdown
### Security Checklist

**Authentication:**
- ✅ Use HTTPS only (enforce)
- ✅ Bcrypt for password hashing (cost factor 12+)
- ✅ JWT with short expiry (15 min access, 7 day refresh)
- ✅ Refresh token rotation
- ✅ Multi-factor authentication (optional, recommended)

**Authorization:**
- ✅ Role-based access control (RBAC)
- ✅ Check permissions on every API call
- ✅ Never trust client-side validation
- ✅ Use parameterized queries (prevent SQL injection)

**Data Protection:**
- ✅ Encrypt sensitive fields (asking_price, financials)
- ✅ Encrypt data in transit (TLS 1.3)
- ✅ Encrypt data at rest (RDS encryption)
- ✅ Secure file uploads (virus scan, size limits)

**API Security:**
- ✅ Rate limiting (prevent abuse)
- ✅ CORS policy (whitelist domains)
- ✅ Input validation (Zod/Pydantic schemas)
- ✅ Output sanitization (prevent XSS)
- ✅ API key rotation

**Infrastructure:**
- ✅ Secrets management (AWS Secrets Manager / Vault)
- ✅ Least privilege IAM roles
- ✅ WAF (Web Application Firewall)
- ✅ DDoS protection (Cloudflare)

**Monitoring:**
- ✅ Log all authentication attempts
- ✅ Alert on suspicious activity
- ✅ Regular security audits
- ✅ Dependency vulnerability scanning

**Example: SQL Injection Prevention**
```python
# ❌ VULNERABLE
query = f"SELECT * FROM deals WHERE id = '{deal_id}'"
cursor.execute(query)

# ✅ SAFE (parameterized)
query = "SELECT * FROM deals WHERE id = %s"
cursor.execute(query, (deal_id,))

# ✅ EVEN BETTER (ORM)
deal = Deal.query.filter_by(id=deal_id).first()
```

**Example: XSS Prevention**
```typescript
// ❌ VULNERABLE
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ✅ SAFE (React auto-escapes)
<div>{userInput}</div>

// ✅ SAFE (sanitize if HTML needed)
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />
```
```

---

## Additional Feature Recommendations

### 1. **Mobile App**

```markdown
### Mobile Strategy

**Phase 1: Progressive Web App (PWA)**
- Responsive design (works on mobile browsers)
- Offline support (service workers)
- Add to home screen
- Push notifications

**Phase 2: React Native App**
- Native iOS/Android apps
- Share codebase with web (80%+)
- Key features:
  - View deals on the go
  - Property photos with camera
  - Quick notes/voice memos
  - Location-based property search
  - Push notifications for deal updates

**Mobile-Specific Features:**
- Camera integration (property photos)
- GPS integration (nearby properties)
- Offline mode (sync when online)
- Voice notes (transcribe to text)
- Signature capture (contracts)
```

---

### 2. **AI Copilot Chat**

```markdown
### AI Copilot Feature

**Persistent Chat Widget:**
```
┌──────────────────────────────────────┐
│ 💬 AI Copilot                    [–]│
├──────────────────────────────────────┤
│ 🤖: Hi! I'm your AI assistant.      │
│     What can I help you with?       │
│                                      │
│ 👤: What's the JEDI Score for the   │
│     Buckhead deal?                  │
│                                      │
│ 🤖: The Buckhead Mixed-Use deal has │
│     a JEDI Score of 72 (OPPORTUNITY)│
│     with 85% confidence.            │
│                                      │
│     Would you like me to:           │
│     • Explain the score breakdown   │
│     • Run a new analysis            │
│     • Compare with similar deals    │
│                                      │
│ [Type message...]          [Send]   │
└──────────────────────────────────────┘
```

**Capabilities:**
- Answer questions about deals/properties
- Explain JEDI Scores
- Suggest next actions ("You should review lease expirations")
- Create tasks/reminders
- Search across all data
- Generate reports

**Implementation:**
```python
from langchain.agents import create_openai_functions_agent
from langchain.tools import tool

@tool
def get_deal_info(deal_id: str) -> dict:
    """Get information about a deal"""
    return Deal.query.get(deal_id).to_dict()

@tool
def search_properties(query: str) -> list:
    """Search properties by address or keywords"""
    return Property.search(query)

# Create agent
agent = create_openai_functions_agent(
    llm=ChatOpenAI(model="gpt-4"),
    tools=[get_deal_info, search_properties, ...],
    system_message="You are a real estate investment assistant..."
)
```
```

---

### 3. **Deal Deck Builder**

```markdown
### Investor Pitch Deck Generator

**Feature:** Auto-generate beautiful pitch decks from deal data.

**UI:**
```
┌──────────────────────────────────────────────────────────────┐
│ 📊 Create Deal Deck                                      [X] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Template:                                                    │
│ ○ Investor Pitch (LP fundraising)                           │
│ ● Acquisition Proposal (lender/bank)                        │
│ ○ Partnership Deck (JV partner)                             │
│                                                              │
│ Include Sections:                                            │
│ ☑ Executive Summary                                         │
│ ☑ Property Overview                                         │
│ ☑ Market Analysis                                           │
│ ☑ Financial Projections                                     │
│ ☑ Development Timeline                                      │
│ ☑ Team Bios                                                 │
│ ☐ Exit Strategy                                             │
│ ☐ Risk Mitigation                                           │
│                                                              │
│ Branding:                                                    │
│ [Logo Upload]  [Company Name]  [Color Scheme]               │
│                                                              │
│ [Cancel]                         [Generate Deck (PDF/PPT)]  │
└──────────────────────────────────────────────────────────────┘
```

**Output:**
- PowerPoint (.pptx) or PDF
- Professional design templates
- Charts/graphs auto-generated from data
- Editable (user can customize)

**Implementation:**
- python-pptx for PowerPoint generation
- ReportLab for PDF
- Template system with placeholders
```

---

### 4. **Market Alerts**

```markdown
### Automated Market Intelligence

**Feature:** Get notified when market conditions change.

**Setup:**
```
┌──────────────────────────────────────────────────────────────┐
│ 🔔 Create Market Alert                                   [X] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Alert Name: Buckhead Rent Growth                            │
│                                                              │
│ Watch:                                                       │
│ ☑ Rent growth > 5% YoY                                      │
│ ☑ New supply < 1000 units/year                              │
│ ☑ Occupancy rate > 95%                                      │
│                                                              │
│ Location:                                                    │
│ [Buckhead, Atlanta, GA] [+ Add Location]                    │
│                                                              │
│ Notify me:                                                   │
│ ● Immediately                                                │
│ ○ Daily digest                                               │
│ ○ Weekly summary                                             │
│                                                              │
│ Delivery:                                                    │
│ ☑ Email                                                      │
│ ☑ In-app notification                                        │
│ ☐ SMS (Pro plan)                                             │
│                                                              │
│ [Cancel]                                    [Create Alert]  │
└──────────────────────────────────────────────────────────────┘
```

**Alert Types:**
- Rent growth/decline
- New supply announcements
- Competitor activity
- Zoning changes
- Property listings (matching criteria)
- Market cap rate changes
```

---

### 5. **Scenario Modeling**

```markdown
### "What-If" Analysis Tool

**Feature:** Test different scenarios on deals.

**UI:**
```
┌──────────────────────────────────────────────────────────────────┐
│ 🔮 Scenario Modeling: Buckhead Deal                          [X] │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│ BASE CASE (Current)                                               │
│ Purchase Price: $52.5M                                            │
│ Rent Growth: 3% YoY                                               │
│ IRR: 18.2%                                                        │
│                                                                   │
│ ─────────────────────────────────────────────────────────────────│
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ SCENARIO 1: Aggressive Growth                               │ │
│ │ Rent Growth: [5%] YoY (vs 3% base)                          │ │
│ │ Occupancy: [98%] (vs 95% base)                              │ │
│ │ → Projected IRR: 24.1% (+5.9 pts)                           │ │
│ │ [Edit] [Delete]                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ SCENARIO 2: Market Downturn                                 │ │
│ │ Rent Growth: [0%] YoY (vs 3% base)                          │ │
│ │ Vacancy: [15%] (vs 5% base)                                 │ │
│ │ Exit Cap Rate: [5.5%] (vs 4.5% base)                        │ │
│ │ → Projected IRR: 8.3% (-9.9 pts) ⚠️                         │ │
│ │ [Edit] [Delete]                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ [+ Add Scenario]                                                  │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ COMPARISON CHART                                            │ │
│ │ [IRR by Scenario bar chart]                                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ [Export Scenarios]  [Share with Team]                            │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```
```

---

## Priority Action Items

### CRITICAL (Do Before Launch)

1. **Complete Database Schema**
   - [ ] Add missing tables (properties, comments, notifications, teams)
   - [ ] Add all indexes for performance
   - [ ] Add constraints and validation rules
   - [ ] Add cascade rules for foreign keys

2. **Define Authentication Strategy**
   - [ ] Implement JWT auth with refresh tokens
   - [ ] Add OAuth2 providers (Google, Microsoft)
   - [ ] Implement RBAC (roles and permissions)
   - [ ] Create user session management

3. **Specify Real-Time Architecture**
   - [ ] Choose WebSocket technology (Socket.io vs Channels)
   - [ ] Design event types and room structure
   - [ ] Implement presence tracking
   - [ ] Add reconnection logic

4. **Create Complete API Specification**
   - [ ] Add request/response schemas for all endpoints
   - [ ] Define error codes and messages
   - [ ] Implement pagination standard
   - [ ] Add rate limiting
   - [ ] Create OpenAPI/Swagger docs

5. **Address Security**
   - [ ] Data encryption strategy (at rest, in transit)
   - [ ] Input validation (all endpoints)
   - [ ] CSRF protection
   - [ ] XSS prevention
   - [ ] SQL injection prevention

---

### HIGH PRIORITY (Do in Phase 1)

6. **Map Performance Optimization**
   - [ ] Implement clustering for large datasets
   - [ ] Add viewport-based loading
   - [ ] Optimize polygon simplification
   - [ ] Add layer caching

7. **Module Dependency System**
   - [ ] Create dependency graph database structure
   - [ ] Implement dependency checking in UI
   - [ ] Handle circular dependencies
   - [ ] Add "smart activate" (auto-add dependencies)

8. **JEDI Score Specification**
   - [ ] Document calculation methodology
   - [ ] Define data source requirements
   - [ ] Create confidence score formula
   - [ ] Add recalculation triggers

9. **AI Agent Architecture**
   - [ ] Implement state management (LangGraph)
   - [ ] Add task queue (Celery/Bull)
   - [ ] Create progress tracking
   - [ ] Add error recovery

10. **Billing System**
    - [ ] Integrate Stripe subscriptions
    - [ ] Implement proration logic
    - [ ] Add trial management
    - [ ] Create usage tracking

---

### MEDIUM PRIORITY (Do in Phase 2)

11. **Enhanced UX**
    - [ ] Improve empty states with examples
    - [ ] Add onboarding tour
    - [ ] Create demo data generator
    - [ ] Add search discoverability

12. **Missing Features**
    - [ ] Email integration (OAuth + IMAP)
    - [ ] Data import/export (CSV, Excel)
    - [ ] Team collaboration (comments, mentions)
    - [ ] Notifications system

13. **Testing**
    - [ ] Write unit tests (60% coverage)
    - [ ] Write integration tests (30% coverage)
    - [ ] Write E2E tests (10% coverage)
    - [ ] Performance testing

14. **Documentation**
    - [ ] API documentation (Swagger)
    - [ ] User documentation
    - [ ] Developer documentation
    - [ ] Architecture diagrams

15. **Third-Party API Resilience**
    - [ ] Implement caching layer
    - [ ] Add fallback data sources
    - [ ] Circuit breaker pattern
    - [ ] Rate limit management

---

### LOW PRIORITY (Nice to Have)

16. **Mobile App**
    - [ ] PWA implementation
    - [ ] React Native app (future)

17. **AI Copilot**
    - [ ] Persistent chat widget
    - [ ] LangChain integration
    - [ ] Custom tools/functions

18. **Advanced Features**
    - [ ] Deal deck builder
    - [ ] Market alerts
    - [ ] Scenario modeling
    - [ ] Predictive analytics

19. **Additional Modules**
    - [ ] Waterfall calculator
    - [ ] Property management
    - [ ] Contract management
    - [ ] Portfolio optimizer

20. **Analytics & Insights**
    - [ ] User behavior tracking
    - [ ] Feature usage analytics
    - [ ] Performance dashboards
    - [ ] Business intelligence reports

---

## Conclusion

The JEDI RE platform specifications are **comprehensive and well-designed**, with a clear vision for a powerful real estate intelligence platform. However, several critical technical details need to be addressed before implementation can begin.

**Key Strengths:**
- Innovative map-centric UI
- Modular marketplace architecture with strong monetization potential
- Comprehensive feature set
- AI-powered analysis (differentiator)

**Critical Gaps:**
- Database schema needs expansion
- Authentication/authorization not specified
- Real-time architecture missing
- API design incomplete
- Security strategy undefined

**Recommendations:**
1. **Address all CRITICAL items** before starting implementation
2. **Create a phased rollout plan**: Start with core features (deals, properties, basic analysis) before adding all 27 modules
3. **Prioritize MVP**: Focus on Build-to-Sell strategy and basic JEDI Score first
4. **Invest in infrastructure**: Proper auth, real-time, and API foundation will prevent technical debt
5. **Plan for scale**: Current architecture can scale, but needs performance optimizations from day one

**Estimated Implementation Timeline:**
- Phase 0 (Specification completion): 2-3 weeks
- Phase 1 (MVP - core features): 3-4 months
- Phase 2 (Module marketplace): 2-3 months
- Phase 3 (Advanced features): 3-6 months

**Total: 8-13 months to full production-ready platform**

---

**Next Steps:**
1. Review this document with the team
2. Prioritize action items
3. Create detailed sprint plans
4. Begin Phase 0 (complete specifications)
5. Hire/assign developers
6. Set up development environment
7. Start implementing!

---

**END OF REVIEW**

*Questions? Need clarification on any recommendation? Let me know!*
