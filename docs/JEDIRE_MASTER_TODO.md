# JEDIRE — MASTER TO-DO / BRANCH TRACKER
*Assembled from this session. Organized by DB-requirement (your ask) and by branch.*

Legend: 🔴 blocks/urgent · 🟡 queued · 🟢 spec-only/parked · [DB] needs live database+backend · [NO-DB] code/design/desk only

---

## A. NEEDS DATABASE + LIVE BACKEND (run in a DB-connected Replit session)

### Security / correctness (do first)
- 🔴 **[DB] CoStar firewall — I2/I4 clarifications** (close the security arc clean): confirm `skill_chat_messages` can't receive CoStar-derived capsule values; confirm I4 calibration exclusion is an *explicit filter* not empty-table coincidence; confirm restricted tables (`costar_market_metrics`, `metric_time_series`, `historical_observations`, logs) are empty platform-wide → dissolves the purge question.
- 🔴 **[DB] Supply-stub honesty fix**: `supplySignalService.getSupplyPipeline` returns fabricated `existingUnits:10000 / pipeline:0` when no data → make it honest-absence (`dataAvailable:false`). Same for `fetch_costar_metrics` empty-`{}`-reads-as-success. *Correctness/trust bug — a fabricated underwriting signal.*

### Verification that unblocks big arcs
- ✅ **[DB] F-P1 confidence window — CLOSED** (10/10 clean shadow-read, 2026-07-08; deterministic hash, 0 alarms; writer-path + trigger retirement auto-fired). **F-P1 now FULLY closed.**
- 🟡 **[DB] D3-W2+ agent seam** (UNBLOCKED — window closed; CREATE-1 done ✅). Source: `DISPATCH_D3_PHASE2_GO.md` (full R1–R8 rulings) + `DISPATCH_D3_W2_RESUME.md` (gate-confirmation). **W-item breakdown (matches bot's list):**
  - ✅ **W1 · R1** agent_confirmed layer — DONE + ratified (commit `44e1d0338`).
  - 🔴 **W1-ID** — per-deal identity checkpoint (Bishop + Highlands: resolution byte-identical pre/post-W1, PASTED). *Owed since W1 — described but never shown per-deal. Cheap now window's open. Do with Tier-1 DB session.*
  - 🟡 **W2 · R7** — `update_assumption` reroute through overlay seam.
  - 🟡 **W3 · R2+R4** — provenance schema (reasoning/evidence_refs) + escalation surface.
  - 🟡 **W4 · R6** — broker-claim flag via overlay seam (post-W3).
  - 🟡 **W5 · R3** — hash-stamping per overlay row (post-W3).
  - ⏸️ **W6** — evidence-citing items (F5-GATED — waits on F5 Finding-V fix).
  - ⏸️ **W7** — tax reconciliation (F-P1t state check: (a) in F-P1t if landed, else (b) Inngest cron interim).
  - **Two design additions required before W2 coding (from window-close findings):** (1) overlay-prune retention ruling — superseded rows grow ~143/build; they're the attribution/undo trail, so DON'T auto-prune — retain most-recent-superseded-per-field, tail-prune only; (2) no-active-scenario write contract — Highlands + fresh CREATE-1 deals have no active scenario; define whether agent write creates a default scenario or writes deal-level overlay.

### New audits you asked to open
- 🟡 **[DB] Capsule Gap-Fill Path audit** (read-only): does an uploaded value (OM/rent-roll/T-12/CoStar) actually land in the mapped empty `deal_assumptions`/`deal_monthly_actuals` field, deal-scoped, provenance-tagged, survive the firewall's new `dealId` gate, and become readable by agents + model? *Answers "can users fill their own gaps with their own uploads." The payoff-path check.*

### UI — surfacing passes (TS-chain)
- 🟡 **[DB] TS-2 floor badge + occupancy row** (BUILDABLE NOW — was blocked, now unblocked): T2 floor badge + T3 occupancy grid row per `TS1_THIN_SURFACING_PASS.md`. *Unblocked by F-P1's 7-field `monthlyProjection` serialization; floor-badge bug ALREADY FIXED in F-P1 verification (V1: `annualFloor[]` per-year replaced aggregate `mp.some()`).* Render-only, frontend-only diff. Puts the 2nd/3rd visible engine pieces on screen. *Fell through the queue after the CoStar emergency — ready to re-dispatch.*

### Data-source work (from provisioning audit)
- 🟡 **[DB] FREE-WINS wiring**: repoint dead Supply routes (`fetch_permits`/`fetch_submarket_deliveries` 404 → working `historical-deliveries` endpoint); wire ArcGIS county expansion, FL municipal comps, SEC EDGAR, Treasury/Yahoo. *Free capsule-fill, high value.*
- 🟡 **[DB] Zoning agent fix** (source-routing, NOT schema-patching): per expected field, route to platform-ruleset vs API (Municode/GIS) vs agent-interpreted; LLM must not fabricate zoning facts that should be looked up; honest-absence where API dry. Fix the Tavily empty-error logging too.
- 🟡 **[DB] T2 forced cache-hit close** (DeepSeek now funded): identical prompt ×2, second shows cache_read_tokens, cost matches hand-math. *9 sessions open, cheap now.*
- 🟢 **[DB] Other-agents health**: Zoning schema-validation, the broader agent-run failures — own dispatch after Zoning.

### CREATE-1 follow-through
- 🟢 **[DB] Sentosa Epperson classification check**: auto-classified `platform_underwritten` but HAS T12 actuals — contradicts doctrine. Verify the classifier rule didn't misfire (may recur on future creates).
- 🟢 **[DB] 29 NULL origin_class deals**: operator ruling on the unclassifiable Feb-portfolio/test set (or leave NULL — harmless until read).

---

## B. NO DATABASE NEEDED (code-review, design, or your desk)

### Specs to build (written, awaiting build slot)
- 🟢 **[NO-DB] OM Extraction build** (spec done: `SPEC_OM_EXTRACTION.md`): classify→locate→extract, page-provenance, structural broker_claims routing. Real build arc.
- 🟢 **[NO-DB] Multi-Year History Capture build** (spec done: `SPEC_MULTIYEAR_HISTORY_CAPTURE.md`): BPI series fix + OM appendix → month-keyed `deal_monthly_actuals`; silent-drop guard.

### Roadmap arcs (design-first, not yet scheduled)
- 🟢 **[NO-DB] Exit-basis + exit-cap engine work** (ruled, lives in F-P1/disposition): `exit_valuation_basis: forward_12 | trailing_12` as LayeredValue (default forward_12); disposition computes BOTH from the monthly series, pins chosen, RETURNS shows both sale prices side-by-side; exit cap four-door sourcing + optional entry-to-exit spread. *Ruled this session; schema in F-P1, display in F-P2/RETURNS — track so it doesn't vanish inside those arcs.*
- 🟢 **[NO-DB] Debt-event machinery** (named capability, wake: F-P3 or first restructure/exit deal): loan ASSUMPTION (below-market in-place debt as asset; assumable-NPV module), mid-hold REFI events, RESTRUCTURE/recast (distressed entry, pairs with NOTE PURCHASE overlay), EXIT PAYOFF (prepay penalties, yield maintenance/defeasance, assumption-transfer). *Answers your "loans-in-place-need-restructuring" + "exiting deals" questions. One machinery, feeds both.*
- 🟢 **[NO-DB] Tax verification duties** (ruled into D3, easy to lose in the bundle): (a) deterministic — engine tax vs county bill (ATTOM/GIS) auto-flag, no LLM; (b) CashFlow agent — investigates flag, OM-tax-vs-post-reassessment check, proposes correction via seam or flags broker_claims. *In D3-W7; surfaced here so it's visible.*
- 🟢 **[NO-DB] F-P1t tax trigger model**: piecewise law (R6b) — trend every inter-event segment, triggers (sale/CO/cycle) reset basis. Queued after F-P1 fully closes.
- 🟢 **[NO-DB] D3-W6/W7 design**: evidence_refs integrity (F5-gated), tax reconciliation (a-in-F-P1t / b-Inngest interim).
- 🟢 **[NO-DB] F-P2 chassis migration** (the BIG UI arc — parked behind D3, correctly): 11 tabs → CHART/PRO FORMA/ASSUMPTIONS/RETURNS + dynamic; rehoming ledger + catch-all clause (survival period, orphaned-consumer check); persistent Opus underwriting console; dual RESOLUTION/BRIDGE view; product-type physics selector (composition spec v1.1). *This is the real UI transformation — wakes after D3.*
- 🟢 **[NO-DB] EXPORT-1 institutional Excel** / **SHARE-1 capsule sharing**: parked, wake near F-P2. Aesthetics-gated on your review.
- 🟢 **[NO-DB] DEV-1 3D module** (pascalorg/editor candidate): viewer-first, wake on first ground-up deal.

### YOUR DESK (operator decisions / actions — no agent can do these)
- 🔴 **[YOU] Data-source PROVISION decision**: ATTOM subscription for FL/Atlanta/Dallas (unlocks Tier-2 tax/parcel). Hold RentCast/CompStak until their NOT-WIRED code is built.
- 🔴 **[YOU] CoStar historical-purge question** (legal/counsel): future-blocking is done; does already-pooled data need purging? *Likely moot if tables were empty — confirm via I2/I4 first.*
- 🟡 **[YOU] F5 handoff to external agent**: 6 items (effective-assumptions hypothesis, Q/R/S/U, Finding-V evidence dupes). Gates Bishop re-pin + parity list + D3-W6.
- 🟡 **[YOU] Excel parity oracle values**: fill the regenerated PROVISIONAL list against your workbook (post-Bishop-re-pin). The engine's only external validation.
- 🟢 **[YOU] ATTOM mortgage/deed entitlement check**: gates distress census.
- 🟢 **[YOU] Shaping addendum §5 numbering + DealShapeProposal vintage ruling**: gates master-spec-index entry.
- 🟢 **[YOU] Workflow-health monitoring decision**: Inngest was down unnoticed; vendor-pipeline shows false-failed. Nothing watches workflow health — instrument it? *Cheap now, expensive to discover later.*

### Standing infra notes (recurring, worth a permanent fix)
- 🟡 **[YOU/infra] DB access in task-agent sandbox**: recurring "no DB in sandbox" stalls — ask Replit about exposing read-only `DATABASE_URL` to task agents.
- 🟢 **[infra] git lock gremlin**: `.git/*.lock` cleared manually ~6× this session — add `find .git -name '*.lock' -mmin +5 -delete` to session-start hygiene.
- 🟢 **[infra] workflow-scope PAT**: keep the `workflow`-scoped token in Secrets for pushes touching `.github/workflows/`.

---

## C. CLOSED THIS SESSION (done, for reference)
W5 engine arc (Findings A–U + throw) · F-P1 store consolidation (closed-pending-window) incl. **multi-user attribution B5** (`edited_by`/`edited_at`, last-write-wins) and **exit-basis/trending schema** · TS-1 T1 pills (live on Bishop ProForma) · D3-W1 (agent_confirmed layer) · QW-1 (capstruct mock) · QW-2 (origin_class) · CREATE-1 (materialization + credit-gate + collision fix) · CoStar firewall I1/I3 (leak closed, preventive) · provisioning audit · capsule-fill-lane audit.

---

## D. SOURCE-FILE INDEX (to-do item → its MD dispatch/spec)
*Dispatches/specs in archive `JEDIRE_ALL_DISPATCHES_2026-07-08.tar.gz`. UI design corpus is in the repo project files (Section E).*
| Item | Source MD |
|------|-----------|
| D3 rulings (R1–R8) + W1–W7 | `DISPATCH_D3_PHASE2_GO.md`, `DISPATCH_D3_W2_RESUME.md` |
| D3 audit (seam map) | `DISPATCH_D3_PHASE1_AUDIT.md` |
| CoStar firewall (I1–I4) | `DISPATCH_COSTAR_FIREWALL_ENFORCEMENT.md` |
| Capsule gap-fill audit | `DISPATCH_CAPSULE_FILL_LANE_AUDIT.md` |
| Data-source provisioning | `DISPATCH_DATA_SOURCE_PROVISIONING_AUDIT.md` |
| Pipeline remediation index | `MASTER_SEQUENCE_PIPELINE_REMEDIATION.md` |
| QW-1/QW-2/CREATE-1 | `DISPATCH_QW1_*`, `DISPATCH_QW2_*`, `DISPATCH_CREATE1_*` |
| TS-1/TS-2 | `DISPATCH_TS1_EXECUTION.md`, `TS1_THIN_SURFACING_PASS.md` |
| OM extraction build | `SPEC_OM_EXTRACTION.md` |
| Multi-year history build | `SPEC_MULTIYEAR_HISTORY_CAPTURE.md` |
| Composition / product-type | `PROFORMA_COMPOSITION_MODEL_SPEC.md` |
| Underwriter model (D3/tax roots) | `F9_UNDERWRITER_MODEL_SPEC.md` |
| Roadmap (repo canonical) | `POST_D2_PROGRAM_ROADMAP.md` |

---

## E. UI DESIGN CORPUS (reference for TIER-5 F-P2 — read these before design sign-off)
*The design layer that predates the engine work PLUS the session-native F-P2 designs. When F-P2 wakes, these are the vision inputs Claude synthesizes into final specs.*

### E-1. SESSION-NATIVE F-P2 DESIGNS (newest — made in this chat, live in the transcript; Claude regenerates on request)
| Artifact | What it defines |
|----------|-----------------|
| **Factory chassis mockup** (1200 Westshore distressed deal) | The full F-P2 reference frame: CHART · PRO FORMA · ASSUMPTIONS · RETURNS chassis tabs + summoned FLIP/NOTE-PURCHASE (·S) + SHAPE tabs; 15-yr ribbon with actual/gap/projection zones + M35 pins; assumptions panel with provenance chips (agent·COR-14 violet, traffic teal, you neutral, T1-unverified amber); AGENT PROPOSES queue with activate/dismiss; 3/6 working-set counter; "the situation itself built the model." |
| **PRO FORMA interior mockup** | The underwriter's working document: Current-T12 → Stabilized bridge with Δ column; per-line source badges (doc-verified green / agent·peer-set violet / broker-claim ⚠ red); inline LENDER RECOVERY module summoned by negative_dscr; SOLVE PRICE footer (max @ target IRR, binding constraint named, ±band honest about unverified inputs, 4 anchors). |
| **Ratified interior definitions** (from the mockup discussion) | CHART = ribbon + GRID (the PeriodicGrid IS the projections view); PRO FORMA = **dual view: RESOLUTION** (the existing Broker/T-12/Platform/Resolved columns — preserved intact) **+ BRIDGE** (current→stabilized); RETURNS = yearly table + IRR-by-exit sawtooth + sensitivity + waterfall + debt-schedule section; S&U = PRO FORMA section; **OVERVIEW decomposes into headers; Opus panel PROMOTED to persistent underwriting console** with free-vs-billable command signaling. "Four tabs, ever, plus what the deal summons." |

### E-2. PRE-EXISTING DESIGN LAYER (repo project files)
| Design artifact | What it defines |
|-----------------|-----------------|
| `FEATURE_EXPANSION.md` | The F-key feature map — every designed-but-unbuilt feature → its Portfolio(F1–9)/Deal(F1–12) home, backend readiness, effort, priority (Waves 1–4). The master UI build-order doc. |
| `jedi_re_wireframe_blueprint.jsx` | Core design principle (WHAT/WHY/WHAT-should-I-do; Raw→Signal→Verdict→Action) + per-module enhanced-state specs (JEDI Score hero, collision analysis, etc.). |
| `jedi-bloomberg-integrated.jsx` | The Bloomberg-terminal integrated layout (F-key nav, dark aesthetic, T-token system). |
| `jedi_re_wireframe_blueprint.jsx` + `jedi_re_ui_audit.jsx` | Current-vs-enhanced audit per page; what's mock vs wired. |
| `jedi_re_audit_vs_progress.jsx` | Design-vs-implementation progress tracker (which designs are prototype/mapped/spec-only). |
| `exit_timing_dashboard.jsx` | Exit-timing UI (ties to exit-basis + debt-event work). |
| `traffic-fusion-v2.jsx`, `competitive-intelligence-opportunity-engine.jsx`, `ci-engine-frontend-integration-map.jsx`, `correlation-metrics-engine.jsx` | CI-engine / traffic / correlation frontend designs. |
| `jedi_re_palantir_map.jsx` | Map-layer intelligence design. |
| `PROFORMA_COMPOSITION_MODEL_SPEC.md` | Product-type physics × strategy × situation composition (the ProForma factory — drives F-P2's dynamic tabs). |
| `PROFORMA_TIMELINE_MODEL_SPEC.md`, `Event_Visualization_Placement_Spec.md` | Periodic timeline + event-viz placement (the ribbon UI). |

**F-P2 design-gate process (binding):** when F-P2 wakes → Claude synthesizes this corpus + the composition spec + the rehoming ledger into ONE final design spec → Leon reviews/signs off → THEN implementation. No building from the raw corpus directly; no executor drift.

---

## EXECUTION SEQUENCE (recommended, 2026-07-08)
*Principle: legal exposure > data-integrity bugs > feature progress > polish. Ordered by cost-of-leaving-broken.*

**TIER 1 — close what's actively wrong (one short DB session, do first):**
1. 🔴 [DB] CoStar I2/I4 clarifications + empty-table confirm → security arc clean-verified.
2. 🔴 [DB] Supply-stub honesty fix → kill the fabricated `10000/0` signal.
*After Tier 1: nothing in the platform is actively lying or leaking.*

**TIER 2 — highest-leverage feature progress:**
3. 🟡 [DB] D3-W2/W3 (UNBLOCKED — F-P1 window closed 2026-07-08). *Needs 2 design additions first (see D3 line).* The payoff arc: agent authors through the seam.

**TIER 3 — capability + data (nothing breaks while waiting):**
4. 🟡 [DB] Capsule Gap-Fill audit (read-only) — run BEFORE OM/history builds; tells you what's wired.
5. 🟡 [DB] FREE-WINS wiring.
6. 🟡 [DB] Zoning (source-routing) · T2 cache-hit close.

**TIER 4 — spec builds (depend on Tier 3 findings):** OM Extraction · Multi-Year History.

**TIER 5 — UI, LAST (all gated: refer to Claude for final design specs BEFORE any implementation):**
7. 🟡 [DB] **TS-2** floor badge + occupancy row — small render-only surfacing (design-light, but still confirm with Claude first).
8. 🟢 **F-P2 chassis migration** — the real UI arc (11→4 tabs + dynamic, Opus console, dual views, rehoming ledger). **HARD DESIGN GATE: Leon + Claude sign off on full design specs before a single line is built.** F-P2 is where an executor can drift furthest from the vision — spec-first, no exceptions. Design corpus in Section E.
*Rationale for UI-last: the engine/data/agent layers must be true before surfacing them — a beautiful UI over wrong numbers is worse than no UI. Everything below the glass gets correct first.*

**YOUR DESK (parallel to everything):** F5 handoff (highest-leverage desk item — gates Bishop re-pin + parity + D3-W6) · ATTOM provision · CoStar legal-purge Q (likely moot post-I2/I4).

**Background:** ~~F-P1 window~~ ✅ CLOSED 10/10.
