# JEDI RE Wireframe Updates - February 8, 2026

## Navigation Structure - AS IMPLEMENTED

### Left Sidebar Navigation (Vertical)

```
┌──────────────────────────────────────────┐
│ JEDI RE                          🔔  👤▼ │  ← Header with user menu
├──────────────────────────────────────────┤
│                                           │
│ 📊 Dashboard ▼                           │  ← Expandable
│   └─ Email (5)                           │
│   └─ Pipeline (12)                       │
│   └─ Assets Owned (23)       👁️         │  ← Eye = layer toggle
│                                           │
│ INTELLIGENCE                              │
│ 📊 Market Data                           │
│ 📰 News (3)                  👁️         │
│                                           │
│ TOOLS                                     │
│ 📊 Reports                               │
│ 👥 Team                                  │
│                                           │
└──────────────────────────────────────────┘
```

### User Menu (Top Right Dropdown)
Click **👤 Leon D ▼** opens:
```
┌────────────────────────┐
│ Leon D                 │
│ leon@example.com       │
├────────────────────────┤
│ ⚙️  Settings           │
│ 👤 Profile             │
│ 💳 Billing             │
├────────────────────────┤
│ 🚪 Sign Out            │
└────────────────────────┘
```

### Key Changes from Wireframe
1. **Dashboard is now expandable** with Email, Pipeline, and Assets Owned subitems
2. **"My Deals" renamed to "Pipeline"** and moved under Dashboard section
3. **Settings moved to user dropdown** (top right, not in sidebar)
4. **Architecture link removed** (internal dev tool only)
5. **Email, Pipeline, and Assets under Dashboard** (consolidated deal management)

---

## Global Layout Structure

### Shared Horizontal Bar (ALL Pages)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  [🔍 Search] [🗺️ War Maps] [📍 Custom Maps...]  [➕ Map] [➕ Deal]         │  ← MapTabsBar (global)
└──────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Appears on ALL pages (Email, Pipeline, Assets, Market Data, News, etc.)
- Search bar (left)
- Map tabs (center) - War Maps + saved custom maps
- Action buttons (right) - Create Map, Create Deal

---

## 3-Panel Split-View Pattern (Standard for Data Pages)

**Applied to:** Email, Pipeline, Assets Owned, Market Data, News Intelligence

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  MapTabsBar (shared horizontal bar - see above)                             │
├──────────────┬─────────────────────────┬─────────────────────────────────────┤
│   PANEL 1    │      PANEL 2            │         PANEL 3                     │
│   VIEWS      │      CONTENT            │         MAP                         │
│   SIDEBAR    │      PANEL              │                                     │
│              │                         │                                     │
│  📋 View 1   │  ┌─────────────────┐   │                                     │
│  📊 View 2   │  │ List/Card       │   │      MAPBOX MAP                     │
│  🔗 View 3   │  │ Content         │   │                                     │
│  🔔 View 4   │  │                 │   │      - Deal boundaries              │
│              │  │ (scrollable)    │   │      - Property markers             │
│              │  │                 │   │      - Event markers                │
│              │  └─────────────────┘   │      - Click to interact            │
│              │                         │                                     │
│  64-80px     │  400-800px (resizable)  │      flex-1 (remaining space)      │
└──────────────┴─────────────────────────┴─────────────────────────────────────┘
```

**Features:**
- **Panel 1 (Views):** Navigation between sub-views (64-80px fixed width)
- **Panel 2 (Content):** Main content area (resizable 400-800px, default 550px)
- **Panel 3 (Map):** Always-visible map context (takes remaining space)
- **Toggle buttons:** Top-right controls to show/hide panels
- **Resize handle:** Drag to adjust Panel 2 width
- **Persistent state:** Width saved to localStorage

**Benefits:**
- Consistent UX across all data pages
- Map always visible for spatial context
- Easy navigation between views
- Flexible content sizing

---

### 1. Email Page (Dashboard → Email)

**Route:** `/dashboard/email`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  MapTabsBar (shared)                                                         │
├──────────┬────────────────────────────┬──────────────────────────────────────┤
│  VIEWS   │       CONTENT              │           MAP                        │
│          │                            │                                      │
│ 📥 Inbox │  ┌──────────────────────┐  │                                      │
│ 📤 Sent  │  │ 📧 Sarah Johnson     │  │      MAPBOX MAP                      │
│ 📝 Drafts│  │ New MF opportunity   │  │                                      │
│ ⭐ Flagged   📁 Buckhead Deal  🔵  │  │      - Deal boundaries               │
│          │  │ 2h ago              │  │      - Email locations (if geocoded) │
│          │  └──────────────────────┘  │      - Property markers              │
│          │                            │                                      │
│          │  Email list (scrollable)   │                                      │
└──────────┴────────────────────────────┴──────────────────────────────────────┘
```

**Panel 1 (Views):** Inbox, Sent, Drafts, Flagged  
**Panel 2 (Content):** Email cards with sender, subject, deal badge, timestamp  
**Panel 3 (Map):** Deals visible, email locations if available

---

### 2. Pipeline Page (Dashboard → Pipeline)

**Route:** `/deals`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  MapTabsBar (shared)                                                         │
├──────────┬────────────────────────────┬──────────────────────────────────────┤
│  VIEWS   │       CONTENT              │           MAP                        │
│          │                            │                                      │
│ 📊 All   │  ┌──────────────────────┐  │                                      │
│ 🟢 Active│  │ 🟡 Buckhead Mixed-Use│  │      MAPBOX MAP                      │
│ 🔍 Due D │  │ 228.3 acres          │  │                                      │
│ 📝 Qualified  0 properties         │  │      - Deal boundaries (colored)     │
│ 🏁 Closing   $52M estimated       │  │      - Property markers              │
│ ✅ Closed│  └──────────────────────┘  │      - Click → Navigate to detail    │
│          │                            │                                      │
│          │  Deal cards (scrollable)   │                                      │
└──────────┴────────────────────────────┴──────────────────────────────────────┘
```

**Panel 1 (Views):** All, Active, Qualified, Due Diligence, Closing, Closed  
**Panel 2 (Content):** Deal cards with tier, acreage, property count, value  
**Panel 3 (Map):** Deal boundaries with tier-based colors

---

### 3. Assets Owned Page (Dashboard → Assets Owned)

**Route:** `/assets`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  MapTabsBar (shared)                                                         │
├──────────┬────────────────────────────┬──────────────────────────────────────┤
│  VIEWS   │       CONTENT              │           MAP                        │
│          │                            │                                      │
│ 🏢 All   │  ┌──────────────────────┐  │                                      │
│ 📊 Perform.  │ Midtown Tower       │  │      MAPBOX MAP                      │
│ 📄 Documents 250 units, 94% occ.   │  │                                      │
│          │  │ $2.1M NOI            │  │      - Asset locations               │
│          │  │ Class A+             │  │      - Property markers              │
│          │  └──────────────────────┘  │      - Performance heat overlay      │
│          │                            │                                      │
│          │  Asset cards (scrollable)  │                                      │
└──────────┴────────────────────────────┴──────────────────────────────────────┘
```

**Panel 1 (Views):** All, Performance, Documents  
**Panel 2 (Content):** Asset cards with units, occupancy, NOI, class  
**Panel 3 (Map):** Asset markers with performance overlay

---

### 4. Market Data Page (Intelligence → Market Data)

**Route:** `/market-data`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  MapTabsBar (shared)                                                         │
├──────────┬────────────────────────────┬──────────────────────────────────────┤
│  VIEWS   │       CONTENT              │           MAP                        │
│          │                            │                                      │
│ 📊 Overview  KPIs + Charts           │  │      MAPBOX MAP                      │
│ 🏘️ Comparables  Comp properties        │  │                                      │
│ 👥 Demographics  Census data            │  │      - Submarket boundaries          │
│ 📈 Supply/Demand Supply pressure        │  │      - Data overlays (choropleth)    │
│          │                            │  │      - Comparable markers            │
│          │  Data viz (scrollable)     │  │      - Heat maps (rent, vacancy)     │
│          │                            │                                      │
└──────────┴────────────────────────────┴──────────────────────────────────────┘
```

**Panel 1 (Views):** Overview, Comparables, Demographics, Supply/Demand  
**Panel 2 (Content):** Charts, tables, KPIs  
**Panel 3 (Map):** Data overlays, heat maps, submarket boundaries

---

### 5. News Intelligence Page (Intelligence → News)

**Route:** `/news`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  MapTabsBar (shared)                                                         │
├──────────┬────────────────────────────┬──────────────────────────────────────┤
│  VIEWS   │       CONTENT              │           MAP                        │
│          │                            │                                      │
│ 📋 Feed  │  ┌──────────────────────┐  │                                      │
│ 📊 Dashboard  MS relocating 3,200   │  │      MAPBOX MAP                      │
│ 🔗 Network   Employment → +2,100   │  │                                      │
│ 🔔 Alerts│  │ housing demand       │  │      - Event markers (by category)   │
│          │  │ ⚠️ High Impact       │  │      - Deal boundaries               │
│          │  └──────────────────────┘  │      - Click event → Zoom to location│
│          │                            │                                      │
│          │  Event cards (scrollable)  │                                      │
└──────────┴────────────────────────────┴──────────────────────────────────────┘
```

**Panel 1 (Views):** Event Feed, Market Dashboard, Network Intelligence, Alerts  
**Panel 2 (Content):** Event cards with impact analysis, source tracking  
**Panel 3 (Map):** Event markers color-coded by category

---

## Implementation Summary

### Design System Established (Feb 8, 2026)

**Core Pattern:** 3-Panel Split-View with Shared Horizontal Bar

**Applied to 5 major pages:**
1. ✅ **Email** - Fully implemented backend, needs 3-panel UI update
2. ✅ **News Intelligence** - 3-panel layout built, needs views restoration  
3. ⏳ **Pipeline** - Backend ready, needs 3-panel UI
4. ⏳ **Assets Owned** - Backend ready, needs 3-panel UI
5. ⏳ **Market Data** - Backend ready, needs 3-panel UI

### Shared Components

**MapTabsBar (Horizontal Bar):**
- ✅ Search bar integration
- ✅ Map tabs (War Maps + custom maps)
- ✅ Action buttons (Create Map, Create Deal)
- ✅ Appears on ALL pages globally
- ✅ WarMapsComposer modal wired

**3-Panel Layout Components:**
- ⏳ Reusable ThreePanelLayout wrapper
- ⏳ ViewsSidebar component (64-80px)
- ⏳ ContentPanel component (resizable 400-800px)
- ⏳ MapPanel component (flex-1, always visible)
- ⏳ Toggle controls (show/hide panels)
- ⏳ Resize handle with localStorage persistence

### Backend Status

**Email:**
- ✅ Database schema (4 tables)
- ✅ API endpoints (11 routes)
- ✅ Email service layer
- ✅ Sample data seeded

**News Intelligence:**
- ✅ Database schema (6 tables)
- ✅ API endpoints (8 routes)
- ✅ News service layer
- ✅ Sample data ready

**Pipeline/Assets/Market Data:**
- ✅ Existing API infrastructure
- ✅ Database schemas complete
- ✅ Service layers functional

### Next Implementation Steps

**Phase 1: Create Reusable Components (4 hours)**
1. Build ThreePanelLayout wrapper component
2. Build ViewsSidebar with navigation logic
3. Build resizable ContentPanel
4. Integrate MapPanel with existing map logic

**Phase 2: Update Existing Pages (6 hours)**
1. News Intelligence - restore 3-panel layout
2. Email - convert to 3-panel layout
3. Pipeline - convert to 3-panel layout
4. Assets Owned - convert to 3-panel layout
5. Market Data - convert to 3-panel layout

**Phase 3: Polish & Testing (2 hours)**
1. Consistent styling across all pages
2. LocalStorage persistence for panel widths
3. Responsive behavior
4. Performance optimization

---

## Key Design Decisions

### Why 3-Panel Layout?

**User Benefits:**
1. **Consistent navigation** - Same pattern across all data pages
2. **Spatial context** - Map always visible (no context switching)
3. **Flexible content** - Resizable middle panel for different content types
4. **Progressive disclosure** - Toggle panels to focus on content or map
5. **Mobile-ready foundation** - Panels can stack on smaller screens

### Why Shared Horizontal Bar?

**User Benefits:**
1. **Global map access** - Switch between War Maps on any page
2. **Quick actions** - Create Map/Deal buttons always available
3. **Unified search** - One search bar for entire platform
4. **Consistent navigation** - No context loss when switching pages

### Technical Decisions

**Component Architecture:**
- Reusable ThreePanelLayout wrapper (DRY principle)
- Props-based configuration (viewItems, contentRenderer, mapRenderer)
- LocalStorage for panel width persistence
- CSS Grid for layout (cleaner than flexbox for 3-column)

**Performance:**
- Map instance reused across panel toggles
- Panel widths cached to prevent layout thrashing
- Lazy loading for content panels
- Virtualized lists for large datasets

---

**Last Updated:** February 8, 2026 18:57 EST  
**Status:** Design system defined, implementation in progress  
**Next Milestone:** Phase 1 - Build reusable 3-panel components (4 hours)
