import React from 'react';
import OutputCard, { OutputSection } from '../components/OutputCard';
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
    { label: 'Demand', groupId: 'DEMAND' as const, outputId: 'D-09', score: isAtlanta ? 68 : 0 },
    { label: 'Supply', groupId: 'SUPPLY' as const, outputId: 'S-04', score: isAtlanta ? 55 : 0 },
    { label: 'Momentum', groupId: 'MOMENTUM' as const, outputId: 'M-02', score: isAtlanta ? 61 : 0 },
    { label: 'Position', groupId: 'POSITION' as const, outputId: 'P-10', score: isAtlanta ? 70 : 0 },
    { label: 'Risk', groupId: 'RISK' as const, outputId: 'R-01', score: isAtlanta ? 42 : 0 },
  ];

  const coverageItems = [
    { label: 'Properties (S-01)', value: isAtlanta ? 1028 : 0, max: 1500, status: isAtlanta ? 'real' as const : 'mock' as const },
    { label: 'Ownership Coverage (P-04)', value: isAtlanta ? 82 : 0, max: 100, status: isAtlanta ? 'real' as const : 'mock' as const },
    { label: 'Municipal Pipeline', value: 0, max: 100, status: 'pending' as const },
  ];

  const alerts = [
    { title: 'New 350-unit development permitted in Midtown', time: '2h ago', severity: 'warning' as const },
    { title: 'Occupancy dipped below 92% in Buckhead submarket', time: '1d ago', severity: 'alert' as const },
    { title: 'Rent growth accelerating in East Atlanta', time: '3d ago', severity: 'positive' as const },
  ];

  const severityStyles = {
    warning: 'border-l-amber-400 bg-amber-50',
    alert: 'border-l-red-400 bg-red-50',
    positive: 'border-l-green-400 bg-green-50',
  };

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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {vitals.map((v, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:shadow-sm transition-shadow">
            <div className="text-[10px] font-mono text-gray-400 mb-1">{v.id}</div>
            <div className="text-2xl font-bold text-gray-900">{v.value}</div>
            <div className="text-xs font-semibold text-gray-700 mt-1">{v.label}</div>
            <div className="text-[10px] text-gray-400">{v.sub}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Data Coverage</h3>
        <div className="space-y-3">
          {coverageItems.map((item, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-700">{item.label}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  item.status === 'real' ? 'bg-green-100 text-green-800' :
                  item.status === 'mock' ? 'bg-gray-100 text-gray-500' :
                  'bg-amber-50 text-amber-600'
                }`}>
                  {item.status === 'real' ? 'LIVE' : item.status === 'mock' ? 'MOCK' : 'PENDING'}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div
                  className="h-2.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min((item.value / item.max) * 100, 100)}%`,
                    backgroundColor: item.status === 'real' ? '#22c55e' : item.status === 'mock' ? '#9ca3af' : '#f59e0b',
                  }}
                />
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                {item.max === 100 ? `${item.value}%` : `${item.value.toLocaleString()} / ${item.max.toLocaleString()}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">5-Signal Health Bar</h3>
          <span className="text-xs text-gray-400">5 composites</span>
        </div>
        <div className="grid grid-cols-5 gap-3 mb-4">
          {healthSignals.map((signal) => {
            const group = SIGNAL_GROUPS[signal.groupId];
            return (
              <div key={signal.groupId} className="text-center">
                <div className="text-xs font-semibold mb-2" style={{ color: group.color }}>{signal.label}</div>
                <div className="relative w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-4 rounded-full transition-all duration-700"
                    style={{
                      width: `${signal.score}%`,
                      backgroundColor: group.color,
                    }}
                  />
                </div>
                <div className="text-lg font-bold mt-1" style={{ color: group.color }}>
                  {signal.score > 0 ? signal.score : '—'}
                </div>
                <div className="text-[10px] text-gray-400 font-mono">{signal.outputId}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-dashed border-gray-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-semibold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">AI SUMMARY</span>
          </div>
          <p className="text-sm text-gray-500 italic">
            {isAtlanta
              ? 'Atlanta shows strong demand fundamentals with moderate supply risk. Momentum is steady with rent growth decelerating. Position metrics indicate value-add opportunities in B-class vintage. Key risk: new supply concentration in Midtown/Buckhead corridors.'
              : 'AI narrative will be generated once market data is connected.'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Recent Market Intelligence</h3>
          <span className="text-[10px] font-mono text-gray-400">R-10</span>
        </div>
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div key={i} className={`border-l-4 rounded-r-lg p-3 ${severityStyles[alert.severity]}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800">{alert.title}</span>
                <span className="text-[10px] text-gray-400 flex-shrink-0 ml-3">{alert.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <OutputSection
        title="Supply Snapshot Enhanced"
        description="Existing inventory, pipeline, and development capacity outlook"
        outputIds={['S-01', 'S-02', 'S-03', 'S-05', 'S-06', 'S-10', 'DC-01', 'DC-04', 'DC-08']}
        groupHighlight="SUPPLY"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <OutputCard outputId="S-01" status={isAtlanta ? 'real' : 'mock'} value={isAtlanta ? '1,028' : undefined} subtitle="Properties in inventory" />
          <OutputCard outputId="S-02" status="mock" subtitle="Under construction" />
          <OutputCard outputId="S-03" status="mock" subtitle="Permitted, not started" />
          <OutputCard outputId="S-05" status="mock" subtitle="Delivery clustering analysis" />
          <OutputCard outputId="S-06" status="mock" subtitle="QoQ permit trend" />
          <OutputCard outputId="S-10" status={isAtlanta ? 'real' : 'mock'} subtitle="Vintage distribution" />
          <OutputCard outputId="DC-01" status="pending" subtitle="Zoning capacity ratio" />
          <OutputCard outputId="DC-04" status="pending" subtitle="Supply overhang risk" />
          <OutputCard outputId="DC-08" status="pending" subtitle="10-year supply wave forecast" />
        </div>
      </OutputSection>
    </div>
  );
};

export default OverviewTab;
