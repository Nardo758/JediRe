import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const SUBJECT_PROPERTIES = [
  { id: 'sunset-ridge', name: 'Sunset Ridge Apartments', units: 248, class: 'B', submarket: 'Sandy Springs', avgRent: 1648, rentPSF: 1.74 },
  { id: 'lakewood-crossing', name: 'Lakewood Crossing', units: 312, class: 'B-', submarket: 'Lakewood', avgRent: 1420, rentPSF: 1.52 },
  { id: 'cascade-falls', name: 'Cascade Falls Residences', units: 186, class: 'B', submarket: 'Cascade', avgRent: 1580, rentPSF: 1.68 },
  { id: 'peachtree-creek', name: 'Peachtree Creek Landing', units: 420, class: 'B+', submarket: 'Buckhead', avgRent: 1890, rentPSF: 2.02 },
  { id: 'east-point', name: 'East Point Village', units: 156, class: 'C+', submarket: 'East Point', avgRent: 1180, rentPSF: 1.28 },
  { id: 'brookhaven', name: 'Brookhaven Station Apts', units: 278, class: 'B+', submarket: 'Brookhaven', avgRent: 1760, rentPSF: 1.88 },
  { id: 'decatur', name: 'Decatur Heights', units: 198, class: 'B', submarket: 'Decatur', avgRent: 1540, rentPSF: 1.64 },
  { id: 'college-park', name: 'College Park Commons', units: 224, class: 'C', submarket: 'College Park', avgRent: 1120, rentPSF: 1.22 },
  { id: 'vinings', name: 'Vinings Creek Terrace', units: 168, class: 'B', submarket: 'Vinings', avgRent: 1680, rentPSF: 1.80 },
  { id: 'westside', name: 'Westside Lofts', units: 142, class: 'B-', submarket: 'Westside', avgRent: 1490, rentPSF: 1.58 },
  { id: 'pines-midtown', name: 'Pines at Midtown', units: 180, class: 'B', submarket: 'Midtown', avgRent: 1720, rentPSF: 1.84 },
  { id: 'camden-usa', name: 'Camden USA', units: 745, class: 'A', submarket: 'Buckhead', avgRent: 2180, rentPSF: 2.36 },
];

const COMP_VITALS = [
  { id: 'trade-area', label: 'Trade Area Comps', value: '24', trend: '+3 this quarter', trendDirection: 'up' as const, sparklineData: [14, 16, 17, 18, 19, 18, 20, 21, 20, 22, 23, 24] },
  { id: 'like-kind', label: 'Like-Kind Peers', value: '38', trend: 'Across 6 MSAs', trendDirection: 'up' as const, sparklineData: [22, 24, 26, 28, 30, 29, 31, 33, 34, 35, 37, 38] },
  { id: 'rent-premium', label: 'Avg Rent Premium', value: '+$127', trend: 'vs trade area avg', trendDirection: 'up' as const, sparklineData: [65, 72, 80, 88, 95, 102, 98, 108, 112, 118, 122, 127] },
  { id: 'rent-ceiling', label: 'Rent Ceiling Gap', value: '$302', trend: 'Room to close', trendDirection: 'up' as const, sparklineData: [410, 395, 380, 365, 350, 340, 335, 325, 318, 312, 308, 302] },
  { id: 'cross-market', label: 'Cross-Market Score', value: '74', trend: '+4.2 QoQ', trendDirection: 'up' as const, sparklineData: [52, 55, 58, 60, 62, 64, 66, 68, 70, 71, 73, 74] },
];

type TradeAreaComp = {
  name: string;
  units: number;
  class: string;
  yearBuilt: number;
  distance: string;
  avgRent: number;
  rentPSF: number;
  occupancy: number;
  rentDelta: number;
  trafficRank: number;
  amenityScore: number;
  threat: 'HIGH' | 'MODERATE' | 'LOW';
  recentReno: boolean;
};

const TRADE_AREA_COMPS: TradeAreaComp[] = [
  { name: 'The Vue at Buckhead', units: 312, class: 'A', yearBuilt: 2021, distance: '0.3 mi', avgRent: 1950, rentPSF: 2.18, occupancy: 96.2, rentDelta: +302, trafficRank: 1, amenityScore: 94, threat: 'HIGH', recentReno: false },
  { name: 'Elan Lenox', units: 268, class: 'A-', yearBuilt: 2019, distance: '0.5 mi', avgRent: 1875, rentPSF: 2.04, occupancy: 94.8, rentDelta: +227, trafficRank: 3, amenityScore: 88, threat: 'HIGH', recentReno: false },
  { name: 'Alexan Buckhead Village', units: 340, class: 'A', yearBuilt: 2022, distance: '0.7 mi', avgRent: 2010, rentPSF: 2.24, occupancy: 93.1, rentDelta: +362, trafficRank: 2, amenityScore: 96, threat: 'HIGH', recentReno: false },
  { name: 'ARIUM Brookhaven', units: 224, class: 'B+', yearBuilt: 2016, distance: '0.4 mi', avgRent: 1720, rentPSF: 1.82, occupancy: 95.4, rentDelta: +72, trafficRank: 8, amenityScore: 72, threat: 'MODERATE', recentReno: true },
  { name: 'Cortland at Phipps Plaza', units: 198, class: 'A-', yearBuilt: 2020, distance: '0.8 mi', avgRent: 1840, rentPSF: 1.98, occupancy: 94.2, rentDelta: +192, trafficRank: 5, amenityScore: 82, threat: 'MODERATE', recentReno: false },
  { name: 'Broadstone Lenox Park', units: 286, class: 'B+', yearBuilt: 2014, distance: '0.6 mi', avgRent: 1690, rentPSF: 1.76, occupancy: 93.8, rentDelta: +42, trafficRank: 11, amenityScore: 68, threat: 'MODERATE', recentReno: true },
  { name: 'Camden Phipps', units: 352, class: 'B', yearBuilt: 2008, distance: '0.9 mi', avgRent: 1580, rentPSF: 1.62, occupancy: 92.1, rentDelta: -68, trafficRank: 14, amenityScore: 58, threat: 'LOW', recentReno: false },
  { name: 'MAA North Buckhead', units: 410, class: 'B', yearBuilt: 2005, distance: '1.1 mi', avgRent: 1520, rentPSF: 1.54, occupancy: 91.5, rentDelta: -128, trafficRank: 18, amenityScore: 52, threat: 'LOW', recentReno: false },
];

type LikeKindComp = {
  name: string;
  units: number;
  class: string;
  market: string;
  avgRent: number;
  rentPSF: number;
  occupancy: number;
  rentGrowthYoY: number;
  pcsScore: number;
  opBenchmark: 'ABOVE' | 'AT' | 'BELOW';
  pricingAnomaly: boolean;
  collision: boolean;
};

const LIKE_KIND_COMPS: LikeKindComp[] = [
  { name: 'Cortland Vinings', units: 288, class: 'B+', market: 'Atlanta — Vinings', avgRent: 1680, rentPSF: 1.78, occupancy: 94.6, rentGrowthYoY: 4.8, pcsScore: 78, opBenchmark: 'ABOVE', pricingAnomaly: false, collision: false },
  { name: 'MAA Lindbergh', units: 264, class: 'B+', market: 'Atlanta — Lindbergh', avgRent: 1590, rentPSF: 1.68, occupancy: 93.2, rentGrowthYoY: 3.2, pcsScore: 68, opBenchmark: 'AT', pricingAnomaly: false, collision: false },
  { name: 'Retreat at Peachtree City', units: 302, class: 'B', market: 'Atlanta — South', avgRent: 1420, rentPSF: 1.48, occupancy: 91.8, rentGrowthYoY: 5.6, pcsScore: 62, opBenchmark: 'BELOW', pricingAnomaly: true, collision: true },
  { name: 'Broadstone Centennial', units: 256, class: 'B+', market: 'Nashville — Midtown', avgRent: 1740, rentPSF: 1.86, occupancy: 95.1, rentGrowthYoY: 6.2, pcsScore: 82, opBenchmark: 'ABOVE', pricingAnomaly: false, collision: false },
  { name: 'The Flats at Overton Park', units: 318, class: 'B+', market: 'Nashville — East', avgRent: 1620, rentPSF: 1.72, occupancy: 93.8, rentGrowthYoY: 4.1, pcsScore: 71, opBenchmark: 'AT', pricingAnomaly: false, collision: false },
  { name: 'Hawthorne at the District', units: 244, class: 'B', market: 'Charlotte — South End', avgRent: 1560, rentPSF: 1.64, occupancy: 94.4, rentGrowthYoY: 5.8, pcsScore: 65, opBenchmark: 'BELOW', pricingAnomaly: true, collision: true },
  { name: 'Arcadian Sugar Land', units: 276, class: 'B+', market: 'Houston — Sugar Land', avgRent: 1480, rentPSF: 1.52, occupancy: 92.6, rentGrowthYoY: 3.6, pcsScore: 60, opBenchmark: 'BELOW', pricingAnomaly: true, collision: false },
  { name: 'Springs at Lakeline', units: 232, class: 'B', market: 'Austin — Cedar Park', avgRent: 1640, rentPSF: 1.74, occupancy: 93.0, rentGrowthYoY: 2.8, pcsScore: 58, opBenchmark: 'BELOW', pricingAnomaly: false, collision: false },
  { name: 'Avana Westchase', units: 348, class: 'B', market: 'Tampa — Westchase', avgRent: 1510, rentPSF: 1.58, occupancy: 94.8, rentGrowthYoY: 7.2, pcsScore: 74, opBenchmark: 'AT', pricingAnomaly: true, collision: false },
  { name: 'The Wyatt at West Midtown', units: 208, class: 'B+', market: 'Atlanta — West Midtown', avgRent: 1710, rentPSF: 1.84, occupancy: 95.6, rentGrowthYoY: 5.4, pcsScore: 76, opBenchmark: 'ABOVE', pricingAnomaly: false, collision: false },
];

const TRADE_AREA_PATTERNS = [
  {
    pattern: 'Rent Ceiling Gap',
    detection: "If the top-rent comp charges $1,950 and the average is $1,650 — that $300 gap defines your renovation opportunity ceiling. Properties below average with above-average traffic position are acquisition targets.",
  },
  {
    pattern: 'Amenity Arms Race Detection',
    detection: "When 60%+ of trade area comps have added a specific amenity in the last 24 months, properties WITHOUT that amenity face accelerating competitive displacement.",
  },
  {
    pattern: 'Vintage Rotation',
    detection: 'When new supply enters a trade area, competitive pressure cascades downward: Class A new → pushes Class A existing → pushes renovated B → pushes unrenovated B.',
  },
];

const LIKE_KIND_PATTERNS = [
  {
    pattern: 'Cross-Market Pricing Anomaly',
    detection: 'Markets where like-kind rent PSF is >15% below the national like-kind average AND traffic/demand signals are strong = UNDERPRICED MARKETS.',
  },
  {
    pattern: 'Operational Benchmark Gap',
    detection: "Compare operational metrics across like-kind properties. Properties performing below the like-kind national benchmark have operational upside regardless of market conditions.",
  },
  {
    pattern: 'Rent Growth Divergence',
    detection: "When one market's like-kind cohort grows significantly faster than others, it signals either a catch-up play or a bubble. Cross-reference with traffic trajectory to distinguish.",
  },
];

const THREAT_COLORS = {
  HIGH: 'bg-red-100 text-red-700',
  MODERATE: 'bg-amber-100 text-amber-700',
  LOW: 'bg-emerald-100 text-emerald-700',
} as const;

const BENCHMARK_COLORS = {
  ABOVE: 'text-emerald-600',
  AT: 'text-stone-500',
  BELOW: 'text-red-600',
} as const;

const BENCHMARK_ICONS = {
  ABOVE: '↑',
  AT: '→',
  BELOW: '↓',
} as const;

const CompAnalysisPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'trade-area' | 'like-kind'>('trade-area');
  const [tradeSort, setTradeSort] = useState<'threat' | 'rent' | 'distance'>('threat');
  const [likeKindSort, setLikeKindSort] = useState<'pcs' | 'anomaly' | 'growth'>('pcs');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const propertyParam = searchParams.get('property');
  const initialProperty = propertyParam
    ? SUBJECT_PROPERTIES.find(p => p.name.toLowerCase() === propertyParam.toLowerCase()) || SUBJECT_PROPERTIES[0]
    : SUBJECT_PROPERTIES[0];
  const [selectedProperty, setSelectedProperty] = useState(initialProperty);

  useEffect(() => {
    if (propertyParam) {
      const found = SUBJECT_PROPERTIES.find(p => p.name.toLowerCase() === propertyParam.toLowerCase());
      if (found) setSelectedProperty(found);
    }
  }, [propertyParam]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setSearchText('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredProperties = SUBJECT_PROPERTIES.filter(p =>
    p.name.toLowerCase().includes(searchText.toLowerCase()) ||
    p.submarket.toLowerCase().includes(searchText.toLowerCase())
  );

  const sortedTradeArea = [...TRADE_AREA_COMPS].sort((a, b) => {
    if (tradeSort === 'threat') {
      const order = { HIGH: 0, MODERATE: 1, LOW: 2 };
      return order[a.threat] - order[b.threat];
    }
    if (tradeSort === 'rent') return b.avgRent - a.avgRent;
    return parseFloat(a.distance) - parseFloat(b.distance);
  });

  const sortedLikeKind = [...LIKE_KIND_COMPS].sort((a, b) => {
    if (likeKindSort === 'pcs') return b.pcsScore - a.pcsScore;
    if (likeKindSort === 'anomaly') return (b.pricingAnomaly ? 1 : 0) - (a.pricingAnomaly ? 1 : 0);
    return b.rentGrowthYoY - a.rentGrowthYoY;
  });

  const subjectProperty = { name: selectedProperty.name, avgRent: selectedProperty.avgRent, rentPSF: selectedProperty.rentPSF };

  return (
    <div className="space-y-5">
      <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-violet-500">
        <div className="text-[10px] font-mono text-violet-400 tracking-widest mb-1">THE DECISION THIS PAGE DRIVES</div>
        <div className="text-lg font-semibold">How does your property compare locally and nationally — and what patterns emerge?</div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-stone-900">Dual Comp Analysis</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-mono">MOCK DATA</span>
            <span className="text-[10px] text-stone-400">2 lenses | Trade Area + Like-Kind</span>
          </div>
        </div>

        <div className="mb-4" ref={dropdownRef}>
          <div className="text-[10px] font-mono text-stone-400 tracking-wider mb-1.5">SUBJECT PROPERTY</div>
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-lg text-left hover:border-violet-300 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600 text-sm font-bold">{selectedProperty.class}</div>
                <div>
                  <div className="text-sm font-semibold text-stone-900">{selectedProperty.name}</div>
                  <div className="text-[10px] text-stone-500">{selectedProperty.units} units · {selectedProperty.submarket} · ${selectedProperty.avgRent.toLocaleString()}/mo · ${selectedProperty.rentPSF}/sqft</div>
                </div>
              </div>
              <svg className={`w-4 h-4 text-stone-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {dropdownOpen && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-stone-200 rounded-lg shadow-lg overflow-hidden">
                <div className="p-2 border-b border-stone-100">
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Search properties..."
                    className="w-full px-3 py-1.5 text-sm border border-stone-200 rounded-md focus:outline-none focus:border-violet-400"
                    autoFocus
                  />
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {filteredProperties.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedProperty(p); setDropdownOpen(false); setSearchText(''); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-violet-50 transition-colors ${selectedProperty.id === p.id ? 'bg-violet-50' : ''}`}
                    >
                      <div className="w-7 h-7 rounded-md bg-stone-100 flex items-center justify-center text-[10px] font-bold text-stone-600">{p.class}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-stone-900 truncate">{p.name}</div>
                        <div className="text-[10px] text-stone-500">{p.units} units · {p.submarket} · ${p.avgRent.toLocaleString()}/mo</div>
                      </div>
                      {selectedProperty.id === p.id && <div className="w-2 h-2 rounded-full bg-violet-500" />}
                    </button>
                  ))}
                  {filteredProperties.length === 0 && (
                    <div className="px-4 py-3 text-xs text-stone-400 text-center">No properties found</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {COMP_VITALS.map(vital => (
            <div key={vital.id} className="border border-stone-200 rounded-lg p-3 hover:border-stone-300 transition-colors">
              <div className="text-[10px] font-mono text-stone-400 tracking-wider mb-1">{vital.label}</div>
              <div className="text-xl font-bold text-stone-900">{vital.value}</div>
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-[10px] font-medium ${vital.trendDirection === 'up' ? 'text-emerald-600' : vital.trendDirection === 'down' ? 'text-red-500' : 'text-stone-500'}`}>
                  {vital.trendDirection === 'up' ? '↑' : vital.trendDirection === 'down' ? '↓' : '→'} {vital.trend}
                </span>
              </div>
              <div className="mt-2 h-6 flex items-end gap-px">
                {vital.sparklineData.slice(-12).map((v, i, arr) => {
                  const min = Math.min(...arr);
                  const max = Math.max(...arr);
                  const range = max - min || 1;
                  const height = ((v - min) / range) * 100;
                  return (
                    <div key={i} className={`flex-1 rounded-sm ${i === arr.length - 1 ? 'bg-violet-500' : 'bg-stone-200'}`} style={{ height: `${Math.max(10, height)}%` }} />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-violet-50 border border-violet-200 rounded-xl px-5 py-3">
        <p className="text-sm text-violet-900">
          Dual comp analysis active across <strong>24 trade area comps</strong> and <strong>38 like-kind peers</strong> spanning 6 MSAs. Average rent premium of +$127 vs local competition with a $302 rent ceiling gap — indicating significant upside through renovation and repositioning. Cross-market score of 74 suggests strong relative performance.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-stone-900 mb-1">Comparable Properties</h3>
            <p className="text-sm text-stone-500">Side-by-side analysis of competitive set across both lenses</p>
          </div>
          <div className="flex bg-stone-100 rounded-lg p-0.5">
            <button onClick={() => setActiveTab('trade-area')} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeTab === 'trade-area' ? 'bg-white text-violet-700 shadow-sm' : 'text-stone-500'}`}>Trade Area (8)</button>
            <button onClick={() => setActiveTab('like-kind')} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeTab === 'like-kind' ? 'bg-white text-violet-700 shadow-sm' : 'text-stone-500'}`}>Like-Kind (10)</button>
          </div>
        </div>

        {activeTab === 'trade-area' && (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[10px] text-stone-500">
                <span className="font-mono">SUBJECT:</span>
                <span className="font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded">{subjectProperty.name} — ${subjectProperty.avgRent}/mo — ${subjectProperty.rentPSF}/sqft</span>
              </div>
              <div className="flex bg-stone-100 rounded-lg p-0.5">
                <button onClick={() => setTradeSort('threat')} className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-colors ${tradeSort === 'threat' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>By Threat</button>
                <button onClick={() => setTradeSort('rent')} className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-colors ${tradeSort === 'rent' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>By Rent</button>
                <button onClick={() => setTradeSort('distance')} className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-colors ${tradeSort === 'distance' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>By Distance</button>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-stone-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 text-left">
                    <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">PROPERTY</th>
                    <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">DISTANCE</th>
                    <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">AVG RENT</th>
                    <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">RENT PSF</th>
                    <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">OCCUPANCY</th>
                    <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">vs SUBJECT</th>
                    <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">TRAFFIC</th>
                    <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">AMENITY</th>
                    <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">THREAT</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTradeArea.map((comp, i) => (
                    <tr key={i} className="border-t border-stone-100 hover:bg-violet-50/30 transition-colors">
                      <td className="px-3 py-3">
                        <div className="font-semibold text-stone-900 text-xs">{comp.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-stone-500">{comp.units} units</span>
                          <span className="text-[10px] text-stone-300">·</span>
                          <span className={`text-[10px] font-bold px-1.5 rounded ${comp.class.startsWith('A') ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>{comp.class}</span>
                          <span className="text-[10px] text-stone-300">·</span>
                          <span className="text-[10px] text-stone-500">{comp.yearBuilt}</span>
                          {comp.recentReno && <span className="text-[9px] bg-amber-100 text-amber-700 px-1 rounded font-bold">RENO</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs font-mono text-stone-600">{comp.distance}</td>
                      <td className="px-3 py-3 text-xs font-bold text-stone-900">${comp.avgRent.toLocaleString()}</td>
                      <td className="px-3 py-3 text-xs font-mono text-stone-600">${comp.rentPSF.toFixed(2)}</td>
                      <td className="px-3 py-3 text-xs text-stone-700">{comp.occupancy}%</td>
                      <td className="px-3 py-3">
                        <span className={`text-xs font-bold ${comp.rentDelta >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {comp.rentDelta >= 0 ? '+' : ''}{comp.rentDelta >= 0 ? `$${comp.rentDelta}` : `-$${Math.abs(comp.rentDelta)}`}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs font-mono text-stone-600">#{comp.trafficRank}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-10 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-violet-500" style={{ width: `${comp.amenityScore}%` }} />
                          </div>
                          <span className="text-[10px] text-stone-500">{comp.amenityScore}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${THREAT_COLORS[comp.threat]}`}>{comp.threat}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex gap-5 text-[10px] text-stone-500">
              <span>vs Subject = rent difference from your property</span>
              <span className="text-stone-300">|</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-100 inline-block" /> HIGH threat comps charging more, closer, newer</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-100 inline-block" /> MODERATE competitive overlap</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-100 inline-block" /> LOW direct threat</span>
            </div>
          </>
        )}

        {activeTab === 'like-kind' && (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[10px] text-stone-500">
                <span className="font-mono">LIKE-KIND CRITERIA:</span>
                <span className="font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded">200–400 units · Class B/B+ · 2005–2020 vintage</span>
              </div>
              <div className="flex bg-stone-100 rounded-lg p-0.5">
                <button onClick={() => setLikeKindSort('pcs')} className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-colors ${likeKindSort === 'pcs' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>By PCS</button>
                <button onClick={() => setLikeKindSort('anomaly')} className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-colors ${likeKindSort === 'anomaly' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>By Anomaly</button>
                <button onClick={() => setLikeKindSort('growth')} className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-colors ${likeKindSort === 'growth' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>By Growth</button>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-stone-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 text-left">
                    <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">PROPERTY</th>
                    <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">MARKET</th>
                    <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">AVG RENT</th>
                    <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">RENT PSF</th>
                    <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">OCC</th>
                    <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">RENT GROWTH</th>
                    <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">PCS</th>
                    <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">OP BENCH</th>
                    <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">SIGNALS</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLikeKind.map((comp, i) => (
                    <tr key={i} className={`border-t border-stone-100 transition-colors ${comp.collision ? 'bg-violet-50/50 hover:bg-violet-50' : 'hover:bg-violet-50/30'}`}>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-stone-900 text-xs">{comp.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-stone-500">{comp.units} units</span>
                          <span className="text-[10px] text-stone-300">·</span>
                          <span className={`text-[10px] font-bold px-1.5 rounded ${comp.class.startsWith('A') ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>{comp.class}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-stone-600">{comp.market}</td>
                      <td className="px-3 py-3 text-xs font-bold text-stone-900">${comp.avgRent.toLocaleString()}</td>
                      <td className="px-3 py-3 text-xs font-mono text-stone-600">${comp.rentPSF.toFixed(2)}</td>
                      <td className="px-3 py-3 text-xs text-stone-700">{comp.occupancy}%</td>
                      <td className="px-3 py-3">
                        <span className={`text-xs font-bold ${comp.rentGrowthYoY >= 5 ? 'text-emerald-600' : comp.rentGrowthYoY >= 3 ? 'text-stone-600' : 'text-red-500'}`}>
                          +{comp.rentGrowthYoY}%
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-10 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${comp.pcsScore >= 75 ? 'bg-emerald-500' : comp.pcsScore >= 65 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${comp.pcsScore}%` }} />
                          </div>
                          <span className="text-[10px] font-mono text-stone-600">{comp.pcsScore}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-xs font-bold ${BENCHMARK_COLORS[comp.opBenchmark]}`}>
                          {BENCHMARK_ICONS[comp.opBenchmark]} {comp.opBenchmark}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {comp.pricingAnomaly && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">UNDERPRICED</span>}
                          {comp.collision && <span className="text-[9px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-bold">⚡ COLLISION</span>}
                          {comp.opBenchmark === 'BELOW' && <span className="text-[9px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">Op Gap</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex gap-5 text-[10px] text-stone-500">
              <span className="flex items-center gap-1"><span className="text-[9px] bg-amber-100 text-amber-700 px-1 rounded font-bold inline-block">UNDERPRICED</span> Rent PSF &gt;15% below like-kind avg</span>
              <span className="flex items-center gap-1"><span className="text-[9px] bg-violet-100 text-violet-700 px-1 rounded font-bold inline-block">⚡ COLLISION</span> Flagged in both Trade Area + Like-Kind lenses</span>
              <span className="flex items-center gap-1"><span className="text-[9px] bg-red-50 text-red-600 px-1 rounded font-medium inline-block">Op Gap</span> Below national operational benchmark</span>
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center gap-3 mb-1">
          <h3 className="text-lg font-bold text-stone-900">Competition Lens — Trade Area Comps</h3>
          <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-mono">LENS 1</span>
        </div>
        <p className="text-sm text-stone-500 mb-5">Properties within the defined trade area that compete for the SAME renter pool</p>

        <div className="grid grid-cols-3 gap-4">
          {TRADE_AREA_PATTERNS.map((p, i) => (
            <div key={i} className="border border-violet-200 rounded-lg p-4 bg-violet-50/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-violet-500" />
                <div className="text-sm font-bold text-stone-900">{p.pattern}</div>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">{p.detection}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center gap-3 mb-1">
          <h3 className="text-lg font-bold text-stone-900">Like-Kind Lens — Cross-Market Comps</h3>
          <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-mono">LENS 2</span>
        </div>
        <p className="text-sm text-stone-500 mb-5">Properties with similar attributes across different submarkets or MSAs</p>

        <div className="grid grid-cols-3 gap-4">
          {LIKE_KIND_PATTERNS.map((p, i) => (
            <div key={i} className="border border-violet-200 rounded-lg p-4 bg-violet-50/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-violet-500" />
                <div className="text-sm font-bold text-stone-900">{p.pattern}</div>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">{p.detection}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center gap-3 mb-2">
          <h3 className="text-lg font-bold text-stone-900">Collision Output</h3>
          <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-mono">SIGNAL AMPLIFIER</span>
        </div>
        <div className="bg-stone-50 rounded-lg p-5 border border-stone-200">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-lg font-bold">⚡</div>
            <div>
              <p className="text-sm text-stone-700 leading-relaxed">
                When both lenses find the same property, the signal is amplified. A property that ranks low in its trade area AND ranks below like-kind benchmarks has <strong>BOTH local competitive problems AND operational problems</strong> — maximum value-add potential.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="bg-white rounded-lg p-3 border border-stone-200 text-center">
                  <div className="text-[10px] font-mono text-stone-400 tracking-wider">TRADE AREA SIGNAL</div>
                  <div className="text-sm font-bold text-violet-600 mt-1">Below Local Avg</div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-stone-200 text-center">
                  <div className="text-lg font-bold text-amber-500">+</div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-stone-200 text-center">
                  <div className="text-[10px] font-mono text-stone-400 tracking-wider">LIKE-KIND SIGNAL</div>
                  <div className="text-sm font-bold text-violet-600 mt-1">Below National Benchmark</div>
                </div>
              </div>
              <div className="mt-3 bg-violet-50 border border-violet-200 rounded-lg p-3 text-center">
                <div className="text-[10px] font-mono text-violet-400 tracking-widest">COLLISION RESULT</div>
                <div className="text-sm font-bold text-violet-700 mt-1">Maximum Value-Add Target — Dual Signal Confirmed</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompAnalysisPage;
