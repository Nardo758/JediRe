# JEDI RE — MAIN NAVIGATION SYSTEM

## Overview

JEDI RE uses a **context-aware F-key navigation bar** that switches between two modes:

1. **Portfolio Navigation** (F1–F9) — Primary app surfaces
2. **Deal Navigation** (F1–F12) — Inside a deal capsule

The navigation is implemented in `MainLayout.tsx` and uses the **FKeyNavBar** component with keyboard/mouse support.

---

## ARCHITECTURE

### MainLayout Component

**File:** `frontend/src/components/layout/MainLayout.tsx`

**Structure:**
```
MainLayout (flex column)
  ├─ TopStatusBar (24px)
  │  ├─ Logo "JEDI RE" with gradient
  │  ├─ Context label (DASHBOARD, PIPELINE, etc.)
  │  └─ Live clock + Agent count + Email count + Kafka throughput
  │
  ├─ FKeyNavBar (28px) — SMART SWITCHING
  │  ├─ Portfolio Nav (F1–F9) when in /deals, /market-intelligence, etc.
  │  └─ Deal Nav (F1–F12) when in /deals/{id}/detail
  │
  ├─ DealContextBar (32px, conditional) — Shows when in a deal
  │  ├─ Deal address/location (pin icon)
  │  ├─ JEDI score + 30d delta
  │  ├─ Pipeline stage badge
  │  └─ Recommended strategy badge
  │
  ├─ BottomPanel (collapsible, 28–180px)
  │  ├─ ALERTS tab → critical/high/medium/low alerts
  │  ├─ NEWS tab → recent market events
  │  └─ AGENTS tab → background agent status
  │
  ├─ Outlet (flex: 1) — Page content renders here
  │
  └─ ChatOverlay, WarMapsComposer, QuickSetupModal (modals)
```

**Responsive Behavior:**
- When inside `/deals/:dealId/detail` → **Deal Nav** (F1–F12)
- When outside → **Portfolio Nav** (F1–F9)
- Context bar shows only when navigating to a deal
- Bottom panel can collapse/expand (keyboard: arrow up/down)

---

## PORTFOLIO NAVIGATION (F1–F9)

### Menu Definition

```typescript
const PORTFOLIO_NAV = [
  { key: 'F1', label: 'DASHBOARD',       path: '/dashboard' },       // → /terminal
  { key: 'F2', label: 'PIPELINE',        path: '/deals' },
  { key: 'F3', label: 'PORTFOLIO',       path: '/assets-owned' },
  { key: 'F4', label: 'MARKETS',         path: '/market-intelligence' },
  { key: 'F5', label: 'COMPETE',         path: '/competitive-intelligence' },
  { key: 'F6', label: 'NEWS',            path: '/news-intel' },
  { key: 'F7', label: 'OPPS',            path: '/opportunities' },
  { key: 'F8', label: 'REPORTS',         path: '/reports' },
  { key: 'F9', label: 'SETTINGS',        path: '/settings' },
];
```

### Navigation Behavior

| Key | Label | Route | Maps To | Status |
|-----|-------|-------|---------|--------|
| **F1** | DASHBOARD | `/dashboard` | `/terminal` (redirect) | ✅ Active |
| **F2** | PIPELINE | `/deals` | DealsPage | ✅ Active |
| **F3** | PORTFOLIO | `/assets-owned` | AssetsOwnedPage | ✅ Active |
| **F4** | MARKETS | `/market-intelligence` | MarketIntelligencePage | ✅ Active |
| **F5** | COMPETE | `/competitive-intelligence` | CompetitiveIntelligencePage | ✅ Active |
| **F6** | NEWS | `/news-intel` | NewsIntelligencePage | ✅ Active |
| **F7** | OPPS | `/opportunities` | OpportunitiesPage | 🟡 Partial |
| **F8** | REPORTS | `/reports` | ReportsPage | 🟡 Stub |
| **F9** | SETTINGS | `/settings` | SettingsPage | ✅ Active |

### Visual Styling

**Active State:**
- Background: `T.text.amber` (#F5A623)
- Text: Dark terminal background
- Font weight: 600
- Font family: JetBrains Mono

**Inactive State:**
- Background: Transparent
- Text: `T.text.secondary` (#8B95A5)
- Hover: `T.bg.hover` (#1E2538) — light highlight

**Key Display:**
```
┌─ F1 DASHBOARD ─┐
│  ^             │
│ Font: mono     │
│ Size: 7px      │
│ Opacity: 0.5   │
└─────────────────┘
```

### Keyboard Integration

**Active Routes:**
- Dashboard: `/` or `/terminal` or `/dashboard`
- Pipeline: Any `/deals/*` route
- Others: Exact path match

**Custom Event Listeners:**
```javascript
// When F-key is clicked
onNavigate(path) → useNavigate(path)

// When already in /deals/:id/detail, dispatch custom event
window.dispatchEvent(new CustomEvent('deal-tab-change', { detail: DEAL_TAB_IDS[idx] }))
```

---

## DEAL NAVIGATION (F1–F12)

### Menu Definition

```typescript
const DEAL_NAV = [
  { key: 'F1',  label: 'OVERVIEW' },
  { key: 'F2',  label: 'ZONING' },
  { key: 'F3',  label: 'MARKET' },
  { key: 'F4',  label: 'SUPPLY' },
  { key: 'F5',  label: 'COMPS' },
  { key: 'F6',  label: 'STRATEGY' },
  { key: 'F7',  label: 'TRAFFIC' },
  { key: 'F8',  label: 'PROFORMA' },
  { key: 'F9',  label: 'CAPITAL' },
  { key: 'F10', label: 'RISK' },
  { key: 'F11', label: 'EXECUTE' },
  { key: 'F12', label: 'AI AGENT' },
];

const DEAL_TAB_IDS = [
  'overview', 'zoning', 'market', 'supply', 'competition',
  'strategy', 'traffic', 'proforma', 'capital', 'risk',
  'execution', 'ai-agent'
];
```

### Tab Mapping (DealDetailPage)

| F-Key | Label | Tab ID | Component | Route |
|-------|-------|--------|-----------|-------|
| **F1** | OVERVIEW | `overview` | OverviewScreen (5 sub-tabs) | `/deals/:dealId/detail?tab=overview` |
| **F2** | ZONING | `zoning` | ZoningModuleSection | `?tab=zoning` |
| **F3** | MARKET | `market` | MarketScreen (4 sub-tabs) | `?tab=market` |
| **F4** | SUPPLY | `supply` | SupplyPipelinePage | `?tab=supply` |
| **F5** | COMPS | `competition` | CompetitionScreen (2 sub-tabs) | `?tab=competition` |
| **F6** | STRATEGY | `strategy` | StrategyScreen (2 sub-tabs) | `?tab=strategy` |
| **F7** | TRAFFIC | `traffic` | TrafficModule | `?tab=traffic` |
| **F8** | PROFORMA | `proforma` | ProformaScreen (3 sub-tabs) | `?tab=proforma` |
| **F9** | CAPITAL | `capital` | ExitCapitalModule | `?tab=capital` |
| **F10** | RISK | `risk` | RiskScreen (4 sub-tabs) | `?tab=risk` |
| **F11** | EXECUTE | `execution` | ExecutionScreen (4 sub-tabs) | `?tab=execution` |
| **F12** | AI AGENT | `ai-agent` | AIAgentScreen (2 sub-tabs) | `?tab=ai-agent` |

### How Deal Tab Switching Works

**Event Loop (in DealDetailPage.tsx):**

```typescript
// 1. F-key click in nav bar
FKeyNavBar button.onClick()
  └─ window.dispatchEvent(new CustomEvent('deal-tab-change', { detail: 'overview' }))

// 2. DealDetailPage listens
useEffect(() => {
  window.addEventListener('deal-tab-change', (e: CustomEvent) => {
    setActiveTab(e.detail) // e.g., 'overview'
  })
}, [])

// 3. When tab changes, dispatch reverse signal to nav bar
useEffect(() => {
  window.dispatchEvent(new CustomEvent('deal-active-tab', { detail: activeTab }))
}, [activeTab])

// 4. FKeyNavBar listens to update visual state
useEffect(() => {
  window.addEventListener('deal-active-tab', (e: CustomEvent) => {
    setDealActiveTab(e.detail)
  })
}, [])
```

### Visual Styling (Same as Portfolio)

- Active: Amber background (#F5A623)
- Inactive: Transparent
- Hover: Light highlight

---

## TOP STATUS BAR

**Height:** 24px
**Background:** `T.bg.topBar` (#050810)

### Components

1. **Logo Section** (Left)
   ```
   JEDI RE | CONTEXT LABEL
   └─ Logo: gradient teal-cyan (#00E5A0 → #00B4D8)
   └─ Context: "PIPELINE", "MARKET INTEL", etc.
   ```

2. **Status Section** (Right)
   ```
   🟢 6 AGENTS | EMAIL: 3 | KAFKA: 312/s | 14:23:45
   └─ Green pulsing dot for agents
   └─ Email unread count
   └─ Kafka event throughput (msgs/s)
   └─ Live clock (24-hour format)
   ```

### Clock Implementation

```javascript
useEffect(() => {
  const tick = () => {
    const now = new Date();
    setClock(now.toLocaleTimeString('en-GB', { hour12: false }));
  };
  tick(); // initial
  const id = setInterval(tick, 1000); // update every second
  return () => clearInterval(id);
}, []);
```

---

## DEAL CONTEXT BAR

**Height:** 32px
**Background:** `rgba(245, 166, 35, 0.08)` (amber tinted)
**Visibility:** Only when inside a deal (`/deals/:dealId/detail`)

### Components

```
📍 Deal Address | JEDI 87 ▲+2 | ACTIVE | BTS
```

**Fields:**
- **Address:** Deal location (pin icon)
- **JEDI Score:** Current score (amber text) + 30-day delta
  - Delta up: `▲` green text
  - Delta down: `▼` red text
  - Example: `JEDI 87 ▲+2` or `JEDI 82 ▼-1`
- **Pipeline Stage:** Badge (e.g., "ACTIVE", "DUE DILIGENCE")
  - Color: Cyan (#00BCD4)
- **Strategy:** Recommended strategy badge (e.g., "BTS", "RENTAL")
  - Color: Purple (#A78BFA)

### Source Data

```typescript
interface DealContextInfo {
  address?: string;              // from deal.address
  location?: string;             // fallback
  name?: string;                 // fallback to deal name
  jedi_score?: number;           // current JEDI score
  delta_30d?: number;            // score change last 30 days
  pipeline_stage?: string;       // deal.stage
  recommended_strategy?: string; // deal.strategy
}
```

---

## BOTTOM PANEL

**Heights:**
- Collapsed: 28px
- Expanded: 180px
- Transition: 0.2s ease

**Background:** `T.bg.panel` (#0F1319)

### Tab Structure

```
[ALERTS (6)] [NEWS (2)] [AGENTS (3)]
```

Each tab shows count in header. Click to switch.

### Tab 1: ALERTS

**Columns:**
- Severity indicator (color-coded: critical/red, high/orange, medium/amber, low/green)
- Type (ARBITRAGE, RISK, MARKET, DEADLINE)
- Message
- Associated deal (if any)
- Timestamp ("10m ago", "2h ago", etc.)

**Data Source:** `/jedi/alerts` API
**Example:**
```
🔴 ARBITRAGE | BTS outscores Rental by 22pts... | Pipeline | 10m
🟠 RISK      | Insurance risk elevated on STR... | null     | 34m
🟡 MARKET    | Tampa MSA absorption exceeded... | null     | 1h
```

### Tab 2: NEWS

**Columns:**
- Timestamp
- Headline
- Impact ("+DEMAND", "-SUPPLY", "RISK UP/DN")
- JEDI points gained/lost
- Affected properties

**Data Source:** `/news/feed` API
**Example:**
```
14:23 | Amazon announces 2,000-job Tampa expansion | +DEMAND | +3.2pts | [Pipeline]
13:41 | Greystar breaks ground 380-unit tower     | +SUPPLY | -1.8pts | []
```

### Tab 3: AGENTS

**Columns:**
- Agent ID (A01, A03, etc.)
- Name (Data Collector, Zoning Agent, etc.)
- Status (ON / IDLE)
- Current action
- Time running
- Message count (in queue)

**Data Source:** `/agent-status` API
**Example:**
```
A01 | Data Collector      | ON   | Scraping comps Apartments.com | 2s    | 142
A03 | Zoning Agent        | ON   | Parsing Municode setback rules| 8s    | 38
A05 | Market Analyst      | ON   | Updating absorption metrics   | 34s   | 87
A07 | Risk Scorer         | ON   | Recalculating insurance risks | 1m    | 64
A08 | Strategy Engine     | IDLE | Awaiting new intake           | 4m    | 23
```

### Fetching & Polling

```typescript
const fetchData = useCallback(async () => {
  try {
    const [alertRes, newsRes, agentRes] = await Promise.allSettled([
      api.get('/jedi/alerts'),
      api.get('/news/feed'),
      api.get('/agent-status'),
    ]);
    // Process responses...
  } catch (err) {
    console.warn('[BottomPanel] Failed to fetch', err);
  }
}, []);

useEffect(() => {
  fetchData();
  const id = setInterval(fetchData, 30000); // Refresh every 30 seconds
  return () => clearInterval(id);
}, [fetchData]);
```

---

## COMMAND PALETTE

**Keybinding:** `⌘K` (shown in bottom-right corner of nav bar)

**Location:** `CommandPanel.tsx`

**Features:**
- Strategy search & execution
- Preset strategies (preset / custom)
- Run custom strategy by name
- Display top 3 results
- Match count

**Implementation:**
```typescript
export const CommandPanel: React.FC<CommandPanelProps> = ({ isOpen, onClose }) => {
  // Search input
  // Load strategies from /strategies API
  // Run strategy: POST /strategies/{id}/run
  // Display results: geography_name, score
};
```

---

## ACTIVE STATUS DETECTION

### Portfolio View Active Detection

```typescript
const isActive =
  activePath === item.path ||
  (item.path === '/deals' && activePath.startsWith('/deals')) ||
  (item.path === '/dashboard' && (activePath === '/' || activePath === '/terminal'));
```

**Examples:**
- Route: `/deals/123` → **F2 PIPELINE** active (matches `/deals`)
- Route: `/market-intelligence/markets/atlanta` → **F4 MARKETS** active (exact match)
- Route: `/terminal` → **F1 DASHBOARD** active (special case)

### Deal View Active Detection

```typescript
const isActive = (dealActiveTab === DEAL_TAB_IDS[idx]);
```

**Depends on:**
- `dealActiveTab` state (listening to `deal-active-tab` custom event)
- `DEAL_TAB_IDS` array index matching

---

## THEME TOKENS (Terminal Design)

**File:** `frontend/src/styles/terminal-tokens.ts`

```typescript
const T = {
  bg: {
    terminal: '#0A0E17',    // darkest bg
    panel: '#0F1319',       // panel bg
    panelAlt: '#131821',
    header: '#1A1F2E',      // nav bar
    hover: '#1E2538',
    active: '#252D40',
    input: '#0D1117',
    topBar: '#050810',      // top bar (very dark)
  },
  text: {
    primary: '#E8ECF1',     // main text (light)
    secondary: '#8B95A5',   // secondary text
    muted: '#4A5568',
    amber: '#F5A623',       // active button color
    amberBright: '#FFD166',
    green: '#00D26A',       // positive
    red: '#FF4757',         // negative
    cyan: '#00BCD4',        // deal context
    orange: '#FF8C42',
    purple: '#A78BFA',      // strategy
    white: '#FFFFFF',
  },
  border: {
    subtle: '#1E2538',
    medium: '#2A3348',
    bright: '#3B4A6B',
  },
  font: {
    mono: "'JetBrains Mono','Fira Code','SF Mono',monospace",
    display: "'IBM Plex Mono',monospace",
    label: "'IBM Plex Sans',sans-serif",
  },
};
```

---

## KEY INTERACTION PATTERNS

### Pattern 1: F-Key Click

```
User clicks F2 PIPELINE button
  ↓
FKeyNavBar onClick handler
  ↓
if (isInsideDeal) {
  window.dispatchEvent('deal-tab-change')
} else {
  navigate('/deals')
}
  ↓
Component re-renders with new path
```

### Pattern 2: Deal Tab Switch

```
User in /deals/123/detail clicks F3 MARKET
  ↓
FKeyNavBar detects isInsideDeal = true
  ↓
Dispatches CustomEvent('deal-tab-change', { detail: 'market' })
  ↓
DealDetailPage listens, calls setActiveTab('market')
  ↓
Page updates query param: ?tab=market
  ↓
DealDetailPage dispatches reverse signal: 'deal-active-tab'
  ↓
FKeyNavBar receives signal, updates dealActiveTab state
  ↓
Visual: F3 button shows amber background
```

### Pattern 3: Bottom Panel Polling

```
Every 30 seconds:
  ↓
fetchData() → Promise.allSettled([alerts, news, agents])
  ↓
Parse responses (handle multiple response formats)
  ↓
setState({ alerts, news, agents })
  ↓
Re-render bottom panel tabs
```

---

## ACCESSIBILITY & CUSTOMIZATION

### Keyboard Shortcuts

| Shortcut | Action | Status |
|----------|--------|--------|
| F1–F9 | Portfolio navigation | ✅ Implemented |
| F1–F12 | Deal navigation (in deal view) | ✅ Implemented |
| ⌘K | Command palette | ✅ Implemented |
| Esc | Close modals | ✅ Implemented |
| Arrow Up/Down | Collapse/expand bottom panel | 🔴 Not yet |

### Responsive Design

- **Desktop:** Full layout with all panels
- **Tablet:** Bottom panel might become drawer
- **Mobile:** Not currently optimized (desktop-first design)

---

## FUTURE ENHANCEMENTS

1. **Customizable F-Key Bindings**
   - Let users remap F1–F9 navigation
   - Persist to localStorage

2. **Context-Aware Bottom Panel**
   - Show different tabs based on current page
   - E.g., in /deals → show DEAL ALERTS instead of all alerts

3. **Breadcrumb Trail**
   - Add breadcrumb above nav bar
   - E.g., `Dashboard > Markets > Atlanta > Midtown`

4. **Search Across Surfaces**
   - ⌘K expands to search deals, properties, markets, people

5. **Keyboard Shortcut Hints**
   - Tooltip on F-key buttons (press `?` to show all shortcuts)

6. **Tab Persistence**
   - Remember last active tab per surface
   - Restore on return visit

---

## SUMMARY

JEDI RE's navigation is a **smart context-aware system** that:

- ✅ Provides 2-level navigation (Portfolio + Deal)
- ✅ Uses Bloomberg Terminal F-key conventions
- ✅ Integrates status information (clock, agents, email)
- ✅ Shows alerts, news, agent activity in real-time (polling every 30s)
- ✅ Uses custom events for tab switching
- ✅ Theme-aware with terminal dark styling
- ✅ Supports keyboard & mouse interaction

**Files Involved:**
- `MainLayout.tsx` — Core layout + FKeyNavBar + DealContextBar + BottomPanel
- `CommandPanel.tsx` — ⌘K strategy search
- `Terminal tokens` — Design system colors/fonts
- `DealDetailPage.tsx` — Deal tab event listeners

**Improvement Priority:**
1. Replace polling with WebSocket for real-time updates
2. Add more keyboard shortcuts (arrow keys for panel collapse)
3. Implement breadcrumb navigation
4. Support mobile/tablet responsive layout

---

**Created:** March 2026
**Location:** `/home/user/JediRe/MAIN_NAVIGATION.md`
