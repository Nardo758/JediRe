-- Add DEFAULT 'existing' to project_type column on deals table
-- The column already exists; this just ensures new rows get a sensible default.
ALTER TABLE deals ALTER COLUMN project_type SET DEFAULT 'existing';
