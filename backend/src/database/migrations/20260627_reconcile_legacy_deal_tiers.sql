-- §E-F2(b): Reconcile legacy-vocab deal tiers (enterprise/pro) to canonical UCB tiers.
--
-- Background: deals.tier was written from req.body at creation (pre-F2a fix) and
-- could receive legacy vocab ('enterprise', 'pro') or be set arbitrarily by the
-- client. These values are not in ALLOWED_TIERS and have no TIER_CONFIG entry.
-- Once F3 raises automation_level, payload-tier agents would deny these deals.
--
-- Reconciliation rule: map each deal to the CURRENT UCB tier of its owner.
-- If the owner has no UCB row (COALESCE → 'scout'), use 'scout'.
-- This is idempotent: re-running maps to the same UCB value.
--
-- Affected: enterprise (9 deals) + pro (7 deals) = 16 deals.
-- UCB state at reconciliation: enterprise-owned → 3 scout + 6 operator;
--                               pro-owned → 7 operator.

UPDATE deals d
SET    tier = COALESCE(ucb.subscription_tier, 'scout'),
       updated_at = NOW()
FROM   users u
LEFT   JOIN user_credit_balances ucb ON ucb.user_id = u.id
WHERE  d.user_id = u.id
  AND  d.tier IN ('enterprise', 'pro');
