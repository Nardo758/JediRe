import React, { useState } from 'react';
import { Shield, Plus, Edit, Trash2, AlertTriangle, CheckCircle, Eye } from 'lucide-react';
import type { RiskMatrix, RiskItem } from '../../types/development/dueDiligence.types';

interface RiskMatrixHeatmapProps {
  riskMatrix: RiskMatrix;
  dealId: string;
  onUpdate: (updated: RiskMatrix) => void;
}

export const RiskMatrixHeatmap: React.FC<RiskMatrixHeatmapProps> = ({
  riskMatrix,
  dealId,
  onUpdate,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      entitlement: 'bg-blue-100 text-blue-800',
      environmental: 'bg-green-100 text-green-800',
      geotechnical: 'bg-orange-100 text-orange-800',
      utility: 'bg-purple-100 text-purple-800',
      assemblage: 'bg-pink-100 text-pink-800',
      financial: 'bg-yellow-100 text-yellow-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[category] || colors.other;
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 7) return 'bg-red-600 text-white';
    if (score >= 5) return 'bg-orange-500 text-white';
    if (score >= 3) return 'bg-yellow-500 text-gray-900';
    return 'bg-green-500 text-white';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      identified: 'bg-gray-100 text-gray-800',
      monitoring: 'bg-blue-100 text-blue-800',
      mitigating: 'bg-yellow-100 text-yellow-800',
      resolved: 'bg-green-100 text-green-800',
      accepted: 'bg-purple-100 text-purple-800',
    };
    return colors[status] || colors.identified;
  };

  // Group risks by category
  const risksByCategory = riskMatrix.risks.reduce((acc, risk) => {
    if (!acc[risk.category]) acc[risk.category] = [];
    acc[risk.category].push(risk);
    return acc;
  }, {} as Record<string, RiskItem[]>);

  // Calculate category scores
  const categoryScores = Object.entries(risksByCategory).map(([category, risks]) => ({
    category,
    avgScore: risks.reduce((sum, r) => sum + r.riskScore, 0) / risks.length,
    count: risks.length,
  }));

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="w-6 h-6 text-red-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Risk Matrix</h2>
              <p className="text-sm text-gray-600">Overall Risk Score: {riskMatrix.overallRiskScore}/100</p>
            </div>
          </div>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Add Risk</span>
          </button>
        </div>

        {/* Overall Risk Gauge */}
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className={`h-4 rounded-full transition-all duration-300 ${
                riskMatrix.overallRiskScore >= 70 ? 'bg-red-600' :
                riskMatrix.overallRiskScore >= 50 ? 'bg-orange-500' :
                riskMatrix.overallRiskScore >= 30 ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              style={{ width: `${riskMatrix.overallRiskScore}%` }}
            />
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Category Summary Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {categoryScores.map(({ category, avgScore, count }) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedCategory === category
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`inline-flex px-2 py-1 rounded text-xs font-medium mb-2 ${getCategoryColor(category)}`}>
                {category}
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {avgScore.toFixed(1)}
              </div>
              <div className="text-xs text-gray-600">{count} risks</div>
            </button>
          ))}
        </div>

        {/* Risk Heatmap */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Heatmap</h3>
          <div className="grid grid-cols-10 gap-1 mb-2">
            {Array.from({ length: 100 }, (_, i) => {
              const probability = Math.floor(i / 10) * 10;
              const impact = (i % 10) + 1;
              const score = (probability / 100) * impact;
              const hasRisk = riskMatrix.risks.some(
                r => Math.floor(r.probability / 10) === Math.floor(i / 10) && Math.floor(r.impact) === (i % 10) + 1
              );

              return (
                <div
                  key={i}
                  className={`aspect-square rounded transition-all ${
                    hasRisk ? getRiskScoreColor(score) : 'bg-gray-200'
                  }`}
                  title={hasRisk ? `P: ${probability}%, I: ${impact}` : ''}
                />
              );
            })}
          </div>
          <div className="flex items-center justify-between text-xs text-gray-600 mt-2">
            <span>Impact →</span>
            <span>Probability →</span>
          </div>
        </div>

        {/* Risk List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">All Risks</h3>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span className="w-3 h-3 rounded bg-red-600"></span>
              <span>High</span>
              <span className="w-3 h-3 rounded bg-yellow-500 ml-4"></span>
              <span>Medium</span>
              <span className="w-3 h-3 rounded bg-green-500 ml-4"></span>
              <span>Low</span>
            </div>
          </div>

          {(selectedCategory ? risksByCategory[selectedCategory] : riskMatrix.risks)
            .sort((a, b) => b.riskScore - a.riskScore)
            .map((risk) => (
              <RiskCard key={risk.id} risk={risk} getCategoryColor={getCategoryColor} getStatusColor={getStatusColor} getRiskScoreColor={getRiskScoreColor} />
            ))}
        </div>
      </div>
    </div>
  );
};

// Risk Card Component
const RiskCard: React.FC<{
  risk: RiskItem;
  getCategoryColor: (category: string) => string;
  getStatusColor: (status: string) => string;
  getRiskScoreColor: (score: number) => string;
}> = ({ risk, getCategoryColor, getStatusColor, getRiskScoreColor }) => {
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${getCategoryColor(risk.category)}`}>
              {risk.category}
            </span>
            <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${getStatusColor(risk.status)}`}>
              {risk.status}
            </span>
          </div>
          <h4 className="font-semibold text-gray-900 mb-1">{risk.description}</h4>
        </div>
        <div className={`ml-4 w-12 h-12 rounded flex items-center justify-center font-bold ${getRiskScoreColor(risk.riskScore)}`}>
          {risk.riskScore.toFixed(1)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
        <div>
          <span className="text-gray-600">Probability: </span>
          <span className="font-semibold text-gray-900">{risk.probability}%</span>
        </div>
        <div>
          <span className="text-gray-600">Impact: </span>
          <span className="font-semibold text-gray-900">{risk.impact}/10</span>
        </div>
      </div>

      {risk.mitigationPlan && (
        <div className="bg-blue-50 rounded p-3 mb-3">
          <div className="text-xs font-semibold text-gray-700 mb-1">Mitigation Plan:</div>
          <p className="text-sm text-gray-700">{risk.mitigationPlan}</p>
        </div>
      )}

      {risk.owner && (
        <div className="text-xs text-gray-600">
          Owner: <span className="font-medium text-gray-900">{risk.owner}</span>
        </div>
      )}
    </div>
  );
};

export default RiskMatrixHeatmap;
