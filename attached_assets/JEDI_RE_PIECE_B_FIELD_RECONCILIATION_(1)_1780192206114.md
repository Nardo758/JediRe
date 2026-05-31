# JEDI RE — PIECE B: FIELD-LEVEL RECONCILIATION AND DIVERGENCE SURFACING

**Purpose:** For every multi-source field in the platform (vacancy, market rent, cap rate, LTL, etc.), define how sources reconcile, how divergences surface to operators, and how downstream consumers read a single canonical value.

**Status:** Piece B of four (A, B, C, D). Companion to the Vendor Market Data Architecture overview.

**Predecessor work:** The Deal Details audit (DEAL_DETAILS_DATA_AUDIT.md), the Engine A + M07 lease-roll audit, the revised calc-vs-assumption doc, Task #1520 (NOI override wiring), Task #1521 (per-year overrides).

---

## THE PROBLEM PIECE B SOLVES

Three audit-confirmed problems converge here:

**Problem 1 — The same field reads from different places at different surfaces, AND computed fields bypass their resolution chains entirely.** The Deal Details UI/Backend audit (2026-05-31) revealed two distinct patterns:

  *Pattern 1a — Cross-surface inconsistency (real but less common than initially thought).* The Operating Statement's Other Income is $341,907 (agent `other_income_dollars`). The Projection Loop's Other Income is $180,261 (per-unit × units × 12). Same logical field, different read paths, inconsistent values. The audit also found 5 logical values (NOI, EGI, GPR, exit_cap, hold_period) with cross-surface read-path variation, though several are now resolved by recent tasks.

  *Pattern 1b — Formula bypass of resolution chain (more architecturally significant).* The audit's central NOI finding: `getFieldValues` runs a computed formula (`egi − total_opex`) that produces $840K and wins regardless of what `year1.noi.om` contains. The OM-extracted $2,999,564 sits in the LayeredValue chain, unread. This isn't cross-surface inconsistency (both Pro Forma and Valuation Grid show $840K). It's a deeper bug: the formula bypasses the resolution chain entirely, silently overriding stored higher-confidence values. The same pattern likely affects EGI (`nri + other_income`) and possibly other computed fields.

**Problem 2 — Source disagreements resolve silently or accidentally.** The audit found LTL at 0.35% (T12-derived) while the lease-level signal says 13.8%. The resolution chain picked T12 by FIELD_PRIORITIES order; neither the operator nor the agent saw that an alternative source said something dramatically different. The disagreement is information, but the platform discards it.

**Problem 3 — Hold-year assumptions are flat constants where they should be trajectories.** The audit confirmed `lossToLeasePct` is read once outside the projection loop and applied as a constant to every year. For value-add deals where LTL compression is the thesis, this makes the math wrong. GPR was partially fixed by Task #1521 (per-year overrides), but trajectory math (vs override math) is missing.

**Problem 4 (newly surfaced by the audit) — The `agent` resolution layer is undocumented in FIELD_PRIORITIES.** Fields like `gpr`, `egi`, `payroll`, `g_and_a` carry `resolution: 'agent'` in production, but the published `FIELD_PRIORITIES` constant doesn't include the agent layer or its priority position. The resolution is selecting the agent layer through undocumented behavior. The audit calls this "undocumented and fragile" and it's a precondition that must be resolved before Layer 1 override wiring can be considered universally trustworthy.

Piece B addresses all four.

---

## THE THREE COMMITMENTS PIECE B OPERATIONALIZES

### Commitment B.1 — One logical value, one canonical read path

For any field a consumer needs (NOI, market rent, vacancy, LTL, other income, cap rate, etc.), there is exactly one read path. All consumers — Pro Forma, Valuation Grid, Returns, Decision, F-keys, agents — read from the same path and receive the same value.

**Implementation:** a `getFieldValue(deal_id, field_name, year, options)` service that:
1. Resolves the LayeredValue chain (Layer 1 override → Layer 2 agent → Layer 3 broker)
2. Returns the `resolved` value with `resolvedFrom` provenance
3. Surfaces an `alertLevel` if material divergence exists between layers
4. Handles trajectory math when the field varies across hold years

Every consumer that today reads from a different table or applies its own computation switches to this canonical service. The audit's findings on cross-surface inconsistency are resolved by making this discipline universal.

### Commitment B.2 — Trajectory math for hold-year fields

Five fields (per the audit) require trajectory math, not flat constants:

| Field | Trajectory inputs | Current implementation | Required change |
|---|---|---|---|
| **GPR** | Rent growth × lease roll velocity × market rent | Per-year override (Task #1521 fix) + portfolio compounding | Add lease-roll-based trajectory as primary; override as Layer 1 |
| **LTL** | T12 baseline + mark-to-market rate + lease roll velocity | Flat percentage applied to all years | Build forward trajectory; this is Piece B's most significant single fix |
| **Other Income** | Per-unit value × growth rate (separate from GPR rent growth) | Inherits GPR growth rate, single per-unit seed | Add independent growth rate (may match GPR by default, override-able) |
| **Vacancy** | M07 absorption curve OR flat fallback | M07 trajectory when available, flat year-1 percentage otherwise | When M07 missing, flag deal as incomplete; do not silently use flat percentage as if it were a forward projection |
| **OpEx growth (per line)** | Inflation-adjusted base + per-line growth rate | Single OpEx growth scalar applied to all lines | Per-line growth rates with sensible defaults |

The trajectory math runs at projection time, not at ingestion time. The snapshot-at-ingestion architecture (Commitment 2 from the overview) holds: ingestion produces the year-1 baseline plus the trajectory inputs; the projection loop computes year-N values from those inputs.

### Commitment B.3 — Cross-source divergence surfaces as alert, not silence

When multiple sources contribute to a field and they materially disagree, the platform surfaces this to operators and to agents. The resolution chain picks a winner (per Layer 1 > Layer 2 > Layer 3), but the winning value carries an `alertLevel` and a list of alternative source values with their provenance.

**Material divergence** is defined per field:
- Percentage fields (vacancy, LTL, cap rate): material = >2 percentage points between sources OR >50% relative difference
- Dollar fields (rent, NOI, expenses): material = >5% relative difference
- Date fields: material = >30 days difference (e.g., when sources disagree on lease end dates)

These thresholds are configurable per field. The defaults are starting points; calibration happens after the divergence diagnostic (Piece D) produces real distribution data.

---

## THE LTL TRAJECTORY MATH

This is the most architecturally important specific fix in Piece B because it's where the audit found a 39× divergence and where current implementation falls farthest short.

### Why LTL is a trajectory

LTL = (market rent - in-place rent) / market rent

For a stabilized property at equilibrium, LTL ≈ 0 (in-place rents track market). For a property below market (recent acquisition, deferred re-leasing, distress), LTL is positive and reflects upside that materializes as leases roll. For a value-add deal post-renovation, LTL captures the premium being captured as units re-rent at the renovated rate.

LTL evolves over hold years based on three forces:
- **Market rent growth** (raises market rent, widens LTL if in-place is static)
- **Lease roll velocity** (each rolling lease re-rents at current market, closing that unit's gap)
- **Mark-to-market rate** (in operator-controlled scenarios — renovation pushes in-place higher than passive re-rent would)

### The trajectory formula

For each hold year, LTL is computed:

```
LTL(year_t) = LTL(year_t-1) 
            + market_rent_growth(year_t) × current_LTL_share
            - lease_roll_velocity(year_t) × current_LTL_share × mark_to_market_capture
            + value_add_premium(year_t)
```

Where:
- `market_rent_growth(year_t)` is the rent growth scalar for that year (from `proforma_assumptions.rent_growth_current` with per-year override)
- `lease_roll_velocity(year_t)` is the fraction of in-place leases rolling that year (from `deal_lease_transactions` lease_end distribution, or a stylized 1/avg_lease_term default)
- `mark_to_market_capture` is the fraction of the LTL gap captured at each lease roll (1.0 for full mark-to-market; lower for tenant-protection or rent control scenarios)
- `value_add_premium(year_t)` is the rent premium achieved through renovation (for value-add deals; zero otherwise)

### Inputs the trajectory needs

| Input | Source | Status |
|---|---|---|
| **LTL year-1 baseline** | Existing snapshot at `year1.loss_to_lease_pct.resolved` | Available; produced by seeder |
| **Market rent growth per year** | `proforma_assumptions.rent_growth_current` + per-year override (`rent_growth_pct:yr${yr}`) | Available |
| **Lease roll velocity per year** | Computed from `deal_lease_transactions.lease_end` distribution | Available at seeder time; needs to be persisted as `deal_assumptions.lease_roll_velocity_per_year` JSONB |
| **Mark-to-market capture rate** | Operator assumption — default 1.0; overridable | Needs UI control |
| **Value-add premium per year** | From `deal_assumptions.renovation_schedule` (for value-add deals) | Sparse/empty for 464 Bishop per audit; needs proper schema |

### Layer 1 override for LTL trajectory

The trajectory is computed by the engine. The operator can override at any of these levels:
1. **Override the trajectory entirely** for a year (`per_year_overrides['loss_to_lease_pct:yr${yr}']` — this key currently doesn't exist per audit; add it)
2. **Override individual trajectory inputs** (mark-to-market capture, lease roll velocity)
3. **Override the year-1 baseline** (existing capability)

Override at any level wins per Layer 1 priority. The UI shows the trajectory with override affordances at each level.

### What this replaces

Today: `lossToLeasePct = ry1('loss_to_lease_pct')` read once, applied uniformly across all years.

After Piece B: LTL trajectory computed per year with explicit inputs, surfaced in the projection UI as a trajectory line chart (not a static value), with override affordances per Layer 1 and explicit alerting when lease-level signal (13.8% in 464 Bishop's case) materially diverges from T12-derived baseline (0.35%).

---

## CROSS-SOURCE DIVERGENCE SURFACING

For every field that reads from multiple sources, the platform tracks divergence and surfaces it.

### What divergence detection produces

For each field on each deal:
1. The `resolved` value (per LayeredValue chain)
2. The contributing sources and their values
3. An `alertLevel` per material divergence threshold
4. A `divergence_signature` — a structured description suitable for agent consumption (Piece C reads this) and for tracking over time (Piece D reads this)

Example divergence signature for 464 Bishop's LTL:
```json
{
  "field": "loss_to_lease_pct",
  "resolved": 0.0035,
  "resolved_from": "t12",
  "alert_level": "high",
  "alternative_sources": [
    { "source": "lease_level_live", "value": 0.138, "delta": 39.4, "delta_significance": "extreme" },
    { "source": "rent_roll", "value": 0.0132, "delta": 0.78, "delta_significance": "high" },
    { "source": "om", "value": null, "delta": null, "delta_significance": "missing" }
  ],
  "interpretation_hint": "T12 average reflects trailing carrying; lease-level reflects current snapshot; magnitude of divergence suggests substantial mark-to-market opportunity not captured by T12 baseline"
}
```

The `interpretation_hint` is the agent's foothold. Piece C agents read these hints when synthesizing market findings — "Per CoStar trailing T12, LTL appears modest (0.35%), but live lease-level analysis shows substantial gap (13.8%), suggesting Y meaningful mark-to-market upside captured as leases roll."

### Where divergence surfacing appears in the UI

Three placements:

**Per-field provenance badge:** every displayed field shows a small indicator when `alertLevel` is non-zero. Clicking reveals the alternative sources with their values.

**The Validation Grid:** the existing F2a Validation Grid surface is the natural home for explicit divergence display. Each row shows the field, the resolved value, the alternative sources with deltas, the operator's confidence indicator, and override affordance.

**The Deal Capsule:** when the deal capsule is rendered for sharing, divergences appear in a "Source Disagreements" section that operators can choose to include or redact (per the freeze-on-share pattern from the capsule vision).

### The deal completeness contribution

When material divergences are *unresolved* — neither overridden nor explicitly acknowledged by the operator — they contribute to deal incompleteness. The deal completeness framework treats unresolved high-alert divergences as "operator review needed" signals.

---

## LAYER 1 OVERRIDE WIRING UNIVERSALITY

Per Commitment 5 from the overview: every field the agent (or platform) authors must have Layer 1 operator override wired.

### Audit-identified wiring gaps

From the Deal Details audit:
- **NOI** — Task #1520 in progress
- **EGI** — same wiring pattern needed (agent writes; override not surfaced uniformly)
- **GPR** — agent authoring confirmed; override path exists at per-year level but year-1 override needs UI surface
- **Per-line OpEx** — Task #1521 added per-year overrides; year-1 layer needs verification
- **LTL** — per-year override missing entirely (`projPyOvr('loss_to_lease_pct')` doesn't exist); needs addition
- **LP/GP equity split** — no UI write path; needs new affordance
- **Unit mix flag** (`da:use_unit_mix_for_gpr`) — backend supports it; no UI toggle exists
- **Several other fields per the audit's 65-empty / 19-broken inventory**

### The discipline going forward

For every field that any agent or platform layer authors:

1. **A LayeredValue structure must exist** with explicit Layer 1 slot
2. **A PATCH endpoint must exist** writing to that Layer 1 slot
3. **The resolution chain must select override over agent** (verified by tests, not just documented)
4. **The UI surfaces the override affordance** consistently per design system
5. **Reset-to-agent must be available** at any time
6. **Material divergence between Layer 1 and Layer 2** fires an alert

This applies to every field in every F-key. Piece B's implementation includes an audit pass over every field surfaced in the Deal Details audit to confirm or fix each one's wiring.

---

## CROSS-SURFACE READ CONSISTENCY MIGRATION

The audit identified Pro Forma reading from Engine A's computation while Valuation Grid reads from `year1.noi.resolved`. This pattern needs to be eliminated across all surfaces.

### Migration approach

**Step 1 — inventory.** For every field displayed in the platform, document the current read path. The Deal Details audit started this; Piece B's implementation completes it.

**Step 2 — pick a canonical path per field.** Generally the LayeredValue resolution is canonical, but some fields legitimately have multiple authoritative views (e.g., NOI from Engine A computation vs NOI from operator override). In those cases, the resolved LayeredValue is canonical — the engine's computation writes to the agent layer (or platform layer); operator override sits above it; resolved is what consumers read.

**Step 3 — migrate consumers one at a time.** Per the reader migration pattern from the property refactor (feature flag → shadow comparison → canary → 100% → 30 days stable → old code removed).

**Step 4 — enforce.** New code that adds a field must declare its canonical read path. Code review checks that consumers use the canonical path. Static analysis where feasible.

### What this changes about Engine A

Engine A's `getDealFinancials()` becomes one of the writers to the LayeredValue chain, not a separate read path. The agent layer or platform layer for NOI captures Engine A's computation; consumers read `year1.noi.resolved`. Pro Forma and Valuation Grid both read from the same place; both see the same value.

This may sound like a significant refactor, but it's mostly wiring — Engine A's computation logic doesn't change, it just writes to a LayeredValue slot instead of being read directly. The consumers change (Pro Forma reads resolved instead of computing fresh).

---

## IMPLEMENTATION SCOPE

**Phase 2B-1 — Cross-surface read consistency foundation (4-5 weeks):**
1. Field inventory: catalog every displayed field's current read path
2. Pick canonical paths; document
3. Wire `getFieldValue()` service as the canonical access point
4. Migrate top-priority consumers (NOI in Valuation Grid first; this completes Task #1520's reach)

**Phase 2B-2 — LTL trajectory implementation (3-4 weeks):**
1. Define LTL trajectory math in code (per the formula above)
2. Add lease roll velocity capture at seeder time → `deal_assumptions.lease_roll_velocity_per_year`
3. Add mark-to-market capture rate as operator-controllable assumption (Layer 1 wiring)
4. Add `loss_to_lease_pct:yr${yr}` per-year override key
5. Update projection loop to call trajectory function instead of using flat constant
6. Update LTL display to show trajectory (line chart, not single value)
7. Verify against 464 Bishop: LTL trajectory should reflect the 13.8% live signal, not the 0.35% T12 average

**Phase 2B-3 — Divergence surfacing (3-4 weeks):**
1. Define material divergence thresholds per field (configurable)
2. Compute divergence signatures at field resolution time
3. Surface in Validation Grid and per-field provenance badges
4. Feed divergence to agent context (precursor to Piece C)
5. Feed divergence to deal completeness framework

**Phase 2B-4 — Layer 1 override wiring audit and fixes (4-5 weeks):**
1. Inventory every field's override wiring status
2. Wire missing override paths (LTL, LP/GP split, unit mix flag, other audit findings)
3. UI affordances per design system
4. Test discipline: every agent-authored field has working override

**Phase 2B-5 — Trajectory math for other hold-year fields (3-4 weeks):**
1. GPR trajectory: ensure lease-roll-based primary path (audit found portfolio-level shortcut)
2. Other income: independent growth rate, not GPR-inherited
3. OpEx growth: per-line rates, not single scalar
4. Vacancy: when M07 missing, flag deal as incomplete rather than silently using flat percentage

**Total estimated Piece B scope:** 17-22 weeks, runs in parallel with Pieces A and C as dependencies allow.

---

## ACCEPTANCE CRITERIA

Piece B is complete when:

1. **No cross-surface field inconsistencies remain.** Pro Forma, Valuation Grid, Returns, Decision, and F-keys all read the same value for any logical field. The audit's CF-01 pattern (NOI showing different values at different surfaces) is eliminated as a class of bug.

2. **LTL trajectory math implemented and the 464 Bishop divergence resolves.** LTL projects forward from inputs (T12 baseline + mark-to-market rate + lease roll velocity) producing per-year values. The platform's LTL for 464 Bishop reflects the lease-level signal (closer to 13.8%) rather than the T12 average (0.35%), with explicit display of both sources and operator override available.

3. **Every agent-authored field has Layer 1 override wired.** No silent agent-wins-by-default behavior. UI affordances consistent across the platform.

4. **Material divergences surface as alerts, not silence.** Validation Grid shows divergence signatures. Per-field badges fire on alertLevel. Divergences contribute to deal completeness scoring.

5. **Hold-year trajectory math operational for GPR, LTL, other income, vacancy, OpEx per-line.** Flat-constant approximations are documented as fallbacks (when trajectory inputs are missing) but not the primary computation.

6. **`getFieldValue()` is the canonical access point.** Code review catches new consumers that bypass it. Old direct-read patterns removed from migrated surfaces.

---

## RELATIONSHIP TO OTHER DOCUMENTS

| Document | How Piece B relates |
|---|---|
| Vendor Market Data Architecture (overview) | Piece B operationalizes Commitments 1, 3, 4, 5 (LayeredValue universality; trajectory math; cross-surface consistency; override wiring) |
| Piece A (Vendor Abstraction) | Piece B consumes Piece A's `vendor_market_observations` substrate for cross-vendor reconciliation |
| Piece C (Agent Synthesis Interface) | Piece B's divergence signatures and reconciled view are the research material Piece C agents consume |
| Piece D (Divergence as Quality Signal) | Piece B's divergence detection is the data Piece D tracks over time |
| Deal Details Audit | Piece B is the primary architectural response to the audit's cross-surface inconsistency findings and Layer 1 wiring gaps |
| Engine A + M07 lease-roll audit | Piece B's LTL trajectory implementation responds directly to the audit's most significant single finding |
| Revised calc-vs-assumption doc | Piece B is the implementation of the doc's Layer 1 wiring discipline applied universally |
| Task #1520 (NOI override) | Piece B's cross-surface consistency completes #1520's intent beyond NOI |
| Task #1521 (per-year overrides) | Piece B's LTL trajectory adds the missing per-year override for LTL |
| F-key triage Wave A (freshness indicator) | Piece B's divergence surfacing extends the freshness pattern from "how old" to "how disputed" |

---

## NOTE TO REPLIT

Three things worth being explicit about:

**First, the field inventory is the precondition.** Before Phase 2B-1 starts, the inventory of every displayed field's current read path needs to land. This is audit-style work, not implementation. Without it, the canonical-path migration is guesswork.

**Second, the LTL trajectory is genuinely architecturally significant.** The 39× divergence the audit found isn't a small bug — it's a structural underestimation of value-add opportunity that biases the platform's underwriting toward stabilized-deal assumptions. Operators underwriting value-add deals are getting wrong LTL trajectories today. Fixing this is high-leverage even if other parts of Piece B take longer.

**Third, the divergence surfacing changes operator experience materially.** Today operators see resolved values without context. After Piece B, they see resolved values with explicit "this value disagreed with alternative sources by X" context. This is more information; some operators will love it; others may find it overwhelming. The UI design needs to make the alerting graceful — surfacing material disagreements without burying every field in metadata noise. Worth designing carefully.

Per CLAUDE.md P8: state-verify the current read paths, the current FIELD_PRIORITIES contents, and the current per_year_overrides keys against live code before implementing. The audit caught several discrepancies between assumed and actual state; expect similar findings here.
