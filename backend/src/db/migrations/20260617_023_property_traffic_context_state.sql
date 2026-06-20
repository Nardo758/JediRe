-- Migration: Add state column to property_traffic_context
 -- Lower #6 — Enables same-state ADT station preference in traffic linking.

 ALTER TABLE IF EXISTS property_traffic_context
   ADD COLUMN IF NOT EXISTS state VARCHAR(2);

 CREATE INDEX IF NOT EXISTS idx_property_traffic_context_state
   ON property_traffic_context(state);
