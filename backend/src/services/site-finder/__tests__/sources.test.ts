import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { discoverCounty, officialJson, SOURCES } from '../sources';
import { fromEsri, overlapArea } from '../geometry';
vi.mock('axios',()=>({default:{get:vi.fn(),post:vi.fn()}}));
const parcelRing = [[-80,26],[-80,26.002],[-79.998,26.002],[-79.998,26],[-80,26]];
const fields = ['FOLIO','LOT_SIZE','TRUE_SITE_ADDR','DOR_CODE_CUR','DOR_DESC','OBJECTID'].map(name=>({name}));
const catalog = [{type_key:'warehouse_distribution',display_name:'Warehouse / Distribution',category:'Industrial'}];
describe('official source safeguards', () => {
  beforeEach(()=>vi.clearAllMocks());
  it('rejects arbitrary URLs before issuing network requests', async () => {
    await expect(officialJson('https://evil.test/query')).rejects.toThrow(/Unapproved/);
    expect(axios.get).not.toHaveBeenCalled();
  });
  it('uses bounded POST for long spatial geometry, with no redirects',async()=>{
    vi.mocked(axios.post).mockResolvedValue({data:{features:[]}});
    await officialJson(SOURCES.Broward.parcel+'/query',{geometry:'x'.repeat(10000)});
    expect(axios.post).toHaveBeenCalledWith(expect.any(String),expect.any(String),expect.objectContaining({maxRedirects:0,timeout:12000}));
  });
  it('uses stable source pagination, deduplicates identifiers, and reports limit', async () => {
    const offsets:number[]=[];
    vi.mocked(axios.get).mockImplementation(async (url:any,config:any)=>{
      if (url === SOURCES['Miami-Dade'].parcel) return {data:{fields,advancedQueryCapabilities:{supportsPagination:true,supportsOrderBy:true},editingInfo:{lastEditDate:1700000000000}}};
      if (url === SOURCES['Miami-Dade'].parcel+'/query') {
        offsets.push(config.params.resultOffset);
        const index=config.params.resultOffset;
        return {data:{features:[{attributes:{FOLIO:index===0?'001':'002',LOT_SIZE:130680.000001,TRUE_SITE_ADDR:'Real source',DOR_CODE_CUR:'4800',DOR_DESC:'WAREHOUSE',OBJECTID:index}}],exceededTransferLimit:index===0}};
      }
      throw new Error('Unexpected URL');
    });
    const found:any[]=[];
    const h = await discoverCounty('Miami-Dade',{counties:['Miami-Dade'],area:{min:3,unit:'acres',minInclusive:false,maxInclusive:true},limit:2},catalog,async p=>{found.push(...p);});
    expect(offsets).toEqual([0,1]); expect(found.map(p=>p.parcelId)).toEqual(['001','002']);
    expect(found[0].areaSqft).toBe(130680.000001);
    expect(h.limited).toBe(true); expect(h.status).toBe('partial');
  });
  it('source failures are explicit errors, not empty successful searches',async()=>{
    vi.mocked(axios.get).mockRejectedValue(new Error('county outage'));
    const h=await discoverCounty('Broward',{counties:['Broward'],area:{min:1,unit:'acres',minInclusive:true,maxInclusive:true},limit:1},catalog,async()=>{});
    expect(h.status).toBe('error');expect(h.messages.join()).toContain('county outage');
  });
  it('pushes exact district candidate envelopes, then verifies authority and full district coverage without requiring a use',async()=>{
    const s=SOURCES['Miami-Dade'];
    vi.mocked(axios.get).mockImplementation(async(url:any,config:any)=>{
      if(url===s.parcel) return {data:{fields,advancedQueryCapabilities:{supportsPagination:true,supportsOrderBy:true}}};
      if(url===s.municipality) return {data:{fields:[{name:'NAME'}]}};
      if(url===s.zones[0].url) return {data:{fields:[{name:'ZONE'},{name:'ZONE_DESC'}]}};
      if(url===s.municipality+'/query') return {data:{features:[]}};
      if(url===s.zones[0].url+'/query') return {data:{features:[{attributes:{ZONE:'IU-1',ZONE_DESC:'Industrial'},geometry:{rings:[parcelRing]}}]}};
      if(url===s.parcel+'/query') {
        expect(config.params.geometryType).toBe('esriGeometryEnvelope');
        expect(config.params.where).toBe('1=1');
        return {data:{features:[{attributes:{FOLIO:'district-hit',LOT_SIZE:130680,OBJECTID:1},geometry:{rings:[parcelRing]}}]}};
      }
      throw new Error('Unexpected official URL');
    });
    const found:any[]=[];
    await discoverCounty('Miami-Dade',{counties:['Miami-Dade'],zoning:{code:'IU-1',jurisdiction:'Unincorporated Miami-Dade'},limit:1},catalog,async p=>{found.push(...p)});
    expect(found).toHaveLength(1);
    expect(found[0].district).toBe('IU-1');expect(found[0].jurisdiction).toBe('Unincorporated Miami-Dade');
    expect(found[0].review.status).toBe('not-requested');
    expect(axios.get).toHaveBeenCalledWith(s.zones[0].url+'/query',expect.objectContaining({params:expect.objectContaining({where:"UPPER(ZONE)='IU-1'"})}));
  });
  it('retains multipart geometry and holes without invented joins',()=>{
    const hole = [[-79.9995,26.0005],[-79.999,26.0005],[-79.999,26.001],[-79.9995,26.001],[-79.9995,26.0005]];
    const island = parcelRing.map(([x,y])=>[x+0.01,y]);
    const g=fromEsri([parcelRing,hole,island]);
    expect(g.type).toBe('MultiPolygon');
    expect(g.coordinates).toHaveLength(2);
    expect(g.coordinates[0]).toHaveLength(2);
  });
  it('shared edges do not establish split zoning or another municipal authority',()=>{
    const adjacent=parcelRing.map(([x,y])=>[x+0.002,y]);
    expect(overlapArea(fromEsri([parcelRing]),fromEsri([adjacent]))).toBeLessThan(0.01);
    expect(overlapArea(fromEsri([parcelRing]),fromEsri([parcelRing]))).toBeGreaterThan(1000);
  });
});