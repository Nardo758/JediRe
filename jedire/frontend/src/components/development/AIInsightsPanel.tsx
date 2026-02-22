import React from 'react';
import {
  Sparkles,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  DollarSign,
  Calendar,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
} from 'lucide-react';
import type { DDInsights } from '../../types/development/dueDiligence.types';

interface AIInsightsPanelProps {
  insights: DDInsights;
  onRefresh: () => void;
}

export const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({ insights, onRefresh }) => {
  const getRecommendationColor = (recommendation?: string) => {
    switch (recommendation) {
      case 'go':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'proceed_with_caution':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'no_go':
        return 'bg-red-50 border-red-200 text-red-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getRecommendationIcon = (recommendation?: string) => {
    switch (recommendation) {
      case 'go':
        return <ThumbsUp className="w-5 h-5 text-green-600" />;
      case 'proceed_with_caution':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'no_go':
        return <ThumbsDown className="w-5 h-5 text-red-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg shadow-sm sticky top-24">
      {/* Header */}
      <div className="p-4 border-b border-purple-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">AI DD Insights</h3>
          </div>
          <button
            onClick={onRefresh}
            className="p-1 text-purple-600 hover:bg-purple-100 rounded"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center space-x-2 text-xs text-gray-600">
          <span>Confidence:</span>
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div
              className="bg-purple-600 h-2 rounded-full"
              style={{ width: `${insights.confidence}%` }}
            />
          </div>
          <span className="font-semibold">{insights.confidence}%</span>
        </div>
      </div>

      <div className="p-4 space-y-4 max-h-[calc(100vh-12rem)] overflow-y-auto">
        {/* Go/No-Go Recommendation */}
        {insights.goNoGoRecommendation && (
          <div className={`border-2 rounded-lg p-4 ${getRecommendationColor(insights.goNoGoRecommendation)}`}>
            <div className="flex items-center space-x-2 mb-2">
              {getRecommendationIcon(insights.goNoGoRecommendation)}
              <h4 className="font-semibold">Recommendation</h4>
            </div>
            <p className="text-sm font-medium">
              {insights.goNoGoRecommendation === 'go' && 'Proceed with Development'}
              {insights.goNoGoRecommendation === 'proceed_with_caution' && 'Proceed with Caution'}
              {insights.goNoGoRecommendation === 'no_go' && 'High Risk - Reconsider'}
            </p>
          </div>
        )}

        {/* Critical Risks */}
        {insights.criticalRisks.length > 0 && (
          <div className="bg-white rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <h4 className="font-semibold text-gray-900">Critical Risks</h4>
            </div>
            <ul className="space-y-2">
              {insights.criticalRisks.slice(0, 5).map((risk, idx) => (
                <li key={idx} className="flex items-start space-x-2 text-sm">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="text-gray-700">{risk}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommended Actions */}
        {insights.recommendedActions.length > 0 && (
          <div className="bg-white rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              <h4 className="font-semibold text-gray-900">Recommended Actions</h4>
            </div>
            <div className="space-y-3">
              {insights.recommendedActions.slice(0, 5).map((action, idx) => (
                <div key={idx} className="border border-gray-200 rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(action.priority)}`}>
                      {action.priority}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 mb-1">{action.action}</p>
                  <p className="text-xs text-gray-600">{action.reasoning}</p>
                  {action.estimatedImpact && (
                    <div className="mt-2 text-xs text-blue-600 font-medium">
                      💡 {action.estimatedImpact}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline Impacts */}
        {insights.timelineImpacts.length > 0 && (
          <div className="bg-white rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <Calendar className="w-5 h-5 text-orange-600" />
              <h4 className="font-semibold text-gray-900">Timeline Impacts</h4>
            </div>
            <div className="space-y-2">
              {insights.timelineImpacts.slice(0, 3).map((impact, idx) => (
                <div key={idx} className="flex items-start justify-between p-2 bg-orange-50 rounded">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{impact.item}</p>
                    <p className="text-xs text-gray-600 mt-1">{impact.recommendation}</p>
                  </div>
                  <div className="ml-2 text-right">
                    <div className="text-sm font-bold text-orange-600">
                      {impact.delayWeeks > 0 ? '+' : ''}{impact.delayWeeks}w
                    </div>
                    {impact.criticalPath && (
                      <span className="text-xs text-red-600 font-semibold">Critical</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cost Impacts */}
        {insights.costImpacts.length > 0 && (
          <div className="bg-white rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <DollarSign className="w-5 h-5 text-green-600" />
              <h4 className="font-semibold text-gray-900">Cost Impacts</h4>
            </div>
            <div className="space-y-2">
              {insights.costImpacts.slice(0, 3).map((impact, idx) => (
                <div key={idx} className="flex items-start justify-between p-2 bg-green-50 rounded">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{impact.item}</p>
                    <p className="text-xs text-gray-600 mt-1">{impact.recommendation}</p>
                  </div>
                  <div className="ml-2 text-right">
                    <div className={`text-sm font-bold ${impact.costChange >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {impact.costChange >= 0 ? '+' : ''}${Math.abs(impact.costChange / 1000).toFixed(0)}k
                    </div>
                    <span className="text-xs text-gray-600 capitalize">{impact.category.replace('_', ' ')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Button */}
        <button className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center space-x-2">
          <TrendingUp className="w-5 h-5" />
          <span>Update Pro Forma</span>
        </button>
      </div>
    </div>
  );
};

export default AIInsightsPanel;
