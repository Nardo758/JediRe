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

interface StructureFeature {
  attributes: {
    FeatureID: string;
    YearBuilt: string;
    Stories: number;
    LiveUnits: number;
    AreaSqFt: number;
    StructForm: string;
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

async function fetchLargeMultifamilyProperties(): Promise<TaxParcelFeature[]> {
  console.log('🔍 Querying Tax Parcels API for 100+ unit properties...');
  
  const url = `${TAX_PARCELS}/query`;
  const params = new URLSearchParams({
    where: 'LivUnits >= 100',
    outFields: '*',
    f: 'json',
    returnGeometry: 'false',
    resultRecordCount: '1000',
  });
  
  const response = await fetch(`${url}?${params}`);
  const data = await response.json();
  
  if (data.features) {
    console.log(`✅ Found ${data.features.length} properties with 100+ units`);
    return data.features;
  }
  
  console.error('❌ No properties found or API error:', data.error);
  return [];
}

async function fetchSalesHistory(parcelId: string): Promise<SaleFeature[]> {
  const allSales: SaleFeature[] = [];
  
  for (let year = 2018; year <= 2022; year++) {
    const layerId = year - 2016;
    
    const url = `${SALES_BASE}/${layerId}/query`;
    const params = new URLSearchParams({
      where: `ParID='${parcelId}'`,
      outFields: '*',
      f: 'json',
      returnGeometry: 'false',
    });
    
    try {
      const response = await fetch(`${url}?${params}`);
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        allSales.push(...data.features);
      }
    } catch (error) {
      console.error(`  ⚠️  Error fetching ${year} sales for ${parcelId}:`, error);
    }
  }
  
  return allSales;
}

async function fetchStructureData(parcelId: string): Promise<StructureFeature | null> {
  return null;
}

async function fetchMarketTrends(): Promise<MarketTrendFeature[]> {
  console.log('🔍 Querying market trends (city median prices 2012-2024)...');
  
  const url = `${MARKET_TRENDS}/query`;
  const params = new URLSearchParams({
    where: '1=1',
    outFields: '*',
    f: 'json',
    returnGeometry: 'false',
  });
  
  const response = await fetch(`${url}?${params}`);
  const data = await response.json();
  
  if (data.features) {
    console.log(`✅ Found market data for ${data.features.length} cities`);
    return data.features;
  }
  
  console.error('❌ No market trends found');
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
  
  try {
    await pool.query(query, values);
  } catch (error: any) {
    console.error(`  ❌ Error upserting ${attrs.ParcelID}:`, error.message);
  }
}

async function insertSalesRecords(parcelId: string, sales: SaleFeature[]): Promise<void> {
  if (sales.length === 0) return;
  
  const realSales = sales.filter(s => s.attributes.Price > 0);
  
  if (realSales.length === 0) return;
  
  const query = `
    INSERT INTO property_sales (
      parcel_id, sale_year, sale_price, is_current, scraped_at
    ) VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (parcel_id, sale_year) DO UPDATE SET
      sale_price = EXCLUDED.sale_price,
      is_current = EXCLUDED.is_current
  `;
  
  try {
    for (const sale of realSales) {
      const values = [
        parcelId,
        parseInt(sale.attributes.TaxYear),
        sale.attributes.Price,
        sale.attributes.Cur === 'Y',
      ];
      
      await pool.query(query, values);
    }
  } catch (error: any) {
    console.error(`  ❌ Error inserting sales for ${parcelId}:`, error.message);
  }
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
    
    try {
      for (const { year, price } of yearData) {
        if (price && price > 0) {
          await pool.query(query, [city, year, Math.round(price)]);
          count++;
        }
      }
    } catch (error: any) {
      console.error(`  ❌ Error inserting trends for ${city}:`, error.message);
    }
  }
  
  return count;
}

async function importProperties() {
  console.log('🚀 Starting Fulton County Property Import (100+ units)');
  console.log('━'.repeat(80));
  console.log('');
  
  const properties = await fetchLargeMultifamilyProperties();
  
  if (properties.length === 0) {
    console.log('❌ No properties found. Exiting.');
    return;
  }
  
  console.log('');
  console.log('━'.repeat(80));
  console.log('📥 Importing properties into database...');
  console.log('━'.repeat(80));
  console.log('');
  
  let successCount = 0;
  let salesCount = 0;
  
  for (let i = 0; i < properties.length; i++) {
    const property = properties[i];
    const parcelId = property.attributes.ParcelID;
    const address = property.attributes.Address;
    const units = property.attributes.LivUnits;
    
    console.log(`[${i + 1}/${properties.length}] ${address} (${units} units, ${parcelId})`);
    
    try {
      await upsertPropertyRecord(property);
      successCount++;
      
      const sales = await fetchSalesHistory(parcelId);
      if (sales.length > 0) {
        await insertSalesRecords(parcelId, sales);
        const realSales = sales.filter(s => s.attributes.Price > 0);
        if (realSales.length > 0) {
          console.log(`  💰 Found ${realSales.length} sale(s)`);
          salesCount += realSales.length;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`  ❌ Error processing ${parcelId}:`, error);
    }
  }
  
  console.log('');
  console.log('━'.repeat(80));
  console.log('📈 Importing market trends (city median prices)...');
  console.log('━'.repeat(80));
  console.log('');
  
  const marketData = await fetchMarketTrends();
  let trendsCount = 0;
  
  if (marketData.length > 0) {
    trendsCount = await insertMarketTrends(marketData);
    console.log(`✅ Imported ${trendsCount} market trend records`);
  }
  
  console.log('');
  console.log('━'.repeat(80));
  console.log('✅ Import Complete!');
  console.log('━'.repeat(80));
  console.log('');
  console.log(`📊 Summary:`);
  console.log(`   Properties imported: ${successCount}/${properties.length}`);
  console.log(`   Sales records: ${salesCount}`);
  console.log(`   Market trends: ${trendsCount} data points (${marketData.length} cities, 2012-2024)`);
  console.log('');
  console.log('🎯 Next steps:');
  console.log('   1. Check property_records table');
  console.log('   2. Check property_sales table for sales history');
  console.log('   3. Check market_trends table for city-level context');
  console.log('   4. Query property_metrics view for per-unit calculations');
  console.log('');
}

importProperties()
  .then(async () => {
    console.log('✨ Done!');
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('💥 Fatal error:', error);
    await pool.end();
    process.exit(1);
  });
