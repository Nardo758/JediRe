# Operator Provisioning Path Trace — Verdict

**Date:** 2026-06-30  
**Mode:** READ-ONLY — no backfill, no fix applied  
**HEAD SHA:** `ac9d379828fe494e1459fc014e4380e5cd38ae58`  
**Evidence rule (S1-01):** every claim carries `file:line` of the write and pasted live DB output

---

## THE ANOMALY (recap)

Both live `operator` UCB rows have `automation_level = 1`. `TIER_CONFIG` defines operator `maxAutomationLevel = 2`. `updateTier()` provably sets `automation_level = config.maxAutomationLevel` when called. So the handler is correct AND the live rows are wrong — which requires a provisioning path that reaches `operator` WITHOUT calling `updateTier()`.

---

## WRITER ENUMERATION

Every site that writes `subscription_tier` or `automation_level` in `user_credit_balances`:

| # | Writer | file:line | Sets `automation_level`? | Value written | How tier reaches it | Live path? |
|---|---|---|---|---|---|---|
| 1 | `provisionUser()` INSERT/UPSERT | `creditService.ts:173–200` | **YES — hardcoded literal `1`** (line 193) | `1` always, regardless of tier arg | Stripe `customer.subscription.created` → `webhookHandlers.ts:69` | **LIVE** |
| 2 | `updateTier()` UPDATE | `creditService.ts:274–291` | YES — `config.maxAutomationLevel` (line 287) | Correct tier max | Stripe `customer.subscription.updated` → `webhookHandlers.ts:96` | LIVE |
| 3 | `setAutomationLevel()` UPDATE | `creditService.ts:316–319` | YES — explicit `level` param, capped to tier max | Caller-supplied | No webhook wiring found; no external callers in codebase | LIVE but not invoked by any provisioning path |
| 4 | `billing.routes.ts` INSERT | `billing.routes.ts:172` | NO — column default applies | `1` (column default) | Dev auto-login, always passes `tier='scout'` | LIVE but irrelevant — 'scout' only |
| 5 | `settings-ai.routes.ts` INSERT | `settings-ai.routes.ts:88` | NO — column default applies | `1` (column default) | LLM preference save, always writes `tier='free'` | LIVE but irrelevant — 'free' only |

**Column default:** `user_credit_balances.automation_level` has a DB-level default of `1`. Any INSERT that omits the column silently lands at `1`.

### Suspect: Writer #1 — `provisionUser()`

The INSERT at `creditService.ts:193`:

```typescript
VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, $9)
//                    ^^
//                    $4 — always 1, comment reads "start at Level 1 automation"
```

The `$4` parameter is hardcoded `1` regardless of the `tier` argument passed in. The `ON CONFLICT DO UPDATE` at lines 179–188 also writes `automation_level = $4` (same hardcoded `1`), so even a re-provision of an existing operator user resets automation_level to 1.

The `customer.subscription.created` webhook at `webhookHandlers.ts:62–79` calls `provisionUser(userId, customerId, tier)` where `tier` may be `'operator'`, `'principal'`, etc. — but `provisionUser` discards the tier's maxAutomationLevel and writes `1`.

There is **no subsequent `updateTier()` call** in the `.created` handler branch. The user lands at `automation_level=1` and stays there until a `customer.subscription.updated` event fires or a manual intervention occurs.

---

## THE TWO OPERATOR ROWS — PROVENANCE

```
SELECT user_id, subscription_tier, automation_level, credits_remaining, updated_at
FROM user_credit_balances WHERE subscription_tier = 'operator' ORDER BY updated_at;

               user_id                | subscription_tier | automation_level | credits_remaining |          updated_at
--------------------------------------+-------------------+------------------+-------------------+-------------------------------
 6253ba3f-d40d-4597-86ab-270c8397a857 | operator          |                1 |        406.000000 | 2026-06-28 16:41:10.816347+00
 31720afb-fe3f-421a-9697-096e3fe52565 | operator          |                1 |        500.000000 | 2026-06-30 13:24:50.268189+00
```

**Note on `31720afb` updated_at:** The `2026-06-30 13:24:50` timestamp is the F3 reverification test restore (today). The restore ran `updateTier(userId, 'operator')` then forced `automation_level = 1` back to pre-test value. The row's provisioning predates today.

**The table has no `created_at` column** — only `updated_at`. Exact provisioning timestamps cannot be recovered from the DB alone.

**Did these rows ever pass through `updateTier()`?**  
`updateTier()` is the only function that sets `subscription_tier` AND `automation_level` together in an UPDATE (line 274–291). If either row had passed through `updateTier()` at `tier='operator'`, `automation_level` would have been set to `2`. Both rows show `automation_level=1`. **Conclusion: neither row has ever been processed by `updateTier()`.**

**Most recent `creditService.ts` commit touching provisioning:** `20b9bbebda` on 2026-06-28 01:49 UTC ("Update credit system to enforce monthly caps"). Git diff of that commit shows `automation_level = $4` was already present in `provisionUser()` with `$4` hardcoded to `1` — the hardcoded `1` was not introduced by that commit, it predates it.

**`6253ba3f` updated_at (2026-06-28 16:41)** is 14+ hours after the latest creditService.ts commit. This means the row was either provisioned or touched via the live application on 2026-06-28 — after the most recent code change. The hardcoded `1` in `provisionUser` was present at that time, confirming this is not a stale artifact from before the code existed.

---

## VERDICT

**Operator `automation_level` anomaly is: LIVE WIRING GAP**

A current, active code path (`customer.subscription.created` → `webhookHandlers.ts:69` → `provisionUser()` → `creditService.ts:193` hardcoded `1`) provisions any new subscriber — at any tier — with `automation_level = 1`. The next operator subscriber reproduces the bug.

**A backfill alone does NOT close this.** Without fixing `creditService.ts:193`, every future `customer.subscription.created` event for an operator (or principal, or institutional) subscriber overwrites `automation_level` back to `1`.

---

## FIX TARGET (identified, not applied)

**Single-line fix:**  
`creditService.ts:193` — replace hardcoded `1` with `config.maxAutomationLevel`:

```typescript
// BEFORE
1, // start at Level 1 automation

// AFTER
config.maxAutomationLevel,
```

`config` is already in scope at line 167: `const config = TIER_CONFIG[tier]`. No other changes needed.

**Backfill:** safe to run after the fix is deployed, but cannot be run first (the `.created` path would re-overwrite it on the next provisioning event for an affected user).

---

## IMPLICATION FOR F3

F3's verdict ("automation_level rises when tier is upgraded via the real upgrade path") remains **PASS for the `.updated` path** — `updateTier()` at `creditService.ts:274–291` correctly applies `config.maxAutomationLevel`, as proven by the live before/after DB query in `docs/audits/F2_F3_RUNTIME_REVERIFY_VERDICT.md`.

However, F3's guarantee **has a hole independent of the Stripe-wiring question**: the `.created` provisioning path (`provisionUser`) bypasses the handler entirely and forces `automation_level = 1`. A user who subscribes at operator tier and never triggers a `.updated` event (e.g., no mid-cycle plan change) will have `automation_level = 1` indefinitely — the upgrade handler never fires for them. The automation_level guarantee only holds if the user passes through the `.updated` path at least once after initial provisioning.

---

## SUMMARY TABLE

| Question | Answer |
|---|---|
| Is any live path provisioning operator without correct automation_level? | **YES** — `customer.subscription.created` → `provisionUser()` → hardcoded `1` |
| File:line of the gap | `creditService.ts:193` |
| Is this stale (rows predate a fix)? | **NO** — the hardcoded `1` is present in all reachable commits; `6253ba3f` was touched on 2026-06-28 after the latest code commit |
| Have either operator rows passed through `updateTier()`? | **NO** — if they had, automation_level would be `2` |
| Is backfill alone sufficient? | **NO** — `.created` path re-overwrites on next provisioning |
| F3 verdict change? | F3 PASS stands for `.updated` path; provisioning path is a separate hole |
| Fix target | `creditService.ts:193`: `1` → `config.maxAutomationLevel` |
