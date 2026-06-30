# DISPATCH — AND/OR PRECEDENCE AUDIT (READ-ONLY)

**Mode:** READ-ONLY. Find and classify, fix nothing. The stub-guard work caught a precedence bug in
`byClass`/`byMarket` (a bare `OR` arm escaped an `EXISTS` guard). That pattern is copy-paste-prone;
find every other instance and classify each as correct-or-broken.
**Repo:** `Nardo758/JediRe.git` @ HEAD — record SHA.
**Evidence rule (S1-01):** each flagged site carries the `file:line`, the actual predicate, and a
reasoned correct/broken call. Where "broken" is claimed, state what rows leak in or out.
**Report to:** `docs/audits/ANDOR_PRECEDENCE_AUDIT.md`

---

## PART A — DOWNSTREAM REACH OF THE KNOWN BUG (do this first)

Before hunting new instances, bound the one already found. The `byClass`/`byMarket` allocations in
`portfolio.routes.ts` were mis-scoped — they included rows the guard should have excluded.

1. Trace what consumes `byClass` and `byMarket` output. `file:line` for each consumer — frontend
   components, other endpoints, cached aggregates, anything that read those allocation breakdowns.
2. State the impact in plain terms: were displayed allocation percentages / dollar splits wrong,
   and by roughly how much (how many extra rows leaked into the denominator)? If determinable from
   git history, note how long the bug existed.
3. If any consumer cached or persisted the wrong allocations, flag it — a read-fix doesn't
   retroactively correct stored bad aggregates.

This is diagnosis only. Do not recompute or backfill anything.

---

## PART B — FIND THE PATTERN ELSEWHERE

The bug shape: a `WHERE` (or `JOIN ... ON`, or `HAVING`) clause mixing `AND` and `OR` where a
guard/filter condition is `AND`-joined but an unparenthesized `OR` arm escapes it. Canonical form:
`WHERE guard AND a OR b` parsed as `(guard AND a) OR b` when `guard AND (a OR b)` was intended — or
the inverse.

**Scan scope:** all SQL in `backend/src` — inline query strings, query-builder chains, raw
`sql\`\`` templates, `.where()` calls with string conditions. Both hand-written SQL and ORM
fragments.

**Search strategy (use several — one grep won't catch all forms):**
```
# raw SQL with OR not obviously parenthesized near AND
grep -rniE "where .*\band\b.*\bor\b" backend/src --include=*.ts
grep -rniE "\bor\b\s+[a-z_]+\s*(=|in|is|like)" backend/src --include=*.ts
# ON-clause and HAVING variants
grep -rniE "\bon\b.*\band\b.*\bor\b|\bhaving\b.*\band\b.*\bor\b" backend/src --include=*.ts
# query-builder OR methods that may sit beside AND-guards
grep -rniE "orWhere|\.or\(|orHaving" backend/src --include=*.ts
```
Greps over-capture — that's intended. The classification step filters.

---

## CLASSIFY EACH HIT

For every site the greps surface, record a row:

| field | content |
|---|---|
| `file:line` | exact location |
| predicate | the actual AND/OR clause, verbatim |
| parsed-as | how PostgreSQL/the builder actually evaluates it (precedence applied) |
| intended | what the surrounding code clearly meant (infer from variable names / guard intent) |
| verdict | CORRECT-AS-WRITTEN / MIS-SCOPED / AMBIGUOUS |
| leak | for MIS-SCOPED: what rows wrongly included or excluded, and which surface consumes them |

Three buckets only:
- **CORRECT-AS-WRITTEN** — precedence happens to match intent (parens present, or single-operator,
  or the OR genuinely belongs at top level). Most hits land here. Note briefly why and move on.
- **MIS-SCOPED** — like the byClass bug: a guard that doesn't cover the arm it should. State the leak.
- **AMBIGUOUS** — intent unclear from the code; can't tell if the precedence is a bug or deliberate.
  Name the one fact (a comment, a spec, the consumer's expectation) that would settle it.

---

## DELIVERABLE

- SHA + READ-ONLY header
- **Part A:** byClass/byMarket downstream-reach finding — consumers, impact, any cached bad aggregates
- **Part B:** the full classification table, sorted MIS-SCOPED first, then AMBIGUOUS, then a COUNT of
  CORRECT-AS-WRITTEN (don't enumerate all the correct ones — count them, list only anything notable)
- **Summary line:** N sites scanned, M mis-scoped, K ambiguous — and whether any mis-scoped site
  touches a launch-path surface (those would jump priority for a later fix dispatch)

**STOP at the report. No fixes, no parens added, no recompute. Each MIS-SCOPED finding becomes its
own scoped fix dispatch the human approves — precedence fixes change result sets and must be
verified against live data one at a time, not batch-patched.**
