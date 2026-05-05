-- ============================================================================
-- Migration 20260505_020 — Tax Service Foundation Tables
--
-- Creates three tables for the Tax Service (spec §10):
--
--   jurisdiction_tax_cache  — Jurisdiction-level millage and rate cache.
--                             Shared across all deals in a jurisdiction.
--   parcel_tax_cache        — Per-parcel assessed value, exemptions, etc.
--                             Populated by PropertyAppraiserFetcher (Phase 4).
--   rate_sheet_versions     — Version registry for JSON rate sheets.
--                             Supports audit trail and agent-onboarded review queue.
--
-- All DDL is idempotent: IF NOT EXISTS guards and ON CONFLICT DO NOTHING
-- make re-runs safe in all environments (dev, staging, prod).
-- ============================================================================

-- ── jurisdiction_tax_cache ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS jurisdiction_tax_cache (
  jurisdiction  TEXT        NOT NULL,
  field         TEXT        NOT NULL,
  fiscal_year   INT         NOT NULL,
  value         JSONB       NOT NULL,
  source        TEXT        NOT NULL,
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (jurisdiction, field, fiscal_year)
);

CREATE INDEX IF NOT EXISTS idx_jurisdiction_cache_expiry
  ON jurisdiction_tax_cache(expires_at);

COMMENT ON TABLE jurisdiction_tax_cache IS
  'Jurisdiction-level tax data cache (millage rates, aggregate rates). '
  'Shared across all deals in a jurisdiction. TTL = end of fiscal year. '
  'Populated by PropertyAppraiserFetcher or manual rate entry (Phase 4).';

-- ── parcel_tax_cache ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS parcel_tax_cache (
  parcel_id    TEXT        NOT NULL,
  fiscal_year  INT         NOT NULL,
  data         JSONB       NOT NULL,
  source       TEXT        NOT NULL,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (parcel_id, fiscal_year)
);

CREATE INDEX IF NOT EXISTS idx_parcel_cache_expiry
  ON parcel_tax_cache(expires_at);

COMMENT ON TABLE parcel_tax_cache IS
  'Per-parcel assessed value, exemptions, millage from property appraiser. '
  'Populated by PropertyAppraiserFetcher (Phase 4). '
  'Invalidated on tax_bill_uploaded Kafka event for the parcel.';

-- ── rate_sheet_versions ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rate_sheet_versions (
  jurisdiction  TEXT        NOT NULL,
  year          INT         NOT NULL,
  version       TEXT        NOT NULL,
  status        TEXT        NOT NULL,
  source        TEXT        NOT NULL,
  agent_run_id  UUID        REFERENCES agent_runs(id) ON DELETE SET NULL,
  content       JSONB       NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at  TIMESTAMPTZ,
  PRIMARY KEY (jurisdiction, year, version),
  CONSTRAINT rate_sheet_versions_status_check
    CHECK (status IN ('active', 'pending_review', 'deprecated')),
  CONSTRAINT rate_sheet_versions_source_check
    CHECK (source IN ('engineering', 'agent_research'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_sheet_active
  ON rate_sheet_versions(jurisdiction, year)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_rate_sheet_status
  ON rate_sheet_versions(status, jurisdiction, year);

COMMENT ON TABLE rate_sheet_versions IS
  'Version registry for JSON rate sheets. Supports audit trail and '
  'agent-onboarded sheet review queue. The active sheet per jurisdiction/year '
  'is enforced by the partial unique index idx_rate_sheet_active. '
  'agent_run_id is non-null when status = pending_review (agent drafted the sheet).';

COMMENT ON COLUMN rate_sheet_versions.status IS
  'active = in use for computation; '
  'pending_review = agent-drafted, awaiting engineering approval; '
  'deprecated = replaced by a newer version.';
