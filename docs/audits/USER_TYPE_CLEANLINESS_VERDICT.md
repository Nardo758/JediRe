# user_type Discriminator Cleanliness

**Date:** 2026-06-30  
**Mode:** PHASE 1 — READ-ONLY  
**HEAD SHA:** `cb1b1cba7a28b6c6997767b3594e8e3f19a3b4e4`  
**Dispatch spec:** `attached_assets/USER_TYPE_CLEANLINESS_1782846674719.md`  
**Evidence rule (S1-01):** every claim carries DB rows or `file:line`.

---

## PHASE 1 — FULL VOCABULARY MAP

### 1a. Distribution

```
 user_type     | count
---------------+-------
 human_sponsor |     8
 agent         |     5
 human         |     4
```

Three additional values declared in the TypeScript type but absent from the DB:  
`human_lp`, `human_lender` — `backend/src/auth/jwt.ts:16`, `backend/src/middleware/auth.ts:17`.  
Zero rows; dead vocabulary in the type definition.

### 1b. Full population (17 users total)

```
                  id                  |                     email                      |   user_type   |  org_count | deal_count | ai_count
--------------------------------------+------------------------------------------------+---------------+------------+------------+---------
 00000000-0000-0000-0000-000000000001 | research@agents.jediplatform.internal          | agent         |          0 |          5 |       15
 00000000-0000-0000-0000-000000000002 | zoning@agents.jediplatform.internal            | agent         |          0 |          0 |        0
 00000000-0000-0000-0000-000000000003 | supply@agents.jediplatform.internal            | agent         |          0 |          0 |        0
 00000000-0000-0000-0000-000000000004 | cashflow@agents.jediplatform.internal          | agent         |          0 |          0 |        0
 00000000-0000-0000-0000-000000000005 | commentary@agents.jediplatform.internal        | agent         |          0 |          0 |        0
 6253ba3f-d40d-4597-86ab-270c8397a857 | m.dixon5030@gmail.com                          | human_sponsor |         34 |         28 |    28871
 b24c746c-a926-429b-bfaf-db065c36b550 | web_test-user@chat.jedire.com                  | human_sponsor |          1 |          0 |       67
 c20d4f65-9a66-4c66-bde6-83605c5289be | whatsapp_whatsapp:+1234567890@chat.jedire.com  | human_sponsor |          1 |          0 |       10
 2e655939-b36b-4b32-871e-13cbb3566834 | whatsapp_whatsapp:+15551234567@chat.jedire.com | human_sponsor |          1 |          0 |        3
 17d6a518-863c-4614-9e1a-19d031fb1754 | sms_+15551234567@chat.jedire.com               | human_sponsor |          1 |          0 |        5
 00000000-0000-0000-0000-000000d1a9c0 | diagnostic@jedire.local                        | human_sponsor |          0 |          0 |       18
 c5eb2554-0001-4626-85f8-f2fa7ed48cda | sms_+14155550100@chat.jedire.com               | human_sponsor |          0 |          0 |        0
 c0c0a000-0000-4000-8000-000000000001 | rockeman@jedire.system                         | human_sponsor |          0 |          0 |      870
 851bbca6-c88d-4084-bef6-763f12cfa20e | f2a-scout@test.jedi                            | human         |          0 |          0 |        0
 31720afb-fe3f-421a-9697-096e3fe52565 | f2a-operator@test.jedi                         | human         |          0 |          1 |        0
 15cea9df-694c-4774-bf26-6c83f23874ab | whatsapp_whatsapp: 15551234567@chat.jedire.com | human         |          0 |          0 |        0
 6fa6bd94-5426-4956-aaf3-371a52e0c104 | telegram_123@chat.jedire.com                   | human         |          0 |          0 |        0
```

---

## 2. The `human_sponsor` Resolution — Per Account

`human_sponsor` is the ambiguous label. It currently spans THREE distinct categories:

### 2A. REAL HUMAN TENANT — must be SCOPED

**`m.dixon5030@gmail.com` (`6253ba3f`)**  
34 org memberships, 28 deals, 28,871 ai_usage_log entries. This is the platform's primary operator — the real human user. Not created by any bridge or seed mechanism; a legitimate direct signup. Labeled `human_sponsor`. **This is a mislabel.**

### 2B. CHANNEL BRIDGE TENANTS — real end-users via messaging; must be SCOPED

These are real humans reaching the platform via WhatsApp/SMS/Web; they are tenants, not relays.

`web_test-user@chat.jedire.com` (`b24c746c`) — 1 org, 67 ai_usage entries. Created 2026-03-08.  
`whatsapp_whatsapp:+1234567890@chat.jedire.com` (`c20d4f65`) — 1 org, 10 ai entries. Created 2026-03-08.  
`whatsapp_whatsapp:+15551234567@chat.jedire.com` (`2e655939`) — 1 org, 3 ai entries. Created 2026-03-09.  
`sms_+15551234567@chat.jedire.com` (`17d6a518`) — 1 org, 5 ai entries. Created 2026-03-09.  
`sms_+14155550100@chat.jedire.com` (`c5eb2554`) — 0 orgs, 0 activity (pattern instance, live infra).

Creation path: `sessionStore.ts:64-69` — `findOrCreateUser()` inserts a bridge account when a new inbound channel message arrives with no existing mapping.

### 2C. SYSTEM INFRASTRUCTURE — must be BYPASSED

**`rockeman@jedire.system` (`c0c0a000`)**  
`index.replit.ts:1012`: seeded at server startup — `INSERT INTO users VALUES ('c0c0a000-...', 'rockeman@jedire.system', 'admin')`. `auth.ts:247-248`: hardcoded as a system identity in auth middleware. 870 ai_usage_log, 126 agent_runs. NOT a real user; NOT a tenant. It is the platform's own identity for internal calls. **Should be bypassed.**

**`diagnostic@jedire.local` (`000...d1a9c0`)**  
No code references (`grep` returned zero output). 18 ai_usage_log entries (last active 2026-04-26, 2+ months dormant). 0 orgs, 0 deals. A one-off diagnostic session run under a system identity. **Should be bypassed (or deleted).**

**Summary of `human_sponsor` breakdown:**

| Sub-category | Accounts | Count | Bypass/Scope |
|---|---|---|---|
| Real human tenant (mislabeled) | m.dixon5030@gmail.com | 1 | SCOPED |
| Channel bridge tenants | 5 bridge accounts | 5 | SCOPED |
| System infrastructure | rockeman, diagnostic | 2 | BYPASSED |

---

## 3. The Discriminator Test

**No single predicate over `user_type` cleanly partitions SCOPED from BYPASSED with current labels.**

The DB column default is `'human'::text` (confirmed: `information_schema.columns`). The `sessionStore.ts` INSERT omits `user_type` — new bridge accounts fall through to the default and land on `'human'`. Older bridge accounts (March 2026) landed on `'human_sponsor'` via a now-absent explicit assignment. This is why the same type of account wears two different labels depending on when it was created.

| Predicate candidate | SCOPED correctly? | BYPASSED correctly? | Verdict |
|---|---|---|---|
| `user_type = 'human'` | NO — misses m.dixon5030 (human_sponsor), misses older bridges (human_sponsor) | NO — includes f2a test residue, newer bridges | ✗ broken |
| `user_type = 'human_sponsor'` | NO — includes rockeman + diagnostic (system) | NO — misses f2a + newer bridges | ✗ broken |
| `user_type IN ('human', 'human_sponsor')` | YES — catches everyone who should be scoped | NO — includes rockeman + diagnostic (system) | ✗ broken |
| `user_type NOT IN ('agent')` | YES | NO — rockeman + diagnostic not excluded | ✗ broken |
| `user_type = 'agent'` | NO | YES for agents only — misses rockeman + diagnostic | ✗ incomplete |

**Root cause:** `human_sponsor` is overloaded — it contains both real-tenant-humans (m.dixon5030, channel bridges) and system infrastructure (rockeman, diagnostic). Until rockeman and diagnostic are on a distinct label, no predicate over `user_type` alone can separate them from the tenants who share `human_sponsor`.

**What would yield a clean predicate:**  
Add `'system'` as a user_type value and relabel rockeman + diagnostic. Then:

```typescript
// Step 4 bypass predicate — AFTER relabeling rockeman + diagnostic
user_type NOT IN ('agent', 'system')  // → SCOPED
user_type IN ('agent', 'system')      // → BYPASSED
```

With that in place:
- `agent` (5): AI agents — BYPASSED ✓
- `system` (2, relabeled): rockeman, diagnostic — BYPASSED ✓
- `human_sponsor` (5, remaining after relabel): 5 channel bridges — SCOPED ✓
- `human` (1, after m.dixon5030 relabeled + f2a deleted): m.dixon5030 — SCOPED ✓

Clean. Two human decisions required (vocabulary choice for the new value; whether to apply to diagnostic before or after its deletion).

---

## 4. Misclassifications

**All mislabels found:**

| Account | Current label | Correct label | Reason | Unambiguous? |
|---|---|---|---|---|
| `m.dixon5030@gmail.com` | `human_sponsor` | `human` | Real Gmail user, primary operator, 34 orgs, 28k ai entries. No creation path that would justify `human_sponsor`. | **YES — unambiguous** |
| `whatsapp: 15551234567` (`15cea9df`) | `human` | `human_sponsor` | Bridge account created by sessionStore DB-default fallback (omits user_type). Same pattern as older bridges which correctly carry `human_sponsor`. | **YES — unambiguous (pattern consistency + sessionStore root cause confirmed)** |
| `telegram_123` (`6fa6bd94`) | `human` | `human_sponsor` | Same: sessionStore DB-default fallback. | **YES — unambiguous** |
| `f2a-scout` | `human` | (delete) | Test residue, zero activity, zero code refs. Deletion dispatch in progress — relabeling superseded. | Deletion supersedes |
| `f2a-operator` | `human` | (delete) | Same. Owns 1 test deal. Deletion dispatch in progress. | Deletion supersedes |
| `rockeman` | `human_sponsor` | `system` (new value) | Seeded at startup `index.replit.ts:1012`, hardcoded in `auth.ts:247-248`. Platform system identity. | DEBATABLE — needs vocab decision on `'system'` |
| `diagnostic` | `human_sponsor` | `system` (new value) | No code refs, dormant. Cleanup candidate. | DEBATABLE — could be deletion instead |

**The sessionStore root cause (independent of user relabeling):**  
`sessionStore.ts:66-68` — INSERT omits `user_type`, new bridge accounts inherit the column default `'human'`. Fix is a one-line addition:
```sql
INSERT INTO users (email, role, email_verified, user_type)
VALUES ($1, 'investor', false, 'human_sponsor')
```
This is unambiguous regardless of whether bridge labels end up being `human_sponsor` or something else.

---

## PHASE 1 DELIVERABLE SUMMARY

**Value → meaning map:**

| user_type | Intended meaning | Actual population | Clean? |
|---|---|---|---|
| `agent` | AI service account, infra, BYPASSED | 5 AI agents | ✓ clean |
| `human_sponsor` | Ambiguous — spans 3 sub-categories | real human + 5 bridges + 2 system accounts | ✗ overloaded |
| `human` | Real tenant human, SCOPED | 2 test accounts (deleting) + 2 bridge accounts (DB-default fallback) | ✗ polluted |
| `human_lp` | LP investor type | (zero rows — declared in types only) | — |
| `human_lender` | Lender type | (zero rows — declared in types only) | — |

**Clean partition predicate:**  
`user_type` ALONE cannot cleanly partition with current labels. The minimum required change:

1. **Relabel rockeman + diagnostic** to a new `'system'` value (human decision on vocab).  
2. After that: `user_type NOT IN ('agent', 'system')` = SCOPED, everything else BYPASSED.

**What Phase 2 CAN fix unambiguously (awaiting approval):**

| Account | Current | Proposed | SQL |
|---|---|---|---|
| `m.dixon5030@gmail.com` | `human_sponsor` | `human` | `UPDATE users SET user_type = 'human' WHERE id = '6253ba3f-d40d-4597-86ab-270c8397a857'` |
| `whatsapp: 15551234567` | `human` | `human_sponsor` | `UPDATE users SET user_type = 'human_sponsor' WHERE id = '15cea9df-694c-4774-bf26-6c83f23874ab'` |
| `telegram_123` | `human` | `human_sponsor` | `UPDATE users SET user_type = 'human_sponsor' WHERE id = '6fa6bd94-5426-4956-aaf3-371a52e0c104'` |
| sessionStore INSERT | omits user_type | explicitly sets `human_sponsor` | `sessionStore.ts:66`: add `, user_type` to the INSERT column list and `'human_sponsor'` to the values |

**f2a accounts:** deletion supersedes — no relabel.

**What Phase 2 CANNOT fix unambiguously (requires human decision):**

| Item | Decision needed |
|---|---|
| Rockeman (`human_sponsor` → `system`) | Approve new `'system'` user_type value + confirm it's the right vocab |
| Diagnostic (`human_sponsor` → `system` or delete) | Confirm deletion is the right path; if deleting, relabel is moot |

**After Phase 2 unambiguous fixes only — does the predicate become clean?**

NO — partially cleaner but not fully. After Phase 2:
- `human`: m.dixon5030 (real tenant) + f2a residue (being deleted)
- `human_sponsor`: 5 bridge tenants + rockeman + diagnostic

`user_type IN ('human', 'human_sponsor')` still includes rockeman and diagnostic. The partition is clean for `'agent'` bypass but not for the system-account bypass. Step 4 middleware can be unblocked with an **explicit account exclusion** (allowlist of rockeman's UUID + diagnostic's UUID) until the `'system'` vocab decision is made — that's a 2-UUID constant, not a general pattern.

**One-line bypass predicate for Step 4 (interim, pending vocab decision):**

```typescript
const SYSTEM_BYPASS_IDS = new Set([
  'c0c0a000-0000-4000-8000-000000000001', // rockeman
  '00000000-0000-0000-0000-000000d1a9c0', // diagnostic
]);

// Bypass org scoping if:
const shouldBypass =
  req.user.user_type === 'agent' ||
  SYSTEM_BYPASS_IDS.has(req.user.userId);
```

This is safe to land before the vocab decision and eliminates the need to block Step 4 on it. When `'system'` lands, the predicate becomes `user_type IN ('agent', 'system')` and the constant is removed.

---

**=== HARD STOP — Phase 1 complete. Awaiting approval for Phase 2. ===**
