import React, { useState } from 'react';
import { BT } from '@/components/deal/bloomberg-ui';

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
    <span className="ml-1 text-[10px]" style={{ color: BT.text.muted }}>{sortField === field ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : '\u21C5'}</span>
  );

  return (
    <div className="space-y-5">
      <div className="p-4" style={{ background: BT.bg.terminal, color: BT.text.white, borderRadius: 0, borderLeft: `4px solid ${BT.text.purple}` }}>
        <div className="text-[10px] font-mono tracking-widest mb-1" style={{ color: BT.text.purple }}>THE DECISION THIS PAGE DRIVES</div>
        <div className="text-lg font-semibold">How does this property stack up against its competition — and where are the gaps?</div>
      </div>

      <div className="p-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold" style={{ color: BT.text.primary }}>Competitive Vitals</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 font-mono" style={{ background: `${BT.text.cyan}22`, color: BT.text.cyan, borderRadius: 0 }}>MOCK DATA</span>
            <span className="text-[10px]" style={{ color: BT.text.muted }}>7 comps | 1.5-mile radius</span>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {POSITION_VITALS.map(vital => (
            <div key={vital.id} className="p-3 transition-colors" style={{ border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
              <div className="text-[10px] font-mono tracking-wider mb-1" style={{ color: BT.text.muted }}>{vital.label}</div>
              <div className="text-xl font-bold" style={{ color: BT.text.primary }}>{vital.value}</div>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[10px] font-medium" style={{ color: vital.trendDirection === 'up' ? BT.text.green : vital.trendDirection === 'down' ? BT.text.red : BT.text.secondary }}>
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
                    <div key={i} className="flex-1" style={{ height: `${Math.max(10, height)}%`, background: i === arr.length - 1 ? BT.text.purple : BT.border.subtle, borderRadius: 0 }} />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 py-3" style={{ background: `${BT.text.purple}22`, border: `1px solid ${BT.text.purple}44`, borderRadius: 0 }}>
        <p className="text-sm" style={{ color: BT.text.primary }}>
          Subject outperforms peers on rent (+4.1%) and occupancy (+1.4pp). <strong>Key gap:</strong> Missing 3 amenities that 43%+ of comps offer. Closing coworking and rooftop gaps could yield <strong>+$205/unit/mo</strong> in rent lift. Colony Square dominates digital traffic at 22.3% share.
        </p>
      </div>

      <div className="overflow-hidden" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
        <div className="flex" style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
          <button onClick={() => setActiveTab('tradeArea')} className="flex-1 px-4 py-3 text-sm font-semibold transition-colors" style={{ background: activeTab === 'tradeArea' ? `${BT.text.purple}22` : 'transparent', color: activeTab === 'tradeArea' ? BT.text.purple : BT.text.secondary, borderBottom: activeTab === 'tradeArea' ? `2px solid ${BT.text.purple}` : '2px solid transparent' }}>
            Trade Area Comps
          </button>
          <button onClick={() => setActiveTab('likeKind')} className="flex-1 px-4 py-3 text-sm font-semibold transition-colors" style={{ background: activeTab === 'likeKind' ? `${BT.text.purple}22` : 'transparent', color: activeTab === 'likeKind' ? BT.text.purple : BT.text.secondary, borderBottom: activeTab === 'likeKind' ? `2px solid ${BT.text.purple}` : '2px solid transparent' }}>
            Like-Kind Benchmarks
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'tradeArea' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold" style={{ color: BT.text.primary }}>Local Trade Area Competitors</h3>
                  <p className="text-xs mt-0.5" style={{ color: BT.text.secondary }}>{TRADE_AREA_COMPS.length} properties within 1.5-mile radius</p>
                </div>
                <span className="text-[10px] font-mono tracking-widest" style={{ color: BT.text.muted }}>TRADE AREA RADIUS: 1.5 MI</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs" style={{ borderBottom: `2px solid ${BT.border.subtle}`, color: BT.text.secondary }}>
                      <th className="text-left py-2 px-3 font-medium">Property</th>
                      <th className="text-center py-2 px-3 font-medium cursor-pointer" onClick={() => handleSort('distance')}>Dist<SortIcon field="distance" /></th>
                      <th className="text-center py-2 px-3 font-medium cursor-pointer" onClick={() => handleSort('units')}>Units<SortIcon field="units" /></th>
                      <th className="text-center py-2 px-3 font-medium">Class</th>
                      <th className="text-center py-2 px-3 font-medium cursor-pointer" onClick={() => handleSort('avgRent')}>Avg Rent<SortIcon field="avgRent" /></th>
                      <th className="text-center py-2 px-3 font-medium cursor-pointer" onClick={() => handleSort('occupancy')}>Occ%<SortIcon field="occupancy" /></th>
                      <th className="text-center py-2 px-3 font-medium cursor-pointer" onClick={() => handleSort('trafficShare')}>Traffic<SortIcon field="trafficShare" /></th>
                      <th className="text-center py-2 px-3 font-medium">Amenities</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedComps.map((comp, idx) => {
                      const amenityCount = Object.values(comp.amenities).filter(Boolean).length;
                      return (
                        <tr key={idx} className="transition-colors" style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-xs" style={{ color: BT.text.primary }}>{comp.name}</div>
                            <div className="text-[10px]" style={{ color: BT.text.muted }}>Built {comp.yearBuilt}</div>
                          </td>
                          <td className="text-center py-2.5 px-3 text-xs" style={{ color: BT.text.secondary }}>{comp.distance}</td>
                          <td className="text-center py-2.5 px-3 text-xs font-mono" style={{ color: BT.text.primary }}>{comp.units}</td>
                          <td className="text-center py-2.5 px-3">
                            <span className="text-[10px] font-bold px-1.5 py-0.5" style={{ borderRadius: 0, background: comp.classType.startsWith('A') ? `${BT.text.cyan}22` : `${BT.text.amber}22`, color: comp.classType.startsWith('A') ? BT.text.cyan : BT.text.amber }}>{comp.classType}</span>
                          </td>
                          <td className="text-center py-2.5 px-3 text-xs font-semibold font-mono" style={{ color: BT.text.primary }}>${comp.avgRent.toLocaleString()}</td>
                          <td className="text-center py-2.5 px-3">
                            <span className="text-xs font-semibold" style={{ color: comp.occupancy >= 95 ? BT.text.green : comp.occupancy >= 93 ? BT.text.amber : BT.text.red }}>{comp.occupancy}%</span>
                          </td>
                          <td className="text-center py-2.5 px-3">
                            <div className="flex items-center justify-center gap-1">
                              <div className="w-16 h-1.5 overflow-hidden" style={{ background: BT.border.subtle, borderRadius: 0 }}>
                                <div className="h-full" style={{ width: `${(comp.trafficShare / maxTraffic) * 100}%`, background: BT.text.purple, borderRadius: 0 }} />
                              </div>
                              <span className="text-[10px] font-mono" style={{ color: BT.text.secondary }}>{comp.trafficShare}%</span>
                            </div>
                          </td>
                          <td className="text-center py-2.5 px-3">
                            <div className="flex items-center justify-center gap-0.5">
                              {Object.entries(comp.amenities).map(([key, has]) => (
                                <span key={key} className="w-2 h-2" style={{ borderRadius: '50%', background: has ? BT.text.green : BT.border.subtle }} title={`${AMENITY_LABELS[key]}: ${has ? 'Yes' : 'No'}`} />
                              ))}
                              <span className="text-[10px] ml-1" style={{ color: BT.text.muted }}>{amenityCount}/6</span>
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
                  <h3 className="text-base font-bold" style={{ color: BT.text.primary }}>Like-Kind National Benchmarks</h3>
                  <p className="text-xs mt-0.5" style={{ color: BT.text.secondary }}>Class B+ | 2014{'\u2013'}2018 Vintage | 150{'\u2013'}300 Units {'\u2014'} peer group of 847 properties</p>
                </div>
                <span className="text-[10px] font-mono tracking-widest" style={{ color: BT.text.muted }}>VANTAGE GROUP PEERS</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs" style={{ borderBottom: `2px solid ${BT.border.subtle}`, color: BT.text.secondary }}>
                      <th className="text-left py-2 px-3 font-medium">Metric</th>
                      <th className="text-center py-2 px-3 font-medium">Subject</th>
                      <th className="text-center py-2 px-3 font-medium">Peer Average</th>
                      <th className="text-center py-2 px-3 font-medium">Peer Top 25%</th>
                      <th className="text-center py-2 px-3 font-medium">vs. Peers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LIKE_KIND_BENCHMARKS.map((bm, idx) => (
                      <tr key={idx} className="transition-colors" style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                        <td className="py-2.5 px-3 text-xs font-medium" style={{ color: BT.text.primary }}>{bm.metric}</td>
                        <td className="text-center py-2.5 px-3 text-xs font-bold font-mono" style={{ color: BT.text.primary }}>{bm.subject}</td>
                        <td className="text-center py-2.5 px-3 text-xs font-mono" style={{ color: BT.text.secondary }}>{bm.peerAvg}</td>
                        <td className="text-center py-2.5 px-3 text-xs font-mono" style={{ color: BT.text.secondary }}>{bm.peerTop25}</td>
                        <td className="text-center py-2.5 px-3">
                          <span className="text-xs font-semibold px-2 py-0.5" style={{ borderRadius: 0, background: bm.deltaDirection === 'up' ? `${BT.text.green}22` : bm.deltaDirection === 'down' ? `${BT.text.red}22` : BT.bg.header, color: bm.deltaDirection === 'up' ? BT.text.green : bm.deltaDirection === 'down' ? BT.text.red : BT.text.secondary }}>{bm.delta}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 p-3" style={{ background: `${BT.text.cyan}22`, border: `1px solid ${BT.text.cyan}44`, borderRadius: 0 }}>
                <p className="text-xs leading-relaxed" style={{ color: BT.text.cyan }}>
                  Subject property outperforms peers on rent (+4.1%), occupancy (+1.4pp), and traffic conversion (+3pp).
                  Key gap: Lease renewal rate at 58% vs peer avg 62% {'\u2014'} improving retention could add $45K/yr in avoided turnover costs.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold" style={{ color: BT.text.primary }}>Rent vs Traffic Position</h3>
          <span className="text-[10px] font-mono tracking-widest" style={{ color: BT.text.muted }}>SCATTER ANALYSIS</span>
        </div>
        <p className="text-xs mb-4" style={{ color: BT.text.secondary }}>Subject property plotted against comps on rent (x-axis) and traffic share (y-axis)</p>

        <div className="relative p-4" style={{ height: 240, background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
          <div className="absolute left-8 top-2 text-[9px] font-mono -rotate-90 origin-left" style={{ transform: 'rotate(-90deg) translateX(-80px)', color: BT.text.muted }}>Traffic Share %</div>
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-mono" style={{ color: BT.text.muted }}>Avg Rent $/mo</div>
          <div className="absolute inset-0 ml-10 mb-6 mt-2 mr-4">
            <div className="absolute inset-0" style={{ borderLeft: `1px solid ${BT.border.medium}`, borderBottom: `1px solid ${BT.border.medium}` }} />
            <div className="absolute left-0 top-0 w-1/2 h-1/2" style={{ background: `${BT.text.green}10`, borderRadius: 0 }}>
              <span className="absolute top-1 left-1 text-[8px] font-mono" style={{ color: BT.text.green }}>Hidden Gem</span>
            </div>
            <div className="absolute right-0 top-0 w-1/2 h-1/2" style={{ background: `${BT.text.cyan}10`, borderRadius: 0 }}>
              <span className="absolute top-1 right-1 text-[8px] font-mono" style={{ color: BT.text.cyan }}>Validated Winner</span>
            </div>
            <div className="absolute left-0 bottom-0 w-1/2 h-1/2" style={{ background: `${BT.border.subtle}40`, borderRadius: 0 }}>
              <span className="absolute bottom-1 left-1 text-[8px] font-mono" style={{ color: BT.text.muted }}>Dead Weight</span>
            </div>
            <div className="absolute right-0 bottom-0 w-1/2 h-1/2" style={{ background: `${BT.text.red}10`, borderRadius: 0 }}>
              <span className="absolute bottom-1 right-1 text-[8px] font-mono" style={{ color: BT.text.red }}>Hype Risk</span>
            </div>
            {TRADE_AREA_COMPS.map((comp, idx) => {
              const x = ((comp.avgRent - 1300) / (maxRent - 1300)) * 90 + 5;
              const y = 95 - ((comp.trafficShare / maxTraffic) * 90 + 5);
              return (
                <div key={idx} className="absolute w-3 h-3 cursor-pointer hover:scale-150 transition-transform" style={{ background: BT.text.purple, borderRadius: '50%', border: `2px solid ${BT.bg.panel}` }}
                  style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
                  title={`${comp.name}: $${comp.avgRent}/mo, ${comp.trafficShare}% traffic`} />
              );
            })}
            {(() => {
              const sx = ((SUBJECT.avgRent - 1300) / (maxRent - 1300)) * 90 + 5;
              const sy = 95 - ((SUBJECT.trafficShare / maxTraffic) * 90 + 5);
              return (
                <div className="absolute w-5 h-5 z-10" style={{ background: BT.text.amber, borderRadius: '50%', border: `3px solid ${BT.bg.panel}` }}
                  style={{ left: `${sx}%`, top: `${sy}%`, transform: 'translate(-50%, -50%)' }}
                  title={`Subject: $${SUBJECT.avgRent}/mo, ${SUBJECT.trafficShare}% traffic`}>
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold whitespace-nowrap px-1" style={{ color: BT.text.amber, background: BT.bg.panel, borderRadius: 0 }}>Subject</div>
                </div>
              );
            })()}
          </div>
        </div>
        <div className="flex items-center justify-center gap-4 mt-3 text-[10px]" style={{ color: BT.text.secondary }}>
          <span className="flex items-center gap-1"><span className="w-3 h-3 inline-block" style={{ background: BT.text.amber, borderRadius: '50%', border: `2px solid ${BT.bg.panel}` }} /> Subject Property</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 inline-block" style={{ background: BT.text.purple, borderRadius: '50%', border: `1px solid ${BT.bg.panel}` }} /> Comp Properties</span>
        </div>
      </div>

      <div className="p-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold" style={{ color: BT.text.primary }}>Amenity Gap Matrix</h3>
          <span className="text-[10px] font-mono tracking-widest" style={{ color: BT.text.muted }}>SUBJECT vs COMP SET</span>
        </div>
        <p className="text-xs mb-4" style={{ color: BT.text.secondary }}>Amenities you're missing that competitors offer, with estimated rent lift potential</p>
        <div className="space-y-2">
          {AMENITY_GAPS.map((gap, idx) => (
            <div key={idx} className="flex items-center justify-between p-3" style={{ borderRadius: 0, border: `1px solid ${gap.subject ? `${BT.text.green}44` : BT.border.subtle}`, background: gap.subject ? `${BT.text.green}15` : BT.bg.panelAlt }}>
              <div className="flex items-center gap-3 flex-1">
                <span className={`text-lg ${gap.subject ? '' : 'opacity-30'}`}>{gap.subject ? '\u2705' : '\u274C'}</span>
                <div>
                  <div className="text-sm font-medium" style={{ color: BT.text.primary }}>{gap.amenity}</div>
                  <div className="text-[10px]" style={{ color: BT.text.secondary }}>{gap.compsPct}% of comps have this</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm font-bold" style={{ color: gap.subject ? BT.text.green : BT.text.amber }}>
                    {gap.subject ? 'You have this' : `+$${gap.estRentLift}/unit/mo`}
                  </div>
                  {!gap.subject && <div className="text-[10px]" style={{ color: BT.text.muted }}>est. rent lift</div>}
                </div>
                {!gap.subject && (
                  <span className="text-[9px] font-bold px-2 py-0.5" style={{ borderRadius: 0, background: gap.priority === 'high' ? `${BT.text.red}22` : gap.priority === 'medium' ? `${BT.text.amber}22` : BT.bg.header, color: gap.priority === 'high' ? BT.text.red : gap.priority === 'medium' ? BT.text.amber : BT.text.secondary }}>
                    {gap.priority.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3" style={{ background: `${BT.text.amber}22`, border: `1px solid ${BT.text.amber}44`, borderRadius: 0 }}>
          <p className="text-xs leading-relaxed" style={{ color: BT.text.amber }}>
            Total addressable rent lift: <span className="font-bold">+$350/unit/mo</span> if all high-priority amenity gaps are closed.
            Coworking space and rooftop deck offer the highest ROI based on comp market data.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold" style={{ color: BT.text.primary }}>Pattern Alerts</h3>
          <span className="text-[10px] font-mono tracking-widest" style={{ color: BT.text.muted }}>AI-DETECTED PATTERNS</span>
        </div>
        {PATTERN_ALERTS.map((alert) => (
          <div key={alert.id} className="p-4" style={{ borderRadius: 0, border: `1px solid ${alert.severity === 'warning' ? `${BT.text.amber}44` : alert.severity === 'opportunity' ? `${BT.text.green}44` : `${BT.text.cyan}44`}`, background: alert.severity === 'warning' ? `${BT.text.amber}15` : alert.severity === 'opportunity' ? `${BT.text.green}15` : `${BT.text.cyan}15` }}>
            <div className="flex items-start gap-3">
              <span className="text-xl">{alert.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold" style={{ color: BT.text.primary }}>{alert.pattern}</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5" style={{ borderRadius: 0, background: alert.severity === 'warning' ? `${BT.text.amber}33` : alert.severity === 'opportunity' ? `${BT.text.green}33` : `${BT.text.cyan}33`, color: alert.severity === 'warning' ? BT.text.amber : alert.severity === 'opportunity' ? BT.text.green : BT.text.cyan }}>
                    {alert.severity.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: BT.text.secondary }}>{alert.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CompetitivePositionPage;
