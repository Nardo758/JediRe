-- §4.5 Highlands Audit — Run in Replit: psql "$DATABASE_URL" -f highlands_audit.sql

-- 1. Find Highlands deal
SELECT id, name, status, actuals_through_month, acquisition_date, 
       deal_data->'extraction_t12'->>'period_end' as t12_period_end
FROM deals 
WHERE name ILIKE '%highlands%' OR name ILIKE '%sweetwater%'
LIMIT 5;

-- 2. Periodic_seed zone distribution (if exists)
SELECT 
  CASE WHEN periodic_seed IS NULL THEN 'NO' ELSE 'YES' END as has_periodic_seed,
  jsonb_array_length(periodic_seed->'fields'->'gpr'->'periods') as total_periods,
  (
    SELECT count(*) FROM jsonb_array_elements(periodic_seed->'fields'->'gpr'->'periods') 
    WHERE value->>'zone' = 'actual'
  ) as actual_count,
  (
    SELECT count(*) FROM jsonb_array_elements(periodic_seed->'fields'->'gpr'->'periods') 
    WHERE value->>'zone' = 'gap'
  ) as gap_count,
  (
    SELECT count(*) FROM jsonb_array_elements(periodic_seed->'fields'->'gpr'->'periods') 
    WHERE value->>'zone' = 'projection'
  ) as projection_count,
  periodic_seed->'boundary'->>'actuals_through_month' as boundary_actuals_through,
  periodic_seed->'boundary'->>'acquisition_date' as boundary_acquisition,
  periodic_seed->'boundary'->>'gap_start_month' as boundary_gap_start,
  periodic_seed->'boundary'->>'gap_end_month' as boundary_gap_end
FROM deal_assumptions 
WHERE deal_id = (
  SELECT id FROM deals WHERE name ILIKE '%highlands%' OR name ILIKE '%sweetwater%' LIMIT 1
);

-- 3. deal_monthly_actuals span
SELECT 
  MIN(report_month) as min_month,
  MAX(report_month) as max_month,
  COUNT(*) as total_rows
FROM deal_monthly_actuals
WHERE deal_id = (
  SELECT id FROM deals WHERE name ILIKE '%highlands%' OR name ILIKE '%sweetwater%' LIMIT 1
);

-- 4. Portfolio asset rows for same property
SELECT COUNT(*) as portfolio_rows
FROM deal_monthly_actuals
WHERE is_portfolio_asset = TRUE
  AND property_id = (
    SELECT property_id FROM deal_monthly_actuals 
    WHERE deal_id = (SELECT id FROM deals WHERE name ILIKE '%highlands%' OR name ILIKE '%sweetwater%' LIMIT 1)
    LIMIT 1
  );
