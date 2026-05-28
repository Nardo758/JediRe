-- Step 1: Rename competitive_sets.comp_asset_class → asset_class
-- Safe column rename; no data change.
ALTER TABLE competitive_sets RENAME COLUMN comp_asset_class TO asset_class;
