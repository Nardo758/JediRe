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
| OperatorStance re-blends Layer 2 without new LLM call | Pending verification | Behavior described but not state-verified against code |

### Commitments from Piece A

| Commitment | Status | Evidence |
|---|---|---|
| Vendor registry generalizes CoStar pattern | In-flight | T-A active (Task #1560) |
| `historical_observations` as vendor-agnostic substrate | Operational | Confirmed via Replit's correction; no parallel `vendor_market_observations` table |
| License posture enforced at display/export time | Aspirational | Phase 2C of Piece A; not yet implemented |
| Freshness profiles drive UI behavior | Partially operational | Freshness indicators present on some surfaces; not registry-driven |
| Yardi onboarding tests abstraction | Pending (Task #1561 queued) | Question: is Yardi data actually available for testing? |
| Deal completeness signals from Piece A integrated | Aspirational | Not yet wired |

### Commitments from Piece B

| Commitment | Status | Evidence |
|---|---|---|
| B.1 — One logical value, one canonical read path | In-flight | T-B1 in plan; NOI formula bypass identified as deeper bug than initially framed |
| B.2 — Trajectory math for GPR, LTL, other income, vacancy, OpEx | Partially operational | GPR/vacancy/OpEx/Other Income per-year overrides (Task #1521); LTL trajectory pending |
| B.3 — Cross-source divergence surfaces as alert | Partially operational | Validation Grid CONTESTED badge shipped (Task #1567); fuller divergence framework aspirational |
| Material divergence thresholds per field | Aspirational | Framework described; defaults not yet configurable per field |
| `getFieldValue()` canonical access point | Aspirational | T-B1 plan references; not yet implemented |
| Formula-bypass cases identified beyond NOI | Pending audit | EGI likely; other computed fields uninventoried |

### Commitments from Piece C

| Commitment | Status | Evidence |
|---|---|---|
| Agents author findings with citations | Partially operational | Cashflow agent reasons; Opus authors F12 tabs; full FieldSubstrate interface aspirational |
| Deal completeness framework operational | Partially operational | Framework + CompletenesBadge shipped (Task #1574); 10+ surfaces still silently degrade |
| Operator overrides at all four granularities | Partially operational | Field-level wired for 7 fields; citation-level, finding-level, confidence aspirational |
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

### Item A — `FIELD_PRIORITIES` agent layer resolution

**Question:** Should the `agent` resolution layer be (a) formally added to `FIELD_PRIORITIES` with explicit priority position, or (b) refactored so the agent writes to a documented layer?

**Why this matters:** Currently undocumented in the spec but selected by production resolution. The audit calls this "undocumented and fragile." Every Piece B and Piece C claim about Layer 1/2/3 priority is built on an unstable spec until this resolves.

**Status:** Pending decision

**Affects:** Pieces B and C, calc-vs-assumption doc's §"Reconciliation Action"

### Item B — NOI formula-vs-chain governance

**Question:** Should `getFieldValues` (a) teach the formula to respect higher-confidence layers, or (b) consult stored layers first and use the formula only as fallback?

**Why this matters:** Determines whether Task #1520 fixes the override path only or also fixes the formula bypass. If only the override is wired, the formula still wins and the override has no visible effect.

**Status:** Pending decision

**Affects:** Task #1520, all surfaces downstream of NOI (10+ surfaces per audit §11)

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
| #1560 (T-A) | Vendor registry (Piece A foundation) | Piece A §"Vendor registry pattern" + §"Phase 2A" | Active |
| #1561 (T-A1) | Yardi Matrix onboarding | Piece A §"Phase 2B" | Queued, dependent on #1560 |
| #1562 (T-A2) | License posture + freshness | Piece A §"License posture enforcement" + §"Phase 2C" | Queued, dependent on #1560 |
| #1563 (T-B1) | Cross-surface read consistency + LTL trajectory | Piece B Commitments B.1, B.2 + calc-vs-assumption §"Required wiring" | Queued, dependent on #1536/#1537/#1538 |
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
| #1607 (T-CONF-1) | F8 verdict relabel + JEDI Score integration | §7b UI Conflation Patterns | In progress |

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
| Same data, same framing, accidental | Two surfaces independently added a view of the same data with no coordinated purpose | Market context in F1 and F8 (intent unclear, under investigation) |
| Same label, different data, accidental | Two surfaces share a label but show different constructs with no labeling distinction | JEDI Score in F1 vs F8 verdict (different constructs, same label) |
| Same data, correctly framed but consistently wrong | All surfaces of a logical value show the same wrong value because upstream resolution is broken | NOI everywhere shows $840K (formula bypass) |
| Same handler, multiple mount points | Backend route mounted twice at different paths | `stabilized-potential.routes.ts`, `apartmentLocatorRouter` |

### Active conflation patterns

| Pattern | Type | Operator impact | Resolution status |
|---|---|---|---|
| JEDI Score F1 vs F8 verdict | Same label, different data, accidental | F1 shows stored `jedi_scores.total_score` (NULL for 464 Bishop); F8 shows live-derived verdict from integrity + benchmark deltas. Same labeling produces operator expectation that they agree. | Resolution committed: rename F8 verdict + integrate JEDI Score as primary input when present, fall back to live derivation when absent. Task #1607 in progress. |
| NOI consistently wrong | Same data, correctly framed but consistently wrong | All NOI surfaces show $840K; cascades to 10+ downstream surfaces. | Covered by Task #1520 + Decision Item B (already tracked in §4 and §7a). |

### Closed conflation patterns

| Pattern | Type | Resolution |
|---|---|---|
| SALE COMP TRANSACTIONS panel in RENT COMPS tab | Same data, same framing, accidental | `CompsModule` was rendering both under `case 'sale-comps'` AND inside `renderCompsTab()` (the RENT COMPS tab's function). Fix shipped 2026-05-31: `CompsModule` now appears exactly once, under `case 'sale-comps'`. See §6 entry for date. |
| Market context F1 vs F8 | Same data, same framing — intent unclear | T-CONF-2 investigation (2026-05-31) found neither F1 OverviewTab nor F8 DecisionTab reference `deal_market_intelligence`. False alarm: the described dual-surface did not exist. Guard doc-block comments added to both files. Task #1609 queued to wire market signals when Pattern 2 (compute trigger) gap is resolved. |
| Backend double-mounts | Same handler, multiple mount points | T-CONF-3 (2026-05-31): removed duplicate `stabilized-potential.routes.ts` mount and alias `apartmentLocatorRouter` mount. Caller audit confirmed no callers depended on removed paths. |

### Verification protocol lesson

The Deal Details UI/Backend audit asked specifically about "literal duplicate sections" and correctly reported finding none. The deeper conflation patterns surfaced only when Replit was prompted again with a broader framing.

The lesson for future audit prompts: rather than "are there duplicate X," ask "where does the same Y appear in multiple places, and what's the purpose of each appearance?" The reframed question produces a taxonomy that catches conflation patterns the literal-duplication question misses. Worth folding this into the verification protocol doc when next revised.

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
