-- Phase 1: Property Plumbing Refactor — Schema Build
-- Spec: docs/architecture/property-plumbing-phase1-scope.md
-- No production reads switch here. No data deleted. No destructive operations.
-- Idempotent throughout (IF NOT EXISTS / IF EXISTS guards on every statement).

-- ============================================================
-- STEP 1: Rename existing property_sales stub
-- The 7-col stub (parcel_id, sale_year, sale_price, is_current)
-- conflicts with the target table name. Preserve its data.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'property_sales'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'property_sales_legacy'
  ) THEN
    ALTER TABLE property_sales RENAME TO property_sales_legacy;
    COMMENT ON TABLE property_sales_legacy IS
      'Pre-Phase-1 stub: parcel-level sale year/price scraped before the canonical '
      'property_sales table existed. Superseded by property_sales (Phase 1). '
      'Retained for reference; do not write new rows here.';
  END IF;
END $$;

-- ============================================================
-- STEP 2: Create property_characteristics
-- Time-varying physical state. One row per change event.
-- ============================================================

CREATE TABLE IF NOT EXISTS property_characteristics (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id           UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  effective_from        DATE NOT NULL,
  effective_to          DATE,                          -- NULL = currently active

  current_building_class TEXT,                         -- A/B/C/D; post-renovation rating
  unit_count            INTEGER,
  building_sf           NUMERIC(12, 2),
  unit_mix              JSONB,                         -- {studio:{count,sf}, 1br:{count,sf}, ...}
  condition             TEXT,
  last_renovation_year  INTEGER,
  renovation_scope      TEXT,                          -- light, moderate, heavy, gut

  source                TEXT,                          -- county, om, costar, operator, agent
  source_date           DATE,
  confidence            NUMERIC(4, 3),                 -- 0.000–1.000
  provenance            JSONB,                         -- LayeredValue per field where applicable

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prop_char_property_id
  ON property_characteristics(property_id);

CREATE INDEX IF NOT EXISTS idx_prop_char_effective
  ON property_characteristics(property_id, effective_from DESC NULLS LAST);

-- Partial index for the current (active) row per property
CREATE INDEX IF NOT EXISTS idx_prop_char_current
  ON property_characteristics(property_id)
  WHERE effective_to IS NULL;

COMMENT ON TABLE property_characteristics IS
  'Time-varying physical state of a property. One row per change event (renovation, '
  'redevelopment, re-rating). The row with effective_to IS NULL is the current state. '
  'Part of Phase 1 property plumbing refactor.';

-- ============================================================
-- STEP 3: Create property_operating_data
-- Period-specific operating metrics (TTM, monthly, point-in-time).
-- ============================================================

CREATE TABLE IF NOT EXISTS property_operating_data (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id           UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  period_type           TEXT NOT NULL CHECK (period_type IN ('ttm', 'monthly', 'point_in_time')),
  period_end            DATE NOT NULL,
  period_start          DATE,

  avg_rent_per_unit     NUMERIC(10, 2),
  asking_rent_per_unit  NUMERIC(10, 2),
  effective_rent_per_unit NUMERIC(10, 2),
  occupancy             NUMERIC(6, 4),                 -- 0.0000–1.0000
  concessions           NUMERIC(6, 4),
  gross_potential_rent  NUMERIC(14, 2),
  effective_gross_revenue NUMERIC(14, 2),
  total_opex            NUMERIC(14, 2),
  noi                   NUMERIC(14, 2),
  opex_by_line          JSONB,                         -- {insurance: X, taxes: Y, ...}

  source                TEXT NOT NULL,                 -- t12, rent_roll, costar, broker, operator, agent_derived, county
  source_date           DATE,
  confidence            NUMERIC(4, 3),

  is_owned              BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE = operator's owned-portfolio data (Tier 2)
  operator_id           UUID,                          -- FK when is_owned = TRUE

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prop_opdata_property_id
  ON property_operating_data(property_id);

CREATE INDEX IF NOT EXISTS idx_prop_opdata_period
  ON property_operating_data(property_id, period_end DESC);

CREATE INDEX IF NOT EXISTS idx_prop_opdata_source
  ON property_operating_data(source);

CREATE INDEX IF NOT EXISTS idx_prop_opdata_owned
  ON property_operating_data(property_id, is_owned)
  WHERE is_owned = TRUE;

COMMENT ON TABLE property_operating_data IS
  'Period-specific operating metrics per property. Covers TTM T12 actuals, '
  'monthly snapshots, and point-in-time comp operating data. is_owned=TRUE rows '
  'are Tier 2 (owned-portfolio) and should be redacted on external share. '
  'Part of Phase 1 property plumbing refactor.';

-- ============================================================
-- STEP 4: Create property_sales (canonical transaction table)
-- Replaces the renamed property_sales_legacy stub.
-- Also the target for market_sale_comps deprecation (Phase 5).
-- ============================================================

CREATE TABLE IF NOT EXISTS property_sales (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id           UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  sale_date             DATE,
  sale_price            NUMERIC(16, 2),
  price_per_unit        NUMERIC(12, 2),               -- stored for query speed; redundant with unit_count at sale time
  price_per_sf          NUMERIC(10, 2),

  buyer                 TEXT,
  seller                TEXT,
  buyer_operator_id     UUID,                          -- FK → operators when JEDI tracks the buyer
  seller_operator_id    UUID,                          -- FK → operators when JEDI tracks the seller

  deed_type             TEXT,
  deed_book_page        TEXT,
  financing_type        TEXT,
  loan_amount           NUMERIC(16, 2),
  loan_terms            JSONB,

  implied_cap_rate      NUMERIC(6, 4),                -- computed when NOI available
  related_operating_data_id UUID REFERENCES property_operating_data(id),

  source                TEXT NOT NULL,                 -- county_recorded, costar, operator_upload, jedi_deal_close
  source_id             TEXT,                          -- external source record ID for dedup
  source_date           DATE,
  confidence            NUMERIC(4, 3),

  is_jedi_tracked       BOOLEAN NOT NULL DEFAULT FALSE,
  qualified             BOOLEAN,                       -- comp qualification flag (migrated from market_sale_comps)

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prop_sales_property_id
  ON property_sales(property_id);

CREATE INDEX IF NOT EXISTS idx_prop_sales_date
  ON property_sales(sale_date DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_prop_sales_source
  ON property_sales(source);

CREATE INDEX IF NOT EXISTS idx_prop_sales_jedi
  ON property_sales(property_id)
  WHERE is_jedi_tracked = TRUE;

COMMENT ON TABLE property_sales IS
  'Canonical transaction history. One row per recorded sale. '
  'Source=county_recorded rows migrate from georgia_property_sales + recorded_transactions. '
  'Source=costar rows migrate from market_sale_comps. '
  'Replaces market_sale_comps, recorded_transactions as the comp inventory (Phase 5). '
  'Part of Phase 1 property plumbing refactor.';

-- ============================================================
-- STEP 5: Add deals.property_id (canonical FK — D4)
-- Nullable now; populated during Phase 2 dual-write backfill.
-- deal_properties join table and properties.deal_id unchanged
-- until Phase 3 reader migration completes.
-- ============================================================

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id);

CREATE INDEX IF NOT EXISTS idx_deals_property_id
  ON deals(property_id)
  WHERE property_id IS NOT NULL;

COMMENT ON COLUMN deals.property_id IS
  'Canonical FK to properties. Added Phase 1; populated during Phase 2 backfill. '
  'Supersedes deal_properties join table + reverse properties.deal_id once '
  'Phase 3 reader migration is complete. Many deals → one property.';

-- ============================================================
-- STEP 6: Add parcel_id_status to properties
-- Tracks identity confidence for each property record.
-- ============================================================

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS parcel_id_status TEXT
    CHECK (parcel_id_status IN ('confirmed', 'pending', 'unknown'))
    DEFAULT 'pending';

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS predecessor_property_id UUID REFERENCES properties(id);

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS is_superseded BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ;

COMMENT ON COLUMN properties.parcel_id_status IS
  'Identity confidence: confirmed = county-verified parcel ID; '
  'pending = geocode/address fallback, backfill queued; '
  'unknown = cannot resolve, operator review needed.';

COMMENT ON COLUMN properties.predecessor_property_id IS
  'For parcel split/combine events. Points to the superseded property record '
  'this one was derived from.';
