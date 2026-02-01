-- =====================================================
-- Migration 007: Cash Flow & Financial Model Agent Tables
-- =====================================================
-- Description: Tables for investment analysis, cash flow projections, and financial modeling
-- Created: 2026-01-31
-- =====================================================

-- =====================================================
-- Cash Flow Analyses
-- =====================================================

CREATE TABLE cash_flow_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Analysis name/scenario
    scenario_name VARCHAR(255) DEFAULT 'Base Case',
    analysis_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Purchase details
    purchase_price INTEGER NOT NULL,
    down_payment_pct DECIMAL(5, 2) DEFAULT 20.00,
    down_payment_amount INTEGER,
    loan_amount INTEGER,
    
    -- Financing terms
    interest_rate DECIMAL(5, 3), -- e.g., 6.500
    loan_term_years INTEGER DEFAULT 30,
    monthly_payment INTEGER,
    
    -- Closing costs
    closing_costs INTEGER,
    renovation_costs INTEGER DEFAULT 0,
    total_initial_investment INTEGER,
    
    -- Operating income (monthly)
    gross_rental_income INTEGER,
    other_income INTEGER DEFAULT 0,
    vacancy_loss INTEGER,
    effective_gross_income INTEGER,
    
    -- Operating expenses (monthly)
    property_tax INTEGER,
    insurance INTEGER,
    hoa_fees INTEGER DEFAULT 0,
    utilities INTEGER DEFAULT 0,
    maintenance INTEGER,
    property_management INTEGER,
    capex_reserve INTEGER,
    other_expenses INTEGER DEFAULT 0,
    total_operating_expenses INTEGER,
    
    -- Net operating income
    noi_monthly INTEGER, -- Net Operating Income
    noi_annual INTEGER,
    
    -- Cash flow
    debt_service_monthly INTEGER, -- Mortgage payment
    cash_flow_monthly INTEGER, -- NOI - Debt Service
    cash_flow_annual INTEGER,
    
    -- Returns
    cash_on_cash_return DECIMAL(5, 2), -- Annual cash flow / Total investment
    cap_rate DECIMAL(5, 2), -- NOI / Purchase Price
    grm DECIMAL(5, 2), -- Gross Rent Multiplier
    dscr DECIMAL(5, 2), -- Debt Service Coverage Ratio
    
    -- Break-even analysis
    break_even_occupancy_pct DECIMAL(5, 2),
    break_even_rent INTEGER,
    
    -- Investment score
    investment_score INTEGER CHECK (investment_score BETWEEN 0 AND 100),
    investment_rating VARCHAR(20), -- 'excellent', 'good', 'fair', 'poor'
    
    -- Assumptions
    assumptions JSONB,
    
    -- Sensitivity analysis
    sensitivity_analysis JSONB, -- Different scenarios
    
    -- AI insights
    ai_summary TEXT,
    strengths TEXT[],
    risks TEXT[],
    recommendations TEXT[],
    
    -- Status
    is_favorite BOOLEAN DEFAULT FALSE,
    is_shared BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cashflow_property ON cash_flow_analyses(property_id);
CREATE INDEX idx_cashflow_user ON cash_flow_analyses(user_id);
CREATE INDEX idx_cashflow_org ON cash_flow_analyses(organization_id);
CREATE INDEX idx_cashflow_score ON cash_flow_analyses(investment_score DESC);
CREATE INDEX idx_cashflow_coc ON cash_flow_analyses(cash_on_cash_return DESC);
CREATE INDEX idx_cashflow_favorite ON cash_flow_analyses(is_favorite) WHERE is_favorite = TRUE;

COMMENT ON TABLE cash_flow_analyses IS 'Detailed cash flow analysis for investment properties';
COMMENT ON COLUMN cash_flow_analyses.cash_on_cash_return IS 'Annual cash flow divided by total investment';
COMMENT ON COLUMN cash_flow_analyses.dscr IS 'Debt Service Coverage Ratio (NOI / Debt Service)';

-- =====================================================
-- Pro Forma Projections (Multi-Year)
-- =====================================================

CREATE TABLE proforma_projections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cash_flow_analysis_id UUID REFERENCES cash_flow_analyses(id) ON DELETE CASCADE,
    
    -- Projection year
    year_number INTEGER NOT NULL CHECK (year_number BETWEEN 1 AND 30),
    calendar_year INTEGER,
    
    -- Income projections
    gross_rental_income INTEGER,
    vacancy_loss INTEGER,
    effective_gross_income INTEGER,
    
    -- Expense projections
    operating_expenses INTEGER,
    debt_service INTEGER,
    capital_expenditures INTEGER,
    
    -- Cash flow
    noi INTEGER,
    cash_flow_before_tax INTEGER,
    
    -- Tax impacts
    depreciation INTEGER,
    taxable_income INTEGER,
    tax_savings INTEGER,
    cash_flow_after_tax INTEGER,
    
    -- Property value
    estimated_property_value INTEGER,
    
    -- Equity buildup
    loan_balance INTEGER,
    equity INTEGER,
    
    -- Returns
    cash_on_cash_return DECIMAL(5, 2),
    equity_multiple DECIMAL(5, 2),
    irr DECIMAL(5, 2), -- Cumulative IRR
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT unique_proforma_year UNIQUE(cash_flow_analysis_id, year_number)
);

CREATE INDEX idx_proforma_analysis ON proforma_projections(cash_flow_analysis_id);
CREATE INDEX idx_proforma_year ON proforma_projections(year_number);

COMMENT ON TABLE proforma_projections IS 'Multi-year cash flow and return projections';
COMMENT ON COLUMN proforma_projections.irr IS 'Internal Rate of Return (cumulative)';

-- =====================================================
-- Financial Models (Complex Scenarios)
-- =====================================================

CREATE TABLE financial_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Model metadata
    model_name VARCHAR(255) NOT NULL,
    model_type VARCHAR(50), -- 'acquisition', 'development', 'syndication', 'portfolio'
    description TEXT,
    
    -- Investment structure
    total_project_cost INTEGER,
    equity_required INTEGER,
    debt_financing INTEGER,
    
    -- Ownership structure
    ownership_structure JSONB, -- For syndications/partnerships
    
    -- Development timeline (if applicable)
    acquisition_date DATE,
    construction_start_date DATE,
    construction_end_date DATE,
    stabilization_date DATE,
    exit_date DATE,
    
    -- Returns summary
    total_cash_flow INTEGER,
    exit_proceeds INTEGER,
    total_return INTEGER,
    equity_multiple DECIMAL(5, 2),
    irr DECIMAL(5, 2),
    
    -- Detailed projections
    yearly_projections JSONB, -- Array of year-by-year data
    
    -- Assumptions
    rent_growth_rate DECIMAL(5, 2),
    expense_growth_rate DECIMAL(5, 2),
    property_appreciation_rate DECIMAL(5, 2),
    exit_cap_rate DECIMAL(5, 2),
    
    -- Sensitivity ranges
    sensitivity_low JSONB,
    sensitivity_high JSONB,
    
    -- AI analysis
    ai_executive_summary TEXT,
    key_metrics JSONB,
    risk_assessment TEXT,
    recommendations TEXT[],
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_template BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_models_property ON financial_models(property_id);
CREATE INDEX idx_models_user ON financial_models(user_id);
CREATE INDEX idx_models_org ON financial_models(organization_id);
CREATE INDEX idx_models_type ON financial_models(model_type);
CREATE INDEX idx_models_irr ON financial_models(irr DESC);

COMMENT ON TABLE financial_models IS 'Complex financial models for development and syndication';
COMMENT ON COLUMN financial_models.is_template IS 'Whether this model can be used as a template';

-- =====================================================
-- Market Rental Rates
-- =====================================================

CREATE TABLE market_rental_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID REFERENCES markets(id),
    
    -- Geographic area
    area_name VARCHAR(255),
    area_boundary GEOMETRY(Polygon, 4326),
    
    -- Time period
    rate_date DATE NOT NULL,
    
    -- By property type
    sf_1br_median INTEGER,
    sf_2br_median INTEGER,
    sf_3br_median INTEGER,
    sf_4br_median INTEGER,
    
    mf_studio_median INTEGER,
    mf_1br_median INTEGER,
    mf_2br_median INTEGER,
    mf_3br_median INTEGER,
    
    -- Metrics
    avg_rent_per_sqft DECIMAL(5, 2),
    vacancy_rate DECIMAL(5, 2),
    
    -- Trends
    rent_growth_yoy_pct DECIMAL(5, 2),
    rent_growth_mom_pct DECIMAL(5, 2),
    
    -- Data source
    data_source VARCHAR(50), -- 'rentometer', 'zillow', 'apartments_com'
    sample_size INTEGER,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT unique_rental_rate UNIQUE(market_id, area_name, rate_date)
);

CREATE INDEX idx_rental_rates_market ON market_rental_rates(market_id);
CREATE INDEX idx_rental_rates_date ON market_rental_rates(rate_date DESC);
CREATE INDEX idx_rental_rates_area ON market_rental_rates USING GIST(area_boundary);

COMMENT ON TABLE market_rental_rates IS 'Market rental rates by property type and bedroom count';

-- =====================================================
-- Operating Expense Benchmarks
-- =====================================================

CREATE TABLE expense_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID REFERENCES markets(id),
    
    -- Property characteristics
    property_type property_type,
    units_count INTEGER,
    year_built INTEGER,
    
    -- Annual expenses per unit
    property_tax_per_unit INTEGER,
    insurance_per_unit INTEGER,
    utilities_per_unit INTEGER,
    maintenance_per_unit INTEGER,
    management_per_unit INTEGER,
    capex_per_unit INTEGER,
    
    -- As percentage of gross income
    total_expenses_pct DECIMAL(5, 2),
    
    -- Sample data
    sample_size INTEGER,
    data_year INTEGER,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_expense_benchmarks_market ON expense_benchmarks(market_id);
CREATE INDEX idx_expense_benchmarks_type ON expense_benchmarks(property_type);

COMMENT ON TABLE expense_benchmarks IS 'Operating expense benchmarks by market and property type';

-- =====================================================
-- Debt Agent: Financing Options
-- =====================================================

CREATE TABLE financing_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID REFERENCES markets(id),
    
    -- Lender information
    lender_name VARCHAR(255),
    lender_type VARCHAR(50), -- 'bank', 'credit_union', 'private', 'hard_money'
    
    -- Loan product
    product_name VARCHAR(255),
    loan_type VARCHAR(50), -- 'conventional', 'fha', 'va', 'portfolio', 'commercial'
    
    -- Terms
    min_down_payment_pct DECIMAL(5, 2),
    max_ltv_pct DECIMAL(5, 2),
    interest_rate DECIMAL(5, 3),
    rate_type VARCHAR(20), -- 'fixed', 'adjustable'
    
    -- Loan limits
    min_loan_amount INTEGER,
    max_loan_amount INTEGER,
    
    -- Requirements
    min_credit_score INTEGER,
    max_dti_ratio DECIMAL(5, 2),
    reserves_required_months INTEGER,
    
    -- Property criteria
    allowed_property_types property_type[],
    investment_properties_allowed BOOLEAN DEFAULT TRUE,
    
    -- Fees
    origination_fee_pct DECIMAL(5, 2),
    estimated_closing_costs_pct DECIMAL(5, 2),
    
    -- Availability
    is_active BOOLEAN DEFAULT TRUE,
    effective_date DATE,
    expires_date DATE,
    
    -- Contact
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    application_url TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_financing_market ON financing_options(market_id);
CREATE INDEX idx_financing_lender ON financing_options(lender_name);
CREATE INDEX idx_financing_type ON financing_options(loan_type);
CREATE INDEX idx_financing_rate ON financing_options(interest_rate);
CREATE INDEX idx_financing_active ON financing_options(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE financing_options IS 'Available financing products and loan options by market';

-- =====================================================
-- Calculate Investment Score Function
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_investment_score(
    cash_on_cash DECIMAL(5, 2),
    cap_rate DECIMAL(5, 2),
    dscr DECIMAL(5, 2)
)
RETURNS INTEGER AS $$
DECLARE
    score INTEGER := 50; -- Start at middle
BEGIN
    -- Cash-on-Cash Return scoring (max 40 points)
    CASE
        WHEN cash_on_cash >= 15 THEN score := score + 40;
        WHEN cash_on_cash >= 12 THEN score := score + 35;
        WHEN cash_on_cash >= 10 THEN score := score + 30;
        WHEN cash_on_cash >= 8 THEN score := score + 25;
        WHEN cash_on_cash >= 6 THEN score := score + 20;
        WHEN cash_on_cash >= 4 THEN score := score + 10;
        WHEN cash_on_cash < 0 THEN score := score - 20;
    END CASE;
    
    -- Cap Rate scoring (max 30 points)
    CASE
        WHEN cap_rate >= 10 THEN score := score + 30;
        WHEN cap_rate >= 8 THEN score := score + 25;
        WHEN cap_rate >= 6 THEN score := score + 20;
        WHEN cap_rate >= 5 THEN score := score + 15;
        WHEN cap_rate >= 4 THEN score := score + 10;
    END CASE;
    
    -- DSCR scoring (max 30 points)
    CASE
        WHEN dscr >= 1.50 THEN score := score + 30;
        WHEN dscr >= 1.30 THEN score := score + 25;
        WHEN dscr >= 1.20 THEN score := score + 20;
        WHEN dscr >= 1.10 THEN score := score + 15;
        WHEN dscr >= 1.00 THEN score := score + 10;
        WHEN dscr < 1.00 THEN score := score - 20;
    END CASE;
    
    -- Clamp to 0-100
    IF score > 100 THEN score := 100; END IF;
    IF score < 0 THEN score := 0; END IF;
    
    RETURN score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_investment_score IS 'Calculate investment opportunity score from key metrics';

-- =====================================================
-- Update Timestamps Trigger
-- =====================================================

CREATE TRIGGER update_cashflow_updated_at BEFORE UPDATE ON cash_flow_analyses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_models_updated_at BEFORE UPDATE ON financial_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_financing_updated_at BEFORE UPDATE ON financing_options
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
