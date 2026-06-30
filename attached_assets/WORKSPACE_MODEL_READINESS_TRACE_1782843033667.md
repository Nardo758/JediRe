# DISPATCH — WORKSPACE MODEL READINESS TRACE (READ-ONLY)

**Mode:** READ-ONLY. Report the current state of org/membership/scoping so the multi-tenancy setup
becomes a sized checklist. Decide nothing, build nothing, migrate nothing.
**Target:** running Replit instance + live DB.
**Repo:** `Nardo758/JediRe.git` @ HEAD — record SHA.
**Evidence rule (S1-01):** every answer carries live DB output (schema/rows) or `file:line`. No
inference from memory or spec.
**Report to:** `docs/audits/WORKSPACE_MODEL_READINESS.md`

---

## THE MODEL BEING ADOPTED (context, not in question)

User = person, Org = workspace, data lives in the workspace, a person can belong to several.
Rule: data about the HUMAN keys on `user_id`; data about the WORK keys on `org_id`; data that's
mine-about-this-workspace keys on BOTH. This trace reports how far the current schema already
supports that, so we know what's query-edits vs structural migration.

---

## THE FOUR FACTS (answer each, with evidence)

**FACT 1 — Is membership a JOIN TABLE or a flat FK?**
This is the structural fork. Check both:
```sql
-- join-table shape?
SELECT table_name FROM information_schema.tables
WHERE table_name ILIKE '%org_member%' OR table_name ILIKE '%organization_member%'
   OR table_name ILIKE '%team_member%' OR table_name ILIKE '%membership%';
-- flat-FK shape?
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'users' AND (column_name ILIKE '%org%' OR column_name ILIKE '%team%');
```
Then read the org route handlers (`/api/v1/orgs`, `/api/v1/organization`) to see how a user→org
relationship is actually written. `file:line`.
**Report:** JOIN TABLE (multi-org capable today) / FLAT FK (1:1, needs structural change for
multi-org) / BOTH-PRESENT (reconcile). This single answer determines whether multi-org is a
schema migration or already structurally possible.

**FACT 2 — Does an org_members-style table exist, and what's in it?**
If Fact 1 found a membership table, dump its columns and a sample:
```sql
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '<membership table>';
SELECT * FROM <membership table> LIMIT 10;
SELECT COUNT(DISTINCT user_id) AS users, COUNT(DISTINCT org_id) AS orgs, COUNT(*) AS rows FROM <membership table>;
```
Does it carry a `role` column already? Is the current user↔org ratio actually 1:1, or does any user
already belong to >1 org? (The "38 orgs / 38 members" figure — confirm it's 1:1 in practice.)

**FACT 3 — Current org_id state of the owned-asset and deal rows.**
The pre-org-data question. Do existing work rows already carry an org_id, or null?
```sql
-- owned assets / properties
SELECT COUNT(*) AS total,
       COUNT(org_id) AS with_org,
       COUNT(*) - COUNT(org_id) AS null_org
FROM properties;
-- deals
SELECT COUNT(*) AS total,
       COUNT(org_id) AS with_org,
       COUNT(*) - COUNT(org_id) AS null_org
FROM deals;
-- the four named owned assets specifically
SELECT id, name, org_id FROM properties
WHERE name ILIKE '%frisco%' OR name ILIKE '%mckinney%' OR name ILIKE '%duluth%' OR name ILIKE '%highland%';
```
**Report:** how many work rows would VANISH the moment a `WHERE org_id = ...` filter is added —
i.e. how many carry null org_id today. (If `properties` or `deals` has no org_id column at all,
report that — it's a column-add, not just a backfill.)

**FACT 4 — Does anything already SET org_id on creation?**
Grep the creation paths:
```
grep -rniE "org_id" backend/src --include=*.ts | grep -iE "insert|values|set|create"
```
For deal-create, property-create, and the main work-entity writers: do they set org_id at creation,
or leave it null? `file:line` each. This tells us whether "make org_id required on creation" is a
small change or touches many writers.

---

## ALSO REPORT (cheap, informs the migration)

- **How many distinct users exist total?** `SELECT COUNT(*) FROM users;` — confirms whether the
  pre-org backfill is "effectively one user, trivial" or already multi-user (harder).
- **Are work-data READ queries currently filtering by org_id anywhere?** Spot-check the Pipeline /
  deals / portfolio list endpoints: is there ANY org filter today, or is it all `requireAuth` with
  no scoping? `file:line`. This sizes Step 3 (add workspace filter to reads) — the bulk of the work.

---

## DELIVERABLE — the sizing table

Produce ONE table that turns the model into a sized checklist:

| setup step | current state (from facts) | size | blocker? |
|---|---|---|---|
| Membership = join table | Fact 1 result | — | structural if flat FK |
| Default workspace + assign existing data | Fact 3 null-org count + total users | — | — |
| org_id required on creation | Fact 4 writer count | — | — |
| Workspace filter on work-data reads | "also report" read-scope finding | — | — |
| Human-data stays user_id | (no change) | — | — |

Plus a 3-line plain-English summary: is multi-tenancy mostly QUERY EDITS (org_id columns exist,
membership is a join table, few null rows) or a STRUCTURAL MIGRATION (flat FK, missing org_id
columns, many orphaned rows) — and roughly how big the read-scoping pass is.

**STOP at the report. This is the look-before-you-build. The migration and the query-scoping work
are separate, sequenced, human-approved dispatches that follow from this sizing — each touches data
or entitlement and runs one at a time with live verification.**
