# Vocabulary Finalization: is_fixture + 'system' user_type

**Date:** 2026-06-30  
**HEAD SHA (precondition check):** `a33c9a846af4984c83fa6f6c6ad2e96f902eede6`  
**Dispatch spec:** `attached_assets/VOCAB_FINALIZATION_1782847202436.md`  
**Evidence rule (S1-01):** schema + relabels proven by live before/after DB queries.

---

## PRECONDITION: Phase 2 user_type cleanliness

Confirmed NOT applied at dispatch start. Phase 2 relabels applied here as first action:

| Account | Before | After | SQL executed |
|---|---|---|---|
| `m.dixon5030@gmail.com` (`6253ba3f`) | `human_sponsor` | `human` | `UPDATE users SET user_type = 'human' WHERE id = '6253ba3f-...'` → 1 row |
| `whatsapp: 15551234567` (`15cea9df`) | `human` | `human_sponsor` | `UPDATE users SET user_type = 'human_sponsor' WHERE id IN (...)` → 2 rows |
| `telegram_123` (`6fa6bd94`) | `human` | `human_sponsor` | (same UPDATE, 2 rows) |
| `sessionStore.ts:68-70` INSERT | omitted `user_type` (DB default `human`) | explicit `'human_sponsor'` | code edit `sessionStore.ts:69-71` |

---

## PART A — `is_fixture` Column

### A1. Column added

```sql
ALTER TABLE deals ADD COLUMN IF NOT EXISTS is_fixture BOOLEAN NOT NULL DEFAULT FALSE;
```

Confirmed live:

```
 column_name | data_type | column_default | is_nullable
-------------+-----------+----------------+-------------
 is_fixture  | boolean   | false          | NO
```

### A2. Backfill — 5 fixtures by explicit ID

```sql
UPDATE deals SET is_fixture = TRUE
WHERE id IN (
  '1daab29b-e586-41bc-9338-eba72f202abd',  -- [CS-AUDIT] Value-Add Test
  '6d047c45-6851-4fbf-8369-e378de6c0f1d',  -- [CS-AUDIT] Flip Test
  'f1c6909a-a133-4ddf-8c11-d0069e187034',  -- S1 Gold Set — Jacksonville MF (2018)
  '17457eb3-5ba1-49e6-9f2c-56f311b9bf49',  -- S1 Gold Set — Atlanta MF #1 (2020)
  '0a55f0ac-587a-4b30-8589-a9ea207fbdba'   -- S1 Gold Set — Atlanta MF #2 / HOLD-OUT (2022)
);
```

### A3. Verification

```
                  id                  |                     name                      |               user_id                | is_fixture
--------------------------------------+-----------------------------------------------+--------------------------------------+------------
 17457eb3-5ba1-49e6-9f2c-56f311b9bf49 | S1 Gold Set — Atlanta MF #1 (2020)            | 00000000-0000-0000-0000-000000000001 | t
 0a55f0ac-587a-4b30-8589-a9ea207fbdba | S1 Gold Set — Atlanta MF #2 / HOLD-OUT (2022) | 00000000-0000-0000-0000-000000000001 | t
 f1c6909a-a133-4ddf-8c11-d0069e187034 | S1 Gold Set — Jacksonville MF (2018)          | 00000000-0000-0000-0000-000000000001 | t
 6d047c45-6851-4fbf-8369-e378de6c0f1d | [CS-AUDIT] Flip Test                          | 00000000-0000-0000-0000-000000000001 | t
 1daab29b-e586-41bc-9338-eba72f202abd | [CS-AUDIT] Value-Add Test                     | 00000000-0000-0000-0000-000000000001 | t
(5 rows)

 real_deals_accidentally_flagged
---------------------------------
                               0
```

**Acceptance A: ✓** Column exists, exactly 5 fixtures flagged, all owned by research agent (`000...001`), zero real deals accidentally flagged.

---

## PART B — `'system'` user_type Value

### B1. TS type union — 'system' added

Two files updated (same line each):

**`backend/src/auth/jwt.ts:19`**
```typescript
user_type?: 'human' | 'agent' | 'human_sponsor' | 'human_lp' | 'human_lender' | 'system';
```

**`backend/src/middleware/auth.ts:20`**
```typescript
user_type?: 'human' | 'agent' | 'human_sponsor' | 'human_lp' | 'human_lender' | 'system';
```

`human_lp` / `human_lender` left as-is per dispatch scope.

### B2. Check constraint widened

`user_type` is text in the DB but has an explicit CHECK constraint:

```sql
-- Old: CHECK (user_type = ANY (ARRAY['human','agent','human_sponsor','human_lp','human_lender']))
-- New:
ALTER TABLE users DROP CONSTRAINT users_user_type_check;
ALTER TABLE users ADD CONSTRAINT users_user_type_check
  CHECK (user_type = ANY (ARRAY[
    'human','agent','human_sponsor','human_lp','human_lender','system'
  ]));
```

### B3. Rockeman relabeled

```
                  id                  |         email          | new_type
--------------------------------------+------------------------+----------
 c0c0a000-0000-4000-8000-000000000001 | rockeman@jedire.system | system
(1 row)
```

### B4. Diagnostic — OPEN DECISION (not touched)

`diagnostic@jedire.local` (`000...d1a9c0`) remains `human_sponsor` per dispatch instruction. It is a deletion candidate (zero code refs, dormant since 2026-04-26). Until that decision is made, its UUID must remain in `SYSTEM_BYPASS_IDS`. See §Bypass Predicate below.

### B5. Partition proof

**BYPASSED set** (`user_type IN ('agent', 'system')`):

```
                  id                  |                  email                  | user_type
--------------------------------------+-----------------------------------------+-----------
 00000000-0000-0000-0000-000000000004 | cashflow@agents.jediplatform.internal   | agent
 00000000-0000-0000-0000-000000000005 | commentary@agents.jediplatform.internal | agent
 00000000-0000-0000-0000-000000000001 | research@agents.jediplatform.internal   | agent
 00000000-0000-0000-0000-000000000003 | supply@agents.jediplatform.internal     | agent
 00000000-0000-0000-0000-000000000002 | zoning@agents.jediplatform.internal     | agent
 c0c0a000-0000-4000-8000-000000000001 | rockeman@jedire.system                  | system
(6 rows)
```

5 AI agents + rockeman. No real tenants, no bridges, no humans. ✓

**SCOPED set** (`user_type NOT IN ('agent', 'system')`):

```
                  id                  |                     email                      | user_type
--------------------------------------+------------------------------------------------+---------------
 31720afb-fe3f-421a-9697-096e3fe52565 | f2a-operator@test.jedi                         | human
 851bbca6-c88d-4084-bef6-763f12cfa20e | f2a-scout@test.jedi                            | human
 6253ba3f-d40d-4597-86ab-270c8397a857 | m.dixon5030@gmail.com                          | human
 00000000-0000-0000-0000-000000d1a9c0 | diagnostic@jedire.local                        | human_sponsor
 c5eb2554-0001-4626-85f8-f2fa7ed48cda | sms_+14155550100@chat.jedire.com               | human_sponsor
 17d6a518-863c-4614-9e1a-19d031fb1754 | sms_+15551234567@chat.jedire.com               | human_sponsor
 6fa6bd94-5426-4956-aaf3-371a52e0c104 | telegram_123@chat.jedire.com                   | human_sponsor
 b24c746c-a926-429b-bfaf-db065c36b550 | web_test-user@chat.jedire.com                  | human_sponsor
 15cea9df-694c-4774-bf26-6c83f23874ab | whatsapp_whatsapp: 15551234567@chat.jedire.com | human_sponsor
 c20d4f65-9a66-4c66-bde6-83605c5289be | whatsapp_whatsapp:+1234567890@chat.jedire.com  | human_sponsor
 2e655939-b36b-4b32-871e-13cbb3566834 | whatsapp_whatsapp:+15551234567@chat.jedire.com | human_sponsor
(11 rows)
```

All real tenants and channel bridge users. No AI agents, no system accounts.  
Three residual accounts will be cleaned up by the dead-account deletion dispatch:
- `f2a-scout`, `f2a-operator` — test residue, labeled `human` (harmless in SCOPED; they have no real data)
- `diagnostic` — labeled `human_sponsor`; see below

**Final distribution:**
```
 user_type     | count
---------------+-------
 human_sponsor |     8
 agent         |     5
 human         |     3
 system        |     1
```

**Acceptance B: ✓** `'system'` in type, rockeman relabeled, partition proven. No system/infra account in SCOPED set. Diagnostic is the single documented open decision.

---

## BYPASS PREDICATE FOR STEP 4

**Fully clean predicate (once diagnostic is resolved):**
```typescript
user_type IN ('agent', 'system')  →  BYPASSED
user_type NOT IN ('agent', 'system')  →  SCOPED
```

**Interim predicate (until diagnostic keep-or-delete is decided):**
```typescript
const SYSTEM_BYPASS_IDS = new Set([
  '00000000-0000-0000-0000-000000d1a9c0', // diagnostic — pending keep-or-delete decision
]);

const shouldBypass =
  req.user.user_type === 'agent' ||
  req.user.user_type === 'system' ||
  SYSTEM_BYPASS_IDS.has(req.user.userId);
```

When diagnostic is deleted (dead-account cleanup dispatch), remove its UUID from `SYSTEM_BYPASS_IDS`. When the set is empty, collapse to `user_type IN ('agent', 'system')` and remove the constant entirely.

---

## ONE-LINE SUMMARY

**`is_fixture`:** live — 5 eval deals flagged by explicit ID, 0 real deals touched.  
**Partition:** `user_type NOT IN ('agent', 'system')` is clean except `diagnostic` pending keep-or-delete; that one UUID remains in `SYSTEM_BYPASS_IDS` until resolved.
