---
name: Deal create-path architecture (live vs dead code)
description: Which files are the REAL create paths vs dead/unmounted code, and the two parallel property-linking mechanisms that coexist.
---

## The rule

Before citing a "deal creation" file by name, verify it's actually mounted in `routes/index.ts` — a NestJS-style `deals.service.ts`/`deals.controller.ts` pair exists in this codebase but is **not imported/mounted anywhere** and is fully dead code. Audits/docs that cite it as the live create path are wrong.

**Why:** Confirmed by direct read of `routes/index.ts` — only `inline-deals.routes.ts` is imported. The real live web create route is `POST /` in `inline-deals.routes.ts`.

**How to apply:** Grep `routes/index.ts` for the actual mount before trusting any file:line citation about deal creation, chat tool dispatch, or similar "which file handles X" claims from prior docs/audits (see also gotcha P11 in replit.md).

## No chat-driven create_deal tool exists

`unified-orchestrator.ts` (`process()`) is intent-classify → agent-delegate → synthesize for Q&A/analysis only — it has no case/dispatch that creates a deal. The only two real deal-creation surfaces are: (1) web `POST /` in `inline-deals.routes.ts`, and (2) email-intake `create_deal_draft.ts` (Gmail automation draft, not a conversational/chat tool). Any doc claiming a chat "create_deal" tool via `messageRouter.ts` is describing Telegram webhook route registration, not a create-deal dispatch.

## Two parallel property-linking mechanisms (both real, kept in sync)

- `properties.deal_id` — a 1:1 FK column, written directly by `inline-deals.routes.ts` create route (Step A: address-match UPDATE; Step B: INSERT stub). Consumed by the Valuation Grid join `properties p ON p.deal_id = d.id`.
- `deal_properties` — a many-to-many join table, written by `DealPropertyLinkerService.autoLinkDeal()` (exact/fuzzy match + `createPropertyFromDeal`). Consumed by `zoning-triangulation.routes.ts`.

As of CREATE-1 (2026-07-08), the live create route calls both: it fixes Step B to populate real `address_line1`/`city`/`state_code` (was `NULL` before), and fire-and-forget calls `autoLinkDeal()` afterward so the join table stays populated too. Neither mechanism was removed — they intentionally run in parallel until unified in a later dispatch.
