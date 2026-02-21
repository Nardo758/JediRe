import React from 'react';
import { Building2, Plus, Calendar, DollarSign } from 'lucide-react';
import OutputCard, { OutputSection } from '../components/OutputCard';
import { SIGNAL_GROUPS } from '../signalGroups';

interface DealsTabProps {
  marketId: string;
  summary?: Record<string, any>;
  onUpdate?: () => void;
}

const DealsTab: React.FC<DealsTabProps> = ({ marketId, summary, onUpdate }) => {
  const opportunityOutputs = ['C-01', 'P-03', 'P-05', 'D-09', 'S-05', 'T-01', 'T-04', 'T-06', 'T-09', 'T-10', 'DC-05', 'DC-06', 'DC-10', 'TA-01', 'TA-02'];
  const pipelineOutputs = ['C-01', 'C-04'];
  const activityOutputs = ['R-10', 'M-08', 'M-09'];
  const arbitrageOutputs = ['C-05', 'C-06', 'C-07', 'C-08', 'T-01', 'T-09'];

  const placeholderDeals = [
    { name: 'Heritage at Midtown', units: 240, jedi: 78, tags: ['Value-Add', 'B+ Vintage'] },
    { name: 'Parkside Residences', units: 180, jedi: 72, tags: ['Core-Plus', 'A Class'] },
    { name: 'Summit Creek Apartments', units: 320, jedi: 65, tags: ['Opportunistic', 'C Vintage'] },
  ];

  const kanbanColumns = [
    { stage: 'Screening', count: 4, color: 'bg-gray-100 border-gray-300' },
    { stage: 'LOI', count: 2, color: 'bg-blue-50 border-blue-300' },
    { stage: 'Due Diligence', count: 1, color: 'bg-amber-50 border-amber-300' },
    { stage: 'Closing', count: 1, color: 'bg-green-50 border-green-300' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Active Opportunities + Pipeline</h2>
            <p className="text-sm text-gray-500 mt-1">
              {summary?.market?.display_name || marketId} — 26 outputs across deal intelligence
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
            <Plus size={18} />
            New Deal
          </button>
        </div>
      </div>

      <OutputSection
        title="AI-Recommended Opportunities"
        description="Enhanced with Traffic + Dev Capacity + Trade Area signals"
        outputIds={opportunityOutputs}
      >
        <div className="space-y-4 mb-6">
          {placeholderDeals.map((deal, idx) => (
            <div key={idx} className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-gray-400" />
                    <span className="font-semibold text-gray-900">{deal.name}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><DollarSign size={12} />{deal.units} units</span>
                    <span className="flex items-center gap-1"><Calendar size={12} />Listed 3d ago</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded">JEDI {deal.jedi}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {deal.tags.map(tag => (
                  <span key={tag} className="text-[11px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{tag}</span>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {opportunityOutputs.slice(0, 6).map(id => (
                  <span key={id} className="text-[10px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">{id}</span>
                ))}
                <span className="text-[10px] text-gray-400">+{opportunityOutputs.length - 6} more</span>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Output Coverage ({opportunityOutputs.length} outputs)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {opportunityOutputs.map(id => (
              <OutputCard key={id} outputId={id} compact />
            ))}
          </div>
        </div>
      </OutputSection>

      <OutputSection
        title="My Pipeline"
        description="Stage-specific metrics per deal"
        outputIds={pipelineOutputs}
      >
        <div className="grid grid-cols-4 gap-4 mb-6">
          {kanbanColumns.map(col => (
            <div key={col.stage} className={`rounded-xl border-2 ${col.color} p-4 min-h-[200px]`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700">{col.stage}</span>
                <span className="text-xs font-bold text-gray-500 bg-white px-2 py-0.5 rounded-full">{col.count}</span>
              </div>
              {Array.from({ length: Math.min(col.count, 2) }).map((_, i) => (
                <div key={i} className="bg-white rounded-lg border border-gray-200 p-3 mb-2 shadow-sm">
                  <div className="h-3 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-2 bg-gray-100 rounded w-1/2"></div>
                </div>
              ))}
              {col.count > 2 && (
                <p className="text-[11px] text-gray-400 text-center mt-1">+{col.count - 2} more</p>
              )}
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Per-Deal Outputs ({pipelineOutputs.length} outputs)</p>
          <div className="flex gap-2">
            {pipelineOutputs.map(id => (
              <OutputCard key={id} outputId={id} compact />
            ))}
          </div>
        </div>
      </OutputSection>

      <OutputSection
        title="Market Deal Activity"
        description="Recent transaction signals and market momentum"
        outputIds={activityOutputs}
      >
        <div className="space-y-3 mb-6">
          {[
            { icon: '📰', text: 'Greystar sells 280-unit portfolio in Buckhead for $62M', time: '2h ago', type: 'Sale' },
            { icon: '📊', text: 'Cap rates compressed 15bps in Midtown submarket', time: '1d ago', type: 'Trend' },
            { icon: '🏗️', text: 'New 350-unit permit filed near Beltline corridor', time: '2d ago', type: 'Permit' },
            { icon: '💰', text: 'Investor activity index up 12% MoM in Atlanta MSA', time: '3d ago', type: 'Activity' },
          ].map((item, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
              <span className="text-lg">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800">{item.text}</p>
                <p className="text-xs text-gray-400 mt-0.5">{item.time}</p>
              </div>
              <span className="text-[10px] font-medium text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200 flex-shrink-0">{item.type}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Signal Outputs ({activityOutputs.length} outputs)</p>
          <div className="flex gap-2">
            {activityOutputs.map(id => (
              <OutputCard key={id} outputId={id} compact />
            ))}
          </div>
        </div>
      </OutputSection>

      <OutputSection
        title="Strategy Arbitrage Leaderboard"
        description="Ranked opportunities by alternative strategy upside"
        outputIds={arbitrageOutputs}
      >
        <div className="overflow-x-auto mb-6">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Rank</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Property</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Strategy</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Arbitrage Score</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Traffic Share</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Upside</th>
              </tr>
            </thead>
            <tbody>
              {[
                { rank: 1, name: 'Peachtree Lofts', strategy: 'Condo Conv.', score: 92, trafficShare: '18%', upside: '+34%' },
                { rank: 2, name: 'Brookhaven Terrace', strategy: 'STR Hybrid', score: 87, trafficShare: '14%', upside: '+28%' },
                { rank: 3, name: 'Midtown 440', strategy: 'BTR vs Hold', score: 81, trafficShare: '11%', upside: '+22%' },
                { rank: 4, name: 'Decatur Station', strategy: 'Value-Add', score: 76, trafficShare: '9%', upside: '+18%' },
              ].map(row => (
                <tr key={row.rank} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-bold text-gray-700">#{row.rank}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.name}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded">{row.strategy}</span>
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-teal-600">{row.score}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{row.trafficShare}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-green-600">{row.upside}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Arbitrage Outputs ({arbitrageOutputs.length} outputs)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {arbitrageOutputs.map(id => (
              <OutputCard key={id} outputId={id} compact />
            ))}
          </div>
        </div>
      </OutputSection>
    </div>
  );
};

export default DealsTab;
