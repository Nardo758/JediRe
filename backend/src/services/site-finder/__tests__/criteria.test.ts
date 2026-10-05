import { describe, it, expect } from 'vitest';
import { validateCriteria, interpretText, areaMatches, normalizeCode } from '../criteria';
const catalog = [
  {type_key:'warehouse_distribution',display_name:'Warehouse / Distribution',category:'Industrial'},
  {type_key:'manufacturing',display_name:'Manufacturing Facilities',category:'Industrial'},
  {type_key:'office_class_abc',display_name:'Office (Class A, B, C)',category:'Commercial'},
  {type_key:'senior_housing',display_name:'Senior / Age-Restricted Housing',category:'Multifamily'},
];
describe('Site Finder unified criteria', () => {
  it('rejects wildcard address predicates instead of silently stripping requested text',()=>{
    expect(()=>validateCriteria({addressText:'%MAIN'},catalog)).toThrow(/wildcard/);
  });
  it('parses a text-only letter district with an explicit unincorporated authority',()=>{
    const r=interpretText('Find parcels zoned IL in unincorporated Palm Beach County',{},catalog);
    expect(r.issues).toEqual([]);
    expect(r.criteria.zoning).toEqual({code:'IL',jurisdiction:'Unincorporated Palm Beach'});
    expect(r.criteria.intendedUse).toBeUndefined();
  });
  it.each([
    {propertyType:'warehouse_distribution'}, {zoning:{code:' ru – 1 ',jurisdiction:'Unincorporated Miami-Dade'}},
    {area:{min:3,unit:'acres',minInclusive:false,maxInclusive:true}}, {addressText:'MAIN'},
  ])('accepts independent optional modes without intended use: %j', filter => {
    expect(validateCriteria({counties:['Miami-Dade'],limit:50,...filter},catalog)).toBeTruthy();
  });
  it('supports a catalog-derived broad category without introducing a taxonomy', () => {
    expect(validateCriteria({propertyType:'category:Industrial'},catalog).propertyType).toBe('category:Industrial');
    expect(() => validateCriteria({propertyType:'category:Invented'},catalog)).toThrow();
  });
  it('parses both requested text-only examples against the actual subtype catalog', () => {
    const assisted = interpretText('Find parcels over three acres zoned for assisted living in Broward',{},catalog);
    expect(assisted.issues).toEqual([]);
    expect(assisted.criteria).toMatchObject({counties:['Broward'],intendedUse:'assisted living',typeSemantics:'proposed',area:{min:3,minInclusive:false}});
    const industrial = interpretText('Find industrial sites between 5 and 10 acres in Palm Beach County',{},catalog);
    expect(industrial.issues).toEqual([]);
    expect(industrial.criteria).toMatchObject({counties:['Palm Beach'],propertyType:'category:Industrial',typeSemantics:'current',area:{min:5,max:10,minInclusive:true,maxInclusive:true}});
  });
  it('does not turn existing residential or senior classification into permission', () => {
    const c = validateCriteria({propertyType:'senior_housing'},catalog);
    expect(c.intendedUse).toBeUndefined();
    expect(c.typeSemantics).toBe('current');
    expect(() => validateCriteria({propertyType:'senior_housing',typeSemantics:'proposed'},catalog)).toThrow(/exact/);
    expect(interpretText('Find parcels zoned for senior living in Broward',{},catalog).issues.join()).toMatch(/ambiguous/);
  });
  it('blocks conflicts and unsupported predicates instead of silently dropping them', () => {
    expect(interpretText('Find parcels over 3 acres in Broward',{counties:['Palm Beach']},catalog).issues.join()).toMatch(/conflicts/);
    expect(interpretText('Find parcels over 3 acres near a hospital for sale in Broward',{},catalog).issues.join()).toMatch(/Unsupported/);
    expect(interpretText('Find parcels zoned RU-1 in Miami-Dade',{},catalog).issues.join()).toMatch(/jurisdiction/);
    expect(() => validateCriteria({area:{min:5,max:3,unit:'acres',minInclusive:true,maxInclusive:true}},catalog)).toThrow(/conflict/);
    expect(() => validateCriteria({area:{min:5,unit:'acres',minInclusive:true,maxInclusive:true},sql:'DROP TABLE deals'},catalog)).toThrow();
    expect(() => validateCriteria({addressText:'A',counties:['Fulton']},catalog)).toThrow();
    expect(() => validateCriteria({addressText:'A',limit:100000},catalog)).toThrow();
  });
  it('compares exact unrounded source area at acre/square-foot boundaries', () => {
    const a = {min:3,unit:'acres' as const,minInclusive:false,maxInclusive:true};
    expect(areaMatches(130680,a)).toBe(false);
    expect(areaMatches(130680.000001,a)).toBe(true);
    expect(areaMatches(130679.999999,a)).toBe(false);
    expect(areaMatches(130680,{...a,minInclusive:true})).toBe(true);
    expect(areaMatches(130680,{min:130680,max:130680,unit:'sqft',minInclusive:true,maxInclusive:true})).toBe(true);
    expect(areaMatches(130680,{max:3,unit:'acres',minInclusive:true,maxInclusive:false})).toBe(false);
  });
  it('preserves decimal bounds and normalizes exact district codes', () => {
    expect(interpretText('Find parcels over 3.25 acres in Broward',{},catalog).criteria.area?.min).toBe(3.25);
    expect(normalizeCode(' ru – 1 ')).toBe('RU-1');
  });
});