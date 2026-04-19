-- Add UNIQUE constraint on market_commentary(entity_type, entity_id, tab_context)
-- Required for ON CONFLICT upsert used by Commentary Inngest function and
-- the agent-runs route done.then() handler.
--
-- Step 1: Deduplicate — keep only the most recent row per (entity_type, entity_id, tab_context).
-- This is safe because commentary rows are regenerated on demand (cache-and-replace pattern).
-- We retain the most recent generated_at to preserve the latest cached result.

DELETE FROM market_commentary
WHERE id NOT IN (
  SELECT DISTINCT ON (entity_type, entity_id, tab_context) id
  FROM market_commentary
  ORDER BY entity_type, entity_id, tab_context, generated_at DESC NULLS LAST
);

-- Step 2: Add the UNIQUE constraint (safe after deduplication above).
-- IF NOT EXISTS guard makes this idempotent on re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'market_commentary'::regclass
      AND conname = 'market_commentary_entity_tab_unique'
  ) THEN
    ALTER TABLE market_commentary
      ADD CONSTRAINT market_commentary_entity_tab_unique
      UNIQUE (entity_type, entity_id, tab_context);
  END IF;
END;
$$;
