-- Task #1568: Add gross income fields to market_sale_comps for GRM / GIM activation
-- When comp data is enriched with gross_rent_annual / gross_income_annual, the
-- GRM and GIM valuation methods can produce market-anchored P25/P50/P75 indicated
-- values instead of staying in 'insufficient' status.
--
-- gross_rent_annual  — annual gross potential rent (GPR) reported at the time of sale
-- gross_income_annual — annual effective gross income (EGI) reported at the time of sale

ALTER TABLE market_sale_comps
  ADD COLUMN IF NOT EXISTS gross_rent_annual   NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS gross_income_annual NUMERIC(14,2);

COMMENT ON COLUMN market_sale_comps.gross_rent_annual
  IS 'Annual gross potential rent (GPR) at time of sale — used to compute sale GRM';

COMMENT ON COLUMN market_sale_comps.gross_income_annual
  IS 'Annual effective gross income (EGI) at time of sale — used to compute sale GIM';
