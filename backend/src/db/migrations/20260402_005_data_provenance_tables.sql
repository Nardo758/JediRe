ALTER TABLE deal_monthly_actuals
  ADD COLUMN IF NOT EXISTS source_document_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS source_period_label VARCHAR(50);

ALTER TABLE deal_lease_transactions
  ADD COLUMN IF NOT EXISTS lease_end DATE,
  ADD COLUMN IF NOT EXISTS move_in_date DATE,
  ADD COLUMN IF NOT EXISTS move_out_date DATE,
  ADD COLUMN IF NOT EXISTS tenant_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS effective_rent NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS concession_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS lease_status VARCHAR(30),
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(30),
  ADD COLUMN IF NOT EXISTS source_ref VARCHAR(500),
  ADD COLUMN IF NOT EXISTS source_date DATE;

ALTER TABLE deal_assumptions
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(30) DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_ref VARCHAR(500),
  ADD COLUMN IF NOT EXISTS source_date DATE;

CREATE TABLE IF NOT EXISTS deal_balance_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL,
  report_month DATE NOT NULL,
  total_assets NUMERIC(14,2),
  cash NUMERIC(14,2),
  accounts_receivable NUMERIC(12,2),
  prepaid_expenses NUMERIC(12,2),
  real_estate_assets NUMERIC(14,2),
  accumulated_depreciation NUMERIC(14,2),
  other_assets NUMERIC(12,2),
  total_liabilities NUMERIC(14,2),
  mortgage_balance NUMERIC(14,2),
  accounts_payable NUMERIC(12,2),
  accrued_expenses NUMERIC(12,2),
  security_deposits NUMERIC(12,2),
  other_liabilities NUMERIC(12,2),
  total_equity NUMERIC(14,2),
  partner_capital NUMERIC(14,2),
  retained_earnings NUMERIC(14,2),
  reserves NUMERIC(12,2),
  escrows NUMERIC(12,2),
  tax_escrow NUMERIC(12,2),
  insurance_escrow NUMERIC(12,2),
  replacement_reserve NUMERIC(12,2),
  source_type VARCHAR(30),
  source_ref VARCHAR(500),
  source_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_balance_deal ON deal_balance_sheets(deal_id);
CREATE INDEX IF NOT EXISTS idx_balance_month ON deal_balance_sheets(report_month);
CREATE UNIQUE INDEX IF NOT EXISTS idx_balance_deal_month ON deal_balance_sheets(deal_id, report_month);

CREATE TABLE IF NOT EXISTS deal_capex_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL,
  category VARCHAR(100) NOT NULL,
  description VARCHAR(500),
  vendor VARCHAR(200),
  budgeted_amount NUMERIC(12,2),
  actual_amount NUMERIC(12,2),
  remaining_amount NUMERIC(12,2),
  completion_pct NUMERIC(5,2),
  start_date DATE,
  completion_date DATE,
  status VARCHAR(30) DEFAULT 'planned',
  invoice_ref VARCHAR(200),
  source_type VARCHAR(30),
  source_ref VARCHAR(500),
  source_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capex_deal ON deal_capex_items(deal_id);
CREATE INDEX IF NOT EXISTS idx_capex_category ON deal_capex_items(category);
CREATE INDEX IF NOT EXISTS idx_capex_status ON deal_capex_items(status);

CREATE TABLE IF NOT EXISTS deal_debt_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL,
  lender VARCHAR(200),
  loan_type VARCHAR(50),
  original_amount NUMERIC(14,2),
  current_balance NUMERIC(14,2),
  interest_rate NUMERIC(7,4),
  rate_type VARCHAR(20),
  spread NUMERIC(5,4),
  index_rate VARCHAR(30),
  maturity_date DATE,
  origination_date DATE,
  amortization_years INTEGER,
  io_period_months INTEGER,
  monthly_payment NUMERIC(12,2),
  monthly_principal NUMERIC(12,2),
  monthly_interest NUMERIC(12,2),
  annual_debt_service NUMERIC(14,2),
  ltv NUMERIC(5,4),
  dscr NUMERIC(5,2),
  debt_yield NUMERIC(5,4),
  prepayment_type VARCHAR(50),
  prepayment_expiry DATE,
  covenants JSONB,
  is_active BOOLEAN DEFAULT true,
  source_type VARCHAR(30),
  source_ref VARCHAR(500),
  source_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debt_deal ON deal_debt_schedule(deal_id);
CREATE INDEX IF NOT EXISTS idx_debt_lender ON deal_debt_schedule(lender);
CREATE INDEX IF NOT EXISTS idx_debt_maturity ON deal_debt_schedule(maturity_date);
CREATE INDEX IF NOT EXISTS idx_debt_active ON deal_debt_schedule(is_active);
