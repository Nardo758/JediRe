-- ============================================================================
-- JEDI RE: Data Pipeline Foundation Migration (044)
-- ============================================================================
-- Creates: deal_monthly_actuals, data_uploads, upload_templates,
--          proforma_templates, proforma_snapshots
-- Views:   v_latest_actuals, v_actual_vs_budget, v_comp_search
-- Triggers: fn_calculate_actuals_derived, fn_touch_property
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ADD MISSING COLUMNS TO EXISTING PROPERTIES TABLE
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='name') THEN
        ALTER TABLE properties ADD COLUMN name VARCHAR(300);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='county') THEN
        ALTER TABLE properties ADD COLUMN county VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='lot_acres') THEN
        ALTER TABLE properties ADD COLUMN lot_acres NUMERIC(10,4);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='total_sf') THEN
        ALTER TABLE properties ADD COLUMN total_sf NUMERIC(12,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='stories') THEN
        ALTER TABLE properties ADD COLUMN stories INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='product_type') THEN
        ALTER TABLE properties ADD COLUMN product_type VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='ownership_status') THEN
        ALTER TABLE properties ADD COLUMN ownership_status VARCHAR(20) DEFAULT 'pipeline';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='pipeline_stage') THEN
        ALTER TABLE properties ADD COLUMN pipeline_stage VARCHAR(30);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='acquisition_date') THEN
        ALTER TABLE properties ADD COLUMN acquisition_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='acquisition_price') THEN
        ALTER TABLE properties ADD COLUMN acquisition_price NUMERIC(14,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='jedi_score') THEN
        ALTER TABLE properties ADD COLUMN jedi_score NUMERIC(5,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='jedi_score_updated') THEN
        ALTER TABLE properties ADD COLUMN jedi_score_updated TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='recommended_strategy') THEN
        ALTER TABLE properties ADD COLUMN recommended_strategy VARCHAR(20);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='arbitrage_flag') THEN
        ALTER TABLE properties ADD COLUMN arbitrage_flag BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='arbitrage_delta') THEN
        ALTER TABLE properties ADD COLUMN arbitrage_delta NUMERIC(5,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='created_by') THEN
        ALTER TABLE properties ADD COLUMN created_by UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='msa_id') THEN
        ALTER TABLE properties ADD COLUMN msa_id INTEGER REFERENCES msas(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='updated_at') THEN
        ALTER TABLE properties ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_properties_submarket ON properties(submarket_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(ownership_status);
CREATE INDEX IF NOT EXISTS idx_properties_jedi ON properties(jedi_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(property_type, product_type);

-- ============================================================================
-- 2. DEAL MONTHLY ACTUALS — The Core P&L Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS deal_monthly_actuals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id         UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    report_month        DATE NOT NULL,
    total_units         INTEGER,
    occupied_units      INTEGER,
    occupancy_rate      NUMERIC(5,3),
    avg_market_rent     NUMERIC(10,2),
    avg_effective_rent  NUMERIC(10,2),
    gross_potential_rent NUMERIC(14,2),
    loss_to_lease       NUMERIC(12,2),
    vacancy_loss        NUMERIC(12,2),
    concessions         NUMERIC(12,2),
    bad_debt            NUMERIC(12,2),
    net_rental_income   NUMERIC(14,2),
    other_income        NUMERIC(12,2),
    utility_reimbursement NUMERIC(12,2),
    late_fees           NUMERIC(10,2),
    misc_income         NUMERIC(10,2),
    effective_gross_income NUMERIC(14,2),
    payroll             NUMERIC(12,2),
    repairs_maintenance NUMERIC(12,2),
    turnover_costs      NUMERIC(12,2),
    marketing           NUMERIC(12,2),
    admin_general       NUMERIC(12,2),
    management_fee      NUMERIC(12,2),
    management_fee_pct  NUMERIC(5,3),
    utilities           NUMERIC(12,2),
    contract_services   NUMERIC(12,2),
    property_tax        NUMERIC(12,2),
    insurance           NUMERIC(12,2),
    hoa_condo_fees      NUMERIC(12,2),
    total_opex          NUMERIC(14,2),
    opex_per_unit       NUMERIC(10,2),
    opex_ratio          NUMERIC(5,3),
    noi                 NUMERIC(14,2),
    noi_per_unit        NUMERIC(10,2),
    debt_service        NUMERIC(12,2),
    debt_service_interest NUMERIC(12,2),
    capex               NUMERIC(12,2),
    capex_reserves      NUMERIC(12,2),
    cash_flow_before_tax NUMERIC(14,2),
    new_leases          INTEGER,
    renewals            INTEGER,
    move_outs           INTEGER,
    lease_trade_out     NUMERIC(10,2),
    renewal_rate        NUMERIC(5,3),
    avg_days_to_lease   NUMERIC(7,2),
    adr                 NUMERIC(10,2),
    revpar              NUMERIC(10,2),
    str_occupancy       NUMERIC(5,3),
    str_revenue         NUMERIC(12,2),
    data_source         VARCHAR(50),
    upload_id           UUID,
    is_budget           BOOLEAN DEFAULT FALSE,
    is_proforma         BOOLEAN DEFAULT FALSE,
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    UNIQUE(property_id, report_month, is_budget, is_proforma)
);

CREATE INDEX IF NOT EXISTS idx_actuals_property ON deal_monthly_actuals(property_id);
CREATE INDEX IF NOT EXISTS idx_actuals_month ON deal_monthly_actuals(report_month);
CREATE INDEX IF NOT EXISTS idx_actuals_property_month ON deal_monthly_actuals(property_id, report_month DESC);
CREATE INDEX IF NOT EXISTS idx_actuals_source ON deal_monthly_actuals(data_source);
CREATE INDEX IF NOT EXISTS idx_actuals_upload ON deal_monthly_actuals(upload_id);
CREATE INDEX IF NOT EXISTS idx_actuals_budget ON deal_monthly_actuals(is_budget) WHERE is_budget = TRUE;
CREATE INDEX IF NOT EXISTS idx_actuals_noi ON deal_monthly_actuals(noi DESC NULLS LAST) WHERE noi IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_actuals_occupancy ON deal_monthly_actuals(occupancy_rate) WHERE occupancy_rate IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_actuals_rent ON deal_monthly_actuals(avg_effective_rent) WHERE avg_effective_rent IS NOT NULL;

-- ============================================================================
-- 3. DATA UPLOADS — CSV/Excel Upload Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS data_uploads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    property_id     UUID REFERENCES properties(id),
    original_filename VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT,
    file_type       VARCHAR(20) NOT NULL,
    storage_path    VARCHAR(1000),
    status          VARCHAR(20) DEFAULT 'pending',
    column_mapping  JSONB NOT NULL DEFAULT '{}',
    source_format   VARCHAR(50),
    rows_total      INTEGER DEFAULT 0,
    rows_succeeded  INTEGER DEFAULT 0,
    rows_failed     INTEGER DEFAULT 0,
    error_log       JSONB DEFAULT '[]',
    data_start_date DATE,
    data_end_date   DATE,
    created_at      TIMESTAMPTZ DEFAULT now(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_uploads_user ON data_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_uploads_property ON data_uploads(property_id);
CREATE INDEX IF NOT EXISTS idx_uploads_status ON data_uploads(status);

CREATE TABLE IF NOT EXISTS upload_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    source_format   VARCHAR(50) NOT NULL UNIQUE,
    column_mapping  JSONB NOT NULL,
    description     TEXT,
    is_system       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT now()
);

INSERT INTO upload_templates (name, source_format, column_mapping, description) VALUES
(
    'Manual Excel Template',
    'manual',
    '{
        "Month": "report_month",
        "Total Units": "total_units",
        "Occupied Units": "occupied_units",
        "Avg Market Rent": "avg_market_rent",
        "Avg Effective Rent": "avg_effective_rent",
        "Gross Potential Rent": "gross_potential_rent",
        "Vacancy Loss": "vacancy_loss",
        "Concessions": "concessions",
        "Bad Debt": "bad_debt",
        "Net Rental Income": "net_rental_income",
        "Other Income": "other_income",
        "Effective Gross Income": "effective_gross_income",
        "Payroll": "payroll",
        "R&M": "repairs_maintenance",
        "Turnover": "turnover_costs",
        "Marketing": "marketing",
        "Admin/G&A": "admin_general",
        "Management Fee": "management_fee",
        "Utilities": "utilities",
        "Contract Services": "contract_services",
        "Property Tax": "property_tax",
        "Insurance": "insurance",
        "Total OpEx": "total_opex",
        "NOI": "noi",
        "Debt Service": "debt_service",
        "CapEx": "capex",
        "Cash Flow": "cash_flow_before_tax",
        "New Leases": "new_leases",
        "Renewals": "renewals",
        "Move Outs": "move_outs"
    }',
    'Standard JEDI RE Excel template with all columns pre-mapped'
),
(
    'AppFolio Export',
    'appfolio',
    '{
        "Date": "report_month",
        "Unit Count": "total_units",
        "Occupied": "occupied_units",
        "Market Rent": "avg_market_rent",
        "Effective Rent": "avg_effective_rent",
        "Gross Potential": "gross_potential_rent",
        "Vacancy": "vacancy_loss",
        "Loss to Lease": "loss_to_lease",
        "Concessions": "concessions",
        "Write-offs": "bad_debt",
        "Other Revenue": "other_income",
        "Utility Reimb": "utility_reimbursement",
        "Total Revenue": "effective_gross_income",
        "Salary/Wages": "payroll",
        "Repairs": "repairs_maintenance",
        "Make Ready": "turnover_costs",
        "Advertising": "marketing",
        "Office/Admin": "admin_general",
        "Mgmt Fee": "management_fee",
        "Utilities": "utilities",
        "Contract Svcs": "contract_services",
        "Taxes": "property_tax",
        "Insurance": "insurance",
        "Total Expenses": "total_opex",
        "NOI": "noi",
        "Mortgage": "debt_service",
        "Capital": "capex"
    }',
    'Maps from standard AppFolio P&L export format'
),
(
    'Yardi Voyager',
    'yardi',
    '{
        "Period": "report_month",
        "Physical Units": "total_units",
        "Occupied Units": "occupied_units",
        "Market Rent/Unit": "avg_market_rent",
        "Avg Actual Rent": "avg_effective_rent",
        "Gross Potential": "gross_potential_rent",
        "Vacancy Loss": "vacancy_loss",
        "Gain/Loss to Lease": "loss_to_lease",
        "Concession": "concessions",
        "Bad Debt Expense": "bad_debt",
        "Other Income": "other_income",
        "Utility Recovery": "utility_reimbursement",
        "EGI": "effective_gross_income",
        "Personnel": "payroll",
        "Maintenance": "repairs_maintenance",
        "Turn Cost": "turnover_costs",
        "Marketing/Leasing": "marketing",
        "G&A": "admin_general",
        "Management Fee": "management_fee",
        "Utilities": "utilities",
        "Contract": "contract_services",
        "RE Tax": "property_tax",
        "Insurance": "insurance",
        "Total Operating": "total_opex",
        "NOI": "noi"
    }',
    'Maps from standard Yardi Voyager financial export'
)
ON CONFLICT (source_format) DO NOTHING;

-- ============================================================================
-- 4. PROFORMA TEMPLATES — Reusable Assumption Sets
-- ============================================================================

CREATE TABLE IF NOT EXISTS proforma_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    property_type   VARCHAR(50),
    product_type    VARCHAR(50),
    strategy        VARCHAR(20),
    hold_years      INTEGER DEFAULT 5,
    rent_growth_yr1     NUMERIC(5,3) DEFAULT 0.03,
    rent_growth_yr2_5   NUMERIC(5,3) DEFAULT 0.025,
    rent_growth_yr6_10  NUMERIC(5,3) DEFAULT 0.02,
    vacancy_rate        NUMERIC(5,3) DEFAULT 0.05,
    vacancy_trend       NUMERIC(5,3) DEFAULT 0.0,
    concession_pct      NUMERIC(5,3) DEFAULT 0.01,
    bad_debt_pct        NUMERIC(5,3) DEFAULT 0.015,
    other_income_per_unit NUMERIC(10,2) DEFAULT 150.00,
    opex_ratio          NUMERIC(5,3) DEFAULT 0.45,
    opex_growth         NUMERIC(5,3) DEFAULT 0.025,
    management_fee_pct  NUMERIC(5,3) DEFAULT 0.05,
    capex_per_unit      NUMERIC(10,2) DEFAULT 300.00,
    property_tax_growth NUMERIC(5,3) DEFAULT 0.02,
    insurance_growth    NUMERIC(5,3) DEFAULT 0.03,
    ltv                 NUMERIC(5,3) DEFAULT 0.70,
    interest_rate       NUMERIC(5,4) DEFAULT 0.065,
    amortization_years  INTEGER DEFAULT 30,
    loan_term_years     INTEGER DEFAULT 10,
    io_period_months    INTEGER DEFAULT 0,
    exit_cap_rate       NUMERIC(5,3) DEFAULT 0.055,
    exit_cap_spread     NUMERIC(5,3) DEFAULT 0.001,
    selling_costs_pct   NUMERIC(5,3) DEFAULT 0.02,
    target_irr          NUMERIC(5,3) DEFAULT 0.15,
    target_coc          NUMERIC(5,3) DEFAULT 0.08,
    target_equity_mult  NUMERIC(5,2) DEFAULT 2.0,
    target_dscr_min     NUMERIC(5,2) DEFAULT 1.25,
    is_default          BOOLEAN DEFAULT FALSE,
    is_system           BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_user ON proforma_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_strategy ON proforma_templates(strategy);

-- ============================================================================
-- 5. PROFORMA SNAPSHOTS — Generated ProForma Results
-- ============================================================================

CREATE TABLE IF NOT EXISTS proforma_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    template_id     UUID REFERENCES proforma_templates(id),
    strategy        VARCHAR(20) NOT NULL,
    layer1_baseline     JSONB NOT NULL DEFAULT '{}',
    layer2_adjusted     JSONB NOT NULL DEFAULT '{}',
    layer3_user         JSONB NOT NULL DEFAULT '{}',
    active_layer        VARCHAR(10) DEFAULT 'layer2',
    year1_noi           NUMERIC(14,2),
    going_in_cap        NUMERIC(5,4),
    coc_return          NUMERIC(5,4),
    irr                 NUMERIC(5,4),
    equity_multiple     NUMERIC(5,2),
    dscr                NUMERIC(5,2),
    debt_yield          NUMERIC(5,4),
    annual_projections  JSONB,
    optimal_exit_year   INTEGER,
    exit_value          NUMERIC(14,2),
    generated_at        TIMESTAMPTZ DEFAULT now(),
    generated_by        VARCHAR(20) DEFAULT 'platform',
    notes               TEXT
);

CREATE INDEX IF NOT EXISTS idx_proforma_property ON proforma_snapshots(property_id);
CREATE INDEX IF NOT EXISTS idx_proforma_strategy ON proforma_snapshots(strategy);
CREATE INDEX IF NOT EXISTS idx_proforma_irr ON proforma_snapshots(irr DESC NULLS LAST);

-- ============================================================================
-- 6. VIEWS
-- ============================================================================
-- Note: properties table uses address_line1/state_code/units/lat/lng
-- instead of address/state/total_units/latitude/longitude

CREATE OR REPLACE VIEW v_latest_actuals AS
SELECT DISTINCT ON (property_id)
    dma.*,
    p.name AS property_name,
    p.city,
    p.state_code AS state,
    COALESCE(p.units, dma.total_units) AS property_total_units,
    p.submarket_id::text AS submarket_id,
    p.msa_id,
    p.jedi_score,
    p.recommended_strategy
FROM deal_monthly_actuals dma
JOIN properties p ON p.id = dma.property_id
WHERE dma.is_budget = FALSE AND dma.is_proforma = FALSE
ORDER BY dma.property_id, dma.report_month DESC;

CREATE OR REPLACE VIEW v_actual_vs_budget AS
SELECT
    a.property_id,
    a.report_month,
    p.name AS property_name,
    a.effective_gross_income AS actual_egi,
    b.effective_gross_income AS budget_egi,
    CASE WHEN b.effective_gross_income > 0 
        THEN (a.effective_gross_income - b.effective_gross_income) / b.effective_gross_income 
        ELSE NULL END AS egi_variance_pct,
    a.noi AS actual_noi,
    b.noi AS budget_noi,
    CASE WHEN b.noi > 0 
        THEN (a.noi - b.noi) / b.noi 
        ELSE NULL END AS noi_variance_pct,
    a.occupancy_rate AS actual_occupancy,
    b.occupancy_rate AS budget_occupancy,
    a.occupancy_rate - b.occupancy_rate AS occupancy_variance
FROM deal_monthly_actuals a
JOIN deal_monthly_actuals b 
    ON a.property_id = b.property_id 
    AND a.report_month = b.report_month
    AND b.is_budget = TRUE 
    AND b.is_proforma = FALSE
JOIN properties p ON p.id = a.property_id
WHERE a.is_budget = FALSE AND a.is_proforma = FALSE;

CREATE OR REPLACE VIEW v_comp_search AS
SELECT
    p.id AS property_id,
    p.name,
    p.city,
    p.state_code AS state,
    p.property_type,
    p.product_type,
    COALESCE(p.units, 0) AS total_units,
    p.year_built,
    p.lat AS latitude,
    p.lng AS longitude,
    p.submarket_id,
    p.msa_id,
    s.name AS submarket_name,
    m.name AS msa_name,
    AVG(dma.avg_effective_rent) AS t12_avg_rent,
    AVG(dma.occupancy_rate) AS t12_avg_occupancy,
    AVG(dma.noi) AS t12_avg_monthly_noi,
    SUM(dma.noi) AS t12_total_noi,
    AVG(dma.opex_ratio) AS t12_avg_opex_ratio,
    AVG(dma.noi_per_unit) AS t12_avg_noi_per_unit,
    MAX(dma.report_month) AS latest_month,
    COUNT(dma.id) AS months_of_data
FROM properties p
JOIN deal_monthly_actuals dma ON dma.property_id = p.id
    AND dma.is_budget = FALSE 
    AND dma.is_proforma = FALSE
    AND dma.report_month >= (CURRENT_DATE - INTERVAL '12 months')
LEFT JOIN submarkets s ON s.id::text = p.submarket_id OR s.name = p.submarket_id
LEFT JOIN msas m ON m.id = p.msa_id
GROUP BY p.id, p.name, p.city, p.state_code, p.property_type, p.product_type,
         p.units, p.year_built, p.lat, p.lng, p.submarket_id, p.msa_id,
         s.name, m.name;

-- ============================================================================
-- 7. TRIGGERS — Auto-calculate derived fields
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_calculate_actuals_derived()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.total_units IS NOT NULL AND NEW.total_units > 0 AND NEW.occupied_units IS NOT NULL THEN
        NEW.occupancy_rate := NEW.occupied_units::NUMERIC / NEW.total_units;
    END IF;
    IF NEW.total_opex IS NOT NULL AND NEW.total_units IS NOT NULL AND NEW.total_units > 0 THEN
        NEW.opex_per_unit := NEW.total_opex / NEW.total_units;
    END IF;
    IF NEW.total_opex IS NOT NULL AND NEW.effective_gross_income IS NOT NULL AND NEW.effective_gross_income > 0 THEN
        NEW.opex_ratio := NEW.total_opex / NEW.effective_gross_income;
    END IF;
    IF NEW.noi IS NULL AND NEW.effective_gross_income IS NOT NULL AND NEW.total_opex IS NOT NULL THEN
        NEW.noi := NEW.effective_gross_income - NEW.total_opex;
    END IF;
    IF NEW.noi IS NOT NULL AND NEW.total_units IS NOT NULL AND NEW.total_units > 0 THEN
        NEW.noi_per_unit := NEW.noi / NEW.total_units;
    END IF;
    IF NEW.cash_flow_before_tax IS NULL AND NEW.noi IS NOT NULL THEN
        NEW.cash_flow_before_tax := NEW.noi 
            - COALESCE(NEW.debt_service, 0) 
            - COALESCE(NEW.capex, 0) 
            - COALESCE(NEW.capex_reserves, 0);
    END IF;
    IF NEW.renewals IS NOT NULL AND NEW.move_outs IS NOT NULL 
       AND (NEW.renewals + NEW.move_outs) > 0 THEN
        NEW.renewal_rate := NEW.renewals::NUMERIC / (NEW.renewals + NEW.move_outs);
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_actuals_derived ON deal_monthly_actuals;
CREATE TRIGGER trg_actuals_derived
    BEFORE INSERT OR UPDATE ON deal_monthly_actuals
    FOR EACH ROW
    EXECUTE FUNCTION fn_calculate_actuals_derived();

CREATE OR REPLACE FUNCTION fn_touch_property()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE properties SET updated_at = now() WHERE id = NEW.property_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_property_on_actuals ON deal_monthly_actuals;
CREATE TRIGGER trg_touch_property_on_actuals
    AFTER INSERT OR UPDATE ON deal_monthly_actuals
    FOR EACH ROW
    EXECUTE FUNCTION fn_touch_property();

COMMIT;
