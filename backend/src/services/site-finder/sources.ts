import axios from 'axios';
import { SiteCounty, SiteCriteria, SiteParcel, SiteSourceHealth } from '../../types/site-finder';
import { areaMatches, normalizeAuthority, normalizeCode, CatalogType, resolveCatalogType } from './criteria';
import { fromEsri, esriRings, overlapArea, geometryArea } from './geometry';

const MDC = 'https://gisfs.miamidade.gov/mdarcgis/rest/services/MD_PA_PropertySearch/MapServer';
const BCPA = 'https://gisweb-adapters.bcpa.net/arcgis/rest/services/BCPA_EXTERNAL_JAN26/MapServer';
const PBC = 'https://maps.co.palm-beach.fl.us/arcgis/rest/services/OpenData';
export const SOURCES = {
  'Miami-Dade': {
    parcel: 'https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/PaParcelView_gdb/FeatureServer/0',
    id: 'FOLIO', area: 'LOT_SIZE', address: 'TRUE_SITE_ADDR', use: 'DOR_CODE_CUR', useDescription: 'DOR_DESC', oid: 'OBJECTID',
    municipality: `${MDC}/2`, municipalityName: 'NAME', zones: [{ url: `${MDC}/4`, code: 'ZONE', name: 'ZONE_DESC' }, { url: `${MDC}/5`, code: 'ZONE', name: 'ZONEDESC' }],
    unit: 'sqft', authorityLink: 'https://www.miamidade.gov/global/economy/building/zoning.page',
    provenance: 'https://gis-mdc.opendata.arcgis.com/',
  },
  Broward: {
    parcel: `${BCPA}/16`, id: 'FOLIO', area: 'SHAPE.STArea()', address: '', use: '', useDescription: '', oid: 'OBJECTID',
    municipality: `${BCPA}/3`, municipalityName: 'CITYNAME', zones: [{ url: `${BCPA}/9`, code: 'ZONING', name: 'ZONE_NAME' }],
    unit: 'sqft', authorityLink: 'https://www.bcpa.net/ZoningDefinitions.htm',
    provenance: 'https://gisweb-adapters.bcpa.net/bcpawebmap_ex/bcpawebmap.aspx',
  },
  'Palm Beach': {
    parcel: 'https://services1.arcgis.com/ZWOoUZbtaYePLlPw/arcgis/rest/services/Parcels_and_Property_Details_Local_Projection/FeatureServer/0',
    id: 'PARID', area: 'SHAPE__Area', address: 'SITE_ADDR_STR', use: 'PROPERTY_USE', useDescription: 'PROPERTY_USE', oid: 'OBJECTID',
    municipality: `${PBC}/Boundaries_Open_Data/MapServer/5`, municipalityName: 'MUNINAME', zones: [{ url: `${PBC}/Planning_Open_Data/MapServer/9`, code: 'FCODE', name: 'FNAME' }],
    unit: 'sqft', authorityLink: 'https://pbc.gov/uldc/index.htm',
    provenance: 'https://opendata2-pbcgov.opendata.arcgis.com/',
  },
} as const;

const allowedRoots = [
  MDC, BCPA, PBC,
  'https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/PaParcelView_gdb/',
  'https://services1.arcgis.com/ZWOoUZbtaYePLlPw/arcgis/rest/services/Parcels_and_Property_Details_Local_Projection/',
];
/** No user-supplied hosts, arbitrary SQL, or redirects to untrusted services. */
export async function officialJson(url: string, params: Record<string, unknown> = {}): Promise<any> {
  if (!allowedRoots.some(root => url === root || url.startsWith(`${root}${root.endsWith('/') ? '' : '/'}`))) throw new Error('Unapproved official source URL');
  const options = { timeout: 12000, maxRedirects: 0, maxContentLength: 12 * 1024 * 1024 };
  const { data } = typeof params.geometry === 'string' && params.geometry.length > 5000
    ? await axios.post(url, new URLSearchParams(Object.entries({ f: 'json', ...params }).map(([key,value]) => [key,String(value)])).toString(), { ...options, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
    : await axios.get(url, { ...options, params: { f: 'json', ...params } });
  if (!data || typeof data !== 'object' || data.error) throw new Error(data?.error?.message || 'Official source returned an invalid response');
  return data;
}
const metadata = new Map<string, { at: number; data: any }>();
export async function layerMetadata(url: string, fields: string[], pagination = false) {
  let entry = metadata.get(url);
  if (!entry || Date.now() - entry.at > 60 * 60 * 1000) {
    entry = { at: Date.now(), data: await officialJson(url) }; metadata.set(url, entry);
  }
  const names = entry.data.fields?.map((f: any) => f.name) || [];
  if (fields.some(f => f && !names.includes(f))) throw new Error('Official source schema changed; required fields are missing');
  if (pagination && (!entry.data.advancedQueryCapabilities?.supportsPagination || !entry.data.advancedQueryCapabilities?.supportsOrderBy)) throw new Error('Source does not support bounded, stable pagination');
  return entry.data;
}
export const quoted = (s: string) => `'${s.replace(/'/g, "''")}'`;
const geomQuery = (rings: number[][][]) => ({ geometry: JSON.stringify({ rings, spatialReference: { wkid: 4326 } }), geometryType: 'esriGeometryPolygon', inSR: 4326, spatialRel: 'esriSpatialRelIntersects' });
function envelopeQuery(rings: number[][][]) {
  const points=rings.flat(), xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  return {geometry:JSON.stringify({xmin:Math.min(...xs),xmax:Math.max(...xs),ymin:Math.min(...ys),ymax:Math.max(...ys),spatialReference:{wkid:4326}}),geometryType:'esriGeometryEnvelope',inSR:4326,spatialRel:'esriSpatialRelIntersects'};
}
async function intersect(url: string, rings: number[][][], fields: string[]) {
  await layerMetadata(url, fields);
  const data = await officialJson(`${url}/query`, { ...geomQuery(rings), where: '1=1', outFields: fields.join(','), returnGeometry: true, outSR: 4326 });
  if (data.exceededTransferLimit) throw new Error('Spatial source truncated the jurisdiction/zoning intersection');
  if (!Array.isArray(data.features)) throw new Error('Spatial source did not return features');
  const input = fromEsri(rings);
  return data.features.map((f: any) => ({ ...f.attributes, _overlap: overlapArea(input, fromEsri(f.geometry?.rings)) })).filter((r: any) => r._overlap > 0.01);
}
const labelKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
// Florida DOR categories (current assessment classification, never zoning permission).
// Nursing homes (74) are not equated to assisted living/independent senior housing.
export function dorCodes(type: CatalogType): string[] | null {
  const key = labelKey(type.type_key);
  const label = labelKey(type.display_name);
  const k = `${key} ${label}`;
  if (key === 'singlefamily') return ['01'];
  if (key === 'condominiums') return ['04'];
  if (key === 'manufacturedmobile') return ['02'];
  if (key === 'medicaloffice') return ['19'];
  if (key === 'officeclassabc') return ['17', '18'];
  if (key === 'warehousedistribution') return ['48'];
  if (key === 'manufacturing') return ['41', '42'];
  if (/\b(multifamily|apartments)\b/.test(k)) return ['03', '08'];
  if (/\b(office|generaloffice)\b/.test(k)) return ['17', '18', '19'];
  if (/\b(retail)\b/.test(k)) return ['11', '12', '13', '14', '15', '16'];
  if (/industrial/.test(k) && type.type_key.startsWith('category:')) return ['41', '42', '43', '44', '45', '46', '47', '48', '49'];
  if (/\b(warehouse)\b/.test(k)) return ['48'];
  if (/\b(hospitality|hotel|hotels)\b/.test(k)) return ['39'];
  if (/\b(land|vacantland)\b/.test(k) || key === 'rawundeveloped') return ['00', '10', '40', '70', '80', '90'];
  return null;
}
export function classification(code: unknown, catalog: CatalogType[]): string | null {
  const c = String(code ?? '').trim().padStart(2, '0').slice(0, 2);
  const direct = catalog.find(t => dorCodes(t)?.includes(c));
  if (direct && ['single_family','condominiums','manufactured_mobile','medical_office','manufacturing','warehouse_distribution'].includes(direct.type_key)) return direct.display_name;
  return [...new Set(catalog.map(t => t.category))].find(category => dorCodes({type_key:`category:${category}`,display_name:category,category})?.includes(c)) || null;
}
export const PALM_USE: Record<string, string[]> = {
  multifamily: ['MFR 5 TO 9 UNITS', 'MULTIFAMILY < 10 UNITS-COMM ZONING', 'MULTIFAMILY < 10 UNITS-IND ZONING', 'MULTIFAMILY < 5 UNITS', 'MULTIFAMILY > 10 units Income Restricted', 'MULTIFAMILY 10 UNITS OR MORE'],
  office: ['MEDIC OFFIC- BLDG UP TO 4 STORIES CONDO', 'MEDICAL OFFICE- BUILDING UP TO 4 STORIES', 'OFF BLDG- NON MEDIC 1 TO 3 STORIES CONDO', 'OFF BLDG- NON MEDIC 4 STORIES & UP CONDO', 'OFFICE BLDG- NON MEDICAL 4 STORIES & UP', 'OFFICE BLDG-NON MEDICAL 1 TO 3 STORIES'],
  industrial: ['LIGHT MFG', 'HEAVY MFG', 'WAREH/DIST TERM', 'WAREH/DIST TERM CONDO', 'FOOD PROCESSING', 'BOTTLER', 'PACKING', 'MIN PROCESSING'],
  retail: ['DEPARTMENT STORE', 'SMALL DISCOUNT STORE < 25000 SF', 'STORES', 'STORES CONDO', 'SUPERMARKET/DRUG STORE', 'SHOPPING CENTER CMMITY', 'SHOPPING CENTER REGIONAL', 'SH CTR CMMITY CONDO'],
  hospitality: ['MOTEL', 'HOTEL', 'HOTEL CONDO', 'HOTEL TIMESHARE'],
  land: ['VACANT', 'VACANT COMMERCIAL LAND', 'VACANT INDUSTRIAL', 'VACANT INSTIT', 'VACANT COMM CONDO LAND', 'VACANT CONDO LAND', 'VACANT INDUS CONDO', 'VACANT TOWNHOUSE', 'VACANT ZERO LOT LINE RES'],
  seniorliving: ['RETIREMENT', 'RETIREMENT Income Restricted', 'LIFE CARE HX'],
  mixeduse: ['STORE/OFFICE/RESIDENTIAL', 'STORE/OFF/RES CONDO'],
};
function palmLabels(type: CatalogType): string[] | null {
  const k = labelKey(type.type_key);
  const subtype: Record<string,string[]> = { singlefamily:['SINGLE FAMILY','SINGLE FAMILY-COMM ZONING','SINGLE FAMILY-IND ZONING'], condominiums:['CONDOMINIUM'], townhouses:['TOWNHOUSE'], seniorhousing:PALM_USE.seniorliving, medicaloffice:PALM_USE.office.slice(0,2), officeclassabc:PALM_USE.office.slice(2), warehousedistribution:['WAREH/DIST TERM','WAREH/DIST TERM CONDO'], manufacturing:['LIGHT MFG','HEAVY MFG'], rawundeveloped:PALM_USE.land };
  return subtype[k] || (type.type_key.startsWith('category:') ? PALM_USE[labelKey(type.category)] : PALM_USE[k]) || null;
}
function palmClassification(use: unknown, catalog: CatalogType[]): string | null {
  return catalog.find(t => palmLabels(t)?.includes(String(use)))?.display_name ||
    [...new Set(catalog.map(t=>t.category))].find(category=>palmLabels({type_key:`category:${category}`,display_name:category,category})?.includes(String(use))) || null;
}
function currentPredicate(field: string, codes: string[]) {
  // Miami DOR codes are four-character text. These are assessment classifications, not district codes.
  return `(${codes.map(c => `${field} LIKE ${quoted(c + '%')}`).join(' OR ')})`;
}

export async function resolveZoning(p: SiteParcel): Promise<SiteParcel> {
  const s = SOURCES[p.county];
  const rings = p.geometry ? esriRings(p.geometry) : undefined;
  if (!rings) { p.warnings.push('Geometry unavailable; jurisdiction and district remain unknown.'); return p; }
  try {
    const cities = await intersect(s.municipality, rings, [s.municipalityName]);
    const authorities = [...new Set(cities.map((c: any) => String(c[s.municipalityName]).trim()).filter(Boolean))] as string[];
    p.jurisdictionSourceUrl = s.municipality;
    if (authorities.length > 1 || (authorities.length === 1 && geometryArea(p.geometry!) - cities.reduce((sum: number,c: any) => sum+c._overlap,0) > 1)) { p.warnings.push('Parcel crosses or does not fully resolve within municipal boundaries; authority unresolved.'); return p; }
    if (!authorities.length) {
      // County membership is established by the county's parcel layer, not by mailing address.
      p.jurisdiction = `Unincorporated ${p.county}`;
    } else p.jurisdiction = authorities[0];
    const zones = p.county === 'Miami-Dade'
      ? [s.zones[p.jurisdiction.toUpperCase().includes('UNINCORPORATED') ? 0 : 1]]
      : s.zones;
    if (p.county === 'Palm Beach' && !p.jurisdiction.toUpperCase().includes('UNINCORPORATED')) {
      p.warnings.push('County zoning layer covers unincorporated areas only; municipal zoning is not provisioned.'); return p;
    }
    const z = zones[0];
    const rows = await intersect(z.url, rings, [z.code, z.name, ...(p.county === 'Miami-Dade' && !p.jurisdiction.toUpperCase().includes('UNINCORPORATED') ? ['MUNICNAME'] : [])]);
    const codes: string[] = [...new Set<string>(rows.map((r: any) => normalizeCode(String(r[z.code] ?? ''))).filter((c: string) => c && c !== 'NONE'))];
    if (rows.some((r: any) => r.MUNICNAME && normalizeAuthority(r.MUNICNAME) !== normalizeAuthority(p.jurisdiction!))) {
      p.warnings.push('Zoning authority conflicts with municipal boundary; district unresolved.'); return p;
    }
    if (codes.length !== 1) { p.warnings.push(codes.length ? 'Split zoning: multiple districts intersect the parcel.' : 'No authoritative district intersection found.'); return p; }
    if (geometryArea(p.geometry!) - rows.reduce((sum: number,r: any) => sum+r._overlap,0) > 1) { p.warnings.push('Zoning polygons do not fully cover this parcel; district unresolved.'); return p; }
    p.district = codes[0]; p.zoningSourceUrl = z.url;
    p.review.districtName = rows[0][z.name] || undefined;
    if (p.county === 'Broward') p.warnings.push('BCPA city limits metadata describes a 2013 update; annexation and city zoning currency require confirmation.');
  } catch (e: any) { p.warnings.push(`Zoning resolution incomplete: ${e.message}. Retry the review.`); }
  return p;
}

export async function discoverCounty(
  county: SiteCounty, criteria: SiteCriteria, catalog: CatalogType[],
  onPage: (parcels: SiteParcel[], health: SiteSourceHealth) => Promise<void>,
  signal?: AbortSignal,
): Promise<SiteSourceHealth> {
  const s = SOURCES[county];
  const health: SiteSourceHealth = { county, status: 'working', sourceUrl: s.parcel, scanned: 0, matched: 0, limited: false, messages: [], checkedAt: new Date().toISOString() };
  try {
    const m = await layerMetadata(s.parcel, [s.id, s.area, s.address, s.use, s.oid], true);
    // Area field unit is validated from the layer CRS, not Web Mercator area.
    if (county !== 'Miami-Dade' && ![2236, 102658, 2881].includes(m.extent?.spatialReference?.latestWkid || m.extent?.spatialReference?.wkid)) throw new Error('Parcel area CRS is not validated in feet');
    const where: string[] = ['1=1'];
    if (criteria.area) {
      const a = criteria.area, factor = a.unit === 'acres' ? 43560 : 1;
      if (a.min !== undefined) where.push(`${s.area} ${a.minInclusive ? '>=' : '>'} ${a.min * factor}`);
      if (a.max !== undefined) where.push(`${s.area} ${a.maxInclusive ? '<=' : '<'} ${a.max * factor}`);
    }
    if (criteria.addressText && s.address) where.push(`UPPER(${s.address}) LIKE ${quoted('%' + criteria.addressText.toUpperCase().replace(/[%_]/g, '') + '%')}`);
    let folios: string[] | undefined;
    const current = criteria.propertyType && criteria.typeSemantics !== 'proposed';
    if (current) {
      const type = resolveCatalogType(criteria.propertyType!,catalog)!;
      const codes = county === 'Palm Beach' ? palmLabels(type) : dorCodes(type);
      if (!codes) throw new Error('This catalog subtype has no validated assessor-use mapping; choose proposed-use semantics or another current classification.');
      if (county === 'Broward') {
        await layerMetadata(`${BCPA}/36`, ['FOLIO_NUMBER', 'USE_CODE'], true);
        const info = await officialJson(`${BCPA}/36/query`, { where: `USE_CODE IN (${codes.map(quoted).join(',')})`, outFields: 'FOLIO_NUMBER', returnGeometry: false, resultRecordCount: 200, orderByFields: 'FOLIO_NUMBER' });
        folios = info.features?.map((f: any) => String(f.attributes.FOLIO_NUMBER)) || [];
        if (info.exceededTransferLimit) { health.limited = true; health.messages.push('Current-use candidate lookup capped at 200 assessor records.'); }
         if (!folios.length) { health.status=health.limited?'partial':'complete';health.finishedAt=new Date().toISOString();await onPage([], health); return health; }
        where.push(`FOLIO IN (${folios.map(quoted).join(',')})`);
      } else where.push(county === 'Palm Beach' ? `${s.use} IN (${codes.map(quoted).join(',')})` : currentPredicate(s.use, codes));
    }
    let scopes: Record<string, unknown>[] = [{}];
    let scopeLimited=health.limited;
    const authority = criteria.municipality || criteria.zoning?.jurisdiction;
    if (authority && !authority.toUpperCase().startsWith('UNINCORPORATED')) {
      await layerMetadata(s.municipality, [s.municipalityName]);
      const boundaries = await officialJson(`${s.municipality}/query`, { where: `UPPER(${s.municipalityName}) = ${quoted(normalizeAuthority(authority))}`, outFields: s.municipalityName, returnGeometry: true, outSR: 4326 });
      if (boundaries.exceededTransferLimit || boundaries.features?.length !== 1 || !boundaries.features[0].geometry?.rings) throw new Error('Municipality not uniquely resolved in this county; edit geography or authority.');
      scopes = [envelopeQuery(boundaries.features[0].geometry.rings)];
    }
    if (criteria.zoning) {
      const unincorporated=criteria.zoning.jurisdiction.toUpperCase().startsWith('UNINCORPORATED');
      if (county==='Palm Beach' && !unincorporated) throw new Error('Palm Beach municipal zoning-code coverage is not provisioned; try parcel-size/current-type discovery or the controlling city zoning map.');
      const zone=county==='Miami-Dade' ? SOURCES['Miami-Dade'].zones[unincorporated?0:1] : s.zones[0];
      await layerMetadata(zone.url,[zone.code]);
      const zoneWhere=[`UPPER(${zone.code})=${quoted(criteria.zoning.code)}`];
      if (county==='Miami-Dade'&&!unincorporated) zoneWhere.push(`UPPER(MUNICNAME)=${quoted(normalizeAuthority(criteria.zoning.jurisdiction))}`);
      const districts=await officialJson(`${zone.url}/query`,{where:zoneWhere.join(' AND '),outFields:zone.code,returnGeometry:true,outSR:4326});
      if (districts.exceededTransferLimit) {scopeLimited=true;health.messages.push('Official zoning-code polygons exceed the source transfer limit; spatial scope is incomplete.');}
      if (!districts.features?.length) throw new Error('No exact district polygon found in the official zoning layer. Check the authority/code; this is not proof the district does not exist.');
      const candidates=districts.features.slice(0,20).map((f:any)=>fromEsri(f.geometry?.rings));
      if (districts.features.length>20) {scopeLimited=true;health.messages.push('Zoning spatial scope limited to 20 official district polygons.');}
      scopes=candidates.map((g:any)=>envelopeQuery(esriRings(g)));
      health.messages.push('District polygons supply bounded candidate envelopes; every result is rechecked against exact parcel/district and authority intersections.');
    }
    health.messages.push(county === 'Miami-Dade' ? 'Area is assessor LOT_SIZE (square feet), not Web Mercator geometry area.' : 'Area is unrounded parcel geometry area in the official feet-based CRS.');
    health.messages.push('Bounded screening: at most 200 candidate parcels per county; not an exhaustive county inventory.');
    if (county === 'Palm Beach') health.messages.push('Municipal parcel discovery available; district review currently covers unincorporated county zoning only.');
    if (county === 'Broward') health.messages.push('BCPA municipal boundary currency is uncertain; permission reviews remain unverified pending current authority confirmation.');
    let offset = 0, scopeIndex=0;
    const seen = new Set<string>();
    while (health.scanned < 200 && health.matched < criteria.limit && scopeIndex<scopes.length) {
      if (signal?.aborted) throw new Error('Run time limit reached; retry with narrower filters.');
      const page = await officialJson(`${s.parcel}/query`, { where: where.join(' AND '), ...scopes[scopeIndex], outFields: [...new Set([s.id, s.area, s.address, s.use, s.useDescription, s.oid].filter(Boolean))].join(','), returnGeometry: true, outSR: 4326, resultOffset: offset, resultRecordCount: Math.min(scopes.length>1 ? 5 : 20,200-health.scanned), orderByFields: `${s.oid} ASC` });
      if (!Array.isArray(page.features)) throw new Error('Source query did not return parcel features');
      const features = page.features;
      if (!features.length) {scopeIndex++;offset=0;continue;}
      offset += features.length; health.scanned += features.length;
      const parcels = await Promise.all(features.map(async (f: any): Promise<SiteParcel | null> => {
        const a = f.attributes;
        const id = String(a[s.id] ?? '');
        const sqft = Number(a[s.area]);
        if (!id || seen.has(id) || !areaMatches(sqft, criteria.area)) return null;
        seen.add(id);
        const now = new Date().toISOString();
        const p: SiteParcel = {
          key: `${county.replace(/\W/g, '')}-${id}`, county, parcelId: id, address: a[s.address] || null,
          currentPropertyType: county === 'Palm Beach' ? palmClassification(a[s.use], catalog) : s.use ? classification(a[s.use], catalog) : null, currentLandUse: a[s.useDescription] || a[s.use] || null,
          areaSqft: sqft, acres: sqft / 43560, jurisdiction: null, district: null,
          geometry: f.geometry?.rings ? fromEsri(f.geometry.rings) : undefined,
          sourceUrl: `${s.parcel}/query?f=json&where=${encodeURIComponent(`${s.id}=${quoted(id)}`)}&outFields=${encodeURIComponent([s.id,s.area,s.address,s.use,s.useDescription].filter(Boolean).join(','))}&returnGeometry=true&outSR=4326`,
          areaSourceUrl: s.parcel, retrievedAt: now,
          classificationSourceUrl: county==='Broward' ? `${BCPA}/36/query?f=json&where=${encodeURIComponent(`FOLIO_NUMBER=${quoted(id)}`)}&outFields=FOLIO_NUMBER,USE_CODE` : s.parcel,
          sourceUpdatedAt: m.editingInfo?.lastEditDate ? new Date(m.editingInfo.lastEditDate).toISOString() : undefined,
          warnings: [], review: { status: criteria.intendedUse ? 'unverified' : 'not-requested', requestedUse: criteria.intendedUse, checkedAt: now, evidence: [], conditions: [], standards: [], limitations: [] },
        };
        if (county === 'Broward') {
          try {
            const info = await officialJson(`${BCPA}/36/query`, { where: `FOLIO_NUMBER=${quoted(id)}`, outFields: 'USE_CODE,SITUS_STREET_NUMBER,SITUS_STREET_DIRECTION,SITUS_STREET_NAME,SITUS_STREET_TYPE', returnGeometry: false, resultRecordCount: 2, orderByFields: 'FOLIO_NUMBER' });
            const ia = info.features?.[0]?.attributes;
            if (info.features?.length === 1 && ia) { p.address = [ia.SITUS_STREET_NUMBER,ia.SITUS_STREET_DIRECTION,ia.SITUS_STREET_NAME,ia.SITUS_STREET_TYPE].filter(Boolean).join(' '); p.currentLandUse = ia.USE_CODE; p.currentPropertyType = classification(ia.USE_CODE, catalog); }
          } catch (e: any) { p.warnings.push(`Assessor classification unavailable: ${e.message}`); }
          if (criteria.addressText && !p.address?.toUpperCase().includes(criteria.addressText.toUpperCase())) return null;
        }
        await resolveZoning(p);
        if (authority && (!p.jurisdiction || normalizeAuthority(p.jurisdiction) !== normalizeAuthority(authority))) return null;
        if (criteria.zoning && (!p.district || normalizeCode(p.district) !== criteria.zoning.code || normalizeAuthority(p.jurisdiction!) !== normalizeAuthority(criteria.zoning.jurisdiction))) return null;
        return p;
      }));
      const accepted = parcels.filter((p): p is SiteParcel => !!p).slice(0, criteria.limit - health.matched);
      health.matched += accepted.length;
      if (accepted.some(p => p.warnings.length)) health.status = 'partial';
      health.limited = scopeLimited || !!page.exceededTransferLimit || scopeIndex < scopes.length-1;
      await onPage(accepted, { ...health });
      if (!page.exceededTransferLimit) {scopeIndex++;offset=0;}
    }
    health.limited=scopeLimited || health.scanned>=200 || health.matched>=criteria.limit || scopeIndex<scopes.length;
    if (health.limited) {
      health.limited = true; health.status = 'partial'; health.messages.push('Result/candidate limit reached. Narrow geography or size bounds for more targeted results.');
    }
    if (criteria.zoning || criteria.municipality) health.messages.push('Unresolved jurisdiction/district intersections were excluded; zero matches do not prove no qualifying parcels exist.');
    if (health.status==='working') health.status='complete';
  } catch (e: any) { health.status = 'error'; health.messages.push(e.message); }
  health.finishedAt=new Date().toISOString();
  await onPage([], health);
  return health;
}