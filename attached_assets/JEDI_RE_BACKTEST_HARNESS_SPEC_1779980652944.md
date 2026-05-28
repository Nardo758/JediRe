# JEDI RE — BACKTEST HARNESS SPEC

**Purpose:** Confirm the *whole pipeline* produces a defensible valuation — by running deals where the answer is already known and comparing the platform's output to reality. This is Layer 3 of the verification model: it tests integration, not pieces. Companion to `JEDI_RE_MASTER_PLAN_FOR_REPLIT.md` and `JEDI_RE_VERIFICATION_PROTOCOL.md`.

**Why this is the test that matters:** A comp engine that works and a valuation engine that works can still produce garbage together if the handoff is wrong. Per-dispatch verification (Layers 1–2) confirms each piece. Only the backtest confirms the pieces compose into the right answer. It is the acceptance test for "did the plan actually land."

---

## THE GROUND TRUTH SET

Three deals you closed, where you know the real outcome (from the Historical Observations corpus S1 set):

| Deal | History | What you know |
|---|---|---|
| Jacksonville | 2018 → present (~84 monthly rows) | Actual purchase price, actual going-in cap, actual operating performance |
| Atlanta #1 | 2020 → present (~60 monthly rows) | Same |
| Atlanta #2 | 2022 → present (~36 monthly rows) | Same |

These are the only deals where the platform can be graded against truth. Treat them as the gold set. Do not tune comp selection or assumptions *to* these deals (that's overfitting) — tune to general principles, then test against these.

---

## THE ACCEPTANCE BARS

| Metric | Bar | On a 5.5% cap, $10M deal |
|---|---|---|
| Purchase Price | within **±5%** of actual | $9.5M – $10.5M |
| Going-in cap rate | within **±25bps** of actual | 5.25% – 5.75% |

### The coupling tension (read this)

Price = NOI ÷ cap rate. These two bars interact:
- ±25bps on a 5.5% cap is ±4.5% of price *from cap rate alone* (0.25 ÷ 5.5).
- The price bar is ±5%.
- So if cap rate sits at the edge of its ±25bps tolerance, ~4.5% of the 5% price budget is already consumed — leaving ~0.5% for NOI error.

**Implication:** these bars require the platform to get BOTH NOI and cap rate nearly exactly right, simultaneously. This is an aggressive, production-sharp standard. Expect the first backtest to fail it. That is not evidence the approach is broken — it's evidence the platform is untuned. The error reporting below is what distinguishes the two.

If the coupling proves impractical after tuning, loosen one bar — but decide based on the actual error data, not in advance.

---

## WHAT THE HARNESS REPORTS (the critical design choice)

The harness does NOT report pass/fail alone. Pass/fail hides the diagnostic signal. It reports **actual error, per deal, per method**, so every run tells you *how far off and why.*

### Required output per deal

```
DEAL: Jacksonville
Actual purchase price:    $X
Actual going-in cap:      Y.YY%

PER-METHOD INDICATED VALUE:
  Method              Indicated    Error vs actual    Within bar?
  Cap Rate × NOI      $...         +N.N%              [ ]
  Sales Comp PPU      $...         -N.N%              [ ]
  Sales Comp PSF      $...         +N.N%              [ ]
  Per-Unit Benchmark  $...         +N.N%              [ ]
  GRM                 $...         (if active)        [ ]
  GIM                 $...         (if active)        [ ]
  DCF                 $...         (if active)        [ ]
  Replacement Cost    $...         +N.N%              [ ]

RECONCILED RANGE:       $low – $high
RECONCILED MIDPOINT:    $...        Error vs actual: ±N.N%   PASS/FAIL (±5%)

CAP RATE:
  Implied (comp-anchored):  Z.ZZ%    Error vs actual: ±NN bps   PASS/FAIL (±25bps)

NOI:
  Platform-derived:  $...    Actual at acquisition: $...   Error: ±N.N%
```

### Why per-method matters
- If the reconciled midpoint passes but individual methods diverge wildly, the reconciliation is *masking* broken methods — the midpoint landed by luck. Per-method error exposes this.
- If one method is the outlier (e.g., Replacement Cost off 40%, everything else within 8%), you know exactly what to fix.
- The NOI line separates "cap rate wrong" from "NOI wrong" — the two ways price can be off.

---

## THE AS-OF-DATE DISCIPLINE (do not leak the future)

The backtest must value each deal **as if standing at its acquisition date** — using only data that existed then. This is the single most important methodological rule.

- **Comp set:** only comps with sale/lease dates BEFORE the acquisition date. A 2023 comp cannot inform a 2018 valuation.
- **Market data:** rent/vacancy/cap rate as-of the acquisition date, not current.
- **Assumptions:** derived from what was knowable then, not from the realized performance.
- **No realized-outcome leakage:** the platform must not see how the deal actually performed. It values blind, then we compare to truth.

If the harness uses current comps to value a 2018 acquisition, it's cheating — it knows the future. The result would look good and mean nothing.

**Implementation note:** every comp/market query in backtest mode takes an `as_of` parameter and filters strictly to data dated before it. Confirm this filter works (Layer 1 check on the harness itself).

---

## CALIBRATION VS BREAKAGE — INTERPRETING RESULTS

The first run will fail ±5%. The error magnitude tells you which problem you have:

| Per-deal error | Interpretation | Action |
|---|---|---|
| All three within ±5–10% | Calibration — close, minor tuning | Tune weights, refine comp selection; re-run |
| One deal off, two close | Deal-specific issue | Investigate the outlier — bad comps? wrong subject data? |
| One method off, others close | Method breakage | Fix that method (per-method error pinpoints it) |
| All three off >20% | Approach problem | Step back — is comp-anchored valuation sound? Is the as-of filter leaking? |
| Right price, wrong cap | NOI/cap compensating errors | Two errors canceling — fix both even though price "passed" |

The point: **the error number diagnoses the cause.** A blunt pass/fail would tell you "it failed" and nothing about why.

---

## HOW TO RUN IT

### Prerequisites (must pass before backtest is meaningful)
1. Subject records populated for all three deals (D-DEAL-2) — units, sqft, year built, geocode
2. Comp data available as-of each acquisition date (platform + CoStar backfill if needed)
3. Valuation Grid functioning (column fix + comp-anchored cap rate)
4. As-of-date filter implemented and Layer-1 confirmed

If subject data or as-of comps are missing for a deal, that deal can't be backtested yet — note it, run the deals that can.

### Run procedure
1. For each deal, set `as_of` = acquisition date
2. Run the full pipeline: subject → comp selection → assumption derivation → Valuation Grid
3. Capture per-method indicated values, reconciled range, implied cap, derived NOI
4. Compare each against the deal's actual purchase price / going-in cap / acquisition NOI
5. Produce the per-deal report above
6. Aggregate: how many deals pass ±5% / ±25bps; what's the median error; which method is the most/least reliable across deals

### Cadence
- **Per wave** of the master plan — after each wave lands, re-run the backtest to confirm the wave didn't regress valuation accuracy and to track error trending toward the bar
- **Not per dispatch** — that's Layers 1–2's job; the backtest is heavier and confirms integration

---

## WHAT GOOD LOOKS LIKE (the progression)

You will not hit ±5% / ±25bps on run one. The healthy progression:

1. **First run:** establishes baseline error. Likely 15–30% on price. Diagnoses what's broken vs untuned.
2. **After fixing broken methods:** errors converge as outlier methods get fixed. Maybe 10–15%.
3. **After comp selection tuning:** the right comps tighten the comp-based methods. Maybe 7–10%.
4. **After assumption calibration:** NOI derivation sharpens Cap×NOI and DCF. Approaching ±5%.
5. **Acceptance:** all three deals within ±5% price / ±25bps cap, methods converging rather than canceling.

Track the error trend across runs. Tightening error across waves is the signal the plan is landing. Flat or worsening error is the signal something's wrong with the approach, not the tuning.

---

## OVERFITTING GUARD

Three deals is a small gold set. Risk: tuning until these three pass, then the platform fails on the fourth deal.

Mitigations:
- **Tune to principles, not to these deals.** "Recent same-class comps weight higher" is a principle. "Weight Jacksonville's comp #3 at 0.7" is overfitting.
- **Hold one out.** Tune on Jacksonville + Atlanta #1; test on Atlanta #2 untouched. If the held-out deal also lands within bar, the tuning generalizes.
- **Expand the gold set over time.** Every new acquisition you close becomes a future backtest deal. The set grows; confidence grows with it.

---

## RELATIONSHIP TO THE VERIFICATION PROTOCOL

| | Verification Protocol (L1–L2) | Backtest Harness (L3) |
|---|---|---|
| Scope | Per dispatch | Per wave |
| Tests | Does this piece exist and produce correct values? | Does the whole chain produce the right answer? |
| Reference | External source / sanity bounds for one output | Actual closed-deal price + cap |
| Frequency | Every dispatch before next fires | After each wave lands |
| Catches | Missing object, wrong value | Broken integration, compensating errors |

Both are required. A dispatch can pass L1–L2 (the comp engine works, the valuation engine works) and the system still fail L3 (they compose wrong). The backtest is the only test that confirms the platform does what it claims: produce a defensible valuation on a real deal.
