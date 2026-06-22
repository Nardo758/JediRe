# Public-Ingress Security Audit — A4

**HEAD SHA:** `c07b307c2411ec03e09a5d0ae3cb20d9358d72ff`
**Date:** 2026-06-22
**Mode:** READ-ONLY — no production testing performed. All findings are code-path analysis only.
**Auditor:** JEDI RE Audit Program — A4

---

## One-Line Verdict

**EXPOSED-ON: TC-2 (tenant isolation), TC-3 (cost/credit DoS)**
The public chat ingress is NOT safe to expose to untrusted users in its current form. Two out of six threat classes have exploitable, unmitigated paths: a crafted message can write to another tenant's DealContext, and there is no rate limiting on either the HTTP chat endpoint or the Telegram webhook ingress.

---

## Threat-Class Summary Table

| # | Class | Rating | Concrete attack if ABSENT |
|---|-------|--------|---------------------------|
| TC-1 | Prompt injection → tool misuse | **PARTIAL** | LLM-supplied `deal_id` reaches `write_dealcontext` unchecked; mismatch warned, not blocked |
| TC-2 | Tenant isolation | **ABSENT** | Prompt injection can write to another user's DealContext; chat surface has no userId binding at all |
| TC-3 | Cost / credit DoS | **ABSENT** | Unauthenticated flood of chat POST requests; Telegram webhook auth skipped when env vars unset |
| TC-4 | Secrets hygiene | **PRESENT** | — |
| TC-5 | Input validation / SSRF | **PRESENT** | — |
| TC-6 | Capsule sharing exposure | **PRESENT** | — |

---

## Severity-Ranked Findings

### CRITICAL-1 — Cross-tenant write via `write_dealcontext` tool
**File:** `backend/src/agents/tools/write_dealcontext.ts:75-84`
**Class:** TC-2 + TC-1

The tool accepts `input.deal_id` as an LLM-supplied parameter. When it differs from the runtime-injected `ctx.dealId`, the code logs a warning and continues the write:

```typescript
// write_dealcontext.ts:75-84
const dealIdMismatch =
  ctx.dealId !== undefined && input.deal_id !== ctx.dealId;

if (dealIdMismatch) {
  logger.warn('write_dealcontext: deal_id mismatch — model supplied a different deal…', {
    inputDealId: input.deal_id,
    ctxDealId: ctx.dealId,
    …
  });
}
// ← execution continues; write proceeds on input.deal_id regardless
await query(`INSERT INTO deal_context_fields … VALUES ($1, …)`, [input.deal_id, …]);
```

**Attack:** A user sends a message crafted to make the LLM call `write_dealcontext` with a known competitor's `deal_id` UUID. The tool writes attacker-controlled data into that tenant's DealContext. The only defence is a server-side warning log — no block, no ownership check.

Every other write tool uses only `ctx.dealId`; this is the single documented exception with an acknowledged bypass.

---

### CRITICAL-2 — Telegram webhook auth bypass when env vars are unset
**File:** `backend/src/api/rest/clawdbot-webhooks.routes.ts:26, 48`
**Class:** TC-3

```typescript
function validateSignature(req: Request): boolean {
  const secret = process.env.CLAWDBOT_WEBHOOK_SECRET;
  if (!secret) return true;        // ← open if env var absent
  …
}

function validateAuthToken(req: Request): boolean {
  const expectedToken = process.env.CLAWDBOT_AUTH_TOKEN;
  if (!expectedToken) return true; // ← open if env var absent
  …
}

function validateWebhook(req, res, next) {
  if (!validateSignature(req) && !validateAuthToken(req)) {
    res.status(401).json(…); return;
  }
  next(); // ← admitted if EITHER function returns true
}
```

**Attack:** If `CLAWDBOT_WEBHOOK_SECRET` is unset in the deployment environment, `validateSignature` returns `true` for every request. The `&&` condition in `validateWebhook` short-circuits and any anonymous POST to `/clawdbot/command` is accepted. The `get_deals` command then returns all deals in the database with no user-scoping (the query on lines ~80-100 has no `WHERE user_id = …` filter).

Even with both env vars set, HMAC comparison uses `===` equality on hex strings computed outside constant-time comparison after the `timingSafeEqual` call is only for the matched-length case — if `signature` and `expectedSignature` have different lengths, `timingSafeEqual` throws and falls through to the catch that returns `false` (safe), but the `!secret` shortcut fully bypasses it.

---

### HIGH-1 — Chat surface has no userId binding
**File:** `backend/src/api/rest/chat.routes.ts:6-8, routes/index.ts:511`
**Class:** TC-2

The chat route uses `optionalAuth` (not `requireAuth`) and does not forward the resolved userId to the processing service:

```typescript
// chat.routes.ts:6-8
import { optionalAuth, AuthenticatedRequest } from '../../middleware/auth';
…
router.post('/', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { message, conversationId } = req.body;
  const result = await processChat(message, conversationId); // ← no userId passed
```

`processChat` is called without any user identity. An unauthenticated anonymous caller and a paying subscriber are handled identically. Consequences:
- No per-user budget cap can be enforced downstream.
- Any agent-level tenant scoping that relies on `RunContext.userId` receives `undefined`.
- Credits cannot be debited to the correct user.

Mounted at `routes/index.ts:511` with no rate limiter applied to the mount:
```typescript
app.use('/api/v1/chat', chatRouter);
```

---

### HIGH-2 — No ingress rate limit on chat or Telegram webhook
**File:** `backend/src/api/rest/chat.routes.ts`, `backend/src/middleware/rateLimit.ts`
**Class:** TC-3

`rateLimit.ts` defines an `aiLimiter` (5 requests per minute) and `apiLimiter` (100 per 15 min), but neither is applied to `/api/v1/chat`. The route has only `optionalAuth`. The Telegram webhook (`clawdbot-webhooks.routes.ts`) has no rate limiter at all beyond the broken auth check above.

An unauthenticated attacker can issue unlimited POSTs to `/api/v1/chat`. Since `chat.routes.ts` bypasses the UnifiedOrchestrator entirely (confirmed in A2: it calls `processChat` in `chat.service.ts`, which calls the Anthropic SDK directly), each request incurs real LLM cost. There is no per-session or per-IP token budget on this path.

The `rateLimiter.ts` global IP limiter is applied at the Express app level (100 req/15 min per IP) but:
- It uses in-process memory — not shared across multiple Node processes or restarts.
- IP-keying is trivially bypassable via `X-Forwarded-For` spoofing if the proxy layer doesn't strip untrusted forwarding headers (not verified).

---

### HIGH-3 — Agent-delegator passes user-supplied `dealId` without ownership check
**File:** `backend/src/services/orchestrator/agent-delegator.ts:97-113`
**Class:** TC-2

```typescript
// agent-delegator.ts:97-113
if (intent.dealId) {
  financialContext = await getDealFinancialContext(intent.dealId); // ← no ownership check
}
…
this.executeSpecialist(agent, params, userId, intent.dealId)   // ← unverified dealId to run
```

`intent.dealId` comes from the Coordinator NLU parsing the user's chat message. A message like _"Analyze deal eaabeb9f-830e-44f9-a923-56679ad0329d"_ where that UUID belongs to another user will cause `getDealFinancialContext` and subsequent agent tools (`fetch_t12`, `fetch_comps`, etc.) to query that deal's data. The `fetch_t12` tool queries `WHERE dp.deal_id = $1` with no user ownership join (confirmed: `fetch_t12.ts:88`). This is a cross-tenant read path.

---

### HIGH-4 — Audit log covers only one of five agents
**File:** DB check output
**Class:** TC-2 (operational — unauditable abuse path)

DB query result:
```
AUDIT_LOG: [{"actor_type":"agent","actor_id":"cashflow","count":"1273"}]
```

Only the Cashflow agent produces `audit_log` rows. The Research, Zoning, Commentary, and Supply agents have zero entries. Any write these agents make to `deal_context_fields`, `deal_assumptions`, or other tables via their tools is unattributable after the fact. An abuse event (cross-tenant write, prompt injection) touching any non-Cashflow agent produces no audit trail.

---

### MEDIUM-1 — Error stack trace logged server-side in chat handler
**File:** `backend/src/api/rest/chat.routes.ts:20`
**Class:** TC-4

```typescript
logger.error('Chat request failed:', { error: error.message, stack: error.stack });
```

The response correctly sanitizes (`res.status(500).json({ error: 'Failed to process message. Please try again.' })`), so stack traces are not returned to the client. However, `error.stack` from a DB connection failure can include the full connection string (host, port, credentials). This goes to the server log, not to the caller — severity is lower but warrants log-redaction for connection errors specifically.

---

## TC-4 through TC-6 Evidence (PRESENT)

### TC-4: Secrets Hygiene — PRESENT
- All API keys (`ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `TAVILY_API_KEY`, `DEEPSEEK_API_KEY`, `CLAWDBOT_WEBHOOK_SECRET`, etc.) are read exclusively from `process.env.*` — no literals in source.
  - `financial-dashboard.routes.ts:8`: `const ANTHROPIC_API_KEY = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;`
  - `stripeClient.ts`: throws if `STRIPE_SECRET_KEY` absent — no fallback to a hardcoded value.
- No `.env` files tracked in the repository (filesystem scan returned empty).
- Chat error responses sanitize the message to `'Failed to process message. Please try again.'` — keys do not reach the chat channel.
- **Gap noted under MEDIUM-1:** `error.stack` logged server-side.

### TC-5: Input Validation / SSRF — PRESENT
- `fetch_webpage.ts`: DNS-resolves hostname before fetch; blocks RFC1918 / loopback / link-local / CGNAT ranges; enforces `https:`/`http:` scheme only; re-validates each redirect hop against the same SSRF + domain policy checks (`fetchWithRedirectValidation`, lines 225-274). Domain allowlist enforced per-agent.
- `web_search.ts`: per-agent domain policy enforced pre- and post-Tavily call; per-run search cap checked via `BudgetEnforcer`.
- All reviewed DB queries use parameterized form (`$1`, `$2`). String-built SQL not found in any reviewed path including `agent.routes.ts`, `capsule-sharing.routes.ts`, `deal-shares.routes.ts`, and `clawdbot-webhooks.routes.ts`.

### TC-6: Capsule Sharing Exposure — PRESENT
- Access tokens: `crypto.randomBytes(32).toString('hex')` — 256 bits, stored as SHA-256 hash only (`capsule-sharing.routes.ts:350`). Raw token not persisted.
- Shortcodes: `crypto.randomBytes(6)` mapped to 7 Base62 characters — ~48 bits, not sequential, ~3.5T combinations. Not guessable by enumeration at realistic rates.
- Revocation and expiry enforced server-side in every token resolution query:
  ```sql
  WHERE ces.access_token = $1
    AND ces.revoked_at IS NULL
    AND (ces.expires_at IS NULL OR ces.expires_at > NOW())
  ```
  Same clause on shortcode resolution paths (`capsule-sharing.routes.ts:425-426, 534-535, 585-586`).
- Share creation verifies capsule ownership server-side: `WHERE dc.id = $1 AND dc.user_id = $2` before issuing any token.

---

## Config / DB Check Results

### Check 1 — audit_log attribution
```sql
SELECT actor_type, actor_id, count(*) FROM audit_log GROUP BY 1,2;
```
```
actor_type: agent  actor_id: cashflow  count: 1273
```
**Finding:** Only the Cashflow agent has attributable audit entries. Four of five agents (Research, Zoning, Commentary, Supply) produce zero audit_log rows. Any write those agents make is unauditable.

### Check 2 — agent_runs.user_id population
```
triggered_by: user   total: 4738   null_user: 0   has_user: 4738
triggered_by: event  total: 586    null_user: 582  has_user: 4
```
**Finding:** User-triggered runs are fully attributed (0 null). Event-triggered runs (scheduled crons) have 582/586 null user_id — this is expected for system-initiated jobs, not a direct security concern. **Exception:** the chat surface bypasses this path entirely (A2 finding: `chat.routes.ts` calls `processChat` directly, not through the agent runtime), so these statistics do not reflect chat-triggered exposure.

### Check 3 — ingress rate limit config
**Finding:** No dedicated per-channel-identity rate limit exists on `/api/v1/chat`. `rateLimiter.ts` provides a global IP-keyed limiter (100 req/15 min, in-process memory) applied at the Express layer, but `aiLimiter` (5 req/min) defined in `rateLimit.ts` is not wired to the chat route mount. Telegram webhook (`clawdbot-webhooks.routes.ts`) has no rate limiter. The per-deal `dealRunStartLimiter` (3 starts per 60 s, `AgentRuntime.ts:319`) applies only to the agent runtime path, which the chat surface bypasses.

---

## Recommended Triage Order

1. **CRITICAL-1** — Block `write_dealcontext` when `input.deal_id ≠ ctx.dealId` (one-line fix; current code already detects the mismatch).
2. **CRITICAL-2** — Remove `if (!secret) return true` / `if (!expectedToken) return true` from Clawdbot webhook auth; require both env vars to be set, or fail closed.
3. **HIGH-1** — Make chat route use `requireAuth` (not `optionalAuth`), and pass `userId` through to `processChat`. This also unblocks per-user budget enforcement.
4. **HIGH-2** — Apply `aiLimiter` to `/api/v1/chat` mount; add per-Telegram-user rate limit in message handler.
5. **HIGH-3** — Add ownership check in `agent-delegator.ts` before using `intent.dealId` in any data fetch or agent run: verify `deals.user_id = userId` for the resolved `dealId`.
6. **HIGH-4** — Extend `audit_log` writes to Research, Zoning, Commentary, and Supply agent tool calls.

---

*Report and stop. No fixes implemented. Awaiting triage.*
