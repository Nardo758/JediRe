-- Auto-extraction status tracking for deal_files
-- Created: 2026-04-22 (Task #320)
-- Adds columns so that documents uploaded via the unified files API
-- can be auto-extracted in the background and surface live status to the UI.

-- Add columns nullable first so we can backfill pre-existing rows
ALTER TABLE deal_files
  ADD COLUMN IF NOT EXISTS extraction_status TEXT,
  ADD COLUMN IF NOT EXISTS extraction_skill TEXT,
  ADD COLUMN IF NOT EXISTS extraction_result JSONB,
  ADD COLUMN IF NOT EXISTS extraction_error TEXT,
  ADD COLUMN IF NOT EXISTS extraction_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS extraction_completed_at TIMESTAMPTZ;

-- Backfill: pre-existing files were never sent through the auto-extract pipeline,
-- so mark them 'skipped' rather than leaving them perpetually 'queued' (which the
-- frontend would interpret as in-flight and poll forever).
UPDATE deal_files
   SET extraction_status = 'skipped',
       extraction_completed_at = COALESCE(extraction_completed_at, NOW())
 WHERE extraction_status IS NULL;

-- Now enforce NOT NULL + CHECK and set default for newly inserted rows
ALTER TABLE deal_files
  ALTER COLUMN extraction_status SET DEFAULT 'queued',
  ALTER COLUMN extraction_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'deal_files_extraction_status_check'
  ) THEN
    ALTER TABLE deal_files
      ADD CONSTRAINT deal_files_extraction_status_check
      CHECK (extraction_status IN ('queued', 'running', 'done', 'failed', 'skipped'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_deal_files_extraction_status
  ON deal_files(deal_id, extraction_status)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN deal_files.extraction_status IS
  'Auto-extraction lifecycle: queued -> running -> done | failed | skipped';
COMMENT ON COLUMN deal_files.extraction_skill IS
  'Skill id used for extraction (extract_document, review_contract, analyze_appraisal, parse_environmental_report)';
COMMENT ON COLUMN deal_files.extraction_result IS
  'Structured output from the extract skill (success flag, data, alerts).';
COMMENT ON COLUMN deal_files.extraction_error IS
  'Error message when extraction_status = failed.';
