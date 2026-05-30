-- Migration: 20260530_data_library_files_parser_status_fix
-- Fixes the parser_status CHECK constraint on data_library_files to include
-- 'running' — the intermediate status written by data-library-upload-processor.ts
-- while parsing is in progress.
--
-- Root cause: The CHECK constraint was created with only terminal statuses
-- (success, partial, failed, unparsed). The processor writes 'running' as an
-- intermediate progress signal before resolving to a terminal state, but this
-- was not reflected in the constraint. As a result, every spreadsheet parse call
-- in production silently failed at the first setParserStatus call:
--   setParserStatus(fileId, 'classifying', 'running')  →  CHECK violation
--   → catch block sets parser_status = 'failed'
--   → processDataLibraryUploadFile returns { success: false }
-- The upload processor appeared to run but never actually parsed any spreadsheet.
--
-- Fix: add 'running' to the allowed set so intermediate status updates succeed.

BEGIN;

ALTER TABLE data_library_files
  DROP CONSTRAINT IF EXISTS data_library_files_parser_status_check;

ALTER TABLE data_library_files
  ADD CONSTRAINT data_library_files_parser_status_check
    CHECK (parser_status IN ('unparsed', 'running', 'success', 'partial', 'failed'));

COMMIT;
