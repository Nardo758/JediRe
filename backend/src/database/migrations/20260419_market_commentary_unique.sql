-- Add UNIQUE constraint on market_commentary(entity_type, entity_id, tab_context)
-- Required for ON CONFLICT upsert used by Commentary Inngest function and
-- the agent-runs route done.then() handler.
--
-- The existing idx_commentary_lookup index is non-unique and cannot serve as
-- the conflict target for ON CONFLICT DO UPDATE. This constraint replaces the
-- lookup intent while enabling idempotent upserts.

ALTER TABLE market_commentary
  ADD CONSTRAINT market_commentary_entity_tab_unique
  UNIQUE (entity_type, entity_id, tab_context);
