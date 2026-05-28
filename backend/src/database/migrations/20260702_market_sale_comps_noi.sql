-- Task #1445: Add NOI fields to market_sale_comps for cap rate synthesis (D-COMP-3)
-- Adds noi and noi_per_unit so the CoStar upload pipeline can persist actual income
-- data and avg_implied_cap_rate can be derived from NOI / sale_price rather than
-- relying solely on the broker-reported cap_rate column.

ALTER TABLE market_sale_comps
  ADD COLUMN IF NOT EXISTS noi         NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS noi_per_unit NUMERIC(10,2);
