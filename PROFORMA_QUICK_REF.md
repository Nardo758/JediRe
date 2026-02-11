# Pro Forma Adjustments - Quick Reference

**Phase 2, Component 1 | Status: Production Ready (Rental Strategy)**

## 🚀 Quick Start

### 1. Apply Migration

```bash
psql -d jedire -f migrations/025_proforma_adjustments.sql
```

### 2. Import in Code

```typescript
import { proformaAdjustmentService } from './services/proforma-adjustment.service';
```

### 3. Initialize for a Deal

```typescript
await proformaAdjustmentService.initializeProForma(
  dealId,
  'rental'
);
```

### 4. Recalculate on News Event

```typescript
await proformaAdjustmentService.recalculate({
  dealId,
  triggerType: 'demand_signal',
  triggerEventId: demandEventId
});
```

## 📊 Assumption Types

| Assumption | Unit | Typical Range | Formula |
|------------|------|---------------|---------|
| `rent_growth` | % annual | 0-10% | Demand-Supply Elasticity |
| `vacancy` | % | 0-20% | Employment Conversion |
| `opex_growth` | % annual | 0-10% | Direct Passthrough |
| `exit_cap` | % | 4-8% | Momentum + Risk |
| `absorption` | leases/mo | 1-30 | Demand × Supply Factor |

## 🔧 API Endpoints

```bash
# Get current assumptions
GET /api/v1/proforma/:dealId

# Recalculate
POST /api/v1/proforma/:dealId/recalculate
{
  "triggerType": "periodic_update"
}

# Override assumption
PATCH /api/v1/proforma/:dealId/override
{
  "assumptionType": "rent_growth",
  "value": 5.5,
  "reason": "Conservative estimate"
}

# Get comparison
GET /api/v1/proforma/:dealId/comparison

# Export
GET /api/v1/proforma/:dealId/export?format=csv
```

## 🧮 Adjustment Formulas

### Rent Growth

```typescript
adjustment = demandDeltaPct × rentElasticity
// demandDeltaPct: % change in demand-supply ratio
// rentElasticity: 0.5 (loose) to 1.2 (tight)
```

**Trigger:** Demand change > ±5% OR supply pipeline > 200 units

### Vacancy

```typescript
adjustment = -(employeeCount × 0.40 × 0.95) / totalInventory × 100
// 0.40 = housing conversion rate
// 0.95 = occupancy factor
```

**Trigger:** Major employer change (>500 employees)

### OpEx Growth

```typescript
adjustment = announcedChangePct
// Direct passthrough from news
```

**Trigger:** Insurance/tax/utility rate change

### Exit Cap

```typescript
adjustment = compressionBps / 100 + riskPremium
// compressionBps: -10 to -25 (strong markets)
```

**Trigger:** Momentum score > 55

### Absorption

```typescript
adjustment = baseline × (1 + demandDelta) × (1 - supplyFactor)
```

**Trigger:** New demand driver or competitive supply

## 🎨 Frontend Component

```tsx
import { ProFormaComparison } from '@/components/deal/ProFormaComparison';

<ProFormaComparison dealId={deal.id} />
```

**Features:**
- Baseline vs. adjusted comparison
- Color-coded differences
- Click to see news events
- Override modal
- Export (JSON/CSV/Markdown)

## 📡 Kafka Integration

```typescript
// Start consumer
import proformaConsumer from './services/kafka/proforma-consumer';

await proformaConsumer.start();
```

**Topics:**
- `signals.demand.updated` - Auto-recalculate on demand changes
- `signals.supply.updated` - Phase 2.1

## 🧪 Testing

```bash
# Run test suite
./test-proforma-adjustments.sh

# Manual test
curl http://localhost:5000/api/v1/proforma/:dealId/comparison
```

## 📝 Common Queries

### Get all adjustments for a deal

```sql
SELECT * FROM recent_adjustments
WHERE deal_id = 'your-deal-id'
ORDER BY created_at DESC
LIMIT 10;
```

### Find deals with large adjustments

```sql
SELECT 
  d.name,
  aa.assumption_type,
  aa.adjustment_delta,
  aa.created_at
FROM assumption_adjustments aa
JOIN proforma_assumptions pa ON pa.id = aa.proforma_id
JOIN deals d ON d.id = pa.deal_id
WHERE ABS(aa.adjustment_delta) > 1.0
ORDER BY ABS(aa.adjustment_delta) DESC;
```

### Get pro forma summary

```sql
SELECT * FROM proforma_summary
WHERE deal_id = 'your-deal-id';
```

## ⚠️ Troubleshooting

### Adjustment not triggering?

1. Check trigger thresholds: `SELECT * FROM adjustment_formulas WHERE assumption_type = 'rent_growth';`
2. Verify demand signal exists: `SELECT * FROM demand_events WHERE news_event_id = '...';`
3. Check geographic assignment: `SELECT * FROM trade_area_event_impacts WHERE event_id = '...';`

### Values seem wrong?

1. Check `calculation_inputs` in `assumption_adjustments` table
2. Review baseline values: `SELECT * FROM proforma_assumptions WHERE deal_id = '...';`
3. Verify market data: Total inventory, occupancy, etc.

### Performance slow?

1. Add indexes: All FKs should be indexed
2. Batch recalculations: Use job queue for >10 deals
3. Cache market baseline data

## 🔐 Best Practices

1. **Always provide override reasons** - Creates audit trail
2. **Review adjustments weekly** - Catch outliers early
3. **Update baselines quarterly** - Keep market data fresh
4. **Export before major decisions** - Share with lenders/investors
5. **Monitor confidence scores** - Flag low-confidence adjustments

## 📚 Full Documentation

See `PROFORMA_ADJUSTMENTS.md` for:
- Complete formula reference
- Test scenarios
- Architecture diagrams
- Extending to other strategies

## 🎯 Key Metrics

- **Adjustment Frequency:** ~2-5 per deal per month
- **Typical Rent Growth Adjustment:** ±0.5-2.0%
- **Typical Vacancy Adjustment:** ±2-10%
- **Recalculation Time:** <500ms per deal
- **Confidence Threshold:** 60+ (auto-apply), <60 (flag for review)

## 📞 Support

- **Docs:** `/docs/proforma-adjustments/`
- **API:** `/api/v1/proforma` (OpenAPI spec)
- **Issues:** File in repo with `proforma` label

---

**Quick Tip:** Use `GET /comparison` to see everything at once - baseline, adjusted, differences, and news events all in one call!
