# CLASSIFICATION MAP B — ACTION-LAYER SEMANTICS

**HEAD SHA:** `06296754a75dd5ba0abdb08894d1c696df4a169a`  
**Mode:** READ-ONLY — no mutations performed  
**Date:** 2026-06-30  
**Dispatch:** B (Depth) — ownership, visibility, boundary, tenancy-awareness  
**Dispatch A columns:** NOT duplicated here — see `CLASSIFICATION_MAP_A_SPINE.md`

---

## B's Axes (B owns these; A owns PUBLIC/PRIVATE/MIXED)

- **OWNERSHIP** — user-private vs org-shared (whose is the artifact?)
- **VISIBILITY** — member-private / org-shared / cross-org
- **BOUNDARY** — stays within one org vs deliberately crosses org boundary
- **TENANCY-AWARE?** — explicitly checks org_id at the route level (yes/partial/no)
- **LEAK RISK** — exposure severity if org-scoping goes live without fixing

---

## B1 — Proforma Versioning

**Tables:** `deal_versions`, `opus_proforma_versions`  
**Routes/services:** `backend/src/services/proforma/deal-versions.service.ts`, `backend/src/services/opus.service.ts`

### Findings

**`deal_versions`**
- Columns: `id, deal_id, version_number, created_by (user_id, nullable), layered_state_snapshot, model_versions, override_divergences, save_trigger, note`. **NO `org_id`.**
- Read route: gated by `requireAuth + requireDealAccess`. The `requireDealAccess` middleware at `backend/src/middleware/deal-access.ts:52` queries `SELECT organization_id, user_id FROM deals WHERE id = $1` and verifies the caller is an org member — so the org check IS enforced at the route layer.
- **OWNERSHIP: user.** `created_by` = caller's user_id. But the READ path (`VERSIONS_SELECT` in deal-versions.service.ts line 55) returns ALL versions for the deal, unfiltered by `created_by`. Any org member with deal access sees every teammate's saved versions.
- **VISIBILITY: org-shared** (all deal members see all versions).

**`opus_proforma_versions`**
- Columns: `deal_id, conversation_id, version_name, version_number, proforma_data, assumptions, comparable_sources`. **NO `user_id`, NO `org_id`.**
- Reads/writes via `opus.service.ts` lines 154, 160, 169 — all scoped `WHERE deal_id = $1` only.
- Risk routes read it (`risk.routes.ts:898`): `SELECT proforma_data, assumptions FROM opus_proforma_versions WHERE deal_id = $1 ORDER BY version_number DESC LIMIT 1`. This route has auth, but there is **no `created_by` to determine authorship post-scoping**.

### Pre-scoping risk

`requireDealAccess` correctly uses `organization_id` from `deals` today. **Low risk from the gate itself.** However:
- When `deals.org_id` is backfilled (Phase 2), `deal-access.ts:52` must be updated to use `org_id` (the new canonical column) not the legacy `organization_id` — or the gate will silently stop working.
- `opus_proforma_versions` has no attribution at all. If a version is disputed (e.g. whose data was this?), there is no audit trail.

---

## B2 — Capsule Sharing

**Tables:** `deal_capsules`, `capsule_external_shares`, `recipient_session_overlays`  
**Routes:** `backend/src/api/rest/capsule-sharing.routes.ts`

### Findings

**Ownership check at share creation (`createExternalShareInternal`, line ~140):**
```sql
WHERE dc.id = $1 AND dc.user_id = $2
```
This is **user-level, not org-level.** `deal_capsules` has NO `org_id` column (confirmed by A's scope-signal query). Capsules are owned by individual users, not orgs. Org-mates cannot share each other's capsules — this is correct behavior for the current model, but it means capsule ownership is fundamentally un-migratable to org-scoping without a schema addition.

**Token-based routes (`/capsule-links/:accessToken/*`) — NO platform auth. Token is the credential:**
- `GET /capsule-links/:accessToken` — redirect
- `GET /capsule-links/:accessToken/deal-book` — full capsule payload (see below)
- `GET /capsule-links/:accessToken/field-divergences`
- `PATCH /capsule-links/:accessToken/overlay` — recipient can write overlays
- `POST /capsule-links/:accessToken/connect_api`
- `POST /capsule-links/:accessToken/query`
- `GET /capsule-links/:accessToken/export/excel`
- `GET /capsule-links/:accessToken/export/pdf`

Token validation (`capsule-sharing.routes.ts:958`):
```sql
WHERE ces.access_token = $1
  AND ces.revoked_at IS NULL
  AND (ces.expires_at IS NULL OR ces.expires_at > NOW())
```
Expiry and revocation are checked. There is **no org check** — the token grants access regardless of the recipient's org identity. This is by design (external sharing).

**Phase-1 live-data pivot (confirmed `capsule-sharing.routes.ts:985`):**
```sql
SELECT deal_data, platform_intel, user_adjustments, module_outputs, ...
FROM deal_capsules WHERE id = $1 LIMIT 1
```
No frozen snapshot. Recipients ALWAYS read the current live state of `deal_capsules`. If the owner updates their capsule after share creation, recipients instantly see the updated data — there is **no consent gate on post-share updates.**

**Payload exposed via token** (deal-book endpoint, lines 985–1000):
`property_address, asset_class, jedi_score, collision_score, deal_data, platform_intel, user_adjustments, module_outputs` — the full deal capsule body.

**In-platform routing (lines 160–185):** If `recipient_email` belongs to an existing JediRe user, the share is routed as an in-platform notification — **no external token created.** The recipient is assumed to be in a different org and sees the capsule via their own account.

**`show_attribution_override`:** Only `principal`/`institutional` tier senders can suppress JEDI RE attribution. Lower tiers always show attribution. Silently ignored for lower tiers (does not 403).

### Cross-org boundary

**Boundary: intentionally crosses org.** External sharing is the explicit use-case. The token mechanism has no org concept by design. However:
- `deal_capsules` has no `org_id`. When org-scoping turns on, the only guarantee that a capsule belongs to `$ws` is tracing `deal_capsules.user_id → users` and checking `org_members.org_id = $ws`. No direct column exists.
- Any future "org-level capsule library" feature would need `org_id` added to `deal_capsules`.

---

## B3 — Export / Data Leaving the System

### B3a — Financial Model Excel Export ⚠️ CRITICAL AUTH GAP

**Route:** `backend/src/api/rest/financial-model.routes.ts:579`
```ts
router.get('/:dealId/export/excel', async (req: Request, res: Response) => {
```
**NO `requireAuth` middleware.** Any HTTP request with a valid `dealId` UUID receives the full financial model as an Excel workbook — annual cash flows, assumptions, IRR — with zero authentication. The route is registered and reachable from outside the platform.

- A classifies `deal_financial_models` as PRIVATE.
- Actual behavior: UNPROTECTED (any caller). **Contradicts A's classification — see CONFLICTS.**

### B3b — Audit Export ⚠️ AUTH GAP

**Route:** `backend/src/api/rest/audit.routes.ts:131`
```ts
router.post('/export/:dealId', async (req: Request, res: Response) => {
```
**NO `requireAuth` middleware.** Exports `assumption_history`, `assumption_adjustments`, `proforma_snapshots` (the full audit trail) as JSON/PDF/Excel.

- A classifies audit tables as PRIVATE.
- Actual behavior: UNPROTECTED. **Contradicts A — see CONFLICTS.**

### B3c — Grid Export

**Route:** `backend/src/api/rest/grid.routes.ts:498`
```ts
router.post('/export', async (req: Request, res: Response) => {
```
`grid.routes.ts:10` applies `router.use(optionalAuth)` — auth is optional, not required. Any unauthenticated caller can POST to `/export`. What the export returns depends on the grid query payload, but the route does not enforce authentication.

### B3d — Capsule Export (token-based, intentional)

**Routes:** `/capsule-links/:accessToken/export/excel`, `/capsule-links/:accessToken/export/pdf`, `/shares/:shortcode/export/excel`, `/shares/:shortcode/export/pdf`

No platform auth — token/shortcode is the credential. `allow_document_download` flag is checked per share before serving. Restricted-vendor data is redacted via `redactRestrictedVendorPlatformIntel` before export. **This is by design.** No org check exists or is needed (external export of an explicitly shared capsule).

### B3e — Proforma CSV/Markdown/JSON Export

**Route:** `backend/src/api/rest/proforma.routes.ts:508`
```ts
router.get('/:dealId/export', authMiddleware.requireAuth, ...
```
Has `requireAuth`. No org-level check beyond deal auth. **Low risk.** Scoped by deal_id; deal gate enforces org post-scoping.

### B3f — Document Download (authenticated)

**Routes:** `source-documents.routes.ts:112, :204`, `archive.routes.ts:1361`, `data-library-files.routes.ts:98`
All have `requireAuth`. Scoped via deal_id or user_id. **Low risk.**

### B3g — Deal Financials Export (authenticated)

**Route:** `deal-assumptions.routes.ts:2398`
```ts
router.get('/:dealId/financials/export', requireAuth, ...
```
Has `requireAuth`. **Low risk.**

---

## B4 — Attribution / Authorship

### `underwriting_evidence`
- Columns from `backend/src/database/migrations/20260419_cashflow_evidence.sql:7`:
  `id, deal_id, agent_run_id, field_path, value_numeric, value_text, primary_tier, data_points, reasoning, alternatives, collision, confidence, created_at`
- **NO `user_id`. NO `org_id`.** Attribution is indirect only: `agent_run_id → agent_runs.user_id`.
- If `agent_run_id` is NULL (tool calls that don't go through a tracked run), the evidence row is completely anonymous. No author, no org.
- Risk: post-scoping, evidence rows are scoped via `deal_id → deals.org_id`, which is sufficient for data isolation. But org-level reporting ("who generated this evidence?") will fail without the indirect join.

### `deal_versions`
- Has `created_by` (user_id, nullable). **NO `org_id`.**
- Scoped via deal gate. Author attribution is user-level and correct for single-org usage.
- Post-scoping risk: if a deal is transferred between orgs (future feature), `created_by` will reference a user who may no longer be in the new org — authorship mis-attribution.

### `ai_usage_log`
- Columns include `deal_id, user_id`. **NO `org_id`.**
- AI cost aggregation at org level requires a join: `ai_usage_log JOIN deals ON deals.id = ai_usage_log.deal_id WHERE deals.org_id = $ws`.
- No index on `deals.org_id` today (pre-Phase 2). Org-level cost queries will be slow until the index is added.

### `deal_capsules` (attribution)
- `capsule.routes.ts:27` writes `user_id` as the owner. **NO `org_id`.**
- Attribution shown to share recipients (`sender_display_name`) is resolved from `deal_capsules.user_id → users.full_name`. Correct today. Post-org-scoping, capsules still work — they just can't be queried at org-level without a user→org join.

---

## Feature Summary Table

| feature | surface (A key) | ownership | visibility | boundary | tenancy-aware? | leak risk |
|---|---|---|---|---|---|---|
| **B1a** Proforma deal_versions save/read | M09 Pro Forma Engine / F9 | user (`created_by`) | org-shared (all deal members see all versions) | in-org | **partial** (requireDealAccess checks `organization_id`; must be updated when `org_id` backfilled) | LOW |
| **B1b** opus_proforma_versions | M09 / M21 AI Chat | none (no created_by) | org-shared | in-org | **no** (deal_id only, no org_id, no author) | LOW |
| **B2a** Capsule share creation | M01 Deal Overview / Capsule | user (`user_id` on deal_capsules) | cross-org (external token) | **crosses** (intentional) | **no** (no org_id on deal_capsules; user-level gate only) | MEDIUM (live-data drift) |
| **B2b** Token-based capsule access (`/capsule-links/*`) | Capsule sharing surface | n/a (token-holder) | cross-org | **crosses** (intentional) | **by design** (no org concept — token is credential) | LOW (mitigated by token + revoke) |
| **B3a** Financial model Excel export | M09 / F9 | n/a | **any caller** | **crosses** (no auth at all) | **no** | ⚠️ CRITICAL |
| **B3b** Audit export (assumption history) | M09 / F9 | n/a | **any caller** | **crosses** (no auth at all) | **no** | ⚠️ HIGH |
| **B3c** Grid export | F1/F2/F4 grid surfaces | n/a | **any caller** (optionalAuth) | **crosses** | **no** | HIGH |
| **B3d** Capsule token export (Excel/PDF) | Capsule sharing | n/a (token-holder) | cross-org | **crosses** (intentional) | **by design** | LOW (allow_document_download gate + vendor redaction) |
| **B3e** Proforma CSV/JSON export | M09 | deal-scoped | org-shared | in-org | **partial** (requireAuth, no org check) | LOW |
| **B4a** underwriting_evidence attribution | M09 / Cashflow Agent | none (no user_id) | org-shared (via deal) | in-org | **no** | LOW (isolation OK; reporting gap only) |
| **B4b** ai_usage_log org cost reporting | all AI surfaces | user | org-shared (via deal join) | in-org | **no** | LOW (reporting gap; isolation OK) |

---

## CONFLICTS (B findings that contradict A's PUBLIC/PRIVATE classification)

### CONFLICT-1: `deal_financial_models` / financial-model export

**A's classification:** PRIVATE (deal-scoped, user-generated)  
**B's finding:** Route `GET /api/v1/financial-model/:dealId/export/excel` (`financial-model.routes.ts:579`) has NO `requireAuth` middleware. The table is PRIVATE but the export path makes it effectively **PUBLIC to any caller who knows the dealId.**  
**Severity:** CRITICAL — proforma data (NOI, IRR, cash flow projections) exits the system unauthenticated.  
**Fix:** Add `requireAuth` (and `requireDealAccess`) to `router.get('/:dealId/export/excel', ...)`.

### CONFLICT-2: Audit / assumption history export

**A's classification:** `assumption_history`, `assumption_snapshots`, `proforma_snapshots` = PRIVATE  
**B's finding:** Route `POST /api/v1/audit/export/:dealId` (`audit.routes.ts:131`) has NO `requireAuth`.  
**Severity:** HIGH — full audit trail (override history, confidence tiers, AI reasoning) exits unauthenticated.  
**Fix:** Add `requireAuth` + deal ownership check to audit export route.

### CONFLICT-3: Grid export (optionalAuth)

**A's classification:** grid/market query surfaces = MIXED (F1/F2/F4)  
**B's finding:** `POST /api/v1/grid/export` (`grid.routes.ts:498`) uses `optionalAuth` — no authentication required. Grid query body determines what is returned; if private deal data is queryable via the grid route, it exits without auth.  
**Severity:** HIGH — depends on what data the grid can query without auth. Needs audit of the grid query executor to determine full exposure.  
**Fix:** Elevate `grid.routes.ts` from `optionalAuth` to `requireAuth`.

### CONFLICT-4: Capsule sharing vs. PRIVATE classification

**A's classification:** `deal_capsules`, `capsule_external_shares` = PRIVATE  
**B's finding:** The capsule sharing mechanism intentionally makes PRIVATE data cross-org. The token-based routes expose `deal_data, platform_intel, user_adjustments, module_outputs` to anyone with a valid token — no platform account required. The live-data pivot means the recipient sees real-time updates to a deal they have no org relationship with.  
**Severity:** MEDIUM (by design, but the live-data pivot creates data drift that the sender may not expect). A should note this as "PRIVATE with intentional cross-org sharing path."  
**Fix:** No code change required — this is intentional. Documentation fix: classify capsule sharing as "PRIVATE + intentional cross-org boundary via token."

---

## Leak-Risk Ranking (if org-scoping goes live without fixes)

| rank | feature | route | risk |
|---|---|---|---|
| 1 | **Financial model Excel export — no auth** | `GET /api/v1/financial-model/:dealId/export/excel` | CRITICAL — proforma exits with zero auth; dealId is guessable (UUIDs in URLs) |
| 2 | **Audit export — no auth** | `POST /api/v1/audit/export/:dealId` | HIGH — full assumption history + AI reasoning trails exit unauthenticated |
| 3 | **Grid export — optionalAuth** | `POST /api/v1/grid/export` | HIGH — extent depends on grid query executor; no auth floor |
| 4 | **Capsule live-data pivot** | `/capsule-links/:token/deal-book` | MEDIUM — intentional cross-org, but recipients receive real-time data updates they may not have been explicitly granted |
| 5 | **requireDealAccess org_id migration dependency** | `deal-access.ts:52` | MEDIUM — currently checks `organization_id`; if Phase 2 backfill changes canonical column to `org_id`, the gate stops enforcing org boundary silently |
| 6 | **opus_proforma_versions — no attribution** | `opus.service.ts:154-169` | LOW — no user_id/org_id on versions; isolation OK via deal gate; authorship lost |
| 7 | **underwriting_evidence — no direct attribution** | `write_evidence_rows.ts:85` | LOW — isolation OK via deal; org-level AI evidence reporting will need indirect join |
| 8 | **ai_usage_log — no org_id** | all AI surfaces | LOW — isolation OK; cost reporting at org level needs join through deals |

---

## Pre-Launch Fix Queue (Track 1)

**Features NOT tenancy-aware** (built without org_id checks, must be fixed before org-scoping turns on):

| # | feature | fix type |
|---|---|---|
| 1 | Financial model Excel export | Add `requireAuth` + `requireDealAccess` |
| 2 | Audit export | Add `requireAuth` + deal ownership check |
| 3 | Grid export | Elevate `optionalAuth → requireAuth` |
| 4 | `requireDealAccess` org_id column migration | Update `deal-access.ts:52` from `organization_id` → `org_id` when Phase 2 DDL lands |
| 5 | `deal_capsules` org membership | Add `org_id` to `deal_capsules` or enforce via user→org_members join on capsule creation |

**Total: 5 features not tenancy-aware** that need code changes before org-scoping is safe.

Features with **intentional cross-org behavior** (by design, not bugs): B2b (token-based capsule access), B3d (capsule token export). These need documentation only.
