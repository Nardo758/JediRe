# DISPATCH — W-B Phase 2 GO: Stabilization Ramp + Traffic Wiring + Highlands Shadow-Diff

**Arc:** continues `SEEDER_GAP_ZONE_AND_TRAFFIC_RAMP.md`. W-A accepted. W-B Phase 1 findings accepted. Precedence order unchanged: `user > agent > traffic_engine > platform_default`.
**Repo:** `Nardo758/JediRe.git` · backend port 4000
**Standing rule (S1-01):** live DB + rendered observation.

## AMENDMENTS (operator rulings on Phase 1 findings)

**A1 — Highlands shadow-diff is now a blocker, replacing "value-identical by construction."** The reseed guard skipping Highlands proved its data didn't change; it proved nothing about the new code — and Highlands reseeds routinely (last: 2026-07-02), so the new gap logic WILL run on it soon, unverified. Required: build Highlands' seed in memory under the new code (no persist) and diff against the stored seed. Expected and ACCEPTED diff: a data-lag gap zone (~2026-05 → analysis_date−1) where projection previously started — that is the model working, render it honestly. Any OTHER diff (value changes in actual months, NOI/EGI shifts, boundary moves off 2026-04-01) → STOP and report before anything persists. If the shadow-diff shows only the expected gap, persist the Highlands reseed deliberately in this dispatch — do not leave it to the next cron.

**A2 — Traffic conversion is typed into the traffic layer, not the seeder.** `TrafficHandoff.leaseUpTimeline.weeksTo95` → `months_to_stabilization` (weeks ÷ 4.345, ceil) as a typed output on the traffic service (extend the handoff or `TrafficToProFormaService`), consumed by the resolution chain. `leaseUpTimeline: null` self-signals stabilized → the `traffic_engine` layer abstains (resolution falls through), which for an already-stabilized asset lands on a value the ramp formula degenerates on anyway. weeksTo95 is the stabilization definition (95% = stabilized occupancy, consistent with portfolio observations).

**A3 — Wiring depth, v1:** the seeder's `months_to_stabilization` resolution READS the traffic layer's stored output when present (via the platform layer of `deal_assumptions` where `pushTrafficToProForma` already writes, or a direct typed read — implementer's call, but ONE seam, named). Do NOT make the seeder invoke traffic computation inline — no new coupling between seed-build and traffic-engine execution. If no traffic output exists at seed time, the layer abstains. Wiring the automatic traffic→push cadence is a separate dispatch.

## IMPLEMENTATION (per original W-B Phase 2 scope + amendments)
1. `months_to_stabilization` + `stabilization_curve` (v1 `linear`) as LayeredValue-pattern fields, four-layer precedence, provenance on resolution. Platform default: 24.
2. `ramp(t)`: projection month m = `baseline + (stabilized_monthly − baseline) × min(m / months_to_stabilization, 1)`; post-stabilization continues existing compound trend from the stabilized level. `stabilized_monthly` = year1 stabilized NOI ÷ 12 at ONE named location with the units assertion. Baseline = last gap value (post-W-A).
3. No special-case degenerate branch — the formula degenerates when baseline ≈ target.
4. Deterministic layer only; agents never compute the ramp.
5. Reseed Bishop. Shadow-diff then reseed Highlands per A1.

## ACCEPTANCE
| # | Item | Evidence |
|---|---|---|
| 1 | Bishop ramps from post-gap baseline (~$17.5k) to stabilized_monthly (year1 ÷12, order $70–110k) at month 24, trends after | Samples m=1, 12, 24, 36 |
| 2 | Tri-tab reconciliation at months 12/24/60 vs ProForma yearly ÷12 | Paired values |
| 3 | Bishop provenance: `months_to_stabilization` → `platform_default:24` (no property_id, traffic abstains) | Field dump |
| 4 | Highlands shadow-diff: ONLY the expected data-lag gap; then persisted reseed with actual-month values + 57.17% margin + EGI $6,315,308 unchanged, boundary 2026-04-01 | Diff output + post-reseed values |
| 5 | Determinism: Bishop ×2 same analysis_date → identical | Both outputs |
| 6 | Chart: Bishop full ribbon (actual→gap→ramped projection reaching plausible scale), Highlands with small amber lag gap | Screenshots |
| 7 | 16 pins + M35 legend active on Bishop (observation debt — third time on the sheet, close it) | Screenshot + DOM count |

**Blockers: 1, 2, 4.**

## OUT OF SCOPE
Automatic traffic-push cadence; S-curves; agent override UX; per-year-override P&L; lifecycle origin/vintage implementation; the 4 missing Bishop opex T12 line items (logged, pre-existing, park as data-hygiene note).

**Run it. Report.**
