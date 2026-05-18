-- Migration: widen the save_trigger CHECK constraint to include all trigger values
-- used in code (agent_run was always written but not in the original constraint;
-- operator_override was added by Task #837).

ALTER TABLE deal_versions
  DROP CONSTRAINT IF EXISTS deal_versions_save_trigger_check;

ALTER TABLE deal_versions
  ADD CONSTRAINT deal_versions_save_trigger_check
  CHECK (save_trigger IN (
    'user_save',
    'chat_command',
    'auto_prompt',
    'agent_run',
    'operator_override'
  ));
