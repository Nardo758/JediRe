-- ============================================================================
-- Migration 093: Add Backward Compatibility Columns to financial_models
-- Supports existing CRUD routes while adding Claude functionality
-- ============================================================================

-- Add missing columns for backward compatibility with existing routes
ALTER TABLE financial_models
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS name VARCHAR(255),
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS components JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS results JSONB,
ADD COLUMN IF NOT EXISTS claude_output JSONB,
ADD COLUMN IF NOT EXISTS validation JSONB;

-- Make user_id required (but allow NULL for now to not break existing data)
-- Update trigger will ensure new records have user_id from created_by
CREATE OR REPLACE FUNCTION sync_user_id_from_created_by()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.created_by IS NOT NULL THEN
    NEW.user_id = NEW.created_by;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER financial_models_sync_user_id
  BEFORE INSERT OR UPDATE ON financial_models
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_id_from_created_by();

-- Index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_financial_models_user_id ON financial_models(user_id);

-- Update any existing records to sync user_id
UPDATE financial_models SET user_id = created_by WHERE user_id IS NULL AND created_by IS NOT NULL;

COMMENT ON COLUMN financial_models.user_id IS 'User ID for backward compatibility with existing routes (synced from created_by)';
COMMENT ON COLUMN financial_models.name IS 'User-friendly name for the model';
COMMENT ON COLUMN financial_models.version IS 'Version number for backward compatibility';
COMMENT ON COLUMN financial_models.components IS 'Legacy components array for backward compatibility';
COMMENT ON COLUMN financial_models.results IS 'Computed results (for backward compatibility, same as output)';
COMMENT ON COLUMN financial_models.claude_output IS 'Claude-generated output (same as output, kept for explicit API clarity)';
COMMENT ON COLUMN financial_models.validation IS 'Validation results from model-validator service';
