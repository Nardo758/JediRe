import React, { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Send, Eye, X, TrendingUp } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import type { AIInsight } from '@/types/development';

interface AIInsightsPanelProps {
  insights?: AIInsight[];
  onApplyAll: () => void;
  onApplySelected: () => void;
}

export const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({
  insights = [],
  onApplyAll,
  onApplySelected,
}) => {
  const [selectedInsights, setSelectedInsights] = useState<string[]>([]);
  const [expandedInsights, setExpandedInsights] = useState<string[]>([]);

  const handleToggleInsight = (insightId: string) => {
    setSelectedInsights(prev =>
      prev.includes(insightId)
        ? prev.filter(id => id !== insightId)
        : [...prev, insightId]
    );
  };

  const handleToggleExpand = (insightId: string) => {
    setExpandedInsights(prev =>
      prev.includes(insightId)
        ? prev.filter(id => id !== insightId)
        : [...prev, insightId]
    );
  };

  const getImpactColor = (impact: 'high' | 'medium' | 'low') => {
    switch (impact) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getTypeIcon = (type: AIInsight['type']) => {
    switch (type) {
      case 'unit-mix':
        return '🏗️';
      case 'amenity':
        return '✨';
      case 'pricing':
        return '💰';
      case 'timing':
        return '⏰';
      default:
        return '💡';
    }
  };

  if (insights.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-500">
          <Sparkles className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">No AI insights available yet</p>
          <p className="text-xs text-gray-400 mt-1">
            AI analysis will appear here once market data is processed
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg shadow-sm border border-purple-200 overflow-hidden">
      <div className="p-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            <h3 className="text-lg font-semibold">AI Development Insights</h3>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="text-xs bg-white/20 px-2 py-1 rounded">
              {insights.length} recommendations
            </div>
          </div>
        </div>
        <p className="text-xs text-purple-100 mt-1">
          Powered by market analysis and development optimization algorithms
        </p>
      </div>

      <div className="p-4 space-y-3">
        {insights.map((insight) => {
          const isSelected = selectedInsights.includes(insight.id);
          const isExpanded = expandedInsights.includes(insight.id);

          return (
            <div
              key={insight.id}
              className={`bg-white rounded-lg border-2 transition-all ${
                isSelected
                  ? 'border-blue-500 shadow-md'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleInsight(insight.id)}
                    className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getTypeIcon(insight.type)}</span>
                        <h4 className="text-sm font-semibold text-gray-900">
                          {insight.title}
                        </h4>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full border ${getImpactColor(insight.impact)}`}>
                          {insight.impact.toUpperCase()} IMPACT
                        </span>
                        <span className="text-xs text-gray-500">
                          {(insight.confidence * 100).toFixed(0)}% confidence
                        </span>
                      </div>
                    </div>

                    <p className="text-sm text-gray-700 mb-2">
                      {insight.description}
                    </p>

                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <span className="text-sm font-medium text-gray-900">
                        {insight.recommendation}
                      </span>
                    </div>

                    {insight.estimatedValue && (
                      <div className="inline-flex items-center gap-1 bg-green-50 border border-green-200 rounded px-2 py-1 mb-2">
                        <span className="text-xs text-green-700">
                          Est. Value:
                        </span>
                        <span className="text-sm font-bold text-green-900">
                          ${insight.estimatedValue.toLocaleString()}
                        </span>
                        {insight.timeframe && (
                          <span className="text-xs text-green-600">
                            / {insight.timeframe}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Expandable Data Points */}
                    {insight.dataPoints && insight.dataPoints.length > 0 && (
                      <button
                        onClick={() => handleToggleExpand(insight.id)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 mt-2"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3 h-3" />
                            Hide data points
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3 h-3" />
                            Show {insight.dataPoints.length} data points
                          </>
                        )}
                      </button>
                    )}

                    {isExpanded && insight.dataPoints && (
                      <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200">
                        <div className="text-xs font-semibold text-gray-700 mb-2">
                          Supporting Data:
                        </div>
                        <ul className="space-y-1">
                          {insight.dataPoints.map((point, idx) => (
                            <li key={idx} className="text-xs text-gray-600 flex items-start gap-2">
                              <span className="text-blue-500">•</span>
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Footer */}
      <div className="p-4 bg-white border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <span className="font-semibold">{selectedInsights.length}</span> of{' '}
            <span className="font-semibold">{insights.length}</span> insights selected
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedInsights([])}
              disabled={selectedInsights.length === 0}
            >
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onApplySelected}
              disabled={selectedInsights.length === 0}
            >
              <Eye className="w-4 h-4 mr-1" />
              Preview Selected
            </Button>
            
            <Button
              variant="default"
              size="sm"
              onClick={onApplyAll}
              className="flex items-center gap-1"
            >
              <Send className="w-4 h-4" />
              Apply to 3D Design
            </Button>
          </div>
        </div>
        
        <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-800">
          💡 <span className="font-semibold">Tip:</span> Selected recommendations will be sent to
          the 3D Design page with pre-configured settings
        </div>
      </div>
    </div>
  );
};
