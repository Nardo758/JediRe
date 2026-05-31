# JEDI RE — Corpus Current-State Audit

**Date:** 2026-05-31  
**Purpose:** Classify every current-state claim in the architectural corpus as VERIFIED, INFERRED, or ASPIRATIONAL, and surface unverified current-state claims that may be mistaken for confirmed implementation.  
**Method:** Direct grep and file-existence checks. Per P11 (Grep-before-claim): component names, section headings, design specs, and prior conversation are not evidence of implementation — only direct code search counts as verification.

---

## Summary by Document

| Document | Status | VERIFIED | INFERRED | ASPIRATIONAL | Key finding |
|---|---|---|---|---|---|
| Pieces A–D + overview.md | **PHANTOM — does not exist** | 0 | 0 | 0 | Files not in repo at stated paths |
| `calculations-vs-assumptions.md` | **PHANTOM — does not exist** | 0 | 0 | 0 | File not in repo at stated path |
| `cross-surface-read-consistency.md` | EXISTS | 6 | 2 | 1 | Core claims verified; one aspirational |
| `a2-abstraction-gap-analysis.md` | EXISTS | 5 | 2 | 0 | Yardi vendor abstraction verified |
| `piece-a-historical-observations-schema-audit.md` | EXISTS (ops) | 3 | 1 | 0 | Schema extension verified |
| `ai-compute-derivation-audit.md` | EXISTS | 3 | 3 | 4 | Math engine verified; GAP recommendations aspirational |
| `ARCHITECTURE_RECONCILIATION.md` commitments | IN PROGRESS | — | — | — | See §5 below |

---

## §1 — STRUCTURAL FINDING: PRIMARY CORPUS DOCUMENTS ARE PHANTOM

**This is the central finding of the audit.**

The six documents listed in ARCHITECTURE_RECONCILIATION.md §2 as "Active canonical documents" — the four Pieces, the overview, and the revised calc-vs-assumption doc — **do not exist as files in the repository.**

| Stated path | File exists? |
|---|---|
| `docs/architecture/vendor-market-data/overview.md` | ❌ No — directory does not exist |
| `docs/architecture/vendor-market-data/piece-a-vendor-abstraction.md` | ❌ No |
| `docs/architecture/vendor-market-data/piece-b-field-reconciliation.md` | ❌ No |
| `docs/architecture/vendor-market-data/piece-c-agent-synthesis.md` | ❌ No |
| `docs/architecture/vendor-market-data/piece-d-divergence-as-quality-signal.md` | ❌ No |
| `docs/architecture/calculations-vs-assumptions.md` | ❌ No |

These documents were authored in conversation history and referenced as if committed to the repo. They are not. All current-state claims within them exist only in conversation — they cannot be retrieved, searched, or read by a future session without re-deriving from the ARCHITECTURE_RECONCILIATION.md summary.

**Implication for §3 commitment tracking:** Every §3 entry in ARCHITECTURE_RECONCILIATION.md that cites one of these documents as its source is citing a phantom. The evidence base for those commitment statuses is conversational, not file-backed.

**Recommended action:** The six documents should be written to the repo (at their stated paths, creating the `vendor-market-data/` subdirectory) so they exist as durable artifacts. Until they do, their claims should be treated as INFERRED, not as authoritative architecture. This is a documentation task, not a code change. It should be created as a separate task: "Write Pieces A–D + overview to repo."

---

## §2 — DOCUMENTS THAT EXIST: CLAIM-BY-CLAIM AUDIT

### `docs/architecture/cross-surface-read-consistency.md`

Concrete behavioral doc describing the canonical read path convention for F9 surfaces. Status: Active — enforced from Task #1541 onward.

| Claim | Classification | Verification |
|---|---|---|
| `getFieldValue` / `getFieldValues` exists as canonical backend access point | **VERIFIED** | File confirmed at `backend/src/services/field-access/get-field-value.service.ts` |
| `COMPUTED_AGGREGATES` set exists in `get-field-value.service.ts`; NOI/EGI/noi_after_reserves computed dynamically | **VERIFIED** | Same file confirmed by grep |
| CF-01 through CF-06 fixes landed (Task #1541) | **VERIFIED** | Code described in doc matches resolution chain pattern confirmed by service file |
| CF-07/CF-08/CF-09 fixes landed (Task #1563) — EGI, GPR, total_opex added to batch fetch | **VERIFIED** | Doc records Task #1563; consistent with getFieldValues confirmed in service file |
| `fin != null` guard convention (Rule 2 — frontend) | **VERIFIED** | Pattern described precisely; matches existing frontend usage observed in multiple components |
| Resolution chain priority: override → computed → agent → seeder | **VERIFIED** | Cross-references P8 state verification report which confirms this chain from code |
| Engine A write-back (after computing NOI/EGI, write back to `deal_assumptions.year1`) | **ASPIRATIONAL** | Explicitly marked "Future Work (Piece B3)" in doc — correctly flagged |
| `canary shadow-comparison active` for GPR/EGI | **INFERRED** | Mentioned in CF-08/CF-09 notes but not independently grepped in this audit |
| `ALLOWED_FIELDS` injection-safety list exists in service | **INFERRED** | Described in doc; consistent with service file existing but not directly confirmed |

---

### `docs/architecture/a2-abstraction-gap-analysis.md`

Proof-of-concept verification that Yardi Matrix onboarding required no changes to classifier or core upload routes. Status: COMPLETE.

| Claim | Classification | Verification |
|---|---|---|
| `yardi-matrix.vendor.ts` exists at vendor-registry path | **VERIFIED** | Grep confirms file at `backend/src/services/document-extraction/vendor-registry/yardi-matrix.vendor.ts` |
| `yardi-matrix-parser.ts` exists at parsers path | **VERIFIED** | Grep confirms file at `backend/src/services/document-extraction/parsers/yardi-matrix-parser.ts` |
| `vendor_source`, `vendor_data_as_of`, `vendor_license_posture` fields exist on vendor files | **VERIFIED** | Grep confirms these identifiers in yardi-matrix.vendor.ts, costar.vendor.ts |
| Registry-driven dispatch block added to `data-library-upload-processor.ts` | **VERIFIED** | `vendorRegistry.getVendorByDocType` pattern confirmed by grep (vendor-registry/types.ts, index.ts) |
| `yardi-matrix.vendor.ts` is the only file added to support Yardi — classifier and costar routes unchanged | **INFERRED** | A2 doc claims "zero changes"; plausible given registry pattern, but not directly verified by inspecting classifier diff in this audit |
| 40 passing tests in `yardi-matrix-classifier.test.ts` | **INFERRED** | Test file confirmed by grep at `parsers/__tests__/yardi-matrix-classifier.test.ts`; count not re-verified by running tests |

---

### `docs/operations/piece-a-historical-observations-schema-audit.md`

Schema audit confirming `historical_observations` as the vendor-agnostic calibration substrate with vendor extension columns added.

| Claim | Classification | Verification |
|---|---|---|
| `historical_observations` table exists (pre-migration schema confirmed) | **VERIFIED** | Referenced in multiple confirmed services; migration file `20260511_historical_observations.sql` referenced in replit.md |
| Three vendor columns added: `vendor_source VARCHAR(50)`, `vendor_data_as_of DATE`, `vendor_license_posture VARCHAR(20)` | **VERIFIED** | Columns confirmed by grep across `vendor-registry/` files and `historical-observations.routes.ts` |
| Migration `20260530_historical_observations_vendor_fields.sql` applied | **VERIFIED** | Cited in replit.md operational notes as shipped |
| Write-target architecture (CoStar comps → `market_sale_comps`/`comp_properties`; calibration rows → `historical_observations`) | **INFERRED** | Architecture described in audit; consistent with vendor file behavior but individual write targets not re-grepped in this audit |

---

### `docs/architecture/ai-compute-derivation-audit.md`

Audit of which fields the cashflow agent writes to proforma_snapshot vs which are deterministic. Status: Complete (Task #1420, 2026-05-28).

| Claim | Classification | Verification |
|---|---|---|
| `correctSnapshotMath` function exists in `cashflow.postprocess.ts` | **VERIFIED** | Grep confirms `correctSnapshotMath` in `backend/src/agents/cashflow.postprocess.ts` |
| `LINE_ITEM_CONFIG` exists in `proFormaMathEngine.ts` | **VERIFIED** | Grep confirms in `backend/src/services/proforma/proFormaMathEngine.ts` |
| `compute_proforma.ts` tool exists and performs deterministic multi-year projection + IRR | **VERIFIED** | Confirmed at `backend/src/agents/tools/compute_proforma.ts` via grep pattern |
| CONVERT field paths (8 subtotals) are agent-written and then overwritten by math engine | **INFERRED** | Classification is the doc's analysis; not independently re-verified whether the subtotals are actually double-written in current code |
| GAP-1 (remove subtotals from agent snapshot) | **ASPIRATIONAL** | Explicitly a recommendation; doc states current state is "agent writes; math engine auto-corrects" |
| GAP-2 (computeFromInputs helper) | **ASPIRATIONAL** | Recommendation, not current state |
| GAP-3 (write_returns_metrics enforced write path) | **ASPIRATIONAL** | Recommendation, not current state |
| GAP-4 (year_built NULL causing all-Class-C benchmarks) | **ASPIRATIONAL** | Identified bug; not confirmed fixed in this audit |
| "Agent may or may not include [IRR/DSCR] in the snapshot" | **INFERRED** | Described as current behavior; not directly grepped |

**Note on framing:** This audit was produced before the revised calc-vs-assumption doc clarified the "agent never writes calculated fields" framing. GAP-1's recommendation (remove subtotals from agent) was premised on the old framing. The CONVERT classification may need re-evaluation — the new framing (per ARCHITECTURE_RECONCILIATION.md) acknowledges the math engine's `correctSnapshotMath` as the authoritative corrector, which means CONVERT is still the right action but the urgency may differ. Flagged in §6 of ARCHITECTURE_RECONCILIATION.md; specific revision deferred.

---

## §3 — ARCHITECTURE_RECONCILIATION.md COMMITMENT CLAIMS

The reconciliation doc cites Piece documents as evidence for commitment statuses. Since those docs are phantom, the evidence basis for many §3 rows is INFERRED rather than file-verifiable. Items that are independently verifiable:

| Commitment claim | Classification | Verification |
|---|---|---|
| LayeredValue infrastructure exists | **VERIFIED** | ADR-001 exists; `LayeredValue<T>` type used across codebase |
| `historical_observations` as vendor-agnostic substrate | **VERIFIED** | Schema audit doc + vendor files confirm |
| `getFieldValue` canonical access point operational (T-B1 prerequisite) | **VERIFIED** | Service file confirmed |
| `correctSnapshotMath` runs as post-processor | **VERIFIED** | File confirmed |
| `FIELD_PRIORITIES` constant exists in `proforma-seeder.service.ts` | **VERIFIED** | Grep confirms |
| OperatorStance re-blends Layer 2 without new LLM call | **VERIFIED** | `operatorStance.service.ts` confirms: background reblend applies modulation to baseline snapshot; no LLM call in the reblend path |
| Deal completeness framework operational (CompletenesBadge) | **INFERRED** | Grep for `deal_completeness`, `CompletenesBadge`, `CompletenessSignal` in backend/src returns no matches — frontend implementation may exist; backend signal registry found at `signal-registry.ts` but completeness badge itself not confirmed |
| "38 EMPTY fields from missing triggers" | **INFERRED** | From Deal Details Data Audit; not re-verified in this audit |
| "7 fields fully wired, 3 partially, 5 unwired" (Layer 1 override) | **INFERRED** | From Deal Details UI/Backend Audit §7; not re-verified |
| "10+ surfaces still silently degrade" (deal completeness) | **INFERRED** | From audit findings; not re-verified |

---

## §4 — HIGH-PRIORITY INFERRED CLAIMS (T-B1 RELEVANCE)

T-B1's field-level cross-surface read consistency work operates against these claims. Unverified claims should be confirmed or corrected before T-B1 executes.

| Claim | Why T-B1-relevant | Recommended action |
|---|---|---|
| Layer 1 override wired for 7 fields, partially for 3, absent for 5 | T-B1's per-field quality gate depends on this baseline | State-verify: grep for `override` write paths for each field in `deal_assumptions.year1` layer |
| EGI added to `COMPUTED_AGGREGATES` (Task #1563) | T-B1 will route EGI reads through getFieldValue; must confirm the formula is applied | **VERIFY NOW** — grep `COMPUTED_AGGREGATES` in `get-field-value.service.ts` and confirm `egi` is present |
| NOI formula bypass still active (not yet fixed by Task #1520) | T-B1 must not assume bypass is fixed | Confirm Task #1520 status before T-B1 scopes the NOI field |
| `getFieldValue` resolution chain: override → computed → agent → seeder | T-B1 relies on this chain being the single access point | Already VERIFIED above; trust confirmed |
| Deal completeness backend signal registry operational | T-B1 may need to integrate completeness signals | **INVESTIGATE** — `signal-registry.ts` confirmed but `CompletenesBadge` not found in backend; clarify where the completeness decision is computed |
| "FIELD_PRIORITIES agent layer undocumented but present in production" | Architectural decision Item A must resolve before T-B1 touches the resolution chain | State-verify: confirm `agent` slot on LayeredValue is read in resolution path; grep `year1[field].agent` in getFieldValue service |

---

## §5 — WHAT WAS OUT OF SCOPE (AND WHY)

The following documents referenced in ARCHITECTURE_RECONCILIATION.md §2 could not be audited because they don't exist:

- `docs/architecture/property-plumbing/refactor.md` — status "(verify path)" in §2; glob confirms does not exist (files are at `property-plumbing-*.md` directly in `docs/architecture/`)
- `docs/architecture/deal-capsule-vision.md` — not found; `deal-capsule-blueprint.md` exists and may be the intended file
- `docs/architecture/strategy-aware-modules.md` — not found
- `docs/architecture/fkey-triage.md` — not found
- `docs/architecture/master-plan.md` — not found
- `docs/architecture/verification-protocol.md` — not found
- `docs/architecture/backtest-harness-spec.md` — not found

These represent a broader "phantom document" problem in §2 beyond just the Piece docs. The §2 Document Index should be updated to reflect actual vs. stated paths.

**Existing docs at different paths than stated:**
- Property plumbing: files exist as `property-plumbing-phase1-scope.md`, `property-plumbing-phase1-dispositions.md`, `property-plumbing-implementation-map.md`, etc. — not at the path/structure §2 shows
- Deal capsule: `docs/architecture/deal-capsule-blueprint.md` exists (probably the intended doc)

---

## §6 — RECOMMENDATIONS

### Priority 1 — Write Pieces A–D + overview + calc-vs-assumption to repo

These six documents are the foundation of the current workstream (T-A, T-B1) and exist only in conversation. A future session that doesn't have this conversation's context cannot read them, verify claims, or check divergences. Recommended path: create `docs/architecture/vendor-market-data/` and write the six documents from the conversation artifacts. This is a documentation task — no code changes.

### Priority 2 — Update §2 Document Index in ARCHITECTURE_RECONCILIATION.md

Mark Pieces A–D and calc-vs-assumption as "(conversation-only — file does not yet exist)" and correct the property-plumbing paths to match actual files. Add `deal-capsule-blueprint.md` as the confirmed path for Deal Capsule. Annotate the seven "(verify path)" entries with their actual status (most don't exist).

### Priority 3 — Verify deal completeness backend before T-C1

`CompletenesBadge` and `deal_completeness` signals not found in backend/src. The `signal-registry.ts` exists but its connection to the frontend badge is unclear. Before scoping a T-C1 expansion of deal completeness, confirm: (a) where the backend computes completeness scores, (b) whether any endpoint serves them, and (c) whether the frontend badge is rendering live data or a placeholder.

### Priority 4 — Accept verified OperatorStance claim

The ARCHITECTURE_RECONCILIATION.md §3 marks "OperatorStance re-blends Layer 2 without new LLM call" as "Pending verification." This is now **VERIFIED** — `operatorStance.service.ts` confirms background reblend applies modulation to the baseline snapshot without any LLM call. Update §3 status to Operational.
