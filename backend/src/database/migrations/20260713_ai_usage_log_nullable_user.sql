-- Allow system/background DeepSeek calls to write ai_usage_log without a
-- real user_id. Previously the NOT NULL constraint caused silent INSERT
-- failures for all cron- and event-triggered agent calls, meaning only
-- user-initiated runs were ever logged.
--
-- The FK constraint (ai_usage_log_user_id_fkey) is preserved so that rows
-- with a non-null user_id are still validated against the users table.

ALTER TABLE ai_usage_log ALTER COLUMN user_id DROP NOT NULL;
