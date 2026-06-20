-- Migration: Asset Class Spread Calibration Table
 -- Lower #17 — Backtest service stores calibration reports here so operators
 -- can review empirical spreads vs assumed spreads before updating the code.

 CREATE TABLE IF NOT EXISTS asset_class_spread_calibration (
     id               SERIAL PRIMARY KEY,
     computed_at      TIMESTAMP WITH TIME ZONE NOT NULL,
     asset_class      TEXT NOT NULL,
     sample_size      INTEGER NOT NULL DEFAULT 0,
     assumed_spread_bps    NUMERIC(10, 2),
     empirical_spread_bps  NUMERIC(10, 2),
     empirical_spread_median NUMERIC(10, 2),
     bias_bps         NUMERIC(10, 2),
     t_stat           NUMERIC(10, 4),
     p_value          NUMERIC(10, 4),
     recommended_spread_bps NUMERIC(10, 2),
     recommendation   TEXT NOT NULL DEFAULT 'insufficient_data',
     confidence       TEXT NOT NULL DEFAULT 'low',
     property_list    JSONB,
     property_details JSONB,
     created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     UNIQUE (computed_at, asset_class)
 );

 CREATE INDEX IF NOT EXISTS idx_asset_class_spread_computed_at
     ON asset_class_spread_calibration(computed_at DESC);

 CREATE INDEX IF NOT EXISTS idx_asset_class_spread_asset_class
     ON asset_class_spread_calibration(asset_class);
