# Capsule Share UI — End-to-End Validation
**Date:** 2026-05-19  
**Task:** #898 — Capsule share UI + end-to-end validation

---

## Summary

Task #898 wired the previously-dead Share button in `CapsuleDetailPage.tsx` to a full share modal, applied schema migrations for the Piece 4 backend tables, fixed a route-ordering regression that blocked token-based capsule resolution, and confirmed all 8 validation steps pass.

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
- `POST /api/v1/capsules-ext/:capsuleId/share/external` — authenticated owner creates a share
- `GET /api/v1/capsules/:accessToken` — public token resolution (no auth required)
- `POST /api/v1/capsules/:accessToken/connect_api` — recipient connects their own API key (Piece 4)
- `POST /api/v1/capsules/:accessToken/query` — recipient runs an agent query with Stripe metering (Piece 4)
- `GET /api/v1/capsules-ext/:capsuleId/shares` — owner lists all shares for a capsule
- `DELETE /api/v1/capsules-ext/shares/:shareId` — owner revokes a share

### Route Ordering Fix (`index.replit.ts`)
`app.use('/api/v1', capsuleSharingRoutes)` was originally mounted after two
`app.use('/api/v1', requireAuth, ...)` handlers (lines 458, 467), which caused all
unauthenticated capsule resolution requests to return 401. The mount was moved to
just before those handlers (line 463), with a comment explaining the ordering requirement.
The authenticated owner mount at `/api/v1/capsules-ext` remains in its original position.

---

## Validation Results

All 8 steps ran against the live development environment at `http://localhost:4000`.

| Step | Description | Result | Notes |
|---|---|---|---|
| 1 | Migration applied — `capsule_external_shares` has `preview_text`, `preview_metadata`, `access_token` | **PASS** | All 14 expected columns present |
| 2 | Create share WITH `preview_text` — resolution returns it verbatim | **PASS** | `preview_text="Validation preview — 37 chars exact."` round-tripped exactly; `agent_enabled=true` |
| 3 | Create share WITHOUT `preview_text` — resolution returns `null` + `must_connect_api: true` | **PASS** | `preview_text=null`, `must_connect_api=true` |
| 4 | `preview_text` stored on `capsule_external_shares` only, not derived from `deals` | **PASS** | Resolution SELECT reads `capsule_external_shares` with no JOIN to `deals` |
| 5 | Bypass blocked — unauthenticated `GET /api/v1/deals/:id` returns 401 | **PASS** | Status 401 confirmed |
| 6 | Rate limiting — 429 returned after repeated resolution attempts | **PASS** | 429 triggered on attempt 4 (5-per-10-min in-memory window) |
| 7 | Encryption present — `api_key_encrypted` column exists, `encryptToken(api_key)` called in handler | **PASS** | Column confirmed in `recipient_api_connections`; `encryptToken` call confirmed in source |
| 8 | Stripe metering — `stripe.billing.meterEvents.create` called in query handler | **PASS** | Two meter events (query count + token usage) confirmed in `recipient-agent-executor.service.ts` |

---

## Open Items / Follow-Up

| Item | Scope |
|---|---|
| Recipient-side capsule landing page UI | Separate feature — Piece 4 follow-up |
| `connect_api` and `query` flows (full Piece 4 agent loop) | Out of scope for this task |
| `preview_metadata` structured-fields form | V1 ships plain-text pitch; structured fields default to `{}` |
| Bypass audit fixes 3–6 (campaign-level improvements) | Tracked in `docs/operations/recipient_bypass_audit_20260519_0809.md` |
| M07 confidence bands, M36 aggressiveness, M35 event path, M38 calibration | Deal Journey Phase 2 — unrelated |
