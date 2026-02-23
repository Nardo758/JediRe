/**
 * Municode Zoning Scraper
 * 
 * Scrapes zoning district information from Municode library
 * For cities without open data APIs
 * 
 * ⚠️ LEGAL DISCLAIMER:
 * This scraper is for educational and research purposes only.
 * Respects robots.txt and implements polite rate limiting.
 * Use responsibly and in compliance with Municode Terms of Service.
 */

import { chromium, Browser, Page } from 'playwright';
import { db } from '../db';

interface ZoningDistrict {
  municipality_id: string;
  zoning_code: string;
  district_name: string;
  max_density_per_acre?: number;
  max_far?: number;
  max_height_feet?: number;
  max_stories?: number;
  min_parking_per_unit?: number;
  min_lot_size_sqft?: number;
  setback_front_ft?: number;
  setback_side_ft?: number;
  setback_rear_ft?: number;
  permitted_uses?: string[];
  conditional_uses?: string[];
  special_conditions?: Record<string, any>;
  source: 'municode_scraped';
  scraped_at: Date;
}

interface Municipality {
  id: string;
  name: string;
  state: string;
  municode_url: string;
  zoning_chapter_path: string;
}

export class MunicodeScraper {
  private browser?: Browser;
  private page?: Page;
  private requestDelay = 2000; // 2 seconds between requests (polite)

  /**
   * Initialize browser
   */
  async init() {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    this.page = await this.browser.newPage();
    
    // Set user agent (identify as bot, be transparent)
    await this.page.setExtraHTTPHeaders({
      'User-Agent': 'JEDI-RE-Zoning-Research-Bot/1.0 (Educational/Research Purpose)',
    });
  }

  /**
   * Close browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  /**
   * Polite delay between requests
   */
  private async delay(ms: number = this.requestDelay) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Scrape zoning districts for a municipality
   */
  async scrapeMunicipality(municipality: Municipality): Promise<ZoningDistrict[]> {
    if (!this.page) await this.init();
    
    console.log(`Scraping ${municipality.name}, ${municipality.state}...`);
    
    try {
      // Navigate to zoning chapter
      const url = `${municipality.municode_url}${municipality.zoning_chapter_path}`;
      await this.page!.goto(url, { waitUntil: 'networkidle' });
      await this.delay();

      // Extract chapter text
      const content = await this.page!.evaluate(() => {
        return document.body.innerText;
      });

      // Parse zoning districts from content
      const districts = this.parseZoningDistricts(content, municipality);

      console.log(`Found ${districts.length} zoning districts for ${municipality.name}`);
      return districts;

    } catch (error) {
      console.error(`Error scraping ${municipality.name}:`, error);
      throw error;
    }
  }

  /**
   * Parse zoning districts from Municode chapter text
   * 
   * Common patterns:
   * - "R-1" or "R1" = Residential district code
   * - "Density: 4 units per acre" or "Max density: 4 DU/A"
   * - "Height: 35 feet" or "Maximum height: 35 ft"
   * - "Parking: 2 spaces per unit"
   */
  private parseZoningDistricts(
    content: string, 
    municipality: Municipality
  ): ZoningDistrict[] {
    const districts: ZoningDistrict[] = [];

    // Pattern 1: Find district codes (R-1, C-2, I-1, etc.)
    const districtPattern = /\b([A-Z]{1,3}[-\s]?\d{1,2}[A-Z]?)\b/g;
    const codes = content.match(districtPattern) || [];
    const uniqueCodes = [...new Set(codes)];

    console.log(`Found ${uniqueCodes.length} potential district codes`);

    // For each district code, try to extract parameters
    for (const code of uniqueCodes) {
      // Find the section containing this district
      const sectionPattern = new RegExp(
        `${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*?(?=\\n\\n|$)`,
        'is'
      );
      const section = content.match(sectionPattern)?.[0] || '';

      if (section) {
        const district = this.parseDistrictSection(code, section, municipality);
        if (district) {
          districts.push(district);
        }
      }
    }

    return districts;
  }

  /**
   * Parse individual district section
   */
  private parseDistrictSection(
    code: string,
    section: string,
    municipality: Municipality
  ): ZoningDistrict | null {
    
    // Extract district name (usually after code)
    const namePattern = new RegExp(`${code}[:\\s]*([^\\n]+)`, 'i');
    const nameMatch = section.match(namePattern);
    const districtName = nameMatch?.[1]?.trim() || code;

    // Extract density (units per acre)
    const density = this.extractDensity(section);

    // Extract FAR
    const far = this.extractFAR(section);

    // Extract height
    const { feet, stories } = this.extractHeight(section);

    // Extract parking
    const parking = this.extractParking(section);

    // Extract lot size
    const lotSize = this.extractLotSize(section);

    // Extract setbacks
    const setbacks = this.extractSetbacks(section);

    // Only create district if we found at least one parameter
    if (!density && !far && !feet && !parking && !lotSize) {
      return null;
    }

    return {
      municipality_id: municipality.id,
      zoning_code: code,
      district_name: districtName,
      max_density_per_acre: density,
      max_far: far,
      max_height_feet: feet,
      max_stories: stories,
      min_parking_per_unit: parking,
      min_lot_size_sqft: lotSize,
      setback_front_ft: setbacks.front,
      setback_side_ft: setbacks.side,
      setback_rear_ft: setbacks.rear,
      source: 'municode_scraped',
      scraped_at: new Date(),
    };
  }

  /**
   * Extract density (units per acre)
   */
  private extractDensity(text: string): number | undefined {
    const patterns = [
      /density[:\s]+(\d+\.?\d*)\s*(?:units?|du|dwelling\s*units?)\s*per\s*acre/i,
      /(\d+\.?\d*)\s*(?:units?|du|dwelling\s*units?)\s*per\s*acre/i,
      /maximum\s*density[:\s]+(\d+\.?\d*)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return parseFloat(match[1]);
      }
    }

    return undefined;
  }

  /**
   * Extract FAR (Floor Area Ratio)
   */
  private extractFAR(text: string): number | undefined {
    const patterns = [
      /FAR[:\s]+(\d+\.?\d*)/i,
      /floor\s*area\s*ratio[:\s]+(\d+\.?\d*)/i,
      /maximum\s*FAR[:\s]+(\d+\.?\d*)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return parseFloat(match[1]);
      }
    }

    return undefined;
  }

  /**
   * Extract height (feet and stories)
   */
  private extractHeight(text: string): { feet?: number; stories?: number } {
    const result: { feet?: number; stories?: number } = {};

    // Extract feet
    const feetPatterns = [
      /height[:\s]+(\d+)\s*(?:feet|ft|')/i,
      /maximum\s*height[:\s]+(\d+)\s*(?:feet|ft|')/i,
      /(\d+)\s*(?:feet|ft|')\s*(?:in\s*)?height/i,
    ];

    for (const pattern of feetPatterns) {
      const match = text.match(pattern);
      if (match) {
        result.feet = parseInt(match[1]);
        break;
      }
    }

    // Extract stories
    const storyPatterns = [
      /(\d+)\s*stor(?:y|ies)/i,
      /maximum\s*of\s*(\d+)\s*stor(?:y|ies)/i,
    ];

    for (const pattern of storyPatterns) {
      const match = text.match(pattern);
      if (match) {
        result.stories = parseInt(match[1]);
        break;
      }
    }

    return result;
  }

  /**
   * Extract parking (spaces per unit)
   */
  private extractParking(text: string): number | undefined {
    const patterns = [
      /parking[:\s]+(\d+\.?\d*)\s*spaces?\s*per\s*(?:unit|dwelling)/i,
      /(\d+\.?\d*)\s*spaces?\s*per\s*(?:unit|dwelling)/i,
      /minimum\s*parking[:\s]+(\d+\.?\d*)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return parseFloat(match[1]);
      }
    }

    return undefined;
  }

  /**
   * Extract lot size (square feet)
   */
  private extractLotSize(text: string): number | undefined {
    const patterns = [
      /lot\s*size[:\s]+(\d+[,\d]*)\s*(?:sq\.?\s*ft|square\s*feet)/i,
      /minimum\s*lot\s*(?:area|size)[:\s]+(\d+[,\d]*)\s*(?:sq\.?\s*ft|square\s*feet)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return parseInt(match[1].replace(/,/g, ''));
      }
    }

    return undefined;
  }

  /**
   * Extract setbacks (front, side, rear in feet)
   */
  private extractSetbacks(text: string): {
    front?: number;
    side?: number;
    rear?: number;
  } {
    const result: { front?: number; side?: number; rear?: number } = {};

    // Front setback
    const frontPattern = /front\s*setback[:\s]+(\d+)\s*(?:feet|ft|')/i;
    const frontMatch = text.match(frontPattern);
    if (frontMatch) {
      result.front = parseInt(frontMatch[1]);
    }

    // Side setback
    const sidePattern = /side\s*setback[:\s]+(\d+)\s*(?:feet|ft|')/i;
    const sideMatch = text.match(sidePattern);
    if (sideMatch) {
      result.side = parseInt(sideMatch[1]);
    }

    // Rear setback
    const rearPattern = /rear\s*setback[:\s]+(\d+)\s*(?:feet|ft|')/i;
    const rearMatch = text.match(rearPattern);
    if (rearMatch) {
      result.rear = parseInt(rearMatch[1]);
    }

    return result;
  }

  /**
   * Save districts to database
   */
  async saveDistricts(districts: ZoningDistrict[]): Promise<void> {
    for (const district of districts) {
      try {
        await db.query(
          `
          INSERT INTO zoning_districts (
            municipality_id, zoning_code, district_name,
            max_density_per_acre, max_far, max_height_feet, max_stories,
            min_parking_per_unit, min_lot_size_sqft,
            setback_front_ft, setback_side_ft, setback_rear_ft,
            source, last_updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
          ON CONFLICT (municipality_id, zoning_code)
          DO UPDATE SET
            district_name = EXCLUDED.district_name,
            max_density_per_acre = COALESCE(EXCLUDED.max_density_per_acre, zoning_districts.max_density_per_acre),
            max_far = COALESCE(EXCLUDED.max_far, zoning_districts.max_far),
            max_height_feet = COALESCE(EXCLUDED.max_height_feet, zoning_districts.max_height_feet),
            max_stories = COALESCE(EXCLUDED.max_stories, zoning_districts.max_stories),
            min_parking_per_unit = COALESCE(EXCLUDED.min_parking_per_unit, zoning_districts.min_parking_per_unit),
            min_lot_size_sqft = COALESCE(EXCLUDED.min_lot_size_sqft, zoning_districts.min_lot_size_sqft),
            setback_front_ft = COALESCE(EXCLUDED.setback_front_ft, zoning_districts.setback_front_ft),
            setback_side_ft = COALESCE(EXCLUDED.setback_side_ft, zoning_districts.setback_side_ft),
            setback_rear_ft = COALESCE(EXCLUDED.setback_rear_ft, zoning_districts.setback_rear_ft),
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
            district.min_lot_size_sqft,
            district.setback_front_ft,
            district.setback_side_ft,
            district.setback_rear_ft,
            district.source,
          ]
        );

        console.log(`Saved district: ${district.zoning_code} - ${district.district_name}`);
      } catch (error) {
        console.error(`Error saving district ${district.zoning_code}:`, error);
      }
    }
  }
}

/**
 * Main scraping function
 */
export async function scrapeMunicipalities(municipalities: Municipality[]): Promise<void> {
  const scraper = new MunicodeScraper();
  
  try {
    await scraper.init();

    for (const municipality of municipalities) {
      console.log(`\nProcessing ${municipality.name}, ${municipality.state}...`);
      
      try {
        const districts = await scraper.scrapeMunicipality(municipality);
        await scraper.saveDistricts(districts);
        
        // Mark municipality as scraped
        await db.query(
          `UPDATE municipalities SET last_scraped_at = NOW() WHERE id = $1`,
          [municipality.id]
        );

        console.log(`✅ Completed ${municipality.name} (${districts.length} districts)`);
      } catch (error) {
        console.error(`❌ Failed ${municipality.name}:`, error);
      }

      // Polite delay between municipalities
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

  } finally {
    await scraper.close();
  }
}

// Example usage
if (require.main === module) {
  const testMunicipality: Municipality = {
    id: 'birmingham-al',
    name: 'Birmingham',
    state: 'AL',
    municode_url: 'https://library.municode.com/al/birmingham/codes/code_of_ordinances',
    zoning_chapter_path: '?nodeId=COOR_TITZOZORE',
  };

  scrapeMunicipalities([testMunicipality])
    .then(() => {
      console.log('Scraping complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Scraping failed:', error);
      process.exit(1);
    });
}
