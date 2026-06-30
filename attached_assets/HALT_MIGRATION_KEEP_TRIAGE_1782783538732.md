# DISPATCH — HALT MIGRATION LOOP, KEEP TRIAGE CLASSIFICATION

**Mode:** STOP-AND-REDIRECT. You are iterating on the wrong artifact. Read this fully before the
next action. Do not run another validation cycle on the migration file.

---

## WHAT'S WRONG

You've run three validation cycles converging on a migration of `WHERE FALSE` / `WHERE id IN ()`.
A migration that executes nothing is not a migration — it's a runtime-dead file dressed as an
action. The linter failing was the correct signal that **this artifact should not exist**, not a
syntax problem to fix. Stop polishing it.

The triage's job was to CLASSIFY the orphaned `deal_category='portfolio'` rows and produce a
decision. It did that. The classification is the deliverable. The executable migration is not.

---

## DO THIS

**1. Delete the migration file entirely.** Whatever path you created it at — remove it. There is no
migration in this task. Confirm the file is gone (`ls` the migrations dir, paste output).

**2. Keep the audit/classification document.** That's the real output. It should contain, and only
contain:
   - The orphaned-row inventory (the 9 — reconcile against the "10" from the prior turn; see item 4)
   - Per-row evidence: `deal_monthly_actuals` count, `properties.name` state, external references
   - The explicit zero-count table you already built (`deal_files`, `deal_waterfalls`,
     `capital_calls`, `deal_investments`, `market_sale_comps`, `deal_comments`,
     `deal_monthly_actuals`, `market_rent_comps` = 0; `deal_assumptions` = 1, Westside Lofts only)
   - The 210-table scan-completeness appendix
   - **Decision recorded: LEAVE-AND-DOCUMENT.** These are synthetic stubs (zero actuals, NULL
     property names), safe to leave in place. No deletion at launch. Revisit post-launch in a
     non-launch window where any FK cascade can be observed.

**3. Add ONE consumer-guard note to the audit doc (documentation only, no code in this task):**
   any query reading `deal_category='portfolio'` as a signal of "live portfolio deal" must exclude
   these orphaned stub rows. Name the consumer(s) that need the guard (e.g. Dashboard filter,
   `useDealMode`) so the guard becomes its own scoped dispatch later. Do NOT write the guard now.

**4. Reconcile the count.** Prior turn referenced TEN orphaned rows; your scan worked NINE deal IDs.
   Resolve which is correct and state the reconciled number in the doc. A ±1 discrepancy on a set
   that could ever be deleted is a stop-and-recount condition. Paste the query that settles it.

**5. Leave Westside Lofts as its own open item.** It is the only row with a `deal_assumptions`
   reference — genuinely different from the other eight. Record it in the doc as a SEPARATE
   open item for individual review, NOT folded into the leave-and-document batch. No action on it.

---

## DO NOT

- Do not write, fix, or validate any migration.
- Do not DELETE any rows. Leave-and-document means leave.
- Do not write the consumer guard code — just name where it's needed.
- Do not touch Westside Lofts beyond recording it as an open item.

---

## DELIVERABLE

- Confirmation the migration file is deleted (paste `ls`)
- The finalized audit doc with: reconciled row count, per-row evidence, zero-count table, scan
  appendix, recorded LEAVE-AND-DOCUMENT decision, consumer-guard note, Westside Lofts as separate
  open item
- One-line status: classification complete, decision = leave-and-document, 0 rows deleted, 0
  migrations executed, 2 open items (consumer-guard dispatch + Westside Lofts review)

**STOP after the doc is finalized. No further iteration.**
