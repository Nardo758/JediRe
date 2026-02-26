-- ============================================================================
-- JEDI RE: Data Pipeline Foundation Migration
-- ============================================================================
-- This migration creates the 5 core tables that unblock the entire platform:
--   1. Geographic hierarchy (MSAs, submarkets) - reference data
--   2. deal_monthly_actuals - the granular P&L table (30+ columns)
--   3. data_uploads - CSV/Excel upload tracking + column mapping
--   4. comp_properties - searchable comp engine
--   5. proforma_templates - reusable assumption sets (3-layer)
--
-- Dependency chain: 
--   geographic hierarchy → properties → deal_monthly_actuals → comp engine
--   proforma_templates → 3-layer proforma generator
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. GEOGRAPHIC HIERARCHY
-- ============================================================================
-- Referenced by: properties, comp queries, submarket ranking (F26),
--   market intelligence (M05), supply pipeline (M04)

CREATE TABLE IF NOT EXISTS msas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cbsa_code       VARCHAR(10) UNIQUE NOT NULL,       -- Census CBSA code
    name            VARCHAR(200) NOT NULL,              -- e.g., "Miami-Fort Lauderdale-Pompano Beach, FL"
    state           VARCHAR(2) NOT NULL,
    population      INTEGER,
    median_hhi      NUMERIC(12,2),                      -- median household income
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submarkets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    msa_id          UUID NOT NULL REFERENCES msas(id),
    name            VARCHAR(200) NOT NULL,              -- e.g., "Brickell/Downtown Miami"
    boundary        JSONB,                              -- GeoJSON polygon for map overlay
    -- Submarket vitals (feeds M05 Market Vitals Dashboard, F26 submarket rank)
    avg_rent        NUMERIC(10,2),
    vacancy_rate    NUMERIC(5,3),                       -- e.g., 0.058 = 5.8%
    absorption_rate NUMERIC(10,2),                      -- units/quarter
    rent_growth_yoy NUMERIC(5,3),                       -- e.g., 0.032 = 3.2%
    pop_growth_yoy  NUMERIC(5,3),
    submarket_rank  NUMERIC(5,2),                       -- F26 percentile (0-100)
    vitals_updated  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_submarkets_msa ON submarkets(msa_id);
CREATE INDEX idx_submarkets_rank ON submarkets(submarket_rank DESC);

-- ============================================================================
-- 2. PROPERTIES (if not already present — the deal backbone)
-- ============================================================================
-- Central reference for deals, owned assets, and comps.
-- Feeds: M01 Overview, M16 Pipeline, M22 Portfolio

CREATE TABLE IF NOT EXISTS properties (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Identity
    name            VARCHAR(300) NOT NULL,
    address         VARCHAR(500),
    city            VARCHAR(100),
    state           VARCHAR(2),
    zip             VARCHAR(10),
    county          VARCHAR(100),
    latitude        NUMERIC(10,7),
    longitude       NUMERIC(10,7),
    -- Geography links
    msa_id          UUID REFERENCES msas(id),
    submarket_id    UUID REFERENCES submarkets(id),
    -- Property characteristics
    property_type   VARCHAR(50),                        -- multifamily, office, retail, industrial, mixed-use
    product_type    VARCHAR(50),                        -- garden-style, mid-rise, high-rise, townhome, SFR, etc.
    year_built      INTEGER,
    total_units     INTEGER,
    total_sf        NUMERIC(12,2),
    lot_acres       NUMERIC(10,4),
    stories         INTEGER,
    -- Ownership / pipeline
    ownership_status VARCHAR(20) DEFAULT 'pipeline',    -- pipeline, under_contract, owned, sold, dead
    pipeline_stage  VARCHAR(30),                        -- lead, prospect, loi, dd, under_contract, closed
    acquisition_date DATE,
    acquisition_price NUMERIC(14,2),
    -- JEDI Score (F01 composite, cached)
    jedi_score      NUMERIC(5,2),
    jedi_score_updated TIMESTAMPTZ,
    -- Strategy recommendation (F23, F24)
    recommended_strategy VARCHAR(20),                   -- bts, flip, rental, str
    arbitrage_flag  BOOLEAN DEFAULT FALSE,
    arbitrage_delta NUMERIC(5,2),
    -- Metadata
    created_by      UUID,                               -- user who added this deal
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_properties_submarket ON properties(submarket_id);
CREATE INDEX idx_properties_msa ON properties(msa_id);
CREATE INDEX idx_properties_status ON properties(ownership_status);
CREATE INDEX idx_properties_jedi ON properties(jedi_score DESC NULLS LAST);
CREATE INDEX idx_properties_type ON properties(property_type, product_type);
CREATE INDEX idx_properties_geo ON properties(state, city);

-- ============================================================================
-- 3. DEAL MONTHLY ACTUALS — The Core P&L Table
-- ============================================================================
-- This is the foundation table everything else depends on.
-- Feeds: M22 Portfolio (F35), M09 ProForma baseline, Comp Query Engine,
--        M05 Market Intelligence (rent/vacancy actuals), actual-vs-projected
--
-- Design: One row per property per month. 30+ financial columns covering
-- the complete operating statement. This matches what users export from
-- AppFolio, Yardi, RealPage, or manual Excel tracking.

CREATE TABLE IF NOT EXISTS deal_monthly_actuals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id         UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    -- Time period
    report_month        DATE NOT NULL,                  -- first of month: 2025-01-01, 2025-02-01, etc.
    
    -- ========== REVENUE ==========
    -- Gross Potential Rent (GPR)
    total_units         INTEGER,                        -- unit count that month (can change with reno)
    occupied_units      INTEGER,
    occupancy_rate      NUMERIC(5,3),                   -- derived: occupied/total, stored for query speed
    avg_market_rent     NUMERIC(10,2),                  -- asking rent per unit
    avg_effective_rent  NUMERIC(10,2),                  -- after concessions
    gross_potential_rent NUMERIC(14,2),                  -- total_units × avg_market_rent
    
    -- Loss to Lease & Vacancy
    loss_to_lease       NUMERIC(12,2),                  -- GPR - actual collected rent
    vacancy_loss        NUMERIC(12,2),                  -- from physical vacancy
    concessions         NUMERIC(12,2),                  -- free rent, move-in specials
    bad_debt            NUMERIC(12,2),                  -- uncollectable rent
    
    -- Net Rental Income
    net_rental_income   NUMERIC(14,2),                  -- GPR - vacancy - concessions - bad_debt
    
    -- Other Income
    other_income        NUMERIC(12,2),                  -- parking, laundry, storage, pet, app fees, etc.
    utility_reimbursement NUMERIC(12,2),                -- RUBS or direct billing
    late_fees           NUMERIC(10,2),
    misc_income         NUMERIC(10,2),
    
    -- Effective Gross Income (EGI)
    effective_gross_income NUMERIC(14,2),               -- net rental + other income
    
    -- ========== EXPENSES ==========
    -- Controllable
    payroll             NUMERIC(12,2),                  -- on-site staff
    repairs_maintenance NUMERIC(12,2),
    turnover_costs      NUMERIC(12,2),                  -- make-ready between tenants
    marketing           NUMERIC(12,2),                  -- advertising, ILS listings
    admin_general       NUMERIC(12,2),                  -- office, legal, accounting
    management_fee      NUMERIC(12,2),                  -- PM fee (usually % of EGI)
    management_fee_pct  NUMERIC(5,3),                   -- the percentage used
    utilities           NUMERIC(12,2),                  -- owner-paid utilities
    contract_services   NUMERIC(12,2),                  -- landscaping, pest, elevator, etc.
    
    -- Non-Controllable
    property_tax        NUMERIC(12,2),
    insurance           NUMERIC(12,2),
    hoa_condo_fees      NUMERIC(12,2),                  -- if applicable
    
    -- Total Operating Expenses
    total_opex          NUMERIC(14,2),
    opex_per_unit       NUMERIC(10,2),                  -- derived: total_opex / total_units
    opex_ratio          NUMERIC(5,3),                   -- derived: total_opex / EGI
    
    -- ========== NET OPERATING INCOME ==========
    -- This is the number that feeds F16, F17, F18, F21, F22, F35
    noi                 NUMERIC(14,2),                  -- EGI - total_opex
    noi_per_unit        NUMERIC(10,2),                  -- derived
    
    -- ========== BELOW THE LINE ==========
    -- Debt service (feeds F18 CoC, F21 DSCR, F22 Debt Yield)
    debt_service        NUMERIC(12,2),                  -- monthly mortgage payment (P+I)
    debt_service_interest NUMERIC(12,2),                -- interest portion only
    
    -- Capital Expenditures
    capex               NUMERIC(12,2),                  -- non-routine capital improvements
    capex_reserves      NUMERIC(12,2),                  -- reserve contributions ($250-500/unit/yr typical)
    
    -- Cash Flow
    cash_flow_before_tax NUMERIC(14,2),                 -- NOI - debt_service - capex
    
    -- ========== LEASING METRICS ==========
    -- Feeds M07 Traffic Engine (F28, F29), market intelligence
    new_leases          INTEGER,                        -- new move-ins
    renewals            INTEGER,                        -- lease renewals
    move_outs           INTEGER,                        -- moveouts / notices
    lease_trade_out     NUMERIC(10,2),                  -- avg rent increase on turnover
    renewal_rate        NUMERIC(5,3),                   -- renewals / (renewals + move_outs)
    avg_days_to_lease   NUMERIC(7,2),                   -- avg days vacant before re-leased
    
    -- ========== STR METRICS (Airbnb/STR strategy) ==========
    -- Only populated for STR properties, feeds F23 STR strategy score
    adr                 NUMERIC(10,2),                  -- average daily rate
    revpar              NUMERIC(10,2),                  -- revenue per available room
    str_occupancy       NUMERIC(5,3),                   -- STR-specific occupancy
    str_revenue         NUMERIC(12,2),                  -- total STR gross revenue
    
    -- ========== METADATA ==========
    data_source         VARCHAR(50),                    -- 'appfolio', 'yardi', 'realpage', 'manual', 'csv_upload'
    upload_id           UUID,                           -- links to data_uploads table
    is_budget           BOOLEAN DEFAULT FALSE,          -- TRUE = budget/projection, FALSE = actual
    is_proforma         BOOLEAN DEFAULT FALSE,          -- TRUE = proforma projection
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    
    -- Prevent duplicate months per property per type
    UNIQUE(property_id, report_month, is_budget, is_proforma)
);

-- Performance indexes for the comp query engine and portfolio tracking
CREATE INDEX idx_actuals_property ON deal_monthly_actuals(property_id);
CREATE INDEX idx_actuals_month ON deal_monthly_actuals(report_month);
CREATE INDEX idx_actuals_property_month ON deal_monthly_actuals(property_id, report_month DESC);
CREATE INDEX idx_actuals_source ON deal_monthly_actuals(data_source);
CREATE INDEX idx_actuals_upload ON deal_monthly_actuals(upload_id);
CREATE INDEX idx_actuals_budget ON deal_monthly_actuals(is_budget) WHERE is_budget = TRUE;

-- Comp query engine indexes (searching by geography + financial metrics)
CREATE INDEX idx_actuals_noi ON deal_monthly_actuals(noi DESC NULLS LAST) WHERE noi IS NOT NULL;
CREATE INDEX idx_actuals_occupancy ON deal_monthly_actuals(occupancy_rate) WHERE occupancy_rate IS NOT NULL;
CREATE INDEX idx_actuals_rent ON deal_monthly_actuals(avg_effective_rent) WHERE avg_effective_rent IS NOT NULL;


-- ============================================================================
-- 4. DATA UPLOADS — CSV/Excel Upload Tracking + Column Mapping
-- ============================================================================
-- Tracks every file upload: who, when, what format, how columns mapped,
-- how many rows succeeded/failed. Enables audit trail and re-processing.

CREATE TABLE IF NOT EXISTS data_uploads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Who and what
    user_id         UUID NOT NULL,
    property_id     UUID REFERENCES properties(id),     -- NULL if bulk upload spanning multiple properties
    -- File info
    original_filename VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT,
    file_type       VARCHAR(20) NOT NULL,               -- 'csv', 'xlsx', 'xls', 'tsv'
    storage_path    VARCHAR(1000),                      -- S3/local path to archived original
    -- Processing status
    status          VARCHAR(20) DEFAULT 'pending',      -- pending, processing, completed, failed, partial
    -- Column mapping (the mapper UI saves this)
    column_mapping  JSONB NOT NULL DEFAULT '{}',        -- { "source_col": "target_col", ... }
    -- e.g., { "Gross Rent": "gross_potential_rent", "Vacancy $": "vacancy_loss", "Month": "report_month" }
    source_format   VARCHAR(50),                        -- 'appfolio', 'yardi', 'realpage', 'custom'
    -- Results
    rows_total      INTEGER DEFAULT 0,
    rows_succeeded  INTEGER DEFAULT 0,
    rows_failed     INTEGER DEFAULT 0,
    error_log       JSONB DEFAULT '[]',                 -- [{ row: 5, error: "invalid date", raw: {...} }]
    -- Time range of data uploaded
    data_start_date DATE,
    data_end_date   DATE,
    -- Metadata
    created_at      TIMESTAMPTZ DEFAULT now(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_uploads_user ON data_uploads(user_id);
CREATE INDEX idx_uploads_property ON data_uploads(property_id);
CREATE INDEX idx_uploads_status ON data_uploads(status);

-- Pre-defined column mapping templates for common PM software
CREATE TABLE IF NOT EXISTS upload_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,              -- 'AppFolio Standard', 'Yardi Voyager', 'Manual Excel'
    source_format   VARCHAR(50) NOT NULL UNIQUE,        -- 'appfolio', 'yardi', 'realpage', 'manual'
    column_mapping  JSONB NOT NULL,                     -- default mapping for this format
    description     TEXT,
    is_system       BOOLEAN DEFAULT TRUE,               -- system templates vs user-created
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Seed the most common templates
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
);


-- ============================================================================
-- 5. PROFORMA TEMPLATES — Reusable Assumption Sets (3-Layer Architecture)
-- ============================================================================
-- The 3-layer proforma from M09:
--   Layer 1 (Baseline): historical averages from deal_monthly_actuals + market data
--   Layer 2 (Platform-Adjusted): news events, demand signals adjust assumptions (F32, F33)
--   Layer 3 (User Override): user manually overrides any assumption
--
-- Templates save a complete set of assumptions that can be reused across deals.

CREATE TABLE IF NOT EXISTS proforma_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    -- Template identity
    name            VARCHAR(200) NOT NULL,              -- "Conservative 5yr Hold", "Aggressive Value-Add"
    description     TEXT,
    property_type   VARCHAR(50),                        -- if type-specific, NULL = universal
    product_type    VARCHAR(50),
    strategy        VARCHAR(20),                        -- bts, flip, rental, str, or NULL = any
    -- Hold period
    hold_years      INTEGER DEFAULT 5,
    -- Revenue assumptions (F16, F32)
    rent_growth_yr1     NUMERIC(5,3) DEFAULT 0.03,      -- 3.0%
    rent_growth_yr2_5   NUMERIC(5,3) DEFAULT 0.025,     -- 2.5%
    rent_growth_yr6_10  NUMERIC(5,3) DEFAULT 0.02,      -- 2.0%
    vacancy_rate        NUMERIC(5,3) DEFAULT 0.05,      -- 5.0%
    vacancy_trend       NUMERIC(5,3) DEFAULT 0.0,       -- annual change in vacancy
    concession_pct      NUMERIC(5,3) DEFAULT 0.01,      -- 1.0% of GPR
    bad_debt_pct        NUMERIC(5,3) DEFAULT 0.015,     -- 1.5%
    other_income_per_unit NUMERIC(10,2) DEFAULT 150.00,
    -- Expense assumptions
    opex_ratio          NUMERIC(5,3) DEFAULT 0.45,      -- 45% of EGI
    opex_growth         NUMERIC(5,3) DEFAULT 0.025,     -- 2.5%/yr
    management_fee_pct  NUMERIC(5,3) DEFAULT 0.05,      -- 5% of EGI
    capex_per_unit      NUMERIC(10,2) DEFAULT 300.00,   -- annual reserves
    property_tax_growth NUMERIC(5,3) DEFAULT 0.02,
    insurance_growth    NUMERIC(5,3) DEFAULT 0.03,
    -- Debt assumptions (feeds F21 DSCR, F22 Debt Yield)
    ltv                 NUMERIC(5,3) DEFAULT 0.70,      -- 70% LTV
    interest_rate       NUMERIC(5,4) DEFAULT 0.065,     -- 6.5%
    amortization_years  INTEGER DEFAULT 30,
    loan_term_years     INTEGER DEFAULT 10,
    io_period_months    INTEGER DEFAULT 0,              -- interest-only period
    -- Exit assumptions (feeds F34 Optimal Exit)
    exit_cap_rate       NUMERIC(5,3) DEFAULT 0.055,     -- 5.5%
    exit_cap_spread     NUMERIC(5,3) DEFAULT 0.001,     -- cap rate expansion over hold
    selling_costs_pct   NUMERIC(5,3) DEFAULT 0.02,      -- 2% of sale price
    -- Return targets (for sensitivity highlighting)
    target_irr          NUMERIC(5,3) DEFAULT 0.15,      -- 15%
    target_coc          NUMERIC(5,3) DEFAULT 0.08,      -- 8%
    target_equity_mult  NUMERIC(5,2) DEFAULT 2.0,       -- 2.0x
    target_dscr_min     NUMERIC(5,2) DEFAULT 1.25,      -- minimum 1.25x
    -- Metadata
    is_default          BOOLEAN DEFAULT FALSE,
    is_system           BOOLEAN DEFAULT FALSE,           -- system-provided templates
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_templates_user ON proforma_templates(user_id);
CREATE INDEX idx_templates_strategy ON proforma_templates(strategy);


-- ============================================================================
-- 6. PROFORMA SNAPSHOTS — Generated ProForma Results
-- ============================================================================
-- When the 3-layer generator runs, it produces a proforma for a specific
-- property + template combination. Stores the computed results.

CREATE TABLE IF NOT EXISTS proforma_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    template_id     UUID REFERENCES proforma_templates(id),
    strategy        VARCHAR(20) NOT NULL,               -- which strategy this proforma models
    -- The 3 layers of assumptions (JSON for flexibility)
    layer1_baseline     JSONB NOT NULL DEFAULT '{}',    -- historical/market data assumptions
    layer2_adjusted     JSONB NOT NULL DEFAULT '{}',    -- platform-adjusted (F32, F33 applied)
    layer3_user         JSONB NOT NULL DEFAULT '{}',    -- user overrides
    active_layer        VARCHAR(10) DEFAULT 'layer2',   -- which layer is "active" for display
    -- Computed results (F16-F22)
    year1_noi           NUMERIC(14,2),                  -- F16
    going_in_cap        NUMERIC(5,4),                   -- F17
    coc_return          NUMERIC(5,4),                   -- F18
    irr                 NUMERIC(5,4),                   -- F19
    equity_multiple     NUMERIC(5,2),                   -- F20
    dscr                NUMERIC(5,2),                   -- F21
    debt_yield          NUMERIC(5,4),                   -- F22
    -- Full annual projection (JSON array, one object per year)
    annual_projections  JSONB,                          -- [{year:1, noi:X, cf:Y, ...}, ...]
    -- Exit analysis (F34)
    optimal_exit_year   INTEGER,
    exit_value          NUMERIC(14,2),
    -- Metadata
    generated_at        TIMESTAMPTZ DEFAULT now(),
    generated_by        VARCHAR(20) DEFAULT 'platform', -- 'platform', 'user', 'scenario'
    notes               TEXT
);

CREATE INDEX idx_proforma_property ON proforma_snapshots(property_id);
CREATE INDEX idx_proforma_strategy ON proforma_snapshots(strategy);
CREATE INDEX idx_proforma_irr ON proforma_snapshots(irr DESC NULLS LAST);


-- ============================================================================
-- 7. VIEWS — Pre-built queries for common access patterns
-- ============================================================================

-- Latest monthly actuals per property (most common query)
CREATE OR REPLACE VIEW v_latest_actuals AS
SELECT DISTINCT ON (property_id)
    dma.*,
    p.name AS property_name,
    p.city,
    p.state,
    p.total_units AS property_total_units,
    p.submarket_id,
    p.msa_id,
    p.jedi_score,
    p.recommended_strategy
FROM deal_monthly_actuals dma
JOIN properties p ON p.id = dma.property_id
WHERE dma.is_budget = FALSE AND dma.is_proforma = FALSE
ORDER BY dma.property_id, dma.report_month DESC;

-- Actual vs Budget variance (feeds M22 Portfolio, F35)
CREATE OR REPLACE VIEW v_actual_vs_budget AS
SELECT
    a.property_id,
    a.report_month,
    p.name AS property_name,
    -- Revenue variance
    a.effective_gross_income AS actual_egi,
    b.effective_gross_income AS budget_egi,
    CASE WHEN b.effective_gross_income > 0 
        THEN (a.effective_gross_income - b.effective_gross_income) / b.effective_gross_income 
        ELSE NULL END AS egi_variance_pct,
    -- NOI variance  
    a.noi AS actual_noi,
    b.noi AS budget_noi,
    CASE WHEN b.noi > 0 
        THEN (a.noi - b.noi) / b.noi 
        ELSE NULL END AS noi_variance_pct,
    -- Occupancy variance
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

-- Comp query base view (feeds the Comp Query Engine)
-- Joins actuals with property details for geographic + financial filtering
CREATE OR REPLACE VIEW v_comp_search AS
SELECT
    p.id AS property_id,
    p.name,
    p.city,
    p.state,
    p.property_type,
    p.product_type,
    p.total_units,
    p.year_built,
    p.submarket_id,
    p.msa_id,
    s.name AS submarket_name,
    m.name AS msa_name,
    -- Trailing 12-month averages (comp-relevant metrics)
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
LEFT JOIN submarkets s ON s.id = p.submarket_id
LEFT JOIN msas m ON m.id = p.msa_id
GROUP BY p.id, p.name, p.city, p.state, p.property_type, p.product_type,
         p.total_units, p.year_built, p.submarket_id, p.msa_id,
         s.name, m.name;


-- ============================================================================
-- 8. FUNCTIONS — Derived field calculation triggers
-- ============================================================================

-- Auto-calculate derived fields on insert/update
CREATE OR REPLACE FUNCTION fn_calculate_actuals_derived()
RETURNS TRIGGER AS $$
BEGIN
    -- Occupancy rate
    IF NEW.total_units IS NOT NULL AND NEW.total_units > 0 AND NEW.occupied_units IS NOT NULL THEN
        NEW.occupancy_rate := NEW.occupied_units::NUMERIC / NEW.total_units;
    END IF;
    
    -- OpEx per unit
    IF NEW.total_opex IS NOT NULL AND NEW.total_units IS NOT NULL AND NEW.total_units > 0 THEN
        NEW.opex_per_unit := NEW.total_opex / NEW.total_units;
    END IF;
    
    -- OpEx ratio
    IF NEW.total_opex IS NOT NULL AND NEW.effective_gross_income IS NOT NULL AND NEW.effective_gross_income > 0 THEN
        NEW.opex_ratio := NEW.total_opex / NEW.effective_gross_income;
    END IF;
    
    -- NOI (if not explicitly provided)
    IF NEW.noi IS NULL AND NEW.effective_gross_income IS NOT NULL AND NEW.total_opex IS NOT NULL THEN
        NEW.noi := NEW.effective_gross_income - NEW.total_opex;
    END IF;
    
    -- NOI per unit
    IF NEW.noi IS NOT NULL AND NEW.total_units IS NOT NULL AND NEW.total_units > 0 THEN
        NEW.noi_per_unit := NEW.noi / NEW.total_units;
    END IF;
    
    -- Cash flow before tax
    IF NEW.cash_flow_before_tax IS NULL AND NEW.noi IS NOT NULL THEN
        NEW.cash_flow_before_tax := NEW.noi 
            - COALESCE(NEW.debt_service, 0) 
            - COALESCE(NEW.capex, 0) 
            - COALESCE(NEW.capex_reserves, 0);
    END IF;
    
    -- Renewal rate
    IF NEW.renewals IS NOT NULL AND NEW.move_outs IS NOT NULL 
       AND (NEW.renewals + NEW.move_outs) > 0 THEN
        NEW.renewal_rate := NEW.renewals::NUMERIC / (NEW.renewals + NEW.move_outs);
    END IF;
    
    -- Updated timestamp
    NEW.updated_at := now();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_actuals_derived
    BEFORE INSERT OR UPDATE ON deal_monthly_actuals
    FOR EACH ROW
    EXECUTE FUNCTION fn_calculate_actuals_derived();

-- Auto-update property updated_at when actuals change
CREATE OR REPLACE FUNCTION fn_touch_property()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE properties SET updated_at = now() WHERE id = NEW.property_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_touch_property_on_actuals
    AFTER INSERT OR UPDATE ON deal_monthly_actuals
    FOR EACH ROW
    EXECUTE FUNCTION fn_touch_property();


COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
-- 
-- What this unblocks:
--   ✓ deal_monthly_actuals → foundation for everything
--   ✓ data_uploads + upload_templates → CSV/Excel upload flow
--   ✓ v_comp_search → Comp Query Engine base
--   ✓ proforma_templates + proforma_snapshots → 3-layer proforma
--   ✓ v_actual_vs_budget → M22 Portfolio actual vs projected (F35)
--   ✓ Geographic hierarchy → submarket ranking (F26), market intel (M05)
--
-- Next steps after migration:
--   1. FastAPI endpoint: POST /api/v1/uploads → accept file, detect format, 
--      return column_mapping preview → user confirms → process rows
--   2. FastAPI endpoint: GET /api/v1/comps?submarket_id=X&min_units=Y&...
--      → queries v_comp_search with filters
--   3. FastAPI endpoint: POST /api/v1/proforma/generate → takes property_id + 
--      template_id → runs 3-layer calculation → saves snapshot
--   4. Wire M22 Portfolio page to v_actual_vs_budget view
--   5. Create downloadable Excel template from upload_templates mapping
