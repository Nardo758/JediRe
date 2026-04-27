-- Migration: property_proximity_unique_property_id
-- Date: 2026-04-27
-- Description: Add a NON-PARTIAL unique index on property_proximity.property_id
--   so the UPSERT in backend/src/services/proximity/proximity.service.ts:346
--   (`ON CONFLICT (property_id) DO UPDATE ...`) has a matching unique
--   constraint to target. Without this, fetch_proximity_context fails with
--   "there is no unique or exclusion constraint matching the ON CONFLICT
--   specification" and every research-agent run loses proximity scoring.
--
--   Note: a PARTIAL unique index `WHERE property_id IS NOT NULL` does NOT
--   satisfy a bare `ON CONFLICT (property_id)` clause — Postgres requires the
--   conflict_target predicate to match the partial index predicate. We use a
--   non-partial unique index here. property_id is intended to be globally
--   unique and the column should never be NULL in practice for this table.

CREATE UNIQUE INDEX IF NOT EXISTS idx_property_proximity_property_id_unique
  ON property_proximity (property_id);
