-- Track rent-by-class aggregates over time so MSATrendsTab can show trends,
-- not just today's snapshot. Populated on each ApartmentLocatorSync run.

CREATE TABLE IF NOT EXISTS apartment_class_rent_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  city TEXT NOT NULL,
  state TEXT NOT NULL,
  asset_class CHAR(1) NOT NULL CHECK (asset_class IN ('A', 'B', 'C')),

  snapshot_date DATE NOT NULL,

  property_count INT NOT NULL DEFAULT 0,
  avg_rent NUMERIC(10, 2),
  min_rent NUMERIC(10, 2),
  max_rent NUMERIC(10, 2),

  source TEXT NOT NULL DEFAULT 'apartment_locator_ai',

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  UNIQUE (city, state, asset_class, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_acrs_city_state_date
  ON apartment_class_rent_snapshots (city, state, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_acrs_city_state_class_date
  ON apartment_class_rent_snapshots (city, state, asset_class, snapshot_date DESC);
