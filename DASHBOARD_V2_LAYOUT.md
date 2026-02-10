# Dashboard V2 Layout - Improved Design

## Overview
New dashboard layout with better space utilization and intelligence hierarchy.

## Layout Structure

```
┌───────────────────────────────────────────────────────────────┐
│  [KPI Card 1]  [KPI Card 2]  [KPI Card 3]  [KPI Card 4]      │
│  Pipeline $    Active Deals  Assets       Avg Days           │
├──────────────────────────────┬────────────────────────────────┤
│ KEY INTELLIGENCE (40%)       │  MY DEALS (60%)                │
│                              │                                │
│ [4 Tabs]                     │  [Hot Deals Alert]             │
│ 📰 News   | 📊 Market       │  [Deal Card 1]                 │
│ 🤖 AI Insights | ⚠️ Actions  │  [Deal Card 2]                 │
│                              │  [Deal Card 3]                 │
│ [Findings List - Priority]   │  ...                           │
│                              │  [View All →]                  │
├──────────────────────────────┴────────────────────────────────┤
│ PORTFOLIO ASSETS (60%)       │  QUICK ACTIONS (40%)           │
│                              │                                │
│ [Asset Card 1] [Asset Card 2]│  + Create New Deal             │
│ [Asset Card 3] [Asset Card 4]│  🔍 Search Properties           │
│                              │  📊 Market Analysis             │
│ [View All →]                 │  📰 News Intelligence           │
│                              │  ───────────────               │
│                              │  Need help?                    │
│                              │  View User Guide               │
└──────────────────────────────┴────────────────────────────────┘
```

## Changes from V1

### Added
1. **KPI Cards** - 4 metric cards at top (Total Pipeline, Active Deals, Assets, Avg Days)
2. **Two-Column Layout** - Better space utilization (40/60 split)
3. **New Intelligence Categories**:
   - 📰 News Intelligence (external events)
   - 📊 Market Signals (submarket trends)
   - 🤖 AI Insights (JEDI analysis recommendations)
   - ⚠️ Action Items (things needing attention)
4. **Quick Actions Panel** - One-click access to key features
5. **Compact Deal Cards** - Show max 6, with "View All" link

### Removed
1. Vertical stacking (all replaced with grid layout)
2. Redundant "Quick Stats" section (moved to top KPIs)
3. Old category names (properties → market)

## Key Features

### KPI Cards
- **Total Pipeline** - Sum of all deal values + count
- **Active Deals** - Deals not in POST_CLOSE/ARCHIVED/MARKET_NOTE
- **Portfolio Assets** - Deals with dealCategory='portfolio' and state='POST_CLOSE'
- **Avg Days/Deal** - Average time in current station

### Intelligence Feed
- **Priority Auto-Selection** - Actions > Insights > News > Market
- **Color Coding** - Red (urgent), Orange (important), Blue (info)
- **Smart Filtering** - Only relevant findings shown
- **Click-through** - Navigate to detail pages

### Deal Section
- **Hot Deals Alert** - Highlight stalled (>14 days) or Hot-tagged deals
- **Compact Cards** - Show 6 most recent, link to view all
- **State Indicators** - Visual badges for each stage
- **Status Colors** - Hot🔥/Warm☀️/Watch👀/Pass❌

### Quick Actions
- Primary actions (Create Deal, Search, Analyze)
- Help/support access
- Clean button hierarchy

## Responsive Behavior

- **Desktop (>1024px)** - Full 5-column grid layout
- **Tablet (768-1024px)** - Stack to 2 columns
- **Mobile (<768px)** - Single column, collapsible sections

## Performance

- Lazy load assets (only top 4 shown by default)
- Limit deals to 6 on dashboard
- Findings capped at 5 per category
- Map markers loaded on demand

## Backend Changes

### New Endpoints
- `GET /api/v1/dashboard/findings` - Updated to support new categories
- `GET /api/v1/dashboard/kpis` - (Optional) Dedicated KPI endpoint

### Updated Types
```typescript
type FindingCategory = 'news' | 'market' | 'insights' | 'actions';

interface Finding {
  id: string;
  type: FindingCategory;
  priority: 'urgent' | 'important' | 'info';
  title: string;
  description: string;
  timestamp: string;
  link: string;
  metadata?: any;
}
```

## Migration Path

1. Update backend `/findings` endpoint ✅
2. Update KeyFindingsSection component ✅
3. Update Dashboard layout (IN PROGRESS)
4. Test on Replit
5. Push to production

## Files Changed

1. `backend/src/api/rest/dashboard.routes.ts` - Updated categories, added AI Insights
2. `frontend/src/components/dashboard/KeyFindingsSection.tsx` - New tabs
3. `frontend/src/pages/Dashboard.tsx` - New grid layout
4. `DASHBOARD_V2_LAYOUT.md` - This documentation

## Testing Checklist

- [ ] KPI cards display correct values
- [ ] Intelligence tabs switch properly
- [ ] AI Insights query analysis_results correctly
- [ ] Deal cards show state badges
- [ ] Hot deals alert appears when needed
- [ ] Quick Actions buttons navigate correctly
- [ ] Portfolio assets load and display
- [ ] Mobile responsive behavior works
- [ ] Loading states show properly
- [ ] Error states handled gracefully

## Next Steps

1. Finish Dashboard.tsx rewrite
2. Test locally
3. Commit and push to GitHub
4. Deploy to Replit
5. Get Leon's feedback
6. Iterate based on usage
