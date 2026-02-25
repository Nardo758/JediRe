import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../services/api.client';

interface EnvelopeData {
  buildableArea: number;
  maxFootprint: number;
  maxFloors: number;
  maxGFA: number;
  maxCapacity: number;
  limitingFactor: string;
  parkingRequired: number;
  parkingArea: { surface: number; structured: number };
  capacityByConstraint: {
    byDensity: number | null;
    byFAR: number | null;
    byHeight: number | null;
    byParking: number | null;
  };
}

interface ZoningStandards {
  maxDensity: number | null;
  maxFAR: number | null;
  maxHeight: number | null;
  maxStories: number | null;
  minParking: number | null;
  maxLotCoverage: number | null;
  setbacks: { front: number; side: number; rear: number };
}

interface Scenario {
  scenarioType: string;
  label: string;
  maxUnits: number;
  maxHeight: number;
  maxFar: number;
  maxGfa: number;
  parkingRequired: string;
  openSpace: number;
  timeline: string;
  cost: string;
  riskLevel: string;
  successPercent: number;
  estimatedValue: number;
  deltaVsByRight: number;
  deltaPercent: number;
}

interface CapacityData {
  parcelInfo: {
    address: string;
    lotSize: string;
    currentZoning: string;
    districtName: string;
  };
  envelope: EnvelopeData;
  zoningStandards: ZoningStandards;
  scenarios: Scenario[];
}

interface DevelopmentCapacityTabProps {
  dealId?: string;
  deal?: any;
}

function formatNumber(v: number | null | undefined): string {
  if (v == null) return '--';
  return v.toLocaleString();
}

function getLimitingLabel(factor: string): string {
  switch (factor) {
    case 'density': return 'Density (units/acre)';
    case 'FAR': return 'Floor Area Ratio';
    case 'height': return 'Building Height';
    case 'parking': return 'Parking Capacity';
    default: return factor;
  }
}

export default function DevelopmentCapacityTab({ dealId, deal }: DevelopmentCapacityTabProps) {
  const [data, setData] = useState<CapacityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dealId) return;
    setLoading(true);
    setError(null);
    apiClient.get(`/api/v1/deals/${dealId}/development-capacity`)
      .then((res: any) => {
        setData(res);
      })
      .catch((err: any) => {
        const msg = err?.response?.data?.error || err?.message || 'Failed to load capacity analysis';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [dealId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        <span className="ml-3 text-gray-600 text-sm">Calculating building envelope...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
        <svg className="mx-auto h-10 w-10 mb-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <p className="text-sm text-amber-800">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { parcelInfo, envelope, zoningStandards, scenarios } = data;
  const byRight = scenarios.find(s => s.scenarioType === 'by_right');
  const variance = scenarios.find(s => s.scenarioType === 'variance');
  const rezone = scenarios.find(s => s.scenarioType === 'rezone');

  const constraints = envelope.capacityByConstraint;
  const constraintEntries = [
    { label: 'Density', value: constraints.byDensity, isLimiting: envelope.limitingFactor === 'density' },
    { label: 'FAR', value: constraints.byFAR, isLimiting: envelope.limitingFactor === 'FAR' },
    { label: 'Height', value: constraints.byHeight, isLimiting: envelope.limitingFactor === 'height' },
    { label: 'Parking', value: constraints.byParking, isLimiting: envelope.limitingFactor === 'parking' },
  ].filter(c => c.value != null);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-lg border border-gray-200 px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-500 font-medium">Zoning:</span>
          <span className="text-gray-900 font-semibold">{parcelInfo.currentZoning}</span>
          <span className="text-gray-400">({parcelInfo.districtName})</span>
        </div>
        <div className="w-px h-5 bg-gray-200" />
        <div className="flex items-center gap-2">
          <span className="text-gray-500 font-medium">Lot:</span>
          <span className="text-gray-900">{parcelInfo.lotSize}</span>
        </div>
        <div className="w-px h-5 bg-gray-200" />
        <div className="flex items-center gap-2">
          <span className="text-gray-500 font-medium">Buildable:</span>
          <span className="text-gray-900">{formatNumber(envelope.buildableArea)} SF</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Max Units</p>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(envelope.maxCapacity)}</p>
          <p className="text-xs text-gray-400 mt-1">by-right</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Max GFA</p>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(envelope.maxGFA)}</p>
          <p className="text-xs text-gray-400 mt-1">gross SF</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Max Floors</p>
          <p className="text-2xl font-bold text-gray-900">{envelope.maxFloors}</p>
          <p className="text-xs text-gray-400 mt-1">{zoningStandards.maxHeight ? `${zoningStandards.maxHeight} ft limit` : '--'}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Parking Req</p>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(envelope.parkingRequired)}</p>
          <p className="text-xs text-gray-400 mt-1">spaces</p>
        </div>
      </div>

      {constraintEntries.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Capacity by Constraint</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Limiting factor: <span className="font-semibold text-red-600">{getLimitingLabel(envelope.limitingFactor)}</span>
            </p>
          </div>
          <div className="p-5">
            <div className="space-y-3">
              {constraintEntries.map(c => {
                const maxVal = Math.max(...constraintEntries.map(e => e.value || 0));
                const pct = maxVal > 0 ? ((c.value || 0) / maxVal) * 100 : 0;
                return (
                  <div key={c.label} className="flex items-center gap-4">
                    <span className={`text-xs font-medium w-16 ${c.isLimiting ? 'text-red-600' : 'text-gray-600'}`}>{c.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${c.isLimiting ? 'bg-red-400' : 'bg-blue-400'}`}
                        style={{ width: `${Math.max(pct, 3)}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-800">
                        {formatNumber(c.value)} units
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Zoning Standards Applied</h3>
        </div>
        <div className="grid grid-cols-3 gap-px bg-gray-100">
          {[
            { label: 'Max Density', value: zoningStandards.maxDensity, suffix: ' units/acre' },
            { label: 'Max FAR', value: zoningStandards.maxFAR, suffix: '' },
            { label: 'Max Height', value: zoningStandards.maxHeight, suffix: ' ft' },
            { label: 'Max Stories', value: zoningStandards.maxStories, suffix: '' },
            { label: 'Parking Ratio', value: zoningStandards.minParking, suffix: ' per unit' },
            { label: 'Lot Coverage', value: zoningStandards.maxLotCoverage, suffix: '%' },
          ].map(item => (
            <div key={item.label} className="bg-white p-3">
              <p className="text-xs text-gray-500">{item.label}</p>
              <p className="text-sm font-semibold text-gray-900">
                {item.value != null ? `${item.value}${item.suffix}` : '--'}
              </p>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 px-5 py-3 bg-gray-50">
          <p className="text-xs text-gray-500">
            Setbacks: Front {zoningStandards.setbacks.front}ft, Side {zoningStandards.setbacks.side}ft, Rear {zoningStandards.setbacks.rear}ft
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Scenario Comparison</h3>
          <p className="text-xs text-gray-500 mt-0.5">Development potential across entitlement paths</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider w-[22%]" />
                <th className="text-center px-4 py-3 w-[26%]">
                  <div className="text-xs font-bold text-gray-900">CURRENT ZONING</div>
                  <div className="text-[10px] text-gray-500">(by-right)</div>
                </th>
                <th className="text-center px-4 py-3 w-[26%]">
                  <div className="text-xs font-bold text-gray-900">VARIANCE PATH</div>
                  <div className="text-[10px] text-gray-500">(+20% density)</div>
                </th>
                <th className="text-center px-4 py-3 w-[26%]">
                  <div className="text-xs font-bold text-gray-900">REZONE PATH</div>
                  <div className="text-[10px] text-gray-500">(+60% density)</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Max Units', key: 'maxUnits', format: (v: number) => formatNumber(v) },
                { label: 'Max GFA', key: 'maxGfa', format: (v: number) => `${formatNumber(v)} SF` },
                { label: 'Parking', key: 'parkingRequired', format: (v: string) => v },
                { label: 'Timeline', key: 'timeline', format: (v: string) => v },
                { label: 'Cost', key: 'cost', format: (v: string) => v },
                { label: 'Risk', key: 'riskLevel', format: (v: string) => v.charAt(0).toUpperCase() + v.slice(1) },
                { label: 'Success %', key: 'successPercent', format: (v: number) => `${v}%` },
                { label: 'Est. Value', key: 'estimatedValue', format: (v: number) => `$${formatNumber(v)}` },
                { label: 'Delta vs By-Right', key: 'deltaVsByRight', format: (v: number) => v === 0 ? 'baseline' : `${v >= 0 ? '+' : ''}$${formatNumber(v)}` },
              ].map(row => (
                <tr key={row.key} className="hover:bg-gray-50/50 border-b border-gray-50">
                  <td className="px-5 py-2.5 text-gray-600 font-medium text-xs">{row.label}</td>
                  {[byRight, variance, rezone].map((scenario, i) => {
                    const val = scenario ? (scenario as any)[row.key] : null;
                    let cellClass = 'text-gray-900';
                    if (row.key === 'riskLevel' && scenario) {
                      cellClass = scenario.riskLevel === 'low' ? 'text-green-600' : scenario.riskLevel === 'medium' ? 'text-yellow-600' : 'text-red-600';
                    }
                    if (row.key === 'deltaVsByRight' && scenario && scenario.deltaVsByRight !== 0) {
                      cellClass = scenario.deltaVsByRight > 0 ? 'text-green-600 font-semibold' : 'text-red-600';
                    }
                    if (row.key === 'successPercent' && scenario) {
                      cellClass = scenario.successPercent >= 80 ? 'text-green-600 font-medium' : scenario.successPercent >= 50 ? 'text-yellow-600 font-medium' : 'text-red-600 font-medium';
                    }
                    return (
                      <td key={i} className={`text-center px-4 py-2.5 text-xs ${cellClass}`}>
                        {val != null ? row.format(val) : '--'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
