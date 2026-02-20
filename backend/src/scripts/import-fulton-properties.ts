#!/usr/bin/env tsx
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const API_BASE = 'https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services';
const TAX_PARCELS = `${API_BASE}/Tax_Parcels_2025/FeatureServer/0`;
const SALES_BASE = `${API_BASE}/Tyler_YearlySales/FeatureServer`;
const MARKET_TRENDS = `${API_BASE}/CommissionDistrict1Cities_HomeSales/FeatureServer/28`;

const CONCURRENCY = 10;
const FETCH_TIMEOUT = 15000;

interface TaxParcelFeature {
  attributes: {
    ParcelID: string;
    Address: string;
    Owner: string;
    OwnerAddr1: string;
    OwnerAddr2: string;
    LivUnits: number;
    LandAcres: number;
    TotAssess: number;
    LandAssess: number;
    ImprAssess: number;
    TotAppr: number;
    LandAppr: number;
    ImprAppr: number;
    LUCode: string;
    ClassCode: string;
    NbrHood: string;
    Subdiv: string;
    TaxDist: string;
    TaxYear: number;
    Shape__Area: number;
    Shape__Length: number;
  };
}

interface SaleFeature {
  attributes: {
    ParID: string;
    TaxYear: string;
    Price: number;
    Cur: string;
  };
}

interface MarketTrendFeature {
  attributes: {
    City: string;
    F2012_avg_median_sale_price: number;
    F2013_avg_median_sale_price: number;
    F2014_avg_median_sale_price: number;
    F2015_avg_median_sale_price: number;
    F2016_avg_median_sale_price: number;
    F2017_avg_median_sale_price: number;
    F2018_avg_median_sale_price: number;
    F2019_avg_median_sale_price: number;
    F2020_avg_median_sale_price: number;
    F2021_avg_median_sale_price: number;
    F2022_avg_median_sale_price: number;
    F2023_avg_median_sale_price: number;
    F2024_avg_median_sale_price: number;
  };
}

async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchLargeMultifamilyProperties(): Promise<TaxParcelFeature[]> {
  console.log('Querying Tax Parcels API for 100+ unit properties...');

  const url = `${TAX_PARCELS}/query`;
  const params = new URLSearchParams({
    where: 'LivUnits >= 100',
    outFields: '*',
    f: 'json',
    returnGeometry: 'false',
    resultRecordCount: '2000',
  });

  const response = await fetchWithTimeout(`${url}?${params}`, 30000);
  const data = await response.json();

  if (data.features) {
    console.log(`Found ${data.features.length} properties with 100+ units`);
    return data.features;
  }

  console.error('No properties found or API error:', data.error);
  return [];
}

async function fetchSalesHistoryParallel(parcelId: string): Promise<SaleFeature[]> {
  const yearPromises = [];
  for (let year = 2018; year <= 2022; year++) {
    const layerId = year - 2016;
    const url = `${SALES_BASE}/${layerId}/query`;
    const params = new URLSearchParams({
      where: `ParID='${parcelId}'`,
      outFields: '*',
      f: 'json',
      returnGeometry: 'false',
    });

    yearPromises.push(
      fetchWithTimeout(`${url}?${params}`)
        .then(r => r.json())
        .then(data => (data.features || []) as SaleFeature[])
        .catch(() => [] as SaleFeature[])
    );
  }

  const results = await Promise.all(yearPromises);
  return results.flat();
}

async function fetchMarketTrends(): Promise<MarketTrendFeature[]> {
  console.log('Querying market trends (city median prices 2012-2024)...');

  const url = `${MARKET_TRENDS}/query`;
  const params = new URLSearchParams({
    where: '1=1',
    outFields: '*',
    f: 'json',
    returnGeometry: 'false',
  });

  const response = await fetchWithTimeout(`${url}?${params}`, 30000);
  const data = await response.json();

  if (data.features) {
    console.log(`Found market data for ${data.features.length} cities`);
    return data.features;
  }

  console.error('No market trends found');
  return [];
}

async function upsertPropertyRecord(feature: TaxParcelFeature): Promise<void> {
  const attrs = feature.attributes;

  const query = `
    INSERT INTO property_records (
      parcel_id, county, state, address, owner_name, owner_address_1, owner_address_2,
      units, land_acres, assessed_value, assessed_land, assessed_improvements,
      appraised_value, appraised_land, appraised_improvements, land_use_code,
      class_code, neighborhood_code, subdivision, tax_district,
      parcel_area_sqft, parcel_perimeter_ft, tax_year, data_source_url,
      scraped_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
      $16, $17, $18, $19, $20, $21, $22, $23, $24, NOW(), NOW()
    )
    ON CONFLICT (parcel_id) DO UPDATE SET
      address = EXCLUDED.address,
      owner_name = EXCLUDED.owner_name,
      owner_address_1 = EXCLUDED.owner_address_1,
      owner_address_2 = EXCLUDED.owner_address_2,
      units = EXCLUDED.units,
      land_acres = EXCLUDED.land_acres,
      assessed_value = EXCLUDED.assessed_value,
      assessed_land = EXCLUDED.assessed_land,
      assessed_improvements = EXCLUDED.assessed_improvements,
      appraised_value = EXCLUDED.appraised_value,
      appraised_land = EXCLUDED.appraised_land,
      appraised_improvements = EXCLUDED.appraised_improvements,
      land_use_code = EXCLUDED.land_use_code,
      class_code = EXCLUDED.class_code,
      neighborhood_code = EXCLUDED.neighborhood_code,
      subdivision = EXCLUDED.subdivision,
      tax_district = EXCLUDED.tax_district,
      parcel_area_sqft = EXCLUDED.parcel_area_sqft,
      parcel_perimeter_ft = EXCLUDED.parcel_perimeter_ft,
      tax_year = EXCLUDED.tax_year,
      data_source_url = EXCLUDED.data_source_url,
      updated_at = NOW()
  `;

  const values = [
    attrs.ParcelID,
    'Fulton',
    'GA',
    attrs.Address || '',
    attrs.Owner || null,
    attrs.OwnerAddr1 || null,
    attrs.OwnerAddr2 || null,
    attrs.LivUnits || null,
    attrs.LandAcres || null,
    attrs.TotAssess || null,
    attrs.LandAssess || null,
    attrs.ImprAssess || null,
    attrs.TotAppr || null,
    attrs.LandAppr || null,
    attrs.ImprAppr || null,
    attrs.LUCode || null,
    attrs.ClassCode || null,
    attrs.NbrHood || null,
    attrs.Subdiv || null,
    attrs.TaxDist || null,
    attrs.Shape__Area || null,
    attrs.Shape__Length || null,
    attrs.TaxYear || 2025,
    `${TAX_PARCELS}/query?where=ParcelID='${encodeURIComponent(attrs.ParcelID)}'`,
  ];

  await pool.query(query, values);
}

async function insertSalesRecords(parcelId: string, sales: SaleFeature[]): Promise<number> {
  const realSales = sales.filter(s => s.attributes.Price > 0);
  if (realSales.length === 0) return 0;

  const query = `
    INSERT INTO property_sales (
      parcel_id, sale_year, sale_price, is_current, scraped_at
    ) VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (parcel_id, sale_year) DO UPDATE SET
      sale_price = EXCLUDED.sale_price,
      is_current = EXCLUDED.is_current
  `;

  for (const sale of realSales) {
    await pool.query(query, [
      parcelId,
      parseInt(sale.attributes.TaxYear),
      sale.attributes.Price,
      sale.attributes.Cur === 'Y',
    ]);
  }

  return realSales.length;
}

async function insertMarketTrends(trends: MarketTrendFeature[]): Promise<number> {
  let count = 0;

  const query = `
    INSERT INTO market_trends (city, year, median_sale_price, scraped_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (city, year) DO UPDATE SET
      median_sale_price = EXCLUDED.median_sale_price
  `;

  for (const trend of trends) {
    const attrs = trend.attributes;
    const city = attrs.City;

    const yearData = [
      { year: 2012, price: attrs.F2012_avg_median_sale_price },
      { year: 2013, price: attrs.F2013_avg_median_sale_price },
      { year: 2014, price: attrs.F2014_avg_median_sale_price },
      { year: 2015, price: attrs.F2015_avg_median_sale_price },
      { year: 2016, price: attrs.F2016_avg_median_sale_price },
      { year: 2017, price: attrs.F2017_avg_median_sale_price },
      { year: 2018, price: attrs.F2018_avg_median_sale_price },
      { year: 2019, price: attrs.F2019_avg_median_sale_price },
      { year: 2020, price: attrs.F2020_avg_median_sale_price },
      { year: 2021, price: attrs.F2021_avg_median_sale_price },
      { year: 2022, price: attrs.F2022_avg_median_sale_price },
      { year: 2023, price: attrs.F2023_avg_median_sale_price },
      { year: 2024, price: attrs.F2024_avg_median_sale_price },
    ];

    for (const { year, price } of yearData) {
      if (price && price > 0) {
        await pool.query(query, [city, year, Math.round(price)]);
        count++;
      }
    }
  }

  return count;
}

async function processProperty(
  property: TaxParcelFeature,
  index: number,
  total: number
): Promise<{ success: boolean; sales: number }> {
  const parcelId = property.attributes.ParcelID;
  const address = property.attributes.Address;
  const units = property.attributes.LivUnits;

  try {
    await upsertPropertyRecord(property);

    const sales = await fetchSalesHistoryParallel(parcelId);
    let salesCount = 0;
    if (sales.length > 0) {
      salesCount = await insertSalesRecords(parcelId, sales);
    }

    const salesInfo = salesCount > 0 ? ` | ${salesCount} sale(s)` : '';
    console.log(`[${index}/${total}] ${address} (${units} units)${salesInfo}`);

    return { success: true, sales: salesCount };
  } catch (error: any) {
    console.error(`[${index}/${total}] FAIL ${parcelId}: ${error.message}`);
    return { success: false, sales: 0 };
  }
}

async function processInBatches(
  properties: TaxParcelFeature[],
  existingParcelIds: Set<string>
): Promise<{ successCount: number; salesCount: number; skipped: number }> {
  let successCount = 0;
  let salesCount = 0;
  let skipped = 0;

  const toProcess = properties.filter(p => {
    if (existingParcelIds.has(p.attributes.ParcelID)) {
      skipped++;
      return false;
    }
    return true;
  });

  console.log(`Skipping ${skipped} already-imported properties`);
  console.log(`Processing ${toProcess.length} new properties (${CONCURRENCY} at a time)...`);
  console.log('');

  for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
    const batch = toProcess.slice(i, i + CONCURRENCY);
    const batchNum = Math.floor(i / CONCURRENCY) + 1;
    const totalBatches = Math.ceil(toProcess.length / CONCURRENCY);

    const results = await Promise.all(
      batch.map((prop, j) =>
        processProperty(prop, skipped + i + j + 1, properties.length)
      )
    );

    for (const r of results) {
      if (r.success) successCount++;
      salesCount += r.sales;
    }

    if (batchNum % 5 === 0) {
      console.log(`--- Batch ${batchNum}/${totalBatches} done (${successCount} imported, ${salesCount} sales) ---`);
    }
  }

  return { successCount, salesCount, skipped };
}

async function importProperties() {
  const startTime = Date.now();
  console.log('Starting Fulton County Property Import (100+ units)');
  console.log('='.repeat(70));
  console.log('');

  const existingResult = await pool.query('SELECT parcel_id FROM property_records');
  const existingParcelIds = new Set(existingResult.rows.map((r: any) => r.parcel_id));
  console.log(`Found ${existingParcelIds.size} properties already in database`);

  const properties = await fetchLargeMultifamilyProperties();

  if (properties.length === 0) {
    console.log('No properties found. Exiting.');
    return;
  }

  console.log('');
  console.log('--- Importing properties ---');
  console.log('');

  const { successCount, salesCount, skipped } = await processInBatches(properties, existingParcelIds);

  console.log('');
  console.log('--- Importing market trends ---');
  console.log('');

  const marketData = await fetchMarketTrends();
  let trendsCount = 0;

  if (marketData.length > 0) {
    trendsCount = await insertMarketTrends(marketData);
    console.log(`Imported ${trendsCount} market trend records`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('');
  console.log('='.repeat(70));
  console.log('Import Complete!');
  console.log('='.repeat(70));
  console.log('');
  console.log(`Summary:`);
  console.log(`   Already in DB (skipped): ${skipped}`);
  console.log(`   New properties imported:  ${successCount}`);
  console.log(`   Sales records:            ${salesCount}`);
  console.log(`   Market trends:            ${trendsCount} data points (${marketData.length} cities)`);
  console.log(`   Total time:               ${elapsed}s`);
  console.log('');
}

importProperties()
  .then(async () => {
    console.log('Done!');
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Fatal error:', error);
    await pool.end();
    process.exit(1);
  });
