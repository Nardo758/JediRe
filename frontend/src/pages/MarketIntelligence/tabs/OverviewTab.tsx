import React from 'react';
import { SIGNAL_GROUPS } from '../signalGroups';

interface OverviewTabProps {
  marketId: string;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ marketId }) => {
  const isAtlanta = marketId === 'atlanta';

  const vitals = [
    { id: 'D-12', label: 'Population', value: isAtlanta ? '6.2M' : '—', sub: 'Metro MSA' },
    { id: 'D-01', label: 'Jobs Ratio', value: isAtlanta ? '1.8x' : '—', sub: 'Jobs / Apartments' },
    { id: 'D-12', label: 'Med. Income', value: isAtlanta ? '$72,400' : '—', sub: 'Household' },
    { id: 'M-01', label: 'Avg Rent', value: isAtlanta ? '$1,580' : '—', sub: '1BR Market' },
    { id: 'M-06', label: 'Occupancy', value: isAtlanta ? '93.2%' : '—', sub: 'Proxy estimate' },
    { id: 'C-01', label: 'JEDI Score', value: isAtlanta ? '72' : '—', sub: 'Composite 0-100' },
  ];

  const healthSignals = [
    { label: 'DEMAND', outputId: 'D-09', groupId: 'DEMAND' as const, score: isAtlanta ? 68 : 0 },
    { label: 'SUPPLY', outputId: 'S+DC-04', groupId: 'SUPPLY' as const, score: isAtlanta ? 55 : 0 },
    { label: 'MOMENTUM', outputId: 'M-02/05/07', groupId: 'MOMENTUM' as const, score: isAtlanta ? 61 : 0 },
    { label: 'POSITION', outputId: 'P-10/11', groupId: 'POSITION' as const, score: isAtlanta ? 70 : 0 },
    { label: 'RISK', outputId: 'R-01/03/04/07', groupId: 'RISK' as const, score: isAtlanta ? 42 : 0 },
  ];

  const alerts = [
    {
      date: 'Feb 18',
      title: 'Amazon announces 5,000 additional jobs at Midtown campus',
      impact: 'D-01 ratio improving. Midtown rent pressure likely.',
      borderColor: 'border-l-red-500',
      bgColor: 'bg-red-50',
    },
    {
      date: 'Feb 12',
      title: 'Fulton County TAD extension approved for Westside BeltLine',
      impact: 'Tax incentive extends. Supply accelerant for BeltLine sub.',
      borderColor: 'border-l-yellow-500',
      bgColor: 'bg-yellow-50',
    },
    {
      date: 'Feb 8',
      title: 'Q4 2025 rent report: Atlanta B-class up 4.8% vs A +2.1%',
      impact: 'Vintage spread widening (R-02). Value-add thesis confirmed.',
      borderColor: 'border-l-green-500',
      bgColor: 'bg-green-50',
    },
  ];

  const nearTermMetrics = [
    { label: 'Existing Stock', value: isAtlanta ? '249,964' : '—', id: 'S-01' },
    { label: 'Under Construction', value: isAtlanta ? '32,400' : '—', id: 'S-02' },
    { label: 'Permitted', value: isAtlanta ? '7,200' : '—', id: 'S-03' },
    { label: 'Pipeline %', value: isAtlanta ? '15.8%' : '—', id: '' },
    { label: 'Absorption Runway', value: isAtlanta ? '22.4 mo' : '—', id: 'S-04' },
    { label: 'Delivery Clusters', value: isAtlanta ? '3' : '—', id: 'S-05', warning: true },
    { label: 'Permit Momentum', value: isAtlanta ? '0.85x' : '—', id: 'S-06' },
    { label: 'Vintage Breakdown', value: isAtlanta ? '<2000: 42% | 2000-15: 35% | 2015+: 23%' : '—', id: 'S-10' },
  ];

  const longTermMetrics = [
    { label: 'Capacity Ratio', value: isAtlanta ? '32%' : '—', id: 'DC-01', badge: 'MOD' },
    { label: 'Buildout Timeline', value: isAtlanta ? '8.6 yr' : '—', id: 'DC-02' },
    { label: 'Constraint Score', value: isAtlanta ? '58/100' : '—', id: 'DC-03', badge: 'MOD' },
    { label: 'Overhang Risk', value: isAtlanta ? 'LOW' : '—', id: 'DC-04', check: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Market Overview</h2>
          <p className="text-sm text-gray-500">30-second market health check &middot; 25 outputs</p>
        </div>
        <span className="text-xs font-medium text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full">
          {isAtlanta ? '32% live data' : 'No live data'}
        </span>
      </div>

      <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {vitals.map((v, i) => (
            <div key={i} className="bg-white/80 backdrop-blur rounded-xl border border-gray-200/60 p-4 text-center hover:shadow-sm transition-shadow">
              <div className="text-[10px] font-mono text-blue-400 mb-1">{v.id}</div>
              <div className="text-2xl font-bold text-gray-900">{v.value}</div>
              <div className="text-xs font-semibold text-gray-700 mt-1">{v.label}</div>
              <div className="text-[10px] text-gray-400">{v.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500 font-medium">1,033K Parcels</span>
          <div className="flex-1 flex items-center gap-3">
            <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className="h-3 rounded-full bg-green-500 transition-all"
                style={{ width: isAtlanta ? '60%' : '0%' }}
              />
            </div>
            <span className="text-sm font-bold text-gray-700">{isAtlanta ? '60%' : '0%'} Coverage</span>
          </div>
          <span className="text-gray-500">{isAtlanta ? '1,028' : '0'} Props</span>
          <span className="text-gray-500">{isAtlanta ? '249,964' : '0'} units</span>
        </div>
      </div>

      <div className="flex gap-5">
        <div className="w-[60%] bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">5-Signal Health Bar</h3>
            <span className="text-xs text-gray-400">5 composites</span>
          </div>
          <div className="space-y-4">
            {healthSignals.map((signal) => {
              const group = SIGNAL_GROUPS[signal.groupId];
              return (
                <div key={signal.groupId}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold" style={{ color: group.color }}>{signal.label}</span>
                      <span className="text-[10px] font-mono text-gray-400">{signal.outputId}</span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: group.color }}>
                      {signal.score > 0 ? signal.score : '—'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                      className="h-4 rounded-full transition-all duration-700"
                      style={{ width: `${signal.score}%`, backgroundColor: group.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="w-[40%] bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-semibold text-teal-600 bg-teal-50 px-2 py-0.5 rounded">AI MARKET SUMMARY</span>
          </div>
          <div className="flex-1 text-sm text-gray-600 space-y-3">
            {isAtlanta ? (
              <>
                <p><strong>Demand:</strong> Atlanta continues to benefit from strong in-migration and corporate relocations. Job growth across tech and logistics sectors is outpacing apartment deliveries, creating favorable demand-supply dynamics. The jobs-to-apartment ratio of 1.8x remains well above the 1.2x national average.</p>
                <p><strong>Supply:</strong> Near-term pipeline is elevated at 15.8%, with 32,400 units under construction concentrated in Midtown and Buckhead. However, permit momentum has decelerated to 0.85x, suggesting the supply wave is peaking. Absorption runway of 22.4 months provides moderate cushion.</p>
                <p><strong>Pricing Power:</strong> B-class rents are growing faster than A-class (4.8% vs 2.1%), confirming the value-add thesis. Concession rates remain minimal outside new lease-up properties.</p>
                <p><strong>Best Opportunities:</strong> East Atlanta and South DeKalb submarkets offer the strongest risk-adjusted returns due to lower supply pressure and improving demand fundamentals from BeltLine expansion.</p>
              </>
            ) : (
              <p className="italic text-gray-400">AI narrative will be generated once market data is connected.</p>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">Confidence:</span>
            <span className="text-sm font-bold text-teal-600">{isAtlanta ? '78%' : '—'}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Recent Market Intelligence</h3>
          <span className="text-[10px] font-mono text-gray-400">R-10</span>
        </div>
        <div className="space-y-3">
          {alerts.map((alert, i) => (
            <div key={i} className={`border-l-4 ${alert.borderColor} ${alert.bgColor} rounded-r-lg p-4`}>
              <div className="flex items-start justify-between mb-1">
                <span className="text-sm font-semibold text-gray-800">{alert.title}</span>
                <span className="text-[10px] text-gray-400 flex-shrink-0 ml-3 mt-0.5">{alert.date}</span>
              </div>
              <div className="text-xs text-gray-600">
                <span className="font-medium text-gray-500">Impact:</span> {alert.impact}
              </div>
            </div>
          ))}
        </div>
        <button className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-800">
          View All Intelligence →
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100" style={{ borderLeftWidth: 4, borderLeftColor: SIGNAL_GROUPS.SUPPLY.color }}>
          <h3 className="text-base font-semibold text-gray-900">Supply Snapshot</h3>
          <p className="text-sm text-gray-500 mt-0.5">Existing inventory, pipeline, and development capacity outlook</p>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">NEAR-TERM (S-outputs: 2yr)</h4>
            <div className="space-y-2.5">
              {nearTermMetrics.map((m, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">{m.label}</span>
                    {m.id && <span className="text-[10px] font-mono text-gray-400">({m.id})</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-gray-900">{m.value}</span>
                    {m.warning && <span className="text-yellow-500 text-xs">⚠</span>}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg">
              <span className="text-xs font-semibold text-red-700">Verdict: </span>
              <span className="text-xs text-red-600">
                {isAtlanta ? 'Elevated near-term supply. Pipeline % exceeds 15% threshold. Monitor delivery clustering in Midtown corridor.' : 'Insufficient data for verdict.'}
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">LONG-TERM (DC-outputs: 10yr) ★</h4>
            <div className="space-y-2.5">
              {longTermMetrics.map((m, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">{m.label}</span>
                    {m.id && <span className="text-[10px] font-mono text-gray-400">({m.id})</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-gray-900">{m.value}</span>
                    {m.badge && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">{m.badge}</span>}
                    {m.check && <span className="text-green-500">✓</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="text-xs font-semibold text-gray-600 mb-2">Supply Wave Forecast</div>
              <svg viewBox="0 0 200 60" className="w-full h-16">
                <path
                  d="M10,50 Q30,48 50,35 Q70,20 90,12 Q110,8 120,10 Q140,15 160,28 Q180,42 190,48"
                  fill="none"
                  stroke={SIGNAL_GROUPS.SUPPLY.color}
                  strokeWidth="2"
                />
                <path
                  d="M10,50 Q30,48 50,35 Q70,20 90,12 Q110,8 120,10 Q140,15 160,28 Q180,42 190,48 L190,55 L10,55 Z"
                  fill={SIGNAL_GROUPS.SUPPLY.color}
                  opacity="0.1"
                />
                {[
                  { x: 10, label: '2026' },
                  { x: 55, label: '2027' },
                  { x: 100, label: '2028' },
                  { x: 145, label: '2030' },
                  { x: 190, label: '2032' },
                ].map((tick) => (
                  <text key={tick.label} x={tick.x} y="58" textAnchor="middle" className="text-[6px] fill-gray-400">{tick.label}</text>
                ))}
              </svg>
            </div>

            <div className="mt-3 p-3 bg-green-50 border border-green-100 rounded-lg">
              <span className="text-xs font-semibold text-green-700">Verdict: </span>
              <span className="text-xs text-green-600">
                {isAtlanta ? 'Moderate long-term constraint (58/100). Buildout runway of 8.6 years limits future oversupply. Low overhang risk supports acquisition thesis.' : 'Insufficient data for verdict.'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;
