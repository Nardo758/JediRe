# DISPATCH — VOCABULARY FINALIZATION: is_fixture + 'system' user_type

**Why:** two small finalization changes that make Step 4's scope predicate provably clean and keep
the eval corpus out of real Pipeline views — both before the structural properties migration.
**Independence:** Part A (is_fixture) and Part B ('system' user_type) are SEPARATE concerns — keep
them as two commits, each with its own acceptance. Combined into one dispatch only because both are
small and both gate Step 4. Do not entangle them.
**Precondition:** the user_type cleanliness Phase 2 (m.dixon relabel, bridge relabels, sessionStore
INSERT fix) is merged and live. Confirm the running SHA carries it before Part B touches user_type.
**Repo:** `Nardo758/JediRe.git` @ HEAD — record SHA.
**Verification rule (S1-01):** schema + relabels proven by live before/after DB queries, not write
counts.
**Report to:** `docs/audits/VOCAB_FINALIZATION_VERDICT.md`

---

## PART A — is_fixture COLUMN (independent, cheap)

Keeps the 5 eval/fixture deals (S1 Gold Set, [CS-AUDIT]) out of real deal lists permanently and
explicitly, instead of relying on the agent-owner bypass.

1. **Add the column** (additive, default false, non-breaking):
   `ALTER TABLE deals ADD COLUMN is_fixture BOOLEAN NOT NULL DEFAULT FALSE;`
   Confirm it landed: `\d deals` or information_schema column query, paste.

2. **Backfill the 5 fixtures — by id, not by name match.** Use the exact 5 deal ids from the
   classification (the research-agent-owned S1 Gold Set + [CS-AUDIT] deals). Do NOT pattern-match on
   name (`ILIKE '%gold%'`) — that risks catching a real deal someone named similarly. List the 5 ids
   explicitly:
   ```sql
   UPDATE deals SET is_fixture = TRUE WHERE id IN (<5 explicit fixture deal ids>);
   ```
   Paste before/after. Expected exactly 5 rows.

3. **Verify no real deal was flagged:**
   ```sql
   SELECT id, name, user_id, is_fixture FROM deals WHERE is_fixture = TRUE;
   ```
   Confirm all 5 are the known fixtures, owned by the research agent, none are real. Paste.

Acceptance A: column exists, exactly 5 fixtures flagged, all verified as the known eval deals.
(Step 4 will later add `AND NOT is_fixture` to deal-list reads — NOT in this dispatch.)

---

## PART B — 'system' user_type VALUE (independent)

Makes `user_type NOT IN ('agent','system')` a clean scope/bypass partition, so the hardcoded
`SYSTEM_BYPASS_IDS` constant can eventually be removed.

1. **Add 'system' to the user_type TS union type** (user_type is text in DB, so no DDL — but the
   declared type set must include it). `file:line` of the type definition. Note: the type also
   declares `human_lp` / `human_lender` with zero rows — leave them, don't prune here.

2. **Relabel rockeman → 'system'** (unambiguous: startup-seeded infra, `index.replit.ts:1012`,
   live, kept). Single-row UPDATE, paste before/after.

3. **diagnostic — DECISION POINT, do not guess.** diagnostic is dormant (since Apr 26), zero code
   refs, and is also a dead-account-deletion candidate. Two valid futures:
   - KEEP → relabel to 'system' (then it's covered by the clean predicate), or
   - DELETE → handled by the dead-account cleanup dispatch; do NOT relabel here.
   **Do not relabel diagnostic in this dispatch.** Report it as the one open decision: until
   diagnostic is resolved (system-or-delete), its UUID must remain in `SYSTEM_BYPASS_IDS`. State this
   explicitly.

4. **Re-prove the partition:** after relabeling rockeman, test the target predicate:
   ```sql
   -- accounts that would be BYPASSED by the clean predicate:
   SELECT id, email, user_type FROM users WHERE user_type IN ('agent','system');
   -- accounts that would be SCOPED:
   SELECT id, email, user_type FROM users WHERE user_type NOT IN ('agent','system');
   ```
   Confirm: the BYPASSED set = the 5 agents + rockeman (+ diagnostic only if you relabeled it). The
   SCOPED set = all real humans + all bridge tenants, NO system/infra accounts. Paste both.
   If diagnostic is NOT yet 'system', note that it's the sole account still requiring the bypass
   constant — the predicate is clean for everything except that one pending decision.

Acceptance B: 'system' in the type, rockeman relabeled, partition proven clean modulo the documented
diagnostic decision.

---

## DELIVERABLE

- SHA + precondition confirmation (cleanliness Phase 2 is live)
- Part A: column added, 5 fixtures flagged by id, verified — before/after pasted
- Part B: 'system' added, rockeman relabeled, partition re-proven; diagnostic flagged as the single
  open keep-or-delete decision blocking constant removal
- One-line: is_fixture live (5 flagged); `user_type NOT IN ('agent','system')` clean except
  diagnostic pending

---

## OUT OF SCOPE

- Step 4 read-scoping itself (the `AND NOT is_fixture` and the bypass predicate wiring) — separate.
- properties org_id column (Step 2, structural) — next after this.
- f2a / diagnostic DELETION — dead-account cleanup dispatch.
- Pruning human_lp / human_lender unused type values — leave them.

**Two commits, two acceptances. diagnostic's fate is a flagged decision, not an action here.**
