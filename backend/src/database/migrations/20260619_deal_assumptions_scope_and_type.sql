-- Add institutional-grade structural columns to deal_assumptions
-- P0-4: Two-axis visibility model (use × archetype)
-- P0-5: Lane A/B scope guard for licensed data compliance

ALTER TABLE deal_assumptions
  ADD COLUMN IF NOT EXISTS scope_id TEXT DEFAULT 'GLOBAL',
  ADD COLUMN IF NOT EXISTS asset_use_type TEXT DEFAULT 'multifamily',
  ADD COLUMN IF NOT EXISTS deal_archetype TEXT DEFAULT 'stabilized';

-- Add index on scope_id for fast Lane A/B filtering
CREATE INDEX IF NOT EXISTS idx_deal_assumptions_scope_id
  ON deal_assumptions(scope_id);

-- Add composite index for two-axis visibility queries
CREATE INDEX IF NOT EXISTS idx_deal_assumptions_use_archetype
  ON deal_assumptions(asset_use_type, deal_archetype);

COMMENT ON COLUMN deal_assumptions.scope_id IS
  'Lane A/B scope guard. GLOBAL = platform data (redistributable). user:<id> = deal-scoped user upload (NOT redistributable). Filters shared-corpus queries.';

COMMENT ON COLUMN deal_assumptions.asset_use_type IS
  'Asset use type (use axis): multifamily | retail | office | industrial | land. Drives tab variant (proforma schema, comp lens, traffic model).';

COMMENT ON COLUMN deal_assumptions.deal_archetype IS
  'Deal archetype (archetype axis): stabilized | value_add | lease_up | development | redevelopment | land_hold. Drives tab visibility and temporal model.';
