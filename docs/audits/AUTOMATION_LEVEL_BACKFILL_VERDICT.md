# Automation Level Backfill — Verdict

**Date:** 2026-06-30  
**HEAD SHA:** `bf768e508` (`fix(billing): provision automation_level from tier config, not hardcoded 1`)  
**Dispatch spec:** `attached_assets/AUTOMATION_LEVEL_BACKFILL_1782833838837.md`

---

## PRECONDITION CHECK

The `provisionUser` fix is the HEAD commit:

```
bf768e508 fix(billing): provision automation_level from tier config, not hardcoded 1
bc675e4a3 Fix incorrect automation level for new subscribers   ← checkpoint auto-commit
ac9d37982 F2/F3 runtime reverification — PASS
```

Fix is merged and live on the running instance. ✓

---

## PHASE 1 — SCOPE (READ-ONLY)

### TIER_CONFIG maxAutomationLevel (confirmed from live `creditService.ts`)

| Tier | maxAutomationLevel |
|---|---|
| scout | 1 |
| basic | 1 |
| operator | **2** |
| principal | **3** |
| institutional | **4** |

### Affected set — full result

```sql
SELECT user_id, subscription_tier, automation_level
FROM user_credit_balances
WHERE (subscription_tier = 'operator'      AND automation_level < 2)
   OR (subscription_tier = 'principal'     AND automation_level < 3)
   OR (subscription_tier = 'institutional' AND automation_level < 4)
ORDER BY subscription_tier, automation_level;

               user_id                | subscription_tier | automation_level
--------------------------------------+-------------------+------------------
 6253ba3f-d40d-4597-86ab-270c8397a857 | operator          |                1
 31720afb-fe3f-421a-9697-096e3fe52565 | operator          |                1
(2 rows)
```

### Count by tier

```
 subscription_tier | affected_rows
-------------------+---------------
 operator          |             2
(1 row)
```

**Total: 2 rows. Tier: operator only. Principal and institutional: 0 affected.**

### Sanity checks

All four checks returned zero rows:

| Check | Result |
|---|---|
| Over-provisioned (automation_level > tier max) | **0 rows** — clean |
| NULL automation_level | **0 rows** — clean |
| Unknown / legacy tier (not in TIER_CONFIG) | **0 rows** — clean |
| Scout/basic with automation_level < 1 | **0 rows** — clean |

No anomalies. No rows require separate review.

---

## PROPOSED UPDATE — FOR HUMAN APPROVAL, NOT EXECUTED

```sql
-- FOR HUMAN APPROVAL — NOT EXECUTED IN PHASE 1
UPDATE user_credit_balances
SET    automation_level = 2,
       updated_at = NOW()
WHERE  subscription_tier = 'operator'
  AND  automation_level < 2;
```

**Exact predicate:** `subscription_tier = 'operator' AND automation_level < 2`  
**Expected affected rows:** 2 (matches Phase 1 count exactly)  
**Effect:** raises both operator rows from automation_level=1 to automation_level=2  
**No principal or institutional rows touched** (zero affected in their tiers)

---

## === HARD STOP ===

Phase 1 deliverable complete. Awaiting human approval of the count (2 rows, operator tier only) before Phase 2 executes.

---

## PHASE 2 — PENDING APPROVAL

*(Blocked — do not proceed until human approves the Phase 1 count above.)*

Steps on approval:
1. Re-run Phase 1 query to confirm count is still 2 (no new provisioning in the interim)
2. Execute the approved UPDATE
3. Re-run Phase 1 query — expect 0 rows
4. Run over-correction check — expect 0 rows above tier max
5. Record before/after with pasted live queries

---

## F3 STATUS (unchanged)

| Path | Status |
|---|---|
| `updateTier()` on `.subscription.updated` | ✓ CONFIRMED |
| `provisionUser()` on `.subscription.created` | ✓ FIXED + ACCEPTED |
| Stripe `.updated` → handler wiring (real event) | ⚠ UNVERIFIED — separate dispatch |
| Backfill of existing rows | ⏸ PHASE 1 COMPLETE — awaiting Phase 2 approval |
