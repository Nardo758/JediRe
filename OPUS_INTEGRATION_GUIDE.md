# Opus (Claude 3 Opus) AI Integration Guide

## Overview

The Opus integration brings advanced AI-powered deal analysis to JEDI RE using Anthropic's Claude 3 Opus model. This system provides comprehensive acquisition recommendations, performance analysis, and conversational deal intelligence across all deal tabs.

## Architecture

### Components

1. **Type Definitions** (`frontend/src/types/opus.types.ts`)
   - Complete data contract for all tab data
   - Analysis result types
   - Chat interface types
   - Configuration and error types

2. **Opus Service** (`frontend/src/services/opus.service.ts`)
   - Main service for API communication
   - Acquisition and performance analysis
   - Chat functionality
   - Usage tracking and metrics

3. **Mock Service** (`frontend/src/services/opus.mock.service.ts`)
   - Development mode without API key
   - Realistic mock responses
   - Testing and demo functionality

## Data Contract

### How Tab Data Feeds Opus

Each deal tab contributes specific data to the overall deal context:

```typescript
interface OpusDealContext {
  dealId: string;
  dealName: string;
  status: 'pipeline' | 'owned';
  
  // Tab-specific data (all optional)
  overview?: OverviewData;           // Property specs, metrics, location
  competition?: CompetitionData;      // Comps, market position
  supply?: SupplyData;                // Pipeline projects, impact analysis
  debt?: DebtData;                    // Interest rates, lending terms
  financial?: FinancialData;          // Pro forma, cash flow projections
  strategy?: StrategyData;            // Deal strategies, arbitrage
  dueDiligence?: DueDiligenceData;    // Checklist items, findings
  market?: MarketData;                // Demographics, trends, SWOT
  team?: TeamData;                    // Team members, communications
  documents?: DocumentData;           // Document inventory
}
```

### Tab Integration Example

Each tab component should export its data in the standardized format:

**Overview Tab:**
```typescript
import { OverviewData } from '../types/opus.types';

export const getOverviewData = (deal: Deal): OverviewData => {
  return {
    propertySpecs: {
      address: deal.address,
      propertyType: deal.propertyType,
      units: deal.targetUnits,
      squareFeet: deal.squareFeet,
      yearBuilt: deal.yearBuilt,
      // ... other specs
    },
    metrics: {
      purchasePrice: deal.dealValue,
      capRate: deal.capRate,
      cashOnCash: deal.cashOnCash,
      // ... other metrics
    },
    location: {
      lat: deal.lat,
      lng: deal.lng,
      city: deal.city,
      state: deal.state,
      // ...
    }
  };
};
```

**Market Competition Tab:**
```typescript
import { CompetitionData } from '../types/opus.types';

export const getCompetitionData = (comps: Comparable[]): CompetitionData => {
  return {
    comps: comps.map(c => ({
      address: c.address,
      distance: c.distance,
      salePrice: c.price,
      pricePerUnit: c.pricePerUnit,
      similarity: c.similarity,
      // ...
    })),
    marketPosition: {
      pricingCompetitiveness: calculateCompetitiveness(comps),
      demandLevel: analyzeDemand(),
      vacancyRate: getVacancyRate(),
      // ...
    }
  };
};
```

## Usage

### 1. Installation

First, install the Anthropic SDK:

```bash
npm install @anthropic-ai/sdk
```

### 2. Configuration

Set up your API key in `.env`:

```bash
VITE_ANTHROPIC_API_KEY=sk-ant-api03-...
```

For development without an API key, use mock mode:

```typescript
import { opusService } from '../services/opus.service';

opusService.updateConfig({ useMockData: true });
```

### 3. Acquisition Analysis

```typescript
import { opusService } from '../services/opus.service';
import { OpusDealContext } from '../types/opus.types';

// Build complete deal context from all tabs
const dealContext: OpusDealContext = {
  dealId: deal.id,
  dealName: deal.name,
  status: 'pipeline',
  overview: getOverviewData(deal),
  competition: getCompetitionData(comps),
  supply: getSupplyData(supply),
  debt: getDebtData(debtMarket),
  financial: getFinancialData(proforma),
  // ... other tabs as available
};

// Get analysis
try {
  const analysis = await opusService.analyzeAcquisition(dealContext);
  
  console.log('Recommendation:', analysis.recommendation);
  console.log('Score:', analysis.score);
  console.log('Confidence:', analysis.confidence);
  console.log('Key Insights:', analysis.keyInsights);
  console.log('Risks:', analysis.risks);
  console.log('Opportunities:', analysis.opportunities);
  console.log('Action Items:', analysis.actionItems);
} catch (error) {
  console.error('Analysis failed:', error);
}
```

### 4. Performance Analysis (Owned Assets)

```typescript
const dealContext: OpusDealContext = {
  dealId: asset.id,
  dealName: asset.name,
  status: 'owned',  // Important: owned assets use different prompts
  overview: getCurrentPerformanceData(asset),
  financial: getCurrentFinancials(asset),
  market: getMarketComparison(asset),
  // ...
};

const analysis = await opusService.analyzePerformance(dealContext);

// Analysis will include optimization recommendations
console.log('Performance Score:', analysis.score);
console.log('Recommendation:', analysis.recommendation); // 'optimize', 'hold-asset', or 'sell'
console.log('Opportunities:', analysis.opportunities);
```

### 5. Chat Interface

```typescript
import { ChatRequest, ChatResponse } from '../types/opus.types';

const request: ChatRequest = {
  dealId: deal.id,
  message: 'What are the biggest risks in this deal?',
  includeContext: true,  // Include full deal context
  temperature: 0.7,
  sessionId: currentSessionId  // Optional: maintain conversation
};

const response: ChatResponse = await opusService.chat(request);

console.log('AI Response:', response.message.content);
console.log('Session ID:', response.sessionId);
console.log('Follow-up suggestions:', response.suggestions);
```

### 6. Usage Metrics

```typescript
const metrics = opusService.getUsageMetrics();

console.log('Total Requests:', metrics.totalRequests);
console.log('Tokens Used:', metrics.totalTokensUsed);
console.log('Total Cost:', metrics.totalCost);
console.log('Avg Response Time:', metrics.averageResponseTime);
console.log('Error Rate:', metrics.errorRate);
```

## Component Integration

### AI Agent Tab Component

```typescript
import React, { useState } from 'react';
import { opusService } from '../services/opus.service';
import { OpusDealContext, OpusRecommendationResult } from '../types/opus.types';

export const AIAgentTab: React.FC<{ deal: Deal }> = ({ deal }) => {
  const [analysis, setAnalysis] = useState<OpusRecommendationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const analyzeDealbtn = async () => {
    setLoading(true);
    try {
      // Gather data from all tabs
      const context: OpusDealContext = buildDealContext(deal);
      
      // Run analysis
      const result = deal.status === 'pipeline' 
        ? await opusService.analyzeAcquisition(context)
        : await opusService.analyzePerformance(context);
      
      setAnalysis(result);
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('Failed to analyze deal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="opus-agent-tab">
      <button onClick={analyzeDealbtn} disabled={loading}>
        {loading ? 'Analyzing...' : 'Analyze Deal'}
      </button>
      
      {analysis && (
        <div className="analysis-results">
          <div className="score-card">
            <h3>Deal Score: {analysis.score.toFixed(1)}/10</h3>
            <p>Confidence: {analysis.confidence}%</p>
            <p className="recommendation">{analysis.recommendation}</p>
          </div>
          
          <div className="executive-summary">
            <h4>Executive Summary</h4>
            <p>{analysis.executiveSummary}</p>
          </div>
          
          <div className="key-insights">
            <h4>Key Insights</h4>
            <ul>
              {analysis.keyInsights.map((insight, i) => (
                <li key={i}>{insight}</li>
              ))}
            </ul>
          </div>
          
          <div className="risks">
            <h4>Risks ({analysis.risks.length})</h4>
            {analysis.risks.map(risk => (
              <div key={risk.id} className={`risk risk-${risk.level}`}>
                <h5>{risk.category}: {risk.description}</h5>
                <p>Impact: {risk.impact} | Probability: {risk.probability}%</p>
                {risk.mitigation && <p>Mitigation: {risk.mitigation}</p>}
              </div>
            ))}
          </div>
          
          <div className="opportunities">
            <h4>Opportunities ({analysis.opportunities.length})</h4>
            {analysis.opportunities.map(opp => (
              <div key={opp.id} className="opportunity">
                <h5>{opp.type}: {opp.description}</h5>
                {opp.potentialValue && (
                  <p>Potential Value: ${opp.potentialValue.toLocaleString()}</p>
                )}
                <p>Probability: {opp.probability}%</p>
              </div>
            ))}
          </div>
          
          <div className="action-items">
            <h4>Action Items ({analysis.actionItems.length})</h4>
            {analysis.actionItems.map(item => (
              <div key={item.id} className={`action priority-${item.priority}`}>
                <p><strong>{item.action}</strong></p>
                <p>Priority: {item.priority} | Timeframe: {item.timeframe}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
```

### Chat Component

```typescript
import React, { useState } from 'react';
import { opusService } from '../services/opus.service';
import { ChatMessage } from '../types/opus.types';

export const OpusChat: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string>();

  const sendMessage = async () => {
    if (!input.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };
    setMessages([...messages, userMessage]);
    setInput('');

    // Get AI response
    try {
      const response = await opusService.chat({
        dealId,
        message: input,
        sessionId,
        includeContext: true
      });

      setSessionId(response.sessionId);
      setMessages(prev => [...prev, response.message]);
    } catch (error) {
      console.error('Chat failed:', error);
    }
  };

  return (
    <div className="opus-chat">
      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <div className="content">{msg.content}</div>
            <div className="timestamp">{new Date(msg.timestamp).toLocaleTimeString()}</div>
          </div>
        ))}
      </div>
      
      <div className="input-area">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && sendMessage()}
          placeholder="Ask about this deal..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
};
```

## Mock vs Real Mode

### Development Mode (Mock)

During development, use mock mode to avoid API costs:

```typescript
import { opusMockService } from '../services/opus.mock.service';

const analysis = await opusMockService.analyzeAcquisition(context);
const chatResponse = await opusMockService.chat(request);
```

Or configure the main service:

```typescript
opusService.updateConfig({ useMockData: true });
```

### Production Mode (Real API)

In production, ensure API key is set:

```typescript
// Will use VITE_ANTHROPIC_API_KEY from environment
opusService.updateConfig({ 
  useMockData: false,
  model: 'claude-3-opus-20240229',
  maxTokens: 4096,
  temperature: 0.7
});
```

## Error Handling

```typescript
try {
  const analysis = await opusService.analyzeAcquisition(context);
} catch (error) {
  if (error.code === 'API_KEY_MISSING') {
    // Prompt user to configure API key or switch to mock mode
  } else if (error.code === 'RATE_LIMIT_EXCEEDED') {
    // Show rate limit message, retry later
  } else if (error.code === 'INSUFFICIENT_DATA') {
    // Prompt user to add more tab data
  } else {
    // Generic error handling
  }
}
```

## Cost Management

Claude Opus pricing (as of Feb 2025):
- Input: ~$15 per million tokens
- Output: ~$75 per million tokens

Typical usage:
- Single analysis: 2,000-4,000 tokens (~$0.20-$0.40)
- Chat message: 500-1,500 tokens (~$0.05-$0.15)

Monitor costs:

```typescript
const metrics = opusService.getUsageMetrics();
console.log(`Total cost: $${metrics.totalCost.toFixed(2)}`);
```

## Best Practices

### 1. Data Completeness

Provide as much tab data as possible:

```typescript
const context: OpusDealContext = {
  dealId: deal.id,
  dealName: deal.name,
  status: deal.status,
  overview: getOverviewData(deal),        // Required
  financial: getFinancialData(deal),      // Highly recommended
  competition: getCompetitionData(deal),  // Recommended
  supply: getSupplyData(deal),            // Recommended
  debt: getDebtData(deal),                // Optional but valuable
  market: getMarketData(deal),            // Optional but valuable
};
```

### 2. Context Caching

For repeated analysis of the same deal:

```typescript
// Cache context for reuse
const cachedContext = buildDealContext(deal);

// Quick re-analysis with different prompts
const quickAnalysis = await opusService.analyzeAcquisition(cachedContext);
```

### 3. Chat Sessions

Maintain session IDs for contextual conversations:

```typescript
let sessionId: string | undefined;

const chat = async (message: string) => {
  const response = await opusService.chat({
    dealId,
    message,
    sessionId  // Maintains conversation history
  });
  sessionId = response.sessionId;
  return response;
};
```

### 4. Error Boundaries

Wrap Opus components in error boundaries:

```typescript
<ErrorBoundary fallback={<div>AI analysis unavailable</div>}>
  <AIAgentTab deal={deal} />
</ErrorBoundary>
```

## Testing

### Unit Tests

```typescript
import { opusMockService } from '../services/opus.mock.service';

describe('Opus Integration', () => {
  it('should analyze acquisition deals', async () => {
    const context = createTestContext();
    const result = await opusMockService.analyzeAcquisition(context);
    
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(10);
    expect(result.recommendation).toBeDefined();
  });
});
```

### Integration Tests

Test with small API calls (use mock for bulk testing):

```typescript
// Use real API for smoke test only
opusService.updateConfig({ 
  useMockData: false,
  maxTokens: 500  // Limit cost
});

const result = await opusService.analyzeAcquisition(minimalContext);
expect(result).toBeDefined();
```

## Roadmap

Future enhancements:

1. **Streaming Responses** - Real-time token streaming for better UX
2. **Fine-tuning** - Custom model fine-tuned on historical deal data
3. **Multi-model Support** - Fallback to Claude Sonnet for cost savings
4. **Batch Analysis** - Analyze multiple deals simultaneously
5. **Historical Learning** - Track recommendations vs outcomes
6. **Custom Prompts** - User-defined analysis templates

## Support

For issues or questions:
- Check error messages and console logs
- Review usage metrics for API issues
- Test with mock service first
- Verify API key configuration
- Check data completeness

## Summary

The Opus integration provides:
- ✅ Complete type-safe data contracts
- ✅ Acquisition and performance analysis
- ✅ Conversational chat interface
- ✅ Mock service for development
- ✅ Usage tracking and cost monitoring
- ✅ Error handling and retry logic
- ✅ Comprehensive documentation

Ready to integrate AI-powered deal analysis across all tabs!
