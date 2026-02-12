# Opus AI Integration Guide

**Complete guide to integrating Claude 3 Opus for real estate deal analysis in JEDI RE**

## 📋 Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Architecture](#architecture)
5. [Type System](#type-system)
6. [Service API](#service-api)
7. [Context Builder](#context-builder)
8. [Mock Service](#mock-service)
9. [Integration Examples](#integration-examples)
10. [Configuration](#configuration)
11. [Error Handling](#error-handling)
12. [Cost Management](#cost-management)
13. [Best Practices](#best-practices)

---

## Overview

The Opus integration provides AI-powered deal analysis using Anthropic's Claude 3 Opus model. It analyzes real estate deals across all data dimensions (property specs, financials, market dynamics, competition, supply pipeline, etc.) and provides:

- **Acquisition Analysis**: Buy/pass/hold recommendations with confidence scores
- **Performance Analysis**: Optimization recommendations for owned assets
- **Conversational Chat**: Ask questions about specific deals
- **Risk Assessment**: Comprehensive risk identification and mitigation
- **Opportunity Detection**: Value-add and arbitrage opportunities
- **Action Planning**: Prioritized next steps

### Key Features

✅ Comprehensive deal analysis across all tabs  
✅ Structured JSON responses with type safety  
✅ Streaming support for real-time responses  
✅ Mock service for development without API costs  
✅ Usage tracking and cost monitoring  
✅ Retry logic with exponential backoff  
✅ Context builder for easy data mapping  

---

## Installation

### 1. Install Dependencies

```bash
cd frontend
npm install @anthropic-ai/sdk
```

### 2. Environment Configuration

Add to `.env` (or `.env.local`):

```bash
VITE_ANTHROPIC_API_KEY=sk-ant-api03-...your-key-here
```

**Important**: Never commit API keys to git. The `.env` file should be in `.gitignore`.

### 3. Get an API Key

1. Sign up at [console.anthropic.com](https://console.anthropic.com)
2. Navigate to API Keys
3. Create a new key
4. Copy and paste into `.env`

**Cost Estimate**: Claude 3 Opus costs ~$15/M input tokens, ~$75/M output tokens. Typical analysis uses 2,000-4,000 tokens (~$0.15-$0.30 per analysis).

---

## Quick Start

### Basic Acquisition Analysis

```typescript
import { opusService } from '@/services/opus.service';
import { buildOpusContext } from '@/services/opus.context.builder';
import type { OpusDealContext } from '@/types/opus.types';

// 1. Build context from your deal data
const context = buildOpusContext(deal, {
  comps: competitionComps,
  supplyProjects: pipelineProjects,
  proForma: financialData,
  debtInfo: lendingInfo
});

// 2. Get analysis
try {
  const analysis = await opusService.analyzeAcquisition(context);
  
  console.log('Recommendation:', analysis.recommendation); // 'buy', 'pass', 'hold', etc.
  console.log('Score:', analysis.score); // 0-10
  console.log('Confidence:', analysis.confidence); // 0-100%
  console.log('Key Insights:', analysis.keyInsights);
  console.log('Risks:', analysis.risks);
  console.log('Opportunities:', analysis.opportunities);
  
} catch (error) {
  console.error('Analysis failed:', error);
}
```

### Chat with Opus

```typescript
const response = await opusService.chat({
  dealId: deal.id,
  message: 'What are the biggest risks in this deal?',
  includeContext: true
});

console.log(response.message.content);
console.log('Follow-up suggestions:', response.suggestions);
```

### Using Mock Data (Development)

```typescript
// Enable mock mode - no API key needed
opusService.updateConfig({ useMockData: true });

// Analysis will return realistic mock data
const analysis = await opusService.analyzeAcquisition(context);
```

---

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────┐
│                    UI Components                         │
│  (Deal Analysis Tab, Chat Interface, Risk Dashboard)    │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│              Opus Service Layer                         │
│  • opusService.ts (Main API)                           │
│  • opus.context.builder.ts (Data mapping)              │
│  • opus.mock.service.ts (Development mode)             │
└───────────────────┬─────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌──────────────┐      ┌──────────────────┐
│   Mock Data  │      │  Anthropic API   │
│   Generator  │      │  (Claude Opus)   │
└──────────────┘      └──────────────────┘
```

### Data Flow

1. **Context Building**: Map your Deal object to `OpusDealContext`
2. **Service Call**: Send context to Opus service
3. **API Communication**: Service calls Anthropic API (or mock)
4. **Response Parsing**: Parse AI response into typed result
5. **UI Rendering**: Display analysis, risks, opportunities

---

## Type System

### Core Types

#### OpusDealContext

Complete deal data from all tabs. More data = better analysis.

```typescript
interface OpusDealContext {
  // Required
  dealId: string;
  dealName: string;
  status: 'pipeline' | 'owned';
  
  // Optional - include what you have
  overview?: OverviewData;          // Property specs, metrics, location
  competition?: CompetitionData;     // Comps, market position
  supply?: SupplyData;               // Pipeline projects, impact
  debt?: DebtData;                   // Rates, lending conditions
  financial?: FinancialData;         // Pro forma, projections
  strategy?: StrategyData;           // Investment strategies
  dueDiligence?: DueDiligenceData;  // Checklist, findings
  market?: MarketData;               // Demographics, trends
  team?: TeamData;                   // Stakeholders, communications
  documents?: DocumentData;          // Document inventory
  
  // Metadata
  lastUpdated?: string;
  dataCompleteness?: number; // 0-100%
}
```

#### OpusRecommendationResult

What you get back from analysis.

```typescript
interface OpusRecommendationResult {
  // Core recommendation
  score: number;                    // 0-10
  confidence: number;               // 0-100%
  recommendation: OpusRecommendation;
  reasoning: string;
  executiveSummary?: string;
  
  // Insights
  keyInsights: string[];           // 3-5 critical points
  
  // Detailed analysis
  risks: Risk[];                   // Identified risks with mitigation
  opportunities: Opportunity[];    // Value creation pathways
  actionItems: ActionItem[];       // Prioritized next steps
  
  // Supporting data
  strengths: string[];
  weaknesses: string[];
  assumptions: string[];
  
  // Metadata
  analysisDate: string;
  modelVersion: string;
  tokensUsed?: number;
  processingTime?: number; // milliseconds
}
```

#### OpusRecommendation

```typescript
type OpusRecommendation =
  // Acquisition
  | 'strong-buy'    // Score 8.5+, proceed with conviction
  | 'buy'           // Score 7-8.5, proceed with diligence
  | 'hold'          // Score 5.5-7, needs better terms or data
  | 'pass'          // Score 4-5.5, not attractive
  | 'strong-pass'   // Score <4, significant issues
  
  // Performance
  | 'optimize'      // Implement improvements
  | 'hold-asset'    // Continue current strategy
  | 'sell';         // Divest recommended
```

### Tab Data Types

See `frontend/src/types/opus.types.ts` for complete definitions:

- `OverviewData` - Property specs, metrics, location
- `CompetitionData` - Comps, market position
- `SupplyData` - Pipeline projects, impact analysis
- `DebtData` - Interest rates, lending conditions
- `FinancialData` - Pro forma, projections, sensitivity
- `StrategyData` - Investment strategies, arbitrage
- `DueDiligenceData` - Checklist, findings, red flags
- `MarketData` - Demographics, trends, SWOT
- `TeamData` - Stakeholders, communications
- `DocumentData` - Document inventory

---

## Service API

### OpusService Methods

#### analyzeAcquisition()

Analyze a deal for acquisition decision.

```typescript
async analyzeAcquisition(
  context: OpusDealContext
): Promise<OpusRecommendationResult>
```

**Example:**
```typescript
const result = await opusService.analyzeAcquisition(context);

if (result.recommendation === 'buy' || result.recommendation === 'strong-buy') {
  console.log('✅ Proceed with deal');
  console.log('Score:', result.score);
  console.log('Risks:', result.risks.length);
  console.log('Opportunities:', result.opportunities.length);
}
```

#### analyzePerformance()

Analyze owned asset for optimization.

```typescript
async analyzePerformance(
  context: OpusDealContext
): Promise<OpusRecommendationResult>
```

**Example:**
```typescript
const result = await opusService.analyzePerformance(context);

if (result.recommendation === 'optimize') {
  const topOpportunities = result.opportunities
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);
  
  console.log('Top optimization opportunities:', topOpportunities);
}
```

#### chat()

Conversational interface for deal questions.

```typescript
async chat(request: ChatRequest): Promise<ChatResponse>

interface ChatRequest {
  dealId: string;
  message: string;
  sessionId?: string;        // For conversation continuity
  includeContext?: boolean;  // Include full deal context
  temperature?: number;      // 0-1, default 0.7
  maxTokens?: number;        // Max response length
}
```

**Example:**
```typescript
// Start conversation
const response1 = await opusService.chat({
  dealId: deal.id,
  message: 'What are the key risks?',
  includeContext: true
});

// Continue conversation
const response2 = await opusService.chat({
  dealId: deal.id,
  message: 'How can we mitigate the market risk?',
  sessionId: response1.sessionId
});

console.log(response2.message.content);
console.log('Suggestions:', response2.suggestions);
```

#### clearSession()

Clear chat history.

```typescript
clearSession(sessionId: string): void
```

#### getUsageMetrics()

Track API usage and costs.

```typescript
getUsageMetrics(): OpusUsageMetrics

interface OpusUsageMetrics {
  totalRequests: number;
  totalTokensUsed: number;
  totalCost: number;              // USD
  averageResponseTime: number;    // milliseconds
  errorRate: number;              // percentage
  lastRequest?: string;
}
```

**Example:**
```typescript
const metrics = opusService.getUsageMetrics();
console.log(`Total cost: $${metrics.totalCost.toFixed(2)}`);
console.log(`Tokens used: ${metrics.totalTokensUsed.toLocaleString()}`);
console.log(`Avg response time: ${metrics.averageResponseTime}ms`);
```

#### updateConfig()

Update service configuration.

```typescript
updateConfig(config: Partial<OpusConfig>): void

interface OpusConfig {
  apiKey?: string;
  model: 'claude-opus-4' | 'claude-3-opus-20240229';
  maxTokens: number;
  temperature: number;
  useMockData: boolean;
  enableCaching?: boolean;
  enableStreaming?: boolean;
  retryAttempts?: number;
  timeoutMs?: number;
}
```

**Example:**
```typescript
// Use mock data for development
opusService.updateConfig({ useMockData: true });

// Increase temperature for more creative responses
opusService.updateConfig({ temperature: 0.9 });

// Reduce max tokens to save costs
opusService.updateConfig({ maxTokens: 2048 });
```

---

## Context Builder

The context builder maps your Deal object to the Opus data contract.

### buildOpusContext()

```typescript
function buildOpusContext(
  deal: Deal,
  options?: {
    comps?: any[];
    supplyProjects?: any[];
    debtInfo?: any;
    proForma?: any;
    strategies?: any[];
    ddChecklist?: any[];
    marketData?: any;
    teamMembers?: any[];
    documents?: any[];
  }
): OpusDealContext
```

### Usage Pattern

```typescript
import { buildOpusContext } from '@/services/opus.context.builder';

// Minimal context (just the deal)
const basicContext = buildOpusContext(deal);

// Full context with all tab data
const fullContext = buildOpusContext(deal, {
  comps: await fetchCompetitionData(deal),
  supplyProjects: await fetchSupplyPipeline(deal),
  proForma: deal.financialModel,
  debtInfo: deal.lendingInfo,
  strategies: deal.strategies,
  ddChecklist: deal.dueDiligenceItems,
  marketData: await fetchMarketData(deal.location),
  teamMembers: deal.team,
  documents: deal.documents
});

const analysis = await opusService.analyzeAcquisition(fullContext);
```

### Data Completeness

The context builder automatically calculates data completeness:

```typescript
const context = buildOpusContext(deal, options);
console.log(`Data completeness: ${context.dataCompleteness}%`);

// Low completeness = lower confidence
if (context.dataCompleteness < 40) {
  console.warn('Limited data may reduce analysis quality');
}
```

### Customizing Field Mapping

The context builder includes sensible defaults for field mapping. If your data structure differs, you can:

1. **Modify the builder** - Edit `opus.context.builder.ts`
2. **Manual mapping** - Build context manually

```typescript
// Manual context building
const context: OpusDealContext = {
  dealId: deal.id,
  dealName: deal.name,
  status: deal.isOwned ? 'owned' : 'pipeline',
  overview: {
    propertySpecs: {
      address: deal.propertyAddress,
      propertyType: deal.type,
      units: deal.unitCount,
      // ... map your fields
    },
    metrics: {
      purchasePrice: deal.price,
      capRate: deal.capRate,
      // ... map your fields
    }
  },
  // ... other sections
};
```

---

## Mock Service

The mock service provides realistic responses for development without API costs.

### When to Use Mock Mode

✅ **Use mock mode when:**
- Developing UI without API key
- Testing integration flows
- Avoiding API costs during development
- Creating demos or screenshots
- Running automated tests

❌ **Don't use mock mode when:**
- You need actual AI analysis
- Testing prompt engineering
- Validating real deal analysis
- Production deployment

### Enabling Mock Mode

```typescript
// Global config
opusService.updateConfig({ useMockData: true });

// Or import mock service directly
import { opusMockService } from '@/services/opus.mock.service';

const analysis = await opusMockService.analyzeAcquisition(context);
const chat = await opusMockService.chat(request);
```

### Mock Response Quality

The mock service generates realistic responses based on:

- Deal metrics (cap rate, NOI, etc.)
- Supply impact levels
- Market positioning
- Competition data

Responses include:
- Score calculation based on fundamentals
- Contextual insights referencing actual deal data
- Realistic risks and opportunities
- Proper confidence levels

**Note**: Mock responses are deterministic based on input data patterns, not AI-generated.

---

## Integration Examples

### Example 1: Deal Analysis Page

```typescript
import { useState, useEffect } from 'react';
import { opusService } from '@/services/opus.service';
import { buildOpusContext } from '@/services/opus.context.builder';

function DealAnalysisTab({ deal }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    
    try {
      // Build context from available data
      const context = buildOpusContext(deal, {
        comps: deal.competitionData,
        supplyProjects: deal.supplyPipeline,
        proForma: deal.financials
      });
      
      // Run analysis
      const result = deal.status === 'owned'
        ? await opusService.analyzePerformance(context)
        : await opusService.analyzeAcquisition(context);
      
      setAnalysis(result);
      
    } catch (err) {
      setError(err.message);
      console.error('Analysis failed:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6">
      <button
        onClick={runAnalysis}
        disabled={loading}
        className="btn-primary"
      >
        {loading ? 'Analyzing...' : 'Run AI Analysis'}
      </button>

      {error && (
        <div className="alert-error mt-4">{error}</div>
      )}

      {analysis && (
        <div className="mt-6 space-y-4">
          {/* Score Card */}
          <div className="card">
            <div className="text-4xl font-bold">{analysis.score}/10</div>
            <div className="text-lg">{analysis.recommendation}</div>
            <div className="text-sm text-gray-500">
              {analysis.confidence}% confidence
            </div>
          </div>

          {/* Executive Summary */}
          <div className="card">
            <h3 className="font-bold mb-2">Executive Summary</h3>
            <p>{analysis.executiveSummary}</p>
          </div>

          {/* Key Insights */}
          <div className="card">
            <h3 className="font-bold mb-2">Key Insights</h3>
            <ul className="list-disc pl-5 space-y-1">
              {analysis.keyInsights.map((insight, i) => (
                <li key={i}>{insight}</li>
              ))}
            </ul>
          </div>

          {/* Risks */}
          <div className="card">
            <h3 className="font-bold mb-2">Risks ({analysis.risks.length})</h3>
            {analysis.risks.map(risk => (
              <div key={risk.id} className="mb-3 border-l-4 border-red-500 pl-3">
                <div className="font-semibold">{risk.category}</div>
                <div className="text-sm">{risk.description}</div>
                <div className="text-xs text-gray-500">
                  {risk.level} risk • {risk.probability}% probability
                </div>
                {risk.mitigation && (
                  <div className="text-xs text-gray-600 mt-1">
                    <strong>Mitigation:</strong> {risk.mitigation}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Opportunities */}
          <div className="card">
            <h3 className="font-bold mb-2">
              Opportunities ({analysis.opportunities.length})
            </h3>
            {analysis.opportunities.map(opp => (
              <div key={opp.id} className="mb-3 border-l-4 border-green-500 pl-3">
                <div className="font-semibold">{opp.type}</div>
                <div className="text-sm">{opp.description}</div>
                {opp.potentialValue && (
                  <div className="text-xs text-green-600">
                    Potential value: ${opp.potentialValue.toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Action Items */}
          <div className="card">
            <h3 className="font-bold mb-2">
              Action Items ({analysis.actionItems.length})
            </h3>
            {analysis.actionItems
              .sort((a, b) => {
                const priorityMap = { urgent: 0, high: 1, medium: 2, low: 3 };
                return priorityMap[a.priority] - priorityMap[b.priority];
              })
              .map(item => (
                <div key={item.id} className="mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`badge badge-${item.priority}`}>
                      {item.priority}
                    </span>
                    <span className="font-semibold">{item.action}</span>
                  </div>
                  <div className="text-xs text-gray-500 ml-16">
                    {item.timeframe} • {item.category}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Example 2: Chat Interface

```typescript
import { useState } from 'react';
import { opusService } from '@/services/opus.service';

function OpusChat({ dealId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!input.trim()) return;

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await opusService.chat({
        dealId,
        message: input,
        sessionId,
        includeContext: !sessionId // Include context on first message
      });

      setMessages(prev => [...prev, response.message]);
      setSessionId(response.sessionId);

    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-3 ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask about this deal..."
            className="flex-1 px-4 py-2 border rounded-lg"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="btn-primary"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Example 3: Risk Dashboard

```typescript
function RiskDashboard({ deal }) {
  const [risks, setRisks] = useState([]);

  useEffect(() => {
    async function analyzeRisks() {
      const context = buildOpusContext(deal, {
        // Include relevant data
      });

      const analysis = await opusService.analyzeAcquisition(context);
      
      // Sort risks by priority
      const sortedRisks = analysis.risks
        .sort((a, b) => b.priority - a.priority);
      
      setRisks(sortedRisks);
    }

    analyzeRisks();
  }, [deal.id]);

  // Group by risk level
  const criticalRisks = risks.filter(r => r.level === 'critical');
  const highRisks = risks.filter(r => r.level === 'high');
  const mediumRisks = risks.filter(r => r.level === 'medium');
  const lowRisks = risks.filter(r => r.level === 'low');

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Critical Risks */}
      {criticalRisks.length > 0 && (
        <div className="col-span-2 bg-red-50 border-2 border-red-500 rounded-lg p-4">
          <h3 className="text-red-800 font-bold mb-2">
            ⚠️ Critical Risks ({criticalRisks.length})
          </h3>
          {criticalRisks.map(risk => (
            <RiskCard key={risk.id} risk={risk} />
          ))}
        </div>
      )}

      {/* High Risks */}
      {highRisks.length > 0 && (
        <div className="bg-orange-50 border border-orange-300 rounded-lg p-4">
          <h3 className="text-orange-800 font-bold mb-2">
            High Risks ({highRisks.length})
          </h3>
          {highRisks.map(risk => (
            <RiskCard key={risk.id} risk={risk} />
          ))}
        </div>
      )}

      {/* Medium & Low Risks */}
      {/* ... similar pattern */}
    </div>
  );
}

function RiskCard({ risk }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="font-semibold">{risk.category}</div>
      <div className="text-sm mb-1">{risk.description}</div>
      <div className="text-xs text-gray-600">
        {risk.probability}% probability • {risk.impact} impact
      </div>
      {risk.mitigation && (
        <div className="text-xs mt-2 p-2 bg-white rounded">
          <strong>Mitigation:</strong> {risk.mitigation}
        </div>
      )}
    </div>
  );
}
```

---

## Configuration

### Environment Variables

```bash
# Required for production
VITE_ANTHROPIC_API_KEY=sk-ant-api03-...

# Optional - defaults shown
VITE_OPUS_MODEL=claude-3-opus-20240229
VITE_OPUS_MAX_TOKENS=4096
VITE_OPUS_TEMPERATURE=0.7
VITE_OPUS_TIMEOUT_MS=60000
VITE_OPUS_USE_MOCK=false
```

### Runtime Configuration

```typescript
// At app initialization
opusService.updateConfig({
  model: 'claude-3-opus-20240229',
  maxTokens: 4096,
  temperature: 0.7,
  useMockData: import.meta.env.DEV, // Mock in development
  enableCaching: true,
  retryAttempts: 3,
  timeoutMs: 60000
});
```

### Model Selection

**Claude 3 Opus (`claude-3-opus-20240229`)**
- Most capable model
- Best for complex analysis
- Higher cost (~$15/M input, $75/M output)
- Recommended for production

**Claude Opus 4 (`claude-opus-4`)**
- Newer model (if available)
- Check Anthropic docs for availability

### Temperature Settings

- `0.0-0.3`: Focused, deterministic (good for structured analysis)
- `0.4-0.7`: Balanced (default, recommended)
- `0.8-1.0`: Creative, varied (good for brainstorming)

---

## Error Handling

### Error Types

```typescript
interface OpusError {
  code: OpusErrorCode;
  message: string;
  details?: any;
  timestamp: string;
  retryable: boolean;
}

type OpusErrorCode =
  | 'API_KEY_MISSING'      // No API key configured
  | 'API_ERROR'            // API returned error
  | 'RATE_LIMIT_EXCEEDED'  // Too many requests
  | 'INVALID_REQUEST'      // Bad request data
  | 'TIMEOUT'              // Request timed out
  | 'NETWORK_ERROR'        // Network issue
  | 'INSUFFICIENT_DATA'    // Not enough deal data
  | 'UNKNOWN_ERROR';       // Unexpected error
```

### Handling Errors

```typescript
try {
  const analysis = await opusService.analyzeAcquisition(context);
} catch (error) {
  if (error.code === 'API_KEY_MISSING') {
    // Prompt user to configure API key
    showApiKeySetup();
  } else if (error.code === 'RATE_LIMIT_EXCEEDED') {
    // Wait and retry
    await delay(5000);
    retry();
  } else if (error.code === 'INSUFFICIENT_DATA') {
    // Show warning about data completeness
    showWarning('Please add more deal data for better analysis');
  } else if (error.retryable) {
    // Automatic retry for transient errors
    retry();
  } else {
    // Show error to user
    showError(error.message);
  }
}
```

### Validation Errors

```typescript
// The service validates before calling API
const context: OpusDealContext = {
  dealId: deal.id,
  dealName: deal.name,
  status: 'pipeline'
  // No data provided
};

try {
  await opusService.analyzeAcquisition(context);
} catch (error) {
  // Error: INSUFFICIENT_DATA
  // Message: "Insufficient deal data for analysis. Please provide overview, financial, or competition data."
}
```

---

## Cost Management

### Token Usage

Typical analysis token usage:

| Analysis Type | Input Tokens | Output Tokens | Total | Cost (est.) |
|--------------|--------------|---------------|-------|-------------|
| Basic (minimal data) | 800-1,200 | 500-800 | 1,500 | $0.08 |
| Standard (3-4 tabs) | 1,500-2,500 | 800-1,200 | 3,000 | $0.15 |
| Comprehensive (all tabs) | 3,000-4,500 | 1,200-1,800 | 5,500 | $0.30 |
| Chat message | 200-500 | 300-600 | 700 | $0.04 |

**Note**: Costs based on Claude 3 Opus pricing ($15/M input, $75/M output, blended ~$45/M)

### Monitoring Usage

```typescript
// Check usage periodically
const metrics = opusService.getUsageMetrics();

console.log(`
  Total Requests: ${metrics.totalRequests}
  Total Tokens: ${metrics.totalTokensUsed.toLocaleString()}
  Total Cost: $${metrics.totalCost.toFixed(2)}
  Avg Response Time: ${metrics.averageResponseTime}ms
  Error Rate: ${(metrics.errorRate * 100).toFixed(1)}%
`);

// Set up alerts
if (metrics.totalCost > 100) {
  alert('API costs exceed $100 this month');
}
```

### Cost Optimization Strategies

1. **Use mock mode in development**
   ```typescript
   opusService.updateConfig({ 
     useMockData: import.meta.env.DEV 
   });
   ```

2. **Reduce max tokens**
   ```typescript
   opusService.updateConfig({ maxTokens: 2048 }); // vs 4096
   ```

3. **Include only necessary data**
   ```typescript
   // Instead of full context
   const context = buildOpusContext(deal, {
     // Only include essential tabs
     overview: deal.overview,
     financial: deal.financial
   });
   ```

4. **Cache analyses**
   ```typescript
   // Cache results to avoid re-analysis
   const cacheKey = `analysis-${deal.id}-${deal.lastModified}`;
   let analysis = localStorage.getItem(cacheKey);
   
   if (!analysis) {
     analysis = await opusService.analyzeAcquisition(context);
     localStorage.setItem(cacheKey, JSON.stringify(analysis));
   }
   ```

5. **Batch operations**
   ```typescript
   // Analyze multiple deals in one session
   const analyses = await Promise.all(
     deals.map(deal => opusService.analyzeAcquisition(buildOpusContext(deal)))
   );
   ```

---

## Best Practices

### 1. Data Quality

✅ **Do:**
- Provide as much relevant data as possible
- Keep data up to date (check `lastUpdated`)
- Use actual numbers, not estimates when available
- Include context about market conditions

❌ **Don't:**
- Send incomplete or placeholder data
- Mix units (e.g., thousands vs actual values)
- Include obviously wrong data
- Omit critical information like location or property type

### 2. Context Building

✅ **Do:**
- Use the context builder for consistency
- Check `dataCompleteness` before analysis
- Map all available fields from your data model
- Include metadata (last updated, data sources)

❌ **Don't:**
- Build context manually without checking completeness
- Ignore data validation errors
- Mix different deal versions in same context

### 3. Error Handling

✅ **Do:**
- Always wrap service calls in try-catch
- Check for retryable errors
- Provide user feedback on failures
- Log errors for debugging

❌ **Don't:**
- Ignore errors silently
- Retry indefinitely
- Show technical error messages to users

### 4. Performance

✅ **Do:**
- Cache analysis results when appropriate
- Debounce chat inputs
- Show loading states
- Use mock mode in development

❌ **Don't:**
- Re-analyze on every render
- Make concurrent calls without rate limiting
- Block UI during analysis

### 5. Security

✅ **Do:**
- Store API key in environment variables
- Use server-side API calls if possible (future)
- Validate user input before sending to API
- Monitor usage for anomalies

❌ **Don't:**
- Commit API keys to git
- Expose keys in client-side code
- Send sensitive data unnecessarily
- Allow unlimited user requests

### 6. Testing

✅ **Do:**
- Use mock service for unit tests
- Test with various data completeness levels
- Validate response types
- Test error scenarios

❌ **Don't:**
- Use real API in automated tests
- Assume responses match types without validation
- Skip edge case testing

---

## Troubleshooting

### "API key missing" error

**Problem**: `VITE_ANTHROPIC_API_KEY` not configured

**Solution**:
```bash
# Add to .env
VITE_ANTHROPIC_API_KEY=sk-ant-api03-...

# Restart dev server
npm run dev
```

### "Insufficient data" error

**Problem**: Context doesn't have enough data for analysis

**Solution**:
```typescript
// Check data completeness
const context = buildOpusContext(deal, options);
console.log('Completeness:', context.dataCompleteness);

// Add more tab data
const context = buildOpusContext(deal, {
  overview: getOverviewData(),
  financial: getFinancialData(),
  competition: getCompData()
});
```

### Rate limit errors

**Problem**: Too many requests

**Solution**:
```typescript
// Add delay between requests
await delay(1000);

// Reduce concurrent requests
const analyses = [];
for (const deal of deals) {
  const analysis = await opusService.analyzeAcquisition(context);
  analyses.push(analysis);
  await delay(500); // Rate limit
}
```

### Mock mode not working

**Problem**: `useMockData: true` but still seeing API errors

**Solution**:
```typescript
// Update config at runtime
opusService.updateConfig({ useMockData: true });

// Or use mock service directly
import { opusMockService } from '@/services/opus.mock.service';
const analysis = await opusMockService.analyzeAcquisition(context);
```

### Slow response times

**Problem**: Analysis takes >30 seconds

**Solution**:
```typescript
// Reduce input data size
// Reduce max tokens
opusService.updateConfig({ maxTokens: 2048 });

// Increase timeout
opusService.updateConfig({ timeoutMs: 90000 });
```

---

## Next Steps

1. **Install SDK**: `npm install @anthropic-ai/sdk`
2. **Configure API key**: Add to `.env`
3. **Test with mock mode**: Verify integration
4. **Build UI components**: Analysis displays, chat interface
5. **Switch to real API**: Test with actual deals
6. **Monitor usage**: Track costs and performance
7. **Optimize**: Refine prompts, reduce token usage

---

## Additional Resources

- **Anthropic Documentation**: [docs.anthropic.com](https://docs.anthropic.com)
- **Claude 3 Model Card**: Details on capabilities and pricing
- **Type Definitions**: `frontend/src/types/opus.types.ts`
- **Service Implementation**: `frontend/src/services/opus.service.ts`
- **Mock Service**: `frontend/src/services/opus.mock.service.ts`
- **Context Builder**: `frontend/src/services/opus.context.builder.ts`

---

**Questions or Issues?** 

Check the troubleshooting section or review the service implementation for details.
