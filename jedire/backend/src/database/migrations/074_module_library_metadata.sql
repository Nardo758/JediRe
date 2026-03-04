ALTER TABLE module_library_files ADD COLUMN IF NOT EXISTS property_type VARCHAR(50);
ALTER TABLE module_library_files ADD COLUMN IF NOT EXISTS address VARCHAR(255);
ALTER TABLE module_library_files ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE module_library_files ADD COLUMN IF NOT EXISTS state VARCHAR(2);
ALTER TABLE module_library_files ADD COLUMN IF NOT EXISTS zip VARCHAR(10);
ALTER TABLE module_library_files ADD COLUMN IF NOT EXISTS submarket VARCHAR(100);
ALTER TABLE module_library_files ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_library_property_type_state ON module_library_files (module_name, property_type, state);
CREATE INDEX IF NOT EXISTS idx_library_city_state ON module_library_files (city, state);
