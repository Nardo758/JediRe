# Piece A — `historical_observations` Schema Audit

**Date:** 2026-05-30  
**Task:** Piece A — Vendor Registry Foundation (#1539)  
**Status:** Audit complete; migration written and applied.

---

## What Was Audited

Whether `historical_observations` (migration `20260511_historical_observations.sql`) can serve as
the vendor-agnostic cross-vendor substrate for Piece B's multi-vendor reconciliation — as directed
by the user's architecture decision to use this table rather than create a new
`vendor_market_observations` table.

---

## Existing Schema (pre-migration)

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `msa_id`, `submarket_id`, `parcel_id` | VARCHAR | Geography (sparse) |
| `latitude`, `longitude` | NUMERIC | Point geography |
| `geography_level` | VARCHAR(20) | msa \| submarket \| parcel \| point |
| `observation_date` | DATE | Month being observed (1st of month) |
| `observation_window` | VARCHAR(20) | monthly \| quarterly \| annual |
| `source_signals` | TEXT[] | Array of source names that contributed to this row |
| `signal_freshness_days` | JSONB | Per-signal staleness at observation date |
| `is_subject_property` | BOOLEAN | TRUE for labeled training rows |
| `realization_complete` | BOOLEAN | TRUE once all output windows closed |
| *...input/output columns...* | NUMERIC/INTEGER | Calibration substrate fields |
| `created_at`, `updated_at` | TIMESTAMP | Server timestamps |

**Key finding:** `source_signals TEXT[]` stores an array of signal source names (e.g.
`['mobility_placer', 'qcew_employment']`) but does NOT carry a single vendor identity field.
There is no `source` column, no `vendor_source` column, no license posture field.

---

## What Was Missing for Multi-Vendor Use

For Piece B's cross-vendor reconciliation, when a CoStar submarket observation is aggregated
into `historical_observations`, the row needs to carry:

| Missing | Why needed |
|---------|-----------|
| `vendor_source VARCHAR(50)` | Identity of which vendor wrote this row (e.g. `'costar'`). Without it, vendor-specific queries (Piece B) cannot filter by source. |
| `vendor_data_as_of DATE` | The vendor's data-generation date, separate from `created_at` (server ingestion time). CoStar's exports often lag the market by 30–90 days; freshness computation needs the vendor's date, not when we ingested it. |
| `vendor_license_posture VARCHAR(20)` | Whether the row can be exported externally. Without this, the platform can't enforce CoStar's restriction at render/export time in Piece A Phase 2C. |

---

## Write Target Architecture Decision

`historical_observations` is the **calibration substrate** designed for empirical coefficient
derivation (M07, M35, M36, M37, M38). It is NOT a direct comp store — CoStar comp rows
continue to land in their vendor-specific tables:

| CoStar doc type | Primary write target | Cross-vendor target |
|-----------------|---------------------|---------------------|
| COSTAR_SUBMARKET_EXPORT | `costar_submarket_stats` | `historical_observations` (via aggregation step — **not** direct per-row insert) |
| COSTAR_SALE_COMPS | `market_sale_comps` (`source = 'costar_upload'`) | (none — comps don't aggregate to calibration corpus) |
| COSTAR_RENT_COMPS | `market_rent_comps` (`source = 'costar_upload'`) | (none) |

The cross-vendor write to `historical_observations` happens at aggregation time (a downstream
step, not at upload commit). The vendor registry's `crossVendor` write target field records this
intent for Piece B's implementation.

---

## Migration Applied

`backend/src/database/migrations/20260530_historical_observations_vendor_fields.sql` adds:

- `vendor_source VARCHAR(50)` — nullable; NULL for non-vendor rows
- `vendor_data_as_of DATE` — nullable; vendor's data-generation date
- `vendor_license_posture VARCHAR(20)` — nullable; CHECK constraint enforces valid values

An index on `(vendor_source, observation_date) WHERE vendor_source IS NOT NULL` enables
efficient per-vendor cross-vendor queries for Piece B reconciliation.

---

## What Remains for Piece B

The migration adds the columns; Piece B must:

1. Write to `historical_observations.vendor_source = 'costar'` when aggregating CoStar
   submarket stats into the calibration corpus
2. Wire `vendor_data_as_of` from `costar_submarket_stats.data_as_of` at aggregation time
3. Set `vendor_license_posture = 'restricted'` for all CoStar-sourced rows
4. Build the cross-vendor reconciliation query that compares rows from different vendors
   for the same geography×period

---

## Columns NOT Added (and Why)

| Considered | Decision |
|-----------|----------|
| `divergence_signature JSONB` | Belongs in Piece B — divergence is computed at field resolution time (T-B2/T-B3), not stored in the raw observation substrate. |
| `submarket_name VARCHAR(255)` | Already covered by `submarket_id`; name normalization is Piece B's concern. |
| `deal_id` | `historical_observations` is a platform-wide corpus, not scoped per deal. Deal-scoped vendor data lives in `costar_submarket_stats` which already has `deal_id`. |
