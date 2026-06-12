/**
 * vault-enrich-deals.ts
 *
 * Backfill script: runs the full intake enrichment pipeline for all
 * deal-linked properties that lack a vault record in property_descriptions.
 *
 * Covers two cases:
 *   A) Properties with NO parcel_id: creates an intake_job, runs the
 *      pipeline (municipal lookup resolves the county parcel_id), then
 *      writes the resolved parcel_id back to properties.parcel_id.
 *
 *   B) Properties WITH a parcel_id but no property_descriptions row:
 *      creates an intake_job and runs the pipeline (municipality + web
 *      search + Places) to populate the vault.
 *
 * Idempotent: re-running creates a fresh intake_job per property but
 * does not overwrite existing user-sourced ('user') LayeredValue fields.
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only scripts/vault-enrich-deals.ts
 *   cd backend && npx ts-node --transpile-only scripts/vault-enrich-deals.ts --dry-run
 *   cd backend && npx ts-node --transpile-only scripts/vault-enrich-deals.ts --deal-id=<uuid>
 */

import { query } from '../src/database/connection';
import { processJobById } from '../src/services/intake-orchestrator/worker';

const DRY_RUN    = process.argv.includes('--dry-run');
const DEAL_FILTER = process.argv.find(a => a.startsWith('--deal-id='))?.split('=')[1] ?? null;

interface PropertyRow {
  property_id:  string;
  deal_id:      string;
  deal_name:    string | null;
  parcel_id:    string | null;
  prop_name:    string | null;
  address:      string | null;
  city:         string | null;
  state_code:   string | null;
  has_vault:    boolean;
}

async function findPropertiesNeedingEnrichment(): Promise<PropertyRow[]> {
  const dealCondition = DEAL_FILTER ? `AND p.deal_id = '${DEAL_FILTER}'` : '';

  const res = await query<PropertyRow>(
    `SELECT
       p.id                                        AS property_id,
       p.deal_id,
       d.name                                      AS deal_name,
       p.parcel_id,
       p.name                                      AS prop_name,
       p.address_line1                             AS address,
       p.city,
       p.state_code,
       (pd.parcel_id IS NOT NULL)                  AS has_vault
     FROM properties p
     JOIN deals d ON d.id = p.deal_id
     LEFT JOIN property_descriptions pd ON pd.parcel_id = p.parcel_id
     WHERE p.deal_id IS NOT NULL
       AND p.address_line1 IS NOT NULL
       ${dealCondition}
       AND (
         p.parcel_id IS NULL
         OR pd.parcel_id IS NULL
       )
     ORDER BY d.name, p.name`,
    [],
  );

  return res.rows.map(r => ({
    ...r,
    has_vault: r.has_vault === true || String(r.has_vault) === 'true',
  }));
}

async function upsertIntakeJob(prop: PropertyRow): Promise<string> {
  const sourceData = {
    property_id: prop.property_id,
    deal_id:     prop.deal_id,
    name:        prop.prop_name ?? undefined,
    address:     prop.address   ?? undefined,
    city:        prop.city      ?? undefined,
    state:       prop.state_code ?? undefined,
  };

  // Idempotent: if a prior backfill job already exists for this property,
  // reset it to 'pending' and clear its log so it re-runs cleanly.
  // Matches on source_data->>'property_id' (the canonical link) or parcel_id
  // so multiple re-runs always reuse the same row.
  const existing = await query<{ id: string }>(
    `SELECT id FROM intake_jobs
     WHERE source_type = 'deal_vault_backfill'
       AND (
         source_data->>'property_id' = $1
         OR (parcel_id IS NOT NULL AND parcel_id = $2)
       )
     ORDER BY created_at DESC
     LIMIT 1`,
    [prop.property_id, prop.parcel_id ?? ''],
  );

  if (existing.rows.length > 0) {
    const jobId = existing.rows[0].id;
    await query(
      `UPDATE intake_jobs
       SET state          = 'pending',
           parcel_id      = $1,
           source_data    = $2::jsonb,
           enrichment_log = '[]'::jsonb,
           block_reason   = NULL,
           last_error     = NULL,
           updated_at     = NOW()
       WHERE id = $3`,
      [prop.parcel_id ?? null, JSON.stringify(sourceData), jobId],
    );
    return jobId;
  }

  const res = await query<{ id: string }>(
    `INSERT INTO intake_jobs
       (parcel_id, state, source_type, source_data, enrichment_log, created_at, updated_at)
     VALUES
       ($1, 'pending', 'deal_vault_backfill', $2::jsonb, '[]'::jsonb, NOW(), NOW())
     RETURNING id`,
    [prop.parcel_id ?? null, JSON.stringify(sourceData)],
  );

  return res.rows[0].id;
}

/**
 * Returns true only when the string looks like a county-style parcel ID —
 * short (≤ 50 chars to fit the column), contains at least one digit, and
 * does not look like a full street address (no comma-separated city/state
 * components).  Rejects property-name strings used as fallback parcel IDs
 * when municipal lookup fails.
 */
function looksLikeCountyParcelId(s: string): boolean {
  if (!s || s.length > 50) return false;
  if (!/\d/.test(s)) return false;
  // Full addresses have a comma (e.g. "244 Biscayne Blvd, Miami, FL")
  if (s.includes(',')) return false;
  return true;
}

async function backfillParcelId(propertyId: string, jobId: string): Promise<string | null> {
  // Re-read from the job to get the final resolved parcel_id
  const jobRes = await query<{ parcel_id: string | null; enrichment_log: unknown[] }>(
    `SELECT parcel_id, enrichment_log FROM intake_jobs WHERE id = $1`,
    [jobId],
  );
  const resolvedParcelId = jobRes.rows[0]?.parcel_id ?? null;
  const log: any[] = (jobRes.rows[0]?.enrichment_log as any[]) ?? [];

  if (!resolvedParcelId) return null;

  // Only backfill when the municipal lookup actually succeeded with a real
  // county parcel_id — not just a fallback address string.
  const municipalOk = log.some(
    (e: any) => e.step === 'municipal_lookup' && e.status === 'ok',
  );
  if (!municipalOk) {
    console.log(`  skipping parcel_id backfill — municipal lookup did not resolve (value: "${resolvedParcelId}")`);
    return null;
  }

  if (!looksLikeCountyParcelId(resolvedParcelId)) {
    console.log(`  skipping parcel_id backfill — value does not look like a county parcel ID: "${resolvedParcelId}"`);
    return null;
  }

  await query(
    `UPDATE properties
     SET parcel_id  = $1,
         updated_at = NOW()
     WHERE id = $2
       AND (parcel_id IS NULL OR parcel_id != $1)`,
    [resolvedParcelId, propertyId],
  );

  return resolvedParcelId;
}

async function main(): Promise<void> {
  console.log('=== Vault Enrichment Backfill for Deal Properties ===');
  if (DRY_RUN)    console.log('[DRY RUN] No jobs will be created or processed.');
  if (DEAL_FILTER) console.log(`[FILTER]  Only deal ${DEAL_FILTER}`);
  console.log();

  const props = await findPropertiesNeedingEnrichment();
  console.log(`Found ${props.length} deal-linked properties needing vault enrichment:`);
  for (const p of props) {
    const caseLabel = !p.parcel_id ? 'CASE A (no parcel_id)' : 'CASE B (parcel_id, no vault)';
    console.log(`  ${caseLabel}  deal="${p.deal_name ?? p.deal_id}"  prop="${p.prop_name ?? p.address ?? p.property_id}"  parcel=${p.parcel_id ?? 'null'}  state=${p.state_code}`);
  }
  console.log();

  if (DRY_RUN) {
    console.log('Dry-run complete — no changes made.');
    process.exit(0);
  }

  let succeeded  = 0;
  let failed     = 0;
  let parcelBack = 0;

  for (const prop of props) {
    const label = `[${prop.deal_name ?? prop.deal_id}] ${prop.prop_name ?? prop.address}`;
    console.log(`Processing ${label} …`);

    let jobId: string;
    try {
      jobId = await upsertIntakeJob(prop);
      console.log(`  intake_job created: ${jobId}`);
    } catch (err: any) {
      console.error(`  FAILED to create job: ${err.message}`);
      failed++;
      continue;
    }

    try {
      await processJobById(jobId);
    } catch (err: any) {
      console.error(`  FAILED during enrichment: ${err.message}`);
      failed++;
      continue;
    }

    // Read final job state
    const stateRow = await query<{ state: string; parcel_id: string | null }>(
      `SELECT state, parcel_id FROM intake_jobs WHERE id = $1`,
      [jobId],
    );
    const finalState   = stateRow.rows[0]?.state ?? 'unknown';
    const jobParcelId  = stateRow.rows[0]?.parcel_id ?? null;
    console.log(`  job state: ${finalState}  resolved parcel_id: ${jobParcelId ?? 'none'}`);

    // Case A: backfill parcel_id onto the property row
    if (!prop.parcel_id && jobParcelId) {
      const written = await backfillParcelId(prop.property_id, jobId);
      if (written) {
        console.log(`  properties.parcel_id ← ${written}`);
        parcelBack++;
      }
    }

    // Verify vault row exists
    const vaultCheck = await query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM property_descriptions WHERE parcel_id = $1`,
      [jobParcelId ?? prop.parcel_id],
    );
    const vaultRows = parseInt(vaultCheck.rows[0]?.cnt ?? '0', 10);
    console.log(`  property_descriptions rows: ${vaultRows}`);

    succeeded++;
    console.log();
  }

  console.log('=== Summary ===');
  console.log(`Properties processed   : ${props.length}`);
  console.log(`Succeeded              : ${succeeded}`);
  console.log(`Failed                 : ${failed}`);
  console.log(`parcel_id backfills    : ${parcelBack}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
