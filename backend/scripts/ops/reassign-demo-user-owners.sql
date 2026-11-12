-- DO NOT RUN until the owner approves the rows from
-- backend/scripts/ops/list-demo-user-owners.sql.
--
-- This file is not executed by the application, by CI, or by this change.
-- It reassigns literal 'demo-user' ownership to the deal creator
-- (deals.user_id) only when that creator is present and is not demo-user.
-- Rows with no deal creator, deals whose creator is demo-user, and
-- user_module_settings are left unchanged.
--
-- Review the list script output first. Then run this file manually, in a
-- transaction, and confirm the row counts before committing.

BEGIN;

UPDATE deal_capsules dc
SET user_id = d.user_id
FROM deals d
WHERE dc.user_id = 'demo-user'
  AND dc.deal_data->>'deal_id' = d.id::text
  AND d.user_id IS NOT NULL
  AND d.user_id <> 'demo-user';

UPDATE capsule_activity ca
SET user_id = d.user_id
FROM deal_capsules dc
JOIN deals d ON d.id::text = dc.deal_data->>'deal_id'
WHERE ca.user_id = 'demo-user'
  AND ca.capsule_id = dc.id
  AND d.user_id IS NOT NULL
  AND d.user_id <> 'demo-user';

UPDATE proforma_assumptions pa
SET user_id = d.user_id
FROM deals d
WHERE pa.user_id = 'demo-user'
  AND pa.deal_id = d.id
  AND d.user_id IS NOT NULL
  AND d.user_id <> 'demo-user';

UPDATE agent_runs ar
SET user_id = d.user_id
FROM deals d
WHERE ar.user_id = 'demo-user'
  AND ar.deal_id = d.id
  AND d.user_id IS NOT NULL
  AND d.user_id <> 'demo-user';

UPDATE strategy_overrides so
SET created_by = d.user_id
FROM deals d
WHERE so.created_by = 'demo-user'
  AND so.deal_id = d.id
  AND d.user_id IS NOT NULL
  AND d.user_id <> 'demo-user';

UPDATE deal_capex_items ci
SET created_by = d.user_id
FROM deals d
WHERE ci.created_by = 'demo-user'
  AND ci.deal_id = d.id
  AND d.user_id IS NOT NULL
  AND d.user_id <> 'demo-user';

UPDATE deal_capex_items ci
SET updated_by = d.user_id
FROM deals d
WHERE ci.updated_by = 'demo-user'
  AND ci.deal_id = d.id
  AND d.user_id IS NOT NULL
  AND d.user_id <> 'demo-user';

-- user_module_settings has no deal. Not updated.
-- deals.user_id = 'demo-user' has no other creator. Not updated.

-- Stop here and inspect. Commit only after the list is approved.
-- COMMIT;
ROLLBACK;
