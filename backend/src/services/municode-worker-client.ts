/**
 * Municode Worker Client
 * 
 * Calls Cloudflare Worker to scrape Municode data
 * Then saves results to database
 */

import axios from 'axios';
import { db } from '../db';

interface WorkerDistrict {
  municipality_id: string;
  zoning_code: string;
  district_name: string;
  max_density_per_acre?: number;
  max_far?: number;
  max_height_feet?: number;
  max_stories?: number;
  min_parking_per_unit?: number;
}

interface WorkerResponse {
  success: boolean;
  municipality: string;
  state: string;
  districtsFound: number;
  districts: WorkerDistrict[];
  scrapedAt: string;
  error?: string;
}

export class MunicodeWorkerClient {
  private workerUrl: string;

  constructor(workerUrl: string) {
    this.workerUrl = workerUrl;
  }

  /**
   * List available municipalities
   */
  async listMunicipalities(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.workerUrl}/list`);
      return response.data.municipalities || [];
    } catch (error) {
      console.error('Error listing municipalities:', error);
      throw error;
    }
  }

  /**
   * Scrape a single municipality
   */
  async scrapeMunicipality(municipalityId: string): Promise<WorkerResponse> {
    try {
      console.log(`Calling worker to scrape ${municipalityId}...`);

      const response = await axios.post(
        `${this.workerUrl}/scrape`,
        { municipalityId },
        {
          timeout: 30000, // 30 second timeout
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error(`Worker error for ${municipalityId}:`, error);
      throw error;
    }
  }

  /**
   * Scrape and save a municipality
   */
  async scrapeAndSave(municipalityId: string): Promise<void> {
    try {
      // Call worker
      const result = await this.scrapeMunicipality(municipalityId);

      if (!result.success) {
        throw new Error(result.error || 'Worker returned unsuccessful');
      }

      console.log(`Worker found ${result.districtsFound} districts for ${result.municipality}`);

      // Save to database
      await this.saveDistricts(result.districts);

      // Update municipality record
      await db.query(
        `UPDATE municipalities SET 
          total_zoning_districts = $1,
          last_scraped_at = NOW(),
          zoning_data_quality = CASE 
            WHEN $1 > 20 THEN 'excellent'
            WHEN $1 > 10 THEN 'good'
            WHEN $1 > 5 THEN 'fair'
            ELSE 'poor'
          END
         WHERE id = $2`,
        [result.districtsFound, municipalityId]
      );

      console.log(`✅ Saved ${result.districtsFound} districts for ${municipalityId}`);

    } catch (error) {
      console.error(`Failed to scrape and save ${municipalityId}:`, error);
      throw error;
    }
  }

  /**
   * Save districts to database
   */
  private async saveDistricts(districts: WorkerDistrict[]): Promise<void> {
    for (const district of districts) {
      try {
        await db.query(
          `
          INSERT INTO zoning_districts (
            municipality_id, zoning_code, district_name,
            max_density_per_acre, max_far, max_height_feet, max_stories,
            min_parking_per_unit, source, last_updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'municode_scraped', NOW())
          ON CONFLICT (municipality_id, zoning_code)
          DO UPDATE SET
            district_name = EXCLUDED.district_name,
            max_density_per_acre = COALESCE(EXCLUDED.max_density_per_acre, zoning_districts.max_density_per_acre),
            max_far = COALESCE(EXCLUDED.max_far, zoning_districts.max_far),
            max_height_feet = COALESCE(EXCLUDED.max_height_feet, zoning_districts.max_height_feet),
            max_stories = COALESCE(EXCLUDED.max_stories, zoning_districts.max_stories),
            min_parking_per_unit = COALESCE(EXCLUDED.min_parking_per_unit, zoning_districts.min_parking_per_unit),
            last_updated_at = NOW()
          `,
          [
            district.municipality_id,
            district.zoning_code,
            district.district_name,
            district.max_density_per_acre,
            district.max_far,
            district.max_height_feet,
            district.max_stories,
            district.min_parking_per_unit,
          ]
        );
      } catch (error) {
        console.error(`Error saving district ${district.zoning_code}:`, error);
      }
    }
  }

  /**
   * Scrape multiple municipalities with delay
   */
  async scrapeMultiple(municipalityIds: string[], delayMs: number = 2000): Promise<{
    success: number;
    failed: number;
    results: Array<{ id: string; success: boolean; count?: number; error?: string }>;
  }> {
    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const id of municipalityIds) {
      try {
        await this.scrapeAndSave(id);
        results.push({ id, success: true });
        successCount++;
      } catch (error) {
        results.push({ id, success: false, error: error.message });
        failCount++;
      }

      // Polite delay between requests
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return {
      success: successCount,
      failed: failCount,
      results,
    };
  }
}

/**
 * Get worker URL from environment
 */
export function getWorkerClient(): MunicodeWorkerClient {
  const workerUrl = process.env.MUNICODE_WORKER_URL;
  
  if (!workerUrl) {
    throw new Error('MUNICODE_WORKER_URL environment variable not set');
  }

  return new MunicodeWorkerClient(workerUrl);
}
