# Deal Silo Architecture - Integration Assessment

**Date:** February 9, 2026  
**Source:** Route Architecture v9  
**Current Wireframe:** COMPLETE_PLATFORM_WIREFRAME.md v2.1

---

## Executive Summary

The Route Architecture v9 introduces a **Deal Silo model** where each deal is a self-contained workspace with 36+ module pages. This differs from the current wireframe's central map canvas model. Both can coexist with clear integration points.

**Integration Strategy:** Two-layer navigation
1. **Platform Layer** (existing wireframe) - Portfolio overview, map canvas, pipeline list
2. **Deal Silo Layer** (new architecture) - Individual deal workspaces with modules

---

## Architecture Comparison

### Current Wireframe (v2.1)
```
Platform-Level Navigation:
- Horizontal bar: Map layers, search, War Maps
- Vertical sidebar: Dashboard, Assets, Pipeline, Email, Reports, Team
- Central map canvas: Always visible, layers stack
- Three-panel layout: Views/Content/Map for data pages
```

### Deal Silo Architecture (v9)
```
Deal-Level Navigation (inside /deals/:dealId):
- Deal header: Name, type, strategy, stage, score
- Module sidebar: Standard features + enabled modules
- Content area: Active module page
- Optional map panel: Deal-specific (boundary, properties)
```

**Key Insight:** These are complementary, not competing. The platform layer navigates TO deals, the deal silo layer navigates WITHIN deals.

---

## Integration Points

### 1. Entry Points to Deal Silos

**From Pipeline (Map View):**
```
User clicks deal boundary on map
  → Navigate to /deals/:dealId (Overview)
  → Deal silo layout replaces main layout
  → User is now "inside" the deal workspace
```

**From Pipeline (Grid View):**
```
User clicks deal row in grid
  → Navigate to /deals/:dealId (Overview)
  → Same as above
```

**From Pipeline (Kanban View):**
```
User clicks deal card in Kanban
  → Navigate to /deals/:dealId (Overview)
  → Same as above
```

**From Create Deal Wizard:**
```
User completes /deals/new (5 steps)
  → Deal created with suggested modules activated
  → Redirect to /deals/:dealId (Overview)
  → User sees sidebar with ✦ suggested modules
```

---

### 2. Deal Silo Layout Structure

**Route:** `/deals/:dealId/*`  
**Layout File:** `app/deals/[dealId]/layout.tsx`  
**Replaces:** Main platform layout (no horizontal bar, different sidebar)

```
┌────────────────────────────────────────────────────────────────────┐
│  ← Back to Pipeline  |  Buckhead Mixed-Use  |  MF • Value-Add • Lead │
│                                                         Score: 72   │
├──────────────┬─────────────────────────────────────────────────────┤
│  SIDEBAR     │                                                      │
│  (Module Nav)│              ACTIVE MODULE CONTENT                   │
│              │              (rendered by child route)               │
│  STANDARD    │                                                      │
│  □ Overview  │              /deals/:dealId/financial-model          │
│  □ Activity  │              renders Financial Modeling Pro          │
│  □ Notes     │              with this deal's data                   │
│  □ Docs      │                                                      │
│  □ Tasks     │                                                      │
│  □ Offers    │                                                      │
│  □ Comms     │                                                      │
│  □ Providers │                                                      │
│  □ DD Check  │                                                      │
│  □ Occupancy │                                                      │
│  □ Returns   │                                                      │
│              │                                                      │
│  MODULES     │                                                      │
│  ✦ Strategy  │                                                      │
│  ✦ Financial │                                                      │
│  ✦ Analysis  │                                                      │
│  ✦ DD Suite  │                                                      │
│  ✦ Market    │                                                      │
│  ✦ Intel     │                                                      │
│  ✦ Execution │                                                      │
│              │                                                      │
│  TOOLS       │                                                      │
│  □ Props     │                                                      │
│  □ Stage     │                                                      │
│  □ AI Agents │                                                      │
│  □ Email     │                                                      │
│  □ Reports   │                                                      │
│              │                                                      │
│  [Map View]  │  ← Optional: Toggle deal-specific map panel         │
└──────────────┴─────────────────────────────────────────────────────┘
```

---

### 3. Navigation Flow

**Two-Layer Model:**

**Layer 1: Platform Navigation** (Main Layout)
```
/dashboard              → Portfolio overview, all deals on map
/pipeline               → All deals (map view)
/pipeline/grid          → All deals (grid view, 34 columns)
/pipeline/kanban        → All deals (Kanban, 6 stages)
/assets-owned           → All properties (map view)
/assets-owned/grid      → All properties (grid view, 54 columns)
/news-intel             → News intelligence (3-panel layout)
/email                  → Global inbox
/reports                → Report library
/team                   → Team management
/maps                   → War Maps / Custom Maps
/settings               → User settings

User sees: Horizontal bar + vertical sidebar + map canvas
```

**Layer 2: Deal Silo Navigation** (Deal Layout)
```
/deals/:dealId                      → Overview (landing page)
/deals/:dealId/activity             → Activity feed
/deals/:dealId/notes                → Notes
/deals/:dealId/documents            → Documents
/deals/:dealId/tasks                → Tasks
/deals/:dealId/financial-model      → Financial Modeling Pro module
/deals/:dealId/dd-suite             → Due Diligence Suite module
/deals/:dealId/market-signals       → Market Signals module
... (36+ total routes per deal)

User sees: Deal header + module sidebar + content area
```

**Breadcrumb Example:**
```
Dashboard → Pipeline → Buckhead Mixed-Use (Deal) → Financial Model
   ↑          ↑              ↑                          ↑
Platform   Platform      Deal Silo                 Module
 Layer      Layer         Entry                    within Silo
```

---

## Module Control System

### Settings > Modules Page

**Route:** `/settings/modules`  
**Layout:** Uses main platform layout  
**Purpose:** Global control center for module subscriptions

**User sees:**
- Current bundle (Flipper, Developer, Portfolio Manager, or a la carte)
- All available modules grouped by category
- Toggle switches [ON/OFF] for each module
- Pricing and bundle inclusion status
- Upsell prompts for disabled modules

**Effect of toggling:**
- **[ON]** → Module appears in sidebar of ALL deals
- **[OFF]** → Module hidden from sidebar of ALL deals (but data preserved)

**Example:**
```
User turns OFF "Sensitivity Tester":
  → Sidebar in all deals no longer shows Sensitivity Tester
  → Route /deals/:dealId/sensitivity still exists
  → If user navigates directly to URL, gets "Module not enabled" message
  → User can re-enable in settings at any time
```

---

### Module Suggestions (Deal-Specific)

**Triggered:** On deal creation (`/deals/new`)  
**Logic:** Based on product type + strategy

**Example:**
```
User creates:
  Product Type: Multifamily
  Strategy: Value-Add
  Phase: Pipeline

System auto-suggests:
  ✦ Strategy Arbitrage
  ✦ Financial Modeling Pro
  ✦ Financial Analysis Pro
  ✦ Due Diligence Suite
  ✦ Market Signals
  ✦ Deal Intelligence
  ✦ Deal Execution

Result:
  - These modules show ✦ badge in sidebar
  - User can navigate to them immediately
  - Other enabled modules still visible (no ✦ badge)
  - Disabled modules show as locked upsell
```

---

## Wireframe Updates Required

### 1. Add Deal Silo Section

**New Section:** After "Individual Deal Pages", before "User Flows"

**Content:**
- Deal silo layout diagram
- Module sidebar structure
- Standard features list (11 items)
- Premium modules list (36+ items)
- Module grouping categories
- Suggested vs enabled vs locked states

### 2. Update Pipeline Deep Dive

**Current:** Focuses on map/grid/Kanban views  
**Add:** Entry point description

```
Pipeline Silo - Deep Dive

Entry Points:
  - Map view: Click deal boundary → Enter silo
  - Grid view: Click deal row → Enter silo
  - Kanban view: Click deal card → Enter silo

Once inside silo:
  - User sees deal-specific layout (not main layout)
  - Sidebar shows enabled modules
  - Content area shows active module
  - [← Back to Pipeline] returns to map/grid/Kanban
```

### 3. Add Settings > Modules Section

**New Section:** Under "Settings"

**Content:**
- Module Control Center UI
- Bundle comparison (Flipper, Developer, Portfolio Manager)
- Toggle behavior (global effect)
- Upsell flows
- Pricing per module

### 4. Update Navigation Patterns

**Add:** Two-layer navigation model

```
Navigation Layers:

LAYER 1: Platform Navigation
  Purpose: Portfolio-wide views, all deals, all properties
  Layout: Main layout (horizontal bar + sidebar + map)
  Pages: Dashboard, Pipeline, Assets, Email, Reports, Team, Settings

LAYER 2: Deal Silo Navigation
  Purpose: Single-deal workspace, module access
  Layout: Deal layout (deal header + module sidebar + content)
  Pages: 36+ module pages per deal
  Entry: Click deal from Pipeline
  Exit: "← Back to Pipeline" button
```

---

## Implementation Roadmap

### Phase 1: Foundation (Current Sprint)
- [x] Main layout (horizontal bar + sidebar + map) - Complete
- [x] Three-panel layout component - Complete
- [ ] Deal silo layout component - NEW
- [ ] Module sidebar component - NEW
- [ ] Module permission resolver - NEW

### Phase 2: Standard Features (Week 2)
- [ ] Deal overview page
- [ ] Activity feed
- [ ] Notes
- [ ] Documents
- [ ] Tasks
- [ ] Offers & Negotiation
- [ ] DD Checklist (Basic)
- [ ] Occupancy Dashboard
- [ ] Returns Tracker
- [ ] Communication Log
- [ ] Service Providers

### Phase 3: Free Modules (Week 3)
- [ ] Basic Financial Modeling
- [ ] Comp Analysis (Basic)

### Phase 4: Premium Modules (Week 4+)
- [ ] Strategy Arbitrage Engine
- [ ] Financial Modeling Pro
- [ ] Financial Analysis Pro
- [ ] Due Diligence Suite
- [ ] Market Signals
- [ ] Deal Intelligence
- [ ] (30+ more modules, prioritize by bundle)

### Phase 5: Module Control (Week 6)
- [ ] Settings > Modules page
- [ ] Bundle management UI
- [ ] Module toggle logic
- [ ] Upsell flows
- [ ] Subscription integration (Stripe)

---

## Data Model Changes

### New Tables Required

```sql
-- User module preferences (global)
CREATE TABLE user_module_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  module_slug     TEXT NOT NULL,
  enabled         BOOLEAN DEFAULT true,
  subscribed      BOOLEAN DEFAULT false,
  bundle_id       TEXT,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, module_slug)
);

-- Deal module suggestions (computed on deal creation)
CREATE TABLE deal_module_suggestions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         UUID NOT NULL REFERENCES deals(id),
  module_slug     TEXT NOT NULL,
  suggestion_type TEXT CHECK (suggestion_type IN ('auto', 'optional')),
  activated       BOOLEAN DEFAULT false,
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(deal_id, module_slug)
);

-- Module definitions (static config)
CREATE TABLE module_definitions (
  slug            TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,
  price_monthly   INTEGER,
  is_free         BOOLEAN DEFAULT false,
  bundles         TEXT[],
  description     TEXT,
  icon            TEXT,
  sort_order      INTEGER
);
```

### Module Data Tables

Each module will have its own table(s):
- `financial_models` (for Financial Modeling Pro)
- `dd_checklists` (for DD Suite)
- `market_signals` (for Market Signals)
- etc.

All keyed to `deal_id` for deal-specific data.

---

## Design System Updates

### New Components Needed

**1. DealSiloLayout**
- Deal header (name, type, strategy, stage, score)
- Module sidebar (grouped, collapsible sections)
- Content area (full width or with map panel)
- Back navigation to pipeline
- Breadcrumb support

**2. ModuleSidebar**
- Section headers (Standard, Modules, Tools)
- Module items with states:
  - Active (blue background)
  - Suggested (✦ badge)
  - Enabled (normal)
  - Locked (grayed, lock icon, upsell)
- Collapsible sections
- Scroll behavior

**3. ModuleUpsellPage**
- When user navigates to disabled module
- Module description and benefits
- Pricing options (a la carte or bundle)
- [Add Module] CTA
- [Upgrade Bundle] CTA

**4. ModuleToggle** (Settings page)
- ON/OFF switch
- Module name and description
- Pricing display
- Bundle inclusion indicator
- Upgrade prompts

---

## User Flows - Updated

### Flow 1: Create Deal → Enter Silo → Use Module

```
1. User clicks [+ Create Deal] from Pipeline
2. Modal wizard opens (/deals/new)
   - Step 1: Category (Portfolio vs Pipeline)
   - Step 2: Type (New vs Existing)
   - Step 3: Address (search + geocode)
   - Step 4: Trade Area (4 methods)
   - Step 5: Details (name, type, strategy, stage, budget)
3. User submits
4. System computes module suggestions based on type + strategy
5. Redirect to /deals/:dealId (Overview)
6. User sees deal silo layout:
   - Sidebar shows enabled modules
   - Suggested modules have ✦ badge
   - Overview page shows deal summary + quick actions
7. User clicks ✦ Financial Modeling Pro
8. Navigate to /deals/:dealId/financial-model
9. Module loads with deal context
10. User builds financial model
11. Clicks [← Back to Pipeline] to exit silo
```

### Flow 2: Enable/Disable Modules

```
1. User navigates to /settings/modules
2. Sees current bundle (e.g., Flipper - $89/mo)
3. Sees all modules grouped by category
4. User scrolls to "Development" section
5. Sees [OFF] Dev Budget Tracker - $29/mo (not in bundle)
6. User toggles [ON]
7. System checks subscription:
   - Not in bundle → Show upgrade prompt
   - "Add for $29/mo or upgrade to Developer bundle"
8. User clicks [Add Module]
9. Stripe checkout flow
10. Payment success
11. Module enabled globally
12. User returns to any deal silo
13. Sidebar now shows "Dev Budget Tracker" in Development section
14. User can navigate to /deals/:dealId/dev-budget
```

### Flow 3: Upsell Flow (Locked Module)

```
1. User in deal silo sidebar
2. Sees "🔒 Sensitivity Tester (Premium)"
3. Clicks on it (curiosity)
4. Navigate to /deals/:dealId/sensitivity
5. ModuleUpsellPage renders:
   - "Sensitivity Tester"
   - "Test your financial model against 100+ scenarios"
   - "$24/mo or included in Developer bundle"
   - [Add Module - $24/mo]
   - [Upgrade to Developer - $159/mo (saves $68/mo)]
6. User clicks [Add Module]
7. Stripe checkout
8. Success → Module enabled
9. Page refreshes → Module content loads
10. Sidebar updates → No longer locked
```

---

## Questions for Leon

1. **Deal Map Panel:** Should deal silo have a map panel (like three-panel layout) or just full-width content?
   - **Recommendation:** Optional toggle. Default OFF (full-width content). Toggle shows deal boundary + properties.

2. **Module Page Layout:** Should module pages use three-panel layout or custom layouts?
   - **Recommendation:** Custom layouts per module. Financial models need spreadsheet-style. DD checklists need forms. Map-heavy modules use three-panel.

3. **Back Navigation:** Where does "← Back to Pipeline" go?
   - **Options:**
     - A) Last pipeline view (map/grid/Kanban)
     - B) Always map view
     - C) User preference
   - **Recommendation:** Remember last view (localStorage)

4. **Module Data Migration:** Do we need to migrate existing deal data to module-specific tables?
   - **Recommendation:** New deals use new schema. Old deals remain in legacy tables. Build adapter layer.

5. **Bundle Pricing:** Confirm pricing for Phase 5 implementation
   - Flipper: $89/mo (7 modules)
   - Developer: $159/mo (19 modules)
   - Portfolio Manager: $219/mo (all 36+ modules)

---

## Next Steps

**Immediate (Today):**
1. Review this assessment
2. Confirm integration strategy
3. Answer questions above
4. Prioritize Phase 1 work

**This Week:**
1. Build DealSiloLayout component
2. Build ModuleSidebar component
3. Update COMPLETE_PLATFORM_WIREFRAME.md with deal silo section
4. Create first module page (Overview)

**Next Week:**
1. Build 11 standard feature pages
2. Build module permission resolver
3. Build Settings > Modules page
4. Test deal creation → silo entry flow

---

## Conclusion

The Deal Silo architecture (v9) and the current wireframe (v2.1) are **complementary, not competing**. 

- **Wireframe = Platform Layer:** Portfolio views, all deals, navigation
- **Deal Silo = Workspace Layer:** Individual deal deep-work, modules

Integration is clean:
1. User navigates deals in platform layer (map/grid/Kanban)
2. User clicks deal → Enters deal silo
3. User works in modules within silo
4. User clicks back → Returns to platform layer

**Recommendation:** Proceed with integration. Update wireframe to include deal silo section. Build foundation components this week.
