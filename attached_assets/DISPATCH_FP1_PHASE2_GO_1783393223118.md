# DISPATCH — F-P1 PHASE 2 GO (Operator Rulings R1–R10 Encoded, 2026-07-06)

**Arc:** F-P1 store consolidation. Phase 1 audit accepted (`docs/FP1_PHASE1_AUDIT.md`, commit `43da253e7` — Leon: push it if still local). Phase 2 authorized with the rulings below — encoded, do not re-litigate.
**Executor:** engine-authority agent. Repo `Nardo758/JediRe.git` · backend :4000.
**Universal blocker unchanged:** value identity on both reference deals per migration step (Highlands seed canary exact; Bishop live five, epoch-bound; F5 landing mid-arc = record new epoch, don't chase old).
**Standing rules:** S1-01 · verify counts · both compile baselines green per commit · commit early/often · completion reports paste raw output.

## RULINGS (operator, 2026-07-06)
- **R1 — tag-only:** `year1.noi.resolution` for actuals-derived values → `t12` if in the existing enum, else `actuals` — use existing vocabulary, mint nothing. Value unchanged.
- **R2 — honest absence, refined:** owned_import never auto-builds and never gets a fabricated baseline; **user-triggered builds remain legal** (forward-underwriting an owned asset is a real workflow). `modelNotBuilt: true, reason: 'no_underwriting — owned_import'` only when no build exists. Highlands' 2026-07-03 build stays as historical artifact.
- **R3 — decompose with shadow-read:** write path cuts to overlay rows; a verification reader compares old vs new representation and ALARMS on mismatch for the confidence window; then old path retires. No dual-write period.
- **R4 — migration order confirmed:** dark schema → server-fetch beside client path with pasted equivalence proof → retire client path + delete React copy write-path → decompose scenarios → blob semantics → read-sites → trending/exit-basis/attribution → serialization → tax extract.
- **R5 — monthly slice: 7 fields:** `{month, year, occupancy, effectiveVacancy, floorBinding, vacancyLoss, noi}` — vacancyLoss added (dollar row the grid wants next; Finding-E's rate/dollar discipline). Carrier: extend the latest-model response; no new endpoint. **On landing: flag TS-2 UNBLOCKED in the report.**
- **R6 — tax: extract-only this arc.** Runner's inline `computeFloridaTax`/`computeNonFloridaTax` branches extracted to call the existing `taxProjection.service.ts`/ruleset structure; constants (0.85 reassessment basis, 0.10 cap) move into ruleset files; behavior-identical (identity checkpoint on both deals' tax lines). **F-P1t (trigger model) is its own gated follow-up dispatch after core migration — not dropped, not blocking.**
- **R6b — piecewise tax law (operator clarification, goes verbatim into F-P1t's spec AND as a comment at the extraction seam):** *the four-source trend applies in EVERY inter-event segment; triggers reset the basis.* Assessed value trends (four-door, cap-clamped) from its last known value until a trigger fires — sale, CO, or cycle — the trigger recomputes the basis per jurisdiction ruleset, and trending resumes from the new basis. Before, after, and between, segmented by whichever triggers the jurisdiction fires. Current inline behavior (sale-step then capped growth) is the two-segment special case; keep it in the extract.
- **R7 — W4c addendum confirmed as the blob map,** with guard: M-I first censuses the live 140-key blob against the addendum and reports uncovered keys BEFORE renaming.
- **R8 — trending fields, full set:** `rent_growth`, `other_income_growth`, `expense_growth.{insurance, payroll, utilities, repairs_maintenance, contract_services, marketing, g_and_a, other}`. **`real_estate_tax` explicitly EXCLUDED from generic trending — the tax engine owns it; trending prior-owner taxes is prohibited output.** All four-door LayeredValue, user wins; agent authorship is D3, not here.
- **R9 — retire output-scalar columns:** `irr_levered`, `equity_multiple`, `noi_stabilized`, `rent_growth_yr1` on deal_assumptions are derive-not-store violations — do NOT populate; repoint any readers to `deal_financial_models.results`, then drop in migration. Census readers first; paste the list.
- **R10 — `deal_financial_models.deal_id` varchar → uuid** in M-A while the schema is open. Enumerate join sites losing their casts.

## EXECUTION NOTES
1. F-P1-A equivalence proof is the arc's riskiest moment: same deal, client-supplied body vs server-fetched assumptions, **identical ModelResults pasted** before the client path dies. If they differ, that difference IS the local-state divergence being executed — capture it as evidence, reconcile per operator ruling, then retire.
2. Every migration step's identity checkpoint pastes the check, not asserts it.
3. The Phase-1 divergence list (#1–#6) must each appear in the final report with its disposition: fixed-by-ruling / migrated / documented-as-epoch.
4. Report cadence: checkpoint report after M-A+server-fetch (the halfway gate), full report at arc end. STOP only on identity failure or a divergence outside the six known.

## OUT OF SCOPE
F-P1t trigger model (next dispatch) · TS-2 execution (separate small dispatch on unblock) · D3/CU/F-P2 · F5 items · approval workflows · multi-state rulesets beyond FL structure + GA placeholder.
