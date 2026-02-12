# Exit Tab - Quick Start Guide

## 🚀 Using the Exit Tab

### Basic Usage

The Exit tab automatically adapts to the deal's status:

```typescript
// In your deal page:
import { ExitSection } from './components/deal/sections/ExitSection';

<ExitSection deal={deal} />
```

### Dual-Mode Behavior

The tab automatically switches modes based on `deal.status`:

- **`status !== 'owned'`** → **Acquisition Mode** 
  - Shows: Exit planning, 4 exit scenarios, long-term timeline
  - Focus: Strategy selection and planning

- **`status === 'owned'`** → **Performance Mode**
  - Shows: Exit readiness, 3 exit scenarios, near-term timeline, broker recommendations
  - Focus: Execution and market timing

---

## 📂 File Structure

```
/frontend/src/
├── components/deal/sections/
│   ├── ExitSection.tsx          # Main component
│   └── index.ts                 # Export file (updated)
│
├── data/
│   └── exitMockData.ts          # Mock data for both modes
│
├── hooks/
│   └── useDealMode.ts           # Mode detection hook
│
├── pages/
│   ├── DealPage.tsx             # Standard view (updated)
│   └── DealPageEnhanced.tsx     # Enhanced view (updated)
│
└── types/
    └── deal-enhanced.types.ts   # Navigation config (updated)
```

---

## 🎨 Component Hierarchy

```
ExitSection
│
├── QuickStatsGrid
│   └── 5 stat cards with trends
│
├── Exit Scenarios
│   └── ExitScenarioCard (4 in acq, 3 in perf)
│       ├── Scenario details
│       ├── Financial metrics
│       └── Key features list
│
├── ExitTimelineVisualization
│   └── Timeline events (6 in acq, 7 in perf)
│
├── ValueProjectionChart
│   ├── Bar chart visualization
│   └── Data table (8 years)
│
├── [Performance Mode Only]
│   ├── MarketReadinessSection
│   │   └── 5 readiness indicators
│   │
│   └── BrokerRecommendationsSection
│       └── 4 broker profiles
│
└── ExitReadinessChecklist
    └── Checklist items (7 in acq, 10 in perf)
```

---

## 🔧 Customizing Mock Data

### Adding a New Exit Scenario

**In `exitMockData.ts`:**

```typescript
export const acquisitionExitScenarios: ExitScenario[] = [
  // ... existing scenarios
  {
    id: 'custom-scenario',
    name: 'Custom Exit Strategy',
    type: 'sale', // or 'refinance' | 'hold'
    icon: '🎯',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-400',
    timing: 'Year 4 (Q3 2028)',
    exitCap: 5.9,
    projectedNOI: 3250000,
    salePrice: 55000000,
    equityMultiple: 2.0,
    irr: 17.5,
    probability: 'medium',
    keyFeatures: [
      'Feature 1',
      'Feature 2',
      'Feature 3'
    ],
    description: 'Your custom exit strategy description'
  }
];
```

### Modifying Timeline Events

```typescript
export const performanceExitTimeline: ExitTimelineEvent[] = [
  {
    id: 'my-event',
    name: 'Custom Milestone',
    date: '2024-06-30',
    monthsFromNow: 5,
    status: 'upcoming', // 'completed' | 'upcoming' | 'future'
    category: 'preparation', // 'preparation' | 'marketing' | 'transaction' | 'closing'
    description: 'Description of this milestone'
  }
];
```

### Adding Broker Recommendations

```typescript
export const performanceBrokerRecommendations: BrokerRecommendation[] = [
  {
    id: 'broker-5',
    brokerName: 'New Broker Name',
    firm: 'Firm Name',
    specialty: 'Multifamily Value-Add',
    recentSales: 10,
    avgDaysOnMarket: 60,
    avgPricePremium: 3.5,
    rating: 4.7,
    pros: [
      'Strength 1',
      'Strength 2'
    ],
    cons: [
      'Consideration 1'
    ]
  }
];
```

---

## 🔌 Connecting to Real APIs

### Example: Fetching Exit Scenarios from API

**Replace mock data with API call:**

```typescript
// In ExitSection.tsx
const [scenarios, setScenarios] = useState<ExitScenario[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const fetchExitScenarios = async () => {
    try {
      const response = await apiClient.get(`/api/v1/deals/${deal.id}/exit-scenarios`);
      setScenarios(response.data);
    } catch (error) {
      console.error('Failed to load exit scenarios:', error);
      // Fallback to mock data
      setScenarios(isPipeline ? acquisitionExitScenarios : performanceExitScenarios);
    } finally {
      setLoading(false);
    }
  };

  fetchExitScenarios();
}, [deal.id, isPipeline]);
```

### Example: Real-time Value Projections

```typescript
const fetchValueProjections = async () => {
  const response = await apiClient.get(`/api/v1/deals/${deal.id}/value-projections`, {
    params: {
      exitStrategy: selectedScenario,
      projectionYears: 8
    }
  });
  return response.data;
};
```

---

## 🎨 Styling & Theming

### Color Scheme

The Exit tab uses consistent color coding:

- **Blue** → Acquisition/Planning
- **Green** → Performance/Owned
- **Purple** → Premium features
- **Status Colors:**
  - Green: Ready/Completed ✅
  - Yellow: Needs Attention ⚠️
  - Red: Not Ready 🔴
  - Gray: Pending/Future ⏳

### Modifying Colors

```typescript
// Example: Change scenario card colors
<div className={`
  ${scenario.bgColor}     // Background color
  ${scenario.borderColor} // Border when selected
  ${scenario.color}       // Text color for title
`}>
```

### Custom Badge Colors

```typescript
const getProbabilityBadge = (level: string) => {
  switch (level) {
    case 'high': return 'bg-green-100 text-green-700';
    case 'medium': return 'bg-yellow-100 text-yellow-700';
    case 'low': return 'bg-gray-100 text-gray-700';
    // Add custom level:
    case 'very-high': return 'bg-emerald-100 text-emerald-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};
```

---

## 📊 Analytics & Tracking

### Example: Track Scenario Selection

```typescript
const handleScenarioSelect = (scenarioId: string) => {
  setSelectedScenario(scenarioId);
  
  // Track analytics
  analytics.track('exit_scenario_selected', {
    dealId: deal.id,
    scenarioId,
    mode: isPipeline ? 'acquisition' : 'performance'
  });
};
```

### Example: Track Broker Click

```typescript
const handleBrokerClick = (brokerId: string) => {
  analytics.track('broker_viewed', {
    dealId: deal.id,
    brokerId,
    source: 'exit_tab'
  });
};
```

---

## 🧪 Testing

### Unit Test Example

```typescript
import { render, screen } from '@testing-library/react';
import { ExitSection } from './ExitSection';

describe('ExitSection', () => {
  const mockDeal = {
    id: '123',
    name: 'Test Deal',
    status: 'pipeline'
  };

  it('renders acquisition mode for pipeline deals', () => {
    render(<ExitSection deal={mockDeal} />);
    expect(screen.getByText('🎯 Exit Planning')).toBeInTheDocument();
    expect(screen.getByText('Base Case Sale')).toBeInTheDocument();
  });

  it('renders performance mode for owned deals', () => {
    const ownedDeal = { ...mockDeal, status: 'owned' };
    render(<ExitSection deal={ownedDeal} />);
    expect(screen.getByText('📊 Exit Execution')).toBeInTheDocument();
    expect(screen.getByText('Exit Readiness Score')).toBeInTheDocument();
  });
});
```

---

## 🔍 Debugging

### Check Mode Detection

```typescript
// Add to component for debugging
console.log('Deal Mode:', { 
  mode, 
  isPipeline, 
  isOwned,
  dealStatus: deal.status 
});
```

### Verify Data Loading

```typescript
console.log('Exit Data:', {
  stats: stats.length,
  scenarios: scenarios.length,
  timeline: timeline.length,
  readiness: readinessIndicators.length
});
```

---

## 📱 Mobile Responsiveness

The Exit tab is fully responsive:

- **Desktop (lg):** 
  - 5-column quick stats grid
  - 2-column scenario cards
  - Full-width charts and tables

- **Tablet (md):**
  - 3-column quick stats
  - 2-column scenarios
  - Horizontal scroll for tables

- **Mobile (sm):**
  - 2-column quick stats
  - 1-column scenarios (stacked)
  - Compact tables with horizontal scroll

### Test Responsiveness

```bash
# Chrome DevTools
1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Test at: 375px, 768px, 1024px, 1440px
```

---

## 🚦 Common Issues & Solutions

### Issue: Mode not switching correctly

**Solution:** Check `deal.status` value
```typescript
// Valid statuses that trigger performance mode:
deal.status === 'owned'

// Everything else triggers acquisition mode
```

### Issue: Data not displaying

**Solution:** Verify mock data imports
```typescript
import {
  acquisitionExitStats,
  performanceExitStats,
  // ... ensure all imports present
} from '../../../data/exitMockData';
```

### Issue: Styling inconsistencies

**Solution:** Check Tailwind classes are properly configured
```bash
# Verify Tailwind is processing the component
npm run build
```

---

## 📚 Related Documentation

- **Architecture:** `EXIT_TAB_DELIVERY_SUMMARY.md`
- **Design System:** `/docs/UI_COMPONENTS.md`
- **API Integration:** `/docs/API_INTEGRATION_GUIDE.md`
- **Deal Types:** `/frontend/src/types/deal.ts`

---

## 🤝 Contributing

When modifying the Exit tab:

1. **Maintain dual-mode consistency** - Changes should work in both modes
2. **Update mock data** - Keep mock data realistic and comprehensive
3. **Follow existing patterns** - Match the style of other sections
4. **Test both modes** - Verify acquisition AND performance views
5. **Update documentation** - Keep this guide current

---

## 💡 Tips & Best Practices

1. **Use the mode variables:**
   ```typescript
   const { mode, isPipeline, isOwned } = useDealMode(deal);
   ```

2. **Conditional rendering:**
   ```typescript
   {isOwned && <PerformanceOnlyComponent />}
   {isPipeline && <AcquisitionOnlyComponent />}
   ```

3. **Data selection pattern:**
   ```typescript
   const data = isPipeline ? acquisitionData : performanceData;
   ```

4. **Format currency consistently:**
   ```typescript
   new Intl.NumberFormat('en-US', {
     style: 'currency',
     currency: 'USD',
     minimumFractionDigits: 0
   }).format(value);
   ```

5. **Keep components focused:**
   - Break large components into sub-components
   - One responsibility per component
   - Reusable where possible

---

## 🎓 Learning Resources

- **React Hooks:** https://react.dev/reference/react
- **TypeScript:** https://www.typescriptlang.org/docs/
- **Tailwind CSS:** https://tailwindcss.com/docs
- **Component Patterns:** See existing sections like `StrategySection.tsx`

---

**Need Help?** Check the main delivery summary or examine the Strategy tab (`StrategySection.tsx`) which follows the same dual-mode pattern.
