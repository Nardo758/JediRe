-- Migration: operations_intelligence
-- Date: 2026-04-20
-- Description: Revenue management and operations intelligence system.
--              Tracks actuals vs projections at line-item level, monitors
--              rent roll activity, and generates actionable recommendations.

-- ─────────────────────────────────────────────────────────────────────────────
-- Proforma Projections (what we expected to happen)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proforma_projections (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  snapshot_id         UUID        REFERENCES assumption_snapshots(id),
  
  -- Time period
  period_type         TEXT        NOT NULL,  -- 'monthly' | 'quarterly' | 'annual'
  period_start        DATE        NOT NULL,
  period_end          DATE        NOT NULL,
  year_number         INTEGER,               -- Year 1, 2, 3, etc. from acquisition
  
  -- Revenue projections
  gross_potential_rent    NUMERIC,
  loss_to_lease           NUMERIC,
  vacancy_loss            NUMERIC,
  concessions             NUMERIC,
  bad_debt                NUMERIC,
  other_income            NUMERIC,
  effective_gross_income  NUMERIC,
  
  -- Expense projections (by line item)
  payroll                 NUMERIC,
  management_fee          NUMERIC,
  utilities_total         NUMERIC,
  repairs_maintenance     NUMERIC,
  make_ready              NUMERIC,
  landscaping             NUMERIC,
  contract_services       NUMERIC,
  admin_general           NUMERIC,
  marketing               NUMERIC,
  professional_fees       NUMERIC,
  insurance               NUMERIC,
  real_estate_taxes       NUMERIC,
  total_operating_expenses NUMERIC,
  
  -- NOI & Below the line
  net_operating_income    NUMERIC,
  replacement_reserves    NUMERIC,
  capital_improvements    NUMERIC,
  debt_service            NUMERIC,
  cash_flow_before_tax    NUMERIC,
  
  -- Unit economics
  units                   INTEGER,
  avg_rent_per_unit       NUMERIC,
  opex_per_unit           NUMERIC,
  noi_per_unit            NUMERIC,
  
  -- Traffic projections
  projected_leads         INTEGER,
  projected_tours         INTEGER,
  projected_applications  INTEGER,
  projected_move_ins      INTEGER,
  projected_move_outs     INTEGER,
  
  -- Occupancy
  projected_occupancy_pct NUMERIC,
  projected_economic_occupancy_pct NUMERIC,
  
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT uq_proforma_projection UNIQUE (deal_id, period_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_proforma_projections_deal
  ON proforma_projections(deal_id, period_start);

-- ─────────────────────────────────────────────────────────────────────────────
-- Actuals Tracking (what actually happened - detailed)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS operations_actuals (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Time period
  period_type         TEXT        NOT NULL,
  period_start        DATE        NOT NULL,
  period_end          DATE        NOT NULL,
  
  -- Revenue actuals
  gross_potential_rent    NUMERIC,
  loss_to_lease           NUMERIC,
  vacancy_loss            NUMERIC,
  concessions             NUMERIC,
  bad_debt                NUMERIC,
  other_income            NUMERIC,
  effective_gross_income  NUMERIC,
  
  -- Expense actuals (by line item)
  payroll                 NUMERIC,
  management_fee          NUMERIC,
  utilities_total         NUMERIC,
  repairs_maintenance     NUMERIC,
  make_ready              NUMERIC,
  landscaping             NUMERIC,
  contract_services       NUMERIC,
  admin_general           NUMERIC,
  marketing               NUMERIC,
  professional_fees       NUMERIC,
  insurance               NUMERIC,
  real_estate_taxes       NUMERIC,
  total_operating_expenses NUMERIC,
  
  -- NOI
  net_operating_income    NUMERIC,
  replacement_reserves    NUMERIC,
  capital_improvements    NUMERIC,
  
  -- Unit economics
  units_occupied          INTEGER,
  avg_rent_achieved       NUMERIC,
  
  -- Traffic actuals
  actual_leads            INTEGER,
  actual_tours            INTEGER,
  actual_applications     INTEGER,
  actual_move_ins         INTEGER,
  actual_move_outs        INTEGER,
  
  -- Occupancy
  physical_occupancy_pct  NUMERIC,
  economic_occupancy_pct  NUMERIC,
  
  -- Collections
  collections_rate        NUMERIC,
  delinquency_rate        NUMERIC,
  
  -- Source
  source                  TEXT,       -- 'yardi' | 'entrata' | 'appfolio' | 'manual'
  imported_at             TIMESTAMPTZ,
  
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT uq_operations_actuals UNIQUE (deal_id, period_type, period_start)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Variance Analysis (comparison of actual vs projected)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS variance_analysis (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Period
  period_start        DATE        NOT NULL,
  period_end          DATE        NOT NULL,
  
  -- Line item
  line_item           TEXT        NOT NULL,
  category            TEXT        NOT NULL,  -- 'revenue' | 'opex' | 'noi' | 'traffic' | 'occupancy'
  
  -- Values
  projected_value     NUMERIC,
  actual_value        NUMERIC,
  variance_amount     NUMERIC     GENERATED ALWAYS AS (actual_value - projected_value) STORED,
  variance_pct        NUMERIC     GENERATED ALWAYS AS (
    CASE WHEN projected_value != 0 
    THEN ((actual_value - projected_value) / ABS(projected_value)) * 100 
    ELSE NULL END
  ) STORED,
  
  -- Impact
  noi_impact          NUMERIC,    -- How much this variance affects NOI
  annualized_impact   NUMERIC,    -- Projected annual impact if trend continues
  
  -- Classification
  variance_type       TEXT        GENERATED ALWAYS AS (
    CASE 
      WHEN actual_value > projected_value AND category = 'revenue' THEN 'favorable'
      WHEN actual_value < projected_value AND category = 'revenue' THEN 'unfavorable'
      WHEN actual_value < projected_value AND category = 'opex' THEN 'favorable'
      WHEN actual_value > projected_value AND category = 'opex' THEN 'unfavorable'
      ELSE 'neutral'
    END
  ) STORED,
  
  severity            TEXT,       -- 'minor' (<5%) | 'moderate' (5-15%) | 'major' (>15%)
  
  -- Trend
  consecutive_months  INTEGER     DEFAULT 1,  -- How many months in same direction
  trend_direction     TEXT,       -- 'improving' | 'stable' | 'worsening'
  
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT uq_variance_analysis UNIQUE (deal_id, period_start, line_item)
);

CREATE INDEX IF NOT EXISTS idx_variance_analysis_deal
  ON variance_analysis(deal_id, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_variance_unfavorable
  ON variance_analysis(deal_id, variance_type, severity)
  WHERE variance_type = 'unfavorable';

-- ─────────────────────────────────────────────────────────────────────────────
-- Rent Roll Tracking (unit-level detail)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rent_roll_units (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Unit identification
  unit_number         TEXT        NOT NULL,
  unit_type           TEXT,       -- '1BR', '2BR', 'Studio', etc.
  sqft                INTEGER,
  floor_plan          TEXT,
  building            TEXT,
  floor               INTEGER,
  
  -- Current lease
  resident_id         TEXT,
  resident_name       TEXT,
  lease_start         DATE,
  lease_end           DATE,
  lease_term_months   INTEGER,
  
  -- Rent
  market_rent         NUMERIC,
  current_rent        NUMERIC,
  loss_to_lease       NUMERIC     GENERATED ALWAYS AS (market_rent - current_rent) STORED,
  loss_to_lease_pct   NUMERIC     GENERATED ALWAYS AS (
    CASE WHEN market_rent > 0 
    THEN ((market_rent - current_rent) / market_rent) * 100 
    ELSE 0 END
  ) STORED,
  
  -- Status
  status              TEXT        NOT NULL,  -- 'occupied' | 'vacant' | 'notice' | 'down' | 'model'
  days_vacant         INTEGER,
  move_in_date        DATE,
  move_out_date       DATE,
  notice_date         DATE,
  
  -- Renewal tracking
  renewal_offered     BOOLEAN     DEFAULT false,
  renewal_offer_date  DATE,
  renewal_offer_rent  NUMERIC,
  renewal_offer_pct   NUMERIC,
  renewal_status      TEXT,       -- 'pending' | 'accepted' | 'declined' | 'counter'
  
  -- Concessions
  concession_amount   NUMERIC     DEFAULT 0,
  concession_type     TEXT,       -- 'move_in' | 'renewal' | 'look_and_lease'
  
  -- Balance
  current_balance     NUMERIC     DEFAULT 0,
  delinquent_days     INTEGER     DEFAULT 0,
  
  -- Snapshot date
  as_of_date          DATE        NOT NULL,
  
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT uq_rent_roll_unit UNIQUE (deal_id, unit_number, as_of_date)
);

CREATE INDEX IF NOT EXISTS idx_rent_roll_expiring
  ON rent_roll_units(deal_id, lease_end)
  WHERE status = 'occupied';

CREATE INDEX IF NOT EXISTS idx_rent_roll_vacant
  ON rent_roll_units(deal_id, status, days_vacant)
  WHERE status IN ('vacant', 'notice');

-- ─────────────────────────────────────────────────────────────────────────────
-- Lease Expiration Schedule
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lease_expiration_schedule (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Period
  expiration_month    DATE        NOT NULL,  -- First of month
  
  -- Counts
  expiring_leases     INTEGER     NOT NULL,
  expiring_units_pct  NUMERIC,
  
  -- Rent at risk
  monthly_rent_expiring NUMERIC,
  current_avg_rent    NUMERIC,
  market_rent_avg     NUMERIC,
  
  -- Targets
  target_renewal_rate NUMERIC     DEFAULT 55,
  target_rent_increase_pct NUMERIC DEFAULT 3,
  
  -- Projections
  projected_renewals  INTEGER,
  projected_move_outs INTEGER,
  projected_rent_gain NUMERIC,    -- If all renew at target increase
  projected_rent_loss NUMERIC,    -- If all move out (turnover cost)
  
  -- Actuals (filled in as month passes)
  actual_renewals     INTEGER,
  actual_move_outs    INTEGER,
  actual_avg_increase_pct NUMERIC,
  
  as_of_date          DATE        NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT uq_lease_expiration UNIQUE (deal_id, expiration_month, as_of_date)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Operations Recommendations (AI-generated actionable insights)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS operations_recommendations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Classification
  category            TEXT        NOT NULL,  -- 'pricing' | 'occupancy' | 'expense' | 'renewal' | 'traffic' | 'collections'
  priority            TEXT        NOT NULL,  -- 'critical' | 'high' | 'medium' | 'low'
  
  -- Recommendation
  title               TEXT        NOT NULL,
  description         TEXT        NOT NULL,
  rationale           TEXT,       -- Why we're recommending this
  
  -- Impact
  estimated_monthly_impact  NUMERIC,
  estimated_annual_impact   NUMERIC,
  confidence_pct            NUMERIC,
  
  -- Supporting data
  supporting_data     JSONB,      -- Metrics, comps, trends backing the recommendation
  
  -- Actions
  suggested_actions   JSONB,      -- Specific steps to take
  -- Example: [
  --   {"action": "Increase renewal offers by 2%", "units_affected": 12},
  --   {"action": "Reduce concessions on new leases", "current": "$500", "target": "$250"}
  -- ]
  
  -- Status tracking
  status              TEXT        DEFAULT 'pending',  -- 'pending' | 'accepted' | 'rejected' | 'implemented'
  status_updated_at   TIMESTAMPTZ,
  status_updated_by   UUID,
  implementation_notes TEXT,
  
  -- Outcome tracking (after implementation)
  actual_impact       NUMERIC,
  outcome_notes       TEXT,
  
  -- Validity
  valid_from          DATE        NOT NULL DEFAULT CURRENT_DATE,
  valid_until         DATE,
  superseded_by       UUID        REFERENCES operations_recommendations(id),
  
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          TEXT        DEFAULT 'revenue_management_agent'
);

CREATE INDEX IF NOT EXISTS idx_recommendations_active
  ON operations_recommendations(deal_id, status, priority)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_recommendations_category
  ON operations_recommendations(deal_id, category, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Traffic & Conversion Tracking
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS traffic_funnel (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Period
  period_start        DATE        NOT NULL,
  period_end          DATE        NOT NULL,
  
  -- Funnel metrics
  website_visits      INTEGER,
  ils_clicks          INTEGER,
  phone_calls         INTEGER,
  emails_received     INTEGER,
  walk_ins            INTEGER,
  total_leads         INTEGER,
  
  tours_scheduled     INTEGER,
  tours_completed     INTEGER,
  no_shows            INTEGER,
  
  applications        INTEGER,
  approved            INTEGER,
  denied              INTEGER,
  
  leases_signed       INTEGER,
  move_ins            INTEGER,
  
  -- Conversion rates
  lead_to_tour_pct    NUMERIC     GENERATED ALWAYS AS (
    CASE WHEN total_leads > 0 THEN (tours_completed::numeric / total_leads) * 100 ELSE 0 END
  ) STORED,
  tour_to_app_pct     NUMERIC     GENERATED ALWAYS AS (
    CASE WHEN tours_completed > 0 THEN (applications::numeric / tours_completed) * 100 ELSE 0 END
  ) STORED,
  app_to_lease_pct    NUMERIC     GENERATED ALWAYS AS (
    CASE WHEN applications > 0 THEN (leases_signed::numeric / applications) * 100 ELSE 0 END
  ) STORED,
  overall_conversion  NUMERIC     GENERATED ALWAYS AS (
    CASE WHEN total_leads > 0 THEN (move_ins::numeric / total_leads) * 100 ELSE 0 END
  ) STORED,
  
  -- Benchmarks
  projected_leads     INTEGER,
  projected_move_ins  INTEGER,
  
  -- Cost metrics
  marketing_spend     NUMERIC,
  cost_per_lead       NUMERIC     GENERATED ALWAYS AS (
    CASE WHEN total_leads > 0 THEN marketing_spend / total_leads ELSE 0 END
  ) STORED,
  cost_per_lease      NUMERIC     GENERATED ALWAYS AS (
    CASE WHEN leases_signed > 0 THEN marketing_spend / leases_signed ELSE 0 END
  ) STORED,
  
  source              TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT uq_traffic_funnel UNIQUE (deal_id, period_start)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Other Income Tracking
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS other_income_tracking (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Period
  period_start        DATE        NOT NULL,
  period_end          DATE        NOT NULL,
  
  -- Income categories
  pet_fees            NUMERIC     DEFAULT 0,
  pet_rent            NUMERIC     DEFAULT 0,
  parking             NUMERIC     DEFAULT 0,
  storage             NUMERIC     DEFAULT 0,
  application_fees    NUMERIC     DEFAULT 0,
  admin_fees          NUMERIC     DEFAULT 0,
  late_fees           NUMERIC     DEFAULT 0,
  nsf_fees            NUMERIC     DEFAULT 0,
  utility_reimbursement NUMERIC   DEFAULT 0,
  cable_internet      NUMERIC     DEFAULT 0,
  trash_valet         NUMERIC     DEFAULT 0,
  amenity_fees        NUMERIC     DEFAULT 0,
  short_term_premium  NUMERIC     DEFAULT 0,
  furnished_premium   NUMERIC     DEFAULT 0,
  other               NUMERIC     DEFAULT 0,
  
  total_other_income  NUMERIC     GENERATED ALWAYS AS (
    pet_fees + pet_rent + parking + storage + application_fees + 
    admin_fees + late_fees + nsf_fees + utility_reimbursement + 
    cable_internet + trash_valet + amenity_fees + short_term_premium + 
    furnished_premium + other
  ) STORED,
  
  -- Per unit
  units               INTEGER,
  other_income_per_unit NUMERIC   GENERATED ALWAYS AS (
    CASE WHEN units > 0 THEN (
      pet_fees + pet_rent + parking + storage + application_fees + 
      admin_fees + late_fees + nsf_fees + utility_reimbursement + 
      cable_internet + trash_valet + amenity_fees + short_term_premium + 
      furnished_premium + other
    ) / units ELSE 0 END
  ) STORED,
  
  -- Projections
  projected_other_income NUMERIC,
  
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT uq_other_income UNIQUE (deal_id, period_start)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Views
-- ─────────────────────────────────────────────────────────────────────────────

-- Current month variance summary
CREATE OR REPLACE VIEW v_current_variance_summary AS
SELECT 
  deal_id,
  COUNT(*) FILTER (WHERE variance_type = 'unfavorable' AND severity = 'major') as major_unfavorable,
  COUNT(*) FILTER (WHERE variance_type = 'unfavorable' AND severity = 'moderate') as moderate_unfavorable,
  COUNT(*) FILTER (WHERE variance_type = 'favorable') as favorable_count,
  SUM(noi_impact) as total_noi_impact,
  SUM(annualized_impact) as total_annualized_impact
FROM variance_analysis
WHERE period_start = DATE_TRUNC('month', CURRENT_DATE)
GROUP BY deal_id;

-- Expiring leases next 90 days
CREATE OR REPLACE VIEW v_expiring_leases_90d AS
SELECT 
  deal_id,
  COUNT(*) as expiring_count,
  SUM(current_rent) as monthly_rent_at_risk,
  AVG(loss_to_lease_pct) as avg_loss_to_lease_pct,
  COUNT(*) FILTER (WHERE renewal_status = 'pending') as pending_renewals,
  COUNT(*) FILTER (WHERE renewal_status = 'accepted') as accepted_renewals
FROM rent_roll_units
WHERE status = 'occupied'
  AND lease_end BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
GROUP BY deal_id;

-- Active recommendations by property
CREATE OR REPLACE VIEW v_active_recommendations AS
SELECT 
  deal_id,
  COUNT(*) as total_pending,
  COUNT(*) FILTER (WHERE priority = 'critical') as critical_count,
  COUNT(*) FILTER (WHERE priority = 'high') as high_count,
  SUM(estimated_monthly_impact) as total_monthly_impact,
  SUM(estimated_annual_impact) as total_annual_impact
FROM operations_recommendations
WHERE status = 'pending'
  AND (valid_until IS NULL OR valid_until > CURRENT_DATE)
GROUP BY deal_id;
