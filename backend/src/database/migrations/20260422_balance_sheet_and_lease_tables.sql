-- Balance Sheet, Lease Transactions, and Unit Mix tables
-- Created: 2026-04-22

-- ═══════════════════════════════════════════════════════════════════════════════
-- BALANCE SHEETS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS balance_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  report_month DATE NOT NULL,
  
  -- Assets
  cash NUMERIC(14,2),
  accounts_receivable NUMERIC(14,2),
  prepaid_expenses NUMERIC(14,2),
  other_current_assets NUMERIC(14,2),
  fixed_assets NUMERIC(14,2),
  total_assets NUMERIC(14,2),
  
  -- Liabilities
  accounts_payable NUMERIC(14,2),
  accrued_expenses NUMERIC(14,2),
  security_deposits NUMERIC(14,2),
  prepaid_rent NUMERIC(14,2),
  other_liabilities NUMERIC(14,2),
  total_liabilities NUMERIC(14,2),
  
  -- Equity
  contributed_capital NUMERIC(14,2),
  retained_earnings NUMERIC(14,2),
  current_year_earnings NUMERIC(14,2),
  total_equity NUMERIC(14,2),
  
  -- Meta
  source TEXT DEFAULT 'manual', -- 'manual', 'bpi_import', 'pms_sync'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(deal_id, report_month)
);

CREATE INDEX IF NOT EXISTS idx_balance_sheets_deal_month ON balance_sheets(deal_id, report_month DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- LEASE TRANSACTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lease_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  unit_number TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('new_lease', 'renewal', 'move_out', 'transfer')),
  effective_date DATE NOT NULL,
  lease_end_date DATE,
  
  -- Financials
  rent NUMERIC(10,2),
  prior_rent NUMERIC(10,2),
  concessions NUMERIC(10,2),
  
  -- Resident info
  resident_name TEXT,
  
  -- Meta
  source TEXT DEFAULT 'manual', -- 'manual', 'pms_sync', 'derived'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lease_transactions_deal_date ON lease_transactions(deal_id, effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_lease_transactions_type ON lease_transactions(deal_id, transaction_type);

-- ═══════════════════════════════════════════════════════════════════════════════
-- UNIT MIX
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS unit_mix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  unit_type TEXT NOT NULL,
  bed_count INT NOT NULL DEFAULT 1,
  bath_count INT NOT NULL DEFAULT 1,
  sqft INT,
  count INT NOT NULL DEFAULT 0,
  occupied INT NOT NULL DEFAULT 0,
  avg_rent NUMERIC(10,2),
  market_rent NUMERIC(10,2),
  total_rent NUMERIC(12,2),
  
  -- Meta
  as_of_date DATE DEFAULT CURRENT_DATE,
  source TEXT DEFAULT 'manual', -- 'manual', 'rent_roll', 'pms_sync'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unit_mix_deal ON unit_mix(deal_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unit_mix_deal_type ON unit_mix(deal_id, unit_type) WHERE source != 'derived';

-- ═══════════════════════════════════════════════════════════════════════════════
-- COMP SET ADD/EDIT ENHANCEMENTS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add missing columns to deal_comp_sets if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deal_comp_sets' AND column_name = 'tier') THEN
    ALTER TABLE deal_comp_sets ADD COLUMN tier TEXT DEFAULT 'secondary' CHECK (tier IN ('primary', 'secondary'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deal_comp_sets' AND column_name = 'class') THEN
    ALTER TABLE deal_comp_sets ADD COLUMN class TEXT; -- A, B, C, etc.
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deal_comp_sets' AND column_name = 'distance_mi') THEN
    ALTER TABLE deal_comp_sets ADD COLUMN distance_mi NUMERIC(5,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deal_comp_sets' AND column_name = 'avg_rent') THEN
    ALTER TABLE deal_comp_sets ADD COLUMN avg_rent NUMERIC(10,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deal_comp_sets' AND column_name = 'occupancy') THEN
    ALTER TABLE deal_comp_sets ADD COLUMN occupancy NUMERIC(5,2);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Comments
-- ═══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE balance_sheets IS 'Monthly balance sheet snapshots for owned assets';
COMMENT ON TABLE lease_transactions IS 'Lease activity: new leases, renewals, move-outs, transfers';
COMMENT ON TABLE unit_mix IS 'Unit mix breakdown by bedroom/bath type';
