# DISPATCH — S1 Phase 2 GO: Debt-Service Estimator + Cashflow-Distress Flags (Corrected Scope)

**Arc:** Deal Shaping. Phase 1 accepted with operator revisions (2026-07-03). Parallel-safe with D2b — zero shared files expected; STOP on any overlap.
**Repo:** `Nardo758/JediRe.git` · backend port 4000
**Standing rule (S1-01):** live proof per acceptance item.

## OPERATOR RULINGS (encoded — do not re-litigate)
1. **Scope correction:** v1 computes flags from `debt_positions` where populated (pipeline deals with known debt). NO ATTOM mortgage dependency — the adapter has zero mortgage fields today. The submarket distress census is GATED on the ATTOM spike (item 4 below); no silent assumption of coverage.
2. **Rate curves (Ask 1 as revised):** agency multifamily → **DGS10 + 170bps** (NOT MORTGAGE30US — PMMS is residential); bank → DGS10 + 200; cmbs → DGS10 + 220; life_co → DGS10 + 160; bridge → SOFR + 350; debt_fund → SOFR + 400. Ruleset file: `backend/src/services/debt-advisor/rulesets/vintage-spread.ruleset.ts`, versioned, provenance-tagged.
3. **Thresholds (Ask 2 as revised):** lender_min DSCR — agency 1.25, **bank 1.25** (revised from 1.35), bridge 1.10, cmbs 1.30, life_co 1.35; market_LTV max — agency 75%, bank 65%, bridge 80%, cmbs 70%, life_co 65%; thin_dscr buffer 0.05; io_shock_months_ahead 12. File: `distress-threshold.ruleset.ts`, versioned.
4. **ATTOM mortgage/deed spike (separate small task inside this dispatch, read-only):** determine whether the current ATTOM subscription/endpoints expose mortgage instrument data (origination, amount, lender). Paste the endpoint response or the documented absence. Verdict gates the future census dispatch — report only.

## BUILD
1. **Schema:** `deal_context_financials` per Phase-1 proposal (flag + discriminating value + threshold + provenance per flag; `UNIQUE(deal_id, ruleset_version)`; `ruleset_version` stamps which constants produced the row).
2. **Deterministic service:** per §1 formulas of the shaping addendum, inputs from `debt_positions` (loan terms) + rate rulesets + amort ruleset (`amort-profile.ruleset.ts` per Phase-1 proposal, fallback 30yr fixed 0 IO, provenance `platform_estimate`) + value input (asking_price preferred → just_value/AVM fallback, provenance-tagged, never synthesized).
3. **Flags:** all six (`negative_dscr`, `thin_dscr`, `io_expiry_shock`, `underwater_equity`, `cash_in_refi`, `negative_leverage`). `io_expiry_shock` computes only where IO terms exist in `debt_positions`; otherwise `undeterminable`.
4. **Honest absence:** any missing input ⇒ affected flags `undeterminable` with a reason code, never false-negative FALSE. A deal with no `debt_positions` rows produces a row of undeterminables, not an absent row.
5. **Exposure:** DealContext assembly + one read endpoint. Zero LLM anywhere in the path. No UI.

## ACCEPTANCE
1. A deal with populated `debt_positions`: computed `est_debt_service` / DSCRs / gap / flags pasted next to hand math from the same inputs — match.
2. A deal with no debt rows: `undeterminable` output with reasons, pasted.
3. IO case: a bridge/IO position produces `io_expiry_shock` evaluation with the step-up math pasted (or honest-undeterminable if no IO deal exists in data — say which).
4. Ruleset provenance: pasted row shows `ruleset_version` + per-flag provenance.
5. Zero LLM calls (log proof).
6. ATTOM spike verdict with evidence.
**Blockers: 1, 2, 5.**

## OUT OF SCOPE
Distress-supply census (gated on spike) · agent consumption/diagnosis of flags (D3+) · document-tier upgrades (S3) · UI · any `debt_positions` write-path changes.
