# Strategy Tab - Usage & Extension Guide

## 🚀 Quick Start

### Basic Usage

```tsx
import { StrategySection } from './components/deal/sections/StrategySection';
import { Deal } from './types/deal';

// In your component
<StrategySection deal={deal} />
```

The component automatically detects the mode based on `deal.status`:
- `status === 'owned'` → Performance Mode
- `status !== 'owned'` → Acquisition Mode

---

## 🔌 Integration Points

### 1. Deal Page Integration (Already Complete)

```tsx
// DealPage.tsx
import { StrategySection } from '../components/deal/sections/StrategySection';

// In render
<SectionCard id="strategy" icon="🎯" title="Strategy" dealId={dealId}>
  <StrategySection deal={deal} />
</SectionCard>
```

### 2. Enhanced Deal View Integration

```tsx
// EnhancedDealView.tsx
import { StrategySection } from './sections/StrategySection';

// Add to tabs or sections
{activeTab === 'strategy' && (
  <StrategySection deal={deal} />
)}
```

### 3. Standalone Usage

```tsx
// Anywhere in your app
import { StrategySection } from '@/components/deal/sections/StrategySection';

function MyStrategyPage() {
  const deal = useDeal(); // Your hook
  return <StrategySection deal={deal} />;
}
```

---

## 🎨 Customization

### Changing Mock Data

**File:** `src/data/strategyMockData.ts`

```typescript
// Add a new strategy card
export const strategyCards: StrategyCard[] = [
  // ... existing strategies
  {
    id: 'custom-strategy',
    name: 'Custom Strategy',
    type: 'value-add',
    icon: '🎨',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-300',
    targetIRR: 20.0,
    holdPeriod: '4-6 years',
    riskLevel: 'medium',
    keyFeatures: [
      'Your custom feature 1',
      'Your custom feature 2',
      'Your custom feature 3',
      'Your custom feature 4'
    ],
    capexRequired: 5000000,
    timeToStabilize: '12-18 months',
    exitStrategy: ['Custom exit 1', 'Custom exit 2'],
    description: 'Your custom strategy description'
  }
];
```

### Adding New Quick Stats

```typescript
export const acquisitionStats: QuickStat[] = [
  // ... existing stats
  {
    label: 'New Metric',
    value: 123,
    icon: '🎯',
    format: 'number',
    subtext: 'Optional subtext',
    trend: {
      direction: 'up',
      value: '+5%'
    }
  }
];
```

### Customizing Colors

```tsx
// In StrategyCardComponent
const getCustomColor = (type: string) => {
  switch (type) {
    case 'custom': return {
      color: 'text-indigo-700',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-300'
    };
    // ... other cases
  }
};
```

---

## 🔧 API Integration

### Replace Mock Data with Real API

**Step 1:** Create API service

```typescript
// services/strategy.service.ts
export const strategyService = {
  async getStrategyData(dealId: string) {
    const response = await apiClient.get(`/api/v1/deals/${dealId}/strategy`);
    return response.data;
  },

  async updateStrategy(dealId: string, strategyData: any) {
    const response = await apiClient.put(
      `/api/v1/deals/${dealId}/strategy`,
      strategyData
    );
    return response.data;
  }
};
```

**Step 2:** Update StrategySection component

```tsx
import { useState, useEffect } from 'react';
import { strategyService } from '../../../services/strategy.service';

export const StrategySection: React.FC<StrategySectionProps> = ({ deal }) => {
  const [strategyData, setStrategyData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStrategyData();
  }, [deal.id]);

  const loadStrategyData = async () => {
    try {
      const data = await strategyService.getStrategyData(deal.id);
      setStrategyData(data);
    } catch (error) {
      console.error('Failed to load strategy data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading strategy...</div>;
  }

  // Use strategyData instead of mock data
  const stats = isPipeline ? strategyData.acquisitionStats : strategyData.performanceStats;
  // ... rest of component
};
```

---

## 🎯 Backend API Structure

### Recommended API Endpoints

```
GET    /api/v1/deals/:dealId/strategy
POST   /api/v1/deals/:dealId/strategy
PUT    /api/v1/deals/:dealId/strategy/:strategyId
DELETE /api/v1/deals/:dealId/strategy/:strategyId
GET    /api/v1/deals/:dealId/strategy/progress
POST   /api/v1/deals/:dealId/strategy/tasks
PUT    /api/v1/deals/:dealId/strategy/tasks/:taskId
GET    /api/v1/deals/:dealId/strategy/risks
POST   /api/v1/deals/:dealId/strategy/optimizations
GET    /api/v1/deals/:dealId/strategy/exit-scenarios
```

### Sample API Response

```json
{
  "dealId": "deal-001",
  "mode": "acquisition",
  "stats": [
    {
      "label": "Primary Strategy",
      "value": "Value-Add",
      "icon": "🎯",
      "format": "text",
      "subtext": "Moderate Risk"
    }
  ],
  "selectedStrategy": {
    "id": "value-add",
    "name": "Value-Add Strategy",
    "targetIRR": 18.5,
    "holdPeriod": "5-7 years",
    "capexRequired": 4500000
  },
  "tasks": [
    {
      "id": "task-1",
      "task": "Complete property assessment",
      "status": "completed",
      "assignee": "John Doe",
      "dueDate": "2024-01-15",
      "priority": "high"
    }
  ],
  "risks": [
    {
      "category": "Market Risk",
      "level": "medium",
      "description": "Market showing softness",
      "mitigation": "Focus on strong submarkets"
    }
  ]
}
```

---

## 🧩 Component Architecture

### Component Tree

```
StrategySection
├── QuickStatsGrid
│   └── StatCard (×5)
│
├── [Acquisition Mode]
│   ├── StrategyCardComponent (×4)
│   ├── ROIComparisonChart
│   └── TimelineVisualization
│
├── [Performance Mode]
│   ├── StrategyProgressSection
│   ├── OptimizationsSection
│   └── ExitScenariosSection
│
├── ImplementationChecklist
│   └── TaskItem (×6+)
│
└── RiskAssessmentSection
    └── RiskCard (×4-5)
```

### Data Flow

```
Deal (props)
    ↓
useDealMode hook
    ↓
mode detection (acquisition/performance)
    ↓
Mock Data (strategyMockData.ts)
    ↓
Component Rendering
```

---

## 🎨 Styling Customization

### Using Tailwind Config

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        strategy: {
          core: '#3B82F6',      // blue-500
          valueAdd: '#10B981',  // green-500
          opport: '#F59E0B',    // orange-500
          develop: '#8B5CF6'    // purple-500
        }
      }
    }
  }
};
```

### Custom CSS Classes

```css
/* styles/strategy.css */
.strategy-card {
  @apply rounded-lg border-2 p-5 transition-all duration-200;
}

.strategy-card:hover {
  @apply shadow-lg transform -translate-y-1;
}

.strategy-card-selected {
  @apply border-blue-500 shadow-md;
}
```

---

## 📊 Adding Analytics

### Track Strategy Selection

```tsx
const handleStrategySelect = (strategyId: string) => {
  setSelectedStrategy(strategyId);
  
  // Analytics tracking
  analytics.track('Strategy Selected', {
    dealId: deal.id,
    strategyType: strategyId,
    timestamp: new Date().toISOString()
  });
};
```

### Track Task Completion

```tsx
const handleTaskComplete = (taskId: string) => {
  // Update task status
  updateTaskStatus(taskId, 'completed');
  
  // Analytics
  analytics.track('Strategy Task Completed', {
    dealId: deal.id,
    taskId,
    completionTime: Date.now()
  });
};
```

---

## 🔔 Adding Notifications

### Task Due Date Reminders

```tsx
useEffect(() => {
  const upcomingTasks = tasks.filter(task => {
    const dueDate = new Date(task.dueDate);
    const daysUntilDue = (dueDate - Date.now()) / (1000 * 60 * 60 * 24);
    return daysUntilDue <= 3 && task.status !== 'completed';
  });

  if (upcomingTasks.length > 0) {
    showNotification({
      type: 'warning',
      message: `${upcomingTasks.length} strategy tasks due soon`
    });
  }
}, [tasks]);
```

### Strategy Milestone Alerts

```tsx
const checkMilestones = (progress: StrategyProgress[]) => {
  progress.forEach(phase => {
    if (phase.percentage >= 100 && phase.status === 'active') {
      showNotification({
        type: 'success',
        message: `${phase.phase} completed! 🎉`
      });
    }
  });
};
```

---

## 🧪 Testing

### Unit Test Example

```typescript
// StrategySection.test.tsx
import { render, screen } from '@testing-library/react';
import { StrategySection } from './StrategySection';

describe('StrategySection', () => {
  const mockDeal = {
    id: 'test-deal-1',
    name: 'Test Property',
    status: 'pipeline'
  };

  it('renders acquisition mode for pipeline deals', () => {
    render(<StrategySection deal={mockDeal} />);
    expect(screen.getByText('🎯 Strategy Planning')).toBeInTheDocument();
  });

  it('displays 5 quick stats', () => {
    render(<StrategySection deal={mockDeal} />);
    const stats = screen.getAllByRole('region');
    expect(stats.length).toBeGreaterThanOrEqual(5);
  });

  it('shows 4 strategy cards in acquisition mode', () => {
    render(<StrategySection deal={mockDeal} />);
    expect(screen.getByText('Core Strategy')).toBeInTheDocument();
    expect(screen.getByText('Value-Add Strategy')).toBeInTheDocument();
    expect(screen.getByText('Opportunistic Strategy')).toBeInTheDocument();
    expect(screen.getByText('Ground-Up Development')).toBeInTheDocument();
  });
});
```

### Integration Test

```typescript
// StrategySection.integration.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrategySection } from './StrategySection';

it('switches to performance mode for owned deals', async () => {
  const ownedDeal = { ...mockDeal, status: 'owned' };
  render(<StrategySection deal={ownedDeal} />);
  
  await waitFor(() => {
    expect(screen.getByText('📊 Strategy Execution')).toBeInTheDocument();
  });
});

it('allows strategy card selection', async () => {
  render(<StrategySection deal={mockDeal} />);
  
  const valueAddCard = screen.getByText('Value-Add Strategy');
  await userEvent.click(valueAddCard);
  
  expect(valueAddCard.closest('div')).toHaveClass('border-green-300');
});
```

---

## 📦 Exporting Strategy Data

### Add Export Functionality

```tsx
const exportStrategyToPDF = async () => {
  const data = {
    dealName: deal.name,
    strategy: selectedStrategy,
    stats,
    tasks,
    risks,
    timeline
  };

  const response = await fetch('/api/v1/export/strategy-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `strategy-${deal.id}.pdf`;
  a.click();
};

// Add export button
<button onClick={exportStrategyToPDF}>
  📄 Export Strategy
</button>
```

---

## 🌐 Internationalization (i18n)

### Add Multi-language Support

```tsx
import { useTranslation } from 'react-i18next';

export const StrategySection: React.FC<StrategySectionProps> = ({ deal }) => {
  const { t } = useTranslation('strategy');

  return (
    <div>
      <h3>{t('strategy.planning')}</h3>
      <p>{t('strategy.description')}</p>
      {/* ... */}
    </div>
  );
};
```

```json
// locales/en/strategy.json
{
  "strategy": {
    "planning": "Strategy Planning",
    "execution": "Strategy Execution",
    "description": "Investment strategy planning and tracking"
  }
}
```

---

## 🚀 Performance Optimization

### Lazy Loading

```tsx
import { lazy, Suspense } from 'react';

const StrategySection = lazy(() => 
  import('./components/deal/sections/StrategySection')
);

// In parent component
<Suspense fallback={<LoadingSpinner />}>
  <StrategySection deal={deal} />
</Suspense>
```

### Memoization

```tsx
import { memo, useMemo } from 'react';

export const StrategySection: React.FC<StrategySectionProps> = memo(({ deal }) => {
  const stats = useMemo(() => 
    isPipeline ? acquisitionStats : performanceStats,
    [isPipeline]
  );

  const processedTasks = useMemo(() => 
    tasks.filter(t => t.status !== 'archived'),
    [tasks]
  );

  // ... rest of component
});
```

---

## 🎯 Best Practices

### 1. Keep Data Separate
- Mock data in `strategyMockData.ts`
- Business logic in services
- UI components in `StrategySection.tsx`

### 2. Type Safety
- Use TypeScript interfaces
- Validate props
- Handle edge cases

### 3. Accessibility
- Add ARIA labels
- Keyboard navigation
- Screen reader support

### 4. Error Handling
- Graceful degradation
- Loading states
- Error boundaries

### 5. Performance
- Lazy load heavy components
- Memoize expensive calculations
- Optimize re-renders

---

## 📚 Further Resources

- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [TypeScript](https://www.typescriptlang.org)
- [Testing Library](https://testing-library.com)

---

**Last Updated:** February 12, 2024  
**Version:** 1.0.0  
**Maintainer:** JEDI RE Team
