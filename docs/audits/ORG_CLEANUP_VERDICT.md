# B1: Org Cleanup — Phase 1 Verdict

**Date:** 2026-07-01  
**Repo SHA:** `657499814fe21e40c0c06f7accd1a04e2b40e419`  
**Status:** ✅ PHASE 1 COMPLETE — HARD STOP. Awaiting approval for Phase 2.

---

## Summary

| Category | Count | Safe to delete |
|---|---|---|
| REAL org (Leon / dd201183) | 1 | ❌ Keep — 28 deals, 1 member |
| SMOKE-ORG artifacts | 33 | ✅ Yes — 0 real dependents each |
| BOT-FIXTURE artifacts | 4 | ⚠️ Likely safe — see flag below |
| **Total** | **38** | **37 to delete** |

---

## 1. Full 38-Org Inventory

| # | ID | Name / Slug | Created | Members | Deals | Class |
|---|---|---|---|---|---|---|
| 1 | `8fbd2a6d` | web_test-user's Organization | 2026-03-16 | 1 | 0 | **BOT-FIXTURE** |
| 2 | `cef2b7f7` | whatsapp_whatsapp:+1234567890's Organization | 2026-03-16 | 1 | 0 | **BOT-FIXTURE** |
| 3 | `9b09bedb` | whatsapp_whatsapp:+15551234567's Organization | 2026-03-16 | 1 | 0 | **BOT-FIXTURE** |
| 4 | `115a84dd` | sms_+15551234567's Organization | 2026-03-16 | 1 | 0 | **BOT-FIXTURE** |
| 5 | `dd201183` | **Leon Dixon's Organization** `m-dixon5030-dd201183` | 2026-03-16 | **1** | **28** | **REAL ✓** |
| 6 | `5e1c32c7` | Smoke Org `smoke-org-1031cba6` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 7 | `85b5c85d` | Smoke Org `smoke-org-255ac62e` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 8 | `c7e497d6` | Smoke Org `smoke-org-91872d48` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 9 | `37ec124f` | Smoke Org `smoke-org-292840e3` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 10 | `775837bf` | Smoke Org `smoke-org-24045e9e` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 11 | `ed816c2d` | Smoke Org `smoke-org-604e27cd` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 12 | `63394769` | Smoke Org `smoke-org-f56c729c` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 13 | `9869b52e` | Smoke Org `smoke-org-bcf92b43` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 14 | `01c7639b` | Smoke Org `smoke-org-8dc200ad` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 15 | `01ef0f5b` | Smoke Org `smoke-org-14e7f866` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 16 | `4bd87879` | Smoke Org `smoke-org-af520631` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 17 | `6b4e73ed` | Smoke Org `smoke-org-dfefe299` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 18 | `6ded11e8` | Smoke Org `smoke-org-39520979` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 19 | `f0006af0` | Smoke Org `smoke-org-c24e295e` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 20 | `3578fb1a` | Smoke Org `smoke-org-c9ceeddb` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 21 | `ec985512` | Smoke Org `smoke-org-ab12ceba` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 22 | `c7d750d7` | Smoke Org `smoke-org-a170252d` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 23 | `f6909662` | Smoke Org `smoke-org-3b3bc63d` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 24 | `23589985` | Smoke Org `smoke-org-6da792bd` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 25 | `baf60b67` | Smoke Org `smoke-org-ee5b22b1` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 26 | `47aff35e` | Smoke Org `smoke-org-0274607b` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 27 | `f686462f` | Smoke Org `smoke-org-80018d54` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 28 | `a34439cf` | Smoke Org `smoke-org-856f2010` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 29 | `175311d1` | Smoke Org `smoke-org-563ca21f` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 30 | `d33a286a` | Smoke Org `smoke-org-c482ecd5` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 31 | `0e779b72` | Smoke Org `smoke-org-6a2d6156` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 32 | `13436f3d` | Smoke Org `smoke-org-ff5f4eef` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 33 | `ed757eca` | Smoke Org `smoke-org-20856ae2` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 34 | `3261662e` | Smoke Org `smoke-org-b698fe85` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 35 | `f63a393d` | Smoke Org `smoke-org-eecaa38d` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 36 | `3081f56f` | Smoke Org `smoke-org-b3a1b925` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 37 | `4d84df11` | Smoke Org `smoke-org-a44b5151` | 2026-03-20 | 1 | 0 | SMOKE-ORG |
| 38 | `8917530c` | Smoke Org `smoke-org-a04e74d1` | 2026-03-20 | 1 | 0 | SMOKE-ORG |

---

## 2. Empty-Proof — All 16 FK Tables

Live query against all 37 artifact org IDs. Any non-zero result would be a blocker.

| FK Table | Column | Delete rule | Rows pointing at artifact orgs | Safe? |
|---|---|---|---|---|
| `activity_log` | `org_id` | CASCADE | **0** | ✅ |
| `deal_agent_tasks` | `org_id` | SET NULL | **0** | ✅ |
| `deal_context_items` | `organization_id` | CASCADE | **0** | ✅ |
| `deal_handoffs` | `organization_id` | CASCADE | **0** | ✅ |
| `deal_team_assignments` | `organization_id` | CASCADE | **0** | ✅ |
| `deal_templates` | `org_id` | CASCADE | **0** | ✅ |
| `deals` | `org_id` | **NO ACTION** | **0** | ✅ |
| `deals` | `organization_id` | **NO ACTION** | **0** | ✅ |
| `identity_verifications` | `organization_id` | CASCADE | **0** | ✅ |
| `integration_events` | `organization_id` | CASCADE | **0** | ✅ |
| `notarize_sessions` | `org_id` | SET NULL | **0** | ✅ |
| `org_integrations` | `organization_id` | CASCADE | **0** | ✅ |
| `org_invitations` | `org_id` | CASCADE | **0** | ✅ |
| `org_members` | `org_id` | **CASCADE** | **37** | ✅ auto-deleted |
| `organization_members` | `organization_id` | CASCADE | **0** | ✅ |
| `signing_envelopes` | `organization_id` | CASCADE | **0** | ✅ |

**Result: zero real dependents across all 37 artifact orgs.** The only rows that exist
are the 37 `org_members` rows (one per artifact org) — these CASCADE-delete automatically
when the org row is deleted. No manual child-first ordering needed.

**Note on `deals` NO ACTION:** This FK would block a delete if any artifact org had deals.
Confirmed: `deals.org_id` = 0 rows, `deals.organization_id` = 0 rows for all 37 artifact
orgs. No blocker.

---

## 3. Membership Analysis

**Who are the 37 `org_members` rows?**

| User | Email | Artifact org memberships | Also in real org? |
|---|---|---|---|
| `6253ba3f` (Leon) | m.dixon5030@gmail.com | **33** (all smoke orgs) | ✅ yes |
| `b24c746c` | web_test-user@chat.jedire.com | 1 (own bot-fixture org) | ❌ no |
| `c20d4f65` | whatsapp_whatsapp:+1234567890@chat.jedire.com | 1 (own bot-fixture org) | ❌ no |
| `2e655939` | whatsapp_whatsapp:+15551234567@chat.jedire.com | 1 (own bot-fixture org) | ❌ no |
| `17d6a518` | sms_+15551234567@chat.jedire.com | 1 (own bot-fixture org) | ❌ no |

Leon currently has **34 total org memberships** (33 smoke + 1 real).  
After Phase 2: Leon has **1 membership** (real org `dd201183` only). ✓

---

## ⚠️ Bot-Fixture Flag (4 orgs)

Each bot-fixture org is owned by a channel-identity user account:

| Bot account email | User ID | Deals | Other orgs |
|---|---|---|---|
| `web_test-user@chat.jedire.com` | `b24c746c` | 0 | 0 (only this fixture org) |
| `whatsapp_whatsapp:+1234567890@chat.jedire.com` | `c20d4f65` | 0 | 0 |
| `whatsapp_whatsapp:+15551234567@chat.jedire.com` | `2e655939` | 0 | 0 |
| `sms_+15551234567@chat.jedire.com` | `17d6a518` | 0 | 0 |

From the DB alone: **zero live dependencies** (no deals, no activity, no integrations,
no events). All evidence points to test channel accounts created during fixture setup.

**However:** the dispatch rule is "if a fixture org an active bridge relies on isn't
purely artifact, FLAG." These accounts use `@chat.jedire.com` addresses consistent with
a WhatsApp/SMS messaging bridge. If any active bridge runtime looks up these user accounts
by email or user_id to resolve an org, deleting the org row (and cascading the membership)
would break that lookup.

**Recommendation for Phase 2:** Include the 4 bot-fixture orgs in the delete — the DB
shows no live dependency — **but confirm first** that the WhatsApp/SMS/web-test bridge
runtime does not perform an org lookup for these specific accounts. If you're confident
these bridge accounts are decommissioned test fixtures, they are safe. If any bridge is
still wired to them, exclude those 4 and delete the 33 smoke orgs only.

---

## 4. FK Reference Map (delete-order analysis)

| Table | FK column | On delete | Impact on Phase 2 |
|---|---|---|---|
| `org_members` | `org_id` | **CASCADE** | Auto-deletes 37 rows — no separate statement needed |
| `activity_log` | `org_id` | CASCADE | 0 rows — no action needed |
| `deal_context_items` | `organization_id` | CASCADE | 0 rows — no action needed |
| `deal_handoffs` | `organization_id` | CASCADE | 0 rows — no action needed |
| `deal_team_assignments` | `organization_id` | CASCADE | 0 rows — no action needed |
| `deal_templates` | `org_id` | CASCADE | 0 rows — no action needed |
| `identity_verifications` | `organization_id` | CASCADE | 0 rows — no action needed |
| `integration_events` | `organization_id` | CASCADE | 0 rows — no action needed |
| `org_integrations` | `organization_id` | CASCADE | 0 rows — no action needed |
| `org_invitations` | `org_id` | CASCADE | 0 rows — no action needed |
| `organization_members` | `organization_id` | CASCADE | 0 rows — no action needed |
| `signing_envelopes` | `organization_id` | CASCADE | 0 rows — no action needed |
| `deal_agent_tasks` | `org_id` | SET NULL | 0 rows — no action needed |
| `notarize_sessions` | `org_id` | SET NULL | 0 rows — no action needed |
| `deals` | `org_id` | **NO ACTION** | ⚠️ Would block if deals existed — confirmed 0 rows |
| `deals` | `organization_id` | **NO ACTION** | ⚠️ Would block if deals existed — confirmed 0 rows |

**Delete order:** Because all referencing tables are either CASCADE, SET NULL, or have
0 rows for artifact orgs, **a single DELETE on `organizations` is sufficient.** The
`org_members` cascade handles itself. No manual child-first ordering required.

---

## 5. Delete Plan (WRITE ONLY — DO NOT RUN)

> This is the Phase 2 execution plan. Not yet run. Requires explicit approval.

### Pre-confirmation query (run first in Phase 2)

```sql
-- Re-verify inventory is unchanged since Phase 1
SELECT COUNT(*) AS total_orgs FROM organizations;                          -- expect 38
SELECT COUNT(*) AS artifact_orgs FROM organizations
WHERE id != 'dd201183-3cb5-45dd-8485-d17f5a053421';                        -- expect 37
SELECT COUNT(*) AS smoke_deals FROM deals
WHERE org_id IN (
  '5e1c32c7-1f10-463d-ab8b-888a881228d2', -- (and 32 more smoke org IDs)
  '85b5c85d-ec50-4be6-83bb-3fcaf1f71064'
  -- ... full list below
);                                                                          -- expect 0
```

### Step 1 — Delete the 37 artifact orgs (CASCADE handles org_members)

```sql
DELETE FROM organizations
WHERE id IN (
  -- BOT-FIXTURE (4)
  '8fbd2a6d-f18a-4b03-8024-3cf3a0cb4f13',   -- web_test-user
  'cef2b7f7-3efc-4f97-8abf-04b5ef167462',   -- whatsapp:+1234567890
  '9b09bedb-05ce-469e-8e9c-da179e25efd4',   -- whatsapp:+15551234567
  '115a84dd-1000-4379-a2b5-87dc56cd2dcd',   -- sms:+15551234567
  -- SMOKE-ORG (33)
  '5e1c32c7-1f10-463d-ab8b-888a881228d2',
  '85b5c85d-ec50-4be6-83bb-3fcaf1f71064',
  'c7e497d6-02e9-4cf3-930d-8c4c4f932329',
  '37ec124f-e411-4c8a-bd10-8bb20aead832',
  '775837bf-8a90-4625-9f91-50cb26345bfa',
  'ed816c2d-f965-468c-81af-4b6c7e664e9d',
  '63394769-73ea-4e74-8444-74a97a778051',
  '9869b52e-3088-4a1a-96e5-9c5b2f1e8da4',
  '01c7639b-b6de-453a-9636-9ea184d5613c',
  '01ef0f5b-3d6a-4829-8a9e-1d078bc31f9d',
  '4bd87879-fb4a-4535-974c-ef89fa763b24',
  '6b4e73ed-5ade-4aff-9df0-e3f1ab7b11d8',
  '6ded11e8-5a44-4b8c-90ca-53d05402d0a5',
  'f0006af0-b1aa-4f8b-8006-0c4f052dd430',
  '3578fb1a-6060-49b4-94ce-c12ca66fb9b6',
  'ec985512-7256-4fd1-ac56-449e59350f12',
  'c7d750d7-586a-4a39-8eed-f5c595acc1b2',
  'f6909662-089a-4f6c-a470-8351174072d3',
  '23589985-1a75-4855-ba92-2a054b4c1dbe',
  'baf60b67-af5a-46be-884a-7f805c2f6926',
  '47aff35e-b252-4f65-8020-9e6029fff2df',
  'f686462f-10f1-4c36-8a26-f3121afcd6c4',
  'a34439cf-c114-4c40-9427-b3f58a273aa4',
  '175311d1-1b74-41bf-b02f-03080c0f116f',
  'd33a286a-ca09-4b0e-9788-8ab9e720225a',
  '0e779b72-2365-4961-aa03-f603f8a96cea',
  '13436f3d-af3e-4949-b7be-618d8e3cedef',
  'ed757eca-6956-4242-aeed-140e71b44ab6',
  '3261662e-ff4b-482f-b519-d17021900c88',
  'f63a393d-8812-4878-95c6-f57fd50483ce',
  '3081f56f-b16e-4f86-8519-c4d04750762d',
  '4d84df11-1d7a-4b27-ad76-661667d98d09',
  '8917530c-26e7-4cbc-8a90-28acc184b885'
);
-- Expected: 37 rows deleted from organizations
-- Cascade: 37 rows deleted from org_members
```

**Rows affected (expected):**
- `organizations`: 37 deleted
- `org_members`: 37 cascade-deleted
- All other FK tables: 0 (no rows to cascade)

### Step 2 — Verify (Phase 2 post-delete checks)

```sql
SELECT COUNT(*) FROM organizations;
-- expect: 1

SELECT id, name, slug FROM organizations;
-- expect: only dd201183-3cb5-45dd-8485-d17f5a053421 | Leon Dixon's Organization

SELECT COUNT(*) FROM org_members
WHERE user_id = '6253ba3f-d40d-4597-86ab-270c8397a857';
-- expect: 1 (was 34)

-- Confirm real org is untouched
SELECT
  (SELECT COUNT(*) FROM deals WHERE org_id = 'dd201183-3cb5-45dd-8485-d17f5a053421') AS deals,
  (SELECT COUNT(*) FROM org_members WHERE org_id = 'dd201183-3cb5-45dd-8485-d17f5a053421') AS members;
-- expect: deals=28, members=1
```

---

## ⛔ HARD STOP

**Phase 1 deliverable is complete.** The 38-org inventory, empty-proof across all 16 FK
tables, member ownership map, FK cascade analysis, and the ready-to-run delete plan are
all above.

**Before approving Phase 2, confirm:**
1. The 4 bot-fixture org accounts (`whatsapp:*`, `sms:*`, `web_test-user`) are
   decommissioned test fixtures — no active bridge runtime relies on them.
   *(If any are live, exclude those org IDs from the delete and proceed with the 33
   smoke orgs only.)*
2. You're ready for a production DELETE of 37 `organizations` rows + 37 `org_members`
   rows (irreversible without a DB restore).

**On approval, Phase 2 runs Step 1 + Step 2 above and pastes all row-counts.**
