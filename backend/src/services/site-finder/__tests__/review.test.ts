import { describe,it,expect,vi } from 'vitest';
import { reviewParcel, verifiedPermission } from '../review';
import type {SiteParcel,SiteReview} from '../../../types/site-finder';
vi.mock('axios',()=>({default:{get:vi.fn().mockRejectedValue(new Error('official code unavailable')),post:vi.fn()}}));
const review:SiteReview={status:'by-right',legalUse:'Warehouse',evidence:[],conditions:[],standards:[],limitations:[],checkedAt:'2026-10-05'};
const parcel:SiteParcel={key:'test',county:'Broward',parcelId:'folio',address:null,currentPropertyType:null,currentLandUse:null,areaSqft:150000,acres:150000/43560,jurisdiction:'PARKLAND',district:'RM-1',sourceUrl:'https://www.bcpa.net/',areaSourceUrl:'https://www.bcpa.net/',retrievedAt:'2026-10-05',warnings:[],review:{...review,status:'unverified',requestedUse:'assisted living'}};
describe('evidence-only zoning screening',()=>{
  it('does not authorize uses without legal terminology and evidence',()=>{
    expect(verifiedPermission({...review,limitations:[]}).status).toBe('unverified');
  });
  it('official zoning-map citations alone cannot authorize an exact named use',()=>{
    expect(verifiedPermission({...review,legalUse:'Warehouse',evidence:[{url:'https://maps.co.palm-beach.fl.us/arcgis/rest/services/OpenData/Planning_Open_Data/MapServer/9',section:'Official zoning-map intersection',excerpt:'IL',checkedAt:new Date().toISOString()}],limitations:[]}).status).toBe('unverified');
  });
  it('unsupported authorities and senior-care terms remain unknown, with no capacity defaults',async()=>{
    const r=await reviewParcel(parcel);
    expect(r.status).toBe('unverified');expect(r.standards).toEqual([]);expect(r.legalUse).toBeUndefined();
    expect(r.limitations.join()).toMatch(/verified local-code/);
  });
  it('district/area-only screening does not demand permission',async()=>{
    const r=await reviewParcel({...parcel,review:{...parcel.review,requestedUse:undefined}});
    expect(r.status).toBe('not-requested');
  });
  it('an official-code outage cannot become a use-permission match',async()=>{
    const r=await reviewParcel({...parcel,county:'Palm Beach',jurisdiction:'Unincorporated Palm Beach',district:'IL',review:{...parcel.review,requestedUse:'warehouse'}});
    expect(r.status).toBe('unverified');expect(r.limitations.join()).toMatch(/incomplete/);
  });
});