-- Migrate source column from VARCHAR(50) to VARCHAR(255) to support longer TTS constraint strings
ALTER TABLE IF EXISTS zoning_code_interpretations
  ALTER COLUMN source TYPE VARCHAR(255);
