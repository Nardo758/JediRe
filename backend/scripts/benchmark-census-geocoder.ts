/**
 * benchmark-census-geocoder.ts
 *
 * Exercises the new Census Geocoder → FIPS routing chain against all GA
 * blocked_needs_user intake jobs that have an address.
 *
 * Reports:
 *   (a) Of N blocked, how many got a Census-normalized address
 *   (b) Of those, how many resolved to a known FIPS code
 *   (c) Of those, how many returned property data from the routed adapter
 *   (d) Final unblock count
 *
 * Does NOT modify any job state. Safe to run on a live DB.
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only scripts/benchmark-census-geocoder.ts
 */

import { query } from '../src/database/connection';
import { censusGeocode } from '../src/services/geocoder/census/census-geocoder.client';
import { municipalEnrichment } from '../src/services/municipal-enrichment';

// ─── FIPS names for readable output ──────────────────────────────────────────

const FIPS_NAMES: Record<string, string> = {
  '13121': 'Fulton',
  '13089': 'DeKalb',
  '13067': 'Cobb',
  '13135': 'Gwinnett',
  '13057': 'Cherokee',
  '13063': 'Clayton',
  '13151': 'Henry',
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Pull all blocked GA jobs that have an address
  const jobsRes = await query<{
    id: string;
    parcel_id: string | null;
    source_data: Record<string, unknown> | null;
  }>(`
    SELECT id, parcel_id, source_data
      FROM intake_jobs
     WHERE state = 'blocked_needs_user'
       AND UPPER(COALESCE(
             source_data->>'state',
             state_col.val
           )) = 'GA'
     ORDER BY created_at
  `.replace('state_col.val', `''`));

  // Filter to rows that have an address field
  const jobs = jobsRes.rows.filter((j) => {
    const sd = j.source_data ?? {};
    const addr = (sd.address as string | undefined)?.trim();
    return !!addr;
  });

  console.log(`\n=== Census Geocoder Benchmark ===`);
  console.log(`Blocked GA jobs with address: ${jobs.length}\n`);

  if (jobs.length === 0) {
    console.log('Nothing to benchmark.');
    process.exit(0);
  }

  let geocoded      = 0;   // Census returned a match
  let fipsResolved  = 0;   // Census returned a known county FIPS
  let adapterOk     = 0;   // Adapter returned status:'ok'
  let fallbackOk    = 0;   // No FIPS but sequential chain found it anyway

  const failures: Array<{ id: string; address: string; reason: string; fips?: string }> = [];

  for (const job of jobs) {
    const sd = job.source_data ?? {};
    const address = (sd.address as string).trim();
    const city    = (sd.city  as string | undefined)?.trim() ?? null;
    const state   = 'GA';

    process.stdout.write(`  ${address.substring(0, 60).padEnd(60)} → `);

    // ── Step 1: Census Geocoder ──────────────────────────────────────────────
    let countyFips: string | null = null;
    let normalizedAddress: string | null = null;
    let geoLat: number | undefined;
    let geoLng: number | undefined;

    try {
      // Include city + state so Census can disambiguate short street addresses
      const geoQuery = city ? `${address}, ${city}, ${state}` : `${address}, ${state}`;
      const geo = await censusGeocode(geoQuery);
      if (geo) {
        geocoded++;
        normalizedAddress = geo.streetOnly;
        countyFips = geo.countyFips;
        geoLat = geo.lat ?? undefined;
        geoLng = geo.lng ?? undefined;
        if (countyFips) fipsResolved++;
      }
    } catch {
      // fallthrough
    }

    // Small delay to be kind to the Census API
    await new Promise((r) => setTimeout(r, 250));

    // ── Step 2: Municipal adapter via lookup() ───────────────────────────────
    const options = countyFips
      ? { countyFips, normalizedAddress: normalizedAddress ?? undefined, lat: geoLat, lng: geoLng }
      : undefined;

    let result: Awaited<ReturnType<typeof municipalEnrichment.lookup>>;
    try {
      result = await municipalEnrichment.lookup(address, state, city, options);
    } catch (err: any) {
      console.log(`ERROR (adapter threw): ${err?.message ?? String(err)}`);
      failures.push({ id: job.id, address, reason: 'adapter_threw', fips: countyFips ?? undefined });
      continue;
    }

    if (result.status === 'ok' && result.parcel_id) {
      if (countyFips) {
        adapterOk++;
      } else {
        fallbackOk++;
      }
      const county = countyFips ? (FIPS_NAMES[countyFips] ?? countyFips) : 'sequential';
      console.log(`OK  [${county}] parcel=${result.parcel_id}`);
    } else {
      const reason = countyFips
        ? `fips_${countyFips}_adapter_${result.status}`
        : (countyFips === null && !geocoded
            ? 'census_no_match_sequential_fail'
            : `sequential_${result.status}`);
      console.log(`FAIL [${reason}]`);
      failures.push({ id: job.id, address, reason, fips: countyFips ?? undefined });
    }
  }

  // ─── Summary ───────────────────────────────────────────────────────────────

  const totalUnblocked = adapterOk + fallbackOk;
  const target = Math.ceil(jobs.length * 50 / 66); // scale if jobs.length != 66

  console.log(`\n${'─'.repeat(72)}`);
  console.log(`RESULTS`);
  console.log(`${'─'.repeat(72)}`);
  console.log(`Total blocked GA jobs with address : ${jobs.length}`);
  console.log(`Census Geocoder matched            : ${geocoded} / ${jobs.length}`);
  console.log(`County FIPS resolved               : ${fipsResolved} / ${geocoded || 0}`);
  console.log(`Adapter OK (FIPS route)            : ${adapterOk}`);
  console.log(`Adapter OK (sequential fallback)   : ${fallbackOk}`);
  console.log(`──────────────────────────────────── `);
  console.log(`TOTAL UNBLOCKED                    : ${totalUnblocked} / ${jobs.length}`);
  console.log(`Acceptance bar (≥50/66)            : ${totalUnblocked >= 50 ? '✓ PASS' : '✗ FAIL — investigate before declaring complete'}`);

  if (failures.length > 0) {
    console.log(`\n── Still failing (${failures.length}) ──`);
    const byReason: Record<string, string[]> = {};
    for (const f of failures) {
      byReason[f.reason] = byReason[f.reason] ?? [];
      byReason[f.reason].push(f.address.substring(0, 55));
    }
    for (const [reason, addrs] of Object.entries(byReason)) {
      console.log(`\n  [${reason}] — ${addrs.length} address(es):`);
      addrs.forEach((a) => console.log(`    ${a}`));
    }
  }

  console.log('');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
