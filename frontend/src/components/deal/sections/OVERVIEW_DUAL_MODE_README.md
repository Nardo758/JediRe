# Dual-Mode Overview Section

## Overview
Complete implementation of the dual-mode Overview section that automatically switches between **Acquisition Mode** and **Performance Mode** based on deal status.

## Mode Detection

The overview automatically detects the deal mode using the `useDealMode` hook:

```typescript
// Deal with status 'pipeline' → Acquisition Mode
// Deal with status 'owned' → Performance Mode

const { mode, isPipeline, isOwned } = useDealMode(deal);
```

## Features by Mode

### Acquisition Mode (Pipeline Deals)
**When**: `deal.status === 'pipeline'`

**Quick Stats:**
- Target Price
- Expected IRR
- Pro Forma Cap Rate
- Financing Terms
- Deal Stage

**Quick Actions:**
- Run Analysis
- Generate Report
- Request Financing

**Deal Progress:**
- Due Diligence (%)
- Legal Review (%)
- Financing (%)

**Activity Feed:**
- Deal updates
- Document uploads
- Meeting notes
- Site inspections

**Team:**
- Lead Analyst
- Financial Analyst
- Broker
- Legal Counsel

### Performance Mode (Owned Assets)
**When**: `deal.status === 'owned'`

**Quick Stats:**
- Current Occupancy (with trend)
- Actual NOI
- Actual Cap Rate
- Cash Flow (vs Budget)
- Days Owned

**Quick Actions:**
- View Performance Report
- Check Refi Options
- Run Market Analysis

**Performance vs Budget:**
- Occupancy: actual vs target with color coding
  - ✅ Green: Meeting/exceeding target (≥98%)
  - ⚠️ Yellow: Slightly below (90-98%)
  - ❌ Red: Below target (<90%)
- NOI: actual vs budget
- Avg Rent: actual vs target

**Activity Feed:**
- Operational events
- Rent adjustments
- Maintenance updates
- Financial reports

**Team:**
- Property Manager
- Asset Manager
- Leasing Director
- Facilities Manager

## Component Structure

```
OverviewSection (Main)
├── QuickStatsGrid
├── InteractiveMap
├── QuickActionsCard
├── DealProgressCard (Acquisition)
│   └── Progress bars for DD, Legal, Financing
└── PerformanceMetricsCard (Performance)
    └── Actual vs Target with color coding
```

## Usage

### Basic Usage
```tsx
import { OverviewSection } from './components/deal/sections/OverviewSection';

<OverviewSection deal={deal} />
```

The component automatically:
1. Detects mode based on `deal.status`
2. Loads appropriate data
3. Renders mode-specific UI
4. Applies correct styling and icons

### Example with Pipeline Deal
```tsx
const pipelineDeal = {
  id: 'deal-001',
  name: 'Buckhead Tower Development',
  status: 'pipeline',  // ← Triggers Acquisition Mode
  budget: 45000000,
  stage: 'Due Diligence'
};

<OverviewSection deal={pipelineDeal} />
```

### Example with Owned Asset
```tsx
const ownedDeal = {
  id: 'deal-002',
  name: 'Midtown Plaza',
  status: 'owned',  // ← Triggers Performance Mode
  actualCloseDate: '2022-08-15',
  propertyCount: 180
};

<OverviewSection deal={ownedDeal} />
```

## Mock Data

Mock data is centralized in `src/data/overviewMockData.ts`:

- `acquisitionStats` - Pipeline deal quick stats
- `acquisitionActions` - Pipeline quick actions
- `acquisitionProgress` - Deal progress metrics
- `acquisitionActivities` - Pipeline activity feed
- `acquisitionTeam` - Acquisition team members
- `performanceStats` - Owned asset quick stats
- `performanceActions` - Performance quick actions
- `performanceMetrics` - Performance vs budget data
- `performanceActivities` - Operational activity feed
- `performanceTeam` - Property team members

## Color Coding

### Performance Metrics
The performance mode uses color coding to show status:

```typescript
// Green (✅): Meeting/exceeding target
actual >= target * 0.98

// Yellow (⚠️): Slightly below target
target * 0.90 <= actual < target * 0.98

// Red (❌): Significantly below target
actual < target * 0.90
```

### Quick Stats Trends
Stats can show trend indicators:

```typescript
{
  trend: {
    direction: 'up' | 'down' | 'neutral',
    value: '+2.3%'
  }
}
```

## Styling

The component uses TailwindCSS with the existing JEDI RE design system:

- **Cards**: White background, gray borders, rounded corners
- **Hover**: Subtle shadow lift on stat cards
- **Colors**: 
  - Acquisition mode: Blue accents
  - Performance mode: Green accents
- **Icons**: Emoji-based for visual consistency
- **Responsive**: Mobile-first grid layouts

## Integration Points

### With Real Data
Replace mock data with API calls:

```typescript
const { data: stats } = useQuery(['deal-stats', deal.id], () => 
  fetchDealStats(deal.id, mode)
);
```

### With Mapping System
The InteractiveMap component is ready for integration:

```tsx
<InteractiveMap deal={deal} mode={mode} />
// Integrate with existing MapView or Google Maps
```

### With Actions
Quick action buttons accept callbacks:

```typescript
const actions = [
  {
    id: 'run-analysis',
    label: 'Run Analysis',
    icon: '📊',
    color: 'blue',
    action: () => runAnalysis(deal.id)  // ← Custom handler
  }
];
```

## File Structure

```
frontend/src/
├── hooks/
│   └── useDealMode.ts                    # Mode detection hook
├── data/
│   └── overviewMockData.ts               # Mock data for both modes
├── components/deal/sections/
│   ├── OverviewSection.tsx               # Main dual-mode component
│   └── OVERVIEW_DUAL_MODE_README.md      # This file
```

## Testing Modes

### Switch to Performance Mode
```typescript
deal.status = 'owned';
```

### Switch to Acquisition Mode
```typescript
deal.status = 'pipeline';
// or any status other than 'owned'
```

## Future Enhancements

1. **Real-time data**: Connect to backend APIs
2. **Interactive map**: Integrate with Google Maps/Mapbox
3. **Customizable metrics**: Allow users to configure displayed stats
4. **Export reports**: Generate PDF/Excel reports from overview data
5. **Comparison mode**: Side-by-side comparison of multiple deals
6. **Historical trends**: Charts showing performance over time
7. **Alerts**: Notifications when metrics fall below targets

## Success Criteria

✅ Acquisition mode fully functional  
✅ Performance mode fully functional  
✅ Smooth mode detection and switching  
✅ Beautiful, responsive design  
✅ Mock data for both modes  
✅ Ready to feed data to Opus  
✅ Color-coded performance indicators  
✅ Trend indicators for key metrics  
✅ Reusable sub-components  
✅ TypeScript type safety  

## Questions?

See the main component file (`OverviewSection.tsx`) for implementation details or the mock data file (`overviewMockData.ts`) for data structure examples.
