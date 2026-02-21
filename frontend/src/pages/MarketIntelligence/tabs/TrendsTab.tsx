import React from 'react';
import OutputCard, { OutputSection } from '../components/OutputCard';
import { SIGNAL_GROUPS } from '../signalGroups';

interface TrendsTabProps {
  marketId: string;
  summary?: Record<string, any>;
  onUpdate?: () => void;
}

interface TrendSection {
  title: string;
  description: string;
  outputIds: string[];
  groupHighlight?: keyof typeof SIGNAL_GROUPS;
}

const TREND_SECTIONS: TrendSection[] = [
  {
    title: 'Rent Trends by Vintage',
    description: 'Rent time-series across vintage classes with supply-adjusted forecast overlay',
    outputIds: ['M-01', 'M-02', 'R-02', 'DC-11'],
    groupHighlight: 'MOMENTUM',
  },
  {
    title: 'Supply Pipeline Timeline',
    description: 'Construction pipeline and delivery schedule with 10-year supply wave',
    outputIds: ['S-02', 'S-03', 'S-04', 'S-05', 'S-06', 'DC-08'],
    groupHighlight: 'SUPPLY',
  },
  {
    title: 'Demand Signal Trends',
    description: 'Multi-source demand indicators including physical and digital traffic',
    outputIds: ['D-05', 'D-06', 'D-07', 'D-08', 'D-09', 'T-02', 'T-03', 'T-07'],
    groupHighlight: 'DEMAND',
  },
  {
    title: 'Transaction & Cap Rates',
    description: 'Sales volume, investor activity, and cap rate movement',
    outputIds: ['M-08', 'M-09', 'P-07'],
    groupHighlight: 'MOMENTUM',
  },
  {
    title: 'Concession & Occupancy Trends',
    description: 'Concession tracking, velocity, occupancy proxy, and drag rate',
    outputIds: ['M-03', 'M-04', 'M-06', 'R-03'],
    groupHighlight: 'MOMENTUM',
  },
  {
    title: 'JEDI Score History',
    description: 'Composite JEDI score time series with signal group decomposition',
    outputIds: ['C-01'],
    groupHighlight: 'COMPOSITE',
  },
];

const TrendsTab: React.FC<TrendsTabProps> = ({ marketId, summary }) => {
  const totalOutputs = TREND_SECTIONS.reduce((sum, s) => sum + s.outputIds.length, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Time-Series Momentum Analysis</h2>
            <p className="text-sm text-gray-500 mt-1">
              Trend analysis for {summary?.market?.display_name || marketId} — {totalOutputs} outputs across 6 sections
            </p>
          </div>
          <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded">
            {totalOutputs} outputs
          </span>
        </div>
      </div>

      {TREND_SECTIONS.map((section) => {
        const hasNew = section.outputIds.some(id => id.startsWith('DC-') || id.startsWith('T-'));
        return (
          <div key={section.title} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div
              className="px-6 py-4 border-b border-gray-100"
              style={
                section.groupHighlight
                  ? { borderLeftWidth: 4, borderLeftColor: SIGNAL_GROUPS[section.groupHighlight].color }
                  : {}
              }
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-gray-900">{section.title}</h3>
                    {hasNew && (
                      <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">
                        + NEW
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{section.description}</p>
                </div>
                <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded">
                  {section.outputIds.length} outputs
                </span>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="w-full h-48 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center">
                <div className="text-center">
                  <span className="text-gray-400 text-sm font-medium block">
                    Chart: {section.title}
                  </span>
                  <span className="text-gray-300 text-xs mt-1 block">
                    {section.outputIds.join(', ')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {section.outputIds.map(id => (
                  <OutputCard key={id} outputId={id} status="mock" />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TrendsTab;
