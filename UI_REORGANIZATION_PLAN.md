# UI Reorganization Plan - JEDI RE

**Created:** 2026-02-20 16:10 EST  
**Requested By:** Leon  
**Priority:** High (UX improvement for production launch)

---

## Important Terminology

**Market Research Data** = Data points (e.g., 1,028 Fulton County properties) used to:
- Assess market performance and trends
- Identify acquisition opportunities
- Benchmark comparable sales
- Conduct owner outreach
- Analyze vintage cohorts

**Deals** = Properties the user owns or is actively pursuing for acquisition

This plan creates clear separation between market research data and user's portfolio.

---

## Problem Statement

### Issue #1: Deal Flow Tab Overload
**Current State:** 16+ tabs in left sidebar creating cognitive overload
- Overview, AI Agent, Competition, Supply, Market, Debt, Financial, Strategy, Due Diligence, Team, Documents, Timeline, Notes, Files, Exit Analysis, Context

**Problem:** Too many top-level navigation items, hard to find what you need

### Issue #2: Market Intelligence Fragmentation
**Current State:** Two disconnected systems
1. **Market Data** - Property records, Fulton County data (1,028 properties)
2. **Market Research** - Analysis tools, submarkets, trends

**Problem:** No unified overview showing all markets a user wants to track

---

## Solution #1: Deal Flow Navigation Consolidation

### Proposed Structure (7 Top-Level Groups)

```
📊 ANALYSIS
  ├─ Overview (current: Overview)
  ├─ Market Intelligence (current: Market)
  ├─ Competition Analysis (current: Competition)
  ├─ Supply Pipeline (current: Supply)
  └─ Exit Analysis (current: Exit Analysis)

💰 FINANCIAL
  ├─ Financial Model (current: Financial)
  ├─ Debt & Financing (current: Debt)
  └─ Investment Strategy (current: Strategy)

📋 OPERATIONS
  ├─ Due Diligence (current: Due Diligence)
  ├─ Timeline & Milestones (current: Timeline)
  └─ Team & Roles (current: Team)

📁 DOCUMENTS
  ├─ Documents (current: Documents)
  ├─ Files & Assets (current: Files)
  └─ Notes (current: Notes)

🤖 AI TOOLS
  ├─ AI Agent / Opus (current: AI Agent)
  └─ Context Builder (current: Context)

📈 DEAL STATUS (always visible)
  └─ Deal Capsule Summary

⚙️ SETTINGS (collapsed by default)
  └─ Deal Settings
```

### Benefits
- **16 tabs → 7 groups** (56% reduction in visual clutter)
- Logical grouping by function
- Collapsible sections reduce cognitive load
- Deal Status always visible for quick context

### Implementation Tasks
1. Create `TabGroup` component with collapsible sections
2. Refactor `DealDetailPage.tsx` navigation structure
3. Add keyboard shortcuts (e.g., `1-7` to switch groups)
4. Persist expanded/collapsed state in user preferences
5. Add search/filter to quickly find tabs

**Estimate:** 4-6 hours (1 agent)

---

## Solution #2: Market Intelligence Unification

### Current Architecture Issues

**Market Data Page:**
- Focused on market research data points (Fulton County: 1,028 properties)
- Shows individual properties with owner info, sales history for research purposes
- Used to assess market performance, identify trends, find acquisition targets
- No market-level overview

**Market Research Page:**
- Submarket analysis tools
- Supply/demand tracking
- Disconnected from property records

**Gap:** No way to see "I'm tracking Atlanta, Austin, Tampa - show me everything"

### Proposed: Unified Market Intelligence System

#### New Page Structure

```
MARKET INTELLIGENCE (top-level navigation)
│
├─ 📍 MY MARKETS (NEW - Overview Page)
│   ├─ Market Cards (Atlanta, Austin, Tampa, etc.)
│   ├─ Quick Stats (properties tracked, deals active, coverage %)
│   ├─ Alerts & Notifications
│   └─ Add New Market button
│
├─ 🏙️ MARKET DEEP DIVE (per market)
│   ├─ Overview Tab
│   │   ├─ Market vitals (population, job growth, etc.)
│   │   ├─ Property coverage (how many properties we have)
│   │   └─ Active deals in this market
│   │
│   ├─ Market Data Tab (current Market Data)
│   │   ├─ 1,028 research data points (not user's properties)
│   │   ├─ Owner outreach list for acquisition targeting
│   │   ├─ Property-level details for market analysis
│   │   └─ Use cases: trend analysis, comps, acquisition targets
│   │
│   ├─ Submarkets Tab (current Market Research)
│   │   ├─ Submarket comparison
│   │   ├─ Supply/demand analysis
│   │   └─ Trade area intelligence
│   │
│   ├─ Trends Tab
│   │   ├─ 12-year appreciation data
│   │   ├─ Rent growth
│   │   └─ Occupancy trends
│   │
│   └─ Deals Tab (NEW)
│       ├─ YOUR active deals in this market
│       ├─ YOUR pipeline properties
│       ├─ YOUR closed transactions
│       └─ Distinct from Market Data (research) tab
│
└─ 🌎 NATIONWIDE (new)
    ├─ All markets comparison
    ├─ Opportunity scoring
    └─ Market entry recommendations
```

### New "My Markets" Overview Page

**Hero Section:**
```
MY MARKETS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[+ Add Market]  [⚙️ Preferences]  [📊 Compare Markets]

Active Markets: 3        Data Points: 1,028        Active Deals: 12
```

**Market Cards (Grid):**
```
┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│ 🏙️ ATLANTA METRO                   │  │ 🏙️ AUSTIN                           │
│                                     │  │                                     │
│ Coverage: 620,000 parcels (60%)    │  │ Coverage: 125,000 parcels (35%)    │
│ Data Points: 1,028 (250K units)    │  │ Data Points: 0 (pending import)    │
│ Active Deals: 8                    │  │ Active Deals: 3                    │
│                                     │  │                                     │
│ 📈 Rent Growth: +4.2% YoY          │  │ 📈 Rent Growth: +6.8% YoY          │
│ 📊 Occupancy: 94.5%                │  │ 📊 Occupancy: 96.2%                │
│ 🎯 JEDI Score: 87 (Strong Buy)    │  │ 🎯 JEDI Score: 92 (Strong Buy)    │
│                                     │  │                                     │
│ [View Market →]                    │  │ [View Market →]                    │
└─────────────────────────────────────┘  └─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 🏙️ TAMPA                            │
│                                     │
│ Coverage: 85,000 parcels (25%)     │
│ Data Points: 0 (pending import)    │
│ Active Deals: 1                    │
│                                     │
│ 📈 Rent Growth: +5.1% YoY          │
│ 📊 Occupancy: 95.3%                │
│ 🎯 JEDI Score: 84 (Buy)            │
│                                     │
│ [View Market →]                    │
└─────────────────────────────────────┘
```

**Alerts Section:**
```
🔔 ALERTS & OPPORTUNITIES

⚠️ Atlanta: 127 new data points with owner contact info available
💡 Austin: 3 properties identified meeting acquisition criteria (Cap Rate >7%)
📊 Tampa: Market report updated (Q1 2026 data available)
```

### User Preferences (New)

**Market Coverage Preferences Table:**
```
SELECT MARKETS TO TRACK

Metro Area          Status      Data Points         Coverage    Actions
─────────────────────────────────────────────────────────────────────────
□ Atlanta           ✅ Active   1,028 (250K units)  60%        [Configure]
□ Austin            🟡 Pending  0                   0%         [Import]
□ Tampa             🟡 Pending  0                   0%         [Import]
□ Dallas            ⬜ Inactive  -                   -          [Add]
□ Miami             ⬜ Inactive  -                   -          [Add]
□ Phoenix           ⬜ Inactive  -                   -          [Add]

[+ Add Custom Market]
```

### Technical Architecture

**New Database Tables:**

```sql
-- User market preferences
CREATE TABLE user_market_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  market_id VARCHAR(100), -- e.g., "atlanta-metro", "austin"
  is_active BOOLEAN DEFAULT true,
  priority INTEGER, -- 1 = primary, 2 = secondary, etc.
  notification_settings JSONB, -- alert preferences
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Market coverage tracking
CREATE TABLE market_coverage_status (
  id SERIAL PRIMARY KEY,
  market_id VARCHAR(100) UNIQUE,
  display_name VARCHAR(255), -- "Atlanta Metro"
  total_parcels INTEGER, -- Total in market
  covered_parcels INTEGER, -- How many we have
  coverage_percentage DECIMAL(5,2),
  last_import_date TIMESTAMPTZ,
  next_scheduled_import TIMESTAMPTZ,
  status VARCHAR(50), -- 'active', 'pending', 'inactive'
  metadata JSONB -- Additional market info
);

-- Market vitals (economic indicators)
CREATE TABLE market_vitals (
  id SERIAL PRIMARY KEY,
  market_id VARCHAR(100),
  date DATE,
  population INTEGER,
  job_growth_yoy DECIMAL(5,2),
  median_income INTEGER,
  rent_growth_yoy DECIMAL(5,2),
  occupancy_rate DECIMAL(5,2),
  avg_rent_per_unit INTEGER,
  source VARCHAR(255), -- Data source attribution
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**New API Endpoints:**

```typescript
// Market preferences
GET    /api/v1/markets/preferences          // Get user's tracked markets
POST   /api/v1/markets/preferences          // Add market to tracking
PUT    /api/v1/markets/preferences/:id      // Update market preferences
DELETE /api/v1/markets/preferences/:id      // Remove market from tracking

// Market overview
GET    /api/v1/markets/overview              // "My Markets" dashboard data
GET    /api/v1/markets/:marketId/summary     // Single market card data
GET    /api/v1/markets/:marketId/alerts      // Market-specific alerts
GET    /api/v1/markets/compare                // Multi-market comparison

// Market deep dive (consolidates existing endpoints)
GET    /api/v1/markets/:marketId/properties  // Property records (existing)
GET    /api/v1/markets/:marketId/submarkets  // Submarket analysis (existing)
GET    /api/v1/markets/:marketId/trends      // Market trends (existing)
GET    /api/v1/markets/:marketId/deals       // Active deals in market (new)
```

**Frontend Components:**

```
frontend/src/pages/
├─ MarketIntelligence/           # New unified section
│  ├─ MyMarketsOverview.tsx      # NEW: Overview page
│  ├─ MarketDeepDive.tsx         # NEW: Single market view
│  ├─ MarketPreferences.tsx      # NEW: Settings page
│  └─ components/
│     ├─ MarketCard.tsx          # Market summary card
│     ├─ MarketAlerts.tsx        # Alert notifications
│     ├─ MarketComparison.tsx    # Side-by-side comparison
│     └─ AddMarketModal.tsx      # Add new market dialog
│
├─ MarketDataPageV2.tsx          # REFACTOR: Move into MarketDeepDive
└─ MarketResearchPage.tsx        # REFACTOR: Move into MarketDeepDive
```

---

## Implementation Plan

### Phase 1: Deal Flow Navigation (Week 1)
**Goal:** Reduce tab clutter from 16 to 7 groups

**Tasks:**
1. Create `TabGroup` component with expand/collapse (4h)
2. Refactor `DealDetailPage.tsx` navigation (3h)
3. Add keyboard shortcuts + search (2h)
4. User preference persistence (1h)
5. Testing + polish (2h)

**Estimate:** 12 hours (2 days)  
**Deliverable:** Cleaner deal navigation with logical grouping

---

### Phase 2: Market Intelligence Backend (Week 1)
**Goal:** Unify market data with user preferences

**Tasks:**
1. Database migrations (3 tables) (2h)
2. API endpoints (8 new routes) (4h)
3. Market data aggregation service (3h)
4. Alert/notification logic (2h)
5. Testing (2h)

**Estimate:** 13 hours (2 days)  
**Deliverable:** Backend ready for unified market system

---

### Phase 3: "My Markets" Overview Page (Week 2)
**Goal:** Central hub showing all tracked markets

**Tasks:**
1. `MyMarketsOverview.tsx` page component (4h)
2. Market card components (3h)
3. Add market modal + preferences UI (3h)
4. Alert notifications UI (2h)
5. Integration with existing data (3h)
6. Testing (2h)

**Estimate:** 17 hours (2-3 days)  
**Deliverable:** Functional overview page

---

### Phase 4: Market Deep Dive Consolidation (Week 2-3)
**Goal:** Merge Market Data + Market Research into unified view

**Tasks:**
1. Create `MarketDeepDive.tsx` master component (3h)
2. Refactor existing MarketDataPageV2 → Market Data tab (4h)
   - Clarify: Research data points, not user's properties
   - Add use case guidance (trends, acquisition targets, etc.)
3. Refactor existing MarketResearch → Submarkets tab (4h)
4. Create Trends tab (market vitals visualization) (4h)
5. Create Deals tab (deals filtered by market) (3h)
6. Navigation + routing updates (2h)
7. Testing + migration path (3h)

**Estimate:** 23 hours (3-4 days)  
**Deliverable:** Unified market intelligence system

---

### Phase 5: Polish & Documentation (Week 3)
**Tasks:**
1. User guide for new navigation (2h)
2. Market import wizard documentation (1h)
3. Performance optimization (2h)
4. Bug fixes + edge cases (3h)

**Estimate:** 8 hours (1 day)

---

## Total Effort Estimate

| Phase | Days | Hours |
|-------|------|-------|
| Phase 1: Deal Flow Navigation | 2 | 12 |
| Phase 2: Market Backend | 2 | 13 |
| Phase 3: My Markets Overview | 2-3 | 17 |
| Phase 4: Market Deep Dive | 3-4 | 23 |
| Phase 5: Polish | 1 | 8 |
| **Total** | **10-12 days** | **73 hours** |

**With parallel agent deployment:** Could compress to 1.5-2 weeks

---

## Success Metrics

### Navigation Improvements
- ✅ Tabs reduced from 16 to 7 groups (56% reduction)
- ✅ User can find any tab in <3 clicks
- ✅ Keyboard shortcuts reduce mouse dependency
- ✅ Collapsible groups persist user preferences

### Market Intelligence
- ✅ User sees all tracked markets on one page
- ✅ Quick add/remove markets without confusion
- ✅ Property records + market research unified
- ✅ Alerts surface actionable opportunities
- ✅ Coverage tracking shows data gaps

---

## Design Mockups Needed

1. **Deal Flow:** Collapsible navigation with 7 groups
2. **My Markets:** Grid of market cards with vitals
3. **Market Deep Dive:** Tabbed interface (Overview/Properties/Submarkets/Trends/Deals)
4. **Add Market Modal:** Search + select markets to track
5. **Market Preferences:** Table with coverage status

Should I start with Phase 1 (Deal Flow Navigation) or Phase 2 (Market Backend)?

---

**Next Steps:**
1. Get approval on proposed structure
2. Create visual mockups (optional)
3. Deploy agents for parallel build
4. Test with Leon as we go

**Questions for Leon:**
1. Which phase should we prioritize first?
2. Any specific markets beyond Atlanta/Austin/Tampa to pre-configure?
3. Should Market Intelligence be top-level nav or nested under "Research"?

---

**Status:** Plan complete, awaiting approval to begin Phase 1  
**Updated:** 2026-02-20 16:15 EST by RocketMan 🚀
