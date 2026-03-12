-- Migration 120: Remove any legacy demo/seed emails from the emails table
-- Only keeps real emails (PST-backflowed or connected provider emails)
-- Demo emails have no external_id or have non-provider external_ids

DELETE FROM emails
WHERE external_id IS NULL
  OR (external_id NOT LIKE 'pst-%' AND external_id NOT LIKE 'msg_%' AND external_id NOT LIKE 'AAM%');
