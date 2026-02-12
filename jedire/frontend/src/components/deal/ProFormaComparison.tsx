/**
 * Pro Forma Comparison Component
 * 
 * Shows baseline vs. news-adjusted pro forma assumptions side-by-side
 * with color-coded differences and drill-down to news events
 * 
 * Phase 2, Component 1: Pro Forma Integration
 * 
 * @version 1.0.0
 * @date 2026-02-11
 */

import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';

// ============================================================================
// Types
// ============================================================================

interface AssumptionValue {
  baseline: number;
  current: number;
  userOverride?: number;
  overrideReason?: string;
  effective: number;
}

interface ProFormaAssumptions {
  id: string;
  dealId: string;
  strategy: string;
  rentGrowth: AssumptionValue;
  vacancy: AssumptionValue;
  opexGrowth: AssumptionValue;
  exitCap: AssumptionValue;
  absorption: AssumptionValue;
  lastRecalculation?: string;
  updatedAt: string;
}

interface Adjustment {
  id: string;
  assumptionType: string;
  previousValue: number;
  newValue: number;
  adjustmentDelta: number;
  adjustmentPct: number;
  calculationMethod: string;
  calculationInputs: any;
  confidenceScore: number;
  createdAt: string;
  newsHeadline?: string;
  eventCategory?: string;
  eventType?: string;
  newsPublishedAt?: string;
  demandUnits?: number;
  demandPeopleCount?: number;
}

interface ComparisonData {
  dealId: string;
  dealName: string;
  strategy: string;
  baseline: ProFormaAssumptions;
  adjusted: ProFormaAssumptions;
  differences: {
    rentGrowth: number;
    vacancy: number;
    opexGrowth: number;
    exitCap: number;
    absorption: number;
  };
  recentAdjustments: Adjustment[];
}

// ============================================================================
// Component
// ============================================================================

interface Props {
  dealId: string;
}

export const ProFormaComparison: React.FC<Props> = ({ dealId }) => {
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAssumption, setSelectedAssumption] = useState<string | null>(null);
  const [showBaseline, setShowBaseline] = useState(true);
  const [showAdjusted, setShowAdjusted] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  
  // Override modal state
  const [overrideModal, setOverrideModal] = useState<{
    open: boolean;
    assumptionType: string;
    currentValue: number;
  } | null>(null);
  const [overrideValue, setOverrideValue] = useState<string>('');
  const [overrideReason, setOverrideReason] = useState<string>('');

  useEffect(() => {
    fetchComparison();
  }, [dealId]);

  const fetchComparison = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/proforma/${dealId}/comparison`);
      
      if (response.data.success) {
        setComparison(response.data.data);
      } else {
        setError(response.data.error || 'Failed to load pro forma comparison');
      }
    } catch (err: any) {
      console.error('Error fetching pro forma comparison:', err);
      setError(err.response?.data?.error || 'Failed to load pro forma comparison');
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    try {
      setRecalculating(true);
      const response = await api.post(`/proforma/${dealId}/recalculate`, {
        triggerType: 'periodic_update'
      });
      
      if (response.data.success) {
        await fetchComparison();
        alert('Pro forma recalculated successfully!');
      } else {
        alert('Failed to recalculate: ' + response.data.error);
      }
    } catch (err: any) {
      console.error('Error recalculating:', err);
      alert('Failed to recalculate: ' + (err.response?.data?.error || err.message));
    } finally {
      setRecalculating(false);
    }
  };

  const handleOverride = async () => {
    if (!overrideModal || !overrideValue || !overrideReason) {
      alert('Please provide both value and reason');
      return;
    }

    try {
      const response = await api.patch(`/proforma/${dealId}/override`, {
        assumptionType: overrideModal.assumptionType,
        value: parseFloat(overrideValue),
        reason: overrideReason
      });

      if (response.data.success) {
        await fetchComparison();
        setOverrideModal(null);
        setOverrideValue('');
        setOverrideReason('');
        alert('Assumption overridden successfully!');
      } else {
        alert('Failed to override: ' + response.data.error);
      }
    } catch (err: any) {
      console.error('Error overriding assumption:', err);
      alert('Failed to override: ' + (err.response?.data?.error || err.message));
    }
  };

  const openOverrideModal = (assumptionType: string, currentValue: number) => {
    setOverrideModal({ open: true, assumptionType, currentValue });
    setOverrideValue(currentValue.toString());
  };

  const handleExport = async (format: 'json' | 'csv' | 'markdown') => {
    try {
      const response = await api.get(`/proforma/${dealId}/export?format=${format}`, {
        responseType: format === 'json' ? 'json' : 'blob'
      });

      if (format === 'json') {
        const dataStr = JSON.stringify(response.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `proforma-${dealId}.json`;
        link.click();
      } else {
        const url = URL.createObjectURL(response.data);
        const link = document.createElement('a');
        link.href = url;
        link.download = `proforma-${dealId}.${format}`;
        link.click();
      }
    } catch (err: any) {
      console.error('Error exporting:', err);
      alert('Failed to export');
    }
  };

  const getChangeColor = (value: number, assumptionType: string): string => {
    // Green = good, Red = bad
    // For rent growth, exit cap compression, absorption: positive = good
    // For vacancy, opex growth: negative = good
    
    const threshold = assumptionType === 'absorption' ? 0.5 : 0.1;
    
    if (Math.abs(value) < threshold) return 'text-gray-600'; // Neutral
    
    if (assumptionType === 'vacancy' || assumptionType === 'opexGrowth') {
      return value < 0 ? 'text-green-600' : 'text-red-600';
    } else {
      return value > 0 ? 'text-green-600' : 'text-red-600';
    }
  };

  const getChangeIcon = (value: number, assumptionType: string): string => {
    const threshold = assumptionType === 'absorption' ? 0.5 : 0.1;
    if (Math.abs(value) < threshold) return '→';
    return value > 0 ? '↑' : '↓';
  };

  const formatValue = (value: number, assumptionType: string): string => {
    if (assumptionType === 'absorption') {
      return `${value.toFixed(1)} leases/mo`;
    }
    return `${value.toFixed(2)}%`;
  };

  const formatAssumptionName = (type: string): string => {
    const names: Record<string, string> = {
      rentGrowth: 'Rent Growth Rate',
      vacancy: 'Vacancy Rate',
      opexGrowth: 'OpEx Growth Rate',
      exitCap: 'Exit Cap Rate',
      absorption: 'Absorption Rate'
    };
    return names[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading pro forma comparison...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button
          onClick={fetchComparison}
          className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!comparison) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">No pro forma data available for this deal.</p>
      </div>
    );
  }

  const assumptions = [
    { key: 'rentGrowth', data: comparison.baseline.rentGrowth },
    { key: 'vacancy', data: comparison.baseline.vacancy },
    { key: 'opexGrowth', data: comparison.baseline.opexGrowth },
    { key: 'exitCap', data: comparison.baseline.exitCap },
    { key: 'absorption', data: comparison.baseline.absorption }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{comparison.dealName}</h2>
            <p className="text-sm text-gray-600 mt-1">
              Strategy: <span className="font-medium">{comparison.strategy}</span>
              {comparison.baseline.lastRecalculation && (
                <span className="ml-4">
                  Last updated: {new Date(comparison.baseline.lastRecalculation).toLocaleString()}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRecalculate}
              disabled={recalculating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {recalculating ? 'Recalculating...' : 'Recalculate'}
            </button>
            <div className="relative group">
              <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                Export ▾
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                <button
                  onClick={() => handleExport('json')}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-50"
                >
                  Export as JSON
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-50"
                >
                  Export as CSV
                </button>
                <button
                  onClick={() => handleExport('markdown')}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-50"
                >
                  Export as Markdown
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Layer Toggle */}
        <div className="flex gap-4 mt-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={showBaseline}
              onChange={(e) => setShowBaseline(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Show Baseline</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={showAdjusted}
              onChange={(e) => setShowAdjusted(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Show News-Adjusted</span>
          </label>
        </div>
      </div>

      {/* Assumptions Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Assumption
              </th>
              {showBaseline && (
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Baseline
                </th>
              )}
              {showAdjusted && (
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  News-Adjusted
                </th>
              )}
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Effective
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Change
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {assumptions.map(({ key, data }) => {
              const difference = comparison.differences[key as keyof typeof comparison.differences];
              const changeColor = getChangeColor(difference, key);
              const changeIcon = getChangeIcon(difference, key);
              const hasOverride = data.userOverride !== undefined && data.userOverride !== null;

              return (
                <tr
                  key={key}
                  className={`hover:bg-gray-50 cursor-pointer ${
                    selectedAssumption === key ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => setSelectedAssumption(selectedAssumption === key ? null : key)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-900">
                        {formatAssumptionName(key)}
                      </span>
                      {hasOverride && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          Override
                        </span>
                      )}
                    </div>
                    {hasOverride && data.overrideReason && (
                      <p className="text-xs text-gray-500 mt-1">{data.overrideReason}</p>
                    )}
                  </td>
                  {showBaseline && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {formatValue(data.baseline, key)}
                    </td>
                  )}
                  {showAdjusted && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {formatValue(data.current, key)}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900">
                    {formatValue(data.effective, key)}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-medium ${changeColor}`}>
                    <span className="mr-1">{changeIcon}</span>
                    {Math.abs(difference) < 0.01 
                      ? '—' 
                      : `${difference > 0 ? '+' : ''}${formatValue(Math.abs(difference), key)}`
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openOverrideModal(key, data.effective);
                      }}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Override
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* News Events Affecting Assumptions */}
      {selectedAssumption && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            News Events Affecting {formatAssumptionName(selectedAssumption)}
          </h3>
          <div className="space-y-3">
            {comparison.recentAdjustments
              .filter(adj => adj.assumptionType === selectedAssumption)
              .map(adj => (
                <div key={adj.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {adj.newsHeadline || 'Manual Adjustment'}
                      </p>
                      {adj.eventCategory && (
                        <p className="text-xs text-gray-500 mt-1">
                          {adj.eventCategory} • {adj.eventType}
                        </p>
                      )}
                      <p className="text-xs text-gray-600 mt-2">
                        Method: <span className="font-mono">{adj.calculationMethod}</span>
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className={`text-sm font-bold ${getChangeColor(adj.adjustmentDelta, selectedAssumption)}`}>
                        {adj.adjustmentDelta > 0 ? '+' : ''}{formatValue(Math.abs(adj.adjustmentDelta), selectedAssumption)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Confidence: {adj.confidenceScore}%
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(adj.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {adj.calculationInputs && (
                    <details className="mt-3">
                      <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                        View Calculation Details
                      </summary>
                      <pre className="text-xs bg-gray-50 p-2 rounded mt-2 overflow-x-auto">
                        {JSON.stringify(adj.calculationInputs, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            {comparison.recentAdjustments.filter(adj => adj.assumptionType === selectedAssumption).length === 0 && (
              <p className="text-sm text-gray-500 italic">No adjustments for this assumption yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Override Modal */}
      {overrideModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Override {formatAssumptionName(overrideModal.assumptionType)}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Value
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={overrideValue}
                  onChange={(e) => setOverrideValue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={overrideModal.currentValue.toString()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Override
                </label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Explain why you're overriding this assumption..."
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setOverrideModal(null);
                    setOverrideValue('');
                    setOverrideReason('');
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleOverride}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Apply Override
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProFormaComparison;
