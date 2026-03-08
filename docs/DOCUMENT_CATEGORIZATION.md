# Document Categorization System

## Overview

The Intelligence Layer categorization system enables agents to understand:
- **What type of data** each document contains
- **Which modules** can consume it  
- **What stage** of deal pipeline it's relevant to
- **How to prioritize** it in agent context

## 📂 Document Categories (24 Types)

### Financial Documents (4)
- **OM** (Offering Memorandum) → M01, M09, M15, M22
- **T12** (Trailing 12 Months) → M09, M22
- **RENT_ROLL** → M09, M22
- **PROFORMA** → M09

### Property Documents (4)
- **APPRAISAL** → M01, M15
- **SURVEY** → M01, M03
- **INSPECTION** → M22
- **ENV_REPORT** → M01

### Zoning & Entitlement (4)
- **ZONING_CODE** → M03, M48
- **ZONING_LETTER** → M03
- **SITE_PLAN** → M03, M04
- **ENTITLEMENT_APP** → M03

### Market Intelligence (4)
- **MARKET_REPORT** → M05, M06, M15
- **COMP_SHEET** → M15
- **RENT_SURVEY** → M05, M09
- **DEMO_REPORT** → M05, M06

### Construction & Development (4)
- **COST_ESTIMATE** → M04, M09
- **IMPACT_FEES** → M04, M09
- **PERMIT_TIMELINE** → M03, M04
- **PLANS_SPECS** → M04

### Legal & Closing (3)
- **PSA** (Purchase & Sale Agreement) → M01, M22
- **TITLE_REPORT** → M01
- **LEASE_ABSTRACT** → M09, M22

### Asset Management (4) - For Archived Deals
- **BUDGET** → M22, M09
- **VARIANCE_REPORT** → M22
- **CAPEX_PLAN** → M22
- **TENANT_LEDGER** → M22

## 🎯 How Agents Use Categories

### 1. Auto-Categorization
When a document is indexed, `DocumentRouterService` auto-categorizes it:

```typescript
const category = await documentRouter.autoCategorizeDocument({
  title: "1950 Piedmont T12 2025.pdf",
  documentType: "pdf",
  contentText: extractedText
});
// Returns: "T12"
```

**Rules:**
- Pattern matching on title/filename
- Content analysis (first 1000 chars)
- Document type hints
- Fallback: "UNCATEGORIZED"

### 2. Module Routing
Each category knows which modules can consume it:

```typescript
// T12 document gets routed to:
target_modules: ["M09", "M22"]
```

**Example Flow:**
1. Gmail Watch extracts T12 from broker email
2. Auto-categorized as `T12`
3. Routes to M09 (ProForma) and M22 (Deal Bible)
4. M09 uses it to populate OpEx assumptions
5. M22 archives it in financial section

### 3. Module Data Requirements
Each module defines what it needs:

```typescript
M09 (ProForma):
  required: ["T12", "RENT_ROLL"]
  optional: ["OM", "PROFORMA", "COST_ESTIMATE", "BUDGET"]
  min_confidence: 0.7
```

**Data Quality Check:**
```typescript
const quality = await documentRouter.getDealDataQuality(dealId);
// Returns:
{
  modules: [
    {
      moduleCode: "M09",
      dataQuality: {
        hasAllRequired: true,  // ✓ Has T12 + RENT_ROLL
        missingRequired: [],
        hasOptional: ["OM"],   // Has 1 of 4 optional
        overallScore: 0.875    // 87.5% data quality
      }
    }
  ],
  readyModules: ["M09", "M01"],      // Can run
  blockedModules: ["M03", "M15"]     // Missing required data
}
```

### 4. Agent Context Intelligence
Agents get prioritized documents based on category:

```typescript
// Zoning Agent context (M03):
- REQUIRED: ZONING_CODE (priority 1)
- OPTIONAL: SITE_PLAN, ENTITLEMENT_APP, ZONING_LETTER
- IGNORES: BUDGET, TENANT_LEDGER (asset management docs)
```

**Priority Levels:**
- **1 = Critical** - Agent can't function without it
- **2-4 = Important** - Improves accuracy significantly
- **5 = Normal** - Useful but not critical
- **6-10 = Low** - Nice to have

## 📦 Archive Deals Storage

### When to Archive
- Deal closes (purchased/sold)
- Deal passes (pricing, zoning, market, etc.)
- Deal lost to competition

### What Gets Archived
```sql
archived_deals:
  - Original deal data (snapshot_data JSONB)
  - Outcome data (actual vs projected)
  - Lessons learned
  - All linked documents
  
Archive includes:
  - Financial: OM, T12, RENT_ROLL, APPRAISAL
  - Zoning: ZONING_CODE, SITE_PLAN, ENTITLEMENT_APP
  - Market: MARKET_REPORT, COMP_SHEET, RENT_SURVEY
  - Legal: PSA, TITLE_REPORT, LEASE_ABSTRACT
  - Asset Mgmt: BUDGET, VARIANCE_REPORT, CAPEX_PLAN
```

### Learning from Archives
```typescript
// Find comparable past deals
const comps = await findComparableArchivedDeals(
  'Atlanta',
  'multifamily',
  10
);

// Returns deals with:
- Similar city/property type
- Actual purchase prices
- Actual cap rates
- Timeline data
- What worked / didn't work
```

**Agent Learning:**
```sql
deal_historical_outcomes:
  - Agent predicted: "Should purchase, 7.5% IRR"
  - Actual outcome: "Purchased, 8.2% IRR"
  - Prediction accuracy: 92%
  - Key factors: ["market_shift", "rent_growth_exceeded"]
```

## 🔄 Full Data Flow Example

**Scenario:** Broker emails OM for Atlanta multifamily deal

```
1. Gmail Watch Service
   └─> Extracts attachment: "CBRE_Atlanta_Midrise_OM.pdf"

2. Document Parser Service
   └─> Extracts text + structured data
   └─> { noi_annual: 2400000, unit_count: 300, cap_rate: 0.052 }

3. Intelligence Context Service
   └─> Indexes in unified_documents
   └─> Generates embedding (semantic search)

4. Document Router Service
   └─> Auto-categorizes: "OM"
   └─> Routes to modules: ["M01", "M09", "M15", "M22"]
   └─> Priority: 1 (critical)

5. Agent Execution (M09 ProForma)
   └─> Queries: getDocumentsForModule('M09', { dealId })
   └─> Gets: OM (required: no, but helpful)
   └─> Data quality: 60% (has OM, missing T12/RENT_ROLL)
   └─> Result: "Need more data for accurate projection"

6. User uploads T12 + RENT_ROLL
   └─> Auto-categorized, routed to M09
   └─> M09 data quality: 100%
   └─> Agent re-runs with full context
   └─> Result: "87% confidence projection"

7. Deal closes
   └─> Archive triggered
   └─> All documents (OM, T12, RENT_ROLL) linked to archived_deal
   └─> Actual outcomes recorded
   └─> Available for future comp analysis
```

## 🛠️ Usage Examples

### For Agents
```typescript
// Get data for ProForma analysis
const dataPackage = await documentRouter.getDocumentsForModule('M09', {
  dealId: '123',
  minConfidence: 0.7
});

if (!dataPackage.dataQuality.hasAllRequired) {
  return {
    error: `Missing required data: ${dataPackage.dataQuality.missingRequired.join(', ')}`,
    confidence: 0.5
  };
}

// Use documents
const t12 = dataPackage.documents.find(d => d.category === 'T12');
const noi = t12.structuredData.noi_annual;
```

### For UI
```typescript
// Show data completeness
const quality = await documentRouter.getDealDataQuality(dealId);

<DataQualityMeter 
  score={quality.overallScore}
  readyModules={quality.readyModules}
  blockedModules={quality.blockedModules}
/>

// M09 ProForma: ✓ Ready (has T12 + RENT_ROLL)
// M03 Zoning: ✗ Blocked (missing ZONING_CODE)
// M15 Comps: ✓ Ready (has COMP_SHEET)
```

### For Admin
```typescript
// Monitor uncategorized documents
const uncategorized = await pool.query(`
  SELECT COUNT(*) 
  FROM unified_documents 
  WHERE category_code IS NULL
`);

// Find deals with low data quality
const lowQuality = await pool.query(`
  SELECT deal_capsule_id, AVG(confidence_score)
  FROM unified_documents
  GROUP BY deal_capsule_id
  HAVING AVG(confidence_score) < 0.6
`);
```

## 📈 Benefits

### For Agents
✅ Know exactly what data they have  
✅ Request specific missing documents  
✅ Adjust confidence based on data quality  
✅ Learn from historical outcomes  
✅ Find relevant comps automatically

### For Users
✅ See which modules are ready to run  
✅ Understand what documents are needed  
✅ Track data completeness per deal  
✅ Review archived deal outcomes  
✅ Compare current deal to past deals

### For System
✅ Automatic document routing  
✅ Data quality monitoring  
✅ Module dependency tracking  
✅ Historical intelligence  
✅ Continuous improvement

---

**Next Steps:**
1. Run migrations 084-085
2. Backfill existing documents with categories
3. Wire agents to use DocumentRouterService
4. Build UI for data quality visualization
5. Enable archive deal workflow
