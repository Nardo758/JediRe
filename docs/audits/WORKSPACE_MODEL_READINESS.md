# Workspace Model Readiness Trace

**Date:** 2026-06-30  
**Mode:** READ-ONLY — no changes applied  
**HEAD SHA:** `6f2e6793d7377355629d3d6a9073a2188ef55ea7`  
**Dispatch spec:** `attached_assets/WORKSPACE_MODEL_READINESS_TRACE_1782843033667.md`  
**Evidence rule (S1-01):** every claim carries live DB output or `file:line`.

---

## FACT 1 — Membership: JOIN TABLE or flat FK?

**Join tables present:**

```sql
SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%member%' OR table_name ILIKE '%membership%';

      table_name
----------------------
 team_members
 org_members
 deal_team_members
 organization_members
 cohort_membership
```

**Flat FK on users (org_id / team_id column):**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'users' AND (column_name ILIKE '%org%' OR column_name ILIKE '%team%');

 column_name
-------------
(0 rows)
```

**Result: JOIN TABLE.** `org_members` is the live membership table. `users` has no org_id or team_id column. The membership model is structurally multi-org today — a user can belong to many orgs through `org_members` without any schema change.

Write path confirmed: `org.routes.ts:49,219` — INSERT into `org_members (org_id, user_id, role)`. Read path confirmed: `rbac.ts:86` — `WHERE om.user_id = $1 AND om.org_id = $2`.

---

## FACT 2 — org_members: columns, role, and ratio

**Columns:**

```sql
SELECT column_name, data_type, is_nullable FROM information_schema.columns
WHERE table_name = 'org_members' ORDER BY ordinal_position;

 column_name |         data_type          | is_nullable
-------------+----------------------------+-------------
 id          | uuid                       | NO
 org_id      | uuid                       | NO
 user_id     | uuid                       | NO
 role        | character varying          | NO
 invited_by  | uuid                       | YES
 joined_at   | timestamp with time zone   | YES
 updated_at  | timestamp with time zone   | YES
```

`role` column: **YES** — already present, NOT NULL.

**Ratio — live counts:**

```sql
SELECT COUNT(DISTINCT user_id) AS distinct_users,
       COUNT(DISTINCT org_id)  AS distinct_orgs,
       COUNT(*)                AS total_rows
FROM org_members;

 distinct_users | distinct_orgs | total_rows
----------------+---------------+------------
              5 |            38 |          38
```

**Per-user org count:**

```sql
SELECT user_id, COUNT(*) AS org_count FROM org_members GROUP BY user_id ORDER BY org_count DESC LIMIT 5;

               user_id                | org_count
--------------------------------------+-----------
 6253ba3f-d40d-4597-86ab-270c8397a857 |        34
 17d6a518-863c-4614-9e1a-19d031fb1754 |         1
 c20d4f65-9a66-4c66-bde6-83605c5289be |         1
 2e655939-b36b-4b32-871e-13cbb3566834 |         1
 b24c746c-a926-429b-bfaf-db065c36b550 |         1
```

**The "38 orgs / 38 members" figure is NOT 1:1.** One user (`6253ba3f`) is already a member of 34 orgs. The other 4 users each belong to 1 org. Multi-org is already in active use — not a theoretical future state.

---

## FACT 3 — org_id state on work rows

### `properties` table

```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'properties';
-- (101 columns listed — none named org_id)
```

**`properties` has NO `org_id` column.** The column does not exist. Property-level workspace scoping requires a structural column-add before any backfill or filter can be applied.

### `deals` table

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'deals' AND column_name = 'org_id';

 column_name | data_type
-------------+-----------
 org_id      | uuid
```

```sql
SELECT
  CASE WHEN org_id IS NULL THEN 'null_org' ELSE 'has_org' END AS org_state,
  COUNT(*) AS cnt
FROM deals GROUP BY org_state;

 org_state | cnt
-----------+-----
 null_org  |   6
 has_org   |  28
```

**34 total deals. 28 carry an org_id. 6 have null org_id.** Adding a `WHERE org_id = ?` filter today would hide those 6 deals. They need a backfill before workspace scoping can be enforced on deals.

**Recent deals sample (org_id state):**

```sql
SELECT id, org_id FROM deals ORDER BY created_at DESC LIMIT 5;

 id                                   | org_id
--------------------------------------+--------------------------------------
 c92b5746-...                         | (null)
 5b022af1-...                         | dd201183-3cb5-45dd-8485-d17f5a053421
 0a55f0ac-...                         | (null)
 17457eb3-...                         | (null)
 f1c6909a-...                         | (null)
```

Four of the five most recent deals have null org_id — the nulls are not just old data.

---

## FACT 4 — Does anything already SET org_id on creation?

### Deal CREATE — YES, already sets org_id

`inline-deals.routes.ts:458–470`:
```typescript
// line 458: look up the user's first org
'SELECT org_id FROM org_members WHERE user_id = $1 ORDER BY joined_at ASC LIMIT 1'
const userOrgId = orgResult.rows.length > 0 ? orgResult.rows[0].org_id : null;

// line 467–470: INSERT with org_id
INSERT INTO deals (
  user_id, name, boundary, project_type, project_intent,
  deal_category, development_type, address, description, org_id, strategy
```

Deal creation already wires `org_id`. **Why 6 null-org deals exist despite this:** the lookup at line 458 uses `LIMIT 1` and sets `org_id = null` if the user has no org membership yet. Users with no org row at creation time produce null-org deals.

### Other entity types already writing org_id at creation

| Entity | File:line | org_id at creation? |
|---|---|---|
| `deals` | `inline-deals.routes.ts:470` | YES — from first org membership |
| `deal_templates` | `deal-templates.routes.ts:64,127` | YES — org-scoped |
| `strategies` | `strategies.routes.ts:125,247` | YES — org-scoped |
| `activity_log` | `activity-log.service.ts:45` | YES — org-scoped |
| `properties` | N/A | **NO org_id column exists** |

### org_id writer count for deals (how many sites need the create-path updated)

One primary writer: `inline-deals.routes.ts:467–470`. The null-creation risk is already addressed architecturally — the LIMIT 1 lookup is the gap (user with no org → null). Once every user has a default org, the write path works correctly.

---

## ALSO REPORT

### Total user count

```sql
SELECT COUNT(*) AS total_users FROM users;
 total_users
-------------
          17
```

17 users total. Of those, only 5 are in `org_members`. 12 users have no org membership at all. Pre-org backfill is **not trivial** — it affects 12 users who would need a default workspace created for them before scoping can be enforced.

### Are work-data READ queries currently filtering by org_id?

**Deals list (main pipeline view):**  
`inline-deals.routes.ts:242`:
```typescript
WHERE ${isAdmin ? 'TRUE' : 'd.user_id = $1'} AND d.archived_at IS NULL
```
**user_id only — no org filter.** This is the largest read-scope gap.

**Individual deal access checks** (~20 sites in `inline-deals.routes.ts`):
```typescript
WHERE id = $1 AND user_id = $2   // repeated pattern across ~20 endpoints
```
All `user_id` only. No org_id scoping.

**Entities that are already org-scoped on reads:**

| Entity | File:line | Read filter |
|---|---|---|
| `strategies` | `strategies.routes.ts:83,101,152,169,215,236` | `created_by = $2 OR org_id = $3` ✓ |
| `deal_templates` | `deal-templates.routes.ts:89,96` | `WHERE org_id = $1` ✓ |
| `activity_log` | `activity-log.service.ts:97,101` | `WHERE org_id = $1` ✓ |
| `agent_runs` | `agent-runs.routes.ts:90,121` | `LEFT JOIN org_members` ✓ |
| `deals` | `inline-deals.routes.ts:242` + ~20 more | **user_id only** ✗ |
| `properties` | all | **no org_id column** ✗ |

**The deals read-scope pass is the wide one.** Strategies, templates, activity log, and agent-runs are already org-aware. The deals list and all individual deal-access checks are not.

---

## SIZING TABLE

| Setup step | Current state (from facts) | Size | Blocker? |
|---|---|---|---|
| Membership = join table | `org_members` confirmed; join-table shape; one user already in 34 orgs; `role` column present | **✓ done** | No |
| Default workspace + assign existing users | 12 of 17 users have no org; need auto-org creation for them. 6 null-org deal rows need backfill after users get orgs | **SMALL-MEDIUM** — 12 users, 6 rows | No structural change; just data |
| `properties`: add org_id column | No org_id column exists on 101-col table; all property rows unscoped | **STRUCTURAL** — column-add + NULL backfill | Yes — blocks property scoping |
| org_id required on creation | Deals: already wired (line 470), gap is only user-with-no-org case. Properties: blocked by missing column. Others (templates/strategies/activity): already correct | **SMALL** for deals; blocked for properties | Properties column must land first |
| Workspace filter on work-data reads | Deals list + ~20 individual deal checks: user_id only (no org filter). Properties: no column. Strategies/templates/activity/agent-runs: already scoped | **LARGE** — deals read pass is wide (~20 sites) | No, but wide |
| Human-data stays user_id | Users has no org_id; no change needed | **✓ trivial** | No |

---

## PLAIN-ENGLISH SUMMARY

**Mostly query edits for deals; one structural column-add for properties; one data-only backfill for users and 6 orphaned deal rows.**

1. **Membership is already multi-org.** The join table exists, role is there, and one user is already across 34 orgs. No schema change needed for the membership layer.

2. **Deals are ~halfway there.** The `org_id` column exists, creation already tries to set it, and 28 of 34 rows have a value. The remaining work is: (a) create default orgs for the 12 unmembered users so the creation path stops producing nulls, (b) backfill the 6 existing null-org rows, and (c) add org-aware predicates to the ~20+ deal-read sites that currently gate on `user_id` only. Step (c) is the widest item in the whole migration.

3. **Properties need structural work first.** No `org_id` column exists at all on the `properties` table. A `ALTER TABLE properties ADD COLUMN org_id uuid` migration must land before any property read/write scoping can begin. This is the single hard blocker.

4. **Everything else is already correct.** Strategies, deal templates, activity log, and agent-runs all already scope their reads and writes by `org_id`. Those surfaces require no changes.
