# Evidence Rows Investigation

**Dispatch:** 1B — deal_evidence_rows table create + verify  
**Date:** 2026-05-25  
**Outcome:** No fix required. Table exists and is populated. Baseline audit note B3 was a naming error.

---

## Finding

The dispatch brief stated:

> "The CashFlow Agent's write_evidence_rows tool batches 15+ evidence entries per call into a
> table called `deal_evidence_rows`. The table does not exist. Writes are silently failing."

This is incorrect. The `write_evidence_rows` tool has never referenced a table called
`deal_evidence_rows`. The tool's actual INSERT target, as written in
`backend/src/agents/tools/write_evidence_rows.ts` line 85, is `underwriting_evidence`.

---

## Step 1 — Investigation

### A. Tool implementation

**File:** `backend/src/agents/tools/write_evidence_rows.ts`

```
INSERT INTO underwriting_evidence
  (deal_id, agent_run_id, field_path, value_numeric, value_text,
   primary_tier, data_points, reasoning, alternatives, collision, confidence)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING id
```

The tool name is `write_evidence_rows`. The table it writes to is `underwriting_evidence`.
The name `deal_evidence_rows` does not appear anywhere in the codebase.

### B. Table existence

```sql
SELECT to_regclass('public.underwriting_evidence');  -- returns: underwriting_evidence
SELECT to_regclass('public.deal_evidence_rows');     -- returns: NULL (does not exist)
```

`underwriting_evidence` was created by migration `20260419_cashflow_evidence.sql` on 2026-04-19.
`deal_evidence_rows` was never created and is not referenced in any source file.

### C. Schema (as created in migration and confirmed in information_schema)

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | uuid | NOT NULL | PK, gen_random_uuid() |
| `deal_id` | uuid | NOT NULL | FK → deals(id) ON DELETE CASCADE |
| `agent_run_id` | uuid | YES | FK → agent_runs(id) |
| `field_path` | text | NOT NULL | dot-separated proforma path |
| `value_numeric` | numeric | YES | |
| `value_text` | text | YES | |
| `primary_tier` | integer | NOT NULL | 1–4 data tier |
| `data_points` | jsonb | NOT NULL | array of EvidencePoint objects |
| `reasoning` | text | NOT NULL | |
| `alternatives` | jsonb | NOT NULL | array of Alternative objects |
| `collision` | jsonb | YES | broker vs agent conflict detail |
| `confidence` | text | NOT NULL | CHECK IN ('high','medium','low') |
| `created_at` | timestamptz | NOT NULL | DEFAULT NOW() |

**Schema match:** The migration schema and the tool's INSERT column list are identical.

### C. Readers of underwriting_evidence

All readers reference `underwriting_evidence` — none reference `deal_evidence_rows`:

| File | Lines | Purpose |
|------|-------|---------|
| `backend/src/api/rest/cashflow-underwriting.routes.ts` | 217, 456, 734, 767, 828 | Evidence fetch for deal audit trail, field-level evidence, collision report |
| `backend/src/agents/tools/write_underwriting.ts` | 4 (comment only) | Documents the two-table write pattern |

No schema mismatch between writer and readers.

---

## Step 2 — Table state

```
underwriting_evidence  total rows: 11,102
```

Evidence for Sentosa Epperson (`3d96f62d-d986-448f-8ea4-10853021a8cb`):

| Run ID | Rows written | Date |
|--------|-------------|------|
| `01069927-520d-474f-826e-9044be33049f` (reference) | 20 | 2026-05-17 |
| `6253a15a-f9e9-43c8-9433-e56e7443ed18` (fresh) | 26 | 2026-05-25 |

The fresh run's 26 rows correspond exactly to the "batch 15 + batch 11" noted in the baseline.
The writes succeeded. The evidence trail is intact.

---

## Step 3 — Correction to CASHFLOW_AGENT_BASELINE.md

The baseline document at line 72 records:

> ✗ SILENT FAIL | Batch 15 + batch 11 = 26 evidence rows attempted.
> `deal_evidence_rows` table does not exist → silent fail

This is incorrect. The 26 rows were written successfully to `underwriting_evidence` and are
confirmed present (agent_run_id `6253a15a-f9e9-43c8-9433-e56e7443ed18`, 26 rows, timestamps
2026-05-25 13:45–13:46). The baseline observer saw the correct tool call but assumed the wrong
table name. Bug B3 is retracted.

The two real schema bugs from the baseline remain valid:
- **B1:** `fetch_rate_environment` macro fields returned as strings instead of numbers
- **B2:** `fetch_cycle_intelligence` `cap_rate_forecast` fields returned as strings instead of numbers

---

## Step 4 — Evidence gap assessment

Because writes were succeeding all along, there is **no evidence gap**. All agent runs since
2026-04-19 (migration date) have a full evidence trail in `underwriting_evidence`.

Prior to that migration (before April 19, 2026): `underwriting_evidence` did not exist.
Agent runs executed before that date have no evidence rows — not recoverable, consistent with
the dispatch's backfill guidance ("impossible — document the gap for runs before this fix").

---

## Summary

| Item | Status |
|------|--------|
| `deal_evidence_rows` table | Never existed, never referenced in code — phantom name |
| `underwriting_evidence` table | Exists, 11,102 rows, fully healthy |
| write_evidence_rows tool | Writing correctly since migration 2026-04-19 |
| Sentosa evidence trail | Intact — 20 rows (ref run) + 26 rows (fresh run) |
| B3 bug (baseline) | **Retracted** — was a naming error in the audit doc |
| B1, B2 schema bugs | Remain valid — not addressed in this dispatch |
| Backfill needed | None — no real gap exists |

**No code changes, migrations, or backfills were made. No action required.**
