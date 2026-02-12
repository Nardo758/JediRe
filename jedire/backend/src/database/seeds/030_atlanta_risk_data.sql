/**
 * Seed Data: Atlanta Risk Categories Test Data
 * Phase 3, Component 1: Sample data for Regulatory, Market, Execution, Climate Risk
 * 
 * Provides realistic test data for Atlanta trade areas
 */

-- Get Atlanta trade area IDs
DO $$
DECLARE
  v_atlanta_ta_id UUID;
  v_midtown_ta_id UUID;
  v_buckhead_ta_id UUID;
BEGIN
  -- Get sample trade area IDs (assuming they exist from previous seeds)
  SELECT id INTO v_atlanta_ta_id FROM trade_areas WHERE name LIKE '%Atlanta%' LIMIT 1;
  SELECT id INTO v_midtown_ta_id FROM trade_areas WHERE name LIKE '%Midtown%' LIMIT 1;
  SELECT id INTO v_buckhead_ta_id FROM trade_areas WHERE name LIKE '%Buckhead%' LIMIT 1;

  -- If trade areas don't exist, use a placeholder
  IF v_atlanta_ta_id IS NULL THEN
    v_atlanta_ta_id := gen_random_uuid();
  END IF;
  IF v_midtown_ta_id IS NULL THEN
    v_midtown_ta_id := v_atlanta_ta_id;
  END IF;
  IF v_buckhead_ta_id IS NULL THEN
    v_buckhead_ta_id := v_atlanta_ta_id;
  END IF;

  -- ============================================================================
  -- REGULATORY RISK: Fulton County Rent Control Proposal
  -- ============================================================================

  INSERT INTO regulatory_risk_events (
    trade_area_id,
    legislation_name,
    jurisdiction,
    jurisdiction_name,
    legislation_type,
    legislation_stage,
    stage_probability,
    headline,
    description,
    summary,
    introduced_date,
    hearing_date,
    effective_date,
    estimated_rent_impact_pct,
    affected_units_count,
    risk_score_impact,
    severity,
    source_type
  ) VALUES
  (
    v_atlanta_ta_id,
    'Fulton County Rent Stabilization Act',
    'County',
    'Fulton County',
    'rent_control',
    'committee',
    50.0,
    'Fulton County considers rent control ordinance',
    'Proposed legislation would cap annual rent increases at 5% for properties built before 2010. Applies to multifamily buildings with 10+ units.',
    'High-impact rent control proposal currently in committee. 50% probability of passage. Would limit rent growth to 5% annually, significantly below projected market increases of 8-10%.',
    '2024-11-15',
    '2025-02-10',
    '2025-07-01',
    -3.5,  -- -3.5% impact on achievable rents
    45000, -- ~45k units in Fulton County
    15.0,  -- +15 to regulatory risk score
    'high',
    'legislative_database'
  ),
  (
    v_atlanta_ta_id,
    'Short-Term Rental Restrictions - Atlanta',
    'City',
    'City of Atlanta',
    'str_restrictions',
    'vote_pending',
    75.0,
    'Atlanta City Council to vote on STR permit cap',
    'Proposed ordinance would cap STR permits at 1,500 citywide and require owner-occupancy for new permits.',
    'High-probability STR restrictions approaching vote. Would eliminate non-owner-occupied STRs in most zones, reducing income potential by 25-50% for affected units.',
    '2024-10-01',
    '2025-01-15',
    '2025-04-01',
    -1.2,  -- -1.2% average impact (only affects STR-zoned properties)
    8000,  -- ~8k potential STR units
    10.0,  -- +10 to regulatory risk score
    'high',
    'council_minutes'
  ),
  (
    v_midtown_ta_id,
    'Inclusionary Zoning Expansion - Midtown',
    'City',
    'City of Atlanta',
    'inclusionary_zoning',
    'proposed',
    25.0,
    'Midtown inclusionary zoning proposal introduced',
    'Would require 15% affordable units in new developments >50 units in Midtown overlay district.',
    'Early-stage inclusionary zoning proposal. Would require 15% affordable units (60% AMI) in new construction, reducing pro forma returns by ~5-8%.',
    '2025-01-05',
    NULL,
    NULL,
    -0.8,
    2500,  -- future units
    5.0,   -- +5 to regulatory risk score
    'moderate',
    'news_article'
  );

  -- ============================================================================
  -- REGULATORY RISK: Zoning Changes
  -- ============================================================================

  INSERT INTO zoning_changes (
    trade_area_id,
    address,
    location,
    current_zoning,
    proposed_zoning,
    zoning_change_type,
    impact_type,
    risk_score_impact,
    description,
    hearing_date,
    status
  ) VALUES
  (
    v_midtown_ta_id,
    'Peachtree Street Corridor, Midtown Atlanta',
    ST_SetSRID(ST_MakePoint(-84.3869, 33.7820), 4326)::geography,
    'MR-3',
    'MR-5',
    'upzone',
    'opportunity',
    -5.0,  -- negative = reduces risk (opportunity)
    'Upzoning Peachtree corridor from MR-3 to MR-5 allows higher density, increasing development potential and land values.',
    '2025-03-15',
    'proposed'
  ),
  (
    v_buckhead_ta_id,
    'Buckhead Village, Atlanta',
    ST_SetSRID(ST_MakePoint(-84.3831, 33.8475), 4326)::geography,
    'C-2',
    'C-1',
    'downzone',
    'risk',
    8.0,  -- positive = increases risk
    'Proposed downzoning to limit commercial development and preserve neighborhood character. Would reduce allowable FAR from 3.0 to 1.5.',
    '2025-04-01',
    'proposed'
  );

  -- ============================================================================
  -- REGULATORY RISK: Tax Policy Changes
  -- ============================================================================

  INSERT INTO tax_policy_changes (
    trade_area_id,
    tax_type,
    jurisdiction,
    jurisdiction_name,
    previous_rate,
    new_rate,
    rate_change_pct,
    assessment_impact_pct,
    announcement_date,
    effective_date,
    estimated_annual_cost_impact,
    risk_score_impact,
    description
  ) VALUES
  (
    v_atlanta_ta_id,
    'property_tax',
    'County',
    'Fulton County',
    0.0106,    -- 1.06% previous millage rate
    0.0112,    -- 1.12% new millage rate
    5.66,      -- +5.66% increase
    3.0,       -- +3% assessment increase
    '2024-12-15',
    '2025-01-01',
    125000.00, -- $125k estimated annual cost impact for typical 200-unit property
    3.0,       -- +3 to regulatory risk score
    'Fulton County approved property tax increase: millage rate +5.66% and reassessment +3%. Combined ~9% increase in property tax burden.'
  );

  -- ============================================================================
  -- MARKET RISK: Current Interest Rate Environment
  -- ============================================================================

  INSERT INTO market_risk_indicators (
    trade_area_id,
    as_of_date,
    current_10yr_treasury,
    current_mortgage_rate,
    interest_rate_trend,
    rate_change_3mo,
    rate_change_12mo,
    current_cap_rate,
    estimated_cap_rate_expansion,
    cap_rate_sensitivity_factor,
    current_dscr,
    stressed_dscr,
    dscr_buffer,
    transaction_volume_index,
    days_on_market_avg,
    buyer_pool_depth,
    loan_to_value_max,
    debt_yield_requirement,
    lending_standard,
    recession_probability,
    yield_curve_spread,
    unemployment_rate,
    unemployment_trend,
    base_market_risk_score
  ) VALUES
  (
    v_atlanta_ta_id,
    '2025-01-15',
    4.50,      -- 10-year treasury at 4.50%
    6.75,      -- mortgage rate at 6.75%
    'stable',
    -25,       -- -25 bps in 3 months
    100,       -- +100 bps in 12 months
    5.25,      -- cap rate at 5.25%
    50,        -- estimated +50 bps cap expansion if rates rise 100 bps
    0.60,      -- 60 bps cap expansion per 100 bps rate increase
    1.45,      -- current DSCR of 1.45
    1.15,      -- stressed DSCR (at +200 bps) of 1.15
    0.30,      -- 0.30 buffer before covenant breach
    85,        -- transaction volume at 85 (below baseline of 100)
    120,       -- avg 120 days on market
    'moderate',
    65.0,      -- max LTV 65%
    9.5,       -- 9.5% debt yield requirement
    'normal',
    25.0,      -- 25% recession probability in next 12 months
    0.35,      -- +35 bps yield curve (normal, not inverted)
    3.8,       -- 3.8% unemployment rate
    'stable',
    55.0       -- Base market risk score: 55 (moderate risk)
  );

  -- ============================================================================
  -- MARKET RISK: Interest Rate Scenarios
  -- ============================================================================

  INSERT INTO interest_rate_scenarios (
    trade_area_id,
    scenario_name,
    scenario_type,
    base_rate,
    stressed_rate,
    rate_change_bps,
    cap_rate_impact_bps,
    noi_impact_pct,
    value_impact_pct,
    dscr_impact,
    probability,
    timeframe_months,
    risk_score_contribution
  ) VALUES
  (
    v_atlanta_ta_id,
    'Baseline',
    'projection',
    4.50,
    4.50,
    0,
    0,
    0.0,
    0.0,
    1.45,
    60.0,  -- 60% probability baseline holds
    12,
    0.0
  ),
  (
    v_atlanta_ta_id,
    '+100 bps Rate Increase',
    'stress_test',
    4.50,
    5.50,
    100,
    60,    -- +60 bps cap rate expansion
    -2.0,  -- -2% NOI impact (demand softness)
    -10.5, -- -10.5% value impact
    1.25,  -- DSCR drops to 1.25
    25.0,  -- 25% probability
    12,
    5.0    -- +5 to market risk score
  ),
  (
    v_atlanta_ta_id,
    '+200 bps Rate Increase (Recession)',
    'stress_test',
    4.50,
    6.50,
    200,
    120,   -- +120 bps cap rate expansion
    -5.0,  -- -5% NOI impact (recession)
    -22.0, -- -22% value impact
    1.15,  -- DSCR drops to 1.15 (near covenant)
    15.0,  -- 15% probability
    18,
    12.0   -- +12 to market risk score
  );

  -- ============================================================================
  -- EXECUTION RISK: Construction Cost Environment
  -- ============================================================================

  INSERT INTO execution_risk_factors (
    trade_area_id,
    as_of_date,
    project_type,
    estimated_project_cost,
    contingency_budget,
    contingency_pct,
    construction_cost_index,
    cost_inflation_yoy,
    cost_inflation_trend,
    labor_availability,
    contractor_availability,
    wage_inflation_yoy,
    skilled_labor_shortage,
    material_lead_times_avg,
    material_price_volatility,
    supply_chain_disruption_risk,
    tariff_exposure,
    contractor_failure_rate,
    contractor_bonding_availability,
    historical_cost_overrun_pct,
    historical_schedule_overrun_days,
    base_execution_risk_score
  ) VALUES
  (
    v_atlanta_ta_id,
    '2025-01-15',
    'major_renovation',
    8500000.00,  -- $8.5M project
    680000.00,   -- $680k contingency
    8.0,         -- 8% contingency (moderate risk)
    112.5,       -- Construction cost index at 112.5 (12.5% above baseline)
    8.0,         -- +8% YoY cost inflation
    'stable',
    'adequate',
    'adequate',
    5.5,         -- +5.5% YoY wage inflation
    FALSE,
    45,          -- 45-day avg material lead times
    'moderate',
    'low',
    TRUE,        -- exposed to tariffs (steel, aluminum)
    2.5,         -- 2.5% contractor failure rate
    'readily_available',
    12.0,        -- historical avg 12% cost overrun in Atlanta
    30,          -- historical avg 30-day schedule delay
    58.0         -- Base execution risk score: 58 (moderate-high)
  );

  -- ============================================================================
  -- EXECUTION RISK: Construction Cost Tracking (12 months)
  -- ============================================================================

  INSERT INTO construction_cost_tracking (
    trade_area_id,
    period_month,
    labor_cost_index,
    material_cost_index,
    equipment_cost_index,
    overall_cost_index,
    concrete_price_per_cy,
    steel_price_per_ton,
    lumber_price_per_mbf,
    avg_permit_approval_days,
    avg_material_lead_days
  )
  SELECT
    v_atlanta_ta_id,
    date_trunc('month', NOW() - interval '1 month' * generate_series(0, 11)),
    105.0 + (generate_series(0, 11) * 0.8),  -- labor cost rising ~0.8/month
    108.0 + (generate_series(0, 11) * 1.2),  -- material cost rising ~1.2/month
    102.0 + (generate_series(0, 11) * 0.3),  -- equipment cost rising slowly
    106.0 + (generate_series(0, 11) * 0.9),  -- overall cost rising ~0.9/month
    185.00 + (generate_series(0, 11) * 2.5), -- concrete $185-212/cy
    950.00 + (generate_series(0, 11) * 15),  -- steel $950-1115/ton
    650.00 + (generate_series(0, 11) * 8),   -- lumber $650-738/mbf
    35 + (generate_series(0, 11) % 3),       -- permit approval 35-37 days
    42 + (generate_series(0, 11) % 5);       -- material lead 42-46 days

  -- ============================================================================
  -- CLIMATE RISK: Atlanta Metro Climate Assessment
  -- ============================================================================

  INSERT INTO climate_risk_assessments (
    trade_area_id,
    address,
    location,
    fema_flood_zone,
    fema_zone_description,
    base_flood_elevation,
    property_elevation,
    elevation_buffer,
    flood_risk_level,
    flood_event_count_10yr,
    last_flood_event_date,
    wildfire_hazard_zone,
    wui_classification,
    distance_to_fire_perimeter_miles,
    wildfire_risk_level,
    hurricane_zone,
    wind_design_speed,
    storm_surge_risk_level,
    seismic_zone,
    earthquake_risk_level,
    current_distance_to_coast_miles,
    sea_level_rise_30yr_feet,
    slr_impact_level,
    extreme_heat_days_avg,
    extreme_cold_days_avg,
    temperature_trend,
    insurance_availability,
    insurance_carrier_withdrawals,
    insurance_premium_trend,
    estimated_annual_premium,
    climate_projection_summary,
    base_climate_risk_score,
    assessment_date
  ) VALUES
  (
    v_atlanta_ta_id,
    'Midtown Atlanta, GA',
    ST_SetSRID(ST_MakePoint(-84.3880, 33.7830), 4326)::geography,
    'X',                -- Zone X = minimal flood risk
    'Areas determined to be outside the 0.2% annual chance floodplain',
    1050.0,             -- Base flood elevation (not applicable for Zone X, informational)
    1075.0,             -- Property elevation
    25.0,               -- Well above flood zone
    'low',
    0,                  -- No flood events in 10 years
    NULL,
    'Low',              -- Low wildfire hazard (urban area)
    'Non-WUI',
    125.0,              -- 125 miles from nearest major fire perimeter
    'minimal',
    1,                  -- Hurricane zone 1 (minimal risk, far inland)
    90,                 -- 90 mph wind design speed
    'minimal',
    '0',                -- Seismic zone 0 (very low earthquake risk)
    'minimal',
    230.0,              -- 230 miles from coast
    0.0,                -- No sea level rise impact (inland)
    'none',
    18,                 -- Avg 18 days >95°F per year
    3,                  -- Avg 3 days <20°F per year
    'increasing',       -- Extreme heat days increasing
    'readily_available',
    FALSE,
    'stable',
    15000.00,           -- $15k annual premium (standard)
    'Atlanta faces minimal flood and wildfire risk. Primary climate concern is increasing extreme heat days (projected +8-10 days by 2055). No significant sea level rise impact. Insurance market stable.',
    35.0,               -- Base climate risk score: 35 (low)
    '2025-01-15'
  ),
  (
    v_atlanta_ta_id,
    'Chattahoochee River Area, Atlanta',
    ST_SetSRID(ST_MakePoint(-84.4200, 33.8550), 4326)::geography,
    'AE',               -- Zone AE = 1% annual flood risk
    'Areas subject to inundation by the 1% annual chance flood event',
    970.0,              -- Base flood elevation
    972.0,              -- Property elevation
    2.0,                -- Only 2 feet above BFE (moderate risk)
    'moderate',
    2,                  -- 2 flood events in 10 years
    '2021-09-15',
    'Low',
    150.0,
    'minimal',
    1,
    90,
    'minimal',
    '0',
    'minimal',
    225.0,
    0.0,
    'none',
    18,
    3,
    'increasing',
    'limited',          -- Flood zone AE = some carriers withdrawing
    FALSE,
    'increasing_moderate',
    42000.00,           -- $42k annual premium (flood zone premium)
    'Property in FEMA Zone AE with minimal elevation buffer. Moderate flood risk, especially during extreme precipitation events. Recommend flood insurance and consider elevation improvements.',
    55.0,               -- Base climate risk score: 55 (moderate)
    '2025-01-15'
  );

  -- ============================================================================
  -- CLIMATE RISK: Historical Natural Disaster Events
  -- ============================================================================

  INSERT INTO natural_disaster_events (
    trade_area_id,
    event_type,
    event_name,
    event_date,
    location,
    affected_radius_miles,
    severity,
    category_rating,
    estimated_damage_usd,
    properties_affected,
    properties_destroyed,
    description,
    source
  ) VALUES
  (
    v_atlanta_ta_id,
    'tornado',
    'Atlanta Tornado Outbreak',
    '2008-03-14',
    ST_SetSRID(ST_MakePoint(-84.3880, 33.7630), 4326)::geography,
    5.0,
    'major',
    'EF2',
    250000000.00,  -- $250M damage
    1200,
    42,
    'EF2 tornado struck downtown Atlanta during SEC Basketball Tournament, causing extensive damage to Georgia Dome, CNN Center, and surrounding buildings.',
    'NOAA'
  ),
  (
    v_atlanta_ta_id,
    'flood',
    'Atlanta Flood 2009',
    '2009-09-21',
    ST_SetSRID(ST_MakePoint(-84.3880, 33.7830), 4326)::geography,
    15.0,
    'major',
    '500-year flood',
    500000000.00,  -- $500M damage
    2500,
    78,
    'Historic flooding from 20+ inches of rain in 48 hours. Chattahoochee River crested 10 feet above flood stage, inundating low-lying areas.',
    'FEMA'
  ),
  (
    v_atlanta_ta_id,
    'extreme_heat',
    'Atlanta Heat Wave 2023',
    '2023-08-15',
    ST_SetSRID(ST_MakePoint(-84.3880, 33.7830), 4326)::geography,
    50.0,
    'moderate',
    'Heat Index 115°F',
    5000000.00,    -- $5M damage (mostly HVAC failures, power grid stress)
    8500,
    0,
    '12-day heat wave with heat index exceeding 110°F. Widespread HVAC failures, power outages, and heat-related illnesses.',
    'NOAA'
  );

END $$;
