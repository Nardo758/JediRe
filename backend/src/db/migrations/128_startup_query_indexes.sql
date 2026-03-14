-- Migration 128: Add composite indexes for slow startup queries
-- Speeds up email sync scheduler query filtering on provider + sync_enabled
-- Speeds up PST backflow startup query filtering on file_type + user_id

CREATE INDEX IF NOT EXISTS idx_user_email_accounts_sync 
ON user_email_accounts (provider, sync_enabled, last_sync_at) 
WHERE sync_enabled = true;

CREATE INDEX IF NOT EXISTS idx_uploads_file_type_user 
ON data_uploads (file_type, user_id);
