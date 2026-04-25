# Neural Network Buildout Plan

## Goal
Complete the intelligent data layer that makes JediRe "think like a real estate analyst."

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                  │
│  F4 Markets Grid │ Deal Detail │ Property Card │ Market Dashboard           │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │ click on metric
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CONTEXT AWARENESS LAYER                              │
│  "What is the user looking at? What questions would an analyst ask?"        │
│  → Immediate questions, data gaps, suggestions, agent tasks                 │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│   KNOWLEDGE GRAPH   │ │    DATA MATRIX      │ │   EXPANSION PANELS  │
│   Relationships     │ │    9 Data Layers    │ │   Detailed Views    │
│   Impact Analysis   │ │    Unified Context  │ │   Supply, Rent, etc │
└─────────────────────┘ └─────────────────────┘ └─────────────────────┘
              │                   │                   │
              └───────────────────┼───────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AGENT LAYER                                     │
│  Research │ Supply │ Zoning │ CashFlow │ Commentary │ Revenue               │
│  Auto-triggered when gaps detected, fill data autonomously                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Core Wiring (DONE ✅)

- [x] Knowledge Graph service + routes
- [x] Context Awareness service + routes  
- [x] Data Matrix service + routes
- [x] Development Projects table
- [x] Frontend hooks (useContextAwareness)
- [x] Frontend components (SupplyExpansionPanel, SmartMetricCell, ContextIndicator)

---

## Phase 2: Frontend Integration

### 2.1 Wire F4 Markets View
Replace static cells with SmartMetricCell components.

**File:** `frontend/src/pages/terminal/F4MarketsView.tsx`

**Changes:**
- Import SmartMetricCell components
- Replace supply column with SupplyMetricCell
- Replace rent column with RentMetricCell
- Replace occupancy column with OccupancyMetricCell
- Add ContextIndicator at top of view

### 2.2 Wire Deal Detail Page
Add context awareness to deal sections.

**File:** `frontend/src/pages/DealDetailPage.tsx`

**Changes:**
- Add useAutoContextAnalysis hook
- Show ContextIndicator in each section
- Enable drill-down on key metrics

### 2.3 Wire Market Dashboard
Add expansion panels to market stats.

**File:** `frontend/src/components/dashboard/MarketStatsWidget.tsx`

**Changes:**
- Wrap metrics in SmartMetricCell
- Enable supply pipeline expansion

---

## Phase 3: Agent Gap-Filling

### 3.1 Auto-Trigger Research
When context analysis finds gaps, auto-queue agent tasks.

**File:** `backend/src/services/neural-network/context-awareness.service.ts`

**Add:**
- triggerResearchForGaps() method
- Queue to Inngest for background processing
- Priority levels: immediate, background, scheduled

### 3.2 Wire Agents to Graph
When agents find data, update the knowledge graph.

**Files:**
- `backend/src/agents/research.inngest.ts`
- `backend/src/agents/supply.inngest.ts`

**Add:**
- After successful run, call knowledgeGraph.ingestProperty() or ingestEvent()
- Create edges between discovered entities

### 3.3 Staleness Refresh
Periodically check for stale nodes and refresh.

**File:** `backend/src/services/neural-network/scheduled-refresh.ts` (NEW)

**Add:**
- Cron job to check staleness
- Queue refresh tasks for stale nodes
- Priority based on usage frequency

---

## Phase 4: Embeddings Pipeline

### 4.1 Generate Embeddings on Ingest
When nodes are created, generate embeddings.

**File:** `backend/src/services/neural-network/embeddings.service.ts` (NEW)

**Add:**
- generateEmbedding() using OpenAI or local model
- Store in kg_embeddings_cache table
- Batch processing for efficiency

### 4.2 Semantic Search
Enable natural language queries across the graph.

**File:** `backend/src/services/neural-network/knowledge-graph.service.ts`

**Enhance:**
- hybridSearch() to use real embeddings
- Combine with BM25 text search
- Reciprocal rank fusion for results

---

## Phase 5: Property Auto-Ingestion

### 5.1 Ingest on Property Create
When properties are added, auto-create graph nodes.

**File:** `backend/src/api/rest/property.routes.ts`

**Add:**
- After property creation, call knowledgeGraph.ingestProperty()
- Create edges to market, submarket, nearby properties

### 5.2 Ingest on Deal Create
When deals are created, add to graph with relationships.

**File:** `backend/src/api/rest/capsule.routes.ts`

**Add:**
- After capsule creation, create Deal node
- Link to Property node
- Link to Market/Submarket nodes

### 5.3 Event Listener Pattern
Create event-driven ingestion.

**File:** `backend/src/services/neural-network/graph-ingestion-listener.ts` (NEW)

**Add:**
- Listen for property.created, deal.created, etc.
- Auto-ingest to graph
- Handle batch events efficiently

---

## Execution Order

### Batch 1: Frontend Wiring (Can parallelize)
1. F4MarketsView.tsx - SmartMetricCell integration
2. DealDetailPage.tsx - Context awareness
3. MarketStatsWidget.tsx - Expansion panels

### Batch 2: Agent Integration
4. context-awareness.service.ts - triggerResearchForGaps()
5. research.inngest.ts - Graph updates
6. supply.inngest.ts - Graph updates

### Batch 3: Background Services
7. scheduled-refresh.ts - Staleness cron
8. embeddings.service.ts - Embedding generation
9. graph-ingestion-listener.ts - Event-driven ingestion

---

## DeepSeek Execution Tasks

Each task below is self-contained and can be executed by DeepSeek:

### Task 1: F4MarketsView SmartMetricCell Integration
```
File: frontend/src/pages/terminal/F4MarketsView.tsx
Action: 
1. Add imports for SmartMetricCell, SupplyMetricCell, RentMetricCell, OccupancyMetricCell
2. Find the grid column definitions
3. Replace supply column render with <SupplyMetricCell units={value} marketId={row.marketId} />
4. Replace rent column render with <RentMetricCell rent={value} marketId={row.marketId} />
5. Replace occupancy column render with <OccupancyMetricCell occupancy={value} marketId={row.marketId} />
```

### Task 2: DealDetailPage Context Awareness
```
File: frontend/src/pages/DealDetailPage.tsx
Action:
1. Add import for useAutoContextAnalysis, ContextIndicator
2. Add hook: const { analysis, loading } = useAutoContextAnalysis({ context: 'deal_overview', dealId })
3. Add <ContextIndicator analysis={analysis} loading={loading} /> at top of page
```

### Task 3: Context Awareness Gap Trigger
```
File: backend/src/services/neural-network/context-awareness.service.ts
Action:
1. Add method triggerResearchForGaps(gaps: DataGap[], priority: string)
2. For each gap, determine which agent can fill it
3. Queue via Inngest: inngest.send({ name: 'agent/research', data: { task, priority } })
```

### Task 4: Research Agent Graph Integration
```
File: backend/src/agents/research.inngest.ts
Action:
1. Import KnowledgeGraphService
2. After successful research, call:
   - knowledgeGraph.ingestProperty() for property data
   - knowledgeGraph.createEdge() for relationships discovered
```

### Task 5: Supply Agent Graph Integration
```
File: backend/src/agents/supply.inngest.ts
Action:
1. Import KnowledgeGraphService
2. After finding development projects, call:
   - knowledgeGraph.ingestEvent() for each project
   - Create AFFECTS edges to nearby properties
```

### Task 6: Scheduled Refresh Service
```
File: backend/src/services/neural-network/scheduled-refresh.ts (NEW)
Action:
1. Create service that queries stale nodes
2. Group by type and priority
3. Queue refresh tasks to appropriate agents
4. Run on cron: every 6 hours
```

### Task 7: Embeddings Service
```
File: backend/src/services/neural-network/embeddings.service.ts (NEW)
Action:
1. Create EmbeddingsService class
2. generateEmbedding(text: string) - call OpenAI or use local model
3. batchGenerate(texts: string[]) - efficient batch processing
4. cacheEmbedding(nodeId, embedding) - store in kg_embeddings_cache
```

### Task 8: Graph Ingestion Listener
```
File: backend/src/services/neural-network/graph-ingestion-listener.ts (NEW)
Action:
1. Create listener for events: property.created, deal.created, sale.recorded
2. On event, call appropriate ingest method
3. Create edges to related entities
4. Handle errors gracefully
```

---

## Success Criteria

When complete, the system should:

1. **Click any metric** → Shows expansion panel with details
2. **Gaps detected** → Agents auto-triggered to fill them
3. **Data added** → Auto-ingested to knowledge graph
4. **Natural language search** → Find anything via semantic search
5. **Impact analysis** → "What affects this property?" answered instantly
6. **Staleness tracked** → Old data flagged and refreshed

---

## Cost Estimate (DeepSeek Execution)

| Task | Estimated Tokens | Cost |
|------|------------------|------|
| 8 tasks × ~2000 tokens each | 16,000 | ~$0.02 |

Total buildout via DeepSeek: **Under $0.05**

vs Claude Sonnet: ~$0.50

**10x savings** ✅
