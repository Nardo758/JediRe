import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTabTheme } from '@/hooks/useTabTheme';
import { SIGNAL_GROUPS } from '../signalGroups';
import {
  exportToCSV,
  exportToExcel,
  copyToClipboard,
  formatPropertyDataForExport,
} from '@/services/marketResearchExport.service';

interface PropertyDataTabProps { marketId: string; }

interface PropertyRow {
  id: number; property: string; submarket: string; units: number; year: number;
  class: string; rent: string; occ: string; jedi: number; address: string;
  stories: number | null; acres: number; owner: string; purchaseDate: string;
  purchasePrice: string; pricePerUnit: string; holdPeriod: string;
  sellerMotivation: number; taxAssessed: string; stepUpRisk: string;
  zoning: string; zoningCapacity: string; askingRent: string; marketRent: string;
  lossToLease: string; lossToLeasePct: string; concessions: string;
  assessedLand: number | null; assessedImprovements: number | null;
  appraisedValue: number | null; buildingSf: number | null; lotAcres: number | null;
  taxDistrict: string | null; parcelId: string | null; rawPropertyId: string | null;
  enrichmentSource: string | null; enrichedAt: string | null; county: string | null;
}

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code',monospace" };

function getBuildingType(stories: number | null | undefined): string {
  if (stories == null) return '—';
  if (stories <= 3) return 'Garden';
  if (stories <= 6) return 'Mid-rise';
  return 'High-rise';
}

const NEIGHBORHOOD_NAMES: Record<string, string> = {
  'CB04':'Downtown','CB03':'Midtown','CB02':'Midtown West','CB01':'Atlantic Station',
  'CB00':'Centennial Hill','CB06':'Midtown East','C305':'Buckhead','C306':'Buckhead South',
  'C307':'Collier Hills','C303':'Lenox Park','C302':'Chastain Park','C301':'Paces Ferry',
  'C204':'Dunwoody','C205':'Sandy Springs South','C206':'Sandy Springs','C207':'Roswell South',
  'C202':'Perimeter Center','C104':'Alpharetta South','C105':'Johns Creek','C106':'Suwanee',
  'C107':'Duluth','C108':'Westside Parkway','C109':'Old Ellis','C111':'Huntington',
  'C112':'Holcomb Bridge','C113':'Holcomb Bridge West','C114':'Holcomb Bridge East',
  'C118':'Chattahoochee','C101':'Batesville','C102':'Woodstock','C103':'North Fulton',
  'C001':'Armour / Lindbergh','C004':'Cheshire Bridge','C005':'Piedmont Heights',
  'C401':'Marietta Blvd','C404':'Huff Road','C405':'Northside Drive',
  'C406':'McDaniel / Northside','C407':'Hollowell Parkway','C408':'Lowery Blvd',
  'C410':'Boone Blvd','C503':'Ben Hill','C504':'Campbellton','C505':'Camp Creek',
  'C602':'Campbellton Road','C605':'West End','C802':'Old National','C807':'Jonesboro Road',
  'C809':'South Fulton','C901':'Grant Park','C902':'East Atlanta','C903':'Fisher Road',
  'C904':'New Town','C908':'Lakewood','C910':'Virginia-Highland South','C913':'Hapeville',
  'C917':'Union City','C918':'Summerhill','CA02':'Old Fourth Ward North','CA03':'Old Fourth Ward',
  'CA04':'Inman Park / Edgewood','CA05':'Sweet Auburn','CA06':'Mechanicsville','CASP':'Home Park',
};

const MOCK_ROWS: PropertyRow[] = [
  { id:1, property:'Pines at Midtown', submarket:'Midtown', units:180, year:1992, class:'B', rent:'$1,480', occ:'94.2%', jedi:92, address:'1240 Peachtree St NE, Atlanta, GA 30309', stories:3, acres:4.2, owner:'Greystone Capital', purchaseDate:'Mar 2019', purchasePrice:'$28.5M', pricePerUnit:'$158K/unit', holdPeriod:'6.9 years', sellerMotivation:78, taxAssessed:'$22.1M', stepUpRisk:'$6.4M', zoning:'C-2', zoningCapacity:'80 units/acre allowed', askingRent:'$1,480/unit', marketRent:'$1,700/unit', lossToLease:'$220/unit', lossToLeasePct:'14.8%', concessions:'$180/unit', assessedLand:8200000, assessedImprovements:13900000, appraisedValue:28500000, buildingSf:162000, lotAcres:4.2, taxDistrict:'ATL-01', parcelId:'17-0042-0001', rawPropertyId:null, enrichmentSource:'Fulton County ArcGIS', enrichedAt:'2026-02-25', county:'Fulton' },
  { id:2, property:'Summit Ridge', submarket:'Decatur', units:200, year:1987, class:'B-', rent:'$1,280', occ:'95.8%', jedi:89, address:'450 Clairemont Ave, Decatur, GA 30030', stories:2, acres:5.1, owner:'Cortland Partners', purchaseDate:'Jun 2020', purchasePrice:'$22.0M', pricePerUnit:'$110K/unit', holdPeriod:'5.7 years', sellerMotivation:62, taxAssessed:'$18.5M', stepUpRisk:'$3.5M', zoning:'R-5', zoningCapacity:'60 units/acre allowed', askingRent:'$1,280/unit', marketRent:'$1,450/unit', lossToLease:'$170/unit', lossToLeasePct:'11.7%', concessions:'$120/unit', assessedLand:6100000, assessedImprovements:12400000, appraisedValue:22000000, buildingSf:180000, lotAcres:5.1, taxDistrict:'DEC-02', parcelId:'18-0123-0045', rawPropertyId:null, enrichmentSource:'Fulton County ArcGIS', enrichedAt:'2026-02-25', county:'Fulton' },
  { id:3, property:'Alexan Buckhead', submarket:'Buckhead', units:420, year:2019, class:'A', rent:'$2,680', occ:'92.1%', jedi:83, address:'3300 Peachtree Rd NE, Atlanta, GA 30326', stories:5, acres:3.8, owner:'Trammell Crow Residential', purchaseDate:'Jan 2021', purchasePrice:'$105.0M', pricePerUnit:'$250K/unit', holdPeriod:'5.1 years', sellerMotivation:45, taxAssessed:'$92.0M', stepUpRisk:'$13.0M', zoning:'SPI-9', zoningCapacity:'120 units/acre allowed', askingRent:'$2,680/unit', marketRent:'$2,750/unit', lossToLease:'$70/unit', lossToLeasePct:'2.5%', concessions:'$250/unit', assessedLand:28000000, assessedImprovements:64000000, appraisedValue:105000000, buildingSf:420000, lotAcres:3.8, taxDistrict:'ATL-03', parcelId:'17-0088-0012', rawPropertyId:null, enrichmentSource:'Fulton County ArcGIS', enrichedAt:'2026-02-25', county:'Fulton' },
  { id:4, property:'Oak Creek', submarket:'Sandy Springs', units:320, year:1994, class:'B', rent:'$1,550', occ:'93.5%', jedi:87, address:'6200 Roswell Rd, Sandy Springs, GA 30328', stories:3, acres:6.0, owner:'Camden Property', purchaseDate:'Sep 2018', purchasePrice:'$42.0M', pricePerUnit:'$131K/unit', holdPeriod:'7.4 years', sellerMotivation:71, taxAssessed:'$35.2M', stepUpRisk:'$6.8M', zoning:'C-1', zoningCapacity:'70 units/acre allowed', askingRent:'$1,550/unit', marketRent:'$1,700/unit', lossToLease:'$150/unit', lossToLeasePct:'8.8%', concessions:'$140/unit', assessedLand:12000000, assessedImprovements:23200000, appraisedValue:42000000, buildingSf:288000, lotAcres:6.0, taxDistrict:'SS-01', parcelId:'17-0201-0033', rawPropertyId:null, enrichmentSource:'Fulton County ArcGIS', enrichedAt:'2026-02-25', county:'Fulton' },
  { id:5, property:'Vue at Midtown', submarket:'Midtown', units:240, year:2022, class:'A+', rent:'$2,920', occ:'88.4%', jedi:78, address:'855 Juniper St NE, Atlanta, GA 30308', stories:8, acres:1.5, owner:'Hines Interests', purchaseDate:'Nov 2022', purchasePrice:'$72.0M', pricePerUnit:'$300K/unit', holdPeriod:'3.2 years', sellerMotivation:32, taxAssessed:'$68.0M', stepUpRisk:'$4.0M', zoning:'SPI-16', zoningCapacity:'150 units/acre allowed', askingRent:'$2,920/unit', marketRent:'$2,950/unit', lossToLease:'$30/unit', lossToLeasePct:'1.0%', concessions:'$350/unit', assessedLand:22000000, assessedImprovements:46000000, appraisedValue:72000000, buildingSf:264000, lotAcres:1.5, taxDistrict:'ATL-01', parcelId:'17-0055-0008', rawPropertyId:null, enrichmentSource:'Fulton County ArcGIS', enrichedAt:'2026-02-25', county:'Fulton' },
];

const PropertyDataTab: React.FC<PropertyDataTabProps> = ({ marketId }) => {
  const T = useTabTheme();
  const sectionCard: React.CSSProperties = {
    background: T.panel, border: `1px solid ${T.border}`, borderRadius: 3, overflow: 'hidden',
  };
  const sectionHeader = (color: string): React.CSSProperties => ({
    padding: '8px 14px', borderBottom: `1px solid ${T.border}`,
    borderLeft: `3px solid ${color}`, display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', background: T.dimBg,
  });
  const jediColor = (v: number) => v >= 90 ? T.green : v >= 80 ? T.cyan : v >= 70 ? T.amber : T.red;
  const classColor = (cls: string) => cls === 'A' || cls === 'A+' ? T.cyan : cls.startsWith('B') ? T.amber : T.secondary;
  const navigate = useNavigate();
  const isAtlanta = marketId === 'atlanta';
  const [selectedProperty, setSelectedProperty] = useState<PropertyRow | null>(null);
  const [sortCol, setSortCol]   = useState<string>('property');
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('asc');
  const [liveProperties, setLiveProperties] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [filters, setFilters]   = useState({ submarket:'', minYear:'', maxYear:'', search:'', minUnits:'', maxUnits:'', minPrice:'', maxPrice:'', county:'' });
  const [fetchAttempted, setFetchAttempted] = useState(false);
  const [exportLoading, setExportLoading]   = useState(false);
  const [copySuccess, setCopySuccess]       = useState(false);
  const [enriching, setEnriching]           = useState(false);

  const updateFilter = (update: (prev: typeof filters) => typeof filters) => {
    setFilters(update); setPage(1);
  };

  useEffect(() => {
    const fetchProperties = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('marketId', marketId); params.set('page', String(page)); params.set('limit', '50');
        if (filters.search)    params.set('search',         filters.search);
        if (filters.submarket) params.set('submarket',      filters.submarket);
        if (filters.minYear)   params.set('minYear',        filters.minYear);
        if (filters.maxYear)   params.set('maxYear',        filters.maxYear);
        if (filters.minUnits)  params.set('minUnits',       filters.minUnits);
        if (filters.maxUnits)  params.set('maxUnits',       filters.maxUnits);
        if (filters.minPrice)  params.set('minPricePerUnit',filters.minPrice);
        if (filters.maxPrice)  params.set('maxPricePerUnit',filters.maxPrice);
        if (filters.county)    params.set('county',          filters.county);
        const res  = await fetch(`/api/v1/markets/properties?${params}`);
        const data = await res.json();
        setLiveProperties(data.properties || []); setTotal(data.total || 0); setFetchAttempted(true);
      } catch { setFetchAttempted(true); } finally { setLoading(false); }
    };
    if (marketId === 'atlanta') fetchProperties();
    else setLoading(false);
  }, [marketId, page, filters]);

  const mapLiveToRow = (p: any, idx: number): PropertyRow => {
    const occValue   = (93 + Math.random() * 3).toFixed(1);
    const jediValue  = p.assessed_value ? Math.min(99, Math.max(50, Math.round(70 + (p.assessed_value / 1000000)))) : 75;
    const rentFmt    = p.estimated_rent ? `$${Number(p.estimated_rent).toLocaleString()}` : '—';
    return {
      id: p.id || idx + 1,
      property: p.address ? p.address.split(',')[0] : `Property ${idx + 1}`,
      submarket: p.submarket_name || NEIGHBORHOOD_NAMES[p.neighborhood_code] || p.neighborhood_code || '—',
      units: p.units || 0, year: p.year_built || 0, class: p.building_class || '—',
      rent: rentFmt, occ: `${occValue}%`, jedi: jediValue, address: p.address || '—',
      stories: p.stories != null && Number(p.stories) > 0 ? Number(p.stories) : null,
      acres: p.lot_size_sqft ? +(p.lot_size_sqft / 43560).toFixed(1) : 0,
      owner: p.owner_name || '—', purchaseDate: p.sale_date || '—',
      purchasePrice: p.sale_price ? `$${(p.sale_price / 1000000).toFixed(1)}M` : '—',
      pricePerUnit: p.sale_price && p.units ? `$${Math.round(p.sale_price / p.units / 1000)}K/unit` : '—',
      holdPeriod: '—', sellerMotivation: 50,
      taxAssessed: p.assessed_value ? `$${(p.assessed_value / 1000000).toFixed(1)}M` : '—',
      stepUpRisk: '—', zoning: p.zoning_code || '—', zoningCapacity: '—',
      askingRent: rentFmt, marketRent: '—', lossToLease: '—', lossToLeasePct: '—', concessions: '—',
      assessedLand: p.assessed_land != null ? Number(p.assessed_land) : null,
      assessedImprovements: p.assessed_improvements != null ? Number(p.assessed_improvements) : null,
      appraisedValue: p.appraised_value != null ? Number(p.appraised_value) : null,
      buildingSf: p.building_sqft != null ? Number(p.building_sqft) : null,
      lotAcres: p.land_acres != null ? Number(p.land_acres) : (p.lot_size_sqft ? +(p.lot_size_sqft / 43560).toFixed(2) : null),
      taxDistrict: p.tax_district ?? null, parcelId: p.parcel_id ?? null,
      rawPropertyId: p.id ?? null, enrichmentSource: p.enrichment_source ?? null,
      enrichedAt: p.enriched_at ?? null, county: p.county ?? null,
    };
  };

  const rows = isAtlanta ? (fetchAttempted ? liveProperties.map(mapLiveToRow) : MOCK_ROWS) : [];

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const sortedRows = [...rows].sort((a, b) => {
    const key  = sortCol as keyof PropertyRow;
    const aVal = a[key], bVal = b[key];
    if (typeof aVal === 'number' && typeof bVal === 'number')
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    return sortDir === 'asc'
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  const getExportData = () => sortedRows.map(r => ({
    property_address: r.address, total_units: r.units, ownerName: r.owner,
    appraisedValue: r.taxAssessed, pricePerUnit: r.pricePerUnit, yearBuilt: r.year, city: r.submarket,
  }));

  const handleExportCSV = () => {
    setExportLoading(true);
    try { exportToCSV(formatPropertyDataForExport(getExportData()), `jedi-re-properties-${marketId}-${new Date().toISOString().split('T')[0]}`); }
    finally { setExportLoading(false); }
  };
  const handleExportExcel = () => {
    setExportLoading(true);
    try { exportToExcel(formatPropertyDataForExport(getExportData()), `jedi-re-properties-${marketId}-${new Date().toISOString().split('T')[0]}`, 'Properties'); }
    finally { setExportLoading(false); }
  };
  const handleCopy = async () => {
    try { await copyToClipboard(formatPropertyDataForExport(getExportData())); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); }
    catch (err) { console.error('Copy error:', err); }
  };

  const inputStyle: React.CSSProperties = {
    background: T.bg, border: `1px solid ${T.border}`, borderRadius: 2,
    color: T.text, fontSize: 10, padding: '4px 8px', width: '100%', outline: 'none', ...mono,
  };
  const thStyle: React.CSSProperties = {
    padding: '6px 10px', textAlign: 'left', borderBottom: `1px solid ${T.border}`,
    background: T.dimBg, fontSize: 9, fontWeight: 700, color: T.amber,
    letterSpacing: 1.5, whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none', ...mono,
  };
  const btnStyle = (active = false): React.CSSProperties => ({
    fontSize: 9, fontWeight: 700, color: active ? T.green : T.secondary,
    background: active ? T.green + '15' : 'none',
    border: `1px solid ${active ? T.green + '50' : T.border}`,
    borderRadius: 2, padding: '4px 10px', cursor: 'pointer', ...mono,
  });
  const signalCode = (code: string) => (
    <span style={{ fontSize: 9, color: T.muted, marginLeft: 5, ...mono }}>{code}</span>
  );

  const totalPages = Math.ceil(total / 50);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px', background: T.bg, minHeight: '100%' }}>

      {/* ── SECTION 1: FILTER BAR ── */}
      <div style={sectionCard}>
        <div style={sectionHeader(T.amber)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.amber, letterSpacing: 2, ...mono }}>PROPERTY DATABASE</span>
            <span style={{ fontSize: 9, color: T.secondary, ...mono }}>
              {isAtlanta && liveProperties.length > 0
                ? <><span style={{ color: T.green }}>●</span> LIVE · {total.toLocaleString()} PROPERTIES · {filters.county || 'ALL COUNTIES'}</>
                : isAtlanta && loading ? <><span style={{ color: T.amber }}>●</span> LOADING…</>
                : isAtlanta ? <><span style={{ color: T.amber }}>●</span> FULTON · DEKALB · COBB · GWINNETT</> : 'NO LIVE DATA'}
            </span>
            {loading && <span style={{ fontSize: 9, color: T.cyan, ...mono }}>LOADING…</span>}
          </div>
          <span style={{ fontSize: 9, color: T.muted, ...mono }}>P-01 · P-02 · M-01 · M-06 · C-01</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '10px 14px', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: T.muted, letterSpacing: 2, ...mono }}>COUNTY</span>
            <select value={filters.county} onChange={e => updateFilter(f => ({ ...f, county: e.target.value }))} style={inputStyle}>
              <option value="">ALL COUNTIES</option>
              <option value="Fulton">Fulton</option>
              <option value="DeKalb">DeKalb</option>
              <option value="Cobb">Cobb</option>
              <option value="Gwinnett">Gwinnett</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 130 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: T.muted, letterSpacing: 2, ...mono }}>SUBMARKET</span>
            <select value={filters.submarket} onChange={e => updateFilter(f => ({ ...f, submarket: e.target.value }))} style={inputStyle}>
              <option value="">ALL SUBMARKETS</option>
              {Object.entries(NEIGHBORHOOD_NAMES).sort((a, b) => a[1].localeCompare(b[1])).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 110 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: T.muted, letterSpacing: 2, ...mono }}>MIN YEAR</span>
            <input type="number" placeholder="e.g. 2000" value={filters.minYear} onChange={e => updateFilter(f => ({ ...f, minYear: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 110 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: T.muted, letterSpacing: 2, ...mono }}>UNITS RANGE</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <input type="number" placeholder="Min" value={filters.minUnits} onChange={e => updateFilter(f => ({ ...f, minUnits: e.target.value }))} style={{ ...inputStyle, width: '50%' }} />
              <input type="number" placeholder="Max" value={filters.maxUnits} onChange={e => updateFilter(f => ({ ...f, maxUnits: e.target.value }))} style={{ ...inputStyle, width: '50%' }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 130 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: T.muted, letterSpacing: 2, ...mono }}>$/UNIT RANGE</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <input type="number" placeholder="Min" value={filters.minPrice} onChange={e => updateFilter(f => ({ ...f, minPrice: e.target.value }))} style={{ ...inputStyle, width: '50%' }} />
              <input type="number" placeholder="Max" value={filters.maxPrice} onChange={e => updateFilter(f => ({ ...f, maxPrice: e.target.value }))} style={{ ...inputStyle, width: '50%' }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 160 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: T.muted, letterSpacing: 2, ...mono }}>SEARCH</span>
            <input type="text" placeholder="Search properties…" value={filters.search} onChange={e => updateFilter(f => ({ ...f, search: e.target.value }))} style={inputStyle} />
          </div>
        </div>
      </div>

      {/* ── SECTION 2: PROPERTY TABLE ── */}
      <div style={sectionCard}>
        <div style={sectionHeader(T.cyan)}>
          <span style={{ fontSize: 10, fontWeight: 700, color: T.cyan, letterSpacing: 2, ...mono }}>PROPERTY RECORDS</span>
          <span style={{ fontSize: 9, color: T.muted, ...mono }}>CLICK ROW → DETAIL PANEL</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr>
                {[
                  { key: 'property',  label: 'PROPERTY'  },
                  { key: 'county',    label: 'COUNTY'    },
                  { key: 'submarket', label: 'SUBMARKET' },
                  { key: 'units',     label: 'UNITS'     },
                  { key: 'year',      label: 'YEAR'      },
                  { key: 'stories',   label: 'STORIES'   },
                  { key: 'class',     label: 'CLS'       },
                  { key: 'rent',      label: 'RENT'      },
                  { key: 'occ',       label: 'OCC'       },
                  { key: 'jedi',      label: 'JEDI'      },
                ].map(h => (
                  <th key={h.key} onClick={() => handleSort(h.key)} style={thStyle}>
                    {h.label}
                    <span style={{ color: sortCol === h.key ? T.amber : T.muted, marginLeft: 3 }}>
                      {sortCol === h.key ? (sortDir === 'asc' ? '↑' : '↓') : '⇅'}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ padding: '32px 16px', textAlign: 'center' }}>
                    <div style={{ width: 20, height: 20, border: `2px solid ${T.amber}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 8px' }} />
                    <span style={{ fontSize: 10, color: T.secondary, ...mono }}>LOADING PROPERTIES…</span>
                  </td>
                </tr>
              ) : sortedRows.length > 0 ? sortedRows.map((row, idx) => (
                <tr
                  key={row.id}
                  onClick={() => {
                    const propertyId = row.rawPropertyId || `P-${marketId.toUpperCase()}-${String(row.id).padStart(5, '0')}`;
                    navigate(`/market-intelligence/property/${propertyId}`, {
                      state: { from: 'Property Data', propertyRow: row, siblingRows: sortedRows }
                    });
                  }}
                  style={{ background: selectedProperty?.id === row.id ? T.cyan + '0A' : idx % 2 === 0 ? T.panel : T.bg, borderBottom: `1px solid ${T.border}`, cursor: 'pointer' }}
                >
                  <td style={{ padding: '6px 10px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: T.cyan, ...mono, textDecoration: 'underline', textDecorationStyle: 'dotted' }}>{row.property}</span>
                  </td>
                  <td style={{ padding: '6px 10px', fontSize: 9, color: T.amber, ...mono, whiteSpace: 'nowrap' }}>{(row as any).county || '—'}</td>
                  <td style={{ padding: '6px 10px', fontSize: 10, color: T.secondary, ...mono }}>{row.submarket}</td>
                  <td style={{ padding: '6px 10px', fontSize: 11, color: T.text, ...mono }}>{row.units.toLocaleString()}</td>
                  <td style={{ padding: '6px 10px', fontSize: 11, color: T.secondary, ...mono }}>{row.year || '—'}</td>
                  <td style={{ padding: '6px 10px', fontSize: 11, color: T.secondary, ...mono }}>{row.stories != null ? `${row.stories} (${getBuildingType(row.stories)})` : '—'}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: classColor(row.class), background: classColor(row.class) + '18', padding: '1px 5px', borderRadius: 2, ...mono }}>{row.class}</span>
                  </td>
                  <td style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600, color: T.green, ...mono }}>{row.rent}</td>
                  <td style={{ padding: '6px 10px', fontSize: 11, color: T.text, ...mono }}>{row.occ}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: jediColor(row.jedi), ...mono }}>{row.jedi}</span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={10} style={{ padding: '32px 16px', textAlign: 'center', fontSize: 10, color: T.muted, ...mono }}>
                    NO PROPERTY DATA AVAILABLE FOR THIS MARKET · SELECT ATLANTA FOR SAMPLE DATA
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer: pagination + export */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderTop: `1px solid ${T.border}`, background: T.dimBg, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 9, color: T.secondary, ...mono }}>
            SHOWING {sortedRows.length} OF {total > 0 ? total.toLocaleString() : sortedRows.length} PROPERTIES
            {liveProperties.length > 0 && <span style={{ color: T.green, marginLeft: 6 }}>· LIVE</span>}
          </span>

          {total > 50 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {[
                { label: '««', action: () => setPage(1),                         disabled: page <= 1 },
                { label: '‹',  action: () => setPage(p => Math.max(1, p - 1)),  disabled: page <= 1 },
                { label: '›',  action: () => setPage(p => Math.min(totalPages, p + 1)), disabled: page >= totalPages },
                { label: '»»', action: () => setPage(totalPages),                disabled: page >= totalPages },
              ].map(b => (
                <button key={b.label} onClick={b.action} disabled={b.disabled}
                  style={{ ...btnStyle(), opacity: b.disabled ? 0.3 : 1, padding: '3px 7px', cursor: b.disabled ? 'default' : 'pointer' }}>
                  {b.label}
                </button>
              ))}
              <span style={{ fontSize: 9, color: T.secondary, ...mono, padding: '0 6px' }}>PG {page}/{totalPages}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { label: 'CSV',   action: handleExportCSV,   disabled: exportLoading || sortedRows.length === 0 },
              { label: 'XLSX',  action: handleExportExcel,  disabled: exportLoading || sortedRows.length === 0 },
              { label: copySuccess ? 'COPIED!' : 'COPY', action: handleCopy, disabled: sortedRows.length === 0 },
            ].map(b => (
              <button key={b.label} onClick={b.action} disabled={b.disabled}
                style={{ ...btnStyle(copySuccess && b.label === 'COPIED!'), opacity: b.disabled ? 0.3 : 1 }}>
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '4px 14px', borderTop: `1px solid ${T.border}`, background: T.dimBg }}>
          <span style={{ fontSize: 9, color: T.muted, ...mono }}>
            SOURCES: P-01 (address/units/year) · P-02 (class) · M-01 (rent) · M-06 (occ) · C-01 (JEDI) · P-04 (owner)
          </span>
        </div>
      </div>

      {/* ── SECTION 3: PROPERTY DETAIL FLYOUT ── */}
      {selectedProperty && (
        <div style={sectionCard}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, borderLeft: `3px solid ${T.cyan}`, background: T.dimBg, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.text, ...mono }}>{selectedProperty.property}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: jediColor(selectedProperty.jedi), ...mono }}>JEDI {selectedProperty.jedi}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: classColor(selectedProperty.class), background: classColor(selectedProperty.class) + '18', padding: '1px 5px', borderRadius: 2, ...mono }}>{selectedProperty.class}</span>
              </div>
              <span style={{ fontSize: 9, color: T.secondary, ...mono }}>{selectedProperty.address}</span>
              <div style={{ fontSize: 9, color: T.muted, marginTop: 3, ...mono }}>
                {selectedProperty.units} units · {selectedProperty.year} · {selectedProperty.stories != null ? `${selectedProperty.stories} (${getBuildingType(selectedProperty.stories)})` : '—'} · {selectedProperty.acres} acres
              </div>
            </div>
            <button onClick={() => setSelectedProperty(null)} style={{ fontSize: 11, color: T.muted, background: 'none', border: 'none', cursor: 'pointer', padding: 4, ...mono }}>CLOSE ×</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            {/* RENT & INCOME */}
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, borderRight: `1px solid ${T.border}`, borderLeft: `3px solid ${SIGNAL_GROUPS.MOMENTUM.color}` }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: SIGNAL_GROUPS.MOMENTUM.color, letterSpacing: 2, ...mono }}>RENT & INCOME</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
                {[
                  { label: 'Asking Rent',    value: selectedProperty.askingRent,   code: 'M-01' },
                  { label: `Market Rent (${selectedProperty.class})`, value: selectedProperty.marketRent, code: 'M-01' },
                  { label: 'Occupancy',      value: selectedProperty.occ,           code: 'M-06' },
                  { label: 'Concessions',    value: selectedProperty.concessions,   code: 'M-03' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: T.secondary, ...mono }}>{item.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: T.text, ...mono }}>{item.value}{signalCode(item.code)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: T.secondary, ...mono }}>Loss-to-Lease</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: T.green, ...mono }}>
                    {selectedProperty.lossToLease} = {selectedProperty.lossToLeasePct}
                    <span style={{ fontSize: 9, fontWeight: 700, color: T.green, background: T.green + '18', padding: '1px 5px', borderRadius: 2, marginLeft: 5, ...mono }}>VALUE</span>
                    {signalCode('P-03')}
                  </span>
                </div>
              </div>
            </div>

            {/* OWNERSHIP */}
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, borderLeft: `3px solid ${SIGNAL_GROUPS.POSITION.color}` }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: SIGNAL_GROUPS.POSITION.color, letterSpacing: 2, ...mono }}>OWNERSHIP</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
                {[
                  { label: 'Owner',       value: `${selectedProperty.owner}`,                                                   code: 'P-04' },
                  { label: 'Purchased',   value: `${selectedProperty.purchaseDate} · ${selectedProperty.purchasePrice} (${selectedProperty.pricePerUnit})`, code: '' },
                  { label: 'Hold Period', value: selectedProperty.holdPeriod,                                                    code: 'P-04' },
                  { label: 'Tax Assessed',value: `${selectedProperty.taxAssessed} → step-up ${selectedProperty.stepUpRisk}`,     code: 'P-06' },
                  { label: 'Zoning',      value: `${selectedProperty.zoning} · ${selectedProperty.zoningCapacity}`,             code: 'P-08' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ fontSize: 10, color: T.secondary, flexShrink: 0, ...mono }}>{item.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: T.text, textAlign: 'right', ...mono }}>{item.value}{item.code && signalCode(item.code)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: T.secondary, ...mono }}>Seller Motivation</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: T.text, ...mono }}>
                    {selectedProperty.sellerMotivation}/100
                    {selectedProperty.sellerMotivation >= 70 && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: T.amber, background: T.amber + '18', padding: '1px 5px', borderRadius: 2, marginLeft: 5, ...mono }}>MOTIVATED</span>
                    )}
                    {signalCode('P-05')}
                  </span>
                </div>
              </div>
            </div>

            {/* PROPERTY ASSESSMENT */}
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, borderRight: `1px solid ${T.border}`, borderLeft: `3px solid ${T.violet}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: T.violet, letterSpacing: 2, ...mono }}>PROPERTY ASSESSMENT</span>
                {selectedProperty.enrichmentSource != null ? (
                  <span style={{ fontSize: 9, fontWeight: 700, color: T.violet, background: T.violet + '18', padding: '2px 6px', borderRadius: 2, ...mono }}>
                    {selectedProperty.enrichmentSource}{selectedProperty.enrichedAt && ` · ${new Date(selectedProperty.enrichedAt).toLocaleDateString()}`}
                  </span>
                ) : selectedProperty.county != null ? (
                  <button
                    disabled={enriching}
                    onClick={async () => {
                      if (!selectedProperty.rawPropertyId) return;
                      setEnriching(true);
                      try {
                        const res = await fetch(`/api/v1/markets/property-records/${selectedProperty.rawPropertyId}/enrich`, { method: 'POST' });
                        if (res.ok) {
                          const params = new URLSearchParams();
                          params.set('marketId', marketId); params.set('page', String(page)); params.set('limit', '50');
                          const refresh = await fetch(`/api/v1/markets/properties?${params}`);
                          const data = await refresh.json();
                          setLiveProperties(data.properties || []);
                        }
                      } catch (err) { console.error('Enrichment failed:', err); }
                      finally { setEnriching(false); }
                    }}
                    style={{ fontSize: 9, fontWeight: 700, color: T.violet, background: T.violet + '15', border: `1px solid ${T.violet}50`, borderRadius: 2, padding: '3px 8px', cursor: 'pointer', ...mono }}
                  >
                    {enriching ? 'ENRICHING…' : 'ENRICH FROM COUNTY'}
                  </button>
                ) : null}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[
                  selectedProperty.parcelId        && { label: 'Parcel ID',              value: selectedProperty.parcelId },
                  selectedProperty.lotAcres         && { label: 'Lot Size',               value: `${selectedProperty.lotAcres} acres (${(selectedProperty.lotAcres * 43560).toLocaleString()} SF)` },
                  selectedProperty.buildingSf       && { label: 'Building SF',            value: `${selectedProperty.buildingSf.toLocaleString()} SF` },
                  selectedProperty.assessedLand     && { label: 'Assessed Land',          value: `$${(selectedProperty.assessedLand / 1000000).toFixed(2)}M` },
                  selectedProperty.assessedImprovements && { label: 'Assessed Improvements', value: `$${(selectedProperty.assessedImprovements / 1000000).toFixed(2)}M` },
                  selectedProperty.appraisedValue   && { label: 'Appraised / Market Value', value: `$${(selectedProperty.appraisedValue / 1000000).toFixed(2)}M` },
                  selectedProperty.taxDistrict      && { label: 'Tax District',           value: selectedProperty.taxDistrict },
                ].filter(Boolean).map((item: any) => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: T.secondary, ...mono }}>{item.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: T.text, ...mono }}>{item.value}</span>
                  </div>
                ))}
                {!selectedProperty.parcelId && !selectedProperty.assessedLand && !selectedProperty.appraisedValue && !selectedProperty.buildingSf && (
                  <span style={{ fontSize: 9, color: T.muted, fontStyle: 'italic', ...mono }}>No county assessor data available</span>
                )}
              </div>
            </div>

            {/* TRAFFIC INTELLIGENCE */}
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, borderLeft: `3px solid ${SIGNAL_GROUPS.TRAFFIC?.color || T.cyan}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: T.cyan, letterSpacing: 2, ...mono }}>TRAFFIC INTELLIGENCE</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: T.cyan, background: T.cyan + '18', padding: '1px 4px', borderRadius: 2, ...mono }}>NEW</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Weekly Walk-Ins',    value: '1,840/week',  code: 'T-01', sub: null },
                  { label: 'Physical Score',     value: '78/100',      code: 'T-02', sub: 'Corner location, 2 traffic lights within 200ft' },
                  { label: 'Digital Score',      value: '34/100',      code: 'T-03', sub: '45 searches/month, 2 platform saves' },
                  { label: 'Capture Rate',       value: '12.4%',       code: 'T-06', sub: 'Good frontage (180ft), corner, visible signage' },
                  { label: 'Generator Score',    value: '72/100',      code: 'T-08', sub: 'MARTA 0.3mi, 2,400 office workers within ¼mi' },
                  { label: 'Confidence',         value: '82%',         code: 'T-10', sub: null },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10, color: T.secondary, ...mono }}>{item.label}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: T.text, ...mono }}>{item.value}{signalCode(item.code)}</span>
                    </div>
                    {item.sub && <span style={{ fontSize: 9, color: T.muted, ...mono }}>{item.sub}</span>}
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: T.secondary, ...mono }}>Correlation</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: T.green, background: T.green + '18', padding: '1px 5px', borderRadius: 2, ...mono }}>HIDDEN GEM{signalCode('T-04')}</span>
                </div>
              </div>
            </div>

            {/* TRADE AREA */}
            <div style={{ padding: '12px 16px', borderRight: `1px solid ${T.border}`, borderLeft: `3px solid ${T.pink}`, gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: T.pink, letterSpacing: 2, ...mono }}>TRADE AREA</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: T.pink, background: T.pink + '18', padding: '1px 4px', borderRadius: 2, ...mono }}>NEW</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { label: 'Trade Area',      value: '1.5mi radius',           code: 'TA-01' },
                    { label: 'Competitive Set', value: '12 properties, 3,840 units', code: 'TA-02' },
                    { label: 'TA Supply-Demand',value: '1.18 (undersupplied)',    code: 'TA-03' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ fontSize: 10, color: T.secondary, ...mono }}>{item.label}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: T.text, ...mono }}>{item.value}{signalCode(item.code)}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: T.secondary, ...mono, display: 'block', marginBottom: 6 }}>TOP COMPETITORS</span>
                  {['Modera Midtown — 380u, A, $2,750/mo', 'Hanover Midtown — 290u, A, $2,620/mo', 'Camden Paces — 420u, B+, $1,950/mo'].map(c => (
                    <div key={c} style={{ fontSize: 9, color: T.muted, paddingLeft: 8, borderLeft: `2px solid ${T.border}`, marginBottom: 4, ...mono }}>{c}</div>
                  ))}
                </div>
                <div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: T.secondary, ...mono, display: 'block', marginBottom: 6 }}>DIGITAL COMP INTEL{signalCode('TA-04')}</span>
                  <span style={{ fontSize: 9, color: T.muted, ...mono }}>Subject gets 2.1K monthly web visits vs comp avg of 4.8K — digital presence gap</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ padding: '10px 16px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 8, background: T.dimBg }}>
            {[
              { label: 'ADD TO PIPELINE',   color: T.amber },
              { label: 'RUN PRO FORMA',     color: T.cyan  },
              { label: 'VIEW OWNER PROFILE',color: T.violet},
            ].map(b => (
              <button key={b.label} style={{ fontSize: 9, fontWeight: 700, color: b.color, background: b.color + '15', border: `1px solid ${b.color}50`, borderRadius: 2, padding: '5px 12px', cursor: 'pointer', letterSpacing: 1, ...mono }}>
                {b.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyDataTab;
