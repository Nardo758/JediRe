-- Seed 8 platform preset strategies into strategy_definitions
-- These are read-only presets (type='preset', user_id=NULL) visible to all users

INSERT INTO strategy_definitions (user_id, name, description, type, scope, conditions, combinator, sort_by, sort_direction, max_results, asset_classes, tags)
VALUES
-- 1. Core Stabilized
(NULL,
 'Core Stabilized',
 'Low-risk, steady-income properties in stable markets. Targets occupied assets with positive rent growth, reasonable cap rates, and growing population bases. Ideal for long-term hold with predictable cash flow.',
 'preset', 'msa',
 '[
   {"id":"preset-cs-1","metricId":"M_VACANCY","operator":"lt","value":8,"weight":30,"required":true},
   {"id":"preset-cs-2","metricId":"F_RENT_GROWTH","operator":"gt","value":2,"weight":25,"required":true},
   {"id":"preset-cs-3","metricId":"F_CAP_RATE","operator":"between","value":[4.5,7],"weight":25,"required":false},
   {"id":"preset-cs-4","metricId":"E_POPULATION_GROWTH","operator":"gt","value":0.5,"weight":20,"required":false}
 ]'::jsonb,
 'AND', 'F_CAP_RATE', 'desc', 50,
 ARRAY['multifamily'], ARRAY['core','stabilized','low-risk']),

-- 2. Value-Add Upside
(NULL,
 'Value-Add Upside',
 'Properties with below-market rents in growing areas. Targets higher cap rate assets where operational improvements or renovations can drive rent premiums. Moderate risk, higher return potential.',
 'preset', 'msa',
 '[
   {"id":"preset-va-1","metricId":"F_CAP_RATE","operator":"gt","value":5.5,"weight":25,"required":true},
   {"id":"preset-va-2","metricId":"F_RENT_TO_INCOME","operator":"lt","value":30,"weight":20,"required":false},
   {"id":"preset-va-3","metricId":"D_SEARCH_MOMENTUM","operator":"gt","value":5,"weight":25,"required":false},
   {"id":"preset-va-4","metricId":"E_POPULATION_GROWTH","operator":"gt","value":1,"weight":15,"required":false},
   {"id":"preset-va-5","metricId":"F_RENT_GROWTH","operator":"gt","value":1,"weight":15,"required":false}
 ]'::jsonb,
 'AND', 'F_CAP_RATE', 'desc', 50,
 ARRAY['multifamily','single_family'], ARRAY['value-add','upside','growth']),

-- 3. Growth Market Tracker
(NULL,
 'Growth Market Tracker',
 'Markets with strong demand signals across employment, population, and search activity. Identifies markets in expansion phase where fundamentals support rent growth and value appreciation.',
 'preset', 'msa',
 '[
   {"id":"preset-gm-1","metricId":"E_EMPLOYMENT_GROWTH","operator":"gt","value":2,"weight":30,"required":true},
   {"id":"preset-gm-2","metricId":"E_POPULATION_GROWTH","operator":"gt","value":1,"weight":25,"required":true},
   {"id":"preset-gm-3","metricId":"D_SEARCH_MOMENTUM","operator":"gt","value":10,"weight":25,"required":false},
   {"id":"preset-gm-4","metricId":"C_SURGE_INDEX","operator":"gt","value":15,"weight":20,"required":false}
 ]'::jsonb,
 'AND', 'E_EMPLOYMENT_GROWTH', 'desc', 50,
 ARRAY['multifamily','industrial'], ARRAY['growth','expansion','demand']),

-- 4. Supply Constrained
(NULL,
 'Supply Constrained',
 'Markets with limited new construction pipeline and declining permit activity. When supply is tight and demand is steady, landlords have pricing power and vacancy stays low.',
 'preset', 'msa',
 '[
   {"id":"preset-sc-1","metricId":"S_PIPELINE_TO_STOCK","operator":"lt","value":5,"weight":30,"required":true},
   {"id":"preset-sc-2","metricId":"S_PERMIT_VELOCITY","operator":"decreasing","value":null,"weight":20,"required":false},
   {"id":"preset-sc-3","metricId":"M_VACANCY","operator":"lt","value":6,"weight":25,"required":true},
   {"id":"preset-sc-4","metricId":"F_RENT_GROWTH","operator":"gt","value":3,"weight":25,"required":false}
 ]'::jsonb,
 'AND', 'F_RENT_GROWTH', 'desc', 50,
 ARRAY['multifamily'], ARRAY['supply-constrained','tight-market','pricing-power']),

-- 5. Migration Magnet
(NULL,
 'Migration Magnet',
 'Markets attracting population inflows from other regions. Net migration is the strongest leading indicator for housing demand. Combines with wage growth and home value appreciation for conviction.',
 'preset', 'msa',
 '[
   {"id":"preset-mm-1","metricId":"DEMO_NET_MIGRATION","operator":"gt","value":1,"weight":30,"required":true},
   {"id":"preset-mm-2","metricId":"E_POPULATION_GROWTH","operator":"gt","value":1.5,"weight":25,"required":true},
   {"id":"preset-mm-3","metricId":"E_WAGE_GROWTH","operator":"gt","value":3,"weight":25,"required":false},
   {"id":"preset-mm-4","metricId":"SFR_HOME_VALUE_GROWTH","operator":"gt","value":3,"weight":20,"required":false}
 ]'::jsonb,
 'AND', 'DEMO_NET_MIGRATION', 'desc', 50,
 ARRAY['multifamily','single_family'], ARRAY['migration','relocation','sunbelt']),

-- 6. Traffic Alpha
(NULL,
 'Traffic Alpha',
 'JediRE-proprietary strategy using traffic intelligence signals. Combines the Traffic Growth Index and Search Growth Index with physical and digital traffic scores to find locations where real demand is outpacing market awareness.',
 'preset', 'submarket',
 '[
   {"id":"preset-ta-1","metricId":"C_TRAFFIC_GROWTH_INDEX","operator":"gt","value":10,"weight":30,"required":true},
   {"id":"preset-ta-2","metricId":"C_SEARCH_GROWTH_INDEX","operator":"gt","value":10,"weight":25,"required":false},
   {"id":"preset-ta-3","metricId":"T_PHYSICAL_SCORE","operator":"gt","value":60,"weight":25,"required":false},
   {"id":"preset-ta-4","metricId":"D_DIGITAL_SCORE","operator":"gt","value":50,"weight":20,"required":false}
 ]'::jsonb,
 'AND', 'C_TRAFFIC_GROWTH_INDEX', 'desc', 50,
 ARRAY['multifamily','retail'], ARRAY['traffic','alpha','proprietary','jedire']),

-- 7. Cash Flow Maximizer
(NULL,
 'Cash Flow Maximizer',
 'Highest current yield opportunities. Targets markets with strong cap rates, affordable rents relative to income, low vacancy, and positive absorption. Designed for investors prioritizing immediate cash-on-cash returns.',
 'preset', 'msa',
 '[
   {"id":"preset-cf-1","metricId":"F_CAP_RATE","operator":"gt","value":6.5,"weight":30,"required":true},
   {"id":"preset-cf-2","metricId":"F_RENT_TO_INCOME","operator":"lt","value":28,"weight":20,"required":false},
   {"id":"preset-cf-3","metricId":"M_VACANCY","operator":"lt","value":5,"weight":25,"required":true},
   {"id":"preset-cf-4","metricId":"M_ABSORPTION","operator":"gt","value":0,"weight":25,"required":false}
 ]'::jsonb,
 'AND', 'F_CAP_RATE', 'desc', 50,
 ARRAY['multifamily'], ARRAY['cash-flow','yield','income']),

-- 8. Distressed Opportunity
(NULL,
 'Distressed Opportunity',
 'Turnaround plays targeting properties with upcoming debt maturities, elevated vacancy, and above-market cap rates. High risk, high reward. Best for experienced operators who can reposition distressed assets.',
 'preset', 'msa',
 '[
   {"id":"preset-do-1","metricId":"F_CAP_RATE","operator":"gt","value":7.5,"weight":25,"required":true},
   {"id":"preset-do-2","metricId":"O_DEBT_MATURITY_MO","operator":"lt","value":24,"weight":30,"required":false},
   {"id":"preset-do-3","metricId":"M_VACANCY","operator":"gt","value":8,"weight":25,"required":false},
   {"id":"preset-do-4","metricId":"F_RENT_GROWTH","operator":"lt","value":1,"weight":20,"required":false}
 ]'::jsonb,
 'AND', 'F_CAP_RATE', 'desc', 50,
 ARRAY['multifamily','office'], ARRAY['distressed','turnaround','workout','opportunistic'])

ON CONFLICT DO NOTHING;
