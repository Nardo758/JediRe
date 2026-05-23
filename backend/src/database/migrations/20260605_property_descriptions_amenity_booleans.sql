-- Add individual amenity boolean LayeredValue columns to property_descriptions.
-- The existing `amenities` JSONB (string-array) column is kept for backward
-- compatibility; these new columns carry the spec-correct boolean LayeredValue
-- shape so source pills and resolution rules work properly.

ALTER TABLE property_descriptions
  ADD COLUMN IF NOT EXISTS has_pool              jsonb,  -- LayeredValue<boolean>
  ADD COLUMN IF NOT EXISTS has_fitness           jsonb,  -- LayeredValue<boolean>
  ADD COLUMN IF NOT EXISTS has_clubhouse         jsonb,  -- LayeredValue<boolean>
  ADD COLUMN IF NOT EXISTS has_concierge         jsonb,  -- LayeredValue<boolean>
  ADD COLUMN IF NOT EXISTS has_business_center   jsonb,  -- LayeredValue<boolean>
  ADD COLUMN IF NOT EXISTS has_dog_park          jsonb,  -- LayeredValue<boolean>
  ADD COLUMN IF NOT EXISTS is_master_metered     jsonb,  -- LayeredValue<boolean>
  ADD COLUMN IF NOT EXISTS is_individual_metered jsonb;  -- LayeredValue<boolean>
