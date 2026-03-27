import React, { useState } from 'react';
import { StrategyResults } from '@/services/dealAnalysis.service';
import { BT } from '@/components/deal/bloomberg-ui';

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
    if (confidence >= 80) return BT.text.green;
    if (confidence >= 60) return BT.text.cyan;
    if (confidence >= 40) return BT.text.amber;
    return BT.text.orange;
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 80) return 'High Confidence';
    if (confidence >= 60) return 'Good Confidence';
    if (confidence >= 40) return 'Moderate Confidence';
    return 'Low Confidence';
  };

  return (
    <div className="space-y-6">
      <div className="p-6" style={{ background: BT.bg.panelAlt, borderRadius: 0, border: `1px solid ${BT.border.medium}` }}>
        <div className="flex items-start justify-between">
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono, marginBottom: '8px' }}>
              Strategy Recommendations
            </h2>
            <p style={{ color: BT.text.secondary, fontFamily: BT.font.label, fontSize: '11px' }}>
              Based on analysis of your {dealType} deal, we've identified{' '}
              {results.strategies.length} potential strategies
            </p>
          </div>
          <div style={{ fontSize: '10px', color: BT.text.muted, fontFamily: BT.font.label }}>
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
              className="transition-all"
              style={{
                borderRadius: 0,
                border: isSelected
                  ? `2px solid ${BT.text.cyan}`
                  : isRecommended
                  ? `2px solid ${BT.text.green}`
                  : `2px solid ${BT.border.medium}`,
                background: BT.bg.panel,
              }}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 style={{ fontSize: '14px', fontWeight: 600, color: BT.text.primary, fontFamily: BT.font.mono }}>
                        {strategy.name}
                      </h3>
                      {isRecommended && (
                        <span className="px-3 py-1" style={{ fontSize: '9px', fontWeight: 600, background: BT.bg.active, color: BT.text.green, borderRadius: '2px', fontFamily: BT.font.mono }}>
                          Recommended
                        </span>
                      )}
                      {isSelected && !isRecommended && (
                        <span className="px-3 py-1" style={{ fontSize: '9px', fontWeight: 600, background: BT.bg.active, color: BT.text.cyan, borderRadius: '2px', fontFamily: BT.font.mono }}>
                          Selected
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '10px', color: BT.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: BT.font.mono, marginBottom: '8px' }}>
                      {strategy.type}
                    </p>
                  </div>

                  <div
                    className="px-4 py-2"
                    style={{ borderRadius: 0, background: BT.bg.active, textAlign: 'center' }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: 600, color: getConfidenceColor(strategy.confidence), fontFamily: BT.font.mono }}>{strategy.confidence}%</div>
                    <div style={{ fontSize: '9px', color: BT.text.muted, fontFamily: BT.font.label }}>
                      {getConfidenceLabel(strategy.confidence)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  {strategy.projectedROI && (
                    <div className="p-3" style={{ background: BT.bg.panelAlt, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
                      <div style={{ fontSize: '10px', color: BT.text.secondary, fontFamily: BT.font.label }}>Projected ROI</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono }}>
                        {strategy.projectedROI}%
                      </div>
                    </div>
                  )}
                  {strategy.timelineMonths && (
                    <div className="p-3" style={{ background: BT.bg.panelAlt, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
                      <div style={{ fontSize: '10px', color: BT.text.secondary, fontFamily: BT.font.label }}>Timeline</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono }}>
                        {strategy.timelineMonths} months
                      </div>
                    </div>
                  )}
                </div>

                {strategy.description && (
                  <p style={{ color: BT.text.secondary, fontFamily: BT.font.label, fontSize: '11px', marginBottom: '16px' }}>{strategy.description}</p>
                )}

                <button
                  onClick={() => toggleExpand(strategy.id)}
                  style={{ fontSize: '10px', color: BT.text.cyan, fontWeight: 500, fontFamily: BT.font.mono, marginBottom: '16px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  {isExpanded ? 'Hide Details' : 'Show Details'}
                </button>

                {isExpanded && (
                  <div className="space-y-4 pt-4" style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
                    {strategy.opportunities && strategy.opportunities.length > 0 && (
                      <div>
                        <h4 className="flex items-center gap-2 mb-2" style={{ fontWeight: 600, color: BT.text.primary, fontFamily: BT.font.mono, fontSize: '11px' }}>
                          <span style={{ color: BT.text.green }}>✓</span> Opportunities
                        </h4>
                        <ul className="space-y-1">
                          {strategy.opportunities.map((opp: string, idx: number) => (
                            <li key={idx} className="flex gap-2" style={{ fontSize: '11px', color: BT.text.secondary, fontFamily: BT.font.label }}>
                              <span style={{ color: BT.text.green }}>•</span>
                              <span>{opp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {strategy.risks && strategy.risks.length > 0 && (
                      <div>
                        <h4 className="flex items-center gap-2 mb-2" style={{ fontWeight: 600, color: BT.text.primary, fontFamily: BT.font.mono, fontSize: '11px' }}>
                          <span style={{ color: BT.text.orange }}>!</span> Risks
                        </h4>
                        <ul className="space-y-1">
                          {strategy.risks.map((risk: string, idx: number) => (
                            <li key={idx} className="flex gap-2" style={{ fontSize: '11px', color: BT.text.secondary, fontFamily: BT.font.label }}>
                              <span style={{ color: BT.text.orange }}>•</span>
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
                    className="w-full py-3 px-6 transition-colors"
                    style={{
                      borderRadius: 0,
                      fontWeight: 600,
                      fontFamily: BT.font.mono,
                      fontSize: '11px',
                      background: isSelected ? BT.text.cyan : 'transparent',
                      color: isSelected ? BT.bg.terminal : BT.text.cyan,
                      border: isSelected ? 'none' : `2px solid ${BT.text.cyan}`,
                      cursor: 'pointer',
                    }}
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
