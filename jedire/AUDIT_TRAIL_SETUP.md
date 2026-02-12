# Audit Trail System - Setup & Testing Guide

## Quick Start

### 1. Database Migration

Run the audit trail migration:

```bash
cd /home/leon/clawd/jedire
psql -U postgres -d jedire -f backend/src/database/migrations/028_audit_trail.sql
```

Or if using the migration runner:

```bash
cd backend/src/database/migrations
./run_migration.sh 028_audit_trail.sql
```

### 2. Verify Tables Created

```sql
-- Check tables
\dt *audit*
\dt *assumption_evidence*
\dt *calculation_logs*
\dt *export_snapshots*
\dt *source_credibility*

-- Check views
\dv v_*

-- Check functions
\df calculate_chain_confidence
\df update_source_credibility
```

Expected output:
- 6 tables: audit_chains, assumption_evidence, calculation_logs, source_credibility, event_corroboration, export_snapshots
- 3 views: v_assumption_evidence_chains, v_event_impact_summary, v_deal_audit_summary
- 2 functions: calculate_chain_confidence, update_source_credibility

### 3. Backend Service

The service is already created at:
```
backend/src/services/audit-trail.service.ts
```

No additional setup required. The service uses the existing database pool.

### 4. API Routes

Routes are already registered at `/api/v1/audit/*`

Verify by checking:
```
backend/src/api/rest/index.ts
```

Should include:
```typescript
import auditRoutes from './audit.routes';
...
app.use(`${API_PREFIX}/audit`, auditRoutes);
```

### 5. Frontend Components

Three components created:
- `frontend/src/components/AssumptionDetailModal.tsx`
- `frontend/src/components/AuditReport.tsx`
- `frontend/src/components/EventImpactView.tsx`

#### Integration Example

In your Pro Forma view or Deal page:

```tsx
import AssumptionDetailModal from './components/AssumptionDetailModal';
import AuditReport from './components/AuditReport';

function DealView({ dealId }) {
  const [showAudit, setShowAudit] = useState(false);
  const [selectedAssumption, setSelectedAssumption] = useState(null);

  return (
    <div>
      {/* Show audit trail button */}
      <Button onClick={() => setShowAudit(true)}>
        View Audit Trail
      </Button>

      {/* In assumption list */}
      {assumptions.map(assumption => (
        <div onClick={() => setSelectedAssumption(assumption.id)}>
          {assumption.name}: {assumption.value}
        </div>
      ))}

      {/* Audit Report Modal */}
      {showAudit && (
        <Dialog open={showAudit} onOpenChange={setShowAudit}>
          <DialogContent className="max-w-6xl">
            <AuditReport dealId={dealId} />
          </DialogContent>
        </Dialog>
      )}

      {/* Assumption Detail Modal */}
      {selectedAssumption && (
        <AssumptionDetailModal
          isOpen={!!selectedAssumption}
          onClose={() => setSelectedAssumption(null)}
          assumptionId={selectedAssumption}
          dealId={dealId}
        />
      )}
    </div>
  );
}
```

## Testing

### 1. Create Test Data

```sql
-- Assumes you have a test deal and news event
-- Get IDs:
SELECT id, name FROM deals LIMIT 1;
SELECT id, headline FROM news_events LIMIT 1;

-- Insert test assumption evidence
INSERT INTO assumption_evidence (
  deal_id,
  assumption_id,
  assumption_name,
  assumption_category,
  baseline_value,
  adjusted_value,
  delta_value,
  delta_percentage,
  units,
  primary_event_id,
  event_count,
  financial_impact,
  impact_direction,
  impact_magnitude,
  overall_confidence,
  confidence_level
) VALUES (
  '<deal-id>',  -- Replace with actual deal ID
  gen_random_uuid(),
  'Rent Growth Rate',
  'revenue',
  3.5,
  4.8,
  1.3,
  37.14,
  '%',
  '<event-id>',  -- Replace with actual event ID
  1,
  125000.00,
  'positive',
  'significant',
  0.61,
  'moderate'
) RETURNING id;

-- Note the returned assumption_evidence.id

-- Insert calculation log
INSERT INTO calculation_logs (
  deal_id,
  assumption_evidence_id,
  calculation_type,
  calculation_step,
  input_parameters,
  formula,
  calculation_method,
  output_value,
  output_unit,
  calculation_confidence,
  trade_area_name,
  phase_start_quarter,
  phase_duration_quarters
) VALUES (
  '<deal-id>',
  '<assumption-evidence-id>',  -- Use ID from above
  'demand_signal',
  1,
  '{"jobs": 4500, "conversion_rate": 0.358}'::jsonb,
  'jobs × conversion_rate',
  'Standard employment to housing unit conversion',
  1613,
  'housing units',
  0.90,
  'Lawrenceville',
  'Q2 2027',
  8
);

-- Create audit chain link
INSERT INTO audit_chains (
  deal_id,
  assumption_id,
  chain_type,
  source_entity_type,
  source_entity_id,
  target_entity_type,
  target_entity_id,
  link_confidence,
  chain_confidence
) VALUES (
  '<deal-id>',
  '<assumption-id>',  -- Use assumption_id from assumption_evidence
  'rent_growth',
  'news_event',
  '<event-id>',
  'demand_signal',
  '<assumption-evidence-id>',
  0.85,
  0.85
);
```

### 2. Test API Endpoints

#### Get Evidence Chain for Assumption

```bash
curl -X GET http://localhost:3000/api/v1/audit/assumption/<assumption-id> \
  -H "Authorization: Bearer <token>"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "assumptionId": "...",
    "assumptionName": "Rent Growth Rate",
    "baselineValue": 3.5,
    "adjustedValue": 4.8,
    "delta": 1.3,
    "deltaPercentage": 37.14,
    "units": "%",
    "overallConfidence": 0.61,
    "chain": [
      {
        "type": "event",
        "id": "...",
        "title": "Amazon announces 4,500-job fulfillment center",
        "confidence": 0.85,
        ...
      },
      {
        "type": "signal",
        "id": "...",
        "title": "Demand Signal Calculation",
        "confidence": 0.90,
        ...
      }
    ],
    "financialImpact": 125000
  }
}
```

#### Get Deal Audit Summary

```bash
curl -X GET http://localhost:3000/api/v1/audit/deal/<deal-id> \
  -H "Authorization: Bearer <token>"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "dealId": "...",
    "dealName": "Multifamily Property XYZ",
    "totalAssumptions": 12,
    "confirmedAssumptions": 3,
    "highConfidenceAssumptions": 5,
    "moderateConfidenceAssumptions": 3,
    "lowConfidenceAssumptions": 1,
    "sourceEvents": 8,
    "totalFinancialImpact": 450000,
    "avgConfidence": 0.68,
    "minConfidence": 0.35,
    "totalCalculationSteps": 24,
    "assumptionsByCategory": {
      "revenue": 4,
      "expense": 3,
      "market": 5
    }
  }
}
```

#### Get Event Impact

```bash
curl -X GET http://localhost:3000/api/v1/audit/event/<event-id> \
  -H "Authorization: Bearer <token>"
```

#### Export Audit Report

```bash
curl -X POST http://localhost:3000/api/v1/audit/export/<deal-id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "exportType": "json",
    "includeBaseline": true,
    "includeCalculations": true,
    "title": "Test Audit Report"
  }'
```

### 3. Test Frontend Components

1. **Start the frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

2. **Navigate to a deal with audit data**

3. **Test AssumptionDetailModal:**
   - Click on any adjusted assumption
   - Verify evidence chain displays
   - Check confidence badges render correctly
   - Test node expansion/collapse
   - Click "Defend This Assumption"

4. **Test AuditReport:**
   - Click "View Audit Trail" button
   - Check summary cards populate
   - Test search functionality
   - Adjust confidence threshold slider
   - Try different export formats

5. **Test EventImpactView:**
   - Navigate to news event detail
   - Check "Impact on Deals" section
   - Verify assumption breakdown displays
   - Test click-through to assumption detail

## Troubleshooting

### Database Issues

**Problem:** Tables not created

**Solution:**
```bash
# Check if migration ran
psql -U postgres -d jedire -c "\dt *audit*"

# If not, run migration manually
psql -U postgres -d jedire -f backend/src/database/migrations/028_audit_trail.sql
```

**Problem:** Foreign key constraint errors

**Solution:**
- Ensure news_events table exists
- Ensure deals table exists
- Check that referenced IDs are valid UUIDs

### API Issues

**Problem:** 404 on `/api/v1/audit/*` endpoints

**Solution:**
- Check that audit routes are imported in `backend/src/api/rest/index.ts`
- Verify backend server restarted after adding routes
- Check auth middleware is not blocking requests

**Problem:** "pool is not defined" error

**Solution:**
- Check import in `audit.routes.ts`: `import { pool } from '../../database/connection';`
- Verify database connection is established before routes load

### Frontend Issues

**Problem:** Components not rendering

**Solution:**
- Check UI component imports (Button, Badge, Card, Dialog, etc.)
- Verify axios is installed: `npm install axios`
- Check for console errors

**Problem:** Modal not opening

**Solution:**
- Verify state management for `isOpen` prop
- Check Dialog component is properly imported
- Ensure z-index is set correctly for modal overlay

### Data Issues

**Problem:** No evidence chains found

**Solution:**
- Verify assumption_evidence records exist for deal
- Check primary_event_id is valid
- Ensure calculation_logs link to assumption_evidence_id

**Problem:** Confidence scores all 0 or 1

**Solution:**
- Check source_credibility table has seed data
- Verify calculation_confidence values are set
- Run `SELECT calculate_chain_confidence('<assumption-id>');`

## Integration with Phase 2 Components 1-3

### Component 1: Pro Forma Adjustments

When creating/updating pro forma adjustments, also create audit records:

```typescript
// After applying adjustment to pro forma
await auditService.createAssumptionEvidence({
  dealId,
  assumptionId,
  assumptionName: 'Rent Growth Rate',
  assumptionCategory: 'revenue',
  baselineValue: 3.5,
  adjustedValue: 4.8,
  deltaValue: 1.3,
  deltaPercentage: 37.14,
  units: '%',
  primaryEventId: newsEvent.id,
  financialImpact: 125000,
  impactDirection: 'positive',
  impactMagnitude: 'significant',
  overallConfidence: 0.65,
  confidenceLevel: 'moderate',
});
```

### Component 2: Supply Signal

When calculating supply signals, log the calculation:

```typescript
// After calculating supply impact
await auditService.logCalculation({
  dealId,
  assumptionEvidenceId,
  calculationType: 'supply_signal',
  calculationStep: 2,
  inputParameters: {
    pipeline_units: 1200,
    existing_inventory: 8500,
    construction_timeline: '18 months',
  },
  formula: 'pipeline / existing * 100',
  outputValue: 14.1,
  outputUnit: '%',
  calculationConfidence: 0.75,
  tradeAreaName: 'North Buckhead',
});
```

### Component 3: Risk Scoring

Link risk scores to audit trail:

```typescript
// After calculating risk score
await auditService.createAuditChainLink(
  dealId,
  assumptionId,
  'risk_adjustment',
  'supply_signal',
  supplySignalId,
  'risk_score',
  riskScoreId,
  0.80,
  {
    risk_type: 'supply_oversaturation',
    severity: 'moderate',
  }
);
```

## Next Steps

1. **Implement PDF Export:**
   ```bash
   npm install pdfkit
   ```
   Update `exportAuditReport` method in audit-trail.service.ts

2. **Implement Excel Export:**
   ```bash
   npm install exceljs
   ```
   Create multi-tab workbook in export method

3. **Add Visualization:**
   - D3.js for evidence chain diagrams
   - Chart.js for confidence distributions
   - Timeline view for event impact

4. **Enhance Corroboration:**
   - Auto-detect duplicate events
   - Suggest corroboration opportunities
   - ML-based source credibility prediction

5. **Add Notifications:**
   - Alert when low-confidence assumption impacts major decision
   - Notify when new corroboration upgrades confidence
   - Daily digest of audit trail updates

## Support

- Full documentation: `AUDIT_TRAIL_IMPLEMENTATION.md`
- Database schema: `backend/src/database/migrations/028_audit_trail.sql`
- Service code: `backend/src/services/audit-trail.service.ts`
- API routes: `backend/src/api/rest/audit.routes.ts`
- Frontend: `frontend/src/components/Assumption*.tsx`

---

**Version:** 1.0.0  
**Last Updated:** Phase 2 Component 4 Implementation  
**Status:** Ready for Testing
