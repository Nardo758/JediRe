-- Migration 119: PST Email Backflow
-- Creates a "PST Import" virtual email account and copies PST-imported emails into the emails table

-- 1. Create a "PST Import" virtual email_account for the demo user
INSERT INTO email_accounts (user_id, email_address, provider, is_primary, sync_enabled)
VALUES ('6253ba3f-d40d-4597-86ab-270c8397a857', 'pst-import@jedire.com', 'pst_import', false, false)
ON CONFLICT DO NOTHING;

-- 2. Delete the 22 demo seed rows from emails table
DELETE FROM emails WHERE email_account_id = 1 AND user_id = '6253ba3f-d40d-4597-86ab-270c8397a857';

-- 3. Backflow: copy pst_email_imports into emails table
INSERT INTO emails (
  email_account_id,
  user_id,
  external_id,
  subject,
  from_name,
  from_address,
  to_addresses,
  body_preview,
  body_text,
  is_read,
  is_flagged,
  has_attachments,
  received_at,
  created_at
)
SELECT
  (SELECT id FROM email_accounts WHERE provider = 'pst_import' AND user_id = '6253ba3f-d40d-4597-86ab-270c8397a857' LIMIT 1),
  '6253ba3f-d40d-4597-86ab-270c8397a857',
  'pst-' || pei.id::text,
  pei.subject,
  CASE
    WHEN pei.sender LIKE '%<%' THEN TRIM(SPLIT_PART(pei.sender, '<', 1))
    ELSE pei.sender
  END,
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
WHERE NOT EXISTS (
  SELECT 1 FROM emails e WHERE e.external_id = 'pst-' || pei.id::text
);
