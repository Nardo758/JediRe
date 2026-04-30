-- Migration: 20260430_016_deal_files.sql
-- Adds deal_files table for 3D scene storage, design targets, and generic deal-scoped JSON files.
-- Supports UPSERT pattern via composite unique constraint on (deal_id, file_path),
-- enabling save/load/overwrite of 3D scenes and scenario variants.

CREATE TABLE IF NOT EXISTS deal_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  mime_type TEXT NOT NULL DEFAULT 'application/json',
  created_by TEXT NOT NULL DEFAULT 'system',
  updated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (deal_id, file_path)
);

-- Index for listing all files for a deal
CREATE INDEX IF NOT EXISTS idx_deal_files_deal_id ON deal_files(deal_id);
-- Index for finding files by path pattern (e.g., scenarios/%)
CREATE INDEX IF NOT EXISTS idx_deal_files_path ON deal_files(file_path);

COMMENT ON TABLE deal_files IS 'Deal-scoped JSON file storage (3D scenes, design targets, etc.)';
COMMENT ON COLUMN deal_files.file_path IS 'Relative path within deal, e.g. "3d_scene.json" or "scenarios/abc123/3d_scene.json"';
COMMENT ON COLUMN deal_files.file_data IS 'JSON payload (scene graph, targets, etc.)';
COMMENT ON COLUMN deal_files.mime_type IS 'Media type of the stored data';
