ALTER TABLE benchmark_projects ADD COLUMN IF NOT EXISTS building_sf INTEGER;
ALTER TABLE benchmark_projects ADD COLUMN IF NOT EXISTS assessed_land_value INTEGER;
ALTER TABLE benchmark_projects ADD COLUMN IF NOT EXISTS assessed_improvement_value INTEGER;
ALTER TABLE benchmark_projects ADD COLUMN IF NOT EXISTS appraised_value INTEGER;
ALTER TABLE benchmark_projects ADD COLUMN IF NOT EXISTS tax_district VARCHAR(50);
ALTER TABLE benchmark_projects ADD COLUMN IF NOT EXISTS tax_value INTEGER;
ALTER TABLE benchmark_projects ADD COLUMN IF NOT EXISTS last_sale_amount INTEGER;
ALTER TABLE benchmark_projects ADD COLUMN IF NOT EXISTS last_sale_date DATE;
ALTER TABLE benchmark_projects ADD COLUMN IF NOT EXISTS density_achieved NUMERIC;
ALTER TABLE benchmark_projects ADD COLUMN IF NOT EXISTS far_achieved NUMERIC;
ALTER TABLE benchmark_projects ADD COLUMN IF NOT EXISTS enrichment_source VARCHAR(100);
ALTER TABLE benchmark_projects ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMP;

UPDATE benchmark_projects
SET density_achieved = ROUND((unit_count::numeric / land_acres), 2)
WHERE land_acres > 0 AND unit_count > 0 AND density_achieved IS NULL;
