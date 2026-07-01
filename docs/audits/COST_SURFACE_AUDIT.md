# COST-SURFACE AUDIT

**Mode:** READ-ONLY — enumerate, price, classify. No wiring changes.  
**Repo HEAD SHA:** `6695897ddcc0b5d196d0c75d99bca56271291d85`  
**Date:** 2026-07-01  
**Evidence rule (S1-01):** every "this route calls a paid API" claim carries `file:line` of the
external call; every "it's metered" / "it leaks" claim carries the credit-debit code path or its
absence.

---

## SUMMARY

| Category | Count |
|---|---|
| Total cost-incurring call sites enumerated | ~55 |
| METERED (credit-debited via AgentRuntime) | 1 system (5 agents) |
| ATTRIBUTED-NOT-METERED (authed, known user, no credit debit) | ~40 call sites across 20 files |
| LEAKING (unauthenticated, no attribution, no meter) | **0** — floor auth closes the gap |
| PLATFORM-ABSORBED (cron / event / ingest) | ~10 call sites |
| External services wired but free (FRED, BLS, Census, ArcGIS public) | 4 services |
| Referenced but NOT wired (RentCast, CompStak, ApartmentIQ, PredictHQ, GDELT) | 5 services |

**Headline:** there are no genuinely unattributed cost routes — the Phase-2 auth floor
(`conditionalApiV1Auth` + `API_V1_PUBLIC_PREFIXES`) ensures every `/api/v1/*` request is tied to a
user. The real gap is the **credit-meter gap**: 40+ call sites incur external cost that is
attributed but never debited from user credits. The only fully metered path is the five-agent
AgentRuntime. Everything else is platform-absorbed attribution without billing recovery.

---

## THE METERED PATH (baseline reference)

**System:** `backend/src/agents/runtime/AgentRuntime.ts` →
`backend/src/agents/runtime/MeteringAdapter.ts:291`

**Agents covered:** research, cashflow, zoning, supply, commentary (all five Layer 1 agents).

**Three-bucket rule** (deterministic, runs before returning):

| Trigger bucket | Disposition |
|---|---|
| `triggered_by: 'user'` | Pre-flight credit reservation → post-call reconciliation debit + Stripe billing meter event |
| `triggered_by: 'event'` | Platform-absorbed; logged to `ai_usage_log` only |
| `triggered_by: 'cron'` | Platform-absorbed; logged to `ai_usage_log` only |

**Token cost table** (from `MeteringAdapter.ts` lines 26–36):

| Model | Input $/1M tokens | Output $/1M tokens |
|---|---|---|
| `claude-opus-4-5` | $15.00 | $75.00 |
| `claude-sonnet-4-5` | $3.00 | $15.00 |
| `claude-haiku-4-5` | $0.80 | $4.00 |
| `deepseek-chat` | $0.27 | $1.10 |
| `deepseek-reasoner` | $0.55 | $2.19 |

Any LLM call NOT going through `MeteringAdapter.messages.create` is unmetered regardless of auth
status.

---

## LLM CALL SITES OUTSIDE THE METERED PATH

All 15 sites below instantiate `new Anthropic(...)` directly and call `anthropic.messages.create`
or equivalent. None debits credits. All are behind authentication (so user attribution exists), but
none flow through `MeteringAdapter`.

### Group A — Route-level direct Anthropic calls (highest exposure)

| # | File | Line(s) | Route | Auth guard | Model | Verdict |
|---|------|---------|-------|------------|-------|---------|
| A1 | `api/rest/development-scenarios.routes.ts` | 367, 376 | `GET /deals/:dealId/scenarios/hbu` | broad `requireAuth` (routes/index.ts:54) | Sonnet | ATTRIBUTED-NOT-METERED |
| A2 | `api/rest/development-scenarios.routes.ts` | 539, 544 | `GET /deals/:dealId/regulatory-risk-analysis` | broad `requireAuth` (routes/index.ts:54) | Sonnet | ATTRIBUTED-NOT-METERED |
| A3 | `api/rest/development-scenarios.routes.ts` | 896, 901 | `GET /deals/:dealId/timeline-intelligence` | broad `requireAuth` (routes/index.ts:54) | Sonnet | ATTRIBUTED-NOT-METERED |
| A4 | `api/rest/deal-market-intelligence.routes.ts` | 201, 272 | `GET /:dealId/market-intelligence` | inline `requireAuth` (line 404) | Sonnet | ATTRIBUTED-NOT-METERED |
| A5 | `api/rest/morning-brief.routes.ts` | 29, 394 | `GET /` + `POST /refresh` | inline `requireAuth` (lines 98, 144) | Sonnet | ATTRIBUTED-NOT-METERED |
| A6 | `api/rest/portfolio.routes.ts` | 1038, 1049 | `POST /:dealId/agent-report` | inline `requireAuth` (line 1001) | Sonnet | ATTRIBUTED-NOT-METERED |
| A7 | `api/rest/risk.routes.ts` | 869 | `POST /narrative/:dealId` | mount-level `requireAuth` (routes/index.ts:393) | Sonnet (inferred) | ATTRIBUTED-NOT-METERED |
| A8 | `api/rest/zoning-capacity.routes.ts` | 14, 1053 | `POST /deals/:dealId/zoning-capacity` (AI fallback) | broad `requireAuth` (routes/index.ts:49) | Sonnet | ATTRIBUTED-NOT-METERED |
| A9 | `api/rest/building-envelope.routes.ts` | 119, 153 | `POST /deals/:dealId/building-envelope` | broad `requireAuth` | Haiku | ATTRIBUTED-NOT-METERED |
| A10 | `api/rest/capsule-sharing.routes.ts` | 1370–1371, 1590–1591 | API key validation (test ping only) | inline `requireAuth` | Haiku | ATTRIBUTED-NOT-METERED *(negligible — 1 token ping per key save)* |

### Group B — Service-level direct Anthropic calls (triggered by authed routes)

| # | File | Line(s) | Trigger path | Model | Verdict |
|---|------|---------|-------------|-------|---------|
| B1 | `services/skills/skill-chat.service.ts` | 55, 136, 185 | `POST /:dealId/skills/chat` (inline `requireAuth`, skill-chat.routes.ts:30) → `skillChat()` | Sonnet | ATTRIBUTED-NOT-METERED |
| B2 | `services/skills/skills/personas.ts` | 15, 154, 192 | Same skill-chat path → persona routing | Sonnet | ATTRIBUTED-NOT-METERED |
| B3 | `services/agents/collaborations/asset-manager-cfo.service.ts` | 90, 316 | Same skill-chat path → collaboration-skills.ts:116 | Sonnet | ATTRIBUTED-NOT-METERED |
| B4 | `services/agents/collaborations/cfo-lender.service.ts` | 81, 251 | Same skill-chat path → collaboration-skills.ts:43 | Sonnet | ATTRIBUTED-NOT-METERED |
| B5 | `services/agents/collaborations/compliance-legal.service.ts` | 90, 229 | Same skill-chat path → collaboration-skills.ts:359 | Sonnet | ATTRIBUTED-NOT-METERED |
| B6 | `services/agents/collaborations/leasing-revenue.service.ts` | 113, 312 | Same skill-chat path → collaboration-skills.ts:277 | Sonnet | ATTRIBUTED-NOT-METERED |
| B7 | `services/agents/collaborations/research-acquisitions.service.ts` | 82, 304, 355 | Same skill-chat path → collaboration-skills.ts:195 | Sonnet | ATTRIBUTED-NOT-METERED |
| B8 | `services/agents/collaborations/tax-cfo.service.ts` | 142, 476 | Same skill-chat path → collaboration-skills.ts:435 | Sonnet | ATTRIBUTED-NOT-METERED |
| B9 | `services/agents/deal-structuring.service.ts` | 112, 310 | Same skill-chat path → structuring-skills.ts:56 | Sonnet | ATTRIBUTED-NOT-METERED |
| B10 | `services/document-extraction/parsers/om-parser.ts` | 552, 553 | Upload/extraction routes (authed) → OM parser | Sonnet | ATTRIBUTED-NOT-METERED |
| B11 | `services/ai/aiService.ts` | 148, 208, 220, 435 | `llm.routes.ts` (inline `requireAuth` on all handlers) | Sonnet/configurable | ATTRIBUTED-NOT-METERED |
| B12 | `services/ai/planner-executor.service.ts` | 86, 147, 326 | `planner.routes.ts` `/plan`, `/execute`, `/extract`, `/analyze` — mount location not in routes/index.ts; floor auth presumed; **verify before metering** | Sonnet | ATTRIBUTED-NOT-METERED *(mount unconfirmed)* |

### Group C — Agent-tool direct Anthropic calls (compound leak inside metered agent runs)

This is the highest-risk structural finding. When the **research agent** runs via AgentRuntime, the
main LLM loop IS metered through `MeteringAdapter`. However, two tools registered in
`research.config.ts` (lines 100, 102) instantiate their own Anthropic clients and call
`messages.create` directly — **those calls bypass the meter entirely**.

| # | File | Line(s) | Called from | Model | Verdict |
|---|------|---------|-------------|-------|---------|
| C1 | `agents/tools/classify_as_deal_opportunity.ts` | 25, 62 | (a) research agent tool loop (research.config.ts:100); (b) email.routes.ts:469 (authed); (c) inngest email-intake (event bucket) | Haiku | **ATTRIBUTED-NOT-METERED** (paths a+b); PLATFORM-ABSORBED (path c) |
| C2 | `agents/tools/extract_deal_fields.ts` | 33, 83 | (a) research agent tool loop (research.config.ts:102); (b) email.routes.ts:481 (authed); (c) inngest email-intake (event bucket) | Haiku | **ATTRIBUTED-NOT-METERED** (paths a+b); PLATFORM-ABSORBED (path c) |

**Effect:** a single research agent run that invokes both tools generates **three** Anthropic API
calls — one metered (the agent's main loop) and two unmetered (the tools). The metered credit debit
understates actual cost.

### Group D — Platform-absorbed LLM calls (event/cron bucket)

| # | File | Line(s) | Trigger | Verdict |
|---|------|---------|---------|---------|
| D1 | `services/chat.service.ts` | 225, 265 | Twilio/WhatsApp inbound webhook reply (messageRouter.ts) | PLATFORM-ABSORBED |
| D2 | `services/chat/messageRouter.ts` | 149, 152 | Same Twilio webhook flow | PLATFORM-ABSORBED |
| D3 | `services/recipient-agent-executor.service.ts` | 146, 338 | Event-triggered agent execution | PLATFORM-ABSORBED |
| D4 | `services/market-event-extraction.service.ts` | 216 | Cron/event (market data pipeline) | PLATFORM-ABSORBED |

---

## NON-LLM EXTERNAL COST SITES

### Google Places / Maps API

| Pricing | Find Place: ~$17/1k; Place Details: ~$17/1k; Geocoding: ~$5/1k |
|---|---|

| # | File | Line(s) | Route / trigger | Auth | Verdict |
|---|------|---------|----------------|------|---------|
| GP1 | `api/rest/archive-properties.routes.ts` | 163, 167 | `GET /places-photo` — server-side photo proxy | broad `requireAuth` | ATTRIBUTED-NOT-METERED |
| GP2 | `api/rest/archive-properties.routes.ts` | 198, 241 | `POST /by-parcel/:parcelId/enrich` → `stepGooglePlaces()` in intake-orchestrator/worker.ts:495 | broad `requireAuth` | ATTRIBUTED-NOT-METERED |
| GP3 | `services/zoning.service.ts` | 83, 139, 146 | Geocoding via `GOOGLE_MAPS_API_KEY` — called from zoning lookup routes | broad `requireAuth` | ATTRIBUTED-NOT-METERED |

**Note:** `GOOGLE_PLACES_API_KEY` gated (worker.ts:484 — skipped if not set). `GOOGLE_MAPS_API_KEY`
separate key for geocoding (zoning.service.ts:83).

### Mapbox API

| Pricing | Isochrone: ~$0.50/1k; Geocoding: ~$0.50/1k; Free tier: 50k/month |
|---|---|

| # | File | Line(s) | Route | Auth | Verdict |
|---|------|---------|-------|------|---------|
| MB1 | `api/rest/isochrone.routes.ts` | 33–51 | `POST /isochrone/generate` | mount-level `requireAuth` (routes/index.ts:494) | ATTRIBUTED-NOT-METERED |
| MB2 | `api/rest/traffic-ai.routes.ts` | 26, 50, 56 | `POST /traffic-ai/generate` | mount-level `requireAuth` (routes/index.ts:495) | ATTRIBUTED-NOT-METERED |
| MB3 | `api/rest/zoning-capacity.routes.ts` | 930, 932 | Reverse-geocode inside zoning capacity flow | broad `requireAuth` | ATTRIBUTED-NOT-METERED |
| MB4 | `api/rest/zoning-capacity.routes.ts` | 1141 | Geocoding inside `/reverse-geocode` handler | broad `requireAuth` | ATTRIBUTED-NOT-METERED |

### ATTOM Property Data API

| Pricing | ~$0.10–$1.00/lookup (plan-dependent; ATTOM_API_KEY gated) |
|---|---|

| # | File | Line(s) | Trigger path | Auth | Verdict |
|---|------|---------|-------------|------|---------|
| AT1 | `services/tax/attomAdapter.ts` | 156, 161 | `propertyAppraiserFetcher.ts:189` → tax composition pipeline → triggered by authed deal/tax routes | authed via route mount | ATTRIBUTED-NOT-METERED |

**Note:** `fetchFromAttom()` is Tier 2 in a three-tier cascade (upload PDF → ATTOM → county adapter).
Gated at line 161: returns early if `ATTOM_API_KEY` not set. Active only when ATTOM_API_KEY is
configured in prod.

### Twilio SMS / WhatsApp

| Pricing | SMS outbound: ~$0.0079/msg; WhatsApp: ~$0.0147/conversation-day |
|---|---|

| # | File | Line(s) | Trigger | Attribution | Verdict |
|---|------|---------|---------|-------------|---------|
| TW1 | `services/notifications/channels/twilio.ts` | 99, 130 | Risk escalation alerts, agent-run completion notifications | userId on notification record | ATTRIBUTED-NOT-METERED |
| TW2 | `services/chat/messageRouter.ts` | 143, 152 | Twilio inbound webhook → conversation reply | Platform webhook (no per-user billing recoverable) | PLATFORM-ABSORBED |

### Resend Email

| Pricing | ~$0.001/email (varies by Replit integration plan) |
|---|---|

| # | File | Line(s) | Trigger | Auth | Verdict |
|---|------|---------|---------|------|---------|
| RE1 | `services/email.service.ts` | 181, 206 | Capsule share invitations (capsule-sharing.routes.ts:265, authed) | inline `requireAuth` | ATTRIBUTED-NOT-METERED |
| RE2 | `services/email.service.ts` | 181, 206 | Password reset (inline-auth.routes.ts:278) | inline auth check | ATTRIBUTED-NOT-METERED |

### Notarize.com Remote Notarization

| Pricing | ~$25–150/document (per-signature transaction fee) |
|---|---|

| # | File | Line(s) | Route | Auth | Verdict |
|---|------|---------|-------|------|---------|
| NO1 | `services/notarize/notarize-com.adapter.ts` | 10, 35 | `POST /deals/:dealId/notarize` (notarize.routes.ts:45) | inline `requireAuth` | ATTRIBUTED-NOT-METERED |

**Highest per-call cost of any non-LLM external service.** User-conscious (user explicitly initiates
a notarization flow). Low frequency.

### Telegram Bot API

| Pricing | FREE (no per-message charge) |
|---|---|

`services/notifications/channels/telegram.ts:94,106,188` — `POST /bot{token}/sendMessage`.  
Free Telegram Bot API, no billing exposure. Listed for completeness, not a cost surface.

---

## SERVICES CONFIRMED FREE (no cost surface)

| Service | Evidence |
|---|---|
| FRED API (St. Louis Fed) | Free registration key, no per-call charge. `utils/fred-api.client.ts`, `scripts/ingest-rate-data.ts`. |
| BLS API (Bureau of Labor Statistics) | Free federal API. `api/rest/admin.routes.ts:1210`. |
| Census API | Free federal API. `api/rest/admin.routes.ts:1188`, `api/rest/ingestion.routes.ts:148`. |
| ArcGIS county GIS layers | Public REST services (county assessor/parcel layers), no commercial tier. `services/benchmark-enrichment.service.ts`, `services/atlanta-benchmark-ingestion.service.ts`. |

---

## SERVICES REFERENCED BUT NOT WIRED (no active API calls)

| Service | Evidence of absence |
|---|---|
| RentCast | Mentioned in `research.agent.ts:7` comment and `types/dealContext.ts:186,189` — no SDK import, no HTTP call found. |
| CompStak | No SDK calls found in backend/src. |
| ApartmentIQ | No SDK calls found. |
| PredictHQ | No SDK calls found. |
| GDELT | No SDK calls found. |

---

## PLATFORM-ABSORBED COST SITES (COGS — intentional, not per-user)

| # | Service | File / trigger | Notes |
|---|---------|---------------|-------|
| PA1 | Anthropic (Haiku) | `inngest/functions/email-intake.function.ts:148,184` → classify + extract tools | Event bucket; platform cost per inbound deal email |
| PA2 | Anthropic (Sonnet) | `services/chat.service.ts:225,265` + `messageRouter.ts:152` | Twilio/WhatsApp chat reply; platform COGS for chat feature |
| PA3 | Anthropic (Sonnet) | `services/recipient-agent-executor.service.ts:146,338` | Event-triggered agent follow-up; platform cost |
| PA4 | Anthropic (Sonnet) | `services/market-event-extraction.service.ts:216` | Market data pipeline; likely cron-triggered |
| PA5 | FRED API | `scripts/ingest-rate-data.ts`, `scripts/ingest-leading-indicators.ts` | Scheduled ingest; free API anyway |
| PA6 | ArcGIS | `scripts/enrich-georgia-comps.ts`, `services/benchmark-enrichment.service.ts` | Admin-triggered county data ingest; free API |
| PA7 | Twilio | `services/chat/messageRouter.ts:143` | Inbound webhook → outbound reply; platform chat COGS |

---

## RANKED LEAKING / ATTRIBUTED-NOT-METERED QUEUE

The table below ranks every cost site that is **attributable to a user but not billed** against
their credits, ordered by estimated dollar exposure (unit cost × plausible call volume). This is the
prioritized wiring queue for future per-route metering dispatches.

> Each row is a separate dispatch: changing billing behavior requires its own verification.
> **STOP HERE** — this audit produces the queue only.

| Rank | Site(s) | Service | Est. unit cost | Vol. estimate | Priority |
|------|---------|---------|---------------|--------------|---------|
| **1** | `skill-chat.service.ts:136,185` + collaboration services B3–B9 (7 direct Anthropic calls per session) | Anthropic Sonnet | ~$0.03–$0.20/session | High — every skill-chat invocation | 🔴 **HIGHEST** |
| **2** | `development-scenarios.routes.ts:376,544,901` (3 routes) | Anthropic Sonnet | ~$0.01–$0.05/call | Medium — per dev-scenario session | 🔴 **HIGH** |
| **3** | Agent tool LLM calls `classify_as_deal_opportunity.ts:62` + `extract_deal_fields.ts:83` inside research agent runs | Anthropic Haiku | ~$0.002–$0.01/run (×2 per run) | High — every research agent run | 🔴 **HIGH** *(structural compound leak)* |
| **4** | `morning-brief.routes.ts:394` | Anthropic Sonnet | ~$0.02–$0.10/user/day | Medium — daily per active user | 🟠 MED |
| **5** | `zoning-capacity.routes.ts:1053` (AI fallback) | Anthropic Sonnet | ~$0.01–$0.05/call | Medium — per zoning query | 🟠 MED |
| **6** | `deal-market-intelligence.routes.ts:272` | Anthropic Sonnet | ~$0.01–$0.05/call | Medium — per deal market view | 🟠 MED |
| **7** | `om-parser.ts:553` (OM document extraction) | Anthropic Sonnet | ~$0.05–$0.20/doc | Low-Medium — per OM upload | 🟠 MED |
| **8** | `portfolio.routes.ts:1049` (agent-report) | Anthropic Sonnet | ~$0.01–$0.05/call | Low-Medium — per report request | 🟠 MED |
| **9** | `archive-properties.routes.ts:241` + `intake-orchestrator/worker.ts:495` (Places enrichment) | Google Places | ~$0.034/enrichment (find + detail) | Medium — per vault enrich | 🟠 MED |
| **10** | `risk.routes.ts:869` (narrative) | Anthropic Sonnet | ~$0.01–$0.05/call | Low — per risk narrative | 🟡 LOW |
| **11** | `aiService.ts:208,220,435` + `llm.routes.ts` | Anthropic Sonnet | ~$0.01–$0.05/call | Low-Medium | 🟡 LOW |
| **12** | `planner-executor.service.ts:147,326` via planner.routes.ts | Anthropic Sonnet | ~$0.01–$0.05/call | Unknown — mount unconfirmed | 🟡 LOW *(verify mount first)* |
| **13** | `services/tax/attomAdapter.ts:161` (`fetchFromAttom`) | ATTOM | ~$0.10–$1.00/lookup | Low — per tax lookup (key not confirmed active) | 🟠 MED *(when active)* |
| **14** | `isochrone.routes.ts:45` + `traffic-ai.routes.ts:50` | Mapbox Isochrone | ~$0.001/call (within free tier likely) | Medium — per isochrone request | 🟡 LOW |
| **15** | `zoning-capacity.routes.ts:932,1141` | Mapbox Geocoding | ~$0.001/call (within free tier likely) | Medium — per zoning lookup | 🟡 LOW |
| **16** | `building-envelope.routes.ts:153` | Anthropic Haiku | ~$0.002–$0.01/call | Low-Medium | 🟡 LOW |
| **17** | `archive-properties.routes.ts:163` (Places photo proxy) | Google Places | ~$0.007/photo | Low — user-triggered manually | 🟡 LOW |
| **18** | `services/zoning.service.ts:83,146` (geocoding) | Google Maps Geocoding | ~$0.005/call | Low — per zoning address lookup | 🟡 LOW |
| **19** | `notifications/channels/twilio.ts:99,130` | Twilio SMS/WhatsApp | ~$0.008–$0.015/msg | Low | 🟡 LOW |
| **20** | `notarize.routes.ts:45` → `notarize-com.adapter.ts:35` | Notarize.com | ~$25–150/doc | Very low (user-conscious action) | 🟡 LOW *(user intent is explicit)* |
| **21** | `email.service.ts:181,206` (Resend) | Resend | ~$0.001/email | Low | 🟡 LOW |

---

## THE LLM-OUTSIDE-METER LIST (highest $ risk, wire first)

Complete list of `anthropic.messages.create` call sites that bypass `MeteringAdapter`. Each is a
separate line item in the credit-meter wiring queue.

```
# Route-level (Group A)
backend/src/api/rest/development-scenarios.routes.ts:376   GET hbu
backend/src/api/rest/development-scenarios.routes.ts:544   GET regulatory-risk-analysis
backend/src/api/rest/development-scenarios.routes.ts:901   GET timeline-intelligence
backend/src/api/rest/deal-market-intelligence.routes.ts:272  GET market-intelligence
backend/src/api/rest/morning-brief.routes.ts:394             GET / + POST /refresh
backend/src/api/rest/portfolio.routes.ts:1049                POST agent-report
backend/src/api/rest/risk.routes.ts:869                      POST narrative
backend/src/api/rest/zoning-capacity.routes.ts:1053          POST zoning-capacity (AI fallback)
backend/src/api/rest/building-envelope.routes.ts:153         POST building-envelope

# Service-level triggered by authed routes (Group B)
backend/src/services/skills/skill-chat.service.ts:136,185
backend/src/services/skills/skills/personas.ts:154,192
backend/src/services/agents/collaborations/asset-manager-cfo.service.ts:316
backend/src/services/agents/collaborations/cfo-lender.service.ts:251
backend/src/services/agents/collaborations/compliance-legal.service.ts:229
backend/src/services/agents/collaborations/leasing-revenue.service.ts:312
backend/src/services/agents/collaborations/research-acquisitions.service.ts:304,355
backend/src/services/agents/collaborations/tax-cfo.service.ts:476
backend/src/services/agents/deal-structuring.service.ts:310
backend/src/services/document-extraction/parsers/om-parser.ts:553
backend/src/services/ai/aiService.ts:208,220,435
backend/src/services/ai/planner-executor.service.ts:147,326

# Agent-tool calls that compound metered research agent runs (Group C — structural)
backend/src/agents/tools/classify_as_deal_opportunity.ts:62
backend/src/agents/tools/extract_deal_fields.ts:83
```

**Total LLM call sites outside the meter: 25** (excluding the platform-absorbed Group D sites).

---

## NOTES ON SCOPE BOUNDARIES

- **DeepSeek:** `DeepSeekMeteringAdapter.ts` exists alongside `MeteringAdapter.ts` — DeepSeek calls
  through AgentRuntime are metered. No direct DeepSeek calls found outside AgentRuntime.
- **Stripe metering:** `MeteringAdapter` fires `jedi_input_tokens` + `jedi_output_tokens` Stripe
  billing meter events for user-bucket runs. Non-metered routes produce no Stripe events.
- **capsule-sharing API key test pings** (lines 1371, 1591): `max_tokens: 1` test validation — cost
  is negligible (~$0.000003/ping). Not worth a wiring dispatch.
- **llm.routes.ts:** All five handlers have inline `requireAuth`. Calls through `aiService.ts` —
  classified ATTRIBUTED-NOT-METERED at rank 11 above.
- **planner.routes.ts mount:** Not found in `routes/index.ts` or `index.replit.ts`. Floor auth at
  `/api/v1` covers it if mounted there, but the mount path should be verified before treating
  planner as metering-eligible.

---

*STOP — wiring is a separate per-route dispatch ranked by the table above.*
