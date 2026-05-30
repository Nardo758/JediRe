-- Migration: 20260530_historical_observations_vendor_fields
-- Piece A — Vendor Registry Foundation
--
-- Adds vendor attribution columns to historical_observations so that when
-- market data vendor observations are aggregated into the cross-vendor
-- substrate, each row carries the vendor's identity, data-as-of date, and
-- license posture.
--
-- Design note: historical_observations was originally designed as a
-- calibration substrate that aggregates many signals. These columns extend
-- it to also carry vendor attribution for multi-vendor reconciliation
-- (Piece B). Columns are nullable — existing rows (platform calibration data)
-- do not have a vendor source and remain unchanged.
--
-- vendor_source         : which market data vendor populated this row
--                         (e.g. 'costar', 'yardi_matrix'). NULL for rows
--                         derived from platform or public data sources.
--
-- vendor_data_as_of     : when the vendor generated this snapshot.
--                         Distinct from created_at (= server ingestion time).
--                         Allows freshness computation without relying on the
--                         ingestion timestamp.
--
-- vendor_license_posture: governs display/export restrictions. Values mirror
--                         VendorLicensePosture in the vendor registry:
--                           'restricted'     — vendor-branded, no re-export
--                           'platform_only'  — operator-uploaded, internal use
--                           'open'           — public domain / no restrictions
--                         NULL for non-vendor rows.

BEGIN;

ALTER TABLE historical_observations
  ADD COLUMN IF NOT EXISTS vendor_source           VARCHAR(50),
  ADD COLUMN IF NOT EXISTS vendor_data_as_of       DATE,
  ADD COLUMN IF NOT EXISTS vendor_license_posture  VARCHAR(20)
    CHECK (vendor_license_posture IN ('restricted', 'platform_only', 'open'));

-- Index to enable efficient per-vendor queries
-- (e.g. "give me all CoStar submarket observations for the last 2 years")
CREATE INDEX IF NOT EXISTS idx_hist_obs_vendor_source
  ON historical_observations (vendor_source, observation_date)
  WHERE vendor_source IS NOT NULL;

COMMENT ON COLUMN historical_observations.vendor_source IS
  'Market data vendor identity (e.g. ''costar'', ''yardi_matrix''). '
  'NULL for rows from platform calibration or public data. '
  'Piece A — Vendor Registry Foundation.';

COMMENT ON COLUMN historical_observations.vendor_data_as_of IS
  'Date the vendor generated this data snapshot. '
  'Distinct from created_at (server ingestion time). '
  'Used for freshness computation independent of ingestion lag. '
  'Piece A — Vendor Registry Foundation.';

COMMENT ON COLUMN historical_observations.vendor_license_posture IS
  'Display/export restriction level for vendor-sourced rows. '
  'Mirrors VendorLicensePosture in vendor-registry/types.ts. '
  'NULL for non-vendor rows. '
  'Piece A — Vendor Registry Foundation.';

COMMIT;
