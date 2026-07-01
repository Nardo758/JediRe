-- B2a: Org-level entitlement core
-- Creates org_credit_balances (shared pool per org), adds org_id to ai_usage_log
-- for per-member attribution, and seeds the one real org (dd201183) at its tier allotment.
--
-- Seed strategy (Requirement 1): pool is seeded from the TIER allotment, not from Leon's
-- stale user_credit_balances.credits_remaining (which reflects arbitrary test usage).
-- operator tier allotment = 500 credits; credits_used_this_period = 0; fresh period bounds.

CREATE TABLE IF NOT EXISTS org_credit_balances (
  org_id                   UUID        NOT NULL PRIMARY KEY
                             REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_tier        TEXT        NOT NULL DEFAULT 'scout',
  credits_included_monthly NUMERIC     NOT NULL DEFAULT 100,
  credits_remaining        NUMERIC     NOT NULL DEFAULT 100,
  credits_used_this_period NUMERIC     NOT NULL DEFAULT 0,
  monthly_credit_cap       NUMERIC     NULL,      -- NULL = unlimited (Institutional)
  period_start             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_end               TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
  stripe_customer_id       TEXT,                  -- reserved for B3 org billing; NULL in B2a
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-member attribution column: records which org's pool was charged on every AI call.
-- Nullable for backward compatibility (pre-B2a rows have no org context).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_usage_log' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE ai_usage_log ADD COLUMN org_id UUID NULL REFERENCES organizations(id);
    CREATE INDEX ai_usage_log_org_id_idx ON ai_usage_log(org_id);
  END IF;
END $$;

-- Seed dd201183 (Leon Dixon, operator tier) at the operator allotment (500 credits).
-- Phase 1 confirmed: Leon's credits_remaining = 406 (stale from testing);
-- the correct seed value is the tier allotment: 500.
INSERT INTO org_credit_balances (
  org_id, subscription_tier, credits_included_monthly,
  credits_remaining, credits_used_this_period, monthly_credit_cap,
  period_start, period_end, updated_at
)
VALUES (
  'dd201183-3cb5-45dd-8485-d17f5a053421',
  'operator',
  500,
  500,
  0,
  500,
  NOW(),
  NOW() + INTERVAL '1 month',
  NOW()
)
ON CONFLICT (org_id) DO NOTHING;
