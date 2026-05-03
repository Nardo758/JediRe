# Rent Roll Analytics Framework — Implementation Gap Analysis

> Companion to [`RENT_ROLL_ANALYTICS_FRAMEWORK.md`](./RENT_ROLL_ANALYTICS_FRAMEWORK.md). Walks every section of the framework and labels each piece **EXISTS / PARTIAL / MISSING** with concrete file pointers. This is the planning baseline — every follow-up rent-roll project task should cite a row in this table and either close the gap or extend it.
>
> Conventions:
> - **EXISTS** — code in main implements the spec section as written. Pointer lists what implements it.
> - **PARTIAL** — code covers part of the spec or covers it in a degraded form. Pointer lists what's there + a one-line note on what's missing.
> - **MISSING** — no implementation. Pointer lists where it would naturally land.
> - File pointers use `path:line-range` per repo conventions. `~` prefix means "approximately".
>
> Last updated: 2026-05-03 (Task #518). Tasks #514 (rent-roll quality scorecard + UNKNOWN bucket) and #517 (per-file re-extract action) are the most recent merges that landed in Layers 2 and 5 — cited inline below.

---

## Layer 1 — Extraction (§2)

### 2.1 / 2.2 — PMS detection + variant matrix

| Spec row | Status | Pointer / note |
|---|---|---|
| Step 1: Source PMS detection (Yardi / RealPage / Entrata / AppFolio / ResMan / Generic / Unknown) | **PARTIAL** | `backend/src/services/rent-roll/format-detector.service.ts:22-92` only distinguishes Yardi vs Generic via `YARDI_FINGERPRINTS`; the other four PMS classes are unimplemented and the format enum (`yardi_csv \| yardi_xlsx \| generic_csv \| generic_xlsx`) has no slot for them. |
| Step 2: Variant detection (STANDARD / RRWLC / OCCUPANCY_ONLY / WIDE) | **PARTIAL** | `backend/src/services/document-extraction/parsers/rent-roll-parser.ts:64-100` (`detectLayout`) discriminates **`yardi_rrwlc`** vs **`generic_flat`** only. OCCUPANCY_ONLY and WIDE are not modeled; STANDARD is collapsed into `generic_flat`. |
| Confidence < 0.85 surfaces to user before commit | **MISSING** | Format detector returns `confidence` (`format-detector.service.ts:18,61,78`) but no upload-time gating consumes it. There is no dry-run / preview step. |
| Yardi STANDARD parser (`rent-roll-parser.ts`) | **EXISTS** | `backend/src/services/document-extraction/parsers/rent-roll-parser.ts` (875 lines, dual-mode). |
| Yardi RRWLC parser (`rrwlc-parser.ts`) | **EXISTS (inlined)** | RRwLC logic is inlined into `rent-roll-parser.ts:163-338` (`parseYardiRRwLC`) including dynamic header detection (`detectYardiColumns:114-158`). The spec's separate `rrwlc-parser.ts` file does not exist; this is structurally fine but worth noting. |
| Yardi OCCUPANCY_ONLY graceful degradation | **MISSING** | No path. A Yardi export with no rent column today falls into `generic_flat` and silently produces $0 rents. |
| RealPage / Entrata / AppFolio / ResMan parsers | **MISSING** | None. |
| Generic CSV parser via `field_mapper` with synonyms | **PARTIAL** | `backend/src/services/rent-roll/field-mapper.service.ts:32-67` ships Yardi + generic alias tables and the `parseAndStore` pipeline (`rent-roll-parser.service.ts:40-159`) wires detector → mapper → validator → DB. **Gap:** this pipeline is reachable only via `POST /api/v1/calibration/rent-roll/upload` (`backend/src/api/rest/m07-calibration.routes.ts:129`); the standard upload path (`auto-extract-on-upload.ts` → `processDocument` → `parseRentRoll`) ignores it entirely. So today there are effectively two disconnected rent-roll pipelines. |
| Manual column-mapping UI for low-confidence | **MISSING** | No frontend route, no API, no persisted user-mapping override. |

### 2.3 — Normalized output schema

| Table | Status | Pointer / note |
|---|---|---|
| `rent_roll_snapshots` | **PARTIAL** | Created at runtime (no numbered SQL migration ships it; `rg "CREATE TABLE.*rent_roll_snapshots"` returns no SQL hits — written by application init code). Columns present per `rent-roll-parser.service.ts:90-104`: `deal_id, original_filename, file_path, file_format, row_count, extraction_confidence, snapshot_date, status, derived_metrics`. **Missing:** `property_id`, `uploaded_by`, `source_s3_key`, `detected_pms`, `detected_variant`, `detection_confidence`, `parser_version`, `unit_count_expected`, `quality_verdict`, `notes`. The framework's enum types (`pms_enum`, `variant_enum`, `quality_verdict_enum`) do not exist. |
| `lease_events` | **PARTIAL** | Two tables coexist: `leasing_events` (engine join target, `rent-roll-parser.service.ts:138`) and `lease_events` (normalized log, line 139). Column set per `colList` (lines 111-114) covers identity + dates + status + rent + concessions + `row_confidence`. **Missing:** `field_status` JSONB (the §2.4 contract), `extraction_method`, `human_review_needed`, `original_row_ref`. |
| `charge_lines` | **MISSING** | No table. RRwLC charge codes are aggregated into capsule JSON (`rent-roll-parser.ts:477-495`, `data-router.ts:1083`) and lost as per-unit per-charge rows. This is the single biggest storage gap — every Layer 3 ancillary metric (parking_attach_rate, pet_attach_rate, ancillary_pct_of_revenue) loses unit-level resolution. |
| `rent_roll_quality` (denormalized field-status cache) | **MISSING** | No table. Per-snapshot column-coverage scorecard exists in capsule JSON only (`rent-roll-parser.ts:618-649` `column_coverage`) — not persisted as a queryable row, so consumers can't filter by quality verdict. |
| `rent_roll_derived` (Layer 3 metrics cache) | **PARTIAL** | Cached as `rent_roll_snapshots.derived_metrics` JSONB (`rent-roll-derivations.service.ts:65-72`). **Gap:** denormalized into a single column rather than the per-dimension table the spec calls for; cannot index or join per metric. |
| `rent_roll_diffs` (Layer 4 cache) | **MISSING** | No table, no service. |

### 2.4 — Per-row extraction confidence

| Field | Status | Pointer / note |
|---|---|---|
| `extraction_confidence` per row | **EXISTS** | `rent-roll-validator.service.ts:25-85` writes `row_confidence` to every event; pipeline aggregates to snapshot via `computeSnapshotConfidence` (`:87-93`) and persists in `extraction_confidence` column (`rent-roll-parser.service.ts:102`). |
| `extraction_method` ("structured" / "ocr" / "fuzzy") | **MISSING** | Not modeled. |
| `human_review_needed` | **PARTIAL** | Surfaced in capsule extras (`rent-roll-parser.ts:714` `human_review_needed: true`) only when columns are unreadable. Not stored per row. |
| `original_row_ref` | **MISSING** | No back-pointer. |
| `field_status` JSONB per row | **PARTIAL** | Per-snapshot `column_coverage` scorecard is computed (`rent-roll-parser.ts:618-707`, **Task #514**) with statuses `ok / fallback / all_null / missing / not_supported`. **Gap:** scorecard is per-snapshot, not per-row. The spec wants both. |

---

## Layer 2 — Quality Gating (§3)

### 3.1 — Field criticality classes

| Class | Status | Pointer / note |
|---|---|---|
| Class A (identity hard-fail) | **PARTIAL** | `rent-roll-validator.service.ts:30-42` deducts confidence for missing identity fields but never marks the snapshot FAILED. There is no enum / no versioned config table per the spec's "Session 2 — define field criticality in a versioned config table." |
| Class B (>10% missing → FAILED) | **PARTIAL** | `rent-roll-parser.ts:716-748` (Task #514 hard-fail gate) hard-fails when `market_rent` or `amount` columns are `'missing'` or `'all_null'`. Threshold is binary on the column-coverage status, not "% of occupied rows missing." |
| Class C (>20% missing → PARTIAL) | **MISSING** | No PARTIAL verdict logic. The capsule today has only OK / hard-fail. |
| Class C-X (cross-doc reconcilable) | **MISSING** | Concessions are not classified as C-X; the cross-document concession reconciliation rule (§3.5) is not implemented. |
| Class D (graceful degradation) | **PARTIAL** | Fields not asserted by validator effectively degrade gracefully, but this is by omission, not by explicit policy. |

### 3.2 — `assessQuality()` function returning OK / PARTIAL / FAILED verdict

**MISSING.** No function with this contract exists. The closest analog is the per-column scorecard + hard-fail boolean inside `parseRentRoll` (`rent-roll-parser.ts:716-748`). It returns either a successful capsule or `success:false`; there is no three-valued snapshot verdict consumers can branch on.

### 3.3 — Upload-time quality preview UI

**MISSING.** Today's flow auto-commits on upload: `auto-extract-on-upload.ts:92-145` writes status `running → done/failed` into `deal_files.extraction_status` and rows into `deal_data` / `deal_capsules` with no user gate between parse and commit. There is no modal with the four CTAs (Re-parse as RRwLC / Manual mapping / Re-export with charge details / Cancel).

The closest existing surface area:
- **Task #517** added a per-file Re-extract action (`frontend/src/components/deal/sections/DocumentsFilesSection.tsx`) — this is the structural place a "Re-parse with different variant" button would attach to.
- **Task #514** surfaces `column_coverage` + `human_review_needed` in the capsule and renders them in `DocumentsFiles` views — this is the data the preview modal would consume.

So the preview UI is unbuilt but the **data inputs and the UI re-trigger plumbing already exist** — Session 3 in the spec is pure UI work over an existing payload.

### 3.4 — Why this beats post-hoc detection

N/A — design rationale, not code.

### 3.5 — Cross-document concession reconciliation

| Piece | Status | Pointer / note |
|---|---|---|
| RR-level concession extraction (RRwLC `CONCESSION` charge code) | **PARTIAL** | `rent-roll-parser.ts:36` maps `empdisc/otconc/renew/patrol → concessions`; aggregated into capsule `extraction_concession_detail` (`data-router.ts:421`). **Gap:** no per-unit `charge_lines` row; RR-level value collapses to a property-level monthly sum. |
| RR standalone `concession_amount` column | **PARTIAL** | Mapped via `field-mapper.service.ts:38,57` to canonical `concession_value` / `concession_months`; persisted in `lease_events`. |
| T12 concession line item | **EXISTS** | T12 parser detects `concessions` line and `data-router.ts:439-448` enriches lease events from T12 concession data. |
| T12-implied (NRI − GPR fallback) | **MISSING** | No residual-derivation path. |
| Reconciliation rule with `CONCESSION_MISMATCH` flag at >20% delta | **MISSING** | `multi-doc-cross-validation.service.ts` cross-validates several fields but does not run the §3.5 priority cascade or emit the `concession_source_flag` (`RR / T12 / RECONCILED / RR_T12_MISMATCH / IMPLIED`). |
| `requires_t12: bool` flag on concession-dependent metrics | **MISSING** | Not modeled. |
| Generalization to bad debt / other income / vacancy loss / NRI cross-checks | **MISSING** | The §3.5 closing table (5 reconciliation rules) is unimplemented. |

---

## Layer 3 — Single-Snapshot Derivations (§4)

### 4.4 — Property-level metric set

| Field | Status | Pointer / note |
|---|---|---|
| Unit counts (total / occupied / vacant_ready / vacant_not_ready / notice / excluded) | **PARTIAL** | `rent-roll-parser.ts:453-457` splits current/occupied/vacant/non-revenue/future. **Gap:** `vacant_ready` vs `vacant_not_ready` not distinguished; `notice` not separately bucketed; `unit_count_excluded` collapses model+employee+courtesy without preserving the breakdown. |
| `physical_occupancy`, `economic_occupancy`, `leased_pct` | **PARTIAL** | Physical occupancy is computed in capsule extras; `economic_occupancy` and `leased_pct` (which counts notice as leased) are not separately surfaced. |
| `avg_market_rent`, `avg_effective_rent`, both PSF | **EXISTS** | Computed per floor plan and rolled up (`rent-roll-parser.ts:459-471`). |
| `loss_to_lease_pct` and `_dollars_monthly` | **EXISTS** | `rent-roll-parser.ts:466-471` (occupied-only LTL with explicit comment on the formula choice). |
| `concession_intensity_pct` with `LayeredValue` (multi-source) | **PARTIAL** | Single value computed; no `LayeredValue` wrapper; no `concession_source_flag`. |
| GPR / in-place rent / ancillary breakdown / EGI estimate | **PARTIAL** | `data-router.ts:1083` writes `extraction_other_income_monthly` with the eight income categories; GPR and EGI estimate are not separately surfaced as snapshot fields. |
| `expiration_waterfall: number[24]` | **EXISTS** | `rent-roll-derivations.service.ts:151-170` (`computeExpirationWaterfall`) returns a true 24-element array of `{ months_out, expiring_units, expiring_pct }` anchored to `snapshotDate`, persisted to `rent_roll_snapshots.derived_metrics` (line 65-72). The parser additionally exposes a coarser 5+1 bucket curve per floor plan (`rent-roll-parser.ts:530-555`) for capsule-level rendering. **Gap vs spec:** stored shape is `{months_out, expiring_units, expiring_pct}[]` rather than the spec's bare `number[24]` — semantically equivalent. |
| `expiration_concentration_index` (Herfindahl) | **MISSING** | Not computed. |
| `mtm_count` distinguishing true MTM from extraction-failed nulls | **EXISTS (post Task #514)** | `rent-roll-parser.ts:514-521` `bucketExpiration` separates `unknown` (null/unparseable) from `mtm` (real holdover). This is the structural fix the spec §11 calls out. |
| `vacancy_aging_p50`, `vacancy_aging_p90` | **MISSING** | No service computes these. |
| `signings_ttm`, `signings_per_month_ttm`, `signings_yoy_change_pct` | **PARTIAL** | `rent-roll-derivations.service.ts:91-115` computes a 24-month signing-velocity histogram with survivor-bias weighting (per spec §1.3). Per-month TTM / pYTM / YoY-change scalars are not separately stored. `traffic-analytics.service.ts:1-12` defines a `SigningVelocity` interface with trailing-3/6/12 buckets — that path consumes from `leasing_events` ad-hoc, not from `rent_roll_derived`. |
| `avg_tenure_months`, `lease_term_mix`, `renewal_share_in_place` | **PARTIAL** | `rent-roll-derivations.service.ts:118` (`computeRenewalRateProxy`) implements the spec §5.8 single-snapshot proxy. Tenure and term mix are not computed. |

### 4.5 — Floor plan / unit type metrics

| Field | Status | Pointer / note |
|---|---|---|
| Per-FP unit counts (total / occupied / vacant_ready / vacant_not_ready / notice) | **PARTIAL** | `rent-roll-parser.ts:550-580` (`floorPlanMix`) tracks count, occupied count, market-rent, effective-rent, occupancy_pct. Vacant_ready vs vacant_not_ready and notice are not split. |
| `avg_sqft`, `avg_market_rent`, `avg_effective_rent`, `avg_market_rent_psf`, `loss_to_lease_pct` | **EXISTS** | Same block. |
| `premium_vs_lowest_fp_pct` | **MISSING** | No computation. |
| Per-FP `expiration_curve` with 5 buckets + `unknown` + `extraction_status` | **EXISTS (post Task #514)** | `rent-roll-parser.ts:546-555` (`expiration_curve` with `unknown` bucket and `expiration_extraction_status: 'ok' \| 'partial' \| 'failed'`). This is the §6.2 UNKNOWN-bucket pattern applied at floor-plan grain. |
| `signing_velocity_ttm` per FP | **EXISTS** | `rent-roll-derivations.service.ts:184-188` (`computeUnitTypeBreakdown` → `signing_velocity` = recent-12mo leases / 12) anchored to `snapshotDate`. Stored in `derived_metrics.unit_type_breakdown[]`. |
| `days_vacant_median` per FP | **PARTIAL** | `rent-roll-derivations.service.ts:191-194` computes `days_vacant_avg` (mean), not median. Spec wants median; arithmetic-mean approximation only. |
| `concession_intensity_pct` per FP | **PARTIAL** | `rent-roll-derivations.service.ts:197-200` computes `concession_intensity` as average free months across rows with non-null `concession_months`. **Gap:** not the spec's `pct of GPR` formulation, and no FAILED state when concessions are T12-only (no §3.5 reconciliation). |
| `renewal_rate` per FP | **EXISTS** | `rent-roll-derivations.service.ts:203-206` computes per-type renewal rate from rows with non-null `is_renewal` in the recent-12mo window; defaults to 0.5 when no data. (Spec calls this `retention_rate` and labels it Layer 4 — the single-snapshot proxy is what's implemented.) |
| `rent_growth_yoy_pct` per FP (Layer 4) | **MISSING** | Diff layer doesn't exist. |

### 4.6 — Floor / building metrics

**MISSING.** No floor-number extraction, no `FloorMetrics` derivation, no auto-detect-when-floor-data-is-rich heuristic, no floor-premium-curve sparkline.

### 4.7 — Tenant cohort metrics

**MISSING.** No cohort grouping (`0-6mo / 6-12mo / 12-24mo / 24mo+`) and no `expiration_concentration` per cohort.

### 4.8 — Risk metrics

| Field | Status |
|---|---|
| `expiration_concentration_index` (Herfindahl over 24 buckets) | **MISSING** |
| `largest_monthly_expiration_pct` | **MISSING** |
| `expiring_next_quarter_pct`, `expiring_next_6mo_pct` | **PARTIAL** — derivable from existing 6-bucket curve but not stored as named scalars. |
| `vacancy_aging` 4-bucket histogram | **MISSING** |
| `notice_concentration_pct` | **MISSING** |
| Tenant concentration (commercial only) | **MISSING** — out of scope for current multifamily focus. |

### 4.9 — Pricing metrics

| Field | Status |
|---|---|
| `rent_dispersion_within_fp` (p25/50/75/90) and `fp_with_widest_dispersion` | **MISSING** |
| Concession economics block (units count, avg term, avg value, share-of-GPR) | **PARTIAL** — total monthly concession is in capsule extras; per-unit term/value distribution is not. |
| Ancillary attach rates (parking / pet / RUBS) and `ancillary_pct_of_revenue` | **MISSING** — blocked by absence of `charge_lines` table. The aggregation in `rent-roll-parser.ts:477-495` loses unit-level attribution. |
| `loss_to_lease_decomp` (concessions vs below-market-renewals vs legacy long leases) | **MISSING** |

---

## Layer 4 — Diff Extractor Analytics (§5)

**MISSING in entirety.** Every metric in this layer requires two snapshots ≥30 days apart for the same property. Current state:

- No `rent_roll_diffs` table.
- No service module for pairwise diff computation.
- `traffic-analytics.service.ts:64-101` defines `TradeOutMetrics` and `FloorPlanTradeOut` interfaces but populates them from `leasing_events` flags (`is_renewal`, `prior_rent` synthesized) within a single snapshot — not via snapshot-pair diffing. This is the §5.8 single-snapshot **proxy**, not the §5.2 diff metric.
- Activation-rule progressive lighting (§5.1: 1 / 2 / 4 / 12 snapshots) does not exist.
- Trend metrics (slope / YoY / volatility / inflection) for §5.3 do not exist.

**Implication:** every spec table that references "true" trade-out, "true" renewal rate, actual downtime, or net absorption is unbuilt. M22 variance tracking and M07 T-07 trajectory currently consume single-snapshot proxies.

---

## Layer 5 — Presentation State Machine (§6)

### 6.1 — Three-state rendering per metric

**PARTIAL.** The state vocabulary exists in two related forms:

- **Field-level extraction status** at the rent-roll surface: `column_coverage` 5-state enum (`rent-roll-parser.ts:618`) + `expiration_extraction_status` 3-state enum (`rent-roll-parser.ts:546`) — both Task #514 work. These propagate to `extraction_rent_roll` capsule extras.
- **File-level extraction status** at the Documents UI: `deal_files.extraction_status` (`pending / running / done / failed / skipped`) added in migration `20260423_deal_files_extraction_status.sql`. Rendered in `DocumentsFilesSection`, `GridView`, `ListView`, `FolderView`. Task #517 added the per-file Re-extract trigger.

**Gap:** there is no derived-metric-level OK/PARTIAL/FAILED state machine. A consumer reading `extraction_rent_roll.floor_plan_mix['bs-a1'].avg_effective_rent` cannot tell from the value alone whether the snapshot was OK or PARTIAL — the propagation contract the spec calls out ("a JEDI Score component computed on PARTIAL inputs is itself PARTIAL") is not enforced.

### 6.2 — UNKNOWN bucket pattern

**EXISTS (post Task #514) for one metric, MISSING elsewhere.**

- Lease-expiration curve **does** carry an `unknown` bucket (parser line 514-521) and exposes per-FP `expiration_extraction_status`.
- Vacancy aging, tenure cohort, rent dispersion — **none implemented**, so the bucket pattern is moot but should be declared as part of the rules-as-code when those metrics ship.
- The §6.2 hard rule "`unknown_count / occupied_count > 0.5` → FAILED" is **not** generally enforced; the parser computes per-FP `expiration_extraction_status` on a different threshold (`unknown >= occupiedCount` → FAILED, `:541-545`).

### 6.3 — Field-level source tracing UI (hover-to-source)

**MISSING.** No hover-to-source UI on numerical cells. The data needed to back this hover (filename, source column, mapping confidence) is captured in `column_coverage` + extraction provenance, but no React component reads it back into a tooltip.

### 6.4 — Upload-time preview (recap)

See §3.3 above — **MISSING**.

---

## §7 — Cross-Module Consumption Map

| Spec metric | Consumed by spec | Status today |
|---|---|---|
| `physical_occupancy` | M09, M25, M22 | **PARTIAL** — capsule reads it; M09 ProForma seeder uses it (`proforma-seeder.service.ts`); M25 JEDI Score component path exists; M22 post-close variance consumes capsule. |
| `economic_occupancy` | M09, M25 | **MISSING** — not separately surfaced. |
| `loss_to_lease_pct` | M09, M25, M08 | **PARTIAL** — value exists in capsule; M08 Value-Add detector does not yet read it. |
| `concession_intensity_pct` | M09, M07, M25 | **PARTIAL** — single-source value only; missing T12 reconciliation. |
| `expiration_waterfall` | M07, M09, M14 Risk | **PARTIAL** — true 24-month curve exists in `rent_roll_snapshots.derived_metrics` (`rent-roll-derivations.service.ts:151-170`); M07 calibration consumes via `derived_metrics`; M09 ProForma seeder reads coarser per-FP curve from capsule; M14 Risk wiring not present. |
| `signing_velocity_ttm`, `signings_yoy_change_pct` | M07, M22 | **PARTIAL** — histogram exists; YoY scalar is not stored. |
| `renewal_rate_true` (diff) | M09, M07, M22 | **MISSING** — only the single-snapshot proxy exists. |
| `trade_out_pct` (diff) | M09, M25 | **MISSING** — diff layer absent. |
| `actual_downtime_days` (diff) | M07, M09 | **MISSING**. |
| `floor_plan.rent_growth_yoy_pct` | M09, M03 | **MISSING**. |
| `expiration_concentration_index` | M14, M25 | **MISSING**. |
| `vacancy_aging_p90` | M25, M14 | **MISSING**. |
| `tenant_cohort.expiration_concentration` | M14 | **MISSING**. |
| `ancillary_pct_of_revenue` | M09, M15 | **PARTIAL** — aggregate `extraction_other_income_monthly` exists; not split as PCT of revenue and not per-tenant attributable without `charge_lines`. |
| `parking_attach_rate` | M09, M15 | **MISSING** — blocked by `charge_lines`. |

**Net:** M09 (ProForma) and M25 (JEDI Score) consume what they can from current capsule extras; the spec's full consumption map requires Layer 3 + Layer 4 buildout.

---

## §8 — Storage Architecture

| Spec table | Status | Pointer |
|---|---|---|
| `rent_roll_snapshots` | **PARTIAL** | Runtime-created; missing 9 columns (see §2.3 row above). **Action:** add a numbered SQL migration and add the missing columns. |
| `lease_events` | **PARTIAL** | Two parallel tables (`leasing_events` engine target + `lease_events` log), both missing `field_status`. |
| `charge_lines` | **MISSING** | Top-priority storage gap. |
| `rent_roll_quality` | **MISSING** | Per-snapshot field-status denormalization for fast lookup. |
| `rent_roll_derived` (cache) | **PARTIAL** | Lives in JSONB column rather than a queryable table. |
| `rent_roll_diffs` (cache) | **MISSING** | Layer 4 doesn't exist. |

---

## §9 — Event Flow

**MISSING — current trigger chain is synchronous.** `auto-extract-on-upload.ts:198-220` calls `processDocument()`, then on success directly invokes `eventDispatcher.onDocumentUploaded(...)` in-process. The spec's Kafka fan-out (`rent_roll_derivation_worker / rent_roll_diff_worker / traffic_calibration_worker / proforma_seeder_worker / jedi_score_recalc_worker / m22_post_close_worker / deal_store_invalidator`) is not implemented.

What does exist:
- Inngest workflows (the Inngest Dev Server is a configured workflow). Inngest functions in `backend/src/agents/cashflow.inngest.ts` and elsewhere are the natural substrate for the spec's worker fan-out — they're an Inngest-not-Kafka substitution but functionally equivalent.
- `trafficCalibrationJob.ts` exists as a scheduled job — closest analog to the spec's `traffic_calibration_worker`.
- Quality verdict events `rent_roll.partially_extracted` and `rent_roll.failed` are not emitted (Layer 2 verdict is not modeled).

---

## §11 — The 464 Bishop Failure Mode

| Guard | Status post Tasks #514 / #517 |
|---|---|
| 1. Variant detection flags confidence < 0.85 | **MISSING** — confidence is computed but not gated on. |
| 2. Quality gating catches `market_rent missing on 100% of occupied units` | **PARTIAL** — Task #514 added a hard-fail when `market_rent` column is `'missing'` or `'all_null'` (`rent-roll-parser.ts:716-748`) — this catches the 464 Bishop class structurally. |
| 3. User in cognitive context to fix it | **PARTIAL** — Task #517 added a per-file Re-extract trigger; full re-parse-with-different-variant prompt is not built. |
| 4. UNKNOWN bucket prevents 100% MTM bar | **EXISTS** — Task #514 (`rent-roll-parser.ts:514-521`). |
| 5. Layer 5 em-dashes on every rent column | **PARTIAL** — capsule carries `column_coverage` + `human_review_needed`; downstream rendering of em-dashes vs zeros is per-component and not universally enforced. |

**Net:** 464 Bishop's specific failure (silent $0 rents + 100% MTM) is now caught at parse time. Three of the five defense-in-depth guards are partial or missing — the framework's "any one guard catches it" claim is not yet redundant.

---

## §12 — Open Questions

Lease-charge audit trail, multi-property portfolio sharding, schema-drift detection, and tenant-ledger uploads are all **MISSING** and remain open per the spec.

---

## Appendix — Recommended Task Slicing

The spec lists 13 build sessions. Grouping into 5 cohesive project tasks with proposed dependencies, sized for the typical task envelope (S = ≤4h, M = 4-10h, L = 10-20h):

### Task A — Storage + Quality Foundation (sessions 1, 2; covers §2.3, §3.1, §3.2)  *— L*
- Numbered SQL migration adding `rent_roll_snapshots` columns (`property_id`, `uploaded_by`, `source_s3_key`, `detected_pms`, `detected_variant`, `detection_confidence`, `parser_version`, `unit_count_expected`, `quality_verdict`, `notes`) plus the four missing tables: `charge_lines`, `rent_roll_quality`, `rent_roll_derived`, `rent_roll_diffs`. Add `field_status` JSONB to `lease_events`.
- Versioned config table for field criticality classes A / B / C / C-X / D.
- New `assessQuality(snapshot): "OK" | "PARTIAL" | "FAILED"` function with the §3.2 thresholds. Persist verdict on `rent_roll_snapshots.quality_verdict`.
- **Dependencies:** none. Foundation for everything below.

### Task B — Variant Detection + Manual Mapping + Upload-Time Preview (sessions 3, 4, 5; covers §2.1, §2.2, §3.3)  *— L*
- Two-step PMS + variant cascade with confidence scoring. Train RRwLC vs STANDARD heuristic on a labeled set (use 464 Bishop as positive RRwLC example).
- Dry-run mode that runs the parser end-to-end and emits a quality assessment without committing to `lease_events` / `charge_lines`. Wire into `auto-extract-on-upload.ts`.
- Upload-time preview modal in Documents UI with the four CTAs (Re-parse / Manual mapping / Re-export / Cancel). Re-uses the per-file Re-extract trigger from Task #517 as the structural attachment point. Consumes Task #514's `column_coverage` + `human_review_needed` payload.
- Manual column-mapping UI for confidence < threshold; persist as user-specific override.
- **Dependencies:** Task A (needs `quality_verdict` column + `assessQuality()`).

### Task C — Layer 3 Single-Snapshot Derivations + Cross-Doc Reconciliation (sessions 6, 6.5, 7; covers §4.4, §4.5, §3.5)  *— L*
- Implement the §4.4 property-level metric set as a derivation worker writing to the `rent_roll_derived` table (not the JSONB column). Wire derivation worker to the post-commit fan-out (Inngest function listening for the `rent_roll.ingested` equivalent — see Task E for the eventing).
- Implement §4.5 floor-plan metrics in the same worker; F6 Floor Plan Breakdown UI consumes from the new table.
- Apply §6.2 UNKNOWN bucket pattern universally (not only to expiration curve — also vacancy aging once it lands).
- Implement §3.5 concession reconciliation rule with the full priority cascade and `concession_source_flag`. Generalize template to bad debt, other income, vacancy loss, NRI cross-checks.
- **Dependencies:** Task A (needs `rent_roll_derived` table, `charge_lines` table for ancillary breakouts).

### Task D — Layer 4 Diff Extractors + Layer 5 Presentation State + Cross-Module Wiring (sessions 8, 9, 10, 13; covers §5, §6.1, §6.3, §7)  *— L*
- Diff worker computing trade-out, true renewal rate, actual downtime, net absorption, pricing velocity. Activation per §5.1 progressive thresholds. Persist to `rent_roll_diffs`.
- Three-state rendering (OK / PARTIAL / FAILED) with hatched-fill SVG pattern for PARTIAL and em-dash + hover for FAILED — applied universally across F6 and any view consuming derived metrics.
- Hover-to-source field-level audit chain (§6.3) on every numerical cell.
- Wire `rent_roll_derived` + `rent_roll_diffs` into M09 ProForma seeder, M07 traffic calibration, M25 JEDI Score, M22 Post-Close variance per §7 consumption map. Each consumer reads `extraction_status` and propagates state.
- **Dependencies:** Tasks A and C (needs derived table; diff metrics activate once a property has 2+ snapshots ≥30 days apart, which can come from any ingestion path). Task B is **not** a hard prerequisite — backend diff/presentation/wiring can land before the upload-time preview UI ships, as long as quality state is propagated through the existing capsule contract.

### Task E — Risk + Pricing + Tenant Cohort Metrics + Event-Flow Hardening (sessions 11, 12; covers §4.6, §4.7, §4.8, §4.9, §9)  *— M*
- §4.8 Risk and §4.9 Pricing metrics added to the derivation worker. These are second-order analytics that depend on Tasks C and D being live.
- §4.6 floor metrics + §4.7 tenant cohort metrics with auto-detect-when-rich heuristic.
- Replace the synchronous trigger chain in `auto-extract-on-upload.ts` with explicit Inngest events `rent_roll.ingested`, `rent_roll.partially_extracted`, `rent_roll.failed`. Each subscriber (derivation / diff / traffic-calibration / proforma-seeder / jedi-score / m22 / dealStore-invalidator) becomes a subscribed Inngest function. Drives M14 Risk and M25 Position score.
- **Dependencies:** Tasks C and D (event flow hardening is most useful once there are multiple subscribers; risk/pricing/cohort layer on top of derivation worker).

---

### Sequencing summary

```
A (Storage + Quality Foundation)
├── B (Variant Detection + Preview UI)
└── C (Layer 3 Derivations + Reconciliation)
    └── D (Layer 4 Diffs + Presentation + Cross-Module Wiring)
        └── E (Risk + Pricing + Cohort + Event Hardening)
```

Tasks B and C can run in parallel after A merges. D depends on C (derivation table) and on the existence of ≥2 snapshots per property to compute the first diff — that data can arrive through any ingestion path, so D does **not** require B's preview-gated flow to be live. E layers on top of D.
