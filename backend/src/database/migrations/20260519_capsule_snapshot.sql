-- Capsule Share Snapshot — v1 Architecture
-- Adds a frozen snapshot column to capsule_external_shares.
-- At share creation the deal's active capsule state is copied here.
-- Recipient view is served entirely from this column; subsequent sender
-- changes to deal_capsules do NOT propagate to existing shares.
-- deal-book endpoint falls back to deal_capsules for shares created before
-- this migration (capsule_snapshot IS NULL).

ALTER TABLE capsule_external_shares
  ADD COLUMN IF NOT EXISTS capsule_snapshot JSONB;

COMMENT ON COLUMN capsule_external_shares.capsule_snapshot IS
  'Frozen snapshot of deal_capsules row captured at share creation. '
  'Keys: property_address, asset_class, jedi_score, collision_score, '
  'deal_data, platform_intel, user_adjustments, module_outputs, snapshot_taken_at. '
  'NULL for shares created before the snapshot migration.';
