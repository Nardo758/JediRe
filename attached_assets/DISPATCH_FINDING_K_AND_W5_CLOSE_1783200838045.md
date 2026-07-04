# DISPATCH — Finding K Ruling + W5 Close Sequence (Amended)

**Arc:** F9 Underwriter Model — W5 pin ceremony, Finding K resolved into doctrine.
**Repo:** `Nardo758/JediRe.git` · backend port 4000
**Standing rules:** S1-01 live evidence per claim. **PATH-BOUND RULE:** canary/regression gate values are path-bound — every gate must name the surface its expected values came from.

## Finding K Ruling (Operator-Ratified)

Highlands is `owned_import` — it entered at Owned/Operate, was never underwritten on-platform, and therefore **correctly has no deal_assumptions row**. The absence isn't missing data; it's an honest record of a deal that skipped phases A–E.

**Option 1 (hand-creating a deal_assumptions row) is REJECTED** — that would fabricate an underwriting that never happened, violating origin-class honesty and poisoning the onboarding-baseline machinery with an untagged impostor row.

**Correct resolution:**
- Highlands' golden role is path-bound to its true surface — **pin it on the seed path**.
- The seed canary held exactly: margin 57.17%, EGI $6,315,308, boundary 2026-04-01.
- Bishop alone is the **build-path golden** (architecturally right: Bishop has real underwriting history).
- The degenerate-case guard Highlands was blocking on gets covered at the engine level: a **permanent third golden fixture** (synthetic, deterministic, provenance "engine-level degenerate case").

## W5 Close Criterion (Amended)

**8/8 = 6 suites + golden-Bishop (build path) + golden-Highlands (seed path) + synthetic degenerate fixture green + Phases 2–3**

## F-P1 Ledger Update

- **F-P1-A:** Build boundary requires client-supplied assumptions; store bypassed.
- **F-P1-B:** noi.resolved provenance lie (`platform_fallback` on actuals-derived).
- **F-P1-C:** Server-fetch fix must handle absent deal_assumptions honestly: `modelNotBuilt: true`, reason: `'no_underwriting — owned_import'`. Never a silent default-build.

## Execution Status

### Done and Proven
- Engine: turn-cohort, downtime, floor, three bug generations survived
- Loudness system: 6/6
- Bishop's build-path golden: structure in place, pending live capture
- Seed canary: held to the dollar (margin 57.17%, EGI $6,315,308)
- Finding K: resolved into doctrine (origin-class honesty), not patched
- F-P1 ledger: A, B, C loaded
- Synthetic degenerate fixture: pinned and green locally

### Still Open Before W5 Closes
1. **Highlands seed-path golden pinned** — hit seed/deal-financials surface, populate 12-field shape
2. **Bishop build-path golden pinned** — run capture script with live DB, populate 12-field shape
3. **Runbook Phases 2–3** — smoke shapes on real deals, consumer matrix, D1 behavioral, T2 forced cache-hit
4. **Parity list regenerated** — Excel parity (oracle-gated)

## K4 Close Sequence (Updated)

1. **Highlands seed-path capture** → hit seed/actuals surface, extract 12-field expected, provenance naming seed path + origin class `owned_import`.
2. **Bishop build-path capture** → run construct-from-DB body through build endpoint, extract 12-field expected, provenance naming build route + F-P1-A context.
3. **Full suite: 8/8** (synthetic green + Bishop green + Highlands green + 6 identity suites).
4. **Phases 2–3**: smoke shapes, consumer matrix, D1, T2.
5. **Regenerate parity list** from pinned values → operator fill-in-the-blanks.
6. **W5 CLOSES** on: 8/8 + Phases 2–3 green + seed canary held.

## OUT OF SCOPE
`financial-model.routes.ts` (F-P1) · excel-parity (oracle-gated).
