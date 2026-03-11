import React, { useState } from 'react';
import type { Decision } from '../../types/showcase.types';

interface Props {
  decisions: Decision[];
}

export function DecisionLog({ decisions }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getOutcomeColor = (outcome?: string) => {
    switch (outcome) {
      case 'positive': return 'bg-green-100 text-green-800';
      case 'neutral': return 'bg-gray-100 text-gray-800';
      case 'negative': return 'bg-red-100 text-red-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className="space-y-4">
      {decisions.map(decision => (
        <div
          key={decision.id}
          className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
        >
          <div
            className="p-4 bg-white cursor-pointer"
            onClick={() => setExpandedId(expandedId === decision.id ? null : decision.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-gray-900">{decision.title}</h4>
                  {decision.outcome && (
                    <span className={`px-2 py-0.5 text-xs rounded-full ${getOutcomeColor(decision.outcome)}`}>
                      {decision.outcome}
                      {decision.impactScore && ` • ${decision.impactScore}/100`}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">{decision.description}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span>👤 {decision.decidedBy}</span>
                  <span>📅 {new Date(decision.date).toLocaleDateString()}</span>
                  <span>📊 {decision.dataSources.length} sources</span>
                </div>
              </div>
              
              <button className="ml-4 text-gray-400 hover:text-gray-600">
                {expandedId === decision.id ? '▼' : '▶'}
              </button>
            </div>
          </div>

          {expandedId === decision.id && (
            <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-4">
              {decision.aiRecommendation && (
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-purple-600">✨</span>
                    <span className="text-sm font-semibold text-purple-900">AI Recommendation</span>
                  </div>
                  <p className="text-sm text-purple-800">{decision.aiRecommendation}</p>
                </div>
              )}

              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-blue-600">✓</span>
                  <span className="text-sm font-semibold text-blue-900">Actual Decision</span>
                </div>
                <p className="text-sm text-blue-800">{decision.actualChoice}</p>
              </div>

              <div>
                <h5 className="text-sm font-semibold text-gray-700 mb-2">Reasoning</h5>
                <p className="text-sm text-gray-600">{decision.reasoning}</p>
              </div>

              <div>
                <h5 className="text-sm font-semibold text-gray-700 mb-2">Data Sources</h5>
                <div className="flex flex-wrap gap-2">
                  {decision.dataSources.map((source, i) => (
                    <span key={i} className="px-2 py-1 text-xs rounded-full bg-gray-200 text-gray-700">
                      {source}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
