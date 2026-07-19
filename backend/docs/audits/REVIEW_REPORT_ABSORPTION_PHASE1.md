# REVIEW REPORT — ABSORPTION_ENGINE_PHASE1_DESIGN.md
**Reviewer:** bot (self-review against `REVIEW_GATE_ABSORPTION_PHASE1_DESIGN.md`)
**Commit reviewed:** `aa04fce59`
**Date:** 2026-07-18

---

## CHECK 1: CONVERSION OWNERSHIP — PARTIAL

**Evidence:**
> "Step 7 | Delete old services | 5→1 achieved" (Section 4, Migration Path table)

Migration path ends with deletion — PASS on that sub-check.

**Missing:** `ProFormaService:134`'s `closing_ratio` is NOT explicitly listed as migrating INTO the registry. The design cites `TrafficToProFormaService` (M07→M09 bridge) as the first consumer but gives no file:line for `closing_ratio`.

---

## CHECK 2: P0 INDEPENDENCE — FAIL

**Evidence:**
> "The P0 (visits-vs-tours) happened because `visit_to_tour_ratio` in one service applied to a stage labeled differently in another." (Section 4, "The Disease")

The P0 is referenced as historical motivation, but the design doc does NOT explicitly state:
- The P0 fix is OUT of this design's scope
- The design INHERITS corrected stage-labeling
- No Phase 1 deliverable is a prerequisite for the P0 dispatch

Section 1 (Scope Boundary) does not list the P0 fix as OUT.

---

## CHECK 3: PROVENANCE AT WRITE — FAIL

**Evidence (schema):**
> "`conversion_provenance` | jsonb | Which stage labels resolved from which source" (Section 6, `absorption_estimates` table)

`conversion_provenance` covers conversion ratios only. It does NOT cover:
- The estimate row's source-class / tier (`measured` | `observed` | `inferred`)
- WHICH fallback rung produced the value (II.3: measured → derived → inferred, method named)
- Error band / confidence stored alongside the estimate

No per-row provenance columns exist for `weekly_forecast`, `monthly_rollup`, or `netAbsorption`.

---

## CHECK 4: CANONICAL KEYS — FAIL

**Evidence:**
> "`type DealMode = 'existing' | 'lease_up';`" (Section 2)

Locally declared string literals with:
- No import from shared canonical module
- No explicit declaration of canonical spellings to register in a Wave-1 key module
- No reconciliation note linking to SPEC_ABSORPTION_ENGINE II.1 taxonomy

Stage labels are also local literals:
> "`'inquiry→tour'` | `'tour→application'` | `'application→lease'`" (Section 4)

---

## CHECK 5: LADDER-DRIVEN MONTHLY — PASS

**Evidence:**
> "`expectedMoveOuts: number;  // expiringLeases × (1 − renewalRate)`" (Section 3, `MonthlyAbsorption` interface)

> "Weekly funnel flows (Layer 2 input) + monthly ladder (Layer 3 output) are married at this seam. The monthly rollup is **aggregation**, not a separate native model." (Section 3, "The Marriage")

> "4. **No decay model:** The retired `TenYearProjectionService`'s decay curve is NOT used. Monthly values are direct aggregation or ladder computation." (Section 3, Aggregation Rules)

**Grep hits:**
- `"TenYearProjectionService"` — 3 occurrences, all explicit rejections (Sections 1, 3, 10)
- `"decay"` — 1 occurrence: "decay curve is NOT used" (Section 3, Rule 4)

Zero load-bearing usages.

---

## CHECK 6: ASYMMETRIC TRENDING — FAIL

**Evidence:** The design doc does NOT contain:
- A `rentPath` field or derivation
- Per-lease roll-to-market on the expiry ladder
- Any statement that the assembler does NOT touch stored-direct stabilized expenses / other income
- Loss-to-lease expressibility (the $588K finding is not representable in the current `DemandContext` or `MonthlyAbsorption` interfaces)

`DemandContext` (Section 2) carries traffic modifiers only:
> "`weeklyTrafficForecast`, `seasonalityIndex`, `demandModifier`, `pricingModifier`"

No rent engine, no per-lease granularity, no asymmetric trending semantics.

---

## CHECK 7: GATE DEALS + HONEST ACCEPTANCE TEST — FAIL

**Evidence:**
> "| Weekly seasonality | 52-week ingestion table | Forecast peaks align with historical peaks |" (Section 8, Highlands)

The test strategy does NOT name:
- Highlands funnel: 15 contacts → 10.9 tours → 1.94 leases
- Race deficit: need 13.3 vs have 10.9
- Ladder: Jul 46 expirations
- LTL: $192/unit, $588K/yr

For Bishop:
- `monthsToStabilize` is NOT mentioned as derived
- B5 consumption is NOT mentioned
- Back-test v1 is referenced but NOT specified as "ladder-driven v1 re-scored against held-out Jan–Jul 2026 window"

The test criteria are unit-test-green abstractions, not live-number reproduction.

---

## CHECK 8: QUARANTINE IN THE RISK REGISTER — FAIL

**Evidence:**
> "| `TrafficPredictionEngine` output shape changes | Medium | High | AbsorptionEngine accepts generic `weeklyTrafficForecast: number[]` |" (Section 9, Risk Register)

The risk register contains 4 risks. NONE mention:
- CoStar firewall
- Permits/Census-sourced supply inputs
- Calibration/validation restrictions against CoStar-lineage data
- Source class (S3/S4) on any market-data dependency

---

## SCORE: 1 PASS / 1 PARTIAL / 6 FAIL

**Not banked.** Revision list below.

---

## REVISION LIST

### R1: CHECK 1 — Cite ProFormaService:134 explicitly
Add a migration step or note in Section 4 that explicitly names `ProFormaService` (or `trafficToProFormaService.ts:134`) as a conversion site whose `closing_ratio` and `visit_to_tour_ratio` migrate into the registry.

### R2: CHECK 2 — Scope P0 OUT explicitly
Add a sentence to Section 1 (Scope Boundary) or Section 0 (Design Principle): "This design inherits corrected stage-labeling from the Wave 0 P0 fix; the P0 fix ships independently and is NOT a prerequisite for any Phase 1 deliverable."

### R3: CHECK 3 — Add provenance columns to schema
Extend `absorption_estimates` schema:
- `estimate_tier` enum: `'measured' | 'observed' | 'inferred'`
- `fallback_rung` text: which II.3 rung produced the value (e.g., `'submarket_peer'`, `'market_default'`)
- `confidence_band` jsonb: `{ lower: number, upper: number, method: string }`

Update `MonthlyAbsorption` to carry per-field provenance if needed.

### R4: CHECK 4 — Reconcile canonical keys
Either:
- Declare the canonical spellings and name the destination module (e.g., `backend/src/types/canonical-keys.ts` in Wave 1)
- Or import from an existing canonical module if one exists
Add a reconciliation note mapping design literals to SPEC_ABSORPTION_ENGINE II.1 taxonomy.

### R5: CHECK 6 — Add asymmetric trending to DemandContext or adjacent seam
Extend the design to include:
- `rentPath` derivation: per-lease roll-to-market on expiry ladder
- Explicit statement: assembler does NOT re-trend stored-direct stabilized expenses / other income
- Loss-to-lease expressibility: individual lease below market, roll at expiration

This may require a new interface (e.g., `RentContext`) alongside `DemandContext`.

### R6: CHECK 7 — Name live numbers in acceptance tests
Rewrite Section 8 with explicit acceptance criteria:
- Highlands: reproduce 15→10.9→1.94 funnel, 13.3 vs 10.9 race deficit, Jul 46 ladder, $192/$588K LTL
- Bishop: derive `monthsToStabilize` from S-curve, consumed by B5
- Back-test: ladder-driven v1 re-scored against held-out Jan–Jul 2026; v0 occupancy-direction miss either fixed or honestly labeled

### R7: CHECK 8 — Add CoStar firewall to risk register
Add risk row:
> "| CoStar-lineage data contamination | Low | High | Supply inputs = permits/Census ONLY; no calibration against CoStar-derived data; Highlands submarket cross-read is observational, not validated |"

Name source class (S3/S4) on all market-data dependencies in the design.

---

**Next action:** Revise `ABSORPTION_ENGINE_PHASE1_DESIGN.md` against R1–R7, commit, and re-run this review gate.
