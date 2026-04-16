# JediRe UI Data Architecture

## Overview

Data flows through JediRe in a clear hierarchy:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   CREATE DEAL ──► DEAL CAPSULE ──► PORTFOLIO ──► DATA LIBRARY               │
│   (initial)       (active DD)      (owned)       (AI training)              │
│                                                                             │
│   ↓ uploads       ↓ uploads        ↓ uploads     ↓ aggregates               │
│   documents       documents        financials    all deal data              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. CREATE DEAL (Starting Point)

**Location:** `/create-deal`  
**File:** `frontend/src/pages/CreateDealPage.tsx`

### Current Steps:
```
Step 1: DETAILS & ADDRESS
        └── Property address (Google Places)
        └── Deal name
        └── Coordinates/Map

Step 2: PROJECT TYPE
        └── Existing / Development / Redevelopment

Step 3: CATEGORY
        └── Pipeline / Portfolio

Step 4: PROPERTY TYPE
        └── Multifamily, BTR, Mixed-Use, etc.

Step 5: DOCUMENTS ← CRITICAL DATA CAPTURE
        └── Upload initial docs (OM, photos, flyers)
        └── AI extracts: units, rents, cap rate, etc.

Step 6: TRADE AREA
        └── Define market boundary
        └── Auto-populate submarkets, MSA
```

### Proposed Enhancements:

```
Step 5: DOCUMENTS (Enhanced)
        ├── Drag & drop uploads
        ├── Auto-categorization (AI)
        ├── Extracted data preview:
        │   └── "Found: 200 units, $1,450 avg rent, 94% occupied"
        ├── Required docs indicator:
        │   └── "OM Required ⚠️"
        └── Link to Data Library: "Add to AI training set"

Step 7: INITIAL FINANCIALS (New)
        └── Purchase price (or range)
        └── Target cap rate
        └── Quick pro forma (optional)
```

---

## 2. DEAL CAPSULE (Active Deal)

**Location:** `/terminal?fkey=F2` → Click deal → `/deals/:id`  
**Purpose:** Primary workspace for active deals

### Current F-Key Structure (Deal View):
```
DEAL CAPSULE (when viewing a specific deal)
├── F1  Overview          ─ Summary, JEDI Score, Key Metrics
├── F2  Zoning            ─ Zoning profile, entitlements
├── F3  Market Intel      ─ Demographics, employment, trends
├── F4  Supply Pipeline   ─ Competing developments
├── F5  (varies)
├── F6  Strategy          ─ BTS/Rental/Flip analysis
├── F7  Traffic/3D        ─ Traffic analysis, 3D design
├── F8  Financial Engine  ─ Pro forma, underwriting
├── F9  Risk/DD           ─ Risk scores, JEDI assessment
├── F10 Comps             ─ Rent comps, sales comps
├── F11 Documents         ─ ⚠️ NEEDS PROMINENCE
└── F12 Execution         ─ Closing timeline
```

### Proposed: Elevate Documents to F3

```
DEAL CAPSULE (Proposed)
├── F1  Overview
├── F2  Zoning
├── F3  DOCUMENTS ← Move here (high visibility)
│       ├── All Files (grid/list view)
│       ├── By Category:
│       │   ├── Legal (LOI, PSA, Title)
│       │   ├── Financial (Rent Roll, T12, Pro Forma)
│       │   ├── Due Diligence (Phase I, Survey, PCA)
│       │   ├── Photos & Marketing
│       │   └── Closing
│       ├── Required Docs Checklist (by stage)
│       ├── Upload button
│       └── "Copy to Data Library" action
├── F4  Market Intel
├── F5  Supply Pipeline
├── F6  Strategy
├── F7  Financial Engine
├── F8  Risk/DD
├── F9  Comps
├── F10 Traffic/3D
├── F11 Execution
└── F12 (reserved)
```

---

## 3. PORTFOLIO (Owned Assets)

**Location:** `/terminal?fkey=F3`  
**File:** `TerminalPage.tsx` → F3 section

### Current F3 Tabs:
```
F3 PORTFOLIO
├── Rankings      ─ Assets ranked by performance
├── Grid          ─ All assets overview
├── Performance   ─ NOI variance, occupancy
├── Comps         ─ Comparable properties
└── Documents     ─ Already exists! ✓
```

### Proposed: Enhance Documents Tab

```
F3 PORTFOLIO → Documents Tab
├── Asset-level folders:
│   ├── Atlanta Development/
│   │   ├── Acquisition/ (from deal close)
│   │   ├── Operations/
│   │   │   ├── Rent Rolls/
│   │   │   ├── Financials/
│   │   │   └── Maintenance/
│   │   ├── Tax & Insurance/
│   │   └── Investor Reports/
│   └── Tampa MF/
│       └── ...
├── Bulk upload (drag folder)
├── Auto-categorization
└── "Sync to Data Library" toggle
```

### Operational Data Capture:

```
F3 PORTFOLIO → Performance Tab (Enhanced)
├── Upload Monthly/Quarterly Data:
│   ├── Rent Roll upload → Auto-parse units, rents, occupancy
│   ├── T12/P&L upload → Auto-extract NOI, expenses
│   └── Bank statements → Cash flow tracking
├── Variance Alerts:
│   └── "Occupancy dropped 3% vs. underwriting"
└── Export: LP Report Generator
```

---

## 4. DATA LIBRARY (AI Training)

**Location:** `/data-library`  
**File:** `frontend/src/pages/DataLibraryPage.tsx`

### Current Features:
```
DATA LIBRARY
├── File uploads with metadata:
│   ├── City, Zip
│   ├── Property Type
│   ├── Property Height
│   ├── Year Built
│   ├── Unit Count
│   └── Source Type (owned/market)
├── PST email parsing (Outlook exports)
├── File search & filters
└── Preview panel
```

### Proposed: Unified Knowledge Base

```
DATA LIBRARY (Enhanced)
├── SOURCES:
│   ├── Deal Documents (auto-synced from closed deals)
│   ├── Portfolio Financials (rent rolls, P&Ls)
│   ├── Market Research (uploaded reports)
│   ├── Email Intelligence (parsed PST)
│   └── Manual Uploads
│
├── DATA TYPES:
│   ├── Rent Comps (extracted from rent rolls)
│   ├── Sale Comps (from closing statements)
│   ├── Construction Costs (from GC bids)
│   ├── Operating Expenses (from P&Ls)
│   ├── Cap Rates (from deals)
│   └── Market Trends (from reports)
│
├── AI FEATURES:
│   ├── "Ask JEDI" ─ Query across all data
│   │   └── "What's the avg rent for 2BR in Tampa?"
│   ├── Auto-extract structured data from PDFs
│   ├── Trend analysis over time
│   └── Pro forma suggestions based on historical
│
└── PERMISSIONS:
    ├── Private (user's deals only)
    ├── Team (shared within org)
    └── Platform (anonymized, opt-in contribution)
```

---

## 5. ADMIN TOOLS (Links to Documents)

**Location:** `/admin`

### Document References (Not Primary Storage):

```
ADMIN TOOLS
├── Deal Intelligence
│   ├── Notes ─ Can attach/link documents
│   ├── Decisions ─ Reference supporting docs
│   └── Risks ─ Link to DD reports
│
├── Data Room (External Sharing)
│   └── Select docs from Deal → Share externally
│   └── Watermarked viewing
│   └── Access tracking
│
└── Verification
    └── Pull docs for KYC review
```

---

## 6. REPORTS

**Location:** `/terminal?fkey=F8`

### Document-Powered Reports:

```
F8 REPORTS
├── Generate from Data:
│   ├── Investor Update ─ Pull from Portfolio financials
│   ├── Deal Summary ─ Pull from Deal Capsule
│   ├── Market Report ─ Pull from Data Library
│   └── DD Summary ─ Pull from Deal Documents
│
├── Templates:
│   └── Select template → Auto-populate from docs
│
└── Export:
    ├── PDF (branded)
    ├── Excel (data tables)
    └── Presentation (slides)
```

---

## Complete Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ┌─────────────┐     ┌─────────────────┐     ┌─────────────┐                │
│  │ CREATE DEAL │────►│  DEAL CAPSULE   │────►│  PORTFOLIO  │                │
│  │             │     │                 │     │             │                │
│  │ • Address   │     │ F3 Documents:   │     │ Operations: │                │
│  │ • Type      │     │ • DD docs       │     │ • Rent rolls│                │
│  │ • Initial   │     │ • Legal         │     │ • Financials│                │
│  │   docs      │     │ • Financial     │     │ • CapEx     │                │
│  └─────────────┘     │ • Photos        │     └──────┬──────┘                │
│                      └────────┬────────┘            │                       │
│                               │                     │                       │
│                               ▼                     ▼                       │
│                      ┌────────────────────────────────────┐                 │
│                      │          DATA LIBRARY              │                 │
│                      │                                    │                 │
│                      │  • Aggregated deal data            │                 │
│                      │  • Extracted metrics               │                 │
│                      │  • AI-queryable knowledge base     │                 │
│                      │  • Powers future underwriting      │                 │
│                      └───────────────┬────────────────────┘                 │
│                                      │                                      │
│              ┌───────────────────────┼───────────────────────┐              │
│              ▼                       ▼                       ▼              │
│     ┌─────────────┐         ┌─────────────┐         ┌─────────────┐        │
│     │ ADMIN TOOLS │         │   REPORTS   │         │  JEDI AI    │        │
│     │             │         │             │         │             │        │
│     │ • Data Room │         │ • Investor  │         │ • "What's   │        │
│     │   sharing   │         │   updates   │         │   avg rent?"│        │
│     │ • DD links  │         │ • Deal      │         │ • Pro forma │        │
│     │             │         │   summaries │         │   suggest"  │        │
│     └─────────────┘         └─────────────┘         └─────────────┘        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Priorities

### Phase 1: Core Document Flow
1. ✅ Ensure CreateDealPage Step 5 (Documents) is prominent
2. Add F3 Documents tab to Deal Capsule (or elevate existing)
3. Add "Copy to Data Library" action on documents
4. Auto-sync closed deal docs to Data Library

### Phase 2: Portfolio Operations
5. Rent roll upload → auto-parse → Data Library
6. P&L upload → auto-extract NOI → Data Library
7. Variance tracking vs. underwriting

### Phase 3: AI Features
8. "Ask JEDI" interface in Data Library
9. Pro forma suggestions based on historical data
10. Trend analysis across all deals

### Phase 4: Reporting
11. Report templates pulling from Data Library
12. Investor update automation
13. Market report generation

---

## Navigation Summary

| Entry Point | Primary Data | Links To |
|-------------|--------------|----------|
| **Create Deal** | Initial property + docs | Deal Capsule |
| **Deal Capsule** | DD documents, financials | Portfolio (on close), Data Library |
| **Portfolio** | Operational data | Data Library, Reports |
| **Data Library** | All aggregated data | AI queries, Reports |
| **Admin Tools** | References only | Deal docs (via links) |
| **Reports** | Generated outputs | Data Library (source) |
