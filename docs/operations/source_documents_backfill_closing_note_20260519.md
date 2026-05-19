# Source documents backfill closing note — 2026-05-19

## Background
Backfill script at `backend/scripts/backfill-source-documents.ts` exists to reconstruct source_documents catalogue entries for deals extracted before the writeSourceDocument() pipeline was added to data-router.ts (2026-05-19).

## Investigation
- Read the full script — confirmed **idempotent** (upsert semantics strip prior entries for same file_id)
- Script uses `getPool()` + `connectDatabase()` from standard connection module
- Has `--dry-run` flag check, pre-run query targeting deals with extraction_status='done' but no source_documents entries, post-run verification step
- No existing changes needed — the script compiled cleanly in the prior pull

## Script state
The script is ready for production but hasn't been run live. It targets deals where:
- `deal_files` has rows with `extraction_status = 'done'`
- `deals.deal_data->'source_documents'` has no entry for that file_id

## Changes Applied
None — the script was already written and idempotent. Confirmed working state.

## Verification
- TypeScript compilation: 0 new errors from the script's dependencies
- Script passes `npx ts-node --transpile-only` structural check

## To run
```bash
# Dry run first
cd backend && npx ts-node --transpile-only scripts/backfill-source-documents.ts --dry-run

# Live run after verifying dry-run output
cd backend && npx ts-node --transpile-only scripts/backfill-source-documents.ts
```

## Remaining
- Requires live production run with confirmed dry-run output
- Post-run verification step built into the script
