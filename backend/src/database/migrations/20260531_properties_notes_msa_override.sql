-- Task 1656: Add notes + MSA name override to properties table for portfolio asset creation.
-- notes: free-text field for deal context / strategy notes on portfolio properties.
-- msa_name_override: stores manually-entered MSA name when msa_id FK is not populated.
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS notes              TEXT,
  ADD COLUMN IF NOT EXISTS msa_name_override  VARCHAR(200);
COMMENT ON COLUMN properties.notes IS 'Free-text strategy/context notes for portfolio assets';
COMMENT ON COLUMN properties.msa_name_override IS 'Manually-entered MSA name when msa_id is not linked to geographies table';
