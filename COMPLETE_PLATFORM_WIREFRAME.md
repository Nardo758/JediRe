# JEDI RE - Complete Platform Wireframe

**Version:** 2.2 - Central Map Canvas + Three-Panel Layout + Module System  
**Created:** 2026-02-07  
**Last Updated:** 2026-02-09 (Module System Update)  
**Status:** Production Implementation

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Main Layout Structure](#main-layout-structure)
3. [Horizontal Bar - Map Layers](#horizontal-bar---map-layers)
4. [Vertical Sidebar - Data Navigation](#vertical-sidebar---data-navigation)
5. [Central Map Canvas](#central-map-canvas)
6. [Three-Panel Layout System](#three-panel-layout-system)
7. [Properties Silo - Deep Dive](#properties-silo---deep-dive)
8. [Pipeline Silo - Deep Dive](#pipeline-silo---deep-dive)
9. [Individual Deal Pages](#individual-deal-pages)
10. [User Flows](#user-flows)
11. [Interaction Patterns](#interaction-patterns)

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

## Three-Panel Layout System

### Overview

**Component:** `ThreePanelLayout.tsx`  
**Purpose:** Standardized 3-panel split-view layout for all data pages  
**Status:** Production (Deployed Feb 8-9, 2026)

**Pages Using ThreePanelLayout:**
- News Intelligence (`/news-intel`)
- Email (`/dashboard/email`)
- Pipeline/Deals (`/deals`)
- Assets Owned (`/assets-owned`)
- Market Data (`/market-data`)
- Dashboard (Portfolio Overview) (`/dashboard`)

---

### Panel Structure

```
┌──────────────────────────────────────────────────────────────────────┐
│  HORIZONTAL BAR (MapTabsBar - global)                                │
├────────┬─────────────────────────────┬──────────────────────────────┤
│ PANEL 1│      PANEL 2: CONTENT       │  PANEL 3: MAP                │
│ Views  │      (Resizable)            │  (Always visible)            │
│ 64-80px│      400-1400px             │  (Flex-1)                    │
│        │                             │                              │
│ [📋]   │  ┌───────────────────────┐  │  ┌────────────────────────┐ │
│ Feed   │  │                       │  │  │                        │ │
│        │  │   Event cards         │  │  │    Mapbox GL JS        │ │
│ [📊]   │  │   Property list       │  │  │                        │ │
│ Dash   │  │   Email threads       │  │  │    • Deal boundaries   │ │
│        │  │   Deal Kanban         │  │  │    • Property markers  │ │
│ [🔗]   │  │   Asset grid          │  │  │    • Event markers     │ │
│ Network│  │                       │  │  │    • Custom layers     │ │
│        │  │   (Scrollable)        │  │  │                        │ │
│ [🔔]   │  │                       │  │  │    (Interactive)       │ │
│ Alerts │  │                       │  │  │                        │ │
│        │  └───────────────────────┘  │  └────────────────────────┘ │
│        │                             │                              │
│        │  [Resize Handle]            │                              │
│        │       ║                     │                              │
└────────┴─────────────────────────────┴──────────────────────────────┘
             ▲                                      ▲
         Toggle Controls (top-right):
         [◀ Views] [◀ Content] [Map ▶] [⤢ Maximize]
```

---

### Panel Features

#### Panel 1: Views Sidebar (Optional)

**Visibility:** Conditional - only shown if page has multiple views  
**Width:** 64-80px fixed  
**Background:** White  
**Purpose:** Quick navigation between page views

**Pages with Views:**
- **News Intelligence:** 4 views (Event Feed, Dashboard, Network Intelligence, Alerts)

**Pages without Views:**
- Email, Pipeline, Assets Owned, Market Data (single view per page)

**View Items:**
```typescript
interface ViewItem {
  id: string;
  label: string;
  icon: string;     // Emoji (e.g., "📋", "📊", "🔗", "🔔")
  count?: number;   // Badge count (e.g., unread emails, alerts)
}
```

**Example:**
```
┌────────┐
│  📋   │
│  Feed  │  ← Active (blue background)
│        │
│  📊   │
│  Dash  │  ← Inactive (gray text)
│   [3]  │  ← Badge count
│        │
│  🔗   │
│Network │
└────────┘
```

---

#### Panel 2: Content Panel

**Width:** Resizable (400px - 1400px)  
**Default:** 550px  
**Background:** Light gray (`bg-gray-50`)  
**Purpose:** Main content area for each page

**Content Types:**
- **News Intel:** Event cards (horizontal layout with full impact data)
- **Email:** Email list with sender, subject, preview
- **Pipeline:** Kanban board with deal cards
- **Assets Owned:** Property grid/cards with performance metrics
- **Market Data:** Market trends, comps, demographics tables

**Resize Handle:**
- **Position:** Right edge of content panel (1px wide)
- **Visual:** Gray bar, blue on hover
- **Behavior:** Click and drag horizontally
- **Constraints:** Min 400px, Max 1400px
- **Persistence:** Saved to localStorage per page

**Maximize Feature:** *(Added Feb 9, 2026)*
- **Button:** `[⤢ Maximize]` in top-right toggle controls
- **Behavior:** 
  - Hides map panel
  - Expands content to full width (minus views panel if present)
  - Button changes to `[⤡ Restore]`
  - Clicking restore brings back map panel at previous size
- **Use Cases:**
  - Deep work in Kanban board (Pipeline)
  - Reviewing large property grid (Assets)
  - Reading long email threads (Email)

---

#### Panel 3: Map Panel

**Width:** Flexible (flex-1, fills remaining space)  
**Background:** Map (Mapbox GL JS)  
**Purpose:** Spatial context for all data

**Always Visible Rule:**
- At least one panel (Content or Map) must be visible at all times
- If user tries to hide both → Map automatically shows
- This safeguard prevents blank screen

**Map Content (by page):**
- **News Intel:** Event markers color-coded by category + deal boundaries
- **Email:** Email locations (if geocoded) + deal boundaries
- **Pipeline:** Deal boundaries color-coded by stage + property markers
- **Assets Owned:** Property markers clustered + ownership boundaries
- **Market Data:** Market boundary overlays + comp property markers

**Map Interactions:**
- Click event/property → Highlight in content panel
- Click content item → Zoom to location on map
- Bi-directional sync between content and map

---

### Toggle Controls

**Position:** Fixed top-right corner (z-index: 20, above content)  
**Layout:** Horizontal button row

**Buttons:**

1. **[◀ Views]** / **[▶ Views]**
   - Only visible if page has views panel
   - Toggles Panel 1 visibility
   - Blue when visible, white when hidden
   - Keyboard: `V` (future enhancement)

2. **[◀ Content]** / **[▶ Content]**
   - Toggles Panel 2 visibility
   - Blue when visible, white when hidden
   - Keyboard: `C` (future enhancement)

3. **[Map ▶]** / **[◀ Map]**
   - Toggles Panel 3 visibility
   - Blue when visible, white when hidden
   - Keyboard: `M` (future enhancement)

4. **[⤢ Maximize]** / **[⤡ Restore]** *(New!)*
   - Maximizes content panel (full-width)
   - Hides map while maximized
   - Restores map on un-maximize
   - Keyboard: `F` (future enhancement)

**Button Styles:**
```css
Active (panel visible):
- Background: Blue (#2563eb)
- Text: White
- Shadow: md
- Hover: Darker blue (#1e40af)

Inactive (panel hidden):
- Background: White
- Text: Gray (#374151)
- Border: Light gray
- Hover: Light gray background
```

---

### State Persistence

**localStorage Keys (per page):**
- `{storageKey}-content-width` → Content panel width (px)
- `{storageKey}-show-views` → Views panel visibility (boolean)
- `{storageKey}-show-content` → Content panel visibility (boolean)
- `{storageKey}-show-map` → Map panel visibility (boolean)

**Example:**
```javascript
// News Intelligence page
localStorage.getItem('news-content-width')     // "650"
localStorage.getItem('news-show-views')        // "true"
localStorage.getItem('news-show-content')      // "true"
localStorage.getItem('news-show-map')          // "true"

// Email page (no views panel)
localStorage.getItem('email-content-width')    // "800"
localStorage.getItem('email-show-content')     // "true"
localStorage.getItem('email-show-map')         // "false"  // Maximized
```

**Benefits:**
- User preferences persist across sessions
- Each page remembers its own layout
- Reduce cognitive load (no re-adjusting every time)

---

### Responsive Behavior

**Desktop (1920px+):**
- All three panels visible by default
- Comfortable resize range (400-1400px for content)

**Laptop (1366px-1920px):**
- All panels fit, but tighter
- Default content width: 550px
- Map gets minimum ~600px

**Tablet (768px-1366px):**
- Views panel collapses by default
- Content + Map side-by-side
- Toggle views as overlay/drawer

**Mobile (< 768px):** *(Future)*
- Single panel view (content OR map)
- Bottom tabs to switch
- Full-screen map or content

---

### Implementation Details

**Component Props:**
```typescript
interface ThreePanelLayoutProps {
  storageKey: string;              // Unique ID for localStorage (e.g., 'news', 'email')
  views?: ViewItem[];              // Optional view items for Panel 1
  activeView?: string;             // Currently active view ID
  onViewChange?: (viewId: string) => void;
  renderContent: (viewId?: string) => ReactNode;  // Content panel renderer
  renderMap: () => ReactNode;      // Map panel renderer
  showViewsPanel?: boolean;        // Override views panel visibility
  defaultContentWidth?: number;    // Initial width (default: 550)
  minContentWidth?: number;        // Min resize (default: 400)
  maxContentWidth?: number;        // Max resize (default: 1400)
  onNewMap?: () => void;           // Optional: Create Map button handler
}
```

**Usage Example (News Intelligence):**
```tsx
<ThreePanelLayout
  storageKey="news"
  views={tabs}                     // 4 views: Feed, Dashboard, Network, Alerts
  activeView={activeView}
  onViewChange={setActiveView}
  renderContent={renderContent}    // Event cards, metrics, etc.
  renderMap={renderMap}            // Mapbox with event markers
  defaultContentWidth={550}
  minContentWidth={400}
  maxContentWidth={1400}
/>
```

---

### Recent Improvements (Feb 9, 2026)

**1. Maximize Content Panel**
- **Commit:** 3d7f857
- **Feature:** New maximize button in toggle controls
- **Behavior:** Full-width content, hides map temporarily
- **Use Case:** Deep work sessions (Kanban, property analysis)

**2. Increased Max Width**
- **Old:** 800px
- **New:** 1400px
- **Reason:** Support wider content (Kanban board, property grids)

**3. Panel Visibility Persistence**
- **Commit:** 4e05090
- **Feature:** Save/load panel states from localStorage
- **Impact:** User preferences persist across sessions

**4. Safeguard for Blank Screen**
- **Issue:** Could hide all panels simultaneously
- **Fix:** Auto-show map if both content and map hidden
- **Benefit:** Prevents accidental blank screen

**5. Rendering Optimizations**
- **Commit:** aefe05e
- **Changes:**
  - `useRef` for accurate resize calculations
  - Conditional data loading (auth-based)
  - Prevent duplicate fetches (useRef for category tracking)
- **Impact:** Smoother interactions, faster page loads

---

### Future Enhancements

**Planned:**
- Keyboard shortcuts (`V`, `C`, `M`, `F`)
- Mobile responsive breakpoints
- Panel animations (slide in/out)
- Snap-to-size presets (small/medium/large)
- Multi-panel layouts (4-panel for advanced users)
- Panel layouts saved to user profile (sync across devices)

**Under Consideration:**
- Vertical split mode (content above/below map)
- Picture-in-picture map (small floating map when content maximized)
- Panel docking (detach panels to separate windows)

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

**ARCHITECTURE UPDATE (Feb 9, 2026):** Modules are NOT sidebar navigation items. They are contextual tools that enhance sections on a single comprehensive page.

---

### Deal Page Structure

**URL:** `/deals/:dealId`

**Key Principles:**
1. **Single comprehensive page** with expandable sections (no nested routes)
2. **Modules enhance sections** in-place (basic vs pro features)
3. **All sections always visible** (upsell prompts for inactive modules)
4. **No module sidebar** - Settings > Modules controls global activation

**Layout:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back to Pipeline (Grid)                     [+ Show Architecture]    │
├─────────────────────────────────────────────────────────────────────────┤
│  🏗️ Buckhead Mixed-Use Development                                      │
│  📊 PIPELINE • 🏢 EXISTING • ACTIVE • BASIC                             │
│  📍 3350 Peachtree Rd NE, Atlanta, GA 30326                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  EXPANDABLE SECTIONS (Accordion on mobile):                             │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 📊 Overview                                                    [▼] │ │
│  │ Basic info, map, quick stats (always visible)                      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 🏢 Properties                                                  [▼] │ │
│  │ Properties within deal boundary (always visible)                   │ │
│  │ 🔒 Enhanced with "Property Intelligence" module (if active)        │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 💰 Financial Analysis                                          [▲] │ │
│  │                                                                     │ │
│  │ ┌─ BASIC (no module) ──────────────────────────────────────────┐  │ │
│  │ │ Simple calculator: Purchase price, NOI, Cap Rate              │  │ │
│  │ │ Monthly payment, basic metrics                                │  │ │
│  │ │                                                                │  │ │
│  │ │ ┌──────────────────────────────────────────────────────────┐ │  │ │
│  │ │ │ 🔓 Upgrade to Financial Modeling Pro                      │ │  │ │
│  │ │ │                                                            │ │  │ │
│  │ │ │ Get access to:                                             │ │  │ │
│  │ │ │ • Component-based pro-forma builder (13 blocks)           │ │  │ │
│  │ │ │ • Sensitivity analysis & stress testing                   │ │  │ │
│  │ │ │ • Monte Carlo simulations                                 │ │  │ │
│  │ │ │ • Waterfall distribution models                           │ │  │ │
│  │ │ │                                                            │ │  │ │
│  │ │ │ $34/mo or included in Flipper bundle                      │ │  │ │
│  │ │ │                                                            │ │  │ │
│  │ │ │ [Add Module] [Upgrade Bundle] [Learn More]                │ │  │ │
│  │ │ └──────────────────────────────────────────────────────────┘ │  │ │
│  │ └───────────────────────────────────────────────────────────────┘  │ │
│  │                                                                     │ │
│  │ ┌─ ENHANCED (with Financial Modeling Pro module) ──────────────┐  │ │
│  │ │ Component Builder:                                            │  │ │
│  │ │ [Purchase Price] [Financing] [Operating Income] [CapEx]      │  │ │
│  │ │ [Operating Expenses] [Disposition] [Distributions]           │  │ │
│  │ │                                                                │  │ │
│  │ │ Sensitivity Analysis:                                          │  │ │
│  │ │ Revenue ±10%: [$42K - $58K NOI]                               │  │ │
│  │ │ Expenses ±5%: [$48K - $52K NOI]                               │  │ │
│  │ │ Cap Rate ±50bps: [6.5% - 7.5%]                                │  │ │
│  │ │                                                                │  │ │
│  │ │ Monte Carlo Results: (1000 simulations)                        │  │ │
│  │ │ P50 IRR: 18.2% | P90 IRR: 24.1% | P10 IRR: 12.3%             │  │ │
│  │ └───────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 🎯 Strategy                                                    [▼] │ │
│  │ 🔒 Enhanced with "Strategy Arbitrage Engine" module                │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ ✅ Due Diligence                                               [▼] │ │
│  │ 🔒 Enhanced with "DD Suite Pro" module                             │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 📡 Market Analysis                                             [▼] │ │
│  │ 🔒 Enhanced with "Market Signals" module                           │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 🏗️ Development (conditional - only if isDevelopment)          [▼] │ │
│  │ 🔒 Enhanced with "Development Tracker" module                      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 📁 Documents                                                   [▼] │ │
│  │ File upload/organization (always visible)                          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 👥 Collaboration                                               [▼] │ │
│  │ 🔒 Enhanced with "Deal Room" module                                │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 📅 Activity Feed                                               [▼] │ │
│  │ Timeline of all actions (always visible)                           │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Module System: How It Works

**Modules are contextual tools that enhance sections, NOT navigation items.**

**Two States for Each Section:**

1. **Basic (No Module Active):**
   - Simplified features
   - Manual calculations
   - Basic UI
   - Upsell banner with benefits + pricing
   - [Add Module] or [Upgrade Bundle] buttons

2. **Enhanced (Module Active):**
   - Advanced features
   - Automation
   - AI-powered insights
   - Professional UI
   - No upsells (user has access)

**Example Flow:**

```
User viewing deal → Sees "Financial Analysis" section

IF "Financial Modeling Pro" module is ACTIVE (checked in Settings > Modules):
  → Section shows:
     - Component-based pro-forma builder
     - Sensitivity analysis sliders
     - Monte Carlo simulation results
     - Export to Excel/PDF

IF module is INACTIVE:
  → Section shows:
     - Basic calculator (price, NOI, cap rate)
     - Upsell banner:
       "Upgrade to Financial Modeling Pro for advanced features"
       [$34/mo or included in Flipper bundle]
       [Add Module] [Upgrade Bundle]
```

---

### Settings > Modules Page

**Route:** `/settings/modules`

**Purpose:** Global control center where users activate/deactivate modules

**Layout:**

```
┌────────────────────────────────────────────────────────────────────────┐
│  ⚙️ Settings > Modules                                                 │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Module Marketplace                                                    │
│                                                                         │
│  Select the modules you want active across all your deals, assets,    │
│  and projects. Changes apply globally.                                │
│                                                                         │
│  YOUR PLAN: Flipper Bundle ($89/mo)                                   │
│  [Change Plan]  [Manage Billing]                                       │
│                                                                         │
├────────────────────────────────────────────────────────────────────────┤
│  FREE MODULES                                                           │
│  ──────────────────────────────────────                                │
│                                                                         │
│  [✓] Basic Financial Modeling                           Free ✓         │
│       Simple financial calculations and metrics                        │
│       Enhances: Financial Analysis sections                            │
│                                                                         │
│  [✓] Comp Analysis (Basic)                              Free ✓         │
│       Basic comparable property analysis                               │
│       Enhances: Market Analysis sections                               │
│                                                                         │
├────────────────────────────────────────────────────────────────────────┤
│  STRATEGY & ARBITRAGE                                                   │
│  ──────────────────────────────────────                                │
│                                                                         │
│  [✓] Strategy Arbitrage Engine                          Included ✓     │
│       39 pre-loaded strategies plus custom strategy builder           │
│       Enhances: Strategy sections                                      │
│       Part of your Flipper bundle                                      │
│                                                                         │
├────────────────────────────────────────────────────────────────────────┤
│  FINANCIAL & ANALYSIS                                                   │
│  ──────────────────────────────────────                                │
│                                                                         │
│  [✓] Financial Modeling Pro                             Included ✓     │
│       Component-based builder (13 blocks), sensitivity, Monte Carlo   │
│       Enhances: Financial Analysis sections                            │
│       Part of your Flipper bundle                                      │
│                                                                         │
│  [✓] Financial Analysis Pro                             Included ✓     │
│       Advanced metrics, waterfall models, investor returns             │
│       Enhances: Financial Analysis sections                            │
│       Part of your Flipper bundle                                      │
│                                                                         │
│  [ ] Sensitivity Tester                                 $24/mo         │
│       Multi-variable stress testing and scenario analysis              │
│       Enhances: Financial Analysis sections                            │
│       Not in Flipper bundle. Add for $24/mo                            │
│       [Add Module]  or  [Upgrade to Developer - $159/mo]               │
│                                                                         │
├────────────────────────────────────────────────────────────────────────┤
│  DEVELOPMENT                                                            │
│  ──────────────────────────────────────                                │
│                                                                         │
│  [ ] Dev Budget Tracker                                 $29/mo         │
│  [ ] Development Tracker                                $39/mo         │
│  [ ] Zoning Interpreter                                 $54/mo         │
│  [ ] Site Plan Analyzer                                 $39/mo         │
│       All 4 included in Developer bundle ($159/mo)                     │
│       [Upgrade Bundle]                                                  │
│                                                                         │
├────────────────────────────────────────────────────────────────────────┤
│  DUE DILIGENCE                                                          │
│  ──────────────────────────────────────                                │
│                                                                         │
│  [✓] Due Diligence Suite                                Included ✓     │
│       Smart checklists with risk scoring and automation                │
│       Enhances: Due Diligence sections                                 │
│       Part of your Flipper bundle                                      │
│                                                                         │
│  [✓] Property Condition                                 Included ✓     │
│       Inspection tracking, maintenance estimates, CapEx planning       │
│       Enhances: Due Diligence sections                                 │
│       Part of your Flipper bundle                                      │
│                                                                         │
│  ... (25 more modules across 7 categories)                             │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

**Module Card States:**

1. **Enabled + Subscribed:** `[✓]` Green checkmark, "Included ✓"
2. **Disabled + Subscribed:** `[ ]` Empty checkbox, can toggle ON
3. **Not Subscribed:** `[ ]` Grayed out, shows price, [Add Module] button

**Toggle Behavior:**

```
User clicks [✓] to toggle OFF:
  → Module disabled globally
  → All deals/assets revert to basic features in that section
  → Data preserved (can re-enable anytime)
  → No refund (still subscribed, just choosing not to use)

User clicks [ ] to toggle ON:
  IF subscribed:
    → Module enabled globally
    → All deals/assets show enhanced features
  IF not subscribed:
    → Show purchase modal:
       "This module costs $34/mo or is included in Developer bundle"
       [Add Module - $34/mo] [Upgrade Bundle - $159/mo] [Cancel]
```

---

### Section Examples: Basic vs Enhanced

---

#### 1. Financial Analysis Section

**Basic (no module):**
```
┌─────────────────────────────────────────────────────────────────────┐
│ 💰 Financial Analysis                                          [▼] │
│                                                                     │
│ BASIC CALCULATOR                                                    │
│                                                                     │
│ Purchase Price:       $5,000,000                                    │
│ Down Payment:         $1,000,000 (20%)                              │
│ Loan Amount:          $4,000,000                                    │
│ Interest Rate:        6.5%                                          │
│ Term:                 30 years                                      │
│                                                                     │
│ Monthly Payment:      $25,264                                       │
│ Annual Debt Service:  $303,168                                      │
│                                                                     │
│ Estimated NOI:        $350,000                                      │
│ Cap Rate:             7.0%                                          │
│ Debt Coverage:        1.15x                                         │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 🔓 Upgrade to Financial Modeling Pro                            │ │
│ │                                                                  │ │
│ │ Get access to:                                                   │ │
│ │ • Component-based pro-forma builder (13 blocks)                 │ │
│ │ • Sensitivity analysis & stress testing                         │ │
│ │ • Monte Carlo simulations (1000 scenarios)                      │ │
│ │ • Waterfall distribution models                                 │ │
│ │ • Export to Excel/PDF                                           │ │
│ │                                                                  │ │
│ │ $34/mo or included in Flipper bundle ($89/mo total)             │ │
│ │                                                                  │ │
│ │ [Add Module] [Upgrade to Flipper Bundle] [Learn More]          │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

**Enhanced (Financial Modeling Pro active):**
```
┌─────────────────────────────────────────────────────────────────────┐
│ 💰 Financial Analysis                                          [▲] │
│                                                                     │
│ COMPONENT BUILDER                                                   │
│                                                                     │
│ Build your pro-forma by selecting components:                      │
│ [Purchase Price] [Financing] [Operating Income] [Operating Expenses]│
│ [CapEx] [Reserves] [Disposition] [Distributions] [+13 more blocks] │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Purchase Price Component:                                        │ │
│ │   Land:                        $1,500,000                        │ │
│ │   Building:                    $3,200,000                        │ │
│ │   FF&E:                        $  300,000                        │ │
│ │   Closing Costs (2.5%):        $  125,000                        │ │
│ │   Total:                       $5,125,000                        │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Operating Income Component:                                      │ │
│ │   Base Rent:                   $420,000/year                     │ │
│ │   Parking Revenue:             $ 24,000/year                     │ │
│ │   Other Income:                $ 12,000/year                     │ │
│ │   Vacancy (5%):                -$ 22,800/year                    │ │
│ │   Effective Gross Income:      $433,200/year                     │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ SENSITIVITY ANALYSIS                                                │
│                                                                     │
│ Test how changes affect your returns:                              │
│                                                                     │
│ Revenue Impact:  [-10%]  <===●===>  [+10%]                         │
│   IRR Range: 14.2% - 22.8%                                          │
│                                                                     │
│ Expenses Impact: [-5%]   <===●===>  [+5%]                          │
│   IRR Range: 16.5% - 20.3%                                          │
│                                                                     │
│ Cap Rate Impact: [6.0%]  <===●===>  [8.0%] (Current: 7.0%)        │
│   Exit Value Range: $4.2M - $5.8M                                   │
│                                                                     │
│ MONTE CARLO SIMULATION                                              │
│                                                                     │
│ 1,000 simulations run. Results:                                     │
│                                                                     │
│   P90 IRR: 24.1%  ▓▓▓▓▓▓▓▓▓░░░░░░░░                               │
│   P50 IRR: 18.2%  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░                             │
│   P10 IRR: 12.3%  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                           │
│                                                                     │
│   Probability of IRR > 15%: 78%                                     │
│   Probability of IRR > 20%: 42%                                     │
│                                                                     │
│ [Export to Excel] [Export to PDF] [Save Model] [Share]            │
└─────────────────────────────────────────────────────────────────────┘
```

---

#### 2. Strategy Section

**Basic (no module):**
```
┌─────────────────────────────────────────────────────────────────────┐
│ 🎯 Strategy                                                    [▼] │
│                                                                     │
│ STRATEGY SELECTION                                                  │
│                                                                     │
│ Select your investment strategy:                                    │
│ ● Value-Add                                                         │
│ ○ Core                                                              │
│ ○ Opportunistic                                                     │
│ ○ Development                                                       │
│ ○ Ground-Up                                                         │
│                                                                     │
│ Description: Value-Add strategies focus on increasing NOI through   │
│ operational improvements, rent growth, and expense reduction.       │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 🔓 Upgrade to Strategy Arbitrage Engine                         │ │
│ │                                                                  │ │
│ │ Get access to:                                                   │ │
│ │ • 39 pre-loaded strategies with detailed playbooks              │ │
│ │ • Custom strategy builder                                       │ │
│ │ • ROI comparison matrix (side-by-side analysis)                │ │
│ │ • Risk scoring for each strategy                                │ │
│ │ • AI-recommended best-fit strategy for this deal               │ │
│ │                                                                  │ │
│ │ $39/mo or included in all bundles                               │ │
│ │                                                                  │ │
│ │ [Add Module] [Upgrade Bundle]                                   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

**Enhanced (Strategy Arbitrage Engine active):**
```
┌─────────────────────────────────────────────────────────────────────┐
│ 🎯 Strategy                                                    [▲] │
│                                                                     │
│ 39 PRE-LOADED STRATEGIES                                            │
│                                                                     │
│ ┌─ RECOMMENDED FOR THIS DEAL (AI-Selected) ──────────────────────┐ │
│ │ ✨ Multifamily Value-Add (Operational Turnaround)               │ │
│ │    Expected IRR: 18-24% | Risk Score: 6/10 (Medium)             │ │
│ │    Timeline: 18-24 months                                        │ │
│ │    [View Playbook] [Select Strategy] [Compare]                  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─ OTHER STRATEGIES ──────────────────────────────────────────────┐ │
│ │                                                                  │ │
│ │ Value-Add (14 strategies):                                       │ │
│ │ • Operational Turnaround (Recommended)                          │ │
│ │ • Deferred Maintenance Recovery                                 │ │
│ │ • Amenity Upgrade Program                                       │ │
│ │ • Unit Renovation Value-Add                                     │ │
│ │ • Repositioning (Class B to A-)                                 │ │
│ │ ... [View All 14]                                                │ │
│ │                                                                  │ │
│ │ Core (6 strategies):                                             │ │
│ │ • Stable Cash Flow Hold                                         │ │
│ │ • Long-Term Appreciation Play                                   │ │
│ │ ... [View All 6]                                                 │ │
│ │                                                                  │ │
│ │ Opportunistic (9 strategies):                                    │ │
│ │ • Distressed Asset Turnaround                                   │ │
│ │ • Short-Term Flip                                               │ │
│ │ ... [View All 9]                                                 │ │
│ │                                                                  │ │
│ │ Development (10 strategies):                                     │ │
│ │ • Ground-Up Development                                         │ │
│ │ • Adaptive Reuse                                                │ │
│ │ ... [View All 10]                                                │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ COMPARISON MATRIX                                                   │
│                                                                     │
│ Compare up to 4 strategies side-by-side:                           │
│                                                                     │
│ [+ Add Strategy to Compare]                                         │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │          │ Op. Turnaround│ Deferred Maint│ Amenity Upgrade    │ │
│ │──────────│───────────────│───────────────│────────────────────│ │
│ │ IRR      │ 18-24%        │ 16-20%        │ 14-18%             │ │
│ │ Risk     │ 6/10 (Med)    │ 7/10 (Med-Hi) │ 5/10 (Low-Med)     │ │
│ │ Timeline │ 18-24mo       │ 12-18mo       │ 24-36mo            │ │
│ │ CapEx    │ $500K         │ $800K         │ $1.2M              │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ [Create Custom Strategy] [Export Comparison] [Save Analysis]      │
└─────────────────────────────────────────────────────────────────────┘
```

---

#### 3. Due Diligence Section

**Basic (no module):**
```
┌─────────────────────────────────────────────────────────────────────┐
│ ✅ Due Diligence                                               [▼] │
│                                                                     │
│ BASIC CHECKLIST                                                     │
│                                                                     │
│ □ Review financials                                                 │
│ □ Inspect property                                                  │
│ □ Title search                                                      │
│ □ Environmental assessment                                          │
│ □ Zoning verification                                               │
│ □ Review leases                                                     │
│ □ Insurance review                                                  │
│ □ Appraisal                                                         │
│                                                                     │
│ Progress: 0/8 complete (0%)                                         │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 🔓 Upgrade to Due Diligence Suite Pro                          │ │
│ │                                                                  │ │
│ │ Get access to:                                                   │ │
│ │ • Smart checklists (auto-generated based on deal type)         │ │
│ │ • Risk scoring (quantify DD risk across 12 categories)         │ │
│ │ • Automated document review (AI extraction & validation)       │ │
│ │ • Property condition integration                                │ │
│ │ • Critical dates & deadline management                          │ │
│ │                                                                  │ │
│ │ $39/mo or included in all bundles                               │ │
│ │                                                                  │ │
│ │ [Add Module] [Upgrade Bundle]                                   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

**Enhanced (DD Suite Pro active):**
```
┌─────────────────────────────────────────────────────────────────────┐
│ ✅ Due Diligence                                               [▲] │
│                                                                     │
│ SMART CHECKLIST (Multifamily Value-Add)                             │
│                                                                     │
│ Auto-generated 47 tasks based on your deal type and strategy       │
│                                                                     │
│ Overall Progress: ████████░░░░░░░░░░ 38% (18/47 complete)          │
│ Risk Score: 6.2/10 (Medium) 🟡                                      │
│                                                                     │
│ ┌─ FINANCIAL DUE DILIGENCE (8 tasks) ─────────────── 5/8 ✅ ──────┐ │
│ │ ✅ Review last 3 years P&L statements                           │ │
│ │ ✅ Analyze rent roll (current)                                  │ │
│ │ ✅ Verify operating expenses                                    │ │
│ │ ✅ Review capital expenditure history                           │ │
│ │ ✅ Confirm property taxes                                       │ │
│ │ ⏳ Review tenant payment history              Due in 3 days 🟡 │ │
│ │ □  Verify insurance costs                                       │ │
│ │ □  Analyze utility expenses                                     │ │
│ │                                                                  │ │
│ │ Risk: LOW ✅ (Historical financials verified)                   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─ PHYSICAL INSPECTION (12 tasks) ────────────── 4/12 🟡 ─────────┐ │
│ │ ✅ Schedule property inspection                                 │ │
│ │ ✅ Review existing inspection reports                           │ │
│ │ ✅ Walk all units (sample 20%)                                  │ │
│ │ ✅ Inspect common areas                                         │ │
│ │ ⚠️  HVAC system inspection                    OVERDUE 2 days 🔴│ │
│ │ □  Roof inspection                                              │ │
│ │ □  Plumbing system review                                       │ │
│ │ □  Electrical system review                                     │ │
│ │ □  Foundation inspection                                        │ │
│ │ □  Parking lot/garage inspection                                │ │
│ │ □  Pool/amenities inspection                                    │ │
│ │ □  Landscaping assessment                                       │ │
│ │                                                                  │ │
│ │ Risk: MEDIUM-HIGH ⚠️  (HVAC inspection overdue, critical item) │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─ LEGAL & TITLE (6 tasks) ───────────────────── 2/6 🟡 ──────────┐ │
│ │ ✅ Order title search                                           │ │
│ │ ✅ Review preliminary title report                              │ │
│ │ ⏳ Resolve title issues                       Due in 5 days 🟡 │ │
│ │ □  Survey property boundaries                                   │ │
│ │ □  Review deed restrictions                                     │ │
│ │ □  Confirm zoning compliance                                    │ │
│ │                                                                  │ │
│ │ Risk: LOW-MEDIUM 🟡 (Minor title issues to resolve)            │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ... (5 more categories: Environmental, Tenant, Compliance, etc.)   │
│                                                                     │
│ RISK BREAKDOWN                                                      │
│                                                                     │
│ Financial:        ✅ LOW (2.1/10)                                   │
│ Physical:         ⚠️  MEDIUM-HIGH (7.3/10) ← Needs attention       │
│ Legal:            🟡 LOW-MEDIUM (4.5/10)                            │
│ Environmental:    ✅ LOW (1.8/10)                                   │
│ Tenant:           ✅ LOW (3.2/10)                                   │
│ Compliance:       🟡 MEDIUM (5.8/10)                                │
│                                                                     │
│ CRITICAL DATES                                                      │
│                                                                     │
│ ⚠️  HVAC inspection: OVERDUE by 2 days                             │
│ 🟡 Tenant payment review: Due in 3 days                            │
│ 🟡 Title issue resolution: Due in 5 days                           │
│ ✅ Appraisal: Scheduled for Feb 15                                 │
│                                                                     │
│ [Add Task] [Export DD Report] [Share with Team] [Set Reminder]    │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Module Activation: Behind the Scenes

**When user toggles module ON in Settings > Modules:**

1. **API Call:** `PATCH /api/v1/modules/:slug/toggle {"enabled": true}`
2. **Database:** Updates `user_module_settings` table
3. **Effect:** Immediately visible across all deals/assets (no page refresh needed)
4. **Sections:** Basic → Enhanced (components swap)
5. **Upsell Banners:** Removed from all sections where module is active

**When user toggles module OFF:**

1. **API Call:** `PATCH /api/v1/modules/:slug/toggle {"enabled": false}`
2. **Database:** Updates enabled = false (preserves subscription + data)
3. **Effect:** All enhanced sections revert to basic
4. **Upsell Banners:** Re-appear in affected sections
5. **Data:** Preserved (can re-enable anytime, data intact)

---

### Routes: Simplified

**OLD (incorrect) architecture:**
```
/deals/:dealId                    → Overview
/deals/:dealId/financial          → Financial page
/deals/:dealId/strategy           → Strategy page
/deals/:dealId/dd-suite           → DD page
... (36+ routes per deal)
```

**NEW (correct) architecture:**
```
/deals/:dealId                    → Single comprehensive page
                                     All sections on one page
                                     Modules enhance sections in-place
```

**Benefits:**
- ✅ Simpler routing (1 route instead of 36+)
- ✅ Better UX (no page navigation, instant interactions)
- ✅ Faster development (fewer pages to build)
- ✅ Better SEO (one URL per deal)
- ✅ Mobile-friendly (accordion sections)

---

### Implementation Status

**Completed:**
- ✅ Database schema (user_module_settings, module_definitions)
- ✅ API endpoints (GET, PATCH modules)
- ✅ 27 modules seeded (2 free, 25 premium)

**In Progress (Day 2):**
- 🔨 Frontend: Settings > Modules page
- 🔨 Frontend: Deal page with expandable sections

**Next:**
- ⏭️ Module enhancements (Financial Pro, Strategy, DD Suite)
- ⏭️ Apply to Assets Owned pages
- ⏭️ Module suggestion popup on deal creation

---

## Assets Owned Pages

**Same pattern applies to `/assets-owned/:assetId` pages:**

- Single comprehensive page
- Expandable sections (Properties, Financial, Occupancy, etc.)
- Modules enhance sections (Portfolio Management modules)
- Settings > Modules controls activation
- No asset-level module sidebar

---

## Projects Pages (Future)

**Same pattern will apply to `/projects/:projectId` pages:**

- Single comprehensive page
- Expandable sections (Development, Budget, Timeline, etc.)
- Modules enhance sections (Development modules)
- Settings > Modules controls activation
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

