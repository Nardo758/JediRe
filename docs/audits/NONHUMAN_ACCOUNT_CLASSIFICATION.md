# Non-Human Account Classification

**Date:** 2026-06-30  
**Mode:** READ-ONLY — no writes, no deletions, no org creation  
**HEAD SHA:** `d523309edeaae853456878feb4859463f14c2559`  
**Dispatch spec:** `attached_assets/NONHUMAN_ACCOUNT_CLASSIFICATION_1782846302319.md`  
**Evidence rule (S1-01):** every bucket assignment carries DB rows or `file:line`.

---

## EXISTING CLASSIFICATION SYSTEM FOUND

Before the buckets: `users.user_type` (text) already exists and is already populated for all 12 accounts:

```sql
SELECT user_type, COUNT(*) FROM users GROUP BY user_type ORDER BY count DESC;

   user_type    | count
----------------+-------
 human_sponsor  |     8
 agent          |     5
 human          |     4
```

The system already distinguishes agents from sponsors from humans. The 12 accounts break down:
- `agent` (5): the five AI agent personas
- `human_sponsor` (7): rockeman, diagnostic, SMS, WhatsApp, Telegram + 2 others (not in the 12)
- `human` (2 of the 12): f2a-scout, f2a-operator — **misclassified at test creation, not real humans**

This is the anchor for treatment recommendations.

---

## CLASSIFICATION TABLE — ALL 12 ACCOUNTS

| Account | Email | user_type | Bucket | Evidence |
|---|---|---|---|---|
| research agent | research@agents.jediplatform.internal | `agent` | **A — LIVE INFRA** | `agent-auth.routes.ts:45`, `platform-client.ts:22`, `clawdbot-webhooks.routes.ts:1201`, `openclaw-actions.ts:46`; 5 deals, 5 agent_runs, 15 ai_usage_log |
| zoning agent | zoning@agents.jediplatform.internal | `agent` | **A — LIVE INFRA** | `agent-auth.routes.ts:46`, `platform-client.ts:23`; 0 deals, 0 runs, 0 usage (wired, awaiting deployment) |
| supply agent | supply@agents.jediplatform.internal | `agent` | **A — LIVE INFRA** | `agent-auth.routes.ts:47`, `platform-client.ts:24`; 0 deals, 0 runs, 0 usage |
| cashflow agent | cashflow@agents.jediplatform.internal | `agent` | **A — LIVE INFRA** | `agent-auth.routes.ts:48`, `platform-client.ts:25`; 0 deals, 0 runs, 0 usage |
| commentary agent | commentary@agents.jediplatform.internal | `agent` | **A — LIVE INFRA** | `agent-auth.routes.ts:49`, `platform-client.ts:26`; 0 deals, 0 runs, 0 usage |
| rockeman | rockeman@jedire.system | `human_sponsor` | **A — LIVE INFRA** | `auth.ts:247-248`, seeded at startup `index.replit.ts:1012`; **126 agent_runs, 870 ai_usage_log** — the most active non-human account |
| SMS bridge | sms_+14155550100@chat.jedire.com | `human_sponsor` | **A — LIVE INFRA (pattern)** | `sessionStore.ts:69` generates `${platform}_${platformUserId}@chat.jedire.com` dynamically; 0 activity for this specific instance |
| WhatsApp bridge | whatsapp_whatsapp:15551234567@chat.jedire.com | `human_sponsor` | **A — LIVE INFRA (pattern)** | same dynamic-creation pattern; 0 activity |
| Telegram bridge | telegram_123@chat.jedire.com | `human_sponsor` | **A — LIVE INFRA (pattern)** | same dynamic-creation pattern; 0 activity |
| diagnostic | diagnostic@jedire.local | `human_sponsor` | **B — DEAD/TEST RESIDUE** | zero code refs (grep: no output); 18 ai_usage_log entries, last active **2026-04-26** (2+ months dormant); 0 deals, 0 agent_runs |
| f2a-scout | f2a-scout@test.jedi | `human` | **B — DEAD/TEST RESIDUE** | zero code refs (grep: no output); 0 deals, 0 agent_runs, 0 ai_usage_log; created 2026-06-27 during F2/F3 reverification work in this thread |
| f2a-operator | f2a-operator@test.jedi | `human` | **B — DEAD/TEST RESIDUE** | zero code refs; 1 deal (`F2-reverify-1782825918545`, 2026-06-30), 1 UCB row (`operator` tier, 500 credits); created 2026-06-27; user_type misclassified as `human` |

**Bucket counts: A = 9 (5 agents + rockeman + 3 bridge pattern accounts), B = 3 (diagnostic, f2a-scout, f2a-operator)**

---

## BUCKET DETAIL

### Bucket A — LIVE INFRASTRUCTURE (9 accounts)

#### The 5 AI agents

`agent-auth.routes.ts:1-13` (header comment):
> "Internal-only endpoint for issuing scoped service-account JWTs to agents. POST /api/v1/auth/agent-token. Protected by AGENT_INTERNAL_SECRET. Do NOT expose to external clients."

These are Layer-1 agent service accounts. `agent-auth.routes.ts:44-49` defines a static `AGENT_USER_IDS` map. `platform-client.ts:21-26` mirrors the same map. Both are hardcoded and referenced at runtime.

Research agent has the widest live footprint — it doubles as `CLAWDBOT_UUID` (`clawdbot-webhooks.routes.ts:1201`), `OPENCLAW_SYSTEM_USER_ID` (`openclaw-actions.ts:46`), and is the fallback userId in `context-tracker.routes.ts:36`. It owns 5 deals (the eval corpus) and has 5 agent_runs and 15 ai_usage_log entries. The other 4 agents have zero data rows but are hardcoded in live route handlers and infrastructure code — they are wired, not dead.

#### Rockeman (`c0c0a000-0000-4000-8000-000000000001`)

`auth.ts:247-248`:
```typescript
userId: 'c0c0a000-0000-4000-8000-000000000001',
email: 'rockeman@jedire.system',
```

`index.replit.ts:1012`: seeded at server startup as an `admin`-role user. This is the platform's own system identity — used for internal API calls, automated jobs, and background tasks running "as the platform." 126 agent_runs and 870 ai_usage_log entries confirm it is the most active non-human account in the system. `user_type = 'human_sponsor'` in the DB.

#### Chat bridges (SMS / WhatsApp / Telegram) — 3 specific accounts

`sessionStore.ts:69`:
```typescript
[`${platform}_${platformUserId}@chat.jedire.com`]
```

These three accounts are **instances of a live dynamic-creation pattern**, not the pattern itself. The messaging integration creates one bridge account per conversation per platform on first contact. These specific three (SMS +1415, WhatsApp 15551234567, Telegram 123) have zero activity rows — they were likely created during integration testing or onboarding. But the pattern that creates them is live: any real WhatsApp/SMS/Telegram conversation would produce new accounts of this shape. `user_type = 'human_sponsor'` is correct — they act on behalf of a real human sponsor.

---

### Bucket B — DEAD / TEST RESIDUE (3 accounts)

#### f2a-scout and f2a-operator

Created 2026-06-27 during F2/F3 reverification work in this thread. No live code references (grep returned no output). `user_type = 'human'` — misclassification at test-account creation; these were never real users.

- **f2a-scout**: zero data of any kind. Clean delete candidate.
- **f2a-operator**: owns 1 deal (`F2-reverify-1782825918545`, a regression test fixture created 2026-06-30 today) and has 1 UCB row (`operator` tier). FK check required before deletion: `deals` (1 row), `user_credit_balances` (1 row). The owned deal is itself a test artifact.

#### Diagnostic (`00000000-0000-0000-0000-000000d1a9c0`)

Zero live code references. 18 ai_usage_log entries with last activity **2026-04-26** — dormant for over 2 months. `user_type = 'human_sponsor'` — likely a one-off diagnostic session run under a system identity. Zero deals, zero agent_runs. FK check required before deletion: `ai_usage_log` (18 rows).

---

## THE FIXTURE QUESTION

**Does any flag exist to mark a deal as eval/fixture, or only the name?**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'deals'
  AND column_name ILIKE ANY(ARRAY['%fixture%','%eval%','%test%','%seed%','%calibrat%','%is_template%','%is_sample%']);

(0 rows)
```

**No fixture column exists.** The `[CS-AUDIT]` prefix and `S1 Gold Set` name are the only markers. These 5 deals have no structural distinction from real deals:

```
[CS-AUDIT] Value-Add Test      — pipeline_stage='prospect', no notes
[CS-AUDIT] Flip Test           — pipeline_stage='prospect', no notes
S1 Gold Set — Jacksonville MF  — pipeline_stage='prospect', no notes
S1 Gold Set — Atlanta MF #1    — pipeline_stage='prospect', no notes
S1 Gold Set — Atlanta MF #2    — pipeline_stage='prospect', no notes
```

All owned by research agent (`000...001`). All null org_id.

**Recommended treatment (both options, one answer):** `ADD COLUMN is_fixture BOOLEAN DEFAULT FALSE` on `deals` and backfill these 5 rows. This is less invasive than a dedicated eval org — it adds a single boolean WHERE predicate to Pipeline views (`AND NOT is_fixture` or `AND (is_fixture IS NULL OR is_fixture = FALSE)`), doesn't require the properties org_id column to land first, and doesn't create a synthetic tenant. The dedicated-org approach has the same filtering effect but ties fixture handling to the workspace migration sequence — the column is cheaper and decoupled.

---

## THE SERVICE-ACCOUNT QUESTION

**Does any `is_service_account`-style concept exist today?**

**Yes — `users.user_type` is already the service-account concept.** Values in use:
- `'agent'` — AI agent service accounts (the 5 agents)
- `'human_sponsor'` — system/bridge/sponsoring accounts (rockeman, chat bridges, diagnostic)
- `'human'` — real human users (plus the 2 misclassified f2a test accounts)

`AGENT_USER_IDS` constant in `agent-auth.routes.ts:44` and `platform-client.ts:21` is a secondary explicit registry for the 5 agents specifically.

**No `is_service_account` boolean exists, but `user_type != 'human'` is functionally equivalent** for exemption purposes. The mechanism is already in the DB; it only needs to be wired into the workspace-scoping middleware.

---

## RECOMMENDED TREATMENTS (per bucket — no action here)

### Bucket A — LIVE INFRASTRUCTURE

**Recommended: `user_type`-based exemption in workspace scoping middleware.**  
When `WHERE org_id = ?` enforcement lands, add a bypass:
```typescript
// in workspace-scope middleware
if (req.user.userType !== 'human') { /* skip org_id filter */ }
```
`user_type` is already on the token payload path (it's in the users row). Agents and bridges are not tenants — they act across workspaces. A single SYSTEM org is the alternative but is architecturally messier (it would appear in org lists, needs fake members, etc.). The `user_type` exemption is a 1-line gate addition to one middleware; it's already the natural fit given the existing schema.

For **chat bridges specifically:** the `human_sponsor` pattern also needs a sponsor-resolution step at message-routing time (identify which real workspace the bridge conversation belongs to and scope data reads to that org). That is a separate product question — not this dispatch.

### Bucket B — DEAD/TEST RESIDUE

Cleanup candidates. Require a separate human-approved deletion dispatch with:
- FK check across all tables before deletion (deals, user_credit_balances, ai_usage_log)
- For f2a-operator: the owned `F2-reverify` deal is also test residue and should be deleted in the same pass
- `diagnostic`: 18 ai_usage_log rows would be orphaned if the user is deleted — cascade or explicit delete
- The dispatch should also fix `user_type = 'human'` on f2a-* accounts (or the deletion makes it moot)

### Eval/fixture deals (the 5 S1 Gold Set / [CS-AUDIT] rows)

**Recommended: `ALTER TABLE deals ADD COLUMN is_fixture BOOLEAN DEFAULT FALSE`** and backfill these 5 rows to `TRUE`. Cheaper than a dedicated org, decoupled from workspace migration sequencing, and the filter is a trivial WHERE predicate addition in Pipeline list queries. Separate dispatch.

---

## WHAT IS SAFE TO LEAVE EXACTLY AS-IS FOR NOW

The following 9 Bucket A accounts are **safe to leave orgless** until read-scoping (Step 4) lands — adding an org_id filter to deal reads would need to bypass them anyway. They are not human users, they don't appear in Pipeline views, and their current orgless state causes zero user-visible harm:

- All 5 AI agents
- Rockeman
- SMS, WhatsApp, Telegram bridges

**Which accounts need a decision BEFORE Step 4 (read-scoping):**

| Account | Why it blocks Step 4 |
|---|---|
| All 5 agents (especially research agent) | Own 5 deals that currently show up in all deal lists; once workspace filter lands, these deals vanish unless fixture-flagged or agent org-exempt |
| `diagnostic` | Dormant but owns ai_usage_log rows; safe to leave; low urgency |
| `f2a-operator` | Owns 1 deal that would vanish under org scoping; that deal is test residue anyway — cleanup is the cleaner path |

**The is_fixture column addition is the dependency for Step 4.** Without it, the 5 S1 Gold Set / [CS-AUDIT] deals disappear from all workspace-scoped deal lists the moment the org filter lands. Either they get is_fixture=true before Step 4, or they get assigned to the system/research-agent workspace with `user_type` exemption — either works, but the choice must be made before Step 4 runs.
