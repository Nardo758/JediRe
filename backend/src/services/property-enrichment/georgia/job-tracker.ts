/**
 * Georgia Ingestion Job Tracker
 * Persists IngestionJob state to georgia_ingestion_jobs table.
 */

import { query as dbQuery } from '../../../database/connection';
import { IngestionJob } from './types';

/**
 * Insert a new job row at the start of an ingestion run (status = 'running').
 */
export async function createJobRecord(job: IngestionJob): Promise<void> {
  try {
    await dbQuery(
      `INSERT INTO georgia_ingestion_jobs
         (id, county, state, job_type, status, total_records, processed_records,
          inserted_records, updated_records, error_count, errors, started_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO NOTHING`,
      [
        job.id,
        job.county,
        job.state,
        job.jobType,
        job.status,
        job.totalRecords,
        job.processedRecords,
        job.insertedRecords,
        job.updatedRecords,
        job.errorCount,
        JSON.stringify(job.errors),
        job.startedAt,
      ]
    );
  } catch (err) {
    console.warn(`[JobTracker] createJobRecord failed (${job.id}): ${err}`);
  }
}

/**
 * Update an existing job row on completion or failure.
 */
export async function completeJobRecord(job: IngestionJob): Promise<void> {
  try {
    await dbQuery(
      `UPDATE georgia_ingestion_jobs SET
         status           = $2,
         total_records    = $3,
         processed_records= $4,
         inserted_records = $5,
         updated_records  = $6,
         error_count      = $7,
         errors           = $8,
         completed_at     = $9
       WHERE id = $1`,
      [
        job.id,
        job.status,
        job.totalRecords,
        job.processedRecords,
        job.insertedRecords,
        job.updatedRecords,
        job.errorCount,
        JSON.stringify(job.errors),
        job.completedAt ?? new Date(),
      ]
    );
  } catch (err) {
    console.warn(`[JobTracker] completeJobRecord failed (${job.id}): ${err}`);
  }
}

/**
 * Query recent jobs for a county.
 */
export async function getRecentJobs(county: string, limit = 10): Promise<object[]> {
  const result = await dbQuery(
    `SELECT id, county, state, job_type, status,
            total_records, processed_records, inserted_records,
            updated_records, error_count, errors,
            started_at, completed_at, created_at
     FROM georgia_ingestion_jobs
     WHERE LOWER(county) = LOWER($1)
     ORDER BY created_at DESC
     LIMIT $2`,
    [county, limit]
  );
  return result.rows;
}

/**
 * Get the most recent completed job for a county (any job_type).
 */
export async function getLastJob(county: string): Promise<object | null> {
  const result = await dbQuery(
    `SELECT id, county, state, job_type, status,
            total_records, inserted_records, error_count,
            started_at, completed_at
     FROM georgia_ingestion_jobs
     WHERE LOWER(county) = LOWER($1)
     ORDER BY created_at DESC
     LIMIT 1`,
    [county]
  );
  return result.rows[0] ?? null;
}
