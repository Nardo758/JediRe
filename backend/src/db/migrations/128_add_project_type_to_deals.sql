-- Migration 128: Add project_type column to deals table
-- Adds deal type system: existing, development, redevelopment

ALTER TABLE deals ADD COLUMN IF NOT EXISTS project_type VARCHAR(50) DEFAULT 'existing';

-- Add constraint to ensure valid project types
ALTER TABLE deals ADD CONSTRAINT check_project_type
  CHECK (project_type IN ('existing', 'development', 'redevelopment'));

-- Create index for efficient filtering by deal type
CREATE INDEX IF NOT EXISTS idx_deals_project_type ON deals(project_type);

COMMENT ON COLUMN deals.project_type IS 'Deal type classification: existing acquisition, development, or redevelopment';
