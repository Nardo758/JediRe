# Module Reorganization Proposal
**Date:** February 22, 2026  
**Goal:** Create a natural, intuitive flow that matches real estate development workflow

---

## Current Structure (Issues)

### Problems Identified:
1. **Scattered Modules:** Development modules exist but aren't in the sidebar
2. **Unclear Workflow:** No logical progression from research → analysis → execution
3. **Buried Features:** Market Intelligence hidden under "Intelligence" section
4. **Inconsistent Naming:** "Pipeline" vs "Deals", "Assets Owned" vs "Portfolio"
5. **Missing Connections:** Deal modules not connected to Market Intelligence
6. **No Context:** Modules don't show when they're relevant in the workflow

### Current Sidebar Structure:
```
Control Panel
├── Dashboard
├── Email
├── Pipeline (Deals)
└── Assets Owned

Intelligence
├── Market Intelligence
│   ├── My Markets
│   ├── Compare Markets
│   ├── Active Owners
│   └── Future Supply
└── News Intel

Tools
└── Tasks

Other
├── Reports
└── Team
```

---

## Proposed Structure (Natural Flow)

### User Journey:
1. **Discover** opportunities (research & intelligence)
2. **Analyze** markets & competition
3. **Develop** deals (create, design, diligence)
4. **Execute** (track progress, manage)
5. **Manage** portfolio

---

## New Module Organization

### 🔍 DISCOVER
**Purpose:** Find and research opportunities

```
🔍 Discover
├── 🏙️ Market Intelligence
│   ├── My Markets               [existing]
│   ├── Compare Markets          [existing]
│   ├── Active Owners            [existing]
│   └── Future Supply            [existing: 10-Year Supply Wave]
│
├── 📰 News & Alerts
│   ├── News Intelligence        [existing: News Intel]
│   └── Deal Alerts              [new: notify about opportunities]
│
└── 🗺️ Property Research
    ├── Property Explorer        [existing: Properties page]
    └── Ownership Tracking       [existing: Active Owners]
```

### 📊 ANALYZE
**Purpose:** Deep dive into specific opportunities

```
📊 Analyze
├── 🏘️ Competition Analysis     [existing: dev module]
│   ├── Competitive Properties
│   ├── Amenity Comparison
│   └── Pricing Strategy
│
├── 📈 Market Analysis          [existing: dev module]
│   ├── Demographics
│   ├── Supply & Demand
│   └── Market Trends
│
├── 🏗️ Supply Pipeline         [existing: dev module]
│   ├── Under Construction
│   ├── Planned Developments
│   └── Pipeline Impact
│
└── 💰 Financial Modeling
    ├── Underwriting
    ├── Proforma Analysis
    └── Scenario Planning
```

### 🏗️ DEVELOP
**Purpose:** Create and design deal opportunities

```
🏗️ Develop
├── 📋 My Deals
│   ├── Active Deals            [existing: Pipeline/Deals]
│   ├── Create New Deal         [existing]
│   └── Deal Templates          [new]
│
├── 🎨 Design Studio
│   ├── 3D Site Design          [existing: Design3DPage]
│   ├── Unit Mix Planning       [existing: in design]
│   └── Site Layout             [existing: in design]
│
├── 📋 Due Diligence           [existing: dev module]
│   ├── Checklist Manager
│   ├── Document Repository
│   └── Review Status
│
└── 📅 Timeline & Milestones   [existing: dev module]
    ├── Project Schedule
    ├── Critical Path
    └── Dependencies
```

### ✅ EXECUTE
**Purpose:** Track and manage active projects

```
✅ Execute
├── 🎯 Tasks & Workflow        [existing: Tasks]
│   ├── My Tasks
│   ├── Team Tasks
│   └── Deal Tasks
│
├── 📧 Communications          [existing: Email]
│   ├── Inbox
│   ├── Sent
│   └── Drafts
│
└── 📊 Deal Dashboard
    ├── Active Projects
    ├── Milestones Tracker
    └── Status Reports
```

### 🏢 PORTFOLIO
**Purpose:** Manage existing assets

```
🏢 Portfolio
├── 🏘️ My Properties          [existing: Assets Owned]
│   ├── Property List
│   ├── Performance Metrics
│   └── Documents
│
├── 💰 Financial Performance
│   ├── NOI Tracking
│   ├── Budget vs Actual
│   └── Portfolio Summary
│
└── 📈 Reports                 [existing]
    ├── Portfolio Reports
    ├── Market Reports
    └── Custom Reports
```

### ⚙️ SETTINGS & ADMIN
```
⚙️ Settings
├── 👥 Team Management         [existing]
├── 🔧 Preferences
├── 📦 Module Marketplace      [existing]
└── 🛠️ System Settings
```

---

## Key Improvements

### 1. **Contextual Modules**
Modules appear when relevant. For example:
- When viewing a deal → Show relevant analysis modules
- When in a market → Show market-specific tools
- When creating a deal → Guide through workflow

### 2. **Progressive Disclosure**
- Start simple (Discover)
- Add complexity as needed (Analyze)
- Guide users through stages

### 3. **Smart Navigation**
- Breadcrumbs show position in workflow
- "Next Steps" suggestions
- Related modules highlighted

### 4. **Module Badges**
Show status and activity:
- 🔴 **New** - Recently added module
- 🟡 **Action Required** - Needs attention
- 🟢 **Complete** - Finished/current
- 💎 **Premium** - Advanced features

### 5. **Workflow Integration**
Example flow:
1. User discovers opportunity in **Market Intelligence**
2. Click "Analyze This Market" → Opens **Competition Analysis**
3. Click "Create Deal" → Opens **Deal Creation** with market data pre-filled
4. Deal creation guides to **Design Studio**
5. Design complete → Suggests **Due Diligence** checklist
6. Launch project → Moves to **Execute** section

---

## Implementation Phases

### Phase 1: Reorganize Sidebar (1-2 hours)
- Restructure MainLayout.tsx navigation
- Create new section headers
- Move existing items to new structure
- Add expand/collapse for sections

### Phase 2: Smart Context (2-3 hours)
- Add "contextual modules" to deal pages
- Show relevant modules based on deal stage
- Add "Quick Actions" buttons

### Phase 3: Workflow Guidance (3-4 hours)
- Add "Next Steps" suggestions
- Create workflow progress indicators
- Add breadcrumb navigation

### Phase 4: Polish & UX (2-3 hours)
- Add module badges
- Improve transitions
- Add tooltips and help text
- Create onboarding tour

---

## Module Mapping (Old → New)

| Current Location | New Location | Notes |
|-----------------|--------------|-------|
| Pipeline | Develop → My Deals | Renamed for clarity |
| Assets Owned | Portfolio → My Properties | Better terminology |
| Market Intelligence | Discover → Market Intelligence | Top-level section |
| News Intel | Discover → News & Alerts | Better categorization |
| Properties | Discover → Property Research | More discoverable |
| Email | Execute → Communications | Part of workflow |
| Tasks | Execute → Tasks & Workflow | Action-oriented |
| Competition (dev module) | Analyze → Competition Analysis | Exposed in sidebar |
| Market Analysis (dev module) | Analyze → Market Analysis | Exposed in sidebar |
| Supply Pipeline (dev module) | Analyze → Supply Pipeline | Exposed in sidebar |
| Due Diligence (dev module) | Develop → Due Diligence | Part of deal workflow |
| Timeline (dev module) | Develop → Timeline & Milestones | Project management |
| Design 3D | Develop → Design Studio | Creative workspace |

---

## Visual Mockup (Sidebar)

```
┌─────────────────────────────┐
│ 🏢 JEDI RE                  │
├─────────────────────────────┤
│                             │
│ 🔍 DISCOVER            ▼   │
│   🏙️ Market Intelligence   │
│   📰 News & Alerts         │
│   🗺️ Property Research     │
│                             │
│ 📊 ANALYZE             ▶   │
│                             │
│ 🏗️ DEVELOP             ▼   │
│   📋 My Deals         (12) │
│   🎨 Design Studio         │
│   📋 Due Diligence         │
│   📅 Timeline              │
│                             │
│ ✅ EXECUTE             ▶   │
│                             │
│ 🏢 PORTFOLIO           ▶   │
│                             │
├─────────────────────────────┤
│ ⚙️ Settings                │
└─────────────────────────────┘
```

---

## Benefits

1. **Intuitive Flow:** Matches real estate development process
2. **Discoverability:** All modules visible and accessible
3. **Context-Aware:** Show relevant tools at right time
4. **Scalable:** Easy to add new modules in right category
5. **Professional:** Clear, organized, enterprise-grade
6. **Reduces Clicks:** Related items grouped together
7. **Guides Users:** Natural progression through workflow

---

## Next Steps

1. **Review & Approve:** Discuss this structure
2. **Prioritize:** Which phase to start with?
3. **Build:** Implement Phase 1 (sidebar reorganization)
4. **Test:** Get feedback from usage
5. **Iterate:** Refine based on real usage patterns

---

**Questions to Consider:**
- Do these categories match your workflow?
- Any modules missing from the organization?
- Should some sections start collapsed/expanded by default?
- Any naming preferences (e.g., "Develop" vs "Projects")?
