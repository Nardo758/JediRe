# B2b — Account-Origin Paths: Phase 1 Verdict

**Status: PHASE 1 COMPLETE — awaiting approval before Phase 2 builds.**

---

## Path 1 — Web Signup (GAP: handler missing)

**Frontend call:** `api.ts:100` → `POST /api/v1/auth/register`  
**Router mount:** `index.replit.ts:222` → `app.use('/api/v1/auth', authLimiter, authRouter)` where `authRouter` = `inline-auth.routes.ts`  
**Handler exists?** **NO.** `inline-auth.routes.ts` has `POST /login`, `GET /dev-login`, `GET /me`, `PUT /profile`, and password-reset routes — but **no `POST /register`**. Signup returns 404 today.

**Gap to fix in Phase 2:**  
Build `POST /register` in `backend/src/api/rest/inline-auth.routes.ts`. The handler must run in a transaction:

```
INSERT INTO users (email, full_name, password_hash, email_verified, role)
INSERT INTO organizations (name, slug, owner_id)
INSERT INTO org_members (org_id, user_id, role='owner')
INSERT INTO org_credit_balances (org_id, subscription_tier='scout', credits_included_monthly=100, ...)
UPDATE users SET default_org_id = new_org.id WHERE id = new_user.id
→ return JWT token
```

Org name = first name + "'s Organization" (or email prefix if no name). `default_org_id` set in the same transaction.

---

## Path 2 — Bridge/Chat (confirmed B1 gap)

**File:line:** `backend/src/services/chat/sessionStore.ts:64–80`  
**What it does today:** `INSERT INTO users (email, role, email_verified, user_type)` — then immediately returns `{ userId }`. No organization, no org_members row, no default_org_id.

```typescript
// sessionStore.ts:65–72 — creates user row only, nothing else
const newUser = await query(
  `INSERT INTO users (email, role, email_verified, user_type)
   VALUES ($1, 'investor', false, 'human_sponsor')
   RETURNING id`,
  [`${platform}_${platformUserId}@chat.jedire.com`]
);
const userId = newUser.rows[0].id;
// ← org creation is MISSING here
```

**Fix in Phase 2:** Wrap the `INSERT INTO users` in a transaction and also create org + org_members + org_credit_balances + set `users.default_org_id`. Identical shape to the signup path: a WhatsApp/SMS user becomes an org-of-one owner, exactly like a web signup.

---

## Path 3 — Invite (scaffold EXISTS, two gaps)

The invite mechanism is **already built** in `org.routes.ts`. What exists:

| Piece | File:line | Status |
|---|---|---|
| `org_invitations` table (id, org_id, email, role, token, invited_by, status, expires_at, accepted_at) | `db/schema/org.ts:41–56` + applied migration | ✅ exists |
| `POST /:orgId/invitations` — token generation, dedup check, 7-day expiry, store row | `org.routes.ts:117–162` | ✅ exists |
| `POST /invitations/:token/accept` — email match, create org_members row, mark accepted, idempotent re-accept guard | `org.routes.ts:182–238` | ✅ exists |
| `GET /:orgId/invitations` — list pending | `org.routes.ts:164–180` | ✅ exists |
| Token pattern | `crypto.randomBytes(32).toString('hex')` stored plaintext with UNIQUE constraint (same as org.routes) vs SHA-256 hashed for password-reset | ✅ fine for non-credential invite token |

**Two gaps to fill in Phase 2:**

1. **No email sent** — `org.routes.ts:117–162` creates the invite record and returns `accept_url` but never calls `emailService`. Need to add `emailService.sendOrgInvitation(data.email, { inviterName, orgName, acceptUrl })` after the INSERT, plus an HTML/text template in `email.service.ts` (matching the existing `buildShareInvitationHtml` / `buildPasswordResetHtml` pattern).

2. **No Institutional-only gate** — the route is guarded by `requireOrgRoleForOrg('principal')` but doesn't check whether the org is on the Institutional tier. Add inside `POST /:orgId/invitations` (at `org.routes.ts:117`):
   ```sql
   SELECT subscription_tier FROM org_credit_balances WHERE org_id = $1
   ```
   If `subscription_tier !== 'institutional'` → `403 { error: 'Invitations are available on the Institutional tier only' }`.

---

## default_org_id field

**Does it exist?** **NO.** Confirmed: `column "default_org_id" does not exist` on the `users` table.

**Decision:** Add `users.default_org_id UUID NULL REFERENCES organizations(id)`.

**Migration in Phase 2:**
```sql
ALTER TABLE users ADD COLUMN default_org_id UUID NULL REFERENCES organizations(id);

-- Backfill: post-B1, every user has 0 or 1 org membership — unambiguous.
UPDATE users u
SET default_org_id = (
  SELECT org_id FROM org_members om
  WHERE om.user_id = u.id
  LIMIT 1
)
WHERE default_org_id IS NULL;
-- Result: Leon → dd201183-3cb5-45dd-8485-d17f5a053421. All other users → NULL (no org yet, gets one at next login or bridge event).
```

---

## Resolution Replacement

**Current site:** `backend/src/services/ai/orgCreditService.ts:27` — `resolveOrgForUser(userId)`

```typescript
// Current — arbitrary LIMIT 1:
SELECT org_id FROM org_members WHERE user_id = $1 LIMIT 1
```

**Replacement in Phase 2:**

```typescript
// New — deterministic: session-active-org ?? default_org_id ?? (legacy fallback to org_members LIMIT 1)
SELECT default_org_id FROM users WHERE id = $1
```

Resolution order (Phase 2):
1. `session_active_org_id` — not yet populated (switcher deferred); will always be NULL in B2b
2. `users.default_org_id` — set at signup / bridge / backfill; deterministic
3. Fallback `org_members LIMIT 1` — safety net for any user who slips through before backfill; logged as a warning

This is switcher-ready: when the workspace-switcher UI is built, it sets `session_active_org_id` in the request context. The resolution site here already reads it first — nothing else changes.

---

## Institutional-only Gate Location

**Handler:** `backend/src/api/rest/org.routes.ts:117` — `POST /:orgId/invitations`  
**Gate query:** `SELECT subscription_tier FROM org_credit_balances WHERE org_id = $1`  
**Condition:** `tier !== 'institutional'` → `403`  
**Why `org_credit_balances` and not `organizations`?** `org_credit_balances.subscription_tier` is the authoritative tier field (B2a established this; it's what the gate reads). `organizations` has no `tier` column.

---

## Invite Table Design — Already Correct

`org_invitations` (`db/schema/org.ts:41–56`) already has everything needed:

```
id             UUID PK
org_id         UUID FK → organizations
email          VARCHAR(255)       ← invitee email
role           VARCHAR(20)        ← 'analyst' default
token          VARCHAR(64) UNIQUE ← crypto.randomBytes(32).hex()
invited_by     UUID FK → users
status         VARCHAR(20)        ← 'pending' | 'accepted' | 'expired'
expires_at     TIMESTAMP          ← +7 days
accepted_at    TIMESTAMP NULL
created_at     TIMESTAMP
```

The accept flow (`org.routes.ts:182–238`) already:
- Validates token + expiry
- Checks email matches authenticated user
- Inserts `org_members (org_id, user_id, role, invited_by)`
- Marks invite `accepted`
- Is idempotent (re-accept of already-joined member is a no-op)

**One gap on accept:** When the invitee accepts, they will now be in 2 orgs (their own solo org + the inviter's org). Their `default_org_id` stays pointing to their solo org — which is correct. The invitee's own AI usage resolves to their solo org; the invite just gives them ACCESS to the inviter's org. No `default_org_id` change on accept.

---

## Email Infrastructure

**File:** `backend/src/services/email.service.ts`  
**Provider:** Resend (auto-detected from `RESEND_API_KEY` — integration installed)  
**Pattern to reuse:**

```typescript
// In email.service.ts — add alongside existing templates:
function buildOrgInvitationHtml(params: { inviterName, orgName, acceptUrl, expiresAt }): string { ... }
function buildOrgInvitationText(params: ...): string { ... }
// In emailService object:
sendOrgInvitation(params: { to, inviterName, orgName, acceptUrl, expiresAt }): Promise<boolean>
```

Then call from `org.routes.ts:149` (after the INSERT, before the response):
```typescript
await emailService.sendOrgInvitation({
  to: data.email,
  inviterName: req.user!.email,  // improved with JOIN to users.full_name in Phase 2
  orgName: org.name,             // need one extra SELECT or pass from middleware
  acceptUrl: `${baseUrl}/accept-invite?token=${token}`,
  expiresAt: expiresAt.toISOString(),
});
```

---

## Summary — Three Paths, Current State, and Fixes

| Path | Current state | Gap | Fix |
|---|---|---|---|
| **Web signup** | `POST /api/v1/auth/register` handler missing — 404 | No user, no org | Build handler in `inline-auth.routes.ts` — transaction: users + organizations + org_members + org_credit_balances + default_org_id |
| **Bridge/chat** | `sessionStore.ts:65` creates users row only | No org (B1 gap confirmed) | After INSERT users, also create org + org_members + org_credit_balances + set default_org_id |
| **Invite** | `org.routes.ts:117–238` token + accept flow exists | No email sent; no Institutional gate | Add email send + Institutional-only check; accept path already sets org_members correctly |

| Field | Current state | Fix |
|---|---|---|
| `users.default_org_id` | Column does NOT exist | `ALTER TABLE users ADD COLUMN default_org_id UUID REFERENCES organizations(id); backfill` |
| Resolution | `LIMIT 1` on `org_members` (arbitrary) | `SELECT default_org_id FROM users WHERE id = $1` with LIMIT 1 fallback + warning |

---

## Phase 1 Questions for Approval

1. **Signup org name** — use `{firstName}'s Organization` (fallback: email prefix)? Or just `Personal`?
2. **Invite email sender name** — `org.routes.ts` currently only has `req.user!.userId`. Should the invite email use `full_name` (requires JOIN to `users`) or just the email address?
3. **Accept redirect** — the accept URL resolves to `/accept-invite?token=...`. Does a frontend page for this exist, or should Phase 2 also build it?
4. **Bridge user org name** — bridge users get a synthetic email like `whatsapp_+15555551234@chat.jedire.com`. Org name could be `WhatsApp Contact` (platform-specific) or `{platform} {platformUserId}'s Organization`. Which?

**Approval grants Phase 2 to build: migration (default_org_id + backfill), signup handler, bridge org creation, Institutional gate, invite email, and resolution replacement.**
