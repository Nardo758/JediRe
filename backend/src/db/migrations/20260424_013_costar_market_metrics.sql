-- Migration: costar_market_metrics
-- Purpose: Store CoStar-sourced (or CoStar-equivalent) submarket metrics used
--          as the PRIMARY rent/occupancy/cap-rate source in snapshot-capture.service.ts.
--          When this table has a row for a geography_id within 45 days, it takes
--          precedence over apartment_locator_properties fallback data.

CREATE TABLE IF NOT EXISTS costar_market_metrics (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  geography_type           text        NOT NULL,
  geography_id             text        NOT NULL,
  geography_name           text,
  as_of_date               date        NOT NULL,
  avg_asking_rent          numeric(10,2),
  avg_effective_rent       numeric(10,2),
  avg_occupancy_pct        numeric(5,4),
  vacancy_rate             numeric(5,4),
  net_absorption_units     integer,
  avg_cap_rate             numeric(6,4),
  avg_price_per_unit       numeric(12,2),
  units_under_construction integer,
  new_supply_trailing_12mo integer,
  source                   text        NOT NULL DEFAULT 'costar',
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  UNIQUE (geography_type, geography_id, as_of_date)
);

CREATE INDEX IF NOT EXISTS idx_costar_market_metrics_geo_date
  ON costar_market_metrics (geography_id, as_of_date DESC);

CREATE INDEX IF NOT EXISTS idx_costar_market_metrics_type_date
  ON costar_market_metrics (geography_type, as_of_date DESC);

COMMENT ON TABLE costar_market_metrics IS
  'Submarket-level market metrics sourced from CoStar (or equivalent). '
  'Primary rent/occupancy source for monthly snapshot capture. '
  'Falls back to apartment_locator_properties when no recent row exists.';
