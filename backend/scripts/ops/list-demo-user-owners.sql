-- READ ONLY. Do not run an UPDATE from this file.
-- Lists rows whose acting user is the literal string 'demo-user', and the
-- deal creator (deals.user_id) they would be reassigned to.
--
-- This script is not executed by the application, CI, or this change.
-- Review the result before considering backend/scripts/ops/reassign-demo-user-owners.sql.
--
-- Schema note: the API writes deal_capsules.user_id and stores the deal id in
-- deal_data->>'deal_id'. An older snapshot migration defines created_by and a
-- deal_id column instead. The queries below follow the API writers
-- (capsule bridge, renovation routes, modules controller). If a column is
-- absent in this database, skip that statement rather than altering the table.

-- deal_capsules owned by demo-user
SELECT
  'deal_capsules' AS source_table,
  dc.id AS row_id,
  dc.deal_data->>'deal_id' AS deal_id,
  d.user_id AS deal_creator_id,
  dc.user_id AS current_owner
FROM deal_capsules dc
LEFT JOIN deals d ON d.id::text = dc.deal_data->>'deal_id'
WHERE dc.user_id = 'demo-user'
ORDER BY dc.created_at NULLS LAST, dc.id;

-- capsule activity written as demo-user
SELECT
  'capsule_activity' AS source_table,
  ca.id AS row_id,
  dc.deal_data->>'deal_id' AS deal_id,
  d.user_id AS deal_creator_id,
  ca.user_id AS current_owner
FROM capsule_activity ca
LEFT JOIN deal_capsules dc ON dc.id = ca.capsule_id
LEFT JOIN deals d ON d.id::text = dc.deal_data->>'deal_id'
WHERE ca.user_id = 'demo-user'
ORDER BY ca.created_at NULLS LAST, ca.id;

-- proforma rows initialized as demo-user
SELECT
  'proforma_assumptions' AS source_table,
  pa.id AS row_id,
  pa.deal_id::text AS deal_id,
  d.user_id AS deal_creator_id,
  pa.user_id AS current_owner
FROM proforma_assumptions pa
LEFT JOIN deals d ON d.id = pa.deal_id
WHERE pa.user_id = 'demo-user'
ORDER BY pa.created_at NULLS LAST, pa.id;

-- agent runs stamped with demo-user by the capsule bridge
SELECT
  'agent_runs' AS source_table,
  ar.id AS row_id,
  ar.deal_id::text AS deal_id,
  d.user_id AS deal_creator_id,
  ar.user_id AS current_owner
FROM agent_runs ar
LEFT JOIN deals d ON d.id = ar.deal_id
WHERE ar.user_id = 'demo-user'
ORDER BY ar.started_at NULLS LAST, ar.id;

-- renovation premium overrides created as demo-user
SELECT
  'strategy_overrides' AS source_table,
  so.id AS row_id,
  so.deal_id::text AS deal_id,
  d.user_id AS deal_creator_id,
  so.created_by AS current_owner
FROM strategy_overrides so
LEFT JOIN deals d ON d.id = so.deal_id
WHERE so.created_by = 'demo-user'
ORDER BY so.created_at NULLS LAST, so.id;

-- capex items created or last updated as demo-user
SELECT
  'deal_capex_items' AS source_table,
  ci.id AS row_id,
  ci.deal_id::text AS deal_id,
  d.user_id AS deal_creator_id,
  ci.created_by AS created_by,
  ci.updated_by AS updated_by
FROM deal_capex_items ci
LEFT JOIN deals d ON d.id = ci.deal_id
WHERE ci.created_by = 'demo-user' OR ci.updated_by = 'demo-user'
ORDER BY ci.created_at NULLS LAST, ci.id;

-- module settings stored under demo-user. There is no deal, so there is no
-- deal creator to reassign them to. The reassignment script leaves these rows.
SELECT
  'user_module_settings' AS source_table,
  ums.user_id AS row_id,
  ums.module_slug,
  NULL::text AS deal_id,
  NULL::text AS deal_creator_id,
  ums.user_id AS current_owner
FROM user_module_settings ums
WHERE ums.user_id = 'demo-user'
ORDER BY ums.module_slug;

-- deals whose own creator is demo-user. No other creator is known.
SELECT
  'deals' AS source_table,
  d.id AS row_id,
  d.id::text AS deal_id,
  d.user_id AS deal_creator_id,
  d.user_id AS current_owner
FROM deals d
WHERE d.user_id = 'demo-user'
ORDER BY d.created_at NULLS LAST, d.id;
