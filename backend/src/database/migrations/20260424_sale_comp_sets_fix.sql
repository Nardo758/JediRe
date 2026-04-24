-- Fix sale_comp_sets: add columns that generateCompSet() expects
ALTER TABLE sale_comp_sets
  ADD COLUMN IF NOT EXISTS comp_type           text DEFAULT 'sale',
  ADD COLUMN IF NOT EXISTS selection_criteria  jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS avg_price_per_unit  numeric(12,2),
  ADD COLUMN IF NOT EXISTS min_price_per_unit  numeric(12,2),
  ADD COLUMN IF NOT EXISTS max_price_per_unit  numeric(12,2),
  ADD COLUMN IF NOT EXISTS std_dev_price_per_unit numeric(12,2),
  ADD COLUMN IF NOT EXISTS median_price_per_sf numeric(10,2),
  ADD COLUMN IF NOT EXISTS median_implied_cap_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS avg_implied_cap_rate    numeric(5,2),
  ADD COLUMN IF NOT EXISTS subject_price_per_unit  numeric(12,2),
  ADD COLUMN IF NOT EXISTS subject_vs_median_pct   numeric(8,4),
  ADD COLUMN IF NOT EXISTS subject_percentile      integer;

-- Fix sale_comp_set_members: support market_sale_comps (no FK to recorded_transactions)
ALTER TABLE sale_comp_set_members
  ADD COLUMN IF NOT EXISTS market_comp_id uuid REFERENCES market_sale_comps(id) ON DELETE CASCADE;

-- Make transaction_id nullable (was implicitly required by INSERT) — it was never NOT NULL
-- but add market_comp_id as the Georgia-side identifier
CREATE INDEX IF NOT EXISTS idx_comp_members_market ON sale_comp_set_members(market_comp_id)
  WHERE market_comp_id IS NOT NULL;
