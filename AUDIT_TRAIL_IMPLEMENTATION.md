# Audit Trail System - JEDI RE Phase 2 Component 4

## Overview

The Audit Trail System provides full traceability from every financial assumption back to the source news events that modified it. This enables institutional-grade auditability for investment committees, lender due diligence, and regulatory compliance.

## Architecture

### Database Schema

Located in: `backend/src/database/migrations/028_audit_trail.sql`

**Core Tables:**

1. **audit_chains** - Links between entities in the evidence chain
   - Tracks connections from events → signals → calculations → assumptions
   - Maintains confidence scores at each link
   - Calculates cumulative chain confidence

2. **assumption_evidence** - Maps assumptions to source events
   - Baseline vs adjusted values
   - Financial impact calculations
   - Overall confidence levels
   - Event linkages (primary + supporting)

3. **calculation_logs** - Detailed calculation steps
   - Input parameters (JSONB)
   - Formulas and methodologies
   - Geographic context (trade areas)
   - Timing and phasing

4. **source_credibility** - Track source reliability over time
   - Base and current credibility scores
   - Accuracy tracking (confirmed vs false positives)
   - Credibility levels: confirmed, high, moderate, low

5. **event_corroboration** - Links between corroborating events
   - Confirms, updates, or contradicts
   - Confidence boost when multiple sources confirm

6. **export_snapshots** - Saved audit reports
   - File paths and metadata
   - Download tracking
   - Export settings preservation

**Views:**

- `v_assumption_evidence_chains` - Complete evidence chain for assumptions
- `v_event_impact_summary` - Event impact across all deals
- `v_deal_audit_summary` - Deal-level audit metrics

**Functions:**

- `calculate_chain_confidence(assumptionId)` - Product of link confidences
- `update_source_credibility(sourceName)` - Adjust credibility based on accuracy

### Backend Service

Located in: `backend/src/services/audit-trail.service.ts`

**Key Methods:**

```typescript
// Retrieve evidence chains
getAssumptionEvidenceChain(assumptionId: string): Promise<CompleteEvidenceChain>
getDealAuditTrail(dealId: string): Promise<DealAuditSummary>
getEventImpact(eventId: string): Promise<EventImpact>
getDealConfidenceScores(dealId: string): Promise<AssumptionConfidence[]>

// Create audit records
createAuditChainLink(...): Promise<string>
createAssumptionEvidence(evidence: Partial<AssumptionEvidence>): Promise<string>
logCalculation(log: Partial<CalculationLog>): Promise<string>

// Corroboration and credibility
recordCorroboration(primaryEventId, corroboratingEventId, ...): Promise<void>
updateSourceCredibility(sourceName: string, confirmed: boolean): Promise<void>

// Export
exportAuditReport(options: AuditExportOptions): Promise<string>
```

### API Routes

Located in: `backend/src/api/rest/audit.routes.ts`

**Endpoints:**

```
GET  /api/v1/audit/assumption/:assumptionId    - Evidence chain for assumption
GET  /api/v1/audit/deal/:dealId                - Full deal audit trail
GET  /api/v1/audit/event/:eventId              - All assumptions affected by event
GET  /api/v1/audit/confidence/:dealId          - Confidence scores for all assumptions
POST /api/v1/audit/export/:dealId              - Generate audit report (PDF/Excel/JSON)

POST /api/v1/audit/chain-link                  - Create audit chain link
POST /api/v1/audit/assumption-evidence         - Create assumption evidence
POST /api/v1/audit/calculation-log             - Log calculation step
POST /api/v1/audit/corroboration               - Record event corroboration
PUT  /api/v1/audit/source-credibility/:source  - Update source credibility

GET  /api/v1/audit/export-status/:exportId     - Get export status
```

### Frontend Components

#### 1. AssumptionDetailModal.tsx

**Purpose:** Display complete evidence chain for a single assumption

**Features:**
- Visual flow diagram: Event → Signal → Calculation → Adjustment → Assumption
- Expandable nodes with detailed information
- Confidence indicators (colored badges and borders)
- "Defend This Assumption" button for single-assumption export
- Source quality badges

**Usage:**
```tsx
<AssumptionDetailModal
  isOpen={true}
  onClose={handleClose}
  assumptionId="uuid"
  dealId="uuid"
/>
```

**Confidence Visualization:**
- ✅ Confirmed (90%+): Solid green indicators
- 📊 High (70-89%): Solid blue indicators  
- ⚠️ Moderate (40-69%): Dashed yellow indicators
- 👁️ Low (<40%): Ghost gray indicators

#### 2. AuditReport.tsx

**Purpose:** Full deal audit view with tabbed interface

**Features:**
- Summary cards (total assumptions, events, confidence, impact)
- Confidence distribution breakdown
- Tabbed interface:
  - **Assumptions:** Searchable, filterable list with confidence scores
  - **Events:** Event impact timeline
  - **Sources:** Source credibility tracking
  - **Export:** Export options and settings
- Filter by confidence threshold
- Toggle baseline vs adjusted comparison
- Multiple export formats (PDF, Excel, JSON)

**Usage:**
```tsx
<AuditReport dealId="uuid" />
```

#### 3. EventImpactView.tsx

**Purpose:** Show all assumptions changed by a specific event

**Features:**
- Event header with credibility badge
- Impact summary (deals affected, assumptions changed, financial impact)
- Impact breakdown by deal
- Visual impact distribution chart
- Click-through to assumption detail

**Usage:**
```tsx
<EventImpactView eventId="uuid" onClose={handleClose} />
```

## Source Credibility System

### Credibility Levels

| Level | Source Type | Confidence Weight | Display |
|-------|------------|------------------|---------|
| Confirmed | 2+ independent sources, official filing | 100% | ✅ Solid indicators |
| High | Single authoritative source (SEC, credible news) | 80% | 📊 Standard indicators |
| Moderate | Credible reporting, partially quantified | 50% | ⚠️ Dashed indicators |
| Low | Rumor, social media, unquantified | 20% | 👁️ Ghost indicators |

### Credibility Tracking

Sources are seeded with base credibility scores:
- SEC EDGAR, Census Bureau, BLS: 100% (confirmed)
- WSJ, Bloomberg, Reuters: 85% (high)
- Local news, CoStar: 70-75% (high)
- Social media, unverified tips: 20-35% (low)

**Dynamic Updates:**
- Confirmed events: +5% credibility (max 100%)
- False positives: -10% credibility
- Accuracy rate = confirmed / total events
- Corroboration from multiple sources upgrades confidence

## Evidence Chain Flow

### Example: Rent Growth Adjustment

```
1. News Event
   📰 Amazon 4,500-job fulfillment center announcement
   Source: Atlanta Business Chronicle (credibility: 85%)
   Date: Feb 8, 2026
   Confidence: 0.85
   ↓

2. Demand Signal Calculation
   📊 4,500 jobs × 0.358 conversion rate = 1,613 housing units
   Trade Area: Lawrenceville (impact weight: 0.85)
   Phased over 8 quarters starting Q2 2027
   Confidence: 0.90
   ↓

3. Demand-Supply Ratio
   📈 Net new demand: +16.1% over 2 years
   Existing inventory: 10,000 units
   New supply pipeline: 400 units (4%)
   Net pressure: +12.1% undersupplied
   Confidence: 0.85
   ↓

4. Rent Growth Adjustment
   🎯 Elasticity coefficient: 0.75% per 1% demand-supply shift
   Adjustment: 12.1% × 0.75 = +9.1% over 2 years
   = +4.3% annualized, applied starting Q2 2027
   Confidence: 0.80
   ↓

5. Pro Forma Impact
   💰 Baseline: 3.5%
   Adjustment: +4.3% phased
   Blended: 4.8% over hold period
   
Chain Confidence: 0.85 × 0.90 × 0.85 × 0.80 = 0.52 (52%)
```

## Integration Points

### Phase 1 Dependencies
- News Events (news_events table)
- Demand Signal Service
- Geographic Assignment Service

### Phase 2 Component Dependencies
- Pro Forma Adjustments Service (Component 1)
- Supply Signal Service (Component 2)
- Risk Scoring Service (Component 3)

### Data Flow

1. **News Event Captured** → Phase 1
2. **Demand/Supply Signal Calculated** → Phase 1 & Phase 2 Component 2
3. **Pro Forma Adjustment Applied** → Phase 2 Component 1
4. **Audit Trail Recorded** → Phase 2 Component 4 (this system)
   - Create assumption_evidence record
   - Log calculation steps
   - Create audit chain links
   - Calculate confidence scores

## Export Formats

### JSON Export

Machine-readable format containing:
- Deal audit summary
- Complete evidence chains for all assumptions
- Calculation logs
- Source credibility data

**Use case:** API integration, custom reporting

### Excel Workbook

Multi-tab spreadsheet:
- **Assumptions:** Baseline, adjusted, delta, confidence
- **Events:** Chronological event timeline with impact
- **Calculations:** Detailed formulas and parameters
- **Sources:** Credibility scores and track records

**Use case:** Financial analysis, modeling review

### PDF Report

Professional document containing:
- Executive summary
- Assumption comparison table
- Event timeline with impact visualization
- Detailed evidence chains (one per assumption)
- Source citations
- Confidence scoring methodology

**Use case:** Investment committee presentations, lender due diligence

## Usage Guide

### For Underwriters

**Defending an Assumption:**
1. Open deal in pro forma view
2. Click any adjusted assumption
3. AssumptionDetailModal opens with evidence chain
4. Review each step: Event → Signal → Calculation → Impact
5. Click "Defend This Assumption" to export evidence
6. Share PDF with lender/IC

**Filtering Low-Confidence Assumptions:**
1. Open Audit Report for deal
2. Go to Assumptions tab
3. Adjust "Min Confidence" slider to 70%
4. Review only high-confidence assumptions
5. Investigate any low-confidence critical assumptions

### For Asset Managers

**Tracking Event Impact:**
1. News event captured in system
2. Open EventImpactView for that event
3. See all deals affected
4. Review which assumptions changed
5. Assess total portfolio impact

**Quarterly Reporting:**
1. Open AuditReport for deal
2. Go to Export tab
3. Select PDF format
4. Include baseline comparison
5. Generate report for LP quarterly update

### For Investment Committees

**Due Diligence Review:**
1. Request full audit trail from underwriter
2. Review confidence distribution (should be >70% high/confirmed)
3. Examine low-confidence assumptions
4. Verify source credibility
5. Challenge assumptions with weak evidence chains

## API Integration Examples

### Get Evidence Chain for Assumption

```typescript
const response = await fetch(`/api/v1/audit/assumption/${assumptionId}`);
const { data } = await response.json();

console.log(data.assumptionName);
console.log(`Confidence: ${data.overallConfidence * 100}%`);
data.chain.forEach(node => {
  console.log(`${node.type}: ${node.title} (${node.confidence * 100}%)`);
});
```

### Export Audit Report

```typescript
const response = await fetch(`/api/v1/audit/export/${dealId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    exportType: 'pdf',
    includeBaseline: true,
    includeCalculations: true,
    confidenceThreshold: 0.5,
    title: 'Q4 2026 Audit Report',
  }),
});

const { data } = await response.json();
console.log(`Export ID: ${data.exportId}`);
```

### Record Event Corroboration

```typescript
// When a second source confirms a news event
await fetch('/api/v1/audit/corroboration', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    primaryEventId: 'event-uuid-1',
    corroboratingEventId: 'event-uuid-2',
    corroborationType: 'confirms',
    corroborationStrength: 1.0,
    details: 'Bloomberg confirmed Amazon announcement',
  }),
});
// System automatically upgrades confidence by +10%
```

### Update Source Credibility

```typescript
// When a prediction proves accurate
await fetch('/api/v1/audit/source-credibility/Atlanta Business Chronicle', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    confirmed: true,
  }),
});
// System recalculates credibility score and level
```

## Testing Audit Trail

### Seed Test Data

```sql
-- Create a test assumption evidence record
INSERT INTO assumption_evidence (
  deal_id, assumption_id, assumption_name, assumption_category,
  baseline_value, adjusted_value, delta_value, delta_percentage, units,
  primary_event_id, financial_impact, impact_direction, impact_magnitude,
  overall_confidence, confidence_level
) VALUES (
  'deal-uuid', 'assumption-uuid', 'Rent Growth Rate', 'revenue',
  3.5, 4.8, 1.3, 37.14, '%',
  'event-uuid', 125000, 'positive', 'significant',
  0.61, 'moderate'
);

-- Create calculation log
INSERT INTO calculation_logs (
  deal_id, assumption_evidence_id, calculation_type, calculation_step,
  input_parameters, formula, output_value, output_unit,
  calculation_confidence, trade_area_name, phase_start_quarter
) VALUES (
  'deal-uuid', 'evidence-uuid', 'demand_signal', 1,
  '{"jobs": 4500, "conversion_rate": 0.358}',
  'jobs × conversion_rate',
  1613, 'housing units',
  0.90, 'Lawrenceville', 'Q2 2027'
);
```

### Frontend Testing

1. **Test AssumptionDetailModal:**
   - Click assumption in pro forma
   - Verify evidence chain loads
   - Check confidence badges display correctly
   - Test node expansion/collapse
   - Test "Defend This Assumption" export

2. **Test AuditReport:**
   - Load deal audit report
   - Verify summary cards populate
   - Test search and filtering
   - Test confidence threshold slider
   - Test all export formats

3. **Test EventImpactView:**
   - Load event impact view
   - Verify deals affected count
   - Check assumption breakdown
   - Test impact distribution chart
   - Test click-through to assumption detail

## Performance Considerations

### Indexing

Key indexes for query performance:
- `idx_assumption_evidence_deal` - Deal lookup
- `idx_audit_chains_assumption` - Chain traversal
- `idx_calculation_logs_evidence` - Calculation retrieval
- `idx_event_corroboration_primary` - Corroboration lookup

### Caching Strategy

Consider caching:
- Deal audit summaries (invalidate on assumption change)
- Source credibility scores (refresh daily)
- Evidence chains (invalidate on chain modification)

### Query Optimization

- Use views for complex joins
- Limit calculation log detail in summary views
- Paginate assumption lists for large deals
- Lazy-load evidence chain details

## Future Enhancements

1. **Real-time Updates:**
   - WebSocket notifications when event impacts deal
   - Live confidence score updates as corroboration occurs

2. **Machine Learning:**
   - Predict credibility of new sources
   - Suggest corroboration opportunities
   - Auto-classify event types

3. **Visualization:**
   - Interactive evidence chain diagrams
   - Confidence heatmaps across portfolio
   - Timeline view of assumption evolution

4. **Collaboration:**
   - Comment on evidence chain steps
   - Challenge assumptions with counter-evidence
   - Approval workflows for low-confidence assumptions

5. **Advanced Exports:**
   - PowerPoint deck generation
   - Custom report templates
   - Scheduled automated exports

## Troubleshooting

### Common Issues

**Evidence chain not loading:**
- Check assumption_evidence record exists for assumption
- Verify primary_event_id is valid
- Check calculation_logs link to assumption_evidence

**Low confidence scores:**
- Review source credibility levels
- Check for corroborating events
- Verify calculation confidence values

**Export failures:**
- Check export_snapshots table for error logs
- Verify file path permissions
- Check export format support (JSON implemented, PDF/Excel TODO)

**Missing audit data:**
- Ensure audit trail service integrated with pro forma adjustments
- Check calculation logging in demand/supply signal services
- Verify event linkage in assumption creation

## Support

For issues or questions:
- Check migration logs: `backend/src/database/migrations/028_audit_trail.sql`
- Review service implementation: `backend/src/services/audit-trail.service.ts`
- Test API endpoints: `backend/src/api/rest/audit.routes.ts`
- Inspect frontend components: `frontend/src/components/Assumption*.tsx`

---

**Last Updated:** Phase 2 Component 4 Implementation
**Version:** 1.0.0
**Status:** Production Ready (PDF/Excel exports require additional libraries)
