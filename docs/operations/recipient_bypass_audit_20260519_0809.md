# RECIPIENT BYPASS AUDIT — Piece 4

## Section A — Endpoint Inventory

### Recipient-accessible endpoints (via capsule access token)

These are endpoints mounted WITHOUT `requireAuth` at the `app.use()` level on the same Express app as the capsule-sharing routes. Some internally use `requireAuth` — those are noted and excluded as bypass vectors.

| # | Path | Method | Data returned | Security | Bypass utility | Notes |
|---|------|--------|---------------|----------|----------------|-------|
| 1 | `/api/v1/capsules/:accessToken` | GET | Deal metadata: name, city, state, property_type, total_units, share settings, agent availability | Token-hashed lookup, share not revoked/expired | **LOW** — Returns metadata only, no financials, no documents. Same metadata that the agent system prompt already provides to the recipient. | This is the intended capsule resolution endpoint |
| 2 | `/api/v1/capsules/:accessToken/connect_api` | POST | Connection status (provider, connected_at) | Token-hashed lookup + provider API key validation | **LOW** — Not data retrieval; needed setup step for agent queries | Intended setup endpoint |
| 3 | `/api/v1/capsules/:accessToken/query` | POST | Agent response + token usage + cost breakdown | Token-hashed lookup + encrypted API key | **HIGH** — This IS the metered endpoint. Returns agent-derived analysis. | **The intended metered endpoint.** The bypass risk is not about this endpoint itself, but about avoiding it. |
| 4 | `/api/v1/capsules/:accessToken/connect_api` | DELETE | Disconnection status | Token-hashed lookup | **NONE** — No data returned | |
| 5 | `/api/v1/` + unauthenticated internal routes | GET | See below | None | Variable | Not token-accessible but ANYONE can reach them |

### Unauthenticated platform endpoints (accessible without ANY auth)

These are routes mounted at `app.use()` without `requireAuth` or `optionalAuth`. Their internal handlers also don't require auth.

| # | Path | Method | Data returned | Bypass utility | Notes |
|---|------|--------|---------------|----------------|-------|
| 6 | `/api/v1/supply/:market` | GET | Market supply metrics (inventory, months_of_supply, score) | **LOW** — Public market data | `dataRouter` |
| 7 | `/api/v1/markets` | GET | Supply metrics for all markets | **LOW** — Public data | `dataRouter` |
| 8 | `/api/v1/properties` (dataRouter) | GET | Properties table (city-filterable) | **LOW** — Generic property listing data | `dataRouter` — NOT the same as `propertyRoutes` (which requires auth) |
| 9 | `/api/v1/ticker/feed` | GET | FRED market data (treasury, SOFR, CPI, unemployment) | **LOW** — Public data | `ticker.routes.ts` — no auth checks at all |
| 10 | `/api/v1/chat` | POST | General CRE AI chat (via platform's Anthropic key) | **MEDIUM** — Uses optionalAuth (anyone can chat). But it's a general AI, NOT deal-scoped. No capsule context. | Recipient cannot scope the chat to the shared deal without the agent runtime |

### Auth-protected endpoints (NOT recipient-accessible)

These all require `requireAuth` or `optionalAuth` at either the `app.use` or individual route level. A recipient WITHOUT platform credentials cannot access them:

| Endpoint group | Protection | Data (if accessible) |
|---------------|-----------|---------------------|
| `/api/v1/deals` + sub-routes | `requireAuth` on all route handlers | Deal financials, assumptions, models, scenarios, source documents |
| `/api/v1/deals/:dealId/documents/:id/download` | `requireAuth` on `app.use('/api/v1/deals', ...)` | Raw document content |
| `/api/v1/deals/:dealId/documents/bulk_download` | `requireAuth` | ZIP of all deal files |
| `/api/v1/deals/:dealId/source-documents` | `requireAuth` | Document catalogue |
| `/api/v1/portfolio` | `requireAuth` on all route handlers | Sender's owned portfolio data |
| `/api/v1/capsules` (Deal Capsule infrastructure) | `requireAuth` at `app.use` level | Full capsule data |
| `/api/v1/markets` (intelligence) | `optionalAuth` (auth preferred) | Market intelligence |
| `/api/v1/grid`, `rankings`, `grid-templates` | `optionalAuth` | Platform grid data |
| `/api/v1/agents`, `/api/v1/agents/*/chat` | `requireAuth` on route handlers | Agent runs, agent results |
| `/api/v1/cycle-intelligence/*` | `requireAuth` on route handlers | MSA cycle phase, rate environment, leading indicators |

---

## Section B — Bypass Risk Assessment

### Is the platform currently single-orchestrator?

**No.** The platform is multi-endpoint by design. However, all deal-scoped data (financials, documents, assumptions, scenarios) is behind `requireAuth`. The capsule sharing routes are the ONLY token-accessible path to any deal-scoped data.

### What is the realistic bypass scenario?

A determined recipient could:

1. **Resolve the capsule** (`GET /capsules/:accessToken`) to get deal metadata (city, state, type, units)
2. **Avoid `POST /capsules/:accessToken/query`** — never connect an API key, never pass through metering
3. **Route the capsule metadata as context to their own external LLM** — run their own analysis
4. **Supplement with public market data** from unauthenticated endpoints (`/supply/:market`, `/api/v1/chat`, `/ticker/feed`)

**This is already a viable bypass.** The capsule resolution endpoint returns enough deal metadata (name, city, state, property type, unit count) that an external bot could construct a reasonable investment thesis. The recipient never needs to call the metered query endpoint.

**But it gets worse if we widen the scope:** Once a recipient has a deal name, city, and state, they could search public resources, look up comps, check market data, and build an analysis entirely externally — without ever touching a JediRe endpoint after the initial capsule resolution.

### Value at risk

| Scenario | Value per recipient action | Metered? |
|----------|---------------------------|----------|
| Recipient resolves capsule → runs their own LLM analysis | **Full analysis value** (potentially $5-50+ in agent reasoning) | ❌ — None metered |
| Recipient resolves capsule → supplements with platform public market data | **Enhanced analysis** | ❌ — Only LLM inference paid to their provider |
| Recipient actually calls `/query` | **$0.XX platform fee** | ✅ — Captured |

### Is the bypass risk actually a problem?

**Yes, but in a nuanced way.** The current design separates "data at rest" (deal metadata from capsule resolution) from "agent reasoning" (the metered query endpoint). The metadata alone is useful enough that a recipient might not need the agent.

The question is: **is deal metadata alone valuable enough for an external bot to produce sponsor-quality analysis?**

For a sophisticated CRE investor with their own analysis pipeline: **yes**. City, state, property type, and unit count are sufficient to:
- Look up local market comps
- Estimate rent / expense parameters
- Run their own DCF or pro forma
- The source documents would add value but aren't needed

For an unsophisticated user: the agent runtime provides far more value (structured analysis, cohort comparison, market context). They'd use the query endpoint.

### Comparison: what does the agent provide that the metadata alone doesn't?

The agent provides:
- Extracted financials (NOI, rent roll, T12)
- Cohort baseline comparison (how this deal compares to peers)
- Market cycle context
- Scenario-specific assumptions
- Structured reasoning

The metadata provides:
- Deal name
- City, state
- Property type
- Unit count

**The agent provides ~90% of the analytical value.** The metadata provides ~10%. But 10% of a $500M underwriting decision is still significant intelligence.

---

## Section C — Recommended Fixes

### Fix 1: Strip deal metadata from capsule resolution endpoint

**Problem:** `GET /capsules/:accessToken` returns deal name, city, state, property type, and unit count — enough for an external bot to build a rough thesis.

**Fix:** Return only share settings, not deal metadata, from the resolution endpoint. Move the actual deal details behind the `connect_api` step.

**Implementation:**
```typescript
// In capsule resolution endpoint — reduce to bare minimum
return res.json({
  share_exists: true,
  share_type: share.share_type,
  allow_document_download: share.allow_document_download,
  allow_agent_interaction: share.allow_agent_interaction,
  agent_enabled: share.share_type === 'external_agent_enabled',
  must_connect_api: true,
  // NO deal name, city, state, type, units
});
```

**Impact:** External bot gets nothing useful from resolution. Must connect API key (and thus go through the metered path) to get any deal context. The system prompt inside the agent runtime provides the context — so the metered endpoint becomes the gating factor.

**Downside:** The capsule preview experience degrades. A recipient can't see "this is the deal being shared" before connecting their key. Mitigation: show a generic reference ("Deal shared with you by [sender_email]") in the share email, not in the capsule resolution response.

### Fix 2: Rate-limit the capsule resolution endpoint

**Problem:** A recipient can call `GET /capsules/:accessToken` repeatedly with no cost. This enables reconnaissance (try tokens until one works, extract metadata).

**Fix:** Add rate limiting per IP on capsule resolution:
```typescript
// 5 requests per 10 minutes per IP
const RATE_LIMIT = {
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: 'Too many capsule resolution attempts',
};
```

**Impact:** Prevents token brute-forcing. Limits data extraction to 5 requests / 10 min.

### Fix 3: Increase the value inside the metered query endpoint

**Problem:** The agent runtime returns everything the recipient needs. But the capsule metadata returns enough context to start.

**Fix:** The Fix 1 removes metadata from capsule resolution. But consider adding **more** value inside the metered query endpoint (beyond what's already there) to create incentive to use it:
- Include cohort comparison
- Include cycle analysis
- Include highlighted sections of supporting documents

### Fix 4: Add a "preview credit" for the first query

**Problem:** A recipient who has to connect an API key AND pay for the first query has high friction. This tempts them to do the metadata-based bypass.

**Fix:** Allow one free query per capsule (the `$0-initial-request` pattern from the spec). The recipient connects an API key, the first query is free (Stripe meter events fire with $0.00), and subsequent queries are metered.

**Implementation:**
- Track `free_queries_used` in `recipient_api_connections`
- First query: skip Stripe metering, still log usage
- Increment counter and meter on subsequent queries

### Fix 5: Consider time-bounded access

**Problem:** Once a recipient has the access token, they have indefinite access (until revoked or expired). They could set up a cron job to periodically extract metadata.

**Fix:** For `external_view` shares (no agent interaction), consider:
- Enforcing the `expires_at` more aggressively (auto-expire after 7 days if not set)
- Adding a `max_resolutions` counter — after N resolutions, the token is locked

### Fix 6: Deprecate `external_view` share type

**Problem:** `external_view` shares exist (`share_type: "external_view"`). These allow document download without agent interaction. The document download is behind `requireAuth` (not accessible via token), but the resolution endpoint would still return metadata.

**Fix:** Deprecate `external_view` and require all shares to be `external_agent_enabled`. This ensures every share goes through the agent runtime (even if the recipient never queries, they're incentivized to connect).

---

## Summary of Bypass Risk

| Risk type | Likelihood | Impact | Priority |
|-----------|-----------|--------|----------|
| Recipient extracts deal metadata from capsule resolution → external analysis | **Medium** | **Medium** (loss of platform margin on $0.XX per query, metadata leak) | **High** |
| Recipient uses unauthenticated platform endpoints to supplement capsule data | **Low** | **Low** (public market data only) | **Medium** |
| Recipient brute-forces access tokens | **Very Low** | **High** (if successful, 2^256 search space per SHA-256 hash) | **Low** |

---

## Recommended immediate action

**Implement Fix 1 and Fix 2 before proceeding to Task 2 validation.** These are low-effort, high-impact changes:

1. Strip deal metadata from `GET /capsules/:accessToken` response
2. Add IP-based rate limiting to capsule resolution

Without Fix 1, Task 2 validation will produce misleading results — it will validate the metered flow is working, but won't surface the fact that a recipient doesn't need the metered flow at all.

Fixes 3-6 are campaign-level improvements for the next iteration.
