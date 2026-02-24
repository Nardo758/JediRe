import React, { useState } from 'react';
import { useRegulatoryAlerts } from '../../../hooks/useRegulatoryAlerts';
import { useZoningModuleStore } from '../../../stores/zoningModuleStore';
import type { RegulatoryAlert, RegulatoryCategory, AlertSeverity } from '../../../types/zoning.types';

const CATEGORY_CONFIG: Record<RegulatoryCategory, string> = {
  zoning_changes: 'Zoning Stability',
  rent_control: 'Rent Control Risk',
  str_restrictions: 'STR Regulation',
  impact_fees: 'Impact Fees',
  inclusionary_housing: 'Inclusionary Req',
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

type RiskLevel = 'Low' | 'Moderate' | 'Elevated' | 'High';

interface RiskRow {
  category: string;
  level: RiskLevel;
  trend: string;
  impact: string;
}

const RISK_LEVEL_CONFIG: Record<RiskLevel, { dot: string; bg: string }> = {
  Low: { dot: '🟢', bg: 'text-green-700' },
  Moderate: { dot: '🟡', bg: 'text-yellow-700' },
  Elevated: { dot: '🟠', bg: 'text-orange-700' },
  High: { dot: '🔴', bg: 'text-red-700' },
};

const MOCK_RISK_ROWS: RiskRow[] = [
  { category: 'Zoning Stability', level: 'Low', trend: '→', impact: 'Low rezone rejection rate' },
  { category: 'Permit Timeline', level: 'Moderate', trend: '↑', impact: 'Avg 14mo for MF permits' },
  { category: 'Impact Fees', level: 'Elevated', trend: '↑↑', impact: '$8,200/unit (up 22% YoY)' },
  { category: 'Inclusionary Req', level: 'Low', trend: '→', impact: '15% AMI units required' },
  { category: 'Rent Control Risk', level: 'Low', trend: '→', impact: 'No state preemption risk' },
  { category: 'STR Regulation', level: 'Elevated', trend: '↑', impact: 'License cap in 5 wards' },
  { category: 'Environmental', level: 'Moderate', trend: '→', impact: 'Standard NEPA + Phase I' },
  { category: 'Historic Preservation', level: 'Low', trend: '→', impact: 'Not in historic district' },
];

interface MockAlert {
  id: string;
  severity: 'urgent' | 'watch' | 'opportunity';
  emoji: string;
  title: string;
  impact: string;
  probability: string;
  source: string;
  affectedDeals: string;
}

const MOCK_ALERTS: MockAlert[] = [
  {
    id: '1',
    severity: 'urgent',
    emoji: '🔴',
    title: 'City Council Vote 3/5: Proposed STR moratorium in Midtown/VaHi',
    impact: 'Would block all new STR licenses for 12 months',
    probability: '65%',
    source: 'News Agent + Council agenda',
    affectedDeals: '#044, #051',
  },
  {
    id: '2',
    severity: 'watch',
    emoji: '🟡',
    title: 'Planning Commission reviewing density bonus update (Q2 2026)',
    impact: 'Could increase by-right density 15% in transit corridors',
    probability: '40%',
    source: 'News Agent + Planning docs',
    affectedDeals: '#047, #032',
  },
  {
    id: '3',
    severity: 'watch',
    emoji: '🟡',
    title: 'Impact fee increase proposed for 2027 budget cycle',
    impact: 'Est. +$2,400/unit for MF development',
    probability: '55%',
    source: 'Budget committee minutes',
    affectedDeals: 'All pipeline',
  },
  {
    id: '4',
    severity: 'opportunity',
    emoji: '🟢',
    title: 'Affordable housing density bonus expansion under review',
    impact: '20% density bonus for 10% AMI units (currently 15%)',
    probability: '70%',
    source: 'Housing authority + News Agent',
    affectedDeals: '',
  },
];

const STRATEGIES = ['BTS', 'Flip', 'Rental', 'STR'] as const;

interface StrategyMatrixRow {
  strategy: string;
  emoji: string;
  level: string;
  description: string;
}

const STRATEGY_MATRIX: StrategyMatrixRow[] = [
  { strategy: 'BTS', emoji: '🟢', level: 'Favorable', description: 'Streamlined site plan review for >200 units' },
  { strategy: 'Flip', emoji: '🟢', level: 'Favorable', description: 'Fast permit turnaround for SFR renovations' },
  { strategy: 'Rental', emoji: '🟡', level: 'Moderate', description: 'Inclusionary req adds $1.2M to 245-unit dev' },
  { strategy: 'STR', emoji: '🟠', level: 'Elevated', description: 'Pending moratorium + license caps' },
];

const MARKETS = ['Atlanta Metro', 'Dallas-Fort Worth', 'Nashville', 'Charlotte', 'Tampa Bay'];
const JURISDICTIONS_LIST = ['City of Atlanta', 'Fulton County', 'DeKalb County', 'Cobb County', 'Gwinnett County'];

interface RegulatoryRiskTabProps {
  dealId?: string;
  deal?: any;
}

export default function RegulatoryRiskTab({ dealId, deal }: RegulatoryRiskTabProps = {}) {
  const { selectedJurisdiction, setSelectedJurisdiction, setRegulatoryAlerts } = useZoningModuleStore();
  const {
    loading,
    error,
    alerts,
  } = useRegulatoryAlerts(selectedJurisdiction);

  const [selectedMarket, setSelectedMarket] = useState('Atlanta Metro');
  const [selectedJuris, setSelectedJuris] = useState('City of Atlanta');

  React.useEffect(() => {
    if (alerts.length > 0) {
      setRegulatoryAlerts(alerts);
    }
  }, [alerts, setRegulatoryAlerts]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Market</label>
            <select
              value={selectedMarket}
              onChange={(e) => setSelectedMarket(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {MARKETS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Jurisdiction</label>
            <select
              value={selectedJuris}
              onChange={(e) => {
                setSelectedJuris(e.target.value);
                setSelectedJurisdiction(e.target.value);
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {JURISDICTIONS_LIST.map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </div>
          <button className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Market
          </button>
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

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Regulatory Risk Dashboard</h3>
            <p className="text-xs text-gray-500 mt-0.5">{selectedJuris} — {selectedMarket}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
            🟡 MODERATE RISK
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Risk Category</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Level</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Trend</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Impact on Strategy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {MOCK_RISK_ROWS.map((row) => {
                const levelCfg = RISK_LEVEL_CONFIG[row.level];
                return (
                  <tr key={row.category} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.category}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${levelCfg.bg}`}>
                        <span>{levelCfg.dot}</span>
                        <span>{row.level}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600 font-mono">{row.trend}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.impact}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Active Regulatory Alerts</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {MOCK_ALERTS.map((alert) => (
            <div key={alert.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0 mt-0.5">{alert.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold uppercase tracking-wide ${
                      alert.severity === 'urgent' ? 'text-red-700' :
                      alert.severity === 'watch' ? 'text-yellow-700' :
                      'text-green-700'
                    }`}>
                      {alert.severity === 'urgent' ? 'URGENT' : alert.severity === 'watch' ? 'WATCH' : 'OPPORTUNITY'}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 mb-2">{alert.title}</p>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-600">
                      <span className="font-medium text-gray-500">Impact:</span> {alert.impact}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <p className="text-xs text-gray-600">
                        <span className="font-medium text-gray-500">Probability:</span> {alert.probability}
                      </p>
                      <p className="text-xs text-gray-600">
                        <span className="font-medium text-gray-500">Source:</span> {alert.source}
                      </p>
                    </div>
                    {alert.affectedDeals && (
                      <p className="text-xs text-gray-600">
                        <span className="font-medium text-gray-500">Affected Deals:</span> {alert.affectedDeals}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Strategy-Specific Regulatory Matrix</h3>
          <p className="text-xs text-gray-500 mt-1">How does this jurisdiction's regulatory environment affect each investment strategy?</p>
        </div>
        <div className="divide-y divide-gray-100">
          {STRATEGY_MATRIX.map((row) => (
            <div key={row.strategy} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
              <span className="text-sm font-bold text-gray-900 w-16">{row.strategy}</span>
              <span className="text-lg flex-shrink-0">{row.emoji}</span>
              <span className={`text-sm font-semibold w-20 ${
                row.level === 'Favorable' ? 'text-green-700' :
                row.level === 'Moderate' ? 'text-yellow-700' :
                'text-orange-700'
              }`}>
                {row.level}
              </span>
              <span className="text-sm text-gray-600">— {row.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
