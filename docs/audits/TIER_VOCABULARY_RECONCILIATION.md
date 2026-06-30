# Tier Vocabulary Reconciliation

**Date:** 2026-06-30  
**Mode:** READ-ONLY — no changes applied  
**HEAD SHA:** `710359cb2f2c87e99a29c16d5bcf25f71d199a2d`  
**Dispatch spec:** `attached_assets/TIER_VOCABULARY_RECONCILIATION_1782834411931.md`  
**Evidence rule (S1-01):** every tier claim carries `file:line` or live DB output.

---

## LIVE DB STATE BEFORE ANYTHING ELSE

```sql
SELECT subscription_tier, COUNT(*) FROM user_credit_balances GROUP BY subscription_tier ORDER BY 1;

 subscription_tier | count
-------------------+-------
 operator          |     2
(1 row)
```

**Only `operator` rows exist.** No `basic`, `scout`, `principal`, `institutional`, `free`, `team`, `enterprise`, or `professional` rows are present.

---

## VOCABULARY 1 — Credit-billing tiers (`TIER_CONFIG`)

**Source:** `backend/src/services/ai/creditService.ts:26–84`  
**Type:** `backend/src/types/dealContext.ts:388` — `export type SubscriptionTier = 'scout' | 'basic' | 'operator' | 'principal' | 'institutional'`  
**Column:** `user_credit_balances.subscription_tier` — type `text` (not enum-constrained)

| Tier | `file:line` | maxAutomationLevel | surfaces | monthlyFee | Live rows |
|---|---|---|---|---|---|
| scout | `creditService.ts:27` | 1 | chat | $49 | **0** |
| basic | `creditService.ts:40` | 1 | chat | $49 | **0** |
| operator | `creditService.ts:51` | 2 | chat, web | $97 | **2** |
| principal | `creditService.ts:62` | 3 | chat, web, api | $197 | **0** |
| institutional | `creditService.ts:73` | 4 | chat, web, api | custom | **0** |

**This vocabulary is the live entitlement authority.** `TIER_CONFIG[tier]` is the source for all surface gates, automation level caps, credit quotas, and markup rates.

---

## VOCABULARY 2 — PostgreSQL enum `subscription_tier`

```sql
SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typname ILIKE '%tier%' ORDER BY e.enumsortorder;

    typname        | enumlabel
-------------------+--------------
 subscription_tier | free
 subscription_tier | professional
 subscription_tier | team
 subscription_tier | enterprise
```

**This enum exists in the database but is not attached to any live column.**

```sql
SELECT column_name, data_type, udt_name FROM information_schema.columns
WHERE table_name = 'user_credit_balances' AND column_name = 'subscription_tier';

 column_name       | data_type | udt_name
-------------------+-----------+---------
 subscription_tier | text      | text        ← not the enum
```

The `users` table has **no `subscription_tier` column at all.**

**Conclusion:** The `free / professional / team / enterprise` enum is a dead schema artifact. It was the RBAC vocabulary from a prior architecture (referenced in A9 work notes as "the F2b legacy-vocab lockout"). It is not used by any live column. It constrains nothing.

---

## VOCABULARY 3 — Deal-tier schema (separate concept)

`backend/src/validation/schemas.ts:89`:
```typescript
export const DealTierSchema = z.enum(['basic', 'standard', 'premium']);
```

This is a **deal access level** (deal capsule sharing permission), not a user subscription tier. `'basic'` here means "read-only deal capsule access" — unrelated to the `basic` billing tier. This vocabulary is internal to the capsule-sharing flow and does not appear in `TIER_CONFIG` or `user_credit_balances`.

---

## RECONCILED TIER TABLE

| Tier value | Source(s) | Live row count | What it gates | Status |
|---|---|---|---|---|
| `scout` | TIER_CONFIG (`creditService.ts:27`), `SubscriptionTier` type, Stripe webhook mapping | 0 | surfaces=['chat'], automation_level≤1, 100 credits/mo | **LIVE** — no users yet |
| `basic` | TIER_CONFIG (`creditService.ts:40`), `SubscriptionTier` type; fallback in deal reads | 0 | Same as scout; comment: "legacy / pre-launch" | **LEGACY** — in config for backward compat, never provisioned by live paths (see §basic below) |
| `operator` | TIER_CONFIG, Stripe webhook mapping, 2 live UCB rows | 2 | surfaces=['chat','web'], automation_level≤2, 500 credits/mo | **LIVE** |
| `principal` | TIER_CONFIG, Stripe webhook mapping | 0 | surfaces=['chat','web','api'], automation_level≤3, 2000 credits/mo | **LIVE** — no users yet |
| `institutional` | TIER_CONFIG, Stripe webhook mapping | 0 | surfaces=['chat','web','api'], automation_level≤4, custom credits | **LIVE** — no users yet |
| `free` | `settings-ai.routes.ts:88` INSERT hardcode; null-safety fallback string only | 0 | **Not in TIER_CONFIG** — any TIER_CONFIG lookup on `'free'` returns `undefined` | **ORPHANED / LATENT BUG** — see §free below |
| `professional` | PostgreSQL enum `subscription_tier` only | 0 | Nothing (enum not used by any column) | **DEAD** |
| `team` | PostgreSQL enum; `module_name: 'team'` in deal module config (different concept) | 0 | Nothing (enum not used; `module_name` is a feature flag, not a tier gate) | **DEAD** |
| `enterprise` | PostgreSQL enum; `userTier?: 'free' \| 'pro' \| 'enterprise'` in `unified-orchestrator.ts:50` | 0 | Nothing (enum not used; orchestrator type is a stale local typedef not wired to UCB) | **DEAD** |

---

## `basic` — PROVENANCE

`creditService.ts:38–50` carries `basic` with the comment:
> "A5-F4: 'basic' tier — legacy / pre-launch tier mapped to same config as scout. getAllowedTriggerModes('basic') returns ['manual', 'event-driven'] (dev/testing)."

**No live path provisions `basic`:**
- `billing.routes.ts:172`: `provisionUser(userId!, 'dev_auto', 'scout')` — always 'scout'
- `webhookHandlers.ts:62–79`: Stripe product map (`PRODUCT_TO_TIER`) has entries for scout/operator/principal/institutional only — no product ID maps to 'basic'
- `settings-ai.routes.ts:88`: inserts `subscription_tier = 'free'` (not 'basic') as first-touch fallback

`'basic'` appears in several places as a **deal-read fallback default** (`row.tier || 'basic'` — `inline-deals.routes.ts:254,327,769`; `deals.service.ts:34`). This fallback refers to `deals.tier`, not `user_credit_balances.subscription_tier` — a different column on a different table. The deal's own tier field defaults to 'basic' as a display/permission shorthand; it does not drive TIER_CONFIG lookups.

**Status: LEGACY.** Safe to leave in TIER_CONFIG for now (removing it without grepping all fallback paths is risky). Flag for cleanup pass.

---

## `free` — ORPHANED / LATENT BUG

`settings-ai.routes.ts:88` hardcodes a UCB INSERT with `subscription_tier = 'free'`:
```typescript
INSERT INTO user_credit_balances (user_id, subscription_tier, ...)
VALUES ($1, 'free', $2, 100, 100, 0, NOW(), NOW() + INTERVAL '1 month')
```

`'free'` is **not in `SubscriptionTier`** and **not in `TIER_CONFIG`**. If this INSERT fires (user saves AI preferences before a UCB row exists), any subsequent code path that calls `TIER_CONFIG[balance.subscriptionTier]` will get `undefined` and crash. Zero rows exist today (the INSERT only fires for users with no UCB row — a transient state that currently resolves before this endpoint is hit). This is a latent bug, not an active one. Flag for fix — either add `'free'` to TIER_CONFIG (mapped to scout) or change the INSERT to `'scout'`.

**Additionally:** five sites in `settings-ai.routes.ts` use `?? 'free'` / `|| 'free'` as a null-safety fallback for the local `tier` variable (not for DB writes). These are safe-fallback patterns reading the result of a SELECT, not tier gates. They don't write 'free' to the DB. The only DB write is line 88.

---

## `team` / `enterprise` / `professional` — DEAD VOCABULARY

**PostgreSQL enum `subscription_tier`** (`free`, `professional`, `team`, `enterprise`):  
Not used by any live column. `user_credit_balances.subscription_tier` is `text`. `users` has no `subscription_tier` column. The enum is an orphaned schema object from the prior RBAC vocabulary. Zero rows carry these values anywhere.

**`module_name: 'team'`** (`inline-deals.routes.ts:1117,1136`; `index.legacy.ts:563,580`):  
This is a **deal module feature flag name** (`deal_modules` table), not a subscription tier. No tier gate reads it.

**`userTier?: 'free' | 'pro' | 'enterprise'`** (`unified-orchestrator.ts:50`):  
Stale local typedef on an orchestrator context object. Not sourced from UCB, not gated against TIER_CONFIG. Dead.

**`index.legacy.ts`**: Not imported in `index.replit.ts` or `routes/index.ts`. The file is not mounted in the live application. All legacy-vocab references (`'free'`, `'basic'`, `'team'`, `'professional'`) within it are inert.

---

## MULTI-USER / TEAM ACCESS — DIRECT ANSWER

**Does any current subscription grant team/multi-user access?**

**No.** No subscription tier gates team or org membership.

The org/collaboration system **exists and is populated** (`organizations`: 38 rows, `org_members`: 38 rows, `deals.org_id` column exists). It is mounted and live:
- `routes/index.ts:499`: `app.use('/api/v1/orgs', requireAuth, orgRouter)` — org CRUD
- `routes/index.ts:463`: `app.use('/api/v1/organization', organizationRouter)` — org profile
- `collaboration.routes.ts`: deal-level team members via `deal_team_members` table
- `agent-runs.routes.ts:90`: deal access checks include `org_members` LEFT JOIN

**But `requireAuth` is the only gate** on org routes — no `requireSurface('web')`, no tier check. Any authenticated user can create an org and invite members regardless of subscription tier. Team/org access is not a billing feature in the current system.

The `subscription_tier` enum value `team` exists in the DB schema but:
1. Is not used by any live column
2. Has zero rows
3. Gates nothing
4. Is named 'team' but does not correspond to a multi-user billing plan

**Bottom line:** "team access" in the live product is available to all authenticated users (it's not paywalled). The `team` enum value is dead vocabulary with no behavioral meaning.

---

## VOCABULARY DIVERGENCE FINDINGS

| Question | Finding |
|---|---|
| Are the two `subscription_tier` columns on the same enum? | `user_credit_balances.subscription_tier` is `text`. `users` has no `subscription_tier` column. The legacy enum (`free/professional/team/enterprise`) is not used by either. Divergence is moot — the enum is attached to nothing. |
| Is `basic` live or legacy? | **Legacy** — in TIER_CONFIG with "legacy / pre-launch" comment, zero live rows, no active provisioning path |
| Are `free/professional/team/enterprise` dead? | **Yes, all dead.** Zero rows, enum not attached to any live column, no live gates read these values |
| Latent bug? | Yes: `settings-ai.routes.ts:88` can write `subscription_tier = 'free'` — not in TIER_CONFIG, would crash downstream lookups |

---

## FLAGS (not actioned — each requires separate dispatch)

1. **`subscription_tier` enum orphan** — `free/professional/team/enterprise` enum exists in DB but attaches to nothing. Candidate for `DROP TYPE subscription_tier` once all migration scripts are audited.
2. **`basic` in TIER_CONFIG** — legacy holdover. Safe to remove once all `|| 'basic'` fallback sites on `deals.tier` (not UCB) are audited. Not urgent.
3. **`settings-ai.routes.ts:88` latent bug** — hardcoded `subscription_tier = 'free'` insert is not in TIER_CONFIG. Fix: change to `'scout'` or add a `'free'` config entry mapped to scout. Low active risk (zero rows today), medium crash risk on first trigger.
4. **`unified-orchestrator.ts:50` stale type** — `userTier?: 'free' | 'pro' | 'enterprise'` should be replaced with `SubscriptionTier` or removed. Documentation-level cleanup.
5. **`index.legacy.ts`** — unmounted dead file. Candidate for deletion after confirming no import elsewhere.
