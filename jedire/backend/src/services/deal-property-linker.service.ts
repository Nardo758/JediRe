import { Pool } from 'pg';
import { getPool } from '../database/connection';

function normalizeAddress(addr: string): string {
  return addr
    .toUpperCase()
    .replace(/[.,#]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\bAPT\b\s*\S*/i, '')
    .replace(/\bSUITE\b\s*\S*/i, '')
    .replace(/\bSTE\b\s*\S*/i, '')
    .replace(/\bUNIT\b\s*\S*/i, '')
    .replace(/\b(STREET|STR)\b/g, 'ST')
    .replace(/\bAVENUE\b/g, 'AVE')
    .replace(/\bBOULEVARD\b/g, 'BLVD')
    .replace(/\bDRIVE\b/g, 'DR')
    .replace(/\bLANE\b/g, 'LN')
    .replace(/\bROAD\b/g, 'RD')
    .replace(/\bCOURT\b/g, 'CT')
    .replace(/\bPLACE\b/g, 'PL')
    .replace(/\bCIRCLE\b/g, 'CIR')
    .replace(/\bPARKWAY\b/g, 'PKWY')
    .replace(/\bHIGHWAY\b/g, 'HWY')
    .trim();
}

export interface AutoLinkResult {
  dealId: string;
  propertyId: string | null;
  action: 'linked' | 'created_and_linked' | 'already_linked' | 'no_address' | 'failed';
  confidence?: number;
  error?: string;
}

export interface BatchLinkSummary {
  totalDeals: number;
  linked: number;
  created: number;
  alreadyLinked: number;
  noAddress: number;
  failed: number;
  results: AutoLinkResult[];
}

export class DealPropertyLinkerService {
  private pool: Pool;

  constructor() {
    this.pool = getPool();
  }

  async autoLinkDeal(dealId: string): Promise<AutoLinkResult> {
    const dealResult = await this.pool.query(
      `SELECT id, address, property_address, state FROM deals WHERE id = $1`,
      [dealId]
    );

    if (dealResult.rows.length === 0) {
      return { dealId, propertyId: null, action: 'failed', error: 'Deal not found' };
    }

    const deal = dealResult.rows[0];
    const dealAddress = deal.address || deal.property_address;

    if (!dealAddress || dealAddress.trim().length < 5) {
      return { dealId, propertyId: null, action: 'no_address' };
    }

    const existingLink = await this.pool.query(
      `SELECT property_id FROM deal_properties WHERE deal_id = $1 LIMIT 1`,
      [dealId]
    );

    if (existingLink.rows.length > 0) {
      return { dealId, propertyId: existingLink.rows[0].property_id, action: 'already_linked' };
    }

    const normalized = normalizeAddress(dealAddress);

    const exactMatch = await this.pool.query(
      `SELECT id, address_line1 FROM properties
       WHERE UPPER(REPLACE(REPLACE(REPLACE(address_line1, ',', ''), '.', ''), '#', '')) = $1
       LIMIT 1`,
      [normalized]
    );

    if (exactMatch.rows.length > 0) {
      const propertyId = exactMatch.rows[0].id;
      await this.insertLink(dealId, propertyId, 1.0);
      return { dealId, propertyId, action: 'linked', confidence: 1.0 };
    }

    const streetNum = normalized.match(/^(\d+)\s/)?.[1];
    const streetName = normalized.replace(/^\d+\s+/, '').split(/\s+(NW|NE|SW|SE|N|S|E|W)\s*$/i)[0];

    if (streetNum && streetName && streetName.length >= 3) {
      const fuzzyMatch = await this.pool.query(
        `SELECT id, address_line1 FROM properties
         WHERE address_line1 IS NOT NULL
           AND UPPER(address_line1) LIKE $1
         LIMIT 1`,
        [`${streetNum} ${streetName}%`]
      );

      if (fuzzyMatch.rows.length > 0) {
        const propertyId = fuzzyMatch.rows[0].id;
        await this.insertLink(dealId, propertyId, 0.8);
        return { dealId, propertyId, action: 'linked', confidence: 0.8 };
      }
    }

    try {
      const propertyId = await this.createPropertyFromDeal(deal, dealAddress);
      await this.insertLink(dealId, propertyId, 1.0);
      return { dealId, propertyId, action: 'created_and_linked', confidence: 1.0 };
    } catch (err: any) {
      if (err.message?.includes('duplicate key') || err.code === '23505') {
        const existing = await this.pool.query(
          `SELECT id FROM properties WHERE address_line1 = $1 LIMIT 1`,
          [dealAddress]
        );
        if (existing.rows.length > 0) {
          const propertyId = existing.rows[0].id;
          await this.insertLink(dealId, propertyId, 0.9);
          return { dealId, propertyId, action: 'linked', confidence: 0.9 };
        }
      }
      throw err;
    }
  }

  async autoLinkAll(): Promise<BatchLinkSummary> {
    const dealsResult = await this.pool.query(
      `SELECT d.id FROM deals d
       LEFT JOIN deal_properties dp ON d.id = dp.deal_id
       WHERE dp.id IS NULL
       ORDER BY d.created_at DESC`
    );

    const summary: BatchLinkSummary = {
      totalDeals: dealsResult.rows.length,
      linked: 0,
      created: 0,
      alreadyLinked: 0,
      noAddress: 0,
      failed: 0,
      results: [],
    };

    for (const row of dealsResult.rows) {
      try {
        const result = await this.autoLinkDeal(row.id);
        summary.results.push(result);

        switch (result.action) {
          case 'linked': summary.linked++; break;
          case 'created_and_linked': summary.created++; break;
          case 'already_linked': summary.alreadyLinked++; break;
          case 'no_address': summary.noAddress++; break;
          case 'failed': summary.failed++; break;
        }
      } catch (err: any) {
        summary.failed++;
        summary.results.push({ dealId: row.id, propertyId: null, action: 'failed', error: err.message });
      }
    }

    return summary;
  }

  async getDealProperties(dealId: string): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT
         p.*,
         dp.relationship,
         dp.linked_by,
         dp.confidence_score,
         dp.notes as link_notes,
         dp.created_at as linked_at
       FROM deal_properties dp
       JOIN properties p ON dp.property_id = p.id
       WHERE dp.deal_id = $1
       ORDER BY dp.created_at DESC`,
      [dealId]
    );

    return result.rows.map(row => ({
      id: row.id,
      addressLine1: row.address_line1,
      city: row.city,
      stateCode: row.state_code,
      zip: row.zip,
      county: row.county,
      name: row.name,
      propertyType: row.property_type,
      lat: row.lat,
      lng: row.lng,
      lotAcres: row.lot_acres != null ? parseFloat(row.lot_acres) : null,
      totalSf: row.total_sf != null ? parseFloat(row.total_sf) : null,
      buildingSf: row.building_sf != null ? parseFloat(row.building_sf) : null,
      sqft: row.sqft != null ? parseInt(row.sqft) : null,
      units: row.units != null ? parseInt(row.units) : null,
      stories: row.stories != null ? parseInt(row.stories) : null,
      yearBuilt: row.year_built != null ? parseInt(row.year_built) : null,
      buildingClass: row.building_class,
      rent: row.rent != null ? parseFloat(row.rent) : null,
      avgRent: row.avg_rent != null ? parseFloat(row.avg_rent) : null,
      marketRent: row.market_rent != null ? parseFloat(row.market_rent) : null,
      currentOccupancy: row.current_occupancy != null ? parseFloat(row.current_occupancy) : null,
      jediScore: row.jedi_score != null ? parseFloat(row.jedi_score) : null,
      assessedValue: row.assessed_value != null ? parseFloat(row.assessed_value) : null,
      assessedLand: row.assessed_land != null ? parseFloat(row.assessed_land) : null,
      assessedImprovements: row.assessed_improvements != null ? parseFloat(row.assessed_improvements) : null,
      appraisedValue: row.appraised_value != null ? parseFloat(row.appraised_value) : null,
      appraisedLand: row.appraised_land != null ? parseFloat(row.appraised_land) : null,
      appraisedImprovements: row.appraised_improvements != null ? parseFloat(row.appraised_improvements) : null,
      taxDistrict: row.tax_district,
      annualTaxes: row.annual_taxes != null ? parseFloat(row.annual_taxes) : null,
      millageRate: row.millage_rate != null ? parseFloat(row.millage_rate) : null,
      parcelId: row.parcel_id,
      lastSaleAmount: row.last_sale_amount != null ? parseFloat(row.last_sale_amount) : null,
      lastSaleDate: row.last_sale_date,
      enrichmentSource: row.enrichment_source,
      enrichedAt: row.enriched_at,
      acquisitionDate: row.acquisition_date,
      acquisitionPrice: row.acquisition_price != null ? parseFloat(row.acquisition_price) : null,
      relationship: row.relationship,
      linkedBy: row.linked_by,
      confidenceScore: row.confidence_score != null ? parseFloat(row.confidence_score) : null,
      linkNotes: row.link_notes,
      linkedAt: row.linked_at,
    }));
  }

  async linkProperty(dealId: string, propertyId: string, relationship: string = 'subject', notes?: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO deal_properties (deal_id, property_id, relationship, linked_by, confidence_score, notes)
       VALUES ($1, $2, $3, 'manual', 1.0, $4)
       ON CONFLICT (deal_id, property_id) DO UPDATE SET
         relationship = EXCLUDED.relationship,
         notes = COALESCE(EXCLUDED.notes, deal_properties.notes),
         updated_at = NOW()`,
      [dealId, propertyId, relationship, notes || null]
    );
  }

  async unlinkProperty(dealId: string, propertyId: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM deal_properties WHERE deal_id = $1 AND property_id = $2`,
      [dealId, propertyId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  private async insertLink(dealId: string, propertyId: string, confidence: number): Promise<void> {
    await this.pool.query(
      `INSERT INTO deal_properties (deal_id, property_id, relationship, linked_by, confidence_score)
       VALUES ($1, $2, 'subject', 'auto', $3)
       ON CONFLICT (deal_id, property_id) DO NOTHING`,
      [dealId, propertyId, confidence]
    );
  }

  private extractStateFromAddress(address: string): string | null {
    const match = address.match(/,\s*([A-Z]{2})\s+\d{5}/);
    return match ? match[1] : null;
  }

  private extractCityFromAddress(address: string): string | null {
    const parts = address.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      return parts[parts.length - 2] || null;
    }
    return null;
  }

  private async createPropertyFromDeal(deal: any, address: string): Promise<string> {
    const stateCode = this.extractStateFromAddress(address);
    const city = this.extractCityFromAddress(address);

    const result = await this.pool.query(
      `INSERT INTO properties (address_line1, city, state_code, county)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        address,
        city,
        stateCode,
        null,
      ]
    );
    return result.rows[0].id;
  }
}
