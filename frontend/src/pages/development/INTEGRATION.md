# Supply Pipeline Module - Integration Guide

## Quick Start

### 1. Add Route to Router

Update your main router file (e.g., `App.tsx` or `routes.tsx`):

```typescript
import { SupplyPipelinePage } from './pages/development';

// In your Routes configuration:
<Route path="/development/supply/:dealId" element={<SupplyPipelinePage />} />
```

### 2. Add Navigation Link

From any page, navigate to the Supply Pipeline:

```typescript
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();

// Link to supply pipeline for a specific deal
<button onClick={() => navigate(`/development/supply/${dealId}`)}>
  View Supply Pipeline
</button>

// Or as a Link component
<Link to={`/development/supply/${dealId}`}>
  Supply Pipeline Analysis
</Link>
```

### 3. Test with Mock Data

The page currently uses mock data generators, so it works immediately without backend:

```bash
# Start dev server
npm run dev

# Navigate to:
http://localhost:5173/development/supply/test-deal-123
```

## API Integration

### Replace Mock Data

Find and replace these functions in `SupplyPipelinePage.tsx`:

```typescript
// Current: Uses mock generators
const fetchSupplyData = async () => {
  setSupplyWave(generateMockSupplyWave());
  setPipelineProjects(generateMockPipeline());
  // ...
};

// Replace with: Real API calls
const fetchSupplyData = async () => {
  try {
    const [waveRes, pipelineRes, devsRes, absRes, riskRes] = await Promise.all([
      fetch(`/api/v1/supply/wave?deal_id=${dealId}&horizon=${timeHorizon}`),
      fetch(`/api/v1/supply/pipeline?deal_id=${dealId}`),
      fetch(`/api/v1/supply/developers?deal_id=${dealId}`),
      fetch(`/api/v1/supply/absorption?deal_id=${dealId}`),
      fetch(`/api/v1/supply/risk-score?deal_id=${dealId}`),
    ]);

    setSupplyWave(await waveRes.json());
    setPipelineProjects(await pipelineRes.json());
    setDeveloperActivity(await devsRes.json());
    setAbsorption(await absRes.json());
    setRiskScore(await riskRes.json());
  } catch (error) {
    console.error('Error fetching supply data:', error);
  }
};
```

### API Endpoint Specifications

#### 1. Supply Wave Data

```
GET /api/v1/supply/wave
Query params:
  - deal_id: string (required)
  - horizon: '3yr' | '5yr' | '10yr' (default: '5yr')

Response: SupplyWaveData[]
[
  {
    year: 2025,
    quarter: "2025Q1",
    confirmed: 450,
    underConstruction: 320,
    planned: 180,
    total: 950
  },
  ...
]
```

#### 2. Pipeline Projects

```
GET /api/v1/supply/pipeline
Query params:
  - deal_id: string (required)
  - phase: 'all' | 'planned' | 'under_construction' | 'delivered'
  - submarket: string (optional)

Response: PipelineProject[]
[
  {
    id: "proj-123",
    name: "Midtown Tower",
    developer: "Greystar",
    units: 350,
    phase: "under_construction",
    expectedDelivery: "2026Q2",
    submarket: "Midtown",
    distanceMiles: 1.2,
    unitMix: {
      studio: 15,
      oneBed: 45,
      twoBed: 30,
      threeBed: 10
    },
    status: "On Track",
    delayMonths: 0
  },
  ...
]
```

#### 3. Developer Activity

```
GET /api/v1/supply/developers
Query params:
  - deal_id: string (required)
  - market_id: string (optional)

Response: DeveloperActivity[]
[
  {
    developer: "Greystar",
    activeProjects: 4,
    totalUnits: 1450,
    pipelineShare: 18.5,
    avgDeliveryTime: 22,
    delayRate: 12.5,
    marketShare: 15.2
  },
  ...
]
```

#### 4. Absorption Analysis

```
GET /api/v1/supply/absorption
Query params:
  - deal_id: string (required)
  - market_id: string (optional)
  - trade_area_id: number (optional)

Response: AbsorptionAnalysis
{
  currentRate: 52.5,
  historicalAvg: 48.2,
  projectedRate: 45.8,
  monthsToAbsorb: 32.4,
  riskLevel: "medium",
  demandSupplyGap: -125,
  peakSupplyQuarter: "2026Q2"
}
```

#### 5. Risk Scoring

```
GET /api/v1/supply/risk-score
Query params:
  - deal_id: string (required)

Response: RiskScore
{
  overall: 58,
  level: "medium",
  factors: {
    pipelineConcentration: 65,
    absorptionRisk: 52,
    timingRisk: 48,
    unitMixCompetition: 58
  },
  recommendations: [
    "Consider targeting Q3 2026 delivery to avoid peak supply in Q2",
    "Increase 1BR allocation to differentiate from competing projects",
    ...
  ]
}
```

## Menu Integration

### Add to Navigation Menu

If you have a main navigation menu, add the Supply Pipeline link:

```typescript
// Example: In your Navigation component
const devAnalysisMenu = [
  {
    label: 'Market Intelligence',
    path: '/development/market',
    icon: '📊',
  },
  {
    label: 'Competition Analysis',
    path: '/development/competition',
    icon: '🏢',
  },
  {
    label: 'Supply Pipeline', // ← NEW
    path: `/development/supply/${currentDealId}`, // ← NEW
    icon: '🏗️', // ← NEW
  },
  {
    label: 'Trends Analysis',
    path: '/development/trends',
    icon: '📈',
  },
];
```

### Deal Detail Page Integration

Add Supply Pipeline as a tab or card in your deal detail page:

```typescript
// In DealDetailPage.tsx or similar
<div className="grid grid-cols-3 gap-4">
  <Card onClick={() => navigate(`/development/supply/${deal.id}`)}>
    <h3>Supply Pipeline</h3>
    <p>Analyze delivery timing and absorption risk</p>
  </Card>
  
  {/* Other analysis cards */}
</div>
```

## Styling Dependencies

The page uses Tailwind CSS. Ensure these utilities are available:

- Color palette: gray, blue, green, yellow, orange, red
- Responsive breakpoints: sm, md, lg, xl
- Transitions and animations
- Border radius utilities
- Shadow utilities

## Component Dependencies

Required npm packages:

```json
{
  "dependencies": {
    "react": "^18.x",
    "react-router-dom": "^6.x",
    "recharts": "^2.x"
  }
}
```

If Recharts is not installed:

```bash
npm install recharts
```

## TypeScript

The page is fully typed. Ensure `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true
  }
}
```

## Testing Checklist

### Unit Tests

```typescript
// SupplyPipelinePage.test.tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SupplyPipelinePage from './SupplyPipelinePage';

test('renders supply pipeline page', () => {
  render(
    <MemoryRouter>
      <SupplyPipelinePage />
    </MemoryRouter>
  );
  
  expect(screen.getByText('Supply Pipeline Analysis')).toBeInTheDocument();
});
```

### Integration Tests

1. **Navigation:** Verify routing works from other pages
2. **Tab Switching:** All 5 tabs load without errors
3. **Data Loading:** Loading states display correctly
4. **Charts:** Recharts render properly
5. **Responsive:** Works on mobile/tablet/desktop
6. **Filters:** Submarket and phase filters function
7. **Time Horizon:** 3yr/5yr/10yr toggle updates view

### Manual Testing Checklist

- [ ] Page loads without console errors
- [ ] All 5 tabs are clickable and switch views
- [ ] Supply wave chart displays with bars
- [ ] Phase cards show correct unit counts
- [ ] Developer table sorts and displays data
- [ ] Absorption metrics render
- [ ] Risk gauge displays with color
- [ ] Back navigation works
- [ ] Time horizon selector updates data
- [ ] Responsive layout on mobile
- [ ] All colors render correctly
- [ ] AI insights display properly

## Troubleshooting

### Issue: Recharts not rendering

**Solution:** Ensure `ResponsiveContainer` has explicit height:

```typescript
<ResponsiveContainer width="100%" height={400}>
  <BarChart data={data}>
    ...
  </BarChart>
</ResponsiveContainer>
```

### Issue: TypeScript errors on mock data

**Solution:** Verify all interfaces match the generated mock data structure. Check that optional fields use `?:` syntax.

### Issue: Navigation not working

**Solution:** Ensure `react-router-dom` is installed and `<BrowserRouter>` wraps your app:

```typescript
// In main.tsx or App.tsx
import { BrowserRouter } from 'react-router-dom';

<BrowserRouter>
  <App />
</BrowserRouter>
```

### Issue: Tailwind classes not applying

**Solution:** Verify Tailwind is configured and content paths include the pages directory:

```javascript
// tailwind.config.js
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  ...
}
```

## Next Steps

1. ✅ **You are here:** Component built with mock data
2. 🔄 **Connect APIs:** Replace mock generators with real endpoints
3. 🧪 **Test:** Write unit and integration tests
4. 🎨 **Polish:** Fine-tune styling and animations
5. 📊 **Analytics:** Add tracking for user interactions
6. 🚀 **Deploy:** Ship to production

## Support

For questions or issues:
- Check design doc: `/jedire/DEV_ANALYSIS_MODULES_DESIGN.md`
- Review existing components: `/components/deal/SupplyPipeline.tsx`
- Reference Market Intelligence page: `/pages/MarketIntelligence/FutureSupplyPage.tsx`

---

**Last Updated:** 2025-01-10  
**Status:** Ready for integration  
**API Status:** Pending - using mock data
