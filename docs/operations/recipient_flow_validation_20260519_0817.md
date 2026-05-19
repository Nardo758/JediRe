# RECIPIENT FLOW VALIDATION — Piece 4

**⚠️ Not executed against live backend** — no `.env` or running server in local workspace.
This document is the **validation plan + expected results** derived from code review.
A human with Replit shell access should execute the curl commands below and fill in results.

---

## Prerequisites

- A Replit shell session on the running backend
- A test deal (use an existing deal or create one)
- A test Anthropic API key (separate from the platform's main key)
- A test OpenAI API key (optional for multi-provider testing)
- Stripe test mode API key in environment

---

## Step 1 — Create an external capsule share

### Command
```bash
# Replace :dealId with an existing deal
# Set :authToken to the authenticated user's JWT
DEAL_ID="your-test-deal-uuid"
AUTH_TOKEN="your-jwt-token"

# Create share WITH preview
curl -X POST "https://your-repl.replit.app/api/v1/deals/${DEAL_ID}/share/external" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_email": "test-recipient@example.com",
    "recipient_name": "Test Recipient",
    "share_type": "external_agent_enabled",
    "allow_document_download": true,
    "allow_agent_interaction": true,
    "preview_text": "Charlotte CBD — 180-unit garden-style, strong in-fill market with 8% rent growth. Value-add play with ~200bps NOI upside from renovated units.",
    "preview_metadata": {
      "strategy": "Value-Add",
      "asset_class": "Multifamily",
      "region": "Southeast",
      "deal_size_range": "$15M-$30M"
    }
  }'

# Create share WITHOUT preview (existing behavior test)
curl -X POST "https://your-repl.replit.app/api/v1/deals/${DEAL_ID}/share/external" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_email": "test-recipient-no-preview@example.com",
    "share_type": "external_agent_enabled",
    "allow_agent_interaction": true
  }'
```

### Expected response
```json
{
  "share_id": "uuid-here",
  "capsule_url": "https://your-repl.replit.app/capsules/64-char-hex-token",
  "access_token": "64-char-hex-token",
  "recipient_email": "test-recipient@example.com",
  "share_type": "external_agent_enabled",
  "expires_at": null,
  "created_at": "2026-05-19T..."
}
```

### DB verification
```sql
SELECT share_id, share_type, recipient_email, access_token, revoked_at
FROM capsule_shares
WHERE recipient_email = 'test-recipient@example.com';
```

Expected: `access_token` is a SHA-256 hash (64 hex chars), NOT the raw token.
Expected: `revoked_at` is null.
Expected: 66 chars in access_token (SHA-256 = 64 hex chars). Raw token is 64 chars.

### Actual result
```

```

---

## Step 2 — Resolve the capsule as a recipient

### Command
```bash
ACCESS_TOKEN="64-char-hex-token-from-step-1"

curl -s "https://your-repl.replit.app/api/v1/capsules/${ACCESS_TOKEN}"
```

### Expected response (with preview)
```json
{
  "share_exists": true,
  "share_type": "external_agent_enabled",
  "recipient_email": "test-recipient@example.com",
  "allow_document_download": true,
  "allow_agent_interaction": true,
  "expires_at": null,
  "agent_enabled": true,
  "preview_text": "Charlotte CBD — 180-unit garden-style, strong in-fill market with 8% rent growth. Value-add play with ~200bps NOI upside from renovated units.",
  "preview_metadata": {
    "strategy": "Value-Add",
    "asset_class": "Multifamily",
    "region": "Southeast",
    "deal_size_range": "$15M-$30M"
  },
  "must_connect_api": true,
  "next_step": "Connect an API key via POST /capsules/:accessToken/connect_api, then query via POST /capsules/:accessToken/query"
}
```

### Expected response (without preview)
```json
{
  "share_exists": true,
  "share_type": "external_agent_enabled",
  "recipient_email": "test-recipient-no-preview@example.com",
  "allow_document_download": true,
  "allow_agent_interaction": true,
  "expires_at": null,
  "agent_enabled": true,
  "preview_text": null,
  "preview_metadata": null,
  "must_connect_api": true,
  "next_step": "Connect an API key via POST /capsules/:accessToken/connect_api..."
}
```

### Verification checklist
- ❌ No `deal_name` field present (bypass fix)
- ❌ No `deal_summary` with city/state/property_type (bypass fix)  
- ❌ No `deal_id` exposed to unauthenticated caller (bypass fix)
- ❌ No `share_id` exposed (bypass fix)
- ✅ `must_connect_api: true` tells recipient what to do next
- ✅ `recipient_email` matches the share creation
- ✅ `agent_enabled: true` for external_agent_enabled share type
- ✅ `preview_text` returns sender-written pitch (with-preview share)
- ✅ `preview_metadata` returns structured metadata (with-preview share)
- ✅ `preview_text: null` for share created without preview
- ✅ `preview_metadata: null` for share created without preview
- ✅ Bypass still blocked: preview_text is sender-curated (stored on capsule_shares), NOT deal data (no query to deals table at resolution time)
- ✅ 500-char preview_text cap enforced at both API and DB level
- ✅ preview_metadata validated: must be JSON object, not array or primitive

### UX assessment
The recipient sees: share exists, it's agent-enabled, they need to connect an API key.
They do NOT see: deal name, city, property type, or any other identifying information.

**Motivation concern:** A recipient receiving a capsule link with zero deal context
might not be motivated to connect an API key. They don't know what deal was shared,
what market it's in, or whether it's worth their time.

**Recommendation:** Consider adding minimal context that doesn't enable bypass:
- Deal city + property type (e.g., "Charlotte — Multifamily (Value-Add)")
- But NOT deal name, address, or unit count
This gives enough intrigue to motivate API key connection without enabling
meaningful external analysis.

### Rate limiting verification

```bash
# Rapid-fire 6 requests
for i in $(seq 1 6); do
  echo "Request $i:"
  curl -s -o /dev/null -w "%{http_code}" "https://your-repl.replit.app/api/v1/capsules/${ACCESS_TOKEN}"
  echo ""
done
```

Expected: first 5 return 200, 6th returns 429.

### Actual result
```

```

---

## Step 3 — Connect a test API key

### Command
```bash
TEST_API_KEY="sk-ant-test-your-test-key"  # Replace with a real test key
ACCESS_TOKEN="same-token-from-step-1"

curl -X POST "https://your-repl.replit.app/api/v1/capsules/${ACCESS_TOKEN}/connect_api" \
  -H "Content-Type: application/json" \
  -d "{
    \"provider\": \"anthropic\",
    \"api_key\": \"${TEST_API_KEY}\"
  }"
```

### Expected response
```json
{
  "connection_id": "uuid-here",
  "provider": "anthropic",
  "connected_at": "2026-05-19T...",
  "status": "connected",
  "note": "API key validated and encrypted at rest (AES-256-GCM). You can now query the agent via POST /capsules/:accessToken/query"
}
```

### DB verification — encryption
```sql
SELECT connection_id, provider, api_key_encrypted, stripe_customer_id
FROM recipient_api_connections
WHERE connection_id = 'uuid-from-response';
```

**Encryption verification:**
- `api_key_encrypted` format: `iv_hex:auth_tag_hex:ciphertext_hex`
- Split by `:` → 3 parts
- `iv_hex` = 32 hex chars (16 bytes)
- `auth_tag_hex` = 32 hex chars (16 bytes)  
- `ciphertext_hex` = variable length
- The string does NOT start with `encrypted:` prefix (old format removed)

**Encryption test — decrypt with known key:**
```typescript
// Run in Replit shell:
const { decryptToken } = require('./src/services/encryption');
process.env.TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY; // must match
const val = decryptToken('iv:authTag:ciphertext'); // from DB
console.log('Decrypted:', val); // Should match the API key you provided
```

**Encryption test — decrypt WITHOUT key:**
```typescript
// Without TOKEN_ENCRYPTION_KEY set, decryptToken() throws:
// "TOKEN_ENCRYPTION_KEY environment variable is required..."
```

### Stripe customer verification
```sql
SELECT stripe_customer_id FROM recipient_api_connections WHERE connection_id = 'uuid';
```
Expected: `stripe_customer_id` is populated (starts with `cus_`).
Verify in Stripe Dashboard: Customer should exist with metadata `source: 'capsule_share'`.

### Actual result
```

```

---

## Step 4 — Submit a recipient query

### Command
```bash
ACCESS_TOKEN="same-token-from-step-1"

curl -X POST "https://your-repl.replit.app/api/v1/capsules/${ACCESS_TOKEN}/query" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is this deal about? Summarize the property including location, type, size, and the key financial metrics you have available."
  }'
```

### Expected response
```json
{
  "response": "This deal is [deal name], a [property type] in [city], [state] with [units] units. Based on the data I have access to: [financial summary].",
  "usage": {
    "tokens_input": 1200,
    "tokens_output": 450,
    "cost_basis_usd": 0.01,
    "platform_margin_usd": 0.003,
    "total_charged_usd": 0.013
  }
}
```

### Verification checklist
- ✅ `response` is a well-reasoned non-empty string about the deal
- ✅ `usage` fields are populated with reasonable token counts
- ✅ Usage cost formula: `cost_basis = (input_tokens * $3/M) + (output_tokens * $15/M)`
- ✅ `total_charged = cost_basis * 1.3` (30% platform margin)
- ✅ Response mentions deal by name (context was assembled correctly)

### DB verification — recipient_query_log
```sql
SELECT tokens_input, tokens_output, cost_basis_usd, platform_margin_usd, 
       total_charged_usd, query_category, response_status
FROM recipient_query_log
WHERE connection_id = 'uuid-from-step-3'
ORDER BY query_timestamp DESC
LIMIT 1;
```

Expected:
- `tokens_input` ≈ matches usage returned
- `tokens_output` ≈ matches usage returned
- `query_category = 'deal_query'`
- `response_status = 'success'`
- **No query content stored** — check there's no text column

### DB verification — connection counters
```sql
SELECT total_queries, total_tokens_consumed, total_charges_usd, platform_margin_usd, last_used_at
FROM recipient_api_connections
WHERE connection_id = 'uuid-from-step-3';
```
Expected:
- `total_queries = 1`
- `total_tokens_consumed = input + output tokens`
- `total_charges_usd > 0`
- `last_used_at` is recent

### Stripe metering verification
```bash
# Check Stripe meter events (requires Stripe CLI or Dashboard)
stripe billing meter_events list --customer cus_xxx
```

Expected meter events (3 per query):
- `capsule_query_count` — value: 1
- `capsule_input_tokens` — value: {actual count}
- `capsule_output_tokens` — value: {actual count}

### Actual result
```

```

---

## Step 5 — Verify privacy scoping at runtime

### Investigation approach
This is a static audit of the data flow (runtime trace requires Replit backend access).

**The context built in `buildRecipientDealContext()`:**
```typescript
// Terms of the context passed to the LLM:
- deal_name                         ✅ Visible to agent
- city, state                       ✅ Visible
- property_type, total_units        ✅ Visible
- scenario.assumptions              ✅ Visible (only shared scenario)
- source_documents[] (metadata)     ✅ Visible (filenames, types, extracted_at)
- cycle_phase                       ✅ Visible (market data)
- cohort comparison                 ✅ Visible (aggregated)
- sender_owned_portfolio            ❌ Explicitly null
- other_scenarios                   ❌ Explicitly null
- full_knowledge_graph              ❌ Explicitly null
- other_deals                       ❌ Explicitly null
```

**Runtime test (when backend is accessible):**
Submit a query: "Show me the sender's other deals and portfolio"
Expected: Agent should respond that it only has access to this deal, not other data.

Submit a query: "What scenarios exist beyond the one I have access to?"
Expected: Agent should say only this scenario is available.

### Actual result
```

```

---

## Step 6 — Test the bypass scenario

### Access denied endpoint verification
```bash
ACCESS_TOKEN="valid-token"
DEAL_ID="known-deal-uuid"

# These should ALL fail with 401 or 403 (no platform auth token)
curl -s -o /dev/null -w "%{http_code}" "https://your-repl.replit.app/api/v1/deals/${DEAL_ID}"
echo " - GET /deals/:id (expected 401)"

curl -s -o /dev/null -w "%{http_code}" "https://your-repl.replit.app/api/v1/deals/${DEAL_ID}/source-documents"
echo " - GET source-documents (expected 401)"

curl -s -o /dev/null -w "%{http_code}" "https://your-repl.replit.app/api/v1/deals/${DEAL_ID}/financials?hold=10"
echo " - GET financials (expected 401)"

curl -s -o /dev/null -w "%{http_code}" "https://your-repl.replit.app/api/v1/deals/${DEAL_ID}/documents/${DEAL_ID}/download"
echo " - GET document download (expected 401)"

curl -s -o /dev/null -w "%{http_code}" "https://your-repl.replit.app/api/v1/portfolio/assets"
echo " - GET portfolio (expected 401)"
```

### Token-based access verification
```bash
# Query endpoint works with valid token
curl -s -o /dev/null -w "%{http_code}" -X POST \
  "https://your-repl.replit.app/api/v1/capsules/${ACCESS_TOKEN}/query" \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'
echo " - POST query (expected 200 with valid connection)"

# Query fails without token
curl -s -o /dev/null -w "%{http_code}" -X POST \
  "https://your-repl.replit.app/api/v1/capsules/INVALID/query" \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'
echo " - POST query invalid token (expected 400)"
```

### Actual result
```

```

---

## Step 7 — Test error and edge cases

### Invalid access token
```bash
curl -s "https://your-repl.replit.app/api/v1/capsules/0000000000000000000000000000000000000000000000000000000000000000"
```
Expected: 404 "Capsule not found or revoked/expired"

### Query without connecting API key
```bash
# Create a fresh share, skip connect_api, try query:
FRESH_TOKEN=$(curl -X POST "...share/external..." | jq -r '.access_token')
curl -X POST "https://your-repl.replit.app/api/v1/capsules/${FRESH_TOKEN}/query" \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'
```
Expected: 400 "No active API connection found for this capsule. Connect an API key first..."

### Invalid API key on connect
```bash
curl -X POST "https://your-repl.replit.app/api/v1/capsules/${ACCESS_TOKEN}/connect_api" \
  -H "Content-Type: application/json" \
  -d '{"provider":"anthropic","api_key":"sk-ant-invalid-key"}'
```
Expected: 400 "API key validation failed" with provider error detail

### Query with invalid API key (key revoked after connection)
This requires a two-step test:
1. Connect with valid key
2. Revoke the key at the provider
3. Submit query
Expected: 400 with provider error (key no longer valid)

### Revoke share, then query
```bash
# Revoke the share
curl -X POST "https://your-repl.replit.app/api/v1/deals/${DEAL_ID}/shares/${SHARE_ID}/revoke" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"

# Try to resolve
curl -s "https://your-repl.replit.app/api/v1/capsules/${ACCESS_TOKEN}"
```
Expected: 404 "Capsule not found or revoked/expired"

```bash
# Try to query
curl -X POST "https://your-repl.replit.app/api/v1/capsules/${ACCESS_TOKEN}/query" \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'
```
Expected: 400 "No active API connection found..."

### Long message rejection
```bash
LONG_MSG=$(python3 -c "print('x' * 10001)")
curl -X POST "https://your-repl.replit.app/api/v1/capsules/${ACCESS_TOKEN}/query" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"${LONG_MSG}\"}"
```
Expected: 400 "Message too long (max 10,000 characters)"

### No message body
```bash
curl -X POST "https://your-repl.replit.app/api/v1/capsules/${ACCESS_TOKEN}/query" \
  -H "Content-Type: application/json" \
  -d '{}'
```
Expected: 400 "message is required"

### Actual result
```

```

---

## Step 8 — Cleanup

```bash
# Revoke the test share
curl -X POST "https://your-repl.replit.app/api/v1/deals/${DEAL_ID}/shares/${SHARE_ID}/revoke" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"

# Verify revoked
curl -s "https://your-repl.replit.app/api/v1/capsules/${ACCESS_TOKEN}"
# Expected: 404

# DB cleanup queries:
# DELETE FROM recipient_query_log WHERE connection_id = 'connection-uuid';
# DELETE FROM recipient_api_connections WHERE connection_id = 'connection-uuid';
# DELETE FROM capsule_shares WHERE share_id = 'share-uuid';
```

**Note:** The `recipient_query_log` and `recipient_api_connections` rows should ideally be kept
for audit trail. Only delete if this is purely test data. Mark as `test_data = true`
in a metadata column.

---

## UX Assessment: Capsule Resolution After Metadata Strip

### Current experience

A recipient who clicks a capsule link like:
```
https://app.jedire.ai/capsules/a1b2c3d4e5f6...
```

Sees:
```
share_exists: true
share_type: external_agent_enabled
recipient_email: test-recipient@example.com
allow_document_download: true
agent_enabled: true
must_connect_api: true
next_step: Connect an API key via POST /capsules/:accessToken/connect_api...
```

**Problem:** The recipient has no idea what deal this is. They see:
- It exists
- They need to connect an API key
- Their email is associated

Zero deal context: no city, no property type, no deal name.

**This is correct from a security standpoint** — no bypass possible.
**This is bad from a UX/conversion standpoint** — a recipient won't connect
their API key without knowing what they're getting.

### Recommendation

Add a **minimal "preview" layer** that shows only:
```json
{
  "preview": {
    "city": "Charlotte",
    "state": "NC",
    "property_type": "Multifamily",
    "total_units_min": 100,   // binned: 50-100, 100-200, 200+
    "total_units_max": 200
  }
}
```

This gives enough context for a recipient to decide: "Oh, that Charlotte deal I was
looking at — worth connecting my key." But it's deliberately insufficient for bypass:

- **City + property type** — useful for identification, useless for financial analysis
- **Binned unit count** — coarse enough to not give away scale
- **NO deal name** — prevents googling/checking known properties
- **NO exact unit count** — prevents precise NOI estimation
- **NO financials or assumptions** — only categorical data

### Implementation sketch

```sql
-- Add an optional preview object to capsule_shares
ALTER TABLE capsule_shares ADD COLUMN IF NOT EXISTS preview_city TEXT;
ALTER TABLE capsule_shares ADD COLUMN IF NOT EXISTS preview_state TEXT;
ALTER TABLE capsule_shares ADD COLUMN IF NOT EXISTS preview_property_type TEXT;
ALTER TABLE capsule_shares ADD COLUMN IF NOT EXISTS preview_unit_bucket TEXT;
```

The sender fills this in when creating the share, OR it's auto-generated from
the deal data (city, property_type → direct; unit_count → binned).

**Why not auto-populate:** Auto-population re-introduces the bypass risk.
If the resolution endpoint queries `deals` to get city/property_type, it leaks
data. The preview should be stored in `capsule_shares` itself, populated by
the sender-managed share creation flow.

### Actual result
```

```
