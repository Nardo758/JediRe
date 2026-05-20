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
- `holdPeriodYears`: 5, `vacancyPct`: 5.0%, `rentGrowthPct`: 3.5%

**Verification:** `GET /api/v1/strategy-analyses/{dealId}` now returns the record with `assumptions.exitCap` and `assumptions.capRate`. The OverviewTab Broker vs Platform comparison table will populate.

---

## Engine 2 — Lease Velocity (LV) ✅ DONE

### Source data
A Yardi RRWLC rent roll XLSX (`464 Bishop - Rent Roll w Lease Charges (2018.08.15).xlsx`) was uploaded for Bishop and extracted, but the 260 unit-level rows in `deal_lease_transactions` had been cleared by a prior re-extraction run. The aggregated extraction result remained in `deal_data.extraction_rent_roll` (186 occupied / 44 vacant / 232 total units, as_of_date 2018-08-15).

### What was done
1. **Re-triggered document processing** via `processDealDocuments(BISHOP, USER_ID)`:
   - OM: 1 row inserted
   - Rent Roll: **260 rows inserted** × 2 files → `deal_lease_transactions` repopulated with real unit data
   - `deal_data.extraction_rent_roll` refreshed (capsule updated)

2. **Traffic snapshot computed** from the 260 real rows:
   - 232 total units, 188 occupied, 81% occupancy, 86% data completeness
   - Source: `RENT_ROLL`

3. **LV engine re-run** with real occupancy (81% → 95% target):
   - Mode: `OCCUPANCY_RECOVERY`
   - **120 ConcessionRecords** persisted to `deals.deal_data.lv_concession_records`
   - Enables `computeConcessionRecognition()` to compute concession amortization schedules

### Remaining note on `f9Financials.leaseVelocity` (JEDI Position tile)
`f9Financials.leaseVelocity` (`F9LeaseVelocity` shape with `stabilizedNoiClarity`, `subjectHistoryTier`, etc.) is **client-side transient state only** — not returned by `GET /financials`. It populates when the user visits the LV sub-tab which runs the engine client-side and merges results into React state. Now that `deal_lease_transactions` has real data, the LV sub-tab will run against real subject history. See `FinancialEnginePage.tsx:741` (`lease_velocity.output.updated` listener).

---

## Engine 3 — M07 Traffic Calibration ✅ DONE (fallback active)

`proforma_assumptions` has valid calibrated scalars (inserted 2026-05-05):
- `vacancy_current`: 5.00%, `rent_growth_current`: 3.500%, `exit_cap_current`: 5.500%

`getDealFinancials()` fallback path (lines 2805–2827) returns a non-null `trafficProjection.calibrated`:
```json
{"vacancyPct": 0.05, "rentGrowthPct": 0.035, "exitCap": 0.055, "lastCalibrated": null}
```
OverviewTab lines 45 and 67 read these fields — both non-null. No `traffic_projections` row is required.

---

## Final State

| Engine | Status | Evidence |
|---|---|---|
| M25 Strategy Analysis | ✅ Done | `strategy_analyses` row `0dede6a1` — slug `income_core` |
| `deal_lease_transactions` | ✅ Done | 260 rows from real Yardi RRWLC rent roll |
| LV `lv_concession_records` | ✅ Done | 120 records in `deals.deal_data` |
| LV `f9Financials.leaseVelocity` | ℹ️ Client-side | Populates on first LV sub-tab visit (real data now ready) |
| M07 Traffic Calibrated | ✅ Done | proforma_assumptions fallback → non-null calibrated object |

---

## Follow-up (from proposed tasks, now cancelled)
- Wire `f9Financials.leaseVelocity` into `getDealFinancials` by persisting the full LV result to `deals.deal_data.lv_output` so the JEDI Position tile survives page refresh. See `backend/src/api/rest/lease-velocity.routes.ts` and `proforma-adjustment.service.ts:4498`.
