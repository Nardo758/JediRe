import React, { useState } from 'react';
import { useRegulatoryAlerts } from '../../../hooks/useRegulatoryAlerts';
import { useZoningModuleStore } from '../../../stores/zoningModuleStore';
import type { RegulatoryAlert, RegulatoryCategory, AlertSeverity } from '../../../types/zoning.types';

const SEVERITY_CONFIG: Record<AlertSeverity, { bg: string; text: string; label: string }> = {
  critical: { bg: 'bg-red-100', text: 'text-red-800', label: 'Critical' },
  warning: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Warning' },
  watch: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Watch' },
  info: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Info' },
};

const CATEGORY_CONFIG: Record<RegulatoryCategory, string> = {
  zoning_changes: 'Zoning Changes',
  rent_control: 'Rent Control',
  str_restrictions: 'STR Restrictions',
  impact_fees: 'Impact Fees',
  inclusionary_housing: 'Inclusionary Housing',
  environmental: 'Environmental',
  moratorium: 'Moratorium',
  other: 'Other',
};

const PRIMARY_CATEGORIES: RegulatoryCategory[] = [
  'zoning_changes',
  'rent_control',
  'str_restrictions',
  'impact_fees',
  'inclusionary_housing',
  'environmental',
];

const STRATEGIES = ['BTS', 'Flip', 'Rental', 'STR'] as const;

function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const config = SEVERITY_CONFIG[severity];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

function ImpactIcon({ impact }: { impact: 'positive' | 'warning' | 'negative' | 'neutral' }) {
  switch (impact) {
    case 'positive':
      return (
        <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'warning':
      return (
        <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      );
    case 'negative':
      return (
        <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      );
  }
}

function getStrategyImpact(
  category: RegulatoryCategory,
  strategy: typeof STRATEGIES[number]
): 'positive' | 'warning' | 'negative' | 'neutral' {
  const matrix: Record<string, Record<string, 'positive' | 'warning' | 'negative' | 'neutral'>> = {
    zoning_changes: { BTS: 'warning', Flip: 'warning', Rental: 'warning', STR: 'warning' },
    rent_control: { BTS: 'neutral', Flip: 'neutral', Rental: 'negative', STR: 'warning' },
    str_restrictions: { BTS: 'neutral', Flip: 'neutral', Rental: 'positive', STR: 'negative' },
    impact_fees: { BTS: 'negative', Flip: 'warning', Rental: 'warning', STR: 'neutral' },
    inclusionary_housing: { BTS: 'warning', Flip: 'neutral', Rental: 'negative', STR: 'neutral' },
    environmental: { BTS: 'negative', Flip: 'warning', Rental: 'warning', STR: 'warning' },
  };
  return matrix[category]?.[strategy] ?? 'neutral';
}

function AlertDetailCard({ alert, onClose }: { alert: RegulatoryAlert; onClose: () => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-6 mb-4">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <SeverityBadge severity={alert.severity} />
            <span className="text-xs text-gray-500 uppercase tracking-wide">
              {CATEGORY_CONFIG[alert.category]}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{alert.title}</h3>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 ml-4"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {alert.description && (
        <p className="text-sm text-gray-600 mb-4">{alert.description}</p>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <span className="text-xs font-medium text-gray-500 uppercase">Municipality</span>
          <p className="text-sm text-gray-900">{alert.municipality}, {alert.state}</p>
        </div>
        <div>
          <span className="text-xs font-medium text-gray-500 uppercase">Published</span>
          <p className="text-sm text-gray-900">
            {alert.publishedDate ? new Date(alert.publishedDate).toLocaleDateString() : 'N/A'}
          </p>
        </div>
        {alert.expiresDate && (
          <div>
            <span className="text-xs font-medium text-gray-500 uppercase">Expires</span>
            <p className="text-sm text-gray-900">
              {new Date(alert.expiresDate).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>

      {alert.sourceUrl && (
        <div className="mb-4">
          <span className="text-xs font-medium text-gray-500 uppercase">Source</span>
          <a
            href={alert.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            {alert.sourceName || alert.sourceUrl}
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      )}

      {alert.affectedStrategies && alert.affectedStrategies.length > 0 && (
        <div>
          <span className="text-xs font-medium text-gray-500 uppercase mb-2 block">Affected Strategies</span>
          <div className="flex flex-wrap gap-2">
            {alert.affectedStrategies.map((strategy) => (
              <span
                key={strategy}
                className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700"
              >
                {strategy}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RegulatoryRiskTab() {
  const { selectedJurisdiction, setSelectedJurisdiction, setRegulatoryAlerts } = useZoningModuleStore();
  const {
    loading,
    error,
    filteredAlerts,
    filterByCategory,
    filterBySeverity,
    selectedCategory,
    selectedSeverity,
    jurisdictions,
    alerts,
  } = useRegulatoryAlerts(selectedJurisdiction);

  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);

  React.useEffect(() => {
    if (alerts.length > 0) {
      setRegulatoryAlerts(alerts);
    }
  }, [alerts, setRegulatoryAlerts]);

  const alertsByCategory = PRIMARY_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = filteredAlerts.filter((a) => a.category === cat);
    return acc;
  }, {} as Record<RegulatoryCategory, RegulatoryAlert[]>);

  const expandedAlert = expandedAlertId ? filteredAlerts.find((a) => a.id === expandedAlertId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Regulatory Risk Intelligence</h2>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Jurisdiction</label>
          <select
            value={selectedJurisdiction || ''}
            onChange={(e) => setSelectedJurisdiction(e.target.value || null)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Jurisdictions</option>
            {jurisdictions.map((j) => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Category</label>
          <select
            value={selectedCategory || ''}
            onChange={(e) => filterByCategory((e.target.value as RegulatoryCategory) || null)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Categories</option>
            {PRIMARY_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{CATEGORY_CONFIG[cat]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Severity</label>
          <select
            value={selectedSeverity || ''}
            onChange={(e) => filterBySeverity((e.target.value as AlertSeverity) || null)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="watch">Watch</option>
            <option value="info">Info</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-sm text-gray-500">Loading alerts...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {expandedAlert && (
            <AlertDetailCard
              alert={expandedAlert}
              onClose={() => setExpandedAlertId(null)}
            />
          )}

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Active Alerts Feed</h3>
            {filteredAlerts.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No active regulatory alerts found.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredAlerts.map((alert) => (
                  <button
                    key={alert.id}
                    onClick={() => setExpandedAlertId(alert.id === expandedAlertId ? null : alert.id)}
                    className={`w-full text-left flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      expandedAlertId === alert.id
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <SeverityBadge severity={alert.severity} />
                      <span className="text-sm text-gray-900 truncate">{alert.title}</span>
                    </div>
                    <span className="text-xs text-gray-500 ml-2 shrink-0">
                      {alert.municipality}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Categories</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {PRIMARY_CATEGORIES.map((cat) => {
                const catAlerts = alertsByCategory[cat];
                const criticalCount = catAlerts.filter((a) => a.severity === 'critical').length;
                const warningCount = catAlerts.filter((a) => a.severity === 'warning').length;

                return (
                  <div
                    key={cat}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow cursor-pointer"
                    onClick={() => filterByCategory(selectedCategory === cat ? null : cat)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-900">{CATEGORY_CONFIG[cat]}</h4>
                      <span className="text-lg font-bold text-gray-700">{catAlerts.length}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {criticalCount > 0 && (
                        <span className="text-red-600">{criticalCount} critical</span>
                      )}
                      {warningCount > 0 && (
                        <span className="text-orange-600">{warningCount} warning</span>
                      )}
                      {criticalCount === 0 && warningCount === 0 && catAlerts.length > 0 && (
                        <span className="text-gray-500">{catAlerts.length} active</span>
                      )}
                      {catAlerts.length === 0 && (
                        <span className="text-gray-400">No alerts</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Strategy-Regulatory Matrix</h3>
              <p className="text-xs text-gray-500 mt-1">Impact of each regulation category on investment strategies</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Regulation</th>
                    {STRATEGIES.map((s) => (
                      <th key={s} className="text-center text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">
                        {s}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {PRIMARY_CATEGORIES.map((cat) => (
                    <tr key={cat} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{CATEGORY_CONFIG[cat]}</td>
                      {STRATEGIES.map((strategy) => (
                        <td key={strategy} className="px-4 py-3 text-center">
                          <div className="flex justify-center">
                            <ImpactIcon impact={getStrategyImpact(cat, strategy)} />
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <ImpactIcon impact="positive" /> Favorable
              </span>
              <span className="flex items-center gap-1">
                <ImpactIcon impact="warning" /> Monitor
              </span>
              <span className="flex items-center gap-1">
                <ImpactIcon impact="negative" /> Adverse
              </span>
              <span className="flex items-center gap-1">
                <ImpactIcon impact="neutral" /> Neutral
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
