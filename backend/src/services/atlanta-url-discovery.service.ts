import { getPool } from '../database/connection';
import { logger } from '../utils/logger';

const FULTON_TAX_BASE = 'https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0';
const DEKALB_PARCEL_BASE = 'https://gis.dekalbcountyga.gov/arcgis/rest/services/PropertyInformation/MapServer/0';

const FULTON_ASSESSOR_BASE = 'https://qpublic.schneidercorp.com/Application.aspx?AppID=1011&LayerID=22783&PageTypeID=4&PageID=9541&KeyValue=';
const DEKALB_ASSESSOR_BASE = 'https://iaspublicaccess.dekalbcountyga.gov/propertysearch/parcel/details/';

export interface UrlDiscoveryStats {
  totalAtlantaProperties: number;
  propertiesNeedingUrls: number;
  fultonProcessed: number;
  dekalbProcessed: number;
  urlsDiscovered: number;
  urlsFailed: number;
  errors: string[];
  sampleUrls: Array<{ address: string; assessorUrl: string; county: string }>;
}

interface AtlantaProperty {
  id: string;
  address: string;
  city: string;
  county: string | null;
  state: string;
  source: 'properties' | 'property_records';
}

async function arcgisQuery(baseUrl: string, params: Record<string, string>): Promise<any> {
  const url = new URL(`${baseUrl}/query`);
  url.searchParams.set('f', 'json');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
  if (!resp.ok) throw new Error(`ArcGIS query failed: ${resp.status}`);
  return resp.json();
}

function sanitizeForArcGisWhere(token: string): string {
  return token.replace(/[^a-zA-Z0-9\s.-]/g, '');
}

function normalizeAddress(address: string): string {
  return address
    .replace(/\s+/g, ' ')
    .replace(/\bAPT\b.*$/i, '')
    .replace(/\bSTE\b.*$/i, '')
    .replace(/\bUNIT\b.*$/i, '')
    .replace(/#\d+.*$/i, '')
    .trim()
    .toUpperCase();
}

function detectCounty(
  county: string | null,
  city: string | null,
  _address: string | null
): 'fulton' | 'dekalb' | 'ambiguous' | null {
  const countyLower = (county || '').toLowerCase();
  if (countyLower.includes('fulton')) return 'fulton';
  if (countyLower.includes('dekalb') || countyLower.includes('de kalb')) return 'dekalb';

  const cityLower = (city || '').toLowerCase();

  if (cityLower === 'atlanta') return 'ambiguous';

  if (cityLower === 'sandy springs' || cityLower === 'roswell' ||
      cityLower === 'johns creek' || cityLower === 'alpharetta' || cityLower === 'milton' ||
      cityLower === 'college park' || cityLower === 'east point' || cityLower === 'hapeville' ||
      cityLower === 'union city' || cityLower === 'fairburn' || cityLower === 'palmetto') {
    return 'fulton';
  }
  if (cityLower === 'decatur' || cityLower === 'stone mountain' || cityLower === 'lithonia' ||
      cityLower === 'tucker' || cityLower === 'clarkston' || cityLower === 'avondale estates' ||
      cityLower === 'pine lake' || cityLower === 'stonecrest') {
    return 'dekalb';
  }

  return null;
}

function scoreAddressMatch(featureAddr: string, normalAddr: string): number {
  if (featureAddr === normalAddr) return 100;
  if (featureAddr.startsWith(normalAddr)) return 90;

  const addrParts = normalAddr.split(' ');
  const matchCount = addrParts.filter(part => featureAddr.includes(part)).length;
  const ratio = matchCount / addrParts.length;

  if (ratio >= 0.8) return 70;
  if (ratio >= 0.6) return 50;
  return 0;
}

async function lookupParcelId(
  county: 'fulton' | 'dekalb',
  address: string
): Promise<string | null> {
  const normalAddr = normalizeAddress(address);
  if (!normalAddr) return null;

  const baseUrl = county === 'fulton' ? FULTON_TAX_BASE : DEKALB_PARCEL_BASE;
  const addressField = 'Address';

  const addrParts = normalAddr.split(' ');
  const streetNumber = sanitizeForArcGisWhere(addrParts[0] || '');
  const streetName = sanitizeForArcGisWhere(addrParts.slice(1, 3).join(' '));

  if (!streetNumber || !/^\d+$/.test(streetNumber)) return null;

  let whereClause: string;
  if (streetName) {
    whereClause = `UPPER(${addressField}) LIKE '${streetNumber} ${streetName}%'`;
  } else {
    whereClause = `UPPER(${addressField}) LIKE '${streetNumber} %'`;
  }

  try {
    const data = await arcgisQuery(baseUrl, {
      where: whereClause,
      outFields: 'ParcelID,Address',
      returnGeometry: 'false',
      resultRecordCount: '10',
    });

    const features = data.features || [];
    if (features.length === 0) return null;

    let bestMatch: any = null;
    let bestScore = 0;

    for (const f of features) {
      const featureAddr = (f.attributes.Address || '').toUpperCase().trim();
      const score = scoreAddressMatch(featureAddr, normalAddr);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = f;
      }
    }

    if (bestScore >= 50 && bestMatch) {
      return bestMatch.attributes.ParcelID;
    }

    return null;
  } catch (err) {
    logger.warn(`[UrlDiscovery] ArcGIS lookup failed for ${address}: ${(err as Error).message}`);
    return null;
  }
}

async function lookupParcelIdAmbiguous(address: string): Promise<{ parcelId: string; county: 'fulton' | 'dekalb' } | null> {
  const fultonResult = await lookupParcelId('fulton', address);
  if (fultonResult) return { parcelId: fultonResult, county: 'fulton' };

  const dekalbResult = await lookupParcelId('dekalb', address);
  if (dekalbResult) return { parcelId: dekalbResult, county: 'dekalb' };

  return null;
}

function constructAssessorUrl(county: 'fulton' | 'dekalb', parcelId: string): string {
  if (county === 'fulton') {
    return `${FULTON_ASSESSOR_BASE}${encodeURIComponent(parcelId)}`;
  }
  return `${DEKALB_ASSESSOR_BASE}${encodeURIComponent(parcelId)}`;
}

async function validateUrl(url: string): Promise<boolean> {
  try {
    const resp = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });
    if (resp.ok) return true;

    if (resp.status === 405) {
      const getResp = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
        redirect: 'follow',
      });
      return getResp.ok;
    }

    return false;
  } catch {
    return false;
  }
}

export class AtlantaUrlDiscoveryService {
  private get pool() {
    return getPool();
  }

  async discoverUrls(): Promise<UrlDiscoveryStats> {
    const stats: UrlDiscoveryStats = {
      totalAtlantaProperties: 0,
      propertiesNeedingUrls: 0,
      fultonProcessed: 0,
      dekalbProcessed: 0,
      urlsDiscovered: 0,
      urlsFailed: 0,
      errors: [],
      sampleUrls: [],
    };

    try {
      logger.info('[UrlDiscovery] Step 1: Identifying Atlanta properties needing assessor URLs...');
      const atlantaProperties = await this.getAtlantaPropertiesNeedingUrls();
      stats.totalAtlantaProperties = await this.countAllAtlantaProperties();
      stats.propertiesNeedingUrls = atlantaProperties.length;

      logger.info(`[UrlDiscovery] Found ${stats.totalAtlantaProperties} total Atlanta properties, ${stats.propertiesNeedingUrls} need URLs`);

      if (atlantaProperties.length === 0) {
        logger.info('[UrlDiscovery] All Atlanta properties already have assessor URLs');
        return stats;
      }

      logger.info('[UrlDiscovery] Step 2: Looking up parcel IDs and constructing URLs...');

      for (const prop of atlantaProperties) {
        try {
          const countyResult = detectCounty(prop.county, prop.city, prop.address);
          if (!countyResult) {
            logger.debug(`[UrlDiscovery] Could not determine county for: ${prop.address}`);
            stats.urlsFailed++;
            continue;
          }

          let parcelId: string | null = null;
          let resolvedCounty: 'fulton' | 'dekalb';

          if (countyResult === 'ambiguous') {
            const result = await lookupParcelIdAmbiguous(prop.address);
            if (!result) {
              logger.debug(`[UrlDiscovery] No parcel ID found (tried both counties) for: ${prop.address}`);
              stats.urlsFailed++;
              continue;
            }
            parcelId = result.parcelId;
            resolvedCounty = result.county;
          } else {
            resolvedCounty = countyResult;
            parcelId = await lookupParcelId(resolvedCounty, prop.address);
            if (!parcelId) {
              logger.debug(`[UrlDiscovery] No parcel ID found for: ${prop.address}`);
              stats.urlsFailed++;
              continue;
            }
          }

          if (resolvedCounty === 'fulton') stats.fultonProcessed++;
          if (resolvedCounty === 'dekalb') stats.dekalbProcessed++;

          const assessorUrl = constructAssessorUrl(resolvedCounty, parcelId);

          const isValid = await validateUrl(assessorUrl);
          if (!isValid) {
            logger.debug(`[UrlDiscovery] URL validation failed (non-200) for: ${assessorUrl}`);
            stats.urlsFailed++;
            continue;
          }

          await this.storeAssessorUrl(prop.id, prop.source, assessorUrl);

          stats.urlsDiscovered++;

          if (stats.sampleUrls.length < 10) {
            stats.sampleUrls.push({
              address: prop.address,
              assessorUrl,
              county: resolvedCounty === 'fulton' ? 'Fulton County' : 'DeKalb County',
            });
          }

          if (stats.urlsDiscovered % 50 === 0) {
            logger.info(`[UrlDiscovery] Progress: ${stats.urlsDiscovered} URLs discovered so far...`);
          }

          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (err) {
          const msg = `Error processing ${prop.address}: ${(err as Error).message}`;
          stats.errors.push(msg);
          stats.urlsFailed++;
          if (stats.errors.length <= 5) {
            logger.error(`[UrlDiscovery] ${msg}`);
          }
        }
      }

      logger.info(`[UrlDiscovery] Complete. Discovered ${stats.urlsDiscovered} URLs, ${stats.urlsFailed} failed.`);
    } catch (err) {
      const msg = `URL discovery pipeline failed: ${(err as Error).message}`;
      stats.errors.push(msg);
      logger.error(`[UrlDiscovery] ${msg}`);
    }

    return stats;
  }

  private async countAllAtlantaProperties(): Promise<number> {
    const result = await this.pool.query(`
      SELECT
        (SELECT COUNT(*) FROM properties
         WHERE (UPPER(city) IN ('ATLANTA') OR UPPER(county) IN ('FULTON', 'DEKALB', 'FULTON COUNTY', 'DEKALB COUNTY'))
           AND state_code = 'GA') +
        (SELECT COUNT(*) FROM property_records
         WHERE (UPPER(city) IN ('ATLANTA') OR UPPER(county) IN ('FULTON', 'DEKALB', 'FULTON COUNTY', 'DEKALB COUNTY'))
           AND UPPER(state) = 'GA')
        AS total
    `);
    return parseInt(result.rows[0]?.total || '0');
  }

  private async getAtlantaPropertiesNeedingUrls(): Promise<AtlantaProperty[]> {
    const propertiesResult = await this.pool.query(`
      SELECT id, address_line1 AS address, city, county, state_code AS state
      FROM properties
      WHERE (UPPER(city) IN ('ATLANTA') OR UPPER(county) IN ('FULTON', 'DEKALB', 'FULTON COUNTY', 'DEKALB COUNTY'))
        AND state_code = 'GA'
        AND assessor_url IS NULL
        AND address_line1 IS NOT NULL
      ORDER BY created_at DESC
    `);

    const propertyRecordsResult = await this.pool.query(`
      SELECT id::text, address, city, county, state
      FROM property_records
      WHERE (UPPER(city) IN ('ATLANTA') OR UPPER(county) IN ('FULTON', 'DEKALB', 'FULTON COUNTY', 'DEKALB COUNTY'))
        AND UPPER(state) = 'GA'
        AND assessor_url IS NULL
        AND address IS NOT NULL
      ORDER BY id
    `);

    const results: AtlantaProperty[] = [];

    for (const row of propertiesResult.rows) {
      results.push({
        id: row.id,
        address: row.address,
        city: row.city || 'Atlanta',
        county: row.county,
        state: row.state || 'GA',
        source: 'properties',
      });
    }

    for (const row of propertyRecordsResult.rows) {
      results.push({
        id: row.id,
        address: row.address,
        city: row.city || 'Atlanta',
        county: row.county,
        state: row.state || 'GA',
        source: 'property_records',
      });
    }

    return results;
  }

  private async storeAssessorUrl(id: string, source: 'properties' | 'property_records', assessorUrl: string): Promise<void> {
    if (source === 'properties') {
      await this.pool.query(
        `UPDATE properties SET assessor_url = $1, updated_at = NOW() WHERE id = $2`,
        [assessorUrl, id]
      );
    } else {
      await this.pool.query(
        `UPDATE property_records SET assessor_url = $1 WHERE id = $2::uuid`,
        [assessorUrl, id]
      );
    }
  }

  async getSummary(): Promise<{
    totalAtlanta: number;
    withUrls: number;
    withoutUrls: number;
    byCounty: Array<{ county: string; total: number; withUrls: number }>;
  }> {
    const result = await this.pool.query(`
      SELECT
        COALESCE(county, city, 'Unknown') AS county_name,
        COUNT(*) AS total,
        COUNT(assessor_url) AS with_urls
      FROM (
        SELECT county, city, assessor_url FROM properties
        WHERE (UPPER(city) IN ('ATLANTA') OR UPPER(county) IN ('FULTON', 'DEKALB', 'FULTON COUNTY', 'DEKALB COUNTY'))
          AND state_code = 'GA'
        UNION ALL
        SELECT county, city, assessor_url FROM property_records
        WHERE (UPPER(city) IN ('ATLANTA') OR UPPER(county) IN ('FULTON', 'DEKALB', 'FULTON COUNTY', 'DEKALB COUNTY'))
          AND UPPER(state) = 'GA'
      ) combined
      GROUP BY COALESCE(county, city, 'Unknown')
    `);

    let totalAtlanta = 0;
    let withUrls = 0;
    const byCounty = result.rows.map((r: any) => {
      totalAtlanta += parseInt(r.total);
      withUrls += parseInt(r.with_urls);
      return {
        county: r.county_name,
        total: parseInt(r.total),
        withUrls: parseInt(r.with_urls),
      };
    });

    return {
      totalAtlanta,
      withUrls,
      withoutUrls: totalAtlanta - withUrls,
      byCounty,
    };
  }
}
