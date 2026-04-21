-- Migration: cloud_storage_connections
-- Date: 2026-04-20
-- Description: Cloud storage integrations for bulk deal upload

-- Cloud storage connections (Google Drive, Dropbox, etc.)
CREATE TABLE IF NOT EXISTS cloud_storage_connections (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT        NOT NULL,
  provider          TEXT        NOT NULL, -- google_drive, dropbox, sharefile, box, onedrive
  account_email     TEXT        NOT NULL,
  access_token      TEXT        NOT NULL,
  refresh_token     TEXT        NOT NULL,
  token_expires_at  TIMESTAMPTZ NOT NULL,
  root_folder_id    TEXT,
  root_folder_name  TEXT,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  last_sync_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (user_id, provider, account_email)
);

CREATE INDEX IF NOT EXISTS idx_cloud_connections_user
  ON cloud_storage_connections (user_id, is_active);

-- Cloud sync jobs
CREATE TABLE IF NOT EXISTS cloud_sync_jobs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT        NOT NULL,
  connection_id     UUID        NOT NULL REFERENCES cloud_storage_connections(id) ON DELETE CASCADE,
  folder_id         TEXT        NOT NULL,
  folder_path       TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'pending', -- pending, scanning, downloading, parsing, complete, error
  total_files       INTEGER     NOT NULL DEFAULT 0,
  processed_files   INTEGER     NOT NULL DEFAULT 0,
  success_count     INTEGER     NOT NULL DEFAULT 0,
  error_count       INTEGER     NOT NULL DEFAULT 0,
  errors            JSONB       DEFAULT '[]'::jsonb,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cloud_sync_jobs_user
  ON cloud_sync_jobs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cloud_sync_jobs_status
  ON cloud_sync_jobs (status)
  WHERE status NOT IN ('complete', 'error');
