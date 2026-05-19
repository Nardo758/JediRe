# Piece 4 Production Readiness — Closing Note

## Background
Three production readiness gaps remained after the initial Piece 4 foundation (capsule_shares schema, recipient_api_connections, recipient agent runtime):

1. **API key encryption**: Keys stored as `base64(api_key)` with an `encrypted:` prefix — obfuscated but not encrypted. Full AES-256-GCM required.
2. **Stripe Token Billing wrapper**: Per-query costs were calculated and logged to the DB but never pushed to Stripe for billing.
3. **Privacy audit**: `buildRecipientDealContext()` explicitly nulls sender-private fields but needed downstream confirmation that no path leaks private data.

## 1. AES-256-GCM Encryption Upgrade

### Before
```typescript
const encryptedKey = Buffer.from(api_key).toString('base64');
// stored as: `encrypted:${base64Key}` — NOT actually encrypted
```

### After
```typescript
import { encryptToken, decryptToken } from '../../services/encryption';
// encryptToken() produces: `iv:authTag:ciphertext` hex format
const encryptedKey = encryptToken(api_key);
```

**File changes:**
- `capsule-sharing.routes.ts`: imports `encryptToken` from `services/encryption`, calls it on write
- `recipient-agent-executor.service.ts`: imports `decryptToken`, decrypts key on read instead of prefix-stripping

**Notes:**
- The `services/encryption.ts` module already existed — AES-256-GCM, `TOKEN_ENCRYPTION_KEY` env var, `encryptToken`/`decryptToken` functions
- The `TOKEN_ENCRYPTION_KEY` must be set to a 64-character hex string (or 32-byte UTF-8 string) for the encryption to work
- If the encryption key is not set, `encryptToken()` throws on `connect_api` — preventing unencrypted storage
- Error handling: `decryptToken` failure returns a clear message ("key may have been corrupted or encryption key rotated")

### Key storage format (in `recipient_api_connections.api_key_encrypted`):
```
iv_hex:auth_tag_hex:ciphertext_hex
```
Each component is hex-encoded. The `encrypted:` prefix is removed.

### Rotation safety
- Encrypted keys survive key rotation as long as the same key remains in `TOKEN_ENCRYPTION_KEY`
- Key rotation requires re-encrypting all stored keys (out of scope — documented as future work)

## 2. Stripe Token Billing Wrapper

### Design Decision: Fixed per-query fee, not LLM token pass-through

Since the recipient brings their own API key, the LLM cost is paid by the recipient directly to Anthropic/OpenAI. The Stripe billing is for the **platform margin** (context building, routing, metering) — not the LLM inference cost.

**Meter events created:**
| Event name | Payload | Purpose |
|-----------|---------|---------|
| `capsule_query_count` | value=1 | Per-query metered billing (fixed fee per query) |
| `capsule_input_tokens` | value={count} | Informational — enables future per-token pricing |
| `capsule_output_tokens` | value={count} | Informational — enables future per-token pricing |

### Flow
1. `connect_api` — creates a Stripe Customer (by email, looks up existing first)
2. `POST /capsules/:accessToken/query` — after each successful agent call:
   1. Log usage to DB (always, even if Stripe fails)
   2. Report 3 meter events to Stripe
   3. Update connection counters
3. Stripe invoices the Stripe Customer based on meter event usage (configured in Stripe Dashboard — not in platform code)

### Stripe meter setup (one-time, manual)
Create three meters in Stripe Dashboard:
- `capsule_query_count` — 1 unit = 1 query
- `capsule_input_tokens` — future use
- `capsule_output_tokens` — future use

Configure pricing in Stripe (e.g., $0.05/query for `capsule_query_count`).

### Stripe customer lifecycle
- Created with metadata `source: 'capsule_share'` + `share_id`
- Linked to `recipient_api_connections.stripe_customer_id`
- NOT linked to platform `user_credit_balances` (different billing model — recipients aren't platform subscribers)

### Error handling
- Stripe failures are **non-fatal** — the query still succeeds
- logger.warn on failure — operations can detect and retry
- DB logging ensures no data loss even if Stripe is down

## 3. Privacy Audit

### Audit scope
Audit `buildRecipientDealContext()` and `executeRecipientQuery()` for any path where sender-private data reaches the recipient.

### Data flow trace

| Step | What data | Sender-private? | Audit finding |
|------|-----------|-----------------|---------------|
| Query: `deals` table | deal name, city, state, property_type, total_units, year_built, msa_id | No — these are property characteristics | ✅ Clean — only deal-scoped attributes returned |
| Query: `capsule_shares` | scenario_id (nullable) | No — only shared scenario | ✅ Clean — LIMIT 1 to shared scenario only |
| Query: `deal_scenarios` | scenario_data | No — only the shared scenario | ✅ Clean — only shared scenario |
| Query: `deals.deal_data->'source_documents'` | file_id, filename, document_type, extracted_at, key_fields | No — document metadata | ✅ Clean — filename and metadata only, no raw content |
| Import: `cycleIntelligenceService.getCyclePhase()` | market cycle phase | No — public market data | ✅ Clean |
| Query: `deal_assumptions` evidence cohort_context | cohort baseline P50, n, delta, status | No — derived comparisons | ✅ Clean — aggregated comparison, no raw values |
| **Explicit nulls** | `sender_owned_portfolio`, `other_scenarios`, `full_knowledge_graph`, `other_deals` | **Yes — these are sender-private** | ✅ **Explicitly set to null in type + return** |
| Return type: `RecipientDealContext` | All of the above | No | ✅ Type prevents accidental inclusion of fields not in the interface |
| System prompt | Rendered from context | No | ✅ Only context fields appear in prompt |

### Verdict
**Green.** No path exists for sender-private data to reach the recipient agent runtime.

### What's protected
- 🔒 **Sender's owned portfolio** — not fetched from `owned_portfolio` table
- 🔒 **Other deals** — query is scoped to `deals WHERE id = $1` with the deal_id from the share
- 🔒 **Other scenarios** — only the shared scenario (if any) is fetched, limited to `WHERE scenario_id = $1`
- 🔒 **Full knowledge graph** — no KG query issued
- 🔒 **Document content** — source_documents returns metadata only (filenames, types); no file content is read or included
- 🔒 **Sender's email/identity** — no sender information is included in the response or context

### One caution (not a gap, but worth noting)
The `RecipientDealContext` interface is structurally typed. If a future developer adds a new field to the return object and forgets to null it, recipient might see it. Mitigation: the return type is explicitly typed as `RecipientDealContext`, so TypeScript will enforce the shape. The explicit `// Privacy-scrubbed` comment block in the return statement adds a team-readable marker.

## Remaining (cascaded)

These are intentional deferrals, not gaps:

1. **Conversion funnel UI** — frontend for the connect-your-API flow with Stripe sign-up → "Coming in iteration 2"
2. **Multi-provider support beyond Anthropic** — OpenAI wired but GPT-4o model hardcoded. Add AWS Bedrock, Google AI, Groq
3. **Key rotation endpoint** — allow recipient to rotate their API key without re-sharing the capsule
4. **Per-token pricing model** — current model is per-query with token data collected for future pricing changes
5. **Conversion funnel automation** — $0-initial-request program, subscription upsells at usage thresholds (spec §14 Q3)
6. **Idempotency keys** — prevent duplicate charges on network retries
7. **Rate limiting** — per-connection, per-capsule, and per-recipient limits
8. **Stripe meter setup automation** — currently manual (Stripe Dashboard). Could automate via API
9. **$0 initial request flow** — allow first query free to demonstrate value before requiring API key
