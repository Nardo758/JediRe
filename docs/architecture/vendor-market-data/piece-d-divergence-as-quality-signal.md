# Piece D — Divergence as Quality Signal

**Status:** Aspirational — deferred until Pieces A and B have accumulated 3–6 months of multi-vendor data  
**Date:** 2026-05-30  
**Authority over:** Source reliability profiles, divergence ledger, anomaly detection, vendor quality intelligence

---

## The Premise

When two vendors consistently disagree on the same field over multiple time periods, that pattern is itself a signal:

- **Methodology difference:** CoStar vacancy is trailing 12-month average; Yardi Matrix is point-in-time. Expected divergence, not a data quality problem.
- **Market timing difference:** One vendor's survey was conducted in a different month than the other's. The delta encodes market velocity.
- **Data quality problem:** One vendor consistently has outlier values for a specific submarket. Their methodology is unreliable for that geography.
- **Market uncertainty:** High pairwise divergence across all vendors signals a market in transition where no source has high confidence.

Piece D's goal: build the infrastructure to distinguish these cases and use them to improve underwriting confidence.

---

## Why Deferred

Piece D requires a meaningful volume of multi-vendor data before source reliability profiles can be built. Until Pieces A and B have onboarded at least two vendors and accumulated 3–6 months of observation data, there is no corpus to derive patterns from.

The foundational infrastructure (divergence signature at field resolution time, divergence ledger stub) is operational as a side effect of Piece B.

---

## What Exists Today (as Piece B side effects)

### Per-field divergence signature

Every `getFieldValue` call computes a `DivergenceSignature` when ≥2 source layers are non-null. This signature carries:
- All non-null source layers with their delta vs. the resolved canonical value
- `maxAbsDelta` — the largest pairwise disagreement
- `alertLevel` — `none`, `warn`, or `block` based on per-field thresholds
- `interpretationHint` — why this field tends to diverge (where known)

This runs at read time on every field resolution — it is already producing divergence observations as a byproduct of the Piece B read path.

### Divergence ledger stub

`backend/src/services/field-access/divergence-ledger.stub.ts` — a placeholder that accepts divergence observations but does nothing with them yet. When Piece D activates, this stub becomes the write path for the divergence ledger database table.

### Per-field threshold registry

`backend/src/services/field-access/divergence-thresholds.ts` — configurable thresholds per field (e.g., `exit_cap` threshold is 150 bps). These drive the `alertLevel` computation today and will drive anomaly detection in Piece D.

---

## Target Architecture (aspirational)

### Divergence ledger

A time-series table capturing every material divergence observation:

```sql
divergence_ledger (
  id UUID,
  deal_id UUID,
  field_name VARCHAR,
  observation_date DATE,
  submarket_id VARCHAR,
  vendor_a VARCHAR,
  value_a NUMERIC,
  vendor_b VARCHAR,
  value_b NUMERIC,
  delta_absolute NUMERIC,
  delta_relative NUMERIC,
  alert_level VARCHAR,
  created_at TIMESTAMP
)
```

Populated by the divergence-ledger stub's activation. Every `getFieldValue` call with `alertLevel = 'warn' | 'block'` would write a row.

### Source reliability profiles

Aggregated per-vendor, per-field, per-submarket statistics:
- Median absolute delta vs. platform consensus
- Bias direction (consistently above or below)
- Methodology classification (trailing vs. point-in-time vs. survey-based)

Used to weight vendor contributions in the resolution chain — a vendor with a known 8% high bias on exit cap in Buckhead gets a haircut applied automatically.

### Anomaly detection

When a vendor's divergence from consensus exceeds 2σ for a specific submarket over 3+ consecutive observations, flag it as a data quality anomaly requiring operator review before the data is used in underwriting.

### Vendor quality intelligence

Operator-facing dashboard showing:
- Per-vendor reliability score by field and geography
- Recent anomalies
- Freshness status (days since last observation vs. `freshnessProfileDays`)

---

## Activation Criteria

Piece D activates when:
1. At least 2 vendors are active in `historical_observations` with real data (Piece A: done for CoStar + Yardi Matrix)
2. At least 3 months of dual-vendor observations exist for at least 2 submarkets
3. T-B1 is complete (divergence signatures are being consistently produced)

Estimated activation window: 3–6 months after T-A and T-B1 ship.
