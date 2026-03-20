# BLOOMBERG TERMINAL UI/UX SPEC — Screen Content & Visual Language

> **Companion to:** `NAVIGATION_REFRAME_SPEC.md` (navigation structure)
> **This spec covers:** The visual design system, shared chrome, component library, and content layout for every screen.
> **Goal:** Transform the white SaaS aesthetic into a Bloomberg Terminal-grade data environment. Dark, dense, data-first. The address is the ticker.

---

## PART 1: DESIGN SYSTEM TOKENS

### File to create: `frontend/src/styles/terminal-tokens.ts`

This is the single source of truth for the Bloomberg Terminal theme. Every component imports from here.

```ts
export const T = {
  bg: {
    terminal: '#0A0E17',     // darkest — full page bg
    panel:    '#0F1319',     // card/panel bg
    panelAlt: '#131821',     // alternating row bg
    header:   '#1A1F2E',     // section headers, nav bars
    hover:    '#1E2538',     // row hover
    active:   '#252D40',     // selected/active row
    input:    '#0D1117',     // input fields
    topBar:   '#050810',     // top status bar
  },
  text: {
    primary:    '#E8ECF1',   // main text
    secondary:  '#8B95A5',   // supporting text
    muted:      '#4A5568',   // labels, timestamps
    amber:      '#F5A623',   // brand accent, highlights, totals
    amberBright: '#FFD166',  // hot amber for emphasis
    green:      '#00D26A',   // positive, online, gains
    red:        '#FF4757',   // negative, alerts, losses
    cyan:       '#00BCD4',   // links, info badges
    orange:     '#FF8C42',   // warnings
    purple:     '#A78BFA',   // strategy, agent labels
    white:      '#FFFFFF',   // max emphasis only
  },
  border: {
    subtle:  '#1E2538',      // default borders
    medium:  '#2A3348',      // section dividers
    bright:  '#3B4A6B',      // focus/active borders
  },
  gradient: {
    tealCyan: 'linear-gradient(135deg, #00E5A0, #00B4D8)',  // logo, primary action
  },
  font: {
    mono:    "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
    display: "'IBM Plex Mono', monospace",
    label:   "'IBM Plex Sans', sans-serif",
  },
  fontSize: {
    xs:   '8px',    // timestamps, secondary labels
    sm:   '9px',    // table data, badges, sub-labels
    md:   '10px',   // section headers, module codes
    base: '11px',   // descriptions, context text
    lg:   '12px',   // body text, table content
    xl:   '14px',   // titles, metric values
    xxl:  '20px',   // hero numbers
    hero: '32px',   // JEDI Score, main gauge
  },
} as const;
```

### Font loading

Add to `frontend/index.html` `<head>`:

```html
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Tailwind extension (optional but recommended)

In `tailwind.config.ts`, extend colors:

```ts
theme: {
  extend: {
    colors: {
      terminal: {
        bg: '#0A0E17',
        panel: '#0F1319',
        header: '#1A1F2E',
        hover: '#1E2538',
        active: '#252D40',
      },
      't-amber': '#F5A623',
      't-green': '#00D26A',
      't-red': '#FF4757',
      't-cyan': '#00BCD4',
      't-purple': '#A78BFA',
    },
    fontFamily: {
      mono: ["'JetBrains Mono'", "'Fira Code'", "'SF Mono'", 'monospace'],
      display: ["'IBM Plex Mono'", 'monospace'],
      label: ["'IBM Plex Sans'", 'sans-serif'],
    },
  },
}
```

---

## PART 2: SHARED CHROME — The Terminal Shell

The entire app wraps in a terminal chrome that provides: top status bar, ticker, F-key nav bar, bottom panel (alerts/news/agents). This replaces the current white `MainLayout.tsx`.

### File to modify: `frontend/src/components/layout/MainLayout.tsx`

This is the biggest visual change. The white sidebar + white content area becomes a full-bleed dark terminal.

### 2A: Top Status Bar (24px fixed)

Always visible. Shows: JEDI RE logo, context label (PORTFOLIO or DEAL + address), agent status count, Kafka throughput, live clock.

```
┌──────────────────────────────────────────────────────────────────┐
│ JEDI RE  │ PORTFOLIO          5 AGENTS  EMAIL: 5  KAFKA: 312/s  │
└──────────────────────────────────────────────────────────────────┘
```

**Implementation:** A fixed 24px bar at the top of the viewport. Uses `T.bg.topBar`. JetBrains Mono throughout. Agent count shows a pulsing green dot. Clock is 24h format, amber.

### 2B: Ticker Bar (18px fixed)

Horizontal auto-scrolling ticker showing portfolio properties + scores, like a stock ticker. CSS `@keyframes ticker` animation.

```
▲ Westshore Commons 82 +4  ▲ Nocatee Parcels 88 +7  ▼ Ybor Mixed-Use 54 -3  ...
```

**Data source:** `GET /api/v1/deals` — map each deal to `{name, jedi_score, delta_30d}`. Green for positive delta, red for negative.

### 2C: F-Key Navigation Bar (28px fixed)

Horizontal bar of F-key buttons. Active button is amber bg with terminal-dark text. Inactive is transparent with secondary text.

```
┌──────────────────────────────────────────────────────────────────┐
│ F1 DASHBOARD  F2 PIPELINE  F3 PORTFOLIO  F4 MARKETS  F5 COMPETE │
└──────────────────────────────────────────────────────────────────┘
```

**Implementation:** Flex row. Each button: `font-size: 9px`, `font-weight: 600`, `font-family: mono`. F-key prefix in 7px bold, slightly dimmed. This REPLACES the current sidebar nav — no sidebar at all in terminal mode.

### 2D: Bottom Panel (180px collapsible)

Three-tab panel pinned to the bottom: ALERTS, NEWS, AGENTS. Tab buttons on top, content scrolls below.

- **ALERTS tab:** Severity-colored left border (red=critical, orange=high, amber=med). Type badge (ARBITRAGE, RISK, SCORE, DEADLINE, MARKET). Deal name in amber. Alert message in primary text. Timestamp right-aligned.
- **NEWS tab:** Time column, headline, impact badge (+DEMAND, +SUPPLY, RISK DN), JEDI pts change, affected deal badges.
- **AGENTS tab:** 3-column grid. Each agent card: left border green=ON / gray=IDLE. Agent code (A01) in purple, name, last action, time ago, message count.

**Data sources:**
- Alerts: `GET /api/v1/jedi/alerts`
- News: `GET /api/v1/news/feed`
- Agents: `/api/v1/agent-status` or WebSocket from Kafka

### 2E: Command Palette (⌘K overlay)

Already exists as `CommandPanel.tsx`. Keep but restyle: dark bg (`T.bg.panel`), amber accent, mono font. Add navigation commands (Email, Tasks, Strategy Builder, deal search).

### 2F: Deal Context Bar (amber, shows when inside a deal)

When navigated to a deal (`/deals/:id/detail`), a 32px amber-tinted bar appears below the F-key bar:

```
┌──────────────────────────────────────────────────────────────────┐
│ 📍 4201 W Boy Scout Blvd, Tampa FL  │ JEDI 82 ▲+4  │ DD  │ BTS │
└──────────────────────────────────────────────────────────────────┘
```

Shows: address, JEDI Score with delta, pipeline stage badge, recommended strategy badge. The F-key bar switches from Portfolio (F1-F9) to Deal (F1-F12).

---

## PART 3: SHARED COMPONENT LIBRARY

### File to create: `frontend/src/components/terminal/`

Build these reusable terminal-styled components. Every screen assembles from them.

### 3A: `PanelHeader.tsx`

Section header inside panels. Title in 10px mono uppercase, optional subtitle, optional right-side element (buttons, counts), optional colored top border.

```tsx
interface PanelHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  borderColor?: string; // e.g., T.text.cyan for a cyan accent stripe
}
```

### 3B: `MetricCell.tsx`

For dashboard-style KPI displays. Label in 8px muted mono uppercase, value in 20px bold primary, optional delta badge, optional sparkline.

```tsx
interface MetricCellProps {
  label: string;
  value: string;
  delta?: string;        // "+3.2%" — auto-colors green/red
  sparkData?: number[];  // renders SVG sparkline
  context?: string;      // "vs market avg 94.1%"
  contextColor?: 'green' | 'amber' | 'red' | 'gray';
}
```

### 3C: `Spark.tsx`

SVG sparkline. Takes `data: number[]`, `color`, `width`, `height`. Renders polyline. Already exists in the prototype — extract it.

### 3D: `Badge.tsx`

Inline badge for status, strategy, severity. Takes `label`, `color`. Renders mono 8px text with 1px border and 18% alpha background.

```tsx
// Usage:
<Badge label="BTS" color={T.text.purple} />
<Badge label="HIGH" color={T.text.red} />
<Badge label="DD" color={T.text.cyan} />
```

### 3E: `DataGrid.tsx`

Bloomberg-style data grid. Dense rows, alternating bg, sortable columns, hover highlight, click-to-select with amber left border. Column headers in 7px bold mono.

```tsx
interface DataGridProps {
  columns: { key: string; label: string; width?: string; sortable?: boolean; align?: 'left'|'right' }[];
  rows: Record<string, any>[];
  onRowClick?: (row: any) => void;
  onRowDoubleClick?: (row: any) => void;
  selectedId?: string | number;
}
```

### 3F: `SectionLabel.tsx`

10px mono uppercase label with optional color. For marking sections within a panel.

### 3G: `RiskDot.tsx`

Small colored dot + severity text. Green=LOW, Orange=MED, Red=HIGH (with pulsing glow animation for HIGH).

### 3H: `JEDIScoreGauge.tsx`

Circular SVG gauge for JEDI Score. 100px diameter. Colored border based on score tier (green ≥80, amber ≥65, red <65). Score in 32px bold center. Delta below. Sparkline of score history.

### 3I: `SignalBar.tsx`

Horizontal stacked bar for the 5 Master Signals (Demand 30%, Supply 25%, Momentum 20%, Position 15%, Risk 10%). Each segment colored. Scores below each segment.

### 3J: `StrategyComparison.tsx`

4-column comparison view for BTS | Flip | Rental | STR. Each column shows: strategy name, score (28px bold), IRR, YOC, timeline, 5-signal breakdown, winner badge, arbitrage alert.

### 3K: `TickerBar.tsx`

Auto-scrolling horizontal bar of deal tickers. Each shows deal name + JEDI score + delta. Green/red coloring. CSS animation.

---

## PART 4: PORTFOLIO SCREENS (F1–F9) — Content Specs

Each screen should be full-bleed dark (`T.bg.terminal`), no sidebar, no white cards. Content fills the area between the F-key nav bar and the bottom panel.

---

### F1 DASHBOARD — Portfolio Command Center

**Layout:** 3 rows.

**Row 1: Market Vitals Bar** (full width, 60px)
Horizontal strip of 5 KPI cells: Avg Effective Rent, Vacancy Rate, Absorbed Units, Rent Growth, Submarket Strength. Each cell: value + delta + sparkline. Uses `MetricCell`.

**Row 2: Pipeline Grid + Map** (split 60/40, flex-1)
- Left: `DataGrid` showing all pipeline deals. Columns: #, Property, Market, JEDI, D30, Strategy, IRR, EM, Price, $/Unit, Stage, Risk, Days. Sortable by JEDI score default. Double-click enters deal context.
- Right: Map panel with deals plotted. Score-colored markers (green/amber/red). Sized by unit count. Click highlights grid row.

**Row 3: Bottom Panel** (shared chrome — Alerts/News/Agents)

**Data sources:** `GET /api/v1/deals` for pipeline, `GET /api/v1/jedi/alerts` for alerts, `GET /api/v1/news/feed` for news, WebSocket for agents.

---

### F2 PIPELINE — Deal Flow Grid

**Layout:** Full-screen `DataGrid` with filters toolbar.

**Toolbar:** Strategy filter (BTS/Flip/Rental/STR), stage filter (Lead/Prospect/LOI/DD/Closed), market filter, score range slider, MAP toggle button.

**Grid columns:** Same as Dashboard but more columns exposed: #, Property, Address, Market, Submarket, JEDI, D30, Strategy, IRR, EM, CoC, DSCR, Price, $/Unit, $/SF, Cap Rate, Units, Stage, Risk, Days, Analyst.

**Row behavior:** Click selects (amber left border). Double-click navigates to deal detail. Right-click shows context menu (Show on Map, Change Stage, Quick Score).

**Map panel:** Optional right panel (toggled by MAP button). Shows deals geographically. Mapbox dark style (`mapbox://styles/mapbox/dark-v11`).

**Data source:** `GET /api/v1/deals` with query params for filtering.

---

### F3 PORTFOLIO — Owned Assets

**Layout:** Similar to Pipeline but for owned properties.

**Key difference:** Columns include post-close metrics: Current NOI, Budget NOI, Variance %, Occupancy, Avg Rent, YOY Growth, JEDI Score (monitoring), Portfolio Weight.

**Status indicators:** Green = performing above pro forma. Amber = within 5%. Red = below budget by >5%.

**Expandable row:** Click to show a mini-dashboard per property: 6-month NOI trend sparkline, occupancy trend, lease expiration schedule bar, maintenance alerts.

**Data source:** `GET /api/v1/assets-owned`, `GET /api/v1/properties/:id/performance` for detail.

---

### F4 MARKETS — Market Intelligence Hub

**Layout:** 2 panels (left 60% + right 40%).

**Left panel: Submarket Grid**
`DataGrid` of submarkets. Columns: Submarket, Properties, Units, Avg Rent, Vacancy, Rent Growth (YOY), Opportunity Score, Buyer/Seller Pressure. Sortable. Click selects submarket.

**Right panel: Selected Submarket Detail**
When a submarket is selected, shows:
- Header: submarket name, opportunity score gauge
- Rent trend chart (12mo)
- Supply pipeline (units under construction, units permitted, delivery timeline)
- Top 5 properties in submarket with JEDI scores
- Macro overlay: employment growth, population growth, median income

**Internal tabs** (via `DealScreenWrapper` pattern from Spec 1):
- `Compare` — side-by-side submarket comparison (2-4 markets, like Bloomberg REL VALUE screen)
- `Supply` — construction pipeline, permits, deliveries timeline
- `Macro` — Fed rates, CPI, employment, population — M28 Macro Cycle data
- `Owners` — active buyers/sellers in market, transaction velocity

**Data sources:** Market Intelligence APIs, Apartment Locator AI, FRED/BLS, Census.

---

### F5 COMPETE — Competitive Intelligence

**Layout:** Top-level grid + detail panel.

**Grid:** Properties ranked by Performance Composite Score (PCS). Columns: Rank, Property, Owner, PCS, Traffic Score (T-04 quadrant), Occupancy, Avg Rent, Rent Growth, Review Score, Quadrant Badge.

**Quadrant badges:** Hidden Gem (green), Validated Winner (blue), Hype Risk (amber), Underperformer (red). Based on T-04 Physical×Digital matrix.

**Detail panel (on select):** Amenity comparison table, rent positioning vs comp set, Google review sentiment trend, competitive displacement warnings.

**Internal tabs:**
- `Rankings` — PCS leaderboard
- `Acquisition` — non-owned properties flagged as targets, acquisition target score
- `Comps` — trade area + like-kind comp analysis
- `Traffic` — physical + digital traffic scores, trajectory

**Data sources:** Competition service, Google Places, SpyFu, traffic engine.

---

### F6 NEWS — News & Event Intelligence

**Layout:** 3-column: News Feed (50%) | Impact Analysis (25%) | Deal Correlations (25%).

**News Feed:** Chronological list of market-moving events. Each item: timestamp, headline, source, impact badge (+DEMAND/-SUPPLY/RISK), JEDI point impact, affected deals list.

**Impact Analysis:** When a news item is selected, shows: which JEDI signals it affects, estimated point impact per deal, confidence level, transmission chain (M28 pattern).

**Deal Correlations:** Right panel shows which pipeline deals are affected by the selected news item, with before/after score projections.

**Data source:** `GET /api/v1/news/feed`, news.service.ts.

---

### F7 OPPORTUNITIES — Deal Sourcing Feed

**Layout:** Opportunity cards in a vertical feed, sorted by opportunity score.

**Each card:**
- Property address + type
- Opportunity type badge: DISTRESS, BELOW_MARKET, ZONING_CHANGE, MGMT_FAILURE, DEREGULATION
- Opportunity score (0-100)
- Key signal: "Owner 18mo behind on taxes" / "Rents 22% below market" / "Zoning change approved"
- Estimated JEDI Score if acquired
- One-click: CREATE DEAL (pre-populates deal creation with this address)

**Filters:** Opportunity type, market, min score, strategy match.

**Data source:** `GET /api/v1/opportunity-engine/alerts` (or new endpoint).

---

### F8 REPORTS — Generated Documents

**Layout:** Report library grid.

**Types:** Deal Memo, LP Quarterly Report, Market Report (monthly auto-gen), Comp Report, Strategy Brief.

**Each row:** Report name, type badge, deal association, generated date, status (Draft/Final), download link.

**Generate button:** Opens a modal to select report type, deal, date range. Triggers Claude-generated report via API.

---

### F9 SETTINGS — Configuration

**Layout:** Settings nav on left (mini sidebar), content on right.

**Sections:**
- `Team` — org members, roles (Owner/Principal/Analyst/Viewer), invite
- `Comp Library` — saved comps across markets
- `Data Library` — CSV/Excel uploads, data sources
- `Template Library` — ProForma, Deal Memo, LP Report templates
- `Market Benchmarks` — cap rates, rent growth targets by submarket
- `Model Library` — saved financial model versions
- `Integrations` — QuickBooks, MLS, email, Twilio status
- `Billing` — Stripe subscription, credit usage, tier

---

## PART 5: DEAL SCREENS (F1–F12) — Content Specs

When inside a deal, the F-key bar switches to Deal Nav (F1-F12). The amber deal context bar appears. All screens render in the same terminal dark theme.

---

### F1 OVERVIEW (M01) — Deal Command Center

**This is the deal-capsule-overviews JSX you already built.** Use the 3-variant pattern (Existing / Development / Redevelopment) from `deal-capsule-overviews_(1)_1773544596111.jsx`.

**Structure for all variants:**
1. **PropertyIdentityStrip** — name, type badge, address, pricing hero, property detail grid, zoning envelope bar, unit mix bar
2. **JEDI Score Hero** — circular gauge + 5-signal breakdown + confidence + 30d delta
3. **Strategy Verdict Card** — winning strategy, arbitrage alert, 4-strategy comparison mini
4. **Risk Alert Banner** — if any signal is HIGH, show amber/red alert
5. **Variant-specific KPIs** (4-column MetricCard grid)
6. **Variant-specific intelligence** (Sources & Uses, NOI Waterfall, Cost Stack, Timeline)
7. **Signal Detail Cards** — 5-column grid, one per signal

**Internal tabs:** Overview, Context Tracker, Team

---

### F2 PROPERTY (M02) — Zoning & Property Intel

**Already has 7 internal tabs.** Keep the existing ZoningModuleSection. Restyle to dark theme:
- Tab bar uses terminal header bg
- Content panels use terminal panel bg
- Data tables use DataGrid component
- Source citations (Municode links) render as cyan links

**Tabs:** Boundary & Zoning, Dev Capacity, Regulatory Risk, Zoning Comparator, Time-to-Shovel, Entitlements, Site Plan

---

### F3 MARKET (M05) — Market Intelligence

**Internal tabs:** Intelligence, Unit Mix, Trends, Opportunity

**Intelligence tab:** Submarket dashboard — rent trends, occupancy, absorption, comparable properties. Trade area / submarket / MSA scope switcher.

**Unit Mix tab:** UnitMixIntelligence component — utilization bar constrained by development envelope, unit type grid, rent positioning.

**Trends tab:** Time-series charts — rent growth, vacancy, supply deliveries, demand indicators. 12mo / 3yr / 5yr toggle.

**Opportunity tab:** Local opportunity engine — distress signals, below-market rents, management failures in trade area.

---

### F4 SUPPLY (M04) — Pipeline Threat

**Full-screen supply intelligence.** 

**Top:** Supply Risk Score gauge (0-100) with delta.

**Middle:** Construction pipeline table — project name, developer, units, status (Permitted/Under Construction/Lease-Up), delivery date, distance from subject.

**Bottom:** Timeline chart — units delivering by quarter over next 24 months. Absorption overlay showing capacity to absorb.

**Data source:** `GET /api/v1/supply/trade-area/:id`

---

### F5 STRATEGY (M08) — Arbitrage Engine

**Internal tabs:** Arbitrage, 3D Design, Tax

**Arbitrage tab:** The core Bloomberg screen. 4-column strategy comparison:
- Each column: strategy name, score (big number), per-signal breakdown (5 bars), IRR, YOC, timeline, risk flags
- Arbitrage alert banner when gap ≥15pts
- Collision detection: "Broker recommends RENTAL. Platform scores BTS +22pts higher."

**3D Design tab:** Design3DPageEnhanced — Three.js massing, typology selection, site solver.

**Tax tab:** TaxModule — tax intelligence, millage rates, exemptions, abatements.

---

### F6 PROFORMA (M09) — Financial Model

**Internal tabs:** Pro Forma, Dashboard

**Pro Forma tab:** The Bloomberg-style financial model. NOI waterfall, Sources & Uses, 10-year cash flow table with scrollable columns, assumption override panel (3-layer: broker > platform > user).

**Dashboard tab:** FinancialDashboard — key returns summary (IRR, EM, CoC, DSCR), sensitivity tables, scenario comparison.

---

### F7 CAPITAL (M11) — Debt, Equity & Exit

**Full screen ExitCapitalModule.** Capital stack visualization (stacked bar), debt terms table, equity waterfall, exit scenario modeling, refi analysis.

---

### F8 RISK (M14) — Risk Assessment

**Internal tabs:** Risk Intel, Collision, DD Checklist

**Risk Intel tab:** Risk scoring dashboard. 6 risk categories: Market, Regulatory, Insurance, Construction, Environmental, Operational. Each with score, trend, key drivers.

**Collision tab:** CollisionAnalysisSection — broker claim vs. platform intelligence comparison. Side-by-side with divergence flags.

**DD Checklist tab:** DueDiligencePage — checklist with completion status, deadline tracking, document requirements.

---

### F9 COMPS (M15) — Comparable Analysis

**Internal tabs:** Competition, Sale Comps

**Competition tab:** Trade area competitive set. Properties ranked by relevance. Rent comparison table, amenity gap analysis, review sentiment comparison.

**Sale Comps tab:** Recent sales in trade area. Price/unit, price/SF, cap rate, buyer, date. Comp adjustment grid.

---

### F10 TRAFFIC (M07) — Traffic Intelligence

**Full screen TrafficModule.** Physical traffic score (T-02), digital traffic score (T-03), T-04 quadrant classification, walk-in prediction curve, trajectory trend, PCS rank within submarket.

---

### F11 DOCS (M18) — Documents & Lifecycle

**Internal tabs:** Files, Deal Lifecycle

**Files tab:** Document library. Upload, categorize, tag. File types: LOI, PSA, Rent Roll, T-12, Inspection Reports, Appraisal.

**Deal Lifecycle tab:** Pipeline stage tracker with stage gates. Manufacturing metaphor: Intake → Intelligence → Underwriting → Packaging → Execution → Post-Close.

---

### F12 EXIT (M20) — Execution & Exit

**Internal tabs:** Timeline, Project Mgmt, Construction

**Timeline tab:** Gantt-style project timeline. Milestones, dependencies, critical path.

**Project Mgmt tab:** Task board, team assignments, progress tracking.

**Construction tab:** Construction management — draw schedule, budget tracking, progress photos, punch list.

---

## PART 6: IMPLEMENTATION PLAN

### Phase 1: Terminal Shell (2-3 days)
1. Create `terminal-tokens.ts`
2. Create shared components (`PanelHeader`, `MetricCell`, `Badge`, `DataGrid`, `Spark`, `RiskDot`, `JEDIScoreGauge`, `TickerBar`)
3. Restyle `MainLayout.tsx` — dark terminal chrome with top bar, ticker, F-key nav, bottom panel
4. Remove white sidebar entirely — full-bleed content area
5. Load Google Fonts for JetBrains Mono + IBM Plex

### Phase 2: Portfolio Screens (3-4 days)
6. F1 Dashboard — wire pipeline DataGrid + market vitals bar
7. F2 Pipeline — full DataGrid with filters + map toggle
8. F3 Portfolio — owned assets grid with performance indicators
9. F4 Markets — submarket grid + detail panel + internal tabs
10. F5 Compete — PCS rankings + quadrant badges
11. F6 News — news feed + impact analysis
12. F7 Opportunities — stub → opportunity cards feed
13. F8 Reports — report library grid
14. F9 Settings — settings layout with dark theme

### Phase 3: Deal Screens (4-5 days)
15. F1 Overview — port `deal-capsule-overviews` JSX into OverviewRouter with dark terminal styling
16. F2 Property — restyle ZoningModuleSection to dark theme
17. F3 Market — compose MarketScreenWrapper with internal tabs
18. F4 Supply — restyle SupplyPipelinePage to dark theme
19. F5 Strategy — compose StrategyScreenWrapper, build arbitrage 4-column view
20. F6 ProForma — compose ProFormaScreenWrapper
21. F7 Capital — restyle ExitCapitalModule
22. F8 Risk — compose RiskScreenWrapper
23. F9 Comps — compose CompsScreenWrapper
24. F10 Traffic — restyle TrafficModule
25. F11 Docs — compose DocsScreenWrapper
26. F12 Exit — compose ExitScreenWrapper

### Phase 4: Polish (1-2 days)
27. Keyboard shortcuts: F-keys + ⌘K
28. Animations: fadeIn on screen switch, flash on score change, glow on alerts
29. Scrollbar styling: thin, dark theme
30. CRT scanline overlay (subtle, 3% opacity)
31. Responsive: tablet breakpoint collapses to single-panel
32. Dark mode Mapbox style integration

---

## PART 7: FILES TO CREATE

| File | Purpose |
|---|---|
| `frontend/src/styles/terminal-tokens.ts` | Design system token export |
| `frontend/src/components/terminal/PanelHeader.tsx` | Section header |
| `frontend/src/components/terminal/MetricCell.tsx` | KPI metric display |
| `frontend/src/components/terminal/Spark.tsx` | SVG sparkline |
| `frontend/src/components/terminal/Badge.tsx` | Status/strategy badge |
| `frontend/src/components/terminal/DataGrid.tsx` | Bloomberg-style data grid |
| `frontend/src/components/terminal/RiskDot.tsx` | Risk severity indicator |
| `frontend/src/components/terminal/JEDIScoreGauge.tsx` | Circular score gauge |
| `frontend/src/components/terminal/SignalBar.tsx` | 5-signal stacked bar |
| `frontend/src/components/terminal/StrategyComparison.tsx` | 4-strategy column view |
| `frontend/src/components/terminal/TickerBar.tsx` | Auto-scrolling property ticker |
| `frontend/src/components/terminal/SectionLabel.tsx` | Section label |
| `frontend/src/components/terminal/index.ts` | Barrel export |

## PART 8: FILES TO MODIFY

| File | Change |
|---|---|
| `frontend/src/components/layout/MainLayout.tsx` | Full rewrite to terminal chrome: dark bg, top bar, ticker, F-key nav, bottom panel, no sidebar |
| `frontend/src/pages/DealDetailPage.tsx` | Dark theme, deal context bar, F-key nav switch |
| `frontend/index.html` | Add Google Fonts link |
| `tailwind.config.ts` | Extend with terminal color tokens |
| Every page component | Replace white card styling with terminal panel styling |

## PART 9: CRITICAL DESIGN RULES

1. **No white backgrounds.** Every surface is `T.bg.terminal`, `T.bg.panel`, or `T.bg.header`. Never `bg-white` or `bg-gray-50`.
2. **No Tailwind color utilities for brand colors.** Use `T.text.amber` etc. from tokens. Tailwind utilities OK for layout (flex, grid, padding).
3. **Mono font for numbers and labels.** JetBrains Mono for: scores, percentages, currency, dates, badge text, section headers. IBM Plex Sans for: descriptions, context text, long-form content.
4. **Data density over whitespace.** Bloomberg shows 50+ data points per screen. Cards are compact (14-20px padding, not 24-32px). Row height is 28-32px, not 48px.
5. **Amber is the accent.** Totals in amber. Active nav in amber. Selected row border in amber. Logo gradient is teal-cyan but UI accent is amber.
6. **Scores drive color.** ≥80 = green. 65-79 = amber. <65 = red. This applies to JEDI Score, PCS, signal scores, risk scores — everything.
7. **Every number has a delta.** Where possible, show change: +3.2%, -1.8%, ▲+4. Delta is always green (positive) or red (negative).
8. **Sparklines everywhere.** Any metric with historical data gets a 56×16 sparkline next to it.
9. **No emoji in terminal mode.** Replace sidebar emoji (📊📧🏢) with: nothing (text labels suffice) or tiny SVG icons in muted color.
10. **CRT overlay.** Subtle repeating horizontal line pattern at 3% opacity over the entire viewport. Creates the terminal feel without being distracting.
