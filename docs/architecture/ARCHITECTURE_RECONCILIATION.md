# JEDI RE — ARCHITECTURE RECONCILIATION

**Purpose:** Single source of truth for the state of the platform's architectural corpus. Tracks which documents exist where, which commitments are operational/in-flight/aspirational, which corrections have landed, and which divergences between docs and implementation are known.

**Status:** Living document. Update protocol: append corrections to §6 as they're identified; update commitment status in §3 as work lands; update document index in §2 when new docs are added or commitments retire prior docs.

**Last updated:** 2026-05-31

---

## §1 — WHY THIS DOCUMENT EXISTS

The architectural corpus has grown substantially across multiple sessions. Documents reference each other; commitments span multiple documents; reality drifts from documentation as code evolves and as audits surface findings. Without an artifact tracking the corpus state, three failures recur:

1. **Documents accumulate without coherence** — six docs may all be relevant to a question; no clear way to know which is authoritative
2. **Corrections get distributed across conversation history** — when reality diverges from a doc, the correction lives in a conversation that future sessions don't read
3. **Verification becomes archaeology** — checking "did this commitment land" requires hunting through Git history, task records, and prior conversations

This document addresses all three. It's the answer to "where are we on the plan?" — a question that came up multiple times in the session that produced the core architecture and that should remain answerable in one place going forward.

---

## §2 — DOCUMENT INDEX

### Active canonical documents

| Document | Location | Authority over | Last revised |
|---|---|---|---|
| Vendor Market Data Architecture (overview) | `docs/architecture/vendor-market-data/overview.md` | Multi-vendor ingestion, reconciliation, agent synthesis, divergence as signal | 2026-05-30 |
| Piece A — Vendor Abstraction | `docs/architecture/vendor-market-data/piece-a-vendor-abstraction.md` | Vendor registry, classifier generalization, license posture | 2026-05-30 |
| Piece B — Field-Level Reconciliation | `docs/architecture/vendor-market-data/piece-b-field-reconciliation.md` | Cross-surface read consistency, trajectory math, divergence surfacing, Layer 1 override universality | 2026-05-31 (audit findings incorporated) |
| Piece C — Agent Synthesis Interface | `docs/architecture/vendor-market-data/piece-c-agent-synthesis.md` | Agent authorship, deal completeness framework | 2026-05-30 |
| Piece D — Divergence as Quality Signal | `docs/architecture/vendor-market-data/piece-d-divergence-as-quality-signal.md` | Source reliability profiles, anomaly detection | 2026-05-30 |
| Revised Calc-vs-Assumption | `docs/architecture/calculations-vs-assumptions.md` | F9 ProForma calculation vs assumption distinction; LayeredValue framing; required Layer 1 override wiring | 2026-05-31 (NOI bug diagnosis corrected) |
| Property Plumbing Refactor | `docs/architecture/property-plumbing/refactor.md` | Property identity unification | (verify path) |
| Property Plumbing Phases | `docs/architecture/property-plumbing/phases.md` | Phased migration | (verify path) |
| Deal Capsule Vision | `docs/architecture/deal-capsule-vision.md` | Deal capsule structure, six stations | (verify path) |
| Strategy-Aware Modules | `docs/architecture/strategy-aware-modules.md` | Strategy-aware framing across modules | (verify path) |
| F-Key Triage | `docs/architecture/fkey-triage.md` | F-key surface prioritization and Wave A freshness pattern | (verify path) |
| Master Plan for Replit | `docs/architecture/master-plan.md` | Workstream coordination | (verify path) |
| Verification Protocol | `docs/architecture/verification-protocol.md` | P8 state-verification discipline | (verify path) |
| Backtest Harness Spec | `docs/architecture/backtest-harness-spec.md` | Reasoning validation | (verify path) |
| AI Compute Derivation Audit | `docs/architecture/ai-compute-derivation-audit.md` | Audit instrument for agent vs engine boundary | (note: framing should be re-evaluated against revised calc-vs-assumption doc) |

### Audit artifacts (informational, not architectural)

| Document | Location | Captures |
|---|---|---|
| Deal Details Data Audit | `docs/operations/DEAL_DETAILS_DATA_AUDIT.md` | 190-field POPULATED/SPARSE/EMPTY/BROKEN status |
| Deal Details UI/Backend Audit | `docs/operations/DEAL_DETAILS_UI_BACKEND_AUDIT.md` | 5-dimensional UI-to-backend wiring audit |
| Engine A + M07 Lease-Roll Audit | (transcript reference) | Five-field characterization confirming snapshot-at-ingestion architecture |
| Deal Details Audit Fix Plan Briefing | `docs/operations/DEAL_DETAILS_AUDIT_FIX_PLAN_BRIEFING.md` | Pattern-grouped fix inventory for Replit prioritization |

### Documents requiring path verification or known-stale

| Document | Status | Action needed |
|---|---|---|
| `PROFORMA_CALCULATION_TEMPLATE.md` | Referenced but path uncertain | Locate; verify the 22-and-14 count claim |
| `AI Compute Derivation Audit` | Framing partially superseded | Re-evaluate "smoking gun" claims against revised calc-vs-assumption framing |
| Various F-Key triage waves | Implementation state shifts as features ship | Reconcile periodically |

### ✅ Previously phantom — written to repo 2026-05-31

Corpus-sweep audit (2026-05-31) confirmed these six documents existed only in conversation history. All six were written to the repo on 2026-05-31. Current-state claims they contain reflect the state at the time of writing; claims tagged **[inferred]** were not re-verified by the corpus-sweep audit.

| Document | Status |
|---|---|
| `docs/architecture/vendor-market-data/overview.md` | Written 2026-05-31 |
| `docs/architecture/vendor-market-data/piece-a-vendor-abstraction.md` | Written 2026-05-31 |
| `docs/architecture/vendor-market-data/piece-b-field-reconciliation.md` | Written 2026-05-31 (audit findings incorporated) |
| `docs/architecture/vendor-market-data/piece-c-agent-synthesis.md` | Written 2026-05-31 |
| `docs/architecture/vendor-market-data/piece-d-divergence-as-quality-signal.md` | Written 2026-05-31 |
| `docs/architecture/calculations-vs-assumptions.md` | Written 2026-05-31 (NOI bug diagnosis corrected; agent layer framing updated) |

Additionally, seven entries in "Active canonical documents" have "(verify path)" status. Corpus-sweep confirmed most do not exist at stated paths. Actual confirmed paths for surviving docs: `docs/architecture/deal-capsule-blueprint.md` (Deal Capsule), `docs/architecture/property-plumbing-*.md` (Property Plumbing, multiple files — not the single refactor.md/phases.md structure shown above).

---

## §3 — ARCHITECTURAL COMMITMENT STATUS

Tracking each commitment's state: **Operational** (working in production), **In-flight** (active development with merged or in-progress tasks), **Aspirational** (target state, not yet under active development), **Pending decision** (architectural decision required before implementation).

### Commitments from the Vendor Architecture overview

| Commitment | Status | Evidence |
|---|---|---|
| 1 — LayeredValue universal across multi-source fields | Operational with caveats | LayeredValue infrastructure exists; the `agent` resolution layer is undocumented in FIELD_PRIORITIES (pending decision per §4 Item A) |
| 2 — Snapshot-at-ingestion preserves architectural simplicity | Operational | Engine A audit confirmed deliberate pattern |
| 3 — Trajectory math for hold-year fields | In-flight | LTL trajectory pending (Task #1536 → T-B1); GPR partially trajectory-aware via Task #1521; vacancy partially M07-dependent |
| 4 — Cross-surface read consistency | In-flight | T-B1 covers it; current cross-surface inconsistencies inventoried in Deal Details UI/Backend audit §3 |
| 5 — Layer 1 override universally wired | In-flight | 7 fields fully wired, 3 partially, 5 unwired per audit §7 |
| 6 — Deal completeness first-class | In-flight | Task #1574 shipped framework; per-surface coverage incomplete (audit §9) |

### Commitments from the revised calc-vs-assumption doc

| Commitment | Status | Evidence |
|---|---|---|
| LayeredValue mechanism for assumptions AND calculations | Operational | Both classes flow through the chain |
| Required wiring for every agent-authored field (6-point checklist) | In-flight | 7 fields fully wired per audit; checklist used as T-B1 per-field quality gate |
| Conceptual assumption vs calculation distinction preserved as reasoning guidance | Operational | Doc preserves catalog of 22 and 14 (count pending verification) |
| OperatorStance re-blends Layer 2 without new LLM call | Operational | Verified 2026-05-31: `operatorStance.service.ts` background reblend applies modulation to baseline snapshot with no LLM call in the path |

### Commitments from Piece A

| Commitment | Status | Evidence |
|---|---|---|
| Vendor registry generalizes CoStar pattern | Operational | T-A (task-1539) merged; Yardi Matrix abstraction proof (task-1544) merged; zero changes to classifier or CoStar route |
| `historical_observations` as vendor-agnostic substrate | Operational | Confirmed via Replit's correction; no parallel `vendor_market_observations` table |
| License posture enforced at display/export time | Aspirational | Phase 2C of Piece A; not yet implemented |
| Freshness profiles drive UI behavior | Partially operational | Freshness indicators present on some surfaces; not registry-driven |
| Yardi onboarding tests abstraction | Operational | task-1544 merged; `yardi-matrix.vendor.ts` + `yardi-matrix-parser.ts` added; Item C (Yardi data availability) deferred as framing question |
| Deal completeness signals from Piece A integrated | Aspirational | Not yet wired |

### Commitments from Piece B

| Commitment | Status | Evidence |
|---|---|---|
| B.1 — One logical value, one canonical read path | In-flight | T-B1 queued; `getFieldValue` service operational (see below); override-check-first guard already implemented (Item B resolved 2026-05-31) |
| B.2 — Trajectory math for GPR, LTL, other income, vacancy, OpEx | Partially operational | GPR/vacancy/OpEx/Other Income per-year overrides (Task #1521); LTL trajectory pending (#1536) |
| B.3 — Cross-source divergence surfaces as alert | Partially operational | Validation Grid CONTESTED badge shipped (Task #1567); `DivergenceSignature` computed per field by `getFieldValue`; per-field threshold registry operational |
| Material divergence thresholds per field | Partially operational | Per-field threshold defaults in `divergence-thresholds.ts`; operator-configurable thresholds aspirational |
| `getFieldValue()` canonical access point | Operational | Service verified at `backend/src/services/field-access/get-field-value.service.ts`; `COMPUTED_AGGREGATES` (noi, egi, noi_after_reserves) implemented; divergence signature computed at resolution time |
| Layer 1 override universally wired | In-flight | **[inferred from prior audit]** ~7 fields fully wired, ~3 partially wired, ~5 unwired; T-B1 quality gate will re-verify per-field |

### Commitments from Piece C

| Commitment | Status | Evidence |
|---|---|---|
| Agents author findings with citations | Partially operational | Cashflow agent reasons; Opus authors F12 tabs; full FieldSubstrate interface aspirational |
| Deal completeness framework operational | Partially operational | `signal-registry.ts` confirmed operational (2026-05-31 grep); frontend `CompletenesBadge` component exists (Task #1574); full backend→badge API path not directly re-verified in corpus-sweep — treat as **[inferred]**; **[inferred]** 10+ surfaces still silently degrade |
| Operator overrides at all four granularities | Partially operational | Field-level wired for **[inferred]** ~7 fields; citation-level, finding-level, confidence granularities aspirational |
| Module-apply pattern operationalizes field-level overrides | Queued | Tasks #1256–#1261 — pushing module outputs to F9 via `apply-from-module` endpoint writes to Layer 1 override slot; does not depend on T-B1 or vendor infrastructure; can proceed independently |
| License posture flows through to exports | Aspirational | Tied to Piece A Phase 2C |
| Completeness caveats appear in findings | Aspirational | Framework supports; agent authorship not yet using |

### Commitments from Piece D

| Commitment | Status | Evidence |
|---|---|---|
| Divergence ledger captures every material divergence | Aspirational | Deferred until A+B accumulate 3-6 months data |
| Source reliability profiles | Aspirational | Same |
| Anomaly detection | Aspirational | Same |
| Vendor quality intelligence | Aspirational | Same |

---

## §4 — ARCHITECTURAL DECISIONS PENDING

Decisions required before downstream implementation proceeds.

### ~~Item A — `FIELD_PRIORITIES` agent layer resolution~~ — RESOLVED 2026-05-31

**Decision:** Option (a) — formally document the agent layer in the resolution chain.

**Finding:** The `agent` layer is already correctly documented and implemented in `get-field-value.service.ts` (lines 13–18). The read-time resolution chain there lists all four layers: override → formula → agent → storedResolved. `FIELD_PRIORITIES` in `proforma-seeder.service.ts` governs a separate concern — seed-time source selection (which of t12, rent_roll, om, broker to prefer per field). These are intentionally different: the seeder doesn't know about agent-written values; the read service doesn't consult the seeder's priority map.

**Resolution:** No code change needed. A naming conflation in the architectural documentation made this look like an implementation gap. The code is correct.

**Moves to:** §6 Corrections Landed (2026-05-31)

---

### ~~Item B — NOI formula-vs-chain governance~~ — RESOLVED 2026-05-31

**Decision:** Option (a) — override-check-first guard in `getFieldValue` before formula execution.

**Finding:** The guard already exists. Line 512 of `get-field-value.service.ts`:
```typescript
if (aggDef && !usingAlias && override == null) {
```
The formula is skipped entirely when an operator override is present. `resolveLayeredValue` then returns the override as the canonical value. The resolution chain already satisfies Commitment B.1.

**What #1520 actually covers:** The write path — the UI and API endpoint that let an operator SET a NOI override value. The read path works correctly; the override can never be set because there is no UI/API to write to `year1.noi.override`. Task #1520 is about wiring that write path.

**Moves to:** §6 Corrections Landed (2026-05-31)

### Item C — Yardi data availability for T-A1 abstraction test

**Question:** Is Yardi Matrix data actually available to test the vendor abstraction, or is Yardi hypothetical for the near term?

**Why this matters:** T-A1 is queued as "onboard Yardi as the second vendor." If Yardi data isn't available, T-A1 becomes "build the abstraction so a second vendor onboards smoothly when one becomes available" — same code, different framing, different validation criteria.

**Status:** Pending decision (asked but not answered)

**Affects:** T-A1 framing, Piece A's abstraction validation

### Item D — Ghost endpoint dispositions

**Question 1:** `/balance-sheets` — implement handler or remove fetch?

**Question 2:** `/roadmap` + `/timeline` — implement handlers or gate RoadmapTab behind dev-deal type?

**Why this matters:** Two ghost endpoints in Deal Details cause silent 404s. Decisions precede implementation.

**Status:** Pending decision

**Affects:** F5 CapitalHubTab balance sheet strip, F11/F12 RoadmapTab

### Item E — Compute trigger framework scope

**Question:** Should the 38 EMPTY fields from missing triggers be addressed via (a) a unified triggering framework that handles all 38 cases, or (b) per-trigger implementations for the most operator-urgent ones?

**Why this matters:** Pattern 2 in the fix plan briefing — affects 38 fields across JEDI score, market intelligence, risk analysis, module calibration. Single workstream vs distributed work changes timeline and architecture.

**Status:** Pending decision

**Affects:** F1, F8, F10, multiple downstream surfaces

### Item F — Stabilization outcome tracking schema commitment

**Question:** How should the platform record actual stabilization dates per deal once they are known? Three options:
1. Add `stabilization_achieved_date` column to existing `deals` or `deal_assumptions` table
2. New `deal_outcomes` table tracking stabilization date, exit, realized returns, and other post-close intelligence
3. Defer until Phase 1B is closer (currently data-blocked — Phase 1B is blocked on populated `historical_observations` and the query functions to use them)

**Why this matters:** Phase 1B's empirical correlation queries require a stabilization outcome variable — some record of when actual deals actually stabilized and how that compares to underwritten assumptions. Without this, the correlation engine cannot learn from deal history. This is also the foundation for realized-vs-underwritten variance tracking, post-close intelligence, and exit timing analysis — uses that extend well beyond Phase 1B.

**Recommendation:** Option 2 (new `deal_outcomes` table) — outcome tracking has implications beyond stabilization and deserves dedicated schema. A `deal_outcomes` table can grow incrementally (add `stabilization_achieved_date` first, then exit date, realized returns, etc. as the platform matures). But this is an operator decision on whether to commit to outcome tracking as a platform discipline.

**Status:** Pending operator decision — not a blocker for Phase 1A or Phase 1B (Phase 1B is data-blocked on `historical_observations` density regardless of whether this schema exists)

**Affects:** Phase 1B correlation engine queries; post-close intelligence; realized-vs-underwritten variance tracking

**Surfaced by:** Owned/Portfolio + Correlation Engine Map audit (2026-05-31)

---

## §5 — ACTIVE TASK MAP

Tasks currently in flight or queued, mapped to source documents.

| Task | Description | Source document section | Status |
|---|---|---|---|
| #1520 | NOI Layer 1 override wiring | calc-vs-assumption §"Required wiring for agent-authored fields" + audit CF-01 | In progress |
| #1521 | Per-year overrides for GPR/vacancy/OpEx/Other Income | calc-vs-assumption + audit CF-02 | Merged |
| #1522, #1523, #1525 | LP/GP equity split wiring (model side) | Audit CF-06 | Merged |
| #1528 | Engine A + M07 lease-roll audit | Audit prompt | Merged |
| #1536 | LTL per-year override | Piece B §"LTL trajectory math" + audit §10 | Pending acceptance |
| #1537 | Other income display vs projection seed discrepancy | Piece B §"Cross-surface read consistency" | Pending acceptance |
| #1538 | Feed live LTL signal into Engine A Year 1 | Piece B §"LTL trajectory math" | Pending acceptance |
| task-1539 (T-A) | Vendor registry (Piece A foundation) | Piece A §"Vendor registry pattern" + §"Phase 2A" | Merged |
| task-1544 (T-A2) | Yardi Matrix abstraction proof | Piece A §"Phase 2B" | Merged |
| task-1554 | Market Data tab — vendor-aware upload UI | Piece A §"Phase 2D" | Queued, dependent on T-A |
| task-1555 | Surface vendor market data in submarket view | Piece A §"Phase 2E" | Queued, dependent on T-A |
| task-1556 | Market Data pipeline end-to-end integration test | Piece A §"Phase 2F" | Queued, dependent on T-A |
| task-1541 (T-B1) | Cross-surface read consistency + LTL trajectory | Piece B Commitments B.1, B.2 + calc-vs-assumption §"Required wiring" | Queued — blocked on #1536 + #1537 + #1538 |
| task-1542 (T-B2) | Divergence surfacing in Validation Grid | Piece B §"Cross-source divergence surfacing" | Queued, dependent on T-B1 |
| #1567 | Validation Grid CONTESTED badge | Piece B §"Cross-source divergence surfacing" | Merged |
| #1568 | GRM/GIM Valuation methods | Audit §"F7 Valuation Grid" | Merged |
| #1569 | Exit cap + hold period canonical chain in Valuation Grid | Audit cross-surface inventory | Merged |
| #1570 | CoStar vendor badge wiring | Piece A §"License posture" | Merged |
| #1571 | CompletenesBadge vendor freshness signal | Piece C §"Deal completeness framework" | Merged |
| #1573 | Field divergence delta fields | Piece B §"Cross-source divergence surfacing" | Merged |
| #1574 | Deal completeness framework | Piece C §"Deal completeness framework" | Merged |
| #1595 | County comp ingestion | Adjacent — not architectural | Merged |
| #1605 (T-CONF-3) | Backend double-mount cleanup | §7b UI Conflation Patterns | Merged |
| #1606 (T-CONF-2) | Market context dual-surface investigation | §7b UI Conflation Patterns | Merged — finding: false alarm, no dual-surface exists; guard comments added |
| #1607 (T-CONF-1) | F8 verdict relabel + JEDI Score integration | §7b UI Conflation Patterns | Merged |
| #1609 | Market signals into F9 OverviewTab | §7b — queued pending Pattern 2 (compute trigger) gap resolution | Merged |
| #1615 | Corpus-sweep audit | §2 phantom docs + §3 claim verification | Merged |

### Valuation Grid Waves B and C — vendor architecture dependencies

Waves B and C have direct architectural overlap with the vendor market data workstream and are documented here. Waves D–F and F9 module gaps are tracked in task records only (no architectural commitment documentation needed — they don't introduce new patterns).

| Task | Description | Architecture dependency |
|---|---|---|
| #1406 | Wave B — Subject record population pipeline | Piece A substrate (`historical_observations`) |
| #1407 | Wave B — CoStar comp upload + parser | Piece A vendor registry (upload uses registry-driven dispatch) |
| #1408 | Wave B — Comp relevance scoring engine | Piece A + `historical_observations` vendor rows |
| #1409 | Wave C — Strategy-aware comp story + geographic cascade | Piece B divergence framework (comp-vs-platform disagreement) |
| #1410 | Wave C — CoStar ↔ platform comp dedup + reconciliation | Piece B cross-source reconciliation; CONTESTED badge (T-B2) |

**Sequencing note:** Waves B tasks (#1406–#1408) can start after T-A is fully operational (done). Wave C tasks (#1409–#1410) require T-B1 or T-B2 to be complete — comp dedup is field-level reconciliation across two source registries.

### Tasks expected but not yet created

- T-B2 (cross-surface read consistency standalone if not absorbed into T-B1) — clarification pending
- T-B3 (divergence surfacing as named workstream) — not in current queue
- T-C1 (deal completeness framework expansion to additional surfaces) — not in current queue
- Pattern 2 workstream (compute triggers) — not yet scoped
- Pattern 5 workstream (LayeredValue consumer leakage) — not yet scoped
- Pattern 6 workstream (silent degradation per surface) — not yet scoped

### Tasks for UI conflation patterns (drafted 2026-05-31)

- **T-CONF-1 — JEDI Score relabel + F8 verdict integration.** Rename F8's live-derived verdict to a label distinct from "JEDI Score" (e.g., "Deal Verdict" or "Operational Signal" — Replit picks based on what the verdict actually represents). Update F8's verdict logic to consume `jedi_scores.total_score` as primary input when present, falling back to current integrity-checks-and-benchmark-deltas computation when `jedi_scores` is empty. Verdict should refresh when JEDI Score lands or updates. Estimated complexity: 1-2 weeks.
- **T-CONF-2 — Market context dual-surfacing investigation.** Determine whether the market context appearance in F1 (Overview market strip) and F8 (Decision market signal overlay) is intentional dual-surfacing (consolidate framing, distinguish purposes) or accidental duplication (pick canonical surface, remove or reference from the other). Investigation first, fix follows based on finding. Estimated complexity: 30 min investigation + 1-3 days fix.
- **T-CONF-3 — Backend double-mount cleanup.** Remove duplicate mount of `stabilized-potential.routes.ts` (currently mounted twice consecutively at `/api/v1/proforma`) and the duplicate mount of `apartmentLocatorRouter` at its second path. Verify no callers depend on the duplicate paths before removal. Estimated complexity: 1 day.

---

## §6 — CORRECTIONS LANDED

Tracking when documents have been corrected against audit findings or operator clarifications. Append new entries; don't delete old ones.

### 2026-05-30

- **LayeredValue framing corrected** across calc-vs-assumption doc, all four Piece documents. Hierarchy is Layer 1 = operator override / Layer 2 = agent/platform / Layer 3 = broker/document. Prior framing had this inverted.
- **`vendor_market_observations` parallel table removed** from Piece A. Use `historical_observations` with `source` field. Replit caught this in confirmation step.
- **LP/GP wiring stale claim removed** from Piece B. Tasks #1522/#1523/#1525 had already wired model-side LP/GP; doc was stale. (Note: investor-side grid still broken due to unmounted `investor-capital.routes.ts`.)

### 2026-05-31

- **NOI bug diagnosis corrected** in revised calc-vs-assumption doc §"What about the NOI bug specifically." The Deal Details UI/Backend audit revealed both Pro Forma and Valuation Grid show $840K (not different values per surface). The actual bug is `getFieldValues` formula bypassing the resolution chain entirely. The OM-extracted $2.99M sits in `year1.noi.om` unread.
- **Piece B §"Problem Piece B Solves" expanded** from three problems to four. Added Problem 1b (formula bypass of resolution chain) and Problem 4 (`FIELD_PRIORITIES` agent layer undocumented).
- **`FIELD_PRIORITIES` agent layer gap surfaced** as architectural decision in §4 of this reconciliation document and as updated Reconciliation Action in calc-vs-assumption doc.
- **Duplicate SALE COMP TRANSACTIONS panel removed** from RENT COMPS tab in MarketIntelligencePage. `CompsModule` was being rendered both under `case 'sale-comps'` and inside `renderCompsTab()` (the RENT COMPS branch). Fix shipped: component now appears exactly once. Identified during operator-led data verification ("are there no rent comps for 464 Bishop?") which surfaced the duplication as the actual bug rather than missing data.
- **HMR false-positive gotcha captured** in `replit.md` Gotchas section: "Vite HMR collisions during active editing can produce runtime errors that disappear on hard refresh. Before treating any error as production-relevant, let edits settle, hard-refresh the preview, and confirm the error persists."
- **T-CONF-2 false-alarm finding documented:** Neither F1 OverviewTab nor F8 DecisionTab reference `deal_market_intelligence`. The described dual-surface did not exist. Guard doc-block comments added to both files to prevent accidental future duplication. Follow-up task #1609 queued to wire market signals into F9 OverviewTab once the Pattern 2 (compute trigger) gap is resolved.
- **T-CONF-3 double-mounts removed:** `stabilized-potential.routes.ts` duplicate mount at `/api/v1/proforma` removed. `apartmentLocatorRouter` alias mount at `/api/v1/property-discovery/apartment-locator` removed after caller audit confirmed no frontend or backend code uses that path.

### 2026-05-31 (corpus-sweep audit)

- **Corpus current-state audit completed.** Full report at `docs/operations/CORPUS_CURRENT_STATE_AUDIT.md`. Central finding: six primary corpus documents (Pieces A–D, overview.md, calculations-vs-assumptions.md) listed in §2 as "Active canonical documents" do not exist as repo files — they exist only in conversation history. All current-state claims in those documents are INFERRED. Additionally, most of the seven "(verify path)" entries in §2 also do not exist at stated paths.
- **OperatorStance re-blend claim verified.** `operatorStance.service.ts` confirms background reblend applies modulation to baseline snapshot without LLM call. §3 status updated from "Pending verification" to "Operational."
- **Phantom documents table added to §2** listing all six primary corpus docs with "does not exist" status and action item to write them to repo.
- **Claims independently verified by this audit:** `getFieldValue`/`getFieldValues` service, `COMPUTED_AGGREGATES` in service, `correctSnapshotMath` in `cashflow.postprocess.ts`, `LINE_ITEM_CONFIG` in `proFormaMathEngine.ts`, `FIELD_PRIORITIES` in `proforma-seeder.service.ts`, `vendor_source`/`vendor_data_as_of`/`vendor_license_posture` fields in vendor registry files, `yardi-matrix.vendor.ts` and `yardi-matrix-parser.ts` existence, `historical_observations` vendor column migration.

### 2026-05-31 (Items A and B resolved; six corpus documents written)

- **Item A resolved — agent layer already documented.** The read-time resolution chain in `get-field-value.service.ts` correctly documents all four layers (override → formula → agent → storedResolved). `FIELD_PRIORITIES` in `proforma-seeder.service.ts` is a seeder-time concern (source priority: t12, rent_roll, om, broker) and is intentionally separate from the read chain. No code change needed. `FIELD_PRIORITIES` does not need an `agent` entry. §4 Item A closed.
- **Item B resolved — override-check-first guard already implemented.** Line 512 of `get-field-value.service.ts` gates formula computation on `override == null`. When an operator override is present, the formula is skipped and the override wins. The read path is correct. Task #1520 is about the write path (no UI/API exists to SET a NOI override) — not the read resolution. §4 Item B closed.
- **Six corpus documents written to repo.** All six documents previously listed as phantom (Pieces A–D, overview.md, calculations-vs-assumptions.md) written to `docs/architecture/vendor-market-data/` and `docs/architecture/`. §2 phantom table updated. Inferred claims tagged **[inferred]** throughout the documents.
- **T-A and T-A2 status updated to Merged** in §5. task-1539 (vendor registry) and task-1544 (Yardi Matrix abstraction proof) both merged. §5 task refs corrected from #1560/#1561/#1562/#1563 (planned refs) to actual task file numbers.
- **Wave B and Wave C Valuation Grid tasks added to §5** with explicit vendor architecture dependencies. Wave B depends on T-A (done). Wave C depends on T-B1/T-B2.
- **Module-apply pattern (#1256–#1261) added to §3 Piece C commitments** — operationalizes field-level overrides without depending on T-B1 or vendor infrastructure.
- **§3 Piece B `getFieldValue()` status corrected** from Aspirational to Operational — service verified operational in corpus-sweep audit.
- **§3 inferred claims tagged** — override field counts (~7/~3/~5), 38 EMPTY fields, 10+ surfaces silently degrade, backend→badge API path all tagged **[inferred from prior audit]**.
- **#1607 (T-CONF-1) status updated** to Merged in §5.

### 2026-05-31 (Pro Forma Window architecture corrections)

- **Owned portfolio composition corrected in Pro Forma Window documents.** Prior session memory described three owned properties as "Jacksonville 2018+, Atlanta A 2020+, Atlanta B 2022+." Live SQL audit verified actual portfolio is: Frisco TX (4800 Spring Creek Pkwy, manual data, Jul 2024–Dec 2025, 94.7% occ), McKinney TX (1200 Eldorado Pkwy, manual data, Jul 2024–Dec 2025, 94.6% occ), Duluth GA (2789 Satellite Blvd, suburban Gwinnett, Yardi data, Dec 2021–Dec 2022, 95.0% occ). No Jacksonville. No Atlanta Midtown. All three observed at stabilized occupancy. No lease-up trajectory data for any owned property. Corrections 1.1, 1.4, and 2.1 applied to Math Spec and Lifecycle State Machine documents.
- **Correlation engine actual scope corrected in Pro Forma Window documents.** `CorrelationEngineService` (3,488 lines) computes 30 market-intelligence signals (COR-01..30) from `apartment_market_snapshots`, `apartment_trends`, `metric_time_series`. Answers "what is the market doing?" — NOT "when will this deal stabilize?" Stabilization-underwriting correlation queries are a NEW analytical capability, not a refinement of existing engine scope. Phase 1B requires three new query functions AND two independent data infrastructure preconditions (vendor feed scaling, stabilization outcome tracking schema). Corrections 1.3 and 3.1 applied to Math Spec and Data Flow Spec.
- **Phase 1B owned-portfolio framing corrected in Data Flow Spec.** The owned-portfolio → CashFlow Agent path is Phase 0 (already operational via `fetch_owned_asset_actuals` and `fetch_owned_asset_opex_ratios`), not Phase 1B. Phase 1B is specifically about NEW correlation-engine queries against populated `historical_observations`. Correction 3.3 applied.
- **Phase 1A fields verified in Data Flow Spec.** `stabilization_threshold_pct`, `stabilization_year`, `lifecycle_profile` in `deal_assumptions` confirmed shipped in Phase 1A tasks #1640, #1644, #1645. Correction 3.2 applied.
- **Profile detection thresholds labeled as professional judgment in Lifecycle State Machine.** §3.5 note added: thresholds (DISTRESSED < 80%, VALUE-ADD renovation triggers, STABILIZED ≥ 92%) are industry conventions and professional judgment, not platform-empirical. Cannot be validated from current portfolio — all three owned properties observed at stabilized occupancy only. Correction 2.1 applied.
- **`deal_mode` relationship flagged for verification in Lifecycle State Machine.** The STABILIZED/LEASE_UP/REDEVELOPMENT values attributed to `deals.deal_mode` are INFERRED-NOT-VERIFIED. Grep verification of actual values, readers, and writers required before reconciling with the four-profile classifier. Correction 2.2 applied.
- **Market rent and OpEx benchmarking provenance corrected in Math Spec.** Atlanta Midtown market rent is city-level only (34 rows, no Midtown-specific granularity). OpEx benchmarking in 464 Bishop worked example uses Duluth GA (suburban Atlanta) as a regional cross-check, NOT a same-submarket Midtown comparable. Corrections 1.1 and 1.2 applied.
- **Renovation premium fallback corrected in Math Spec.** Archive P50 fallback = 0.80 (from 298 archive rows) — not empirical renovation track record from owned portfolio. No owned property has before/after value-add program data. Correction 1.4 applied.
- **Stabilization-year detection algorithm provenance noted in Math Spec.** Algorithm is wiring on existing agent infrastructure, not a new analytical capability. Correction 1.5 applied.
- **`costar_submarket_stats` flagged INFERRED-NOT-VERIFIED in Surface Map.** Existence, schema, and row count require grep verification before implementing submarket equilibrium context display. Fallback: "Submarket equilibrium: insufficient data." Correction 4.1 applied.
- **Four Pro Forma Window documents updated inline.** Corrections applied as blockquote annotations (`> **Correction N.M (2026-05-31):**`) within the source documents in `attached_assets/`. No source documents were rewritten — corrections are append-style redlines.

### Pending corrections (not yet applied)

- **AI Compute Derivation Audit framing** — the audit instrument was built when calc-vs-assumption used the "agent never writes calculated fields" framing. The instrument's CONVERT verdicts should be re-evaluated against the revised framing. Tracked here; specific revision deferred.
- **PROFORMA_CALCULATION_TEMPLATE.md 22-and-14 count** — referenced in calc-vs-assumption doc but never state-verified. Tracked here; verification deferred until referenced for a specific decision.

---

## §7a — KNOWN DIVERGENCES (DOC VS IMPLEMENTATION)

Active divergences where the documents describe a target state and implementation is different. These exist as known debt, not bugs.

| Divergence | Doc claim | Implementation reality | Resolution path |
|---|---|---|---|
| Layer 1 override universally wired (Piece B Commitment 5) | "Every agent-authored field has override path" | 5 fields have zero wiring; 3 partially wired (audit §7) | T-B1 + Pattern 5 cleanup |
| Cross-surface read consistency (Piece B Commitment 1) | "One logical value, one canonical read path" | NOI formula bypass; Other Income display vs projection seed; multiple cross-surface inconsistencies | T-B1 + decision on Item B |
| FIELD_PRIORITIES documents all resolution layers (calc-vs-assumption Reconciliation Action) | "FIELD_PRIORITIES is the spec" | `agent` layer present in production but absent from spec | Decision Item A |
| Deal completeness framework operational across all surfaces (Piece C) | "Deal completeness is first-class" | Framework shipped; 10+ surfaces still silently degrade | Pattern 6 workstream |
| Compute triggers fire at deal creation (implicit Piece C) | "M07, Research Agent, Risk Agent populate required signals" | 38 EMPTY fields are genuinely missing data because no triggers fire | Pattern 2 workstream + Decision Item E |
| `apartment_submarkets` UUID registry exists (CoStar dispatch context) | "Mapping resolves CoStar submarket → JEDI submarket" | Registry doesn't exist as canonical system | Deferred; flagged in earlier session |
| `deal_monthly_actuals` has writer (implicit) | Read path exists | 24 shell rows; no writer found in codebase | Decide: implement ETL or deprecate overlay |
| Tab-scoped rendering enforced structurally (implicit) | "Components render in their named tabs" | MarketIntelligencePage routes tabs via switch statement on `activeTab`; component placement is convention-only with no type or lint constraint preventing components from landing in the wrong branch. Duplicate sale comps panel (resolved 2026-05-31) was an instance. Similar risk exists in any switch-based tab routing elsewhere in the platform. | Decide: invest in type-safe tab routing (e.g., typed tab registry mapping IDs to render functions with structural enforcement) vs. accept convention-only with audit discipline catching future instances |

---

## §7b — UI CONFLATION PATTERNS

Distinct from §7a's doc-vs-implementation divergences, §7b tracks UI patterns where the same data, label, or concept appears in multiple places in ways that produce operator confusion. These were surfaced by Replit's follow-up to the Deal Details UI/Backend audit (2026-05-31) when asked whether the audit had found duplicate sections.

The taxonomy that emerged from the follow-up:

| Pattern type | Description | Example |
|---|---|---|
| Same data, different framing, intentional | Two surfaces show the same value because operators need it in both contexts | NOI in P&L vs Valuation Grid — both legitimate views |
| Same data, same framing, accidental | Two surfaces independently added a view of the same data with no coordinated purpose | SALE COMP TRANSACTIONS panel appearing in both RENT COMPS tab and SALE COMPS tab |
| Same label, different data, accidental | Two surfaces share a label but show different constructs with no labeling distinction | JEDI Score in F1 vs F8 verdict (different constructs, same label) |
| Same data, correctly framed but consistently wrong | All surfaces of a logical value show the same wrong value because upstream resolution is broken | NOI everywhere shows $840K (formula bypass) |
| Same handler, multiple mount points | Backend route mounted twice at different paths | `stabilized-potential.routes.ts`, `apartmentLocatorRouter` |
| Architectural-intent conflation (false positive) | Described in design docs or prior conversation but neither surface has actually implemented the feature; the conflict exists only in documentation, not in code | Market context F1/F8 — neither OverviewTab nor DecisionTab referenced `deal_market_intelligence`; the dual-surface was planned but never wired |

### Active conflation patterns

| Pattern | Type | Operator impact | Resolution status |
|---|---|---|---|
| JEDI Score F1 vs F8 verdict | Same label, different data, accidental | F1 shows stored `jedi_scores.total_score` (NULL for 464 Bishop); F8 shows live-derived verdict from integrity + benchmark deltas. Same labeling produces operator expectation that they agree. | Resolution committed: rename F8 verdict + integrate JEDI Score as primary input when present, fall back to live derivation when absent. Task #1607 in progress. |
| NOI consistently wrong | Same data, correctly framed but consistently wrong | All NOI surfaces show $840K; cascades to 10+ downstream surfaces. | Covered by Task #1520 + Decision Item B (already tracked in §4 and §7a). |

### Closed conflation patterns

| Pattern | Type | Resolution |
|---|---|---|
| SALE COMP TRANSACTIONS panel in RENT COMPS tab | Same data, same framing, accidental | `CompsModule` was rendering both under `case 'sale-comps'` AND inside `renderCompsTab()` (the RENT COMPS tab's function). Fix shipped 2026-05-31: `CompsModule` now appears exactly once, under `case 'sale-comps'`. See §6 entry for date. |
| Market context F1 vs F8 | Architectural-intent conflation (false positive) | T-CONF-2 investigation (2026-05-31): grepped `deal_market_intelligence`, `marketIntelligence`, and related identifiers in both OverviewTab.tsx and DecisionTab.tsx — zero references in either file. Also confirmed `tabProps` in FinancialEnginePage carries no market intelligence field. Neither surface had implemented the feature; the described dual-surface existed only in architectural description. Guard doc-block comments added to both files. Task #1609 queued to wire market signals when Pattern 2 (compute trigger) gap is resolved. |
| Backend double-mounts | Same handler, multiple mount points | T-CONF-3 (2026-05-31): removed duplicate `stabilized-potential.routes.ts` mount and alias `apartmentLocatorRouter` mount. Caller audit confirmed no callers depended on removed paths. |

### Verification protocol lessons

**Lesson 1 — Reframe the audit question.** The Deal Details UI/Backend audit asked specifically about "literal duplicate sections" and correctly reported finding none. The deeper conflation patterns surfaced only when Replit was prompted again with a broader framing. Rather than "are there duplicate X," ask "where does the same Y appear in multiple places, and what's the purpose of each appearance?" The reframed question produces a taxonomy that catches conflation patterns the literal-duplication question misses. Worth folding this into the verification protocol doc when next revised.

**Lesson 2 — State-verify by data source, not by surface name.** T-CONF-2 (market context F1/F8) was initially treated as a "Same data, same framing, accidental" candidate based on architectural descriptions and prior conversation context. The investigation resolved it as a false positive by grepping for the actual data source identifier (`deal_market_intelligence`) in both component files and checking `tabProps` in the parent component. Zero references found in either file.

The discipline: **a surface with a plausible-sounding name is not evidence that a data source is wired**. Before classifying a pattern as "real conflation," confirm that each suspected surface actually references the claimed data source (table, endpoint, or store field) in code. If neither does, the conflict is in documentation or prior conversation — not in the running system. This prevents investigation effort from being spent on features that were planned but never implemented.

The distinction between real conflation and architectural-intent conflation cannot be made from component names, section headings, or design docs alone. It requires a grep.

---

## §8 — UPDATE PROTOCOL

How this document stays current.

**When to update §2 (Document Index):**
- New architectural document created → add row
- Document moved or renamed → update location
- Document marked stale or retired → annotate

**When to update §3 (Architectural Commitment Status):**
- Task completes that materially advances a commitment → update status
- Audit reveals commitment is partially or fully unimplemented → update with evidence
- Architectural decision retires or replaces a commitment → annotate

**When to update §4 (Decisions Pending):**
- New architectural decision required → add item
- Decision made → move to §6 Corrections Landed with decision summary; remove from §4

**When to update §5 (Active Task Map):**
- New task created against an architectural document → add row
- Task merges → update status
- Task is canceled or absorbed into another task → annotate

**When to update §6 (Corrections Landed):**
- Document is corrected against audit finding or operator clarification → append entry with date
- Never delete prior entries — they're the change history

**When to update §7a (Known Divergences):**
- Audit surfaces a doc-vs-implementation gap → add row
- Divergence is closed by work landing → remove row (move closure note to §6)

**When to update §7b (UI Conflation Patterns):**
- Audit or operator observation surfaces a conflation pattern → add row with type classification
- Pattern resolved by work landing → remove row (move closure note to §6)
- New taxonomy type discovered → extend the taxonomy table

**Cadence:**
- Append to §6 immediately when corrections happen
- Update §3, §5 at weekly check-in cadence
- Full review (all sections) at end of each major workstream (Piece A complete, Piece B complete, etc.)

---

## §9 — WHAT THIS DOCUMENT IS NOT

To be explicit:

- **Not a roadmap.** Roadmap-level sequencing is in the master plan + Replit's task queue. This document tracks state, not plans.
- **Not a status report.** Status reports are episodic communications. This is a continuously-updated artifact.
- **Not authoritative over the source documents.** When this document says "Commitment X is operational," the source document is still authoritative on what Commitment X means; this document just tracks status.
- **Not a substitute for the architectural documents.** Pieces A-D and the calc-vs-assumption doc are the architecture; this document just tracks where each commitment stands and where the documents need updating.

---

## §10 — META — HOW WE GOT HERE

For continuity if this document is read by a future session without the conversation context:

The architectural corpus accumulated across multiple sessions in 2026. Six documents established the Vendor Market Data Architecture (overview + four pieces) plus a revised calc-vs-assumption doc. Multiple audits (property plumbing, Deal Details data, Engine A + M07 lease-roll, Deal Details UI/Backend) ran against the corpus and surfaced both confirmations and corrections. The session that produced this reconciliation document was the third in a row where a correction landed against the corpus (LayeredValue framing → vendor_market_observations parallel table → NOI bug diagnosis); building this document was the operator's response to the pattern.

The corpus represents Leon's mental model of the platform translated into specifications Replit can implement against. Replit's audit discipline catches gaps reliably; the corpus stays grounded through that audit/correction cycle. This document is the artifact that makes the cycle visible and trackable rather than distributed across conversation history.

Per CLAUDE.md P8: every claim in this document is meant to be verifiable against either a source architectural document, a task record, or live code. If verification reveals a divergence, that's a §6 entry to append, not a §9 entry to remove.
