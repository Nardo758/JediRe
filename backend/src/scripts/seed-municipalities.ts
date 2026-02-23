/**
 * Seed Municipalities Database
 * 
 * Populates the municipalities table with the 26 cities
 * that need Municode scraping (no API available)
 */

import { db } from '../db';

interface MunicipalityData {
  id: string;
  name: string;
  state: string;
  county: string;
  municode_url: string;
  zoning_chapter_path: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

const municipalities: MunicipalityData[] = [
  // HIGH PRIORITY (6 cities)
  {
    id: 'birmingham-al',
    name: 'Birmingham',
    state: 'AL',
    county: 'Jefferson',
    municode_url: 'https://library.municode.com/al/birmingham/codes/code_of_ordinances',
    zoning_chapter_path: '?nodeId=COOR_TITZOZORE',
    priority: 'HIGH',
  },
  {
    id: 'montgomery-al',
    name: 'Montgomery',
    state: 'AL',
    county: 'Montgomery',
    municode_url: 'https://library.municode.com/al/montgomery/codes/code_of_ordinances',
    zoning_chapter_path: '?nodeId=PTIICOOR_CH13ZO',
    priority: 'HIGH',
  },
  {
    id: 'louisville-ky',
    name: 'Louisville',
    state: 'KY',
    county: 'Jefferson',
    municode_url: 'https://library.municode.com/ky/louisville/codes/code_of_ordinances',
    zoning_chapter_path: '?nodeId=CD_ORD_CH4LADECO',
    priority: 'HIGH',
  },
  {
    id: 'lexington-ky',
    name: 'Lexington',
    state: 'KY',
    county: 'Fayette',
    municode_url: 'https://library.municode.com/ky/lexington-fayette_county/codes/code_of_ordinances',
    zoning_chapter_path: '?nodeId=COOR_ARTIZOOR',
    priority: 'HIGH',
  },
  {
    id: 'fort-worth-tx',
    name: 'Fort Worth',
    state: 'TX',
    county: 'Tarrant',
    municode_url: 'https://library.municode.com/tx/fort_worth/codes/code_of_ordinances',
    zoning_chapter_path: '?nodeId=COOR_CH14ZO',
    priority: 'HIGH',
  },
  {
    id: 'el-paso-tx',
    name: 'El Paso',
    state: 'TX',
    county: 'El Paso',
    municode_url: 'https://library.municode.com/tx/el_paso/codes/code_of_ordinances',
    zoning_chapter_path: '?nodeId=TIT20ZO',
    priority: 'HIGH',
  },

  // MEDIUM PRIORITY (11 cities)
  {
    id: 'jackson-ms',
    name: 'Jackson',
    state: 'MS',
    county: 'Hinds',
    municode_url: 'https://library.municode.com/ms/jackson/codes/code_of_ordinances',
    zoning_chapter_path: '?nodeId=PTIICOOR_CH31ZO',
    priority: 'MEDIUM',
  },
  {
    id: 'little-rock-ar',
    name: 'Little Rock',
    state: 'AR',
    county: 'Pulaski',
    municode_url: 'https://library.municode.com/ar/little_rock/codes/code_of_ordinances',
    zoning_chapter_path: '?nodeId=TITVIIILAUSDE_CH36ZO',
    priority: 'MEDIUM',
  },
  {
    id: 'savannah-ga',
    name: 'Savannah',
    state: 'GA',
    county: 'Chatham',
    municode_url: 'https://library.municode.com/ga/savannah/codes/code_of_ordinances',
    zoning_chapter_path: '?nodeId=PTIICOOR_CH8-3000ZO',
    priority: 'MEDIUM',
  },
  {
    id: 'columbus-ga',
    name: 'Columbus',
    state: 'GA',
    county: 'Muscogee',
    municode_url: 'https://library.municode.com/ga/columbus/codes/code_of_ordinances',
    zoning_chapter_path: '?nodeId=PTIICOOR_CH5ZO',
    priority: 'MEDIUM',
  },
  {
    id: 'columbia-sc',
    name: 'Columbia',
    state: 'SC',
    county: 'Richland',
    municode_url: 'https://library.municode.com/sc/columbia/codes/code_of_ordinances',
    zoning_chapter_path: '?nodeId=PTIICOOR_CH17ZO',
    priority: 'MEDIUM',
  },
  {
    id: 'knoxville-tn',
    name: 'Knoxville',
    state: 'TN',
    county: 'Knox',
    municode_url: 'https://library.municode.com/tn/knoxville/codes/code_of_ordinances',
    zoning_chapter_path: '?nodeId=TIT19ZO',
    priority: 'MEDIUM',
  },
  {
    id: 'chattanooga-tn',
    name: 'Chattanooga',
    state: 'TN',
    county: 'Hamilton',
    municode_url: 'https://library.municode.com/tn/chattanooga/codes/code_of_ordinances',
    zoning_chapter_path: '?nodeId=PTIIIZOCODE',
    priority: 'MEDIUM',
  },
  {
    id: 'arlington-tx',
    name: 'Arlington',
    state: 'TX',
    county: 'Tarrant',
    municode_url: 'https://library.municode.com/tx/arlington/codes/code_of_ordinances',
    zoning_chapter_path: '?nodeId=PTIICOOR_CH51ZO',
    priority: 'MEDIUM',
  },
  {
    id: 'corpus-christi-tx',
    name: 'Corpus Christi',
    state: 'TX',
    county: 'Nueces',
    municode_url: 'https://library.municode.com/tx/corpus_christi/codes/code_of_ordinances',
    zoning_chapter_path: '?nodeId=PTIICOOR_CH3ZODI',
    priority: 'MEDIUM',
  },
  {
    id: 'plano-tx',
    name: 'Plano',
    state: 'TX',
    county: 'Collin',
    municode_url: 'https://library.municode.com/tx/plano/codes/code_of_ordinances',
    zoning_chapter_path: '?nodeId=PTIICOOR_CH4ZO',
    priority: 'MEDIUM',
  },
  {
    id: 'st-petersburg-fl',
    name: 'St. Petersburg',
    state: 'FL',
    county: 'Pinellas',
    municode_url: 'https://library.municode.com/fl/st._petersburg/codes/code_of_ordinances',
    zoning_chapter_path: '?nodeId=PTIICICO_CH16ZO',
    priority: 'MEDIUM',
  },

  // LOW PRIORITY (9 cities - selected high-value)
  {
    id: 'charleston-wv',
    name: 'Charleston',
    state: 'WV',
    county: 'Kanawha',
    municode_url: 'https://library.municode.com/wv/charleston/codes/code_of_ordinances',
    zoning_chapter_path: '?nodeId=PTIICOOR_CH115ZO',
    priority: 'LOW',
  },
  {
    id: 'north-charleston-sc',
    name: 'North Charleston',
    state: 'SC',
    county: 'Charleston',
    municode_url: 'https://library.municode.com/sc/north_charleston/codes/code_of_ordinances',
    zoning_chapter_path: '?nodeId=TIT5ZOPLCO',
    priority: 'LOW',
  },
  {
    id: 'lubbock-tx',
    name: 'Lubbock',
    state: 'TX',
    county: 'Lubbock',
    municode_url: 'https://library.municode.com/tx/lubbock/codes/code_of_ordinances',
    zoning_chapter_path: '?nodeId=PTIICOOR_CH19ZO',
    priority: 'LOW',
  },
  {
    id: 'laredo-tx',
    name: 'Laredo',
    state: 'TX',
    county: 'Webb',
    municode_url: 'https://library.municode.com/tx/laredo/codes/code_of_ordinances',
    zoning_chapter_path: '?nodeId=PTIICOOR_CH4ZORE',
    priority: 'LOW',
  },
  {
    id: 'irving-tx',
    name: 'Irving',
    state: 'TX',
    county: 'Dallas',
    municode_url: 'https://library.municode.com/tx/irving/codes/code_of_ordinances',
    zoning_chapter_path: '?nodeId=PTIICOOR_CH51ZO',
    priority: 'LOW',
  },
  {
    id: 'garland-tx',
    name: 'Garland',
    state: 'TX',
    county: 'Dallas',
    municode_url: 'https://library.municode.com/tx/garland/codes/code_of_ordinances',
    zoning_chapter_path: '?nodeId=PTIICOOR_CH14ZO',
    priority: 'LOW',
  },
  {
    id: 'hialeah-fl',
    name: 'Hialeah',
    state: 'FL',
    county: 'Miami-Dade',
    municode_url: 'https://library.municode.com/fl/hialeah/codes/code_of_ordinances',
    zoning_chapter_path: '?nodeId=PTIICOOR_CH29ZODIRE',
    priority: 'LOW',
  },
  {
    id: 'cape-coral-fl',
    name: 'Cape Coral',
    state: 'FL',
    county: 'Lee',
    municode_url: 'https://library.municode.com/fl/cape_coral/codes/code_of_ordinances',
    zoning_chapter_path: '?nodeId=PTIICOOR_CH27ZO',
    priority: 'LOW',
  },
  {
    id: 'port-st-lucie-fl',
    name: 'Port St. Lucie',
    state: 'FL',
    county: 'St. Lucie',
    municode_url: 'https://library.municode.com/fl/port_st._lucie/codes/code_of_ordinances',
    zoning_chapter_path: '?nodeId=PTIICOOR_CH19ZO',
    priority: 'LOW',
  },
];

async function seedMunicipalities() {
  console.log(`Seeding ${municipalities.length} municipalities...`);

  for (const muni of municipalities) {
    try {
      await db.query(
        `
        INSERT INTO municipalities (
          id, name, state, county, municode_url, zoning_chapter_path,
          has_api, api_type, zoning_data_quality, scraping_enabled
        ) VALUES ($1, $2, $3, $4, $5, $6, FALSE, 'none', 'none', TRUE)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          municode_url = EXCLUDED.municode_url,
          zoning_chapter_path = EXCLUDED.zoning_chapter_path
        `,
        [
          muni.id,
          muni.name,
          muni.state,
          muni.county,
          muni.municode_url,
          muni.zoning_chapter_path,
        ]
      );

      console.log(`✅ ${muni.name}, ${muni.state} (${muni.priority} priority)`);
    } catch (error) {
      console.error(`❌ Failed to seed ${muni.name}:`, error);
    }
  }

  console.log('\n✅ Municipality seeding complete!');

  // Show summary
  const stats = await db.query(`
    SELECT state, COUNT(*) as count
    FROM municipalities
    GROUP BY state
    ORDER BY count DESC
  `);

  console.log('\n📊 Summary by State:');
  stats.rows.forEach((row) => {
    console.log(`  ${row.state}: ${row.count} cities`);
  });
}

// Run seeder
if (require.main === module) {
  seedMunicipalities()
    .then(() => {
      console.log('\nDone!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

export { seedMunicipalities, municipalities };
