-- Migration: archive_deals_table
-- Date: 2026-04-27
-- Description: Create archive_deals table for backtest benchmarking

CREATE TABLE IF NOT EXISTS archive_deals (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_name        TEXT        NOT NULL,
  deal_type        TEXT,              -- stabilized, value-add, lease-up, development
  asset_class      TEXT,              -- A, B, C, D
  submarket        TEXT,
  units            INTEGER,
  acquisition_date TIMESTAMPTZ,
  disposition_date TIMESTAMPTZ,
  projected_irr    NUMERIC(6,4),     -- e.g. 0.1523 = 15.23%
  actual_irr       NUMERIC(6,4),
  projected_exit_cap NUMERIC(6,4),
  actual_exit_cap    NUMERIC(6,4),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_archive_deals_asset_submarket
  ON archive_deals (asset_class, submarket);

CREATE INDEX IF NOT EXISTS idx_archive_deals_acquisition
  ON archive_deals (acquisition_date DESC);
