# 8-POINT DESIGN REVIEW REPORT — ABSORPTION_ENGINE_PHASE1_DESIGN.md

**Review date:** 2026-08-22
**Design commit reviewed:** `ae220c20e` (HEAD at time of review)
**Review document commit:** `REVIEW_DOC_COMMIT` — updated after this file commits
**Reviewer:** local agent (post W1 closeout)
**Rule:** One line per check: PASS / FAIL / PARTIAL — verbatim quote + section. Any non-PASS = revision list; re-run required.

---

## CHECK 1 — CONVERSION OWNERSHIP (R4: one proprietor, not a sixth service)

**PASS**

> "Step 7 | Delete old services | 5→1 achieved" (Section 4, Migration Path table)

> "**Schedule risk, not architecture risk.** Each legacy service tagged `@deprecated` at registry launch; removal tickets (#M4-1 through #M4-5) track per-step completion. Thin delegates are interim scaffolding, not permanent. If step 3 stalls >2 sprints, escalation to architecture review; no silent indefinite coexistence." (Section 10, Risk Register)

The contradiction is resolved: the migration path commits to deletion (Step 7), and the risk register reframes stall risk as *schedule* risk with `@deprecated` tags and explicit removal tickets — not permanent coexistence. No "indefinitely" hedge remains.

---

## CHECK 2 — P0 INDEPENDENCE (Wave 0 stays Wave 0)

**PASS**

> "The P0 visits-vs-tours fix [...] is a **live production data-integrity defect that ships independently in Wave 0.** This design inherits corrected stage-labeling; it does not deliver the fix. No Phase 1 deliverable is a prerequisite for the P0 dispatch." (Section 1, P0 FIX — EXPLICITLY OUT OF SCOPE)

P0 is explicitly fenced out. The design inherits corrected stage-labeling (visit→tour = 0.50, closing_ratio preserved as tours→leases). Verified: P0 fix shipped July 13 (`90d494584`) independently.

---

## CHECK 3 — PROVENANCE AT WRITE (`absorption_estimates` schema)

**PASS**

> "`estimate_tier` enum | `'measured' \| 'observed' \| 'inferred'` — spec II.3 provenance" (Section 6)

> "`fallback_rung` text | which II.3 rung produced the value..." (Section 6)

> "`confidence_band` jsonb | `{ lower: number, upper: number, method: string }` — spec II.3 format" (Section 6)

> "**Provenance rule (Check 3):** No estimate row can exist without `estimate_tier` + `fallback_rung` + `confidence_band`." (Section 6)

All three provenance fields schema-defined. The no-row-without-all-three rule is explicit. Anti-original-sin pattern: stamp at entry, not inference at read.

---

## CHECK 4 — CANONICAL KEYS (no spelling #6)

**PASS**

> "`// Canonical spellings: imported from backend/src/shared/canonical-keys.ts (Wave 1 unification).`" (Section 2, `DealMode` declaration)

> "`import { StageLabel } from '../shared/canonical-keys';`" (Section 4, ConversionRegistry)

> "`// Reconciliation: canonical StageLabel = 'inquiry_to_tour' | 'visit_to_tour' | 'tour_to_lease'`" (Section 4)

Verified live: `backend/src/shared/canonical-keys.ts` exports `StageLabel` with exactly `inquiry_to_tour`, `visit_to_tour`, `tour_to_lease` (line 28-33). Arrow characters (`→`) removed; underscore-lowercase canonical form used. Display labels (with arrows) are presentation-layer only (`DisplayMap.stageLabel`, lines 60-64).

---

## CHECK 5 — LADDER-DRIVEN MONTHLY (R2's most likely quiet violation)

**PASS**

> "`expectedMoveOuts: number;  // expiringLeases × (1 − renewalRate)`" (Section 3, `MonthlyAbsorption` interface)

> "The monthly rollup is **aggregation**, not a separate native model." (Section 3)

> "**No decay model:** The retired `TenYearProjectionService`'s decay curve is NOT used." (Section 3, Aggregation Rule 4)

Grep for "decay" in doc: 1 hit, negation. Grep for "TenYearProjection": 3 hits, all retirement context. Zero load-bearing usages. Ladder is sole source of move-outs.

---

## CHECK 6 — ASYMMETRIC TRENDING IN DemandContext (II.13)

**PASS**

> "Rent growth is NOT a uniform `GPR×(1+g)^year`. Market rent grows continuously; a unit's REALIZED rent steps only at LEASE EXPIRATION, when it rolls to then-current market." (Section 7)

> "**Assembler discipline:** The overlay does NOT touch stored-direct stabilized expenses / other income (no re-trending)." (Section 7)

> "`lossToLeaseAnnual: number;` — sized demand gap" + "Highlands finding: LTL $192/unit = $588K/yr — invisible to uniform-growth models" (Section 7, `RentContext`)

Per-lease roll-to-market is native grain; uniform growth explicitly rejected. LTL expressible. Assembler no-re-trending rule stated for expenses/other income.

---

## CHECK 7 — GATE DEALS + HONEST ACCEPTANCE TEST (S1-01 at design level)

**PASS**

Highlands live numbers named in Section 9:
- Funnel: **15 contacts → 10.9–12.2 tours → 1.94–3.15 leases/wk** (9.1)
- Race deficit: **18%** (need **13.3**, have **10.9**) (9.2)
- Ladder: **121 leases Jun–Sep 2026, July = 46** (9.3)
- LTL: **$192/unit = $588K/yr** (9.4)
- Demand-supported rent: **$1,674–1,680** (9.5)
- Conversion: **17.9%** tour→lease (9.6)
- Back-test v0 honesty: **occupancy WRONG DIRECTION** (pred **91.0%**, actual **96.2%**) labeled `modeled · backtested · direction unreliable under lumpy expiries · n=27` (9.7)
- v1 fix: ladder-driven move-outs + rent-coupled conversion (9.8)

Bishop:
- `monthsToStabilize` **DERIVED** from `occupancyPath` crossing stabilization threshold; consumed by B5 (9.10)

All gate-deal numbers explicit, not hand-waved. Back-test carries honest labeling for v0 miss. v1 fix specified.

---

## CHECK 8 — QUARANTINE IN THE RISK REGISTER

**PASS**

> "**CoStar-lineage data contamination** | Low | **High** | **Supply inputs = permits/Census ONLY; no calibration/validation against CoStar-derived data; CE pairs against CoStar-lineage rows remain deal-scoped/restricted per I1-EXTENSION firewall. The Highlands submarket cross-read is observational only — confirms the engine's independent narrative but contributes ZERO coefficients.**" (Section 10, Risk Register)

Firewall explicit: supply = permits/Census, no CoStar calibration, observational cross-read quarantined. Source class named on market-data dependencies.

---

## SCORE: 8/8 PASS

| Check | Status | Section |
|-------|--------|---------|
| 1 — Conversion Ownership | **PASS** | Section 4 (migration) + Section 10 (risk register) — contradiction resolved |
| 2 — P0 Independence | PASS | Section 1, P0 FIX |
| 3 — Provenance at Write | PASS | Section 6, Data Model |
| 4 — Canonical Keys | PASS | Section 2 + Section 4 — canonical-keys.ts verified live |
| 5 — Ladder-Driven Monthly | PASS | Section 3, Aggregation Rules |
| 6 — Asymmetric Trending | PASS | Section 7, Rent Engine |
| 7 — Gate Deals + Honest Acceptance | PASS | Section 9, Test Strategy |
| 8 — Quarantine | PASS | Section 10, Risk Register |

---

## BANKING STATEMENT

`ABSORPTION_ENGINE_PHASE1_DESIGN.md` at commit `ae220c20e` is **REVIEWED — BANKED FOR WAVE 3**.

**Gate condition for build dispatch:** Wave 1 unification foundations complete.

**Cross-references:**
- SPEC_ABSORPTION_ENGINE I–II.15
- TRAFFIC_ENGINE_AUDIT R1–R5 (approved 2026-07-18)
- `backend/src/shared/canonical-keys.ts` (live verification)
