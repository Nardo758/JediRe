-- Agent Prompt Rollback Script
-- ============================================================
-- Use this script to roll back an agent's active prompt to a
-- prior version when a new prompt causes unexpected behavior.
--
-- Pattern: deactivate the current version, reactivate the prior.
-- Safe to run multiple times (idempotent via WHERE guards).
--
-- Usage:
--   1. Identify the agent_id and the version ID to restore.
--   2. Replace :AGENT_ID, :CURRENT_VERSION_ID, :ROLLBACK_VERSION_ID below.
--   3. Run in a transaction so both UPDATEs are atomic.
--
-- To see all versions for an agent:
--   SELECT id, agent_id, version, prompt_type, active, created_at
--   FROM prompt_versions
--   WHERE agent_id = '<agent_id>'
--   ORDER BY created_at DESC;

BEGIN;

-- Step 1: Deactivate the current active version(s) for this agent.
-- Between Step 1 and Step 2, no version is active — runs will use the
-- AgentRuntime generic fallback prompt (degraded quality, not halted).
-- Run both UPDATEs in the same transaction to minimize this window.
UPDATE prompt_versions
SET active = false
WHERE agent_id       = '<AGENT_ID>'         -- e.g. 'cashflow'
  AND active         = true
  AND id            != '<ROLLBACK_VERSION_ID>'; -- do not deactivate the target

-- Step 2: Activate the rollback version.
UPDATE prompt_versions
SET active = true
WHERE id = '<ROLLBACK_VERSION_ID>';          -- e.g. 'cashflow-v3-core'

-- Verify the result:
SELECT id, agent_id, version, prompt_type, active, created_at
FROM prompt_versions
WHERE agent_id = '<AGENT_ID>'
ORDER BY active DESC, created_at DESC;

COMMIT;

-- ============================================================
-- Example: roll cashflow back from v4-core to v3-core
-- ============================================================
-- BEGIN;
-- UPDATE prompt_versions SET active = false
--   WHERE agent_id = 'cashflow' AND active = true AND id != 'cashflow-v3-core';
-- UPDATE prompt_versions SET active = true WHERE id = 'cashflow-v3-core';
-- SELECT id, version, prompt_type, active FROM prompt_versions WHERE agent_id = 'cashflow' ORDER BY active DESC, created_at DESC;
-- COMMIT;
