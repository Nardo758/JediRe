-- ============================================================================
-- OM PIPELINE SCHEMA FIXES
-- Migration: 20260426_om_pipeline_schema_fixes.sql
--
-- Fixes schema drift between:
-- 1. om-distribution.service.ts and the comp tables it writes to
-- 2. capsule-intelligence.service.ts and data_library_assets it reads from
-- ============================================================================

-- ── 1. Add file_id to comp tables (om-distribution writes these) ─────────────

ALTER TABLE market_rent_comps
  ADD COLUMN IF NOT EXISTS file_id INTEGER REFERENCES data_library_files(id) ON DELETE SET NULL;

ALTER TABLE market_sale_comps
  ADD COLUMN IF NOT EXISTS file_id INTEGER REFERENCES data_library_files(id) ON DELETE SET NULL;

-- om_replacement_cost_data (created by 20260425_om_replacement_cost_data.sql)
ALTER TABLE om_replacement_cost_data
  ADD COLUMN IF NOT EXISTS file_id INTEGER REFERENCES data_library_files(id) ON DELETE SET NULL;

-- broker_narratives (created by 20260425_om_intelligence.sql)
ALTER TABLE broker_narratives
  ADD COLUMN IF NOT EXISTS file_id INTEGER REFERENCES data_library_files(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_market_rent_comps_file ON market_rent_comps(file_id);
CREATE INDEX IF NOT EXISTS idx_market_sale_comps_file ON market_sale_comps(file_id);
CREATE INDEX IF NOT EXISTS idx_om_replacement_cost_file ON om_replacement_cost_data(file_id);
CREATE INDEX IF NOT EXISTS idx_broker_narratives_file ON broker_narratives(file_id);

-- ── 2. Add financial columns to data_library_assets (capsule-intel reads these) ─

ALTER TABLE data_library_assets
  ADD COLUMN IF NOT EXISTS cap_rate NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS gross_potential_rent NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS vacancy_rate NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS operating_expense_ratio NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS noi NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS asking_price_per_unit NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS management_fee_pct NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS property_tax_per_unit NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS insurance_per_unit NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS repairs_maintenance_per_unit NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS data_type VARCHAR(50);

-- Map existing columns to the names capsule-intel expects
-- (some tables use different names — create a view for compatibility)
DO $$
BEGIN
  -- going_in_cap_rate → cap_rate
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_library_assets' AND column_name = 'going_in_cap_rate'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_library_assets' AND column_name = 'cap_rate'
  ) THEN
    ALTER TABLE data_library_assets RENAME COLUMN going_in_cap_rate TO cap_rate;
  END IF;

  -- opex_ratio → operating_expense_ratio
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_library_assets' AND column_name = 'opex_ratio'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_library_assets' AND column_name = 'operating_expense_ratio'
  ) THEN
    ALTER TABLE data_library_assets RENAME COLUMN opex_ratio TO operating_expense_ratio;
  END IF;

  -- trailing_noi → noi (if no noi column exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_library_assets' AND column_name = 'trailing_noi'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_library_assets' AND column_name = 'noi'
  ) THEN
    ALTER TABLE data_library_assets ADD COLUMN noi NUMERIC(14,2);
    UPDATE data_library_assets SET noi = trailing_noi WHERE trailing_noi IS NOT NULL;
  END IF;
END $$;

-- ── 3. Backfill data_library_assets from om_intelligence tables if possible ──

-- Pull cap rates from om_intelligence_snapshots into data_library_assets
UPDATE data_library_assets a
SET cap_rate = o.cap_rate
FROM om_intelligence_snapshots o
WHERE o.file_id = a.file_id
  AND a.cap_rate IS NULL
  AND o.cap_rate IS NOT NULL;

-- Pull asking price per unit
UPDATE data_library_assets a
SET asking_price_per_unit = o.price_per_unit
FROM om_intelligence_snapshots o
WHERE o.file_id = a.file_id
  AND a.asking_price_per_unit IS NULL
  AND o.price_per_unit IS NOT NULL;

-- ── 4. Index for capsule intelligence queries ──────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_dla_financial ON data_library_assets(file_id)
  WHERE cap_rate IS NOT NULL OR gross_potential_rent IS NOT NULL OR operating_expense_ratio IS NOT NULL;
