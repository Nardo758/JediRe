# NAVIGATION REFRAME — Portfolio Sidebar + Deal Sidebar

> **Goal:** Flatten the current accordion-based sidebar into Bloomberg Terminal-style F-key screens. The address is the ticker. Every property gets the same analytical framework.
>
> **Two surfaces to change:**
> 1. **Portfolio sidebar** (`MainLayout.tsx`) — major rewrite
> 2. **Deal sidebar** (`DealDetailPage.tsx`) — moderate restructure (tab grouping, not tab deletion)

---

## PART 1: PORTFOLIO SIDEBAR REFRAME

### File: `frontend/src/components/layout/MainLayout.tsx`

**Current structure (lines 171–383):** Three sections with nested accordions:
- "Control Panel" → Dashboard, Email, Pipeline, Assets Owned
- "Intelligence" → Market Intelligence (5 sub-items), Competitive Intel (4 sub-items), Strategies, News Intel
- "Tools" → Tasks, Reports, Team

**Target structure:** Flat F-key navigation, 9 screens, no accordions.

### New Sidebar Navigation Items

Replace the entire `<nav className="space-y-1">` block (lines 171–383) with a flat list. Remove `expandedSections` state entirely — no more accordions.

```
F1  DASHBOARD       → /dashboard              (existing Dashboard component)
F2  PIPELINE        → /deals                   (existing DealsPage)
F3  PORTFOLIO       → /assets-owned            (existing AssetsOwnedPage)
F4  MARKETS         → /market-intelligence     (existing MarketIntelligencePage)
F5  COMPETE         → /competitive-intelligence (existing, redirect to /performance)
F6  NEWS            → /news-intel              (existing NewsIntelligencePage)
F7  OPPORTUNITIES   → /opportunities           (NEW page — stub for now)
F8  REPORTS         → /reports                 (existing ReportsPage)
F9  SETTINGS        → /settings                (existing SettingsPage — absorbs Team)
```

### What gets removed from the sidebar
- **Email** → moves to command palette (`CommandPanel.tsx`) as a command, not a nav item
- **Tasks** → moves to command palette as a command
- All sub-items under Market Intelligence (Compare, Owners, Supply, Traffic, Competitive Position) → become **internal tabs** inside the MarketIntelligencePage, not sidebar nav
- All sub-items under Competitive Intel (Performance, Acquisition, Comps, Alerts) → become **internal tabs** inside CompetitiveIntelligencePage, not sidebar nav
- **Strategies** → accessible from deal context (Strategy Builder) and command palette, not a top-level portfolio nav item
- **Team** → becomes a tab inside Settings

### Implementation Steps

#### Step 1: Remove accordion state from MainLayout.tsx

Delete the `expandedSections` state and `toggleSection` function (lines 19–45). They are no longer needed.

#### Step 2: Replace sidebar nav content

Replace lines 171–383 with a flat list of 9 items. Each item uses the existing `SidebarItem` component (no `hasSubItems`, no `isExpanded`, no `onToggle`).

New sidebar JSX (replaces everything inside `<nav className="space-y-1">`):

```tsx
{/* F-KEY SCREENS */}
<div className="mb-2">
  <h3 className="px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest font-mono">
    Portfolio · F1–F9
  </h3>
</div>

<SidebarItem icon="📊" label="Dashboard"     path="/dashboard"                isActive={isActive('/dashboard')} />
<SidebarItem icon="📋" label="Pipeline"      path="/deals"        count={12}  isActive={isActivePrefix('/deals')} />
<SidebarItem icon="🏢" label="Portfolio"     path="/assets-owned" count={23}  isActive={isActivePrefix('/assets-owned')}
  layerConfig={{ sourceType: 'assets', layerType: 'pin', defaultStyle: { icon: '🏢', color: '#10b981', size: 'medium' } }}
  onShowOnMap={handleShowOnMap}
/>
<SidebarItem icon="📈" label="Markets"       path="/market-intelligence"      isActive={isActivePrefix('/market-intelligence')} />
<SidebarItem icon="🎯" label="Compete"       path="/competitive-intelligence" isActive={isActivePrefix('/competitive-intelligence')} />
<SidebarItem icon="📰" label="News"          path="/news-intel"   count={3}   isActive={isActivePrefix('/news-intel')}
  layerConfig={{ sourceType: 'news', layerType: 'heatmap', defaultStyle: { colorScale: ['#fef3c7','#fbbf24','#f59e0b','#dc2626'], radius: 25, intensity: 1.0 } }}
  onShowOnMap={handleShowOnMap}
/>
<SidebarItem icon="⚡" label="Opportunities" path="/opportunities"            isActive={isActivePrefix('/opportunities')} />
<SidebarItem icon="📄" label="Reports"       path="/reports"                  isActive={isActive('/reports')} />
<SidebarItem icon="⚙️" label="Settings"      path="/settings"                 isActive={isActivePrefix('/settings')} />

{/* COMMAND PALETTE HINT */}
<div className="mt-6 px-4">
  <button
    onClick={() => setCommandPanelOpen(true)}
    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors font-mono"
  >
    <span>⌘K</span>
    <span className="text-gray-300">Email · Tasks · Search</span>
  </button>
</div>
```

#### Step 3: Add F-key keyboard shortcuts

Add this `useEffect` after the existing ⌘K handler (around line 96):

```tsx
// F-key navigation for portfolio screens
useEffect(() => {
  const handleFKey = (e: KeyboardEvent) => {
    // Don't intercept if user is typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    // Don't intercept if inside a deal page (deal page has its own key handlers)
    if (location.pathname.startsWith('/deals/') && location.pathname.includes('/detail')) return;

    const fKeyRoutes: Record<string, string> = {
      'F1': '/dashboard',
      'F2': '/deals',
      'F3': '/assets-owned',
      'F4': '/market-intelligence',
      'F5': '/competitive-intelligence',
      'F6': '/news-intel',
      'F7': '/opportunities',
      'F8': '/reports',
      'F9': '/settings',
    };

    if (fKeyRoutes[e.key]) {
      e.preventDefault();
      navigate(fKeyRoutes[e.key]);
    }
  };
  window.addEventListener('keydown', handleFKey);
  return () => window.removeEventListener('keydown', handleFKey);
}, [location.pathname]);
```

You will need to add `useNavigate` import and call at the top of the component:
```tsx
import { useNavigate } from 'react-router-dom';
// inside the component:
const navigate = useNavigate();
```

#### Step 4: Add Opportunities stub route in App.tsx

In `frontend/src/App.tsx`, add the route inside the `<Route element={<MainLayout />}>` block:

```tsx
<Route path="/opportunities" element={<OpportunitiesPage />} />
```

Create the stub page at `frontend/src/pages/OpportunitiesPage.tsx`:

```tsx
import React from 'react';
import { Zap } from 'lucide-react';

export const OpportunitiesPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Zap className="text-amber-500" size={24} />
        <h1 className="text-2xl font-bold text-slate-900">Opportunities</h1>
        <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">F7</span>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <p className="text-slate-500 text-sm">Deals the platform detected for you — coming soon</p>
        <p className="text-slate-400 text-xs mt-2">
          Distress signals · Below-market rents · Zoning changes · Management failures · STR deregulation
        </p>
      </div>
    </div>
  );
};

export default OpportunitiesPage;
```

Import it in App.tsx:
```tsx
import { OpportunitiesPage } from './pages/OpportunitiesPage';
```

#### Step 5: Add Email + Tasks to CommandPanel.tsx

In `frontend/src/components/layout/CommandPanel.tsx`, add navigation commands to the command palette so Email and Tasks are accessible via ⌘K.

Find the section where navigation/commands are rendered and add:

```tsx
// Add to the commands list alongside existing strategy items
const navigationCommands = [
  { label: 'Email Inbox', icon: '📧', path: '/dashboard/email', shortcut: '' },
  { label: 'Tasks', icon: '✅', path: '/tasks', shortcut: '' },
  { label: 'Team Management', icon: '👥', path: '/team', shortcut: '' },
  { label: 'Strategy Builder', icon: '⚡', path: '/strategies', shortcut: '' },
  { label: 'Create New Deal', icon: '➕', path: '/deals/create', shortcut: '' },
];
```

These should appear in the command palette search results and be navigable.

---

## PART 2: DEAL SIDEBAR RESTRUCTURE

### File: `frontend/src/pages/DealDetailPage.tsx`

**Current structure (lines 252–457):** 6 TabGroups with 30+ individual tabs shown in a sidebar accordion. Works, but the Bloomberg model is: 12 flat F-key screens, each with internal tabs.

**Target structure:** Collapse the 6 groups into 12 F-key entries. Sub-tabs that currently live in the sidebar become **internal tabs rendered inside the screen content area**, not sidebar items.

### New Deal Sidebar — 12 Screens

Replace the 6 `<TabGroup>` blocks (lines 641–691) with a flat list of 12 items. Each screen maps to a module.

```
F1   OVERVIEW    M01   → OverviewRouter (already done — routes by ProjectType)
F2   PROPERTY    M02   → ZoningModuleSection (already has 7 internal tabs)
F3   MARKET      M05   → NEW wrapper: MarketIntelligencePage + Unit Mix + Trends + Opportunity Engine as internal tabs
F4   SUPPLY      M04   → SupplyPipelinePage
F5   STRATEGY    M08   → NEW wrapper: StrategySection + 3D Design + Tax as internal tabs
F6   PROFORMA    M09   → NEW wrapper: ProFormaTab + Financial Dashboard as internal tabs
F7   CAPITAL     M11   → ExitCapitalModule (Debt, Equity & Exit)
F8   RISK        M14   → NEW wrapper: RiskIntelligence + Collision Analysis + DD Checklist as internal tabs
F9   COMPS       M15   → NEW wrapper: CompetitionPage + CompsModule (Sale Comps) as internal tabs
F10  TRAFFIC     M07   → TrafficModule
F11  DOCS        M18   → NEW wrapper: FilesSection + Deal Lifecycle as internal tabs
F12  EXIT        M20   → NEW wrapper: Project Timeline + Project Mgmt + Construction Mgmt as internal tabs
```

### What moves from sidebar to internal tabs

| Current sidebar tab | New home |
|---|---|
| Context Tracker | F1 Overview (internal tab) |
| Team & Collaborators | F1 Overview (internal tab) |
| Unit Mix Intelligence | F3 Market (internal tab) |
| Opportunity Engine | F3 Market (internal tab) |
| Trends Analysis | F3 Market (internal tab) |
| Sale Comps | F9 Comps (internal tab alongside Competition) |
| 3D Building Design | F5 Strategy (internal tab) |
| Tax Intelligence | F5 Strategy (internal tab) |
| Financial Dashboard | F6 ProForma (internal tab) |
| Collision Analysis | F8 Risk (internal tab) |
| DD Checklist | F8 Risk (internal tab) |
| Deal Lifecycle | F11 Docs (internal tab) |
| Project Timeline | F12 Exit (internal tab) |
| Project Management | F12 Exit (internal tab) |
| Construction Mgmt | F12 Exit (internal tab) |
| Opus AI Agent | Command palette (⌘K) or persistent chat overlay (already exists) |
| AI Recommendations | Embedded in F1 Overview |

### Implementation: DealScreenWrapper Component

Create a reusable wrapper for screens that have internal tabs.

File: `frontend/src/components/deal/DealScreenWrapper.tsx`

```tsx
import React, { useState } from 'react';

interface ScreenTab {
  id: string;
  label: string;
  component: React.ComponentType<any>;
}

interface DealScreenWrapperProps {
  tabs: ScreenTab[];
  defaultTab?: string;
  screenLabel: string;
  moduleCode: string;
  passProps?: Record<string, any>;
}

export const DealScreenWrapper: React.FC<DealScreenWrapperProps> = ({
  tabs, defaultTab, screenLabel, moduleCode, passProps = {}
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);
  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || tabs[0]?.component;

  if (tabs.length === 1) {
    return <ActiveComponent {...passProps} />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-200 bg-white flex-shrink-0">
        <span className="text-[10px] font-mono text-slate-400 mr-2">{moduleCode}</span>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <ActiveComponent {...passProps} />
      </div>
    </div>
  );
};
```

### New Deal Tab Definitions

Replace the current 6 tab group arrays (lines 252–457) with 12 screen definitions:

```tsx
// The 12 F-key deal screens
const dealScreens: { id: string; label: string; fkey: string; module: string; component: React.ComponentType<any> }[] = [
  { id: 'overview',  label: 'Overview',  fkey: 'F1',  module: 'M01', component: OverviewScreenWrapper },
  { id: 'property',  label: 'Property',  fkey: 'F2',  module: 'M02', component: ZoningModuleSection },
  { id: 'market',    label: 'Market',    fkey: 'F3',  module: 'M05', component: MarketScreenWrapper },
  { id: 'supply',    label: 'Supply',    fkey: 'F4',  module: 'M04', component: SupplyPipelinePage },
  { id: 'strategy',  label: 'Strategy',  fkey: 'F5',  module: 'M08', component: StrategyScreenWrapper },
  { id: 'proforma',  label: 'Pro Forma', fkey: 'F6',  module: 'M09', component: ProFormaScreenWrapper },
  { id: 'capital',   label: 'Capital',   fkey: 'F7',  module: 'M11', component: ExitCapitalModule },
  { id: 'risk',      label: 'Risk',      fkey: 'F8',  module: 'M14', component: RiskScreenWrapper },
  { id: 'comps',     label: 'Comps',     fkey: 'F9',  module: 'M15', component: CompsScreenWrapper },
  { id: 'traffic',   label: 'Traffic',   fkey: 'F10', module: 'M07', component: TrafficModule },
  { id: 'docs',      label: 'Docs',      fkey: 'F11', module: 'M18', component: DocsScreenWrapper },
  { id: 'exit',      label: 'Exit',      fkey: 'F12', module: 'M20', component: ExitScreenWrapper },
];
```

Where the wrapper components are defined above the screen array:

```tsx
// Screen wrappers that compose internal tabs using DealScreenWrapper
const MarketScreenWrapper: React.FC<any> = (props) => (
  <DealScreenWrapper
    screenLabel="Market" moduleCode="M05"
    tabs={[
      { id: 'intelligence', label: 'Intelligence', component: MarketIntelligencePage },
      { id: 'unit-mix', label: 'Unit Mix', component: UnitMixIntelligence },
      { id: 'trends', label: 'Trends', component: TrendsAnalysisSection },
      { id: 'opportunity', label: 'Opportunity', component: OpportunityEngineSection },
    ]}
    passProps={props}
  />
);

const StrategyScreenWrapper: React.FC<any> = (props) => (
  <DealScreenWrapper
    screenLabel="Strategy" moduleCode="M08"
    tabs={[
      { id: 'strategy', label: 'Strategy', component: StrategySection },
      { id: '3d-design', label: '3D Design', component: Design3DPageEnhanced },
      { id: 'tax', label: 'Tax', component: TaxModule },
    ]}
    passProps={props}
  />
);

const ProFormaScreenWrapper: React.FC<any> = (props) => (
  <DealScreenWrapper
    screenLabel="Pro Forma" moduleCode="M09"
    tabs={[
      { id: 'proforma', label: 'Pro Forma', component: ProFormaTab },
      { id: 'dashboard', label: 'Dashboard', component: FinancialDashboard },
    ]}
    passProps={props}
  />
);

const RiskScreenWrapper: React.FC<any> = (props) => (
  <DealScreenWrapper
    screenLabel="Risk" moduleCode="M14"
    tabs={[
      { id: 'risk', label: 'Risk Intel', component: RiskIntelligence },
      { id: 'collision', label: 'Collision', component: CollisionAnalysisSection },
      { id: 'dd', label: 'DD Checklist', component: DueDiligencePage },
    ]}
    passProps={props}
  />
);

const CompsScreenWrapper: React.FC<any> = (props) => (
  <DealScreenWrapper
    screenLabel="Comps" moduleCode="M15"
    tabs={[
      { id: 'competition', label: 'Competition', component: CompetitionPage },
      { id: 'sales', label: 'Sale Comps', component: CompsModule },
    ]}
    passProps={props}
  />
);

const DocsScreenWrapper: React.FC<any> = (props) => (
  <DealScreenWrapper
    screenLabel="Docs" moduleCode="M18"
    tabs={[
      { id: 'files', label: 'Files', component: FilesSection },
      { id: 'lifecycle', label: 'Deal Lifecycle', component: DealStatusSection },
    ]}
    passProps={props}
  />
);

const ExitScreenWrapper: React.FC<any> = (props) => (
  <DealScreenWrapper
    screenLabel="Exit" moduleCode="M20"
    tabs={[
      { id: 'timeline', label: 'Timeline', component: ProjectTimelinePage },
      { id: 'project', label: 'Project Mgmt', component: ProjectManagementSection },
      { id: 'construction', label: 'Construction', component: ConstructionManagementSection },
    ]}
    passProps={props}
  />
);

const OverviewScreenWrapper: React.FC<any> = (props) => (
  <DealScreenWrapper
    screenLabel="Overview" moduleCode="M01"
    tabs={[
      { id: 'overview', label: 'Overview', component: OverviewRouter },
      { id: 'context', label: 'Context', component: ContextTrackerSection },
      { id: 'team', label: 'Team', component: TeamManagementSection },
    ]}
    passProps={props}
  />
);
```

### New Deal Sidebar JSX

Replace the 6 `<TabGroup>` blocks (lines 641–691) with a flat F-key list:

```tsx
<nav className="flex-1">
  <div className="px-3 py-2">
    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
      Deal · F1–F12
    </span>
  </div>
  {dealScreens.map(screen => (
    <button
      key={screen.id}
      onClick={() => setActiveTab(screen.id)}
      className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors rounded-lg mx-1 ${
        activeTab === screen.id
          ? 'bg-blue-500 text-white font-medium'
          : 'text-slate-600 hover:bg-slate-50'
      }`}
    >
      <span className={`text-[10px] font-mono w-6 ${
        activeTab === screen.id ? 'text-blue-200' : 'text-slate-400'
      }`}>
        {screen.fkey}
      </span>
      <span className="flex-1">{screen.label}</span>
      <span className={`text-[10px] font-mono ${
        activeTab === screen.id ? 'text-blue-200' : 'text-slate-300'
      }`}>
        {screen.module}
      </span>
    </button>
  ))}
</nav>
```

### Update keyboard shortcuts

Replace the existing keyMap (lines 231–248) with F-key mapping:

```tsx
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    const fKeyMap: Record<string, string> = {
      'F1': 'overview',
      'F2': 'property',
      'F3': 'market',
      'F4': 'supply',
      'F5': 'strategy',
      'F6': 'proforma',
      'F7': 'capital',
      'F8': 'risk',
      'F9': 'comps',
      'F10': 'traffic',
      'F11': 'docs',
      'F12': 'exit',
    };

    if (fKeyMap[e.key]) {
      e.preventDefault();
      setActiveTab(fKeyMap[e.key]);
    }
  };
  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, []);
```

---

## PART 3: ROUTE CLEANUP IN App.tsx

### Redirects for removed sidebar paths

These sidebar paths no longer exist as separate routes since they became internal tabs. Add redirects:

```tsx
{/* Market Intelligence sub-routes → main market page */}
<Route path="/market-intelligence/compare" element={<Navigate to="/market-intelligence" replace />} />
<Route path="/market-intelligence/owners" element={<Navigate to="/market-intelligence" replace />} />
<Route path="/market-intelligence/supply" element={<Navigate to="/market-intelligence" replace />} />
<Route path="/market-intelligence/traffic-intelligence" element={<Navigate to="/market-intelligence" replace />} />
<Route path="/market-intelligence/competitive-position" element={<Navigate to="/market-intelligence" replace />} />

{/* Strategy → accessible from deal context */}
<Route path="/strategies" element={<Navigate to="/deals" replace />} />
```

**Keep the existing routes for**: `/market-intelligence/markets/:marketId`, `/market-intelligence/property/:id`, and all `/competitive-intelligence/*` sub-routes since those pages still render standalone.

### New route
```tsx
<Route path="/opportunities" element={<OpportunitiesPage />} />
```

---

## PART 4: FILES TO CREATE

| File | Purpose |
|---|---|
| `frontend/src/components/deal/DealScreenWrapper.tsx` | Reusable internal-tab wrapper for deal F-key screens |
| `frontend/src/pages/OpportunitiesPage.tsx` | Stub page for F7 Opportunities |

## PART 5: FILES TO MODIFY

| File | Change |
|---|---|
| `frontend/src/components/layout/MainLayout.tsx` | Remove accordion state. Replace sidebar nav with flat F-key list. Add F-key keyboard shortcuts. Add `useNavigate`. |
| `frontend/src/pages/DealDetailPage.tsx` | Replace 6 TabGroup definitions with 12 dealScreens array. Create screen wrapper components. Replace sidebar JSX. Update keyboard shortcuts from 1-6 to F1-F12. |
| `frontend/src/App.tsx` | Add OpportunitiesPage import + route. Add redirects for removed sub-routes. |
| `frontend/src/components/layout/CommandPanel.tsx` | Add Email, Tasks, Team, Strategy Builder as navigable commands. |

## PART 6: FILES UNCHANGED

All existing page components (MarketIntelligencePage, CompetitionPage, SupplyPipelinePage, etc.) stay exactly as they are. They just get rendered inside `DealScreenWrapper` tabs instead of being direct sidebar entries.

The `SidebarItem` component stays unchanged — it already supports the flat pattern.

The `TabGroup` component can stay in the codebase (other places may use it) but is no longer used in DealDetailPage.

---

## EXECUTION ORDER

1. Create `DealScreenWrapper.tsx`
2. Create `OpportunitiesPage.tsx`
3. Modify `MainLayout.tsx` (portfolio sidebar)
4. Modify `DealDetailPage.tsx` (deal sidebar)
5. Modify `App.tsx` (routes + redirects)
6. Modify `CommandPanel.tsx` (add Email/Tasks commands)
7. Test: F-keys work in both portfolio and deal contexts without conflict
8. Test: All existing pages still render correctly inside their new wrapper locations
