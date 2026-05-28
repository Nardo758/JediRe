-- Task #1407 Wave B: CoStar comp upload + parser
--
-- 1. Add data_as_of provenance column to market_sale_comps and market_rent_comps
--    data_as_of = the date the CoStar export was generated (operator-supplied),
--    distinct from ingested_at (= created_at = server time of insert).
--
-- 2. Create costar_submarket_stats for submarket performance exports —
--    the third CoStar export type (sale comps | rent comps | submarket performance).

-- market_sale_comps: add data_as_of
ALTER TABLE market_sale_comps
  ADD COLUMN IF NOT EXISTS data_as_of date;

-- market_rent_comps: add data_as_of
ALTER TABLE market_rent_comps
  ADD COLUMN IF NOT EXISTS data_as_of date;

-- costar_submarket_stats — holds submarket performance snapshots from CoStar exports.
-- Rows are scoped to the uploading deal (deal_id) to avoid cross-deal data bleed.
-- Unique key: (deal_id, submarket, state, period_date) — allows multiple periods
-- per submarket but prevents exact-duplicate re-uploads.
CREATE TABLE IF NOT EXISTS costar_submarket_stats (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id                 uuid        REFERENCES deals(id) ON DELETE CASCADE,
  submarket               varchar(255),
  city                    varchar(100),
  state                   varchar(2),
  msa                     varchar(255),
  period_date             date        NOT NULL,
  vacancy_rate            numeric(6,2),
  asking_rent_per_unit    numeric(10,2),
  effective_rent_per_unit numeric(10,2),
  yoy_rent_growth         numeric(6,2),
  absorption_units        integer,
  net_deliveries_units    integer,
  total_inventory_units   integer,
  under_construction_units integer,
  occupancy_pct           numeric(6,2),
  concession_pct          numeric(6,2),
  source                  varchar(50)  DEFAULT 'costar_upload',
  file_id                 integer,
  data_as_of              date,
  ingested_at             timestamptz  DEFAULT NOW(),
  UNIQUE (deal_id, submarket, state, period_date)
);

CREATE INDEX IF NOT EXISTS idx_costar_submarket_stats_deal_id
  ON costar_submarket_stats(deal_id);

CREATE INDEX IF NOT EXISTS idx_costar_submarket_stats_period
  ON costar_submarket_stats(submarket, period_date);

COMMENT ON TABLE costar_submarket_stats IS
  'CoStar submarket performance exports — sourced from operator-uploaded CoStar CSV/Excel. '
  'Scoped per deal to prevent cross-deal data bleed. '
  'data_as_of = CoStar export date supplied by operator; '
  'ingested_at = server time of insert. '
  'Task #1407 Wave B.';
