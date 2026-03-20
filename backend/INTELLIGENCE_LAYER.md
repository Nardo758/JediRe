# Intelligence Context Engine - Setup Guide

## Overview

The Intelligence Context Engine provides semantic search, document relationships, and agent learning capabilities across all data sources (Data Library, Gmail, Drive, Sheets).

## 📦 Database Setup

### 1. Run Migrations

Apply the intelligence layer migrations to your database:

```bash
cd backend
npm run migrate
```

This will create:
- `unified_documents` - Single registry for all documents with vector embeddings
- `doc_relationships` - Links between related documents
- `field_mappings` - Schema normalization rules (25+ default mappings)
- `agent_task_learnings` - Historical task execution for pattern learning
- `agent_patterns` - Discovered heuristics across tasks

**Requirements:**
- PostgreSQL with `pgvector` extension (installed automatically by migration 081)
- Database connection configured via `DATABASE_URL` or individual env vars

**Environment Variables:**
```bash
# Option 1: Connection string
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Option 2: Individual vars
DB_HOST=localhost
DB_PORT=5432
DB_NAME=jedire
DB_USER=postgres
DB_PASSWORD=your_password
```

### 2. Backfill Existing Data Library

Migrate existing `data_library_files` into `unified_documents`:

```bash
npm run backfill
```

This will:
- Read all completed data library files
- Infer document types from tags and filenames
- Extract structured data from CSV parsed_data
- Calculate confidence scores
- Detect data quality flags
- Insert into `unified_documents` (without embeddings)

**Output:**
```
📊 Backfill Summary:
  ✅ Successfully indexed: 142
  ⏭️  Skipped (already indexed): 8
  ❌ Errors: 0
  📁 Total processed: 150
```

**Note:** Embeddings are not generated during backfill. Run embedding generation next.

### 3. Generate Embeddings

Generate vector embeddings for all documents using OpenAI API:

```bash
# Dry run (estimate cost, no API calls)
npm run embeddings -- --dry-run

# Generate embeddings for all documents
npm run embeddings

# Generate embeddings for first 50 documents (testing)
npm run embeddings -- --limit 50
```

**Requirements:**
- OpenAI API key: `OPENAI_API_KEY=sk-...`

**Model:** `text-embedding-3-small` (1536 dimensions)  
**Cost:** ~$0.02 per 1M tokens (~$0.00002 per document)

**Output:**
```
📊 Embedding Generation Summary:
  ✅ Successfully generated: 142
  ❌ Errors: 0
  📁 Total documents: 142
  🔢 Total tokens: 71,234
  💰 Estimated cost: $0.0014
```

**Rate Limiting:** 100ms delay between requests (built-in)

## 🚀 Usage

### Semantic Search

```typescript
import { IntelligenceContextService } from './services/intelligence-context.service';
import { getPool } from './database/connection';

const intelligence = new IntelligenceContextService(getPool());

// Search by query text (requires embeddings)
const results = await intelligence.semanticSearch({
  query: 'Atlanta multifamily rent comps',
  filters: {
    documentType: ['rent_comp_data', 'market_report'],
    propertyCity: 'Atlanta',
    validationStatus: 'validated',
  },
  limit: 10,
  minSimilarity: 0.75,
});

// Search by embedding (from agent context)
const results = await intelligence.semanticSearch({
  queryEmbedding: contextEmbedding,
  filters: { propertyCity: 'Atlanta' },
  limit: 5,
});
```

### Get Agent Context

```typescript
// Get comprehensive context for agent execution
const context = await intelligence.getAgentContext({
  dealId: 'deal-123',
  agentType: 'zoning_analysis',
  semanticQuery: 'Atlanta zoning regulations midrise development',
  filters: {
    propertyCity: 'Atlanta',
    documentType: ['zoning_code', 'market_report', 'om'],
  },
  limit: 10,
});

/*
Returns:
{
  primaryDocuments: [
    { id, title, documentType, similarity: 0.92, ... },
    ...
  ],
  supplementalDocuments: [ ... ], // Related docs via doc_relationships
  comparableDeals: [ ... ],        // Similar past deals
  historicalLearnings: [           // Discovered patterns
    {
      pattern: 'midrise_atlanta_urban_core',
      statistics: {
        sample_size: 23,
        avg_timeline_days: 195,
        variance_rate: 0.35,
        success_rate: 0.92
      }
    }
  ],
  normalizedFields: {              // Extracted structured data
    noi_annual: 2400000,
    cap_rate: 0.052,
    unit_count: 300
  },
  confidenceScore: 0.87,           // Avg confidence of sources
  dataQualityFlags: [ ... ]        // Issues detected
}
*/
```

### Index New Document

```typescript
const doc = await intelligence.indexDocument({
  sourceSystem: 'gmail',
  sourceId: 'msg_abc123',
  documentType: 'om',
  title: 'CBRE - 1950 Piedmont Circle - Atlanta Multifamily OM',
  contentText: extractedText,
  contentEmbedding: embedding,
  propertyCity: 'Atlanta',
  propertyState: 'GA',
  structuredData: {
    noi_annual: 2400000,
    unit_count: 300,
    cap_rate: 0.052,
  },
  confidenceScore: 0.87,
  validationStatus: 'validated',
  dataQualityFlags: [],
  createdByAgent: 'gmail_watch_service',
  userId: 'user-123',
});
```

### Create Document Relationship

```typescript
await intelligence.createDocumentRelationship({
  parentDocId: omDocId,
  childDocId: t12DocId,
  relationshipType: 'supplements',
  confidence: 0.95,
  detectedBy: 'document_parser_service',
  metadata: {
    detected_via: 'property_address_match',
    noi_variance: 0.08, // T12 NOI is 8% lower than OM
  },
  notes: 'T12 provides detailed OpEx breakdown for OM property',
});
```

### Log Agent Learning

```typescript
await intelligence.logAgentLearning({
  agentType: 'zoning_analysis',
  taskId: 'task-456',
  dealCapsuleId: 'deal-123',
  contextDocuments: [omDocId, zoningDocId, marketReportId],
  contextSummary: 'OM + zoning code + market report for Atlanta midrise',
  contextEmbedding: embedding,
  inputParams: {
    address: '1950 Piedmont Circle NE',
    propertyType: 'multifamily',
    lotSizeSf: 87120,
  },
  outputResult: {
    zoningCode: 'MR-5',
    maxFar: 6.0,
    maxHeight: 150,
    timelineEstimate: 195,
    varianceLikely: false,
  },
  outputConfidence: 0.89,
  executionTimeMs: 3420,
  dataSourcesUsed: ['unified_documents', 'zoning_database'],
  userId: 'user-123',
});
```

## 🔄 Agent Integration

Agents automatically log learnings after task completion (via `AgentOrchestrator`).

To use intelligence context in agents:

```typescript
// In your agent's execute() method
import { IntelligenceContextService } from '../services/intelligence-context.service';
import { getPool } from '../database/connection';

const intelligence = new IntelligenceContextService(getPool());

const context = await intelligence.getAgentContext({
  agentType: 'zoning_analysis',
  semanticQuery: `${address} ${propertyType} zoning regulations`,
  filters: {
    propertyCity: city,
    documentType: ['zoning_code', 'om', 'market_report'],
  },
});

// Use context.primaryDocuments, context.normalizedFields, etc.
// Return confidence score in output for learning logs
return {
  result: analysis,
  confidence: context.confidenceScore,
};
```

## 📊 Monitoring

### Check Migration Status

```sql
SELECT migration_number, migration_name, applied_at
FROM schema_migrations
WHERE migration_number >= 81
ORDER BY migration_number;
```

### Check Document Count

```sql
SELECT 
  source_system,
  document_type,
  validation_status,
  COUNT(*) as count,
  COUNT(content_embedding) as with_embedding
FROM unified_documents
GROUP BY source_system, document_type, validation_status
ORDER BY count DESC;
```

### Check Learning Stats

```sql
SELECT 
  agent_type,
  user_validation,
  COUNT(*) as count,
  AVG(execution_time_ms) as avg_time_ms,
  AVG(output_confidence) as avg_confidence
FROM agent_task_learnings
GROUP BY agent_type, user_validation
ORDER BY count DESC;
```

## 🎯 Next Steps

1. ✅ Run migrations (`npm run migrate`)
2. ✅ Backfill data library (`npm run backfill`)
3. ✅ Generate embeddings (`npm run embeddings`)
4. 🔄 Wire M28 Gmail/Drive services to intelligence layer
5. 🔄 Update agents to query intelligence context
6. 🔄 Build user feedback loops (corrections → agent_task_learnings)

## 📝 Field Mappings

25+ default mappings included for common CRE fields:

**NOI (Net Operating Income):**
- `CBRE OM: "Net Operating Income (Annual)"` → `noi_annual`
- `Marcus & Millichap OM: "NOI"` → `noi_annual`
- `T12: "NOI (Monthly)"` × 12 → `noi_annual`

**Property Characteristics:**
- `"Unit Count"` / `"Total Units"` → `unit_count`
- `"Lot Size (Acres)"` × 43,560 → `lot_size_sf`
- `"Year Built"` → `year_built`

**Financial Metrics:**
- `"Cap Rate"` / `"Capitalization Rate"` → `cap_rate`
- `"Asking Price"` / `"List Price"` → `asking_price`
- `"Occupancy"` / `"Occupancy Rate"` → `occupancy_rate`

Add custom mappings via:
```sql
INSERT INTO field_mappings (
  source_document_type, source_field_name, canonical_field,
  canonical_type, transformation_rule, validation_rule
) VALUES (
  'custom_om', 'Monthly NOI', 'noi_annual', 'currency',
  '{"operation": "multiply", "factor": 12}',
  '{"min": 0, "max": 100000000, "outlier_threshold": 2.5}'
);
```

## ⚠️ Troubleshooting

**Error: `pgvector extension not found`**
- Migration 081 should install it automatically
- If manual install needed: `CREATE EXTENSION vector;`

**Error: `OpenAI API key not set`**
- Set env var: `OPENAI_API_KEY=sk-...`

**Slow embedding generation:**
- Use `--limit` for incremental processing
- Rate limiting is built-in (100ms delay)
- Run overnight for large datasets

**High embedding costs:**
- Run `--dry-run` first to estimate
- Embeddings are one-time cost
- ~$0.00002 per document (very cheap)

---

**Questions?** Check `/home/leon/clawd/docs/gws-data-integration-analysis.md` for architecture details.
