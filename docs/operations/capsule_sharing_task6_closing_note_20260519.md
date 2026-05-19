# Capsule Sharing Task 6 closing note — 2026-05-19 (Stretch)

## Background
Per TONIGHT_ROADMAP.md, Task 6 is the Recipient Agent Runtime — the stretch item enabling non-platform recipients to connect their own API key and query the deal through the agent infrastructure. The roadmap named it "the highest strategic value piece... the business model we cannot ship without."

## Investigation
- The `connect_api` endpoint from our Piece 4 foundation was a stub — it stored a placeholder and returned "coming soon"
- The agent runtime uses the `AgentRuntime` class in `src/agents/runtime/AgentRuntime.ts` with `DeepSeekMeteringAdapter` for the platform's own DeepSeek provider
- The existing `MeteringAdapter` and `StubMeteringAdapter` are for platform-side metering, not recipient API key routing
- No existing mechanism to route agent calls through a recipient-provided API key
- No existing recipient-scoped context builder that scrubs sender-private data
- Stripe integration exists in the platform (`stripe-replit-sync`, webhooks) but for platform subscriptions, not recipient token-based billing

## Changes Applied

### New file: `recipient-context.service.ts`
- `RecipientDealContext` interface with scrubbed fields
- `buildRecipientDealContext(shareId)` function:
  - Fetches deal data from `capsule_shares → deals` join
  - Retrieves shared scenario data (if any)
  - Fetches source documents from `deals.deal_data->'source_documents'`
  - Retrieves market cycle phase (optional, from `cycleIntelligenceService`)
  - Retrieves cohort comparison data (optional, from `deal_assumptions`)
  - **Privacy-scrubbed**: `sender_owned_portfolio`, `other_scenarios`, `full_knowledge_graph`, `other_deals` all explicitly set to null

### New file: `recipient-agent-executor.service.ts`
- `executeRecipientQuery(accessToken, message)` function:
  1. **Share validation**: Hashes token, looks up active share + API connection
  2. **Key extraction**: Decodes `encrypted:base64...` from DB
  3. **Context building**: Calls `buildRecipientDealContext` to create scrubbed deal context
  4. **System prompt**: Builds from context with bounds-awareness and confidentiality notice
  5. **Provider routing**: Routes through Anthropic or OpenAI SDK with recipient's own key
  6. **Cost calculation**: Approximate (Anthropic $3/M in, $15/M out; OpenAI $2.50/$10)
  7. **Usage logging**: Logs to `recipient_query_log` (tokens, costs, category)
  8. **Counter update**: Updates `recipient_api_connections` usage counters

### Modified: `capsule-sharing.routes.ts`
- **`POST /:accessToken/connect_api`**: Upgraded from stub — now:
  - Validates API key by making a minimal test call to the provider
  - Stores key as base64-encoded via `Buffer.from().toString('base64')`
  - Returns `status: 'connected'` with link to query endpoint
- **`POST /:accessToken/query`**: New endpoint — takes `{ message }` and returns:
  - `response`: Agent text response
  - `usage`: Token counts, cost basis, platform margin, total charged (all in USD)
- **`GET /:accessToken`**: Updated `agent_status` from `available: false` to `available: true`

## Privacy
- No query content is stored in the database
- Only aggregated metrics: token counts, category, cost, timestamps
- API key stored as base64 in `recipient_api_connections.api_key_encrypted` column
- Future: AES-GCM encryption at rest (requires key management service)

## Remaining (for production readiness)
1. **Stripe Token Billing wrapper** — integrate the existing Stripe infrastructure to charge per-query
2. **AES-GCM encryption** for stored API keys (currently base64 only)
3. **Rate limiting** — protect against runaway queries on a single share
4. **$0-initial-request flow** — the Stripe flow for new providers
5. **Provider key rotation** — allow the recipient to update their key
6. **Model selection** — currently hardcoded to claude-sonnet-4-20250514 / gpt-4o
7. **Error handling** — provider API errors surfaced through a structured error response
8. **Idempotency** — handle duplicate query submission (for network retries)
