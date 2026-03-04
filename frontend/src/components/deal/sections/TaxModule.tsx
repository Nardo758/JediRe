/**
 * M26: Tax Intelligence Module
 * Property tax projections and intelligence
 */

import { useState, useEffect } from 'react';
import {
  DollarSign, TrendingUp, FileText, Clock,
  AlertTriangle, Building2, Calculator, MapPin
} from 'lucide-react';
import { apiClient } from '@/services/api.client';

interface TaxModuleProps {
  deal?: any;
  dealId?: string;
  embedded?: boolean;
  onUpdate?: () => void;
  onBack?: () => void;
}

interface TaxProjection {
  id: string;
  projected_total_tax: number;
  projected_tax_per_unit: number;
  effective_tax_rate: number;
  current_annual_tax: number | null;
  delta_amount: number | null;
  delta_pct: number | null;
  yearly_projections: Array<{
    year: number;
    annual_tax: number;
    tax_per_unit: number;
    cumulative_savings_from_cap: number;
  }>;
}

export default function TaxModule({
  deal,
  dealId: propDealId,
  embedded = false,
  onUpdate,
  onBack
}: TaxModuleProps) {
  const dealId = deal?.id || propDealId;
  const [activeTab, setActiveTab] = useState<'summary' | 'projection' | 'methodology' | 'history'>('summary');
  const [loading, setLoading] = useState(true);
  const [projection, setProjection] = useState<TaxProjection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dealId) {
      loadTaxData();
    }
  }, [dealId]);

  const loadTaxData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.get(`/deals/${dealId}/tax/projection`);
      
      if (response.success && response.data) {
        setProjection(response.data);
      } else {
        setProjection(null);
      }
    } catch (err: any) {
      console.error('Tax data load error:', err);
      if (err.response?.status === 404) {
        setError('No tax projection available. Set purchase price and units to generate.');
      } else {
        setError(err.message || 'Failed to load tax data');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return (value * 100).toFixed(2) + '%';
  };

  const renderSummaryTab = () => {
    if (!projection) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Calculator className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-sm">No tax projection available</p>
          <p className="text-xs mt-2">Set purchase price and units to generate projection</p>
        </div>
      );
    }

    const hasIncrease = projection.delta_pct && projection.delta_pct > 0;

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Current Tax */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
              <Building2 className="w-3.5 h-3.5" />
              <span>Current Tax (Seller's Bill)</span>
            </div>
            <div className="text-2xl font-bold text-gray-300">
              {projection.current_annual_tax ? formatCurrency(projection.current_annual_tax) : 'N/A'}
            </div>
            {projection.current_annual_tax && (
              <div className="text-xs text-gray-500 mt-1">
                Per Unit: {formatCurrency(projection.current_annual_tax / (deal?.targetUnits || 1))}
              </div>
            )}
          </div>

          {/* Projected Tax */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-amber-400 text-xs mb-2">
              <DollarSign className="w-3.5 h-3.5" />
              <span>Projected Tax (Post-Acquisition)</span>
            </div>
            <div className="text-2xl font-bold text-amber-300">
              {formatCurrency(projection.projected_total_tax)}
            </div>
            <div className="text-xs text-amber-500/70 mt-1">
              Per Unit: {formatCurrency(projection.projected_tax_per_unit)}
            </div>
          </div>

          {/* Delta */}
          <div className={`${hasIncrease ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'} border rounded-lg p-4`}>
            <div className="flex items-center gap-2 text-xs mb-2" style={{ color: hasIncrease ? '#fca5a5' : '#86efac' }}>
              {hasIncrease ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
              <span>Change on Acquisition</span>
            </div>
            <div className="text-2xl font-bold" style={{ color: hasIncrease ? '#f87171' : '#4ade80' }}>
              {projection.delta_pct ? `${projection.delta_pct >= 0 ? '+' : ''}${projection.delta_pct.toFixed(1)}%` : 'N/A'}
            </div>
            {projection.delta_amount && (
              <div className="text-xs mt-1" style={{ color: hasIncrease ? '#f87171' : '#4ade80' }}>
                {projection.delta_amount >= 0 ? '+' : ''}{formatCurrency(projection.delta_amount)}
              </div>
            )}
          </div>
        </div>

        {/* Alert if significant increase */}
        {projection.delta_pct && projection.delta_pct > 30 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-red-300 mb-1">
                  High Tax Increase Detected
                </div>
                <div className="text-xs text-red-400/80">
                  Property tax will increase by {projection.delta_pct.toFixed(1)}% on acquisition.
                  County will reassess to your purchase price. This is a ${formatCurrency(projection.delta_amount || 0)}/year
                  impact to OpEx. ProForma has been automatically updated with the projected tax.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Additional Metrics */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
          <div className="text-sm font-semibold text-gray-300 mb-3">Tax Burden Metrics</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">Effective Tax Rate</div>
              <div className="text-lg font-bold text-gray-300">
                {formatPercent(projection.effective_tax_rate)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Annual Tax</div>
              <div className="text-lg font-bold text-gray-300">
                {formatCurrency(projection.projected_total_tax)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Per Unit/Year</div>
              <div className="text-lg font-bold text-gray-300">
                {formatCurrency(projection.projected_tax_per_unit)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Per Unit/Month</div>
              <div className="text-lg font-bold text-gray-300">
                {formatCurrency(projection.projected_tax_per_unit / 12)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderProjectionTab = () => {
    if (!projection || !projection.yearly_projections) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Clock className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-sm">No 10-year projection available</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
          <div className="text-sm font-semibold text-gray-300 mb-2">10-Year Tax Projection</div>
          <div className="text-xs text-gray-500 mb-4">
            Assumes 10% annual cap (non-homestead) and 3% market value growth
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-2 text-gray-400 font-medium">Year</th>
                  <th className="text-right py-2 px-2 text-gray-400 font-medium">Annual Tax</th>
                  <th className="text-right py-2 px-2 text-gray-400 font-medium">Per Unit</th>
                  <th className="text-right py-2 px-2 text-gray-400 font-medium">Cap Savings</th>
                </tr>
              </thead>
              <tbody>
                {projection.yearly_projections.map((year) => (
                  <tr key={year.year} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                    <td className="py-2 px-2 text-gray-300">Year {year.year}</td>
                    <td className="py-2 px-2 text-right text-gray-300 font-medium">
                      {formatCurrency(year.annual_tax)}
                    </td>
                    <td className="py-2 px-2 text-right text-gray-400">
                      {formatCurrency(year.tax_per_unit)}
                    </td>
                    <td className="py-2 px-2 text-right text-green-400">
                      {year.cumulative_savings_from_cap > 0 
                        ? formatCurrency(year.cumulative_savings_from_cap)
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-blue-300 mb-1">
                Assessment Cap Benefit
              </div>
              <div className="text-xs text-blue-400/80">
                Florida's 10% annual cap on non-homestead assessments means your assessed value
                can only increase 10%/year, even if market value grows faster. This creates
                cumulative tax savings over your hold period shown in the table above.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMethodologyTab = () => {
    return (
      <div className="space-y-4">
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
          <div className="text-sm font-semibold text-gray-300 mb-3">Municipal Tax Methodology</div>
          <div className="text-xs text-gray-500 mb-4">
            Coming soon: How this county assesses multifamily properties, exemptions available, and non-ad-valorem charges.
          </div>
        </div>
      </div>
    );
  };

  const renderHistoryTab = () => {
    return (
      <div className="space-y-4">
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
          <div className="text-sm font-semibold text-gray-300 mb-3">Tax History (5-10 Years)</div>
          <div className="text-xs text-gray-500 mb-4">
            Coming soon: Historical assessed values, millage rates, and tax amounts for trend analysis.
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-400 text-sm">Loading tax data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-100 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-400" />
            Tax Intelligence
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Property tax projections and analysis
          </p>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-gray-300"
          >
            Back
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        {(['summary', 'projection', 'methodology', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 ${
              activeTab === tab
                ? 'text-amber-400 border-amber-400'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
            <div className="text-sm text-red-300">{error}</div>
          </div>
        )}
        
        {activeTab === 'summary' && renderSummaryTab()}
        {activeTab === 'projection' && renderProjectionTab()}
        {activeTab === 'methodology' && renderMethodologyTab()}
        {activeTab === 'history' && renderHistoryTab()}
      </div>
    </div>
  );
}
