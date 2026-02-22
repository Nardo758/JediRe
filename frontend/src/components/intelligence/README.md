# Market Intelligence Components

## SupplyWaveChart

**THE KEY DIFFERENTIATOR** - 10-Year Supply Wave Forecast Visualization for JEDI RE Market Intelligence

### Overview

The SupplyWaveChart is a sophisticated, interactive data visualization component that displays 10-year supply forecasts for real estate markets. It combines dual-layer bar charts with phase annotations to provide instant visual insights into market supply dynamics.

### Features

✨ **Dual-Layer Visualization**
- Pipeline Development (solid red gradient)
- Capacity Conversion (orange gradient)
- Stacked bars showing total supply per year

🎯 **Phase Annotations**
- Real-time market phase indicators
- 4 phases: PEAKING → CRESTING → TROUGH → BUILDING
- Color-coded badges with icons
- Auto-highlight on hover

💡 **Interactive Experience**
- Rich hover tooltips with breakdown
- Smooth transitions and animations
- Responsive design
- Opacity effects for focus

📊 **Professional Styling**
- Custom gradients using SVG defs
- TailwindCSS integration
- Shadcn/ui compatible
- Print-ready visuals

### Usage

```typescript
import { SupplyWaveChart } from '@/components/intelligence';

function FutureSupplyPage() {
  const { data: supplyData } = useQuery(
    ['supplyForecast', marketId], 
    () => fetchSupplyForecast(marketId)
  );

  return (
    <SupplyWaveChart 
      marketId="DC-08-Washington" 
      data={supplyData} 
    />
  );
}
```

### Props

```typescript
interface SupplyWaveChartProps {
  marketId: string;
  data: Array<{
    year: number;        // 2026-2035
    pipeline: number;    // Pipeline units
    capacity: number;    // Capacity conversion units
    phase: string;       // 'PEAKING' | 'CRESTING' | 'TROUGH' | 'BUILDING'
  }>;
}
```

### Data Source

Component expects data from **DC-08 output type** (Future Supply forecast):

```typescript
// Expected API response shape
{
  marketId: "DC-08-Washington",
  forecastYears: [
    {
      year: 2026,
      pipelineDevelopment: 400,      // Maps to 'pipeline'
      capacityConversion: 45,         // Maps to 'capacity'
      marketPhase: 'CRESTING'         // Maps to 'phase'
    },
    // ... more years
  ]
}
```

### Phase Definitions

| Phase | Icon | Description |
|-------|------|-------------|
| **PEAKING** | 📈 | Maximum supply delivery, highest development activity |
| **CRESTING** | 🌊 | Supply wave reaching peak, beginning to decline |
| **TROUGH** | 📉 | Minimal new supply, market absorption phase |
| **BUILDING** | 📊 | Supply increasing, new development ramping up |

### Customization

#### Colors

Edit the gradients in the component:

```typescript
// Pipeline gradient (red)
<linearGradient id="pipelineGradient">
  <stop offset="0%" stopColor="#dc2626" />
  <stop offset="100%" stopColor="#b91c1c" />
</linearGradient>

// Capacity gradient (orange)
<linearGradient id="capacityGradient">
  <stop offset="0%" stopColor="#fb923c" />
  <stop offset="100%" stopColor="#ea580c" />
</linearGradient>
```

#### Phase Configs

```typescript
const PHASE_CONFIGS: Record<string, PhaseConfig> = {
  PEAKING: {
    label: 'PEAKING',
    color: 'text-red-700',
    bgColor: 'bg-red-50 border-red-300',
    icon: '📈',
  },
  // ... customize as needed
};
```

### Example Component

See `SupplyWaveChartExample.tsx` for a complete working example with:
- Mock data setup
- Integration example
- Usage documentation
- Feature showcase

### Dependencies

- `recharts` - Chart library
- `react` - UI framework
- TailwindCSS - Styling

### Performance Notes

- Component memoizes hover state for smooth interactions
- ResponsiveContainer handles resize efficiently
- Gradient definitions cached in SVG defs
- Recommended max data points: 10-15 years

### Accessibility

- Color-blind friendly with distinct shapes
- Keyboard navigation supported via Recharts
- ARIA labels on interactive elements
- High contrast text

### Integration Checklist

- [ ] Install recharts: `npm install recharts`
- [ ] Verify TailwindCSS config includes opacity utilities
- [ ] Set up API endpoint for DC-08 data
- [ ] Map API response to component data shape
- [ ] Test responsive behavior on mobile
- [ ] Verify gradient rendering in target browsers
- [ ] Add loading/error states in parent component

### Future Enhancements

Potential improvements:
- Export to PNG/PDF functionality
- Historical vs forecast comparison mode
- Drill-down to quarterly granularity
- Animated transitions between data updates
- Custom date range selector
- Comparison across multiple markets

---

**Created**: 2024  
**Author**: JEDI RE Platform Team  
**Component Type**: Data Visualization  
**Status**: Production Ready ✅
