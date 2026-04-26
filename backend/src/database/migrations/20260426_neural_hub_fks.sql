-- Follow-up: enforce referential integrity from agent_events / agent_workflow_runs
-- to deals(id). ON DELETE SET NULL preserves the audit trail when a deal is
-- deleted but breaks dangling references for live joins.
--
-- Idempotent: each ALTER ... ADD CONSTRAINT is wrapped so re-runs do not error.

DO $$ BEGIN
  ALTER TABLE agent_events
    ADD CONSTRAINT agent_events_deal_id_fkey
    FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE agent_workflow_runs
    ADD CONSTRAINT agent_workflow_runs_deal_id_fkey
    FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
