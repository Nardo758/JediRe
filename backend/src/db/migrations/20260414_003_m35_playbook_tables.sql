-- M35 Phase 3: Playbook Aggregation Engine tables
-- event_playbooks: aggregated response functions per subtype × stratum × metric × window
-- playbook_instances: provenance links from each playbook row to its source event_impacts

CREATE TABLE IF NOT EXISTS event_playbooks (
  id                   UUID                     NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subtype              VARCHAR(64)              NOT NULL,
  stratum_msa_tier     VARCHAR(16)              NOT NULL DEFAULT 'all',
  stratum_magnitude    VARCHAR(20)              NOT NULL DEFAULT 'all',
  stratum_regime       VARCHAR(16)              NOT NULL DEFAULT 'all',
  metric_key           VARCHAR(64)              NOT NULL,
  window_months        SMALLINT                 NOT NULL,
  median_delta         NUMERIC(18,6),
  p25                  NUMERIC(18,6),
  p75                  NUMERIC(18,6),
  mean_delta           NUMERIC(18,6),
  stddev_delta         NUMERIC(18,6),
  instance_count       SMALLINT                 NOT NULL DEFAULT 0,
  confidence           NUMERIC(4,3)             DEFAULT 0,
  status               VARCHAR(16)              NOT NULL DEFAULT 'preliminary',
  lag_structure        JSONB                    DEFAULT '{}',
  scaling_coefficients JSONB                    DEFAULT '{}',
  is_seeded            BOOLEAN                  DEFAULT FALSE,
  last_updated         TIMESTAMPTZ              DEFAULT NOW(),
  created_at           TIMESTAMPTZ              DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_playbooks_unique
  ON event_playbooks (subtype, stratum_msa_tier, stratum_magnitude, stratum_regime, metric_key, window_months);

CREATE INDEX IF NOT EXISTS idx_event_playbooks_subtype_metric_window
  ON event_playbooks (subtype, metric_key, window_months);

CREATE INDEX IF NOT EXISTS idx_event_playbooks_status
  ON event_playbooks (status);


CREATE TABLE IF NOT EXISTS playbook_instances (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playbook_id UUID        NOT NULL REFERENCES event_playbooks(id) ON DELETE CASCADE,
  event_id    UUID        NOT NULL,
  impact_id   UUID        NOT NULL,
  weight      NUMERIC(6,4) NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK constraints idempotently — safe if table already exists from an earlier run
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_playbook_instances_event_id'
      AND table_name = 'playbook_instances'
  ) THEN
    BEGIN
      ALTER TABLE playbook_instances
        ADD CONSTRAINT fk_playbook_instances_event_id
        FOREIGN KEY (event_id) REFERENCES key_events(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'fk_playbook_instances_event_id skipped: %', SQLERRM;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_playbook_instances_impact_id'
      AND table_name = 'playbook_instances'
  ) THEN
    BEGIN
      ALTER TABLE playbook_instances
        ADD CONSTRAINT fk_playbook_instances_impact_id
        FOREIGN KEY (impact_id) REFERENCES event_impacts(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'fk_playbook_instances_impact_id skipped: %', SQLERRM;
    END;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_playbook_instances_unique
  ON playbook_instances (playbook_id, impact_id);

CREATE INDEX IF NOT EXISTS idx_playbook_instances_playbook
  ON playbook_instances (playbook_id);

CREATE INDEX IF NOT EXISTS idx_playbook_instances_event
  ON playbook_instances (event_id);

-- Preflight: NULL out any duplicate source_record_id values so the unique index below
-- does not fail on legacy data.  Keeps the most-recently-created row's value and NULLs
-- all earlier duplicates.  Safe to re-run (no-op if no duplicates exist).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'key_events' AND column_name = 'source_record_id'
  ) THEN
    UPDATE key_events ke
    SET    source_record_id = NULL
    WHERE  source_record_id IS NOT NULL
      AND  ke.id NOT IN (
             SELECT DISTINCT ON (source_record_id) id
             FROM   key_events
             WHERE  source_record_id IS NOT NULL
             ORDER  BY source_record_id, created_at DESC NULLS LAST, id DESC
           );
  END IF;
END $$;

-- Allow seed function to upsert key_events idempotently by source_record_id.
-- Partial index (WHERE IS NOT NULL) matches the ON CONFLICT predicate in seedHistoricalPlaybooks().
CREATE UNIQUE INDEX IF NOT EXISTS idx_key_events_source_record_id
  ON key_events (source_record_id)
  WHERE source_record_id IS NOT NULL;
