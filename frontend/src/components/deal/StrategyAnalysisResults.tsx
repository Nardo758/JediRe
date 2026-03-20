import React, { useState } from 'react';
import { StrategyResults } from '@/services/dealAnalysis.service';

export interface StrategyAnalysisResultsProps {
  results: StrategyResults;
  dealType: string;
  onChooseStrategy?: (strategyId: string) => void;
}

export const StrategyAnalysisResults: React.FC<StrategyAnalysisResultsProps> = ({
  results,
  dealType,
  onChooseStrategy,
}) => {
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(
    results.recommendedStrategyId || null
  );
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(
    results.recommendedStrategyId || null
  );

  const handleSelectStrategy = (strategyId: string) => {
    setSelectedStrategy(strategyId);
    onChooseStrategy?.(strategyId);
  };

  const toggleExpand = (strategyId: string) => {
    setExpandedStrategy(expandedStrategy === strategyId ? null : strategyId);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-[#022c22]';
    if (confidence >= 60) return 'text-blue-600 bg-[#0d1e3d]';
    if (confidence >= 40) return 'text-yellow-600 bg-[#1a1200]';
    return 'text-orange-600 bg-[#1a0d00]';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 80) return 'High Confidence';
    if (confidence >= 60) return 'Good Confidence';
    if (confidence >= 40) return 'Moderate Confidence';
    return 'Low Confidence';
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-900/50">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#E8E6E1] mb-2">
              Strategy Recommendations
            </h2>
            <p className="text-[#9EA8B4]">
              Based on analysis of your {dealType} deal, we've identified{' '}
              {results.strategies.length} potential strategies
            </p>
          </div>
          <div className="text-sm text-[#6B7585]">
            Analyzed {new Date(results.analysisCompletedAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {results.strategies.map((strategy) => {
          const isRecommended = strategy.id === results.recommendedStrategyId;
          const isSelected = strategy.id === selectedStrategy;
          const isExpanded = strategy.id === expandedStrategy;

          return (
            <div
              key={strategy.id}
              className={`rounded-lg border-2 transition-all ${
                isSelected
                  ? 'border-blue-500 bg-[#0d1e3d]'
                  : isRecommended
                  ? 'border-green-500 bg-[#022c22]'
                  : 'border-[#1e2a3d] bg-[#0F1319] hover:border-[#253347]'
              }`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-[#E8E6E1]">
                        {strategy.name}
                      </h3>
                      {isRecommended && (
                        <span className="px-3 py-1 text-xs font-semibold bg-[#022c22] text-green-300 rounded-full">
                          Recommended
                        </span>
                      )}
                      {isSelected && !isRecommended && (
                        <span className="px-3 py-1 text-xs font-semibold bg-[#0d1e3d] text-blue-300 rounded-full">
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#9EA8B4] uppercase tracking-wide mb-2">
                      {strategy.type}
                    </p>
                  </div>

                  <div
                    className={`px-4 py-2 rounded-lg text-sm font-semibold ${getConfidenceColor(
                      strategy.confidence
                    )}`}
                  >
                    <div className="text-lg">{strategy.confidence}%</div>
                    <div className="text-xs opacity-75">
                      {getConfidenceLabel(strategy.confidence)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  {strategy.projectedROI && (
                    <div className="bg-[#0F1319] rounded-lg p-3 border border-[#1e2a3d]">
                      <div className="text-sm text-[#9EA8B4]">Projected ROI</div>
                      <div className="text-2xl font-bold text-[#E8E6E1]">
                        {strategy.projectedROI}%
                      </div>
                    </div>
                  )}
                  {strategy.timelineMonths && (
                    <div className="bg-[#0F1319] rounded-lg p-3 border border-[#1e2a3d]">
                      <div className="text-sm text-[#9EA8B4]">Timeline</div>
                      <div className="text-2xl font-bold text-[#E8E6E1]">
                        {strategy.timelineMonths} months
                      </div>
                    </div>
                  )}
                </div>

                {strategy.description && (
                  <p className="text-[#9EA8B4] mb-4">{strategy.description}</p>
                )}

                <button
                  onClick={() => toggleExpand(strategy.id)}
                  className="text-sm text-blue-600 hover:text-blue-400 font-medium mb-4"
                >
                  {isExpanded ? 'Hide Details' : 'Show Details'}
                </button>

                {isExpanded && (
                  <div className="space-y-4 pt-4 border-t border-[#1e2a3d]">
                    {strategy.opportunities && strategy.opportunities.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-[#E8E6E1] mb-2 flex items-center gap-2">
                          <span className="text-green-500">✓</span> Opportunities
                        </h4>
                        <ul className="space-y-1">
                          {strategy.opportunities.map((opp, idx) => (
                            <li key={idx} className="text-sm text-[#9EA8B4] flex gap-2">
                              <span className="text-green-500">•</span>
                              <span>{opp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {strategy.risks && strategy.risks.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-[#E8E6E1] mb-2 flex items-center gap-2">
                          <span className="text-orange-500">!</span> Risks
                        </h4>
                        <ul className="space-y-1">
                          {strategy.risks.map((risk, idx) => (
                            <li key={idx} className="text-sm text-[#9EA8B4] flex gap-2">
                              <span className="text-orange-500">•</span>
                              <span>{risk}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4">
                  <button
                    onClick={() => handleSelectStrategy(strategy.id)}
                    className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-[#0F1319] text-blue-600 border-2 border-blue-600 hover:bg-[#0d1e3d]'
                    }`}
                  >
                    {isSelected ? 'Selected Strategy' : 'Choose This Strategy'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StrategyAnalysisResults;
