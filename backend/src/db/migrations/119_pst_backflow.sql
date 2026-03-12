-- Migration 119: PST Email Backflow (multi-user, idempotent)
-- Creates per-user "PST Import" virtual email accounts and backflows PST emails
-- into the unified emails table for each user who has PST uploads.

-- 1. Create PST Import email_account for each user with PST uploads (idempotent)
INSERT INTO email_accounts (user_id, email_address, provider, is_primary, sync_enabled)
SELECT DISTINCT du.user_id, 'pst-import@jedire.com', 'pst_import', false, false
FROM data_uploads du
WHERE du.file_type = 'pst'
  AND NOT EXISTS (
    SELECT 1 FROM email_accounts ea WHERE ea.provider = 'pst_import' AND ea.user_id = du.user_id
  );

-- 2. Backflow PST emails into emails table, scoped per user via data_uploads ownership
INSERT INTO emails (
  email_account_id, user_id, external_id, subject, from_name, from_address,
  to_addresses, body_preview, body_text, is_read, is_flagged, has_attachments,
  received_at, created_at
)
SELECT
  ea.id,
  du.user_id,
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
JOIN data_uploads du ON du.id = pei.upload_id
JOIN email_accounts ea ON ea.provider = 'pst_import' AND ea.user_id = du.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM emails e WHERE e.external_id = 'pst-' || pei.id::text
);
