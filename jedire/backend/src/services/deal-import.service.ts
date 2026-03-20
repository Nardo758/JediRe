/**
 * Deal Import Service
 * Import deals from various sources (CSV, JSON, API)
 */

import { query, transaction } from '../database/connection';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import csv from 'csv-parser';
import { Readable } from 'stream';

export interface DealImportData {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  projectType?: string;
  status?: string;
  budget?: number;
  targetUnits?: number;
  description?: string;
  lotSizeSqft?: number;
  tier?: string;
  dealCategory?: string;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: Array<{ row: number; error: string; data?: any }>;
  dealIds: string[];
}

export class DealImportService {
  /**
   * Import deals from JSON array
   */
  async importFromJSON(deals: DealImportData[], userId: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      imported: 0,
      failed: 0,
      errors: [],
      dealIds: [],
    };

    for (let i = 0; i < deals.length; i++) {
      try {
        const dealId = await this.importSingleDeal(deals[i], userId);
        result.dealIds.push(dealId);
        result.imported++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          row: i + 1,
          error: error.message,
          data: deals[i],
        });
        logger.error(`Failed to import deal at row ${i + 1}:`, error);
      }
    }

    result.success = result.failed === 0;
    return result;
  }

  /**
   * Import deals from CSV string or buffer
   */
  async importFromCSV(csvData: string | Buffer, userId: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      imported: 0,
      failed: 0,
      errors: [],
      dealIds: [],
    };

    return new Promise((resolve, reject) => {
      const deals: DealImportData[] = [];
      const stream = Readable.from(csvData.toString());

      stream
        .pipe(csv())
        .on('data', (row: any) => {
          deals.push(this.mapCSVRowToDeal(row));
        })
        .on('end', async () => {
          try {
            const importResult = await this.importFromJSON(deals, userId);
            resolve(importResult);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  /**
   * Import a single deal
   */
  private async importSingleDeal(dealData: DealImportData, userId: string): Promise<string> {
    // Validate required fields
    if (!dealData.name) {
      throw new AppError(400, 'Deal name is required');
    }

    // Set defaults
    const projectType = dealData.projectType || 'multifamily';
    const status = dealData.status || 'active';
    const tier = dealData.tier || 'basic';
    const dealCategory = dealData.dealCategory || 'pipeline';
    const state = dealData.state?.toUpperCase() || this.parseState(dealData.address);

    // Build full address
    const address = dealData.address || this.buildAddress(
      dealData.city,
      dealData.state,
      dealData.zipCode
    );

    return transaction(async (client) => {
      // Insert deal
      const dealResult = await client.query(
        `INSERT INTO deals (
          name, address, city, state_code, zip_code,
          project_type, status, tier, deal_category,
          budget, target_units, description, lot_size_sqft,
          state, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id`,
        [
          dealData.name,
          address,
          dealData.city,
          state,
          dealData.zipCode,
          projectType,
          status,
          tier,
          dealCategory,
          dealData.budget,
          dealData.targetUnits,
          dealData.description,
          dealData.lotSizeSqft,
          'SIGNAL_INTAKE', // initial workflow state
          userId,
        ]
      );

      const dealId = dealResult.rows[0].id;

      logger.info('Deal imported:', {
        dealId,
        name: dealData.name,
        address,
        userId,
      });

      return dealId;
    });
  }

  /**
   * Map CSV row to DealImportData
   */
  private mapCSVRowToDeal(row: any): DealImportData {
    return {
      name: row.name || row.Name || row.deal_name,
      address: row.address || row.Address,
      city: row.city || row.City,
      state: row.state || row.State,
      zipCode: row.zip_code || row.zipCode || row['Zip Code'],
      projectType: this.normalizeProjectType(row.project_type || row.projectType || row['Project Type']),
      status: row.status || row.Status,
      budget: this.parseNumber(row.budget || row.Budget),
      targetUnits: this.parseNumber(row.target_units || row.targetUnits || row['Target Units']),
      description: row.description || row.Description,
      lotSizeSqft: this.parseNumber(row.lot_size_sqft || row.lotSizeSqft || row['Lot Size']),
      tier: row.tier || row.Tier,
      dealCategory: row.deal_category || row.dealCategory || row['Deal Category'],
    };
  }

  /**
   * Normalize project type values
   */
  private normalizeProjectType(value?: string): string {
    if (!value) return 'multifamily';

    const normalized = value.toLowerCase().replace(/[\s-_]/g, '');
    const typeMap: Record<string, string> = {
      multifamily: 'multifamily',
      apartment: 'multifamily',
      apartments: 'multifamily',
      townhome: 'townhome',
      townhomes: 'townhome',
      townhouse: 'townhome',
      mixeduse: 'mixed_use',
      retail: 'retail',
      office: 'office',
      industrial: 'industrial',
      warehouse: 'industrial',
      seniorliving: 'senior_living',
      assisted: 'senior_living',
      studenthousing: 'student_housing',
      residential: 'residential',
      singlefamily: 'residential',
    };

    return typeMap[normalized] || 'multifamily';
  }

  /**
   * Parse numeric string to number
   */
  private parseNumber(value?: string | number): number | undefined {
    if (typeof value === 'number') return value;
    if (!value) return undefined;

    // Remove common formatting (commas, dollar signs, etc.)
    const cleaned = value.toString().replace(/[$,]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? undefined : parsed;
  }

  /**
   * Extract state code from address string
   */
  private parseState(address?: string): string | undefined {
    if (!address) return undefined;

    // Look for 2-letter state codes
    const stateMatch = address.match(/\b([A-Z]{2})\b/);
    return stateMatch ? stateMatch[1] : undefined;
  }

  /**
   * Build address from components
   */
  private buildAddress(city?: string, state?: string, zipCode?: string): string | undefined {
    if (!city && !state) return undefined;

    const parts: string[] = [];
    if (city) parts.push(city);
    if (state) parts.push(state.toUpperCase());
    if (zipCode) parts.push(zipCode);

    return parts.join(', ');
  }

  /**
   * Validate import data before processing
   */
  async validateImportData(deals: DealImportData[]): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    if (!Array.isArray(deals) || deals.length === 0) {
      errors.push('Import data must be a non-empty array');
      return { valid: false, errors };
    }

    if (deals.length > 1000) {
      errors.push('Cannot import more than 1000 deals at once');
    }

    deals.forEach((deal, index) => {
      if (!deal.name || deal.name.trim().length === 0) {
        errors.push(`Row ${index + 1}: Deal name is required`);
      }

      if (deal.name && deal.name.length > 200) {
        errors.push(`Row ${index + 1}: Deal name exceeds 200 characters`);
      }

      if (deal.budget && deal.budget < 0) {
        errors.push(`Row ${index + 1}: Budget cannot be negative`);
      }

      if (deal.targetUnits && deal.targetUnits < 0) {
        errors.push(`Row ${index + 1}: Target units cannot be negative`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
