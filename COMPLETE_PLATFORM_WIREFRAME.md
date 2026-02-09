# JEDI RE - Complete Platform Wireframe

**Version:** 2.0 - Central Map Canvas Architecture  
**Created:** 2026-02-07  
**Status:** Design Specification

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Main Layout Structure](#main-layout-structure)
3. [Horizontal Bar - Map Layers](#horizontal-bar---map-layers)
4. [Vertical Sidebar - Data Navigation](#vertical-sidebar---data-navigation)
5. [Central Map Canvas](#central-map-canvas)
6. [Properties Silo - Deep Dive](#properties-silo---deep-dive)
7. [Pipeline Silo - Deep Dive](#pipeline-silo---deep-dive)
8. [Individual Deal Pages](#individual-deal-pages)
9. [User Flows](#user-flows)
10. [Interaction Patterns](#interaction-patterns)

---

## Architecture Overview

### Core Concept
**Central Map Canvas Model** - Everything layers onto a persistent map

**Three Control Layers:**
1. **Horizontal Bar** (Top) → Map layers & search
2. **Vertical Sidebar** (Left) → Data overlays & navigation
3. **Central Canvas** (Main) → Interactive map with layers

**Two View Modes:**
- **Map View** → Spatial overview with layered data
- **Grid View** → Detailed silo for deep work (Properties or Pipeline)

---

## Main Layout Structure

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  HORIZONTAL BAR (Map Layers & Tools)                                         │
│  [🔍 Search] [🗺️ War Maps] [📍 Custom 1] [📍 Custom 2]... [➕ Map] [➕ Deal] │
├────────────┬─────────────────────────────────────────────────────────────────┤
│  VERTICAL  │                                                                  │
│  SIDEBAR   │                                                                  │
│            │                                                                  │
│ 📊 Dashboard│               CENTRAL MAP CANVAS                               │
│ 🏢 Assets  │               (Always Visible)                                  │
│ 📁 Pipeline│                                                                  │
│ 📧 Email   │               - Mapbox base layer                               │
│ 📈 Reports │               - Property markers                                │
│ 👥 Team    │               - Deal boundaries                                 │
│ 🏗️ Arch    │               - Custom map layers                               │
│ ⚙️ Settings│               - Annotations & notes                             │
│            │                                                                  │
│            │                                                                  │
└────────────┴─────────────────────────────────────────────────────────────────┘
```

---

## Horizontal Bar - Map Layers

### Layout (Left to Right)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ [🔍 Google Search Bar - "Search for addresses, apartments, locations..."]              │
│                                                                                          │
│ [🗺️ War Maps*] [📍 Midtown Research] [📍 Competitor Analysis] [📍 Broker Recs]        │
│                                                                          [➕ Create Map] [➕ Create Deal] │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Components

#### 1. Google Search Bar
**Purpose:** Discovery & geocoding without leaving app

**Features:**
- Search addresses: "123 Peachtree St, Atlanta, GA"
- Search keywords: "apartments", "multifamily", "vacant land"
- Search results appear IN-APP (side panel or overlay)
- Click result → Add pin to map → Save to deal/asset
- Recent searches dropdown
- Search suggestions as you type

**Use Cases:**
- Read email about property → Search address → Add to map
- Research competitors → Search "luxury apartments Buckhead" → See results
- Validate broker recommendation → Search address → Verify location

---

#### 2. War Maps (Master Layer)
**Position:** First button after search bar  
**Icon:** 🗺️  
**Behavior:** Toggle on/off

**Purpose:** Master layer combining ALL maps

**When Active:**
- Shows all custom maps as layers
- Layer controls panel appears (right side):
  ```
  ┌─────────────────────┐
  │ 🗺️ War Maps        │
  │ ─────────────────── │
  │ ☑️ Midtown Research │  [👁️] [⚙️] [🔒]
  │ ☑️ Competitor       │  [👁️] [⚙️] [🔒]
  │ ☐ Broker Recs       │  [👁️] [⚙️] [🔒]
  │ ─────────────────── │
  │ Opacity: ████░░░░   │
  │ Blend Mode: Normal  │
  └─────────────────────┘
  ```
- Drag to reorder layers
- Toggle visibility per layer
- Adjust opacity (0-100%)
- Lock/unlock layers

---

#### 3. Custom Map Buttons
**Each map = Toggle button**

**Example:** `[📍 Midtown Research]`

**When Active (Blue highlight):**
- Layer appears on map
- Can draw, annotate, add pins
- Appears in War Maps layer list

**When Inactive (Gray):**
- Layer hidden
- Data preserved

**Click-hold menu:**
- Rename map
- Duplicate map
- Share map (link)
- Export map (PDF/image)
- Delete map

---

#### 4. Create New Map Button
**Position:** Top right (before Create Deal)  
**Icon:** ➕ Create Map

**Click action → Modal:**

```
┌─────────────────────────────────────────┐
│  Create New Map                    [X]  │
├─────────────────────────────────────────┤
│                                         │
│  Map Name: ___________________________  │
│                                         │
│  Description (optional):                │
│  ┌───────────────────────────────────┐  │
│  │                                   │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Map Type:                              │
│  ○ Research Map                         │
│  ○ Competitor Analysis                  │
│  ○ Market Intelligence                  │
│  ○ Custom                               │
│                                         │
│  [Cancel]              [Create Map]     │
└─────────────────────────────────────────┘
```

**Map Features Available:**
- ✏️ Drawing tools (polygon, circle, line, arrow)
- 📌 Pin markers with notes
- 📝 Text annotations
- 📷 Image attachments
- 🔗 Link to deals/properties
- 💬 Comments (team collaboration)
- 📤 Share link (view-only or edit)
- 📊 Export (PDF, PNG, GeoJSON)

---

#### 5. Create Deal Button
**Position:** Top right corner  
**Icon:** ➕ Create Deal

**Click action → 5-Step Wizard Modal** (as designed):
1. Category: Portfolio vs Pipeline
2. Development Type: New vs Existing
3. Address Entry (geocoding)
4. Boundary Drawing/Location
5. Deal Details

---

## Vertical Sidebar - Data Navigation

### Sidebar Structure

```
┌──────────────────┐
│  JEDI RE  🚀     │
│  Leon D          │
├──────────────────┤
│                  │
│ 📊 Dashboard     │
│                  │
│ 🏢 Assets Owned  │  23
│                  │
│ 📁 Pipeline      │   8
│                  │
│ 📧 Email         │   5
│                  │
│ 📈 Reports       │
│                  │
│ 👥 Team          │
│                  │
│ 🏗️ Architecture  │
│                  │
│ ⚙️ Settings      │
│                  │
└──────────────────┘
```

### Behavior

**Default State:** Nothing active, map shows base layer only

**When User Clicks Sidebar Item:**
- Item highlights (blue background)
- Corresponding data overlays on map
- OR switches to Grid View (for Assets/Pipeline)

**Multiple Active Items:**
- Dashboard + Assets → Shows dashboard stats + asset markers
- Assets + Pipeline → Shows both on map (color-coded)

**User Preferences:**
- Remember last active views
- Auto-restore on login

---

### Sidebar Items Detail

#### 📊 Dashboard
**View:** Map with stats overlay

**What Shows on Map:**
- All active deals (color-coded by status)
- All properties (if also toggled)
- Stats cards (floating panels):
  ```
  ┌─────────────────────────────┐
  │ 🏢 Portfolio Overview       │
  ├─────────────────────────────┤
  │ 1 deal active               │
  │ 23 properties               │
  │ 94% occupancy               │
  │ 8 opportunities             │
  └─────────────────────────────┘
  ```

---

#### 🏢 Assets Owned
**Default:** Activates property markers on map

**Switch to Grid View button** appears in header:
```
[Assets Owned - Map View]  [Switch to Grid View →]
```

**Map View:**
- All properties shown as markers
- Click marker → Property popup:
  ```
  ┌────────────────────────────┐
  │ 100 Peachtree St           │
  │ $2,100/mo • 2bd/2ba        │
  │ Building: A+               │
  │ Lease expires: Mar 2026    │
  │                            │
  │ [View Details]  [Add Note] │
  └────────────────────────────┘
  ```

**Grid View:** (Separate page - detailed below in Properties Silo)

---

#### 📁 Pipeline
**Default:** Activates deal boundaries on map

**Switch to Grid View button** appears:
```
[Pipeline - Map View]  [Switch to Grid View →]
```

**Map View:**
- All pipeline deals shown as boundaries (polygons)
- Color-coded by stage:
  - Lead: Gray
  - Qualified: Blue
  - Due Diligence: Yellow
  - Under Contract: Orange
  - Closing: Purple
  - Closed: Green
- Click boundary → Deal popup:
  ```
  ┌────────────────────────────────┐
  │ Buckhead Mixed-Use Development │
  │ multifamily • 228.3 acres      │
  │ Stage: Due Diligence           │
  │ 0 properties                   │
  │                                │
  │ [View Deal]  [Run Analysis]    │
  └────────────────────────────────┘
  ```

**Grid View:** (Separate page - detailed below in Pipeline Silo)

---

#### 📧 Email
**View:** Side panel (does not affect map)

**Layout:**
```
┌─────────┬────────────────────────────────┐
│ Sidebar │ Email Panel                    │
│         ├────────────────────────────────┤
│         │ [✉️ Compose]                   │
│         ├────────────────────────────────┤
│         │ 📥 Inbox (5)                   │
│         │                                │
│         │ broker@example.com             │
│         │ New listing in Buckhead        │
│         │ Check out this amazing prop... │
│         │                                │
│         │ owner@example.com              │
│         │ RE: Offer on 123 Main St       │
│         │ We accept your offer of...     │
│         │                                │
└─────────┴────────────────────────────────┘
```

---

#### 📈 Reports
**View:** Full-page report builder

---

#### 👥 Team
**View:** Team management page

---

#### 🏗️ Architecture
**View:** System architecture overlay (as designed)

---

#### ⚙️ Settings
**View:** Settings panel

---

## Central Map Canvas

### Always-On Features

**Base Map:**
- Mapbox GL JS
- Satellite Streets style (default)
- Style switcher: Satellite / Streets / Dark

**Navigation Controls:**
- Zoom in/out
- Rotate
- Pitch (3D)
- Compass reset
- Fullscreen

**Layer Stack (Bottom to Top):**
1. Base map (Mapbox)
2. Sidebar data overlays (Assets, Pipeline)
3. Custom map layers (from horizontal bar)
4. Drawing annotations
5. Popups and tooltips

---

### Map Interactions

**Click:**
- Property marker → Property popup
- Deal boundary → Deal popup
- Custom pin → Note/annotation popup

**Right-click:**
- Add pin here
- Add to deal
- Measure distance
- Get coordinates
- Street view (if available)

**Drawing Mode:**
- Activate from custom map toolbar
- Draw polygon, circle, line, arrow
- Add text label
- Attach image
- Save to current map layer

---

### Layer Controls Panel

**Position:** Floating panel (top-right, below horizontal bar)

**When Multiple Layers Active:**
```
┌─────────────────────────┐
│ 🗺️ Active Layers        │
├─────────────────────────┤
│ War Maps        [👁️] [⚙️] │
│ ├─ Midtown      [👁️] [⚙️] │
│ ├─ Competitor   [👁️] [⚙️] │
│ └─ Broker       [👁️] [🔒] │
│                          │
│ Assets Owned    [👁️] [⚙️] │
│ ├─ 23 properties        │
│ └─ Clustered            │
│                          │
│ Pipeline        [👁️] [⚙️] │
│ ├─ 8 deals              │
│ └─ By stage             │
├─────────────────────────┤
│ Legend:                  │
│ 🟢 Closed                │
│ 🟣 Closing               │
│ 🟠 Under Contract        │
│ 🟡 Due Diligence         │
│ 🔵 Qualified             │
│ ⚪ Lead                  │
└─────────────────────────┘
```

**Controls:**
- 👁️ Toggle visibility
- ⚙️ Layer settings (opacity, blend mode, z-index)
- 🔒 Lock layer (prevent edits)
- Drag to reorder

---

## Properties Silo - Deep Dive

### Entry Point
**From:** Sidebar → Assets Owned → [Switch to Grid View]

### Grid View Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  🏢 Assets Owned                          [← Back to Map]  [+ Show Architecture] │
│  Manage and analyze your property portfolio                          │
├──────────────────────────────────────────────────────────────────────┤
│  [🔍 Search properties...]  [All Classes ▼] [All Neighborhoods ▼] [Filter] │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ Total Props │  │ Avg Rent    │  │ Occupancy   │  │ Opportunities│ │
│  │     23      │  │   $2,247    │  │     94%     │  │      8      │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  PROPERTY LIST                                                        │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 🏢 100 Peachtree St NE                                         │  │
│  │ $2,100/mo • 2bd/2ba • 1,200 sqft • Built 2015                 │  │
│  │ Building: A+ • Lease expires: Mar 15, 2026 (38 days)          │  │
│  │ Current Lease: $2,100 • Market: $2,300 • Gap: $200/mo         │  │
│  │ Negotiation Power: HIGH (85/100)                               │  │
│  │ [View Details] [Run Analysis] [Export Report] [Add Note]      │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 🏢 250 Pharr Rd NE                                             │  │
│  │ $2,400/mo • 2bd/2ba • 1,350 sqft • Built 2018                 │  │
│  │ Building: A+ • Lease expires: Jun 30, 2026 (144 days)         │  │
│  │ Current Lease: $2,400 • Market: $2,450 • Gap: $50/mo          │  │
│  │ Negotiation Power: MODERATE (58/100)                           │  │
│  │ [View Details] [Run Analysis] [Export Report] [Add Note]      │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  [Load More...] (Showing 10 of 23)                                   │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

### Property Card - Expanded Features

**Click [View Details] → Property Detail Modal:**

```
┌───────────────────────────────────────────────────────────────────────┐
│  🏢 100 Peachtree St NE                                          [X]  │
├───────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────────────┐    BASIC INFORMATION                           │
│  │                  │    ───────────────────────────                  │
│  │   [Image]        │    Address: 100 Peachtree St NE, Atlanta, GA   │
│  │   🏢             │    Unit: 2402                                   │
│  │                  │    Beds/Baths: 2bd / 2ba                        │
│  └──────────────────┘    Square Feet: 1,200 sqft                     │
│                          Year Built: 2015                              │
│  Building Class: A+      Parking: 1 spot included                     │
│  Comparable Score: ████████░░ 82/100                                  │
│                                                                        │
├───────────────────────────────────────────────────────────────────────┤
│  RENT INFORMATION                                                      │
│  ─────────────────────────────────────────                            │
│  Current Rent: $2,100/mo ($1.75/sqft)                                │
│  Market Rent: $2,300/mo ($1.92/sqft)                                 │
│  Rent Gap: -$200/mo (9% below market) 📉                             │
│  Annual Upside: $2,400/year                                           │
│                                                                        │
├───────────────────────────────────────────────────────────────────────┤
│  LEASE INTELLIGENCE                                                    │
│  ─────────────────────────────────────────                            │
│  Lease Start: Mar 15, 2024                                            │
│  Lease Expiration: Mar 15, 2026 (38 days)⚠️                          │
│  Renewal Status: 🔴 Expiring                                          │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ 💪 NEGOTIATION POWER ANALYSIS                                   │ │
│  │ ─────────────────────────────────────────────                   │ │
│  │ Overall Score: 85/100 (HIGH)                                    │ │
│  │                                                                  │ │
│  │ Factors:                                                         │ │
│  │ ✅ Expires in <60 days (+30 pts)                                │ │
│  │ ✅ Below market rent (+25 pts)                                  │ │
│  │ ✅ Hot market (high demand) (+15 pts)                           │ │
│  │ ✅ Status: Expiring (+15 pts)                                   │ │
│  │                                                                  │ │
│  │ Recommendation:                                                  │ │
│  │ Strong leverage for rent increase or concessions. Tenant        │ │
│  │ likely motivated to renew at market rate to avoid moving.       │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                        │
├───────────────────────────────────────────────────────────────────────┤
│  AMENITIES                                                             │
│  ─────────────────────────────────────────                            │
│  [Pool] [Gym] [Doorman] [Pet Friendly] [In-Unit W/D] [Balcony]       │
│                                                                        │
├───────────────────────────────────────────────────────────────────────┤
│  NOTES & DOCUMENTS                                                     │
│  ─────────────────────────────────────────                            │
│  📝 Great tenant, always pays on time. Consider renewal offer.        │
│  📄 Lease Agreement.pdf                                               │
│  📄 Move-in Inspection.pdf                                            │
│                                                                        │
│  [+ Add Note] [+ Upload Document]                                     │
│                                                                        │
├───────────────────────────────────────────────────────────────────────┤
│  ACTIONS                                                               │
│  ─────────────────────────────────────────────                        │
│  [🗺️ View on Map] [📊 Run Analysis] [📤 Export Report] [🔗 Share]   │
│                                                                        │
└───────────────────────────────────────────────────────────────────────┘
```

---

### Property Features Available in Grid View

**Per Property:**
1. **View Details** → Full property modal (above)
2. **Run Analysis** → Property-level analysis:
   - Rent optimization recommendations
   - Comparable properties analysis
   - Market trends
   - Investment metrics (if applicable)
3. **Export Report** → PDF report with all property data
4. **Add Note** → Timestamped notes visible to team
5. **Lease Management:**
   - Track expiration dates
   - Set renewal reminders
   - Calculate negotiation leverage
   - Monitor rent vs market gap
6. **Document Storage:**
   - Lease agreements
   - Inspection reports
   - Maintenance records
   - Photos

**Portfolio-Level:**
1. **Bulk Actions:**
   - Export multiple properties
   - Bulk tag/categorize
   - Bulk analysis
2. **Portfolio Analytics:**
   - Total occupancy rate
   - Average rent/sqft
   - Expiration timeline (next 12 months)
   - Rollover risk score
   - Rent gap opportunities
3. **Filters & Search:**
   - Building class (A+, A, B+, B, C+)
   - Neighborhood
   - Rent range
   - Lease expiration window
   - Renewal status
   - Below/above market
4. **Reports:**
   - Portfolio performance report
   - Lease expiration report
   - Rent roll report
   - Market comparison report

---

## Pipeline Silo - Deep Dive

### Entry Point
**From:** Sidebar → Pipeline → [Switch to Grid View]

### Grid View Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  📁 Pipeline                              [← Back to Map]  [+ Create Deal] │
│  Track and manage your active deals                                   │
├──────────────────────────────────────────────────────────────────────┤
│  PIPELINE PROGRESS                                                    │
│                                                                       │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐ │
│  │  Lead  │  │Qualified│ │Due Dil.│ │Contract│ │Closing │ │ Closed │ │
│  │   0    │  │   0    │  │   0    │  │   0    │  │   0    │  │   0    │ │
│  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘ │
│                                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ Total Deals │  │  Qualified  │  │   In DD     │  │   Closed    │ │
│  │      1      │  │      0      │  │      0      │  │      0      │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  ACTIVE DEALS                                                         │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 🏗️ Buckhead Mixed-Use Development                              │  │
│  │ 📊 PIPELINE • 🏢 EXISTING • ACTIVE • BASIC                     │  │
│  │ 📍 3350 Peachtree Rd NE, Atlanta, GA 30326                     │  │
│  │ 🏠 multifamily • 228.3 acres • $52.5M budget                   │  │
│  │ 0 properties • Stage: Lead                                     │  │
│  │                                                                 │  │
│  │ Quick Stats:                                                    │  │
│  │ • JEDI Score: Not yet analyzed                                 │  │
│  │ • Created: Feb 5, 2026                                         │  │
│  │ • Last Updated: 2 days ago                                     │  │
│  │                                                                 │  │
│  │ [View Deal] [Run Analysis] [Move to Next Stage] [Archive]     │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  [+ Create Deal]                                                      │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

### Deal Card - Expanded Actions

**[View Deal] → Opens Individual Deal Page** (detailed below)

**[Run Analysis] → Triggers JEDI Score Analysis:**
- Runs Python capacity analyzer
- Calculates development potential
- Analyzes market signals
- Generates recommendations
- Returns JEDI Score (0-100) with verdict

**[Move to Next Stage] → Stage Transition:**
```
┌───────────────────────────────────┐
│  Move Deal to Next Stage     [X] │
├───────────────────────────────────┤
│                                   │
│  Current Stage: Lead              │
│  Next Stage: Qualified            │
│                                   │
│  Notes (optional):                │
│  ┌──────────────────────────────┐ │
│  │ Met with seller, deal looks  │ │
│  │ promising. Moving forward.   │ │
│  └──────────────────────────────┘ │
│                                   │
│  [Cancel]         [Move Forward] │
└───────────────────────────────────┘
```

**[Archive] → Archives deal:**
- Moves to archived list
- Preserves all data
- Can be restored later

---

## Individual Deal Pages

### Deal View Structure

**URL:** `/deals/:dealId`

**Layout:**

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Back to Pipeline                             [+ Show Architecture] │
├──────────────────────────────────────────────────────────────────────┤
│  🏗️ Buckhead Mixed-Use Development                                   │
│  📊 PIPELINE • 🏢 EXISTING • ACTIVE • BASIC                          │
│  📍 3350 Peachtree Rd NE, Atlanta, GA 30326                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────┐                                                 │
│  │ SIDEBAR         │  MAIN CONTENT AREA                              │
│  │                 │  (Changes based on selected module)             │
│  │ Overview        │                                                  │
│  │ Properties      │                                                  │
│  │ Strategy        │                                                  │
│  │ Pipeline        │                                                  │
│  │ AI Agents       │                                                  │
│  │ Analysis        │                                                  │
│  │ Email           │                                                  │
│  │ Reports         │                                                  │
│  └─────────────────┘                                                 │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

### Module 1: Overview

**Default landing page for deal**

```
┌──────────────────────────────────────────────────────────────────────┐
│  DEAL SUMMARY                                                         │
│  ───────────────────────────────────────────                         │
│                                                                       │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │ 🏢 Properties  │  │ 💰 Est. Budget │  │ ⏱️ Timeline   │        │
│  │      0         │  │   $52.5M       │  │  24 months    │        │
│  └────────────────┘  └────────────────┘  └────────────────┘        │
│                                                                       │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │ 📊 JEDI Score  │  │ 🎯 Stage       │  │ 📈 Confidence │        │
│  │  Not analyzed  │  │    Lead        │  │     --        │        │
│  └────────────────┘  └────────────────┘  └────────────────┘        │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  MAP VIEW                                                             │
│  ───────────────────────────────────────────                         │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                                                                 │  │
│  │              [MAPBOX MAP WITH DEAL BOUNDARY]                    │  │
│  │                                                                 │  │
│  │              • Shows deal boundary (polygon)                    │  │
│  │              • Properties within boundary (if any)              │  │
│  │              • Nearby properties                                │  │
│  │              • Zoning overlay (toggle)                          │  │
│  │                                                                 │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  QUICK ACTIONS                                                        │
│  ───────────────────────────────────────────                         │
│                                                                       │
│  [🔍 Find Properties]  [🎯 Run Analysis]  [📊 Generate Report]       │
│  [📧 Email Team]       [📝 Add Note]      [🗑️ Archive Deal]          │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  RECENT ACTIVITY                                                      │
│  ───────────────────────────────────────────                         │
│                                                                       │
│  • Feb 6, 2026 - Deal created by Leon D                             │
│  • Feb 6, 2026 - Boundary defined (228.3 acres)                     │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

### Module 2: Properties

**Shows all properties within deal boundary**

```
┌──────────────────────────────────────────────────────────────────────┐
│  PROPERTIES IN DEAL                                                   │
│  ───────────────────────────────────────────                         │
│                                                                       │
│  [🔍 Search properties...]  [Building Class ▼]  [Filters ▼]  [Add ▼] │
│                                                                       │
│  Found 0 properties within boundary                                   │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                                                                 │  │
│  │                   No properties found yet                       │  │
│  │                                                                 │  │
│  │           Properties within the deal boundary will              │  │
│  │           appear here automatically, or you can:                │  │
│  │                                                                 │  │
│  │           [🔍 Search Nearby Properties]                         │  │
│  │           [➕ Add Property Manually]                            │  │
│  │           [📍 Import from Map]                                  │  │
│  │                                                                 │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  When properties exist, each shows:                                   │
│  • Address, rent, beds/baths                                         │
│  • Building class                                                     │
│  • Lease intelligence                                                │
│  • Negotiation power score                                           │
│  • Distance from deal center                                         │
│  • Actions: View, Analyze, Remove from deal                          │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Property Search Options:**
- **Search Nearby:** Searches within X miles of deal center
- **Add Manually:** Enter address, validate, add to deal
- **Import from Map:** Click properties on map to add to deal

---

### Module 3: Strategy

**Lease analysis, rollover risk, rent gap opportunities**

```
┌──────────────────────────────────────────────────────────────────────┐
│  DEAL STRATEGY & ANALYSIS                                             │
│  ───────────────────────────────────────────                         │
│                                                                       │
│  LEASE INTELLIGENCE                                                   │
│  ───────────────────────────────────────────                         │
│                                                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │ Expiring 30d    │  │ Expiring 90d    │  │ Rollover Risk   │     │
│  │       0         │  │       0         │  │     0/100       │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│                                                                       │
│  No properties in deal yet. Add properties to see lease analysis.    │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  RENT GAP OPPORTUNITY                                                 │
│  ───────────────────────────────────────────                         │
│                                                                       │
│  Current Avg Lease: --                                               │
│  Market Rate:       --                                               │
│  Monthly Gap:       --                                               │
│  Annual Upside:     --                                               │
│                                                                       │
│  Add properties to calculate rent gap opportunity.                   │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  EXPIRATION TIMELINE (Next 12 Months)                                │
│  ───────────────────────────────────────────                         │
│                                                                       │
│  [Bar chart showing lease expirations by month]                      │
│                                                                       │
│  No data available yet.                                              │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

### Module 4: Pipeline

**6-stage Kanban board for deal progression**

```
┌──────────────────────────────────────────────────────────────────────┐
│  DEAL PIPELINE STAGES                                                 │
│  ───────────────────────────────────────────                         │
│                                                                       │
│  Current Stage: ● Lead                                               │
│  Last Updated: Feb 6, 2026 by Leon D                                 │
│                                                                       │
│  ┌────────┬────────┬────────┬────────┬────────┬────────┐            │
│  │ Lead   │Qualified│Due Dil.│Contract│Closing │Closed  │            │
│  │   ●    │        │        │        │        │        │            │
│  ├────────┼────────┼────────┼────────┼────────┼────────┤            │
│  │        │        │        │        │        │        │            │
│  │  This  │        │        │        │        │        │            │
│  │  Deal  │        │        │        │        │        │            │
│  │        │        │        │        │        │        │            │
│  └────────┴────────┴────────┴────────┴────────┴────────┘            │
│                                                                       │
│  Progress: ████░░░░░░░░░░░░░░░░░░░░░░░░░░ 17% (1/6 stages)         │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  STAGE DETAILS: Lead                                                  │
│  ───────────────────────────────────────────                         │
│                                                                       │
│  ✅ Tasks for this stage:                                            │
│  ☐ Initial property research                                         │
│  ☐ Contact broker/seller                                             │
│  ☐ Get preliminary financials                                        │
│  ☐ Schedule site visit                                               │
│                                                                       │
│  📝 Notes:                                                            │
│  Initial research phase. Evaluating feasibility.                     │
│                                                                       │
│  [Add Task]  [Add Note]  [Move to Next Stage →]                     │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  STAGE HISTORY                                                        │
│  ───────────────────────────────────────────                         │
│                                                                       │
│  • Feb 6, 2026 - Moved to Lead by Leon D                            │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Stage Actions:**
- **Add Task:** Custom checklist per stage
- **Add Note:** Timestamped notes for stage
- **Move to Next Stage:** Advances deal (with optional note)
- **Move to Previous Stage:** Regresses deal (with reason)

---

### Module 5: AI Agents

**4 specialist agents coordinated by Chief Orchestrator**

```
┌──────────────────────────────────────────────────────────────────────┐
│  AI AGENTS                                                            │
│  ───────────────────────────────────────────                         │
│                                                                       │
│  🤖 Chief Orchestrator                                               │
│  Status: ● Online                                                    │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Chat with Chief Orchestrator                                    │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │                                                                 │  │
│  │ 🤖 Hi! I'm your Chief Orchestrator. I coordinate all          │  │
│  │    specialist agents to help you analyze properties and       │  │
│  │    deals. What would you like to work on?                     │  │
│  │                                                                 │  │
│  │ 👤 Run analysis on this Buckhead deal.                        │  │
│  │                                                                 │  │
│  │ 🤖 I'll coordinate with the agents to analyze this deal.      │  │
│  │    - Market Agent is researching Buckhead market data         │  │
│  │    - Development Agent is analyzing capacity                  │  │
│  │    - Financial Agent is building proforma                     │  │
│  │    - Risk Agent is evaluating zoning/regulations              │  │
│  │                                                                 │  │
│  │    [Analysis in progress... 45% complete]                     │  │
│  │                                                                 │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │ [Type message...]                                    [Send]    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  SPECIALIST AGENTS                                                    │
│  ───────────────────────────────────────────────                     │
│                                                                       │
│  ┌─────────────────────────┐  ┌─────────────────────────┐          │
│  │ 📊 Market Agent         │  │ 🏗️ Development Agent    │          │
│  │ Status: ● Working       │  │ Status: ● Working       │          │
│  │                         │  │                         │          │
│  │ Current Task:           │  │ Current Task:           │          │
│  │ Analyzing Buckhead      │  │ Calculating capacity    │          │
│  │ market trends           │  │ for 228.3 acres         │          │
│  │                         │  │                         │          │
│  │ [View Details]          │  │ [View Details]          │          │
│  └─────────────────────────┘  └─────────────────────────┘          │
│                                                                       │
│  ┌─────────────────────────┐  ┌─────────────────────────┐          │
│  │ 💰 Financial Agent      │  │ ⚠️ Risk Agent           │          │
│  │ Status: ● Working       │  │ Status: ● Working       │          │
│  │                         │  │                         │          │
│  │ Current Task:           │  │ Current Task:           │          │
│  │ Building proforma       │  │ Checking zoning rules   │          │
│  │ projections             │  │                         │          │
│  │                         │  │                         │          │
│  │ [View Details]          │  │ [View Details]          │          │
│  └─────────────────────────┘  └─────────────────────────┘          │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Agent Features:**
- **WebSocket Connection:** Real-time updates from agents
- **Task Queue:** See what each agent is working on
- **Results:** Each agent delivers findings to Chief
- **History:** View past agent interactions and results

---

### Module 6: Analysis

**JEDI Score results and recommendations**

**Before Analysis Run:**

```
┌──────────────────────────────────────────────────────────────────────┐
│  DEAL ANALYSIS                                                        │
│  ───────────────────────────────────────────                         │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                                                                 │  │
│  │                  No analysis run yet                            │  │
│  │                                                                 │  │
│  │         Click the button below to run comprehensive             │  │
│  │         development analysis on this deal.                      │  │
│  │                                                                 │  │
│  │         Analysis includes:                                      │  │
│  │         • Development capacity estimation                       │  │
│  │         • Market signal processing                              │  │
│  │         • Property quality scoring                              │  │
│  │         • Location factor analysis                              │  │
│  │         • JEDI Score (0-100)                                    │  │
│  │         • AI recommendations                                    │  │
│  │                                                                 │  │
│  │                    [🎯 Run Analysis]                            │  │
│  │                                                                 │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**After Analysis (JEDI Score Display):**

```
┌──────────────────────────────────────────────────────────────────────┐
│  JEDI SCORE ANALYSIS                                                  │
│  ───────────────────────────────────────────                         │
│  Last Updated: Feb 7, 2026 at 2:45 PM                                │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                                                                 │  │
│  │                      ┌─────────────┐                            │  │
│  │                      │             │                            │  │
│  │                      │     72      │  🟢 OPPORTUNITY            │  │
│  │                      │             │                            │  │
│  │                      │  JEDI Score │                            │  │
│  │                      └─────────────┘                            │  │
│  │                                                                 │  │
│  │         Confidence: ████████░░ 85% (High)                       │  │
│  │                                                                 │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  COMPONENT SCORES                                                     │
│  ───────────────────────────────────────────                         │
│                                                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │ Development     │  │ Market Signals  │  │ Quality         │     │
│  │ Capacity        │  │                 │  │                 │     │
│  │                 │  │                 │  │                 │     │
│  │      28/30      │  │      22/30      │  │      14/20      │     │
│  │   VERY HIGH     │  │      HIGH       │  │      GOOD       │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│                                                                       │
│  ┌─────────────────┐                                                 │
│  │ Location Factor │                                                 │
│  │                 │                                                 │
│  │                 │                                                 │
│  │      8/20       │                                                 │
│  │   MODERATE      │                                                 │
│  └─────────────────┘                                                 │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  PROJECT ESTIMATES                                                    │
│  ───────────────────────────────────────────                         │
│                                                                       │
│  Estimated Units:       240 units                                    │
│  Estimated Cost:        $52.8M                                       │
│  Development Timeline:  24 months                                    │
│  Units/Acre:           1.05 (optimal density)                        │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  AI RECOMMENDATIONS                                                   │
│  ───────────────────────────────────────────                         │
│                                                                       │
│  1. Strong Development Opportunity                                   │
│     Site has excellent capacity for multifamily development.         │
│     Zoning allows for optimal density.                               │
│                                                                       │
│  2. Market Conditions Favorable                                      │
│     Buckhead market showing consistent growth. Demand for            │
│     luxury units is strong with limited new supply.                  │
│                                                                       │
│  3. Consider Phased Approach                                         │
│     Given the size (228 acres), consider developing in phases        │
│     to manage risk and capture market appreciation.                  │
│                                                                       │
│  4. Location Enhancement Needed                                      │
│     Score: 8/20. Consider amenities to boost location appeal:        │
│     • Walkability improvements                                       │
│     • Public transit access                                          │
│     • Retail/commercial ground floor                                 │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  ACTIONS                                                              │
│  ───────────────────────────────────────────                         │
│                                                                       │
│  [🔄 Re-run Analysis]  [📊 Export Report]  [📧 Email Team]           │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Verdict System:**
- **80-100: STRONG_OPPORTUNITY** (🟢 Green) - Highly recommended
- **65-79: OPPORTUNITY** (🔵 Blue) - Recommended with conditions
- **45-64: NEUTRAL** (⚪ Gray) - Proceed with caution
- **30-44: CAUTION** (🟡 Yellow) - Significant concerns
- **0-29: AVOID** (🔴 Red) - Not recommended

---

### Module 7: Email

**Email integration within deal context**

```
┌──────────────────────────────────────────────────────────────────────┐
│  DEAL EMAILS                                                          │
│  ───────────────────────────────────────────────                     │
│                                                                       │
│  [✉️ Compose New Email]                                              │
│                                                                       │
│  Showing emails related to: Buckhead Mixed-Use Development           │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ broker@example.com                               Feb 6, 10:30 AM │  │
│  │ New listing in Buckhead                                         │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │ Check out this amazing property at 3350 Peachtree Rd NE...     │  │
│  │                                                                 │  │
│  │ [Reply] [Forward] [Link to Deal] [Archive]                     │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ owner@example.com                                Feb 5, 3:45 PM │  │
│  │ RE: Offer on Buckhead property                                 │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │ We accept your offer of $52.5M. Let's schedule due diligence...│  │
│  │                                                                 │  │
│  │ [Reply] [Forward] [Link to Deal] [Archive]                     │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  [Load More...]                                                       │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Email Features:**
- Auto-link emails to deals (by address/keywords)
- Search/filter by deal
- Quick reply within deal context
- Forward with deal details attached
- Archive/unarchive

---

### Module 8: Reports

**Custom report generation**

```
┌──────────────────────────────────────────────────────────────────────┐
│  DEAL REPORTS                                                         │
│  ───────────────────────────────────────────                         │
│                                                                       │
│  GENERATE NEW REPORT                                                  │
│  ───────────────────────────────────────                             │
│                                                                       │
│  Report Type:                                                         │
│  ○ Executive Summary                                                 │
│  ○ Full Analysis Report                                              │
│  ○ Property Comparison                                               │
│  ○ Financial Proforma                                                │
│  ● Custom Report                                                     │
│                                                                       │
│  Include:                                                             │
│  ☑ Deal overview                                                     │
│  ☑ JEDI Score analysis                                               │
│  ☑ Property list                                                     │
│  ☑ Market data                                                       │
│  ☑ Financial projections                                             │
│  ☐ Zoning analysis                                                   │
│  ☐ Risk assessment                                                   │
│                                                                       │
│  Format:                                                              │
│  ○ PDF  ● Excel  ○ Word                                              │
│                                                                       │
│  [Generate Report]                                                    │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  SAVED REPORTS                                                        │
│  ───────────────────────────────────────────────                     │
│                                                                       │
│  📄 Executive Summary - Feb 6, 2026.pdf                              │
│  📄 JEDI Analysis Report - Feb 6, 2026.pdf                           │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## User Flows

### Flow 1: Create New Deal

1. **User clicks [➕ Create Deal]** (top right horizontal bar)
2. **5-Step Wizard opens:**
   - **Step 1:** Select category (Portfolio/Pipeline)
   - **Step 2:** Select development type (New/Existing)
   - **Step 3:** Enter address → Geocode
   - **Step 4:** Draw boundary (new) or confirm location (existing)
   - **Step 5:** Enter deal details (name, description, tier)
3. **Submit → Deal created**
4. **Redirects to Deal Overview page**

---

### Flow 2: Analyze a Deal

1. **User on Pipeline Grid View**
2. **Clicks [View Deal]** on deal card
3. **Deal Overview page opens**
4. **Clicks sidebar → Analysis**
5. **Clicks [🎯 Run Analysis]**
6. **Analysis runs (10-30 seconds):**
   - Python engine processes data
   - Calculates JEDI Score
   - Generates recommendations
7. **JEDI Score displayed** with verdict and components
8. **User can [📊 Export Report]** or [📧 Email Team]

---

### Flow 3: Add Properties to Deal

1. **User on Deal View → Properties module**
2. **Clicks [🔍 Search Nearby Properties]**
3. **Search modal opens:**
   ```
   ┌─────────────────────────────────┐
   │ Search Properties Near Deal     │
   ├─────────────────────────────────┤
   │                                 │
   │ Search Radius: [1 mile ▼]      │
   │                                 │
   │ Filters:                        │
   │ ☐ Multifamily only              │
   │ ☐ Building class A+ or A        │
   │ ☐ Available for sale            │
   │                                 │
   │ [Cancel]    [Search]            │
   └─────────────────────────────────┘
   ```
4. **Results show in list**
5. **User selects properties → [Add to Deal]**
6. **Properties now linked to deal**
7. **Appear in Properties module**
8. **Show on map within deal boundary**

---

### Flow 4: Layer Custom Map on Dashboard

1. **User clicks [📊 Dashboard]** in sidebar
2. **Dashboard loads with base map (no overlays)**
3. **User clicks [📍 Midtown Research]** in horizontal bar
4. **Custom map layer activates:**
   - Annotations appear on map
   - Pins/drawings visible
   - Layer controls panel appears
5. **User clicks [🗺️ War Maps]**
6. **All custom maps layer on top**
7. **User can toggle individual layers on/off**
8. **Adjust opacity, reorder layers**

---

### Flow 5: Collaborate on Custom Map

1. **User creates [➕ Create Map]**
2. **Names it "Broker Recommendations"**
3. **Draws annotations on map:**
   - Circles around target properties
   - Text labels with notes
   - Pins at broker-recommended locations
4. **Clicks map menu → [📤 Share]**
5. **Share modal opens:**
   ```
   ┌─────────────────────────────────┐
   │ Share Map                       │
   ├─────────────────────────────────┤
   │                                 │
   │ Share Link:                     │
   │ https://jedire.com/maps/abc123  │
   │ [Copy Link]                     │
   │                                 │
   │ Permissions:                    │
   │ ○ View Only                     │
   │ ● View & Comment                │
   │ ○ Full Edit Access              │
   │                                 │
   │ Expires:                        │
   │ [7 days ▼]                      │
   │                                 │
   │ [Cancel]    [Share]             │
   └─────────────────────────────────┘
   ```
6. **Team members open link**
7. **View map + add comments:**
   - Click pin → Add comment
   - Reply to comments
   - Real-time updates (WebSocket)

---

## Interaction Patterns

### Map + Sidebar Sync

**Rule:** Sidebar selections control what data overlays on map

**Examples:**

**Scenario 1:**
- User clicks **Assets Owned** → Property markers appear
- User clicks **Pipeline** → Deal boundaries also appear
- Both visible simultaneously

**Scenario 2:**
- User clicks **Dashboard** → Stats overlay + no specific data
- User clicks **Assets Owned** → Stats + property markers
- User clicks **Pipeline** → Stats + properties + deals (all visible)

**Scenario 3:**
- User on **Dashboard** (map view)
- User clicks **Assets Owned → Grid View**
- Switches to full-page grid (leaves map)
- Map no longer visible

---

### Custom Map Layer Behavior

**Rule:** Custom maps are ADDITIVE layers on top of sidebar data

**Examples:**

**Scenario 1:**
- **Sidebar:** Dashboard (base map)
- **Horizontal:** [📍 Midtown Research] clicked
- **Result:** Midtown Research annotations appear on empty map

**Scenario 2:**
- **Sidebar:** Assets Owned (properties on map)
- **Horizontal:** [📍 Competitor Analysis] clicked
- **Result:** Properties + Competitor annotations both visible

**Scenario 3:**
- **Sidebar:** Assets + Pipeline (both on map)
- **Horizontal:** [🗺️ War Maps] clicked
- **Result:** Assets + Pipeline + ALL custom maps visible

---

### Toggle States

**Horizontal Bar Buttons:**
- **Inactive:** Gray, no layer visible
- **Active:** Blue highlight, layer visible on map
- **Click:** Toggles on/off

**Sidebar Items:**
- **Inactive:** No highlight, no data on map
- **Active:** Blue background, data overlays on map
- **Click:** Activates/deactivates (can have multiple active)

**Special Case - Grid View:**
- When switching to Grid View (Assets or Pipeline), map is hidden
- Horizontal bar buttons become inactive (not visible)
- [← Back to Map] button returns to map view

---

### Google Search Integration

**Search Types:**

**Address Search:**
- User types: "123 Peachtree St, Atlanta, GA"
- Result: Geocoded location, shown on map
- Actions:
  - [📍 Add Pin]
  - [➕ Add to Deal]
  - [🏢 Add as Property]

**Keyword Search:**
- User types: "luxury apartments Buckhead"
- Result: List of apartments in-app (side panel)
- Results show:
  - Name, address, rent range
  - Distance from map center
  - Thumbnail image
- Actions:
  - [📍 Show on Map]
  - [➕ Add to Deal]
  - [🔍 View Details]

---

## Summary

### Architecture Recap

**Three Layers of Control:**

1. **Horizontal Bar (Map Context)**
   - Google Search for discovery
   - War Maps master layer
   - Custom map buttons (user-created)
   - Create Map / Create Deal actions

2. **Vertical Sidebar (Data Navigation)**
   - Dashboard, Assets, Pipeline, Email, Reports, Team, Settings
   - Controls which data overlays on map
   - Switches between Map View and Grid View (for Assets/Pipeline)

3. **Central Map Canvas (Visual Workspace)**
   - Always visible (except in Grid View)
   - Layers stack: Base → Sidebar Data → Custom Maps → Annotations
   - Interactive: Click markers/boundaries → Popups
   - Collaborative: Draw, annotate, share

---

### Key Workflows

1. **Deal Creation:** 5-step wizard → Portfolio/Pipeline categorization
2. **Deal Analysis:** Run JEDI Score → Get verdict + recommendations
3. **Property Management:** Grid View for details, Map View for spatial
4. **Custom Maps:** Create layers for research, share with team
5. **Collaboration:** Layer maps, comment, share links

---

### Design Principles

- **Map-Centric:** Everything visualized spatially
- **Layered:** Multiple data sources visible simultaneously
- **Context-Aware:** Sidebar + horizontal bar work together
- **Flexible:** Users control what they see
- **Collaborative:** Share maps, comment, work together

---

**Next Steps:**
1. Build horizontal bar component
2. Refactor sidebar to control map overlays
3. Implement custom map creation
4. Build layer controls panel
5. Integrate Google Search
6. Test user flows

---

**End of Wireframe Document**

**Total Pages:** Individual deal pages have 8 modules each  
**Total Features:** 50+ across platform  
**Architecture:** Central Map Canvas Model

**Ready to build!** 🚀

---

## Grid View Specifications - Comprehensive Tracking

**Added:** 2026-02-08 21:23 EST  
**Purpose:** Detailed grid views for Pipeline (pre-acquisition) and Assets Owned (post-acquisition) tracking

---

### Pipeline Grid View (Pre-Acquisition Tracking)

**URL:** `/deals/pipeline/grid`  
**Access:** Pipeline → [Switch to Grid View]

#### Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│  📁 Pipeline / Grid View                    [Toggle: Grid | Kanban]        │
│  [Export CSV] [Export Excel] [Filters ▼] [Columns ▼]         [+ Create Deal]│
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Grouped Column Headers (Collapsible):                                     │
│  ┌──────────┬───────────┬────────────┬──────────┬────────────┐            │
│  │ Identity │ Financial │ Strategy   │ Market   │ Velocity   │            │
│  │ & Status │ Snapshot  │ Arbitrage  │ Context  │ Metrics    │            │
│  ├──────────┼───────────┼────────────┼──────────┼────────────┤            │
│  │ • Name   │ • Ask $   │ • Best     │ • Supply │ • Source   │            │
│  │ • Address│ • JEDI $  │   Strategy │   Risk   │ • LOI Date │            │
│  │ • Type   │ • IRR (B) │ • Confidence│ • Absorb │ • Close    │            │
│  │ • Units  │ • IRR (J) │ • Spread   │ • Imbal. │ • DD %     │            │
│  │ • Stage  │ • NOI     │ • Signal   │ • Growth │ • Compete  │            │
│  │ • Days   │ • Cap     │            │          │            │            │
│  │ • AI Score│ • Equity  │            │          │            │            │
│  └──────────┴───────────┴────────────┴──────────┴────────────┘            │
│                                                                             │
│  Row 1: (with visual indicators)                                           │
│  ───────────────────────────────────────────────────────────────────────── │
│  🟢⭐ Midtown Plaza         $45M → $38M     Build-to-Sell (92)  ⚠️ 1,240u  │
│      123 Peachtree St      IRR: 18%→22%    Spread: $4.2M       Absorb: 45  │
│      Multifamily, 450u     NOI: $3.2M      Signal: 88          Imbal: 72   │
│      LOI | 12d | Score: 94                                  DD: 0% | 2 bids│
│  ───────────────────────────────────────────────────────────────────────── │
│  🟡 Buckhead Tower          ...                                             │
│  ───────────────────────────────────────────────────────────────────────── │
│                                                                             │
│  Showing 1-50 of 127 deals | Pagination: [< 1 2 3 4 5 >]                 │
└────────────────────────────────────────────────────────────────────────────┘
```

#### Complete Column Definitions

**Group 1: Identity & Status (7 columns)**
| Column | Type | Description | Sortable | Filterable |
|--------|------|-------------|----------|------------|
| Property Name | Text | Deal name/identifier | ✓ | ✓ |
| Address | Text | Full property address | ✓ | ✓ |
| Asset Type | Enum | Multifamily, Office, Retail, etc. | ✓ | ✓ |
| Unit Count / SF | Number | Size metric | ✓ | ✓ |
| Pipeline Stage | Enum | Sourced, Under Review, LOI, Contract, DD, Closing | ✓ | ✓ |
| Days in Stage | Number | Days since stage change (⚠️ if >30) | ✓ | ✓ |
| AI Opportunity Score | 0-100 | Strategy Arbitrage confidence | ✓ | ✓ |

**Group 2: Financial Snapshot (12 columns)**
| Column | Type | Description | Sortable | Filterable |
|--------|------|-------------|----------|------------|
| Ask Price | Currency | Broker/seller asking price | ✓ | ✓ |
| Price per Unit/SF | Currency | Normalized pricing | ✓ | ✓ |
| JEDI Adjusted Price | Currency | AI-recommended price | ✓ | ✓ |
| Going-in Cap (Broker) | % | Seller's pro forma cap | ✓ | ✓ |
| Going-in Cap (JEDI) | % | AI-adjusted cap rate | ✓ | ✓ |
| Projected IRR (Broker) | % | Seller's projected IRR | ✓ | ✓ |
| Projected IRR (JEDI) | % | AI-realistic IRR range | ✓ | ✓ |
| Pro Forma NOI | Currency | Broker's NOI projection | ✓ | ✓ |
| JEDI Adjusted NOI | Currency | AI-adjusted NOI | ✓ | ✓ |
| Equity Required | Currency | Down payment needed | ✓ | ✓ |
| Target DSCR | Ratio | Debt service coverage | ✓ | ✓ |
| Debt Leverage | % | LTV ratio | ✓ | ✓ |

**Group 3: Strategy Arbitrage (4 columns)**
| Column | Type | Description | Sortable | Filterable |
|--------|------|-------------|----------|------------|
| Best Strategy | Enum | Build-to-Sell, Flip, Rental, Airbnb | ✓ | ✓ |
| Confidence Score | 0-100 | Confidence in best strategy | ✓ | ✓ |
| Strategy Spread | Currency | Delta between best/worst | ✓ | ✓ |
| Arbitrage Signal | 0-100 | Hidden ROI strength | ✓ | ✓ |

**Group 4: Market Context (5 columns)**
| Column | Type | Description | Sortable | Filterable |
|--------|------|-------------|----------|------------|
| Supply Risk Flag | Boolean | ⚠️ if high competing supply | ✓ | ✓ |
| Competing Units | Number | Units delivering in area | ✓ | ✓ |
| Absorption Rate | Number | Units absorbed/month | ✓ | ✓ |
| Rent Growth Forecast | % | 12-month projection | ✓ | ✓ |
| Imbalance Score | 0-100 | Supply-demand balance | ✓ | ✓ |

**Group 5: Velocity Metrics (6 columns)**
| Column | Type | Description | Sortable | Filterable |
|--------|------|-------------|----------|------------|
| Source | Enum | Broker, Off-Market, Network, News | ✓ | ✓ |
| Competing Offers | Number | Known competing bids | ✓ | ✓ |
| LOI Deadline | Date | Letter of intent deadline | ✓ | ✓ |
| Inspection Period End | Date | DD inspection deadline | ✓ | ✓ |
| Closing Date | Date | Target close date | ✓ | ✓ |
| DD Checklist % | % | Due diligence completion | ✓ | ✓ |

**Total: 34 columns**

#### Visual Indicators

**Status Badges:**
- 🟢 On Track - progressing normally
- 🟡 Attention - approaching deadline / stalled
- 🔴 Risk - missed deadline / critical issue
- ⭐ High Confidence - AI score >85

**Alert Icons:**
- ⚠️ Supply Risk - high competing supply
- 🚨 Stalled - >30 days in current stage
- 💰 Value Gap - JEDI price significantly below ask
- 🎯 Strong Arbitrage - high strategy spread (>$2M)

---

### Assets Owned Grid View (Post-Acquisition Tracking)

**URL:** `/deals/owned/grid`  
**Access:** Assets Owned → [Switch to Grid View]

#### Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│  🏢 Assets Owned / Grid View                [Toggle: Grid | Map]            │
│  [Export CSV] [Export Excel] [Filters ▼] [Columns ▼]         [Add Asset]    │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Grouped Column Headers (Collapsible):                                     │
│  ┌──────────┬───────────┬────────────┬──────────┬────────────┬──────────┐ │
│  │ Identity │ Perform.  │ Returns    │ Oper.    │ Market     │ Risk     │ │
│  │          │ vs UW     │ Tracking   │ Health   │ Position   │ Monitor  │ │
│  ├──────────┼───────────┼────────────┼──────────┼────────────┼──────────┤ │
│  │ • Name   │ • NOI     │ • Curr IRR │ • Occ    │ • AI Score │ • Loan   │ │
│  │ • Address│ • Occ %   │ • Proj IRR │   Trend  │ • Supply   │   Maturity│
│  │ • Type   │ • Rent    │ • CoC      │ • Rent   │ • Comp     │ • Refi   │ │
│  │ • Acq Dt │ • Variance│ • Equity M │   Growth │   Position │   Risk   │ │
│  │ • Hold   │           │ • Distrib  │ • Opex % │ • Concess. │ • Market │ │
│  │          │           │ • Gain/Loss│ • Capex  │            │   Signals│ │
│  └──────────┴───────────┴────────────┴──────────┴────────────┴──────────┘ │
│                                                                             │
│  Row 1: (with variance highlighting)                                       │
│  ───────────────────────────────────────────────────────────────────────── │
│  🟢 Park Avenue Apts    NOI: $2.1M (vs $1.9M) +10.5%    IRR: 24% (vs 18%)  │
│      345 Park Ave       Occ: 96% (vs 92%) +4%           CoC: 16%           │
│      Multifamily, 120u  Rent: $1,850 (vs $1,750) +5.7%  Eq M: 1.8x        │
│      Acq: Jan 2024      Variance: Outperforming ✅      Distrib: $420K     │
│  ───────────────────────────────────────────────────────────────────────── │
│  🟡 Midtown Tower       NOI: $1.5M (vs $1.8M) -16.7%   ...                 │
│  ───────────────────────────────────────────────────────────────────────── │
│                                                                             │
│  Showing 1-20 of 45 owned deals | Pagination: [< 1 2 3 >]                 │
└────────────────────────────────────────────────────────────────────────────┘
```

#### Complete Column Definitions

**Group 1: Identity (5 columns)**
| Column | Type | Description | Sortable | Filterable |
|--------|------|-------------|----------|------------|
| Property Name | Text | Asset name | ✓ | ✓ |
| Address | Text | Full property address | ✓ | ✓ |
| Asset Type | Enum | Property type | ✓ | ✓ |
| Acquisition Date | Date | Purchase date | ✓ | ✓ |
| Hold Period | Months | Months since acquisition | ✓ | ✓ |

**Group 2: Performance vs Underwriting (13 columns)**
| Column | Type | Description | Sortable | Filterable |
|--------|------|-------------|----------|------------|
| Actual NOI | Currency | TTM net operating income | ✓ | ✓ |
| Pro Forma NOI | Currency | Underwritten NOI | ✓ | ✓ |
| NOI Variance | % | (Actual - PF) / PF | ✓ | ✓ |
| Actual Occupancy | % | Current occupancy rate | ✓ | ✓ |
| Projected Occupancy | % | Underwritten occupancy | ✓ | ✓ |
| Occupancy Variance | % | Actual - Projected | ✓ | ✓ |
| Actual Rent/Unit | Currency | Current average rent | ✓ | ✓ |
| Underwritten Rent | Currency | Pro forma rent | ✓ | ✓ |
| Rent Variance | % | (Actual - UW) / UW | ✓ | ✓ |
| Actual Concessions | Currency | Current concessions/unit | ✓ | ✓ |
| Projected Concessions | Currency | Underwritten concessions | ✓ | ✓ |
| Actual Cap Rate | % | Current NOI / Value | ✓ | ✓ |
| Going-in Cap Rate | % | Acquisition cap rate | ✓ | ✓ |

**Group 3: Returns Tracking (8 columns)**
| Column | Type | Description | Sortable | Filterable |
|--------|------|-------------|----------|------------|
| Current IRR | % | Internal rate of return | ✓ | ✓ |
| Projected IRR | % | Underwritten IRR | ✓ | ✓ |
| IRR Variance | % | Current - Projected | ✓ | ✓ |
| Cash-on-Cash Return | % | Current period CoC | ✓ | ✓ |
| Equity Multiple | Ratio | Current equity multiple | ✓ | ✓ |
| Projected Exit Multiple | Ratio | Underwritten exit | ✓ | ✓ |
| Total Distributions | Currency | Cumulative distributions | ✓ | ✓ |
| Unrealized Gain/Loss | Currency | Market value - basis | ✓ | ✓ |

**Group 4: Operational Health (11 columns)**
| Column | Type | Description | Sortable | Filterable |
|--------|------|-------------|----------|------------|
| Occupancy Trend (3mo) | % | 3-month average | ✓ | ✓ |
| Occupancy Trend (6mo) | % | 6-month average | ✓ | ✓ |
| Occupancy Trend (12mo) | % | 12-month average | ✓ | ✓ |
| Rent Growth Achieved | % | Actual vs forecast | ✓ | ✓ |
| Rent Growth Forecast | % | Underwritten growth | ✓ | ✓ |
| Opex Ratio | % | Operating expenses / Revenue | ✓ | ✓ |
| Budget Opex Ratio | % | Underwritten opex | ✓ | ✓ |
| Capex Spend | Currency | Actual capex to date | ✓ | ✓ |
| Capex Budget | Currency | Underwritten capex | ✓ | ✓ |
| Capex Timeline % | % | Schedule completion | ✓ | ✓ |
| Lease Renewal Rate | % | Renewals (trailing 12mo) | ✓ | ✓ |

**Group 5: Market Position (5 columns)**
| Column | Type | Description | Sortable | Filterable |
|--------|------|-------------|----------|------------|
| Current AI Score | 0-100 | Updated opportunity score | ✓ | ✓ |
| Updated Supply Pipeline | Number | Competing units in area | ✓ | ✓ |
| Comp Rent Position | Enum | Above/At/Below market | ✓ | ✓ |
| Property Concessions | Currency | Your concessions | ✓ | ✓ |
| Comp Concessions | Currency | Market average | ✓ | ✓ |

**Group 6: Value-Add Progress (6 columns, if applicable)**
| Column | Type | Description | Sortable | Filterable |
|--------|------|-------------|----------|------------|
| Renovation % Complete | % | Value-add completion | ✓ | ✓ |
| Renovation Budget Var | % | Actual vs budget | ✓ | ✓ |
| Renovated Unit Rent | Currency | Avg rent renovated | ✓ | ✓ |
| Unrenovated Unit Rent | Currency | Avg rent unrenovated | ✓ | ✓ |
| Rent Premium Achieved | % | (Ren - Unren) / Unren | ✓ | ✓ |
| Timeline Variance | Days | Days ahead/behind | ✓ | ✓ |

**Group 7: Risk Monitoring (6 columns)**
| Column | Type | Description | Sortable | Filterable |
|--------|------|-------------|----------|------------|
| Loan Maturity Date | Date | Debt maturity | ✓ | ✓ |
| Months to Maturity | Number | Months until refi | ✓ | ✓ |
| Refi Risk Flag | Boolean | ⚠️ if <12 months | ✓ | ✓ |
| Interest Rate Sensitivity | % | Impact of +1% rate | ✓ | ✓ |
| Market Risk Signals | Number | Negative news count | ✓ | ✓ |
| Portfolio Concentration | % | % in this submarket | ✓ | ✓ |

**Total: 54 columns**

#### Visual Indicators

**Performance Badges:**
- 🟢 Outperforming - beating underwriting
- 🟡 On Track - within 5% of pro forma
- 🔴 Underperforming - >10% below pro forma
- ⭐ Value-Add Success - achieving premiums

**Alert Icons:**
- ⚠️ Refi Risk - approaching loan maturity (<12 months)
- 🚨 Underperforming - significant variance
- 💰 Value-Add Opportunity - market shift detected
- 🎯 Exit Window - favorable exit conditions

**Variance Highlighting:**
- Green text - Positive variance (beating pro forma)
- Red text - Negative variance (below pro forma)
- Gray text - Neutral / no variance

---

### Grid Features (Both Views)

#### 1. Column Management
- **Show/Hide Columns:** Toggle visibility via dropdown
- **Reorder Columns:** Drag column headers to reorder
- **Resize Columns:** Drag column borders
- **Group Collapse/Expand:** Click group header to collapse entire section
- **Save Custom Views:** Save preferred column configurations

#### 2. Filtering
- **Text Filters:** Search by name, address
- **Range Filters:** Price, occupancy, IRR ranges
- **Date Filters:** Acquisition date, LOI deadline
- **Enum Filters:** Asset type, stage, source (multiselect)
- **Boolean Filters:** Supply risk, refi risk toggles
- **Advanced:** Combine multiple filters with AND/OR

#### 3. Sorting
- **Single Column:** Click header to sort asc/desc
- **Multi-Column:** Shift+click for secondary sort
- **Save Sort:** Remember last sort preference

#### 4. Export
- **CSV:** All columns, current filter/sort
- **Excel:** Formatted with color coding, formulas
- **PDF:** Current view only (visible columns)
- **Email Report:** Schedule automated exports

#### 5. Bulk Actions
- **Select Multiple:** Checkbox selection
- **Update Stage:** Move multiple deals
- **Assign Owner:** Assign to team member
- **Add Tags:** Bulk tagging
- **Archive:** Archive multiple

#### 6. Quick Actions (per row)
- **View Details:** Navigate to deal page
- **Run Analysis:** Trigger JEDI score
- **Add Note:** Quick note dialog
- **Send Email:** Compose email about deal
- **More:** Additional actions menu

---

### Implementation Priority

#### MVP Phase (Core Grid - Implement First)

**Pipeline Grid MVP (20 columns):**
- Identity & Status: All 7 columns
- Financial Snapshot: Ask Price, JEDI Price, IRR (Broker), IRR (JEDI), NOI
- Strategy Arbitrage: Best Strategy, Confidence Score
- Market Context: Supply Risk Flag, Imbalance Score
- Velocity: Source, LOI Deadline, Closing Date, DD %

**Assets Owned Grid MVP (25 columns):**
- Identity: All 5 columns
- Performance vs UW: NOI (Actual, PF, Variance), Occupancy (Actual, PF, Variance), Rent (Actual, UW, Variance)
- Returns: Current IRR, Projected IRR, CoC, Equity Multiple, Distributions
- Operational: Occupancy Trend (12mo), Rent Growth, Opex Ratio, Capex Spend
- Risk: Loan Maturity, Refi Risk Flag

**MVP Features:**
- ✓ Sortable columns
- ✓ Basic filtering (text, range, enum)
- ✓ Export CSV
- ✓ View Details action
- ✓ Visual indicators (badges, alerts)
- ✓ Responsive layout

**MVP Exclusions (Phase 2):**
- Column reordering
- Custom views
- Excel export
- Bulk actions
- Email reports

---

### Data Requirements

**Pipeline Grid Dependencies:**
- deals table (core data)
- deal_analysis table (Strategy Arbitrage results)
- deal_trade_areas table (Market Context)
- properties table (supply risk calculations)
- news_events table (market signals)

**Assets Owned Grid Dependencies:**
- deals table (acquisition data)
- deal_performance table (actuals vs pro forma) ← NEW TABLE NEEDED
- properties table (operational data)
- deal_analysis table (ongoing AI scoring)
- market_data table (comp positioning)

---

**End of Grid View Specifications**

---

