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

const mockSubmarkets = [
  {
    name: 'Buckhead', jedi: 92, demand: 88, supply: 2800, saturation: 1.12,
    rentAccel: '+5.2%', trfcRent: 1.8, capacity: '42%', buildout: '6.2yr',
    constraint: 52, overhang: 'MOD', lastMover: false, pricingPower: 68,
    adjRent: '+4.8%', traffic: 84, entryPrice: '$242K/unit',
    detail: {
      demand: { 'D-09': 88, 'D-10': 82, 'D-08': 91 },
      supply: { 'S-01': 2800, 'S-08': 1.12, 'S-05': 'Clustered' },
      momentum: { 'M-02': '+5.2%', 'M-07': 1.8 },
      devCapacity: { 'DC-01': '42%', 'DC-02': '6.2yr', 'DC-03': 52, 'DC-04': 'MOD', 'DC-05': 'No', 'DC-07': 68, 'DC-09': 34 },
      traffic: { 'T-02 avg': 84, 'T-08 avg': 76 },
    },
  },
  {
    name: 'Midtown', jedi: 89, demand: 86, supply: 3200, saturation: 1.08,
    rentAccel: '+4.8%', trfcRent: 2.1, capacity: '38%', buildout: '7.4yr',
    constraint: 62, overhang: 'LOW', lastMover: false, pricingPower: 74,
    adjRent: '+5.1%', traffic: 88, entryPrice: '$228K/unit',
    detail: {
      demand: { 'D-09': 86, 'D-10': 79, 'D-08': 88 },
      supply: { 'S-01': 3200, 'S-08': 1.08, 'S-05': 'Moderate' },
      momentum: { 'M-02': '+4.8%', 'M-07': 2.1 },
      devCapacity: { 'DC-01': '38%', 'DC-02': '7.4yr', 'DC-03': 62, 'DC-04': 'LOW', 'DC-05': 'No', 'DC-07': 74, 'DC-09': 41 },
      traffic: { 'T-02 avg': 88, 'T-08 avg': 82 },
    },
  },
  {
    name: 'Decatur', jedi: 86, demand: 78, supply: 1200, saturation: 0.82,
    rentAccel: '+4.2%', trfcRent: 2.4, capacity: '18%', buildout: '12.8yr',
    constraint: 82, overhang: 'LOW', lastMover: true, pricingPower: 86,
    adjRent: '+5.8%', traffic: 72, entryPrice: '$198K/unit',
    detail: {
      demand: { 'D-09': 78, 'D-10': 71, 'D-08': 74 },
      supply: { 'S-01': 1200, 'S-08': 0.82, 'S-05': 'Sparse' },
      momentum: { 'M-02': '+4.2%', 'M-07': 2.4 },
      devCapacity: { 'DC-01': '18%', 'DC-02': '12.8yr', 'DC-03': 82, 'DC-04': 'LOW', 'DC-05': 'Yes★', 'DC-07': 86, 'DC-09': 12 },
      traffic: { 'T-02 avg': 72, 'T-08 avg': 64 },
    },
  },
  {
    name: 'Sandy Springs', jedi: 84, demand: 74, supply: 1800, saturation: 0.92,
    rentAccel: '+3.8%', trfcRent: 1.6, capacity: '28%', buildout: '9.2yr',
    constraint: 72, overhang: 'LOW', lastMover: false, pricingPower: 78,
    adjRent: '+4.4%', traffic: 76, entryPrice: '$262K/unit',
    detail: {
      demand: { 'D-09': 74, 'D-10': 68, 'D-08': 71 },
      supply: { 'S-01': 1800, 'S-08': 0.92, 'S-05': 'Moderate' },
      momentum: { 'M-02': '+3.8%', 'M-07': 1.6 },
      devCapacity: { 'DC-01': '28%', 'DC-02': '9.2yr', 'DC-03': 72, 'DC-04': 'LOW', 'DC-05': 'No', 'DC-07': 78, 'DC-09': 22 },
      traffic: { 'T-02 avg': 76, 'T-08 avg': 71 },
    },
  },
  {
    name: 'East Atlanta', jedi: 82, demand: 72, supply: 800, saturation: 0.74,
    rentAccel: '+3.5%', trfcRent: 2.8, capacity: '15%', buildout: '18.4yr',
    constraint: 88, overhang: 'LOW', lastMover: true, pricingPower: 92,
    adjRent: '+6.2%', traffic: 68, entryPrice: '$172K/unit',
    detail: {
      demand: { 'D-09': 72, 'D-10': 65, 'D-08': 68 },
      supply: { 'S-01': 800, 'S-08': 0.74, 'S-05': 'Very Sparse' },
      momentum: { 'M-02': '+3.5%', 'M-07': 2.8 },
      devCapacity: { 'DC-01': '15%', 'DC-02': '18.4yr', 'DC-03': 88, 'DC-04': 'LOW', 'DC-05': 'Yes★', 'DC-07': 92, 'DC-09': 8 },
      traffic: { 'T-02 avg': 68, 'T-08 avg': 58 },
    },
  },
];

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

function getCellContent(sub: typeof mockSubmarkets[0], key: string): React.ReactNode {
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
  const [liveSubmarketStats, setLiveSubmarketStats] = useState<any[]>([]);
  const [submarketLoading, setSubmarketLoading] = useState(true);

  useEffect(() => {
    const fetchSubmarketStats = async () => {
      try {
        const res = await fetch(`/api/v1/markets/submarket-stats/${marketId}`);
        const data = await res.json();
        setLiveSubmarketStats(data.submarkets || []);
      } catch (err) {
        console.error('Failed to fetch submarket stats:', err);
      } finally {
        setSubmarketLoading(false);
      }
    };
    fetchSubmarketStats();
  }, [marketId]);

  const mergedSubmarkets = mockSubmarkets.map(sub => {
    const liveStat = liveSubmarketStats.find(
      (ls: any) => ls.name?.toLowerCase() === sub.name.toLowerCase() ||
                    ls.neighborhood_code?.toLowerCase() === sub.name.toLowerCase()
    );
    if (liveStat) {
      return {
        ...sub,
        supply: liveStat.total_properties ?? sub.supply,
        _liveProperties: liveStat.total_properties,
        _liveUnits: liveStat.total_units,
        _live: true,
      };
    }
    return { ...sub, _live: false };
  });

  const toggleCompare = (name: string) => {
    setCompareSelection(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : prev.length < 3 ? [...prev, name] : prev
    );
  };

  const comparedSubmarkets = mergedSubmarkets.filter(s => compareSelection.includes(s.name));
  const expandedData = mergedSubmarkets.find(s => s.name === expandedSubmarket);

  return (
    <div className="flex flex-col gap-6">
      {/* SECTION 1: CHOROPLETH MAP */}
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

      {/* SECTION 2: SUBMARKET RANKING TABLE */}
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
    </div>
  );
};

export default SubmarketsTab;
