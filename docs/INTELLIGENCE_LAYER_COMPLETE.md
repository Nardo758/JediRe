# Intelligence Layer - Complete Implementation Guide

## 🎯 Overview

The Intelligence Layer transforms JediRe from keyword-based data retrieval into an AI-powered semantic intelligence system that learns and improves over time.

## 📦 What Was Built

### Phase 0: Foundation (Migrations 081-083)
✅ **Vector Database** - pgvector extension for semantic search  
✅ **Unified Documents** - Single registry for all docs across systems  
✅ **Document Relationships** - Link related docs (supplements, supersedes, contradicts)  
✅ **Field Mappings** - Normalize field names across sources (25+ defaults)  
✅ **Agent Learning** - Historical task execution with outcomes  
✅ **Pattern Discovery** - Aggregate learnings into reusable patterns

### Document Categorization (Migration 084)
✅ **24 Document Categories** - Organized by purpose and target modules  
✅ **Module Routing** - Each category knows which modules consume it  
✅ **Module Requirements** - Defines required vs optional docs per module  
✅ **Data Quality Scoring** - Track readiness (has all required? missing optional?)

### Archive System (Migration 085)
✅ **Archived Deals** - Store closed/passed deals with outcomes  
✅ **Actual vs Projected** - Track prediction accuracy  
✅ **Lessons Learned** - Capture what worked / didn't work  
✅ **Historical Outcomes** - Agent learning from past deals  
✅ **Comparable Finder** - Find similar past deals

### User Preferences (Migration 086)
✅ **Semantic Search Settings** - Enable/disable, precision control  
✅ **Learning Preferences** - Opt-in/out of agent training  
✅ **Privacy Controls** - Document inclusion, retention periods  
✅ **Feedback Settings** - Request ratings, auto-submit corrections

### Backend Services
✅ **IntelligenceContextService** - Core intelligence operations  
✅ **DocumentRouterService** - Auto-categorization + module routing  
✅ **DataLibraryContextService** - Enhanced with semantic search  
✅ **AgentOrchestrator** - Logs learnings after every task

### Admin Dashboard
✅ **Intelligence Dashboard** (`/admin/intelligence`)  
  - Document stats (total, embedded, validated, flagged)  
  - Source breakdown (Data Library, Gmail, Drive, Sheets)  
  - Agent performance (30d approval rates, confidence)  
  - Agent breakdown by type  
  - Data quality alerts  
  - Embedding backlog + cost tracking

### User Settings
✅ **Intelligence Settings** (`/settings` → Intelligence & Data tab)  
  - My document stats  
  - Semantic search preferences  
  - Agent learning opt-in/out  
  - Privacy controls  
  - Personal intelligence stats

### Scripts & Tools
✅ **Migration Runner** - `npm run migrate`  
✅ **Data Library Backfill** - `npm run backfill`  
✅ **Embedding Generation** - `npm run embeddings`  
✅ **Bundle Optimization** - Lazy-loaded map components (-60% initial bundle)

---

## 🗂️ Database Schema

### Core Tables (6)

1. **unified_documents** - Single doc registry  
2. **doc_relationships** - Document links  
3. **field_mappings** - Schema normalization  
4. **agent_task_learnings** - Task history  
5. **agent_patterns** - Discovered patterns  
6. **document_categories** - 24 categories + module mappings

### Archive Tables (3)

7. **archived_deals** - Closed/passed deals  
8. **archive_statistics** - Archive metadata  
9. **deal_historical_outcomes** - Prediction vs actual

### User Preferences (1)

10. **user_intelligence_preferences** - Per-user settings

### Module System (1)

11. **module_data_requirements** - What each module needs

**Total:** 11 new tables + enhancements to existing tables

---

## 🔄 Data Flow Examples

### Example 1: Gmail OM → M09 ProForma

```
1. Gmail Watch Service detects broker email with OM attachment
2. Document Parser extracts text + structured data
   → { noi_annual: 2400000, unit_count: 300, cap_rate: 0.052 }
3. Intelligence Context Service
   → Indexes in unified_documents
   → Generates embedding (OpenAI text-embedding-3-small)
4. Document Router Service
   → Auto-categorizes: "OM"
   → Routes to modules: ["M01", "M09", "M15", "M22"]
   → Links to deal_capsule_id
5. M09 ProForma Agent executes
   → Queries: getDocumentsForModule('M09', { dealId })
   → Gets: OM (helpful but not required)
   → Data quality: 60% (has OM, missing T12, RENT_ROLL)
   → Returns: "Need more data for accurate projection"
6. User uploads T12 + RENT_ROLL
   → Auto-categorized, routed to M09
   → Data quality: 100%
7. M09 re-runs with full context
   → Returns: "87% confidence projection"
   → Execution logged to agent_task_learnings
8. User approves result
   → Approval logged (contributes to M09's learning)
9. Deal closes
   → Archived with actual outcomes
   → Available as comp for future deals
```

### Example 2: Semantic Search

**User Action:** Agent needs zoning data for Atlanta property

**Old Way (Keyword):**
```sql
SELECT * FROM data_library_files
WHERE city ILIKE '%Atlanta%' AND tags @> '["zoning"]'
```
Returns: Generic Atlanta zoning CSVs (may not be relevant)

**New Way (Semantic):**
```typescript
const results = await intelligenceSearch({
  query: "Atlanta midrise multifamily zoning height restrictions FAR",
  filters: { city: "Atlanta", documentType: "ZONING_CODE" },
  minSimilarity: 0.7
});
```
Returns: Semantically relevant docs about:
- MR-5 zoning (midrise specific)
- Height restrictions
- FAR limits
- Even if they don't mention "zoning" in title

### Example 3: Archive Deal Learning

```
Historical Deal: "725 Ponce Midrise" (2023)
  - Predicted: 7.5% IRR, 180d timeline
  - Actual: 6.8% IRR, 240d timeline
  - Variance: -9% IRR, +33% timeline
  - Key factors: ["zoning_variance_delay", "market_softening"]

Current Deal: "1950 Piedmont Midrise" (2026)
  - Agent queries: Find similar Atlanta midrise deals
  - Returns: 725 Ponce + 4 others
  - Pattern learned: "Atlanta midrise urban core: avg 195d timeline, 35% variance rate"
  - Agent adjusts prediction: 200d timeline (not 180d)
  - Confidence: 89% (based on 5 similar past deals)
```

---

## 📊 Document Categories (24)

### Financial (4)
- **OM** → M01, M09, M15, M22 (Priority: 1)
- **T12** → M09, M22 (Priority: 1)
- **RENT_ROLL** → M09, M22 (Priority: 1)
- **PROFORMA** → M09 (Priority: 2)

### Property (4)
- **APPRAISAL** → M01, M15 (Priority: 2)
- **SURVEY** → M01, M03 (Priority: 3)
- **INSPECTION** → M22 (Priority: 3)
- **ENV_REPORT** → M01 (Priority: 2)

### Zoning & Entitlement (4)
- **ZONING_CODE** → M03, M48 (Priority: 1)
- **ZONING_LETTER** → M03 (Priority: 1)
- **SITE_PLAN** → M03, M04 (Priority: 2)
- **ENTITLEMENT_APP** → M03 (Priority: 2)

### Market Intelligence (4)
- **MARKET_REPORT** → M05, M06, M15 (Priority: 2)
- **COMP_SHEET** → M15 (Priority: 1)
- **RENT_SURVEY** → M05, M09 (Priority: 1)
- **DEMO_REPORT** → M05, M06 (Priority: 3)

### Construction & Development (4)
- **COST_ESTIMATE** → M04, M09 (Priority: 2)
- **IMPACT_FEES** → M04, M09 (Priority: 2)
- **PERMIT_TIMELINE** → M03, M04 (Priority: 3)
- **PLANS_SPECS** → M04 (Priority: 4)

### Legal & Closing (3)
- **PSA** → M01, M22 (Priority: 1)
- **TITLE_REPORT** → M01 (Priority: 2)
- **LEASE_ABSTRACT** → M09, M22 (Priority: 3)

### Asset Management (4)
- **BUDGET** → M22, M09 (Priority: 2)
- **VARIANCE_REPORT** → M22 (Priority: 3)
- **CAPEX_PLAN** → M22 (Priority: 3)
- **TENANT_LEDGER** → M22 (Priority: 4)

---

## 🚀 Deployment Steps

### 1. Run Migrations (6 total)

```bash
cd backend

# Set environment variables
export DATABASE_URL="postgresql://user:password@host:5432/dbname"
export OPENAI_API_KEY="sk-..."

# Run migrations
npm run migrate

# Expected output:
# ✅ Applied 081_intelligence_layer_foundation.sql
# ✅ Applied 082_schema_normalization.sql
# ✅ Applied 083_agent_task_learnings.sql
# ✅ Applied 084_document_categorization.sql
# ✅ Applied 085_archive_deals.sql
# ✅ Applied 086_user_intelligence_preferences.sql
```

### 2. Backfill Existing Data

```bash
npm run backfill

# Migrates data_library_files → unified_documents
# Auto-categorizes documents
# Calculates confidence scores
# Detects quality flags
```

### 3. Generate Embeddings

```bash
# Dry run first (check cost)
npm run embeddings -- --dry-run

# Expected output:
# 📊 Found 142 documents without embeddings
# 💰 Estimated cost: $0.0028

# Generate embeddings
npm run embeddings

# Processes in batches of 100
# ~100ms delay between requests (rate limiting)
# Cost: ~$0.00002 per document
```

### 4. Verify Installation

```bash
# Check tables
psql $DATABASE_URL -c "\dt *intelligence*"
psql $DATABASE_URL -c "\dt archived_*"
psql $DATABASE_URL -c "\dt document_*"

# Check data
psql $DATABASE_URL -c "SELECT COUNT(*) FROM unified_documents;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM document_categories;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM module_data_requirements;"
```

---

## 🎨 UI Access

### Admin Dashboard
**URL:** `/admin/intelligence`  
**Features:**
- System-wide document stats
- Source breakdown (Data Library, Gmail, Drive, Sheets)
- Agent performance metrics (30d)
- Agent breakdown by type
- Data quality alerts
- Embedding backlog
- Cost tracking

### User Settings
**URL:** `/settings` → Intelligence & Data tab  
**Features:**
- My document stats
- Generate embeddings button
- Semantic search preferences (precision control)
- Agent learning opt-in/out
- Feedback settings
- Privacy controls (retention periods)
- Personal intelligence stats (last 30d)

---

## 📈 Benefits

### For Agents
✅ Semantic search (meaning-based, not keyword)  
✅ Know what data they have vs need  
✅ Adjust confidence based on data quality  
✅ Learn from user corrections  
✅ Discover patterns across deals  
✅ Find relevant historical comps

### For Users
✅ See which modules are ready to run  
✅ Understand what docs are needed  
✅ Track data completeness per deal  
✅ Review archived deal outcomes  
✅ Compare current deal to past deals  
✅ Control privacy & learning preferences

### For System
✅ Automatic document routing  
✅ Data quality monitoring  
✅ Module dependency tracking  
✅ Historical intelligence  
✅ Continuous improvement  
✅ Explainable AI (provenance tracking)

---

## 🔜 Next Steps

### Immediate
1. ✅ Run migrations on dev database
2. ✅ Backfill data library
3. ✅ Generate embeddings
4. ✅ Test admin dashboard
5. ✅ Test user settings

### M28 Integration (Phase 1)
6. Wire Gmail Watch → Intelligence Layer
7. Wire Drive Sync → Intelligence Layer
8. Wire Sheets Sync → Intelligence Layer

### Agent Enhancement
9. Update agents to use DocumentRouterService
10. Implement data quality checks before execution
11. Add feedback collection UI
12. Enable pattern-based confidence adjustments

### Advanced Features
13. Historical outcome analysis dashboard
14. Comparable deal recommendations
15. Data quality scoring in UI
16. Embedding regeneration (when models improve)
17. Multi-tenant isolation (for team workspaces)

---

## 📚 Documentation

- **`INTELLIGENCE_LAYER.md`** - Setup guide with examples
- **`DOCUMENT_CATEGORIZATION.md`** - Category system + routing
- **`BUNDLE_OPTIMIZATION.md`** - Frontend performance improvements
- **`INTELLIGENCE_LAYER_COMPLETE.md`** - This file (overview)

---

## 🐛 Troubleshooting

**Q: Embeddings not generating**  
A: Check `OPENAI_API_KEY` is set. Run `npm run embeddings -- --dry-run` to test.

**Q: Semantic search returns no results**  
A: Documents need embeddings. Check `SELECT COUNT(*) FROM unified_documents WHERE content_embedding IS NOT NULL`.

**Q: Agent says "missing required data"**  
A: Check data quality: `await documentRouter.getDealDataQuality(dealId)`. Upload missing docs.

**Q: User preferences not saving**  
A: Check `user_intelligence_preferences` table exists. Verify auth middleware sets `req.user`.

**Q: Admin dashboard shows 0 documents**  
A: Run backfill script. Check `unified_documents` table.

---

**Built:** 2026-03-07  
**Status:** Complete - Ready for deployment  
**Commits:** 5 (Phase 0 foundation → User settings)

