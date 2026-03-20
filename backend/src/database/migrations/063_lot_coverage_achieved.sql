ALTER TABLE benchmark_projects ADD COLUMN IF NOT EXISTS lot_coverage_achieved NUMERIC;

UPDATE benchmark_projects
SET lot_coverage_achieved = ROUND(
  (building_sf::numeric / stories) / (land_acres * 43560),
  4
)
WHERE building_sf IS NOT NULL AND building_sf > 0
  AND stories IS NOT NULL AND stories > 0
  AND land_acres IS NOT NULL AND land_acres > 0
  AND lot_coverage_achieved IS NULL;
