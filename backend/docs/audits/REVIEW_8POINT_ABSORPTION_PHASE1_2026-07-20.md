# 8-POINT DESIGN REVIEW REPORT — ABSORPTION_ENGINE_PHASE1_DESIGN.md

**Review date:** 2026-07-20
**Design commit:** `7d27c4f78` (header claims "re-review 8/8 PASS")
**Reviewer hash:** `34f4405bf` (current origin/master HEAD)
**Rule:** One line per check: PASS / FAIL / PARTIAL — verbatim quote + section. Any non-PASS = revision list; re-run required.

---

## CHECK 1 — CONVERSION OWNERSHIP (R4: one proprietor, not a sixth service)

**PARTIAL — contradiction between migration promise and risk-register admission.**

> Migration path Step 7: "Delete old services | 5→1 achieved" (Section 4, Migration Path table)

> Risk Register: "Old services stay as thin delegates indefinitely; no forced deletion"

**The problem:** The migration path promises deletion (Step 7), but the risk register admits the old services may never be deleted ("indefinitely"). CHECK 1 explicitly says "FAIL if: the registry coexists indefinitely with any existing conversion service." The design tries to have both — a migration终点 that deletes and a risk register that accepts permanent coexistence. These cannot both be true.

**Additional finding:** The design cites `ProFormaService:134` as a migration target (Section 4, Step 2: "`ProFormaService:134` `closing_ratio` and `visit_to_tour_ratio` migrate INTO the registry"). This file was proven phantom in P0 Verification 1 — it never existed in repo history. The *intent* is clear (the closing_ratio wherever it lives migrates into the registry), but the citation is fabricated. This is the S1-01 violation pattern the P0 audit itself exhibited.

**Required revision:** Pick one — either the migration path commits to deletion (and the risk register removes the "indefinitely" hedge), or the design honestly admits thin delegates are the permanent shape and CHECK 1 is re-negotiated. The registry cannot be "sole proprietor" and "coexists indefinitely" simultaneously.

**Weight note (from Leon):** This check now carries two inherited tickets — P0's `visit_to_tour_ratio` override wiring and V6's `inquiry_to_tour_ratio` (leasingTrafficService 0.98). The registry's scope just expanded; the contradiction matters more, not less.

---

## CHECK 2 — P0 INDEPENDENCE (Wave 0 stays Wave 0)

**PASS**

> "The P0 visits-vs-tours fix (`ProFormaService:134` computes `projectedLeases = weekly_walk_ins × closing_ratio` — but `weekly_walk_ins` are **visits** and `closing_ratio` is **tours→leases**) is a **live production data-integrity defect that ships independently in Wave 0.** This design inherits corrected stage-labeling; it does not deliver the fix. No Phase 1 deliverable is a prerequisite for the P0 dispatch." (Section 0, Scope Boundary — P0 FIX)

The scope boundary explicitly fences P0 out. Verified: the P0 fix shipped July 13 (`90d494584`) independently. The design inherits corrected stage-labeling (visit→tour ratio = 0.50, closing_ratio preserved as tours→leases).

---

## CHECK 3 — PROVENANCE AT WRITE (`absorption_estimates` schema)

**PASS**

> "`estimate_tier` enum | `'measured' \| 'observed' \| 'inferred'` — spec II.3 provenance" (Section 6, Data Model — absorption_estimates table)

> "`fallback_rung` text | which II.3 rung produced the value (e.g., `'submarket_peer'`, `'market_default'`, `'workback(capture 0.4–0.7)'`)" (Section 6)

> "`confidence_band` jsonb | `{ lower: number, upper: number, method: string }` — spec II.3 format" (Section 6)

> "**Provenance rule (Check 3):** No estimate row can exist without `estimate_tier` + `fallback_rung` + `confidence_band`." (Section 6)

All three provenance fields are schema-defined, and the design explicitly states the no-row-without-all-three rule. This is the anti-original-sin pattern: stamp at entry, not inference at read.

---

## CHECK 4 — CANONICAL KEYS (no spelling #6)

**PARTIAL — deferred reconciliation is declared, but StageLabel arrows are uncanonical.**

> "`DealMode` and `StageLabel` literals declared now; reconciliation with `backend/src/types/canonical-keys.ts` is a Wave 1 unification task" (Section 11, Decision Log #11)

The design honestly defers canonical-key reconciliation to Wave 1. However, the `StageLabel` union uses arrow characters (`'inquiry→tour'`, `'tour→application'`) — these are not valid TypeScript identifiers and will not reconcile cleanly with any `canonical-keys.ts` module that uses underscore-lowercase (`inquiry_to_tour`). The design does not name the mapping. This is a PARTIAL (not FAIL) because the hedge is declared, but the hedge should include the arrow→underscore mapping or use underscore form now.

**Required revision:** Either (a) declare the arrow→underscore mapping explicitly in Decision Log #11, or (b) change `StageLabel` to underscore-lowercase now (`'inquiry_tour'`, `'tour_application'`, `'application_lease'`) and note that display labels (with arrows) are a presentation-layer concern.

---

## CHECK 5 — LADDER-DRIVEN MONTHLY (R2's most likely quiet violation)

**PASS**

> "`expectedMoveOuts: number;  // expiringLeases × (1 − renewalRate)`" (Section 3, MonthlyAbsorption interface)

> "The monthly rollup is **aggregation**, not a separate native model." (Section 3, Aggregation Rules intro)

> "**No decay model:** The retired `TenYearProjectionService`'s decay curve is NOT used. Monthly values are direct aggregation or ladder computation." (Section 3, Aggregation Rule 4)

> "`TenYearProjectionService` is RETIRED, not adapted (R2)" (Section 0, Scope Boundary — OUT table #10)

Grep for "decay" in the design doc: only hit is the negation above. Grep for "TenYearProjection": only in the retirement context. No quiet violation — the ladder is the sole source of move-outs.

---

## CHECK 6 — ASYMMETRIC TRENDING IN DemandContext (II.13)

**PASS**

> "Rent growth is NOT a uniform `GPR×(1+g)^year`. Market rent grows continuously; a unit's REALIZED rent steps only at LEASE EXPIRATION, when it rolls to then-current market." (Section 7)

> "The overlay does NOT touch stored-direct stabilized expenses / other income (no re-trending)." (Section 7, Assembler discipline)

> "`lossToLeaseAnnual: number;` — sized demand gap" and "Highlands finding: LTL $192/unit = $588K/yr — invisible to uniform-growth models" (Section 7, RentContext interface)

The per-lease roll-to-market is the native grain; uniform growth is explicitly rejected. LTL is expressible as a field. The assembler discipline states the no-re-trending rule for expenses/other income.

---

## CHECK 7 — GATE DEALS + HONEST ACCEPTANCE TEST (S1-01 at design level)

**PASS**

> Highlands 9.1: "332K exposures/wk → anchor est. 25–40 visits/wk → **15 contacts → 10.9–12.2 tours → 1.94–3.15 leases/wk**" (Section 9)

> Highlands 9.2: "Replacement race deficit **18%** (need **13.3** tours/wk, have **10.9**)" (Section 9)

> Highlands 9.3: "Expiry wave: **121 leases Jun–Sep 2026, July = 46**; `expectedMoveOuts` = `expirations × (1 − 0.65)`" (Section 9)

> Highlands 9.4: "**LTL $192/unit = $588K/yr**" (Section 9)

> Highlands 9.7: "**occupancy WRONG DIRECTION** (pred 91.0%, actual 96.2%) labeled honestly: `modeled · backtested · direction unreliable under lumpy expiries · n=27`" (Section 9)

> Bishop 9.10: "`monthsToStabilize` DERIVED from `occupancyPath` crossing stabilization threshold; consumed by B5 IO-from-lease-up + refi timing" (Section 9)

All gate-deal numbers are named explicitly, not hand-waved. The back-test carries honest labeling for the v0 miss. The v1 fix is specified (ladder-driven move-outs + rent-coupled conversion).

---

## CHECK 8 — QUARANTINE IN THE RISK REGISTER

**PASS**

> "**CoStar-lineage data contamination** | Low | **High** | **Supply inputs = permits/Census ONLY; no calibration/validation against CoStar-derived data; CE pairs against CoStar-lineage rows remain deal-scoped/restricted per I1-EXTENSION firewall. The Highlands submarket cross-read is observational only — confirms the engine's independent narrative but contributes ZERO coefficients.**" (Section 10, Risk Register)

The firewall is explicit: supply = permits/Census, no CoStar calibration, observational cross-read quarantined. The risk register names the source class for market-data dependencies (S3/S4 in the firewall description).

---

## SCORE: 6 PASS / 2 PARTIAL

| Check | Status | Section |
|-------|--------|---------|
| 1 — Conversion Ownership | **PARTIAL** | Section 4 (migration) vs. Section 10 (risk register) — contradiction |
| 2 — P0 Independence | PASS | Section 0, Scope Boundary |
| 3 — Provenance at Write | PASS | Section 6, Data Model |
| 4 — Canonical Keys | **PARTIAL** | Section 11, Decision Log #11 — arrow chars uncanonical, mapping undeclared |
| 5 — Ladder-Driven Monthly | PASS | Section 3, Aggregation Rules |
| 6 — Asymmetric Trending | PASS | Section 7, Rent Engine |
| 7 — Gate Deals + Honest Acceptance | PASS | Section 9, Test Strategy |
| 8 — Quarantine | PASS | Section 10, Risk Register |

## REVISIONS REQUIRED

1. **CHECK 1:** Resolve the migration-path / risk-register contradiction. Either commit to deletion (remove "indefinitely" from risk register) or admit permanent thin delegates and re-negotiate CHECK 1. Replace phantom `ProFormaService:134` citation with the actual file(s) where `closing_ratio` lives today (`multifamilyTrafficService.ts`, `weekly-report-parser.service.ts`).

2. **CHECK 4:** Add explicit arrow→underscore mapping to Decision Log #11, or convert `StageLabel` to underscore-lowercase now with a display-label note.

## POST-REVISION
Re-run this review against the revised brief. Target: 8/8 PASS → BANKED FOR WAVE 3.
