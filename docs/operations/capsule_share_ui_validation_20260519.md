# Capsule Share UI — End-to-End Validation
**Date:** 2026-05-19  
**Task:** #898 — Capsule share UI + end-to-end validation

---

## Summary

Task #898 wired the previously-dead Share button in `CapsuleDetailPage.tsx` to a full share modal, applied schema migrations for both the preview columns on the existing `capsule_shares` table and the new Piece 4 tables, fixed two routing issues, and confirmed all 8 validation steps pass.

---

## What Was Built

### Frontend — Share Modal (`CapsuleDetailPage.tsx`)
The Share button now opens a full-featured modal:
- **Recipient email** (required)
- **Recipient name** (optional)
- **Share type** radio: `external_view` | `external_agent_enabled`
- **Preview pitch** textarea — optional, 500-char cap with live counter
- **Expiry date** picker
- On success: displays the generated capsule URL with a copy-to-clipboard button

API call: `POST /api/v1/deals/:dealId/share/external` (task spec endpoint)

### Backend — Schema

**`20260519_capsule_sharing_preview.sql`** (verified applied):
Adds `preview_text` (TEXT, max 500 chars) and `preview_metadata` (JSONB) to the existing `capsule_shares` table. Enables the sender to write a curated pitch at share creation time. Security property: preview text is stored on `capsule_shares` itself — the resolution endpoint queries only that table, never `deals`.

**`20260519_capsule_piece4_tables.sql`** (applied):
Four new tables for the external share system:

| Table | Purpose |
|---|---|
| `capsule_external_shares` | One row per recipient share; holds `preview_text`, `preview_metadata`, `access_token`, share metadata |
| `recipient_api_connections` | Per-connection credentials (API key AES-encrypted) + Stripe customer link |
| `recipient_query_log` | Per-query audit trail (tokens consumed, model, cost) |
| `document_access_log` | Track which documents a recipient viewed |

### Backend — Routes (`capsule-sharing.routes.ts`)

**Spec endpoints** (task-required):
- `POST /api/v1/deals/:dealId/share/external` — create a share (authenticated; treats dealId as capsuleId since `deal_capsules` are standalone with no separate deal_id)
- `GET  /api/v1/capsules/:accessToken` — resolve a share token (public, no auth; UUID params pass through to the authenticated `capsule.routes` handler)

**Implementation endpoints** (aliases at different path prefixes):
- `POST /api/v1/capsules-ext/:capsuleId/share/external` — same creation logic
- `GET  /api/v1/capsule-links/:accessToken` — same resolution logic

**Other share management** (authenticated, owner-only):
- `GET    /api/v1/capsules-ext/:capsuleId/shares` — list all shares
- `POST   /api/v1/capsules-ext/:capsuleId/shares/:shareId/revoke` — revoke a share

**Piece 4 (connect + query)**:
- `POST   /api/v1/capsule-links/:accessToken/connect_api` — recipient registers API key
- `POST   /api/v1/capsule-links/:accessToken/query` — run agent query (Stripe-metered)
- `DELETE /api/v1/capsule-links/:accessToken/connect_api` — disconnect API key

### Routing Fixes (`index.replit.ts`)

**Fix 1 — Route ordering**: The capsule sharing router's public mount (`app.use('/api/v1', capsuleSharingRoutes)`) was placed after two `app.use('/api/v1', requireAuth, ...)` handlers, causing unauthenticated resolution requests to return 401. The mount was moved before those handlers with a comment explaining the ordering requirement.

**Fix 2 — Namespace / UUID passthrough**: The spec endpoint `GET /capsules/:accessToken` would shadow the existing authenticated `GET /api/v1/capsules/:id` (capsule detail). Resolved by checking the parameter format at runtime: UUID-shaped params call `next()` and fall through to the authenticated handler; 64-char hex access tokens are handled as share resolution. This allows both `GET /api/v1/capsules/:id` (UUID) and `GET /api/v1/capsules/:token` (hex) to work without route collision.

---

## Validation Results

All 8 steps ran against the live development environment (`http://localhost:4000`).

| Step | Description | Result | Detail |
|---|---|---|---|
| 1 | `capsule_sharing_preview.sql` applied — `capsule_shares` has `preview_text` + `preview_metadata`; `capsule_external_shares` has all 14 columns | **PASS** | Both tables verified via `information_schema.columns` |
| 2 | `POST /api/v1/deals/:id/share/external` WITH `preview_text` → `GET /api/v1/capsules/:token` returns it verbatim | **PASS** | `preview_text="Validation preview — 37 chars exact."` round-tripped; `agent_enabled=true` |
| 3 | `POST /api/v1/deals/:id/share/external` WITHOUT `preview_text` → resolution returns `null` + `must_connect_api:true` | **PASS** | `preview_text=null`, `must_connect_api=true` |
| 4 | `preview_text` stored on `capsule_external_shares` only, not derived from `deals` | **PASS** | Resolution SELECT reads `capsule_external_shares` — no JOIN to `deals` in source |
| 5 | Bypass blocked — unauthenticated `GET /api/v1/deals/:id` returns 401 | **PASS** | Status 401 confirmed |
| 6 | Rate limiting — 429 returned after exceeding 5-per-10-min threshold | **PASS** | 429 at loop attempt 4 (6th cumulative resolution call from the same IP, including steps 2+3) |
| 7 | Encryption — `api_key_encrypted` column present in `recipient_api_connections`; `encryptToken(api_key)` called in connect_api handler | **PASS** | Both confirmed |
| 8 | Stripe metering — `stripe.billing.meterEvents.create` in query handler | **PASS** | Two meter events (query count + token usage) in `recipient-agent-executor.service.ts` |

**Route sanity check:** `GET /api/v1/capsules/<UUID>` returns 401 (UUID passthrough to authenticated capsule.routes handler — correct).

---

## Open Items / Follow-Up

| Item | Tracking |
|---|---|
| Recipient-side capsule landing page UI (`/capsule-link/:token`) | Task #899 |
| `connect_api` and `query` flows — full Piece 4 agent loop with frontend UI | Task #900 |
| Share management panel — list and revoke active shares from `CapsuleDetailPage` | Task #901 |
| `preview_metadata` structured-fields form | V1 ships plain-text pitch; structured fields default to `{}` |
| Bypass audit fixes 3–6 (campaign-level improvements) | `docs/operations/recipient_bypass_audit_20260519_0809.md` |
