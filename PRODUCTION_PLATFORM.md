# JediRe Production Platform Guide

**B + C + D Implementation: Production Hardening + Real Pipeline Testing + Agent Intelligence**

## 🎯 What We Built

This guide covers the complete production-ready platform with:
- **B: Production Hardening** - Error logging, monitoring, validation
- **C: Real Pipeline Testing** - Batch processing, reporting, scale testing  
- **D: Agent Intelligence** - Weighted scoring, recommendations, ranking

---

## 📊 C: Real Pipeline Testing

### Batch Analysis Tool

**Purpose:** Run all 3 agents on multiple deals and generate comprehensive reports.

**Usage:**
```bash
cd /home/leon/clawd/jedire

# Analyze all deals (default: 25)
node batch-analyze-deals.js

# Analyze specific number
node batch-analyze-deals.js 10

# Analyze all deals
node batch-analyze-deals.js 100
```

**Output:**
```
🚀 JediRe Batch Deal Analysis
================================

Fetching up to 25 deals...
✓ Found 25 deals

[1/25] 📊 Analyzing: Highlands at Satellite
   Address: 2789 Satellite Blvd, Duluth, GA 30096
   Status: closed_won | Type: multifamily
   ✓ Submitted 3 tasks
   ✅ zoning: completed (245ms)
   ✅ supply: completed (8ms)
   ✅ cashflow: completed (4ms)

[2/25] 📊 Analyzing: East Atlanta Village Townhomes
...

================================
✨ Batch Analysis Complete

📄 Full report saved: reports/batch-analysis-2026-03-08T17-45-00.json
📊 Summary:
   Total Deals: 25
   ✅ Successful: 23
   ❌ Failed: 2

   Agent Performance:
   zoning: 22/25 (88.0%)
   supply: 25/25 (100.0%)
   cashflow: 24/25 (96.0%)
```

**Report Structure:**
```json
[
  {
    "dealId": "uuid",
    "dealName": "Atlanta Development",
    "address": "1950 Piedmont Circle NE...",
    "projectType": "multifamily",
    "status": "active",
    "budget": 78000000,
    "targetUnits": 300,
    "analysisTimestamp": "2026-03-08T17:45:00.000Z",
    "agents": {
      "zoning": {
        "status": "completed",
        "executionTimeMs": 234,
        "output": { ... }
      },
      "supply": {
        "status": "completed",
        "executionTimeMs": 8,
        "output": { ... }
      },
      "cashflow": {
        "status": "completed",
        "executionTimeMs": 4,
        "output": { ... }
      }
    }
  }
]
```

---

## 🛡️ B: Production Hardening

### 1. Analysis Logging

**Purpose:** Track every agent run with structured logging and performance metrics.

**Setup:**
```sql
-- Run the migration
psql $DATABASE_URL -f create-analysis-logs-table.sql
```

**Integration:**
```typescript
import { AnalysisLoggerService } from './services/analysis-logger.service';

const logger = new AnalysisLoggerService();

// Log analysis start
await logger.logAnalysis({
  dealId: 'uuid',
  dealName: 'Atlanta Development',
  agentType: 'zoning_analysis',
  taskId: 'task-uuid',
  status: 'started',
  inputData: { ... },
});

// Log completion
await logger.logAnalysis({
  dealId: 'uuid',
  agentType: 'zoning_analysis',
  taskId: 'task-uuid',
  status: 'completed',
  executionTimeMs: 234,
  outputData: { ... },
});
```

**Query Performance:**
```typescript
// Get deal analysis history
const stats = await logger.getDealAnalysisStats('deal-uuid');

// Get global agent metrics
const metrics = await logger.getAgentPerformanceMetrics(7); // last 7 days

// Get recent errors
const errors = await logger.getRecentErrors(20);
```

**Example Metrics Output:**
```json
[
  {
    "agent_type": "zoning_analysis",
    "total_runs": 156,
    "successful": 142,
    "failed": 14,
    "avg_execution_ms": 245,
    "min_execution_ms": 180,
    "max_execution_ms": 520,
    "median_execution_ms": 230
  },
  {
    "agent_type": "supply_analysis",
    "total_runs": 156,
    "successful": 156,
    "failed": 0,
    "avg_execution_ms": 8
  }
]
```

### 2. Error Tracking

**Recent Errors Query:**
```typescript
const errors = await logger.getRecentErrors(20);
```

**Output:**
```json
[
  {
    "deal_id": "uuid",
    "deal_name": "Failed Deal Name",
    "agent_type": "zoning_analysis",
    "task_id": "task-uuid",
    "error_message": "Lot size required for analysis",
    "input_data": {},
    "created_at": "2026-03-08T17:30:00.000Z"
  }
]
```

**Action Items:**
- Review errors daily
- Fix common failure patterns
- Update deal data to resolve blockers

---

## 🧠 D: Agent Intelligence Upgrade

### 1. Weighted Scoring System

**Purpose:** Rank deals using customizable weighted criteria.

**Usage:**
```typescript
import { DealScoringService } from './services/deal-scoring.service';

const scorer = new DealScoringService();

// Score a single deal
const score = scorer.calculateScore({
  zoning: {
    opportunityScore: 75,
    maxUnits: 250,
    confidenceScore: 85,
  },
  supply: {
    opportunityScore: 82,
    absorptionRate: 22.5,
    vacancyRate: 0.048,
    avgDaysOnMarket: 28,
  },
  cashflow: {
    opportunityScore: 88,
    cashOnCashReturn: 14.2,
    monthlyCashFlow: 125000,
  },
  location: {
    city: 'Atlanta',
    stateCode: 'GA',
  },
});

console.log(score);
```

**Output:**
```json
{
  "totalScore": 82.5,
  "componentScores": {
    "zoning": 85,
    "supply": 87,
    "cashflow": 93,
    "location": 70
  },
  "recommendation": "strong_buy",
  "confidenceLevel": "high",
  "reasoning": [
    "✓ Strong zoning: 250 units permitted",
    "✓ Hot market: 22.5 units/mo absorption",
    "✓ Excellent returns: 14.2% cash-on-cash",
    "✓ Strong market: Atlanta, GA"
  ]
}
```

### 2. Custom Weighting

**Default Weights:**
- **Cash Flow:** 40% (most important)
- **Zoning:** 25%
- **Supply:** 25%
- **Location:** 10%

**Custom Weights:**
```typescript
const score = scorer.calculateScore(analysisData, {
  cashflow: 0.50,  // Prioritize cash flow even more
  zoning: 0.20,
  supply: 0.20,
  location: 0.10,
});
```

### 3. Deal Ranking

**Rank Multiple Deals:**
```typescript
const rankedDeals = scorer.rankDeals([
  { dealId: 'uuid-1', analysisData: { ... } },
  { dealId: 'uuid-2', analysisData: { ... } },
  { dealId: 'uuid-3', analysisData: { ... } },
]);

console.log(rankedDeals);
```

**Output:**
```json
[
  {
    "dealId": "uuid-2",
    "score": {
      "totalScore": 85.2,
      "recommendation": "strong_buy"
    }
  },
  {
    "dealId": "uuid-1",
    "score": {
      "totalScore": 72.1,
      "recommendation": "buy"
    }
  },
  {
    "dealId": "uuid-3",
    "score": {
      "totalScore": 48.5,
      "recommendation": "pass"
    }
  }
]
```

### 4. Scoring Logic

**Zoning Score:**
- Base: opportunityScore from agent
- +10-20: High unit density potential
- +5: High confidence data

**Supply Score:**
- Base: opportunityScore from agent
- +15: Strong absorption (>20 units/mo)
- +10: Low vacancy (<5%)
- +10: Fast sales (<30 days on market)

**Cashflow Score (Most Important):**
- Base: opportunityScore from agent
- +25: Excellent CoC return (>12%)
- +15: Good CoC return (>8%)
- +5: Acceptable CoC return (>5%)
- -30: Negative cash flow

**Location Score:**
- Base: 50 (neutral)
- +20: Premium markets (Atlanta, Austin, Nashville, etc.)
- +10: Sun Belt states (GA, TX, FL, AZ, NC, SC, TN)

**Recommendation Thresholds:**
- **Strong Buy:** Score ≥80 + positive cash flow
- **Buy:** Score ≥65 + positive cash flow
- **Hold:** Score ≥50 + positive cash flow
- **Pass:** Score <50 or negative cash flow

---

## 🚀 Complete Workflow

### 1. Populate Data Layer
```bash
psql $DATABASE_URL -f populate-market-data.sql
psql $DATABASE_URL -f populate-zoning-data.sql
psql $DATABASE_URL -f create-analysis-logs-table.sql
```

### 2. Run Batch Analysis
```bash
node batch-analyze-deals.js 25
```

### 3. Review Results
```bash
# View JSON reports
cat reports/batch-analysis-*.json | less

# View summary
cat reports/summary-*.json
```

### 4. Score and Rank Deals
```typescript
// In your application
import { DealScoringService } from './services/deal-scoring.service';
import fs from 'fs';

const scorer = new DealScoringService();
const reportData = JSON.parse(fs.readFileSync('reports/batch-analysis-latest.json'));

const rankedDeals = reportData
  .filter(deal => deal.agents && !deal.error)
  .map(deal => ({
    dealId: deal.dealId,
    dealName: deal.dealName,
    score: scorer.calculateScore({
      zoning: deal.agents.zoning?.output,
      supply: deal.agents.supply?.output,
      cashflow: deal.agents.cashflow?.output,
      location: { city: deal.address?.split(',')[1]?.trim(), stateCode: 'GA' },
    }),
  }))
  .sort((a, b) => b.score.totalScore - a.score.totalScore);

console.log('🏆 Top 5 Deals:');
rankedDeals.slice(0, 5).forEach((deal, i) => {
  console.log(`${i+1}. ${deal.dealName} - ${deal.score.totalScore} (${deal.score.recommendation})`);
  deal.score.reasoning.forEach(r => console.log(`   ${r}`));
});
```

### 5. Monitor Performance
```typescript
import { AnalysisLoggerService } from './services/analysis-logger.service';

const logger = new AnalysisLoggerService();

// Daily metrics review
const metrics = await logger.getAgentPerformanceMetrics(7);
console.table(metrics);

// Error analysis
const errors = await logger.getRecentErrors(50);
const errorsByType = {};
errors.forEach(e => {
  errorsByType[e.error_message] = (errorsByType[e.error_message] || 0) + 1;
});
console.log('Common Errors:', errorsByType);
```

---

## 📈 Key Metrics to Track

### Agent Performance:
- **Success Rate:** % of completed vs failed tasks
- **Execution Time:** avg/min/max/median per agent
- **Error Patterns:** Common failure reasons

### Deal Quality:
- **Score Distribution:** How many deals in each bucket?
- **Recommendation Mix:** Strong buy vs pass ratio
- **Top Performers:** Which deals score highest?

### Data Quality:
- **Missing Fields:** Which deals lack lot_size, budget, etc.?
- **Geocoding Success:** % of addresses successfully geocoded
- **Market Coverage:** Which cities have supply data?

---

## 🎯 Next Steps

### Short Term (This Week):
1. ✅ Run batch analysis on all 25 deals
2. ✅ Review error patterns and fix data issues
3. ✅ Score and rank top 10 deals
4. ✅ Set up daily performance monitoring

### Medium Term (This Month):
1. Expand market data (6-12 months historical)
2. Add more cities (Decatur, Marietta, Sandy Springs)
3. Integrate Census API for demographics
4. Build automated email reports

### Long Term (This Quarter):
1. External API integrations (CoStar, Zillow)
2. Machine learning for predictive scoring
3. Automated deal sourcing pipeline
4. Real-time market alerts

---

## 🔧 Troubleshooting

**Agent Failures:**
- Check `analysis_logs` table for error patterns
- Review `agent_tasks` table for retry counts
- Verify deal data completeness (lot_size, address, budget)

**Low Scores:**
- Review component scores - which is dragging it down?
- Check if weights match your investment strategy
- Verify agent outputs are complete

**Performance Issues:**
- Monitor execution times in `analysis_logs`
- Check database indexes
- Review API rate limits (Mapbox, etc.)

**Data Quality:**
- Run validation queries on deals table
- Check for NULL required fields
- Verify market_inventory has recent data

---

## 📚 Files Reference

```
jedire/
├── batch-analyze-deals.js              # Batch analysis script
├── create-analysis-logs-table.sql      # Logging infrastructure
├── populate-market-data.sql            # Market data
├── populate-zoning-data.sql            # Zoning districts
├── PRODUCTION_PLATFORM.md              # This guide
├── jedire/backend/src/services/
│   ├── analysis-logger.service.ts      # Logging service
│   ├── deal-scoring.service.ts         # Scoring engine
│   └── deal-import.service.ts          # Import pipeline
└── reports/                            # Generated reports
    ├── batch-analysis-*.json
    └── summary-*.json
```

---

**Status: PRODUCTION READY** ✅

All systems operational for B + C + D implementation!
