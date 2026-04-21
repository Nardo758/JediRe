-- Migration 011: Investor & Capital Tracking System
-- 10 tables for LP/GP investor management, capital calls,
-- distributions, waterfall config, and capital account ledger.
-- Applied 2026-04-21.

CREATE TABLE IF NOT EXISTS investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'lp' CHECK (type IN ('lp','gp','co_invest','fund_of_funds','other')),
  entity_type TEXT DEFAULT 'individual' CHECK (entity_type IN ('individual','trust','llc','lp','corporation','fund','other')),
  email TEXT,
  phone TEXT,
  address JSONB,
  kyc_status TEXT NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending','in_review','approved','rejected')),
  kyc_completed_at TIMESTAMPTZ,
  accredited BOOLEAN DEFAULT false,
  federal_withholding_pct NUMERIC(5,2) DEFAULT 0,
  state_withholding_pct  NUMERIC(5,2) DEFAULT 0,
  foreign_withholding_pct NUMERIC(5,2) DEFAULT 0,
  bank_name TEXT,
  bank_routing TEXT,
  bank_account TEXT,
  tax_id_last4 TEXT,
  notes TEXT,
  metadata JSONB,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_investors_user ON investors(user_id);
CREATE INDEX IF NOT EXISTS idx_investors_type ON investors(type);

CREATE TABLE IF NOT EXISTS deal_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  commitment_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  ownership_pct NUMERIC(8,4),
  class TEXT DEFAULT 'class_a',
  status TEXT NOT NULL DEFAULT 'committed' CHECK (status IN ('soft_circle','committed','funded','redeemed')),
  subscription_signed_at TIMESTAMPTZ,
  funded_amount NUMERIC(15,2) DEFAULT 0,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(deal_id, investor_id, class)
);
CREATE INDEX IF NOT EXISTS idx_deal_investments_deal ON deal_investments(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_investments_investor ON deal_investments(investor_id);

CREATE TABLE IF NOT EXISTS capital_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  call_number INTEGER NOT NULL,
  call_date DATE NOT NULL,
  due_date DATE NOT NULL,
  total_amount NUMERIC(15,2) NOT NULL,
  purpose TEXT,
  allocation_method TEXT NOT NULL DEFAULT 'pro_rata' CHECK (allocation_method IN ('pro_rata','commitment_pct','custom')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','partially_paid','fully_paid','defaulted')),
  notes TEXT,
  sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(deal_id, call_number)
);
CREATE INDEX IF NOT EXISTS idx_capital_calls_deal ON capital_calls(deal_id);
CREATE INDEX IF NOT EXISTS idx_capital_calls_status ON capital_calls(status);

CREATE TABLE IF NOT EXISTS capital_call_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capital_call_id UUID NOT NULL REFERENCES capital_calls(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  allocated_amount NUMERIC(15,2) NOT NULL,
  paid_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ,
  default_interest NUMERIC(15,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','partial','defaulted','waived')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(capital_call_id, investor_id)
);
CREATE INDEX IF NOT EXISTS idx_cc_items_call ON capital_call_items(capital_call_id);
CREATE INDEX IF NOT EXISTS idx_cc_items_investor ON capital_call_items(investor_id);

CREATE TABLE IF NOT EXISTS distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  distribution_number INTEGER NOT NULL,
  distribution_date DATE NOT NULL,
  total_amount NUMERIC(15,2) NOT NULL,
  distribution_type TEXT NOT NULL DEFAULT 'operating' CHECK (distribution_type IN ('operating','refinance','sale','return_of_capital','special')),
  allocation_method TEXT NOT NULL DEFAULT 'waterfall' CHECK (allocation_method IN ('pro_rata','waterfall')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','processing','completed','reversed')),
  tax_year INTEGER,
  notes TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(deal_id, distribution_number)
);
CREATE INDEX IF NOT EXISTS idx_distributions_deal ON distributions(deal_id);

CREATE TABLE IF NOT EXISTS distribution_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id UUID NOT NULL REFERENCES distributions(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  gross_amount NUMERIC(15,2) NOT NULL,
  return_of_capital NUMERIC(15,2) NOT NULL DEFAULT 0,
  preferred_return NUMERIC(15,2) NOT NULL DEFAULT 0,
  profit_share NUMERIC(15,2) NOT NULL DEFAULT 0,
  promote NUMERIC(15,2) NOT NULL DEFAULT 0,
  federal_withholding NUMERIC(15,2) NOT NULL DEFAULT 0,
  state_withholding NUMERIC(15,2) NOT NULL DEFAULT 0,
  foreign_withholding NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(15,2),
  k1_included BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(distribution_id, investor_id)
);
CREATE INDEX IF NOT EXISTS idx_dist_items_distribution ON distribution_items(distribution_id);
CREATE INDEX IF NOT EXISTS idx_dist_items_investor ON distribution_items(investor_id);

CREATE TABLE IF NOT EXISTS deal_waterfalls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  pref_rate NUMERIC(5,4) NOT NULL DEFAULT 0.08,
  catchup_pct NUMERIC(5,4) NOT NULL DEFAULT 1.0,
  clawback BOOLEAN NOT NULL DEFAULT false,
  clawback_lookback_months INTEGER DEFAULT 24,
  lp_gp_split_base NUMERIC(5,2) DEFAULT 80,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(deal_id)
);

CREATE TABLE IF NOT EXISTS waterfall_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waterfall_id UUID NOT NULL REFERENCES deal_waterfalls(id) ON DELETE CASCADE,
  tier_order INTEGER NOT NULL,
  irr_hurdle_low NUMERIC(5,4),
  irr_hurdle_high NUMERIC(5,4),
  lp_pct NUMERIC(5,2) NOT NULL DEFAULT 80,
  gp_pct NUMERIC(5,2) NOT NULL DEFAULT 20,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(waterfall_id, tier_order)
);
CREATE INDEX IF NOT EXISTS idx_wf_tiers_waterfall ON waterfall_tiers(waterfall_id);

CREATE TABLE IF NOT EXISTS capital_account_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('contribution','distribution','adjustment','fee','interest')),
  amount NUMERIC(15,2) NOT NULL,
  reference_id UUID,
  reference_type TEXT,
  entry_date DATE NOT NULL,
  description TEXT,
  running_balance NUMERIC(15,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cap_entries_deal ON capital_account_entries(deal_id);
CREATE INDEX IF NOT EXISTS idx_cap_entries_investor ON capital_account_entries(investor_id, deal_id);

CREATE TABLE IF NOT EXISTS commitment_tranches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id UUID NOT NULL REFERENCES deal_investments(id) ON DELETE CASCADE,
  tranche_number INTEGER NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  due_date DATE,
  funded_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','called','funded','waived')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(investment_id, tranche_number)
);
CREATE INDEX IF NOT EXISTS idx_tranches_investment ON commitment_tranches(investment_id);
