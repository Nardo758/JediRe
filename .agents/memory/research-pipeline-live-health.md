---
name: Research/Supply/Zoning automated pipeline — live health findings
description: What actually happens when deal.created fires through Inngest, as of a live trace — gate status, LLM failures, and a property-link collision bug.
---

## automation_level gate retired — trigger is now org credit balance (CREATE-1 C1, fixed)

The old `user_credit_balances.automation_level >= 2` gate blocked automated Research/Supply for 100% of users forever (no row ever had that value). It has been replaced in `research.inngest.ts` / `supply.inngest.ts` with an org-credit-based trigger: resolve the user's org via `resolveOrgForUser`, allow through if the user has no org (fail-open, not a hard requirement), block if `org_credit_balances.credits_remaining <= 0`. A blocked run still writes an explicit `agent_runs` row (`status='budget_exceeded'`, `error='<agent> skipped — no credits'`) — never a silent no-op. Live-verified: runs succeed and debit credits when balance > 0, and produce the explicit skip row when balance = 0.

**Why this matters:** other `automation_level` readers were intentionally left untouched (out of scope for this fix) — `cashflow.inngest.ts` (x2), `commentary.inngest.ts`, `zoning.inngest.ts`, plus `creditService.ts`/`sessionStore.ts` references. Anyone auditing automation gating platform-wide should check each of those individually; they do not share the new org-credit gate.

**How to apply:** if a research/supply run isn't firing, check org credit balance and `resolveOrgForUser` resolution (default_org_id → org_members fallback), not the old automation_level column.

## DeepSeek 402 note is stale — pipeline runs clean as of 2026-07-08

A prior finding here said DeepSeek 402 (insufficient balance) blocked Research/Supply before any tool call. Re-traced live on 2026-07-08: both agents completed successfully end-to-end (real LLM calls, real token counts, real cost_usd), so the DeepSeek balance issue no longer reproduces. Treat any future "agent gets 0 tokens_in/tokens_out" report as a fresh incident to re-diagnose, not a recurrence of this old one.

## Zoning Agent: LLM call succeeds, structured-output validation fails

Distinct failure mode — Zoning gets a real LLM response (non-zero token counts) but the response doesn't match the expected Zod schema (missing `zoning_code`, `max_far`, `permitted_uses`, `entitlement_risk`, etc.), so the run is marked failed post-hoc. Its `web_search` (Tavily) tool call also failed separately with an empty error object in the same run. Not touched by CREATE-1 (explicitly out of scope) — still an open issue if zoning reliability work is ever prioritized.

## Property-link address collision — fixed (CREATE-1 C2)

`properties.address_line1` has a unique index. Previously, a second deal created with the exact same address string as an already-claimed property would hit a swallowed 23505 unique-violation on the create-path's Step B INSERT, leaving that deal with **zero** property rows. Fixed: Step B now checks for an existing property by normalized address first (`normalizeAddress`, exported from `deal-property-linker.service.ts`); if found, it links the new deal to the *same* property row via `deal_properties` (idempotent `ON CONFLICT DO NOTHING`) instead of attempting a duplicate INSERT. Live-verified: two deals at the same address now resolve to one shared `properties.id`, one row each in `deal_properties` (relationship=`subject`, linked_by=`auto`).

**How to apply:** the legacy Valuation Grid `getSubjectProperty` query still joins on `properties.deal_id = deals.id` (1:1 exclusive column) rather than `deal_properties` — this is pre-existing debt, not fixed by C2, and will not see the second deal's link. Any future work touching that query path should migrate it to `deal_properties`.
