-- Migration 119: PST Email Backflow (demo seed, already executed)
-- This migration ran once to seed PST-imported emails for the demo environment.
-- For production multi-user backflow, use pst-backflow.service.ts which
-- creates per-user PST Import accounts and scopes backflow via data_uploads.user_id.

-- 1. Create "PST Import" virtual email_account for demo user (idempotent)
INSERT INTO email_accounts (user_id, email_address, provider, is_primary, sync_enabled)
SELECT '6253ba3f-d40d-4597-86ab-270c8397a857', 'pst-import@jedire.com', 'pst_import', false, false
WHERE NOT EXISTS (
  SELECT 1 FROM email_accounts WHERE provider = 'pst_import' AND user_id = '6253ba3f-d40d-4597-86ab-270c8397a857'
);

-- 2. Remove demo seed rows (identified by provider, not by literal account_id)
DELETE FROM emails
WHERE user_id = '6253ba3f-d40d-4597-86ab-270c8397a857'
  AND email_account_id IN (
    SELECT id FROM email_accounts
    WHERE provider != 'pst_import' AND user_id = '6253ba3f-d40d-4597-86ab-270c8397a857'
  )
  AND external_id IS NULL;

-- 3. Backflow: copy pst_email_imports into emails table (idempotent via external_id unique constraint)
INSERT INTO emails (
  email_account_id, user_id, external_id, subject, from_name, from_address,
  to_addresses, body_preview, body_text, is_read, is_flagged, has_attachments,
  received_at, created_at
)
SELECT
  ea.id,
  '6253ba3f-d40d-4597-86ab-270c8397a857',
  'pst-' || pei.id::text,
  pei.subject,
  CASE WHEN pei.sender LIKE '%<%' THEN TRIM(SPLIT_PART(pei.sender, '<', 1)) ELSE pei.sender END,
  CASE
    WHEN pei.sender LIKE '%<%>%' THEN TRIM(BOTH '<>' FROM SUBSTRING(pei.sender FROM '<([^>]+)>'))
    WHEN pei.sender LIKE '%@%' THEN pei.sender
    ELSE 'unknown@pst-import.local'
  END,
  pei.recipients,
  LEFT(pei.raw_body, 500),
  pei.raw_body,
  true,
  pei.has_signal,
  pei.has_attachments,
  COALESCE(pei.email_date, pei.created_at)::timestamp without time zone,
  NOW()
FROM pst_email_imports pei
CROSS JOIN (
  SELECT id FROM email_accounts WHERE provider = 'pst_import' AND user_id = '6253ba3f-d40d-4597-86ab-270c8397a857' LIMIT 1
) ea
WHERE NOT EXISTS (
  SELECT 1 FROM emails e WHERE e.external_id = 'pst-' || pei.id::text
);
