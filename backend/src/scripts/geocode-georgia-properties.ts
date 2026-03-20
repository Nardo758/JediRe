import { getPool } from '../database/connection';

const pool = getPool();

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

interface GeoResult {
  city: string | null;
  lat: number | null;
  lng: number | null;
  zip: string | null;
  displayName: string | null;
}

function cleanAddress(address: string): string {
  let cleaned = address
    .replace(/\s+#\s*PH\s*(I+|[0-9]+)/i, '')
    .replace(/\s+# .+$/i, '')
    .replace(/\s+UNIT\s+\w+$/i, '')
    .replace(/\s+MU\s+\d+$/i, '')
    .replace(/\s+PM$/i, '')
    .replace(/\s+REAR$/i, '')
    .replace(/\s+CONN$/i, '')
    .replace(/\s+HMU$/i, '')
    .replace(/\s+STE\s+\w+$/i, '')
    .replace(/\s+APT\s+\w+$/i, '')
    .trim();
  return cleaned;
}

async function geocodeAddress(rawAddress: string, state: string): Promise<GeoResult> {
  const empty: GeoResult = { city: null, lat: null, lng: null, zip: null, displayName: null };
  const cleaned = cleanAddress(rawAddress);
  
  for (const addr of [cleaned, rawAddress]) {
    if (!addr.trim()) continue;
    const query = `${addr}, ${state}`;
    try {
      const url = `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1&countrycodes=us`;
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'JediRE/1.0 (contact@jedire.com)' },
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) continue;

      const data = (await resp.json()) as any[];
      if (!data || data.length === 0) {
        if (addr === cleaned && cleaned !== rawAddress) {
          await new Promise(r => setTimeout(r, 1100));
          continue;
        }
        return empty;
      }

      const result = data[0];
      const a = result.address || {};
      const city = a.city || a.town || a.village || a.hamlet || null;
      const zip = a.postcode || null;

      if (city) {
        return {
          city,
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          zip,
          displayName: result.display_name || null,
        };
      }
    } catch (err) {
      // try next variant
    }
    await new Promise(r => setTimeout(r, 1100));
  }
  return empty;
}

async function main() {
  console.log('Georgia Property Records City Geocoding\n');

  const records = await pool.query(`
    SELECT id, address, state, city, lat, lng, zip_code, county
    FROM property_records
    WHERE state = 'GA'
      AND units >= 100
      AND city IS NULL
      AND address IS NOT NULL
      AND TRIM(address) != ''
      AND address NOT LIKE '0 %'
    ORDER BY id
  `);

  console.log(`Found ${records.rows.length} records to geocode.\n`);

  if (records.rows.length === 0) {
    console.log('Nothing to do.');
    await pool.end();
    return;
  }

  let geocoded = 0;
  let failed = 0;
  const cityDistribution: Record<string, number> = {};
  const failedAddresses: string[] = [];

  for (let i = 0; i < records.rows.length; i++) {
    const row = records.rows[i];

    if (i > 0 && i % 50 === 0) {
      console.log(`Progress: ${i}/${records.rows.length} (geocoded: ${geocoded}, failed: ${failed})`);
    }

    const geo = await geocodeAddress(row.address, row.state);

    if (geo.city) {
      await pool.query(
        `UPDATE property_records
         SET city = $1,
             lat = COALESCE($2, lat),
             lng = COALESCE($3, lng),
             zip_code = COALESCE($4, zip_code),
             updated_at = NOW()
         WHERE id = $5`,
        [geo.city, geo.lat, geo.lng, geo.zip, row.id]
      );

      cityDistribution[geo.city] = (cityDistribution[geo.city] || 0) + 1;
      geocoded++;
    } else {
      failed++;
      failedAddresses.push(row.address);
    }

    await new Promise(r => setTimeout(r, 1100));
  }

  console.log('\n' + '='.repeat(60));
  console.log('GEOCODING RESULTS:');
  console.log('='.repeat(60));
  console.log(`  Total processed: ${records.rows.length}`);
  console.log(`  Successfully geocoded: ${geocoded}`);
  console.log(`  Failed: ${failed}`);
  console.log('\n  City distribution:');
  const sorted = Object.entries(cityDistribution).sort((a, b) => b[1] - a[1]);
  for (const [city, count] of sorted) {
    console.log(`    ${city}: ${count}`);
  }

  if (failedAddresses.length > 0) {
    console.log(`\n  Failed addresses (${failedAddresses.length}):`);
    for (const addr of failedAddresses.slice(0, 30)) {
      console.log(`    - ${addr}`);
    }
    if (failedAddresses.length > 30) console.log(`    ... and ${failedAddresses.length - 30} more`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('STEP 2: Updating rent_scrape_targets with geocoded cities...');
  console.log('='.repeat(60));

  const updateResult = await pool.query(`
    UPDATE rent_scrape_targets rst
    SET city = pr.city,
        market = pr.city,
        updated_at = NOW()
    FROM property_records pr
    WHERE rst.property_record_id = pr.id
      AND rst.source = 'property_records'
      AND pr.city IS NOT NULL
      AND TRIM(pr.city) != ''
      AND (rst.city != pr.city OR rst.market != pr.city)
  `);

  console.log(`  Updated ${updateResult.rowCount} rent_scrape_targets rows with correct city/market.`);

  console.log('\n' + '='.repeat(60));
  console.log('STEP 3: Deactivating out-of-market targets...');
  console.log('='.repeat(60));

  const VALID_GA_MARKETS = [
    'atlanta', 'sandy springs', 'roswell', 'alpharetta', 'johns creek',
    'milton', 'south fulton', 'college park', 'east point', 'hapeville',
    'union city', 'fairburn', 'palmetto', 'chattahoochee hills',
    'mountain park', 'decatur', 'brookhaven', 'dunwoody', 'doraville',
    'chamblee', 'tucker', 'stonecrest', 'clarkston', 'lithonia',
    'marietta', 'smyrna', 'kennesaw', 'acworth', 'powder springs',
    'austell', 'mableton', 'lawrenceville', 'duluth', 'suwanee',
    'norcross', 'peachtree corners', 'snellville', 'lilburn',
    'conyers', 'covington', 'mcdonough', 'stockbridge', 'morrow',
    'jonesboro', 'riverdale', 'forest park', 'douglasville',
    'woodstock', 'canton', 'holly springs', 'cumming',
    'savannah', 'macon', 'columbus', 'augusta'
  ];
  const placeholders = VALID_GA_MARKETS.map((_, i) => `$${i + 1}`).join(',');
  const deactivated = await pool.query(
    `UPDATE rent_scrape_targets SET active=FALSE, updated_at=NOW()
     WHERE source='property_records' AND state='GA' AND active=TRUE
       AND city IS NOT NULL
       AND LOWER(TRIM(city)) NOT IN (${placeholders})`,
    VALID_GA_MARKETS
  );
  console.log(`  Deactivated ${deactivated.rowCount} out-of-market targets.`);

  console.log('\n' + '='.repeat(60));
  console.log('FINAL SUMMARY:');
  console.log('='.repeat(60));

  const summary = await pool.query(`
    SELECT
      rst.market,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE rst.active = TRUE) AS active,
      COUNT(*) FILTER (WHERE rst.active = FALSE) AS inactive,
      COUNT(*) FILTER (WHERE rst.property_name IS NULL) AS needs_name,
      COUNT(*) FILTER (WHERE rst.places_search_done = TRUE) AS searched,
      COUNT(*) FILTER (WHERE rst.website_url IS NOT NULL) AS has_website
    FROM rent_scrape_targets rst
    WHERE rst.source = 'property_records'
    GROUP BY rst.market
    ORDER BY total DESC
  `);

  for (const row of summary.rows) {
    console.log(`  ${row.market}: ${row.total} total (${row.active} active, ${row.inactive} inactive, ${row.needs_name} need name, ${row.searched} searched, ${row.has_website} w/ website)`);
  }

  console.log('\nDone!');
  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  pool.end().then(() => process.exit(1));
});
