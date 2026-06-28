# JediRE — Session Handoff (2026-06-27) — FINAL

Code is committed and pushed (origin/master). This doc is the narrative record tying the
commits together. Everything below is closed-and-proven unless marked deferrable.

## Closed & proven this session
- **A9-Finding-1 (zombie users.subscription_tier):** CLOSED. Column dropped
  (20260627_drop_users_subscription_tier.sql), readers repointed to user_credit_balances,
  admission test proven (automation_level=2 defeated the masking gate; both trigger patterns
  admitted operator, scout denied via CashFlow's own log). Detail in
  docs/architecture/a9-finding-1-tier-divergence.md.
- **F2(a) write-path privilege escalation:** CLOSED. deals.tier derived from UCB server-side
  (body value ignored). HTTP-proven: body 'institutional' + operator token → stored 'operator'.
- **F2(b) legacy-vocab deal tiers:** CLOSED, per-deal verified. Reconciled 16 enterprise/pro +
  16 basic-drift deals. Final: 32/32 deals.tier == COALESCE(ucb.subscription_tier,'scout').
- **F3 automation_level auto-raise on upgrade:** CLOSED, proven both directions (scout→operator
  1→2; operator→scout caps at 1).
- **F6 / F6(b) auth-ordering:** CLOSED. requireAuth before requireSurface on deals (201 where it
  was 401) and per-route inside MessageRouter for chat (4-axis: chat unauthed 401, chat authed
  200, twilio/telegram webhooks stay 200).
- **deal_status 'active'→'PROSPECT':** CLOSED. HTTP deal creation was 500ing for everyone; fixed.
- **Zombie sweep COMPLETE:** users.subscription_tier (dropped), users.enabled_modules (dropped),
  auth.routes.ts (dead route file, deleted). |'free'→|'scout' fallback fixed at inline-auth.
- **Event-driven credit metering:** CLOSED — wired + enforced + verified.
  - All 5 agents debit on event runs (research/cashflow 10, supply/zoning/commentary 5).
  - monthly_credit_cap written at the writer (provisionUser/updateTier) so new users get a cap,
    not NULL; existing NULL row backfilled. Hard-block reachable for non-institutional users.
  - Debit verified by observation: 480→445, 35/deal exact, per-agent deducted:true.
  - Idempotency RETRY-TESTED (residual CLOSED): forced throw after credit-debit step, Inngest
    retried, 2 executions / 1 debit, balance exact at 410, zero drift. step.run() memoization
    observed, not merely contract-relied-upon.

## Remaining — genuinely deferrable, nothing broken
- user_module_settings enforcement at agent dispatch (deferred feature; real module system is
  table-driven, scaffolding built, dispatch gate not wired — confirm if any module is meant to be
  gated pre-launch).
- F4 runtime confirm (principal + attribution-off → suppressed).
- F5/roles product decision (non-admin roles enforce nothing; decide if they ever should).
- §C-2 property-data completeness (NULL property_type/lot_size_sqft on linked properties).
- Cosmetic frontend vocab (authStore.ts/testUtils.tsx/MapTabsBar.tsx still declare
  'basic'|'pro'|'enterprise').

## Honest one-line status
No open launch-path breaks and no open launch-economics exposure. Event-driven metering fully
closed — wired + enforced (caps at the writer) + debit-verified by observation + retry-tested by
forced-throw. Every piece observation-grade, zero residual. Genuinely deferrable remainder:
user_module_settings enforcement (feature), F4 runtime confirm, F5/roles decision, §C-2 property
data, cosmetic vocab.
