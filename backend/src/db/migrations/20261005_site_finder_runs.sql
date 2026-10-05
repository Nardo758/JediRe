-- Site Finder is workspace-owned; no deal/property/assumption writes.
CREATE TABLE IF NOT EXISTS site_finder_runs (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('queued','running','complete','partial','error')),
  snapshot jsonb NOT NULL,
  lease_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_finder_runs_owner_created
  ON site_finder_runs(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS site_finder_runs_work
  ON site_finder_runs(status, updated_at) WHERE status IN ('queued','running');