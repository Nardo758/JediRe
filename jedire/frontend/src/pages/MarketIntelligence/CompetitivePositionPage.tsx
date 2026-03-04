import React, { useState } from 'react';

const POSITION_VITALS = [
  { id: 'avg-rent', label: 'Avg Effective Rent', value: '$1,920', trend: '+4.1% vs peers', trendDirection: 'up' as const, sparklineData: [1720, 1750, 1780, 1810, 1840, 1860, 1880, 1890, 1900, 1910, 1920, 1920] },
  { id: 'occupancy', label: 'Occupancy', value: '95.2%', trend: '+1.4pp vs avg', trendDirection: 'up' as const, sparklineData: [93, 93.5, 94, 94.2, 94.5, 94.8, 95, 95.1, 95, 95.2, 95.1, 95.2] },
  { id: 'traffic-share', label: 'Traffic Share', value: '11.2%', trend: '+0.8pp QoQ', trendDirection: 'up' as const, sparklineData: [8.5, 9.0, 9.2, 9.5, 9.8, 10.1, 10.4, 10.6, 10.8, 11.0, 11.1, 11.2] },
  { id: 'amenity-score', label: 'Amenity Coverage', value: '67%', trend: 'Gap: 3 amenities', trendDirection: 'neutral' as const, sparklineData: [67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67] },
  { id: 'comp-rank', label: 'Comp Rank', value: '#4', trend: 'of 7 in trade area', trendDirection: 'neutral' as const, sparklineData: [6, 6, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4] },
];

interface TradeAreaComp {
  name: string;
  distance: string;
  units: number;
  yearBuilt: number;
  classType: string;
  avgRent: number;
  occupancy: number;
  trafficShare: number;
  amenities: Record<string, boolean>;
}

const TRADE_AREA_COMPS: TradeAreaComp[] = [
  { name: 'The Meridian at Buckhead', distance: '0.3 mi', units: 312, yearBuilt: 2019, classType: 'A', avgRent: 2150, occupancy: 94.2, trafficShare: 18.5, amenities: { pool: true, gym: true, coworking: true, dogPark: true, rooftop: true, ev: true } },
  { name: 'Avalon Heights', distance: '0.5 mi', units: 248, yearBuilt: 2016, classType: 'A', avgRent: 1980, occupancy: 96.1, trafficShare: 15.2, amenities: { pool: true, gym: true, coworking: false, dogPark: true, rooftop: false, ev: false } },
  { name: 'Peachtree Station Lofts', distance: '0.7 mi', units: 186, yearBuilt: 2012, classType: 'B+', avgRent: 1720, occupancy: 93.8, trafficShare: 12.1, amenities: { pool: true, gym: true, coworking: false, dogPark: false, rooftop: false, ev: false } },
  { name: 'Colony Square Living', distance: '0.9 mi', units: 420, yearBuilt: 2021, classType: 'A+', avgRent: 2480, occupancy: 91.5, trafficShare: 22.3, amenities: { pool: true, gym: true, coworking: true, dogPark: true, rooftop: true, ev: true } },
  { name: 'Brookwood Park Apartments', distance: '1.1 mi', units: 156, yearBuilt: 2008, classType: 'B', avgRent: 1450, occupancy: 97.2, trafficShare: 8.4, amenities: { pool: true, gym: false, coworking: false, dogPark: true, rooftop: false, ev: false } },
  { name: 'The Lindbergh Collection', distance: '1.3 mi', units: 278, yearBuilt: 2018, classType: 'A', avgRent: 2050, occupancy: 95.0, trafficShare: 14.8, amenities: { pool: true, gym: true, coworking: true, dogPark: false, rooftop: true, ev: true } },
  { name: 'Midtown Terrace', distance: '1.5 mi', units: 198, yearBuilt: 2014, classType: 'B+', avgRent: 1680, occupancy: 94.5, trafficShare: 8.7, amenities: { pool: true, gym: true, coworking: false, dogPark: true, rooftop: false, ev: false } },
];

const LIKE_KIND_BENCHMARKS = [
  { metric: 'Avg Effective Rent', subject: '$1,920', peerAvg: '$1,845', peerTop25: '$2,180', delta: '+4.1%', deltaDirection: 'up' as const },
  { metric: 'Occupancy', subject: '95.2%', peerAvg: '93.8%', peerTop25: '96.5%', delta: '+1.4pp', deltaDirection: 'up' as const },
  { metric: 'Revenue per Unit', subject: '$1,828', peerAvg: '$1,731', peerTop25: '$2,104', delta: '+5.6%', deltaDirection: 'up' as const },
  { metric: 'Concession Rate', subject: '2.1%', peerAvg: '3.4%', peerTop25: '1.2%', delta: '-1.3pp', deltaDirection: 'up' as const },
  { metric: 'Lease Renewal Rate', subject: '58%', peerAvg: '62%', peerTop25: '71%', delta: '-4pp', deltaDirection: 'down' as const },
  { metric: 'Traffic-to-Lease', subject: '22%', peerAvg: '19%', peerTop25: '26%', delta: '+3pp', deltaDirection: 'up' as const },
  { metric: 'Avg Days on Market', subject: '28', peerAvg: '34', peerTop25: '18', delta: '-6 days', deltaDirection: 'up' as const },
  { metric: 'Google Rating', subject: '4.2', peerAvg: '3.9', peerTop25: '4.5', delta: '+0.3', deltaDirection: 'up' as const },
];

const AMENITY_LABELS: Record<string, string> = {
  pool: 'Pool/Spa', gym: 'Fitness Center', coworking: 'Coworking Space',
  dogPark: 'Dog Park', rooftop: 'Rooftop Deck', ev: 'EV Charging',
};

const AMENITY_GAPS = [
  { amenity: 'Coworking Space', subject: false, compsPct: 43, estRentLift: 85, priority: 'high' as const },
  { amenity: 'EV Charging', subject: false, compsPct: 43, estRentLift: 45, priority: 'medium' as const },
  { amenity: 'Rooftop Deck', subject: false, compsPct: 43, estRentLift: 120, priority: 'high' as const },
  { amenity: 'Package Lockers', subject: true, compsPct: 71, estRentLift: 30, priority: 'low' as const },
  { amenity: 'Pet Spa', subject: false, compsPct: 29, estRentLift: 35, priority: 'low' as const },
  { amenity: 'Smart Home Tech', subject: false, compsPct: 57, estRentLift: 65, priority: 'high' as const },
];

const PATTERN_ALERTS = [
  { id: 'amenity-arms-race', pattern: 'Amenity Arms Race', description: '4 of 7 comps added coworking spaces in the last 18 months. Properties without coworking are seeing 3-5% lower traffic. Consider adding to remain competitive.', severity: 'warning' as const, icon: '\u2694\uFE0F' },
  { id: 'vintage-cascade', pattern: 'Vintage Cascade', description: 'Two new Class A+ deliveries (2021-2022) are pulling top-tier renters, cascading rent pressure down to 2012-2016 vintage properties. Your 2015 vintage is in the compression zone.', severity: 'warning' as const, icon: '\uD83C\uDFD7\uFE0F' },
  { id: 'occupancy-divergence', pattern: 'Occupancy Divergence', description: 'Class B properties in this trade area maintain 97%+ occupancy vs Class A at 92-95%. Price-sensitive renter pool is strong \u2014 value-add repositioning may capture premium without vacancy risk.', severity: 'opportunity' as const, icon: '\uD83D\uDCC8' },
  { id: 'traffic-concentration', pattern: 'Traffic Concentration Risk', description: 'Colony Square Living captures 22.3% of local search traffic \u2014 dominant digital presence. Your property needs SEO/ILS investment to compete for leads.', severity: 'info' as const, icon: '\uD83D\uDD0D' },
];

const SUBJECT = { name: 'Subject Property', avgRent: 1920, trafficShare: 11.2 };

const CompetitivePositionPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tradeArea' | 'likeKind'>('tradeArea');
  const [sortField, setSortField] = useState<string>('distance');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const maxTraffic = Math.max(...TRADE_AREA_COMPS.map(c => c.trafficShare), SUBJECT.trafficShare);
  const maxRent = Math.max(...TRADE_AREA_COMPS.map(c => c.avgRent), SUBJECT.avgRent);

  const sortedComps = [...TRADE_AREA_COMPS].sort((a, b) => {
    let aVal: number, bVal: number;
    switch (sortField) {
      case 'avgRent': aVal = a.avgRent; bVal = b.avgRent; break;
      case 'occupancy': aVal = a.occupancy; bVal = b.occupancy; break;
      case 'trafficShare': aVal = a.trafficShare; bVal = b.trafficShare; break;
      case 'units': aVal = a.units; bVal = b.units; break;
      default: aVal = parseFloat(a.distance); bVal = parseFloat(b.distance);
    }
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: string }) => (
    <span className="ml-1 text-[10px] text-stone-400">{sortField === field ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : '\u21C5'}</span>
  );

  return (
    <div className="space-y-5">
      <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-indigo-500">
        <div className="text-[10px] font-mono text-indigo-400 tracking-widest mb-1">THE DECISION THIS PAGE DRIVES</div>
        <div className="text-lg font-semibold">How does this property stack up against its competition — and where are the gaps?</div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-stone-900">Competitive Vitals</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-mono">MOCK DATA</span>
            <span className="text-[10px] text-stone-400">7 comps | 1.5-mile radius</span>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {POSITION_VITALS.map(vital => (
            <div key={vital.id} className="border border-stone-200 rounded-lg p-3 hover:border-stone-300 transition-colors">
              <div className="text-[10px] font-mono text-stone-400 tracking-wider mb-1">{vital.label}</div>
              <div className="text-xl font-bold text-stone-900">{vital.value}</div>
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-[10px] font-medium ${vital.trendDirection === 'up' ? 'text-emerald-600' : vital.trendDirection === 'down' ? 'text-red-500' : 'text-stone-500'}`}>
                  {vital.trendDirection === 'up' ? '\u2191' : vital.trendDirection === 'down' ? '\u2193' : '\u2192'} {vital.trend}
                </span>
              </div>
              <div className="mt-2 h-6 flex items-end gap-px">
                {vital.sparklineData.slice(-12).map((v, i, arr) => {
                  const min = Math.min(...arr);
                  const max = Math.max(...arr);
                  const range = max - min || 1;
                  const height = ((v - min) / range) * 100;
                  return (
                    <div key={i} className={`flex-1 rounded-sm ${i === arr.length - 1 ? 'bg-indigo-500' : 'bg-stone-200'}`} style={{ height: `${Math.max(10, height)}%` }} />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-3">
        <p className="text-sm text-indigo-900">
          Subject outperforms peers on rent (+4.1%) and occupancy (+1.4pp). <strong>Key gap:</strong> Missing 3 amenities that 43%+ of comps offer. Closing coworking and rooftop gaps could yield <strong>+$205/unit/mo</strong> in rent lift. Colony Square dominates digital traffic at 22.3% share.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="flex border-b border-stone-200">
          <button onClick={() => setActiveTab('tradeArea')} className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${activeTab === 'tradeArea' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-stone-500 hover:bg-stone-50'}`}>
            Trade Area Comps
          </button>
          <button onClick={() => setActiveTab('likeKind')} className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${activeTab === 'likeKind' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-stone-500 hover:bg-stone-50'}`}>
            Like-Kind Benchmarks
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'tradeArea' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-stone-900">Local Trade Area Competitors</h3>
                  <p className="text-xs text-stone-500 mt-0.5">{TRADE_AREA_COMPS.length} properties within 1.5-mile radius</p>
                </div>
                <span className="text-[10px] font-mono text-stone-400 tracking-widest">TRADE AREA RADIUS: 1.5 MI</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-stone-200 text-xs text-stone-500">
                      <th className="text-left py-2 px-3 font-medium">Property</th>
                      <th className="text-center py-2 px-3 font-medium cursor-pointer hover:text-stone-800" onClick={() => handleSort('distance')}>Dist<SortIcon field="distance" /></th>
                      <th className="text-center py-2 px-3 font-medium cursor-pointer hover:text-stone-800" onClick={() => handleSort('units')}>Units<SortIcon field="units" /></th>
                      <th className="text-center py-2 px-3 font-medium">Class</th>
                      <th className="text-center py-2 px-3 font-medium cursor-pointer hover:text-stone-800" onClick={() => handleSort('avgRent')}>Avg Rent<SortIcon field="avgRent" /></th>
                      <th className="text-center py-2 px-3 font-medium cursor-pointer hover:text-stone-800" onClick={() => handleSort('occupancy')}>Occ%<SortIcon field="occupancy" /></th>
                      <th className="text-center py-2 px-3 font-medium cursor-pointer hover:text-stone-800" onClick={() => handleSort('trafficShare')}>Traffic<SortIcon field="trafficShare" /></th>
                      <th className="text-center py-2 px-3 font-medium">Amenities</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedComps.map((comp, idx) => {
                      const amenityCount = Object.values(comp.amenities).filter(Boolean).length;
                      return (
                        <tr key={idx} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-stone-900 text-xs">{comp.name}</div>
                            <div className="text-[10px] text-stone-400">Built {comp.yearBuilt}</div>
                          </td>
                          <td className="text-center py-2.5 px-3 text-xs text-stone-600">{comp.distance}</td>
                          <td className="text-center py-2.5 px-3 text-xs font-mono text-stone-700">{comp.units}</td>
                          <td className="text-center py-2.5 px-3">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${comp.classType.startsWith('A') ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{comp.classType}</span>
                          </td>
                          <td className="text-center py-2.5 px-3 text-xs font-semibold font-mono text-stone-900">${comp.avgRent.toLocaleString()}</td>
                          <td className="text-center py-2.5 px-3">
                            <span className={`text-xs font-semibold ${comp.occupancy >= 95 ? 'text-emerald-600' : comp.occupancy >= 93 ? 'text-amber-600' : 'text-red-600'}`}>{comp.occupancy}%</span>
                          </td>
                          <td className="text-center py-2.5 px-3">
                            <div className="flex items-center justify-center gap-1">
                              <div className="w-16 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(comp.trafficShare / maxTraffic) * 100}%` }} />
                              </div>
                              <span className="text-[10px] font-mono text-stone-600">{comp.trafficShare}%</span>
                            </div>
                          </td>
                          <td className="text-center py-2.5 px-3">
                            <div className="flex items-center justify-center gap-0.5">
                              {Object.entries(comp.amenities).map(([key, has]) => (
                                <span key={key} className={`w-2 h-2 rounded-full ${has ? 'bg-emerald-400' : 'bg-stone-200'}`} title={`${AMENITY_LABELS[key]}: ${has ? 'Yes' : 'No'}`} />
                              ))}
                              <span className="text-[10px] text-stone-400 ml-1">{amenityCount}/6</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'likeKind' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-stone-900">Like-Kind National Benchmarks</h3>
                  <p className="text-xs text-stone-500 mt-0.5">Class B+ | 2014{'\u2013'}2018 Vintage | 150{'\u2013'}300 Units {'\u2014'} peer group of 847 properties</p>
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
                    {LIKE_KIND_BENCHMARKS.map((bm, idx) => (
                      <tr key={idx} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                        <td className="py-2.5 px-3 text-xs font-medium text-stone-700">{bm.metric}</td>
                        <td className="text-center py-2.5 px-3 text-xs font-bold text-stone-900 font-mono">{bm.subject}</td>
                        <td className="text-center py-2.5 px-3 text-xs text-stone-600 font-mono">{bm.peerAvg}</td>
                        <td className="text-center py-2.5 px-3 text-xs text-stone-600 font-mono">{bm.peerTop25}</td>
                        <td className="text-center py-2.5 px-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${bm.deltaDirection === 'up' ? 'bg-emerald-100 text-emerald-700' : bm.deltaDirection === 'down' ? 'bg-red-100 text-red-700' : 'bg-stone-100 text-stone-600'}`}>{bm.delta}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800 leading-relaxed">
                  Subject property outperforms peers on rent (+4.1%), occupancy (+1.4pp), and traffic conversion (+3pp).
                  Key gap: Lease renewal rate at 58% vs peer avg 62% {'\u2014'} improving retention could add $45K/yr in avoided turnover costs.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold text-stone-900">Rent vs Traffic Position</h3>
          <span className="text-[10px] font-mono text-stone-400 tracking-widest">SCATTER ANALYSIS</span>
        </div>
        <p className="text-xs text-stone-500 mb-4">Subject property plotted against comps on rent (x-axis) and traffic share (y-axis)</p>

        <div className="relative bg-stone-50 rounded-lg border border-stone-200 p-4" style={{ height: 240 }}>
          <div className="absolute left-8 top-2 text-[9px] font-mono text-stone-400 -rotate-90 origin-left" style={{ transform: 'rotate(-90deg) translateX(-80px)' }}>Traffic Share %</div>
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-mono text-stone-400">Avg Rent $/mo</div>
          <div className="absolute inset-0 ml-10 mb-6 mt-2 mr-4">
            <div className="absolute inset-0 border-l border-b border-stone-300" />
            <div className="absolute left-0 top-0 w-1/2 h-1/2 bg-emerald-50/40 rounded-tl-lg">
              <span className="absolute top-1 left-1 text-[8px] font-mono text-emerald-500">Hidden Gem</span>
            </div>
            <div className="absolute right-0 top-0 w-1/2 h-1/2 bg-blue-50/40 rounded-tr-lg">
              <span className="absolute top-1 right-1 text-[8px] font-mono text-blue-500">Validated Winner</span>
            </div>
            <div className="absolute left-0 bottom-0 w-1/2 h-1/2 bg-stone-100/40 rounded-bl-lg">
              <span className="absolute bottom-1 left-1 text-[8px] font-mono text-stone-400">Dead Weight</span>
            </div>
            <div className="absolute right-0 bottom-0 w-1/2 h-1/2 bg-red-50/40 rounded-br-lg">
              <span className="absolute bottom-1 right-1 text-[8px] font-mono text-red-400">Hype Risk</span>
            </div>
            {TRADE_AREA_COMPS.map((comp, idx) => {
              const x = ((comp.avgRent - 1300) / (maxRent - 1300)) * 90 + 5;
              const y = 95 - ((comp.trafficShare / maxTraffic) * 90 + 5);
              return (
                <div key={idx} className="absolute w-3 h-3 bg-indigo-400 rounded-full border-2 border-white shadow-sm cursor-pointer hover:scale-150 transition-transform"
                  style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
                  title={`${comp.name}: $${comp.avgRent}/mo, ${comp.trafficShare}% traffic`} />
              );
            })}
            {(() => {
              const sx = ((SUBJECT.avgRent - 1300) / (maxRent - 1300)) * 90 + 5;
              const sy = 95 - ((SUBJECT.trafficShare / maxTraffic) * 90 + 5);
              return (
                <div className="absolute w-5 h-5 bg-amber-500 rounded-full border-white shadow-lg z-10"
                  style={{ left: `${sx}%`, top: `${sy}%`, transform: 'translate(-50%, -50%)', borderWidth: 3 }}
                  title={`Subject: $${SUBJECT.avgRent}/mo, ${SUBJECT.trafficShare}% traffic`}>
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-amber-700 whitespace-nowrap bg-white px-1 rounded shadow-sm">Subject</div>
                </div>
              );
            })()}
          </div>
        </div>
        <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-stone-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-500 rounded-full border-2 border-white shadow-sm inline-block" /> Subject Property</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-indigo-400 rounded-full border border-white shadow-sm inline-block" /> Comp Properties</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold text-stone-900">Amenity Gap Matrix</h3>
          <span className="text-[10px] font-mono text-stone-400 tracking-widest">SUBJECT vs COMP SET</span>
        </div>
        <p className="text-xs text-stone-500 mb-4">Amenities you're missing that competitors offer, with estimated rent lift potential</p>
        <div className="space-y-2">
          {AMENITY_GAPS.map((gap, idx) => (
            <div key={idx} className={`flex items-center justify-between p-3 rounded-lg border ${gap.subject ? 'bg-emerald-50/50 border-emerald-200' : 'bg-stone-50 border-stone-200'}`}>
              <div className="flex items-center gap-3 flex-1">
                <span className={`text-lg ${gap.subject ? '' : 'opacity-30'}`}>{gap.subject ? '\u2705' : '\u274C'}</span>
                <div>
                  <div className="text-sm font-medium text-stone-900">{gap.amenity}</div>
                  <div className="text-[10px] text-stone-500">{gap.compsPct}% of comps have this</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className={`text-sm font-bold ${gap.subject ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {gap.subject ? 'You have this' : `+$${gap.estRentLift}/unit/mo`}
                  </div>
                  {!gap.subject && <div className="text-[10px] text-stone-400">est. rent lift</div>}
                </div>
                {!gap.subject && (
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${gap.priority === 'high' ? 'bg-red-100 text-red-700' : gap.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-600'}`}>
                    {gap.priority.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-800 leading-relaxed">
            Total addressable rent lift: <span className="font-bold">+$350/unit/mo</span> if all high-priority amenity gaps are closed.
            Coworking space and rooftop deck offer the highest ROI based on comp market data.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-stone-900">Pattern Alerts</h3>
          <span className="text-[10px] font-mono text-stone-400 tracking-widest">AI-DETECTED PATTERNS</span>
        </div>
        {PATTERN_ALERTS.map((alert) => (
          <div key={alert.id} className={`rounded-xl border p-4 ${alert.severity === 'warning' ? 'bg-amber-50 border-amber-200' : alert.severity === 'opportunity' ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200'}`}>
            <div className="flex items-start gap-3">
              <span className="text-xl">{alert.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-stone-900">{alert.pattern}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${alert.severity === 'warning' ? 'bg-amber-200 text-amber-800' : alert.severity === 'opportunity' ? 'bg-emerald-200 text-emerald-800' : 'bg-blue-200 text-blue-800'}`}>
                    {alert.severity.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">{alert.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CompetitivePositionPage;
