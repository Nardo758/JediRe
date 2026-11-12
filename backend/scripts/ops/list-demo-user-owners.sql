-- SELECT ONLY. This file has no INSERT, UPDATE, DELETE, or DDL.
-- It is not executed by the application, by CI, or by this change.
-- Do not run backend/scripts/ops/reassign-demo-user-owners.sql from here.
--
-- Lists rows whose acting user is the literal 'demo-user', plus the deal
-- creator (deals.user_id) they would be reassigned to.
--
-- reassignment_flag:
--   reassignable          deal exists, creator is a users.id, and is not demo-user
--   missing_deal          no deals row for the stored deal id
--   missing_creator       the deal exists and deals.user_id is null
--   creator_is_demo_user  deals.user_id is the literal demo-user
--   creator_not_a_user    deals.user_id is set and does not match users.id
--   no_deal               the row is not deal-scoped (module settings)
--
-- Capsules are included when they are owned by demo-user OR when their deal
-- creator cannot receive a reassignment (missing, not a user, or demo-user).
-- Comparisons use ::text so a non-uuid value such as demo-user does not cast-fail.
--
-- Schema: the API writes deal_capsules.user_id and stores the deal id in
-- deal_data->>'deal_id'. Skip a statement if that column is absent. Do not
-- alter the table to make the statement run.

-- Capsules owned by demo-user, or whose deal creator cannot be the reassignment target.
SELECT
  'deal_capsules' AS source_table,
  dc.id AS row_id,
  dc.deal_data->>'deal_id' AS deal_id,
  d.user_id::text AS deal_creator_id,
  (u.id IS NOT NULL) AS creator_user_exists,
  dc.user_id::text AS current_owner,
  CASE
    WHEN d.id IS NULL THEN 'missing_deal'
    WHEN d.user_id IS NULL THEN 'missing_creator'
    WHEN d.user_id::text = 'demo-user' THEN 'creator_is_demo_user'
    WHEN u.id IS NULL THEN 'creator_not_a_user'
    ELSE 'reassignable'
  END AS reassignment_flag
FROM deal_capsules dc
LEFT JOIN deals d ON d.id::text = dc.deal_data->>'deal_id'
LEFT JOIN users u ON u.id::text = d.user_id::text
WHERE dc.user_id::text = 'demo-user'
   OR d.id IS NULL
   OR d.user_id IS NULL
   OR d.user_id::text = 'demo-user'
   OR (d.user_id IS NOT NULL AND u.id IS NULL)
ORDER BY reassignment_flag, dc.created_at NULLS LAST, dc.id;

-- Capsule activity written as demo-user.
SELECT
  'capsule_activity' AS source_table,
  ca.id AS row_id,
  dc.deal_data->>'deal_id' AS deal_id,
  d.user_id::text AS deal_creator_id,
  (u.id IS NOT NULL) AS creator_user_exists,
  ca.user_id::text AS current_owner,
  CASE
    WHEN d.id IS NULL THEN 'missing_deal'
    WHEN d.user_id IS NULL THEN 'missing_creator'
    WHEN d.user_id::text = 'demo-user' THEN 'creator_is_demo_user'
    WHEN u.id IS NULL THEN 'creator_not_a_user'
    ELSE 'reassignable'
  END AS reassignment_flag
FROM capsule_activity ca
LEFT JOIN deal_capsules dc ON dc.id = ca.capsule_id
LEFT JOIN deals d ON d.id::text = dc.deal_data->>'deal_id'
LEFT JOIN users u ON u.id::text = d.user_id::text
WHERE ca.user_id::text = 'demo-user'
ORDER BY reassignment_flag, ca.created_at NULLS LAST, ca.id;

-- Proforma rows initialized as demo-user.
SELECT
  'proforma_assumptions' AS source_table,
  pa.id AS row_id,
  pa.deal_id::text AS deal_id,
  d.user_id::text AS deal_creator_id,
  (u.id IS NOT NULL) AS creator_user_exists,
  pa.user_id::text AS current_owner,
  CASE
    WHEN d.id IS NULL THEN 'missing_deal'
    WHEN d.user_id IS NULL THEN 'missing_creator'
    WHEN d.user_id::text = 'demo-user' THEN 'creator_is_demo_user'
    WHEN u.id IS NULL THEN 'creator_not_a_user'
    ELSE 'reassignable'
  END AS reassignment_flag
FROM proforma_assumptions pa
LEFT JOIN deals d ON d.id = pa.deal_id
LEFT JOIN users u ON u.id::text = d.user_id::text
WHERE pa.user_id::text = 'demo-user'
ORDER BY reassignment_flag, pa.created_at NULLS LAST, pa.id;

-- Agent runs stamped demo-user by the capsule bridge.
SELECT
  'agent_runs' AS source_table,
  ar.id AS row_id,
  ar.deal_id::text AS deal_id,
  d.user_id::text AS deal_creator_id,
  (u.id IS NOT NULL) AS creator_user_exists,
  ar.user_id::text AS current_owner,
  CASE
    WHEN d.id IS NULL THEN 'missing_deal'
    WHEN d.user_id IS NULL THEN 'missing_creator'
    WHEN d.user_id::text = 'demo-user' THEN 'creator_is_demo_user'
    WHEN u.id IS NULL THEN 'creator_not_a_user'
    ELSE 'reassignable'
  END AS reassignment_flag
FROM agent_runs ar
LEFT JOIN deals d ON d.id = ar.deal_id
LEFT JOIN users u ON u.id::text = d.user_id::text
WHERE ar.user_id::text = 'demo-user'
ORDER BY reassignment_flag, ar.started_at NULLS LAST, ar.id;

-- Renovation premium overrides created as demo-user.
SELECT
  'strategy_overrides' AS source_table,
  so.id AS row_id,
  so.deal_id::text AS deal_id,
  d.user_id::text AS deal_creator_id,
  (u.id IS NOT NULL) AS creator_user_exists,
  so.created_by::text AS current_owner,
  CASE
    WHEN d.id IS NULL THEN 'missing_deal'
    WHEN d.user_id IS NULL THEN 'missing_creator'
    WHEN d.user_id::text = 'demo-user' THEN 'creator_is_demo_user'
    WHEN u.id IS NULL THEN 'creator_not_a_user'
    ELSE 'reassignable'
  END AS reassignment_flag
FROM strategy_overrides so
LEFT JOIN deals d ON d.id = so.deal_id
LEFT JOIN users u ON u.id::text = d.user_id::text
WHERE so.created_by::text = 'demo-user'
ORDER BY reassignment_flag, so.created_at NULLS LAST, so.id;

-- Capex items created or last updated as demo-user.
SELECT
  'deal_capex_items' AS source_table,
  ci.id AS row_id,
  ci.deal_id::text AS deal_id,
  d.user_id::text AS deal_creator_id,
  (u.id IS NOT NULL) AS creator_user_exists,
  ci.created_by::text AS created_by,
  ci.updated_by::text AS updated_by,
  CASE
    WHEN d.id IS NULL THEN 'missing_deal'
    WHEN d.user_id IS NULL THEN 'missing_creator'
    WHEN d.user_id::text = 'demo-user' THEN 'creator_is_demo_user'
    WHEN u.id IS NULL THEN 'creator_not_a_user'
    ELSE 'reassignable'
  END AS reassignment_flag
FROM deal_capex_items ci
LEFT JOIN deals d ON d.id = ci.deal_id
LEFT JOIN users u ON u.id::text = d.user_id::text
WHERE ci.created_by::text = 'demo-user' OR ci.updated_by::text = 'demo-user'
ORDER BY reassignment_flag, ci.created_at NULLS LAST, ci.id;

-- Module settings stored under demo-user. No deal, so no creator to receive them.
SELECT
  'user_module_settings' AS source_table,
  ums.module_slug AS row_id,
  NULL::text AS deal_id,
  NULL::text AS deal_creator_id,
  FALSE AS creator_user_exists,
  ums.user_id::text AS current_owner,
  'no_deal' AS reassignment_flag
FROM user_module_settings ums
WHERE ums.user_id::text = 'demo-user'
ORDER BY ums.module_slug;

-- Deals whose own creator is demo-user. There is no other creator.
SELECT
  'deals' AS source_table,
  d.id AS row_id,
  d.id::text AS deal_id,
  d.user_id::text AS deal_creator_id,
  (u.id IS NOT NULL) AS creator_user_exists,
  d.user_id::text AS current_owner,
  'creator_is_demo_user' AS reassignment_flag
FROM deals d
LEFT JOIN users u ON u.id::text = d.user_id::text
WHERE d.user_id::text = 'demo-user'
ORDER BY d.created_at NULLS LAST, d.id;
