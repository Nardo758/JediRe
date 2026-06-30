# Workspace Seeding — Phase 1 Scope

**Date:** 2026-06-30  
**Mode:** PHASE 1 READ-ONLY — HARD STOP before any writes  
**HEAD SHA:** `3e745e25ad17eb0a4fb92c9305577a4ee71b72dc`  
**Dispatch spec:** `attached_assets/WORKSPACE_SEEDING_1782845977062.md`

---

## ⚠️ CRITICAL FLAG — ALL 12 ORGLESS USERS ARE NON-HUMAN ACCOUNTS

Before the counts: the 12 users with no org membership are **zero real humans**. Every one is a system agent, internal bot, chat bridge, or test account. The 5 actual human users already have orgs. This changes the framing of the seeding decision — see §Proposed seeding shape below.

---

## QUERY 1 — The 12 orgless users (confirmed count: 12)

```sql
SELECT u.id, u.email, u.created_at
FROM users u
LEFT JOIN org_members m ON m.user_id = u.id
WHERE m.user_id IS NULL
ORDER BY u.created_at;

                  id                  |                     email                      |         created_at
--------------------------------------+------------------------------------------------+----------------------------
 00000000-0000-0000-0000-000000000001 | research@agents.jediplatform.internal          | 2026-04-19
 00000000-0000-0000-0000-000000000002 | zoning@agents.jediplatform.internal            | 2026-04-19
 00000000-0000-0000-0000-000000000003 | supply@agents.jediplatform.internal            | 2026-04-19
 00000000-0000-0000-0000-000000000004 | cashflow@agents.jediplatform.internal          | 2026-04-19
 00000000-0000-0000-0000-000000000005 | commentary@agents.jediplatform.internal        | 2026-04-19
 00000000-0000-0000-0000-000000d1a9c0 | diagnostic@jedire.local                        | 2026-04-26
 c5eb2554-0001-4626-85f8-f2fa7ed48cda | sms_+14155550100@chat.jedire.com               | 2026-04-27
 c0c0a000-0000-4000-8000-000000000001 | rockeman@jedire.system                         | 2026-04-28
 851bbca6-c88d-4084-bef6-763f12cfa20e | f2a-scout@test.jedi                            | 2026-06-27
 31720afb-fe3f-421a-9697-096e3fe52565 | f2a-operator@test.jedi                         | 2026-06-27
 15cea9df-694c-4774-bf26-6c83f23874ab | whatsapp_whatsapp: 15551234567@chat.jedire.com | 2026-06-28
 6fa6bd94-5426-4956-aaf3-371a52e0c104 | telegram_123@chat.jedire.com                   | 2026-06-28
(12 rows)
```

**Account type breakdown:**

| Count | Type | Accounts |
|---|---|---|
| 5 | AI agent personas | `research`, `zoning`, `supply`, `cashflow`, `commentary` @ agents.jediplatform.internal |
| 1 | Diagnostic/test system account | `diagnostic@jedire.local` |
| 1 | Internal system account | `rockeman@jedire.system` |
| 1 | SMS chat bridge | `sms_+14155550100@chat.jedire.com` |
| 2 | F2A regression test accounts | `f2a-scout@test.jedi`, `f2a-operator@test.jedi` |
| 2 | Messaging bridge accounts | `whatsapp_whatsapp:...@chat.jedire.com`, `telegram_123@chat.jedire.com` |

**Zero real human users are orgless.** The 5 real humans (`6253ba3f`, `17d6a518`, `c20d4f65`, `2e655939`, `b24c746c`) already have org membership.

---

## QUERY 2 — The 6 null-org deals (ownership breakdown)

```sql
SELECT d.id, d.name, d.user_id, d.org_id, d.created_at,
       (SELECT COUNT(*) FROM org_members m WHERE m.user_id = d.user_id) AS owner_org_count
FROM deals d WHERE d.org_id IS NULL ORDER BY d.created_at;

                  id                  |                     name                      |               user_id                | owner_org_count
--------------------------------------+-----------------------------------------------+--------------------------------------+-----------------
 1daab29b-...                         | [CS-AUDIT] Value-Add Test                     | 00000000-0000-0000-0000-000000000001 |               0
 6d047c45-...                         | [CS-AUDIT] Flip Test                          | 00000000-0000-0000-0000-000000000001 |               0
 f1c6909a-...                         | S1 Gold Set — Jacksonville MF (2018)          | 00000000-0000-0000-0000-000000000001 |               0
 17457eb3-...                         | S1 Gold Set — Atlanta MF #1 (2020)            | 00000000-0000-0000-0000-000000000001 |               0
 0a55f0ac-...                         | S1 Gold Set — Atlanta MF #2 / HOLD-OUT (2022) | 00000000-0000-0000-0000-000000000001 |               0
 c92b5746-...                         | F2-reverify-1782825918545                     | 31720afb-fe3f-421a-9697-096e3fe52565 |               0
(6 rows)
```

**Ownership breakdown:**

| Deal | Owner | Owner type | Backfill classification |
|---|---|---|---|
| [CS-AUDIT] Value-Add Test | `00000000-...-000001` (research agent) | AI agent | Auto-assignable after seeding — but this is a test fixture |
| [CS-AUDIT] Flip Test | `00000000-...-000001` (research agent) | AI agent | Auto-assignable after seeding — but this is a test fixture |
| S1 Gold Set — Jacksonville MF (2018) | `00000000-...-000001` (research agent) | AI agent | Auto-assignable after seeding — but this is a test fixture |
| S1 Gold Set — Atlanta MF #1 (2020) | `00000000-...-000001` (research agent) | AI agent | Auto-assignable after seeding — but this is a test fixture |
| S1 Gold Set — Atlanta MF #2 / HOLD-OUT (2022) | `00000000-...-000001` (research agent) | AI agent | Auto-assignable after seeding — but this is a test fixture |
| F2-reverify-1782825918545 | `31720afb-...` (f2a-operator@test.jedi) | F2A test account | Auto-assignable after seeding — F2A regression fixture |

**All 6 null-org deals are owned by system/test accounts, not real users.** All 6 would become mechanically auto-assignable after seeding (each owner has 0 orgs now → 1 after seeding → no ambiguity). However, whether test-fixture deals *should* get an org_id is a separate question from whether they *can*. The `[CS-AUDIT]` and `S1 Gold Set` names signal evaluation fixtures; `F2-reverify` is a transient regression artifact.

**Zero null-org deals belong to the 34-org power user.** No ambiguity cases to flag.

---

## QUERY 4 — Role vocabulary

```sql
SELECT DISTINCT role FROM org_members ORDER BY role;

 role
-------
 owner
(1 row)
```

**Only `'owner'` exists in `org_members.role` today.** This is the correct value to use for seeded workspace memberships.

The `user_role` PostgreSQL enum (`developer`, `investor`, `flipper`, `broker`, `landlord`, `commercial`, `admin`) is a separate type used for user classification — not the org membership role column.

**Organizations table schema** (needed for the INSERT):

| Column | Type | NOT NULL | Default |
|---|---|---|---|
| id | uuid | YES | gen_random_uuid() |
| name | varchar | YES | — |
| slug | varchar | YES | — |
| owner_id | uuid | YES | — |
| logo_url | text | NO | — |
| settings | jsonb | NO | `'{}'` |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

`slug` is NOT NULL — a slug must be included in each INSERT.

---

## PROPOSED SEEDING PLAN

### Shape: one org + one org_members row per orgless user (N=12)

For each user the INSERT pair is:
```sql
-- Step A: create the workspace org
INSERT INTO organizations (name, slug, owner_id)
VALUES ('<label> Workspace', '<slug>', '<user_id>');

-- Step B: add user as owner
INSERT INTO org_members (org_id, user_id, role)
VALUES ('<new_org_id>', '<user_id>', 'owner');
```

### Exact proposed INSERTs (12 org + 12 org_members rows)

```sql
WITH new_orgs AS (
  INSERT INTO organizations (name, slug, owner_id) VALUES
    ('Research Agent Workspace',       'ws-agent-research',     '00000000-0000-0000-0000-000000000001'),
    ('Zoning Agent Workspace',         'ws-agent-zoning',       '00000000-0000-0000-0000-000000000002'),
    ('Supply Agent Workspace',         'ws-agent-supply',       '00000000-0000-0000-0000-000000000003'),
    ('Cashflow Agent Workspace',       'ws-agent-cashflow',     '00000000-0000-0000-0000-000000000004'),
    ('Commentary Agent Workspace',     'ws-agent-commentary',   '00000000-0000-0000-0000-000000000005'),
    ('Diagnostic Workspace',           'ws-diagnostic',         '00000000-0000-0000-0000-000000d1a9c0'),
    ('SMS Bridge Workspace',           'ws-sms-bridge',         'c5eb2554-0001-4626-85f8-f2fa7ed48cda'),
    ('Rockeman System Workspace',      'ws-rockeman-system',    'c0c0a000-0000-4000-8000-000000000001'),
    ('F2A Scout Test Workspace',       'ws-f2a-scout',          '851bbca6-c88d-4084-bef6-763f12cfa20e'),
    ('F2A Operator Test Workspace',    'ws-f2a-operator',       '31720afb-fe3f-421a-9697-096e3fe52565'),
    ('WhatsApp Bridge Workspace',      'ws-whatsapp-bridge',    '15cea9df-694c-4774-bf26-6c83f23874ab'),
    ('Telegram Bridge Workspace',      'ws-telegram-bridge',    '6fa6bd94-5426-4956-aaf3-371a52e0c104')
  RETURNING id, owner_id
)
INSERT INTO org_members (org_id, user_id, role)
SELECT id, owner_id, 'owner' FROM new_orgs;
```

**Row counts if run:** 12 organizations, 12 org_members.

### Deal backfill plan

After seeding, all 6 null-org deals become mechanically auto-assignable (each owner will have exactly 1 org):

```sql
-- Backfill: set org_id on each null-org deal to its owner's (only) org
UPDATE deals d
SET org_id = (
  SELECT m.org_id FROM org_members m WHERE m.user_id = d.user_id LIMIT 1
)
WHERE d.org_id IS NULL
  AND (SELECT COUNT(*) FROM org_members m WHERE m.user_id = d.user_id) = 1;
```

**Expected rows updated: 6.** Zero deals remain ambiguous (the 34-org user owns zero null-org deals).

---

## ⚠️ FLAG FOR HUMAN DECISION BEFORE PHASE 2

The dispatch assumed 12 real users needed default workspaces. The actual population is:

1. **AI agent accounts (5):** Should AI agent personas own workspaces? They create deals under their user IDs (the S1 Gold Set / [CS-AUDIT] fixtures). If org_id is enforced at deal creation, these agents will fail to create deals unless they have an org. Seeding workspaces for them is a functional fix — but it may also be a signal that agent-created deals should use the *operator's* org, not the agent's.

2. **Test accounts (2 F2A, 1 diagnostic):** These have transient lifecycle — they are created for regression tests and are not persistent users. Seeding them permanent workspaces is benign (no side effects) but they'll be recreated on the next test run with new UUIDs anyway. The `f2a-operator@test.jedi` account owns the `F2-reverify` deal.

3. **System / bridge accounts (4):** `rockeman@jedire.system`, SMS, WhatsApp, Telegram bridges. These are integration accounts, not workspace owners.

4. **Test fixture deals:** The 5 S1 Gold Set / CS-AUDIT deals owned by the research agent are evaluation fixtures. Assigning them to an auto-generated "Research Agent Workspace" is technically correct but may feel semantically wrong — they may be more naturally owned by the primary operator's org.

**Recommended question before Phase 2:** Should the 5 S1 Gold Set / [CS-AUDIT] deals be reassigned to the primary human operator's org (`dd201183-3cb5-45dd-8485-d17f5a053421`, owned by `6253ba3f`) rather than auto-seeded into a fresh agent workspace? That is a product/data decision — neither answer breaks anything, but they have different semantic meanings for later workspace-scoped list views.

---

## === HARD STOP ===

Phase 1 deliverable complete. No writes executed.

Awaiting explicit approval of:
1. The 12-user count (confirmed: 12, all non-human accounts)
2. The 6-deal ownership breakdown (all auto-assignable after seeding, all owned by system/test accounts)
3. The seeding shape — in particular, the flag above: should AI-agent-owned test fixture deals go to agent workspaces or to the primary operator's org?
4. The proposed INSERTs (12 orgs + 12 org_members + 6-deal backfill UPDATE)

Phase 2 will re-confirm counts are unchanged before executing any writes.
