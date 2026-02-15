# 🏛️ Municipal Property Records Scraper - Architecture & Implementation

**Purpose:** Scrape public property records from county assessor websites  
**Scope:** Multi-county support for major US real estate markets  
**Data:** Sales, taxes, ownership, property details  
**Status:** Production-ready architecture

---

## 🎯 System Overview

### **Architecture**
```
┌─────────────────────────────────────────────────────────────┐
│  JEDI RE Platform                                           │
│  (User requests property data)                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  Municipal Scraper Service                                  │
│  • County detector (address → jurisdiction)                 │
│  • Scraper router (county → scraper implementation)         │
│  • Data normalizer (raw → standardized schema)             │
│  • Cache layer (avoid redundant scrapes)                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
         ┌───────────┴───────────┬─────────────┐
         ↓                       ↓             ↓
┌─────────────────┐    ┌─────────────────┐   ┌─────────────────┐
│ County Scraper  │    │ County Scraper  │   │ County Scraper  │
│ Fulton (GA)     │    │ DeKalb (GA)     │   │ Cobb (GA)       │
│                 │    │                 │   │                 │
│ • Detect site   │    │ • Detect site   │   │ • Detect site   │
│ • Parse HTML    │    │ • Parse HTML    │   │ • Parse HTML    │
│ • Extract data  │    │ • Extract data  │   │ • Extract data  │
└────────┬────────┘    └────────┬────────┘   └────────┬────────┘
         │                      │                      │
         ↓                      ↓                      ↓
┌─────────────────────────────────────────────────────────────┐
│  County Assessor Websites (Public)                          │
│  • qpublic.schneidercorp.com (Fulton)                       │
│  • web.co.dekalb.ga.us (DeKalb)                             │
│  • cobbassessor.org (Cobb)                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema

### **Core Tables**

```sql
-- ═════════════════════════════════════════════════════════════
-- Property Records (Master table)
-- ═════════════════════════════════════════════════════════════

CREATE TABLE property_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identifiers
  parcel_id VARCHAR(100) NOT NULL,
  county VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  
  -- Address (normalized)
  address TEXT NOT NULL,
  city VARCHAR(100),
  zip VARCHAR(10),
  geom GEOMETRY(POINT, 4326), -- PostGIS
  
  -- Property Details
  property_type VARCHAR(50), -- 'Multifamily', 'Office', 'Retail', etc.
  year_built INT,
  building_sqft NUMERIC,
  lot_size_sqft NUMERIC,
  lot_size_acres NUMERIC,
  stories INT,
  units INT,
  zoning VARCHAR(50),
  
  -- Assessment
  land_assessed_value NUMERIC,
  improvement_assessed_value NUMERIC,
  total_assessed_value NUMERIC,
  market_value_estimate NUMERIC,
  assessment_year INT,
  
  -- Taxes
  annual_taxes NUMERIC,
  tax_rate NUMERIC, -- Percentage
  county_taxes NUMERIC,
  city_taxes NUMERIC,
  school_taxes NUMERIC,
  special_assessments NUMERIC,
  
  -- Tax burden analysis
  taxes_per_unit NUMERIC,
  taxes_per_sqft NUMERIC,
  
  -- Ownership
  owner_name TEXT,
  owner_type VARCHAR(50), -- 'Individual', 'LLC', 'Corporation', 'REIT', 'Trust'
  owner_address TEXT,
  owner_city VARCHAR(100),
  owner_state VARCHAR(2),
  owner_zip VARCHAR(10),
  is_out_of_state BOOLEAN,
  
  -- Current ownership timeline
  ownership_start_date DATE,
  ownership_duration_years NUMERIC,
  
  -- Legal
  legal_description TEXT,
  subdivision VARCHAR(200),
  
  -- Metadata
  scraped_at TIMESTAMP DEFAULT NOW(),
  scraper_version VARCHAR(20),
  data_source_url TEXT,
  data_quality_score NUMERIC, -- 0-100
  
  -- Indexes
  UNIQUE(parcel_id, county, state)
);

CREATE INDEX idx_property_records_geom ON property_records USING GIST(geom);
CREATE INDEX idx_property_records_address ON property_records(address);
CREATE INDEX idx_property_records_county ON property_records(county, state);
CREATE INDEX idx_property_records_owner ON property_records(owner_name);
CREATE INDEX idx_property_records_type ON property_records(property_type);


-- ═════════════════════════════════════════════════════════════
-- Sales History (All transactions)
-- ═════════════════════════════════════════════════════════════

CREATE TABLE property_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_record_id UUID REFERENCES property_records(id),
  
  -- Transaction
  sale_date DATE NOT NULL,
  sale_price NUMERIC NOT NULL,
  
  -- Parties
  seller_name TEXT,
  buyer_name TEXT,
  buyer_type VARCHAR(50), -- 'Individual', 'LLC', 'Institutional', etc.
  
  -- Transaction details
  sale_type VARCHAR(50), -- 'Arms Length', 'Foreclosure', 'Auction', 'REO'
  financing_type VARCHAR(50), -- 'Cash', 'Conventional', 'Commercial'
  deed_book VARCHAR(50),
  deed_page VARCHAR(50),
  
  -- Calculated metrics
  price_per_unit NUMERIC,
  price_per_sqft NUMERIC,
  cap_rate_estimate NUMERIC,
  
  -- Hold period (for previous owner)
  previous_purchase_date DATE,
  hold_period_years NUMERIC,
  appreciation_pct NUMERIC,
  annual_appreciation_pct NUMERIC,
  
  -- Metadata
  scraped_at TIMESTAMP DEFAULT NOW(),
  data_source_url TEXT
);

CREATE INDEX idx_property_sales_property ON property_sales(property_record_id);
CREATE INDEX idx_property_sales_date ON property_sales(sale_date DESC);
CREATE INDEX idx_property_sales_price ON property_sales(sale_price);


-- ═════════════════════════════════════════════════════════════
-- Tax History (Annual changes)
-- ═════════════════════════════════════════════════════════════

CREATE TABLE property_tax_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_record_id UUID REFERENCES property_records(id),
  
  -- Tax year
  tax_year INT NOT NULL,
  
  -- Assessment
  assessed_value NUMERIC,
  
  -- Taxes paid
  taxes_paid NUMERIC,
  tax_rate NUMERIC,
  
  -- Payment status
  payment_status VARCHAR(50), -- 'Paid', 'Delinquent', 'Appealed'
  payment_date DATE,
  
  -- Changes from prior year
  assessed_value_change_pct NUMERIC,
  taxes_change_pct NUMERIC,
  
  -- Metadata
  scraped_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_property_tax_history_property ON property_tax_history(property_record_id);
CREATE INDEX idx_property_tax_history_year ON property_tax_history(tax_year DESC);


-- ═════════════════════════════════════════════════════════════
-- Permit History
-- ═════════════════════════════════════════════════════════════

CREATE TABLE property_permits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_record_id UUID REFERENCES property_records(id),
  
  -- Permit details
  permit_number VARCHAR(100),
  permit_type VARCHAR(100), -- 'Building', 'Electrical', 'Plumbing', 'Demolition'
  permit_description TEXT,
  
  -- Dates
  issued_date DATE,
  completed_date DATE,
  
  -- Valuation
  estimated_cost NUMERIC,
  
  -- Status
  status VARCHAR(50), -- 'Issued', 'Completed', 'Expired', 'Revoked'
  
  -- Contractor
  contractor_name TEXT,
  
  -- Metadata
  scraped_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_property_permits_property ON property_permits(property_record_id);
CREATE INDEX idx_property_permits_date ON property_permits(issued_date DESC);
CREATE INDEX idx_property_permits_type ON property_permits(permit_type);


-- ═════════════════════════════════════════════════════════════
-- Scraper Metadata (Track scraping performance)
-- ═════════════════════════════════════════════════════════════

CREATE TABLE scraper_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Run details
  county VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  scraper_version VARCHAR(20),
  
  -- Timestamps
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  duration_seconds INT,
  
  -- Results
  properties_attempted INT,
  properties_successful INT,
  properties_failed INT,
  success_rate NUMERIC,
  
  -- Errors
  error_count INT,
  error_details JSONB,
  
  -- Performance
  avg_time_per_property_ms INT
);

CREATE INDEX idx_scraper_runs_county ON scraper_runs(county, state);
CREATE INDEX idx_scraper_runs_date ON scraper_runs(started_at DESC);
```

---

## 🌍 County Scraper Implementations

### **Priority 1: Atlanta Metro (Phase 1)**

#### **Fulton County, GA**
- **Site:** `qpublic.schneidercorp.com/Application.aspx?App=FultonCountyGA`
- **Type:** Schneider GeoPortal (common platform)
- **Data Available:** Sales, taxes, ownership, permits
- **Auth:** None required (public access)
- **Rate Limit:** ~60 requests/minute
- **Complexity:** MEDIUM (AJAX-based search)

**Sample URL Pattern:**
```
https://qpublic.schneidercorp.com/Application.aspx?App=FultonCountyGA&Layer=Parcels&PageType=Detail&KeyValue=14-0089-0001-067-3
```

#### **DeKalb County, GA**
- **Site:** `web.co.dekalb.ga.us/`
- **Type:** Custom county portal
- **Data Available:** Sales, taxes, ownership
- **Auth:** None required
- **Rate Limit:** ~30 requests/minute
- **Complexity:** LOW (simple HTML)

#### **Cobb County, GA**
- **Site:** `cobbassessor.org`
- **Type:** Custom assessor site
- **Data Available:** Sales, taxes, assessments
- **Auth:** None required
- **Rate Limit:** ~45 requests/minute
- **Complexity:** MEDIUM

#### **Gwinnett County, GA**
- **Site:** `gwinnettassessor.com`
- **Type:** Custom portal
- **Data Available:** Sales, taxes, ownership
- **Auth:** None required
- **Rate Limit:** ~30 requests/minute
- **Complexity:** LOW

---

### **Priority 2: Major US Markets (Phase 2)**

#### **Texas**
- **Harris County (Houston):** `hcad.org` (HIGH volume)
- **Dallas County:** `dallascad.org` (AJAX heavy)
- **Travis County (Austin):** `traviscad.org` (excellent API!)
- **Bexar County (San Antonio):** `bcad.org`

#### **Florida**
- **Miami-Dade:** `miamidade.gov/pa` (complex multi-step)
- **Orange County (Orlando):** `ocpafl.org` (excellent data)
- **Hillsborough (Tampa):** `hcpafl.org`
- **Broward (Fort Lauderdale):** `bcpa.net`

#### **North Carolina**
- **Mecklenburg (Charlotte):** `meckcama.co.mecklenburg.nc.us` (great portal)
- **Wake (Raleigh):** `wake.gov/property` (simple)

#### **Other Major Markets**
- **Maricopa, AZ (Phoenix):** `maricopa.gov/assessor`
- **Clark, NV (Las Vegas):** `assessor.clarkcountynv.gov`
- **King, WA (Seattle):** `kingcounty.gov/assessor`

---

## 🛠️ Technical Implementation

### **Service Layer** (`municipalScraper.service.ts`)

```typescript
import axios from 'axios';
import * as cheerio from 'cheerio';
import { parseAddress } from 'parse-address';

export interface PropertyRecordData {
  // Identifiers
  parcelId: string;
  county: string;
  state: string;
  
  // Address
  address: string;
  city: string;
  zip: string;
  latitude?: number;
  longitude?: number;
  
  // Property
  propertyType?: string;
  yearBuilt?: number;
  buildingSqft?: number;
  lotSizeSqft?: number;
  units?: number;
  zoning?: string;
  
  // Assessment
  landValue?: number;
  improvementValue?: number;
  totalAssessedValue?: number;
  assessmentYear?: number;
  
  // Taxes
  annualTaxes?: number;
  taxRate?: number;
  
  // Ownership
  ownerName?: string;
  ownerAddress?: string;
  ownershipStartDate?: Date;
  
  // Sales (most recent)
  lastSaleDate?: Date;
  lastSalePrice?: number;
  
  // Metadata
  dataSourceUrl: string;
  scrapedAt: Date;
}

export interface SaleHistory {
  saleDate: Date;
  salePrice: number;
  sellerName?: string;
  buyerName?: string;
  saleType?: string;
  deedBook?: string;
  deedPage?: string;
}

// ═════════════════════════════════════════════════════════════
// Main Service Class
// ═════════════════════════════════════════════════════════════

export class MunicipalScraperService {
  
  /**
   * Main entry point: Scrape property data by address
   */
  async scrapePropertyByAddress(address: string): Promise<PropertyRecordData | null> {
    // 1. Parse address to extract components
    const parsed = parseAddress(address);
    if (!parsed) {
      throw new Error(`Unable to parse address: ${address}`);
    }
    
    // 2. Geocode to determine county jurisdiction
    const { county, state } = await this.detectCounty(address, parsed);
    
    // 3. Route to appropriate county scraper
    const scraper = this.getCountyScraper(county, state);
    if (!scraper) {
      throw new Error(`No scraper available for ${county}, ${state}`);
    }
    
    // 4. Execute scrape
    const data = await scraper.scrape(address, parsed);
    
    // 5. Normalize data
    const normalized = await this.normalizeData(data, county, state);
    
    // 6. Save to database
    await this.savePropertyRecord(normalized);
    
    return normalized;
  }
  
  /**
   * Scrape multiple properties (batch mode)
   */
  async scrapeProperties(addresses: string[]): Promise<PropertyRecordData[]> {
    const results: PropertyRecordData[] = [];
    
    for (const address of addresses) {
      try {
        const data = await this.scrapePropertyByAddress(address);
        if (data) results.push(data);
        
        // Rate limiting: wait 1-2 seconds between requests
        await this.sleep(1000 + Math.random() * 1000);
      } catch (error) {
        console.error(`Failed to scrape ${address}:`, error);
      }
    }
    
    return results;
  }
  
  /**
   * Get comparable sales around a property
   */
  async getComparableSales(
    address: string,
    radiusMiles: number = 3,
    monthsBack: number = 12
  ): Promise<SaleHistory[]> {
    // 1. Get subject property record
    const subject = await this.scrapePropertyByAddress(address);
    if (!subject || !subject.latitude || !subject.longitude) {
      throw new Error('Unable to geocode subject property');
    }
    
    // 2. Query database for nearby properties with recent sales
    const comps = await this.findNearbyProperties(
      subject.latitude,
      subject.longitude,
      radiusMiles,
      subject.propertyType,
      subject.units
    );
    
    // 3. For each comp, get sale history
    const sales: SaleHistory[] = [];
    for (const comp of comps) {
      const compSales = await this.getPropertySalesHistory(comp.parcelId, comp.county, comp.state);
      
      // Filter to recent sales
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);
      
      const recentSales = compSales.filter(s => s.saleDate >= cutoffDate);
      sales.push(...recentSales);
    }
    
    // 4. Sort by date (most recent first)
    sales.sort((a, b) => b.saleDate.getTime() - a.saleDate.getTime());
    
    return sales;
  }
  
  // ═════════════════════════════════════════════════════════════
  // County Detection
  // ═════════════════════════════════════════════════════════════
  
  private async detectCounty(address: string, parsed: any): Promise<{ county: string; state: string }> {
    // Option 1: Use geocoding service (Google Maps, Mapbox, etc.)
    const geocoded = await this.geocodeAddress(address);
    if (geocoded && geocoded.county) {
      return { county: geocoded.county, state: geocoded.state };
    }
    
    // Option 2: Fallback to parsed address city + state lookup
    if (parsed.city && parsed.state) {
      return await this.lookupCountyByCityState(parsed.city, parsed.state);
    }
    
    throw new Error(`Unable to determine county for address: ${address}`);
  }
  
  private async geocodeAddress(address: string): Promise<any> {
    // Use Google Geocoding API or Mapbox
    // Returns: { latitude, longitude, county, state }
    // Implementation depends on chosen service
    return null; // TODO
  }
  
  // ═════════════════════════════════════════════════════════════
  // County Scraper Router
  // ═════════════════════════════════════════════════════════════
  
  private getCountyScraper(county: string, state: string): CountyScraper | null {
    const key = `${county.toLowerCase()},${state.toLowerCase()}`;
    
    const scrapers: Record<string, CountyScraper> = {
      'fulton,ga': new FultonCountyGAScraper(),
      'dekalb,ga': new DeKalbCountyGAScraper(),
      'cobb,ga': new CobbCountyGAScraper(),
      'gwinnett,ga': new GwinnettCountyGAScraper(),
      // Add more as implemented
    };
    
    return scrapers[key] || null;
  }
  
  // ═════════════════════════════════════════════════════════════
  // Data Normalization
  // ═════════════════════════════════════════════════════════════
  
  private async normalizeData(
    raw: any,
    county: string,
    state: string
  ): Promise<PropertyRecordData> {
    // Standardize field names, convert units, clean data
    return {
      ...raw,
      county,
      state,
      scrapedAt: new Date(),
    };
  }
  
  // ═════════════════════════════════════════════════════════════
  // Database Operations
  // ═════════════════════════════════════════════════════════════
  
  private async savePropertyRecord(data: PropertyRecordData): Promise<void> {
    // Upsert into property_records table
    // Use ON CONFLICT (parcel_id, county, state) DO UPDATE
  }
  
  private async findNearbyProperties(
    lat: number,
    lng: number,
    radiusMiles: number,
    propertyType?: string,
    units?: number
  ): Promise<PropertyRecordData[]> {
    // PostGIS query: ST_DWithin(geom, ST_Point(lng, lat), radius)
    // Filter by property type and similar unit count
    return []; // TODO
  }
  
  private async getPropertySalesHistory(
    parcelId: string,
    county: string,
    state: string
  ): Promise<SaleHistory[]> {
    // Query property_sales table
    return []; // TODO
  }
  
  // ═════════════════════════════════════════════════════════════
  // Utilities
  // ═════════════════════════════════════════════════════════════
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ═════════════════════════════════════════════════════════════
// Base County Scraper Interface
// ═════════════════════════════════════════════════════════════

abstract class CountyScraper {
  abstract scrape(address: string, parsed: any): Promise<Partial<PropertyRecordData>>;
  
  protected async fetchHTML(url: string): Promise<string> {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JEDI-RE-PropertyBot/1.0)',
      },
    });
    return response.data;
  }
  
  protected parseHTML(html: string): cheerio.CheerioAPI {
    return cheerio.load(html);
  }
}

// ═════════════════════════════════════════════════════════════
// Fulton County, GA Scraper (Schneider GeoPortal)
// ═════════════════════════════════════════════════════════════

class FultonCountyGAScraper extends CountyScraper {
  private baseUrl = 'https://qpublic.schneidercorp.com/Application.aspx';
  
  async scrape(address: string, parsed: any): Promise<Partial<PropertyRecordData>> {
    // 1. Search for parcel by address
    const parcelId = await this.searchParcel(address);
    if (!parcelId) {
      throw new Error(`Parcel not found for address: ${address}`);
    }
    
    // 2. Fetch property detail page
    const detailUrl = `${this.baseUrl}?App=FultonCountyGA&Layer=Parcels&PageType=Detail&KeyValue=${parcelId}`;
    const html = await this.fetchHTML(detailUrl);
    const $ = this.parseHTML(html);
    
    // 3. Extract data from page
    const data: Partial<PropertyRecordData> = {
      parcelId,
      address: this.extractText($, '#ctlBodyPane_ctl00_ctl01_txtSitus'),
      
      // Property details
      yearBuilt: this.extractNumber($, '#ctlBodyPane_ctl01_ctl01_txtYearBuilt'),
      buildingSqft: this.extractNumber($, '#ctlBodyPane_ctl02_ctl01_txtBuildingSqft'),
      lotSizeSqft: this.extractNumber($, '#ctlBodyPane_ctl03_ctl01_txtLotSize'),
      
      // Assessment
      landValue: this.extractCurrency($, '#ctlBodyPane_ctl05_ctl01_txtLandValue'),
      improvementValue: this.extractCurrency($, '#ctlBodyPane_ctl05_ctl01_txtImprovementValue'),
      totalAssessedValue: this.extractCurrency($, '#ctlBodyPane_ctl05_ctl01_txtTotalValue'),
      assessmentYear: new Date().getFullYear(),
      
      // Taxes
      annualTaxes: this.extractCurrency($, '#ctlBodyPane_ctl06_ctl01_txtAnnualTaxes'),
      
      // Ownership
      ownerName: this.extractText($, '#ctlBodyPane_ctl04_ctl01_txtOwner'),
      ownerAddress: this.extractText($, '#ctlBodyPane_ctl04_ctl01_txtOwnerAddress'),
      
      dataSourceUrl: detailUrl,
    };
    
    // 4. Extract sales history (separate section)
    const sales = await this.extractSalesHistory($, parcelId);
    if (sales.length > 0) {
      data.lastSaleDate = sales[0].saleDate;
      data.lastSalePrice = sales[0].salePrice;
    }
    
    return data;
  }
  
  private async searchParcel(address: string): Promise<string | null> {
    // Schneider GeoPortal search (AJAX-based)
    // Returns parcel ID
    // Implementation: POST to search endpoint, parse JSON response
    return null; // TODO
  }
  
  private async extractSalesHistory($: cheerio.CheerioAPI, parcelId: string): Promise<SaleHistory[]> {
    // Sales are in a table: #ctlBodyPane_ctl10_ctl01_grdSales
    const sales: SaleHistory[] = [];
    
    $('#ctlBodyPane_ctl10_ctl01_grdSales tr').each((i, row) => {
      if (i === 0) return; // Skip header
      
      const $row = $(row);
      const cells = $row.find('td');
      
      if (cells.length >= 3) {
        sales.push({
          saleDate: this.parseDate($(cells[0]).text()),
          salePrice: this.parseCurrency($(cells[1]).text()),
          saleType: $(cells[2]).text().trim(),
        });
      }
    });
    
    return sales;
  }
  
  // Helper methods
  private extractText($: cheerio.CheerioAPI, selector: string): string {
    return $(selector).val()?.toString().trim() || '';
  }
  
  private extractNumber($: cheerio.CheerioAPI, selector: string): number | undefined {
    const text = this.extractText($, selector);
    const num = parseInt(text.replace(/[^0-9]/g, ''));
    return isNaN(num) ? undefined : num;
  }
  
  private extractCurrency($: cheerio.CheerioAPI, selector: string): number | undefined {
    const text = this.extractText($, selector);
    const num = parseFloat(text.replace(/[$,]/g, ''));
    return isNaN(num) ? undefined : num;
  }
  
  private parseDate(text: string): Date {
    return new Date(text);
  }
  
  private parseCurrency(text: string): number {
    return parseFloat(text.replace(/[$,]/g, ''));
  }
}

// ═════════════════════════════════════════════════════════════
// Additional county scrapers follow same pattern...
// ═════════════════════════════════════════════════════════════
```

---

## 📡 API Endpoints

### **Scraping Operations**

```typescript
// ═════════════════════════════════════════════════════════════
// Scrape single property
// ═════════════════════════════════════════════════════════════
POST /api/municipal/scrape
{
  "address": "3500 Peachtree Road NE, Atlanta, GA 30326"
}

Response:
{
  "success": true,
  "data": {
    "parcelId": "14-0089-0001-067-3",
    "county": "Fulton",
    "state": "GA",
    "address": "3500 Peachtree Road NE",
    "city": "Atlanta",
    "zip": "30326",
    "totalAssessedValue": 45200000,
    "annualTaxes": 486720,
    "ownerName": "ABC Properties LLC",
    "lastSaleDate": "2018-01-15",
    "lastSalePrice": 38500000,
    ...
  },
  "scrapedAt": "2026-02-15T12:34:56Z"
}

// ═════════════════════════════════════════════════════════════
// Get comparable sales
// ═════════════════════════════════════════════════════════════
GET /api/municipal/comps
  ?address=3500+Peachtree+Road+NE+Atlanta+GA
  &radius=3
  &months=12
  &propertyType=Multifamily
  &minUnits=150
  &maxUnits=300

Response:
{
  "success": true,
  "count": 12,
  "comps": [
    {
      "address": "3400 Peachtree Rd",
      "saleDate": "2026-01-15",
      "salePrice": 42500000,
      "pricePerUnit": 188053,
      "units": 226,
      "capRate": 4.7,
      "taxes": 642040,
      "taxesPerUnit": 2840,
      "holdPeriod": 8.2,
      "distanceMiles": 0.8
    },
    ...
  ]
}

// ═════════════════════════════════════════════════════════════
// Get property sales history
// ═════════════════════════════════════════════════════════════
GET /api/municipal/sales-history/:parcelId

Response:
{
  "success": true,
  "parcelId": "14-0089-0001-067-3",
  "sales": [
    {
      "saleDate": "2018-01-15",
      "salePrice": 38500000,
      "sellerName": "XYZ Holdings",
      "buyerName": "ABC Properties LLC",
      "saleType": "Arms Length",
      "holdPeriod": null
    },
    {
      "saleDate": "2010-06-22",
      "salePrice": 28200000,
      "sellerName": "Original Developer",
      "buyerName": "XYZ Holdings",
      "saleType": "Arms Length",
      "holdPeriod": 7.6
    }
  ]
}

// ═════════════════════════════════════════════════════════════
// Batch scrape multiple properties
// ═════════════════════════════════════════════════════════════
POST /api/municipal/scrape-batch
{
  "addresses": [
    "3500 Peachtree Road NE, Atlanta, GA 30326",
    "3400 Peachtree Road NE, Atlanta, GA 30326",
    ...
  ]
}

Response:
{
  "success": true,
  "total": 10,
  "successful": 9,
  "failed": 1,
  "results": [...]
}
```

---

## 🚀 Deployment

### **Backend Service**
```bash
# Install dependencies
npm install axios cheerio parse-address

# Run scraper service
npm run scraper:start

# Test single property
npm run scraper:test -- "3500 Peachtree Road NE, Atlanta, GA 30326"
```

### **Database Setup**
```sql
-- Run migrations
psql -d jedire < migrations/022_property_records_schema.sql

-- Enable PostGIS (if not already)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Test queries
SELECT COUNT(*) FROM property_records;
SELECT * FROM property_records WHERE county = 'Fulton' AND state = 'GA';
```

### **Cron Jobs** (Scheduled scraping)
```javascript
// Daily: Scrape recent sales
// Every Monday: Update tax assessments
// Quarterly: Full property re-scrape for active deals

// Example cron config
{
  "schedule": "0 2 * * *", // 2 AM daily
  "task": "scrape-recent-sales",
  "counties": ["Fulton,GA", "DeKalb,GA", "Cobb,GA"]
}
```

---

## 🔒 Legal & Compliance

### **Public Records Access**
- ✅ Data is public and legally scrapable
- ✅ No authentication bypass required
- ✅ Terms of Service: Read-only access, no automated tools clause varies by county

### **Rate Limiting**
- Respect server capacity: 1-2 seconds between requests
- Monitor for 429/503 errors
- Implement exponential backoff

### **Data Privacy**
- Owner names are public record (no GDPR concerns for US properties)
- Store only publicly available data
- Do not share scraped data with third parties

### **Attribution**
- Credit data source: "Property data from [County] Assessor"
- Link to source: Include `dataSourceUrl` in responses

---

## 📊 Success Metrics

### **Coverage**
- Counties implemented: 4 (Phase 1)
- Properties scraped: Target 10,000+
- Comparable sales database: Target 5,000+ recent transactions

### **Quality**
- Scraping success rate: >95%
- Data completeness: >90% (all core fields)
- Data freshness: <7 days average age

### **Performance**
- Scrape time per property: <5 seconds
- API response time: <500ms (cached comps)
- Uptime: >99.5%

---

## 🎯 Roadmap

### **Phase 1** (Week 1-2) - Atlanta Metro
- ✅ Schema designed
- [ ] Fulton County scraper (2 days)
- [ ] DeKalb County scraper (1 day)
- [ ] Cobb + Gwinnett scrapers (1 day)
- [ ] API endpoints (1 day)
- [ ] Testing + documentation (1 day)

### **Phase 2** (Week 3-4) - Texas + Florida
- [ ] Harris County (Houston)
- [ ] Dallas County
- [ ] Travis County (Austin)
- [ ] Miami-Dade
- [ ] Orange County (Orlando)

### **Phase 3** (Week 5-6) - Nationwide Expansion
- [ ] 10 additional major markets
- [ ] Generic scraper templates
- [ ] Automated county detection

### **Phase 4** (Month 2+) - Advanced Features
- [ ] Permit tracking
- [ ] Violation monitoring
- [ ] Tax appeal opportunity detection
- [ ] Predictive reassessment modeling

---

**Architecture Complete:** Municipal scraper system  
**Estimated Build:** 2 weeks (Phase 1)  
**Status:** Ready for development  
**Next:** Agent 3 - Integration layer

