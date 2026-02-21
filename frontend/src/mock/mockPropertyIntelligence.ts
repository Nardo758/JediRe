// Mock Property Intelligence Data
// Structure matches property_records table from migration 040
// This will be replaced with real API data

export interface PropertyIntelligenceRecord {
  id: string;
  parcel_id: string;
  address: string;
  city: string;
  zip_code: string;
  owner_name: string;
  units: number;
  year_built: string;
  building_sqft: number;
  assessed_value: number;
  appraised_value: number;
  land_use_code: string;
  neighborhood_code: string;
  sqft_per_unit: number;
  appraised_per_unit: number;
  // Computed fields
  vintage_class: 'Pre-1980' | '1980-1999' | '2000-2009' | '2010+';
  hold_period_years: number | null;
  last_sale_year: number | null;
  last_sale_price: number | null;
  // Status for UI
  data_source: 'REAL' | 'MOCK';
}

// Helper to calculate vintage class
function getVintageClass(yearBuilt: string): PropertyIntelligenceRecord['vintage_class'] {
  const year = parseInt(yearBuilt);
  if (year < 1980) return 'Pre-1980';
  if (year < 2000) return '1980-1999';
  if (year < 2010) return '2000-2009';
  return '2010+';
}

// Mock data: 15 sample properties from Atlanta
export const mockPropertyIntelligence: PropertyIntelligenceRecord[] = [
  {
    id: '1',
    parcel_id: '14-0089-0001-123-4',
    address: '245 Peachtree Center Ave NE',
    city: 'Atlanta',
    zip_code: '30303',
    owner_name: 'Piedmont Investment Partners LLC',
    units: 156,
    year_built: '1985',
    building_sqft: 124800,
    assessed_value: 18500000,
    appraised_value: 23400000,
    land_use_code: 'MULT',
    neighborhood_code: 'DT-01',
    sqft_per_unit: 800,
    appraised_per_unit: 150000,
    vintage_class: '1980-1999',
    hold_period_years: 12,
    last_sale_year: 2012,
    last_sale_price: 14200000,
    data_source: 'MOCK'
  },
  {
    id: '2',
    parcel_id: '14-0089-0002-456-7',
    address: '1050 Piedmont Ave NE',
    city: 'Atlanta',
    zip_code: '30309',
    owner_name: 'Midtown Residential Group',
    units: 248,
    year_built: '2018',
    building_sqft: 223200,
    assessed_value: 42000000,
    appraised_value: 52800000,
    land_use_code: 'MULT',
    neighborhood_code: 'MT-05',
    sqft_per_unit: 900,
    appraised_per_unit: 212900,
    vintage_class: '2010+',
    hold_period_years: 6,
    last_sale_year: 2018,
    last_sale_price: 48500000,
    data_source: 'MOCK'
  },
  {
    id: '3',
    parcel_id: '14-0089-0003-789-0',
    address: '788 W Marietta St NW',
    city: 'Atlanta',
    zip_code: '30318',
    owner_name: 'Westside Development Co',
    units: 92,
    year_built: '2015',
    building_sqft: 82800,
    assessed_value: 16800000,
    appraised_value: 21200000,
    land_use_code: 'MULT',
    neighborhood_code: 'WS-03',
    sqft_per_unit: 900,
    appraised_per_unit: 230435,
    vintage_class: '2010+',
    hold_period_years: 4,
    last_sale_year: 2020,
    last_sale_price: 19800000,
    data_source: 'MOCK'
  },
  {
    id: '4',
    parcel_id: '14-0089-0004-012-3',
    address: '2255 Peachtree Rd NE',
    city: 'Atlanta',
    zip_code: '30309',
    owner_name: 'Buckhead Properties Inc',
    units: 312,
    year_built: '1992',
    building_sqft: 280800,
    assessed_value: 38500000,
    appraised_value: 48600000,
    land_use_code: 'MULT',
    neighborhood_code: 'BH-12',
    sqft_per_unit: 900,
    appraised_per_unit: 155769,
    vintage_class: '1980-1999',
    hold_period_years: 18,
    last_sale_year: 2006,
    last_sale_price: 28000000,
    data_source: 'MOCK'
  },
  {
    id: '5',
    parcel_id: '14-0089-0005-345-6',
    address: '520 Edgewood Ave SE',
    city: 'Atlanta',
    zip_code: '30312',
    owner_name: 'Old Fourth Ward Apartments LLC',
    units: 64,
    year_built: '1975',
    building_sqft: 51200,
    assessed_value: 8200000,
    appraised_value: 10400000,
    land_use_code: 'MULT',
    neighborhood_code: 'O4W-08',
    sqft_per_unit: 800,
    appraised_per_unit: 162500,
    vintage_class: 'Pre-1980',
    hold_period_years: 22,
    last_sale_year: 2002,
    last_sale_price: 4800000,
    data_source: 'MOCK'
  },
  {
    id: '6',
    parcel_id: '14-0089-0006-678-9',
    address: '1385 West Paces Ferry Rd NW',
    city: 'Atlanta',
    zip_code: '30327',
    owner_name: 'Tuxedo Park Investments',
    units: 128,
    year_built: '1988',
    building_sqft: 115200,
    assessed_value: 28500000,
    appraised_value: 36000000,
    land_use_code: 'MULT',
    neighborhood_code: 'BH-04',
    sqft_per_unit: 900,
    appraised_per_unit: 281250,
    vintage_class: '1980-1999',
    hold_period_years: 15,
    last_sale_year: 2009,
    last_sale_price: 24200000,
    data_source: 'MOCK'
  },
  {
    id: '7',
    parcel_id: '14-0089-0007-901-2',
    address: '675 Memorial Dr SE',
    city: 'Atlanta',
    zip_code: '30312',
    owner_name: 'Grant Park Capital LLC',
    units: 48,
    year_built: '1968',
    building_sqft: 38400,
    assessed_value: 6500000,
    appraised_value: 8200000,
    land_use_code: 'MULT',
    neighborhood_code: 'GP-02',
    sqft_per_unit: 800,
    appraised_per_unit: 170833,
    vintage_class: 'Pre-1980',
    hold_period_years: 28,
    last_sale_year: 1996,
    last_sale_price: 2100000,
    data_source: 'MOCK'
  },
  {
    id: '8',
    parcel_id: '14-0089-0008-234-5',
    address: '3324 Peachtree Rd NE',
    city: 'Atlanta',
    zip_code: '30326',
    owner_name: 'Lenox Square Holdings',
    units: 224,
    year_built: '2003',
    building_sqft: 201600,
    assessed_value: 38200000,
    appraised_value: 48200000,
    land_use_code: 'MULT',
    neighborhood_code: 'BH-16',
    sqft_per_unit: 900,
    appraised_per_unit: 215179,
    vintage_class: '2000-2009',
    hold_period_years: 11,
    last_sale_year: 2013,
    last_sale_price: 36800000,
    data_source: 'MOCK'
  },
  {
    id: '9',
    parcel_id: '14-0089-0009-567-8',
    address: '1215 Howell Mill Rd NW',
    city: 'Atlanta',
    zip_code: '30318',
    owner_name: 'Howell Mill Property Group',
    units: 176,
    year_built: '2019',
    building_sqft: 158400,
    assessed_value: 34500000,
    appraised_value: 43500000,
    land_use_code: 'MULT',
    neighborhood_code: 'WS-12',
    sqft_per_unit: 900,
    appraised_per_unit: 247159,
    vintage_class: '2010+',
    hold_period_years: 5,
    last_sale_year: 2019,
    last_sale_price: 41200000,
    data_source: 'MOCK'
  },
  {
    id: '10',
    parcel_id: '14-0089-0010-890-1',
    address: '850 Boulevard SE',
    city: 'Atlanta',
    zip_code: '30312',
    owner_name: 'Boulevard Lofts LLC',
    units: 72,
    year_built: '2007',
    building_sqft: 64800,
    assessed_value: 12800000,
    appraised_value: 16200000,
    land_use_code: 'MULT',
    neighborhood_code: 'O4W-15',
    sqft_per_unit: 900,
    appraised_per_unit: 225000,
    vintage_class: '2000-2009',
    hold_period_years: 8,
    last_sale_year: 2016,
    last_sale_price: 14500000,
    data_source: 'MOCK'
  },
  {
    id: '11',
    parcel_id: '14-0089-0011-123-4',
    address: '2965 Pharr Court South NW',
    city: 'Atlanta',
    zip_code: '30305',
    owner_name: 'Pharr Court Properties',
    units: 88,
    year_built: '1982',
    building_sqft: 79200,
    assessed_value: 15200000,
    appraised_value: 19200000,
    land_use_code: 'MULT',
    neighborhood_code: 'BH-08',
    sqft_per_unit: 900,
    appraised_per_unit: 218182,
    vintage_class: '1980-1999',
    hold_period_years: 19,
    last_sale_year: 2005,
    last_sale_price: 11800000,
    data_source: 'MOCK'
  },
  {
    id: '12',
    parcel_id: '14-0089-0012-456-7',
    address: '625 Ponce De Leon Ave NE',
    city: 'Atlanta',
    zip_code: '30308',
    owner_name: 'Ponce City Residential Inc',
    units: 192,
    year_built: '1926',
    building_sqft: 153600,
    assessed_value: 28500000,
    appraised_value: 36000000,
    land_use_code: 'MULT',
    neighborhood_code: 'VH-01',
    sqft_per_unit: 800,
    appraised_per_unit: 187500,
    vintage_class: 'Pre-1980',
    hold_period_years: 10,
    last_sale_year: 2014,
    last_sale_price: 32500000,
    data_source: 'MOCK'
  },
  {
    id: '13',
    parcel_id: '14-0089-0013-789-0',
    address: '400 W Peachtree St NW',
    city: 'Atlanta',
    zip_code: '30308',
    owner_name: 'Midtown Tower LLC',
    units: 384,
    year_built: '2016',
    building_sqft: 345600,
    assessed_value: 78500000,
    appraised_value: 99000000,
    land_use_code: 'MULT',
    neighborhood_code: 'MT-01',
    sqft_per_unit: 900,
    appraised_per_unit: 257813,
    vintage_class: '2010+',
    hold_period_years: 8,
    last_sale_year: 2016,
    last_sale_price: 92000000,
    data_source: 'MOCK'
  },
  {
    id: '14',
    parcel_id: '14-0089-0014-012-3',
    address: '1155 Collier Rd NW',
    city: 'Atlanta',
    zip_code: '30318',
    owner_name: 'Collier Ridge Partners',
    units: 112,
    year_built: '1995',
    building_sqft: 100800,
    assessed_value: 18200000,
    appraised_value: 23000000,
    land_use_code: 'MULT',
    neighborhood_code: 'WS-07',
    sqft_per_unit: 900,
    appraised_per_unit: 205357,
    vintage_class: '1980-1999',
    hold_period_years: 14,
    last_sale_year: 2010,
    last_sale_price: 16500000,
    data_source: 'MOCK'
  },
  {
    id: '15',
    parcel_id: '14-0089-0015-345-6',
    address: '2479 Peachtree Rd NE',
    city: 'Atlanta',
    zip_code: '30305',
    owner_name: 'Peachtree Hills Capital',
    units: 144,
    year_built: '2021',
    building_sqft: 129600,
    assessed_value: 38500000,
    appraised_value: 48500000,
    land_use_code: 'MULT',
    neighborhood_code: 'BH-20',
    sqft_per_unit: 900,
    appraised_per_unit: 336806,
    vintage_class: '2010+',
    hold_period_years: 3,
    last_sale_year: 2021,
    last_sale_price: 46800000,
    data_source: 'MOCK'
  }
];

// Generate additional mock properties to reach ~1028 total
// In production, this would come from the API
export function generateMockPropertyData(count: number = 1028): PropertyIntelligenceRecord[] {
  const baseProperties = [...mockPropertyIntelligence];
  const generated: PropertyIntelligenceRecord[] = [...baseProperties];
  
  const streets = [
    'Peachtree St', 'Piedmont Ave', 'West Peachtree St', 'Marietta St',
    'Boulevard', 'Memorial Dr', 'Ponce De Leon Ave', 'Edgewood Ave',
    'North Ave', 'Monroe Dr', 'Spring St', 'Techwood Dr', 'Howell Mill Rd'
  ];
  
  const neighborhoods = ['DT', 'MT', 'BH', 'WS', 'O4W', 'GP', 'VH', 'EAV'];
  const owners = [
    'Atlanta Investment Group LLC', 'Southern Properties Inc', 'Metro Residential Partners',
    'Peach State Capital', 'Urban Living Properties', 'City Center Holdings',
    'Skyline Apartments LLC', 'Gateway Properties', 'Midtown Residential Co'
  ];
  
  for (let i = baseProperties.length; i < count; i++) {
    const units = Math.floor(Math.random() * 300) + 30;
    const yearBuilt = Math.floor(Math.random() * 70) + 1955;
    const sqftPerUnit = Math.floor(Math.random() * 400) + 700;
    const appraisedPerUnit = Math.floor(Math.random() * 200000) + 120000;
    const holdYears = Math.floor(Math.random() * 30) + 1;
    
    generated.push({
      id: `${i + 1}`,
      parcel_id: `14-0089-${String(i).padStart(4, '0')}-${Math.floor(Math.random() * 1000)}-${Math.floor(Math.random() * 10)}`,
      address: `${Math.floor(Math.random() * 5000) + 100} ${streets[Math.floor(Math.random() * streets.length)]} ${['NE', 'NW', 'SE', 'SW'][Math.floor(Math.random() * 4)]}`,
      city: 'Atlanta',
      zip_code: `303${Math.floor(Math.random() * 30).toString().padStart(2, '0')}`,
      owner_name: owners[Math.floor(Math.random() * owners.length)],
      units,
      year_built: yearBuilt.toString(),
      building_sqft: units * sqftPerUnit,
      assessed_value: Math.floor(units * appraisedPerUnit * 0.85),
      appraised_value: units * appraisedPerUnit,
      land_use_code: 'MULT',
      neighborhood_code: `${neighborhoods[Math.floor(Math.random() * neighborhoods.length)]}-${String(Math.floor(Math.random() * 20) + 1).padStart(2, '0')}`,
      sqft_per_unit: sqftPerUnit,
      appraised_per_unit: appraisedPerUnit,
      vintage_class: getVintageClass(yearBuilt.toString()),
      hold_period_years: holdYears,
      last_sale_year: 2024 - holdYears,
      last_sale_price: Math.floor(units * appraisedPerUnit * (0.7 + Math.random() * 0.3)),
      data_source: 'MOCK'
    });
  }
  
  return generated;
}
