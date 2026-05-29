# Phase 4 Runbooks — Table & Column Deprecation

These SQL scripts are **operator-run runbooks**. They must NOT be applied via
`drizzle-kit migrate` or any automated migration runner. They live here (outside
`backend/src/database/migrations/`) specifically to prevent accidental auto-execution.

## Scripts and execution order

| Order | File | When to run |
|---|---|---|
| 1 | `20260529_phase4_window1_write_revoke.sql` | After Phase 3 acceptance criteria fully met. Starts 7-day write-monitoring window. |
| 2 | `20260529_phase4_window2_read_revoke.sql` | After Window 1 clean for ≥ 7 days. Starts 7-day read-monitoring window. |
| 3 | `20260529_phase4_drop_tables.sql` | After Window 2 clean for ≥ 7 days AND all 7 archives verified in `PROPERTY_REFACTOR_ARCHIVE.md`. |
| 4 | `20260529_phase4_drop_columns.sql` | Immediately after drop_tables.sql in the same maintenance window. |
| 5 | `20260529_phase4_verify.sql` | Immediately after step 4. Read-only verification — safe to re-run any time. |

## How to run

The SET command and script execution **must happen in the same psql session**.
A separate `psql -c "SET ..."` followed by a separate `psql -f script.sql` will
NOT work — the session-local setting is lost between invocations.

### Without role override (auto-detect)

The script checks for a role named `app_user` automatically. If it does not
exist, it falls back to `CURRENT_USER` with a warning.

```bash
psql "$DATABASE_URL" \
  -f docs/operations/runbooks/phase4/20260529_phase4_window1_write_revoke.sql
```

### With explicit role override (recommended for multi-role environments)

```bash
# Option A: -c then -f in the same invocation (single session)
psql "$DATABASE_URL" \
  -c "SET app.revoke_role = 'your_app_role';" \
  -f docs/operations/runbooks/phase4/20260529_phase4_window1_write_revoke.sql

# Option B: heredoc (single session)
psql "$DATABASE_URL" <<'EOF'
SET app.revoke_role = 'your_app_role';
\i docs/operations/runbooks/phase4/20260529_phase4_window1_write_revoke.sql
EOF
```

Both options work because psql processes `-c` and `-f` (or `\i`) in the same
database session, so the `SET` persists for the duration of that session.

### Verifying role detection worked

Each window script prints NOTICE lines confirming which role was targeted and
whether privileges were actually removed (`has_table_privilege` check). Review
the output before declaring the monitoring window started.

## Monitoring during windows

See `docs/operations/PHASE4_MONITORING.md` for:
- Daily monitoring queries
- Window 1 and Window 2 daily log tables (fill in each day)
- Response playbook for each error type
- Schedule tracking

## Archive verification

Before running `phase4_drop_tables.sql`, all 7 entries in
`docs/operations/PROPERTY_REFACTOR_ARCHIVE.md` must show `ARCHIVE STATUS: VERIFIED`.

## Rollback

Phase 4 rollback is HIGH COST — restore from `pg_dump` archives.
See implementation map §Rollback Capability for details.
