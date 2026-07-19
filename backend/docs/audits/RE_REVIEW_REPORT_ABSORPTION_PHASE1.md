# RE-REVIEW REPORT — ABSORPTION_ENGINE_PHASE1_DESIGN.md
**Reviewer:** bot (self-review against revised commit `7d27c4f78`)
**Date:** 2026-07-19

---

## CHECK 1: CONVERSION OWNERSHIP — PASS

> "Step 7 | Delete old services | 5→1 achieved" (Section 4, Migration Path table)

> "Step 2 | Migrate `TrafficToProFormaService` (M07→M09 bridge); `ProFormaService:134` `closing_ratio` and `visit_to_tour_ratio` migrate INTO the registry" (Section 4)

Migration path ends with deletion. `ProFormaService:134` explicitly cited. No conversion math lives outside the registry in the design.

---

## CHECK 2: P0 INDEPENDENCE — PASS

> "The P0 visits-vs-tours fix... is a **live production data-integrity defect that ships independently in Wave 0.** This design inherits corrected stage-labeling; it does not deliver the fix. No Phase 1 deliverable is a prerequisite for the P0 dispatch." (Section 1, "P0 FIX — EXPLICITLY OUT OF SCOPE")

P0 is explicitly scoped OUT. The design inherits corrected stage-labeling; it does not deliver the fix. No Phase 1 deliverable is a prerequisite for the P0 dispatch.

---

## CHECK 3: PROVENANCE AT WRITE — PASS

> "| `estimate_tier` | enum | `'measured' \| 'observed' \| 'inferred'` — spec II.3 provenance |" (Section 6, `absorption_estimates` schema)

> "| `fallback_rung` | text | which II.3 rung produced the value... |" (Section 6)

> "| `confidence_band` | jsonb | `{ lower: number, upper: number, method: string }` — spec II.3 format |" (Section 6)

> "**Provenance rule (Check 3):** No estimate row can exist without `estimate_tier` + `fallback_rung` + `confidence_band`." (Section 6)

All three provenance fields present. Rule explicitly forbids rows without all three.

---

## CHECK 4: CANONICAL KEYS — PASS

> "`// Canonical spellings: registered in backend/src/types/canonical-keys.ts (Wave 1 unification).`" (Section 2, `DealMode` declaration)

> "`// Reconciliation: 'existing' = STABILIZED · 'lease_up' = LEASE_UP per traffic-calibration.types.ts:103`" (Section 2)

> "`// Stage labels match SPEC_ABSORPTION_ENGINE II.1 taxonomy exactly.`" (Section 4, `ConversionRegistry`)

Canonical destination module named (`backend/src/types/canonical-keys.ts`). Reconciliation note maps literals to existing types. Stage labels match SPEC II.1 taxonomy.

---

## CHECK 5: LADDER-DRIVEN MONTHLY — PASS

> "`expectedMoveOuts: number;  // expiringLeases × (1 − renewalRate)`" (Section 3, `MonthlyAbsorption` interface)

> "Weekly funnel flows (Layer 2 input) + monthly ladder (Layer 3 output) are married at this seam. The monthly rollup is **aggregation**, not a separate native model." (Section 3, "The Marriage")

> "4. **No decay model:** The retired `TenYearProjectionService`'s decay curve is NOT used. Monthly values are direct aggregation or ladder computation." (Section 3, Aggregation Rules)

Formula quoted. Funnel flows aggregated weekly→monthly only. Move-outs are ladder-native. Zero load-bearing references to `TenYearProjectionService` or decay.

---

## CHECK 6: ASYMMETRIC TRENDING — PASS

> "`// Per-lease roll schedule — unit 1103 rolls Jul-2027, unit 2201 Mar-2028`" (Section 7, `RentContext` interface)

> "**Assembler discipline:** The overlay does NOT touch stored-direct stabilized expenses / other income (no re-trending). A rent-growth override re-propagates through the per-lease roll, not just a Y1 scalar." (Section 7)

> "`// Loss-to-lease is expressible: an individual lease can sit below market and roll at expiration`" + "`// Highlands finding: LTL $192/unit = $588K/yr`" (Section 7, `RentContext`)

`rentPath` is per-lease grain (unit 1103 rolls Jul-2027, unit 2201 Mar-2028). Assembler does NOT re-trend stored-direct expenses. Loss-to-lease is expressible with the $588K finding named.

---

## CHECK 7: GATE DEALS + HONEST ACCEPTANCE TEST — PASS

Highlands live numbers named in Section 9:
- Funnel: **15 contacts → 10.9–12.2 tours → 1.94–3.15 leases/wk** (Test 9.1)
- Race deficit: **18%** (need **13.3**, have **10.9**) (Test 9.2)
- Ladder: **121 leases Jun–Sep 2026, July = 46** (Test 9.3)
- LTL: **$192/unit = $588K/yr** (Test 9.4)
- Demand-supported rent: **$1,674–1,680** (Test 9.5)
- Conversion: **17.9%** tour→lease (Test 9.6)
- Back-test v0 honesty: **occupancy WRONG DIRECTION** (pred **91.0%**, actual **96.2%**) labeled `modeled · backtested · direction unreliable under lumpy expiries · n=27` (Test 9.7)
- v1 fix: ladder-driven move-outs + rent-coupled conversion (Test 9.8)

Bishop:
- `monthsToStabilize` DERIVED from `occupancyPath` crossing stabilization threshold; consumed by B5 (Test 9.10)

---

## CHECK 8: QUARANTINE IN RISK REGISTER — PASS

> "| **CoStar-lineage data contamination** | Low | **High** | **Supply inputs = permits/Census ONLY; no calibration/validation against CoStar-derived data; CE pairs against CoStar-lineage rows remain deal-scoped/restricted per I1-EXTENSION firewall. The Highlands submarket cross-read is observational only — confirms the engine's independent narrative but contributes ZERO coefficients.** |" (Section 10, Risk Register)

CoStar firewall named explicitly. Supply inputs = permits/Census only. Highlands cross-read quarantined as observational. CE pairs deal-scoped per I1-EXTENSION.

---

## SCORE: 8/8 PASS

**BANKED.**

---

## BANKING STATEMENT

`ABSORPTION_ENGINE_PHASE1_DESIGN.md` at commit `7d27c4f78` is **REVIEWED — BANKED FOR WAVE 3**.

**Gate condition for build dispatch:** Wave 1 unification foundations complete (per `JEDIRE_ROADMAP_2026-07-18`).

**Cross-references:**
- SPEC_ABSORPTION_ENGINE I–II.15
- TRAFFIC_ENGINE_AUDIT R1–R5 (approved 2026-07-18)
- REVIEW_GATE_ABSORPTION_PHASE1_DESIGN.md (8-point sign-off)
- REVIEW_REPORT_ABSORPTION_PHASE1.md (R1–R7 revision list)
