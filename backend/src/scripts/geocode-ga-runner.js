const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

const NOM = 'https://nominatim.openstreetmap.org';
const DELAY = 1100;

function clean(addr) {
  return addr
    .replace(/\s+#\s*PH\s*(I+|\d+)/i, '')
    .replace(/\s+#\s+.+$/i, '')
    .replace(/\s+UNIT\s+\w+$/i, '')
    .replace(/\s+MU\s+\d+$/i, '')
    .replace(/\s+(PM|REAR|CONN|HMU)$/i, '')
    .replace(/\s+STE\s+\w+$/i, '')
    .replace(/\s+APT\s+\w+$/i, '')
    .trim();
}

async function geo(rawAddr, state) {
  const q = clean(rawAddr) + ', ' + state;
  try {
    const r = await fetch(NOM + '/search?format=json&q=' + encodeURIComponent(q) + '&limit=1&addressdetails=1&countrycodes=us', {
      headers: { 'User-Agent': 'JediRE/1.0 (contact@jedire.com)' },
      signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) return null;
    const d = await r.json();
    if (!d || !d.length) return null;
    const a = d[0].address || {};
    const city = a.city || a.town || a.village || a.hamlet;
    if (!city) return null;
    return { city, lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon), zip: a.postcode || null };
  } catch (e) { return null; }
}

async function main() {
  process.stdout.write('=== Georgia Geocoding ===\n');
  const recs = await pool.query(
    "SELECT id, address, state FROM property_records WHERE state='GA' AND units>=100 AND city IS NULL AND address IS NOT NULL AND TRIM(address)!='' AND address NOT LIKE '0 %' ORDER BY id"
  );
  process.stdout.write('Records to process: ' + recs.rows.length + '\n');
  
  let ok = 0, fail = 0;
  const cities = {};
  
  for (let i = 0; i < recs.rows.length; i++) {
    const row = recs.rows[i];
    const g = await geo(row.address, row.state);
    if (g) {
      await pool.query(
        'UPDATE property_records SET city=$1, lat=COALESCE($2,lat), lng=COALESCE($3,lng), zip_code=COALESCE($4,zip_code), updated_at=NOW() WHERE id=$5',
        [g.city, g.lat, g.lng, g.zip, row.id]
      );
      ok++;
      cities[g.city] = (cities[g.city] || 0) + 1;
    } else {
      fail++;
    }
    if ((i + 1) % 25 === 0) {
      process.stdout.write('Progress: ' + (i + 1) + '/' + recs.rows.length + ' (ok:' + ok + ' fail:' + fail + ')\n');
    }
    await new Promise(r => setTimeout(r, DELAY));
  }
  
  process.stdout.write('\n=== RESULTS ===\n');
  process.stdout.write('Geocoded: ' + ok + ', Failed: ' + fail + ', Total: ' + recs.rows.length + '\n');
  process.stdout.write('Cities: ' + JSON.stringify(cities, null, 2) + '\n');
  
  const u = await pool.query(
    "UPDATE rent_scrape_targets rst SET city=pr.city, market=pr.city, updated_at=NOW() FROM property_records pr WHERE rst.property_record_id=pr.id AND rst.source='property_records' AND pr.city IS NOT NULL AND TRIM(pr.city)!='' AND (rst.city!=pr.city OR rst.market!=pr.city)"
  );
  process.stdout.write('Updated rent_scrape_targets: ' + (u.rowCount || 0) + '\n');

  var VALID_GA_MARKETS = [
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
  var placeholders = VALID_GA_MARKETS.map(function(_, i) { return '$' + (i + 1); }).join(',');
  var deactivated = await pool.query(
    "UPDATE rent_scrape_targets SET active=FALSE, updated_at=NOW() WHERE source='property_records' AND state='GA' AND active=TRUE AND city IS NOT NULL AND LOWER(TRIM(city)) NOT IN (" + placeholders + ")",
    VALID_GA_MARKETS
  );
  process.stdout.write('Deactivated out-of-market targets: ' + (deactivated.rowCount || 0) + '\n');

  process.stdout.write('DONE\n');
  await pool.end();
}

main().catch(e => { console.error(e); pool.end().then(() => process.exit(1)); });
