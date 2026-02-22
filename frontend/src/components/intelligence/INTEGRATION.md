# SupplyWaveChart Integration Guide

## Quick Start

### 1. Import the Component

```typescript
import { SupplyWaveChart } from '@/components/intelligence';
```

### 2. Prepare Your Data

```typescript
// Example with API data
const { data: supplyData, isLoading } = useQuery(
  ['future-supply', marketId],
  async () => {
    const response = await fetch(`/api/markets/${marketId}/future-supply`);
    const data = await response.json();
    
    // Transform DC-08 output to component format
    return data.forecastYears.map(year => ({
      year: year.year,
      pipeline: year.pipelineDevelopment,
      capacity: year.capacityConversion,
      phase: year.marketPhase, // 'PEAKING' | 'CRESTING' | 'TROUGH' | 'BUILDING'
    }));
  }
);
```

### 3. Render the Chart

```typescript
function FutureSupplyPage() {
  const { marketId } = useParams();
  const { data: supplyData, isLoading } = useFutureSupplyData(marketId);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <SupplyWaveChart 
        marketId={marketId} 
        data={supplyData} 
      />
    </div>
  );
}
```

## Full Example with Error Handling

```typescript
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { SupplyWaveChart } from '@/components/intelligence';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FutureSupplyPageProps {
  marketId: string;
}

const FutureSupplyPage: React.FC<FutureSupplyPageProps> = ({ marketId }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['future-supply', marketId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/markets/${marketId}/future-supply`);
      if (!res.ok) throw new Error('Failed to fetch supply data');
      const json = await res.json();
      
      return json.forecastYears.map((year: any) => ({
        year: year.year,
        pipeline: year.pipelineDevelopment || 0,
        capacity: year.capacityConversion || 0,
        phase: year.marketPhase || 'BUILDING',
      }));
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[500px] w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load supply forecast data. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No supply forecast data available for this market.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Future Supply Analysis</h1>
          <p className="text-muted-foreground mt-1">
            10-year supply wave forecast and market phase analysis
          </p>
        </div>
      </div>

      <SupplyWaveChart marketId={marketId} data={data} />

      {/* Additional context or insights */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="font-semibold mb-2">Peak Supply Year</h3>
          <p className="text-2xl font-bold text-indigo-600">
            {data.reduce((max, d) => 
              (d.pipeline + d.capacity) > (max.pipeline + max.capacity) ? d : max
            ).year}
          </p>
        </div>
        
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="font-semibold mb-2">Total 10-Year Pipeline</h3>
          <p className="text-2xl font-bold text-red-600">
            {data.reduce((sum, d) => sum + d.pipeline, 0).toLocaleString()}
          </p>
        </div>
        
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="font-semibold mb-2">Total Capacity Conversion</h3>
          <p className="text-2xl font-bold text-orange-600">
            {data.reduce((sum, d) => sum + d.capacity, 0).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default FutureSupplyPage;
```

## API Endpoint Requirements

### Expected DC-08 Response Format

```json
{
  "marketId": "DC-08-Washington",
  "marketName": "Washington DC Metro",
  "generatedAt": "2024-02-21T06:00:00Z",
  "forecastYears": [
    {
      "year": 2026,
      "pipelineDevelopment": 400,
      "capacityConversion": 45,
      "marketPhase": "CRESTING",
      "totalSupply": 445,
      "metadata": {
        "confidence": 0.85,
        "dataSource": "DC-08-processor"
      }
    }
    // ... years 2027-2035
  ]
}
```

### Backend Route Example (Express/Node)

```typescript
// routes/markets.ts
router.get('/markets/:marketId/future-supply', async (req, res) => {
  const { marketId } = req.params;
  
  try {
    // Fetch from DC-08 output processor
    const forecast = await dc08Service.getFutureSupplyForecast(marketId);
    
    res.json({
      marketId,
      marketName: forecast.marketName,
      generatedAt: new Date().toISOString(),
      forecastYears: forecast.years.map(year => ({
        year: year.year,
        pipelineDevelopment: year.pipeline,
        capacityConversion: year.capacity,
        marketPhase: year.phase,
        totalSupply: year.pipeline + year.capacity,
        metadata: {
          confidence: year.confidence,
          dataSource: 'DC-08-processor'
        }
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch supply forecast' });
  }
});
```

## Styling Customization

### Adjusting Chart Colors

Edit `SupplyWaveChart.tsx`:

```typescript
// Change pipeline color (currently red)
<linearGradient id="pipelineGradient">
  <stop offset="0%" stopColor="#your-color-start" />
  <stop offset="100%" stopColor="#your-color-end" />
</linearGradient>

// Change capacity color (currently orange)
<linearGradient id="capacityGradient">
  <stop offset="0%" stopColor="#your-color-start" />
  <stop offset="100%" stopColor="#your-color-end" />
</linearGradient>
```

### Adjusting Chart Dimensions

```typescript
<ResponsiveContainer width="100%" height={450}>
  {/* Change height to desired value */}
</ResponsiveContainer>
```

## Testing

### Unit Test Example (Jest + React Testing Library)

```typescript
import { render, screen } from '@testing-library/react';
import SupplyWaveChart from './SupplyWaveChart';

const mockData = [
  { year: 2026, pipeline: 400, capacity: 45, phase: 'CRESTING' },
  { year: 2027, pipeline: 200, capacity: 52, phase: 'TROUGH' },
];

describe('SupplyWaveChart', () => {
  it('renders chart with market ID', () => {
    render(<SupplyWaveChart marketId="DC-08" data={mockData} />);
    expect(screen.getByText(/DC-08/)).toBeInTheDocument();
  });

  it('displays all years', () => {
    render(<SupplyWaveChart marketId="DC-08" data={mockData} />);
    expect(screen.getByText('2026')).toBeInTheDocument();
    expect(screen.getByText('2027')).toBeInTheDocument();
  });
});
```

## Troubleshooting

### Issue: Chart not rendering

**Solution**: Ensure Recharts is installed:
```bash
npm install recharts
```

### Issue: Gradients not displaying

**Solution**: Check that your build process supports SVG gradients. May need to configure webpack/vite.

### Issue: Phase badges misaligned

**Solution**: Adjust the `gap` value in the phase badges container:
```typescript
<div className="flex flex-col gap-[30px]">
  {/* Adjust gap-[30px] to match your bar spacing */}
</div>
```

### Issue: Tooltip cut off at edges

**Solution**: Increase chart margins:
```typescript
<BarChart margin={{ top: 20, right: 120, left: 20, bottom: 60 }}>
  {/* Increase right margin if badges overlap */}
</BarChart>
```

## Performance Optimization

### Memoization

```typescript
import { useMemo } from 'react';

const MemoizedSupplyWaveChart = React.memo(SupplyWaveChart);

// In parent component
const chartData = useMemo(() => transformApiData(rawData), [rawData]);

<MemoizedSupplyWaveChart marketId={marketId} data={chartData} />
```

### Lazy Loading

```typescript
const SupplyWaveChart = lazy(() => import('@/components/intelligence/SupplyWaveChart'));

<Suspense fallback={<ChartSkeleton />}>
  <SupplyWaveChart marketId={marketId} data={data} />
</Suspense>
```

---

**Last Updated**: 2024-02-21  
**Version**: 1.0.0  
**Status**: Ready for Integration ✅
