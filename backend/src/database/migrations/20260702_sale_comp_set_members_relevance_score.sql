-- Task #1444: Add relevance_score and relevance_factors columns to sale_comp_set_members
-- The comp scoring service writes these values but the columns were never created,
-- causing all relevance scores to silently fail to persist.

ALTER TABLE sale_comp_set_members
  ADD COLUMN IF NOT EXISTS relevance_score   NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS relevance_factors JSONB;
