# Vendor Market Data Architecture — Overview

**Status:** Active  
**Date:** 2026-05-30  
**Authority over:** Multi-vendor ingestion, cross-vendor reconciliation, agent synthesis interface, divergence as quality signal  
**Supersedes:** Any prior single-vendor (CoStar-only) market data design references

---

## Why This Document Exists

The platform began with one market data vendor (CoStar). As the platform scales, operators will bring in multiple vendor sources — Yardi Matrix, CBRE EA, RealPage, custom exports. These sources disagree on rent, vacancy, cap rate, and pipeline supply. That disagreement is not noise to suppress; it is signal to surface.

This document is the anchor for four interdependent architectural pieces (A–D) that together define how the platform:
1. **Ingests** market data from multiple vendors without vendor-specific code spread across the codebase (Piece A)
2. **Reconciles** cross-vendor field values into one canonical read path (Piece B)
3. **Exposes** reconciled market data to AI agents for synthesis (Piece C)
4. **Uses divergence** between sources as an explicit quality signal (Piece D)

---

## Core Architectural Commitments

### Commitment 1 — LayeredValue is universal

Every field that can come from multiple sources — rent, vacancy, cap rate, pipeline, absorption — is stored as a `LayeredValue<T>`. This means every value carries its source, its confidence, and its resolution method alongside the number itself.

**Current status:** Operational with one caveat. The `agent` resolution layer (Layer 3 in the read chain) is implemented in `get-field-value.service.ts` but was historically undocumented in the seeder's `FIELD_PRIORITIES` constant. This is a documentation gap, not an implementation gap — the seeder's `FIELD_PRIORITIES` governs seed-time source priority (t12 vs. rent_roll vs. om), which is a separate concern from the read-time resolution chain.

### Commitment 2 — Snapshot-at-ingestion architecture

When an agent runs and produces underwriting outputs, those outputs are stored as a snapshot (`proforma_snapshot` in `deal_underwriting_snapshots`). The snapshot captures the agent's market view at a point in time. Subsequent reads do not re-run the agent — they read the snapshot through the resolution chain.

This is an intentional architectural decision: it preserves auditability and prevents silent drift. Engine A audit (#1528) confirmed this is deliberate.

### Commitment 3 — Trajectory math for hold-year fields

Fields that evolve over the hold period (GPR, LTL, vacancy, OpEx) use trajectory math rather than flat Year 1 assumptions extended forward. The trajectory is seeded from the lease-roll starting state and moves toward a stabilized endpoint based on market benchmarks.

**Current status:** Partially operational. GPR/vacancy/OpEx/Other Income support per-year overrides (Task #1521). LTL trajectory is in-flight (T-B1 dependency on #1536). Vacancy is partially M07-dependent.

### Commitment 4 — Cross-surface read consistency

Every surface that displays a field value (Pro Forma, Valuation Grid, Returns tab, Validation Grid, Decision tab) MUST resolve it through the canonical `getFieldValue` service. No surface reads `deal_assumptions.year1[field].resolved` directly from SQL.

**Current status:** In-flight. Tasks #1541 and #1563 wired the Valuation Grid. T-B1 covers remaining surfaces.

### Commitment 5 — Layer 1 override universally wired

Every agent-authored field must have a complete override path: the operator can pin any value, the pin persists to `year1[field].override`, and the `getFieldValue` resolution chain returns the pin as the canonical value for all downstream surfaces.

**Current status:** In-flight. 7 fields fully wired, 3 partially wired, 5 without override path per Deal Details UI/Backend Audit §7 (count inferred from that audit, not re-verified in corpus-sweep).

### Commitment 6 — Deal completeness is first-class

Missing or low-confidence inputs are surfaced to the operator explicitly rather than silently degraded. The CompletenesBadge and signal registry (backend: `backend/src/services/deal-completeness/signal-registry.ts`) are the operational infrastructure. The frontend badge is served by the frontend component.

**Current status:** Partially operational. `signal-registry.ts` confirmed operational. Frontend CompletenesBadge exists. Per-surface completeness coverage is incomplete (10+ surfaces still silently degrade — count inferred from Deal Details audit, not re-verified).

---

## The Four Pieces — Summary

### Piece A — Vendor Abstraction

Goal: Any new vendor can be onboarded by adding one file to the vendor registry. Zero changes to the classifier, the upload routes, or any other shared infrastructure.

Proof: Yardi Matrix was onboarded (`yardi-matrix.vendor.ts` + `yardi-matrix-parser.ts`) with zero changes to the classifier or CoStar upload route. See `docs/architecture/a2-abstraction-gap-analysis.md`.

Full spec: `docs/architecture/vendor-market-data/piece-a-vendor-abstraction.md`

### Piece B — Field-Level Reconciliation

Goal: One logical value, one canonical read path. When two vendors disagree on a field, the platform picks the canonical value through the resolution chain and surfaces the disagreement as a CONTESTED badge rather than hiding it.

Key artifact: `backend/src/services/field-access/get-field-value.service.ts`  
Convention doc: `docs/architecture/cross-surface-read-consistency.md`

Full spec: `docs/architecture/vendor-market-data/piece-b-field-reconciliation.md`

### Piece C — Agent Synthesis Interface

Goal: AI agents cite their sources, acknowledge data gaps, and author findings that the operator can override at field level, citation level, finding level, or confidence level.

Full spec: `docs/architecture/vendor-market-data/piece-c-agent-synthesis.md`

### Piece D — Divergence as Quality Signal

Goal: When vendors persistently disagree on the same field, that pattern is itself a signal about data quality, market uncertainty, or methodology differences. Over time, the platform builds source reliability profiles per field.

**Current status:** Aspirational. Deferred until Pieces A and B have accumulated 3–6 months of multi-vendor data. The divergence ledger stub exists at `backend/src/services/field-access/divergence-ledger.stub.ts`.

Full spec: `docs/architecture/vendor-market-data/piece-d-divergence-as-quality-signal.md`

---

## The `historical_observations` Substrate

All vendor market data ultimately lands in `historical_observations` for calibration and cross-vendor comparison. This table was extended with three vendor-specific columns to support multi-vendor use (migration `20260530_historical_observations_vendor_fields.sql`):

| Column | Purpose |
|---|---|
| `vendor_source VARCHAR(50)` | Which vendor wrote this row (e.g. `'costar'`, `'yardi_matrix'`) |
| `vendor_data_as_of DATE` | Vendor's data-generation date (separate from server ingestion timestamp) |
| `vendor_license_posture VARCHAR(20)` | Whether the row can be exported externally (`'platform_only'`, `'shareable'`) |

CoStar comp rows continue to land in their vendor-specific tables (`market_sale_comps`, `comp_properties`). The `historical_observations` rows are calibration substrate — they drive M07, M35, M36, M37, M38 coefficient derivation and cross-vendor field comparison.

---

## Read Path — Resolution Chain

For any field that can be multi-sourced, the resolution chain (implemented in `get-field-value.service.ts`) is:

```
1. Operator override   (year1[field].override — Layer 1, always wins)
       ↓ if null
2. Engine A formula    (for computed aggregates: noi, egi, noi_after_reserves)
       ↓ if not a computed aggregate, or deps missing
3. Agent layer         (year1[field].agent — agent-written value)
       ↓ if null
4. Stored resolved     (year1[field].resolved — seeder's best source per FIELD_PRIORITIES)
```

The seeder's own source priority (which of t12, rent_roll, om, broker to prefer per field) is captured in `FIELD_PRIORITIES` in `proforma-seeder.service.ts`. This governs what lands in Layer 4 at seed time. It is a separate concern from the read-time chain above.

---

## Task Map for This Architecture

| Workstream | Key tasks | Status |
|---|---|---|
| Piece A foundation | task-1539 (vendor registry) | Merged |
| Piece A abstraction proof | task-1544 (Yardi Matrix) | Merged |
| Piece A upload UI | task-1554 (vendor-aware upload tab) | Queued |
| Piece A submarket surface | task-1555 (surface in submarket view) | Queued |
| Piece A integration test | task-1556 (end-to-end pipeline test) | Queued |
| Piece B cross-surface reads | task-1541 (T-B1) | Queued — blocked on LTL+Other Income |
| Piece B divergence surfacing | task-1542 (T-B2) | Queued — follows T-B1 |
| Piece C deal completeness | task-1543 (C1 framework) | Merged |
| Piece D divergence ledger | — | Aspirational |
