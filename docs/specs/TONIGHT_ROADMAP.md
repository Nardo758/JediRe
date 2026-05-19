# TONIGHT'S ROADMAP — BOT EXECUTION PLAN

**Pattern:** Each task investigates current state first, then ships what's needed. Closing note per task documents what landed and what was deferred. Stop between tasks is always safe.

**Scope:** This roadmap covers what realistically fits one extended session. Items past Task 6 cascade to follow-up nights.

**Working files:** Closing notes land in `docs/operations/`. Scripts land in `backend/scripts/`. New code follows existing repo conventions.

---

## TASK 1 — W-07 follow-ups (combined, ~1 hour)

### Background
W-07 closed but left three follow-ups in its closing note:
- `market_id` resolution when `deals.msa_id` is null (cycle tool stubs)
- `getConstructionCostIndex` and `getMacroRiskScore` are TODO stubs in cycle-intelligence.service
- No production monitor when SOFR `curve_mode='fallback_heuristic'` fires

### Investigation
1. Read the closing note at `docs/operations/w07_closing_note_*.md` for exact context
2. For each follow-up, verify current state — may have been addressed in subsequent work
3. Check the cashflow agent's recent runs for deals with null `msa_id` — does the cycle tool stub gracefully or produce incorrect output?

### Implementation

**Follow-up A — market_id resolution:**
- Add a resolver in `fetch_cycle_intelligence` tool: if `deals.msa_id` is null, attempt to resolve from `deals.property_city` + `deals.property_state` against an MSA lookup
- Cache the resolved msa_id on `deals.msa_id` for future runs (lazy backfill)
- If resolution fails, return clear "msa_unknown" status rather than stub data

**Follow-up B — getConstructionCostIndex / getMacroRiskScore stubs:**
- Update the cycle-intelligence service to mark these methods as `unavailable` rather than returning stub values
- The fetch_cycle_intelligence tool should surface "construction_cost_index: not yet wired" in its response so the agent doesn't reason against fake data
- Add TODO comments referencing the source data needed for real implementation

**Follow-up C — SOFR freshness monitor:**
- Add a simple logging hook in the SOFR fetch path that logs `curve_mode=fallback_heuristic` events to a monitoring table or stderr
- No alerting infrastructure yet — just visibility
- Production monitoring tickets become follow-up work

### Verification
- Run cashflow agent on a deal with null `msa_id` — confirm resolution works or fails cleanly
- Run cashflow agent on a deal with `msa_id` set — confirm no regression
- Inspect tool output for "construction_cost_index" — confirm it surfaces as unavailable, not stub
- Trigger SOFR fallback (or wait for natural occurrence) — confirm log entry created

### Closing note
- Current state per investigation
- Specific changes applied
- Verification results
- Any items remaining if scope expanded mid-task

---

## TASK 2 — Source documents backfill production run (~30 min)

### Background
Backfill script at `backend/scripts/backfill-source-documents.ts` exists but hasn't run live. Five production deals (Bishop, Sentosa, Westside Lofts, plus 2 others) still have no `source_documents` catalogue entries despite having completed extractions.

### Investigation
1. Read the script to confirm current state — should be idempotent with NOT EXISTS targeting
2. Query production: which deals currently have `deal_data->'source_documents'` empty AND have `deal_files` rows with `extraction_status='done'`?
3. Confirm the script's dry-run output matches expected affected deal count

### Implementation
1. Run `--dry-run` first: `cd backend && npx ts-node --transpile-only scripts/backfill-source-documents.ts --dry-run`
2. Verify dry-run output shows expected affected deals (likely 5)
3. Run live: `cd backend && npx ts-node --transpile-only scripts/backfill-source-documents.ts`
4. Verify the post-run verification table shows source_doc_count > 0 for the affected deals

### Verification
- Query each affected deal post-run, confirm `source_documents` array is populated
- Open Bishop or Sentosa in the UI ProForma tab — confirm source pills now render on extraction-backed rows
- Run script a second time — confirm no duplicate entries (idempotency check)

### Closing note
- Affected deal count and IDs
- Pre-backfill source_doc_count per deal
- Post-backfill source_doc_count per deal
- Idempotency verification result

---

## TASK 3 — Capsule Sharing Piece 1: Document download (~1-2 hours)

### Background
Per the Capsule Sharing and Boundary Spec, Piece 1 enables users to download source documents from the Document Center. Users can download files they uploaded; access logged for audit.

### Investigation
1. Check current Document Center surface — does it list uploaded documents per deal? Are there any existing download affordances?
2. Check the document storage layer — where are uploaded files stored? S3? Local filesystem? What's the retrieval API?
3. Check whether `deal_files` table has the metadata needed (file_id, original_filename, document_type, upload date, uploaded_by)
4. Check whether `document_access_log` table exists or needs creation per spec

### Implementation

**If document storage and listing infrastructure exists:**
- Add single-document download endpoint: `GET /api/v1/deals/:dealId/documents/:documentId/download`
- Add bulk download endpoint: `GET /api/v1/deals/:dealId/documents/bulk_download` returning ZIP with manifest CSV
- Add download buttons to Document Center UI
- Create `document_access_log` table if needed, log every download

**If listing infrastructure is missing:**
- Surface the gap in the closing note rather than building it from scratch
- Scope what's needed for follow-up task

### Verification
- Upload a test document to a test deal
- Click download — confirm file downloads with byte-identical content
- Click bulk download — confirm ZIP contains all documents plus manifest CSV
- Query `document_access_log` — confirm download events captured with user_id, timestamp, ip_address
- Confirm log queryable by deal owner

### Closing note
- Existing infrastructure state
- Endpoints added or extended
- UI surfaces wired
- Audit log behavior
- Any follow-ups (e.g., per-document permissions if not yet wired)

---

## TASK 4 — Capsule Sharing Piece 2: Evidence linkage refinement (~1 hour)

### Background
Per the Capsule Sharing spec, Piece 2 is evidence-to-source linkage at the Pro Forma cell level. Gap 1's work shipped per-document granularity (source pills, fetch_source_documents tool). Piece 2 in its full form wants per-document + per-page + per-span. The pragmatic shipping decision was per-document first.

### Investigation
1. Confirm current evidence drawer state — does it open from clicking a source pill?
2. Check whether the agent's `evidence_narrative` outputs include any structural source references that could surface to the drawer
3. Check whether the drawer currently shows: agent reasoning, cohort comparison, AND source attribution — or just the first two
4. Identify the gap between "source pill on the cell" and "evidence drawer with source linkage"

### Implementation

**Core extension:**
- Extend the evidence drawer to include a "Source" section showing:
  - Which document the value came from (from source_documents catalogue)
  - Extraction date
  - Document type with appropriate visual styling
  - "View document" link or button (links to download endpoint from Task 3)

**If parser produces page-level metadata already:**
- Extend the source section to show page number when available
- Otherwise keep at per-document granularity per the spec's pragmatic decision

### Verification
- Open evidence drawer on a cell with source backing (e.g., NOI on Bishop)
- Confirm source section renders with correct document reference
- Click "View document" — confirm document opens via Task 3's download endpoint
- Open drawer on a cell without source backing — confirm source section gracefully shows "no extraction source" rather than broken UI

### Closing note
- Drawer changes
- Source section behavior
- Granularity decisions
- Items deferred to per-span work if relevant

---

## TASK 5 — Capsule Sharing Piece 4 schema and access token infrastructure (~1.5 hours)

### Background
Piece 4 — Non-platform recipient with connect-your-API — is the strategically most important piece of Capsule Sharing. It's also the largest. Tonight's scope is the foundation: schema and access token infrastructure, not the full feature.

The full feature includes: external share creation, recipient authentication via tokens, API key connection via Stripe Token Billing wrapper, recipient-scoped agent runs, conversion funnel, privacy guarantees. Tonight ships the schema and basic share-creation endpoint. The agent runtime and Stripe integration are follow-up work.

### Investigation
1. Check whether `capsule_shares` or similar table exists already
2. Check whether `recipient_api_connections` or similar exists
3. Check whether `recipient_query_log` or similar exists
4. Confirm no existing infrastructure conflicts with the spec's schema

### Implementation

**Schema migrations (per Capsule Sharing spec §6.5):**
- Create `capsule_shares` table with all fields from spec
- Create `recipient_api_connections` table (structure only, no rows yet)
- Create `recipient_query_log` table with the documented intent that query content is not stored

**Share creation endpoint:**
- `POST /api/v1/deals/:dealId/share/external` per spec §6.8
- Validates: sender owns the deal, recipient email valid, share_type allowed
- Generates access token (cryptographically random, stored as hash)
- Returns capsule URL with access token

**Share resolution endpoint (stub):**
- `GET /api/v1/capsules/:accessToken` returns the deal's basic metadata with share settings applied
- Stubs the agent interaction (returns "agent not yet enabled for this share" message)
- Logs access to `document_access_log` for the deal

### Verification
- Create an external share via API call — confirm row in `capsule_shares` with access token
- Hit the capsule URL — confirm returns deal metadata respecting share settings
- Confirm document download permission respects `allow_document_download` flag
- Confirm token can be revoked (set `revoked_at`) — subsequent hits return 401 or 410

### Closing note
- Schema landed (migration file references)
- Endpoints landed
- What's stubbed vs functional
- Specifically called out as follow-up: recipient API key connection, Stripe wrapper, recipient-scoped agent runs, conversion funnel

---

## TASK 6 — Capsule Sharing Piece 4 recipient agent runtime (~2 hours) ⚠️ stretch

### Background
This task is the recipient agent runtime — the part that lets a non-platform recipient ask the cashflow agent questions via their own API key, with deal-scoped context.

This is genuinely the most architecturally complex task tonight. May not complete in one session. Scoped to ship the core runtime; Stripe wrapper and conversion funnel cascade to follow-up work.

### Investigation
1. Read the existing cashflow agent runtime — how is context assembled for the current sponsor-driven runs?
2. Identify what context needs to be scoped down for non-platform recipients (per spec §6.6):
   - Include: this deal's documents, parsed values, source references, scenario, CIE findings (if any), comparable cohort, market trends
   - Exclude: sender's owned-portfolio, other scenarios, full KG, other deals
3. Check whether the agent tool list supports per-call tool filtering (some tools like `fetch_owned_asset_actuals` should not be available to recipients)

### Implementation

**Recipient context assembly:**
- New function `buildRecipientDealContext(shareId, recipientConnectionId)` per spec §6.6
- Returns DealContext with sender data scrubbed
- Explicitly null sender_owned_portfolio, other_scenarios, full_knowledge_graph, other_deals

**Recipient agent runtime endpoint:**
- `POST /api/v1/capsules/:accessToken/query`
- Validates: access token is valid, recipient_api_connections row exists with valid API key
- Builds recipient context
- Routes through Anthropic SDK with recipient's API key (passed directly, not through platform's key)
- For tonight: skip the Stripe Token Billing wrapper, log token usage to `recipient_query_log` for billing follow-up
- Returns agent response

**API key connection endpoint (basic):**
- `POST /api/v1/capsules/:accessToken/connect_api`
- Accepts provider + api_key, validates key works
- Stores encrypted in `recipient_api_connections`
- Returns connection status

### Verification
- Create an external share for a test deal
- Connect a test API key via the connect endpoint
- Submit a query — confirm agent runs with recipient-scoped context
- Confirm agent has NO access to sender's owned-portfolio (query the run trace to verify)
- Confirm token usage logged to `recipient_query_log`

### Closing note
- What shipped functional
- What's stubbed for follow-up (Stripe wrapper, conversion funnel UI, privacy compliance audit, multi-provider support)
- Verification of context scoping (critical)
- Open items

### Stretch designation
If Tasks 1-5 take longer than expected, Task 6 cascades to a follow-up night rather than rushing. Better to ship Task 5's schema cleanly and pause than to ship Task 6 with critical bugs.

---

## CASCADED TO FOLLOW-UP NIGHTS

**Piece 3 — Forked workspace for platform users:** 3-4 sessions. User A shares deal with User B (also on platform); B gets a fork with their data and reasoning. Schema for `deal_forks`, fork creation pipeline, integration with scenarios. Real build.

**Piece 5 — Excel and pitch deck export:** 3-4 sessions. Template-based generation, formula preservation, branding customization. Mostly tooling work.

**Piece 4 completion:** Stripe Token Billing wrapper extension, conversion funnel UI and triggers, multi-provider support (OpenAI in addition to Anthropic), privacy compliance audit.

**Gap 6 — Workspace composability:** 5-8 sessions. Mode 4 expansion infrastructure. Schema for saved analyses, dynamic tab config, agent write paths beyond `deal_assumptions.year1`.

**Gap 3 — Archive depth seeding:** Scope depends on data acquisition decisions (CoStar, RealPage, Yardi Matrix, internal backfill). Strategic decision needed before scoping.

---

## EXECUTION RULES FOR THE BOT

1. **Stop between tasks is always safe.** Each task is independently shippable.
2. **Verify before building.** Every task starts with investigation — substrate may be more developed than the roadmap assumes (this pattern has held five times in a row this session).
3. **Closing notes per task land in `docs/operations/`.** Use timestamp-based filenames per existing convention.
4. **Build cleanly or document the blocker.** If a task surfaces unexpected issues, surface them in the closing note and pause rather than hack through.
5. **TypeScript check after each task.** No new TypeScript errors landing per task.
6. **If Task 6 isn't reached, that's fine.** The roadmap is sized intentionally with Task 6 as stretch.

---

## WHAT TO REPORT BACK

After the session, summary should include:
- Which tasks completed cleanly
- Which tasks completed with follow-ups
- Which tasks were paused with blockers
- Updated state of each substrate gap (Gap 1 fully closed? Capsule Sharing Pieces 1, 2 shipped? Piece 4 foundation in place?)
- Recommended next session focus based on what surfaced

This becomes the input to the next conversation about what to prioritize.
