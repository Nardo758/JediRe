# Opus Types Quick Reference

## Core Interfaces

### OpusDealContext
Complete deal data from all tabs - pass this to Opus for analysis.

```typescript
const context: OpusDealContext = {
  dealId: deal.id,
  dealName: deal.name,
  status: 'pipeline', // or 'owned'
  overview: {...},
  competition: {...},
  supply: {...},
  // ... other tabs
};
```

### OpusRecommendationResult
What you get back from analysis.

```typescript
{
  score: 7.5,                    // 0-10
  confidence: 85,                 // 0-100%
  recommendation: 'buy',          // strong-buy, buy, hold, pass, strong-pass
  reasoning: "...",
  keyInsights: [...],
  risks: [...],
  opportunities: [...],
  actionItems: [...]
}
```

## Tab Data Contracts

### Overview Tab
```typescript
interface OverviewData {
  propertySpecs: {
    address: string;
    propertyType: string;
    units?: number;
    squareFeet?: number;
    yearBuilt?: number;
    // ...
  };
  metrics: {
    purchasePrice?: number;
    capRate?: number;
    irr?: number;
    // ...
  };
  location?: {...};
}
```

### Competition Tab
```typescript
interface CompetitionData {
  comps: ComparableProperty[];
  marketPosition: {
    pricingCompetitiveness: number; // -100 to +100
    demandLevel?: 'very-high' | 'high' | 'moderate' | 'low';
    vacancyRate?: number;
  };
}
```

### Supply Tab
```typescript
interface SupplyData {
  pipelineProjects: SupplyProject[];
  impactAnalysis: {
    totalPipelineUnits: number;
    overallImpact: 'minimal' | 'moderate' | 'significant' | 'severe';
    // ...
  };
}
```

### Debt Tab
```typescript
interface DebtData {
  currentRates: {
    currentRate?: number;
    rateType: 'fixed' | 'floating' | 'hybrid';
    marketTrend: 'increasing' | 'decreasing' | 'stable';
  };
  lendingConditions: {
    maxLtv?: number;
    lenderAppetite: 'strong' | 'moderate' | 'weak';
    // ...
  };
}
```

### Financial Tab
```typescript
interface FinancialData {
  proForma: {
    revenue: {...};
    expenses: {...};
    noi?: number;
  };
  projections?: CashFlowProjection[];
  sensitivityAnalysis?: [...];
}
```

## Usage Pattern

```typescript
import { opusService } from '../services/opus.service';

// 1. Build context from tab data
const context: OpusDealContext = {
  dealId: deal.id,
  dealName: deal.name,
  status: 'pipeline',
  overview: getOverviewData(),
  financial: getFinancialData(),
  // ... add data from other tabs
};

// 2. Get analysis
const analysis = await opusService.analyzeAcquisition(context);

// 3. Use results
console.log(analysis.recommendation); // 'buy'
console.log(analysis.score);          // 7.5
console.log(analysis.keyInsights);    // [...]
```

## Quick Tips

1. **More data = better analysis** - Include all available tab data
2. **Mock mode for dev** - `opusService.updateConfig({ useMockData: true })`
3. **Check confidence** - Low confidence means insufficient data
4. **Track costs** - `opusService.getUsageMetrics()`

See `OPUS_INTEGRATION_GUIDE.md` for complete documentation.
