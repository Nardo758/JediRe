---
name: Research/Supply/Zoning automated pipeline — live health findings
description: What actually happens when deal.created fires through Inngest, as of a live trace — gate status, LLM failures, and a property-link collision bug.
---

## automation_level gate has silently blocked ALL automated research, platform-wide

`researchOnDealCreated` (and presumably Supply, gated the same way) requires `user_credit_balances.automation_level >= 2` before running. Queried the full table live: **zero rows** have ever had this value above the default of 1. Automated research-on-create has never fired for a real user since this gate was introduced — it is not a per-user edge case, it is the universal default state.

**Why this matters:** any assumption that "research runs automatically when a deal is created" is currently false for 100% of users. Anyone debugging "why doesn't my new deal have research data" should check this column first, before suspecting the Inngest event, the LLM call, or any research tool.

**How to apply:** if/when this is intentionally turned on, it needs an explicit product decision on rollout (who gets automation_level=2 and how), not just a code fix. To live-trace the pipeline in dev, temporarily `UPDATE user_credit_balances SET automation_level = 2 WHERE user_id = ...`, then revert after — do not leave it flipped.

## DeepSeek 402 blocks agents before any tool call, not just before final output

Confirmed live: Research and Supply agents both fail with HTTP 402 (DeepSeek insufficient balance) at the very first LLM call — `tokens_in`/`tokens_out` both 0. This means zero research tools (fetch_comps, fetch_tax_bill, fetch_parcel, fetch_ownership) are ever invoked when this happens; it is not that they return empty, they are never called. Already known as an environment-only issue per `ramp-target-and-tri-tab-reconciliation.md`, but confirmed here to also block the create-time research chain specifically, not just F9 model builds.

## Zoning Agent: LLM call succeeds, structured-output validation fails

Distinct failure mode from the 402s above — Zoning gets a real LLM response (confirmed via non-zero token counts) but the response doesn't match the expected Zod schema (missing `zoning_code`, `max_far`, `permitted_uses`, `entitlement_risk`, etc.), so the run is marked failed post-hoc. Its `web_search` (Tavily) tool call also failed separately with an empty error object in the same run. Two independent problems in one agent — worth isolating if zoning reliability work is ever prioritized.

## Property-link Step B throws a real, swallowed unique-constraint error on address collision

`properties.address_line1` has a hard `UNIQUE` index (`idx_properties_address`). The create-path's Step A/B property-linking logic (`inline-deals.routes.ts`, D-DEAL-1/CREATE-1) only checks `deal_id IS NULL` before Step A's UPDATE; if a second deal is created with the *exact same address string* as an already-claimed property, Step A matches nothing (deal_id not null) and Step B's INSERT throws `23505 duplicate key value violates unique constraint "idx_properties_address"`. This is caught by a deliberately non-fatal `catch` (deal creation must not block), so the second deal silently ends up with **zero** properties row at all — worse than the pre-CREATE-1 NULL-address stub, since now there's no stub row whatsoever for the Valuation Grid join to find.

**Why:** confirmed by direct SQL reproduction against the live `idx_properties_address` unique index — reproduces the exact 23505 error.

**How to apply:** any future work on the property-linking seam should either (a) scope Step A's match beyond `deal_id IS NULL` to also handle "address already claimed by another deal" by creating a duplicate/tracked property row instead of a stub, or (b) catch the specific 23505 on Step B and fall back to a NULL-address stub insert rather than giving up entirely. Not fixed as part of CREATE-1 — flagged as a follow-up.
