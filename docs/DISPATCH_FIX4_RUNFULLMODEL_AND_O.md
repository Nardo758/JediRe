# DISPATCH — FIX 4: `runFullModel()` Extraction + Finding O (Sources/Uses Reconciliation)

**Executor:** External agent (Claude Code) — engine mandate. Companion doc in repo: `backend/src/services/deterministic/HANDOFF-M-O-DISPATCH.md` (authoritative acceptance criteria; the older HANDOFF-ENGINE-FIX.md M+O section is superseded).
**Repo:** `Nardo758/JediRe.git` · backend port 4000
**Standing rules:** S1-01 live evidence. Compile guard: baseline-diff (`tsc-baseline.txt`, currently 319) — zero NEW errors; shrinkage welcome. No `--no-verify`. Commit early, commit often — no multi-hundred-line uncommitted states on engine files.

## CONTEXT (verified, do not re-derive)
- **Finding M:** the M11 debt-optimizer / M14 DSCR-floor two-pass cycle exists only inside `financial-model-engine.service.ts`'s build orchestration. The golden test's `bridge → runModel()` path is single-pass and can never reproduce live `/build` output. The cycle IS the model; a pure entrypoint must exist.
- **Finding O:** after M11 resized Bishop's loan $39M → $21,024,006, `totalEquity` was never recomputed — summary reports $21M equity against a $60.39M acquisition cost ⇒ sources ≠ uses by $18.3M (46.7%). INV-6 currently surfaces this as an anomaly; the number itself is wrong.
- **Quarantined verification targets (from HANDOFF doc):** loan $21,024,006 / DSCR 1.0424 = LOW O-sensitivity (should HOLD post-fix); IRR −10.21% / EM 0.589 = HIGH O-sensitivity (should MOVE post-fix). **Pre-registered prediction: equity-side values get WORSE (real equity ≈ $39.4M > phantom $21M ⇒ IRR further negative, EM lower). Unchanged IRR/EM to the decimal = O not actually fixed. Uglier returns are the honest ones — not a regression.**

## W1 · Extract `runFullModel()` — one pipeline, one behavior
1. New pure function (suggested home: `deterministic/run-full-model.ts`):
   `runFullModel(assumptions: ModelAssumptions, opts?) → ModelResults`
   executing: pass-1 `runModel()` → M11 capital-structure optimization → M14 DSCR-floor cycle (iterate to convergence as the service does today) → pass-2 `runModel()` on adjusted assumptions → **single assembly point** (`buildFinalResponse`-equivalent) from final state.
2. **Purity contract:** no DB reads, no persistence, no network, no Date.now()-dependent output inside the function. Everything it needs arrives in `assumptions`/`opts`. If extraction reveals a hidden DB read or side effect inside the M11/M14 cycle, that is a NAMED FINDING (engine purity violation) — report it with file:line and propose the injection seam; do not silently inline a query.
3. `financial-model-engine.service.ts` becomes a thin shell: fetch/validate → call `runFullModel()` → persist/respond. **PROHIBITED: a test-only copy of the cycle.** The service and the test call the same function or the fix has failed.
4. Deterministic: same assumptions in ⇒ byte-identical ModelResults out, twice. Prove it.

## W2 · Finding O — equity reconciles after every resize
1. Inside the cycle: whenever debt is resized (M11 or M14), **totalEquity is recomputed** so sources == uses: `equity = totalAcqCost − loan` (with acquisition cost's own components — price, closing, capex budget — assembled once, not re-derived divergently). All equity-derived downstream math (cash-on-cash denominator, IRR cash flows at t0, EM basis) consumes the recomputed value.
2. INV-6 upgrades from anomaly-flag to hard invariant: `|totalEquity − (totalAcqCost − totalDebt)| < $1` ⇒ ERROR, every mode (same structural-impossibility doctrine as K-2).
3. If a legitimate future case needs a funding gap (mezz layer, seller carry), that's a modeled source with a name — never a silent residual. Note this in the invariant's comment; do not build it.

## W3 · K-2 dependent gate (wired, not parked)
Dedicated lease_up-mode test: `stabilizedNOI <= 0` under `mode: lease_up` ⇒ INV-5 `status: 'error'` (not 'warn'). Forced-failure proof pasted.

## W4 · Golden harness switch + Bishop pin (dependent gates)
1. `golden-deals.test.ts` Bishop path switches from `bridge → runModel()` to `bridge → runFullModel()`.
2. Fresh live Bishop capture via `POST /api/v1/financial-model/build` (store-sourced body, Bearer auth) — **the sensitivity diff is the acceptance artifact:** paste old-vs-new for the four quarantined values; LOW-sensitivity pair holds, HIGH-sensitivity pair moves in the predicted direction; INV-6 green in the payload.
3. Populate `bishop.golden.ts` (BuildExpected shape, provenance: store-sourced body · runFullModel commit hash · post-O capture) — pin values MUST come from the live capture that passed the diff, and the test MUST reproduce them through `runFullModel()` (same math, same inputs — this is Finding M's closure criterion).
4. Suite: golden **3/3** (Bishop build_path · Highlands seed_path · SyntheticDegenerate) + identity 4/4 + loudness 2/2 + K-2 test green. Parity remains the sole skip.

## ACCEPTANCE SUMMARY
| # | Item | Evidence |
|---|---|---|
| 1 | runFullModel pure + deterministic | file:line, purity notes, twice-run identical hash |
| 2 | Service is a thin shell calling it; no duplicate cycle | diff |
| 3 | O fixed: sources==uses post-resize; INV-6 hard ERROR | payload paste, forced-failure test |
| 4 | Sensitivity diff matches prediction (LOW holds, HIGH moves worse) | old/new table |
| 5 | K-2 lease_up test green by forced failure | test output |
| 6 | Golden 3/3, full suite green, zero new tsc errors | suite paste + baseline diff |
**Blockers: 1, 3, 4, 6.**

## OUT OF SCOPE
`financial-model.routes.ts` body contract (F-P1-A rides to F-P1) · frontend · seed path/Highlands fixture (pinned, untouchable) · deal-quality commentary on Bishop's negative IRR (honest output of stored $60M price; not a defect) · vendor-pipeline workflow failure (parked, untriaged).

**Run W1→W4 in order. Report with the acceptance table. On green, W5's remaining items (runbook Phases 2–3 + parity list regeneration) execute as the final pass.**
