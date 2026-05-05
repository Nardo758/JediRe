# Module Wiring Update — Integration Spec

**Companion to:** `jedi_re_module_wiring_blueprint_v2.xlsx`
**Status:** Implementation-grade
**Purpose:** Pin the data contracts, re-computation cascades, and document triggers that wire the new inference layer (M35, M36, M37, M38) into the existing module graph. This is an *integration* spec, not a *capability* spec — capabilities live in `Event_Impact_Engine_Spec.md`, `M36_Joint_Distribution_Engine_Spec.md`, etc.

---

## What Changed in the Blueprint

The original `jedi_re_module_wiring_blueprint.xlsx` covered M01 through M25 with seven sheets (Module Registry, Formula Engine, Data Flow Matrix, Agent Coverage, Wireframe Specs, Strategy Signal Weights, Implementation Priority). The v2 file extends this with:

**Additions to existing sheets:**
- **Module Registry:** M35 Event Impact Engine, M36 Joint Distribution Engine, M37 Cross-Market Analog Engine, M38 Calibration Ledger (4 new rows, highlighted)
- **Formula Engine:** F37–F49 (13 new formulas covering plausibility scoring, factor variance attribution, Σ propagation, goal-seek optimization, multi-horizon VAR, analog similarity, calibration reliability, CI propagation, document outlier scoring, conversion funnel, burn-off-aware revenue)
- **Implementation Priority:** P0-6 through P2-3 (10 new wiring tasks with effort and dependency tagging)

**Three new sheets:**
- **Data Flow Matrix v2** — full N×N matrix including M35–M38, with 30 new edges marked ★
- **Data Contracts** — 16 edge contracts (DC-01 through DC-16) with TypeScript-style payload schemas
- **Recomputation Cascade** — 12 trigger events with subscriber chains, action specifications, UI effects, and latency targets
- **Document Triggers** — 6 document types mapped to parsers, LayeredValue provenance tags, outlier gates, and downstream cascades

The original `Data Flow Matrix` sheet is preserved unchanged for reference. Use `Data Flow Matrix v2` for forward work.

---

## The Eleven New Edges (Why Each Exists)

Earlier conversation identified eleven edges that needed formalization. Each is now in the blueprint with a Data Contract. Listed here with the rationale and the relevant DC/cascade reference.

**1. M35 → M07 (events to traffic).** Active events shift the demand distribution that drives traffic. Without this edge, traffic projections ignore amenity-altering or employer-altering events even when M35 has classified them. `DC-01`. Cascade: Event ingested → M07 re-runs.

**2. M04 → M07 (supply to traffic).** Pipeline competition determines how much demand flows to the subject vs comp set. Without this edge, traffic projections assume the subject captures all latent demand. `DC-02`. Cascade: daily refresh.

**3. M06 → M07 (demand to traffic).** Employment, migration, and employer concentration determine the latent demand pool itself. `DC-03`. Cascade: weekly + on news event.

**4. M05 → M07 (market context to traffic).** Comp set rents and concessions determine pricing position, which is a covariate in the conversion funnel (F48). `DC-04`. Cascade: weekly.

**5. M18 → M07 (rent roll to traffic).** Lease expiration schedule is the critical input for burn-off computation. A property with 40% of leases expiring in the next 6 months has a fundamentally different revenue trajectory than one with 5% expiring. `DC-05`. Cascade: rent roll uploaded.

**6. M36 → M07 (Σ to traffic).** Σ_local, factor loadings, and regime classification provide the structural overlay used for confidence intervals on traffic outputs and propagation of upstream uncertainty. `DC-06`. Cascade: Σ recomputed.

**7. M07 → M09 (traffic to ProForma — the revenue handoff).** This is the most important new edge. The `ProFormaHandoff` contract delivers four arrays — occupancy_path, market_rent_path, lease_up_velocity, in_place_rent_burn_off — each with point estimates and CIs. M09 uses these to compute effective revenue per F49 (burn-off-aware revenue). The CI fields enable F46 (CI propagation through proforma to IRR distribution). `DC-07`. Cascade: any M07 input change.

**8. M35 → M06 / M04 (events to demand and supply signals).** M35 classifications fan out: demand events update M06 housing demand projections; supply events update M04 pipeline. Both flow further to M09 and M14 through their existing edges. `DC-08`, `DC-09`. Cascade: event classified.

**9. M36 → M14 / M10 / M09 / M08 / M25 (Σ as structural backbone).** Five edges replacing hand-tuned correlations and additive composites with Σ-derived rigorous quantities. M14 gets factor variance attribution. M10 gets percentile-path scenarios. M09 gets plausibility scoring. M08 gets variance of strategy scores. M25 gets confidence intervals. `DC-10`, `DC-11`, `DC-12`. Cascade: Σ recomputed.

**10. M37 → M06 / M09 / M14 / Cashflow Agent (analog forecasts).** Cross-market analog priors flow into demand forecasts, assumption priors with CIs, and risk distributions. Agent-side: every assumption the agent proposes is anchored by analog evidence. `DC-13`. Cascade: agent reasoning step.

**11. M38 ↔ M22 / M21 / M14 / M36 (calibration loop).** M22 actuals feed M38; M38 outputs flow to Cashflow Agent (DC-14) and M14 (CI multipliers) and M36 (drift-triggered Σ refresh). `DC-15`. Cascade: monthly batch + drift detection.

**Plus three additions surfaced by the gap analysis:**

**12. M18 → M36 (parser outlier check).** Every parsed value runs through F47 outlier scoring before LayeredValue commit. Prevents silent acceptance of misread T12 / rent roll / tax bill values. `DC-16`. Cascade: document parsed.

**13. M22 → M38 (post-close actuals).** Pairs underwritten predictions with realized outcomes. Requires `deal_monthly_actuals` table — flagged as M22 critical-path unlock. `DC-15`. Cascade: actuals recorded.

**14. M14 → M25 (risk to JEDI Score).** Was implicit in the original; now made explicit so the JEDI Score CI computation has a defined source for the risk sub-score variance.

---

## Re-computation Cascade Order Matters

The Cascade sheet specifies subscriber order within each trigger. Order is not cosmetic — it determines what state downstream subscribers see. Two specific orderings worth calling out.

**On `event.ingested`:** M36 must update Σ_conditional *before* M07 re-runs traffic, *before* M09 recomputes proforma. If M07 runs against a stale Σ overlay, its CIs will be wrong by the time M09 reads them. The cascade is: M36 → M07 → M06 → M04 → M09 → M14 → M25 → dealStore. This means the dealStore message bus needs to respect topic dependencies, not just broadcast.

**On `document.parsed (rent_roll)`:** M36 outlier gate must complete *before* M07 incorporates the rent roll. If a misread RR shows $4 PSF when the market is $2 PSF and M07 runs against the bad data, traffic projections will be wildly off and downstream proforma even worse. The outlier gate is the safety check; it must short-circuit on z > 3 with user review before propagation continues.

These ordering constraints belong in the Kafka consumer configuration as topic-level priorities or explicit subscriber dependency declarations.

---

## Latency Targets (Calibrating the UX)

The Cascade sheet specifies latency targets per trigger. A few calibrations:

- **User assumption override:** < 500ms debounced. The plausibility badge must update visibly fast or it loses trust as a real-time signal. Debouncing prevents API hammering on every keystroke.
- **Goal-seek request:** < 3s for solver, < 8s for full agent narrative. The solver itself is fast (SLSQP on ~12 variables); narrative synthesis is the slow part. Stream the solver output first, narrative can populate progressively.
- **Event-ingested cascade:** < 5s end-to-end. This is the visible "deal capsule updates after event" experience. Anything slower feels broken.
- **Σ recomputation:** < 30s for cache invalidation. Σ refreshes weekly; not a user-visible latency.
- **Calibration drift:** < 1hr. Not interactive; monthly batch with hourly tolerance is fine.

Hitting < 500ms on plausibility scoring requires Σ⁻¹ to be precomputed and cached per regime × asset class × scope. Computing the inverse on every request kills the latency budget. Cache invalidation triggers on `sigma.recomputed`.

---

## Document Triggers — The Outlier Safety Net

The Document Triggers sheet formalizes a pattern that's been implicit in the project: every document parser writes to LayeredValue with a provenance tag, but **no parser today checks plausibility**. F47 outlier scoring (M36-derived) closes that gap.

The flow:
1. Parser extracts a value (e.g., T12 shows expense growth at 6.5%)
2. Parser writes a *provisional* LayeredValue with provenance tag
3. M36 runs F47: z = (6.5% − μ_local) / σ_local
4. If |z| > 3, parser does **not** commit; flags for user review with context: "This T12 shows expense growth at 6.5%. Submarket norm is 3.2% ± 0.8%. This is a 4σ outlier. Confirm before accepting?"
5. User confirms → commit. User rejects → reject with reason. User edits → commit edited value (also F47-checked).

This single change closes the most common source of bad-data-flowing-through-platform: misread documents producing crazy assumptions that look plausible because no one checked them against the local market distribution.

The Document Triggers sheet specifies this for T12, rent roll, tax bill, broker proforma, OM, and lease document. Each has its parser, provenance tag, outlier gate description, and downstream cascade.

---

## Implementation Priority — The Critical Path

The new P0/P1/P2 priority items in the Implementation Priority sheet sequence the wiring work. The critical path:

**P0 (must ship for launch):**
- P0-6: M07 receives all six upstream feeds (DC-01 through DC-06). Without this, M07 isn't doing its job.
- P0-7: M07 → M09 ProFormaHandoff (DC-07). The revenue handoff. Without this, GPR projections don't reflect market state.
- P0-8: M36 → M14 + M10 + M09 (Σ as backbone). Without this, the rest of the framework has nothing to consume.
- P0-9: Document parsers → M36 outlier gate. Safety net; cheap to build once M36 plausibility API exists.

**P1 (high-value follow-on):**
- P1-5: M35 event cascade. High value, requires news classifier maturity.
- P1-6: M37 analog engine to Cashflow Agent. Unlocks calibrated assumption priors.
- P1-7: M22 → M38 actuals. Blocked by `deal_monthly_actuals` migration.
- P1-8: M38 → Cashflow Agent calibration profile.

**P2 (quality / refinement):**
- P2-2: Multi-horizon Σ. Required for Flip and BTS strategies; deferrable while platform is multifamily-rental-focused.
- P2-3: User feedback disagreement signal.

**The dependency chain:** P0-8 (Σ engine) gates everything else in the inference layer. P0-6 + P0-7 (traffic feeds + handoff) gate the revenue accuracy improvements. P1-7 (actuals table) gates the calibration loop. Sequencing P0-8 first, then P0-6/7 in parallel, then P1-5 and P1-7 in parallel maximizes the unlock rate.

---

## What This Doesn't Cover

Three things explicitly out of scope for this wiring update, listed for clarity:

**Backfill of historical data.** The wiring is for live ongoing flows. Backfilling Σ estimation on historical metric data is a one-time exercise covered in the M36 spec implementation phases.

**Asset-class-specific Σ structure.** Multifamily vs office vs industrial vs retail probably need separate Σ matrices with different factor counts and regime sensitivities. The current wiring assumes a single Σ pool; per-asset-class Σ is a future enhancement covered in M36 Section 11 (Open Design Questions).

**Geographic generalization beyond Florida.** The current document parser stack and county GIS integrations are Florida-specific. The wiring contracts work generically, but the data sources behind some of the contracts (DC-04 market context, DC-05 rent roll) currently have Florida-specific data quality. Generalization is engineering, not architecture.

---

## Files Delivered

1. `jedi_re_module_wiring_blueprint_v2.xlsx` — the structured matrix (10 sheets, all original content preserved + new sheets added)
2. `WIRING_UPDATE.md` — this document, narrative companion

Together these slot into your existing spec library next to:
- `Event_Impact_Engine_Spec.md` (M35)
- `M36_Joint_Distribution_Engine_Spec.md` (drafted earlier)
- `M37_Cross_Market_Analog_Engine_Spec.md` (next to draft)
- `M35_Calibration_Ledger_Addendum.md` (next to draft)
- `CLAUDE.md` (architectural context for Claude Code sessions)

The wiring update is the integration layer. The capability specs cover what each module does internally; this covers how they talk to each other.
