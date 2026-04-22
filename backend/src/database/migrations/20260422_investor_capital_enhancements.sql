-- ============================================================================
-- 20260422_investor_capital_enhancements.sql
-- Enhance Replit's investor capital schema with enterprise features
-- Run AFTER 20260421_011_investor_capital_tables.sql
-- ============================================================================

-- ============================================================================
-- PART 1: ADD MISSING COLUMNS TO INVESTORS
-- ============================================================================

-- Add org_id for multi-tenant (optional, nullable for backwards compat)
ALTER TABLE investors ADD COLUMN IF NOT EXISTS org_id UUID;

-- Add enhanced KYC tracking
ALTER TABLE investors ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMPTZ;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS kyc_expires_at TIMESTAMPTZ;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS aml_cleared BOOLEAN DEFAULT false;

-- Add qualified purchaser flag
ALTER TABLE investors ADD COLUMN IF NOT EXISTS qualified_purchaser BOOLEAN DEFAULT false;

-- Add preferred distribution method
ALTER TABLE investors ADD COLUMN IF NOT EXISTS preferred_distribution_method VARCHAR(20) DEFAULT 'ach';

-- Add wire instructions
ALTER TABLE investors ADD COLUMN IF NOT EXISTS wire_instructions TEXT;

-- Add contact fields if missing
ALTER TABLE investors ADD COLUMN IF NOT EXISTS contact_name TEXT;

-- ============================================================================
-- PART 2: ADD MISSING COLUMNS TO DEAL_INVESTMENTS
-- ============================================================================

-- Add preferred return override (investor-specific pref if different from deal)
ALTER TABLE deal_investments ADD COLUMN IF NOT EXISTS preferred_return NUMERIC(5,2);

-- Add promote eligibility
ALTER TABLE deal_investments ADD COLUMN IF NOT EXISTS promote_eligible BOOLEAN DEFAULT true;

-- Add co-invest flag
ALTER TABLE deal_investments ADD COLUMN IF NOT EXISTS co_invest BOOLEAN DEFAULT false;

-- Add capital tracking columns
ALTER TABLE deal_investments ADD COLUMN IF NOT EXISTS capital_returned NUMERIC(15,2) DEFAULT 0;
ALTER TABLE deal_investments ADD COLUMN IF NOT EXISTS distributions_paid NUMERIC(15,2) DEFAULT 0;

-- Add side letter terms
ALTER TABLE deal_investments ADD COLUMN IF NOT EXISTS side_letter JSONB;

-- ============================================================================
-- PART 3: ADD MISSING COLUMNS TO CAPITAL_CALLS
-- ============================================================================

ALTER TABLE capital_calls ADD COLUMN IF NOT EXISTS notice_doc_url TEXT;
ALTER TABLE capital_calls ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ;
ALTER TABLE capital_calls ADD COLUMN IF NOT EXISTS amount_received NUMERIC(15,2) DEFAULT 0;

-- ============================================================================
-- PART 4: ADD MISSING COLUMNS TO CAPITAL_CALL_ITEMS
-- ============================================================================

ALTER TABLE capital_call_items ADD COLUMN IF NOT EXISTS called_pct NUMERIC(8,5);
ALTER TABLE capital_call_items ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20);
ALTER TABLE capital_call_items ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE capital_call_items ADD COLUMN IF NOT EXISTS notice_sent_at TIMESTAMPTZ;
ALTER TABLE capital_call_items ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- ============================================================================
-- PART 5: ADD MISSING COLUMNS TO DISTRIBUTIONS
-- ============================================================================

ALTER TABLE distributions ADD COLUMN IF NOT EXISTS record_date DATE;
ALTER TABLE distributions ADD COLUMN IF NOT EXISTS source VARCHAR(30);
ALTER TABLE distributions ADD COLUMN IF NOT EXISTS waterfall_tier VARCHAR(30);
ALTER TABLE distributions ADD COLUMN IF NOT EXISTS is_return_of_capital BOOLEAN DEFAULT false;
ALTER TABLE distributions ADD COLUMN IF NOT EXISTS is_preferred BOOLEAN DEFAULT false;
ALTER TABLE distributions ADD COLUMN IF NOT EXISTS is_promote BOOLEAN DEFAULT false;
ALTER TABLE distributions ADD COLUMN IF NOT EXISTS notice_doc_url TEXT;
ALTER TABLE distributions ADD COLUMN IF NOT EXISTS period_start DATE;
ALTER TABLE distributions ADD COLUMN IF NOT EXISTS period_end DATE;

-- ============================================================================
-- PART 6: ADD MISSING COLUMNS TO DISTRIBUTION_ITEMS
-- ============================================================================

ALTER TABLE distribution_items ADD COLUMN IF NOT EXISTS allocation_pct NUMERIC(8,5);
ALTER TABLE distribution_items ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20);
ALTER TABLE distribution_items ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE distribution_items ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE distribution_items ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE distribution_items ADD COLUMN IF NOT EXISTS taxable_income NUMERIC(15,2);

-- ============================================================================
-- PART 7: ENHANCE DEAL_WATERFALLS
-- ============================================================================

ALTER TABLE deal_waterfalls ADD COLUMN IF NOT EXISTS lp_capital NUMERIC(15,2);
ALTER TABLE deal_waterfalls ADD COLUMN IF NOT EXISTS gp_capital NUMERIC(15,2);
ALTER TABLE deal_waterfalls ADD COLUMN IF NOT EXISTS pref_compounding VARCHAR(20) DEFAULT 'simple';
ALTER TABLE deal_waterfalls ADD COLUMN IF NOT EXISTS pref_accrued NUMERIC(15,2) DEFAULT 0;
ALTER TABLE deal_waterfalls ADD COLUMN IF NOT EXISTS lookback_enabled BOOLEAN DEFAULT false;
ALTER TABLE deal_waterfalls ADD COLUMN IF NOT EXISTS lookback_hurdle_rate NUMERIC(5,2);
ALTER TABLE deal_waterfalls ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE deal_waterfalls ADD COLUMN IF NOT EXISTS effective_date DATE;

-- ============================================================================
-- PART 8: ENHANCE WATERFALL_TIERS
-- ============================================================================

ALTER TABLE waterfall_tiers ADD COLUMN IF NOT EXISTS tier_name TEXT;
ALTER TABLE waterfall_tiers ADD COLUMN IF NOT EXISTS hurdle_type VARCHAR(20) DEFAULT 'irr';

-- ============================================================================
-- PART 9: INVESTOR COMMUNICATIONS (NEW TABLE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS investor_communications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id     UUID REFERENCES investors(id) ON DELETE SET NULL,
  deal_id         UUID REFERENCES deals(id) ON DELETE SET NULL,
  
  -- Communication
  comm_type       VARCHAR(30) NOT NULL, -- 'capital_call' | 'distribution_notice' | 'k1' | 'quarterly_report' | 'annual_report' | 'tax_estimate'
  subject         TEXT NOT NULL,
  body            TEXT,
  
  -- Delivery
  delivery_method VARCHAR(20) NOT NULL DEFAULT 'email', -- 'email' | 'portal' | 'mail'
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  
  -- Attachments
  attachments     JSONB, -- [{name, url, type}]
  
  -- Status
  status          VARCHAR(20) DEFAULT 'draft', -- 'draft' | 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed'
  error           TEXT,
  
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_comms_investor ON investor_communications(investor_id);
CREATE INDEX IF NOT EXISTS idx_inv_comms_deal ON investor_communications(deal_id);
CREATE INDEX IF NOT EXISTS idx_inv_comms_type ON investor_communications(comm_type);

-- ============================================================================
-- PART 10: HELPER FUNCTIONS
-- ============================================================================

-- Calculate next capital call number for a deal
CREATE OR REPLACE FUNCTION next_capital_call_number(p_deal_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(MAX(call_number), 0) + 1
  FROM capital_calls
  WHERE deal_id = p_deal_id;
$$ LANGUAGE sql;

-- Calculate next distribution number for a deal
CREATE OR REPLACE FUNCTION next_distribution_number(p_deal_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(MAX(distribution_number), 0) + 1
  FROM distributions
  WHERE deal_id = p_deal_id;
$$ LANGUAGE sql;

-- Calculate unreturned capital for an investment
CREATE OR REPLACE FUNCTION calc_unreturned_capital(p_investment_id UUID)
RETURNS NUMERIC AS $$
  SELECT COALESCE(funded_amount, 0) - COALESCE(capital_returned, 0)
  FROM deal_investments
  WHERE id = p_investment_id;
$$ LANGUAGE sql;

-- ============================================================================
-- PART 11: MATERIALIZED VIEWS
-- ============================================================================

-- Investor dashboard summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_investor_summary AS
SELECT 
  i.id AS investor_id,
  i.name AS investor_name,
  i.type AS investor_type,
  i.user_id,
  i.org_id,
  
  COUNT(DISTINCT di.deal_id) AS total_deals,
  COALESCE(SUM(di.commitment_amount), 0) AS total_committed,
  COALESCE(SUM(di.funded_amount), 0) AS total_contributed,
  COALESCE(SUM(di.distributions_paid), 0) AS total_distributions,
  COALESCE(SUM(di.funded_amount), 0) - COALESCE(SUM(di.capital_returned), 0) AS total_unreturned,
  
  -- Performance
  CASE WHEN COALESCE(SUM(di.funded_amount), 0) > 0 
    THEN COALESCE(SUM(di.distributions_paid), 0) / SUM(di.funded_amount)
    ELSE 0 
  END AS overall_multiple,
  
  -- Pending capital calls
  (
    SELECT COALESCE(SUM(cci.allocated_amount - cci.paid_amount), 0)
    FROM capital_call_items cci
    JOIN deal_investments di2 ON cci.investor_id = di2.investor_id
    WHERE di2.investor_id = i.id AND cci.status IN ('pending', 'partial')
  ) AS pending_capital_calls,
  
  MAX(di.updated_at) AS last_activity
  
FROM investors i
LEFT JOIN deal_investments di ON di.investor_id = i.id
WHERE i.archived_at IS NULL
GROUP BY i.id, i.name, i.type, i.user_id, i.org_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_inv_summary ON mv_investor_summary(investor_id);

-- Deal capital summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_deal_capital_summary AS
SELECT
  d.id AS deal_id,
  d.name AS deal_name,
  
  -- Investors
  COUNT(DISTINCT di.investor_id) AS investor_count,
  COUNT(DISTINCT di.investor_id) FILTER (WHERE di.status = 'funded') AS funded_investor_count,
  
  -- Capital
  COALESCE(SUM(di.commitment_amount), 0) AS total_committed,
  COALESCE(SUM(di.funded_amount), 0) AS total_contributed,
  COALESCE(SUM(di.distributions_paid), 0) AS total_distributed,
  
  -- Capital Calls
  (SELECT COUNT(*) FROM capital_calls cc WHERE cc.deal_id = d.id) AS total_calls,
  (SELECT COUNT(*) FROM capital_calls cc WHERE cc.deal_id = d.id AND cc.status = 'fully_paid') AS fulfilled_calls,
  (SELECT COALESCE(SUM(total_amount), 0) FROM capital_calls cc WHERE cc.deal_id = d.id) AS total_called,
  
  -- Distributions  
  (SELECT COUNT(*) FROM distributions dist WHERE dist.deal_id = d.id) AS total_distributions,
  (SELECT COALESCE(SUM(total_amount), 0) FROM distributions dist WHERE dist.deal_id = d.id AND dist.status = 'completed') AS total_paid_distributions,
  
  -- Unfunded
  COALESCE(SUM(di.commitment_amount), 0) - COALESCE(SUM(di.funded_amount), 0) AS unfunded_commitments
  
FROM deals d
LEFT JOIN deal_investments di ON di.deal_id = d.id
GROUP BY d.id, d.name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_deal_cap_summary ON mv_deal_capital_summary(deal_id);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_capital_summaries()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_investor_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_deal_capital_summary;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 12: TRIGGERS
-- ============================================================================

-- Update deal_investments capital totals when call items are paid
CREATE OR REPLACE FUNCTION update_investment_on_call_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    UPDATE deal_investments
    SET 
      funded_amount = COALESCE(funded_amount, 0) + NEW.paid_amount,
      status = CASE 
        WHEN COALESCE(funded_amount, 0) + NEW.paid_amount >= commitment_amount THEN 'funded'
        WHEN COALESCE(funded_amount, 0) + NEW.paid_amount > 0 THEN 'committed'
        ELSE status
      END,
      updated_at = NOW()
    WHERE investor_id = NEW.investor_id 
      AND deal_id = (SELECT deal_id FROM capital_calls WHERE id = NEW.capital_call_id);
    
    -- Create ledger entry
    INSERT INTO capital_account_entries (
      deal_id, investor_id, entry_type, amount, entry_date,
      reference_type, reference_id, description
    )
    SELECT 
      cc.deal_id,
      NEW.investor_id,
      'contribution',
      NEW.paid_amount,
      CURRENT_DATE,
      'capital_call',
      NEW.capital_call_id,
      'Capital call payment - Call #' || cc.call_number
    FROM capital_calls cc WHERE cc.id = NEW.capital_call_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_call_payment_update ON capital_call_items;
CREATE TRIGGER trg_call_payment_update
AFTER UPDATE OF status ON capital_call_items
FOR EACH ROW EXECUTE FUNCTION update_investment_on_call_payment();

-- Update deal_investments distribution totals when dist items are paid
CREATE OR REPLACE FUNCTION update_investment_on_distribution()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    UPDATE deal_investments
    SET 
      distributions_paid = COALESCE(distributions_paid, 0) + COALESCE(NEW.net_amount, NEW.gross_amount),
      capital_returned = COALESCE(capital_returned, 0) + COALESCE(NEW.return_of_capital, 0),
      updated_at = NOW()
    WHERE investor_id = NEW.investor_id
      AND deal_id = (SELECT deal_id FROM distributions WHERE id = NEW.distribution_id);
    
    -- Create ledger entry
    INSERT INTO capital_account_entries (
      deal_id, investor_id, entry_type, amount, entry_date,
      reference_type, reference_id, description
    )
    SELECT 
      dist.deal_id,
      NEW.investor_id,
      CASE 
        WHEN NEW.return_of_capital > 0 THEN 'distribution'
        ELSE 'distribution'
      END,
      COALESCE(NEW.net_amount, NEW.gross_amount),
      CURRENT_DATE,
      'distribution',
      NEW.distribution_id,
      'Distribution #' || dist.distribution_number || ' - ' || dist.distribution_type
    FROM distributions dist WHERE dist.id = NEW.distribution_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_distribution_payment_update ON distribution_items;
CREATE TRIGGER trg_distribution_payment_update
AFTER UPDATE OF status ON distribution_items
FOR EACH ROW EXECUTE FUNCTION update_investment_on_distribution();

-- Update capital call status when all items are paid
CREATE OR REPLACE FUNCTION update_capital_call_status()
RETURNS TRIGGER AS $$
DECLARE
  v_total_allocated NUMERIC;
  v_total_paid NUMERIC;
  v_all_paid BOOLEAN;
BEGIN
  SELECT 
    COALESCE(SUM(allocated_amount), 0),
    COALESCE(SUM(paid_amount), 0),
    bool_and(status = 'paid')
  INTO v_total_allocated, v_total_paid, v_all_paid
  FROM capital_call_items
  WHERE capital_call_id = NEW.capital_call_id;
  
  UPDATE capital_calls
  SET 
    amount_received = v_total_paid,
    status = CASE
      WHEN v_all_paid THEN 'fully_paid'
      WHEN v_total_paid > 0 THEN 'partially_paid'
      ELSE status
    END,
    fulfilled_at = CASE WHEN v_all_paid THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = NEW.capital_call_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_call_item_status_change ON capital_call_items;
CREATE TRIGGER trg_call_item_status_change
AFTER UPDATE OF status, paid_amount ON capital_call_items
FOR EACH ROW EXECUTE FUNCTION update_capital_call_status();

-- Update distribution status when all items are paid
CREATE OR REPLACE FUNCTION update_distribution_status()
RETURNS TRIGGER AS $$
DECLARE
  v_all_paid BOOLEAN;
BEGIN
  SELECT bool_and(status = 'paid')
  INTO v_all_paid
  FROM distribution_items
  WHERE distribution_id = NEW.distribution_id;
  
  UPDATE distributions
  SET 
    status = CASE WHEN v_all_paid THEN 'completed' ELSE 'processing' END,
    processed_at = CASE WHEN v_all_paid THEN NOW() ELSE processed_at END,
    updated_at = NOW()
  WHERE id = NEW.distribution_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dist_item_status_change ON distribution_items;
CREATE TRIGGER trg_dist_item_status_change
AFTER UPDATE OF status ON distribution_items
FOR EACH ROW EXECUTE FUNCTION update_distribution_status();

-- ============================================================================
-- PART 13: UPDATE RUNNING BALANCES
-- ============================================================================

-- Function to recalculate running balance for an investor in a deal
CREATE OR REPLACE FUNCTION recalc_investor_running_balance(p_deal_id UUID, p_investor_id UUID)
RETURNS void AS $$
DECLARE
  v_balance NUMERIC := 0;
  r RECORD;
BEGIN
  FOR r IN 
    SELECT id, entry_type, amount 
    FROM capital_account_entries 
    WHERE deal_id = p_deal_id AND investor_id = p_investor_id
    ORDER BY entry_date, created_at
  LOOP
    IF r.entry_type = 'contribution' THEN
      v_balance := v_balance + r.amount;
    ELSE
      v_balance := v_balance - r.amount;
    END IF;
    
    UPDATE capital_account_entries 
    SET running_balance = v_balance 
    WHERE id = r.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update running balance on new entry
CREATE OR REPLACE FUNCTION update_ledger_running_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_prev_balance NUMERIC;
BEGIN
  SELECT COALESCE(running_balance, 0) INTO v_prev_balance
  FROM capital_account_entries
  WHERE deal_id = NEW.deal_id AND investor_id = NEW.investor_id
  ORDER BY entry_date DESC, created_at DESC
  LIMIT 1;
  
  IF NEW.entry_type = 'contribution' THEN
    NEW.running_balance := COALESCE(v_prev_balance, 0) + NEW.amount;
  ELSE
    NEW.running_balance := COALESCE(v_prev_balance, 0) - NEW.amount;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ledger_running_balance ON capital_account_entries;
CREATE TRIGGER trg_ledger_running_balance
BEFORE INSERT ON capital_account_entries
FOR EACH ROW EXECUTE FUNCTION update_ledger_running_balance();
