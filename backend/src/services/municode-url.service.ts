import { query } from '../database/connection';

interface MunicodeBase {
  municodeUrl: string;
  zoningChapterPath: string;
  state: string;
  name: string;
}

interface SectionMapping {
  nodeId: string;
  title: string | null;
  parentNodeId: string | null;
}

const municipalityCache = new Map<string, MunicodeBase | null>();
const CACHE_TTL = 30 * 60 * 1000;
const cacheTimestamps = new Map<string, number>();

class MunicodeUrlService {
  async buildSectionUrl(municipalityId: string, sectionNumber: string): Promise<string | null> {
    const mapping = await this.lookupSection(municipalityId, sectionNumber);
    if (mapping) {
      const base = await this.getMunicipality(municipalityId);
      if (base?.municodeUrl) {
        return `${base.municodeUrl}?nodeId=${mapping.nodeId}`;
      }
    }

    return this.buildChapterUrl(municipalityId);
  }

  async buildDistrictUrl(municipalityId: string, districtCode: string): Promise<string | null> {
    const result = await query(
      `SELECT municode_node_id, code_section FROM zoning_districts
       WHERE municipality_id = $1 AND UPPER(COALESCE(zoning_code, district_code)) = UPPER($2)
       LIMIT 1`,
      [municipalityId, districtCode],
    );

    const row = result.rows[0];
    if (row?.municode_node_id) {
      const base = await this.getMunicipality(municipalityId);
      if (base?.municodeUrl) {
        return `${base.municodeUrl}?nodeId=${row.municode_node_id}`;
      }
    }

    if (row?.code_section) {
      return this.buildSectionUrl(municipalityId, row.code_section);
    }

    return this.buildChapterUrl(municipalityId);
  }

  async buildDistrictSearchUrl(municipalityId: string, districtCode: string): Promise<string | null> {
    return this.buildSearchUrl(municipalityId, districtCode);
  }

  async getDistrictRuleUrls(municipalityId: string, districtCode: string): Promise<{
    districtUrl: string | null;
    districtSearchUrl: string | null;
    chapterUrl: string | null;
    rules: Array<{
      field: string;
      displayLabel: string;
      sectionNumber: string | null;
      sectionTitle: string | null;
      sourceUrl: string | null;
      sourceType: 'municode' | 'search' | 'chapter';
    }>;
  }> {
    const result = await query(
      `SELECT zd.code_section, zd.municode_node_id,
              zd.dimensional_section, zd.parking_section,
              zd.density_section, zd.height_section,
              zd.setback_section, zd.far_section
       FROM zoning_districts zd
       WHERE zd.municipality_id = $1 AND UPPER(COALESCE(zd.zoning_code, zd.district_code)) = UPPER($2)
       LIMIT 1`,
      [municipalityId, districtCode],
    );

    const row = result.rows[0];
    const base = await this.getMunicipality(municipalityId);
    const districtUrl = await this.buildDistrictUrl(municipalityId, districtCode);
    const districtSearchUrl = await this.buildDistrictSearchUrl(municipalityId, districtCode);
    const chapterUrl = await this.buildChapterUrl(municipalityId);

    const ruleCategories = [
      { field: 'maxHeight', displayLabel: 'Maximum Height', sectionCol: 'height_section' },
      { field: 'maxStories', displayLabel: 'Maximum Stories', sectionCol: 'height_section' },
      { field: 'maxFAR', displayLabel: 'Floor Area Ratio', sectionCol: 'far_section' },
      { field: 'maxDensity', displayLabel: 'Maximum Density', sectionCol: 'density_section' },
      { field: 'frontSetback', displayLabel: 'Front Setback', sectionCol: 'setback_section' },
      { field: 'sideSetback', displayLabel: 'Side Setback', sectionCol: 'setback_section' },
      { field: 'rearSetback', displayLabel: 'Rear Setback', sectionCol: 'setback_section' },
      { field: 'lotCoverage', displayLabel: 'Maximum Lot Coverage', sectionCol: 'dimensional_section' },
      { field: 'parking', displayLabel: 'Parking Requirement', sectionCol: 'parking_section' },
    ];

    const rules = await Promise.all(
      ruleCategories.map(async (cat) => {
        const sectionNumber = row?.[cat.sectionCol] || row?.code_section || null;
        let sourceUrl: string | null = null;
        let sourceType: 'municode' | 'search' | 'chapter' = 'chapter';
        let sectionTitle: string | null = null;

        if (sectionNumber && base?.municodeUrl) {
          const mapping = await this.lookupSection(municipalityId, sectionNumber);
          if (mapping) {
            sourceUrl = `${base.municodeUrl}?nodeId=${mapping.nodeId}`;
            sectionTitle = mapping.title;
            sourceType = 'municode';
          } else {
            sourceUrl = await this.buildSearchUrl(municipalityId, `section ${sectionNumber}`);
            sourceType = 'search';
          }
        }

        if (!sourceUrl) {
          sourceUrl = chapterUrl;
          sourceType = 'chapter';
        }

        return {
          field: cat.field,
          displayLabel: cat.displayLabel,
          sectionNumber,
          sectionTitle,
          sourceUrl,
          sourceType,
        };
      }),
    );

    return { districtUrl, districtSearchUrl, chapterUrl, rules };
  }

  async buildSearchUrl(municipalityId: string, searchTerm: string): Promise<string | null> {
    const base = await this.getMunicipality(municipalityId);
    if (!base?.municodeUrl) return null;
    const encoded = encodeURIComponent(searchTerm);
    return `${base.municodeUrl}?searchRequest=${encoded}&searchType=all`;
  }

  async resolveCodeReference(municipalityId: string, codeRef: string): Promise<string | null> {
    const normalized = this.normalizeSection(codeRef);
    if (!normalized) {
      return this.buildSearchUrl(municipalityId, codeRef);
    }

    const url = await this.buildSectionUrl(municipalityId, normalized);
    return url;
  }

  async buildChapterUrl(municipalityId: string): Promise<string | null> {
    const base = await this.getMunicipality(municipalityId);
    if (!base?.municodeUrl) return null;
    if (base.zoningChapterPath) {
      return `${base.municodeUrl}${base.zoningChapterPath}`;
    }
    return base.municodeUrl;
  }

  async getDistrictWithUrl(municipalityId: string, districtCode: string): Promise<{
    districtCode: string;
    municodeUrl: string | null;
    codeSection: string | null;
    sectionTitle: string | null;
  }> {
    const result = await query(
      `SELECT zd.district_code, zd.code_section, zd.municode_node_id,
              msm.title AS section_title, msm.node_id
       FROM zoning_districts zd
       LEFT JOIN municode_section_map msm
         ON msm.municipality_id = zd.municipality_id
         AND msm.section_number = zd.code_section
       WHERE zd.municipality_id = $1 AND UPPER(COALESCE(zd.zoning_code, zd.district_code)) = UPPER($2)
       LIMIT 1`,
      [municipalityId, districtCode],
    );

    const row = result.rows[0];
    let municodeUrl: string | null = null;

    if (row?.municode_node_id || row?.node_id) {
      const base = await this.getMunicipality(municipalityId);
      if (base?.municodeUrl) {
        municodeUrl = `${base.municodeUrl}?nodeId=${row.municode_node_id || row.node_id}`;
      }
    }

    if (!municodeUrl && row?.code_section) {
      municodeUrl = await this.buildSectionUrl(municipalityId, row.code_section);
    }

    if (!municodeUrl) {
      municodeUrl = await this.buildChapterUrl(municipalityId);
    }

    return {
      districtCode: row?.district_code || districtCode,
      municodeUrl,
      codeSection: row?.code_section || null,
      sectionTitle: row?.section_title || null,
    };
  }

  async getSectionsForMunicipality(municipalityId: string, codeType?: string): Promise<Array<{
    sectionNumber: string;
    nodeId: string;
    title: string | null;
    url: string | null;
  }>> {
    const base = await this.getMunicipality(municipalityId);
    if (!base?.municodeUrl) return [];

    let sql = `SELECT section_number, node_id, title FROM municode_section_map WHERE municipality_id = $1`;
    const params: any[] = [municipalityId];

    if (codeType) {
      sql += ` AND code_type = $2`;
      params.push(codeType);
    }

    sql += ` ORDER BY section_number`;
    const result = await query(sql, params);

    return result.rows.map((row: any) => ({
      sectionNumber: row.section_number,
      nodeId: row.node_id,
      title: row.title,
      url: `${base.municodeUrl}?nodeId=${row.node_id}`,
    }));
  }

  normalizeSection(codeRef: string): string | null {
    if (!codeRef) return null;

    let cleaned = codeRef
      .replace(/^§\s*/u, '')
      .replace(/^[Ss]ec(?:tion)?\.?\s*/i, '')
      .replace(/^[Cc]h(?:apter)?\.?\s*/i, '')
      .trim();

    if (/^\d+[-.]/.test(cleaned)) {
      return cleaned;
    }

    return cleaned || null;
  }

  private async lookupSection(municipalityId: string, sectionNumber: string): Promise<SectionMapping | null> {
    const result = await query(
      `SELECT node_id, title, parent_node_id FROM municode_section_map
       WHERE municipality_id = $1 AND section_number = $2
       LIMIT 1`,
      [municipalityId, sectionNumber],
    );

    if (result.rows.length === 0) {
      const parentSection = this.getParentSection(sectionNumber);
      if (parentSection && parentSection !== sectionNumber) {
        return this.lookupSection(municipalityId, parentSection);
      }
      return null;
    }

    return {
      nodeId: result.rows[0].node_id,
      title: result.rows[0].title,
      parentNodeId: result.rows[0].parent_node_id,
    };
  }

  private getParentSection(sectionNumber: string): string | null {
    const dotIdx = sectionNumber.lastIndexOf('.');
    if (dotIdx > 0) {
      return sectionNumber.substring(0, dotIdx);
    }
    const dashIdx = sectionNumber.lastIndexOf('-');
    if (dashIdx > 0) {
      const afterDash = sectionNumber.substring(dashIdx + 1);
      if (/^[A-Z]$/i.test(afterDash)) {
        return sectionNumber.substring(0, dashIdx);
      }
    }
    return null;
  }

  private async getMunicipality(municipalityId: string): Promise<MunicodeBase | null> {
    const now = Date.now();
    const cached = municipalityCache.get(municipalityId);
    const ts = cacheTimestamps.get(municipalityId);

    if (cached !== undefined && ts && now - ts < CACHE_TTL) {
      return cached;
    }

    const result = await query(
      `SELECT name, state, municode_url, zoning_chapter_path FROM municipalities WHERE id = $1`,
      [municipalityId],
    );

    if (result.rows.length === 0) {
      municipalityCache.set(municipalityId, null);
      cacheTimestamps.set(municipalityId, now);
      return null;
    }

    const row = result.rows[0];
    const base: MunicodeBase = {
      name: row.name,
      state: row.state?.trim(),
      municodeUrl: row.municode_url || '',
      zoningChapterPath: row.zoning_chapter_path || '',
    };

    municipalityCache.set(municipalityId, base);
    cacheTimestamps.set(municipalityId, now);
    return base;
  }
}

export const municodeUrlService = new MunicodeUrlService();
