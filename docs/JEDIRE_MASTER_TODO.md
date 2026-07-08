# JEDIRE — MASTER TO-DO / BRANCH TRACKER
*Assembled from this session. Organized by DB-requirement (your ask) and by branch.*

Legend: 🔴 blocks/urgent · 🟡 queued · 🟢 spec-only/parked · [DB] needs live database+backend · [NO-DB] code/design/desk only

---

## A. NEEDS DATABASE + LIVE BACKEND (run in a DB-connected Replit session)

### Security / correctness (do first)
- 🔴 **[DB] CoStar firewall — I2/I4 clarifications** (close the security arc clean): confirm `skill_chat_messages` can't receive CoStar-derived capsule values; confirm I4 calibration exclusion is an *explicit filter* not empty-table coincidence; confirm restricted tables (`costar_market_metrics`, `metric_time_series`, `historical_observations`, logs) are empty platform-wide → dissolves the purge question.
- 🔴 **[DB] Supply-stub honesty fix**: `supplySignalService.getSupplyPipeline` returns fabricated `existingUnits:10000 / pipeline:0` when no data → make it honest-absence (`dataAvailable:false`). Same for `fetch_costar_metrics` empty-`{}`-reads-as-success. *Correctness/trust bug — a fabricated underwriting signal.*

### Verification that unblocks big arcs
- 🔴 **[DB] F-P1 confidence window**: rebuild Bishop/Highlands toward build-10 (or 7 days from 2026-07-08), shadow-read alarm-free → auto-fires writer-path + trigger retirement → **unblocks D3-W2**. *Mostly passive — just run builds in normal use.*
- 🟡 **[DB] D3-W2+ agent seam** (GATED: F-P1 window clear AND CREATE-1 done ✅): reroute `update_assumption` through overlay seam, provenance schema (reasoning/evidence_refs), escalation surface, broker-flag, hash-stamp. F5-gated sub-items wait on F5. `DISPATCH_D3_W2_RESUME.md`.

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

## SUGGESTED NEXT 3 (priority order)
1. 🔴 [DB] CoStar I2/I4 clarifications + empty-table confirm → *close security clean, dissolve purge question.*
2. 🔴 [DB] Supply-stub honesty fix → *kill the fabricated signal.*
3. 🟡 [DB] Capsule Gap-Fill Path audit → *answer the "users fill their own gaps" question you just raised.*
(Meanwhile, passively: rebuild Bishop/Highlands to tick the F-P1 window toward D3-W2.)
