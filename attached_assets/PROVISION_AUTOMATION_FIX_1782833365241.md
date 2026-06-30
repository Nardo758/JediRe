# DISPATCH — FIX provisionUser AUTOMATION_LEVEL WIRING GAP

**Problem:** `provisionUser` (`creditService.ts:193`) hardcodes `automation_level = 1` regardless of
tier, on the `customer.subscription.created` path. Every new subscriber above scout is provisioned
under-entitled — a Principal subscriber lands at automation_level 1, not 3, and never recovers
unless a later `.updated` event fires. This is a live, launch-path, revenue-grade bug.
**Scope:** `creditService.ts` provisioning only — both UPSERT arms. No backfill in this dispatch.
**Repo:** `Nardo758/JediRe.git` — branch `claude/fix-provision-automation-level`, one commit.
**Verification rule (S1-01):** "done" = a NEW subscriber provisioned through the live `.created`
path lands at the correct automation_level, proven by live DB query. Not a code read.
**Report to:** `docs/audits/PROVISION_AUTOMATION_FIX_VERDICT.md`

---

## THE FIX — both arms

`creditService.ts:193` and its `ON CONFLICT DO UPDATE` clause. `config` is already in scope at
line 167 (`const config = TIER_CONFIG[tier]`).

1. **INSERT value:** replace the hardcoded `1` with `config.maxAutomationLevel`.
2. **UPSERT conflict arm:** the `ON CONFLICT DO UPDATE` also writes `automation_level`. Confirm it,
   and set it to `config.maxAutomationLevel` too. **If you fix only the INSERT, a re-provisioning
   event stamps the row back to 1** — both arms or it's not fixed. Cite `file:line` for each arm
   edited and paste the before/after of both.

If the conflict arm currently does NOT write automation_level at all, state that — then the decision
is whether a re-provision should raise it. Default: yes, write `config.maxAutomationLevel` in both
arms so the row always reflects the tier. Flag if you see a reason it shouldn't.

**Do not touch `updateTier` (line 287)** — it's already correct (F3 handler confirmed). This fix is
only the provisioning path.

---

## ACCEPTANCE — live, per tier, through the real path

Provision NEW test users through the actual `provisionUser` path (the function the `.created`
webhook calls — call it the same way the handler does, not a raw SQL insert) at more than one tier,
and confirm automation_level matches config:

1. **Operator** (config max = 2): provision → query `automation_level` → expect **2**.
   ```sql
   SELECT user_id, subscription_tier, automation_level FROM user_credit_balances WHERE user_id = '<test op>';
   ```
   Paste it.
2. **Principal** (config max = 3): provision → expect **3**. Paste the query.
3. **Scout** (config max = 1): provision → expect **1** — confirm the fix didn't break the tier
   whose correct value happened to equal the old hardcode. Paste the query.
4. **Re-provision / conflict arm:** trigger the UPSERT conflict path for an already-provisioned user
   (a second `.created`-style call for the same user) → confirm automation_level still reflects tier
   max, NOT reset to 1. This is the arm that silently re-breaks rows. Paste before/after.
5. Clean up all test users, or flag them for cleanup.

A tier whose value is wrong = fix incomplete, report it. All four must land before this signs.

---

## EXPLICITLY OUT OF SCOPE — do NOT do these here

- **No backfill.** Existing under-provisioned rows are corrected in a SEPARATE, human-approved
  dispatch AFTER this fix is proven live. Backfilling before the path is fixed lets the next
  `.created` event re-break rows. Order is fix → verify → backfill.
- Do not scope or run the backfill query. (When it comes: it targets EVERY tier above scout
  provisioned through `.created`, not just the two operator rows — wider population than first
  assumed. That's the next dispatch's job to scope, not this one's.)
- Do not touch the Stripe webhook wiring (`.created` / `.updated` invocation) — that's F3's separate
  unverified item.
- Do not touch `updateTier`.

---

## PR

- Branch `claude/fix-provision-automation-level`, one commit:
  `fix(billing): provision automation_level from tier config, not hardcoded 1`
- PR body: both arms' before/after with `file:line`, the 4 live per-tier acceptance queries pasted
  inline, cleanup confirmation.

---

## F3 STATUS UPDATE (record in verdict doc)

After this fix lands, F3 reads as THREE states, not one PASS:
- Upgrade path (`updateTier`): **CONFIRMED** (prior reverify)
- Initial provisioning (`provisionUser`): **FIXED HERE** (pending this dispatch's acceptance)
- Stripe `.updated` → handler wiring: **UNVERIFIED** (needs a Stripe test event, separate)

Do not record F3 as fully closed until all three are green.

**STOP at acceptance. Backfill is the next dispatch, separately approved.**
