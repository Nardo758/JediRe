import Joi from 'joi';
import { SITE_COUNTIES, SiteCriteria, SiteInterpretation } from '../../types/site-finder';

export interface CatalogType { type_key: string; display_name: string; category: string }
export function resolveCatalogType(key: string, catalog: CatalogType[]): CatalogType | undefined {
  if (key.startsWith('category:')) {
    const category = key.slice(9);
    return catalog.some(t => t.category === category) ? { type_key: key, display_name: category, category } : undefined;
  }
  return catalog.find(t => t.type_key === key);
}
export const normalizeCode = (s: string) => s.trim().toUpperCase().replace(/[–—]/g, '-').replace(/\s+/g, '');
export const normalizeAuthority = (s: string) => s.trim().toUpperCase().replace(/\s+/g, ' ');
const schema = Joi.object({
  counties: Joi.array().items(Joi.string().valid(...SITE_COUNTIES)).min(1).max(3).unique().default([...SITE_COUNTIES]),
  municipality: Joi.string().trim().max(80),
  propertyType: Joi.string().trim().max(80),
  typeSemantics: Joi.string().valid('current', 'proposed').default('current'),
  intendedUse: Joi.string().trim().max(120),
  zoning: Joi.object({ code: Joi.string().pattern(/^[A-Za-z0-9 .–—-]{1,30}$/).required(), jurisdiction: Joi.string().trim().max(80).required() }),
  area: Joi.object({
    unit: Joi.string().valid('acres', 'sqft').required(),
    min: Joi.number().min(0).max(1e9), max: Joi.number().greater(0).max(1e9),
    minInclusive: Joi.boolean().default(true), maxInclusive: Joi.boolean().default(true),
  }).or('min', 'max'),
  addressText: Joi.string().trim().max(120).pattern(/^[^%_]+$/).messages({'string.pattern.base':'Address text is literal; SQL wildcard characters (%) and (_) are unsupported.'}),
  limit: Joi.number().integer().min(1).max(100).default(50),
}).unknown(false);

export function validateCriteria(input: unknown, catalog: CatalogType[]): SiteCriteria {
  const { value, error } = schema.validate(input, { abortEarly: false, convert: false });
  if (error) throw new Error(error.details.map(d => d.message).join('; '));
  const c = value as SiteCriteria;
  if (c.propertyType && !resolveCatalogType(c.propertyType, catalog)) throw new Error('Select a property type or category from the existing catalog.');
  if (c.zoning) c.zoning.code = normalizeCode(c.zoning.code);
  if (c.area?.min !== undefined && c.area?.max !== undefined &&
    (c.area.min > c.area.max || (c.area.min === c.area.max && (!c.area.minInclusive || !c.area.maxInclusive)))) throw new Error('Parcel-size bounds conflict.');
  if (c.typeSemantics === 'proposed' && c.propertyType && !c.intendedUse) throw new Error('Specify the exact proposed development use; a catalog type alone is not a legal-use classification.');
  if (!c.propertyType && !c.intendedUse && !c.zoning && !c.area && !c.addressText) throw new Error('Enter text or at least one search filter.');
  if (c.intendedUse && /^(senior living|senior housing|residential|industrial|commercial|mixed.use)$/i.test(c.intendedUse)) {
    throw new Error('The proposed use is ambiguous. Specify the activity or care model (for example assisted living, independent senior apartments, warehouse, or manufacturing).');
  }
  return c;
}

export function areaMatches(sqft: number, area?: SiteCriteria['area']): boolean {
  if (!Number.isFinite(sqft) || sqft <= 0) return false;
  if (!area) return true;
  const f = area.unit === 'acres' ? 43560 : 1;
  return (area.min === undefined || (area.minInclusive ? sqft >= area.min * f : sqft > area.min * f)) &&
    (area.max === undefined || (area.maxInclusive ? sqft <= area.max * f : sqft < area.max * f));
}

/** Conservative grammar, not a model-generated query. Every unconsumed predicate blocks execution. */
export function interpretText(text: string, structured: Partial<SiteCriteria>, catalog: CatalogType[]): SiteInterpretation {
  if (typeof text !== 'string' || text.length > 1000) throw new Error('Search text must be at most 1,000 characters.');
  let rest = text.toLowerCase().replace(/[,!?]/g, ' ').replace(/\.(?!\d)/g, ' ').replace(/\bthree\b/g, '3').replace(/\bfive\b/g, '5').replace(/\bten\b/g, '10');
  const parsed: Partial<SiteCriteria> = {};
  const issues: string[] = [];
  const explanation: string[] = [];
  const countyMatches = SITE_COUNTIES.filter(c => rest.includes(c.toLowerCase()));
  if (countyMatches.length) {
    parsed.counties = countyMatches;
    for (const c of countyMatches) rest = rest.replace(c.toLowerCase(), ' ');
  }
  rest = rest.replace(/\bsouth florida\b/g, ' ');
  if (/\bunincorporated\b/.test(rest)) {
    if (countyMatches.length===1) {
      parsed.municipality=`Unincorporated ${countyMatches[0]}`;
      rest=rest.replace(/\bunincorporated\b/g,' ');
    } else issues.push('Specify one county for an unincorporated zoning authority.');
  }
  const between = rest.match(/\bbetween\s+(\d+(?:\.\d+)?)\s+and\s+(\d+(?:\.\d+)?)\s*(acres?|sqft|square feet)\b/);
  if (between) {
    parsed.area = { min: Number(between[1]), max: Number(between[2]), unit: between[3].startsWith('acre') ? 'acres' : 'sqft', minInclusive: true, maxInclusive: true };
    rest = rest.replace(between[0], ' ');
  } else {
    const bounds = [...rest.matchAll(/\b(over|more than|greater than|at least|minimum|under|less than|at most|maximum)\s+(\d+(?:\.\d+)?)\s*(acres?|sqft|square feet)\b/g)];
    for (const m of bounds) {
      const unit = m[3].startsWith('acre') ? 'acres' : 'sqft';
      if (parsed.area && parsed.area.unit !== unit) { issues.push('Use the same area unit for both text bounds.'); continue; }
      parsed.area ||= { unit, minInclusive: true, maxInclusive: true };
      const lower = /over|more than|greater than|at least|minimum/.test(m[1]);
      const key = lower ? 'min' : 'max';
      if (parsed.area[key] !== undefined) issues.push('Multiple parcel-size bounds conflict; edit the structured bounds.');
      parsed.area[key] = Number(m[2]);
      parsed.area[lower ? 'minInclusive' : 'maxInclusive'] = /at least|minimum|at most|maximum/.test(m[1]);
      rest = rest.replace(m[0], ' ');
    }
  }
  const proposed = /\b(zoned for|allowed for|permitted for|develop|build)\b/.test(rest);
  const useTerms = ['continuing care retirement community', 'independent senior housing', 'independent senior apartments', 'assisted living', 'skilled nursing', 'memory care', 'senior living', 'warehouse', 'manufacturing'];
  const precise = useTerms.find(t => rest.includes(t));
  if (precise) {
    parsed.intendedUse = precise; parsed.typeSemantics = 'proposed';
    rest = rest.replace(precise, ' ');
  }
  // Match longest labels first; catalog, rather than a competing taxonomy, is authoritative.
  const categories = [...new Set(catalog.map(t => t.category))].map(category => ({ type_key: `category:${category}`, display_name: category, category }));
  const aliases = [...catalog,...categories].flatMap(t => [t.display_name.toLowerCase(), t.type_key.replace(/_/g, ' ')].map(label => ({ label, type: t })))
    .sort((a, b) => b.label.length - a.label.length);
  const candidate = aliases.find(a => rest.includes(a.label));
  if (candidate) {
    {
      parsed.propertyType = candidate.type.type_key;
      parsed.typeSemantics = proposed ? 'proposed' : 'current';
      if (proposed && !parsed.intendedUse) parsed.intendedUse = candidate.label;
    }
    rest = rest.replace(candidate.label, ' ');
  }
  const code = rest.match(/\b(?:zoning|zoned|district|zone)\s+(?:code\s+)?(?!(?:for|in|and|with)\b)([a-z]+(?:[- ]?\d+[a-z0-9-]*)?)\b/);
  if (code) {
    const jurisdiction=parsed.municipality || structured.zoning?.jurisdiction || structured.municipality || '';
    if (!jurisdiction) issues.push('A district code needs its controlling jurisdiction; enter the zoning authority.');
    parsed.zoning = { code: normalizeCode(code[1]), jurisdiction };
    rest = rest.replace(code[0], ' ');
  }
  rest = rest.replace(/\b(find|show|search|for|parcels?|sites?|properties|property|in|county|counties|and|the|of|zoned|allowed|permitted|develop|build|with|me)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (rest) issues.push(`Unsupported or ambiguous text: "${rest}". Remove it or express it using the editable filters; it was not applied.`);
  for (const [key, val] of Object.entries(parsed)) {
    const prior = structured[key as keyof SiteCriteria];
    if (prior !== undefined && !(key === 'counties' && JSON.stringify(prior) === JSON.stringify(SITE_COUNTIES)) && !(key === 'typeSemantics' && !structured.propertyType) &&
      JSON.stringify(prior) !== JSON.stringify(val)) issues.push(`Text conflicts with the structured ${key} filter. Clear one or edit the interpreted filters before searching.`);
  }
  const merged = { counties: [...SITE_COUNTIES], limit: 50, ...structured, ...parsed } as SiteCriteria;
  try { validateCriteria(merged, catalog); } catch (e: any) { issues.push(e.message); }
  if (merged.area) explanation.push(`${merged.area.min !== undefined ? `${merged.area.minInclusive ? '≥' : '>'} ${merged.area.min}` : ''} ${merged.area.max !== undefined ? `${merged.area.maxInclusive ? '≤' : '<'} ${merged.area.max}` : ''} ${merged.area.unit} (unrounded source area)`);
  if (merged.propertyType) explanation.push(`${merged.typeSemantics === 'proposed' ? 'Proposed' : 'Current classification'}: ${merged.propertyType}`);
  if (merged.intendedUse) explanation.push(`Permission assessment requested: ${merged.intendedUse}`);
  explanation.push(`Geography: ${merged.counties.join(', ')}${merged.municipality ? ` / ${merged.municipality}` : ''}`);
  if (merged.zoning) explanation.push(`Exact district ${merged.zoning.code} / ${merged.zoning.jurisdiction}`);
  return { criteria: merged, issues, interpretation: explanation };
}