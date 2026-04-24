-- Deduplicate apartment_supply_pipeline before adding unique index
-- Keep the row with the latest synced_at per (address, city, state)
DELETE FROM apartment_supply_pipeline
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY address, city, state
        ORDER BY synced_at DESC NULLS LAST, id DESC
      ) AS rn
    FROM apartment_supply_pipeline
    WHERE address IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Unique dedup index: apartment_supply_pipeline by (address, city, state)
CREATE UNIQUE INDEX IF NOT EXISTS idx_supply_pipeline_dedup
  ON apartment_supply_pipeline (address, city, state)
  WHERE address IS NOT NULL;

-- Unique dedup index: competitive_sets per deal per source property
CREATE UNIQUE INDEX IF NOT EXISTS idx_competitive_sets_dedup
  ON competitive_sets (deal_id, source, source_id)
  WHERE source_id IS NOT NULL;
