-- Reverse migration for 20260605_intake_jobs.sql
-- Drops the intake_jobs table and all associated indexes.
--
-- Run this file to roll back the intake_jobs migration:
--   psql "$DATABASE_URL" -f backend/src/database/migrations/20260605_intake_jobs_down.sql

DROP INDEX IF EXISTS idx_intake_jobs_file_id;
DROP INDEX IF EXISTS idx_intake_jobs_state;
DROP INDEX IF EXISTS idx_intake_jobs_parcel;
DROP TABLE IF EXISTS intake_jobs;
