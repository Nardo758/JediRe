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
import { BT } from '@/components/deal/bloomberg-ui';

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Task #425: legacy hook deps frozen during bulk triage; revisit when touching this hook.
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
    const threshold = assumptionType === 'absorption' ? 0.5 : 0.1;

    if (Math.abs(value) < threshold) return BT.text.secondary; // Neutral

    if (assumptionType === 'vacancy' || assumptionType === 'opexGrowth') {
      return value < 0 ? BT.text.green : BT.text.red;
    } else {
      return value > 0 ? BT.text.green : BT.text.red;
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
          <div className="animate-spin h-12 w-12 mx-auto" style={{ borderRadius: '50%', borderBottom: `2px solid ${BT.text.cyan}`, borderTop: `2px solid transparent`, borderLeft: `2px solid transparent`, borderRight: `2px solid transparent` }}></div>
          <p style={{ marginTop: 16, color: BT.text.secondary, fontFamily: BT.font.mono }}>Loading pro forma comparison...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4" style={{ background: `${BT.text.red}08`, border: `1px solid ${BT.text.red}33`, borderRadius: 0 }}>
        <p style={{ color: BT.text.red, fontFamily: BT.font.label }}>{error}</p>
        <button
          onClick={fetchComparison}
          style={{ marginTop: 8, fontSize: BT.fontSize.base, color: BT.text.red, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontFamily: BT.font.mono }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!comparison) {
    return (
      <div className="p-4" style={{ background: `${BT.text.amber}08`, border: `1px solid ${BT.text.amber}33`, borderRadius: 0 }}>
        <p style={{ color: BT.text.amber, fontFamily: BT.font.label }}>No pro forma data available for this deal.</p>
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
      <div className="p-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 style={{ fontSize: BT.fontSize.xl, fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono }}>{comparison.dealName}</h2>
            <p style={{ fontSize: BT.fontSize.base, color: BT.text.secondary, fontFamily: BT.font.label, marginTop: 4 }}>
              Strategy: <span style={{ fontWeight: 500 }}>{comparison.strategy}</span>
              {comparison.baseline.lastRecalculation && (
                <span style={{ marginLeft: 16 }}>
                  Last updated: {new Date(comparison.baseline.lastRecalculation).toLocaleString()}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRecalculate}
              disabled={recalculating}
              className="px-4 py-2"
              style={{ background: BT.text.cyan, color: BT.bg.terminal, fontFamily: BT.font.mono, fontWeight: 600, borderRadius: 0, border: 'none', cursor: recalculating ? 'not-allowed' : 'pointer', opacity: recalculating ? 0.5 : 1 }}
            >
              {recalculating ? 'Recalculating...' : 'Recalculate'}
            </button>
            <div className="relative group">
              <button className="px-4 py-2" style={{ background: BT.bg.active, color: BT.text.primary, fontFamily: BT.font.mono, borderRadius: 0, border: `1px solid ${BT.border.subtle}`, cursor: 'pointer' }}>
                Export ▾
              </button>
              <div className="absolute right-0 mt-2 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.medium}`, borderRadius: 0 }}>
                <button
                  onClick={() => handleExport('json')}
                  className="block w-full text-left px-4 py-2"
                  style={{ background: 'transparent', border: 'none', color: BT.text.primary, fontFamily: BT.font.mono, fontSize: BT.fontSize.base, cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = BT.bg.hover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  Export as JSON
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className="block w-full text-left px-4 py-2"
                  style={{ background: 'transparent', border: 'none', color: BT.text.primary, fontFamily: BT.font.mono, fontSize: BT.fontSize.base, cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = BT.bg.hover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  Export as CSV
                </button>
                <button
                  onClick={() => handleExport('markdown')}
                  className="block w-full text-left px-4 py-2"
                  style={{ background: 'transparent', border: 'none', color: BT.text.primary, fontFamily: BT.font.mono, fontSize: BT.fontSize.base, cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = BT.bg.hover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  Export as Markdown
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Layer Toggle */}
        <div className="flex gap-4 mt-4">
          <label className="flex items-center" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showBaseline}
              onChange={(e) => setShowBaseline(e.target.checked)}
              className="mr-2"
            />
            <span style={{ fontSize: BT.fontSize.base, color: BT.text.secondary, fontFamily: BT.font.label }}>Show Baseline</span>
          </label>
          <label className="flex items-center" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showAdjusted}
              onChange={(e) => setShowAdjusted(e.target.checked)}
              className="mr-2"
            />
            <span style={{ fontSize: BT.fontSize.base, color: BT.text.secondary, fontFamily: BT.font.label }}>Show News-Adjusted</span>
          </label>
        </div>
      </div>

      {/* Assumptions Table */}
      <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0, overflow: 'hidden' }}>
        <table className="min-w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: BT.bg.header }}>
              <th className="px-6 py-3 text-left" style={{ fontSize: BT.fontSize.xs, fontWeight: 700, color: BT.text.muted, letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: BT.font.mono, borderBottom: `1px solid ${BT.border.medium}` }}>
                Assumption
              </th>
              {showBaseline && (
                <th className="px-6 py-3 text-right" style={{ fontSize: BT.fontSize.xs, fontWeight: 700, color: BT.text.muted, letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: BT.font.mono, borderBottom: `1px solid ${BT.border.medium}` }}>
                  Baseline
                </th>
              )}
              {showAdjusted && (
                <th className="px-6 py-3 text-right" style={{ fontSize: BT.fontSize.xs, fontWeight: 700, color: BT.text.muted, letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: BT.font.mono, borderBottom: `1px solid ${BT.border.medium}` }}>
                  News-Adjusted
                </th>
              )}
              <th className="px-6 py-3 text-right" style={{ fontSize: BT.fontSize.xs, fontWeight: 700, color: BT.text.muted, letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: BT.font.mono, borderBottom: `1px solid ${BT.border.medium}` }}>
                Effective
              </th>
              <th className="px-6 py-3 text-right" style={{ fontSize: BT.fontSize.xs, fontWeight: 700, color: BT.text.muted, letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: BT.font.mono, borderBottom: `1px solid ${BT.border.medium}` }}>
                Change
              </th>
              <th className="px-6 py-3 text-right" style={{ fontSize: BT.fontSize.xs, fontWeight: 700, color: BT.text.muted, letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: BT.font.mono, borderBottom: `1px solid ${BT.border.medium}` }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {assumptions.map(({ key, data }, idx) => {
              const difference = comparison.differences[key as keyof typeof comparison.differences];
              const changeColor = getChangeColor(difference, key);
              const changeIcon = getChangeIcon(difference, key);
              const hasOverride = data.userOverride !== undefined && data.userOverride !== null;

              return (
                <tr
                  key={key}
                  style={{
                    cursor: 'pointer',
                    background: selectedAssumption === key ? `${BT.text.cyan}08` : (idx % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt),
                    borderBottom: `1px solid ${BT.border.subtle}`,
                  }}
                  onClick={() => setSelectedAssumption(selectedAssumption === key ? null : key)}
                  onMouseEnter={(e) => { if (selectedAssumption !== key) e.currentTarget.style.background = BT.bg.hover; }}
                  onMouseLeave={(e) => { if (selectedAssumption !== key) e.currentTarget.style.background = idx % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt; }}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span style={{ fontSize: BT.fontSize.base, fontWeight: 500, color: BT.text.primary, fontFamily: BT.font.mono }}>
                        {formatAssumptionName(key)}
                      </span>
                      {hasOverride && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5" style={{ fontSize: BT.fontSize.xs, fontWeight: 500, background: `${BT.text.purple}18`, color: BT.text.purple, borderRadius: 0, fontFamily: BT.font.mono }}>
                          Override
                        </span>
                      )}
                    </div>
                    {hasOverride && data.overrideReason && (
                      <p style={{ fontSize: BT.fontSize.xs, color: BT.text.muted, marginTop: 4, fontFamily: BT.font.label }}>{data.overrideReason}</p>
                    )}
                  </td>
                  {showBaseline && (
                    <td className="px-6 py-4 whitespace-nowrap text-right" style={{ fontSize: BT.fontSize.base, color: BT.text.primary, fontFamily: BT.font.mono }}>
                      {formatValue(data.baseline, key)}
                    </td>
                  )}
                  {showAdjusted && (
                    <td className="px-6 py-4 whitespace-nowrap text-right" style={{ fontSize: BT.fontSize.base, color: BT.text.primary, fontFamily: BT.font.mono }}>
                      {formatValue(data.current, key)}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-right" style={{ fontSize: BT.fontSize.base, fontWeight: 700, color: BT.text.amber, fontFamily: BT.font.mono }}>
                    {formatValue(data.effective, key)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right" style={{ fontSize: BT.fontSize.base, fontWeight: 500, color: changeColor, fontFamily: BT.font.mono }}>
                    <span style={{ marginRight: 4 }}>{changeIcon}</span>
                    {Math.abs(difference) < 0.01
                      ? '—'
                      : `${difference > 0 ? '+' : ''}${formatValue(Math.abs(difference), key)}`
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right" style={{ fontSize: BT.fontSize.base }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openOverrideModal(key, data.effective);
                      }}
                      style={{ color: BT.text.cyan, fontWeight: 500, fontFamily: BT.font.mono, background: 'none', border: 'none', cursor: 'pointer' }}
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
        <div className="p-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
          <h3 style={{ fontSize: BT.fontSize.lg, fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono, marginBottom: 16 }}>
            News Events Affecting {formatAssumptionName(selectedAssumption)}
          </h3>
          <div className="space-y-3">
            {comparison.recentAdjustments
              .filter(adj => adj.assumptionType === selectedAssumption)
              .map(adj => (
                <div key={adj.id} className="p-4" style={{ border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p style={{ fontSize: BT.fontSize.base, fontWeight: 500, color: BT.text.primary, fontFamily: BT.font.mono }}>
                        {adj.newsHeadline || 'Manual Adjustment'}
                      </p>
                      {adj.eventCategory && (
                        <p style={{ fontSize: BT.fontSize.xs, color: BT.text.muted, marginTop: 4, fontFamily: BT.font.label }}>
                          {adj.eventCategory} • {adj.eventType}
                        </p>
                      )}
                      <p style={{ fontSize: BT.fontSize.xs, color: BT.text.secondary, marginTop: 8, fontFamily: BT.font.label }}>
                        Method: <span style={{ fontFamily: BT.font.mono }}>{adj.calculationMethod}</span>
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p style={{ fontSize: BT.fontSize.base, fontWeight: 700, color: getChangeColor(adj.adjustmentDelta, selectedAssumption), fontFamily: BT.font.mono }}>
                        {adj.adjustmentDelta > 0 ? '+' : ''}{formatValue(Math.abs(adj.adjustmentDelta), selectedAssumption)}
                      </p>
                      <p style={{ fontSize: BT.fontSize.xs, color: BT.text.muted, marginTop: 4, fontFamily: BT.font.label }}>
                        Confidence: {adj.confidenceScore}%
                      </p>
                      <p style={{ fontSize: BT.fontSize.xs, color: BT.text.muted, marginTop: 4, fontFamily: BT.font.label }}>
                        {new Date(adj.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {adj.calculationInputs && (
                    <details style={{ marginTop: 12 }}>
                      <summary style={{ fontSize: BT.fontSize.xs, color: BT.text.muted, cursor: 'pointer', fontFamily: BT.font.label }}>
                        View Calculation Details
                      </summary>
                      <pre style={{ fontSize: BT.fontSize.xs, background: BT.bg.panelAlt, padding: 8, marginTop: 8, overflow: 'auto', color: BT.text.secondary, fontFamily: BT.font.mono, borderRadius: 0 }}>
                        {JSON.stringify(adj.calculationInputs, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            {comparison.recentAdjustments.filter(adj => adj.assumptionType === selectedAssumption).length === 0 && (
              <p style={{ fontSize: BT.fontSize.base, color: BT.text.muted, fontStyle: 'italic', fontFamily: BT.font.label }}>No adjustments for this assumption yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Override Modal */}
      {overrideModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="p-6 max-w-md w-full mx-4" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.medium}` }}>
            <h3 style={{ fontSize: BT.fontSize.lg, fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono, marginBottom: 16 }}>
              Override {formatAssumptionName(overrideModal.assumptionType)}
            </h3>
            <div className="space-y-4">
              <div>
                <label style={{ display: 'block', fontSize: BT.fontSize.base, fontWeight: 500, color: BT.text.secondary, fontFamily: BT.font.label, marginBottom: 4 }}>
                  New Value
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={overrideValue}
                  onChange={(e) => setOverrideValue(e.target.value)}
                  className="w-full px-3 py-2"
                  style={{ background: BT.bg.input, border: `1px solid ${BT.border.subtle}`, color: BT.text.primary, fontFamily: BT.font.mono, borderRadius: 0 }}
                  placeholder={overrideModal.currentValue.toString()}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: BT.fontSize.base, fontWeight: 500, color: BT.text.secondary, fontFamily: BT.font.label, marginBottom: 4 }}>
                  Reason for Override
                </label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2"
                  style={{ background: BT.bg.input, border: `1px solid ${BT.border.subtle}`, color: BT.text.primary, fontFamily: BT.font.mono, borderRadius: 0 }}
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
                  className="px-4 py-2"
                  style={{ background: BT.bg.hover, color: BT.text.secondary, fontFamily: BT.font.mono, borderRadius: 0, border: `1px solid ${BT.border.subtle}`, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleOverride}
                  className="px-4 py-2"
                  style={{ background: BT.text.cyan, color: BT.bg.terminal, fontFamily: BT.font.mono, fontWeight: 600, borderRadius: 0, border: 'none', cursor: 'pointer' }}
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
