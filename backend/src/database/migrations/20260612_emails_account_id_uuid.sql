-- Fix type mismatch: emails.email_account_id was INTEGER (FK → old email_accounts table)
-- but must be UUID to match user_email_accounts.id (the active OAuth token store).
--
-- The 230 existing rows are demo/test data with no real Gmail-sourced content.
-- NULLing the legacy integer IDs is safe — zero rows in user_email_accounts means
-- no production referential integrity to preserve.

BEGIN;

-- 1. Drop old FK to legacy email_accounts table
ALTER TABLE emails DROP CONSTRAINT IF EXISTS emails_email_account_id_fkey;

-- 2. Drop NOT NULL so the UPDATE can set values to NULL
ALTER TABLE emails ALTER COLUMN email_account_id DROP NOT NULL;

-- 3. Null out legacy integer IDs (meaningless after type change)
UPDATE emails SET email_account_id = NULL WHERE email_account_id IS NOT NULL;

-- 4. Change column type from INTEGER to UUID (all-NULL now, cast is trivial)
ALTER TABLE emails
  ALTER COLUMN email_account_id TYPE UUID USING NULL;

-- 5. Add new FK to the active user_email_accounts table
ALTER TABLE emails
  ADD CONSTRAINT emails_email_account_id_fkey
  FOREIGN KEY (email_account_id) REFERENCES user_email_accounts(id) ON DELETE SET NULL;

-- 6. Rebuild the index with the correct type
DROP INDEX IF EXISTS idx_emails_account;
CREATE INDEX idx_emails_account ON emails (email_account_id);

COMMIT;
