import React from 'react';
import { Button } from '../shared/Button';
import {
  StrategyAnalysisResult,
  ZoningAnalysisResult,
} from '../../services/dealAnalysis.service';

interface StrategyAnalysisResultsProps {
  results?: StrategyAnalysisResult;
  zoningResults?: ZoningAnalysisResult;
  dealType: string;
  onChooseStrategy?: (physicalOptionId: string, strategyId: string) => void;
  onViewDetailed?: () => void;
  onCompareAll?: () => void;
  onStartDesign?: () => void;
  onViewZoning?: () => void;
}

export const StrategyAnalysisResults: React.FC<StrategyAnalysisResultsProps> = ({
  results,
  zoningResults,
  dealType,
  onChooseStrategy,
  onViewDetailed,
  onCompareAll,
  onStartDesign,
  onViewZoning,
}) => {
  const isExisting = dealType === 'existing';

  // For NEW DEVELOPMENT - show zoning results
  if (!isExisting && zoningResults) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg shadow-lg mx-6 mt-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-blue-200 bg-white/50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📐</span>
            <h2 className="text-xl font-bold text-gray-900">Zoning Analysis Complete</h2>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-700 uppercase mb-3">
              Maximum Allowed
            </h3>
            <div className="space-y-2 text-gray-700">
              <div className="flex items-center gap-2">
                <span className="text-lg">•</span>
                <span>
                  <span className="font-semibold">{zoningResults.maxUnits} units</span> (current zoning {zoningResults.zoning})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">•</span>
                <span>
                  <span className="font-semibold">{zoningResults.heightLimit} ft</span> height limit
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">•</span>
                <span>
                  <span className="font-semibold">{zoningResults.lotCoverage}%</span> lot coverage
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">•</span>
                <span>
                  <span className="font-semibold">{zoningResults.parkingRequired} parking spaces</span> required
                </span>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-700 uppercase mb-3">
              Next Actions
            </h3>
            <div className="space-y-2 text-gray-700">
              <div className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">☐</span>
                <span>Design project in 3D (unit mix, massing, site plan)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">☐</span>
                <span>Define development features (amenities, parking)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">☐</span>
                <span>Build construction timeline</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">☐</span>
                <span>Create development pro forma</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-4 border-t border-blue-200">
            {onStartDesign && (
              <Button variant="default" size="md" onClick={onStartDesign}>
                Start 3D Design →
              </Button>
            )}
            {onViewZoning && (
              <Button variant="outline" size="md" onClick={onViewZoning}>
                View Zoning Details
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // For EXISTING PROPERTIES - show strategy matrix
  if (isExisting && results) {
    const { physicalOptions, strategies, matrix, bestStrategy } = results;

    const bestPhysical = physicalOptions.find(p => p.id === bestStrategy.physicalOptionId);
    const bestStrategyData = strategies.find(s => s.id === bestStrategy.strategyId);

    const formatCurrency = (value: number): string => {
      if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(1)}M`;
      }
      return `$${(value / 1000).toFixed(0)}K`;
    };

    const getMatrixCell = (physicalId: string, strategyId: string) => {
      const physicalIdx = physicalOptions.findIndex(p => p.id === physicalId);
      const strategyIdx = strategies.findIndex(s => s.id === strategyId);
      if (physicalIdx === -1 || strategyIdx === -1) return null;
      return matrix[physicalIdx][strategyIdx];
    };

    const isBestStrategy = (physicalId: string, strategyId: string) => {
      return physicalId === bestStrategy.physicalOptionId && 
             strategyId === bestStrategy.strategyId;
    };

    return (
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg shadow-lg mx-6 mt-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-green-200 bg-white/50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎯</span>
            <h2 className="text-xl font-bold text-gray-900">Strategy Analysis Complete</h2>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-gray-700 mb-6">
            We analyzed <span className="font-semibold">{strategies.length * physicalOptions.length} strategies</span> across{' '}
            <span className="font-semibold">{physicalOptions.length} physical options</span>:
          </p>

          {/* Strategy Matrix */}
          <div className="mb-6 overflow-x-auto">
            <h3 className="text-sm font-bold text-gray-700 uppercase mb-3">
              Physical Options × Investment Strategies
            </h3>
            
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-3 bg-white/70 border border-gray-300 font-semibold text-sm">
                    Strategy
                  </th>
                  {physicalOptions.map(physical => (
                    <th
                      key={physical.id}
                      className="text-center p-3 bg-white/70 border border-gray-300"
                    >
                      <div className="font-semibold text-sm">{physical.name}</div>
                      <div className="text-xs text-gray-600">
                        {physical.id === 'as-is' && `${physical.units} units`}
                        {physical.id === 'redevelop' && `(+${physical.units - physicalOptions[0].units} units)`}
                        {physical.id === 'rebuild' && `(${physical.units} units)`}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {strategies.map(strategy => (
                  <tr key={strategy.id}>
                    <td className="p-3 bg-white/70 border border-gray-300 font-medium text-sm">
                      {strategy.name}
                    </td>
                    {physicalOptions.map(physical => {
                      const cell = getMatrixCell(physical.id, strategy.id);
                      const isBest = isBestStrategy(physical.id, strategy.id);
                      
                      if (!cell || cell.irr === 0) {
                        return (
                          <td
                            key={physical.id}
                            className="p-3 bg-gray-100 border border-gray-300 text-center text-gray-400 text-sm"
                          >
                            N/A
                          </td>
                        );
                      }

                      return (
                        <td
                          key={physical.id}
                          className={`p-3 border border-gray-300 text-center relative ${
                            isBest
                              ? 'bg-yellow-100 border-yellow-400 border-2'
                              : 'bg-white/70'
                          }`}
                        >
                          <div className="font-bold text-base">
                            {(cell.irr * 100).toFixed(1)}% IRR
                            {isBest && <span className="ml-1 text-yellow-600">★</span>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Best Strategy Callout */}
          <div className="mb-6 p-5 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
            <div className="flex items-start gap-3">
              <span className="text-2xl">★</span>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  BEST RETURN: {bestPhysical?.name} + {bestStrategyData?.name}
                </h3>
                <div className="space-y-1 text-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">•</span>
                    <span>
                      <span className="font-semibold">IRR: {(bestStrategy.irr * 100).toFixed(1)}%</span>
                      {' '}({bestStrategy.details.timelineMonths} months)
                    </span>
                  </div>
                  {bestPhysical?.id === 'redevelop' && (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">•</span>
                        <span>Add {bestStrategy.details.units - physicalOptions[0].units} units on vacant portion</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">•</span>
                        <span>Renovate existing {physicalOptions[0].units} units</span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-sm">•</span>
                    <span>
                      Total investment: <span className="font-semibold">
                        {formatCurrency(bestStrategy.details.totalInvestment)}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">•</span>
                    <span>
                      Exit value: <span className="font-semibold">
                        {formatCurrency(bestStrategy.details.exitValue)}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-4 border-t border-green-200">
            {onChooseStrategy && (
              <Button
                variant="default"
                size="md"
                onClick={() => onChooseStrategy(
                  bestStrategy.physicalOptionId,
                  bestStrategy.strategyId
                )}
              >
                Choose This Strategy →
              </Button>
            )}
            {onViewDetailed && (
              <Button variant="outline" size="md" onClick={onViewDetailed}>
                View Detailed Analysis
              </Button>
            )}
            {onCompareAll && (
              <Button variant="ghost" size="md" onClick={onCompareAll}>
                Compare All Strategies
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};
