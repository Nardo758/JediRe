-- Task #1265 — A2 canonical architecture: backfill deals.deal_type from
-- investment_strategy_lv for rows where the operator had saved investmentStrategy
-- BEFORE Task #1233 added the atomic deal_type write (or where deal_type is null
-- for any other reason and a strategy override exists).
--
-- Safe to re-run: only touches rows where deal_type IS NULL.
-- Does not touch rows where deal_type is already set (respects the canonical field).
--
-- Mapping mirrors investmentStrategyToDealType() in deal-assumptions.routes.ts.

UPDATE deals d
SET    deal_type = CASE da.investment_strategy_lv->>'override'
         WHEN 'Build-to-Sell'    THEN 'development'
         WHEN 'Flip'             THEN 'value_add'
         WHEN 'Rental'           THEN 'existing'
         WHEN 'Short-Term Rental'THEN 'existing'
         WHEN 'Value-Add'        THEN 'value_add'
         WHEN 'Redevelopment'    THEN 'redevelopment'
         WHEN 'Lease-Up'         THEN 'lease_up'
         WHEN 'Land Hold'        THEN 'existing'
         ELSE NULL
       END
FROM   deal_assumptions da
WHERE  d.id  = da.deal_id
  AND  d.deal_type IS NULL
  AND  da.investment_strategy_lv IS NOT NULL
  AND  da.investment_strategy_lv->>'override' IS NOT NULL
  AND  da.investment_strategy_lv->>'override' IN (
         'Build-to-Sell', 'Flip', 'Rental', 'Short-Term Rental',
         'Value-Add', 'Redevelopment', 'Lease-Up', 'Land Hold'
       );
