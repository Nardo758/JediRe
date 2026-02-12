# Opus Integration - Quick Start

Get AI-powered deal analysis running in 5 minutes.

## Step 1: Install Dependencies

```bash
cd frontend
npm install @anthropic-ai/sdk
```

## Step 2: Environment Setup

Add to `frontend/.env`:

```bash
# For production/live API
VITE_ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

# Or leave blank to use mock mode for development
```

## Step 3: Use Mock Mode (Recommended for Development)

No API key needed! Just use the mock service:

```typescript
import { opusMockService } from './services/opus.mock.service';

// Instant results, no API costs
const analysis = await opusMockService.analyzeAcquisition(dealContext);
```

## Step 4: Basic Integration

Add to any deal page component:

```typescript
import { opusMockService } from '../services/opus.mock.service';
import type { OpusDealContext, OpusRecommendationResult } from '../types/opus.types';

const [analysis, setAnalysis] = useState<OpusRecommendationResult | null>(null);

const analyzeDeal = async () => {
  // Build context from your deal data
  const context: OpusDealContext = {
    dealId: deal.id,
    dealName: deal.name,
    status: 'pipeline',
    overview: {
      propertySpecs: {
        address: deal.address,
        propertyType: deal.propertyType,
        units: deal.units,
        // ... more specs
      },
      metrics: {
        purchasePrice: deal.price,
        capRate: deal.capRate,
        // ... more metrics
      }
    },
    // Add financial, competition, supply data as available
    financial: deal.financial ? {
      proForma: {
        revenue: { grossRent: deal.grossRent },
        expenses: { operating: deal.opex },
        noi: deal.noi
      }
    } : undefined
  };

  // Get analysis
  const result = await opusMockService.analyzeAcquisition(context);
  setAnalysis(result);
};

// Display results
{analysis && (
  <div>
    <h3>Score: {analysis.score}/10</h3>
    <p>Recommendation: {analysis.recommendation}</p>
    <p>{analysis.reasoning}</p>
    
    <h4>Key Insights:</h4>
    <ul>
      {analysis.keyInsights.map(insight => <li>{insight}</li>)}
    </ul>
    
    <h4>Risks ({analysis.risks.length}):</h4>
    {analysis.risks.map(risk => (
      <div>
        <strong>{risk.category}:</strong> {risk.description}
        <br />
        <em>Mitigation: {risk.mitigation}</em>
      </div>
    ))}
  </div>
)}
```

## Step 5: Example Component

See complete working example:

```typescript
import OpusIntegrationExample from './components/OpusIntegrationExample';

<OpusIntegrationExample deal={deal} useMockData={true} />
```

## What You Get

### Acquisition Analysis
- **Score**: 0-10 rating
- **Recommendation**: strong-buy, buy, hold, pass, strong-pass
- **Key Insights**: Top 3-5 critical points
- **Risks**: Identified risks with mitigation strategies
- **Opportunities**: Value-add and optimization opportunities
- **Action Items**: Prioritized next steps

### Performance Analysis (Owned Assets)
- **Score**: Current performance rating
- **Recommendation**: optimize, hold-asset, sell
- **Optimization Opportunities**: Revenue and expense improvements
- **Performance Insights**: Strengths and weaknesses
- **Action Items**: Improvement priorities

### Chat Interface
```typescript
const response = await opusMockService.chat({
  dealId: deal.id,
  message: 'What are the biggest risks?',
  sessionId: sessionId
});

console.log(response.message.content);
```

## Progressive Enhancement

Start simple, add more data over time:

**Minimal** (works with just this):
```typescript
{
  dealId, dealName, status,
  overview: { propertySpecs, metrics }
}
```

**Better** (add financial):
```typescript
{
  ...,
  financial: { proForma }
}
```

**Best** (full context):
```typescript
{
  ...,
  competition: { comps, marketPosition },
  supply: { pipelineProjects, impactAnalysis },
  debt: { currentRates, lendingConditions },
  market: { demographics, trends }
}
```

More data = better analysis & higher confidence!

## Switching to Live API

When ready for production:

1. Get Anthropic API key from https://console.anthropic.com
2. Add to `.env`: `VITE_ANTHROPIC_API_KEY=sk-ant-...`
3. Switch to real service:

```typescript
import { opusService } from '../services/opus.service';

// Will use API key from environment
const analysis = await opusService.analyzeAcquisition(context);

// Check costs
const metrics = opusService.getUsageMetrics();
console.log(`Cost: $${metrics.totalCost.toFixed(2)}`);
```

## Cost Reference

Claude Opus (production):
- ~$0.20-$0.40 per analysis
- ~$0.05-$0.15 per chat message

Mock service (development):
- $0 always
- Instant responses
- Realistic data

## Troubleshooting

**"API key missing"**
→ Use mock mode or add `VITE_ANTHROPIC_API_KEY` to `.env`

**"Insufficient data"**
→ Add at least `overview` with `propertySpecs` and `metrics`

**Low confidence score**
→ Add more tab data (financial, competition, supply)

**Mock responses too generic**
→ Mock service generates realistic data - good for testing UI, use real API for actual analysis

## Next Steps

1. ✅ Start with mock service
2. ✅ Build deal context gathering
3. ✅ Create UI for analysis results
4. ✅ Add chat interface
5. ✅ Switch to real API when ready
6. ✅ Monitor costs and usage

See `OPUS_INTEGRATION_GUIDE.md` for complete documentation.

## File Reference

- Types: `frontend/src/types/opus.types.ts`
- Service: `frontend/src/services/opus.service.ts`
- Mock: `frontend/src/services/opus.mock.service.ts`
- Example: `frontend/src/components/OpusIntegrationExample.tsx`
- Guide: `OPUS_INTEGRATION_GUIDE.md`

Ready to build! 🚀
