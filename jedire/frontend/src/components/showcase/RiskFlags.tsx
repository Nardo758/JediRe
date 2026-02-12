import React, { useState } from 'react';
import type { RiskFlag } from '../../types/showcase.types';

interface Props {
  risks: RiskFlag[];
}

export function RiskFlags({ risks }: Props) {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');

  const severityColors = {
    low: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', badge: 'bg-green-100' },
    medium: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', badge: 'bg-yellow-100' },
    high: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', badge: 'bg-orange-100' },
    critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', badge: 'bg-red-100' }
  };

  const statusColors = {
    open: 'bg-red-100 text-red-800',
    monitoring: 'bg-yellow-100 text-yellow-800',
    mitigated: 'bg-blue-100 text-blue-800',
    resolved: 'bg-green-100 text-green-800'
  };

  const filteredRisks = risks.filter(risk => 
    selectedSeverity === 'all' || risk.severity === selectedSeverity
  );

  const riskScore = risks.reduce((sum, risk) => {
    const severityWeight = { low: 1, medium: 2, high: 3, critical: 4 };
    return sum + severityWeight[risk.severity] * (risk.impact * risk.probability / 100);
  }, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedSeverity('all')}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              selectedSeverity === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({risks.length})
          </button>
          {Object.keys(severityColors).map(severity => (
            <button
              key={severity}
              onClick={() => setSelectedSeverity(severity)}
              className={`px-3 py-1.5 text-sm rounded-lg capitalize ${
                selectedSeverity === severity ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {severity} ({risks.filter(r => r.severity === severity).length})
            </button>
          ))}
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">{Math.round(riskScore)}</div>
          <div className="text-xs text-gray-500">Overall Risk Score</div>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredRisks.map(risk => {
          const colors = severityColors[risk.severity];
          return (
            <div
              key={risk.id}
              className={`p-4 rounded-lg border-2 ${colors.bg} ${colors.border}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`font-semibold ${colors.text}`}>{risk.title}</h4>
                    {risk.aiDetected && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-800">
                        ✨ AI
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700">{risk.description}</p>
                </div>
                
                <div className="flex gap-2">
                  <span className={`px-2 py-1 text-xs rounded-full font-semibold capitalize ${colors.badge} ${colors.text}`}>
                    {risk.severity}
                  </span>
                  <span className={`px-2 py-1 text-xs rounded-full font-semibold capitalize ${statusColors[risk.status]}`}>
                    {risk.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-3">
                <div>
                  <div className="text-xs text-gray-600 mb-1">Impact</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${colors.text.replace('text-', 'bg-')}`}
                        style={{ width: `${risk.impact}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-700">{risk.impact}%</span>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-600 mb-1">Probability</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${colors.text.replace('text-', 'bg-')}`}
                        style={{ width: `${risk.probability}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-700">{risk.probability}%</span>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-600 mb-1">Category</div>
                  <div className="text-xs font-semibold text-gray-700 capitalize">{risk.category}</div>
                </div>
              </div>

              {risk.mitigation && (
                <div className="p-2 bg-white rounded border border-gray-200">
                  <div className="text-xs font-semibold text-gray-700 mb-1">Mitigation</div>
                  <p className="text-xs text-gray-600">{risk.mitigation}</p>
                </div>
              )}

              <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                <span>📅 {new Date(risk.detectedAt).toLocaleDateString()}</span>
                {risk.dataSources.length > 0 && (
                  <span>📊 {risk.dataSources.join(', ')}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
