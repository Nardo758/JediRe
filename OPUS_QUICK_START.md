# Opus Quick Start - 5 Minutes to Analysis

**Get AI-powered deal analysis running in 5 minutes**

---

## Step 1: Install SDK (30 seconds)

```bash
cd jedire/frontend
npm install @anthropic-ai/sdk
```

---

## Step 2: Get API Key (2 minutes)

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up / Log in
3. Navigate to **API Keys**
4. Click **Create Key**
5. Copy the key (starts with `sk-ant-api03-...`)

---

## Step 3: Configure Environment (30 seconds)

Create or edit `jedire/frontend/.env`:

```bash
VITE_ANTHROPIC_API_KEY=sk-ant-api03-...paste-your-key-here...
```

**Important**: Don't commit this file to git!

---

## Step 4: Test with Mock Data (1 minute)

Create a test file `jedire/frontend/src/test-opus.ts`:

```typescript
import { opusService } from './services/opus.service';
import { buildOpusContext } from './services/opus.context.builder';

// Enable mock mode (no API calls)
opusService.updateConfig({ useMockData: true });

// Test analysis
async function testOpus() {
  const mockDeal = {
    id: 'test-1',
    name: 'Sunnyvale Gardens Apartments',
    status: 'PIPELINE',
    dealValue: 12500000,
    capRate: 6.2,
    units: 120,
    propertyAddress: '123 Main St, Sunnyvale, CA'
  };

  const context = buildOpusContext(mockDeal);
  
  console.log('Context completeness:', context.dataCompleteness + '%');
  
  const analysis = await opusService.analyzeAcquisition(context);
  
  console.log('\n=== ANALYSIS RESULTS ===');
  console.log('Recommendation:', analysis.recommendation);
  console.log('Score:', analysis.score, '/ 10');
  console.log('Confidence:', analysis.confidence + '%');
  console.log('\nKey Insights:');
  analysis.keyInsights.forEach((insight, i) => {
    console.log(`  ${i + 1}. ${insight}`);
  });
  console.log('\nRisks:', analysis.risks.length);
  console.log('Opportunities:', analysis.opportunities.length);
  console.log('Action Items:', analysis.actionItems.length);
}

testOpus().catch(console.error);
```

Run it:
```bash
npx tsx src/test-opus.ts
```

You should see analysis results in console! ✅

---

## Step 5: Switch to Real API (30 seconds)

Once you have an API key configured:

```typescript
// Remove or comment out mock mode
// opusService.updateConfig({ useMockData: true });

// Service will automatically use real API
const analysis = await opusService.analyzeAcquisition(context);
```

**Cost**: ~$0.15 per analysis with standard data

---

## Step 6: Build Your First UI Component (30 minutes)

```typescript
import { useState } from 'react';
import { opusService } from '@/services/opus.service';
import { buildOpusContext } from '@/services/opus.context.builder';

export function DealAnalysis({ deal }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  async function analyze() {
    setLoading(true);
    try {
      const context = buildOpusContext(deal);
      const result = await opusService.analyzeAcquisition(context);
      setAnalysis(result);
    } catch (error) {
      console.error('Analysis failed:', error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6">
      <button onClick={analyze} disabled={loading}>
        {loading ? 'Analyzing...' : '🤖 Run AI Analysis'}
      </button>

      {analysis && (
        <div className="mt-6 space-y-4">
          {/* Score Card */}
          <div className="card bg-white p-6 rounded-lg shadow">
            <div className="text-5xl font-bold text-blue-600">
              {analysis.score}/10
            </div>
            <div className="text-xl font-semibold mt-2">
              {analysis.recommendation.replace('-', ' ').toUpperCase()}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {analysis.confidence}% confidence
            </div>
          </div>

          {/* Executive Summary */}
          <div className="card bg-white p-6 rounded-lg shadow">
            <h3 className="font-bold text-lg mb-2">Executive Summary</h3>
            <p className="text-gray-700">{analysis.executiveSummary}</p>
          </div>

          {/* Key Insights */}
          <div className="card bg-white p-6 rounded-lg shadow">
            <h3 className="font-bold text-lg mb-3">Key Insights</h3>
            <ul className="space-y-2">
              {analysis.keyInsights.map((insight, i) => (
                <li key={i} className="flex items-start">
                  <span className="text-blue-500 mr-2">💡</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Risks */}
          <div className="card bg-white p-6 rounded-lg shadow">
            <h3 className="font-bold text-lg mb-3">
              Risks ({analysis.risks.length})
            </h3>
            <div className="space-y-3">
              {analysis.risks.map(risk => (
                <div key={risk.id} className="border-l-4 border-red-500 pl-3">
                  <div className="font-semibold text-gray-900">
                    {risk.category}
                  </div>
                  <div className="text-sm text-gray-700">
                    {risk.description}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {risk.level} risk • {risk.probability}% probability
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Opportunities */}
          <div className="card bg-white p-6 rounded-lg shadow">
            <h3 className="font-bold text-lg mb-3">
              Opportunities ({analysis.opportunities.length})
            </h3>
            <div className="space-y-3">
              {analysis.opportunities.map(opp => (
                <div key={opp.id} className="border-l-4 border-green-500 pl-3">
                  <div className="font-semibold text-gray-900">
                    {opp.type}
                  </div>
                  <div className="text-sm text-gray-700">
                    {opp.description}
                  </div>
                  {opp.potentialValue && (
                    <div className="text-xs text-green-600 mt-1">
                      Value: ${opp.potentialValue.toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## That's It! 🎉

You now have:
- ✅ AI-powered deal analysis
- ✅ Risk identification
- ✅ Opportunity detection
- ✅ Action item planning

---

## Next Steps

### Learn More
- **Full Documentation**: `jedire/docs/OPUS_INTEGRATION.md`
- **Type Reference**: `jedire/frontend/src/types/opus.README.md`
- **Examples**: See docs for chat interface, risk dashboard, etc.

### Add Features
- Chat interface for deal Q&A
- Risk dashboard
- Opportunity tracker
- Performance analysis for owned assets
- Usage metrics display

### Optimize
- Cache analyses to reduce API costs
- Add data validation before analysis
- Track usage with `opusService.getUsageMetrics()`
- Implement rate limiting for users

---

## Troubleshooting

### "API key missing"
- Check `.env` file exists in `frontend/`
- Verify key starts with `sk-ant-api03-`
- Restart dev server after adding `.env`

### "Insufficient data"
```typescript
// Check data completeness
const context = buildOpusContext(deal);
console.log('Completeness:', context.dataCompleteness);

// Add more tab data
const context = buildOpusContext(deal, {
  overview: getOverviewData(),
  financial: getFinancialData(),
  competition: getCompData()
});
```

### Mock mode not working
```typescript
// Make sure you're calling updateConfig before analysis
opusService.updateConfig({ useMockData: true });
```

---

## Cost Estimates

| Usage Level | Analyses/Month | Chat Messages | Monthly Cost |
|-------------|----------------|---------------|--------------|
| Light       | 50             | 200           | ~$15         |
| Medium      | 200            | 500           | ~$40         |
| Heavy       | 500            | 1000          | ~$90         |

**Per Analysis**: $0.08 - $0.30 depending on data completeness

---

## Support

**Questions?** Check the full documentation at `jedire/docs/OPUS_INTEGRATION.md`

**Ready to build!** 🚀
