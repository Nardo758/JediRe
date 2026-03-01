import React, { useState } from 'react';

interface UnitComp {
  name: string;
  submarket: string;
  classType: string;
  distance: string;
  units: { type: string; sf: number; rent: number; rentPsf: number; occupancy: number }[];
}

interface AmenityGapItem {
  amenity: string;
  subject: boolean;
  compsPct: number;
  estRentLift: number;
  priority: 'high' | 'medium' | 'low';
}

const SUBJECT_UNITS = [
  { type: 'Studio', sf: 520, rent: 1350, rentPsf: 2.60, occupancy: 96.0 },
  { type: '1BR', sf: 720, rent: 1820, rentPsf: 2.53, occupancy: 95.2 },
  { type: '2BR', sf: 1050, rent: 2480, rentPsf: 2.36, occupancy: 94.1 },
  { type: '3BR', sf: 1380, rent: 3150, rentPsf: 2.28, occupancy: 91.8 },
];

const MOCK_COMPS: UnitComp[] = [
  {
    name: 'The Meridian at Buckhead',
    submarket: 'Buckhead',
    classType: 'A',
    distance: '0.3 mi',
    units: [
      { type: 'Studio', sf: 510, rent: 1420, rentPsf: 2.78, occupancy: 94.5 },
      { type: '1BR', sf: 740, rent: 1950, rentPsf: 2.64, occupancy: 93.8 },
      { type: '2BR', sf: 1080, rent: 2620, rentPsf: 2.43, occupancy: 92.0 },
      { type: '3BR', sf: 1400, rent: 3280, rentPsf: 2.34, occupancy: 89.5 },
    ],
  },
  {
    name: 'Avalon Heights',
    submarket: 'Buckhead',
    classType: 'A',
    distance: '0.5 mi',
    units: [
      { type: 'Studio', sf: 490, rent: 1280, rentPsf: 2.61, occupancy: 97.0 },
      { type: '1BR', sf: 700, rent: 1780, rentPsf: 2.54, occupancy: 96.5 },
      { type: '2BR', sf: 1020, rent: 2350, rentPsf: 2.30, occupancy: 95.2 },
      { type: '3BR', sf: 1350, rent: 2980, rentPsf: 2.21, occupancy: 93.1 },
    ],
  },
  {
    name: 'Colony Square Living',
    submarket: 'Midtown',
    classType: 'A+',
    distance: '0.9 mi',
    units: [
      { type: 'Studio', sf: 540, rent: 1580, rentPsf: 2.93, occupancy: 91.2 },
      { type: '1BR', sf: 750, rent: 2180, rentPsf: 2.91, occupancy: 90.5 },
      { type: '2BR', sf: 1100, rent: 2920, rentPsf: 2.65, occupancy: 89.8 },
      { type: '3BR', sf: 1420, rent: 3650, rentPsf: 2.57, occupancy: 87.2 },
    ],
  },
  {
    name: 'Peachtree Station Lofts',
    submarket: 'Midtown',
    classType: 'B+',
    distance: '0.7 mi',
    units: [
      { type: 'Studio', sf: 480, rent: 1180, rentPsf: 2.46, occupancy: 97.5 },
      { type: '1BR', sf: 690, rent: 1620, rentPsf: 2.35, occupancy: 96.0 },
      { type: '2BR', sf: 1000, rent: 2150, rentPsf: 2.15, occupancy: 95.5 },
      { type: '3BR', sf: 1320, rent: 2780, rentPsf: 2.11, occupancy: 94.0 },
    ],
  },
  {
    name: 'The Lindbergh Collection',
    submarket: 'Buckhead',
    classType: 'A',
    distance: '1.3 mi',
    units: [
      { type: 'Studio', sf: 530, rent: 1400, rentPsf: 2.64, occupancy: 95.0 },
      { type: '1BR', sf: 710, rent: 1880, rentPsf: 2.65, occupancy: 94.8 },
      { type: '2BR', sf: 1060, rent: 2540, rentPsf: 2.40, occupancy: 93.5 },
      { type: '3BR', sf: 1370, rent: 3100, rentPsf: 2.26, occupancy: 92.0 },
    ],
  },
  {
    name: 'Brookwood Park Apartments',
    submarket: 'Buckhead',
    classType: 'B',
    distance: '1.1 mi',
    units: [
      { type: 'Studio', sf: 460, rent: 1050, rentPsf: 2.28, occupancy: 98.0 },
      { type: '1BR', sf: 680, rent: 1380, rentPsf: 2.03, occupancy: 97.8 },
      { type: '2BR', sf: 980, rent: 1850, rentPsf: 1.89, occupancy: 97.5 },
      { type: '3BR', sf: 1300, rent: 2420, rentPsf: 1.86, occupancy: 96.8 },
    ],
  },
];

const MOCK_AMENITY_GAPS: AmenityGapItem[] = [
  { amenity: 'Coworking Space', subject: false, compsPct: 50, estRentLift: 85, priority: 'high' },
  { amenity: 'Rooftop Deck', subject: false, compsPct: 33, estRentLift: 120, priority: 'high' },
  { amenity: 'EV Charging', subject: false, compsPct: 50, estRentLift: 45, priority: 'medium' },
  { amenity: 'Smart Home Tech', subject: false, compsPct: 33, estRentLift: 65, priority: 'high' },
  { amenity: 'Pool/Spa', subject: true, compsPct: 100, estRentLift: 0, priority: 'low' },
  { amenity: 'Fitness Center', subject: true, compsPct: 83, estRentLift: 0, priority: 'low' },
  { amenity: 'Dog Park', subject: true, compsPct: 67, estRentLift: 0, priority: 'low' },
  { amenity: 'Package Lockers', subject: true, compsPct: 83, estRentLift: 0, priority: 'low' },
];

const UNIT_TYPES = ['Studio', '1BR', '2BR', '3BR'] as const;

function getSfBand(sf: number): string {
  const center = Math.round(sf / 50) * 50;
  return `${center - 25}–${center + 25} SF`;
}

function getSfBandCenter(sf: number): number {
  return Math.round(sf / 50) * 50;
}

function isInSfBand(sf: number, targetCenter: number): boolean {
  return sf >= targetCenter - 25 && sf <= targetCenter + 25;
}

const DealCompAnalysisTab: React.FC = () => {
  const [activeUnitType, setActiveUnitType] = useState<string>('1BR');
  const [viewMode, setViewMode] = useState<'tradeArea' | 'likeKind'>('tradeArea');

  const subjectUnit = SUBJECT_UNITS.find(u => u.type === activeUnitType);
  const subjectSfCenter = subjectUnit ? getSfBandCenter(subjectUnit.sf) : 700;

  const matchingComps = MOCK_COMPS.map(comp => {
    const matchingUnit = comp.units.find(u => u.type === activeUnitType && isInSfBand(u.sf, subjectSfCenter));
    const anyUnit = comp.units.find(u => u.type === activeUnitType);
    return {
      ...comp,
      matchedUnit: matchingUnit || anyUnit || null,
      inBand: !!matchingUnit,
    };
  }).filter(c => c.matchedUnit);

  const compAvgRent = matchingComps.length > 0
    ? matchingComps.reduce((s, c) => s + (c.matchedUnit?.rent || 0), 0) / matchingComps.length
    : 0;
  const compAvgPsf = matchingComps.length > 0
    ? matchingComps.reduce((s, c) => s + (c.matchedUnit?.rentPsf || 0), 0) / matchingComps.length
    : 0;
  const compAvgOcc = matchingComps.length > 0
    ? matchingComps.reduce((s, c) => s + (c.matchedUnit?.occupancy || 0), 0) / matchingComps.length
    : 0;

  const rentDelta = subjectUnit ? ((subjectUnit.rent - compAvgRent) / compAvgRent * 100) : 0;
  const psfDelta = subjectUnit ? ((subjectUnit.rentPsf - compAvgPsf) / compAvgPsf * 100) : 0;
  const occDelta = subjectUnit ? (subjectUnit.occupancy - compAvgOcc) : 0;

  const kpis = [
    { label: 'Trade Area Comps', value: String(MOCK_COMPS.length), trend: 'Within 1.5 mi', sparkline: [4, 5, 5, 6, 5, 6, 6, 6, 5, 6, 6, 6] },
    { label: 'Avg Rent (Comps)', value: `$${Math.round(compAvgRent).toLocaleString()}`, trend: `${activeUnitType} avg`, sparkline: [1680, 1700, 1720, 1730, 1745, 1750, 1760, 1770, 1780, 1790, 1800, 1810] },
    { label: 'Subject vs Comps', value: `${rentDelta >= 0 ? '+' : ''}${rentDelta.toFixed(1)}%`, trend: 'Rent premium', sparkline: [1.2, 1.5, 1.8, 2.0, 1.9, 2.2, 2.5, 2.3, 2.6, 2.8, 3.0, rentDelta] },
    { label: 'Occupancy Spread', value: `${occDelta >= 0 ? '+' : ''}${occDelta.toFixed(1)}pp`, trend: 'vs comp avg', sparkline: [0.5, 0.8, 1.0, 1.2, 1.1, 1.3, 1.0, 0.8, 1.1, 1.2, 1.0, occDelta] },
    { label: 'Amenity Gaps', value: String(MOCK_AMENITY_GAPS.filter(a => !a.subject).length), trend: 'Missing amenities', sparkline: [6, 6, 5, 5, 5, 5, 4, 4, 4, 4, 4, 4] },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-violet-500">
        <div className="text-[10px] font-mono text-violet-400 tracking-widest mb-1">DEAL-SPECIFIC COMP ANALYSIS</div>
        <div className="text-lg font-semibold">How does this property compete on rent, size, and amenities within its trade area?</div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-white border border-stone-200 rounded-lg p-3 hover:border-stone-300 transition-colors">
            <div className="text-[10px] font-mono text-stone-400 tracking-wider mb-1">{kpi.label}</div>
            <div className="text-xl font-bold text-stone-900">{kpi.value}</div>
            <div className="text-[10px] text-stone-500 mt-0.5">{kpi.trend}</div>
            <div className="mt-2 h-6 flex items-end gap-px">
              {kpi.sparkline.map((v, j, arr) => {
                const min = Math.min(...arr);
                const max = Math.max(...arr);
                const range = max - min || 1;
                const height = ((v - min) / range) * 100;
                return (
                  <div
                    key={j}
                    className={`flex-1 rounded-sm ${j === arr.length - 1 ? 'bg-violet-500' : 'bg-stone-200'}`}
                    style={{ height: `${Math.max(10, height)}%` }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-violet-50 border border-violet-200 rounded-xl px-5 py-3">
        <p className="text-sm text-violet-900">
          Subject property commands a <strong>{rentDelta >= 0 ? '+' : ''}{rentDelta.toFixed(1)}% rent premium</strong> over {matchingComps.length} trade area comps for {activeUnitType} units.
          {occDelta >= 0
            ? ` Occupancy is ${occDelta.toFixed(1)}pp above comp average — pricing power validated.`
            : ` Occupancy is ${Math.abs(occDelta).toFixed(1)}pp below comp average — consider concession review.`
          }
          {' '}{MOCK_AMENITY_GAPS.filter(a => !a.subject && a.priority === 'high').length} high-priority amenity gaps identified.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="flex border-b border-stone-200">
          <button
            onClick={() => setViewMode('tradeArea')}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${
              viewMode === 'tradeArea'
                ? 'bg-violet-50 text-violet-700 border-b-2 border-violet-600'
                : 'text-stone-500 hover:bg-stone-50'
            }`}
          >
            📍 Trade Area Comps
          </button>
          <button
            onClick={() => setViewMode('likeKind')}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${
              viewMode === 'likeKind'
                ? 'bg-violet-50 text-violet-700 border-b-2 border-violet-600'
                : 'text-stone-500 hover:bg-stone-50'
            }`}
          >
            🏢 Like-Kind Comps
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-stone-900">Unit-Type Comparison</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Grouped by bed type + 50 SF tolerance band ({subjectUnit ? getSfBand(subjectUnit.sf) : '—'})
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-mono">MOCK DATA</span>
              <div className="flex bg-stone-100 rounded-lg p-0.5">
                {UNIT_TYPES.map(ut => (
                  <button
                    key={ut}
                    onClick={() => setActiveUnitType(ut)}
                    className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-colors ${
                      activeUnitType === ut ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
                    }`}
                  >
                    {ut}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {viewMode === 'tradeArea' && (
            <>
              <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-violet-800">Subject Property — {activeUnitType}</span>
                  <span className="text-[10px] bg-violet-200 text-violet-700 px-2 py-0.5 rounded-full font-mono">
                    {subjectUnit?.sf} SF
                  </span>
                  <span className="text-[10px] text-violet-600 font-mono">Band: {subjectUnit ? getSfBand(subjectUnit.sf) : '—'}</span>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <div className="text-[10px] text-violet-600">Size</div>
                    <div className="text-lg font-bold text-violet-900">{subjectUnit?.sf} SF</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-violet-600">Total Rent</div>
                    <div className="text-lg font-bold text-violet-900">${subjectUnit?.rent.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-violet-600">Rent PSF</div>
                    <div className="text-lg font-bold text-violet-900">${subjectUnit?.rentPsf.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-violet-600">Occupancy</div>
                    <div className="text-lg font-bold text-violet-900">{subjectUnit?.occupancy}%</div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-stone-200 text-xs text-stone-500">
                      <th className="text-left py-2 px-3 font-medium">Property</th>
                      <th className="text-center py-2 px-3 font-medium">Class</th>
                      <th className="text-center py-2 px-3 font-medium">Dist</th>
                      <th className="text-center py-2 px-3 font-medium">SF</th>
                      <th className="text-center py-2 px-3 font-medium">In Band</th>
                      <th className="text-center py-2 px-3 font-medium">Total Rent</th>
                      <th className="text-center py-2 px-3 font-medium">Rent PSF</th>
                      <th className="text-center py-2 px-3 font-medium">Occ%</th>
                      <th className="text-center py-2 px-3 font-medium">Δ Rent</th>
                      <th className="text-center py-2 px-3 font-medium">Δ PSF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchingComps.map((comp, idx) => {
                      const u = comp.matchedUnit!;
                      const dRent = subjectUnit ? subjectUnit.rent - u.rent : 0;
                      const dPsf = subjectUnit ? subjectUnit.rentPsf - u.rentPsf : 0;
                      return (
                        <tr key={idx} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-stone-900 text-xs">{comp.name}</div>
                            <div className="text-[10px] text-stone-400">{comp.submarket}</div>
                          </td>
                          <td className="text-center py-2.5 px-3">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              comp.classType.startsWith('A') ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                            }`}>{comp.classType}</span>
                          </td>
                          <td className="text-center py-2.5 px-3 text-xs text-stone-600">{comp.distance}</td>
                          <td className="text-center py-2.5 px-3 text-xs font-mono text-stone-700">{u.sf}</td>
                          <td className="text-center py-2.5 px-3">
                            {comp.inBand ? (
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">✓ Yes</span>
                            ) : (
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">~ Near</span>
                            )}
                          </td>
                          <td className="text-center py-2.5 px-3 text-xs font-semibold font-mono text-stone-900">
                            ${u.rent.toLocaleString()}
                          </td>
                          <td className="text-center py-2.5 px-3 text-xs font-mono text-stone-700">
                            ${u.rentPsf.toFixed(2)}
                          </td>
                          <td className="text-center py-2.5 px-3">
                            <span className={`text-xs font-semibold ${
                              u.occupancy >= 95 ? 'text-emerald-600' : u.occupancy >= 93 ? 'text-amber-600' : 'text-red-600'
                            }`}>{u.occupancy}%</span>
                          </td>
                          <td className="text-center py-2.5 px-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              dRent > 0 ? 'bg-emerald-100 text-emerald-700' : dRent < 0 ? 'bg-red-100 text-red-700' : 'bg-stone-100 text-stone-600'
                            }`}>
                              {dRent >= 0 ? '+' : ''}${dRent}
                            </span>
                          </td>
                          <td className="text-center py-2.5 px-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              dPsf > 0 ? 'bg-emerald-100 text-emerald-700' : dPsf < 0 ? 'bg-red-100 text-red-700' : 'bg-stone-100 text-stone-600'
                            }`}>
                              {dPsf >= 0 ? '+' : ''}{dPsf.toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex gap-4 text-[10px] text-stone-400">
                <span>SF Band tolerance: ±25 SF (50 SF total range)</span>
                <span>•</span>
                <span>{matchingComps.filter(c => c.inBand).length} of {matchingComps.length} comps within exact SF band</span>
              </div>
            </>
          )}

          {viewMode === 'likeKind' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-stone-900">Like-Kind National Benchmarks</h3>
                  <p className="text-xs text-stone-500 mt-0.5">Class A | 2016–2022 Vintage | 200–400 Units — peer group of 634 properties</p>
                </div>
                <span className="text-[10px] font-mono text-stone-400 tracking-widest">VANTAGE GROUP PEERS</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-stone-200 text-xs text-stone-500">
                      <th className="text-left py-2 px-3 font-medium">Metric</th>
                      <th className="text-center py-2 px-3 font-medium">Subject</th>
                      <th className="text-center py-2 px-3 font-medium">Peer Average</th>
                      <th className="text-center py-2 px-3 font-medium">Peer Top 25%</th>
                      <th className="text-center py-2 px-3 font-medium">vs. Peers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { metric: 'Avg Effective Rent', subject: '$1,920', peerAvg: '$1,845', peerTop25: '$2,180', delta: '+4.1%', dir: 'up' },
                      { metric: 'Occupancy', subject: '95.2%', peerAvg: '93.8%', peerTop25: '96.5%', delta: '+1.4pp', dir: 'up' },
                      { metric: 'Revenue per Unit', subject: '$1,828', peerAvg: '$1,731', peerTop25: '$2,104', delta: '+5.6%', dir: 'up' },
                      { metric: 'Concession Rate', subject: '2.1%', peerAvg: '3.4%', peerTop25: '1.2%', delta: '-1.3pp', dir: 'up' },
                      { metric: 'Lease Renewal Rate', subject: '58%', peerAvg: '62%', peerTop25: '71%', delta: '-4pp', dir: 'down' },
                      { metric: 'Traffic-to-Lease', subject: '22%', peerAvg: '19%', peerTop25: '26%', delta: '+3pp', dir: 'up' },
                      { metric: 'Avg Days on Market', subject: '28', peerAvg: '34', peerTop25: '18', delta: '-6 days', dir: 'up' },
                      { metric: 'Google Rating', subject: '4.2', peerAvg: '3.9', peerTop25: '4.5', delta: '+0.3', dir: 'up' },
                    ].map((bm, idx) => (
                      <tr key={idx} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                        <td className="py-2.5 px-3 text-xs font-medium text-stone-700">{bm.metric}</td>
                        <td className="text-center py-2.5 px-3 text-xs font-bold text-stone-900 font-mono">{bm.subject}</td>
                        <td className="text-center py-2.5 px-3 text-xs text-stone-600 font-mono">{bm.peerAvg}</td>
                        <td className="text-center py-2.5 px-3 text-xs text-stone-600 font-mono">{bm.peerTop25}</td>
                        <td className="text-center py-2.5 px-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            bm.dir === 'up' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}>{bm.delta}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 bg-violet-50 border border-violet-200 rounded-lg p-3">
                <p className="text-xs text-violet-800 leading-relaxed">
                  Subject property outperforms peers on rent (+4.1%), occupancy (+1.4pp), and traffic conversion (+3pp).
                  Key gap: Lease renewal rate at 58% vs peer avg 62% — improving retention could add $45K/yr in avoided turnover costs.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold text-stone-900">Amenity Gap Matrix</h3>
          <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-mono">MOCK DATA</span>
        </div>
        <p className="text-xs text-stone-500 mb-4">Amenities you're missing that competitors offer, with estimated rent lift potential</p>

        <div className="grid grid-cols-2 gap-2">
          {MOCK_AMENITY_GAPS.map((gap, idx) => (
            <div key={idx} className={`flex items-center justify-between p-3 rounded-lg border ${
              gap.subject ? 'bg-emerald-50/50 border-emerald-200' : 'bg-stone-50 border-stone-200'
            }`}>
              <div className="flex items-center gap-3 flex-1">
                <span className={`text-lg ${gap.subject ? '' : 'opacity-30'}`}>
                  {gap.subject ? '✅' : '❌'}
                </span>
                <div>
                  <div className="text-sm font-medium text-stone-900">{gap.amenity}</div>
                  <div className="text-[10px] text-stone-500">{gap.compsPct}% of comps have this</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className={`text-sm font-bold ${gap.subject ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {gap.subject ? 'You have this' : `+$${gap.estRentLift}/unit/mo`}
                  </div>
                  {!gap.subject && <div className="text-[10px] text-stone-400">est. rent lift</div>}
                </div>
                {!gap.subject && (
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                    gap.priority === 'high' ? 'bg-red-100 text-red-700' :
                    gap.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-stone-100 text-stone-600'
                  }`}>
                    {gap.priority.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-800 leading-relaxed">
            Total addressable rent lift: <span className="font-bold">+$315/unit/mo</span> if all high-priority amenity gaps are closed.
            Coworking space and rooftop deck offer the highest ROI based on comp market data.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold text-stone-900">Rent Positioning by Unit Type</h3>
          <span className="text-[10px] font-mono text-stone-400 tracking-widest">ALL UNIT TYPES</span>
        </div>
        <p className="text-xs text-stone-500 mb-4">Subject rent vs comp average across all bed types</p>

        <div className="grid grid-cols-4 gap-4">
          {SUBJECT_UNITS.map((su) => {
            const compsForType = MOCK_COMPS.map(c => c.units.find(u => u.type === su.type)).filter(Boolean) as typeof su[];
            const avgCompRent = compsForType.length > 0
              ? compsForType.reduce((s, u) => s + u.rent, 0) / compsForType.length
              : 0;
            const delta = avgCompRent > 0 ? ((su.rent - avgCompRent) / avgCompRent * 100) : 0;
            const maxRent = Math.max(su.rent, ...compsForType.map(u => u.rent));

            return (
              <div key={su.type} className="border border-stone-200 rounded-lg p-4">
                <div className="text-sm font-bold text-stone-900 mb-2">{su.type}</div>
                <div className="space-y-2">
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-stone-500 mb-1">
                      <span>Subject</span>
                      <span className="font-mono font-bold text-stone-900">${su.rent.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full" style={{ width: `${(su.rent / maxRent) * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-stone-500 mb-1">
                      <span>Comp Avg</span>
                      <span className="font-mono text-stone-600">${Math.round(avgCompRent).toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-stone-400 rounded-full" style={{ width: `${(avgCompRent / maxRent) * 100}%` }} />
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-center">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    delta >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DealCompAnalysisTab;
