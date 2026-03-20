ALTER TABLE zoning_districts ADD COLUMN IF NOT EXISTS residential_far DECIMAL(10,2);
ALTER TABLE zoning_districts ADD COLUMN IF NOT EXISTS nonresidential_far DECIMAL(10,2);
ALTER TABLE zoning_districts ADD COLUMN IF NOT EXISTS density_method VARCHAR(20) DEFAULT 'units_per_acre';
ALTER TABLE zoning_districts ADD COLUMN IF NOT EXISTS height_buffer_ft INTEGER;
ALTER TABLE zoning_districts ADD COLUMN IF NOT EXISTS height_beyond_buffer_ft INTEGER;

UPDATE zoning_districts
SET residential_far = 1.49,
    nonresidential_far = 2.50,
    density_method = 'far_derived',
    height_buffer_ft = 150,
    height_beyond_buffer_ft = 225
WHERE UPPER(zoning_code) = 'MRC-2' AND UPPER(municipality) = 'ATLANTA';

UPDATE zoning_districts
SET residential_far = 0.70,
    nonresidential_far = 1.00,
    density_method = 'far_derived',
    height_buffer_ft = 150,
    height_beyond_buffer_ft = 52
WHERE UPPER(zoning_code) = 'MRC-1' AND UPPER(municipality) = 'ATLANTA';

UPDATE zoning_districts
SET residential_far = 3.20,
    nonresidential_far = 4.00,
    density_method = 'far_derived'
WHERE UPPER(zoning_code) = 'MRC-3' AND UPPER(municipality) = 'ATLANTA';
