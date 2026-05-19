-- Capsule Sharing — SUPERSEDED by 20260519_capsule_piece4_tables.sql
-- 2026-05-19
--
-- This migration was superseded. The original attempted to alter capsule_shares
-- (adding deal_id-based indexes) but the live table uses a different legacy schema.
-- All Piece 4 tables are created by 20260519_capsule_piece4_tables.sql instead,
-- using capsule_external_shares (references deal_capsules) to avoid the conflict.

BEGIN;
-- no-op: superseded by 20260519_capsule_piece4_tables.sql
COMMIT;
