-- Task #1391: Make transaction_id nullable on sale_comp_set_members
-- market_sale_comps rows (costar_upload, georgia_county, research_agent) use market_comp_id;
-- recorded_transactions rows use transaction_id. Both columns cannot be non-null simultaneously.
ALTER TABLE sale_comp_set_members ALTER COLUMN transaction_id DROP NOT NULL;

-- Add a CHECK to ensure exactly one of the two FK columns is non-null
ALTER TABLE sale_comp_set_members
  ADD CONSTRAINT sale_comp_set_members_exactly_one_source
  CHECK (
    (transaction_id IS NOT NULL AND market_comp_id IS NULL) OR
    (transaction_id IS NULL AND market_comp_id IS NOT NULL)
  );
