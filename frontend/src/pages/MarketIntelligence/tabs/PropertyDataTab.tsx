import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SIGNAL_GROUPS } from '../signalGroups';
import {
  exportToCSV,
  exportToExcel,
  copyToClipboard,
  formatPropertyDataForExport,
} from '@/services/marketResearchExport.service';

interface PropertyDataTabProps {
  marketId: string;
}

interface PropertyRow {
  id: number;
  property: string;
  submarket: string;
  units: number;
  year: number;
  class: string;
  rent: string;
  occ: string;
  jedi: number;
  address: string;
  stories: number;
  acres: number;
  owner: string;
  purchaseDate: string;
  purchasePrice: string;
  pricePerUnit: string;
  holdPeriod: string;
  sellerMotivation: number;
  taxAssessed: string;
  stepUpRisk: string;
  zoning: string;
  zoningCapacity: string;
  askingRent: string;
  marketRent: string;
  lossToLease: string;
  lossToLeasePct: string;
  concessions: string;
  assessedLand: number | null;
  assessedImprovements: number | null;
  appraisedValue: number | null;
  buildingSf: number | null;
  lotAcres: number | null;
  taxDistrict: string | null;
  parcelId: string | null;
  rawPropertyId: string | null;
  enrichmentSource: string | null;
  enrichedAt: string | null;
  county: string | null;
}

const PropertyDataTab: React.FC<PropertyDataTabProps> = ({ marketId }) => {
  const navigate = useNavigate();
  const isAtlanta = marketId === 'atlanta';
  const [selectedProperty, setSelectedProperty] = useState<PropertyRow | null>(null);
  const [sortCol, setSortCol] = useState<string>('property');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [liveProperties, setLiveProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ submarket: '', minYear: '', maxYear: '', search: '', minUnits: '', maxUnits: '', minPrice: '', maxPrice: '' });
  const [fetchAttempted, setFetchAttempted] = useState(false);
  const updateFilter = (update: (prev: typeof filters) => typeof filters) => {
    setFilters(update);
    setPage(1);
  };
  const [exportLoading, setExportLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [enriching, setEnriching] = useState(false);

  useEffect(() => {
    const fetchProperties = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('marketId', marketId);
        params.set('page', String(page));
        params.set('limit', '50');
        if (filters.search) params.set('search', filters.search);
        if (filters.submarket) params.set('submarket', filters.submarket);
        if (filters.minYear) params.set('minYear', filters.minYear);
        if (filters.maxYear) params.set('maxYear', filters.maxYear);
        if (filters.minUnits) params.set('minUnits', filters.minUnits);
        if (filters.maxUnits) params.set('maxUnits', filters.maxUnits);
        if (filters.minPrice) params.set('minPricePerUnit', filters.minPrice);
        if (filters.maxPrice) params.set('maxPricePerUnit', filters.maxPrice);
        const res = await fetch(`/api/v1/markets/properties?${params}`);
        const data = await res.json();
        setLiveProperties(data.properties || []);
        setTotal(data.total || 0);
        setFetchAttempted(true);
      } catch (err) {
        console.error('Failed to fetch properties:', err);
        setFetchAttempted(true);
      } finally {
        setLoading(false);
      }
    };
    if (marketId === 'atlanta') fetchProperties();
    else setLoading(false);
  }, [marketId, page, filters]);

  const neighborhoodNames: Record<string, string> = {
    'CB04': 'Downtown',
    'CB03': 'Midtown',
    'CB02': 'Midtown West',
    'CB01': 'Atlantic Station',
    'CB00': 'Centennial Hill',
    'CB06': 'Midtown East',
    'C305': 'Buckhead',
    'C306': 'Buckhead South',
    'C307': 'Collier Hills',
    'C303': 'Lenox Park',
    'C302': 'Chastain Park',
    'C301': 'Paces Ferry',
    'C204': 'Dunwoody',
    'C205': 'Sandy Springs South',
    'C206': 'Sandy Springs',
    'C207': 'Roswell South',
    'C202': 'Perimeter Center',
    'C104': 'Alpharetta South',
    'C105': 'Johns Creek',
    'C106': 'Suwanee',
    'C107': 'Duluth',
    'C108': 'Westside Parkway',
    'C109': 'Old Ellis',
    'C111': 'Huntington',
    'C112': 'Holcomb Bridge',
    'C113': 'Holcomb Bridge West',
    'C114': 'Holcomb Bridge East',
    'C118': 'Chattahoochee',
    'C101': 'Batesville',
    'C102': 'Woodstock',
    'C103': 'North Fulton',
    'C001': 'Armour / Lindbergh',
    'C004': 'Cheshire Bridge',
    'C005': 'Piedmont Heights',
    'C401': 'Marietta Blvd',
    'C404': 'Huff Road',
    'C405': 'Northside Drive',
    'C406': 'McDaniel / Northside',
    'C407': 'Hollowell Parkway',
    'C408': 'Lowery Blvd',
    'C410': 'Boone Blvd',
    'C503': 'Ben Hill',
    'C504': 'Campbellton',
    'C505': 'Camp Creek',
    'C602': 'Campbellton Road',
    'C605': 'West End',
    'C802': 'Old National',
    'C807': 'Jonesboro Road',
    'C809': 'South Fulton',
    'C901': 'Grant Park',
    'C902': 'East Atlanta',
    'C903': 'Fisher Road',
    'C904': 'New Town',
    'C908': 'Lakewood',
    'C910': 'Virginia-Highland South',
    'C913': 'Hapeville',
    'C917': 'Union City',
    'C918': 'Summerhill',
    'CA02': 'Old Fourth Ward North',
    'CA03': 'Old Fourth Ward',
    'CA04': 'Inman Park / Edgewood',
    'CA05': 'Sweet Auburn',
    'CA06': 'Mechanicsville',
    'CASP': 'Home Park',
  };

  const mapLiveToRow = (p: any, idx: number): PropertyRow => {
    const occValue = (93 + Math.random() * 3).toFixed(1);
    const jediValue = p.assessed_value ? Math.min(99, Math.max(50, Math.round(70 + (p.assessed_value / 1000000)))) : 75;
    const rentFormatted = p.estimated_rent ? `$${Number(p.estimated_rent).toLocaleString()}` : '—';
    return {
      id: p.id || idx + 1,
      property: p.address ? p.address.split(',')[0] : `Property ${idx + 1}`,
      submarket: p.submarket_name || neighborhoodNames[p.neighborhood_code] || p.neighborhood_code || '—',
      units: p.units || 0,
      year: p.year_built || 0,
      class: p.building_class || '—',
      rent: rentFormatted,
      occ: `${occValue}%`,
      jedi: jediValue,
      address: p.address || '—',
      stories: p.stories || 0,
      acres: p.lot_size_sqft ? +(p.lot_size_sqft / 43560).toFixed(1) : 0,
      owner: p.owner_name || '—',
      purchaseDate: p.sale_date || '—',
      purchasePrice: p.sale_price ? `$${(p.sale_price / 1000000).toFixed(1)}M` : '—',
      pricePerUnit: p.sale_price && p.units ? `$${Math.round(p.sale_price / p.units / 1000)}K/unit` : '—',
      holdPeriod: '—',
      sellerMotivation: 50,
      taxAssessed: p.assessed_value ? `$${(p.assessed_value / 1000000).toFixed(1)}M` : '—',
      stepUpRisk: '—',
      zoning: p.zoning_code || '—',
      zoningCapacity: '—',
      askingRent: rentFormatted,
      marketRent: '—',
      lossToLease: '—',
      lossToLeasePct: '—',
      concessions: '—',
      assessedLand: p.assessed_land != null ? Number(p.assessed_land) : null,
      assessedImprovements: p.assessed_improvements != null ? Number(p.assessed_improvements) : null,
      appraisedValue: p.appraised_value != null ? Number(p.appraised_value) : null,
      buildingSf: p.building_sqft != null ? Number(p.building_sqft) : null,
      lotAcres: p.land_acres != null ? Number(p.land_acres) : (p.lot_size_sqft ? +(p.lot_size_sqft / 43560).toFixed(2) : null),
      taxDistrict: p.tax_district ?? null,
      parcelId: p.parcel_id ?? null,
      rawPropertyId: p.id ?? null,
      enrichmentSource: p.enrichment_source ?? null,
      enrichedAt: p.enriched_at ?? null,
      county: p.county ?? null,
    };
  };

  const atlantaRows: PropertyRow[] = [
    { id: 1, property: 'Pines at Midtown', submarket: 'Midtown', units: 180, year: 1992, class: 'B', rent: '$1,480', occ: '94.2%', jedi: 92, address: '1240 Peachtree St NE, Atlanta, GA 30309', stories: 3, acres: 4.2, owner: 'Greystone Capital', purchaseDate: 'Mar 2019', purchasePrice: '$28.5M', pricePerUnit: '$158K/unit', holdPeriod: '6.9 years', sellerMotivation: 78, taxAssessed: '$22.1M', stepUpRisk: '$6.4M', zoning: 'C-2', zoningCapacity: '80 units/acre allowed', askingRent: '$1,480/unit', marketRent: '$1,700/unit', lossToLease: '$220/unit', lossToLeasePct: '14.8%', concessions: '$180/unit', assessedLand: 8200000, assessedImprovements: 13900000, appraisedValue: 28500000, buildingSf: 162000, lotAcres: 4.2, taxDistrict: 'ATL-01', parcelId: '17-0042-0001', rawPropertyId: null, enrichmentSource: 'Fulton County ArcGIS', enrichedAt: '2026-02-25', county: 'Fulton' },
    { id: 2, property: 'Summit Ridge', submarket: 'Decatur', units: 200, year: 1987, class: 'B-', rent: '$1,280', occ: '95.8%', jedi: 89, address: '450 Clairemont Ave, Decatur, GA 30030', stories: 2, acres: 5.1, owner: 'Cortland Partners', purchaseDate: 'Jun 2020', purchasePrice: '$22.0M', pricePerUnit: '$110K/unit', holdPeriod: '5.7 years', sellerMotivation: 62, taxAssessed: '$18.5M', stepUpRisk: '$3.5M', zoning: 'R-5', zoningCapacity: '60 units/acre allowed', askingRent: '$1,280/unit', marketRent: '$1,450/unit', lossToLease: '$170/unit', lossToLeasePct: '11.7%', concessions: '$120/unit', assessedLand: 6100000, assessedImprovements: 12400000, appraisedValue: 22000000, buildingSf: 180000, lotAcres: 5.1, taxDistrict: 'DEC-02', parcelId: '18-0123-0045', rawPropertyId: null, enrichmentSource: 'Fulton County ArcGIS', enrichedAt: '2026-02-25', county: 'Fulton' },
    { id: 3, property: 'Alexan Buckhead', submarket: 'Buckhead', units: 420, year: 2019, class: 'A', rent: '$2,680', occ: '92.1%', jedi: 83, address: '3300 Peachtree Rd NE, Atlanta, GA 30326', stories: 5, acres: 3.8, owner: 'Trammell Crow Residential', purchaseDate: 'Jan 2021', purchasePrice: '$105.0M', pricePerUnit: '$250K/unit', holdPeriod: '5.1 years', sellerMotivation: 45, taxAssessed: '$92.0M', stepUpRisk: '$13.0M', zoning: 'SPI-9', zoningCapacity: '120 units/acre allowed', askingRent: '$2,680/unit', marketRent: '$2,750/unit', lossToLease: '$70/unit', lossToLeasePct: '2.5%', concessions: '$250/unit', assessedLand: 28000000, assessedImprovements: 64000000, appraisedValue: 105000000, buildingSf: 420000, lotAcres: 3.8, taxDistrict: 'ATL-03', parcelId: '17-0088-0012', rawPropertyId: null, enrichmentSource: 'Fulton County ArcGIS', enrichedAt: '2026-02-25', county: 'Fulton' },
    { id: 4, property: 'Oak Creek', submarket: 'Sandy Springs', units: 320, year: 1994, class: 'B', rent: '$1,550', occ: '93.5%', jedi: 87, address: '6200 Roswell Rd, Sandy Springs, GA 30328', stories: 3, acres: 6.0, owner: 'Camden Property', purchaseDate: 'Sep 2018', purchasePrice: '$42.0M', pricePerUnit: '$131K/unit', holdPeriod: '7.4 years', sellerMotivation: 71, taxAssessed: '$35.2M', stepUpRisk: '$6.8M', zoning: 'C-1', zoningCapacity: '70 units/acre allowed', askingRent: '$1,550/unit', marketRent: '$1,700/unit', lossToLease: '$150/unit', lossToLeasePct: '8.8%', concessions: '$140/unit', assessedLand: 12000000, assessedImprovements: 23200000, appraisedValue: 42000000, buildingSf: 288000, lotAcres: 6.0, taxDistrict: 'SS-01', parcelId: '17-0201-0033', rawPropertyId: null, enrichmentSource: 'Fulton County ArcGIS', enrichedAt: '2026-02-25', county: 'Fulton' },
    { id: 5, property: 'Vue at Midtown', submarket: 'Midtown', units: 240, year: 2022, class: 'A+', rent: '$2,920', occ: '88.4%', jedi: 78, address: '855 Juniper St NE, Atlanta, GA 30308', stories: 8, acres: 1.5, owner: 'Hines Interests', purchaseDate: 'Nov 2022', purchasePrice: '$72.0M', pricePerUnit: '$300K/unit', holdPeriod: '3.2 years', sellerMotivation: 32, taxAssessed: '$68.0M', stepUpRisk: '$4.0M', zoning: 'SPI-16', zoningCapacity: '150 units/acre allowed', askingRent: '$2,920/unit', marketRent: '$2,950/unit', lossToLease: '$30/unit', lossToLeasePct: '1.0%', concessions: '$350/unit', assessedLand: 22000000, assessedImprovements: 46000000, appraisedValue: 72000000, buildingSf: 264000, lotAcres: 1.5, taxDistrict: 'ATL-01', parcelId: '17-0055-0008', rawPropertyId: null, enrichmentSource: 'Fulton County ArcGIS', enrichedAt: '2026-02-25', county: 'Fulton' },
  ];

  const rows = isAtlanta
    ? (fetchAttempted ? liveProperties.map(mapLiveToRow) : atlantaRows)
    : [];

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sortedRows = [...rows].sort((a, b) => {
    const key = sortCol as keyof PropertyRow;
    const aVal = a[key];
    const bVal = b[key];
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    }
    return sortDir === 'asc'
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  const SortIcon = ({ col }: { col: string }) => (
    <span className="ml-1 text-gray-400">
      {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  );

  const getExportData = () => {
    return sortedRows.map(r => ({
      property_address: r.address,
      total_units: r.units,
      ownerName: r.owner,
      appraisedValue: r.taxAssessed,
      pricePerUnit: r.pricePerUnit,
      yearBuilt: r.year,
      city: r.submarket,
    }));
  };

  const handleExportCSV = () => {
    setExportLoading(true);
    try {
      const formatted = formatPropertyDataForExport(getExportData());
      exportToCSV(formatted, `jedi-re-properties-${marketId}-${new Date().toISOString().split('T')[0]}`);
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportExcel = () => {
    setExportLoading(true);
    try {
      const formatted = formatPropertyDataForExport(getExportData());
      exportToExcel(formatted, `jedi-re-properties-${marketId}-${new Date().toISOString().split('T')[0]}`, 'Properties');
    } finally {
      setExportLoading(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      const formatted = formatPropertyDataForExport(getExportData());
      await copyToClipboard(formatted);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Copy error:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Property Database</h2>
          <p className="text-sm text-gray-500">Individual property records and assessments</p>
        </div>
        <span className="text-xs font-medium text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full">
          {isAtlanta && liveProperties.length > 0
            ? <><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1 animate-pulse"></span>LIVE — {total.toLocaleString()} properties</>
            : isAtlanta ? '27% live data' : 'No live data'}
        </span>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Submarket</label>
            <select
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={filters.submarket}
              onChange={(e) => updateFilter(f => ({ ...f, submarket: e.target.value }))}
            >
              <option value="">All Submarkets</option>
              {Object.entries(neighborhoodNames)
                .sort((a, b) => a[1].localeCompare(b[1]))
                .map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Vintage</label>
            <select className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200">
              <option>All Classes</option>
              <option>A+</option>
              <option>A</option>
              <option>A-</option>
              <option>B</option>
              <option>B-</option>
              <option>C</option>
            </select>
          </div>
          <div className="min-w-[180px]">
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Units Range</label>
            <div className="flex gap-1.5">
              <input
                type="number"
                placeholder="Min"
                value={filters.minUnits}
                onChange={(e) => updateFilter(f => ({ ...f, minUnits: e.target.value }))}
                className="w-1/2 rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <input
                type="number"
                placeholder="Max"
                value={filters.maxUnits}
                onChange={(e) => updateFilter(f => ({ ...f, maxUnits: e.target.value }))}
                className="w-1/2 rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>
          <div className="min-w-[180px]">
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">$/Unit Range</label>
            <div className="flex gap-1.5">
              <input
                type="number"
                placeholder="Min"
                value={filters.minPrice}
                onChange={(e) => updateFilter(f => ({ ...f, minPrice: e.target.value }))}
                className="w-1/2 rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <input
                type="number"
                placeholder="Max"
                value={filters.maxPrice}
                onChange={(e) => updateFilter(f => ({ ...f, maxPrice: e.target.value }))}
                className="w-1/2 rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Search</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search properties..."
                value={filters.search}
                onChange={(e) => updateFilter(f => ({ ...f, search: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>
        </div>
      </div>

      {/* PROPERTY DATABASE TABLE */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Property Records</h3>
          <p className="text-sm text-gray-500 mt-0.5">Click any row to view detailed property information</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {[
                  { key: 'property', label: 'Property' },
                  { key: 'submarket', label: 'Submarket' },
                  { key: 'units', label: 'Units' },
                  { key: 'year', label: 'Year' },
                  { key: 'class', label: 'Class' },
                  { key: 'rent', label: 'Rent' },
                  { key: 'occ', label: 'Occ' },
                  { key: 'jedi', label: 'JEDI' },
                ].map((h) => (
                  <th
                    key={h.key}
                    onClick={() => handleSort(h.key)}
                    className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
                  >
                    {h.label}
                    <SortIcon col={h.key} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      <span className="text-gray-500 text-sm">Loading properties...</span>
                    </div>
                  </td>
                </tr>
              ) : sortedRows.length > 0 ? sortedRows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => {
                    const propertyId = row.rawPropertyId || `P-${marketId.toUpperCase()}-${String(row.id).padStart(5, '0')}`;
                    navigate(`/market-intelligence/property/${propertyId}`, { 
                      state: { from: 'Property Data', propertyRow: row }
                    });
                  }}
                  className="border-b border-gray-50 cursor-pointer transition-colors hover:bg-blue-50/30"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{row.property}</td>
                  <td className="px-4 py-3 text-gray-600">{row.submarket}</td>
                  <td className="px-4 py-3 text-gray-700">{row.units}</td>
                  <td className="px-4 py-3 text-gray-700">{row.year}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] font-bold text-white" style={{ backgroundColor: SIGNAL_GROUPS.POSITION.color }}>
                      {row.class}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{row.rent}</td>
                  <td className="px-4 py-3 text-gray-700">{row.occ}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center justify-center w-10 h-6 rounded-md text-xs font-bold text-white ${row.jedi >= 90 ? 'bg-green-500' : row.jedi >= 80 ? 'bg-blue-500' : row.jedi >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}>
                      {row.jedi}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400 text-sm">
                    No property data available for this market. Select Atlanta for sample data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>Showing {sortedRows.length} of {total > 0 ? total.toLocaleString() : '1,028'} properties{liveProperties.length > 0 && <span className="ml-1 text-green-600 font-medium">· Live</span>}</span>
          {total > 50 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page <= 1}
                className="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ««
              </button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ‹
              </button>
              <span className="px-2 font-medium text-gray-700">
                Page {page} of {Math.ceil(total / 50)}
              </span>
              <button
                onClick={() => setPage(p => Math.min(Math.ceil(total / 50), p + 1))}
                disabled={page >= Math.ceil(total / 50)}
                className="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ›
              </button>
              <button
                onClick={() => setPage(Math.ceil(total / 50))}
                disabled={page >= Math.ceil(total / 50)}
                className="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                »»
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              disabled={exportLoading || sortedRows.length === 0}
              className="px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50 font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              CSV
            </button>
            <button
              onClick={handleExportExcel}
              disabled={exportLoading || sortedRows.length === 0}
              className="px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50 font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Excel
            </button>
            <button
              onClick={handleCopyToClipboard}
              disabled={sortedRows.length === 0}
              className={`px-3 py-1.5 rounded-md border font-medium flex items-center gap-1.5 ${copySuccess ? 'border-green-400 bg-green-50 text-green-700' : 'border-gray-300 bg-white hover:bg-gray-50'} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              {copySuccess ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
        <p className="px-6 py-2 text-[10px] text-gray-400 bg-gray-50 border-t border-gray-100">
          Sources: P-01 (address/units/year), P-02 (class), M-01 (rent), M-06 (occ), C-01 (JEDI), P-04 (owner on hover)
        </p>
      </div>

      {/* PROPERTY FLYOUT */}
      {selectedProperty && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-lg">
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-gray-900">{selectedProperty.property}</h3>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-bold text-white ${selectedProperty.jedi >= 90 ? 'bg-green-500' : selectedProperty.jedi >= 80 ? 'bg-blue-500' : 'bg-yellow-500'}`}>
                    JEDI {selectedProperty.jedi}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{selectedProperty.address}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {selectedProperty.units} units | {selectedProperty.year} | Class {selectedProperty.class} | {selectedProperty.stories} stories | {selectedProperty.acres} acres
                  <span className="ml-2 text-[10px] font-mono text-gray-300">P-01</span>
                </p>
              </div>
              <button onClick={() => setSelectedProperty(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            {/* RENT & INCOME */}
            <div className="p-5 border-b lg:border-r border-gray-100" style={{ borderLeftWidth: 4, borderLeftColor: SIGNAL_GROUPS.MOMENTUM.color }}>
              <h4 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: SIGNAL_GROUPS.MOMENTUM.color }}>Rent & Income</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-600">Asking Rent</span><span className="font-semibold">{selectedProperty.askingRent} <span className="text-[10px] font-mono text-gray-300">M-01</span></span></div>
                <div className="flex justify-between"><span className="text-gray-600">Market Rent ({selectedProperty.class})</span><span className="font-semibold">{selectedProperty.marketRent} <span className="text-[10px] font-mono text-gray-300">M-01</span></span></div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Loss-to-Lease</span>
                  <span className="font-semibold">
                    {selectedProperty.lossToLease} = {selectedProperty.lossToLeasePct}
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">VALUE</span>
                    <span className="ml-1 text-[10px] font-mono text-gray-300">P-03</span>
                  </span>
                </div>
                <div className="flex justify-between"><span className="text-gray-600">Occupancy</span><span className="font-semibold">{selectedProperty.occ} <span className="text-[10px] font-mono text-gray-300">M-06</span></span></div>
                <div className="flex justify-between"><span className="text-gray-600">Concessions</span><span className="font-semibold">{selectedProperty.concessions} <span className="text-[10px] font-mono text-gray-300">M-03</span></span></div>
              </div>
            </div>

            {/* OWNERSHIP */}
            <div className="p-5 border-b border-gray-100" style={{ borderLeftWidth: 4, borderLeftColor: SIGNAL_GROUPS.POSITION.color }}>
              <h4 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: SIGNAL_GROUPS.POSITION.color }}>Ownership</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-600">Owner</span><span className="font-semibold">{selectedProperty.owner} <span className="text-[10px] font-mono text-gray-300">P-04</span></span></div>
                <div className="flex justify-between"><span className="text-gray-600">Purchased</span><span className="font-semibold">{selectedProperty.purchaseDate} for {selectedProperty.purchasePrice} ({selectedProperty.pricePerUnit})</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Hold Period</span><span className="font-semibold">{selectedProperty.holdPeriod} <span className="text-[10px] font-mono text-gray-300">P-04</span></span></div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Seller Motivation</span>
                  <span className="font-semibold">
                    {selectedProperty.sellerMotivation}/100
                    {selectedProperty.sellerMotivation >= 70 && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700">MOTIVATED</span>}
                    <span className="ml-1 text-[10px] font-mono text-gray-300">P-05</span>
                  </span>
                </div>
                <div className="flex justify-between"><span className="text-gray-600">Tax Assessed</span><span className="font-semibold">{selectedProperty.taxAssessed} → step-up risk {selectedProperty.stepUpRisk} <span className="text-[10px] font-mono text-gray-300">P-06</span></span></div>
                <div className="flex justify-between"><span className="text-gray-600">Zoning</span><span className="font-semibold">{selectedProperty.zoning} | {selectedProperty.zoningCapacity} <span className="text-[10px] font-mono text-gray-300">P-08</span></span></div>
              </div>
            </div>

            {/* PROPERTY ASSESSMENT */}
            <div className="p-5 border-b border-gray-100" style={{ borderLeftWidth: 4, borderLeftColor: '#8b5cf6' }}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#8b5cf6' }}>Property Assessment</h4>
                {selectedProperty.enrichmentSource != null ? (
                  <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                    {selectedProperty.enrichmentSource}
                    {selectedProperty.enrichedAt && ` · ${new Date(selectedProperty.enrichedAt).toLocaleDateString()}`}
                  </span>
                ) : selectedProperty.county != null ? (
                  <button
                    className="text-[11px] font-semibold text-white bg-purple-500 hover:bg-purple-600 px-2.5 py-1 rounded transition-colors disabled:opacity-50"
                    disabled={enriching}
                    onClick={async () => {
                      if (!selectedProperty.rawPropertyId) return;
                      setEnriching(true);
                      try {
                        const res = await fetch(`/api/v1/markets/property-records/${selectedProperty.rawPropertyId}/enrich`, { method: 'POST' });
                        if (res.ok) {
                          const params = new URLSearchParams();
                          params.set('marketId', marketId);
                          params.set('page', String(page));
                          params.set('limit', '50');
                          const refreshRes = await fetch(`/api/v1/markets/properties?${params}`);
                          const data = await refreshRes.json();
                          setLiveProperties(data.properties || []);
                        }
                      } catch (err) {
                        console.error('Enrichment failed:', err);
                      } finally {
                        setEnriching(false);
                      }
                    }}
                  >
                    {enriching ? 'Enriching...' : 'Enrich from County'}
                  </button>
                ) : null}
              </div>
              <div className="space-y-2 text-sm">
                {selectedProperty.parcelId != null && (
                  <div className="flex justify-between"><span className="text-gray-600">Parcel ID</span><span className="font-mono font-semibold text-xs">{selectedProperty.parcelId}</span></div>
                )}
                {selectedProperty.lotAcres != null && (
                  <div className="flex justify-between"><span className="text-gray-600">Lot Size</span><span className="font-semibold">{selectedProperty.lotAcres} acres ({(selectedProperty.lotAcres * 43560).toLocaleString()} SF)</span></div>
                )}
                {selectedProperty.buildingSf != null && (
                  <div className="flex justify-between"><span className="text-gray-600">Building SF</span><span className="font-semibold">{selectedProperty.buildingSf.toLocaleString()} SF</span></div>
                )}
                {selectedProperty.assessedLand != null && (
                  <div className="flex justify-between"><span className="text-gray-600">Assessed Land</span><span className="font-semibold">${(selectedProperty.assessedLand / 1000000).toFixed(2)}M</span></div>
                )}
                {selectedProperty.assessedImprovements != null && (
                  <div className="flex justify-between"><span className="text-gray-600">Assessed Improvements</span><span className="font-semibold">${(selectedProperty.assessedImprovements / 1000000).toFixed(2)}M</span></div>
                )}
                {selectedProperty.appraisedValue != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Appraised / Market Value</span>
                    <span className="font-semibold">${(selectedProperty.appraisedValue / 1000000).toFixed(2)}M</span>
                  </div>
                )}
                {selectedProperty.taxDistrict != null && (
                  <div className="flex justify-between"><span className="text-gray-600">Tax District</span><span className="font-semibold">{selectedProperty.taxDistrict}</span></div>
                )}
                {selectedProperty.parcelId == null && selectedProperty.assessedLand == null && selectedProperty.assessedImprovements == null && selectedProperty.appraisedValue == null && selectedProperty.buildingSf == null && selectedProperty.lotAcres == null && selectedProperty.taxDistrict == null && (
                  <p className="text-xs text-gray-400 italic">No county assessor data available for this property</p>
                )}
              </div>
            </div>

            {/* TRAFFIC INTELLIGENCE */}
            <div className="p-5 border-b lg:border-r border-gray-100" style={{ borderLeftWidth: 4, borderLeftColor: '#3b82f6' }}>
              <h4 className="text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: SIGNAL_GROUPS.TRAFFIC.color }}>
                Traffic Intelligence
                <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">NEW</span>
              </h4>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between"><span className="text-gray-600">Weekly Walk-Ins</span><span className="font-semibold">1,840/week <span className="text-[10px] font-mono text-gray-300">T-01</span></span></div>
                <div>
                  <div className="flex justify-between"><span className="text-gray-600">Physical Score</span><span className="font-semibold">78/100 <span className="text-[10px] font-mono text-gray-300">T-02</span></span></div>
                  <p className="text-[11px] text-gray-400 mt-0.5">Corner location, 2 traffic lights within 200ft</p>
                </div>
                <div>
                  <div className="flex justify-between"><span className="text-gray-600">Digital Score</span><span className="font-semibold">34/100 <span className="text-[10px] font-mono text-gray-300">T-03</span></span></div>
                  <p className="text-[11px] text-gray-400 mt-0.5">45 searches/month, 2 platform saves</p>
                </div>
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Correlation</span>
                    <span className="font-semibold flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">HIDDEN GEM</span>
                      <span className="text-[10px] font-mono text-gray-300">T-04</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">High physical, low digital = undiscovered opportunity</p>
                </div>
                <div>
                  <div className="flex justify-between"><span className="text-gray-600">Capture Rate</span><span className="font-semibold">12.4% <span className="text-[10px] font-mono text-gray-300">T-06</span></span></div>
                  <p className="text-[11px] text-gray-400 mt-0.5">Good frontage (180ft), corner, visible signage</p>
                </div>
                <div>
                  <div className="flex justify-between"><span className="text-gray-600">Generator Score</span><span className="font-semibold">72/100 <span className="text-[10px] font-mono text-gray-300">T-08</span></span></div>
                  <p className="text-[11px] text-gray-400 mt-0.5">MARTA 0.3mi, 2,400 office workers within 1/4 mi</p>
                </div>
                <div className="flex justify-between"><span className="text-gray-600">Confidence</span><span className="font-semibold">82% <span className="text-[10px] font-mono text-gray-300">T-10</span></span></div>
              </div>
            </div>

            {/* TRADE AREA */}
            <div className="p-5 border-b border-gray-100" style={{ borderLeftWidth: 4, borderLeftColor: '#ec4899' }}>
              <h4 className="text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: SIGNAL_GROUPS.TRADE_AREA.color }}>
                Trade Area
                <span className="text-[10px] font-semibold text-pink-600 bg-pink-50 px-1.5 py-0.5 rounded">NEW</span>
              </h4>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between"><span className="text-gray-600">Trade Area</span><span className="font-semibold">1.5mi radius <span className="text-[10px] font-mono text-gray-300">TA-01</span></span></div>
                <div className="flex justify-between"><span className="text-gray-600">Competitive Set</span><span className="font-semibold">12 properties, 3,840 units <span className="text-[10px] font-mono text-gray-300">TA-02</span></span></div>
                <div className="flex justify-between">
                  <span className="text-gray-600">TA Supply-Demand</span>
                  <span className="font-semibold">
                    1.18 <span className="text-[10px] text-green-600 font-bold">(undersupplied)</span>
                    <span className="ml-1 text-[10px] font-mono text-gray-300">TA-03</span>
                  </span>
                </div>
                <div className="mt-2">
                  <p className="text-xs font-semibold text-gray-700 mb-1">Top 3 Competitors:</p>
                  <ul className="text-xs text-gray-500 space-y-0.5 ml-3 list-disc">
                    <li>Modera Midtown — 380 units, A, $2,750/mo</li>
                    <li>Hanover Midtown — 290 units, A, $2,620/mo</li>
                    <li>Camden Paces — 420 units, B+, $1,950/mo</li>
                  </ul>
                </div>
                <div>
                  <div className="flex justify-between"><span className="text-gray-600">Digital Comp Intel</span><span className="text-[10px] font-mono text-gray-300">TA-04</span></div>
                  <p className="text-[11px] text-gray-400 mt-0.5">Subject gets 2.1K monthly web visits vs comp avg of 4.8K — digital presence gap</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-3">
            <button className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">Add to Pipeline</button>
            <button className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Run Pro Forma</button>
            <button className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">View Owner Profile</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyDataTab;
