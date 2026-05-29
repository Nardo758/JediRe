# 464 Bishop — Pre-Check + End-to-End Valuation Run

**Run date:** 2026-05-28  
**Deal ID:** `3f32276f-aacd-4da3-b306-317c5109b403`  
**Property ID:** `49d2e311-350d-44ea-bfb9-41a893b0a704`  
**Address:** 464 Bishop Street NW, Atlanta, GA 30318  
**Overall Stage A Verdict:** 🟠 ORANGE

---

## Stage A — Pre-Check Results

### A.1 — Subject Side Ready

| Field | Value | Status |
|---|---|---|
| `units` | 232 | ✅ |
| `building_sf` | 196,196 | ✅ |
| `year_built` | 2017 | ✅ |
| `building_class` | B | ✅ |
| `latitude` | 33.7799 | ✅ |
| `longitude` | −84.4226 | ✅ |
| `submarket_id` | 9 (West Midtown) | ✅ |
| `acquisition_price` | **null** | ⚠️ |

**Verdict: PASS** — All five required fields (units, building_sf, year_built, building_class, geocode) are populated. `acquisition_price` is null on both the `properties` and `deals` rows — no purchase price has been set on the deal record. This is a gap that will degrade income-approach sizing but does not block A.1.

---

### A.2 — Sale Comps Ingested

**Requirement:** ≥ 5 rows in `market_sale_comps` attributed to a CoStar/operator-upload source for this deal or its submarket.

Queries run:
- `market_sale_comps WHERE deal_id = '<464_id>'` → **0 rows**
- `market_sale_comps WHERE source IN ('costar_upload','costar','operator_upload')` (all deals) → **0 rows**
- `market_sale_comps` within 5 miles of 464 Bishop (lat/lng proximity) → **20 rows returned, all `georgia_county` source**; none have a meaningful `price_per_unit` (column is null for all county-recorded rows); all pre-date 2022
- `sale_comp_sets WHERE deal_id = '<464_id>'` → **4 auto-generated sets, each with `comp_count = 0`**

**Source breakdown for Atlanta multifamily comps in the system:**

| Source | Count | Date range |
|---|---|---|
| `georgia_county` | 343,472 | 1199–2026 |
| `public_records` | 13 | 2022–2026 |
| `assessor_estimate` | 1 | 2024 |
| `costar_upload` | **0** | — |

**Verdict: FAIL** — No CoStar or operator-upload comps are present anywhere in `market_sale_comps`. The upload event described in the task premise did not result in any rows landing in the database. All four auto-generated comp sets return empty pools.

---

### A.3 — Rent Comps Ingested

**Requirement:** ≥ 5 rows in `market_rent_comps` for the 464 Bishop submarket.

Queries run:
- `market_rent_comps WHERE deal_id = '<464_id>'` → **0 rows**
- `market_rent_comps WHERE source IN ('costar_upload','costar','operator_upload')` → **0 rows**
- `market_rent_comps` within 5 miles of 464 Bishop (lat/lng proximity) → **0 rows**

**Verdict: FAIL** — No rent comps of any source exist near 464 Bishop. The `market_rent_comps` table is empty for this geography. Upload did not persist.

---

### A.4 — Submarket Performance Data

Tables checked: `oppgrid_market_economics`, `submarket_characters`, `submarkets`

| Table | Submarket 9 Row | Data Quality |
|---|---|---|
| `submarkets` | ✅ — `name='West Midtown'`, `avg_occupancy=93.2%`, `avg_rent=$2,280`, `avg_cap_rate=4.60%` | Reference data only — no time series |
| `oppgrid_market_economics` | ⚠️ — Atlanta city-level row only (`median_rent=$1,444`, `vacancy=49.7%`, `updated=2026-03-31`) | City not submarket; vacancy 49.7% is implausible (likely a data quality issue with this field) |
| `submarket_characters` | ❌ — No row for `submarket_id='9'` | Empty |
| `costar_submarket_stats` | Not queried — table exists but has no known West Midtown row | |

**Verdict: YELLOW** — Some aggregate submarket identifiers exist (`submarkets` row) but no time-series submarket economics are available for West Midtown. The `oppgrid_market_economics` Atlanta row carries a suspicious `vacancy_rate=49.7%` that is not usable.

---

### A.5 — Deal Assumptions / Agent Run State

**Agent run history (cashflow):**

| Run ID | Status | Started | Summary |
|---|---|---|---|
| `effabf0b` | succeeded | 2026-05-20 15:14 | Latest: "464 Bishop 2017 mid-rise, 80.2% occupancy, IRR ~14.1%, 5 severe collisions" |
| `b197ced3` | succeeded | 2026-05-20 15:13 | Stabilized NOI $2.66M, IRR 8.37% |
| `b2732498` | succeeded | 2026-05-20 15:09 | NOI $3.0M, plausibility d=1.628 |

**Source document availability:**
- T12 actuals in `deal_monthly_actuals`: **24 rows** (T12 data present)
- Rent roll snapshots: **0** (no rent roll snapshot table entry, though rent roll doc is referenced in `year1.source_docs`)
- `year1.source_docs`: T12 doc `4eb5eee6`, tax bill doc `4a68bfbd`, rent roll doc `c9c4bce7` (doc IDs present but rent roll snapshot not persisted)

**NOI LayeredValue state (year1.noi):**

| Slot | Value |
|---|---|
| `om` | $2,999,564 |
| `platform` | $2,632,193 |
| `agent` | null |
| `t12` | null |
| `resolved` | **$367,640** |
| `resolution` | **`platform_fallback`** |

⚠️ **Critical finding:** `year1.noi.resolved = $367,640` via `platform_fallback`. This is ~87% below the OM stabilized NOI of $2,999,564 and ~86% below the platform estimate of $2,632,193. The platform_fallback path indicates the agent did not write a NOI value in the `agent` slot. This makes the `year1` NOI effectively unusable for valuation.

**Total OpEx state:** `year1.total_opex.resolved = $3,283,812` (platform_fallback) — this EXCEEDS EGI ($4,656,330) leaving only $1.37M for NOI at the composed level, which does not match any single-slot value.

**Other key year1 assumptions:**

| Field | Resolved | Resolution | Source conflict |
|---|---|---|---|
| GPR | $4,901,400 | agent | OM=$4,901,400; T12=$4,876,535; RR=$4,932,300 |
| EGI | $4,656,330 | agent | — |
| Vacancy % | 19.83% | rent_roll | OM=5%, T12=66%, RR=19.8% |
| Insurance | $125,280 | agent | OM=$46,400; T12=$63,699 — severe collision |
| Real estate tax | $540,000 | agent | OM=$977,287; T12=$1,127,126; tax bill=$20,731 — severe collision |
| Mgmt fee % | 11.4% | t12 | OM=2.75%; platform=4.5% — severe collision |

**Severe collisions:** 5 (per `collision_summary.severe_count`)  
**Confidence distribution:** high=12 fields, medium=8, low=1 (total 21 fields scored)  
**fields_written:** 0 (field is null in `agent_runs.output` for the latest run — the output schema did not populate this array)

**Verdict: YELLOW** — Agent has run successfully and produced coherent narrative output. However, `year1.noi.resolved` is degraded to $367,640 via `platform_fallback` (agent slot is null), the total_opex path has a similar degradation, and 5 severe collisions are unresolved. The deal has no purchase price set.

---

### A.6 — Stage A Verdict

| Check | Verdict |
|---|---|
| A.1 — Subject fields | ✅ PASS |
| A.2 — Sale comps | ❌ FAIL |
| A.3 — Rent comps | ❌ FAIL |
| A.4 — Submarket data | 🟡 YELLOW |
| A.5 — Agent run / NOI state | 🟡 YELLOW |

**Overall: 🟠 ORANGE**

A.2 and A.3 both fail. The task premise — that CoStar sale comps, rent comps, and submarket data were operator-uploaded — is **not reflected in the database**. The upload event either did not complete, wrote to a different table, or was not triggered. Per the task gate: Stage B should not run with missing inputs.

**The following Stage B findings were gathered during this run as an observation only**, using the valuation grid and cashflow outputs that already existed in the database from prior runs (2026-05-20). They are included for diagnostic value and to answer the four backtest questions, but are explicitly advisory given the ORANGE pre-check.

---

## Stage B — Agent Run Summary (from prior run `effabf0b`, 2026-05-20)

**Variant fired:** Standard multifamily underwrite (property_type defaulted — no specific deal-type variant detected in output)

**Key assumptions resolved:**

| Assumption | Resolved Value | Source tier | Collision? |
|---|---|---|---|
| GPR | $4,901,400 | agent (OM-anchored) | None |
| Vacancy % | 19.83% | rent_roll | OM collision (5% vs 19.8%) |
| Concessions % | 7.78% | t12 | — |
| Bad debt % | 0.86% | t12 | — |
| Insurance | $125,280 | agent (jurisdiction benchmark) | Severe — OM $46,400 |
| Real estate tax | $540,000 | agent (tax engine) | Severe — OM $977,287 |
| Management fee | 11.4% | t12 | Severe — OM 2.75% |
| Payroll | $324,800 | agent | None |
| Repairs & maintenance | $69,600 | agent (OM) | T12 collision ($134,208) |
| Replacement reserves | $46,400 | agent | — |
| NOI (year1, resolved) | **$367,640** | platform_fallback | — |
| Debt rate | 6.59% | platform | — |
| LTV | 75% | platform | — |

**Evidence quality:**
- T12 present: yes (24 actuals rows)
- Rent roll: referenced in source_docs but snapshot not persisted — rent_roll slots populated (vacancy, concessions sourced from rent_roll)
- OM: present (broker values populating GPR, insurance, tax, etc.)
- Archive benchmarks: insufficient (n=0 for cohort anchoring per agent narrative)

**NOI source (agent narrative):** "Pro forma Year 1 NOI $3.0M (broker OM stabilized NOI)" — the agent's narrative cites $3.0M from the OM. However, the `year1.noi.resolved` field in `deal_assumptions` shows $367,640 via `platform_fallback`, suggesting the agent wrote its NOI reasoning into the narrative but did not successfully write the `agent` slot of the NOI LayeredValue.

**Confidence score:** Overall confidence distribution high=12, medium=8, low=1. The `confidence_score` scalar is null in the agent_run output row (the field was not serialized).

---

## Stage B — Valuation Grid Output

*Run: `ValuationGridService.compute()` executed directly, 2026-05-28 22:49 UTC*

**Subject property as read by the service:**

| Field | Value | Source |
|---|---|---|
| Units | 232 | properties table |
| Total SF | 196,196 | properties table |
| Purchase Price | null | not set on deal |
| NOI | **$2,999,564** | proforma_year1 (reads `year1.noi.resolved`) |
| Asset class | B | properties.building_class |
| Submarket | 9 (West Midtown) | properties.submarket_id |

⚠️ **NOI discrepancy:** The service reports NOI = $2,999,564 with `noiSource = 'proforma_year1'`, but the `year1.noi.resolved` field in the database is $367,640. The service code reads `year1->'noi'->>'resolved'` which should return 367,640. The $2,999,564 figure matches `year1.noi.om` — this suggests the ValuationGridService may be reading a different state of the `deal_assumptions` row than what the NOI-detail query observed, or the service has a code path that falls back to the OM value when `resolved` is anomalously low. **This discrepancy is an unresolved gap; the two surfaces are non-deterministic with respect to NOI.**

**Per-method results:**

| Method | Status | Confidence | P50 Indicated Value | Indicated PPU | Sample n | Source |
|---|---|---|---|---|---|---|
| Cap Rate × NOI | active | INSUFFICIENT | $52.6M | $226,827/unit | 0 | Market default cap rates (no archive data) |
| Comp-Anchored Cap Rate | **insufficient** | INSUFFICIENT | — | — | 0 | No sale comps in comp set |
| Per-Unit Benchmark | active | MEDIUM | $58.0M | $250,000/unit | 11 | Archive benchmarks (Atlanta, 2026-05-25) |
| Sales Comp PPU | **insufficient** | INSUFFICIENT | — | — | 0 | No comps within search radius |
| Sales Comp PSF | (not computed) | — | — | — | 0 | Gated on Sales Comp PPU |
| Operator Override | **insufficient** | INSUFFICIENT | — | — | — | Not set |
| Replacement Cost | active | LOW | $41.7M | $179,917/unit | — | ReplacementCostServiceV2 (ppi_escalated) |
| GRM | placeholder | — | — | — | — | V1.0 |
| GIM | placeholder | — | — | — | — | V1.0 |
| DCF | placeholder | — | — | — | — | V1.0 |

**Cap Rate × NOI detail:**
- NOI used: $2,999,564 (OM value as read by service)
- Cap rate P25/P50/P75: 5.00% / 5.70% / 6.50% (market defaults — archive cohort returned n=0)
- Warning: "No archive cap rate data for this cohort — using market defaults"

**Replacement Cost detail:**
- Cost/SF: $185/SF (PPI-escalated basis)
- Improvement cost: $36.30M (196,196 SF × $185)
- Land estimate: $5.44M (flat 15% of improvements)
- Total indicated: $41.74M (P50)
- Range: $37.6M (P25) – $46.7M (P75)
- Two internal errors logged during compute:
  - `building_permits` table does not exist → permit-derived cost/SF fallback failed
  - `cd.asset_id` column does not exist → Data Library cost/SF fallback failed
  - Both are non-fatal; service fell back to `ppi_escalated` path

**Reconciliation:**

| Field | Value |
|---|---|
| Active methods in reconciliation | 2 (Per-Unit Benchmark + Replacement Cost) |
| Note | Cap Rate × NOI excluded from reconciliation weighting (confidence = INSUFFICIENT) |
| Reconciled value (weighted) | $52.58M |
| Reconciled PPU | $226,639/unit |
| Reconciled PSF | $268.00/SF |
| Recommended price low | $48.5M |
| Recommended price high | $56.6M |
| Convergence signal | MODERATE |
| Convergence score | 0.837 |
| Convergence text | "Methods show 33% spread — review gap analysis below" |
| Valuation confidence | LOW |
| Confidence text | "Limited triangulation (2 methods)" |

**Reconciliation math:** Weighted average of Per-Unit (MEDIUM = weight 2, $58.0M) + Replacement Cost (LOW = weight 1, $41.7M) = ($58.0M × 2 + $41.7M × 1) / 3 = **$52.57M**. This confirms Cap Rate × NOI is excluded from weighting due to INSUFFICIENT confidence.

---

## Stage B — Validation Grid

(Source-tier evidence trail for key assumptions from the latest cashflow run)

| Assumption | Resolved | Source tier | Evidence trail | Sigma / plausibility |
|---|---|---|---|---|
| GPR / avg rent | $4,901,400 | agent → OM | OM $4,901,400; T12 $4,876,535; RR $4,932,300 — three-way agreement | Low variance |
| Vacancy | 19.83% | rent_roll | OM 5% vs RR 19.83% — lease-up gap explained; agent chose rent_roll | Expected for lease-up |
| Concessions | 7.78% | t12 | T12 actual; OM shows 0% — material divergence | Lease-up concessions real |
| Insurance | $125,280 ($540/unit) | agent (jurisdiction benchmark) | Severe collision: OM $46,400 ($200/unit), T12 $63,699 ($274/unit) — benchmark overrides both | Agent correct per benchmark |
| Real estate tax | $540,000 | agent (tax engine) | Severe collision: OM $977,287, T12 $1,127,126, tax_bill $20,731 — agent used post-reassessment estimate | Tax bill anomaly ($20.7K likely partial) |
| Management fee | 11.4% of EGI | t12 | Severe collision: OM 2.75% (heroic), T12 11.4% (lease-up management cost) | T12 reflects lease-up reality |
| Payroll | $324,800 | agent (OM) | T12 $194,388 vs OM $324,800 — agent chose OM | OM may be stabilized budget |
| Repairs & maintenance | $69,600 | agent (OM) | T12 $134,208 vs OM $69,600 — agent chose OM (under T12) | T12 may include catch-up |
| Debt rate | 6.59% | platform | No broker rate override; platform set to 6.59% (current market, vs OM 4.05%) | — |
| NOI (year1) | $367,640 (resolved) / $2,999,564 (OM slot) | platform_fallback / OM | Agent slot null — NOI not written by agent; platform_fallback engaged; OM slot $2,999,564 available but not chosen as resolution | Critical gap |

---

## Findings on the Four Backtest Questions

### Q1 — Does Replacement Cost get diluted when comp-based methods have real data?

**Result: UNTESTABLE — comp-based methods did not fire.** Both Comp-Anchored Cap Rate and Sales Comp PPU returned INSUFFICIENT because no comps are in the database. The question cannot be answered empirically from this run.

**What is observable:** Replacement Cost IS diluted by the non-comp methods that did fire. RC at $41.7M (LOW, weight=1) is diluted by Per-Unit Benchmark at $58.0M (MEDIUM, weight=2). The reconciled midpoint ($52.6M) sits ~26% above RC and is pulled substantially toward the archive-benchmark method. In a scenario where comps also fired — returning values in the $50-60M range — RC would be further diluted, moving the reconciled value even further from the cost basis. The dilution mechanism is working as designed; the comp data to trigger the full scenario is absent.

### Q2 — Comp-method performance with real uploaded data

**Result: FAIL — no comp data to test against.** Both `comp_anchored_cap_rate` and `sales_comp_ppu` returned INSUFFICIENT with the message "No sale comps available within search radius." The premise of the test was that CoStar comps had been uploaded; they were not found in `market_sale_comps` (zero rows with `source='costar_upload'`). Comp performance cannot be evaluated.

### Q3 — Reconciliation behaviour with >2 active methods

**Result: NOT TESTED.** Only 2 methods contributed to reconciliation (Per-Unit Benchmark + Replacement Cost). Cap Rate × NOI has INSUFFICIENT confidence and is excluded from the weighted average. The 4+-method scenario (which would include Comp-Anchored and Sales Comp PPU) requires comps. The current convergence signal (MODERATE, 33% spread) with 2 methods gives no insight into how convergence changes with a richer comp pool.

### Q4 — NOI determinism

**Result: NON-DETERMINISTIC GAP CONFIRMED.** Two surfaces disagree on what year1 NOI is:

| Surface | NOI value | How derived |
|---|---|---|
| `deal_assumptions.year1.noi.resolved` | **$367,640** | `platform_fallback` — agent slot null |
| ValuationGridService subject NOI | **$2,999,564** | reads `year1->'noi'->>'resolved'` — reports as OM value |

The service code should return $367,640 (the resolved slot). That it returns $2,999,564 indicates either: (a) the `deal_assumptions` row observed during the DB query and the row read during service execution are different states (timing issue or cached row), or (b) the service has a code path that substitutes the OM slot when `resolved` is anomalously low. This discrepancy means the valuation grid and the F9 proforma/Validation Grid are consuming different NOIs. Any NOI-dependent method (Cap Rate × NOI) is therefore non-deterministic across surfaces.

---

## Gaps Surfaced

| Gap | Severity | Detail |
|---|---|---|
| **No CoStar sale comps in DB** | Critical | The CoStar upload did not persist. `market_sale_comps` has zero `costar_upload` rows. All 4 auto-generated comp sets return comp_count=0. |
| **No rent comps in DB** | Critical | `market_rent_comps` is empty within 5 miles of 464 Bishop. |
| **NOI non-determinism** | Critical | `year1.noi.resolved=$367,640` vs ValuationGridService reads $2,999,564. The two surfaces are inconsistent. |
| **Agent slot null for NOI** | High | The cashflow agent ran (3× succeeded, 2026-05-20) but did not write the `agent` slot of `year1.noi`. The `resolved` field therefore fell through to `platform_fallback` at $367,640, which is nonsensical as a stabilized NOI. |
| **total_opex.resolved exceeds EGI** | High | `year1.total_opex.resolved = $3,283,812` (platform_fallback) vs EGI $4,656,330. This leaves implied NOI of ~$1.37M, which matches neither the OM ($3.0M) nor the resolved NOI slot ($367,640). OpEx assembly has a platform_fallback problem parallel to NOI. |
| **building_permits table missing** | Medium | Replacement Cost service logs error: `relation "building_permits" does not exist`. Permit-derived cost/SF path is broken. Service falls back to PPI-escalated path, masking the error. |
| **cd.asset_id column missing** | Medium | Data Library cost/SF query in ReplacementCostServiceV2 references `cd.asset_id` which does not exist. Data Library path is silently broken. |
| **No purchase price on deal** | Medium | `properties.acquisition_price` and the deal record have no purchase price. This prevents going-in cap rate calculation and limits debt sizing. |
| **West Midtown submarket_characters empty** | Low | No `submarket_characters` row for submarket_id=9. Market traffic calibration and submarket-level rent comps cannot use this signal. |
| **oppgrid_market_economics vacancy data implausible** | Low | Atlanta row shows `vacancy_rate=49.7%` — clearly incorrect (likely a percentage-of-percentage encoding issue). |
| **rent_roll snapshot absent** | Low | The agent narrative references a rent roll doc (`c9c4bce7`) and populates RR slots in year1, but `rent_roll_snapshots` has 0 rows for this deal. The agent appears to have read rent roll data from the extraction pipeline but did not persist a snapshot record. |
| **fields_written null in agent_run** | Low | `agent_runs.output.fields_written` is null for the latest run. Cannot determine which specific fields the agent wrote vs. which were pre-existing. |

---

## Recommendations for Next Dispatches

1. **Diagnose the CoStar upload pipeline** — The highest-priority gap. The pre-check premise (comps uploaded) was not met. Investigate whether the upload endpoint was called, what it returned, and whether `market_sale_comps` insert is gated on a deal_id or submarket link that prevented rows from landing. Check `file_uploads`, `document_processing`, or any upload audit logs for the upload event.

2. **Fix the NOI agent-slot write** — The cashflow agent produced correct narrative NOI ($3.0M from OM) but did not write the `agent` slot of `year1.noi`. Trace the `write_projection` or `compute_proforma` tool to find where the agent's NOI is assembled and why it falls back to `platform_fallback`. Until this is fixed, the valuation grid's NOI source is unreliable.

3. **Resolve the NOI surface discrepancy** — Once the agent-slot write is fixed, verify that `ValuationGridService.getSubjectProperty()` and `deal_assumptions.year1.noi.resolved` agree. Add a logging checkpoint that emits both values on each valuation grid compute so drift is detectable.

4. **Fix total_opex platform_fallback** — The agent writes individual expense line items correctly (per the year1 JSONB evidence trail) but `total_opex.resolved` falls through to `platform_fallback`. The compose step that sums line items into `total_opex` is apparently not running or not writing its result. This is a parallel bug to the NOI issue.

5. **Fix ReplacementCostServiceV2 table/column gaps** — Create the `building_permits` table (or remove the query if permits data is not available) and fix the `cd.asset_id` column reference in the Data Library cost/SF path. These are silent fallbacks that degrade RC confidence without surfacing errors to the operator.

6. **Populate a purchase price for 464 Bishop** — Set `properties.acquisition_price` to enable going-in cap rate computation, Operator Override method, and debt sizing. The $50M ask price from the OM is a reasonable seed value.

7. **Re-run Stage A after comps are confirmed** — Once the upload pipeline gap is diagnosed and comps are confirmed in `market_sale_comps`, re-run this pre-check. A GREEN Stage A will unlock the intended empirical test: Replacement Cost dilution with real comp data, 4-method reconciliation, and full convergence signal.

---

*Document generated by Task #1455 dispatch. Methodology: direct DB queries + `ValuationGridService.compute()` direct invocation. No code was modified; all observations are read-only.*
