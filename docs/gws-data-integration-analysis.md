# GWS Data Integration Analysis
## Data Architecture for Agent Training & Context

**Generated:** 2026-03-07  
**Status:** Architecture Review  
**Priority:** P0 — Foundation for M28 Implementation

---

## 📊 Current Data Architecture

### Existing Data Sources

#### 1. **Data Library** (`data_library_files` table)
```typescript
interface DataLibraryFile {
  id: number;
  user_id: string;
  file_name: string;
  file_path: string;
  parsed_data: any;        // CSV preview with headers/rows
  city: string;
  zip_code: string;
  property_type: string;
  unit_count: number;
  source_type: string;     // 'owned' | 'public' | 'third_party'
  tags: string[];          // ['impact_fees', 'construction', 'rent']
  parsing_status: string;  // 'pending' | 'parsing' | 'complete' | 'error'
}
```

**Current Capabilities:**
- Upload CSV/Excel/PDF files
- Tag-based categorization (impact_fees, construction, rent)
- City/property-type filtering
- Basic CSV parsing (headers + preview rows)
- Comparable matching by city/property type

**Limitations:**
- No semantic search (keyword matching only)
- No cross-file relationship mapping
- Excel/PDF parsing incomplete ("requires_xlsx_parser", "requires_pdf_parser")
- No structured extraction from PDFs (OMs, T12s, rent rolls)
- No versioning or update tracking

#### 2. **Benchmark Projects** (`benchmark_projects` table)
```sql
SELECT project_name, project_type, unit_count, entitlement_type,
       density_achieved, address, application_date, approval_date
FROM benchmark_projects
WHERE municipality ILIKE 'Atlanta'
```

**Current Capabilities:**
- Historical entitlement project data
- Permit timeline aggregation
- Density achievement tracking
- Jurisdiction-specific filtering

**Limitations:**
- Static data (manual entry or batch import)
- No auto-update mechanism
- Missing: zoning outcomes, variance details, cost data

#### 3. **Agent Task Context** (via `DataLibraryContextService`)
```typescript
interface DataLibraryContext {
  impactFees: Array<{description, amount, source}>;
  constructionCosts: Array<{description, amount, source}>;
  rentComps: Array<{description, amount, source}>;
  permitTimelines: Array<{description, duration, source}>;
  recentProjects: Array<{name, type, units, timelineDays}>;
  costSummary: string;
}
```

**How Agents Currently Get Context:**
1. Task submitted with `{dealId, municipality, propertyType}`
2. `DataLibraryContextService.getContextForDeal()` queries:
   - Data Library files matching city + tags
   - Benchmark projects in jurisdiction
   - Permit timeline aggregates
3. Returns structured context object
4. Agent receives this + task-specific `inputData`

**Problem:** Context is **pull-based** and **keyword-matched**. Agents don't "learn" from data — they get filtered subsets on each execution.

---

## 🚨 The Training Problem

### What "Training" Means for Agents

**Current Reality:**
- Agents are **stateless** — no memory between tasks
- Each execution gets **fresh context** via database queries
- No pattern recognition across historical tasks
- No feedback loop from outcomes

**What We Actually Need:**
1. **Semantic Search:** "Find similar deals to Atlanta 300-unit midrise" → retrieve OMs, T12s, rent rolls from past deals
2. **Cross-Source Correlation:** Link email OM → Drive rent roll → Sheets comp database → Benchmark project
3. **Historical Learning:** "Last 5 zoning analyses in this jurisdiction had X outcome — adjust confidence"
4. **Data Quality Validation:** "This T12's OpEx ratio is 45% — flag as outlier, request human review"
5. **Schema Alignment:** Normalize "NOI" from T12 vs "Net Operating Income" from OM vs "Annual NOI" from broker email

### GWS Integration Amplifies This Problem

**New Data Sources (M28):**
- **Gmail:** 50-200 broker emails/day with OMs, T12s, rent rolls
- **Drive:** 20-50 new/modified documents/day (market reports, deal docs)
- **Sheets:** Live comp databases (user-maintained, frequently updated)
- **Calendar:** DD timelines synced to deal stages

**Total Data Ingestion:** ~100-300 new documents/day across 4 Google services + existing Data Library uploads

**Questions:**
1. How do agents **discover** which Drive folder has the rent survey for Atlanta?
2. How do agents **validate** that the T12 from Gmail matches the property in the Deal Capsule?
3. How do agents **prioritize** which data source to trust when there's conflicting info?
4. How do agents **remember** patterns like "CBRE OMs overestimate rent by 8% on average"?

---

## 🏗️ Proposed: Unified Data Intelligence Layer

### Architecture: Add L2.5 — Intelligence Context Engine

```
┌────────────────────────────────────────────────────────────┐
│ L1 — PRESENTATION LAYER                                     │
│ (GWS Settings, Inbox Widget, Document Viewer)              │
└────────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────────┐
│ L2 — API GATEWAY                                            │
│ (GWS Router, Rate Limiter, Auth Middleware)                │
└────────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────────┐
│ L2.5 — INTELLIGENCE CONTEXT ENGINE (NEW)                   │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ • Vector Embeddings (OpenAI/local)                    │  │
│ │ • Semantic Search (pgvector)                          │  │
│ │ • Cross-Source Linking (doc_relationships table)      │  │
│ │ • Data Quality Scoring (anomaly detection)            │  │
│ │ • Schema Normalization (field mapping registry)       │  │
│ │ • Historical Task Memory (agent_task_learnings)       │  │
│ └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────────┐
│ L3 — SERVICE LAYER                                          │
│ (GWS Services, Gmail Watch, Drive Sync, Document Parser)   │
└────────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────────┐
│ L4 — AGENT INTEGRATION                                      │
│ (A01 Intake, A06 News, A10 Tracker, A11 Document)          │
└────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. **Unified Document Registry** (`unified_documents` table)

```sql
CREATE TABLE unified_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source tracking
  source_system VARCHAR(50) NOT NULL,  -- 'data_library' | 'gmail' | 'drive' | 'sheets'
  source_id VARCHAR(500) NOT NULL,     -- Original ID in source system
  external_url TEXT,                   -- Drive file ID, Gmail message ID, etc.
  
  -- Content
  document_type VARCHAR(100) NOT NULL, -- 'om' | 't12' | 'rent_roll' | 'market_report' | 'comp_sheet'
  title TEXT NOT NULL,
  content_text TEXT,                   -- Extracted/OCR'd text
  content_embedding VECTOR(1536),      -- OpenAI text-embedding-3-small
  
  -- Metadata
  property_address TEXT,
  property_city VARCHAR(255),
  property_state VARCHAR(2),
  property_type VARCHAR(100),
  unit_count INTEGER,
  deal_capsule_id UUID,                -- FK to deal_capsules
  
  -- Extracted structured data
  structured_data JSONB,               -- Normalized fields across document types
  confidence_score FLOAT,              -- 0-1, extraction quality
  validation_status VARCHAR(50),       -- 'pending' | 'validated' | 'flagged' | 'rejected'
  validation_notes TEXT,
  
  -- Provenance
  created_by_agent VARCHAR(100),       -- Which agent/service created this entry
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexing
  UNIQUE(source_system, source_id)
);

CREATE INDEX idx_unified_docs_embedding ON unified_documents 
  USING ivfflat (content_embedding vector_cosine_ops);
CREATE INDEX idx_unified_docs_city ON unified_documents (property_city);
CREATE INDEX idx_unified_docs_type ON unified_documents (document_type);
CREATE INDEX idx_unified_docs_deal ON unified_documents (deal_capsule_id);
```

**Purpose:**
- Single source of truth for ALL documents (Data Library, Gmail, Drive, Sheets)
- Vector embeddings enable semantic search: "Find OMs similar to this property"
- Confidence scoring flags low-quality extractions for human review
- Links documents to Deal Capsules automatically

#### 2. **Document Relationships** (`doc_relationships` table)

```sql
CREATE TABLE doc_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  parent_doc_id UUID NOT NULL REFERENCES unified_documents(id) ON DELETE CASCADE,
  child_doc_id UUID NOT NULL REFERENCES unified_documents(id) ON DELETE CASCADE,
  
  relationship_type VARCHAR(100) NOT NULL,
  -- 'supersedes' — newer version of same doc
  -- 'supplements' — rent roll supplements OM
  -- 'contradicts' — conflicting data, flag for review
  -- 'references' — market report references comp sale
  
  confidence FLOAT,                    -- 0-1, how sure the link is correct
  detected_by VARCHAR(100),            -- Agent/service that detected relationship
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  
  notes TEXT,
  
  UNIQUE(parent_doc_id, child_doc_id, relationship_type)
);
```

**Purpose:**
- Track document lineage: Gmail OM → Drive rent roll → Sheets comp database
- Detect conflicts: "Two T12s for same property with different NOI"
- Enable provenance: "Which documents contributed to this JEDI Score?"

#### 3. **Schema Normalization Registry** (`field_mappings` table)

```sql
CREATE TABLE field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  source_document_type VARCHAR(100) NOT NULL,  -- 'cbre_om' | 'mm_om' | 't12' | 'rent_roll'
  source_field_name TEXT NOT NULL,             -- 'Net Operating Income (Annual)'
  
  canonical_field VARCHAR(100) NOT NULL,       -- 'noi_annual'
  canonical_type VARCHAR(50) NOT NULL,         -- 'currency' | 'integer' | 'float' | 'date' | 'text'
  
  transformation_rule JSONB,                   -- { "divide_by": 12 } for monthly→annual
  validation_rule JSONB,                       -- { "min": 0, "max": 10000000, "outlier_threshold": 2.5 }
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Example mappings
INSERT INTO field_mappings (source_document_type, source_field_name, canonical_field, canonical_type, transformation_rule)
VALUES 
  ('cbre_om', 'Net Operating Income (Annual)', 'noi_annual', 'currency', '{}'),
  ('mm_om', 'NOI', 'noi_annual', 'currency', '{}'),
  ('t12', 'NOI (TTM)', 'noi_annual', 'currency', '{}'),
  ('t12', 'NOI (Monthly)', 'noi_annual', 'currency', '{"multiply_by": 12}'),
  ('rent_roll', 'Total Monthly Rent', 'gross_rental_income_annual', 'currency', '{"multiply_by": 12}');
```

**Purpose:**
- Normalize field names across brokers (CBRE vs Marcus & Millichap vs JLL)
- Apply transformations (monthly → annual, sqft → acres)
- Validate extracted values (flag NOI > $10M for 50-unit property as outlier)

#### 4. **Agent Task Learnings** (`agent_task_learnings` table)

```sql
CREATE TABLE agent_task_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  agent_type VARCHAR(100) NOT NULL,            -- 'zoning_analysis' | 'supply_analysis' | 'cashflow_analysis'
  task_id UUID REFERENCES agent_tasks(id),
  
  -- Context fingerprint (what data was used)
  context_documents UUID[],                    -- Array of unified_documents.id
  context_embedding VECTOR(1536),              -- Embedding of concatenated context
  
  -- Input/output for pattern learning
  input_params JSONB NOT NULL,
  output_result JSONB NOT NULL,
  execution_time_ms INTEGER,
  
  -- Human feedback
  user_validation VARCHAR(50),                 -- 'approved' | 'rejected' | 'corrected'
  user_corrections JSONB,                      -- What the user changed
  
  -- Similarity scoring
  similar_task_ids UUID[],                     -- Past tasks with similar context
  similarity_scores FLOAT[],                   -- Cosine similarity to each
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_learnings_context ON agent_task_learnings 
  USING ivfflat (context_embedding vector_cosine_ops);
CREATE INDEX idx_agent_learnings_type ON agent_task_learnings (agent_type);
```

**Purpose:**
- Agents can query: "Find past zoning analyses in Atlanta with similar lot size/zoning code"
- Learn from user corrections: "User changed density from 75 to 60 units/acre — why?"
- Adjust confidence scores: "Last 5 tasks with this doc pattern were rejected → lower confidence"
- Enable explainability: "This result is based on 3 similar past deals (links)"

---

## 🔄 Data Flow: Gmail OM → Agent Context

### Current Flow (WITHOUT Intelligence Layer)
```
1. Gmail Watch Service detects email with OM attachment
2. Document Parser extracts text, classifies as "OM"
3. A01 Deal Intake Agent:
   - Creates Deal Capsule in database
   - Stores parsed OM data in deal_capsules.metadata JSONB
4. Later, Zoning Agent executes:
   - Queries DataLibraryContextService for city="Atlanta"
   - Gets back generic impact fees/construction costs
   - NO CONNECTION to the specific OM that started this deal
```

**Problem:** The OM data is siloed in `deal_capsules.metadata`. Agents can't semantically search for "similar OMs" or cross-reference with other documents.

### Proposed Flow (WITH Intelligence Layer)
```
1. Gmail Watch Service detects email with OM attachment
2. Document Parser Service:
   a. Extracts text + structured fields (property address, NOI, cap rate, etc.)
   b. Normalizes fields via field_mappings registry
   c. Generates text embedding (OpenAI text-embedding-3-small)
   d. Inserts into unified_documents:
      {
        source_system: 'gmail',
        source_id: 'msg_abc123',
        document_type: 'om',
        title: 'CBRE - 1950 Piedmont Circle - Atlanta Multifamily OM',
        content_text: '... extracted text ...',
        content_embedding: [0.023, -0.154, ...],
        structured_data: {
          noi_annual: 2400000,
          unit_count: 300,
          cap_rate: 0.052,
          asking_price: 46000000
        },
        confidence_score: 0.87,
        property_city: 'Atlanta',
        property_state: 'GA'
      }
   e. Runs anomaly detection: NOI/unit = $8,000/yr → within expected range ✓
   f. Validation status: 'validated'

3. A01 Deal Intake Agent:
   a. Creates Deal Capsule
   b. Links to unified_documents entry via deal_capsule_id
   c. Queries Intelligence Context Engine:
      - "Find similar OMs in Atlanta for 200-400 unit properties"
      - Returns: 5 past OMs with cosine similarity > 0.85
   d. Extracts avg cap rate (5.1%), avg NOI/unit ($7,200)
   e. Flags: "This OM's cap rate (5.2%) is 2% above recent comps — verify"
   
4. M09 ProForma Agent executes:
   a. Gets deal_capsule_id
   b. Queries Intelligence Context Engine for linked documents:
      - Returns: OM + any subsequent rent rolls, T12s uploaded to Drive
   c. Cross-references NOI from OM vs T12 (if available)
   d. If mismatch > 10%, creates doc_relationship with type='contradicts'
   e. Flags: "OM shows NOI $2.4M, T12 shows $2.1M — use T12 (more reliable)"
   
5. Agent Task Learnings:
   - Stores: {agent_type: 'deal_intake', context_documents: [om_id], output: {...}, user_validation: 'approved'}
   - Future executions: "3 past deals with similar OMs were approved → confidence +10%"
```

**Result:** Agents have **semantic memory** of past documents and can learn from patterns.

---

## 🛠️ Implementation Plan

### Phase 0: Foundation (Before M28 GWS Integration)
**Timeline:** 2 weeks  
**Effort:** ~80 dev hours

1. **Add Vector Extension to PostgreSQL**
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

2. **Create Intelligence Layer Tables**
   - `unified_documents`
   - `doc_relationships`
   - `field_mappings`
   - `agent_task_learnings`

3. **Build IntelligenceContextService**
   ```typescript
   class IntelligenceContextService {
     async indexDocument(doc: UnifiedDocument): Promise<void>
     async semanticSearch(query: string, filters: {}, limit: number): Promise<UnifiedDocument[]>
     async findRelatedDocuments(docId: string): Promise<DocumentRelationship[]>
     async normalizeField(sourceType: string, fieldName: string, value: any): Promise<NormalizedField>
     async getAgentLearnings(agentType: string, contextFingerprint: string): Promise<PastTask[]>
   }
   ```

4. **Migrate Existing Data Library**
   - Backfill `unified_documents` from `data_library_files`
   - Generate embeddings for existing CSV parsed_data
   - Populate `field_mappings` with common CSV column patterns

5. **Update Agents to Use Intelligence Layer**
   - Modify `DataLibraryContextService` to query `unified_documents` with semantic search
   - Update `AgentOrchestrator` to log task learnings after execution
   - Add feedback loop: capture user edits to agent outputs

### Phase 1: M28 GWS Integration (Week 1-4 of M28)
**Timeline:** 4 weeks  
**Effort:** +40 hours on top of M28 base effort

6. **Gmail Watch Service → Intelligence Layer**
   - Every extracted OM/T12/rent roll → insert into `unified_documents`
   - Run anomaly detection on extracted fields
   - Auto-create doc_relationships if multiple docs for same property detected

7. **Drive Sync Service → Intelligence Layer**
   - New Drive docs → index in `unified_documents`
   - Detect relationships: e.g., "rent_roll_2024.xlsx" + "OM_2024.pdf" in same folder → link them

8. **Document Parser Service Enhancement**
   - Add schema normalization step after extraction
   - Validate extracted values against `field_mappings` rules
   - Generate confidence scores based on extraction method (OCR vs structured)

### Phase 2: Agent Learning Loop (Week 5-8 of M28)
**Timeline:** 4 weeks  
**Effort:** ~100 hours

9. **Semantic Context Retrieval**
   - Agents query: "Find documents similar to this deal's context"
   - Use vector similarity + filters (city, property type, date range)

10. **Historical Pattern Learning**
    - Before each agent execution, query `agent_task_learnings` for similar past tasks
    - Adjust confidence scores based on past outcomes
    - Present: "This analysis is 85% similar to [Deal XYZ] which had outcome [ABC]"

11. **Feedback Integration**
    - When user edits agent output, log to `agent_task_learnings.user_corrections`
    - Next time agent sees similar context, apply learned correction

12. **Explainability Dashboard**
    - UI showing: "This result used 7 documents (3 OMs, 2 T12s, 2 rent rolls)"
    - Click to view source docs
    - Provenance chain: OM → Deal Capsule → ProForma → JEDI Score

---

## 📐 Example: Zoning Agent with Intelligence Layer

### Before (Current):
```typescript
// Zoning agent gets minimal context
const context = await dataLibraryContext.getContextForDeal({
  dealId: '123',
  municipality: 'Atlanta',
  propertyType: 'multifamily'
});
// Returns: 2 impact fee CSVs from Data Library (generic Atlanta data)
// Doesn't know about the specific OM, T12, or market reports for this deal
```

### After (With Intelligence Layer):
```typescript
const intelligence = await intelligenceContext.getAgentContext({
  dealId: '123',
  agentType: 'zoning_analysis',
  semanticQuery: 'zoning regulations, development restrictions, Atlanta midrise multifamily',
  limit: 10
});

/*
Returns:
{
  primaryDocuments: [
    { type: 'om', title: '1950 Piedmont OM', similarity: 0.93, source: 'gmail' },
    { type: 'market_report', title: 'Atlanta Zoning Overview Q4 2025', similarity: 0.89, source: 'drive' }
  ],
  supplementalDocuments: [
    { type: 't12', title: '1950 Piedmont T12', relationship: 'supplements_om', source: 'drive' }
  ],
  comparableDeals: [
    { dealName: '2100 Peachtree', similarity: 0.88, outcome: 'approved', timelineDays: 180 },
    { dealName: '725 Ponce', similarity: 0.84, outcome: 'variance_required', timelineDays: 240 }
  ],
  historicalLearnings: [
    { 
      pattern: 'midrise_atlanta_urban_core',
      avgTimelineDays: 195,
      varianceRate: 0.35,
      successRate: 0.92
    }
  ],
  normalizedFields: {
    lot_area_sf: 87120,      // From OM (normalized from acres)
    max_far: 6.0,            // From market report
    max_height_ft: 150,      // From market report
    parking_ratio: 1.5       // From OM (normalized from "450 spaces / 300 units")
  },
  confidenceScore: 0.89,     // Based on data quality + past similar task outcomes
  dataQualityFlags: [
    { field: 'lot_area_sf', issue: 'Estimated from tax records (not surveyed)', severity: 'low' }
  ]
}
*/

// Agent uses this rich context to make informed decision
// If outcome differs from historicalLearnings, user feedback → agent_task_learnings for next time
```

---

## 🎯 Benefits

### For Agents
1. **Semantic Memory:** Recall similar past deals, not just keyword matches
2. **Cross-Source Intelligence:** Automatically link Gmail OM + Drive docs + Sheets comps
3. **Data Quality Awareness:** Flag outliers, conflicts, missing data
4. **Learning from Feedback:** Improve accuracy over time based on user corrections
5. **Explainability:** Show provenance: "Based on 5 documents (links)"

### For Users
1. **Automatic Deal Intake:** Email OM → indexed → linked to Deal Capsule → agents trained
2. **Conflict Detection:** "This T12 conflicts with the OM (NOI mismatch)" → human review
3. **Comparable Matching:** "Find deals similar to this one" (semantic, not just city match)
4. **Confidence Transparency:** "This result is 72% confident because input data quality was low"
5. **Audit Trail:** Full provenance from email → extraction → agent → output

### For Data Quality
1. **Centralized Validation:** All documents go through schema normalization + anomaly detection
2. **Version Control:** Track document relationships (supersedes, supplements)
3. **Human-in-the-Loop:** Flagged outliers/conflicts require validation before agents use them
4. **Continuous Improvement:** Field mappings + validation rules updated as new doc types arrive

---

## 🚧 Open Questions

1. **Embedding Model Choice:**
   - OpenAI `text-embedding-3-small` (1536 dim, $0.02/1M tokens, fast)
   - OpenAI `text-embedding-3-large` (3072 dim, $0.13/1M tokens, higher accuracy)
   - Local (Sentence Transformers, free but slower)
   - **Recommendation:** Start with `text-embedding-3-small` for cost/speed, evaluate accuracy

2. **Vector Index Strategy:**
   - pgvector with IVFFlat (current plan, 10k-1M docs)
   - pgvector with HNSW (better for >1M docs, higher memory)
   - External vector DB (Pinecone, Weaviate) if scale exceeds pgvector
   - **Recommendation:** pgvector IVFFlat, migrate to HNSW if >500k docs

3. **Document Versioning:**
   - How to handle: User uploads new rent roll → should it supersede old one or coexist?
   - **Proposal:** Use `doc_relationships` with type='supersedes' + keep both versions
   - Flag old version as `archived: true` in `unified_documents`

4. **Data Privacy:**
   - Gmail/Drive content may contain PII/confidential info
   - **Mitigation:** 
     - User-level isolation (user_id on all queries)
     - Encryption at rest for `content_text`
     - Option to exclude sensitive docs from embeddings

5. **Incremental Migration:**
   - Can we deploy Intelligence Layer incrementally while M28 is being built?
   - **Yes:** Phase 0 can be done now, Phase 1 integrates with M28, Phase 2 is post-M28

---

## ✅ Recommendation

**Proceed with Intelligence Context Engine (L2.5) as PREREQUISITE for M28 GWS Integration.**

**Why:**
- Without it, M28 adds 100-300 docs/day with no way for agents to learn from them
- Semantic search is essential for "find similar deals" use case
- Data quality validation prevents garbage-in-garbage-out
- Historical learnings enable continuous improvement

**Timeline Adjustment:**
- Original M28: 12 weeks (Phase 1-3)
- New M28: 14 weeks (Phase 0 = 2 weeks, then original 12 weeks)
- Phase 0 can start NOW (parallel to M28 design finalization)

**Effort:**
- Phase 0: 80 hours (Intelligence Layer foundation)
- M28 integration overhead: +40 hours (wire services to Intelligence Layer)
- Total: +120 hours (~3 weeks FTE)

**ROI:**
- Agents become 10x smarter (semantic search vs keyword match)
- Data quality issues caught early (anomaly detection)
- Users trust agent outputs more (explainability + provenance)
- System scales to 1000s of documents without degradation

---

## 📋 Next Steps

1. **Approve Architecture:** Review this doc, confirm approach
2. **Prioritize Phase 0:** Can we start Intelligence Layer foundation this week?
3. **Finalize M28 Wiring:** Update M28 Service Layer design to integrate with Intelligence Context Engine
4. **Schema Review:** Walk through `unified_documents` + `field_mappings` tables, iterate on structure
5. **POC:** Build semantic search POC with 100 sample documents (Data Library backfill)

---

**Questions? Concerns? Let's discuss.**
