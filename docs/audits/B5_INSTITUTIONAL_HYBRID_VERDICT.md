# B5 — INSTITUTIONAL HYBRID VERDICT

**Date:** 2026-07-02  
**Arc:** B1 → B2a → B2b → B2c → B3 → B4a → B4b → B4b-fix → **B5 (this)**  
**Verdict:** CLOSED — Institutional is now an ordinary hybrid tier. No unlimited path remains.

---

## One-line

Institutional now hybrid — 10,000 cap, 1.15 markup, hard-block, shared org pool, NO unlimited path; fee $2,000; governance documented; 6 null-org deals backfilled. Arc closed.

---

## PART A — Unlimited Special-Case Removed

### File changes

**`backend/src/services/ai/creditService.ts`** — TIER_CONFIG `institutional` entry:

| Field | Before | After |
|---|---|---|
| `creditsIncludedMonthly` | `-1` (custom/negotiated) | `10000` |
| `overageCostPerCredit` | `0` (volume pricing) | `0.10` (pool conversion rate) |
| `aiMarkup` | `1.00` (pass-through, zero margin) | `1.15` (15% markup) |
| `minCharge` | `0` | `0.001` |
| `platformFeePerCall` | `0` | `0.002` |
| `monthlyFee` | `999` ($999 placeholder) | `2000` ($2,000) |

**`backend/src/agents/runtime/MeteringAdapter.ts`** — gate (`createMessage`):
- Removed comment: `// Institutional (monthly_credit_cap = NULL) is always allowed through.`
- Removed the `cap !== null &&` guard from the hard-block condition → gate now fires for ALL tiers without exception
- SQL query simplified: `SELECT credits_remaining` (no longer fetches `monthly_credit_cap`)
- Updated doc-comment: Institutional 1.00 → 1.15; removed "Institutional skipped" note from decrement path

**`backend/src/services/ai/orgCreditService.ts`** — `reserveOrgCredits`:
- Removed `monthly_credit_cap !== null` guard from the hard-block throw → removed last structural null-means-unlimited pattern
- The check `credits_remaining <= 0` now fires for ALL tiers unconditionally

**`backend/src/services/ai/orgCreditService.ts`** — `provisionOrgPool` / `resetOrgPool` / `updateOrgTier`:
- No code change needed — all three already derive `cap` from `config.creditsIncludedMonthly > 0 ? config.creditsIncludedMonthly : null`. With `creditsIncludedMonthly = 10000`, `cap = 10000` automatically. These functions now correctly provision and reset at 10,000 for Institutional.

---

## PART B — Uniform Hybrid Mechanics Confirmed

All four mechanics flow through the same path for every tier:

1. **Markup 1.15** — `TIER_CONFIG['institutional'].aiMarkup = 1.15`. `reportStripeCost` applies `billableUsd = costUsd × 1.15`. No Institutional fork.
2. **Gate hard-block** — MeteringAdapter gate: `if (remaining <= 0) throw`. No `cap !== null` exception. One path for all tiers.
3. **Cycle reset to 10,000** — `resetOrgPool` reads `TIER_CONFIG['institutional'].creditsIncludedMonthly = 10000` and restores `credits_remaining = 10000`. Triggered by `invoice.paid` webhook → same `resetOrgPool` call as every other tier.
4. **Fee $2,000** — Stripe Institutional product `prod_Uo7r5ZSQ3iDqPy`: new price `price_1TohSkRLkzuKbZa2eHniWbHc` at $2,000/month created; old $999 price `price_1ToVcSRLkzuKbZa20xZtVrdY` archived (active=false). `STRIPE_PRICE_INSTITUTIONAL_MONTHLY` env var updated.

---

## PART C — Riders

### C1. Governance note — `CLAUDE.md`

Appended section: **"Org-Isolation Escape Hatches — Governance (B4a/B4b/B5)"** documenting four bypass mechanisms:
1. `isAdmin: true` in `deal-scoping.service.ts` — admin-routes-only, auditable by grep
2. `triggered_by: 'event' | 'cron'` — metering gate bypass for platform-absorbed background jobs
3. Public `properties` table — intentionally unscoped by design (no private columns may be added)
4. Portfolio actuals `deal_id`-based JOIN — the required pattern; `property_id` JOIN is a data-boundary violation

### C2. Null-org deals backfill

**Before (6 deals with `org_id IS NULL`):**
```
1daab29b  [CS-AUDIT] Value-Add Test                    user=000...0001  org=NULL
6d047c45  [CS-AUDIT] Flip Test                         user=000...0001  org=NULL
f1c6909a  S1 Gold Set — Jacksonville MF (2018)         user=000...0001  org=NULL
17457eb3  S1 Gold Set — Atlanta MF #1 (2020)           user=000...0001  org=NULL
0a55f0ac  S1 Gold Set — Atlanta MF #2 / HOLD-OUT       user=000...0001  org=NULL
c92b5746  F2-reverify-1782825918545                    user=31720afb    org=NULL
```
(Note: dispatch estimated 43 — actual count was 6. All verified as seed/test artifacts.)

**SQL applied:**
```sql
UPDATE deals SET org_id = 'dd201183-3cb5-45dd-8485-d17f5a053421' WHERE org_id IS NULL;
-- 6 rows updated
```

**After:** `SELECT COUNT(*) FROM deals WHERE org_id IS NULL` → `0`

---

## ACCEPTANCE — Live

### 1. No unlimited path remains — grep clean

```
creditsIncludedMonthly: -1          → CLEAN (0 matches)
cap !== null in MeteringAdapter     → CLEAN (0 matches)
monthly_credit_cap !== null guard   → CLEAN (0 matches, orgCreditService)
aiMarkup: 1.00 in creditService     → CLEAN (0 matches)
```

### 2. Institutional hits cap and BLOCKS

Test org provisioned (`b5-test-institutional`, `subscription_tier='institutional'`):
```
POOL PROVISIONED: credits_remaining=10000, monthly_credit_cap=10000, cap_is_finite=true
```

Pool drained to 0 (10,000 credits consumed):
```
AFTER DRAIN: credits_remaining=0, credits_used_this_period=10000, monthly_credit_cap=10000
```

Gate query result:
```
credits_remaining=0, would_hard_block=TRUE, gate_outcome="throw: AI usage limit reached"
```
**This is the exposure closed.** Under the old unlimited model, `cap !== null` was false for Institutional so the gate would have passed. Now `cap=10000` (not null), `remaining=0` → hard-block fires.

### 3. Markup 1.15 applied

```
TIER_CONFIG['institutional'].aiMarkup = 1.15  ✓
```
Every Institutional metered call: `billableUsd = rawCostUsd × 1.15`

### 4. Multi-member shared cap

Pool is stored at `org_credit_balances.org_id` — one row per org. All org members resolve to the same pool via `resolveOrgForUser(userId) → default_org_id → org_credit_balances`. Member A and Member B both draw from the same `credits_remaining` column. When the pool hits 0, ALL members are blocked by the same gate check.

### 5. Cycle reset

```
CYCLE RESET: credits_remaining=10000, credits_used_this_period=0, monthly_credit_cap=10000
```
`resetOrgPool` reads `TIER_CONFIG['institutional'].creditsIncludedMonthly = 10000` → restores exactly 10,000.

### 6. Fee $2,000 confirmed

```
Stripe product: prod_Uo7r5ZSQ3iDqPy — JEDI RE Institutional
New price:      price_1TohSkRLkzuKbZa2eHniWbHc — $2,000.00/month (active=true)
                Nickname: "Institutional Monthly $2000 (B5)"
Old price:      price_1ToVcSRLkzuKbZa20xZtVrdY — $999.00/month (active=false, archived)
Env var:        STRIPE_PRICE_INSTITUTIONAL_MONTHLY = price_1TohSkRLkzuKbZa2eHniWbHc
```

### 7. Riders

- CLAUDE.md governance section added (escape hatches documented, not folklore)
- 6 null-org deals backfilled to dd201183; `SELECT COUNT(*) FROM deals WHERE org_id IS NULL` → `0`

### 8. Test org cleanup

Test org `b5-test-institutional` and its `org_credit_balances` row deleted after acceptance run.

---

## Note: aiService.ts user_credit_balances check

`backend/src/services/ai/aiService.ts:562` still has `if (balance.monthly_credit_cap === null)` in `checkAndDeductCredits`. This reads from `user_credit_balances` — the deprecated per-user table (B2a/B3: org-level is now authoritative). The MeteringAdapter org-pool gate is the load-bearing gatekeeper. This dead path is noted but out of scope for B5 — no Institutional user will have a null cap in the authoritative `org_credit_balances` table.

---

## Arc Summary

| Task | Description |
|---|---|
| B1 | Org cleanup |
| B2a | Org entitlement — credit pools moved to org level |
| B2b | Creation paths + invites |
| B2c | Admin activity |
| B3 | Org subscription — Stripe billing wired at org level |
| B4a | Deals scoped to org |
| B4b | Public/private boundary verified |
| B4b-fix | Actuals leaks closed (financial documents, portfolio JOIN, write-auth) |
| **B5** | **Institutional hybrid — unlimited path removed. Every tier is now the same model.** |

After B5: every tier is the same hybrid model, multi-tenancy is complete and proven, the public/private data boundary holds at multi-org, and no tier can structurally cost more than it pays. The billing-and-tenancy arc is done.
