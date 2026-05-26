# Gmail OAuth Architecture Design
**Task #1054 — Investigation Only (no code changes)**
**Date:** 2026-05-25

---

## 1. Executive Summary

Gmail OAuth is **substantially already implemented** — this is not a greenfield build. The core auth flow, token storage, sync scheduler, route layer, and downstream email-intake pipeline are all present and wired up. The primary blockers to making it work in production are:

1. Missing environment secrets (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_GMAIL_CALLBACK_URL`)
2. A Google Cloud Console OAuth client that authorizes the production callback URI
3. A schema type mismatch between `user_email_accounts.id` (UUID) and `emails.email_account_id` (INTEGER)

Everything else documented here describes the existing design, known gaps, and the six design decisions operators must make before enabling OAuth for production users.

---

## 2. Existing Infrastructure Audit

### 2.1 Files and Responsibilities

| File | Role |
|---|---|
| `backend/src/services/gmail-sync.service.ts` | Core OAuth client, token refresh, message fetch, Inngest event emission |
| `backend/src/api/rest/gmail.routes.ts` | REST API: auth URL, callback, connect, accounts, sync, disconnect, emails, sync logs, diagnostics |
| `backend/src/auth/oauth.ts` | **Separate concern** — Passport.js Google strategy for user *login* (not Gmail sync) |
| `backend/src/services/email-sync-scheduler.ts` | Node.js `setInterval`-based background sync poller, started at server boot |
| `backend/src/agents/tools/read_gmail_thread.ts` | Fetches full Gmail thread + attachments using stored tokens; called from email-intake pipeline |
| `backend/src/inngest/functions/email-intake.function.ts` | 12-step durable Inngest pipeline: tier gate → dedupe → classify → OCR → extract → draft deal |
| `backend/src/api/rest/investor-capital.routes.ts` | Calls `gmailSyncService.sendEmail()` for capital-call distribution emails |
| `backend/src/services/cloud-storage/google-drive.adapter.ts` | Reuses `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` for Drive access |
| `backend/src/services/contacts-sync.service.ts` | Also uses same Google OAuth credentials |

### 2.2 Database Schema

#### `user_email_accounts` — Token Storage

| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | `gen_random_uuid()` |
| `user_id` | UUID | FK → users |
| `provider` | VARCHAR | Default `'google'` |
| `email_address` | VARCHAR | Connected Gmail address |
| `access_token` | TEXT | AES-256-GCM encrypted (`enc:v1:` prefix) — see §3, Decision 1 |
| `refresh_token` | TEXT | AES-256-GCM encrypted (`enc:v1:` prefix) — see §3, Decision 1 |
| `token_expires_at` | TIMESTAMPTZ | For 5-minute buffer refresh |
| `is_primary` | BOOLEAN | Default `false` |
| `sync_enabled` | BOOLEAN | Default `true` |
| `sync_frequency_minutes` | INTEGER | Default `15` |
| `last_sync_at` | TIMESTAMPTZ | Updated after each successful sync |

**Live row count: 0** — no accounts have been connected.

#### `emails` — Message Storage

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER (PK) | **Type mismatch with `user_email_accounts.id` — see §3.1** |
| `email_account_id` | INTEGER | Should be UUID — see §3.1 |
| `user_id` | UUID | |
| `external_id` | VARCHAR | Gmail message ID |
| `thread_id` | VARCHAR | Gmail thread ID |
| `subject`, `body_text`, `body_html`, `body_preview` | TEXT | |
| `from_address`, `from_name` | VARCHAR / TEXT | |
| `to_addresses`, `cc_addresses` | ARRAY | |
| `is_read`, `is_flagged`, `is_archived`, `has_attachments` | BOOLEAN | |
| `deal_id` | UUID | FK → deals (nullable) |
| `property_id` | INTEGER | FK → properties (nullable) |
| `extracted_properties` | JSONB | Auto-extraction results |

**Live row count: 230** — from previous test/demo data, not sourced from live Gmail.

#### `email_sync_logs` — Sync Audit Trail

| Column | Type |
|---|---|
| `id` | UUID |
| `account_id` | UUID |
| `sync_started_at`, `sync_completed_at` | TIMESTAMPTZ |
| `sync_status` | VARCHAR (`'running'` / `'success'` / `'failed'`) |
| `messages_fetched`, `messages_stored`, `messages_skipped` | INTEGER |
| `error_message` | TEXT |

**Live row count: 0.**

### 2.3 Auth Flow (How It Works Today)

```
User clicks "Connect Gmail"
  → GET /api/v1/gmail/auth-url  (requireAuth)
  → GmailSyncService.getAuthUrl(state, callbackUrl)
      State encodes: { userId, callbackUrl } as base64url JSON
      Scopes: gmail.readonly, gmail.send, userinfo.email, userinfo.profile
      access_type: 'offline', prompt: 'consent'
  → Frontend redirects browser to Google's consent screen

User approves permissions
  → Google redirects to: /api/v1/gmail/callback?code=...&state=...
  → Route decodes state → userId, callbackUrl
  → GmailSyncService.exchangeCodeForTokens(code, callbackUrl)
      Exchanges code for access_token + refresh_token
      Fetches email address via oauth2.userinfo.get()
      Validates scopes (gmail.readonly + userinfo.email required)
  → INSERT or UPDATE user_email_accounts row
  → Fire-and-forget: syncEmails(accountId, 50)
  → Redirect to: /dashboard/comms?connected=gmail&accountId=...
```

### 2.4 Two Parallel Google OAuth Flows

There are **two independent** Google OAuth configurations in the codebase that must both work, but serve different purposes:

| | Gmail Sync Flow | User Login Flow |
|---|---|---|
| **File** | `gmail-sync.service.ts` + `gmail.routes.ts` | `auth/oauth.ts` |
| **Library** | `googleapis` + `google-auth-library` | `passport-google-oauth20` |
| **Callback env var** | `GOOGLE_GMAIL_CALLBACK_URL` (preferred) | `GOOGLE_CALLBACK_URL` |
| **Callback path** | `/api/v1/gmail/callback` | `/api/v1/auth/google/callback` |
| **Purpose** | Connect a mailbox for sync | Log in / create JEDI RE account |
| **Token storage** | `user_email_accounts` | `users.google_id` |

Both consume the **same** `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Both callback URIs must be registered in the Google Cloud Console OAuth client.

### 2.5 Scheduled Sync

`EmailSyncScheduler` is a simple `setInterval`-based class that:
- Is **started on server boot** (`emailSyncScheduler.start(15)`) — line 1372 of `index.replit.ts`
- Runs every 15 minutes
- Queries all `user_email_accounts WHERE provider='google' AND sync_enabled=true`
- Calls `syncEmails()` for each account (respecting `sync_frequency_minutes` per account)
- Is **stopped on SIGTERM/SIGINT** — line 1618 of `index.replit.ts`

This means if GOOGLE credentials are set but the server restarts, sync resumes immediately and auto-syncs all connected accounts.

### 2.6 Email-Intake Pipeline (Inngest)

The 12-step durable function `email-intake-from-gmail` is triggered by the `gmail.message_received` event emitted during sync for every new INBOX message:

| Step | Name | Action |
|---|---|---|
| 1 | `tier-gate` | Reject Operator/Scout tiers — principal+/professional+/enterprise/institutional only |
| 2 | `dedupe-check` | Skip if `deals.deal_data->>'gmail_message_id'` already exists |
| 3 | `broker-filter` | Skip if sender domain not in user's `notification_preferences.broker_sender_domains` allow-list |
| 4 | `read-gmail-thread` | Full thread + MIME tree attachment extraction via `readGmailThread()` |
| 5 | `classify-email` | Claude: confidence > 0.7 required to continue |
| 6 | `ocr-attachments` | Up to 3 attachments, max 20 MB each |
| 7 | `extract-deal-fields` | Claude: structured field extraction (address, price, cap rate, etc.) |
| 8 | `score-fit` | Score against user's investment profile |
| 9 | `create-draft-deal` | INSERT deals row, `status='awaiting_review'`, `source='email_intake'` |
| 10 | `notify-user` | INSERT `deal_notifications` row |
| 11 | `emit-deal-created` | `step.sendEvent('deal.created')` → Research Agent chains |
| 12 | `write-audit-log` | INSERT `audit_log` row |

Concurrency: limit 3 per `user_id`. Retries: 3.

### 2.7 `gmail.send` Usage

`GmailSyncService.sendEmail()` is actively used (not dead code) — called from `investor-capital.routes.ts` to send capital call and distribution emails via the user's connected Gmail account. The `gmail.send` scope requested during OAuth is required for this use case.

---

## 3. Design Decisions

### Decision 1 — Token Encryption at Rest

**Status: ✅ DONE (Task #1068, 2026-05-26)**

**Former state:** `access_token` and `refresh_token` stored as plaintext TEXT columns in PostgreSQL.

**Risk mitigated:** A database dump or SQL injection attack previously exposed all user Gmail refresh tokens. A refresh token is indefinitely valid (until revoked) and grants full access to the user's Gmail account within the granted scopes.

**Implemented:** Option B — Application-layer AES-256-GCM encryption.

| Detail | Value |
|---|---|
| Algorithm | AES-256-GCM (authenticated encryption) |
| IV | 12 bytes (random per encryption) |
| Auth tag | 16 bytes |
| Storage format | `enc:v1:<base64(IV \| tag \| ciphertext)>` |
| Key env var | `GMAIL_TOKEN_ENCRYPTION_KEY` (32-byte, base64-encoded) |
| Backward compat | Values without `enc:v1:` prefix treated as legacy plaintext (safe rollout) |

**Files changed:**
- `backend/src/services/gmail-sync/token-encryption.ts` — new encryption module
- `backend/src/services/gmail-sync.service.ts` — decrypt on load (`syncEmails`, `sendEmail`), encrypt on write (`getValidAccessToken`)
- `backend/src/api/rest/gmail.routes.ts` — encrypt on INSERT/UPDATE, decrypt for revocation
- `backend/src/agents/tools/read_gmail_thread.ts` — decrypt before OAuth2 client setup
- `backend/src/services/contacts-sync.service.ts` — decrypt on load, encrypt on refresh write
- `backend/src/scripts/encrypt-gmail-tokens.ts` — idempotent re-encryption script for existing rows

**Re-encryption:** Run `cd backend && npx ts-node --transpile-only src/scripts/encrypt-gmail-tokens.ts` to encrypt any pre-existing plaintext rows. Safe to re-run (skips already-encrypted rows).

---

### Decision 2 — Polling vs. Gmail Push Notifications

**Current state:** `setInterval`-based polling every 15 minutes (configurable per account via `sync_frequency_minutes`). On-demand sync also available via `POST /api/v1/gmail/sync/:accountId`.

**Trade-offs:**

| | Polling (current) | Gmail Push (Pub/Sub) |
|---|---|---|
| Latency | Up to 15 min | Near real-time (seconds) |
| Infrastructure | None (uses setInterval) | Cloud Pub/Sub topic + subscription + webhook |
| Reliability | Retries on next interval | Needs Pub/Sub delivery guarantees |
| Cost | Gmail API quota consumption | Pub/Sub message costs (very low) |
| Complexity | Low | Medium — requires Google Cloud Pub/Sub, `watch()` calls, `historyId` tracking |
| Token refresh | Handled at sync time | Needed at watch-renewal time (every 7 days max) |

**For the deal-intake use case**, 15-minute latency is acceptable — broker OMs don't require sub-minute response. Push would only matter if JEDI RE needs to process emails within seconds of receipt (e.g., time-sensitive market alerts).

**Recommendation:** Keep polling for Phase 1. If real-time email intake becomes a product requirement, add Pub/Sub in a follow-up task. The Inngest pipeline is already idempotent and event-driven — plugging in a push trigger would require only the watch setup, not pipeline changes.

**Estimate (if push ever needed):** 3–5 days.

---

### Decision 3 — Multi-Account vs. Single-Account per User

**Current state:** The schema fully supports multiple Gmail accounts per user (`user_email_accounts` rows are `user_id` + `email_address` keyed, with `is_primary` flag). The route layer lists, syncs, and manages all accounts independently.

**UX question:** Should users be allowed to connect multiple Gmail addresses?

| | Single (enforce 1 per user) | Multi (current design) |
|---|---|---|
| Schema change | Require migration to add UNIQUE(user_id, provider) | No change |
| UI complexity | Simpler | Needs account picker in Comms UI |
| Deal attribution | Always clear | Which account sourced which email? |
| Broker OM coverage | Limited (1 inbox) | All broker inboxes synced |

**Recommendation:** Keep multi-account design — no schema change needed. The `is_primary` flag enables account picker UIs. The `email_account_id` FK on `emails` preserves per-account attribution. This is the correct design for a B2B real estate platform where users may have separate personal, firm, and investor-relations Gmail addresses.

---

### Decision 4 — Token Revocation on Disconnect

**Current state:** `DELETE /disconnect/:accountId` does:
```sql
DELETE FROM user_email_accounts WHERE id = $1
```
There is **no call to `https://oauth2.googleapis.com/revoke?token=<refresh_token>`**.

**Impact:** After disconnect, the OAuth token remains valid on Google's servers until it either:
- Expires (access token: 1 hour)
- Is manually revoked by the user via Google account settings
- Is superseded by a new auth grant for the same client + scope

A reconnection flow replaces the token (UPDATE on existing row), but a pure disconnect without revocation leaves the token live.

**Recommendation:** Add token revocation to the disconnect route before the DELETE. Pattern:
```typescript
// Before DELETE
if (account.refresh_token) {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${account.refresh_token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  }).catch(err => logger.warn('Token revocation failed (non-fatal):', err));
}
```
Revocation failure should be non-fatal — proceed with DELETE regardless, log the warning. This is the same pattern Microsoft flow uses (soft fail on disconnect).

**Estimate:** < 1 hour.

---

### Decision 5 — Callback URL Strategy

**Current state:** Three env var candidates are checked in priority order:
1. `GOOGLE_GMAIL_CALLBACK_URL` (dedicated Gmail callback — preferred)
2. `GOOGLE_REDIRECT_URI` (generic fallback)
3. `GOOGLE_CALLBACK_URL` (shared with Passport login callback — risky)
4. Request origin fallback: `{protocol}://{host}/api/v1/gmail/callback`

**Risk with fallback #4:** In Replit, the request origin is the proxied `*.replit.dev` host, which changes when the project is forked or republished. This makes the generated callback URL unpredictable and different from what Google Cloud Console expects, causing `redirect_uri_mismatch` errors.

**Risk with fallback #3 (`GOOGLE_CALLBACK_URL`):** This env var is also used by the Passport login flow (`/api/v1/auth/google/callback`). Sharing it between two different callback paths will break one or the other.

**Recommendation:** Always set `GOOGLE_GMAIL_CALLBACK_URL` explicitly. Never rely on request-origin fallback in production. Both Gmail callback and auth login callback must be registered as separate authorized redirect URIs in Google Cloud Console.

**Required production env vars:**
```
GOOGLE_CLIENT_ID          = <from Google Cloud Console>
GOOGLE_CLIENT_SECRET      = <from Google Cloud Console>
GOOGLE_GMAIL_CALLBACK_URL = https://<production-domain>/api/v1/gmail/callback
GOOGLE_CALLBACK_URL       = https://<production-domain>/api/v1/auth/google/callback
```

---

### Decision 6 — Scope Strategy

**Current state — scopes requested in `getAuthUrl()`:**
```
gmail.readonly
gmail.send
userinfo.email
userinfo.profile
```

**Current state — scopes validated in `validateGrantedScopes()`:**
```
gmail.readonly
userinfo.email     ← only these two are enforced
```

**Gap:** `gmail.send` and `userinfo.profile` are requested but not enforced. If a user approves only read-only permissions (e.g., through a restricted corporate Google Workspace), the connection succeeds — but capital call email sending via `sendEmail()` will fail at runtime with a 403.

**Google sensitivity classification:**
- `gmail.readonly` — **Sensitive** (requires OAuth app verification for external users)
- `gmail.send` — **Sensitive** (requires OAuth app verification)
- `userinfo.email`, `userinfo.profile` — **Non-sensitive** (no verification needed)

**Recommendation:** Add `gmail.send` to `REQUIRED_SCOPES`. If the user's Workspace blocks `gmail.send`, surface a clear error at connect-time rather than at capital-call send-time. This aligns user expectations with system capabilities.

**Note on Google App Verification:** Because the app requests sensitive Gmail scopes (`gmail.readonly`, `gmail.send`), **Google's OAuth consent screen will show a warning ("This app isn't verified")** to external Google accounts. For production with external users, the app must go through Google's OAuth verification process (typically 1–4 weeks). During development and testing, add test users to the OAuth client's "Test users" list to bypass verification.

---

## 4. Schema Bug — Type Mismatch

**Status: ✅ FIXED (Task #1067 + #1069, 2026-05-26)**

`emails.email_account_id` has been migrated from `INTEGER` to `UUID` and now carries a proper FK to `user_email_accounts(id) ON DELETE SET NULL`.

Migration applied: `backend/src/database/migrations/20260612_emails_account_id_uuid.sql`

What was done:
1. Dropped the old FK to the legacy `email_accounts` (integer) table
2. Nulled all legacy integer IDs (230 demo rows with no real Gmail linkage)
3. Changed column type to `UUID` (all-NULL at cast time, trivially safe)
4. Added new FK to `user_email_accounts(id) ON DELETE SET NULL`
5. Rebuilt `idx_emails_account` as a UUID btree index

The `::text = ::text` cast workaround in the `/emails` JOIN has been removed. The join now uses native UUID equality, which is index-eligible.

**Non-Gmail write paths (PST backflow, Microsoft mail):** these legitimately set `email_account_id = NULL` because they have no `user_email_accounts` row. This is correct permanent behavior, not a workaround.

---

## 5. Security Considerations

| Area | Current State | Risk | Mitigation |
|---|---|---|---|
| Token storage | ~~Plaintext in DB~~ AES-256-GCM encrypted | DB breach yields ciphertext only | ✅ Done — Task #1068 |
| Token revocation | Not implemented on disconnect | Revoked accounts can still be used via stale tokens | Add revocation call (Decision 4) |
| Callback URL | Falls back to request origin | SSRF / redirect_uri_mismatch in production | Set `GOOGLE_GMAIL_CALLBACK_URL` explicitly (Decision 5) |
| State parameter | base64url JSON with userId | No HMAC signature — state could be forged | Consider HMAC-signing state for CSRF protection |
| Scope enforcement | gmail.send not enforced | Silent runtime 403 on capital calls | Add gmail.send to REQUIRED_SCOPES (Decision 6) |
| Shared OAuth client | All services use same client ID | Scope creep — Drive, Contacts, Gmail all share one client | Acceptable for B2B SaaS; document clearly |
| Singleton OAuth client | `this.oauth2Client` shared across concurrent syncs | Race condition on `setCredentials()` | Create per-request client in `getGmailClient()` |

### Singleton Race Condition Detail

`GmailSyncService` holds `this._oauth2Client` as a singleton. `getGmailClient()` calls `this.oauth2Client.setCredentials(...)` before making API calls. If two concurrent syncs run for different accounts, one `setCredentials()` call can overwrite the other's credentials mid-flight. The fix is to call `createOAuthClient()` (which creates a new `OAuth2Client` instance) instead of reusing the singleton inside `getGmailClient()`. This is a low-effort, high-priority fix.

---

## 6. Google Cloud Console Prerequisites

Before Gmail OAuth will work in any environment, the following must be configured in Google Cloud Console:

### Step 1 — Create or Select a Project
- Go to [console.cloud.google.com](https://console.cloud.google.com)
- Create a new project (e.g., `jedi-re-production`) or select an existing one

### Step 2 — Enable APIs
Enable the following APIs in **APIs & Services → Library**:
- **Gmail API** — required for `gmail.readonly`, `gmail.send`
- **Google People API** — required for `userinfo.email`, `userinfo.profile`
- (Optional) **Google Drive API** — if Google Drive integration is active
- (Optional) **Google Contacts API** — if contacts sync is active

### Step 3 — Create OAuth 2.0 Credentials
- Go to **APIs & Services → Credentials**
- Click **Create Credentials → OAuth client ID**
- Application type: **Web application** (NOT Desktop — Desktop clients cannot do server-side code exchange)
- Add **Authorized redirect URIs**:
  ```
  https://<production-domain>/api/v1/gmail/callback
  https://<production-domain>/api/v1/auth/google/callback
  http://localhost:4000/api/v1/gmail/callback          (development)
  http://localhost:4000/api/v1/auth/google/callback    (development)
  ```
- Copy the **Client ID** and **Client Secret** → set as Replit secrets `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

### Step 4 — Configure OAuth Consent Screen
- Go to **APIs & Services → OAuth consent screen**
- User type: **External** (if non-Google Workspace users will connect) or **Internal** (Workspace-only)
- Fill in app name, support email, developer contact
- Add scopes:
  ```
  https://www.googleapis.com/auth/gmail.readonly
  https://www.googleapis.com/auth/gmail.send
  https://www.googleapis.com/auth/userinfo.email
  https://www.googleapis.com/auth/userinfo.profile
  ```
- **Test users:** Add developer emails during development to bypass the "unverified app" warning

### Step 5 — App Verification (Production)
Because `gmail.readonly` and `gmail.send` are **Sensitive** scopes:
- Production external users will see an "unverified app" warning until Google verifies the app
- Verification requires: privacy policy URL, OAuth use case justification, potentially a demo video
- Timeline: 1–4 weeks for initial review
- During verification, test users added to the consent screen bypass the warning

### Step 6 — Set Replit Secrets
```
GOOGLE_CLIENT_ID          = <client ID from Step 3>
GOOGLE_CLIENT_SECRET      = <client secret from Step 3>
GOOGLE_GMAIL_CALLBACK_URL = https://<production-domain>/api/v1/gmail/callback
GOOGLE_CALLBACK_URL       = https://<production-domain>/api/v1/auth/google/callback
```

---

## 7. Phased Implementation Plan

### Phase 1 — Make It Work (Blocker fixes, ~3–4 days)

| # | Task | File | Effort | Status |
|---|---|---|---|---|
| P1-1 | Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_GMAIL_CALLBACK_URL`, `GOOGLE_CALLBACK_URL` as Replit secrets | Secrets panel | 1 hour | ✅ DONE (2026-05-25) |
| P1-2 | Register both callback URIs in Google Cloud Console OAuth client | GCC | 30 min | ⏳ USER ACTION NEEDED |
| P1-3 | Enable Gmail API + People API in GCC | GCC | 15 min | ⏳ USER ACTION NEEDED |
| P1-4 | Add test users to OAuth consent screen (developer emails) | GCC | 15 min | ⏳ USER ACTION NEEDED |
| P1-5 | Fix singleton race condition in `GmailSyncService.getGmailClient()` + `refreshAccessToken()` | `gmail-sync.service.ts` | 30 min | ✅ DONE (2026-05-25) — both methods now create fresh `OAuth2Client` per call |
| P1-6 | Fix schema type mismatch: `emails.email_account_id` UUID migration | `20260612_emails_account_id_uuid.sql` + `gmail.routes.ts`, `inbox.routes.ts`, `inline-inbox.routes.ts`, `microsoft.routes.ts`, `pst-backflow.service.ts` | 1 hour | ✅ DONE (2026-05-25) — column is now `UUID REFERENCES user_email_accounts`; non-Gmail write paths set NULL (tracked in task #1069) |
| P1-7 | Add `gmail.send` to `REQUIRED_SCOPES` | `gmail-sync.service.ts` | 15 min | ✅ DONE (2026-05-25) |
| P1-8 | Add token revocation on disconnect | `gmail.routes.ts` | 30 min | ✅ DONE (2026-05-25) — revoke via `https://oauth2.googleapis.com/revoke`, non-fatal on failure |
| P1-9 | End-to-end test: connect Gmail, sync emails, verify pipeline fires | dev environment | 2 hours | ⏳ BLOCKED — requires P1-2/P1-3/P1-4 (GCC setup) |

### Phase 2 — Harden (Security + Ops, ~2–3 days)

| # | Task | Effort |
|---|---|---|
| P2-1 | AES-256 token encryption in `user_email_accounts` | ✅ DONE (Task #1068, 2026-05-26) |
| P2-2 | HMAC-sign OAuth state parameter (CSRF protection) | 2 hours |
| P2-3 | Inngest cron job to renew scheduler (replace `setInterval` with Inngest cron for restart-safe scheduling) | 1 day |
| P2-4 | Alerting on sync failures (`email_sync_logs WHERE sync_status='failed'`) | 4 hours |

### Phase 3 — Scale (Optional, post-MVP)

| # | Task | Notes |
|---|---|---|
| P3-1 | Gmail Push Notifications via Cloud Pub/Sub | Near-real-time sync; requires historyId tracking |
| P3-2 | Google App Verification for production external users | 1–4 week Google review process |
| P3-3 | Per-tenant Google Cloud project isolation | Enterprise multi-tenancy requirement |

---

## 8. Open Questions

| # | Question | Stakeholder |
|---|---|---|
| OQ-1 | Does a Google Cloud Console project already exist for JEDI RE? If so, which project ID? | Engineering / DevOps |
| OQ-2 | Is the OAuth consent screen configured as "External" or "Internal"? All users must be within the same Google Workspace for Internal. | Product |
| OQ-3 | What is the production domain (for registering authorized redirect URIs)? | DevOps |
| OQ-4 | Should Google App Verification be initiated now, or will Gmail be beta/internal-only for the near term? | Product / Legal |
| OQ-5 | Is token encryption at rest a hard security requirement (affects Phase 1 vs. Phase 2 sequencing)? | Security |
| OQ-6 | Should the email intake pipeline fire for all tiers in future, or remain Principal+/Professional+/Enterprise only permanently? | Product |
| OQ-7 | The `setInterval` scheduler does not survive process restarts cleanly — should this be migrated to an Inngest cron (already in-stack) for durability? | Engineering |
| OQ-8 | Are the 230 existing `emails` rows real data or test stubs? If real, the `email_account_id` type migration needs careful handling. | Data |
| OQ-9 | Should Google Drive and Contacts OAuth (which share the same client credentials) be in-scope for this rollout, or treated separately? | Product |

---

## 9. Implementation Effort Summary

| Phase | Scope | Calendar Estimate |
|---|---|---|
| Phase 1 (Blocker fixes) | Env secrets + GCC setup + 5 code fixes | 3–4 days |
| Phase 2 (Hardening) | Token encryption + CSRF + durable scheduler + alerting | 2–3 days |
| Phase 3 (Scale) | Push notifications + App Verification | 1–4 weeks (verification gated on Google) |
| **Total to production-ready** | Phase 1 + Phase 2 | **~6–7 working days** |

Phase 1 alone unblocks end-to-end OAuth flow for development/internal testing. Phase 2 is required before exposing Gmail connect to external customers.
