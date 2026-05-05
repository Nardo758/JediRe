-- Migration: 20260505_021 — Add valid_through to rate_sheet_versions
--
-- Adds the `valid_through` column used by the rate sheet staleness cron
-- (rateSheetStaleness.cron.ts) to detect sheets approaching expiry.
--
-- The cron queries: valid_through < NOW() + INTERVAL '30 days'
-- Engineering sets valid_through when promoting a sheet to 'active'.
-- Sheets without a valid_through are treated as perpetually valid.

ALTER TABLE rate_sheet_versions
  ADD COLUMN IF NOT EXISTS valid_through DATE NULL;

COMMENT ON COLUMN rate_sheet_versions.valid_through IS
  'Date after which this rate sheet should be re-verified by the Research Agent. '
  'NULL = no expiry set. Staleness cron flags sheets within 30 days of this date.';

CREATE INDEX IF NOT EXISTS idx_rate_sheet_valid_through
  ON rate_sheet_versions(valid_through)
  WHERE valid_through IS NOT NULL;
