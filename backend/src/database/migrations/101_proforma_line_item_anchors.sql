-- Proforma Line-Item Anchor Registry (M36 Addendum Part 2)
--
-- Every proforma line item has its own growth driver and timing rules.
-- This registry stores the anchor configuration per line item, plus
-- state-level legal/regulatory override rules.
--
-- See M36_PROFORMA_LINE_ITEM_ANCHORS.md for design rationale.

-- ─── Line-Item Anchor Registry ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proforma_line_item_anchors (
    anchor_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_item_id           VARCHAR(50)  NOT NULL,   -- e.g., 'insurance', 'taxes', 'mgmt_fees'
    line_item_label        VARCHAR(100) NOT NULL,   -- e.g., 'Insurance', 'Property Taxes'
    category               VARCHAR(50)  NOT NULL,   -- 'revenue' | 'opex' | 'capex' | 'summary'
    anchor_type            VARCHAR(30)  NOT NULL,   -- 'macro_series' | 'fixed_rate' | 'prev_year_plus_premium' | 'per_unit_fixed' | 'pct_of_egi'
    macro_series_id        VARCHAR(50),             -- FRED series ID (for macro_series)
    structural_premium     DOUBLE PRECISION DEFAULT 0,
    timing_change_type     VARCHAR(30)  NOT NULL DEFAULT 'annual_step',  -- 'annual_step' | 'locked' | 'trigger_once' | 'cycle' | 'market'
    timing_effective       VARCHAR(50)  NOT NULL DEFAULT 'at_close',     -- 'at_close' | 'next_calendar_year' | 'next_assessment' | 'annual_jan_1'
    timing_cycle_years     INTEGER,
    trigger_on_sale        BOOLEAN DEFAULT false,
    trigger_on_refinance   BOOLEAN DEFAULT false,
    trigger_on_renovation  BOOLEAN DEFAULT false,
    trigger_on_reassessment BOOLEAN DEFAULT false,
    geo_insurance_zone_mult DOUBLE PRECISION DEFAULT 1.0,
    geo_tax_burden_index    DOUBLE PRECISION DEFAULT 1.0,
    default_value          DOUBLE PRECISION,        -- fallback if no source data
    sort_order             INTEGER NOT NULL DEFAULT 0,
    is_active              BOOLEAN DEFAULT true,
    deal_type_tags         TEXT[] DEFAULT '{}',     -- 'new_construction', 'value_add', 'stabilized', 'opportunistic'
    created_at             TIMESTAMPTZ DEFAULT now(),
    updated_at             TIMESTAMPTZ DEFAULT now(),
    UNIQUE (line_item_id, deal_type_tags)
);

CREATE INDEX IF NOT EXISTS idx_anchors_line_item ON proforma_line_item_anchors(line_item_id, is_active);
CREATE INDEX IF NOT EXISTS idx_anchors_deal_tag ON proforma_line_item_anchors USING GIN(deal_type_tags);

COMMENT ON TABLE proforma_line_item_anchors IS
    'Registry mapping each proforma line item to its growth driver (macro series, fixed rate, etc.) and timing rules';

-- ─── State-Level Override Rules ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proforma_state_rules (
    rule_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_code     VARCHAR(2) NOT NULL,
    line_item_id   VARCHAR(50) NOT NULL,
    rule_type      VARCHAR(30) NOT NULL,   -- 'reassessment' | 'cap' | 'trigger' | 'rate'
    rule_value     DOUBLE PRECISION,       -- e.g., cap rate = 0.03 for FL insurance
    rule_text      TEXT,                   -- human-readable: "Reassesses on sale within 6 months"
    effective_date DATE,
    is_active      BOOLEAN DEFAULT true,
    created_at     TIMESTAMPTZ DEFAULT now(),
    UNIQUE (state_code, line_item_id, rule_type)
);

CREATE INDEX IF NOT EXISTS idx_state_rules_lookup ON proforma_state_rules(state_code, line_item_id, is_active);

COMMENT ON TABLE proforma_state_rules IS
    'Per-state legal/regulatory overrides for proforma line items (reassessment rules, rate caps, trigger laws)';

-- ═══════════════════════════════════════════════════════════════════════════════
-- SEED DATA — Default Anchors
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO proforma_line_item_anchors (line_item_id, line_item_label, category, anchor_type, macro_series_id, structural_premium, timing_change_type, timing_effective, trigger_on_sale, trigger_on_reassessment, default_value, sort_order) VALUES
    -- Revenue
    ('rent_income',       'Gross Rent Income',        'revenue', 'macro_series', 'CUSR0000SEHC', 0.008, 'annual_step', 'at_close',            false, false, NULL,  10),
    ('other_income',      'Other Income',              'revenue', 'prev_year_plus_premium', NULL,  0.020, 'annual_step', 'at_close',            false, false, NULL,  20),
    ('vacancy_loss',      'Vacancy & Concessions',     'revenue', 'pct_of_egi',       NULL,        0.000, 'locked',      'at_close',            false, false, NULL,  30),
    ('gross_potential',   'Gross Potential Rent',      'revenue', 'pct_of_egi',       NULL,        0.000, 'annual_step', 'at_close',            false, false, NULL,  40),
    ('effective_gross',   'Effective Gross Income',    'revenue', 'pct_of_egi',       NULL,        0.000, 'locked',      'at_close',            false, false, NULL,  50),

    -- Operating Expenses
    ('mgmt_fees',         'Management Fees',           'opex',   'pct_of_egi',       'ECIWAG',     0.005, 'annual_step', 'at_close',            false, false, NULL, 100),
    ('insurance',         'Insurance',                 'opex',   'macro_series',     'WPSFD49207', 0.010, 'annual_step', 'at_close',            false, false, 700,  110),
    ('taxes',             'Property Taxes',            'opex',   'prev_year_plus_premium', NULL,  0.030, 'trigger_once','next_calendar_year',   false, true,  NULL,  120),
    ('utilities',         'Utilities',                 'opex',   'macro_series',    'CUSR0000SEHC', 0.005, 'annual_step', 'at_close',            false, false, 400,  130),
    ('repairs_maint',     'Repairs & Maintenance',     'opex',   'macro_series',    'WPSFD49207', 0.005, 'annual_step', 'at_close',            false, false, 350,  140),
    ('reserves',          'Replacement Reserves',      'opex',   'prev_year_plus_premium', 'WPSFD49207', 0.025, 'annual_step', 'at_close',        false, false, 300,  150),
    ('total_opex',        'Total Operating Expenses',  'summary','pct_of_egi',       NULL,        0.000, 'locked',      'at_close',            false, false, NULL, 160),

    -- Capex
    ('capex',             'Capital Expenditures',      'capex',  'per_unit_fixed',   NULL,        0.030, 'annual_step', 'at_close',            false, false, 800,  200),

    -- Summary
    ('noi',               'Net Operating Income',      'summary','pct_of_egi',       NULL,        0.000, 'locked',      'at_close',            false, false, NULL, 300)
ON CONFLICT (line_item_id, deal_type_tags) DO NOTHING;

-- ─── State Rules (tax reassessment + insurance caps) ────────────────────────

INSERT INTO proforma_state_rules (state_code, line_item_id, rule_type, rule_value, rule_text) VALUES
    -- Georgia — reassesses on sale
    ('GA', 'taxes', 'reassessment', NULL, 'Georgia reassesses on sale. New bill issued within 6 months of recorded deed. Buyer is responsible for taxes from closing date forward.'),
    ('GA', 'taxes', 'trigger',      NULL, 'On sale completion — new assessment triggered within 6 months of deed recordation.'),
    -- Florida — Save Our Homes cap, insurance rate cap
    ('FL', 'insurance', 'cap',          0.03,  'Florida statutory cap on insurance rate increases is 3% annually for homestead properties. Non-homestead may be limited by Citizens Property Insurance rate case.'),
    ('FL', 'taxes', 'reassessment',     NULL,  'Florida Save Our Homes: caps annual increase at 3% for homestead. Non-homestead assessed annually at market value with 10% cap.'),
    ('FL', 'taxes', 'cap',              0.10,  'Florida non-homestead cap: 10% annual increase on assessed value.'),
    -- California — Prop 13
    ('CA', 'taxes', 'reassessment',     NULL,  'California Prop 13: 2% annual cap on assessed value increase unless property sells or new construction occurs.'),
    ('CA', 'taxes', 'cap',              0.02,  'Prop 13: base year assessed value × max 2% annual increase. Reassessment to market on sale.'),
    -- Texas — annual reassessment with cap
    ('TX', 'taxes', 'reassessment',     NULL,  'Texas reappraises annually. Homestead cap at 10% year-over-year increase in assessed value. School district tax compression affects effective rate.'),
    ('TX', 'taxes', 'cap',              0.10,  'Texas homestead cap: 10% annual increase on assessed value.'),
    -- New York — annual reassessment with lag
    ('NY', 'taxes', 'reassessment',     NULL,  'New York reassesses annually but with 1-year lag on sale. New owner gets adjusted assessment in next cycle.'),
    ('NY', 'taxes', 'cap',              0.00,  'No statutory cap on assessment increases.'),
    -- Illinois — triennial cycle
    ('IL', 'taxes', 'reassessment',     NULL,  'Illinois triennial reassessment cycle. Sale triggers reassessment at next triennial. Cook County has its own assessment schedule.'),
    ('IL', 'taxes', 'cap',              0.05,  '5% cap on reassessment increase in Cook County. Other counties vary.'),
    -- North Carolina — on-sale + county reval
    ('NC', 'taxes', 'reassessment',     NULL,  'North Carolina reassesses on sale AND at county revaluation (4-8 year cycle). New owner gets fresh assessment within 2 months of closing.'),
    ('NC', 'taxes', 'cap',              0.00,  'No statutory cap. County reval can reset to full market value.'),
    -- Louisiana — insurance rate cap + quadrennial reassessment
    ('LA', 'insurance', 'cap',          0.10,  'Louisiana 10% insurance rate cap given hurricane exposure. Pending legislation may reduce to 5%.'),
    ('LA', 'taxes', 'reassessment',     NULL,  'Louisiana quadrennial (4 year) reassessment cycle. No on-sale reassessment.'),
    -- Arizona — annual reassessment
    ('AZ', 'taxes', 'reassessment',     NULL,  'Arizona reassesses annually based on statutory formula. No on-sale reassessment trigger.'),
    ('AZ', 'taxes', 'cap',              0.05,  'Arizona 5% cap on assessed value increase for owner-occupied. Non-owner limited at reduced max.')
ON CONFLICT (state_code, line_item_id, rule_type) DO NOTHING;
