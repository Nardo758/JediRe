import React, { useState } from 'react';
import { SIGNAL_GROUPS } from '../signalGroups';

interface MarketDataTabProps {
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
}

const MarketDataTab: React.FC<MarketDataTabProps> = ({ marketId }) => {
  const isAtlanta = marketId === 'atlanta';
  const [selectedProperty, setSelectedProperty] = useState<PropertyRow | null>(null);
  const [sortCol, setSortCol] = useState<string>('property');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [heatmapMode, setHeatmapMode] = useState('D-05');

  const atlantaRows: PropertyRow[] = [
    { id: 1, property: 'Pines at Midtown', submarket: 'Midtown', units: 180, year: 1992, class: 'B', rent: '$1,480', occ: '94.2%', jedi: 92, address: '1240 Peachtree St NE, Atlanta, GA 30309', stories: 3, acres: 4.2, owner: 'Greystone Capital', purchaseDate: 'Mar 2019', purchasePrice: '$28.5M', pricePerUnit: '$158K/unit', holdPeriod: '6.9 years', sellerMotivation: 78, taxAssessed: '$22.1M', stepUpRisk: '$6.4M', zoning: 'C-2', zoningCapacity: '80 units/acre allowed', askingRent: '$1,480/unit', marketRent: '$1,700/unit', lossToLease: '$220/unit', lossToLeasePct: '14.8%', concessions: '$180/unit' },
    { id: 2, property: 'Summit Ridge', submarket: 'Decatur', units: 200, year: 1987, class: 'B-', rent: '$1,280', occ: '95.8%', jedi: 89, address: '450 Clairemont Ave, Decatur, GA 30030', stories: 2, acres: 5.1, owner: 'Cortland Partners', purchaseDate: 'Jun 2020', purchasePrice: '$22.0M', pricePerUnit: '$110K/unit', holdPeriod: '5.7 years', sellerMotivation: 62, taxAssessed: '$18.5M', stepUpRisk: '$3.5M', zoning: 'R-5', zoningCapacity: '60 units/acre allowed', askingRent: '$1,280/unit', marketRent: '$1,450/unit', lossToLease: '$170/unit', lossToLeasePct: '11.7%', concessions: '$120/unit' },
    { id: 3, property: 'Alexan Buckhead', submarket: 'Buckhead', units: 420, year: 2019, class: 'A', rent: '$2,680', occ: '92.1%', jedi: 83, address: '3300 Peachtree Rd NE, Atlanta, GA 30326', stories: 5, acres: 3.8, owner: 'Trammell Crow Residential', purchaseDate: 'Jan 2021', purchasePrice: '$105.0M', pricePerUnit: '$250K/unit', holdPeriod: '5.1 years', sellerMotivation: 45, taxAssessed: '$92.0M', stepUpRisk: '$13.0M', zoning: 'SPI-9', zoningCapacity: '120 units/acre allowed', askingRent: '$2,680/unit', marketRent: '$2,750/unit', lossToLease: '$70/unit', lossToLeasePct: '2.5%', concessions: '$250/unit' },
    { id: 4, property: 'Oak Creek', submarket: 'Sandy Springs', units: 320, year: 1994, class: 'B', rent: '$1,550', occ: '93.5%', jedi: 87, address: '6200 Roswell Rd, Sandy Springs, GA 30328', stories: 3, acres: 6.0, owner: 'Camden Property', purchaseDate: 'Sep 2018', purchasePrice: '$42.0M', pricePerUnit: '$131K/unit', holdPeriod: '7.4 years', sellerMotivation: 71, taxAssessed: '$35.2M', stepUpRisk: '$6.8M', zoning: 'C-1', zoningCapacity: '70 units/acre allowed', askingRent: '$1,550/unit', marketRent: '$1,700/unit', lossToLease: '$150/unit', lossToLeasePct: '8.8%', concessions: '$140/unit' },
    { id: 5, property: 'Vue at Midtown', submarket: 'Midtown', units: 240, year: 2022, class: 'A+', rent: '$2,920', occ: '88.4%', jedi: 78, address: '855 Juniper St NE, Atlanta, GA 30308', stories: 8, acres: 1.5, owner: 'Hines Interests', purchaseDate: 'Nov 2022', purchasePrice: '$72.0M', pricePerUnit: '$300K/unit', holdPeriod: '3.2 years', sellerMotivation: 32, taxAssessed: '$68.0M', stepUpRisk: '$4.0M', zoning: 'SPI-16', zoningCapacity: '150 units/acre allowed', askingRent: '$2,920/unit', marketRent: '$2,950/unit', lossToLease: '$30/unit', lossToLeasePct: '1.0%', concessions: '$350/unit' },
  ];

  const rows = isAtlanta ? atlantaRows : [];

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

  const demandSignals = [
    { id: 'D-01', name: 'Jobs-to-Apartments Ratio', value: '2.8x', ok: true },
    { id: 'D-02', name: 'New Jobs to New Units', value: '3.1x', ok: true },
    { id: 'D-03', name: 'Net Migration to Supply', value: '1.4x', ok: true },
    { id: 'D-04', name: 'Household Formation', value: '+12,400/yr', ok: true },
    { id: 'D-05', name: 'Traffic Count Growth', value: '+4.2%', ok: true },
    { id: 'D-06', name: 'Traffic Acceleration', value: '+0.8%', ok: true },
    { id: 'D-07', name: 'Digital-Physical Gap', value: '1.3x', ok: true },
    { id: 'D-08', name: 'Search Interest Volume', value: '↑ 18%', ok: true },
    { id: 'D-09', name: 'Demand Momentum Score', value: '78/100', ok: true },
    { id: 'D-10', name: 'Employment Gravity', value: '82/100', ok: true },
    { id: 'D-11', name: 'Rent-to-Mortgage Discount', value: '24%', ok: true },
  ];

  const supplySignals = [
    { id: 'S-04', name: 'Absorption Runway', value: '14 months', ok: false },
    { id: 'S-05', name: 'Delivery Clustering', value: '3 clusters', ok: false },
    { id: 'S-06', name: 'Permit Momentum', value: '↓ 12%', ok: true },
    { id: 'S-07', name: 'Construction Cost vs Yield', value: '5.8%', ok: true },
    { id: 'S-08', name: 'Saturation Index', value: '0.92', ok: true },
    { id: 'S-09', name: 'Permit-to-Delivery', value: '68%', ok: false },
  ];

  const rentByVintage = [
    { vintage: '2020+', class: 'A+', avgRent: '$2,920', yoy: '+2.1%', rentSf: '$3.24', concession: '$350' },
    { vintage: '2010-19', class: 'A', avgRent: '$2,650', yoy: '+2.8%', rentSf: '$2.94', concession: '$280' },
    { vintage: '2000-09', class: 'A-', avgRent: '$2,180', yoy: '+3.5%', rentSf: '$2.42', concession: '$200' },
    { vintage: '1990-99', class: 'B', avgRent: '$1,680', yoy: '+4.2%', rentSf: '$1.87', concession: '$150' },
    { vintage: '1980-89', class: 'B-', avgRent: '$1,380', yoy: '+4.8%', rentSf: '$1.53', concession: '$100' },
    { vintage: 'Pre-80', class: 'C', avgRent: '$1,080', yoy: '+3.9%', rentSf: '$1.20', concession: '$80' },
  ];

  const keyMetrics = [
    { id: 'M-05', name: 'Rent vs Wage Growth Spread', value: '+1.8%', desc: 'Rent growing faster than wages — affordability ceiling approaching' },
    { id: 'R-01', name: 'Affordability Threshold', value: '32%', desc: 'Rent-to-income ratio for median household' },
    { id: 'R-02', name: 'Vintage Convergence Rate', value: '2.4%/yr', desc: 'Class A-B rent spread narrowing' },
    { id: 'M-07', name: 'Traffic-to-Rent Elasticity', value: '0.34', desc: 'Each 10% traffic increase → 3.4% rent growth' },
    { id: 'R-03', name: 'Concession Drag Rate', value: '3.2%', desc: 'Effective rent reduction from concessions' },
    { id: 'DC-07', name: 'Pricing Power Index', value: '74/100', desc: 'Strong pricing power in supply-constrained submarkets' },
  ];

  const topOwners = [
    { owner: 'Camden Property', props: 42, units: '18,400', avgHold: '4.2yr', signal: 'BUY' },
    { owner: 'Cortland', props: 34, units: '12,800', avgHold: '3.5yr', signal: 'BUY' },
    { owner: 'Greystone Capital', props: 4, units: '2,200', avgHold: '5.8yr', signal: 'SELL?' },
  ];

  const heatmapOptions = [
    { id: 'D-05', label: 'Road Traffic (D-05)' },
    { id: 'T-02', label: 'Physical Score (T-02)' },
    { id: 'T-03', label: 'Digital Score (T-03)' },
    { id: 'T-04', label: 'Correlation (T-04)' },
    { id: 'C-01', label: 'JEDI Score (C-01)' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Market Data</h2>
          <p className="text-sm text-gray-500">Full research library · 5-15 minute deep dive · 44 outputs</p>
        </div>
        <span className="text-xs font-medium text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full">
          {isAtlanta ? '27% live data' : 'No live data'}
        </span>
      </div>

      {/* SECTION 1: FILTER BAR */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Submarket</label>
            <select className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200">
              <option>All Submarkets</option>
              <option>Midtown</option>
              <option>Buckhead</option>
              <option>Decatur</option>
              <option>Sandy Springs</option>
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
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Units</label>
            <select className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200">
              <option>Any Size</option>
              <option>1-100</option>
              <option>100-250</option>
              <option>250-500</option>
              <option>500+</option>
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Owner Type</label>
            <select className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200">
              <option>All Owners</option>
              <option>Institutional</option>
              <option>Private</option>
              <option>REIT</option>
            </select>
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
                className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: PROPERTY DATABASE TABLE */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Property Database</h3>
          <p className="text-sm text-gray-500 mt-0.5">Click any row to open Property Flyout</p>
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
              {sortedRows.length > 0 ? sortedRows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedProperty(selectedProperty?.id === row.id ? null : row)}
                  className={`border-b border-gray-50 cursor-pointer transition-colors ${selectedProperty?.id === row.id ? 'bg-blue-50' : 'hover:bg-blue-50/30'}`}
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
          <span>Showing 1,028 properties</span>
          <div className="flex gap-3">
            <button className="px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50 font-medium">Export CSV</button>
            <button className="px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50 font-medium">Select for Comparison</button>
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

      {/* SECTION 3: DEMAND-SUPPLY DASHBOARD */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100" style={{ borderLeftWidth: 4, borderLeftColor: SIGNAL_GROUPS.DEMAND.color }}>
          <h3 className="text-base font-semibold text-gray-900">Demand-Supply Dashboard</h3>
          <p className="text-sm text-gray-500 mt-0.5">Employment, migration, household formation vs pipeline and absorption</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* DEMAND */}
          <div className="p-5 border-b lg:border-b-0 lg:border-r border-gray-100">
            <h4 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: SIGNAL_GROUPS.DEMAND.color }}>Demand Signals</h4>
            <div className="space-y-1.5">
              {demandSignals.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-green-50/50">
                  <div className="flex items-center gap-2">
                    <span className="text-green-500 text-sm">✓</span>
                    <span className="text-[10px] font-mono text-gray-400">{s.id}</span>
                    <span className="text-sm text-gray-700">{s.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{s.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-green-700">STRONG DEMAND</span>
                <span className="text-xs text-green-600">Confidence: 82%</span>
              </div>
              <p className="text-xs text-green-600 mt-1">Atlanta's job growth of 2.8x apartments ratio, combined with strong net migration (+48K/yr), creates sustained demand pressure. Household formation continues to outpace new supply, particularly in Class B/C segments.</p>
            </div>
          </div>

          {/* SUPPLY */}
          <div className="p-5">
            <h4 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: SIGNAL_GROUPS.SUPPLY.color }}>Supply Signals</h4>
            <div className="space-y-1.5">
              {supplySignals.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-red-50/50">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${s.ok ? 'text-green-500' : 'text-amber-500'}`}>{s.ok ? '✓' : '⚠'}</span>
                    <span className="text-[10px] font-mono text-gray-400">{s.id}</span>
                    <span className="text-sm text-gray-700">{s.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{s.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-amber-700">MODERATE SUPPLY RISK</span>
                <span className="text-xs text-amber-600">Confidence: 68%</span>
              </div>
              <p className="text-xs text-amber-600 mt-1">14-month absorption runway is elevated due to Class A deliveries concentrated in Midtown and Buckhead. However, permit momentum is slowing (-12%), and construction costs are filtering out marginal projects.</p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: RENT & PRICING INTELLIGENCE */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100" style={{ borderLeftWidth: 4, borderLeftColor: SIGNAL_GROUPS.MOMENTUM.color }}>
          <h3 className="text-base font-semibold text-gray-900">Rent & Pricing Intelligence</h3>
          <p className="text-sm text-gray-500 mt-0.5">Rent trends, concessions, wage growth spread, and pricing power</p>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Vintage</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Class</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Avg Rent</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">YoY Change</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Rent/SF</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Concession</th>
                </tr>
              </thead>
              <tbody>
                {rentByVintage.map((r, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-orange-50/30">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{r.vintage}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] font-bold text-white" style={{ backgroundColor: SIGNAL_GROUPS.POSITION.color }}>
                        {r.class}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-gray-900">{r.avgRent}</td>
                    <td className="px-4 py-2.5 text-green-600 font-medium">{r.yoy}</td>
                    <td className="px-4 py-2.5 text-gray-700">{r.rentSf}</td>
                    <td className="px-4 py-2.5 text-gray-700">{r.concession}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {keyMetrics.map((m) => (
              <div key={m.id} className="p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono text-gray-400">{m.id}</span>
                  <span className="text-xs font-semibold text-gray-700">{m.name}</span>
                </div>
                <div className="text-lg font-bold text-gray-900">{m.value}</div>
                <p className="text-[11px] text-gray-500 mt-0.5">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 5: OWNERSHIP INTELLIGENCE */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100" style={{ borderLeftWidth: 4, borderLeftColor: SIGNAL_GROUPS.POSITION.color }}>
          <h3 className="text-base font-semibold text-gray-900">Ownership Intelligence</h3>
          <p className="text-sm text-gray-500 mt-0.5">Portfolio analysis, seller motivation, and concentration risk</p>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Owner</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Props</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Units</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Avg Hold</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Signal</th>
                </tr>
              </thead>
              <tbody>
                {topOwners.map((o, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-purple-50/30">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{o.owner}</td>
                    <td className="px-4 py-2.5 text-gray-700">{o.props}</td>
                    <td className="px-4 py-2.5 text-gray-700">{o.units}</td>
                    <td className="px-4 py-2.5 text-gray-700">{o.avgHold}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${o.signal === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {o.signal}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-orange-50 border border-orange-200">
            <div className="flex items-center gap-2">
              <span className="text-orange-600 font-bold text-sm">MOTIVATED SELLERS:</span>
              <span className="text-sm text-orange-700">142 properties flagged</span>
            </div>
            <p className="text-xs text-orange-600 mt-1">Criteria: Hold period &gt; 5yr + tax step-up risk &gt; 20% + seller motivation score &gt; 65</p>
          </div>

          <div className="mt-3">
            <button className="text-sm font-medium text-blue-600 hover:text-blue-700">View Seller Target List →</button>
          </div>
        </div>
      </div>

      {/* SECTION 6: TRANSACTION HISTORY */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100" style={{ borderLeftWidth: 4, borderLeftColor: SIGNAL_GROUPS.MOMENTUM.color }}>
          <h3 className="text-base font-semibold text-gray-900">Transaction History</h3>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-400"></span>
              <span className="font-semibold text-gray-900">292 sales</span>
              <span className="text-gray-500">(2018-2025)</span>
            </div>
            <span className="text-gray-300">|</span>
            <div>
              <span className="text-gray-600">Cap rate: </span>
              <span className="font-semibold text-gray-900">5.1% → 5.5%</span>
            </div>
            <span className="text-gray-300">|</span>
            <div>
              <span className="text-gray-600">Investor Index: </span>
              <span className="font-semibold text-gray-900">6.2</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3">
            <p className="text-[10px] text-gray-400">Sources: M-08, M-09, P-07</p>
            <button className="text-sm font-medium text-blue-600 hover:text-blue-700">See chart on Trends tab →</button>
          </div>
        </div>
      </div>

      {/* SECTION 7: TRAFFIC & DEMAND HEATMAP */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100" style={{ borderLeftWidth: 4, borderLeftColor: SIGNAL_GROUPS.TRAFFIC.color }}>
          <h3 className="text-base font-semibold text-gray-900">Traffic & Demand Heatmap</h3>
          <p className="text-sm text-gray-500 mt-0.5">Physical and digital traffic patterns, demand momentum overlay</p>
        </div>
        <div className="p-4">
          <div className="flex flex-wrap gap-2 mb-4">
            {heatmapOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setHeatmapMode(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${heatmapMode === opt.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="w-full h-64 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
            <div className="text-center px-8">
              <svg className="w-10 h-10 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <p className="text-sm font-medium text-gray-500">
                {heatmapMode === 'D-05' && 'Road traffic volume heatmap — AADT counts by road segment, color-coded by growth rate'}
                {heatmapMode === 'T-02' && 'Physical traffic score overlay — property-level walk-in prediction based on road class, generators, and frontage'}
                {heatmapMode === 'T-03' && 'Digital traffic score overlay — search volume, platform saves, and website visits by property'}
                {heatmapMode === 'T-04' && 'Correlation heatmap — HIDDEN GEM (high physical / low digital) vs DIGITAL DARLING (low physical / high digital)'}
                {heatmapMode === 'C-01' && 'JEDI Score heatmap — composite intelligence score (0-100) by property, weighted across all signal groups'}
              </p>
              <p className="text-xs text-gray-400 mt-2">Map integration requires Mapbox GL JS — placeholder for development</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketDataTab;
