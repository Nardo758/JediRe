-- Migration: add regulatory_constraints column to property_descriptions
-- Date: 2026-06-08
-- Adds the M02 Zoning Module output column.
-- One JSONB column stores the full RegulatoryConstraints object (all fields
-- are LayeredValue<T> wrappers preserving source provenance).
--
-- Reversible: DROP COLUMN + DROP INDEX below.

ALTER TABLE property_descriptions
  ADD COLUMN IF NOT EXISTS regulatory_constraints jsonb;

-- B-tree index on jurisdiction text value (for jurisdiction-based queries,
-- e.g. "all properties in City of Atlanta").
-- NOTE: PostgreSQL GIN cannot index a text sub-expression (->>'value');
-- a functional B-tree is the correct index type for scalar equality lookups.
CREATE INDEX IF NOT EXISTS idx_pd_regulatory_jurisdiction
  ON property_descriptions ((regulatory_constraints -> 'jurisdiction' ->> 'value'));

-- B-tree index on zone_code for zone-based queries
-- (e.g. "all MR-2 parcels in the database").
CREATE INDEX IF NOT EXISTS idx_pd_regulatory_zone_code
  ON property_descriptions ((regulatory_constraints -> 'zone_code' ->> 'value'));

COMMENT ON COLUMN property_descriptions.regulatory_constraints IS
  'M02 RegulatoryConstraints object. All sub-fields are LayeredValue<T> wrappers '
  '(value + source + runAt). Top-level fields resolved_at (ISO timestamp) and '
  'source_chain (string[]) are bare metadata. Source tag pattern: '
  '"municipal:m02_<jurisdiction>" (e.g. "municipal:m02_atlanta_city").';

-- ── Rollback ─────────────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS idx_pd_regulatory_zone_code;
-- DROP INDEX IF EXISTS idx_pd_regulatory_jurisdiction;
-- ALTER TABLE property_descriptions DROP COLUMN IF EXISTS regulatory_constraints;
