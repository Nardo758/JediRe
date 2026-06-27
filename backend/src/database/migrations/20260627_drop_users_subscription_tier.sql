-- A9-Finding-1: Drop zombie users.subscription_tier column
--
-- Context:
--   users.subscription_tier is a fossil from a prior billing system.
--   The canonical tier lives in user_credit_balances.subscription_tier,
--   written exclusively by the Stripe webhook path (creditService.ts).
--   The users column has DEFAULT 'free'::subscription_tier (old vocab:
--   free/professional/team/enterprise) and is NOT NULL — all new users
--   received 'free', which was NOT in the inngest allow-lists, causing
--   agents to deny every net-new paying customer.
--
-- Fix verified (S1-01, 2026-06-27):
--   All live readers repointed to user_credit_balances via LEFT JOIN +
--   COALESCE(..., 'scout'). Inngest runs confirmed UCB tier is read
--   correctly; no "tier gate blocked" from stale vocabulary.
--
-- No Drizzle schema declares this column — DROP will not fight schema regen.

ALTER TABLE users DROP COLUMN IF EXISTS subscription_tier;

-- The subscription_tier enum type may still be referenced by other tables
-- (e.g. user_credit_balances uses its own text column, not this enum).
-- Leave the enum type in place; drop it separately only if confirmed unused.
