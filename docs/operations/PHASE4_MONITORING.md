# PHASE 4 — MONITORING GUIDE

**Purpose:** Operational reference for the two 7-day monitoring windows before table/column DROPs  
**Last updated:** 2026-05-29

---

## Overview

Phase 4 requires two sequential 7-day monitoring windows before any DROP is executed:

| Window | What is revoked | What you monitor | Gate to advance |
|---|---|---|---|
| **Window 1** | INSERT/UPDATE/DELETE on deprecated tables; UPDATE on time-varying columns | Permission-denied errors in app logs | 7 days with zero write errors |
| **Window 2** | SELECT on deprecated tables; SELECT on time-varying columns | Runtime errors in app logs; shadow log divergences | 7 days with zero read errors |

Under Path B, a missed reader hits a **runtime error on a dropped column** rather than a clean permission error on a dropped table. The cost of a missed reader is higher than in a parallel-table migration, so both windows are mandatory and non-negotiable.

---

## Window 1 — Write Revocation Monitoring

### When to start

Window 1 begins when `phase4_window1_write_revoke.sql` is applied to production.

### What to check daily

**1. Application error logs — search for permission-denied on write paths:**
```bash
# Search application logs for permission denied on deprecated tables
grep -i "permission denied\|42501\|insufficient privilege" /var/log/app.log \
  | grep -i "deal_properties\|market_sale_comps\|market_rent_comps\|comp_properties\|recorded_transactions\|property_records\|property_sales_legacy\|building_class\|\.units\|building_sf\|current_occupancy\|acquisition_price"
```

**2. PostgreSQL error log — pg_log:**
```sql
-- Check pg_log for 42501 (insufficient_privilege) errors against deprecated targets
-- Replace with your log query mechanism
SELECT *
FROM pg_log_entries  -- or equivalent log table if available
WHERE error_code = '42501'
  AND message ~* 'deal_properties|market_sale_comps|market_rent_comps|comp_properties|recorded_transactions|property_records|property_sales_legacy'
  AND log_time > NOW() - INTERVAL '24 hours';
```

**3. Dual-write failure table — confirm no new rows:**
```sql
SELECT COUNT(*) AS failures_last_24h,
       MAX(created_at) AS most_recent
FROM property_dual_write_failures
WHERE created_at > NOW() - INTERVAL '24 hours';
-- Expected: 0 failures
```

**4. Shadow log — confirm no new divergences (should be empty before Window 1 since Phase 3 is complete):**
```sql
SELECT reader_id,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE NOT match) AS diverged
FROM property_reader_shadow_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY reader_id
ORDER BY diverged DESC;
-- Expected: 0 rows (all flags at true; shadow comparison no longer running)
```

### Window 1 daily log (fill in during monitoring)

| Day | Date | Write errors? | Action taken | Cleared? |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 | | | | |

**Window 1 verdict:** ☐ CLEAR — proceed to Window 2  /  ☐ ERROR FOUND — restarting window (new start date: _______)

---

## Window 2 — Read Revocation Monitoring

### When to start

Window 2 begins when `phase4_window2_read_revoke.sql` is applied to production.
**Prerequisite:** Window 1 log above shows 7 consecutive days with no write errors.

### What to check daily

**1. Application error logs — search for errors on read paths:**
```bash
# Errors that look like "column does not exist", "relation does not exist",
# or 42501/42P01 against deprecated tables/columns
grep -E "42703|42P01|column.*does not exist|relation.*does not exist|42501" /var/log/app.log \
  | grep -i "deal_properties\|market_sale_comps\|market_rent_comps\|comp_properties\|recorded_transactions\|property_records\|property_sales_legacy\|building_class\|\.units\b\|building_sf\|current_occupancy\|acquisition_price"
```

**2. API error rate — watch for any 5xx spike:**
```sql
-- If you have an API request log table
SELECT
  DATE_TRUNC('hour', created_at) AS hour,
  COUNT(*) FILTER (WHERE status_code >= 500) AS errors_500,
  COUNT(*) AS total
FROM api_request_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY 1 DESC;
-- Baseline: compare to same time last week; any spike = investigate
```

**3. Specifically check highest-risk readers:**

These readers are most likely to have residual reads if Phase 3 was incomplete:

```sql
-- R-009: Valuation Grid comp side (largest behavioral change)
-- Check that comp queries are NOT hitting market_sale_comps
-- (If this surfaces an error here, Phase 3 R-009 is not complete)

-- R-018: Property grid (249K-row property_records read)
-- Check that grid queries are NOT hitting property_records

-- R-030: JEDI score (7 deal_properties join paths)
-- Check that score queries are NOT hitting deal_properties

-- Run explain on a sample deal to verify query plans use new tables:
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM property_characteristics
WHERE property_id = (SELECT property_id FROM deals WHERE id = '<sample-deal-id>');
-- Should show index scan on idx_prop_char_property_id, not a seq scan on property_records
```

**4. Confirm FK cascade integrity:**
```sql
-- After Window 2, verify no orphaned property_characteristics rows
-- (should not happen since we only DROP tables, not properties rows)
SELECT COUNT(*) AS orphaned_characteristics
FROM property_characteristics pc
WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = pc.property_id);
-- Expected: 0
```

### Window 2 daily log (fill in during monitoring)

| Day | Date | Read errors? | Action taken | Cleared? |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 | | | | |

**Window 2 verdict:** ☐ CLEAR — proceed to DROP scripts  /  ☐ ERROR FOUND — restarting window (new start date: _______)

---

## Pre-DROP Final Checklist

Run immediately before applying `phase4_drop_tables.sql` + `phase4_drop_columns.sql`:

```sql
-- 1. No active queries on deprecated tables
SELECT pid, query_start, state, query
FROM pg_stat_activity
WHERE query ~* 'deal_properties|market_sale_comps|market_rent_comps|comp_properties|recorded_transactions|property_records|property_sales_legacy'
  AND state != 'idle';
-- Expected: 0 rows

-- 2. property_sales has data (backfill verified)
SELECT COUNT(*) FROM property_sales;
-- Expected: ≥ 681K rows (Phase 2 Backfill 3)

-- 3. property_characteristics has data
SELECT COUNT(*) FROM property_characteristics;
-- Expected: > 0 rows (Phase 2 Backfill 2)

-- 4. All deals have property_id set
SELECT COUNT(*) AS unlinked_deals
FROM deals
WHERE property_id IS NULL;
-- Expected: 0 rows (Phase 2 Backfill 5)

-- 5. Archive registry complete
-- (manual check: all 7 entries in PROPERTY_REFACTOR_ARCHIVE.md show VERIFIED)
```

---

## Response Playbook — If an Error Surfaces

### Scenario A: Permission-denied on a write path (Window 1)

1. Identify the error: which table, which operation (INSERT/UPDATE/DELETE), which code path
2. Check git blame / recent deploys for missed writer
3. Remove the write path or redirect to new table
4. Do NOT proceed to Window 2 until the missed writer is resolved
5. Restart the 7-day Window 1 clock from the date the fix is deployed

### Scenario B: Permission-denied on a read path (Window 2)

1. Identify the error: which table/column, which code path, which reader ID
2. This reader was missed in Phase 3 migration — check reader audit for flag status
3. Complete the Phase 3 migration for this reader (flag → shadow → canary → true)
4. Do NOT drop the table/column until the reader is fully migrated
5. Restart the 7-day Window 2 clock

### Scenario C: Runtime error after DROP (post-drop)

1. Immediately execute rollback from archive:
   ```bash
   pg_restore --dbname="$DATABASE_URL" \
     "/backups/property_refactor_phase4_<TABLE>_<DATE>.dump"
   ```
2. This is a HIGH COST rollback (see implementation map). Communicate immediately.
3. Identify the missed reader and complete Phase 3 migration for it
4. Re-run both 7-day monitoring windows from the beginning after the fix

---

## Schedule Tracking

| Milestone | Target date | Actual date | Notes |
|---|---|---|---|
| Phase 3 acceptance criteria confirmed | TBD | | All 37 readers at flag=true |
| Window 1 applied to production | TBD | | |
| Window 1 clean (day 7) | TBD | | |
| Window 2 applied to production | TBD | | |
| Window 2 clean (day 7) | TBD | | |
| Archives taken and verified | TBD | | All 7 entries VERIFIED |
| DROP scripts applied | TBD | | Maintenance window |
| Phase 4 acceptance gate confirmed | TBD | | |
