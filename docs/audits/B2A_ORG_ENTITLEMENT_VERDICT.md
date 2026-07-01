# B2a: Org-Entitlement Core — Phase 1 Verdict

**Date:** 2026-07-01  
**Status:** ✅ PHASE 1 COMPLETE — HARD STOP. Awaiting schema approval for Phase 2.  
**Branch:** `claude/b2a-org-entitlement`

---

## 1. Current Per-User Gate/Decrement Sites

All six live sites that touch the per-user balance — every one must move to org-level in Phase 2.

### Gate (pre-flight block)

| Site | File:line | SQL |
|---|---|---|
| MeteringAdapter createMessage | `MeteringAdapter.ts:289–305` | `SELECT credits_remaining, monthly_credit_cap FROM user_credit_balances WHERE user_id = $1` |
| CreditService reserveCredits | `creditService.ts:383–411` | `SELECT credits_remaining, monthly_credit_cap FROM user_credit_balances WHERE user_id = $1` |

**How the gate resolves WHICH balance:** `metadata.user_id` is passed by AgentRuntime from the request
context (set at call site, no org lookup today). `CreditService.reserveCredits` is called with a
plain `userId` string (no org context).

Block condition — both gates:
- `monthly_credit_cap IS NULL` → unlimited (Institutional) → always pass
- `credits_remaining <= 0 AND monthly_credit_cap IS NOT NULL` → block, throw

### Decrement (post-call)

| Site | File:line | SQL |
|---|---|---|
| MeteringAdapter reportStripeCost | `MeteringAdapter.ts:475–482` | `UPDATE user_credit_balances SET credits_remaining = credits_remaining - $1 WHERE user_id = $2` |
| CreditService reserveCredits (pre-call atomic) | `creditService.ts:429–438` | `UPDATE user_credit_balances … WHERE user_id = $2 AND credits_remaining >= $1` |
| CreditService debitActualCost (post-call delta) | `creditService.ts:462–469` | `UPDATE user_credit_balances SET credits_remaining = credits_remaining - $1 WHERE user_id = $2` |

### Cycle Reset

| Site | File:line | SQL |
|---|---|---|
| CreditService resetMonthlyCredits | `creditService.ts:222–234` | `UPDATE user_credit_balances SET credits_remaining = $1, credits_used_this_period = 0 WHERE user_id = $4` |

### Tier/Stripe Lookup (decrement path — stays user-level in B2a)

`MeteringAdapter.ts:444–452` reads `stripe_customer_id, subscription_tier FROM user_credit_balances
WHERE user_id = $1` — used only for Stripe token meter events (`jedi_input_tokens`,
`jedi_output_tokens`) and cost meter event (`jedi_ai_cost_usd`). The Stripe customer
relationship stays per-user in B2a (billing identity moves to org in B3). This lookup is NOT
shifted in B2a.

---

## 2. ai_usage_log — Attribution State

**Live schema today:**

```
id                uuid        NOT NULL
user_id           uuid        YES (nullable — migration 20260713)
stripe_customer_id text       YES
deal_id           uuid        YES
agent_id          text        NO
operation_type    text        NO
surface           text        NO
platform          text        YES
model             text        NO
input_tokens      integer     NO
output_tokens     integer     NO
cache_read_tokens integer     YES
credits_consumed  numeric     NO
estimated_cost_usd numeric    YES
latency_ms        integer     YES
created_at        timestamptz NO
billable_usd      numeric     YES
cost_usd          numeric     YES
```

**`org_id` column: does NOT exist.** Phase 2 adds it.

`MeteringMetadata` type today:
```typescript
export interface MeteringMetadata {
  actor_type: 'human' | 'agent';
  actor_id: string;
  agent_run_id?: string;
  deal_id?: string;
  user_id?: string;
  triggered_by?: TriggerBucket;
}
```

**`org_id` field: does NOT exist.** Phase 2 adds it.

---

## 3. Org-Balance Schema — Chosen Design

**Chosen option: dedicated `org_credit_balances` table** (not a column on `organizations`;
not the org owner's personal balance row). Reason: clean separation — the pool belongs to the
org, not any user. Owner changes and multi-member adds do not corrupt the pool.

### Proposed DDL

```sql
CREATE TABLE org_credit_balances (
  org_id                   UUID        NOT NULL PRIMARY KEY
                             REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_tier        TEXT        NOT NULL DEFAULT 'scout',
  credits_included_monthly NUMERIC     NOT NULL DEFAULT 100,
  credits_remaining        NUMERIC     NOT NULL DEFAULT 100,
  credits_used_this_period NUMERIC     NOT NULL DEFAULT 0,
  monthly_credit_cap       NUMERIC     NULL,      -- NULL = unlimited (Institutional)
  period_start             TIMESTAMPTZ NOT NULL,
  period_end               TIMESTAMPTZ NOT NULL,
  stripe_customer_id       TEXT,                  -- reserved for B3 org billing; NULL in B2a
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Columns mirrored from `user_credit_balances`** (same semantics, same null=unlimited rule):
- `credits_remaining` / `monthly_credit_cap` / `credits_included_monthly` / `credits_used_this_period`
- `period_start` / `period_end` — cycle window for the pool
- `subscription_tier` — the org's tier (drives cap + markup)

**Not included in B2a** (deferred or stays per-user):
- `automation_level` — stays per-user (user-level capability, not pool)
- `alert_threshold_pct` — stays per-user
- `stripe_customer_id` — reserved column, NULL in B2a; populated in B3 when billing moves to org
- `llm_preference` — user-level preference, not pool

### Seeding dd201183 (the real org)

On migration: seed one row for dd201183 from Leon's current `user_credit_balances` row:

```sql
INSERT INTO org_credit_balances (
  org_id, subscription_tier, credits_included_monthly,
  credits_remaining, credits_used_this_period, monthly_credit_cap,
  period_start, period_end, updated_at
)
SELECT
  om.org_id,
  ucb.subscription_tier,
  ucb.credits_included_monthly,
  ucb.credits_remaining,
  ucb.credits_used_this_period,
  ucb.monthly_credit_cap,
  ucb.period_start,
  ucb.period_end,
  NOW()
FROM org_members om
JOIN user_credit_balances ucb ON ucb.user_id = om.user_id
WHERE om.org_id = 'dd201183-3cb5-45dd-8485-d17f5a053421'
ON CONFLICT (org_id) DO NOTHING;
```

---

## 4. Attribution Design

Every metered call records `(org_id, user_id, markup-adjusted cost)`.

**Changes needed:**

1. **`ai_usage_log`** — add column:
   ```sql
   ALTER TABLE ai_usage_log ADD COLUMN org_id UUID NULL REFERENCES organizations(id);
   CREATE INDEX ai_usage_log_org_id_idx ON ai_usage_log(org_id);
   ```
   Nullable for backward compat (pre-B2a rows have no org context).

2. **`MeteringMetadata`** — add field:
   ```typescript
   org_id?: string;   // resolved from org_members at call site
   ```

3. **`MeteringAdapter.logUsage()`** — include `org_id` in the INSERT:
   ```sql
   INSERT INTO ai_usage_log (user_id, org_id, deal_id, ...) VALUES ($1, $2, $3, ...)
   ```

B2c (admin view) queries `ai_usage_log` grouped by `(org_id, user_id)` — this is the
per-member attribution report. No schema changes needed at that point.

---

## 5. Resolution Path: user_id → org_id → pool

Every call resolves the spending member to their org before hitting the gate or decrement:

```sql
SELECT org_id FROM org_members WHERE user_id = $1 LIMIT 1
```

Result feeds:
```
org_id → SELECT credits_remaining FROM org_credit_balances WHERE org_id = $1  (gate)
org_id → UPDATE org_credit_balances SET credits_remaining - X WHERE org_id = $1  (decrement)
org_id → INSERT INTO ai_usage_log (org_id, user_id, ...)  (attribution)
```

**Solo tier (org-of-one — Scout/Operator/Principal):**
- `org_members` returns 1 row → user's org → org pool = that user's allotment
- Behavior is identical to S5 (per-user pool), just resolved via one JOIN
- No special-casing needed: the same path serves both org-of-one and org-of-many

**Institutional (org-of-many — future, after B2b invites):**
- `org_members` returns N rows (one per member)
- Any member's call resolves to the SAME `org_id` → draws from the SAME pool
- Gate blocks ALL members when the pool is empty (not just the member who spent it)

**No-org fallback (bridge users pre-B2b):**
- `org_members` returns 0 rows for users not yet in an org
- Gate: allow through (same policy as "no credit record" today — new user)
- B2b will fix this by auto-provisioning an org on bridge user creation

---

## 6. What Stays Per-User in B2a

The shift is surgical — the credit pool moves, billing identity stays.

| Per-user field | Stays in `user_credit_balances`? | Reason |
|---|---|---|
| `stripe_customer_id` | ✅ YES | Stripe billing identity is per-user until B3 |
| `subscription_tier` | ✅ YES (also in org) | Stripe token events keyed to user's customer ID; org tier for pool logic |
| `automation_level` | ✅ YES | User-level capability cap, not a pool attribute |
| `credits_remaining` | ❌ NO → moves to org | This IS the pool |
| `monthly_credit_cap` | ❌ NO → moves to org | Cap belongs to the org's subscription |
| `credits_used_this_period` | ❌ NO → moves to org | Pool accounting |
| `period_start / period_end` | ❌ NO → moves to org | Pool cycle |

`user_credit_balances` remains in place, unchanged. The gate and decrement stop reading/writing
the per-user balance columns; those columns go dormant (not dropped in B2a).

---

## Phase 2 Build Plan (pending approval)

Summarized scope once schema is approved:

1. **Migration `20260701_org_credit_balances.sql`** — create `org_credit_balances`, add `ai_usage_log.org_id`, seed dd201183 pool from Leon's current balance.

2. **`MeteringMetadata`** — add `org_id?: string` field (`types.ts`).

3. **org resolution helper** — `resolveOrgForUser(userId): Promise<string | null>` in a new `orgCreditService.ts` (single `SELECT org_id FROM org_members WHERE user_id = $1 LIMIT 1`).

4. **Gate shift** — `MeteringAdapter.createMessage()` resolves org, checks `org_credit_balances` instead of `user_credit_balances`.

5. **Decrement shift** — `MeteringAdapter.reportStripeCost()` decrements `org_credit_balances`. `CreditService.reserveCredits()` and `debitActualCost()` gain an org-aware variant or are superseded by `orgCreditService`.

6. **Attribution** — `logUsage()` includes `org_id`.

7. **Cycle reset** — new `orgCreditService.resetOrgPool(orgId)` called from invoice.paid webhook alongside (or replacing) per-user reset.

8. **Solo-tier proof** — confirmed by acceptance #4: dd201183 (org-of-one) gate + decrement + block = same as S5.

---

## Schema Approval Requested

**One question before Phase 2 starts:**

Does the `org_credit_balances` schema above match expectations, specifically:
- `stripe_customer_id` column reserved but NULL in B2a (populated in B3)?
- `subscription_tier` duplicated on the org pool (so the gate doesn't need to JOIN back to `user_credit_balances` for the tier)?
- `user_credit_balances` left in place, dormant (credits columns go stale), not dropped in B2a?

**On approval: Phase 2 builds the migration, shifts gate + decrement + reset + attribution.**
