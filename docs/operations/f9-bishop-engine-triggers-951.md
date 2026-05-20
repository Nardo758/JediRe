# F9 Engine Triggers — Bishop Deal (Task #951)
**Executed:** 2026-05-20  
**Deal:** 464 Bishop — ID `3f32276f-aacd-4da3-b306-317c5109b403`  
**User:** `6253ba3f-d40d-4597-86ab-270c8397a857`

---

## Engine 1 — M25 Strategy Analysis ✅ DONE

**Record inserted:** `strategy_analyses.id = 0dede6a1-0d93-4a60-9b91-34c41cdfd60b`  
**Strategy slug:** `income_core` (stabilized hold — matched to Bishop's `deal_mode=STABILIZED`, `strategy=existing`)  
**Assumptions persisted:**
- `exitCap`: 550 (5.50% — from `proforma_assumptions.exit_cap_current`)
- `capRate`: 500 (5.00% — going-in cap from `deal_assumptions.exit_cap`)
- `holdPeriodYears`: 5
- `vacancyPct`: 5.0%
- `rentGrowthPct`: 3.5%

**Verification:** `GET /api/v1/strategy-analyses/{dealId}` returns the record with `assumptions.exitCap` and `assumptions.capRate` populated. The OverviewTab Broker vs Platform comparison table will now display.

**Method:** Direct DB insert (operational — auth bypass for script context). Route `POST /api/v1/strategy-analyses` with `requireAuth` guards the same path in live product.

---

## Engine 2 — Lease Velocity (LV) — PARTIAL / BLOCKER DOCUMENTED

### Blocker: No rent roll for Bishop
`deal_lease_transactions` has **0 rows** for Bishop. The task spec says: "If no rent roll exists, document this as the blocker." The JEDI Position sub-score tile on the Overview tab reads `f9Financials?.leaseVelocity` which is a **client-side transient state only** — not stored in the DB, not returned by `GET /financials`.

Architecture clarification:
- `GET /financials` → `getDealFinancials()` does **not** return `leaseVelocity` in its response shape (confirmed in `proforma-adjustment.service.ts:4498`)
- `f9Financials.leaseVelocity` is populated client-side when the user visits the LV sub-tab in the F9 engine, which runs the engine and merges the result into React state
- The `lease_velocity.output.updated` window event triggers a financials re-fetch (`FinancialEnginePage.tsx:741`) — but the re-fetch does not include LV output in the response; the LV result is held in local state

### What WAS done (partial operational trigger)
Even without a rent roll, the LV engine ran successfully with deal-derived inputs:
- `total_units`: 232, `current_occupancy`: 0.8017 (from `vacancy_pct=19.83%`), `mode`: STABILIZED_MAINTENANCE
- **120 ConcessionRecord rows persisted** to `deals.deal_data.lv_concession_records`
- This enables `computeConcessionRecognition()` to run in `financials-composer.service.ts`, populating `concessionRecognition` in the financials response

### Unblocking the JEDI Position tile
The tile will populate once the user opens the Bishop deal in the F9 Financial Engine and navigates to the LV sub-tab. No code change needed — the engine is wired; the data gap is just the first client-side run.

---

## Engine 3 — M07 Traffic Calibration ✅ ALREADY DONE (via fallback)

`proforma_assumptions` for Bishop already had valid calibrated scalars (inserted 2026-05-05):
- `vacancy_current`: 5.00%  
- `rent_growth_current`: 3.500%  
- `exit_cap_current`: 5.500%

`getDealFinancials()` has a **fallback path** (lines 2805–2827) that, when `traffic_projections` has no row for the deal but `proforma_assumptions` exists, returns a non-null `trafficProjection.calibrated` object:

```json
{
  "vacancyPct": 0.05,
  "rentGrowthPct": 0.035,
  "exitCap": 0.055,
  "lastCalibrated": null
}
```

The OverviewTab reads `f9Financials?.trafficProjection?.calibrated?.exitCap` (line 45) and `f9Financials?.trafficProjection?.calibrated?.vacancyPct` (line 67) — both will be non-null.  
**No `traffic_projections` row needed** — the fallback is sufficient.

---

## Final State

| Engine | Status | Evidence |
|---|---|---|
| M25 Strategy Analysis | ✅ Done | `strategy_analyses` row `0dede6a1` created |
| LV `lv_concession_records` | ✅ Done | 120 records in `deals.deal_data` |
| LV `f9Financials.leaseVelocity` | ⚠️ Client-side only | No persistent server path; user must visit LV sub-tab |
| M07 Traffic Calibrated | ✅ Done | `proforma_assumptions` fallback returns calibrated object |

---

## Follow-up needed
- **Wire `f9Financials.leaseVelocity` into getDealFinancials** by persisting the full LV result to `deals.deal_data.lv_output` on engine run, and reading it back in `getDealFinancials`. Without this, the JEDI Position tile resets to blank on every page load until the user re-runs the LV sub-tab. See `backend/src/api/rest/lease-velocity.routes.ts` (persistLvConcessionRecords fn, extend to also persist full result) and `backend/src/services/proforma-adjustment.service.ts:4498` (add `leaseVelocity: dealData.lv_output ?? null` to return shape).
