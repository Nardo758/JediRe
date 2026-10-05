-- Apply in development through the project's migration flow; Publish owns managed production schema.
CREATE TABLE IF NOT EXISTS site_finder_instructions (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  snapshot jsonb NOT NULL,
  prior jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_finder_instructions_owner
  ON site_finder_instructions(owner_id, created_at DESC);