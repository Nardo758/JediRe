-- §E follow-up: Reconcile all pre-F2(a) stale 'basic' deals to their owner's UCB tier.
--
-- Background: before F2(a) was fixed, deals.tier was written from req.body with
-- `tier || 'basic'` as the default. Any deal created without an explicit tier in
-- the body landed as 'basic' regardless of the owner's actual subscription tier.
-- Migration #1591 reconciled the enterprise/pro deals; this migration reconciles
-- the remaining 'basic' deals that also have stale tiers.
--
-- Two groups:
--   (a) 14 deals owned by the operator user (Leon Dixon) → correct tier = 'operator'
--   (b)  2 [CS-AUDIT] deals owned by a user with no UCB row → correct tier = 'scout'
--
-- Step 1: update deals whose owner has a non-basic UCB row to match that tier.
-- Step 2: update remaining 'basic' deals (owner has no UCB row) to 'scout'.
-- Both steps are idempotent and safe to re-run.
--
-- Expected result: deals.tier distribution = operator×27 / scout×5 / no 'basic'.

-- Step 1: owner has a UCB row with a non-basic tier
UPDATE deals d
SET    tier = COALESCE(ucb.subscription_tier, 'scout'),
       updated_at = NOW()
FROM   users u
LEFT   JOIN user_credit_balances ucb ON ucb.user_id = u.id
WHERE  d.user_id = u.id
  AND  d.tier = 'basic'
  AND  ucb.subscription_tier IS DISTINCT FROM 'basic'
  AND  ucb.subscription_tier IS NOT NULL;

-- Step 2: owner has no UCB row → COALESCE default is 'scout'
UPDATE deals
SET    tier = 'scout',
       updated_at = NOW()
WHERE  tier = 'basic';
