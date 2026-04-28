-- Allow 'partial' status on agent_runs so the underwriting pipeline can record
-- runs where some agents succeeded and others failed. Without this, the
-- post-pipeline UPDATE rejects with check-constraint violation, leaving the
-- pipeline_run row stuck at 'running' forever and skipping the deal_data sync
-- (which is in the same try block as the UPDATE).
--
-- Idempotent: drop-and-recreate so re-running the migration is safe.

ALTER TABLE agent_runs DROP CONSTRAINT IF EXISTS agent_runs_status_check;

ALTER TABLE agent_runs ADD CONSTRAINT agent_runs_status_check
  CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'aborted', 'budget_exceeded', 'partial'));
