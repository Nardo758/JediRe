# DISPATCH — S1: Vintage Debt-Service Estimator + Cashflow-Distress Flag Group

**Arc:** Deal Shaping (per `DEAL_SHAPING_ADDENDUM.md` §1, §7-gap-2). Runs PARALLEL to F9-D2 — zero shared files with the engine promotion; if any overlap emerges, STOP and report before touching shared code.
**Repo:** `Nardo758/JediRe.git` · backend port 4000
**Nature:** Pure deterministic service on existing data (ATTOM mortgage records × FRED historical rate curves). No LLM anywhere in this dispatch. No agent work — flags become typed `DealContext` fields the Research Agent will READ (consumption is later scope).
**Standing rule (S1-01):** live DB/HTTP proof per item.

## Phase 1 — READ-ONLY data feasibility (STOP at end)
1. **ATTOM mortgage coverage:** for the reference deals' parcels and a 20-parcel sample across Tampa/Atlanta submarkets, paste what mortgage fields actually exist (origination date, amount, lender name/type, loan type, maturity if present). Report coverage % per field — the estimator's accuracy budget depends on it.
2. **Rate-curve source:** confirm FRED series available for vintage pricing (e.g. mortgage/SOFR/DGS10 + typical spreads by lender type). Propose the `vintage_rate_curve(origination_date, lender_type)` lookup design: which series + which spread table, spreads as a versioned ruleset file (no hardcoded lender logic in code — same discipline as jurisdiction rulesets).
3. **Amort-profile inference rules:** propose deterministic defaults (agency 30/yr, bank 25, bridge IO, CMBS 30 w/ IO period) as a ruleset file with provenance tagging `platform_estimate`.
4. **Value input:** `est_value` source for DSCR_at_refi / proceeds_gap — which existing field (platform AVM, comp model)? If none reliable, flag as bounded-uncertainty input; do not invent one.
5. **Schema proposal:** where flags + intermediates live (suggest: `deal_context_financials` or extension of existing DealContext assembly — typed fields: `dscr_current`, `dscr_at_refi`, `proceeds_gap`, `est_debt_service`, plus the six §1 flags with threshold provenance). Thresholds (lender_min 1.20–1.25, market_LTV) as ruleset constants, not literals.
6. **STOP — report with the two design proposals (spread ruleset, thresholds) for sign-off.**

## Phase 2 — implement (on approval)
1. Deterministic service computing the §1 formulas per parcel/deal; every output field tagged `platform_estimate` source tier (per shaping §6.1 — a payoff statement upgrade path comes later with the doc layer).
2. Flag derivation (`negative_dscr`, `thin_dscr`, `io_expiry_shock` where IO data exists, `underwater_equity`, `cash_in_refi`, `negative_leverage`) with the discriminating values stored alongside each flag (a flag without its evidence numbers is not writable).
3. Expose via DealContext assembly + one read endpoint. No UI in this dispatch.
4. **Honest-absence rule:** missing ATTOM data ⇒ flags are `undeterminable` with reason, never false-negative silence.

## Acceptance
1. Reference parcel with known debt: paste computed est_debt_service / DSCR / flags + the hand math from the same inputs — must match.
2. A parcel with no mortgage record: paste the `undeterminable` output with reason.
3. 20-parcel batch: paste flag distribution + compute time (this must be cheap enough to run as a submarket screen — that's gap #5's future census).
4. Zero LLM calls in the entire path (log proof).
**Blockers: 1, 2, 4.**

## Out of scope
Distress-supply census (gap #5 — consumes this service later); agent consumption/diagnosis; doc-tier upgrades; any UI; M36 goal-seek work.
