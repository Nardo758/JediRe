# Capsule Share UI — End-to-End Validation
**Date:** 2026-05-19  
**Task:** #898 — Capsule share UI + end-to-end validation

---

## Summary

Task #898 wired the previously-dead Share button in `CapsuleDetailPage.tsx` to a full share modal, applied schema migrations for the Piece 4 backend tables, fixed two routing issues, and confirmed all 8 validation steps pass.

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

API call: `POST /api/v1/capsules-ext/:capsuleId/share/external`

### Backend — Schema (`20260519_capsule_piece4_tables.sql`)
Four new tables applied cleanly:

| Table | Purpose |
|---|---|
| `capsule_external_shares` | One row per recipient share; holds `preview_text`, `preview_metadata`, `access_token`, share metadata |
| `recipient_api_connections` | Per-connection credentials (API key AES-encrypted) + Stripe customer link |
| `recipient_query_log` | Per-query audit trail (tokens consumed, model, cost) |
| `document_access_log` | Track which documents a recipient viewed |

### Backend — Routes (`capsule-sharing.routes.ts`)

**Authenticated owner actions** (mounted at `/api/v1/capsules-ext`, requires platform auth):
- `POST /:capsuleId/share/external` — create a share
- `GET  /:capsuleId/shares` — list all shares for a capsule
- `POST /:capsuleId/shares/:shareId/revoke` — revoke a share

**Token-based recipient actions** (mounted at `/api/v1`, no platform auth required):
- `GET  /capsule-links/:accessToken` — resolve a share token, returns `preview_text`/`preview_metadata` or `must_connect_api: true`
- `POST /capsule-links/:accessToken/connect_api` — recipient registers their own API key
- `POST /capsule-links/:accessToken/query` — run an agent query (Stripe-metered)
- `DELETE /capsule-links/:accessToken/connect_api` — disconnect API key

### Routing Fixes (`index.replit.ts`)

**Fix 1 — Route ordering**: `app.use('/api/v1', capsuleSharingRoutes)` was mounted after two `app.use('/api/v1', requireAuth, ...)` handlers, which caused all unauthenticated `/capsule-links/` requests to return 401. The mount was moved before those handlers with a comment explaining the ordering requirement.

**Fix 2 — Namespace collision**: The original token-based routes used `/capsules/:accessToken`, which shadowed the existing authenticated capsule CRUD routes at `/api/v1/capsules/:id`. All public token-based endpoints were renamed from `/capsules/` to `/capsule-links/` to ensure Express first-match serves the correct handler for each path.

---

## Validation Results

All 8 steps ran against the live development environment at `http://localhost:4000`.

| Step | Description | Result | Detail |
|---|---|---|---|
| 1 | Migration applied — `capsule_external_shares` has `preview_text`, `preview_metadata`, `access_token` | **PASS** | All 14 expected columns present |
| 2 | Create share WITH `preview_text` — resolution returns it verbatim | **PASS** | `preview_text="Validation preview — 37 chars exact."` round-tripped exactly; `agent_enabled=true` |
| 3 | Create share WITHOUT `preview_text` — resolution returns `null` + `must_connect_api: true` | **PASS** | `preview_text=null`, `must_connect_api=true` |
| 4 | `preview_text` stored on `capsule_external_shares` only, not derived from `deals` | **PASS** | Resolution SELECT reads `capsule_external_shares` — no JOIN to `deals` |
| 5 | Bypass blocked — unauthenticated `GET /api/v1/deals/:id` returns 401 | **PASS** | Status 401 confirmed |
| 6 | Rate limiting — 429 returned after exceeding 5-per-10-min threshold | **PASS** | 429 triggered at loop attempt 4 (6th total resolution call from same IP, including steps 2+3 resolution calls) |
| 7 | Encryption present — `api_key_encrypted` column exists, `encryptToken(api_key)` called in connect_api handler | **PASS** | Column confirmed in `recipient_api_connections`; `encryptToken` call confirmed in source |
| 8 | Stripe metering — `stripe.billing.meterEvents.create` called in query handler | **PASS** | Two meter events (query count + token usage) confirmed in `recipient-agent-executor.service.ts` |

---

## Open Items / Follow-Up

| Item | Tracking |
|---|---|
| Recipient-side capsule landing page UI (`/capsule-link/:token`) | Task #899 |
| `connect_api` and `query` flows — full Piece 4 agent loop with frontend UI | Task #900 |
| Share management panel — list and revoke active shares from `CapsuleDetailPage` | Task #901 |
| `preview_metadata` structured-fields form | V1 ships plain-text pitch; structured fields default to `{}` |
| Bypass audit fixes 3–6 (campaign-level improvements) | Tracked in `docs/operations/recipient_bypass_audit_20260519_0809.md` |
