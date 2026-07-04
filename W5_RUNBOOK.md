# W5 Re-Acceptance Runbook

## Scope
Full runbook re-run with turn-cohort engine (Phase 2 W1–W4c). Executed in Replit.

## Precondition: W4c Checklist (Phase 0+)

These checks decide `deriveProjectionForSeed` disposition before any downstream work:

- [ ] **Ribbon source tags**: Check `seed.fields.noi.periods[*].source` — expect `engine_monthly` when engine months available; `derived_projection` or `assumption_trend_ramp` means old ramp is still running
- [ ] **Value equality seed↔engine**: Compare `seed.fields.noi.periods[i].resolved` vs `ModelResults.monthlyCashFlow[i].noi` for i = 0..35. Delta should be < 0.1% or explained
- [ ] **Dead-code confirmation**: `grep -rn 'deriveProjectionForSeed'` across the repo. Verdict per call site — **ALIVE on both full reseed (`proforma-seeder.service.ts:1535`) AND monthly rebase (`reconciliation.service.ts:184`)**. Monthly cadence path is how the June divergence happened. Fix required before fixture pinning.
- [ ] **Highlands source check**: Pull a 100% occupied deal; verify `source` tag is `engine_monthly`, not `derived_projection`

### deriveProjectionForSeed Disposition Rule
- **Status: ALIVE on 2 call sites** — full reseed (`proforma-seeder.service.ts:1535`) and monthly rebase (`reconciliation.service.ts:184`)
- **Fix required**: `gap-bridge.service.ts:224` — `stabilizedMonthlyNoi` must source from `year1.noi.platform` or `year1.noi.om` (stabilized endpoint), not `seed._meta.resolved_noi` (in-place). This is the ramp-target bug causing ~3.2× undershoot on lease-up.
- **Engine months path**: When `monthlyCashFlow` is populated from the runner, seed projection periods should carry `source: 'engine_monthly'` and the old ramp should NOT overwrite them. Verify this in Phase 0+.
- **If dead** (never called when engine months available): **Delete** the function + all call sites. Dead code with a known bug is a trap.
- **If alive** (any path where engine months unavailable): **Fix** `gap-bridge.service.ts:224` — `stabilizedMonthlyNoi` must source from `year1.noi.platform` or `year1.noi.om` (stabilized endpoint), not `seed._meta.resolved_noi` (in-place).

---

## Phase 1: Build Verification

- [ ] `npm install` in Replit
- [ ] `cd backend && npx tsc --noEmit --skipLibCheck` — must pass (compile guard)
- [ ] `npm run test -- --testPathPattern="deterministic"` — must pass
- [ ] Build free/fast/402-immune (no Stripe/Clerk blocking)

## Phase 2: Tri-Tab Identity (Intra-Year Variance)

- [ ] Run model on a real deal with monthlyCashFlow populated
- [ ] Tab 1: Annual view — `annualCashFlow[0].noi` should equal sum of `monthlyCashFlow[0..11].noi`
- [ ] Tab 2: Monthly view — verify intra-year variance is visible (not flat div-12)
- [ ] Tab 3: Cumulative view — verify trajectory shape
- [ ] Paste the intra-year variance (e.g., m1 vs m6 vs m12 NOI) into evidence

## Phase 3: Two Smoke Shapes Against Real Deals

### Shape A: Lease-Up (70% occupied at close, mts=19)
- [ ] Pull a deal with `occupancyAtClose ≈ 0.70` and `monthsToStabilize` set
- [ ] Read **live endpoints** from blob: `inPlaceNOI = year1.noi.resolved` (actuals-derived), `stabilizedNOI = year1.noi.platform` (platform baseline) or `ModelResults.disposition.stabilizedNOI` (model-computed)
- [ ] Paste both endpoint values alongside Y1 NOI — the "strictly between" claim must be arithmetic
- [ ] Expected: `inPlaceNOI < Y1NOI < stabilizedNOI`
- [ ] Monthly: NOI climbs month-over-month; vacancy floor dormant until transition month (record it), then binding
- [ ] `effectiveVacancy` > `vacancy` in late months (floor binding visible)
- [ ] Pull a deal with `occupancyAtClose ≈ 0.70` and `monthsToStabilize` set
- [ ] Expected: Y1 NOI **strictly between** in-place (~$840K-class) and stabilized (~$2.7M-class)
- [ ] Monthly: NOI climbs month-over-month; vacancy floor dormant until ~m16 then binding
- [ ] `effectiveVacancy` > `vacancy` in late months (floor binding visible)

### Shape B: Highlands (100% occupied, no structural vacancy)
- [ ] Pull a fully occupied deal or set `occupancyAtClose = 1.0`
- [ ] Expected: Y1 NOI holds steady; `floorBinding = true` from m1 (effVac = 5%)
- [ ] Physical occupancy ~96.2%; effective vacancy = 5.0%

## Phase 4: Bishop Hindcast Exhibit

- [ ] Pull Bishop's Aug-2017 DB-sourced inputs (12 months realized)
- [ ] Run engine from his acquisition-state inputs
- [ ] Compare monthly trajectory vs realized 2017–18 actuals
- [ ] Flag honest proxies (e.g., actual turnover rate vs assumed 50%)
- [ ] Produce exhibit: engine projection vs realized, month-by-month
- [ ] Verdict: **review exhibit**, not pass/fail

## Phase 5: Consumer Matrix

- [ ] Capital structure route (`capital-structure.routes.ts:518`) — reads `summary.noiYear1`
- [ ] R3-fixed route — verify no regression
- [ ] `/latest` route — serves runner's `ModelResults`, not T-12 overwrite
- [ ] Dashboard (`financial-dashboard.routes.ts:464`) — label check

## Phase 6: Outstanding Debts (D1, T2, S1)

- [ ] D1 behavioral: If not closed, document status
- [ ] T2 cache-hit: If not closed, document status
- [ ] S1 acceptance: If not closed, document status

## Phase 7: Fixture Pinning (ONLY ON FULL GREEN, ± PARITY-PENDING-ORACLE)

Fixtures pin on everything-else-green. Parity validates the engine's self-consistency against the human oracle; these can land a day apart without violating the gate's intent.

### Pre-Staged Oracle Ask (Emit at Session Start)

Leon: When Phase 7 is reached, the following fields need your workbook values for Excel parity. Fill in as many as you have; the rest can be `ORACLE-PENDING`.

| Field | Year | Format | Your Value |
|---|---|---|---|
| GPR | Y1 | Annual $ | |
| Loss to Lease | Y1 | Annual $ | |
| Vacancy | Y1 | Annual $ | |
| Concessions | Y1 | Annual $ | |
| Bad Debt | Y1 | Annual $ | |
| Other Income | Y1 | Annual $ | |
| Total OpEx | Y1 | Annual $ | |
| NOI | Y1 | Annual $ | |
| Occupancy | Y1 | % | |
| DSCR | Y1 | Ratio | |
| Cash on Cash | Y1 | % | |

If you don't have a workbook for the test deal, state `NO-WORKBOOK` and parity will be skipped with a note.

### Fixture Checklist
- [ ] Update golden fixtures with turn-cohort values
- [ ] Property tests: `annualRows[0].noi === sum(monthlyRows[0..11].noi)`
- [ ] Property tests: `occupancy` is emergent, not schedule-derived
- [ ] Property tests: `effectiveVacancy >= vacancy` for all months
- [ ] Excel parity: Export workbook, compare values against runner output
- [ ] **Exit code if oracle unavailable**: `PARITY-PENDING-ORACLE` — fixtures pin, parity resolves later

- [ ] Update golden fixtures with turn-cohort values
- [ ] Property tests: `annualRows[0].noi === sum(monthlyRows[0..11].noi)`
- [ ] Property tests: `occupancy` is emergent, not schedule-derived
- [ ] Property tests: `effectiveVacancy >= vacancy` for all months
- [ ] Excel parity: Export workbook, compare values against runner output
- [ ] **Note**: Excel parity requires workbook values from user — do not proceed without confirmation

---

## Correction Log (W4 Notes Incorporated)

1. **`om: $2,999,564`** — W4c table had sloppy $1.2M figure. Correct value from live DB paste is ~$3.0M. Do not propagate the $1.2M.
2. **`resolution: "platform_fallback"`** on actuals-derived `noi.resolved` is a **provenance lie** — F-P1 migration must repair the tag.
3. **`deriveGapForSeed` vs `deriveProjectionForSeed`** — gap derivation (continuation-of-actuals) targeting last-actual is correct; only the **projection ramp** is superseded by engine months.
