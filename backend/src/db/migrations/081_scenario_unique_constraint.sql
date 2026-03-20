DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_deal_scenario_name'
  ) THEN
    DELETE FROM development_scenarios
    WHERE id NOT IN (
      SELECT DISTINCT ON (deal_id, name) id
      FROM development_scenarios
      ORDER BY deal_id, name, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    );

    ALTER TABLE development_scenarios
      ADD CONSTRAINT uq_deal_scenario_name UNIQUE (deal_id, name);
  END IF;
END $$;
