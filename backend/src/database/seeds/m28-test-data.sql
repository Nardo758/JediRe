-- M28 Cycle Intelligence Test Data
-- Seeds sample cycle snapshots for widget testing

-- Clear existing test data
DELETE FROM m28_cycle_snapshots WHERE market_id IN ('tampa-msa', 'atlanta-msa', 'orlando-msa', 'miami-msa');
DELETE FROM m28_pattern_matches WHERE computed_date >= CURRENT_DATE - INTERVAL '7 days';
DELETE FROM m28_deal_performance_by_phase WHERE market_id IN ('tampa-msa', 'atlanta-msa', 'orlando-msa', 'miami-msa');

-- Seed cycle snapshots for 4 Florida markets
INSERT INTO m28_cycle_snapshots (
  market_id, snapshot_date, 
  lag_phase, lag_position, 
  lead_phase, lead_position, 
  divergence, confidence
) VALUES
-- Tampa: Early expansion, leading ahead (ACQUIRE signal)
('tampa-msa', CURRENT_DATE, 'expansion', 0.35, 'expansion', 0.50, 7.5, 0.82),

-- Atlanta: Mid-expansion, aligned (HOLD signal)
('atlanta-msa', CURRENT_DATE, 'expansion', 0.62, 'expansion', 0.65, 1.5, 0.85),

-- Orlando: Late expansion, lagging behind (HOLD/MONITOR signal)
('orlando-msa', CURRENT_DATE, 'expansion', 0.85, 'hypersupply', 0.15, -8.2, 0.78),

-- Miami: Hypersupply, lagging significantly (EXIT signal)
('miami-msa', CURRENT_DATE, 'hypersupply', 0.45, 'recession', 0.20, -15.8, 0.80);

-- Seed deal performance by phase for Tampa
INSERT INTO m28_deal_performance_by_phase (
  market_id, phase, 
  avg_irr, avg_em, avg_hold, deal_count,
  best_strategy, worst_strategy, strategy_performance,
  data_range
) VALUES
('tampa-msa', 'expansion', 18.1, 1.82, 5.2, 12, 'Value-Add', 'Core', 
  '{"Value-Add": {"irr": 18.1, "em": 1.82, "count": 7}, "Core+": {"irr": 14.2, "em": 1.45, "count": 3}, "BTS": {"irr": 21.5, "em": 2.1, "count": 2}}'::jsonb,
  '2018-2024'),

('tampa-msa', 'recovery', 22.5, 2.15, 4.8, 8, 'BTS', 'Core',
  '{"BTS": {"irr": 22.5, "em": 2.15, "count": 5}, "Value-Add": {"irr": 19.8, "em": 1.95, "count": 3}}'::jsonb,
  '2010-2016'),

('tampa-msa', 'recession', 12.3, 1.28, 6.5, 5, 'Core', 'BTS',
  '{"Core": {"irr": 12.3, "em": 1.28, "count": 3}, "Value-Add": {"irr": 9.5, "em": 1.15, "count": 2}}'::jsonb,
  '2008-2010'),

('tampa-msa', 'hypersupply', 8.7, 1.08, 7.2, 4, 'Core', 'Value-Add',
  '{"Core": {"irr": 8.7, "em": 1.08, "count": 4}}'::jsonb,
  '2016-2018');

-- Seed deal performance for Atlanta
INSERT INTO m28_deal_performance_by_phase (
  market_id, phase,
  avg_irr, avg_em, avg_hold, deal_count,
  best_strategy, worst_strategy, strategy_performance,
  data_range
) VALUES
('atlanta-msa', 'expansion', 16.8, 1.72, 5.5, 15, 'Core+', 'Core',
  '{"Core+": {"irr": 16.8, "em": 1.72, "count": 10}, "Value-Add": {"irr": 19.2, "em": 1.88, "count": 5}}'::jsonb,
  '2019-2024');

-- Seed pattern matches (historical analogs)
INSERT INTO m28_pattern_matches (
  computed_date, event_id, 
  similarity_pct, match_factors, diverge_factors,
  predicted_re_impact, confidence
) VALUES
(CURRENT_DATE, 'trade_war_2018', 0.82,
  ARRAY['rate_environment', 'policy_uncertainty', 'supply_constraints'],
  ARRAY['unemployment_level', 'consumer_confidence'],
  '{"mf_value_change_12mo": 6, "rent_growth_impact": 2, "cap_rate_movement": 15}'::jsonb,
  0.78),

(CURRENT_DATE, 'taper_tantrum_2013', 0.68,
  ARRAY['rate_spike', 'forward_curve', 'fed_policy'],
  ARRAY['inflation_level', 'growth_rate'],
  '{"mf_value_change_12mo": -5, "rent_growth_impact": -1, "cap_rate_movement": 75}'::jsonb,
  0.72),

(CURRENT_DATE, 'covid_2020', 0.45,
  ARRAY['supply_disruption', 'fiscal_stimulus'],
  ARRAY['unemployment', 'migration_patterns', 'office_demand'],
  '{"mf_value_change_12mo": 15, "rent_growth_impact": 8, "cap_rate_movement": -50}'::jsonb,
  0.65);

-- Success message
SELECT 'M28 test data seeded successfully!' as status,
       COUNT(DISTINCT market_id) as markets,
       COUNT(*) as cycle_snapshots
FROM m28_cycle_snapshots
WHERE market_id IN ('tampa-msa', 'atlanta-msa', 'orlando-msa', 'miami-msa');
