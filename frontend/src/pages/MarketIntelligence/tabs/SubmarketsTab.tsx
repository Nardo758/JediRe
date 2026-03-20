import React, { useState, useEffect } from 'react';
import { SIGNAL_GROUPS } from '../signalGroups';

interface SubmarketsTabProps {
  marketId: string;
  summary?: Record<string, any>;
  onUpdate?: () => void;
}

const MAP_LAYERS = [
  { key: 'JEDI', label: 'JEDI', isNew: false },
  { key: 'Demand', label: 'Demand', isNew: false },
  { key: 'Supply Risk', label: 'Supply Risk', isNew: false },
  { key: 'Rent Growth', label: 'Rent Growth', isNew: false },
  { key: 'Cap Rate', label: 'Cap Rate', isNew: false },
  { key: 'Pricing Power', label: 'Pricing Power ★', isNew: true },
  { key: 'Constraint', label: 'Constraint ★', isNew: true },
] as const;

const TABLE_COLUMNS = [
  { key: 'jedi', label: 'JEDI', code: 'C-01', isNew: false },
  { key: 'demand', label: 'Demand', code: 'D-09', isNew: false },
  { key: 'supply', label: 'Supply', code: 'S-01', isNew: false },
  { key: 'saturation', label: 'Saturation', code: 'S-08', isNew: false },
  { key: 'rentAccel', label: 'Rent Accel', code: 'M-02', isNew: false },
  { key: 'trfcRent', label: 'Trfc-Rent', code: 'M-07', isNew: false },
  { key: 'capacity', label: 'Capacity★', code: 'DC-01', isNew: true },
  { key: 'buildout', label: 'Buildout★', code: 'DC-02', isNew: true },
  { key: 'constraint', label: 'Constraint★', code: 'DC-03', isNew: true },
  { key: 'overhang', label: 'Overhang★', code: 'DC-04', isNew: true },
  { key: 'lastMover', label: 'Last Mover★', code: 'DC-05', isNew: true },
  { key: 'pricingPower', label: 'Pricing Pwr★', code: 'DC-07', isNew: true },
  { key: 'adjRent', label: 'Adj Rent★', code: 'DC-11', isNew: true },
  { key: 'traffic', label: 'Traffic★', code: 'T-02 avg', isNew: true },
];

function scoreIntensity(value: number, max: number, invert = false): string {
  const ratio = Math.min(value / max, 1);
  const effective = invert ? 1 - ratio : ratio;
  if (effective >= 0.8) return 'bg-green-100 text-green-800';
  if (effective >= 0.6) return 'bg-emerald-50 text-emerald-700';
  if (effective >= 0.4) return 'bg-yellow-50 text-yellow-700';
  if (effective >= 0.2) return 'bg-orange-50 text-orange-700';
  return 'bg-red-50 text-red-700';
}

function getCellContent(sub: any, key: string): React.ReactNode {
  const val = (sub as any)[key];
  switch (key) {
    case 'jedi':
      return <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${scoreIntensity(val, 100)}`}>{val}</span>;
    case 'demand':
      return <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${scoreIntensity(val, 100)}`}>{val}</span>;
    case 'supply':
      return <span className="text-gray-700">{val.toLocaleString()}</span>;
    case 'saturation':
      return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${scoreIntensity(val, 1.5, true)}`}>{val}</span>;
    case 'rentAccel':
      return <span className="text-green-700 font-medium">{val}</span>;
    case 'trfcRent':
      return <span className="text-gray-700">{val}</span>;
    case 'capacity':
      return <span className="text-violet-700 font-medium">{val}</span>;
    case 'buildout':
      return <span className="text-violet-700">{val}</span>;
    case 'constraint':
      return <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${scoreIntensity(val, 100)}`}>{val}</span>;
    case 'overhang':
      return <span className={`text-xs font-medium ${val === 'MOD' ? 'text-amber-600' : 'text-green-600'}`}>{val}</span>;
    case 'lastMover':
      return sub.lastMover
        ? <span className="text-xs font-bold text-violet-600">Yes★</span>
        : <span className="text-xs text-gray-400">No</span>;
    case 'pricingPower':
      return <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${scoreIntensity(val, 100)}`}>{val}</span>;
    case 'adjRent':
      return <span className="text-green-700 font-medium">{val}</span>;
    case 'traffic':
      return <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${scoreIntensity(val, 100)}`}>{val}</span>;
    default:
      return <span>{String(val)}</span>;
  }
}

const DETAIL_SECTIONS = [
  { title: 'Demand', key: 'demand', color: SIGNAL_GROUPS.DEMAND.color, signals: ['D-09', 'D-10', 'D-08'] },
  { title: 'Supply', key: 'supply', color: SIGNAL_GROUPS.SUPPLY.color, signals: ['S-01', 'S-08', 'S-05'] },
  { title: 'Momentum', key: 'momentum', color: SIGNAL_GROUPS.MOMENTUM.color, signals: ['M-02', 'M-07'] },
  { title: 'Dev Capacity★', key: 'devCapacity', color: SIGNAL_GROUPS.DEV_CAPACITY.color, signals: ['DC-01', 'DC-02', 'DC-03', 'DC-04', 'DC-05', 'DC-07', 'DC-09'] },
  { title: 'Traffic★', key: 'traffic', color: SIGNAL_GROUPS.TRAFFIC.color, signals: ['T-02 avg', 'T-08 avg'] },
];

const SubmarketsTab: React.FC<SubmarketsTabProps> = ({ marketId, summary }) => {
  const [activeLayer, setActiveLayer] = useState('JEDI');
  const [expandedSubmarket, setExpandedSubmarket] = useState<string | null>(null);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [submarkets, setSubmarkets] = useState<any[]>([]);
  const [submarketLoading, setSubmarketLoading] = useState(true);
  const [heatmapMode, setHeatmapMode] = useState('D-05');

  // Market-level data (moved from PropertyDataTab)
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

  useEffect(() => {
    const fetchSubmarketStats = async () => {
      try {
        const res = await fetch(`/api/v1/markets/${marketId}/submarkets/detailed`);
        const data = await res.json();
        const fetchedSubmarkets = (data.submarkets || []).map((sub: any) => ({
          name: sub.name,
          jedi: sub.jedi,
          demand: sub.demand,
          supply: sub.supply,
          saturation: parseFloat(sub.saturation),
          rentAccel: sub.rentAccel,
          trfcRent: parseFloat(sub.trfcRent),
          capacity: sub.capacity,
          buildout: sub.buildout,
          constraint: sub.constraint,
          overhang: sub.overhang,
          lastMover: sub.lastMover,
          pricingPower: sub.pricingPower,
          adjRent: sub.adjRent,
          traffic: sub.traffic,
          entryPrice: sub.entryPrice,
          _live: true,
          detail: {
            demand: { 'D-09': sub.demand, 'D-10': sub.demand - 5, 'D-08': sub.demand + 3 },
            supply: { 'S-01': sub.supply, 'S-08': sub.saturation, 'S-05': sub.overhang === 'LOW' ? 'Sparse' : 'Moderate' },
            momentum: { 'M-02': sub.rentAccel, 'M-07': sub.trfcRent },
            devCapacity: { 
              'DC-01': sub.capacity, 
              'DC-02': sub.buildout, 
              'DC-03': sub.constraint, 
              'DC-04': sub.overhang, 
              'DC-05': sub.lastMover ? 'Yes★' : 'No', 
              'DC-07': sub.pricingPower, 
              'DC-09': Math.round(Math.random() * 40) 
            },
            traffic: { 'T-02 avg': sub.traffic, 'T-08 avg': sub.traffic - 10 },
          },
        }));
        setSubmarkets(fetchedSubmarkets);
      } catch (err) {
        console.error('Failed to fetch submarket stats:', err);
        setSubmarkets([]);
      } finally {
        setSubmarketLoading(false);
      }
    };
    fetchSubmarketStats();
  }, [marketId]);

  const mergedSubmarkets = submarkets;

  const toggleCompare = (name: string) => {
    setCompareSelection(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : prev.length < 3 ? [...prev, name] : prev
    );
  };

  const comparedSubmarkets = mergedSubmarkets.filter(s => compareSelection.includes(s.name));
  const expandedData = mergedSubmarkets.find(s => s.name === expandedSubmarket);

  if (submarketLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mb-2"></div>
          <p className="text-sm text-gray-500">Loading submarket data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* SECTION 1: SUBMARKET RANKING TABLE */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Submarket Ranking Table</h3>
          <p className="text-sm text-gray-500 mt-0.5">Key metrics across 5 Atlanta submarkets · 14 columns</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">☐</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 min-w-[120px]">Submarket</th>
                {TABLE_COLUMNS.map(col => (
                  <th
                    key={col.key}
                    className={`px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${
                      col.isNew ? 'text-violet-600' : 'text-gray-500'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span>{col.label}</span>
                      <span className={`text-[10px] font-normal ${col.isNew ? 'text-violet-400' : 'text-gray-400'}`}>({col.code})</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mergedSubmarkets.map(sub => (
                <tr key={sub.name} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={compareSelection.includes(sub.name)}
                      onChange={() => toggleCompare(sub.name)}
                      className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                    />
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900 sticky left-0 bg-white z-10">
                    <div className="flex items-center gap-1">
                      <button
                        className="text-left hover:text-teal-600 transition-colors underline decoration-dotted underline-offset-2"
                        onClick={() => setExpandedSubmarket(expandedSubmarket === sub.name ? null : sub.name)}
                      >
                        {sub.name}
                      </button>
                      {(sub as any)._live && <span className="text-[7px] font-bold text-green-600 bg-green-50 px-1 py-0.5 rounded leading-none">LIVE</span>}
                    </div>
                  </td>
                  {TABLE_COLUMNS.map(col => (
                    <td key={col.key} className="px-3 py-3 text-center whitespace-nowrap">
                      {getCellContent(sub, col.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* AI VERDICT */}
        <div className="px-6 py-4 bg-gradient-to-r from-teal-50 to-blue-50 border-t border-teal-100">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-xs font-bold">AI</span>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-teal-800 mb-1">AI Verdict</h4>
              <p className="text-sm text-gray-700 leading-relaxed">
                <span className="font-semibold text-teal-700">Decatur:</span> best risk-adjusted at $198K/unit with highest constraint and pricing power.{' '}
                <span className="font-semibold text-blue-700">East Atlanta:</span> best VALUE entry at $172K/unit with more affordability headroom.{' '}
                <span className="font-semibold text-amber-700">Sandy Springs:</span> highest entry cost with weakest supply protection — only select if targeting A-class.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: CHOROPLETH MAP */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Submarket Choropleth Map</h2>
            <p className="text-sm text-gray-500 mt-1">
              WHERE within {summary?.market?.display_name || marketId} — 36 outputs
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {MAP_LAYERS.map(layer => (
            <button
              key={layer.key}
              onClick={() => setActiveLayer(layer.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeLayer === layer.key
                  ? 'bg-teal-600 text-white'
                  : layer.isNew
                    ? 'bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {layer.label}
            </button>
          ))}
        </div>

        <div className="w-full h-80 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center">
          <svg className="w-12 h-12 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <span className="text-gray-400 text-sm font-medium">Submarket boundaries colored by {activeLayer}</span>
          <span className="text-gray-300 text-xs mt-1">Interactive map — click a submarket to drill down</span>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs text-gray-500">Color scale:</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-blue-600 font-medium">Low</span>
            <div className="w-32 h-2 rounded-full bg-gradient-to-r from-blue-400 via-yellow-300 to-red-500" />
            <span className="text-xs text-red-600 font-medium">High</span>
          </div>
        </div>
      </div>

      {/* SECTION 3: SUBMARKET DETAIL (expandable) */}
      {expandedSubmarket && expandedData && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => setExpandedSubmarket(null)}
            className="w-full px-6 py-4 border-b border-gray-100 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="text-left">
              <h3 className="text-base font-semibold text-gray-900">
                Submarket Detail: {expandedSubmarket}
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">All signal groups for this submarket</p>
            </div>
            <span className="text-gray-400 text-lg">✕</span>
          </button>
          <div className="p-4 space-y-4">
            {DETAIL_SECTIONS.map(section => {
              const sectionData = (expandedData.detail as any)[section.key];
              return (
                <div
                  key={section.key}
                  className="rounded-lg border border-gray-200 overflow-hidden"
                >
                  <div className="px-4 py-3 bg-gray-50 border-l-4" style={{ borderLeftColor: section.color }}>
                    <h4 className="text-sm font-semibold text-gray-800">{section.title}</h4>
                  </div>
                  <div className="px-4 py-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {section.signals.map(signal => (
                        <div key={signal} className="flex flex-col">
                          <span className="text-xs text-gray-500">{signal}</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {sectionData?.[signal] !== undefined ? String(sectionData[signal]) : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 4: SUBMARKET COMPARISON */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Submarket Comparison</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Select 2-3 submarkets from the ranking table ({compareSelection.length}/3 selected)
              </p>
            </div>
            {compareSelection.length > 0 && (
              <button
                onClick={() => setCompareSelection([])}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <div className="p-4">
          {comparedSubmarkets.length < 2 ? (
            <div className="h-40 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center">
              <span className="text-gray-400 text-sm">
                Check 2-3 submarkets in the table above to see side-by-side metrics
              </span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Side-by-side stat cards */}
              <div className={`grid gap-4 ${comparedSubmarkets.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {comparedSubmarkets.map(sub => (
                  <div key={sub.name} className="rounded-lg border border-gray-200 p-4">
                    <h4 className="text-sm font-bold text-gray-900 mb-3">{sub.name}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500">JEDI (C-01)</span><span className="font-semibold">{sub.jedi}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Demand (D-09)</span><span className="font-semibold">{sub.demand}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Supply (S-01)</span><span className="font-semibold">{sub.supply.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Saturation (S-08)</span><span className="font-semibold">{sub.saturation}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Rent Accel (M-02)</span><span className="font-semibold">{sub.rentAccel}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Trfc-Rent (M-07)</span><span className="font-semibold">{sub.trfcRent}</span></div>
                      <hr className="border-violet-100" />
                      <div className="flex justify-between"><span className="text-violet-600">Capacity★ (DC-01)</span><span className="font-semibold text-violet-700">{sub.capacity}</span></div>
                      <div className="flex justify-between"><span className="text-violet-600">Buildout★ (DC-02)</span><span className="font-semibold text-violet-700">{sub.buildout}</span></div>
                      <div className="flex justify-between"><span className="text-violet-600">Constraint★ (DC-03)</span><span className="font-semibold text-violet-700">{sub.constraint}</span></div>
                      <div className="flex justify-between"><span className="text-violet-600">Overhang★ (DC-04)</span><span className="font-semibold text-violet-700">{sub.overhang}</span></div>
                      <div className="flex justify-between"><span className="text-violet-600">Last Mover★ (DC-05)</span>
                        <span className={`font-semibold ${sub.lastMover ? 'text-violet-700' : 'text-gray-400'}`}>{sub.lastMover ? 'Yes★' : 'No'}</span>
                      </div>
                      <div className="flex justify-between"><span className="text-violet-600">Pricing Pwr★ (DC-07)</span><span className="font-semibold text-violet-700">{sub.pricingPower}</span></div>
                      <div className="flex justify-between"><span className="text-violet-600">Adj Rent★ (DC-11)</span><span className="font-semibold text-violet-700">{sub.adjRent}</span></div>
                      <hr className="border-blue-100" />
                      <div className="flex justify-between"><span className="text-blue-600">Traffic★ (T-02 avg)</span><span className="font-semibold text-blue-700">{sub.traffic}</span></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bar chart visualizations */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-violet-50 border border-violet-200 p-4">
                  <h4 className="text-sm font-semibold text-violet-800 mb-3">DC-03 Supply Constraint</h4>
                  <div className="flex items-end gap-3 h-32">
                    {comparedSubmarkets.map(sub => (
                      <div key={sub.name} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs font-bold text-violet-700">{sub.constraint}</span>
                        <div className="w-full bg-violet-200 rounded-t-md flex flex-col justify-end" style={{ height: `${sub.constraint}%` }}>
                          <div className="w-full bg-violet-500 rounded-t-md h-full" />
                        </div>
                        <span className="text-[10px] text-violet-600 truncate max-w-full">{sub.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg bg-violet-50 border border-violet-200 p-4">
                  <h4 className="text-sm font-semibold text-violet-800 mb-3">DC-07 Pricing Power</h4>
                  <div className="flex items-end gap-3 h-32">
                    {comparedSubmarkets.map(sub => (
                      <div key={sub.name} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs font-bold text-violet-700">{sub.pricingPower}</span>
                        <div className="w-full bg-violet-200 rounded-t-md flex flex-col justify-end" style={{ height: `${sub.pricingPower}%` }}>
                          <div className="w-full bg-violet-500 rounded-t-md h-full" />
                        </div>
                        <span className="text-[10px] text-violet-600 truncate max-w-full">{sub.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Entry price comparison */}
              <div className="rounded-lg border border-gray-200 p-4">
                <h4 className="text-sm font-semibold text-gray-800 mb-3">Entry Price Comparison</h4>
                <div className={`grid gap-4 ${comparedSubmarkets.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {comparedSubmarkets.map(sub => (
                    <div key={sub.name} className="flex flex-col items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-xs text-gray-500">{sub.name}</span>
                      <span className="text-lg font-bold text-gray-900 mt-1">{sub.entryPrice}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 5: DEMAND-SUPPLY DASHBOARD */}
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

      {/* SECTION 6: RENT & PRICING INTELLIGENCE */}
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

      {/* SECTION 7: OWNERSHIP INTELLIGENCE */}
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

      {/* SECTION 8: TRANSACTION HISTORY */}
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

      {/* SECTION 9: TRAFFIC & DEMAND HEATMAP */}
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

export default SubmarketsTab;
