-- Corrective migration for deal_roadmaps (Task #786)
--
-- Fix 1: created_by was declared NOT NULL + ON DELETE SET NULL — contradictory.
--   DROP NOT NULL so a deleted user's roadmaps are not orphaned.
--   (ON DELETE SET NULL is the correct behavior; NOT NULL was the bug.)
--
-- Fix 2: Add input_json JSONB to store the full RoadmapInput payload.
--   Downstream queries (reprocessing, re-run, audit) need the full input.

ALTER TABLE deal_roadmaps ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE deal_roadmaps ADD COLUMN IF NOT EXISTS input_json JSONB;
