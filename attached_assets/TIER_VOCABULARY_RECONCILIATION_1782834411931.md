# DISPATCH — TIER VOCABULARY RECONCILIATION (READ-ONLY)

**Mode:** READ-ONLY. Reconcile the multiple tier vocabularies in the system into one authoritative
table. Answer "does any subscription grant team/multi-user access." Fix nothing.
**Target:** running Replit instance + live DB.
**Repo:** `Nardo758/JediRe.git` @ HEAD — record SHA.
**Evidence rule (S1-01):** every tier's existence + meaning carries `file:line` (config/enum
definition) or live DB output (rows actually carrying that value). A tier named in a type but with
zero rows and zero gates is DEAD until proven otherwise.
**Report to:** `docs/audits/TIER_VOCABULARY_RECONCILIATION.md`

---

## WHY THIS RUNS

The backfill scope surfaced a `basic` tier (maxAutomationLevel=1) not in the stated product lineup
(Scout/Operator/Principal/Institutional). Separately, RBAC has historically carried a DIFFERENT
vocabulary — `free/professional/team/enterprise` (PostgreSQL enum) — which is where the F2b
legacy-vocab lockout lived. So there are at least two tier vocabularies, they don't line up, and the
user's question "does any subscription allow team access?" can't be answered until we know which
vocabulary is authoritative for entitlement and whether `basic`/`team`/`enterprise` are live, legacy,
or orphaned.

---

## TRACE — three vocabularies, reconcile to one

**1. Credit-billing tiers (the live one).** `TIER_CONFIG` — enumerate every tier with its
   maxAutomationLevel, credit allotment, surfaces, and price if present. `file:line`. Confirmed live
   values so far: scout=1, basic=1, operator=2, principal=3, institutional=4. For EACH, paste a live
   count:
   ```sql
   SELECT subscription_tier, COUNT(*) FROM user_credit_balances GROUP BY subscription_tier ORDER BY 1;
   ```
   Which tiers actually have users? Which are config-only (zero rows)?

**2. The RBAC enum.** Find the PostgreSQL enum type behind `users.subscription_tier` /
   `user_credit_balances.subscription_tier` (the A9 work noted these historically used different enum
   types). Paste the enum's allowed values:
   ```sql
   SELECT t.typname, e.enumlabel
   FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
   WHERE t.typname ILIKE '%tier%' OR t.typname ILIKE '%subscription%'
   ORDER BY t.typname, e.enumsortorder;
   ```
   Does `free/professional/team/enterprise` still exist as an enum? Does `scout/basic/operator/...`?
   Both? Are the two columns on the same enum type now, or still divergent?

**3. `basic` — provenance.** Where does `basic` come from? Is it in TIER_CONFIG with a real
   definition, or a legacy/default value? Does anything PROVISION `basic` (grep the provisioning +
   signup paths), or do the rows (if any) predate the current tier set? `file:line` + row timestamps.

**4. `team` / `enterprise` — live or dead?** The RBAC enum has `team`. Does ANYTHING gate on it?
   ```
   grep -rniE "'team'|\"team\"|'enterprise'|\"enterprise\"|'professional'|'free'" backend/src --include=*.ts
   ```
   Classify each hit: live gate / dead reference / type-def only. And live DB:
   ```sql
   SELECT subscription_tier, COUNT(*) FROM user_credit_balances WHERE subscription_tier IN ('free','professional','team','enterprise') GROUP BY 1;
   SELECT subscription_tier, COUNT(*) FROM users WHERE subscription_tier IN ('free','professional','team','enterprise') GROUP BY 1;
   ```
   If zero rows AND no live gate → `team`/`enterprise` are dead vocabulary.

**5. The actual question: multi-user / team access.** Is there ANY concept of a user belonging to an
   org/team/account with shared entitlement? Grep for `org`, `organization`, `team_id`, `account_id`,
   seat/member concepts on the user model. Does any billing tier grant more than one seat? `file:line`
   or DB. This is the literal answer to "does any subscription allow team access" — independent of
   whether a tier is NAMED 'team'.

---

## DELIVERABLE

- SHA + READ-ONLY header
- **One reconciled tier table:** every tier value that exists anywhere, with columns: source
  (TIER_CONFIG / RBAC enum / both), live row count, what it gates, status (LIVE / LEGACY / DEAD)
- **Direct answer to the user's question:** does any current subscription grant team/multi-user
  access? Yes/no, with the evidence — and if 'team' exists as an enum value but grants nothing,
  say exactly that (named-but-empty).
- **Vocabulary divergence finding:** are the two columns on the same enum yet, or still split? Is
  `basic` live or legacy? Are `free/professional/team/enterprise` dead?
- **Flag, don't fix:** any dead enum values or orphaned tiers are audit→classify→gate→delete
  candidates for a later pass, noted not actioned.

**STOP at the report. This is a reconciliation, not a cleanup. Any tier consolidation or dead-value
removal is a separate human-approved dispatch — enum changes touch entitlement and are never
batch-applied.**
