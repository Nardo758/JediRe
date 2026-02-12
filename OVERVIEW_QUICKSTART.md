# Dual-Mode Overview - Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Import the Component

```tsx
import { OverviewSection } from './components/deal/sections/OverviewSection';
```

### Step 2: Pass Your Deal Data

```tsx
<OverviewSection deal={deal} />
```

### Step 3: That's It! 🎉

The component automatically:
- ✅ Detects the mode (`pipeline` or `owned`)
- ✅ Loads the correct data
- ✅ Renders the appropriate UI
- ✅ Applies mode-specific styling

---

## 🎯 Mode Switching

### For Acquisition Mode (Pipeline Deals)
```tsx
const deal = {
  id: 'deal-001',
  name: 'New Development Project',
  status: 'pipeline',  // ← Any status except 'owned'
  budget: 45000000,
  stage: 'Due Diligence',
  // ... other properties
};
```

**Shows:**
- Target price and expected returns
- Deal progress (DD, Legal, Financing)
- Acquisition team
- Deal analysis actions

---

### For Performance Mode (Owned Assets)
```tsx
const deal = {
  id: 'deal-002',
  name: 'Existing Property',
  status: 'owned',  // ← Triggers Performance Mode
  actualCloseDate: '2022-08-15',
  propertyCount: 180,
  // ... other properties
};
```

**Shows:**
- Actual performance metrics
- Performance vs budget
- Property management team
- Operational actions

---

## 🎨 Try the Demo

Want to see it in action before integrating?

```tsx
import { OverviewDualModeDemo } from './components/deal/sections/OverviewDualModeDemo';

function App() {
  return <OverviewDualModeDemo />;
}
```

The demo includes:
- Toggle between modes
- Sample data for both modes
- Feature comparison
- Technical documentation

---

## 📊 Using Real Data

### Replace Mock Data with API

**Current (Mock):**
```tsx
const stats = isPipeline ? acquisitionStats : performanceStats;
```

**With Real API:**
```tsx
import { useQuery } from '@tanstack/react-query';

const { data: stats } = useQuery(
  ['deal-stats', deal.id, mode],
  () => fetchDealStats(deal.id, mode)
);
```

### Add Custom Actions

```tsx
const customActions = [
  {
    id: 'my-action',
    label: 'My Custom Action',
    icon: '⚡',
    color: 'purple',
    action: () => {
      // Your custom logic here
      console.log('Action triggered!');
    }
  }
];
```

---

## 🎯 Common Use Cases

### 1. In a Deal Page
```tsx
function DealPage({ dealId }) {
  const { data: deal } = useDeal(dealId);
  
  return (
    <div className="max-w-7xl mx-auto p-6">
      <OverviewSection deal={deal} />
    </div>
  );
}
```

### 2. In a Dashboard
```tsx
function Dashboard() {
  const { data: deals } = useDeals();
  
  return (
    <div className="grid gap-6">
      {deals.map(deal => (
        <OverviewSection key={deal.id} deal={deal} />
      ))}
    </div>
  );
}
```

### 3. In a Modal
```tsx
function DealModal({ deal, isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <OverviewSection deal={deal} />
    </Modal>
  );
}
```

---

## 🔧 Customization

### Change Stats Display

Edit `src/data/overviewMockData.ts`:

```tsx
export const performanceStats: QuickStat[] = [
  {
    label: 'My Custom Metric',
    value: 12345,
    icon: '🎯',
    format: 'number',
    trend: {
      direction: 'up',
      value: '+15%'
    }
  },
  // ... more stats
];
```

### Customize Colors

In `OverviewSection.tsx`, update the color classes:

```tsx
// Acquisition mode color
isPipeline ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'

// Change to your brand colors
isPipeline ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'
```

### Add More Actions

```tsx
const myActions = [
  ...acquisitionActions,  // Existing actions
  {
    id: 'new-action',
    label: 'New Feature',
    icon: '🆕',
    color: 'indigo'
  }
];
```

---

## 🐛 Troubleshooting

### Mode Not Switching?
Check that `deal.status` is set correctly:
- For acquisition: `status !== 'owned'`
- For performance: `status === 'owned'`

### Missing Data?
Ensure your deal object includes required fields:
```tsx
{
  id: string,
  name: string,
  status: string,  // Required for mode detection
  createdAt: string,
  updatedAt: string
}
```

### Styling Issues?
Make sure TailwindCSS is configured and imported in your app.

---

## 📚 Learn More

- **Full Documentation**: See `OVERVIEW_DUAL_MODE_README.md`
- **Implementation Details**: See `OverviewSection.tsx`
- **Mock Data Structure**: See `overviewMockData.ts`
- **Interactive Demo**: Try `OverviewDualModeDemo.tsx`

---

## ✨ Next Steps

1. **Integrate with your app** - Add to existing deal pages
2. **Connect real data** - Replace mock data with API calls
3. **Customize styling** - Adjust colors to match your brand
4. **Add features** - Extend with charts, exports, etc.
5. **Test both modes** - Try with pipeline and owned deals

---

## 💡 Pro Tips

1. **Use the hook separately** if you need mode detection elsewhere:
   ```tsx
   import { useDealMode } from './hooks/useDealMode';
   const { mode, isPipeline, isOwned } = useDealMode(deal);
   ```

2. **Extract sub-components** for use in other sections:
   ```tsx
   import { QuickStatsGrid } from './components/deal/sections/OverviewSection';
   ```

3. **Combine with other sections** for a complete deal view:
   ```tsx
   <OverviewSection deal={deal} />
   <FinancialSection deal={deal} />
   <MarketSection deal={deal} />
   ```

---

**Need Help?** Check the full documentation or ask the team!

🚀 **Happy Building!**
