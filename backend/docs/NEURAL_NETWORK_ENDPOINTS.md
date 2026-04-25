# Neural Network Endpoints

Complete list of endpoints that power the intelligent real estate analysis.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            NEURAL NETWORK                                   │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │  Data Matrix    │  │ Knowledge Graph │  │ Context Aware   │            │
│  │  /data-matrix   │  │ /knowledge-graph│  │ /context        │            │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘            │
│           │                    │                    │                      │
│           └────────────────────┴────────────────────┘                      │
│                                │                                           │
│                         ┌──────┴──────┐                                    │
│                         │   AGENTS    │                                    │
│                         └─────────────┘                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 1. Data Matrix (`/api/v1/data-matrix`)

Pulls from ALL data sources to create unified deal context.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/context/:dealId` | Full 9-layer context for a deal |
| GET | `/context/from-asset/:assetId` | Context from Data Library asset |
| POST | `/context/from-deal` | Context from deal capsule |
| GET | `/layers` | List available data layers |

**Layers:**
1. PropertyInfo - Municipal APIs
2. RentData - Apartment Locator
3. SalesComps - County records
4. Proximity - Transit, grocery, schools
5. Events - Supply pipeline, employers
6. Backtest - Historical validation
7. Benchmarks - Archive deals
8. Macro - FRED, BLS
9. MarketTrends - Correlation engine

---

## 2. Knowledge Graph (`/api/v1/knowledge-graph`)

Graph-based relationship tracking and impact analysis.

### Nodes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/nodes/:id` | Get node with staleness info |
| GET | `/nodes?type=Property` | List nodes by type |
| POST | `/nodes` | Create/update node |

**Node Types:** Property, Deal, Market, Submarket, Owner, Event, Metric, Document, Agent, POI, Route, Employer, Permit, Sale

### Edges

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/nodes/:id/edges` | Get edges for a node |
| POST | `/edges` | Create edge between nodes |

**Edge Types:** COMP_OF, NEAR, AFFECTS, OWNS, IN_MARKET, IN_SUBMARKET, CORRELATES_WITH, EXTRACTED_FROM, ANALYZED_BY, SIMILAR_TO

### Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/impact/:nodeId` | **Blast radius analysis** - What's affected? |
| POST | `/search` | **Hybrid search** - Text + semantic |
| POST | `/traverse` | Walk the graph from a node |
| GET | `/communities` | Detect property clusters |
| GET | `/staleness` | Data freshness stats |
| GET | `/stale-nodes` | Nodes needing refresh |

### Ingestion

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ingest/property` | Add property to graph |
| POST | `/ingest/event` | Add market event to graph |

---

## 3. Context Awareness (`/api/v1/context`)

The brain that thinks like a real estate analyst.

### Core

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/analyze` | **Main endpoint** - Analyze current UI context |
| POST | `/gaps` | Get detailed data gaps |
| POST | `/trigger-research` | Queue agent tasks to fill gaps |

### Supply Pipeline Expansion

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/supply-pipeline/:marketId` | **Full pipeline details** |

Returns:
- Individual projects with specs
- Breakdown by submarket
- Breakdown by quarter
- Breakdown by developer
- Breakdown by class
- Data gaps to fill

### Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/what-if` | Scenario analysis |
| GET | `/analyst-questions/:context` | What would an analyst ask? |

---

## 4. Inflation Engine (`/api/v1/inflation`)

Construction cost and inflation tracking.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/composite` | Get JCIS composite score |
| GET | `/composite/history` | Historical JCIS |
| POST | `/rent-recommendation` | AI rent growth recommendation |
| POST | `/expense-recommendation` | AI expense escalation recommendation |
| POST | `/regime` | Current inflation regime |
| GET | `/market-basket/items` | Market basket items |
| GET | `/market-basket/prices/:market` | Market basket prices |
| POST | `/replacement-cost/v2` | Replacement cost estimate |
| GET | `/replacement-cost/v2/regional/:city/:state` | Regional cost factor |

---

## 5. Columns Catalog (`/api/v1/columns`)

Powers the F4 Markets data grid.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/catalog` | Available metrics with stats |
| GET | `/insights` | Driver analysis insights |
| GET | `/grid-data` | Time series data for metrics |

---

## 6. Proximity (`/api/v1/proximity`)

Location intelligence.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/score/:latitude/:longitude` | Proximity score |
| GET | `/pois` | Points of interest |
| GET | `/transit` | Transit options |

---

## 7. Agents (`/api/v1/agents`)

AI agent orchestration.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/:agentId/run` | Run an agent |
| GET | `/runs/:runId` | Get run status |
| GET | `/chat` | Agent chat interface |

**Agent Types:** cashflow, research, supply, zoning, strategy, revenue, commentary

---

## Frontend Integration

### Hook Example

```typescript
// hooks/useContextAwareness.ts
import { useState } from 'react';
import api from '../services/api';

export function useContextAnalysis() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const analyze = async (focus: {
    context: string;
    marketId?: string;
    submarketId?: string;
    focusedMetric?: string;
    focusedValue?: any;
  }) => {
    setLoading(true);
    const res = await api.post('/context/analyze', focus);
    setAnalysis(res.data);
    setLoading(false);
    return res.data;
  };

  return { analysis, loading, analyze };
}

export function useSupplyExpansion(marketId: string) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const expand = async (submarketId?: string) => {
    setLoading(true);
    const params = submarketId ? `?submarketId=${submarketId}` : '';
    const res = await api.get(`/context/supply-pipeline/${marketId}${params}`);
    setData(res.data);
    setLoading(false);
    return res.data;
  };

  return { data, loading, expand };
}
```

### Component Example

```tsx
// F4MarketsView supply cell
const SupplyMetricCell = ({ value, marketId, submarketId }) => {
  const { data, loading, expand } = useSupplyExpansion(marketId);
  const [showPanel, setShowPanel] = useState(false);

  const handleClick = async () => {
    await expand(submarketId);
    setShowPanel(true);
  };

  return (
    <div onClick={handleClick} className="cursor-pointer hover:bg-blue-50">
      <span className="font-mono">{value.toLocaleString()}</span>
      <span className="text-xs text-gray-500 ml-1">units</span>
      
      {showPanel && data && (
        <SupplyExpansionPanel 
          data={data}
          onClose={() => setShowPanel(false)}
          onTriggerResearch={(gaps) => api.post('/context/trigger-research', { gaps })}
        />
      )}
    </div>
  );
};
```

---

## Data Flow Example

When user sees "Midtown: 2,400 units under construction" and clicks:

```
1. onClick → POST /api/v1/context/analyze
   {
     context: 'supply_pipeline',
     submarketId: 'midtown',
     focusedMetric: 'units_under_construction',
     focusedValue: 2400
   }

2. Response:
   {
     immediateQuestions: [
       { question: "Where exactly are these projects?", available: false },
       { question: "When do they deliver?", available: false }
     ],
     gaps: [
       { userQuestion: "What are the delivery dates?", relevance: "critical" }
     ],
     suggestions: [
       { type: "drill_down", title: "View Development Projects" }
     ],
     agentTasks: [
       { agentType: "supply", task: "Fetch permit data", priority: "immediate" }
     ]
   }

3. User clicks "View Details" → GET /api/v1/context/supply-pipeline/atlanta?submarketId=midtown

4. Response:
   {
     totalUnits: 2400,
     projects: [
       { name: "Midtown Towers", units: 350, developer: "Greystar", delivery: "Q3 2026" },
       { name: "Peachtree Residences", units: 280, developer: "AvalonBay", delivery: "Q2 2026" }
       // ...
     ],
     byQuarter: { "Q2 2026": 850, "Q3 2026": 1100, "Q1 2027": 450 },
     byDeveloper: { "Greystar": 650, "AvalonBay": 480 },
     gaps: [
       { userQuestion: "3 projects missing delivery dates", relevance: "critical" }
     ]
   }

5. Frontend renders expansion panel with full details

6. Background: Supply agent fetches fresh permit data

7. 30 seconds later: Data refreshed, gaps filled
```

---

## Migrations Required

Run these in Replit:

```sql
-- Knowledge Graph tables
\i backend/src/database/migrations/20260425_knowledge_graph.sql

-- Development Projects table
\i backend/src/database/migrations/20260425_development_projects.sql

-- Data Library Cost Data (for replacement cost)
\i backend/src/database/migrations/20260424_data_library_cost_data.sql

-- Inflation Engine tables
\i backend/src/database/migrations/20260424_inflation_engine.sql
```

---

## Status

| Component | Routes | Service | Migration | Frontend |
|-----------|--------|---------|-----------|----------|
| Data Matrix | ✅ | ✅ | ✅ | 🔲 |
| Knowledge Graph | ✅ | ✅ | ✅ | 🔲 |
| Context Awareness | ✅ | ✅ | ✅ | 🔲 |
| Inflation Engine | ✅ | ✅ | ✅ | 🔲 |
| Columns Catalog | ✅ | ✅ | ✅ | 🔲 |
| Development Projects | - | - | ✅ | 🔲 |

**Next:** Build frontend components to consume these endpoints.
