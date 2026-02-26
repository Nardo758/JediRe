import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../../services/api.client';

interface HBUResult {
  propertyType: string;
  maxCapacity: number;
  maxGFA: number;
  annualGrossRevenue: number;
  estimatedNOI: number;
  estimatedValue: number;
  capRate: number;
  expenseRatio: number;
  limitingFactor: string;
  recommended: boolean;
  reasoning: string;
}

interface HighestBestUseTabProps {
  dealId?: string;
  deal?: any;
}

function formatNumber(v: number | null | undefined): string {
  if (v == null) return '--';
  return v.toLocaleString();
}

function getLimitingLabel(factor: string | null): string {
  switch (factor) {
    case 'density': return 'Density (units/acre)';
    case 'FAR': return 'Floor Area Ratio';
    case 'height': return 'Building Height';
    case 'parking': return 'Parking Capacity';
    default: return factor || '--';
  }
}

export default function HighestBestUseTab({ dealId, deal }: HighestBestUseTabProps) {
  const [hbuResults, setHbuResults] = useState<HBUResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rezoneOpportunity, setRezoneOpportunity] = useState<any>(null);
  const [loadingRezone, setLoadingRezone] = useState(false);

  const loadHBU = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/api/v1/deals/${dealId}/scenarios/hbu`);
      setHbuResults(res.data.hbu || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load HBU analysis');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  const loadRezoneOpportunity = useCallback(async () => {
    if (!dealId) return;
    setLoadingRezone(true);
    try {
      const res = await apiClient.get(`/api/v1/deals/${dealId}/rezone-analysis`);
      const opportunities = res.data.opportunities || [];
      if (opportunities.length > 0) {
        setRezoneOpportunity(opportunities[0]);
      }
    } catch {
    } finally {
      setLoadingRezone(false);
    }
  }, [dealId]);

  useEffect(() => {
    loadHBU();
    loadRezoneOpportunity();
  }, [loadHBU, loadRezoneOpportunity]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        <span className="ml-3 text-gray-600 text-sm">Loading Highest & Best Use analysis...</span>
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
        <button onClick={() => { setError(null); loadHBU(); }} className="mt-3 text-xs text-blue-600 hover:text-blue-800 underline">
          Try again
        </button>
      </div>
    );
  }

  if (hbuResults.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <svg className="mx-auto h-12 w-12 mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
        <p className="text-sm text-gray-600 mb-2">No HBU analysis available.</p>
        <p className="text-xs text-gray-500">Ensure a zoning profile has been resolved for this deal in the Development Capacity tab.</p>
      </div>
    );
  }

  const bestUse = hbuResults.find(r => r.recommended);
  const sortedResults = [...hbuResults].sort((a, b) => b.estimatedValue - a.estimatedValue);

  return (
    <div className="space-y-5">
      {bestUse && (
        <div className="bg-gradient-to-r from-amber-50 to-amber-100/50 rounded-lg border border-amber-200 px-5 py-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[10px] bg-amber-200 text-amber-800 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide">Best Use</span>
            <span className="text-base font-bold text-amber-900 capitalize">{bestUse.propertyType}</span>
            <span className="ml-auto text-sm font-semibold text-amber-900">${formatNumber(Math.round(bestUse.estimatedValue))}</span>
          </div>
          <p className="text-sm text-amber-800">{bestUse.reasoning}</p>
          <div className="mt-3 grid grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] text-amber-600 uppercase tracking-wide font-medium">Max Capacity</p>
              <p className="text-sm font-semibold text-amber-900">{formatNumber(bestUse.maxCapacity)} units</p>
            </div>
            <div>
              <p className="text-[10px] text-amber-600 uppercase tracking-wide font-medium">Max GFA</p>
              <p className="text-sm font-semibold text-amber-900">{formatNumber(Math.round(bestUse.maxGFA))} SF</p>
            </div>
            <div>
              <p className="text-[10px] text-amber-600 uppercase tracking-wide font-medium">Annual NOI</p>
              <p className="text-sm font-semibold text-amber-900">${formatNumber(Math.round(bestUse.estimatedNOI))}</p>
            </div>
            <div>
              <p className="text-[10px] text-amber-600 uppercase tracking-wide font-medium">Limiting Factor</p>
              <p className="text-sm font-semibold text-red-700">{getLimitingLabel(bestUse.limitingFactor)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Property Type Comparison</h3>
          <p className="text-xs text-gray-500 mt-0.5">All 6 property types ranked by estimated value under current zoning constraints</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Property Type</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Max Capacity</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Max GFA</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Annual Revenue</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">NOI</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Est. Value</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Limiting Factor</th>
              </tr>
            </thead>
            <tbody>
              {sortedResults.map((result, idx) => (
                <tr key={result.propertyType} className={`border-b border-gray-50 ${result.recommended ? 'bg-amber-50/50' : 'hover:bg-gray-50/50'}`}>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 font-medium w-4">#{idx + 1}</span>
                      <span className={`text-xs font-semibold capitalize ${result.recommended ? 'text-amber-900' : 'text-gray-900'}`}>{result.propertyType}</span>
                      {result.recommended && (
                        <span className="text-[9px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full font-bold">BEST</span>
                      )}
                    </div>
                  </td>
                  <td className="text-right px-4 py-2.5 text-xs text-gray-900">{formatNumber(result.maxCapacity)}</td>
                  <td className="text-right px-4 py-2.5 text-xs text-gray-900">{formatNumber(Math.round(result.maxGFA))} SF</td>
                  <td className="text-right px-4 py-2.5 text-xs text-gray-900">${formatNumber(Math.round(result.annualGrossRevenue))}</td>
                  <td className="text-right px-4 py-2.5 text-xs text-gray-900">${formatNumber(Math.round(result.estimatedNOI))}</td>
                  <td className={`text-right px-4 py-2.5 text-xs font-semibold ${result.recommended ? 'text-amber-900' : 'text-gray-900'}`}>${formatNumber(Math.round(result.estimatedValue))}</td>
                  <td className="text-center px-4 py-2.5">
                    <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-200">{getLimitingLabel(result.limitingFactor)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {rezoneOpportunity && (
        <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-blue-200 bg-blue-50">
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full font-bold uppercase">Rezone Opportunity</span>
              <h3 className="text-sm font-bold text-blue-900">
                {rezoneOpportunity.targetDistrictCode || 'Higher-Density District'}
              </h3>
            </div>
            <p className="text-xs text-blue-700 mt-1">
              Rezoning to {rezoneOpportunity.targetDistrictCode} could unlock a better HBU result
            </p>
          </div>
          <div className="px-5 py-4 grid grid-cols-3 gap-4">
            {rezoneOpportunity.additionalUnits != null && (
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Additional Units</p>
                <p className="text-sm font-semibold text-green-700">+{formatNumber(rezoneOpportunity.additionalUnits)}</p>
              </div>
            )}
            {rezoneOpportunity.additionalGFA != null && (
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Additional GFA</p>
                <p className="text-sm font-semibold text-green-700">+{formatNumber(Math.round(rezoneOpportunity.additionalGFA))} SF</p>
              </div>
            )}
            {rezoneOpportunity.revenueUplift != null && (
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Revenue Uplift</p>
                <p className="text-sm font-semibold text-green-700">+${formatNumber(Math.round(rezoneOpportunity.revenueUplift))}</p>
              </div>
            )}
          </div>
          {rezoneOpportunity.sourceUrl && (
            <div className="px-5 pb-3">
              <a
                href={rezoneOpportunity.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-violet-700 hover:text-violet-900 underline"
              >
                View target district zoning code
              </a>
            </div>
          )}
        </div>
      )}

      {loadingRezone && !rezoneOpportunity && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
          <span className="ml-2 text-gray-500 text-xs">Checking rezone opportunities...</span>
        </div>
      )}
    </div>
  );
}
