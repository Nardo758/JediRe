/**
 * backfill-property-descriptions.ts
 *
 * Task C Step C3: replay enrichment_log entries from existing complete intake_jobs
 * into property_descriptions.
 *
 * RULES (per dispatch):
 * - Only replays CACHED log values — never re-runs the enrichment chain.
 * - Idempotent: safe to re-run; does not overwrite manual ('user') overrides.
 * - Orphan entries (write fails for a job) are flagged, not thrown.
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only scripts/backfill-property-descriptions.ts
 */

import { query } from '../src/database/connection';
import { writeBackToPropertyDescriptions, WriteBackResult } from '../src/services/intake-orchestrator/property-writeback';

interface IntakeJob {
  id: string;
  parcel_id: string | null;
  source_type: string | null;
  enrichment_log: Array<{ step: string; status: string; ts: string; detail?: Record<string, unknown> }>;
}

async function main() {
  console.log('=== Property Descriptions Backfill ===');
  console.log('Replaying enrichment_log → property_descriptions for all complete jobs\n');

  const jobsRes = await query<IntakeJob>(
    `SELECT id, parcel_id, source_type, enrichment_log
       FROM intake_jobs
      WHERE state = 'complete'
        AND enrichment_log IS NOT NULL
        AND jsonb_array_length(enrichment_log) > 0
      ORDER BY updated_at ASC`,
  );

  const jobs = jobsRes.rows;
  console.log(`Found ${jobs.length} complete jobs with non-empty enrichment_log\n`);

  let replayed = 0;
  let pdRowsUpdated = 0;
  let skipped = 0;
  let orphaned = 0;

  const fieldCounts: Record<string, number> = {};
  const orphanList: Array<{ id: string; parcel_id: string | null; reason: string }> = [];

  for (const job of jobs) {
    if (!job.parcel_id) {
      skipped++;
      continue;
    }

    let result: WriteBackResult;
    try {
      result = await writeBackToPropertyDescriptions(job.parcel_id, job.enrichment_log);
    } catch (err: any) {
      orphaned++;
      orphanList.push({ id: job.id, parcel_id: job.parcel_id, reason: err.message });
      console.error(`  ORPHAN  job ${job.id} (parcel ${job.parcel_id}): ${err.message}`);
      continue;
    }

    replayed++;
    if (!result.skipped) {
      pdRowsUpdated++;
      for (const f of result.fieldsWritten) {
        fieldCounts[f] = (fieldCounts[f] ?? 0) + 1;
      }
      console.log(
        `  OK      parcel ${result.parcelId.padEnd(25)} ` +
        `fields=[${result.fieldsWritten.join(', ')}] source=${result.source}`,
      );
    }
  }

  console.log('\n=== Backfill Summary ===');
  console.log(`Total jobs examined   : ${jobs.length}`);
  console.log(`Replayed              : ${replayed}`);
  console.log(`property_descriptions rows updated: ${pdRowsUpdated}`);
  console.log(`Skipped (no parcel_id): ${skipped}`);
  console.log(`Orphaned (write error): ${orphaned}`);

  if (Object.keys(fieldCounts).length > 0) {
    console.log('\nFields written (by column):');
    for (const [col, count] of Object.entries(fieldCounts).sort()) {
      console.log(`  ${col.padEnd(20)} : ${count}`);
    }
  }

  const parcelsAffected = new Set(
    jobs
      .filter((j) => j.parcel_id)
      .map((j) => j.parcel_id!),
  ).size;
  console.log(`\nDistinct parcels in complete jobs: ${parcelsAffected}`);

  if (orphanList.length > 0) {
    console.log('\n=== Orphan Log (manual review required) ===');
    for (const o of orphanList) {
      console.log(`  job=${o.id}  parcel=${o.parcel_id}  reason=${o.reason}`);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
