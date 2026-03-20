/**
 * M27: Transaction Ingestion Service
 * Handles deed record ingestion, price derivation, and entity classification
 */

import { getPool } from '../../database/connection';

const pool = getPool();

export interface TransactionRaw {
  county_id: string;
  instrument_number?: string;
  document_type: string;
  recording_date: Date;
  consideration_stated?: number;
  
  grantor_name?: string;
  grantee_name?: string;
  
  documentary_stamps_paid?: number;
  stamp_rate?: number;
  
  parcel_id: string;
  legal_description?: string;
  property_address?: string;
  
  property_type?: string;
  units?: number;
  building_sf?: number;
  land_sf?: number;
  year_built?: number;
  
  latitude?: number;
  longitude?: number;
  zip_code?: string;
  submarket?: string;
  
  source: string;
  source_url?: string;
}

export interface TransactionIngested {
  id: string;
  derived_sale_price: number;
  price_per_unit?: number;
  buyer_type?: string;
  is_arms_length: boolean;
  is_distress: boolean;
}

export interface BuyerClassification {
  type: 'institutional' | 'syndicator' | 'local_operator' | 'distressed_buyer' | 'unknown';
  confidence: number;
}

export class TransactionIngestService {
  /**
   * Ingest a batch of transactions
   */
  async ingestBatch(transactions: TransactionRaw[]): Promise<{ success: number; errors: number }> {
    let success = 0;
    let errors = 0;

    for (const txn of transactions) {
      try {
        await this.ingestTransaction(txn);
        success++;
      } catch (error) {
        console.error('Transaction ingest error:', error);
        errors++;
      }
    }

    return { success, errors };
  }

  /**
   * Ingest a single transaction
   */
  async ingestTransaction(txn: TransactionRaw): Promise<TransactionIngested> {
    // 1. Derive sale price from documentary stamps
    const salePrice = this.deriveSalePrice(
      txn.documentary_stamps_paid || 0,
      txn.stamp_rate || this.getStampRate(txn.county_id)
    );

    // 2. Classify buyer type
    const buyerClassification = this.classifyBuyerType(txn.grantee_name || '');

    // 3. Determine if arms-length
    const isArmsLength = this.isArmsLengthTransaction(txn);

    // 4. Detect distress
    const isDistress = this.isDistressTransaction(txn);
    const distressType = this.detectDistressType(txn);

    // 5. Calculate derived metrics
    const pricePerUnit = txn.units && txn.units > 0 ? salePrice / txn.units : null;
    const pricePerSf = txn.building_sf && txn.building_sf > 0 ? salePrice / txn.building_sf : null;

    // 6. Classify entity types
    const grantorEntityType = this.classifyEntityType(txn.grantor_name || '');
    const granteeEntityType = this.classifyEntityType(txn.grantee_name || '');

    // 7. Match to existing property
    const propertyId = await this.matchToProperty(txn.parcel_id, txn.county_id);

    // 8. Get holding period info
    const holdingInfo = await this.deriveHoldingPeriod(txn.parcel_id, txn.recording_date);

    // 9. Insert transaction
    const result = await pool.query(`
      INSERT INTO recorded_transactions (
        county_id, instrument_number, document_type, recording_date,
        consideration_stated, grantor_name, grantor_entity_type,
        grantee_name, grantee_entity_type,
        documentary_stamps_paid, stamp_rate, derived_sale_price,
        price_derivation_method, price_confidence,
        parcel_id, legal_description, property_address, property_id,
        property_type, units, building_sf, land_sf, year_built,
        price_per_unit, price_per_sf,
        prior_sale_date, prior_sale_price, holding_period_months,
        appreciation_total_pct, appreciation_annual_pct,
        is_arms_length, is_distress, distress_type, buyer_type,
        latitude, longitude, zip_code, submarket,
        source, source_url, source_retrieved_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25,
        $26, $27, $28, $29, $30, $31, $32, $33, $34,
        $35, $36, $37, $38, $39, $40, NOW()
      )
      ON CONFLICT (parcel_id, county_id, recording_date)
      DO UPDATE SET
        derived_sale_price = EXCLUDED.derived_sale_price,
        price_per_unit = EXCLUDED.price_per_unit,
        updated_at = NOW()
      RETURNING id, derived_sale_price, price_per_unit, buyer_type, is_arms_length, is_distress
    `, [
      txn.county_id,
      txn.instrument_number,
      txn.document_type,
      txn.recording_date,
      txn.consideration_stated,
      txn.grantor_name,
      grantorEntityType,
      txn.grantee_name,
      granteeEntityType,
      txn.documentary_stamps_paid,
      txn.stamp_rate || this.getStampRate(txn.county_id),
      salePrice,
      txn.documentary_stamps_paid ? 'documentary_stamps' : 'stated_consideration',
      txn.documentary_stamps_paid ? 'high' : 'medium',
      txn.parcel_id,
      txn.legal_description,
      txn.property_address,
      propertyId,
      txn.property_type,
      txn.units,
      txn.building_sf,
      txn.land_sf,
      txn.year_built,
      pricePerUnit,
      pricePerSf,
      holdingInfo?.prior_sale_date,
      holdingInfo?.prior_sale_price,
      holdingInfo?.holding_period_months,
      holdingInfo?.appreciation_total_pct,
      holdingInfo?.appreciation_annual_pct,
      isArmsLength,
      isDistress,
      distressType,
      buyerClassification.type,
      txn.latitude,
      txn.longitude,
      txn.zip_code,
      txn.submarket,
      txn.source,
      txn.source_url
    ]);

    return result.rows[0];
  }

  /**
   * Derive sale price from documentary stamps
   * FL formula: sale_price = (doc_stamps / stamp_rate) × 100
   */
  deriveSalePrice(docStamps: number, stampRate: number): number {
    if (!docStamps || docStamps === 0) {
      return 0;
    }
    return (docStamps / stampRate) * 100;
  }

  /**
   * Get stamp rate for county
   * Most FL: $0.70/$100
   * Miami-Dade: $0.60/$100
   */
  private getStampRate(countyId: string): number {
    // TODO: Look up from jurisdiction record
    // For now, default to standard FL rate
    return 0.0070;
  }

  /**
   * Classify buyer type based on entity name
   */
  classifyBuyerType(entityName: string): BuyerClassification {
    const name = entityName.toLowerCase();

    // Institutional signals
    const institutionalPatterns = [
      'llc',
      'capital',
      'partners',
      'holdings',
      'investments',
      'realty',
      'fund',
      'reit',
      'properties',
      'advisors',
      'management'
    ];

    // Known institutional names
    const knownInstitutional = [
      'blackstone',
      'starwood',
      'greystar',
      'avenue5',
      'jpi',
      'wood partners',
      'aimco',
      'equity residential',
      'camden'
    ];

    // Syndicator signals
    const syndicatorPatterns = [
      'ventures',
      'syndicate',
      'group',
      'development',
      'acquisitions'
    ];

    // Check known institutional
    for (const inst of knownInstitutional) {
      if (name.includes(inst)) {
        return { type: 'institutional', confidence: 0.95 };
      }
    }

    // Check institutional patterns (multiple required)
    const instMatches = institutionalPatterns.filter(p => name.includes(p)).length;
    if (instMatches >= 2) {
      return { type: 'institutional', confidence: 0.75 };
    }

    // Check syndicator patterns
    const synMatches = syndicatorPatterns.filter(p => name.includes(p)).length;
    if (synMatches >= 1 && instMatches >= 1) {
      return { type: 'syndicator', confidence: 0.70 };
    }

    // Single-asset LLC or individual = local operator
    if (name.includes('llc') && !name.includes('holdings') && !name.includes('properties')) {
      return { type: 'local_operator', confidence: 0.60 };
    }

    return { type: 'unknown', confidence: 0.30 };
  }

  /**
   * Determine if transaction is arms-length
   */
  isArmsLengthTransaction(txn: TransactionRaw): boolean {
    // Filter out obvious related-party transfers
    
    // 1. Quit-claim deeds = typically related party
    if (txn.document_type.toLowerCase().includes('quit') || txn.document_type.toLowerCase().includes('quitclaim')) {
      return false;
    }

    // 2. $0 or nominal consideration
    if (txn.consideration_stated && txn.consideration_stated < 1000) {
      return false;
    }

    // 3. Same entity name similarity (grantor ≈ grantee)
    if (txn.grantor_name && txn.grantee_name) {
      const similarity = this.stringSimilarity(txn.grantor_name, txn.grantee_name);
      if (similarity > 0.8) {
        return false;
      }
    }

    return true;
  }

  /**
   * Detect if transaction is distressed
   */
  isDistressTransaction(txn: TransactionRaw): boolean {
    const docType = txn.document_type.toLowerCase();
    
    // Trustee deed, tax deed, referee deed = distress
    if (docType.includes('trustee') || docType.includes('tax deed') || docType.includes('referee')) {
      return true;
    }

    // TODO: Check if price significantly below market (requires comp analysis)
    
    return false;
  }

  /**
   * Detect distress type
   */
  private detectDistressType(txn: TransactionRaw): string | null {
    const docType = txn.document_type.toLowerCase();
    
    if (docType.includes('trustee')) return 'foreclosure';
    if (docType.includes('tax deed')) return 'tax_deed';
    if (docType.includes('referee')) return 'foreclosure';
    if (txn.grantor_name?.toLowerCase().includes('bank')) return 'reo';
    
    return null;
  }

  /**
   * Classify entity type
   */
  private classifyEntityType(name: string): string {
    const lower = name.toLowerCase();
    
    if (lower.includes('llc')) return 'llc';
    if (lower.includes('inc') || lower.includes('corp')) return 'corp';
    if (lower.includes('lp') || lower.includes('limited partnership')) return 'lp';
    if (lower.includes('trust')) return 'trust';
    if (lower.includes('bank') || lower.includes('servicer')) return 'financial';
    
    return 'individual';
  }

  /**
   * Match transaction to existing property
   */
  private async matchToProperty(parcelId: string, countyId: string): Promise<string | null> {
    const result = await pool.query(`
      SELECT id FROM properties
      WHERE parcel_id = $1 AND county_id = $2::uuid
      LIMIT 1
    `, [parcelId, countyId]);

    return result.rows.length > 0 ? result.rows[0].id : null;
  }

  /**
   * Derive holding period from prior sale
   */
  private async deriveHoldingPeriod(
    parcelId: string,
    currentSaleDate: Date
  ): Promise<{
    prior_sale_date: Date;
    prior_sale_price: number;
    holding_period_months: number;
    appreciation_total_pct: number;
    appreciation_annual_pct: number;
  } | null> {
    const result = await pool.query(`
      SELECT recording_date, derived_sale_price
      FROM recorded_transactions
      WHERE parcel_id = $1 AND recording_date < $2
      ORDER BY recording_date DESC
      LIMIT 1
    `, [parcelId, currentSaleDate]);

    if (result.rows.length === 0) {
      return null;
    }

    const priorSale = result.rows[0];
    const priorDate = new Date(priorSale.recording_date);
    const currentDate = new Date(currentSaleDate);
    
    const holdingPeriodMonths = Math.round(
      (currentDate.getTime() - priorDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
    );
    
    // Appreciation calculation requires current price (not available in this context)
    // Will be calculated when the current transaction is inserted
    
    return {
      prior_sale_date: priorDate,
      prior_sale_price: parseFloat(priorSale.derived_sale_price),
      holding_period_months: holdingPeriodMonths,
      appreciation_total_pct: 0,
      appreciation_annual_pct: 0
    };
  }

  /**
   * String similarity (simple Levenshtein-based)
   */
  private stringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}

export const transactionIngestService = new TransactionIngestService();
