# Supply Section - Dual-Mode Pipeline Analysis

## Overview

The **Supply Section** provides comprehensive pipeline analysis with dual-mode support for both Acquisition and Performance contexts. It helps users understand future supply impact, track competitive properties, and make informed decisions about market saturation risk.

## Features

### 🎯 Dual-Mode Operation

**Acquisition Mode** (Pipeline Deals)
- Future supply impact analysis
- Delivery timeline tracking
- Absorption capacity assessment
- Market saturation risk indicators

**Performance Mode** (Owned Properties)
- New competition tracking
- Market saturation alerts
- Tenant retention risk analysis
- Competitive positioning insights

### 📊 Components

#### 1. Quick Stats Grid (5 Stats)
- **Total Pipeline Units** - Total units in development pipeline
- **Units Within 3 Miles** - Nearby competitive supply
- **Delivering in 12 Months** - Near-term delivery pressure
- **Direct Competitors** - Properties directly competing for same tenant profile
- **Average Distance** - Average distance to competing properties

#### 2. Supply Impact Calculator
Analyzes supply at multiple distance rings:
- **1 mile radius** - Immediate competitive pressure
- **3 mile radius** - Primary trade area impact
- **5 mile radius** - Secondary market influence

Each distance shows:
- Total units
- Impact level (Low/Medium/High) with color coding
- Market saturation risk assessment

#### 3. Filter Bar
- **Status Filter**: All, Planned, Under Construction, Pre-Leasing, Delivered
- **Distance Filter**: 1 mi, 3 mi, 5 mi, 10 mi
- **Competitive Only Toggle**: Show only direct competitors
- **Results Counter**: Shows filtered vs total projects

#### 4. Delivery Timeline Chart
- Quarterly breakdown of deliveries for next 12 months
- Visual timeline bars proportional to unit count
- Competitive units highlighted in red
- Project pills showing individual developments

#### 5. Pipeline Projects Grid
Responsive card grid showing:
- Project name and developer
- Unit count and distance
- Delivery quarter
- Rent range
- Status badge with color coding
- Impact level indicator
- Leasing progress (if applicable)
- Amenities preview
- Direct competitor flag

#### 6. Market Insights Card
AI-driven insights based on pipeline data:
- Supply concentration warnings/opportunities
- Near-term delivery pressure alerts
- Competition intensity analysis
- Strategic recommendations (mode-specific)

## Data Structure

### Pipeline Project Interface

```typescript
export interface PipelineProject {
  id: string;
  name: string;
  developer: string;
  units: number;
  status: 'planned' | 'under-construction' | 'pre-leasing' | 'delivered';
  deliveryDate: string; // ISO date
  deliveryQuarter: string; // e.g., "Q2 2024"
  distance: number; // miles from subject property
  address: string;
  rentRange: { min: number; max: number };
  amenities: string[];
  competitive: boolean; // true if directly competitive
  impactLevel: 'low' | 'medium' | 'high';
  percentLeased?: number; // for pre-leasing/delivered
  coordinates?: { lat: number; lng: number };
}
```

### Supply Stats Interface

```typescript
export interface SupplyStats {
  totalPipelineUnits: number;
  unitsWithin3Miles: number;
  unitsDelivering12Months: number;
  directCompetitors: number;
  averageDistanceToCompetition: number;
}
```

## Usage

### Basic Integration

```tsx
import { SupplySection } from './components/deal/sections';

<SupplySection deal={deal} />
```

The component automatically detects the mode based on `deal.status`:
- `status === 'owned'` → Performance Mode
- `status !== 'owned'` → Acquisition Mode

### Mock Data

Mock data is provided in `src/data/supplyMockData.ts`:
- `acquisitionPipelineProjects` - 10 sample projects for acquisition mode
- `acquisitionSupplyStats` - Aggregated stats for acquisition mode
- `performancePipelineProjects` - 8 sample projects for performance mode
- `performanceSupplyStats` - Aggregated stats for performance mode

### Utility Functions

```typescript
// Filter projects by status
getProjectsByStatus(projects, 'under-construction')

// Filter by distance
getProjectsByDistance(projects, 3) // Within 3 miles

// Filter by impact level
getProjectsByImpact(projects, 'high')

// Get projects delivering in timeframe
getProjectsDeliveringInMonths(projects, 12) // Next 12 months

// Calculate supply at multiple distances
calculateSupplyImpact(projects, [1, 3, 5]) // Returns { '1mi': 950, '3mi': 1850, '5mi': 3420 }

// Styling helpers
getStatusColor(status) // Returns Tailwind classes for status badges
getImpactColor(impact) // Returns Tailwind classes for impact indicators
getImpactBadge(impact) // Returns emoji + text for impact level
```

## Color Coding

### Status Colors
- **Planned**: Gray (`bg-gray-100 text-gray-700`)
- **Under Construction**: Yellow (`bg-yellow-100 text-yellow-700`)
- **Pre-Leasing**: Blue (`bg-blue-100 text-blue-700`)
- **Delivered**: Green (`bg-green-100 text-green-700`)

### Impact Level Colors
- **Low Impact**: Green (`bg-green-50 border-green-200 text-green-700`)
- **Medium Impact**: Yellow (`bg-yellow-50 border-yellow-200 text-yellow-700`)
- **High Impact**: Red (`bg-red-50 border-red-200 text-red-700`)

### Competitive Flags
- Direct competitors: Red border and background tint
- Non-competitive: Standard gray borders

## Smart Insights

The Market Insights card provides automatic analysis:

### Acquisition Mode Recommendations
- Monitor absorption rates of nearby deliveries
- Conduct competitive amenity analysis
- Model conservative lease-up scenarios
- Consider phased delivery approaches

### Performance Mode Recommendations
- Review tenant retention strategies
- Evaluate capital improvement opportunities
- Monitor competitor lease-up velocity
- Adjust marketing and pricing strategies

## Real Data Integration

To connect to real data:

1. **Replace mock data** in the component:
```tsx
// Instead of importing from supplyMockData.ts
import { getPipelineProjects, getSupplyStats } from '../../../services/supply.service';

// Fetch data in useEffect
useEffect(() => {
  const loadData = async () => {
    const data = await getPipelineProjects(deal.id);
    setProjects(data.projects);
    setStats(data.stats);
  };
  loadData();
}, [deal.id]);
```

2. **Create API service** (`src/services/supply.service.ts`):
```typescript
export const supplyService = {
  async getPipelineProjects(dealId: string) {
    const response = await apiClient.get(`/deals/${dealId}/pipeline-projects`);
    return response.data;
  },
  
  async getSupplyStats(dealId: string) {
    const response = await apiClient.get(`/deals/${dealId}/supply-stats`);
    return response.data;
  }
};
```

3. **Backend API endpoints** needed:
- `GET /api/deals/:dealId/pipeline-projects` - Returns pipeline projects array
- `GET /api/deals/:dealId/supply-stats` - Returns aggregated supply statistics

## Performance Considerations

- **Filtering**: All filters use `useMemo` to prevent unnecessary recalculations
- **Rendering**: Project cards are only rendered when visible (no virtualization needed for <100 items)
- **Data Loading**: Implement loading states and error handling in production

## Testing

Test cases to cover:
- [ ] Mode switching (acquisition vs performance)
- [ ] Status filtering (all options)
- [ ] Distance filtering (1/3/5/10 miles)
- [ ] Competitive-only toggle
- [ ] Empty states (no projects match filters)
- [ ] Timeline chart with various project distributions
- [ ] Impact level calculations
- [ ] Market insights generation

## Future Enhancements

Potential additions:
- **Map Integration**: Plot projects on interactive map
- **Historical Tracking**: Track pipeline changes over time
- **Alerts**: Notify when new competitive projects are announced
- **Export**: Download pipeline reports as PDF/Excel
- **Comp Analysis**: Deep-dive comparison with specific competitors
- **Absorption Modeling**: Forecast market absorption capacity
- **Rent Comps**: Detailed rent comparison matrix

## Dependencies

- React 18+
- TypeScript 4+
- Tailwind CSS 3+
- `useDealMode` hook (included in project)

## File Structure

```
src/
├── components/deal/sections/
│   ├── SupplySection.tsx           # Main component (24KB)
│   ├── SUPPLY_SECTION_README.md    # This file
│   └── index.ts                    # Barrel export (includes SupplySection)
├── data/
│   └── supplyMockData.ts           # Mock data and utilities (13KB)
└── hooks/
    └── useDealMode.ts              # Mode detection hook
```

## Support

For questions or issues:
1. Check this README first
2. Review mock data structure in `supplyMockData.ts`
3. Inspect component code in `SupplySection.tsx`
4. Check similar patterns in `OverviewSection.tsx` (dual-mode reference)

---

**Status**: ✅ Complete and Ready for Integration  
**Version**: 1.0  
**Last Updated**: February 12, 2024  
**Author**: JEDI RE Development Team
