-- ============================================================================
-- 20260421_investor_capital_tracking.sql
-- Investor tracking, capital calls, and distributions tied to waterfall
-- ============================================================================

-- ============================================================================
-- PART 1: INVESTORS & ENTITIES
-- ============================================================================

-- Investor entities (LP, GP, institutional, individual)
CREATE TABLE IF NOT EXISTS investors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Identity
  name            TEXT NOT NULL,
  entity_type     VARCHAR(30) NOT NULL, -- 'individual' | 'llc' | 'lp' | 'trust' | 'institutional' | 'family_office' | 'fund'
  tax_id          TEXT,  -- EIN or SSN (encrypted in app layer)
  tax_id_type     VARCHAR(10), -- 'ein' | 'ssn' | 'foreign'
  
  -- Classification
  investor_class  VARCHAR(20) NOT NULL DEFAULT 'lp', -- 'gp' | 'lp' | 'co_gp'
  accredited      BOOLEAN DEFAULT true,
  qualified_purchaser BOOLEAN DEFAULT false,
  
  -- Contact
  contact_name    TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,
  address_line1   TEXT,
  address_line2   TEXT,
  city            TEXT,
  state           VARCHAR(2),
  zip             VARCHAR(10),
  country         VARCHAR(3) DEFAULT 'USA',
  
  -- Banking
  bank_name       TEXT,
  bank_routing    TEXT,  -- encrypted
  bank_account    TEXT,  -- encrypted
  bank_account_type VARCHAR(10), -- 'checking' | 'savings'
  wire_instructions TEXT,
  
  -- Compliance
  kyc_status      VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'verified' | 'expired' | 'rejected'
  kyc_verified_at TIMESTAMPTZ,
  kyc_expires_at  TIMESTAMPTZ,
  aml_cleared     BOOLEAN DEFAULT false,
  
  -- Preferences
  preferred_distribution_method VARCHAR(20) DEFAULT 'ach', -- 'ach' | 'wire' | 'check'
  withholding_rate NUMERIC(5,2) DEFAULT 0, -- for foreign investors
  
  -- Metadata
  notes           TEXT,
  tags            TEXT[],
  
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_investors_org ON investors(org_id);
CREATE INDEX idx_investors_class ON investors(investor_class);

-- ============================================================================
-- PART 2: DEAL INVESTMENTS (COMMITMENTS)
-- ============================================================================

-- Investor commitments to specific deals
CREATE TABLE IF NOT EXISTS deal_investments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id           UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  investor_id       UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  
  -- Commitment
  commitment_amount NUMERIC(15,2) NOT NULL,
  commitment_date   DATE NOT NULL,
  commitment_docs   TEXT[], -- signed subscription docs
  
  -- Ownership
  ownership_pct     NUMERIC(8,5) NOT NULL, -- 5 decimal places for precision
  class             VARCHAR(20) NOT NULL DEFAULT 'class_a', -- 'class_a' | 'class_b' | 'gp' | 'promote'
  
  -- Waterfall Position
  preferred_return  NUMERIC(5,2), -- investor-specific pref if different from deal default
  promote_eligible  BOOLEAN DEFAULT true,
  co_invest         BOOLEAN DEFAULT false, -- sidecar co-investment
  
  -- Capital Account
  capital_contributed NUMERIC(15,2) DEFAULT 0,
  capital_returned    NUMERIC(15,2) DEFAULT 0,
  distributions_paid  NUMERIC(15,2) DEFAULT 0,
  unreturned_capital  NUMERIC(15,2) GENERATED ALWAYS AS (capital_contributed - capital_returned) STORED,
  
  -- Status
  status            VARCHAR(20) DEFAULT 'committed', -- 'pending' | 'committed' | 'funded' | 'partial' | 'redeemed'
  funding_deadline  DATE,
  
  -- Legal
  subscription_signed_at TIMESTAMPTZ,
  side_letter       JSONB, -- special terms
  
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(deal_id, investor_id)
);

CREATE INDEX idx_deal_investments_deal ON deal_investments(deal_id);
CREATE INDEX idx_deal_investments_investor ON deal_investments(investor_id);
CREATE INDEX idx_deal_investments_status ON deal_investments(status);

-- ============================================================================
-- PART 3: CAPITAL CALLS
-- ============================================================================

-- Capital call notices
CREATE TABLE IF NOT EXISTS capital_calls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Call Details
  call_number     INTEGER NOT NULL, -- sequential per deal
  call_date       DATE NOT NULL,
  due_date        DATE NOT NULL,
  
  -- Amounts
  total_amount    NUMERIC(15,2) NOT NULL,
  purpose         TEXT NOT NULL, -- 'initial_closing' | 'subsequent_closing' | 'capital_improvement' | 'operating_shortfall'
  
  -- Status
  status          VARCHAR(20) DEFAULT 'draft', -- 'draft' | 'sent' | 'partial' | 'fulfilled' | 'overdue'
  sent_at         TIMESTAMPTZ,
  fulfilled_at    TIMESTAMPTZ,
  
  -- Documents
  notice_doc_url  TEXT,
  memo            TEXT,
  
  -- Tracking
  amount_received NUMERIC(15,2) DEFAULT 0,
  
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_capital_calls_deal ON capital_calls(deal_id);
CREATE INDEX idx_capital_calls_status ON capital_calls(status);
CREATE UNIQUE INDEX idx_capital_calls_number ON capital_calls(deal_id, call_number);

-- Individual investor capital call line items
CREATE TABLE IF NOT EXISTS capital_call_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capital_call_id   UUID NOT NULL REFERENCES capital_calls(id) ON DELETE CASCADE,
  investment_id     UUID NOT NULL REFERENCES deal_investments(id) ON DELETE CASCADE,
  investor_id       UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  
  -- Call Amount
  called_amount     NUMERIC(15,2) NOT NULL,
  called_pct        NUMERIC(8,5), -- percentage of commitment being called
  
  -- Payment
  status            VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'paid' | 'partial' | 'overdue' | 'defaulted'
  amount_paid       NUMERIC(15,2) DEFAULT 0,
  paid_at           TIMESTAMPTZ,
  payment_method    VARCHAR(20), -- 'ach' | 'wire' | 'check'
  payment_reference TEXT,
  
  -- Default handling
  days_overdue      INTEGER GENERATED ALWAYS AS (
    CASE WHEN status = 'overdue' OR status = 'defaulted' 
    THEN EXTRACT(DAY FROM now() - (SELECT due_date FROM capital_calls WHERE id = capital_call_id))::INTEGER 
    ELSE 0 END
  ) STORED,
  default_interest  NUMERIC(15,2) DEFAULT 0, -- penalty interest on late payment
  
  -- Notice tracking
  notice_sent_at    TIMESTAMPTZ,
  reminder_sent_at  TIMESTAMPTZ,
  
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(capital_call_id, investment_id)
);

CREATE INDEX idx_cc_items_call ON capital_call_items(capital_call_id);
CREATE INDEX idx_cc_items_investor ON capital_call_items(investor_id);
CREATE INDEX idx_cc_items_status ON capital_call_items(status);

-- ============================================================================
-- PART 4: DISTRIBUTIONS
-- ============================================================================

-- Distribution events (operating, refi, sale proceeds)
CREATE TABLE IF NOT EXISTS distributions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Distribution Details
  dist_number     INTEGER NOT NULL, -- sequential per deal
  dist_date       DATE NOT NULL,
  record_date     DATE NOT NULL, -- investors of record as of this date
  
  -- Type & Source
  dist_type       VARCHAR(30) NOT NULL, -- 'operating' | 'refinance' | 'sale' | 'return_of_capital' | 'preferred' | 'promote'
  source          VARCHAR(30) NOT NULL, -- 'cash_flow' | 'refi_proceeds' | 'sale_proceeds' | 'reserve_release'
  
  -- Amounts
  gross_amount    NUMERIC(15,2) NOT NULL,
  withholding     NUMERIC(15,2) DEFAULT 0,
  net_amount      NUMERIC(15,2) GENERATED ALWAYS AS (gross_amount - withholding) STORED,
  
  -- Waterfall Allocation
  waterfall_tier  VARCHAR(30), -- which tier this distribution falls into
  is_return_of_capital BOOLEAN DEFAULT false,
  is_preferred    BOOLEAN DEFAULT false,
  is_promote      BOOLEAN DEFAULT false,
  
  -- Status
  status          VARCHAR(20) DEFAULT 'draft', -- 'draft' | 'approved' | 'processing' | 'paid' | 'partial'
  approved_by     UUID REFERENCES auth.users(id),
  approved_at     TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  
  -- Documents
  notice_doc_url  TEXT,
  memo            TEXT,
  
  -- Period (for operating distributions)
  period_start    DATE,
  period_end      DATE,
  
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_distributions_deal ON distributions(deal_id);
CREATE INDEX idx_distributions_type ON distributions(dist_type);
CREATE INDEX idx_distributions_status ON distributions(status);
CREATE UNIQUE INDEX idx_distributions_number ON distributions(deal_id, dist_number);

-- Individual investor distribution line items
CREATE TABLE IF NOT EXISTS distribution_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id   UUID NOT NULL REFERENCES distributions(id) ON DELETE CASCADE,
  investment_id     UUID NOT NULL REFERENCES deal_investments(id) ON DELETE CASCADE,
  investor_id       UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  
  -- Allocation
  gross_amount      NUMERIC(15,2) NOT NULL,
  allocation_pct    NUMERIC(8,5), -- actual percentage allocated (may differ from ownership due to waterfall)
  
  -- Withholding
  federal_withholding   NUMERIC(15,2) DEFAULT 0,
  state_withholding     NUMERIC(15,2) DEFAULT 0,
  foreign_withholding   NUMERIC(15,2) DEFAULT 0,
  total_withholding     NUMERIC(15,2) GENERATED ALWAYS AS (
    federal_withholding + state_withholding + foreign_withholding
  ) STORED,
  net_amount        NUMERIC(15,2) GENERATED ALWAYS AS (
    gross_amount - federal_withholding - state_withholding - foreign_withholding
  ) STORED,
  
  -- Waterfall breakdown
  return_of_capital NUMERIC(15,2) DEFAULT 0,
  preferred_return  NUMERIC(15,2) DEFAULT 0,
  profit_share      NUMERIC(15,2) DEFAULT 0,
  promote           NUMERIC(15,2) DEFAULT 0,
  
  -- Payment
  status            VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'paid' | 'failed' | 'held'
  payment_method    VARCHAR(20), -- 'ach' | 'wire' | 'check'
  payment_reference TEXT,
  paid_at           TIMESTAMPTZ,
  
  -- Banking (override investor defaults)
  bank_account_override TEXT,
  
  -- K-1 tracking
  taxable_income    NUMERIC(15,2), -- for K-1 reporting
  tax_year          INTEGER,
  
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(distribution_id, investment_id)
);

CREATE INDEX idx_dist_items_distribution ON distribution_items(distribution_id);
CREATE INDEX idx_dist_items_investor ON distribution_items(investor_id);
CREATE INDEX idx_dist_items_status ON distribution_items(status);

-- ============================================================================
-- PART 5: WATERFALL CONFIGURATION
-- ============================================================================

-- Deal-level waterfall structure
CREATE TABLE IF NOT EXISTS deal_waterfalls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- LP/GP Split
  lp_capital      NUMERIC(15,2) NOT NULL,
  gp_capital      NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_equity    NUMERIC(15,2) GENERATED ALWAYS AS (lp_capital + gp_capital) STORED,
  lp_pct          NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN lp_capital + gp_capital > 0 
    THEN (lp_capital / (lp_capital + gp_capital)) * 100 
    ELSE 0 END
  ) STORED,
  
  -- Preferred Return
  pref_rate       NUMERIC(5,2) NOT NULL DEFAULT 8.00, -- 8% default
  pref_compounding VARCHAR(20) DEFAULT 'simple', -- 'simple' | 'annual' | 'quarterly'
  pref_accrued    NUMERIC(15,2) DEFAULT 0, -- unpaid pref accumulation
  
  -- Catch-up
  catch_up_enabled BOOLEAN DEFAULT true,
  catch_up_pct    NUMERIC(5,2) DEFAULT 100, -- GP catches up to X% of promote split
  
  -- Clawback
  clawback_enabled BOOLEAN DEFAULT true,
  clawback_reserve_pct NUMERIC(5,2) DEFAULT 0, -- % held back pending final reconciliation
  
  -- Lookback
  lookback_enabled BOOLEAN DEFAULT false,
  lookback_hurdle_rate NUMERIC(5,2), -- IRR hurdle for lookback
  
  -- Status
  is_active       BOOLEAN DEFAULT true,
  effective_date  DATE,
  
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(deal_id)
);

CREATE INDEX idx_deal_waterfalls_deal ON deal_waterfalls(deal_id);

-- Waterfall tiers (promote splits)
CREATE TABLE IF NOT EXISTS waterfall_tiers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waterfall_id    UUID NOT NULL REFERENCES deal_waterfalls(id) ON DELETE CASCADE,
  
  tier_number     INTEGER NOT NULL, -- order of tiers
  tier_name       TEXT NOT NULL,
  
  -- Hurdle
  hurdle_type     VARCHAR(20) NOT NULL, -- 'irr' | 'equity_multiple' | 'roi' | 'none'
  hurdle_value    NUMERIC(8,4), -- e.g., 12.00 for 12% IRR
  
  -- Splits
  lp_split        NUMERIC(5,2) NOT NULL, -- e.g., 80.00 for 80%
  gp_split        NUMERIC(5,2) NOT NULL, -- e.g., 20.00 for 20%
  
  -- Verification
  CHECK (lp_split + gp_split = 100),
  
  created_at      TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(waterfall_id, tier_number)
);

CREATE INDEX idx_waterfall_tiers_waterfall ON waterfall_tiers(waterfall_id);

-- ============================================================================
-- PART 6: CAPITAL ACCOUNT LEDGER
-- ============================================================================

-- Running ledger of all capital movements per investor
CREATE TABLE IF NOT EXISTS capital_account_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id   UUID NOT NULL REFERENCES deal_investments(id) ON DELETE CASCADE,
  investor_id     UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Entry Details
  entry_date      DATE NOT NULL,
  entry_type      VARCHAR(30) NOT NULL, -- 'contribution' | 'distribution' | 'return_of_capital' | 'preferred' | 'profit_share' | 'promote' | 'adjustment'
  
  -- Amounts
  debit           NUMERIC(15,2) DEFAULT 0, -- increases capital account (contributions)
  credit          NUMERIC(15,2) DEFAULT 0, -- decreases capital account (distributions)
  
  -- Running Balance
  balance_after   NUMERIC(15,2) NOT NULL, -- capital account balance after this entry
  
  -- Reference
  reference_type  VARCHAR(30), -- 'capital_call' | 'distribution' | 'manual'
  reference_id    UUID,
  
  description     TEXT,
  
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cap_ledger_investment ON capital_account_entries(investment_id);
CREATE INDEX idx_cap_ledger_investor ON capital_account_entries(investor_id);
CREATE INDEX idx_cap_ledger_deal ON capital_account_entries(deal_id);
CREATE INDEX idx_cap_ledger_date ON capital_account_entries(entry_date);

-- ============================================================================
-- PART 7: COMMITMENT SCHEDULE (TRANCHES)
-- ============================================================================

-- For staged funding deals
CREATE TABLE IF NOT EXISTS commitment_tranches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id   UUID NOT NULL REFERENCES deal_investments(id) ON DELETE CASCADE,
  
  tranche_number  INTEGER NOT NULL,
  amount          NUMERIC(15,2) NOT NULL,
  scheduled_date  DATE NOT NULL,
  trigger_event   TEXT, -- 'closing' | 'construction_start' | 'milestone' | 'discretionary'
  
  status          VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled' | 'called' | 'funded' | 'waived'
  called_at       TIMESTAMPTZ,
  funded_at       TIMESTAMPTZ,
  capital_call_id UUID REFERENCES capital_calls(id),
  
  created_at      TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(investment_id, tranche_number)
);

CREATE INDEX idx_tranches_investment ON commitment_tranches(investment_id);

-- ============================================================================
-- PART 8: INVESTOR COMMUNICATIONS
-- ============================================================================

-- Audit log of all investor communications
CREATE TABLE IF NOT EXISTS investor_communications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id     UUID REFERENCES investors(id) ON DELETE SET NULL,
  deal_id         UUID REFERENCES deals(id) ON DELETE SET NULL,
  
  -- Communication
  comm_type       VARCHAR(30) NOT NULL, -- 'capital_call' | 'distribution_notice' | 'k1' | 'quarterly_report' | 'annual_report' | 'tax_estimate'
  subject         TEXT NOT NULL,
  body            TEXT,
  
  -- Delivery
  delivery_method VARCHAR(20) NOT NULL, -- 'email' | 'portal' | 'mail'
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  
  -- Attachments
  attachments     JSONB, -- [{name, url, type}]
  
  -- Status
  status          VARCHAR(20) DEFAULT 'draft', -- 'draft' | 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed'
  error           TEXT,
  
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_inv_comms_investor ON investor_communications(investor_id);
CREATE INDEX idx_inv_comms_deal ON investor_communications(deal_id);
CREATE INDEX idx_inv_comms_type ON investor_communications(comm_type);

-- ============================================================================
-- PART 9: AGGREGATE VIEWS
-- ============================================================================

-- Investor dashboard summary (materialized for performance)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_investor_summary AS
SELECT 
  i.id AS investor_id,
  i.name AS investor_name,
  i.investor_class,
  i.org_id,
  
  COUNT(DISTINCT di.deal_id) AS total_deals,
  SUM(di.commitment_amount) AS total_committed,
  SUM(di.capital_contributed) AS total_contributed,
  SUM(di.distributions_paid) AS total_distributions,
  SUM(di.unreturned_capital) AS total_unreturned,
  
  -- Performance
  CASE WHEN SUM(di.capital_contributed) > 0 
    THEN SUM(di.distributions_paid) / SUM(di.capital_contributed)
    ELSE 0 
  END AS overall_multiple,
  
  -- Pending
  (
    SELECT COALESCE(SUM(cci.called_amount - cci.amount_paid), 0)
    FROM capital_call_items cci
    JOIN deal_investments di2 ON cci.investment_id = di2.id
    WHERE di2.investor_id = i.id AND cci.status IN ('pending', 'partial')
  ) AS pending_capital_calls,
  
  MAX(di.updated_at) AS last_activity
  
FROM investors i
LEFT JOIN deal_investments di ON di.investor_id = i.id
GROUP BY i.id, i.name, i.investor_class, i.org_id;

CREATE UNIQUE INDEX idx_mv_inv_summary ON mv_investor_summary(investor_id);

-- Deal capital summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_deal_capital_summary AS
SELECT
  d.id AS deal_id,
  d.name AS deal_name,
  
  -- Investors
  COUNT(DISTINCT di.investor_id) AS investor_count,
  COUNT(DISTINCT di.investor_id) FILTER (WHERE di.status = 'funded') AS funded_investor_count,
  
  -- Capital
  SUM(di.commitment_amount) AS total_committed,
  SUM(di.capital_contributed) AS total_contributed,
  SUM(di.distributions_paid) AS total_distributed,
  
  -- Capital Calls
  (SELECT COUNT(*) FROM capital_calls cc WHERE cc.deal_id = d.id) AS total_calls,
  (SELECT COUNT(*) FROM capital_calls cc WHERE cc.deal_id = d.id AND cc.status = 'fulfilled') AS fulfilled_calls,
  (SELECT COALESCE(SUM(total_amount), 0) FROM capital_calls cc WHERE cc.deal_id = d.id) AS total_called,
  
  -- Distributions  
  (SELECT COUNT(*) FROM distributions dist WHERE dist.deal_id = d.id) AS total_distributions,
  (SELECT COALESCE(SUM(gross_amount), 0) FROM distributions dist WHERE dist.deal_id = d.id AND dist.status = 'paid') AS total_paid_distributions,
  
  -- Unfunded
  SUM(di.commitment_amount) - SUM(di.capital_contributed) AS unfunded_commitments
  
FROM deals d
LEFT JOIN deal_investments di ON di.deal_id = d.id
GROUP BY d.id, d.name;

CREATE UNIQUE INDEX idx_mv_deal_cap_summary ON mv_deal_capital_summary(deal_id);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_capital_summaries()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_investor_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_deal_capital_summary;
END;
$$ LANGUAGE plpgsql;

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
  SELECT COALESCE(MAX(dist_number), 0) + 1
  FROM distributions
  WHERE deal_id = p_deal_id;
$$ LANGUAGE sql;

-- Calculate investor's share of a distribution based on waterfall
CREATE OR REPLACE FUNCTION calc_investor_distribution_share(
  p_investment_id UUID,
  p_distribution_id UUID
)
RETURNS TABLE (
  gross_amount NUMERIC,
  return_of_capital NUMERIC,
  preferred_return NUMERIC,
  profit_share NUMERIC,
  promote NUMERIC
) AS $$
DECLARE
  v_investment deal_investments%ROWTYPE;
  v_distribution distributions%ROWTYPE;
  v_waterfall deal_waterfalls%ROWTYPE;
  v_deal_total_equity NUMERIC;
  v_investor_share NUMERIC;
BEGIN
  SELECT * INTO v_investment FROM deal_investments WHERE id = p_investment_id;
  SELECT * INTO v_distribution FROM distributions WHERE id = p_distribution_id;
  SELECT * INTO v_waterfall FROM deal_waterfalls WHERE deal_id = v_distribution.deal_id;
  
  -- Get total equity for the deal
  SELECT SUM(commitment_amount) INTO v_deal_total_equity
  FROM deal_investments WHERE deal_id = v_distribution.deal_id;
  
  -- Calculate investor's pro-rata share
  v_investor_share := v_investment.ownership_pct / 100;
  
  -- Simplified distribution logic (full waterfall calc in service layer)
  RETURN QUERY SELECT
    (v_distribution.gross_amount * v_investor_share)::NUMERIC AS gross_amount,
    (CASE WHEN v_distribution.is_return_of_capital THEN v_distribution.gross_amount * v_investor_share ELSE 0 END)::NUMERIC,
    (CASE WHEN v_distribution.is_preferred THEN v_distribution.gross_amount * v_investor_share ELSE 0 END)::NUMERIC,
    (CASE WHEN NOT v_distribution.is_promote AND NOT v_distribution.is_return_of_capital AND NOT v_distribution.is_preferred 
      THEN v_distribution.gross_amount * v_investor_share ELSE 0 END)::NUMERIC,
    (CASE WHEN v_distribution.is_promote AND v_investment.class = 'gp' 
      THEN v_distribution.gross_amount * v_investor_share ELSE 0 END)::NUMERIC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update deal_investments capital totals when call items are paid
CREATE OR REPLACE FUNCTION update_investment_on_call_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    UPDATE deal_investments
    SET 
      capital_contributed = capital_contributed + NEW.amount_paid,
      status = CASE 
        WHEN capital_contributed + NEW.amount_paid >= commitment_amount THEN 'funded'
        WHEN capital_contributed + NEW.amount_paid > 0 THEN 'partial'
        ELSE status
      END,
      updated_at = now()
    WHERE id = NEW.investment_id;
    
    -- Create ledger entry
    INSERT INTO capital_account_entries (
      investment_id, investor_id, deal_id, entry_date, entry_type,
      debit, balance_after, reference_type, reference_id, description
    )
    SELECT 
      NEW.investment_id, 
      NEW.investor_id,
      di.deal_id,
      CURRENT_DATE,
      'contribution',
      NEW.amount_paid,
      di.capital_contributed + NEW.amount_paid,
      'capital_call',
      NEW.capital_call_id,
      'Capital call payment'
    FROM deal_investments di WHERE di.id = NEW.investment_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_call_payment_update
AFTER UPDATE OF status ON capital_call_items
FOR EACH ROW EXECUTE FUNCTION update_investment_on_call_payment();

-- Update deal_investments distribution totals when dist items are paid
CREATE OR REPLACE FUNCTION update_investment_on_distribution()
RETURNS TRIGGER AS $$
DECLARE
  v_deal_id UUID;
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    SELECT deal_id INTO v_deal_id FROM distributions WHERE id = NEW.distribution_id;
    
    UPDATE deal_investments
    SET 
      distributions_paid = distributions_paid + NEW.net_amount,
      capital_returned = capital_returned + NEW.return_of_capital,
      updated_at = now()
    WHERE id = NEW.investment_id;
    
    -- Create ledger entry
    INSERT INTO capital_account_entries (
      investment_id, investor_id, deal_id, entry_date, entry_type,
      credit, balance_after, reference_type, reference_id, description
    )
    SELECT 
      NEW.investment_id,
      NEW.investor_id,
      v_deal_id,
      CURRENT_DATE,
      CASE 
        WHEN NEW.return_of_capital > 0 THEN 'return_of_capital'
        WHEN NEW.preferred_return > 0 THEN 'preferred'
        WHEN NEW.promote > 0 THEN 'promote'
        ELSE 'profit_share'
      END,
      NEW.net_amount,
      di.capital_contributed - di.capital_returned - NEW.return_of_capital,
      'distribution',
      NEW.distribution_id,
      'Distribution payment'
    FROM deal_investments di WHERE di.id = NEW.investment_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_distribution_payment_update
AFTER UPDATE OF status ON distribution_items
FOR EACH ROW EXECUTE FUNCTION update_investment_on_distribution();

-- Update capital call status when all items are paid
CREATE OR REPLACE FUNCTION update_capital_call_status()
RETURNS TRIGGER AS $$
DECLARE
  v_total_called NUMERIC;
  v_total_paid NUMERIC;
  v_all_paid BOOLEAN;
BEGIN
  SELECT 
    SUM(called_amount), 
    SUM(amount_paid),
    bool_and(status = 'paid')
  INTO v_total_called, v_total_paid, v_all_paid
  FROM capital_call_items
  WHERE capital_call_id = NEW.capital_call_id;
  
  UPDATE capital_calls
  SET 
    amount_received = v_total_paid,
    status = CASE
      WHEN v_all_paid THEN 'fulfilled'
      WHEN v_total_paid > 0 THEN 'partial'
      ELSE status
    END,
    fulfilled_at = CASE WHEN v_all_paid THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = NEW.capital_call_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_call_item_status_change
AFTER UPDATE OF status, amount_paid ON capital_call_items
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
    status = CASE WHEN v_all_paid THEN 'paid' ELSE 'partial' END,
    paid_at = CASE WHEN v_all_paid THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = NEW.distribution_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dist_item_status_change
AFTER UPDATE OF status ON distribution_items
FOR EACH ROW EXECUTE FUNCTION update_distribution_status();
