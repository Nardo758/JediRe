import { chromium, Browser, Page } from 'playwright';
import { getPool } from '../database/connection';

const pool = getPool();

interface ZoningDistrict {
  municipality_id: string;
  municipality_name: string;
  state: string;
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
  source: string;
  source_url: string;
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
  private requestDelay = 2000;

  async init() {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    this.page = await this.browser.newPage();

    await this.page.setExtraHTTPHeaders({
      'User-Agent': 'JEDI-RE-Zoning-Research-Bot/1.0 (Educational/Research Purpose)',
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  private async delay(ms: number = this.requestDelay) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async scrapeMunicipality(municipality: Municipality): Promise<ZoningDistrict[]> {
    if (!this.page) await this.init();

    console.log(`Scraping ${municipality.name}, ${municipality.state}...`);

    try {
      const url = `${municipality.municode_url}${municipality.zoning_chapter_path}`;
      await this.page!.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await this.delay();

      const content = await this.page!.evaluate(() => {
        return document.body.innerText;
      });

      const districts = this.parseZoningDistricts(content, municipality);

      console.log(`Found ${districts.length} zoning districts for ${municipality.name}`);
      return districts;

    } catch (error) {
      console.error(`Error scraping ${municipality.name}:`, error);
      throw error;
    }
  }

  private parseZoningDistricts(
    content: string,
    municipality: Municipality
  ): ZoningDistrict[] {
    const districts: ZoningDistrict[] = [];

    const districtPattern = /\b([A-Z]{1,3}[-\s]?\d{1,2}[A-Z]?)\b/g;
    const codes = content.match(districtPattern) || [];
    const uniqueCodes = [...new Set(codes)];

    console.log(`Found ${uniqueCodes.length} potential district codes`);

    for (const code of uniqueCodes) {
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

  private parseDistrictSection(
    code: string,
    section: string,
    municipality: Municipality
  ): ZoningDistrict | null {

    const namePattern = new RegExp(`${code}[:\\s]*([^\\n]+)`, 'i');
    const nameMatch = section.match(namePattern);
    const districtName = nameMatch?.[1]?.trim() || code;

    const density = this.extractDensity(section);
    const far = this.extractFAR(section);
    const { feet, stories } = this.extractHeight(section);
    const parking = this.extractParking(section);
    const lotSize = this.extractLotSize(section);
    const setbacks = this.extractSetbacks(section);

    if (!density && !far && !feet && !parking && !lotSize) {
      return null;
    }

    return {
      municipality_id: municipality.id,
      municipality_name: municipality.name,
      state: municipality.state,
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
      source_url: `${municipality.municode_url}${municipality.zoning_chapter_path}`,
    };
  }

  private extractDensity(text: string): number | undefined {
    const patterns = [
      /density[:\s]+(\d+\.?\d*)\s*(?:units?|du|dwelling\s*units?)\s*per\s*acre/i,
      /(\d+\.?\d*)\s*(?:units?|du|dwelling\s*units?)\s*per\s*acre/i,
      /maximum\s*density[:\s]+(\d+\.?\d*)/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return parseFloat(match[1]);
    }
    return undefined;
  }

  private extractFAR(text: string): number | undefined {
    const patterns = [
      /FAR[:\s]+(\d+\.?\d*)/i,
      /floor\s*area\s*ratio[:\s]+(\d+\.?\d*)/i,
      /maximum\s*FAR[:\s]+(\d+\.?\d*)/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return parseFloat(match[1]);
    }
    return undefined;
  }

  private extractHeight(text: string): { feet?: number; stories?: number } {
    const result: { feet?: number; stories?: number } = {};
    const feetPatterns = [
      /height[:\s]+(\d+)\s*(?:feet|ft|')/i,
      /maximum\s*height[:\s]+(\d+)\s*(?:feet|ft|')/i,
      /(\d+)\s*(?:feet|ft|')\s*(?:in\s*)?height/i,
    ];
    for (const pattern of feetPatterns) {
      const match = text.match(pattern);
      if (match) { result.feet = parseInt(match[1]); break; }
    }
    const storyPatterns = [
      /(\d+)\s*stor(?:y|ies)/i,
      /maximum\s*of\s*(\d+)\s*stor(?:y|ies)/i,
    ];
    for (const pattern of storyPatterns) {
      const match = text.match(pattern);
      if (match) { result.stories = parseInt(match[1]); break; }
    }
    return result;
  }

  private extractParking(text: string): number | undefined {
    const patterns = [
      /parking[:\s]+(\d+\.?\d*)\s*spaces?\s*per\s*(?:unit|dwelling)/i,
      /(\d+\.?\d*)\s*spaces?\s*per\s*(?:unit|dwelling)/i,
      /minimum\s*parking[:\s]+(\d+\.?\d*)/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return parseFloat(match[1]);
    }
    return undefined;
  }

  private extractLotSize(text: string): number | undefined {
    const patterns = [
      /lot\s*size[:\s]+(\d+[,\d]*)\s*(?:sq\.?\s*ft|square\s*feet)/i,
      /minimum\s*lot\s*(?:area|size)[:\s]+(\d+[,\d]*)\s*(?:sq\.?\s*ft|square\s*feet)/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return parseInt(match[1].replace(/,/g, ''));
    }
    return undefined;
  }

  private extractSetbacks(text: string): { front?: number; side?: number; rear?: number } {
    const result: { front?: number; side?: number; rear?: number } = {};
    const frontMatch = text.match(/front\s*(?:yard\s*)?setback[:\s]+(\d+)\s*(?:feet|ft|')/i);
    if (frontMatch) result.front = parseInt(frontMatch[1]);
    const sideMatch = text.match(/side\s*(?:yard\s*)?setback[:\s]+(\d+)\s*(?:feet|ft|')/i);
    if (sideMatch) result.side = parseInt(sideMatch[1]);
    const rearMatch = text.match(/rear\s*(?:yard\s*)?setback[:\s]+(\d+)\s*(?:feet|ft|')/i);
    if (rearMatch) result.rear = parseInt(rearMatch[1]);
    return result;
  }

  async saveDistricts(districts: ZoningDistrict[]): Promise<number> {
    let saved = 0;
    for (const district of districts) {
      try {
        await pool.query(
          `INSERT INTO zoning_districts (
            municipality, state, district_code, district_name,
            municipality_id, zoning_code, category,
            max_units_per_acre, max_density_per_acre,
            max_far, max_building_height_ft, max_height_feet,
            max_stories, parking_per_unit, min_parking_per_unit,
            min_lot_size_sqft,
            min_front_setback_ft, setback_front_ft,
            min_side_setback_ft, setback_side_ft,
            min_rear_setback_ft, setback_rear_ft,
            source, source_url
          ) VALUES (
            $1, $2, $3, $4,
            $5, $3, 'scraped',
            $6, $6,
            $7, $8, $8,
            $9, $10, $10,
            $11,
            $12, $12,
            $13, $13,
            $14, $14,
            $15, $16
          )
          ON CONFLICT (municipality, state, district_code)
          DO UPDATE SET
            district_name = EXCLUDED.district_name,
            max_units_per_acre = COALESCE(EXCLUDED.max_units_per_acre, zoning_districts.max_units_per_acre),
            max_density_per_acre = COALESCE(EXCLUDED.max_density_per_acre, zoning_districts.max_density_per_acre),
            max_far = COALESCE(EXCLUDED.max_far, zoning_districts.max_far),
            max_building_height_ft = COALESCE(EXCLUDED.max_building_height_ft, zoning_districts.max_building_height_ft),
            max_height_feet = COALESCE(EXCLUDED.max_height_feet, zoning_districts.max_height_feet),
            max_stories = COALESCE(EXCLUDED.max_stories, zoning_districts.max_stories),
            parking_per_unit = COALESCE(EXCLUDED.parking_per_unit, zoning_districts.parking_per_unit),
            min_parking_per_unit = COALESCE(EXCLUDED.min_parking_per_unit, zoning_districts.min_parking_per_unit),
            min_lot_size_sqft = COALESCE(EXCLUDED.min_lot_size_sqft, zoning_districts.min_lot_size_sqft),
            source = EXCLUDED.source,
            source_url = EXCLUDED.source_url,
            updated_at = NOW()`,
          [
            district.municipality_name, district.state, district.zoning_code, district.district_name,
            district.municipality_id,
            district.max_density_per_acre || null,
            district.max_far || null,
            district.max_height_feet || null,
            district.max_stories || null,
            district.min_parking_per_unit || null,
            district.min_lot_size_sqft || null,
            district.setback_front_ft || null,
            district.setback_side_ft || null,
            district.setback_rear_ft || null,
            district.source,
            district.source_url,
          ]
        );

        console.log(`  Saved: ${district.zoning_code} - ${district.district_name}`);
        saved++;
      } catch (error: any) {
        console.error(`  Error saving ${district.zoning_code}:`, error.message);
      }
    }
    return saved;
  }
}

export async function scrapeMunicipalities(municipalities: Municipality[]): Promise<void> {
  const scraper = new MunicodeScraper();

  try {
    await scraper.init();

    for (const municipality of municipalities) {
      console.log(`\nProcessing ${municipality.name}, ${municipality.state}...`);

      try {
        const districts = await scraper.scrapeMunicipality(municipality);
        const saved = await scraper.saveDistricts(districts);

        await pool.query(
          `UPDATE municipalities SET last_scraped_at = NOW(), total_zoning_districts = $1 WHERE id = $2`,
          [saved, municipality.id]
        );

        console.log(`Completed ${municipality.name} (${saved} districts saved)`);
      } catch (error) {
        console.error(`Failed ${municipality.name}:`, error);
      }

      await new Promise(resolve => setTimeout(resolve, 3000));
    }

  } finally {
    await scraper.close();
  }
}
