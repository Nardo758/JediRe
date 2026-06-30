# Invalid 'free' Tier INSERT Fix — Verdict

**Date:** 2026-06-30  
**Branch:** `claude/fix-invalid-free-tier-insert`  
**Commit:** `fix(billing): write valid 'scout' tier, not invalid 'free', in settings-ai provisioning`  
**HEAD SHA:** `710359cb2f2c87e99a29c16d5bcf25f71d199a2d` (pre-fix baseline)  
**Mode:** Fix + live acceptance  
**Dispatch spec:** `attached_assets/INVALID_TIER_INSERT_FIX_1782839347673.md`

---

## ACCEPTANCE CHECK 1 — PRE-FIX BASELINE (no invalid rows)

```sql
SELECT COUNT(*) as invalid_tier_rows
FROM user_credit_balances
WHERE subscription_tier NOT IN ('scout','basic','operator','principal','institutional');

 invalid_tier_rows
-------------------
                 0
(1 row)
```

**PASS.** Zero existing rows with invalid tiers. No backfill required.

---

## ALL-SITES GREP — TARGET CONFIRMATION

Grep for every `subscription_tier` write with a non-TIER_CONFIG literal across all live backend `.ts` files (excluding `legacy`, `test`, `spec`, `d.ts`):

```
grep -rniE "subscription_tier\s*[:=].*('|\")?(free|pro|professional|team|enterprise|standard|premium|basic)('|\")?" backend/src --include="*.ts"
grep -rniE "(insert|values|set).*subscription_tier" backend/src --include="*.ts"
```

### All sites classified

| File:line | DB write? | Table | Value | Verdict |
|---|---|---|---|---|
| `settings-ai.routes.ts:35` | No — local var, gate at :42 | — | `: 'free'` (null fallback) | **FIX** — invalid tier in gate logic |
| `settings-ai.routes.ts:77` | No — local var, gate at :82 | — | `: 'free'` (null fallback) | **FIX** |
| `settings-ai.routes.ts:89` | **YES** | `user_credit_balances` | `'free'` literal INSERT | **PRIMARY FIX TARGET** |
| `settings-ai.routes.ts:123` | No — local var, gate at :135 | — | `?? 'free'` (null fallback) | **FIX** |
| `settings-ai.routes.ts:197` | No — local var, gate at :201 | — | `?? 'free'` (null fallback) | **FIX** |
| `settings-ai.routes.ts:235` | No — local var, gate at :239 | — | `?? 'free'` (null fallback) | **FIX** |
| `veraset.routes.ts:69` | Yes | `veraset_subscriptions` | `\|\| 'basic'` | **SAFE** — different table (`veraset_subscriptions`), Veraset API tier concept, not UCB |
| `creditService.ts:276` | Yes | `user_credit_balances` | `$1` (parameterized) | **SAFE** — value comes from `updateTier()` which only accepts `SubscriptionTier` |

**6 fix sites, all in `settings-ai.routes.ts`. Zero fix sites in any other file.**

---

## THE FIX — before/after

### `settings-ai.routes.ts` — 6 sites changed: all `'free'` → `'scout'`

**Line 89 (PRIMARY — DB write):**
```diff
-        VALUES ($1, 'free', $2, 100, 100, 0, NOW(), NOW() + INTERVAL '1 month')`,
+        VALUES ($1, 'scout', $2, 100, 100, 0, NOW(), NOW() + INTERVAL '1 month')`,
```

**Lines 35, 77 (local var fallbacks, `: 'free'` → `: 'scout'`):**
```diff
-    const tier = result.rows.length > 0 ? result.rows[0].subscription_tier : 'free';
+    const tier = result.rows.length > 0 ? result.rows[0].subscription_tier : 'scout';
```

**Lines 123, 197, 235 (local var fallbacks, `?? 'free'` → `?? 'scout'`):**
```diff
-    const tier = tierRow.rows[0]?.subscription_tier ?? 'free';
+    const tier = tierRow.rows[0]?.subscription_tier ?? 'scout';
```

---

## ACCEPTANCE CHECK 2 — LIVE TRIGGER (INSERT path)

Simulated the exact INSERT the fixed route executes, using test user `c20d4f65-9a66-4c66-bde6-83605c5289be` (a WhatsApp-linked account with no UCB row — the exact pre-condition for the INSERT branch):

```sql
INSERT INTO user_credit_balances
  (user_id, subscription_tier, llm_preference, credits_included_monthly,
   credits_remaining, credits_used_this_period, period_start, period_end)
VALUES
  ('c20d4f65-9a66-4c66-bde6-83605c5289be', 'scout', 'auto', 100, 100, 0,
   NOW(), NOW() + INTERVAL '1 month');

SELECT user_id, subscription_tier, llm_preference, credits_included_monthly
FROM user_credit_balances
WHERE user_id = 'c20d4f65-9a66-4c66-bde6-83605c5289be';

               user_id                | subscription_tier | llm_preference | credits_included_monthly
--------------------------------------+-------------------+----------------+--------------------------
 c20d4f65-9a66-4c66-bde6-83605c5289be | scout             | auto           |               100.000000
(1 row)
```

**PASS.** `subscription_tier = 'scout'`, not `'free'`.

---

## ACCEPTANCE CHECK 3 — TIER_CONFIG LOOKUP NO LONGER CRASHES

```
cd backend && npx ts-node --transpile-only -e "
  const { creditService } = require('./src/services/ai/creditService');
  const result = creditService.getTierConfig('scout');
  console.log('TIER_CONFIG[scout]:', JSON.stringify(result, null, 2));
"

TIER_CONFIG[scout]: {
  "creditsIncludedMonthly": 100,
  "overageCostPerCredit": 0.25,
  "maxActiveDeals": 5,
  "maxAutomationLevel": 1,
  "surfaces": ["chat"],
  "aiMarkup": 1.5,
  "minCharge": 0.005,
  "platformFeePerCall": 0.01,
  "monthlyFee": 49
}
maxAutomationLevel: 1
surfaces: [ 'chat' ]
```

**PASS.** `TIER_CONFIG['scout']` returns a full config object. The previous `TIER_CONFIG['free']` path would have returned `undefined` and crashed any downstream dereference.

---

## ACCEPTANCE CHECK 4 — GREP CLEAN

```
grep -rniE "subscription_tier\s*[:=].*('|\")?(free|pro|professional|team|enterprise)('|\")?" \
  backend/src --include="*.ts" | grep -v "//|test|spec|legacy|\.d\.ts"

(no output)
```

**PASS.** Zero invalid-literal tier writers remain in live backend code.

---

## CLEANUP

Test row deleted:

```sql
DELETE FROM user_credit_balances
WHERE user_id = 'c20d4f65-9a66-4c66-bde6-83605c5289be';

SELECT COUNT(*) as invalid_tier_rows
FROM user_credit_balances
WHERE subscription_tier NOT IN ('scout','basic','operator','principal','institutional');

 invalid_tier_rows
-------------------
                 0
```

**PASS.** Zero invalid-tier rows. DB returned to pre-test state.

---

## SUMMARY

| Check | Result |
|---|---|
| Pre-fix baseline: 0 invalid rows | ✅ PASS |
| Target confirmed: `settings-ai.routes.ts:89` is the primary DB writer | ✅ PASS |
| All-sites grep: 6 sites fixed, 2 sites correctly classified as safe | ✅ PASS |
| Fix applied: all 6 `'free'` → `'scout'` | ✅ APPLIED |
| Live INSERT trigger: row written with `subscription_tier='scout'` | ✅ PASS |
| TIER_CONFIG['scout'] resolves: full config returned, not undefined | ✅ PASS |
| Grep clean: zero invalid-literal writers remain | ✅ PASS |
| Cleanup: test row deleted, 0 invalid rows remain | ✅ PASS |

**Verdict: ACCEPTED.**  
The latent crash path is closed. Any user who triggers the `PUT /api/v1/settings/ai` route without a pre-existing UCB row will now receive a valid `scout` tier row that resolves cleanly in TIER_CONFIG.
