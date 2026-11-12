-- Daily observations, not a replacement for the existing latest-value tables.
CREATE TABLE IF NOT EXISTS apartment_locator_rent_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'apartment_locator_ai',
  source_endpoint TEXT NOT NULL CHECK (source_endpoint IN ('rent-comps', 'supply-pipeline', 'backfill')),
  alai_property_id TEXT NOT NULL,
  property_id UUID NULL,
  unit_type_key TEXT NOT NULL,
  bedrooms NUMERIC(3,1),
  bathrooms NUMERIC(3,1),
  square_feet INT,
  asking_rent NUMERIC(10,2),
  rent_per_sqft NUMERIC(8,4),
  effective_rent NUMERIC(10,2),
  concessions_text TEXT,
  units_available INT,
  total_units INT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT,
  address TEXT,
  property_name TEXT,
  snapshot_date DATE NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw JSONB,
  UNIQUE (source, alai_property_id, unit_type_key, snapshot_date)
);

COMMENT ON COLUMN apartment_locator_rent_snapshots.unit_type_key IS
  'Exact normalized beds/baths/integer sqft: b2-ba2-sf1100. Missing components use unknown; all missing gives property. No upstream floor-plan ID is available.';
CREATE INDEX IF NOT EXISTS idx_alrs_property_date
  ON apartment_locator_rent_snapshots (property_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_alrs_city_date
  ON apartment_locator_rent_snapshots (city, state, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_alrs_alai_date
  ON apartment_locator_rent_snapshots (alai_property_id, snapshot_date DESC);
-- Snapshot matching must not scan the full property inventory for each row.
CREATE INDEX IF NOT EXISTS idx_properties_apartment_locator_id_lookup
  ON properties (apartment_locator_id) WHERE apartment_locator_id IS NOT NULL;

ALTER TABLE apartment_class_rent_snapshots
  ADD COLUMN IF NOT EXISTS asset_class_basis TEXT NOT NULL DEFAULT 'year_built_proxy';
COMMENT ON COLUMN apartment_class_rent_snapshots.asset_class_basis IS
  'A/B/C are vintage proxies (2010+, 1995-2009, pre-1995), not observed asset quality classes.';

-- Preserve only the observation actually held now; do not invent earlier history.
-- Idempotent, and never replace an observation already captured by the sync.
WITH property_matches AS (
  SELECT DISTINCT ON (apartment_locator_id) apartment_locator_id, id
  FROM properties WHERE apartment_locator_id IS NOT NULL
  ORDER BY apartment_locator_id, id
)
INSERT INTO apartment_locator_rent_snapshots (
  source, source_endpoint, alai_property_id, property_id, unit_type_key,
  asking_rent, concessions_text, units_available, total_units,
  city, state, zip, address, property_name, snapshot_date, raw
)
SELECT alp.source, 'backfill', alp.external_id, p.id,
  'property', alp.avg_asking_rent, alp.concessions, alp.available_units, alp.total_units,
  alp.city, alp.state, alp.zip, alp.address, alp.property_name,
  COALESCE(alp.data_as_of::date, CURRENT_DATE), to_jsonb(alp)
FROM apartment_locator_properties alp
LEFT JOIN property_matches p ON p.apartment_locator_id = alp.external_id
WHERE alp.source = 'apartment_locator_ai' AND NULLIF(alp.external_id, '') IS NOT NULL
ON CONFLICT (source, alai_property_id, unit_type_key, snapshot_date) DO NOTHING;
