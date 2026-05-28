-- Step 3b: Drop legacy class / class_code columns from deal_comp_sets
-- Safe to run after all application code has been migrated to reference asset_class.
ALTER TABLE deal_comp_sets DROP COLUMN IF EXISTS class;
ALTER TABLE deal_comp_sets DROP COLUMN IF EXISTS class_code;
