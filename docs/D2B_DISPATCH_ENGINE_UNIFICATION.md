# DISPATCH — D2b: Engine Unification + Consumer Migration + Golden-Deal Harness (+ Part A Execution)

**Arc:** F9 Underwriter Model. Gate G1 CLEARED (operator rulings 2026-07-03): G1-1 approved, G1-2 closed-no-action, G1-3 composition spec RATIFIED with `F9_PROFORMA_BLUEPRINT.md` as rehoming map.
**Repo:** `Nardo758/JediRe.git` · backend port 4000
**Environment note:** work items W1–W3 are code + harness work executable now; W4 (D2 Part A live acceptance) and W5 (D2b live acceptance) require the live DB/backend/frontend — execute them in the live session, same dispatch. Nothing closes on code inspection: "inferable" and "verifiable from code" remain OPEN states.
**Standing rule (S1-01):** live proof per item; the harness (W3) is a drift alarm, never an acceptance substitute.

## W1 · Kill Engine A's computation path
1. `getProFormaComputed()` / `finalize()`-with-dummy-assumptions in `proforma-adjustment.service.ts` is removed (or reduced to a thin delegate that calls Engine C's `buildModel()`). The hardcoded assumption block ($50M / 232 units / $1,850 / 35M @ 5.5%) is deleted — grep proves no hardcoded financial-assumption literal survives in A.
2. A retains ONLY: assumption adjustments (userOverride > current > baseline resolution) and W-04 policy mutations (rent control / tax abatement / eviction moratorium) writing to `deal_assumptions` / `per_year_overrides` — applied BEFORE `buildModel()` reads. Paste the ordering guarantee (file:line of the sequencing).

## W2 · Consumer migration — proof per consumer (operator-required, D2b item 1)
The four named consumers of A's computed output: deal-panel routes, M09→M11 capital-structure handoff, baseline-vs-adjusted UI comparison, Traffic Engine v2 refresh hook.
1. For EACH: determine whether it ever DISPLAYED or persisted A's toy-model numbers (file:line trace of the data path to a user-visible surface or stored row). Report the exposure verdict per consumer — this quantifies how long fabricated numbers were user-visible, which goes in the report even though it's historical.
2. Migrate each to C's `buildModel()` path (or to A's assumption outputs where the consumer only ever wanted assumptions, not financials — the baseline-vs-adjusted UI may be this case; verify, don't assume).
3. Live proof per consumer in W5: trigger each surface, paste the value shown alongside C's computed value for the same deal — equal.

## W3 · Golden-deal regression harness (D2b-G)
1. **Golden fixtures:** Bishop (`3f32276f`) + Highlands (`eaabeb9f`) with pinned assumption sets and expected outputs captured from the unified engine AFTER W1/W2 land and W4/W5 accept (fixtures pin verified-correct values, not current values — sequencing matters).
2. **Excel parity:** one real deal, operator's workbook as oracle: Leon supplies (or confirms) the workbook values for the golden assumption set; harness asserts line-by-line agreement GPR→IRR within rounding tolerance (state the tolerance per line class). Any disagreement is a finding for operator review — the workbook wins unless the workbook has the bug, which is itself a finding.
3. **Identity invariants as property tests** over randomized assumption sets (seeded, reproducible): yearly == Σ monthly (every field, every year) · EGI == GPR − LTL − vac − conc − BD + other income · NOI == EGI − Σ opex · debt-schedule ties (begin − principal == end, per period) · sale-proceeds reconciliation · degenerate-ramp identity (baseline ≈ stabilized ⇒ ramp ≈ trend).
4. Runs in CI on every engine-path change (runner, bridge, seeder, stabilization, A's assumption layer). Discipline note IN the harness README: green harness never closes a dispatch.

## W4 · D2 Part A — live acceptance (deferred items, execute in live session, unchanged from `D2_ACCEPTANCE_AND_ENGINE_PROBE.md`)
Items 1 (tri-tab identity both deals), 2 (Bishop before/after exhibit vs stale $2.92M/$3.01M/$3.23M), 3 (ribbon consumption value spot-check — code trace already done, live value check remains), 4 (Highlands regression: 2026-04-01 / 57.17% / $6,315,308), 5 (build free + fast, zero LLM calls, zero ledger rows), 6 (402 immunity — LIVE, not inferred), 7a (D1 behavioral navigation pass), 7b (T2 forced cache-hit, three-term math).

## W5 · D2b live acceptance
1. Per-consumer value-equality proofs from W2.3.
2. Overlap-set spot check: for both golden deals, KPI set (NOI, EGI, DSCR, IRR, EM) fetched via every consumer path — one value per quantity per deal, everywhere. Paste the matrix.
3. Harness green on the unified engine; property tests pass on ≥1000 randomized sets; Excel parity report attached.
4. Highlands canary: unchanged, again.
**Blockers: W2.3, W4 items 1/2/4/5, W5.2.**

## OUT OF SCOPE
F-P1 store consolidation (next in chain) · S2 goal-seek inversion · GoalSeekWidget retirement (waits for S2) · frontend math leakage retirement beyond what W2 migration forces (client debt-service + noiAfterReserves retire in F-P1's edit-path work unless W2 touches them first — if touched, retire, don't duplicate) · anything in F-P2/P3.

**Run W1–W3 now; W4+W5 in the live session; one combined report.**
