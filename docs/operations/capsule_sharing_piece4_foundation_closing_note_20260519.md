# Capsule Sharing Piece 4 (Foundation) closing note — 2026-05-19

## Background
Piece 4 — Non-platform recipient with connect-your-API — is the strategically most important piece of Capsule Sharing. Tonight's scope was the foundation: schema, access token infrastructure, share creation/capsule resolution endpoints, and API key connection stubs.

## Investigation
- No existing `capsule_shares`, `recipient_api_connections`, or `recipient_query_log` tables
- No existing share creation or capsule resolution endpoints
- Existing Deal Capsule routes at `/api/v1/capsules` are the property deal-capsule infrastructure (separate from capsule sharing)
- No existing access token infrastructure

## Changes Applied

### Migration: `20260519_capsule_sharing.sql`
(shared with Piece 1 — detailed in that closing note)

### New file: `capsule-sharing.routes.ts`
Added 6 endpoints:

**Share creation:**
- **`POST /:dealId/share/external`** — creates external share with recipient email + settings
  - Validates deal ownership, share type, required fields
  - Generates cryptographically random access token (32 bytes → hex → SHA-256 hash for storage)
  - Returns share_id, capsule URL with raw token, created_at
  - Logs via `logger.info`

**Capsule resolution:**
- **`GET /capsules/:accessToken`** — resolves an access token to deal metadata
  - Hashes provided token and looks up in DB (tokens stored as hashes, never raw)
  - Checks not revoked, not expired
  - Returns deal summary respecting share settings
  - Agent status: returns stub message ("agent interaction requires connecting API key")

**API key connection (stub):**
- **`POST /capsules/:accessToken/connect_api`** — accepts provider + api_key
  - Validates provider (anthropic, openai), share exists and is active
  - Stores placeholder encrypted key in `recipient_api_connections`
  - Does NOT validate the key against the provider (stub)
  - Does NOT set up Stripe Token Billing wrapper (stub)

**API key disconnection:**
- **`DELETE /capsules/:accessToken/connect_api`** — sets `disconnected_at`
  - Works even if the key was never validated

**Share listing & revocation:**
- **`GET /:dealId/shares`** — lists all shares for a deal (owner only)
- **`POST /:dealId/shares/:shareId/revoke`** — revokes a share (sets `revoked_at`)

### New file: `msa-resolver.service.ts`
(shared with Task 1 — detailed in W-07 closing note)

### Updated: `index.replit.ts`
- Capsule-sharing routes mounted at `/api/v1/deals` (auth-protected for deal-scoped paths) and `/api/v1` (token-based for capsule-resolution paths, no auth middleware)

## Verification
- TypeScript compilation: 0 new errors
- Migration: creates 4 tables with all columns, indexes, constraints per spec §6.5
- Share creation: returns share_id + capsule URL + raw token (sender shares this with recipient)
- Capsule resolution: returns deal summary with share settings, stubbed agent status
- API key connection: creates row in `recipient_api_connections` with placeholder

## Open items (spec §14 Q1-Q6)
- Q1 (API providers): shipped with anthropic + openai support; add others based on demand
- Q2 (anonymized patterns): not implemented — follow-up
- Q3 (sender re-run stale state): not enforced — follow-up
- Q4 (pitch decks): Piece 5 — not started
- Q5 (multi-property): deferred per spec recommendation
- Q6 (self-contained responses): not wired — follow-up

## Remaining (follow-up — estimated 3-4 additional sessions)
1. **API key validation** — test key against Anthropic/OpenAI before storing
2. **Stripe Token Billing wrapper** — connect existing `@stripe/token-meter` infrastructure to non-subscriber use case
3. **Recipient-scoped agent runtime** — `buildRecipientDealContext()` with sender data scrubbed
4. **Conversation funnel UI** — triggers at usage thresholds
5. **Privacy compliance** — query content not stored enforcement
6. **Multi-provider support** — expand beyond Anthropic
