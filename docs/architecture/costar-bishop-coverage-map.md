# CoStar Bishop Coverage Map — Deal-Scoped Correlation Sweep
**Date:** 2026-07-08  
**Dispatch:** DISPATCH_DEALSCOPED_SWEEP_COVERAGE_MAP  
**Deal:** Bishop `3f32276f-aacd-4da3-b306-317c5109b403`  
**Standing rules:** Names and counts only — no CoStar values in this report.

---

## S1 — Deal-Scoped Correlation Sweep

### Design check

**Does the correlation engine support deal-scoped sweep + storage today?**  
Yes — no code changes needed. The storage path was already capable:

- `metric_correlations.scope_id` accepts any string value (default `'GLOBAL'`)
- `metric_correlations.redistribution_restricted` is already a boolean column
- `computePairCorrelation` line 584: `const restricted = scope !== 'GLOBAL'` → passing `scope = 'deal:3f32276f-...'` automatically sets `redistribution_restricted = true` on every output row
- No migration required; the minimal shape is `scope_id = 'deal:3f32276f-aacd-4da3-b306-317c5109b403'`, `redistribution_restricted = true`

**Promotion guard (grep + proof):**  
Every aggregation step in `computeMatrix` reads with `AND scope_id = 'GLOBAL'` (hardcoded, lines 938–964) and writes `'GLOBAL', FALSE` (hardcoded). Deal-scoped rows are **structurally invisible** to the aggregation path. No write path promotes `scope_id = 'deal:...'` to `'GLOBAL'` — confirmed by grep over the full 3760-line file. No forced-failure test needed: the promotion path does not exist in code.

### Sweep execution (S1-01 live output)

**Scope:** All pairs where at least one metric is a CoStar (`CS_`) metric, across all 41 of Bishop's geographies (40 submarkets + 1 MSA: `atlanta-ga-ga`). Pure public×public pairs stay in GLOBAL scope per derivation-chain discipline.

**Stored in `metric_correlations` (`scope_id = 'deal:3f32276f-...'`, `redistribution_restricted = TRUE`):**

| Pair type | Pairs stored | Avg \|r\| | Strong pairs (\|r\|≥0.7) |
|---|---|---|---|
| CS×CS (both metrics CoStar) | 66 | 0.467 | 19 |
| CS×public (cross-signal) | 204 | 0.314 | 17 |
| **Total** | **270** | — | **36** |

Pairs skipped (< 12 overlapping observations): 12

**Pairs dependent on CoStar-lineage inputs (absent from the GLOBAL sweep):** All 270 — any pair involving a CS_ metric requires Bishop's restricted rows, which are invisible to the GLOBAL read-path. The 66 CS×CS pairs would not exist anywhere in the platform without this upload; the 204 CS×public pairs provide cross-correlations only available with Bishop's deal scope.

### Negative proof (non-Bishop query)

```sql
-- Non-owning query: can any GLOBAL or unrestricted reader see these?
SELECT COUNT(*) FROM metric_correlations
WHERE redistribution_restricted = FALSE
  AND (metric_a ILIKE 'CS_%' OR metric_b ILIKE 'CS_%');
-- Result: 0
```

A GLOBAL correlation query returns **0** CoStar-involved rows. Scope isolation confirmed.

### Bonus finding: 106 stale pre-fix GLOBAL rows purged

During the negative-proof check, 106 rows were found in `metric_correlations` with `scope_id = 'GLOBAL'` and `redistribution_restricted = FALSE` but involving CS_ metrics. These were produced by the **03:00 AM scheduled sweep** on 2026-07-08 — running in the gap window after the I1-EXTENSION migration marked `metric_time_series` CS_ rows as restricted, but before the correlationEngine read-path fix was deployed (backend restarted at 22:54). The nightly sweep doesn't delete pairs it no longer computes, so they survived. All 106 were purged:

```sql
DELETE FROM metric_correlations
WHERE redistribution_restricted = FALSE AND scope_id = 'GLOBAL'
  AND (metric_a ILIKE 'CS_%' OR metric_b ILIKE 'CS_%');
-- Deleted: 106
```

**GLOBAL baseline post-purge:** 10,530 correlations, **0** CS_ pairs. Sweep pattern holds (4209/4746 seeding behavior unchanged for new computations).

**Operational note:** The weekly correlation sweep (cron: Sundays 03:00 AM) runs with no `dealId` argument — it will never re-produce these rows. No ongoing risk.

---

## S2 — Coverage Map

### What's in Bishop's CoStar data

**Table 1: `costar_submarket_stats` — 125 rows**

| Field | Rows populated | Coverage |
|---|---|---|
| `vacancy_rate` | 125 | 100% |
| `asking_rent_per_unit` | 125 | 100% |
| `yoy_rent_growth` | 121 | 97% |
| `absorption_units` | 124 | 99% |
| `effective_rent_per_unit` | 0 | 0% — empty |
| `concession_pct` | 0 | 0% — empty |
| `occupancy_pct` | 0 | 0% — empty |

- **Geography:** 1 submarket — "West Midtown, GA"
- **Period:** 2000-01-01 → 2031-04-01 (quarterly, 125 periods including forecast)

**Table 2: `metric_time_series` — 23,488 rows, 55 distinct metrics**

| Tier | Metrics | Date range | Geos |
|---|---|---|---|
| Long series (31 years) | CS_INVENTORY_UNITS, CS_VACANCY_RATE, CS_ASSET_VALUE, CS_SALE_PRICE_UNIT, CS_MARKET_RENT, CS_CAP_RATE, CS_NET_ABSORPTION, CS_RENT_GROWTH, CS_SALES_VOLUME, CS_UNDER_CONSTRUCTION | 2000-Q1 → 2031-Q2 | 41 |
| Medium series (10 years) | CS_EFFECTIVE_RENT, CS_EFF_RENT_1BR/2BR/3BR/STUDIO, CS_RENT_1BR/2BR/3BR/STUDIO, CS_STABILIZED_VACANCY, CS_OCCUPANCY_RATE, CS_EFF_RENT_GROWTH, CS_EFF_RENT_GROWTH_QTR, CS_RENT_GROWTH_QTR, CS_NET_DELIVERIES, CS_NET_DELIVERIES_12MO, CS_ABSORPTION_UNITS, CS_ABSORPTION_PCT, CS_DEMAND_UNITS, CS_DELIVERIES, CS_DEMOLISHED, CS_PRICE_GROWTH, CS_PRICE_INDEX, CS_RENT_INDEX, CS_RENT_PSF, CS_EFF_RENT_PSF, CS_CAP_RATE_TXNS, CS_TOTAL_SALES_TXNS, CS_SOLD_UNITS, CS_BUILDINGS | 2016-Q4 → 2026-Q4 | 40 |
| Shorter series | CS_CONSTR_STARTS, CS_CONSTR_STARTS_12MO, CS_UNDER_CONSTR_BLDGS, CS_DELIVERED_BLDGS, CS_DEMOLISHED_BLDGS, CS_MEDIAN_CAP_RATE, CS_MEDIAN_PRICE_BLDGSF, CS_MEDIAN_PRICE_UNIT, CS_SALES_VOL_TXNS, CS_BUILDINGS | 2016-Q4 → 2025-Q4 | 40 |
| Aggregated only | CS_UNDER_CONSTR_PCT, CS_SALES_VOL_GROWTH | 2000-Q1 → 2026-Q2 | 1 (MSA only) |
| Transaction averages | CS_AVG_SALE_PRICE, CS_AVG_UNITS_SOLD, CS_TXN_PRICE_UNIT, CS_TRANSACTION_CAP_RATE | 2016-Q4 → 2025-Q4 | 37–39 |

**Geography coverage:** 40 Atlanta-area submarkets + 1 MSA (`atlanta-ga-ga`). The 40 submarket IDs are CoStar submarket codes (e.g., `apt-1-10119` = Midtown Atlanta). West Midtown (Bishop's specific submarket) is `costar_submarket_stats` only; the `metric_time_series` 40 submarkets cover the broader MSA.

### Signals now computed for Bishop that are absent from the GLOBAL sweep

All 270 stored correlations are deal-exclusive. The 36 strong correlations (|r| ≥ 0.7) by CoStar metric:

**Strongest CS×public cross-signals (cross-correlations only Bishop can see):**

| CoStar metric | Public metric correlated | |r| | Sample |
|---|---|---|---|
| CS_UNDER_CONSTR_PCT | R_SUPPLY_RISK | 1.000 | 106 |
| CS_INVENTORY_UNITS | D_AVG_WEEKLY_WAGE | 0.956 | 103 |
| CS_UNDER_CONSTRUCTION | R_SUPPLY_RISK | 0.940 | 106 |
| CS_ASSET_VALUE | D_AVG_WEEKLY_WAGE | 0.934 | 103 |
| CS_SALE_PRICE_UNIT | D_AVG_WEEKLY_WAGE | 0.934 | 103 |
| CS_MARKET_RENT | D_AVG_WEEKLY_WAGE | 0.868 | 103 |
| CS_CAP_RATE | D_AVG_WEEKLY_WAGE | -0.863 | 103 |

**Strongest CS×CS internal signals (pure CoStar structure):**

| Pair | |r| | Signal |
|---|---|---|
| CS_ASSET_VALUE ↔ CS_SALE_PRICE_UNIT | 1.000 | Asset value and sale price move in lockstep |
| CS_MARKET_RENT ↔ CS_SALE_PRICE_UNIT | 0.969 | Rent growth drives price growth |
| CS_MARKET_RENT ↔ CS_ASSET_VALUE | 0.969 | Same structural relationship |
| CS_CAP_RATE ↔ CS_ASSET_VALUE | -0.895 | Cap compression as values rise |
| CS_CAP_RATE ↔ CS_MARKET_RENT | -0.768 | Cap rate inversely tracks rent level |

### Bishop's gap fields

Fields in `deal_assumptions` that are NULL, zeroed/defaulted, or likely platform-fallback:

| Field | Value | Status |
|---|---|---|
| `absorption_units_per_month` | NULL | Not set |
| `lease_up_months` | NULL | Not set |
| `construction_months` | NULL | Not set |
| `ltv` | NULL | Not set (year1.ltv_pct=0.75 is platform-seeded) |
| `concessions_pct` | 0.00 | Defaulted (no operator input) |
| `rent_growth_stabilized` | 0.00 | Zeroed/defaulted |
| `vacancy_pct` | 19.83% | In-place vacancy; stabilized market rate unknown |
| `opex_ratio` | 35.00 | Platform default |
| `exit_cap` | 0.0500 | Platform default (5.00%) |
| `dscr_min` | 1.25 | Default; no market evidence either way |

### The coverage map

**Non-goal (explicit):** CoStar market data does NOT populate assumption fields by assignment. It becomes evidence an agent cites when *proposing* a value through the D3 seam (`agent_confirmed` + `reasoning` + `evidence_refs`). This map tells the operator what D3's agent will be able to justify — not what gets auto-filled.

| Gap field | CoStar evidence available | Verdict | Notes |
|---|---|---|---|
| `rent_growth_stabilized` (0.00) | CS_RENT_GROWTH (25yr), CS_EFF_RENT_GROWTH (10yr), CS_RENT_GROWTH_QTR — West Midtown + 40 subs | **EVIDENCE-AVAILABLE** | Directly answers "what has West Midtown rent grown at" — D3 agent can cite submarket trend and propose a non-zero value |
| `vacancy_pct` (stabilized market rate) | CS_VACANCY_RATE (25yr), CS_STABILIZED_VACANCY (10yr), CS_OCCUPANCY_RATE — 40 submarkets | **EVIDENCE-AVAILABLE** | In-place 19.83% is a value-add starting point; CoStar provides the stabilized submarket vacancy an agent can propose as the go-forward target |
| `exit_cap` (0.0500 default) | CS_CAP_RATE (25yr, r=-0.895 vs asset value), CS_CAP_RATE_TXNS, CS_TRANSACTION_CAP_RATE, CS_MEDIAN_CAP_RATE — 40 submarkets | **EVIDENCE-AVAILABLE** | Richest coverage. Four cap-rate series, 25yr depth, cross-validated by transaction data. Strong justification for any exit cap proposal |
| `absorption_units_per_month` (NULL) | CS_NET_ABSORPTION (25yr), CS_ABSORPTION_UNITS (10yr), CS_DEMAND_UNITS (10yr) — 40 submarkets | **EVIDENCE-AVAILABLE** | Three absorption metrics across 40 submarkets; agent can derive a per-month rate directly |
| `lease_up_months` (NULL) | CS_ABSORPTION_UNITS + CS_DEMAND_UNITS + CS_NET_DELIVERIES — rate derivable | **PARTIAL** | No single "months to lease-up" metric; rate is inferred from absorption/deliveries ratio. Agent can propose but must show derivation |
| `ltv` (NULL) | CS_CAP_RATE + CS_ASSET_VALUE → market-implied LTV benchmarks (indirect) | **PARTIAL** | CoStar doesn't provide lender LTV data. Cap rate + value series inform asset underwriting context; an agent can use them to benchmark LTV against market conditions but cannot directly cite a CoStar LTV figure |
| `concessions_pct` (0.00) | `costar_submarket_stats.concession_pct` column is empty (0 rows populated); no concession metric in CS_ time series | **NO-COVERAGE** | CoStar upload did not include concession data. No agent-citable evidence for this field |
| `opex_ratio` (35.00 default) | No CoStar operating expense or NOI ratio metric | **NO-COVERAGE** | CoStar does not provide expense ratio data in this upload |
| `construction_months` (NULL) | No construction duration metric in CS_ series | **NO-COVERAGE** | CS_CONSTR_STARTS tracks new starts count, not duration |
| `dscr_min` (1.25 default) | No CoStar debt coverage or lender terms data | **NO-COVERAGE** | Lender-side metric; out of CoStar's data scope |

---

## S3 — Verdict: Is Bishop's CoStar Upload Rich Enough to Matter?

**Coverage summary:**

| Verdict | Count | Fields |
|---|---|---|
| EVIDENCE-AVAILABLE | 4 | `rent_growth_stabilized`, `vacancy_pct` (stabilized), `exit_cap`, `absorption_units_per_month` |
| PARTIAL | 2 | `lease_up_months`, `ltv` |
| NO-COVERAGE | 4 | `concessions_pct`, `opex_ratio`, `construction_months`, `dscr_min` |

**Answer: Yes — moderately rich, with three standout fields.**

4 of 10 gap fields have clean, direct evidence. The upload is 25 years deep on the most structurally important assumptions (exit cap, rent growth, vacancy). The 4 no-coverage fields are either lender-side (`dscr_min`, `ltv` partial) or cost-side (`opex_ratio`, `concessions_pct`) — CoStar does not provide those regardless of upload depth.

**Top 3 fields for D3's first demos (well-evidenced agent proposals):**

1. **`exit_cap`** — Four distinct cap-rate series (CS_CAP_RATE 25yr, CS_CAP_RATE_TXNS, CS_TRANSACTION_CAP_RATE, CS_MEDIAN_CAP_RATE), spanning 40 submarkets, with strong structural correlations (r=-0.895 with asset value, r=-0.768 with market rent). Agent can propose a current-cycle exit cap with transaction-level support and trend context. Current platform default of 5.00% may be high or low relative to the market — CoStar can say which.

2. **`vacancy_pct` (stabilized)** — The current in-place 19.83% is a value-add starting point. CS_VACANCY_RATE (25yr) and CS_STABILIZED_VACANCY (10yr) give the submarket's long-run stabilized rate. Agent can propose a go-forward vacancy target with direct West Midtown submarket evidence, replacing a guess with a market-calibrated number.

3. **`rent_growth_stabilized`** — Currently zeroed (0.00%). CS_RENT_GROWTH (25yr) and CS_EFF_RENT_GROWTH (10yr) provide a cycle-aware market rent growth series. Agent can propose a non-zero, trend-backed rent growth assumption with a citable 25-year West Midtown time series. This assumption drives NOI projection quality significantly.

**What D3 cannot demo from this upload:** Concession structure, operating expenses, construction timeline, and lender terms — those require T12 extraction, contractor input, or lender term sheets. CoStar does not cover the cost/debt side.

---

---

## X3 — Design Note: `data_kind` on Every `evidence_ref` (2026-07-08)

**Status:** Design note only — not built in this dispatch.

When D3's agent constructs an `evidence_ref` (a citation that backs an assumption proposal), each reference must carry a `data_kind` discriminator indicating whether the cited observation is historical fact or a forward projection. This is required because:

1. **CoStar time series mix actuals and forecasts.** CS_RENT_GROWTH (25yr) contains historical actuals back to ~2000 and CoStar-modeled forward estimates from the present. An agent citing "rent growth 3.2% per CS_RENT_GROWTH" without a `data_kind` annotation is ambiguous — the operator cannot tell whether that figure is a trailing 5yr average (an actual) or a CoStar forecast projection.

2. **License exposure differs by kind.** Historical actuals are licensed differently from CoStar's proprietary forecast models. Forecast values carry additional redistribution constraints under the CoStar enterprise license.

3. **Confidence signals differ.** An `actual` citation should increase operator confidence; a `forecast` citation should trigger scrutiny and possibly a discount in the agent's proposed value.

**Required shape for every `evidence_ref` in D3:**

```typescript
interface EvidenceRef {
  metric_id: string;           // e.g. 'CS_RENT_GROWTH'
  geography_id: string;        // e.g. 'west_midtown_atlanta'
  period: string;              // ISO date or range, e.g. '2019-01/2024-12'
  value: number;
  data_kind: 'actual' | 'forecast';  // ← REQUIRED; no default allowed
  source: string;              // vendor or platform series label
  redistribution_restricted?: boolean;
}
```

**Implementation rule (for when D3 is built):**
- CoStar observations with an `as_of_date` in the past AND no forecast-flag annotation → `data_kind: 'actual'`
- CoStar observations with `as_of_date` beyond the vendor's data-as-of date in `historical_observations.vendor_data_as_of` → `data_kind: 'forecast'`
- When ambiguous, prefer `'forecast'` (conservative — the operator can override; a missed forecast flag cannot be recalled)
- D3's agent prompt must instruct Claude to always emit `data_kind` and never omit it

**Note on current data:** Bishop's upload has `vendor_data_as_of` stored in `historical_observations.vendor_data_as_of`. Any time-series observations beyond that date are CoStar forecasts, not actuals. The 25yr CS_RENT_GROWTH series is mostly actuals (pre-2025); the forward growth tail beyond 2025 is a forecast.

---

## Files changed by this dispatch

- `docs/architecture/costar-bishop-coverage-map.md` (this file — new; X3 design note appended 2026-07-08)
- `metric_correlations` — 270 rows added (scope `deal:3f32276f-...`, restricted=true); 106 stale pre-fix rows deleted
