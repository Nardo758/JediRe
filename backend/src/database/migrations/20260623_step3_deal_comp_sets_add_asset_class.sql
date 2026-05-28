-- Step 3: deal_comp_sets — add asset_class column and backfill from class / class_code
ALTER TABLE deal_comp_sets ADD COLUMN IF NOT EXISTS asset_class TEXT;

-- Backfill: prefer class_code when it holds a non-empty value, else fall back to class
UPDATE deal_comp_sets
SET asset_class = UPPER(LEFT(COALESCE(NULLIF(class_code, ''), class), 1))
WHERE asset_class IS NULL
  AND COALESCE(NULLIF(class_code, ''), class) IS NOT NULL;
