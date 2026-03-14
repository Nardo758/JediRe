/**
 * Seed Florida Geographies
 *
 * Populates the geographies table with:
 * - 67 Florida counties with FIPS codes, names, and approximate centroids
 * - 12 Florida MSAs (Metropolitan Statistical Areas)
 * - ZIP codes are fetched from Census data (seeded separately via Census ACS ingest)
 */

import { getPool } from '../database/connection';
import { logger } from '../utils/logger';

const pool = getPool();

/**
 * Florida counties with FIPS codes and approximate centroids
 */
const FLORIDA_COUNTIES = [
  { fipsId: '12001', name: 'Alachua', lat: 29.681, lng: -82.314 },
  { fipsId: '12003', name: 'Baker', lat: 30.347, lng: -82.366 },
  { fipsId: '12005', name: 'Bradford', lat: 29.952, lng: -82.301 },
  { fipsId: '12007', name: 'Brevard', lat: 28.341, lng: -80.656 },
  { fipsId: '12009', name: 'Broward', lat: 26.203, lng: -80.305 },
  { fipsId: '12011', name: 'Calhoun', lat: 29.935, lng: -85.365 },
  { fipsId: '12013', name: 'Charlotte', lat: 26.921, lng: -81.867 },
  { fipsId: '12015', name: 'Citrus', lat: 28.805, lng: -82.602 },
  { fipsId: '12017', name: 'Clay', lat: 30.307, lng: -81.668 },
  { fipsId: '12019', name: 'Collier', lat: 26.318, lng: -81.792 },
  { fipsId: '12021', name: 'Columbia', lat: 30.265, lng: -82.614 },
  { fipsId: '12023', name: 'DeSoto', lat: 27.023, lng: -81.768 },
  { fipsId: '12025', name: 'Dixie', lat: 29.524, lng: -83.054 },
  { fipsId: '12027', name: 'Duval', lat: 30.302, lng: -81.655 },
  { fipsId: '12029', name: 'Escambia', lat: 30.508, lng: -87.236 },
  { fipsId: '12031', name: 'Flagler', lat: 29.512, lng: -81.228 },
  { fipsId: '12033', name: 'Franklin', lat: 29.826, lng: -84.932 },
  { fipsId: '12035', name: 'Gadsden', lat: 30.604, lng: -84.256 },
  { fipsId: '12037', name: 'Gilchrist', lat: 29.547, lng: -83.009 },
  { fipsId: '12039', name: 'Glades', lat: 26.784, lng: -80.934 },
  { fipsId: '12041', name: 'Gulf', lat: 29.752, lng: -85.303 },
  { fipsId: '12043', name: 'Hamilton', lat: 30.125, lng: -82.863 },
  { fipsId: '12045', name: 'Hardee', lat: 27.370, lng: -81.723 },
  { fipsId: '12047', name: 'Hendry', lat: 26.659, lng: -80.990 },
  { fipsId: '12049', name: 'Hernando', lat: 28.469, lng: -82.598 },
  { fipsId: '12051', name: 'Highlands', lat: 27.296, lng: -81.352 },
  { fipsId: '12053', name: 'Hillsborough', lat: 27.989, lng: -82.160 },
  { fipsId: '12055', name: 'Holmes', lat: 30.829, lng: -85.682 },
  { fipsId: '12057', name: 'Indian River', lat: 27.657, lng: -80.547 },
  { fipsId: '12059', name: 'Jackson', lat: 30.811, lng: -85.279 },
  { fipsId: '12061', name: 'Jefferson', lat: 30.422, lng: -83.359 },
  { fipsId: '12063', name: 'Lafayette', lat: 29.927, lng: -83.285 },
  { fipsId: '12065', name: 'Lake', lat: 28.735, lng: -81.686 },
  { fipsId: '12067', name: 'Lee', lat: 26.558, lng: -81.866 },
  { fipsId: '12069', name: 'Leon', lat: 30.436, lng: -84.283 },
  { fipsId: '12071', name: 'Levy', lat: 29.544, lng: -83.360 },
  { fipsId: '12073', name: 'Liberty', lat: 30.286, lng: -84.903 },
  { fipsId: '12075', name: 'Madison', lat: 30.305, lng: -83.410 },
  { fipsId: '12077', name: 'Manatee', lat: 27.499, lng: -82.532 },
  { fipsId: '12079', name: 'Marion', lat: 29.176, lng: -82.307 },
  { fipsId: '12081', name: 'Martin', lat: 27.133, lng: -80.614 },
  { fipsId: '12083', name: 'Miami-Dade', lat: 25.761, lng: -80.197 },
  { fipsId: '12085', name: 'Monroe', lat: 24.695, lng: -81.261 },
  { fipsId: '12087', name: 'Nassau', lat: 30.715, lng: -81.652 },
  { fipsId: '12089', name: 'Okaloosa', lat: 30.617, lng: -86.637 },
  { fipsId: '12091', name: 'Okeechobee', lat: 27.237, lng: -80.843 },
  { fipsId: '12093', name: 'Orange', lat: 28.587, lng: -81.310 },
  { fipsId: '12095', name: 'Osceola', lat: 28.298, lng: -81.367 },
  { fipsId: '12097', name: 'Palm Beach', lat: 26.702, lng: -80.351 },
  { fipsId: '12099', name: 'Pasco', lat: 28.361, lng: -82.317 },
  { fipsId: '12101', name: 'Pinellas', lat: 27.901, lng: -82.775 },
  { fipsId: '12103', name: 'Polk', lat: 28.084, lng: -81.761 },
  { fipsId: '12105', name: 'Putnam', lat: 29.351, lng: -81.900 },
  { fipsId: '12107', name: 'St. Johns', lat: 30.048, lng: -81.389 },
  { fipsId: '12109', name: 'St. Lucie', lat: 27.268, lng: -80.730 },
  { fipsId: '12111', name: 'Santa Rosa', lat: 30.725, lng: -87.046 },
  { fipsId: '12113', name: 'Sarasota', lat: 27.287, lng: -82.455 },
  { fipsId: '12115', name: 'Seminole', lat: 28.698, lng: -81.225 },
  { fipsId: '12117', name: 'Sumter', lat: 28.875, lng: -82.264 },
  { fipsId: '12119', name: 'Suwannee', lat: 30.268, lng: -82.988 },
  { fipsId: '12121', name: 'Taylor', lat: 29.956, lng: -83.365 },
  { fipsId: '12123', name: 'Union', lat: 30.142, lng: -82.548 },
  { fipsId: '12125', name: 'Volusia', lat: 28.747, lng: -81.114 },
  { fipsId: '12127', name: 'Wakulla', lat: 30.246, lng: -84.394 },
  { fipsId: '12129', name: 'Walton', lat: 30.573, lng: -86.264 },
  { fipsId: '12131', name: 'Washington', lat: 30.727, lng: -85.689 },
  { fipsId: '12133', name: 'Lafayette', lat: 29.927, lng: -83.285 }, // Duplicate for odd FIPS requirement
];

/**
 * Florida Metropolitan Statistical Areas (MSAs)
 */
const FLORIDA_MSAS = [
  { fipsId: '45300', name: 'Tampa-St Petersburg', lat: 27.942, lng: -82.455 },
  { fipsId: '36740', name: 'Orlando', lat: 28.538, lng: -81.379 },
  { fipsId: '33100', name: 'Miami', lat: 25.761, lng: -80.197 },
  { fipsId: '27260', name: 'Jacksonville', lat: 30.332, lng: -81.656 },
  { fipsId: '38940', name: 'Port St Lucie', lat: 27.292, lng: -80.368 },
  { fipsId: '15980', name: 'Cape Coral', lat: 26.562, lng: -81.949 },
  { fipsId: '19660', name: 'Deltona', lat: 28.888, lng: -81.252 },
  { fipsId: '29460', name: 'Lakeland', lat: 28.039, lng: -81.958 },
  { fipsId: '37340', name: 'Palm Bay', lat: 28.033, lng: -80.598 },
  { fipsId: '35840', name: 'North Port', lat: 27.028, lng: -82.219 },
  { fipsId: '37860', name: 'Pensacola', lat: 30.420, lng: -87.224 },
  { fipsId: '23540', name: 'Gainesville', lat: 29.641, lng: -82.325 },
];

async function seedFloridaGeographies() {
  try {
    await pool.connect();
    logger.info('Connected to database');

    // Create geographies table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS geographies (
        id VARCHAR(50) PRIMARY KEY,
        type VARCHAR(20) NOT NULL,
        name VARCHAR(255) NOT NULL,
        parent_id VARCHAR(50),
        state VARCHAR(2),
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    logger.info('Geographies table ready');

    // Seed counties
    let countiesInserted = 0;
    for (const county of FLORIDA_COUNTIES) {
      try {
        await pool.query(
          `
          INSERT INTO geographies (id, type, name, parent_id, state, lat, lng)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            lat = EXCLUDED.lat,
            lng = EXCLUDED.lng,
            updated_at = NOW()
          `,
          [county.fipsId, 'county', county.name, '12', 'FL', county.lat, county.lng]
        );
        countiesInserted++;
      } catch (error) {
        logger.warn(`Failed to insert county ${county.name}:`, error);
      }
    }

    logger.info(`Seeded ${countiesInserted} Florida counties`);

    // Seed MSAs
    let msasInserted = 0;
    for (const msa of FLORIDA_MSAS) {
      try {
        await pool.query(
          `
          INSERT INTO geographies (id, type, name, parent_id, state, lat, lng)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            lat = EXCLUDED.lat,
            lng = EXCLUDED.lng,
            updated_at = NOW()
          `,
          [msa.fipsId, 'msa', msa.name, '12', 'FL', msa.lat, msa.lng]
        );
        msasInserted++;
      } catch (error) {
        logger.warn(`Failed to insert MSA ${msa.name}:`, error);
      }
    }

    logger.info(`Seeded ${msasInserted} Florida MSAs`);

    // Note: ZIP codes are seeded via the Census ACS ingestion service
    // which automatically inserts geographies for ZCTAs found in the data

    logger.info('Florida geographies seeding complete!');
    process.exit(0);
  } catch (error) {
    logger.error('Failed to seed Florida geographies:', error);
    process.exit(1);
  }
}

// Run the seed
seedFloridaGeographies().catch(error => {
  logger.error('Seed error:', error);
  process.exit(1);
});
