/**
 * Planning Application Ingest Service
 *
 * Handles upsert of RawPlanningApplication records into the
 * planning_applications table.  Called by the nightly Inngest sweep job.
 *
 * Deduplication strategy: ON CONFLICT (case_number, jurisdiction) DO UPDATE
 * ensures the same case is never duplicated across nightly runs while still
 * capturing status changes (e.g. PENDING → APPROVED).
 *
 * Parcel linkage: after upsert, attempts to verify parcel_id against the
 * existing properties table. Linkage failure is non-fatal — the application
 * is still stored; linkage can be resolved in a later enrichment pass.
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

// ── Types ─────────────────────────────────────────────────────────────────

export interface RawPlanningApplication {
  case_number:      string;
  jurisdiction:     string;          // 'atlanta_dpcd' | 'fulton_county'
  application_type: string | null;
  applicant_name:   string | null;
  property_address: string | null;
  parcel_id:        string | null;   // County PIN; nullable
  current_zoning:   string | null;
  proposed_zoning:  string | null;
  filed_date:       Date | null;
  status:           string | null;
  hearing_date:     Date | null;
  source_url:       string | null;
  raw_json:         Record<string, unknown>;
}

export interface UpsertResult {
  inserted: number;
  updated:  number;
  errors:   number;
}

// ── Upsert ─────────────────────────────────────────────────────────────────

/**
 * Upsert a batch of planning applications.
 * Returns counts of inserted vs. updated rows.
 */
export async function upsertPlanningApplications(
  applications: RawPlanningApplication[],
): Promise<UpsertResult> {
  let inserted = 0;
  let updated  = 0;
  let errors   = 0;

  for (const app of applications) {
    try {
      const result = await query(
        `INSERT INTO planning_applications (
          case_number, jurisdiction, application_type, applicant_name,
          property_address, parcel_id, current_zoning, proposed_zoning,
          filed_date, status, hearing_date, source_url, raw_json,
          created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, NOW(), NOW())
        ON CONFLICT (case_number, jurisdiction) DO UPDATE SET
          application_type = EXCLUDED.application_type,
          applicant_name   = EXCLUDED.applicant_name,
          property_address = COALESCE(EXCLUDED.property_address, planning_applications.property_address),
          parcel_id        = COALESCE(EXCLUDED.parcel_id,        planning_applications.parcel_id),
          current_zoning   = COALESCE(EXCLUDED.current_zoning,   planning_applications.current_zoning),
          proposed_zoning  = COALESCE(EXCLUDED.proposed_zoning,  planning_applications.proposed_zoning),
          filed_date       = COALESCE(EXCLUDED.filed_date,       planning_applications.filed_date),
          status           = EXCLUDED.status,
          hearing_date     = COALESCE(EXCLUDED.hearing_date,     planning_applications.hearing_date),
          source_url       = COALESCE(EXCLUDED.source_url,       planning_applications.source_url),
          raw_json         = EXCLUDED.raw_json,
          updated_at       = NOW()
        RETURNING xmax`,
        [
          app.case_number,
          app.jurisdiction,
          app.application_type,
          app.applicant_name,
          app.property_address,
          app.parcel_id,
          app.current_zoning,
          app.proposed_zoning,
          app.filed_date ?? null,
          app.status,
          app.hearing_date ?? null,
          app.source_url,
          JSON.stringify(app.raw_json),
        ],
      );

      // xmax = 0 → fresh INSERT; xmax != 0 → UPDATE
      const row = result.rows[0] as any;
      if (row && parseInt(row.xmax as string, 10) === 0) {
        inserted++;
      } else {
        updated++;
      }
    } catch (err: any) {
      errors++;
      logger.error('[planning-ingest] Upsert error', {
        case_number:  app.case_number,
        jurisdiction: app.jurisdiction,
        error:        err?.message ?? String(err),
      });
    }
  }

  return { inserted, updated, errors };
}

// ── Parcel linkage ─────────────────────────────────────────────────────────

/**
 * Verify planning applications parcel IDs against the properties table.
 * Returns a count of matched properties.
 * Non-fatal: failures are logged but do not throw.
 */
export async function auditParcelLinkage(jurisdiction: string): Promise<number> {
  try {
    const result = await query(
      `SELECT COUNT(*) AS linked
       FROM planning_applications pa
       JOIN properties p ON p.parcel_id = pa.parcel_id
       WHERE pa.jurisdiction = $1
         AND pa.parcel_id IS NOT NULL`,
      [jurisdiction],
    );
    const row = result.rows[0] as any;
    return parseInt(row?.linked ?? '0', 10);
  } catch (err: any) {
    logger.warn('[planning-ingest] Parcel linkage audit failed (non-fatal)', {
      jurisdiction,
      error: err?.message ?? String(err),
    });
    return 0;
  }
}
