# DISPATCH — FIX INVALID 'free' TIER INSERT

**Problem:** `settings-ai.routes.ts:88` can INSERT `subscription_tier='free'`, a value not in
TIER_CONFIG. Any downstream `TIER_CONFIG['free']` lookup returns `undefined` and crashes. Zero rows
today (luck, not safety) — the first user to trigger this route writes a row that poisons every
subsequent tier lookup for them. Live latent fault on a write path.
**Scope:** the invalid insert + an all-sites check for the same pattern. No backfill (zero rows).
**Repo:** `Nardo758/JediRe.git` — branch `claude/fix-invalid-free-tier-insert`, one commit.
**Verification rule (S1-01):** proven by a live trigger of the path writing a valid tier + a live DB
query, not a code read.
**Report to:** `docs/audits/INVALID_TIER_INSERT_FIX_VERDICT.md`

---

## FIRST — confirm the target and that it's the ONLY one

Don't fix one site blind. `'free'` appearing here means a hardcoded invalid tier literal was written
somewhere; the same pattern may exist elsewhere (this is the audit-all-sites rule — like the
precedence bug, find every instance when fixing one).

1. Read `settings-ai.routes.ts:88` — confirm exactly which table/column it writes and the literal
   value. `file:line`. Confirm it's `user_credit_balances.subscription_tier` (text) or name the real
   target.
2. Grep every site that writes a tier literal:
   ```
   grep -rniE "subscription_tier\s*[:=].*('|\")(free|pro|professional|team|enterprise|standard|premium|basic)('|\")" backend/src --include=*.ts
   grep -rniE "(insert|values|set).*subscription_tier" backend/src --include=*.ts
   ```
   Classify each hit: writes a VALID TIER_CONFIG key (scout/basic/operator/principal/institutional) /
   writes an INVALID literal (fix target) / reads-only. List them.

The valid TIER_CONFIG keys are the source of truth: scout, basic, operator, principal,
institutional. Anything writing a value outside that set into the tier column is a fix candidate.

---

## THE FIX

For `settings-ai.routes.ts:88` (and any other invalid-literal writer the grep finds):
change the hardcoded `'free'` to **`'scout'`** — the actual entry-level tier in TIER_CONFIG.
`file:line`, before/after.

If any other site writes a DIFFERENT invalid literal (e.g. `'pro'`), map it to the correct
TIER_CONFIG key by intent (entry-level → scout) and flag it for confirmation rather than guessing if
the intended tier is ambiguous.

Do NOT touch the orphaned PostgreSQL `subscription_tier` enum, `basic`, or any of the other
reconciliation cleanup items — those are a separate post-launch sweep. This dispatch is ONLY the
invalid-literal write fix.

---

## ACCEPTANCE — live

1. **No 'free' rows exist (pre-fix baseline):**
   ```sql
   SELECT COUNT(*) FROM user_credit_balances WHERE subscription_tier NOT IN ('scout','basic','operator','principal','institutional');
   ```
   Paste. Expected 0 — if non-zero, those rows need the backfill this dispatch assumed unnecessary;
   STOP and report.
2. **Trigger the fixed path live:** exercise the `settings-ai` route that does the insert, for a test
   user. Then query the row's `subscription_tier`. Paste request + result. Expected: `'scout'`, not
   `'free'`.
3. **TIER_CONFIG lookup no longer crashes:** confirm the value written resolves in TIER_CONFIG (a
   `TIER_CONFIG['scout']` lookup returns a real config, not undefined). Paste evidence.
4. **Grep clean:** paste the all-sites grep output with each hit classified; zero invalid-literal
   writers remain.
5. Clean up test user/rows.

---

## PR

- Branch `claude/fix-invalid-free-tier-insert`, one commit:
  `fix(billing): write valid 'scout' tier, not invalid 'free', in settings-ai provisioning`
- PR body: target confirmation, all-sites grep classified, before/after, the live acceptance proofs.

**STOP at acceptance. If baseline query (#1) finds existing invalid-tier rows, report before fixing —
the "zero rows" assumption breaks and a backfill enters scope.**
