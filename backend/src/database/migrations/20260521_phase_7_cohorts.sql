-- Phase 7 — Cohort Rollup tables
-- cohorts: one row per unique (product_type × asset_class × market × vintage × size_range)
-- cohort_membership: maps parcel_id → cohort_id

BEGIN;

CREATE TABLE IF NOT EXISTS cohorts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type        TEXT,
  asset_class         TEXT,
  market              TEXT,
  vintage             TEXT,
  size_range          TEXT,
  member_count        INTEGER     NOT NULL DEFAULT 0,
  aggregated_metrics  JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique index using COALESCE so NULL is treated as '' for uniqueness purposes
-- (PostgreSQL considers NULL != NULL in UNIQUE constraints; this avoids duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS cohorts_key_uix ON cohorts (
  COALESCE(product_type, ''),
  COALESCE(asset_class,  ''),
  COALESCE(market,       ''),
  COALESCE(vintage,      ''),
  COALESCE(size_range,   '')
);

CREATE INDEX IF NOT EXISTS cohorts_market_idx       ON cohorts (market);
CREATE INDEX IF NOT EXISTS cohorts_asset_class_idx  ON cohorts (asset_class);
CREATE INDEX IF NOT EXISTS cohorts_product_type_idx ON cohorts (product_type);

CREATE TABLE IF NOT EXISTS cohort_membership (
  parcel_id   TEXT NOT NULL,
  cohort_id   UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  PRIMARY KEY (parcel_id, cohort_id)
);

CREATE INDEX IF NOT EXISTS cohort_membership_cohort_idx  ON cohort_membership (cohort_id);
CREATE INDEX IF NOT EXISTS cohort_membership_parcel_idx  ON cohort_membership (parcel_id);

COMMIT;
