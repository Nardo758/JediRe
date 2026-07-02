# DISPATCH — Seeder Phase 2 continued: Gap Zone (GO) + Stabilization Ramp powered by Traffic Engine

**Arc:** Proforma Timeline — continues `SEEDER_FIX_PHASE2_GO.md`. W1 root cause closed (call site postdated Bishop's build; reseed proven: smooth trend, $34.69 edge step, tags `derived_projection`). W3 (gap) and the trend-plausibility question resolve here.
**Repo:** `Nardo758/JediRe.git` · backend port 4000
**Standing rule (S1-01):** live DB + rendered observation. W-B has a read-only phase with a STOP.

## OPERATOR DECISIONS (encoded)
1. **Unified ramp model APPROVED.** Projection zone = `ramp(t)` from baseline (last actual/gap value) converging to the stabilized year-1 NOI, over `months_to_stabilization`. Degenerate case: baseline ≈ stabilized target → ramp reduces to plain trend (Highlands must be numerically unaffected). This is the F9 tri-tab reconciliation invariant applied at monthly resolution — Pro Forma endpoints, Projections ramp, Assumptions curves, one `ramp(t)`.
2. **`months_to_stabilization` is powered by the Traffic Engine.** It is a LayeredValue-style assumption with resolution precedence: **`user` > `agent` > `traffic_engine` > `platform_default`** — full provenance on every resolution. The Traffic/Lease Velocity engine's estimate is the default authority; Agent or user disagreement overrides it. Platform default (fallback of last resort, e.g. no traffic data): **24 months, linear curve** (v1; curve shape is itself a field for later S-curve support).
3. **Δ_operator remains an input.** The ramp never back-solves any operator delta as a residual.
4. **Gap zone proceeds immediately** — already-approved W3 scope, independent of the ramp build.

---

## W-A · GAP ZONE (GO NOW — no further approval needed)
Per the signed-off rule: gap = (last actual + 1) → (`analysis_date` − 1), `analysis_date` persisted in the seed as an input; projection starts at `analysis_date`.
1. Set `gap_start_month` / `gap_end_month` in `buildBoundaryContext` (or the appropriate construction point) from last-actual + `analysis_date`. Currently nothing writes them — that's the no-op root.
2. `buildPeriodList` tags the range `zone:'gap'`; `deriveGapForSeed` populates values (`resolution:'derived_gap'`).
3. **Interaction with W-B (sequencing rule):** once the gap exists, the projection baseline = last GAP value, not the raw 2018-07 actual. Implement W-A first; W-B's ramp consumes the post-gap baseline.
4. Reseed Bishop (same `analysis_date` discipline). Acceptance: three zones in seed dump + chart screenshot (cyan → amber → muted), boundary at 2018-07-01, gap spans 2018-08 → analysis_date−1, numeric step at both zone edges reported.

## W-B · STABILIZATION RAMP

### Phase 1 — READ-ONLY probe (STOP at end)
1. **What does the Traffic/Lease Velocity engine expose today?** Read `TRAFFIC_ENGINE_CALIBRATION_SPEC.md` + `LEASE_VELOCITY_ENGINE_SPEC.md` and the implementing code: does a months-to-stabilization estimate (or an absorption/velocity output convertible to one — units/mo vs remaining units to stabilized occupancy) already exist? Paste the output shape + file:line. If only convertible primitives exist, show the conversion and where it would live (inside the traffic engine, exposed as a typed output — NOT computed ad hoc in the seeder).
2. **Integration point:** where does the seeder/proforma path currently consume (or fail to consume) traffic outputs? Identify the seam where `months_to_stabilization` resolution would occur.
3. **Fallback census:** for Bishop (archived, presumably no traffic data) and Highlands (stabilized), what would each layer resolve to today? Expected: Bishop → `platform_default` (24), Highlands → any (degenerate ramp regardless). Paste the evidence per deal.
4. **Agent override seam:** identify where an agent-supplied value would enter (existing assumption-write path is fine; no new agent work in this dispatch — just confirm the seam exists and name it).
5. **Report + STOP.**

### Phase 2 — implement (on approval of Phase 1 report)
1. `months_to_stabilization` (+ `stabilization_curve`, v1 fixed `linear`) added to assumptions as a LayeredValue-pattern field with the four-layer precedence and provenance. `traffic_engine` layer populated from the engine's typed output when available; absent → next layer down.
2. `ramp(t)` in the projection derivation: month m of projection resolves to `baseline + (stabilized_monthly − baseline) × min(m / months_to_stabilization, 1)`, then post-stabilization months continue on the existing compound trend from the stabilized level. `stabilized_monthly` = year1 stabilized NOI ÷ 12 — the ÷12 happens at ONE named location with the units assertion from the prior dispatch.
3. Degenerate guard: if `|stabilized_monthly − baseline| / stabilized_monthly` is small (define threshold, e.g. <5%), ramp contributes ~nothing by construction — no special-case branch; the formula itself degenerates. Prove Highlands is value-identical (blocker).
4. Deterministic placement: all of this lives in the deterministic engine layer (gap-bridge / seeder services). No LLM/agent computation anywhere in the ramp path — agents only write the override assumption.
5. Reseed Bishop.

### ACCEPTANCE (all observed)
| # | Item | Evidence |
|---|---|---|
| 1 | Bishop three-zone seed with gap (W-A) | Seed dump + screenshot |
| 2 | Bishop projection ramps: starts near post-gap baseline, reaches stabilized_monthly (~year1 ÷12, order $70–110k/mo) at month `months_to_stabilization`, trends thereafter | 6 sample months incl. m=1, m=stab, m=stab+12 |
| 3 | Tri-tab reconciliation: seed projection at months 12/24/60 equals ProForma corresponding yearly figures ÷12 within rounding | Paired values |
| 4 | Provenance: Bishop's `months_to_stabilization` resolves `platform_default:24` with provenance visible; resolution chain dumps correctly | Field dump |
| 5 | Highlands: value-identical post-change (boundary 2026-04-01, 57.17%, $6,315,308) — reseed only under the distinct-months gate from the prior dispatch, still in force | Live values |
| 6 | Determinism: Bishop reseed ×2 same `analysis_date` → identical | Both outputs |
| 7 | 16 pins + M35 legend active on Bishop chart (observation debt, still open) | Screenshot + DOM count |

**Blockers: 2, 3, 5.**

## OUT OF SCOPE
- New Traffic Engine modeling (consume existing outputs / convertible primitives only; engine enhancements are that arc's dispatches)
- Agent-side override UX/logic; S-curve shapes; per-year-override P&L rebuild
- Lifecycle origin/vintage implementation; shell-row deletion; event→curve modeling
- Any change to what assumptions ARE (only how the seeder consumes + how `months_to_stabilization` resolves)

**Run W-A now. Run W-B Phase 1 to the STOP. Report both together.**
