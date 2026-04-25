-- Task #383 follow-up: page-number provenance + net rentable SF for PSF medians.
-- Strictly additive. No PK changes; no destructive ALTER.

ALTER TABLE market_rent_comps        ADD COLUMN IF NOT EXISTS source_page INTEGER;
ALTER TABLE market_sale_comps        ADD COLUMN IF NOT EXISTS source_page INTEGER;
ALTER TABLE broker_narratives        ADD COLUMN IF NOT EXISTS source_page INTEGER;
ALTER TABLE data_library_cost_data   ADD COLUMN IF NOT EXISTS source_page     INTEGER;
ALTER TABLE data_library_cost_data   ADD COLUMN IF NOT EXISTS net_rentable_sf NUMERIC;
