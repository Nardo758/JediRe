-- Step 2: Rename comp_properties.class → asset_class
-- Safe column rename; no data change.
ALTER TABLE comp_properties RENAME COLUMN class TO asset_class;
