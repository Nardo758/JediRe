/**
 * M27: Sale Comp Intelligence Module
 * Transaction intelligence and pattern detection
 */

import { useState, useEffect } from 'react';
import {
  TrendingUp, MapPin, Calendar, DollarSign,
  Building2, Users, Target, BarChart3, AlertCircle
} from 'lucide-react';
import { apiClient } from '@/services/api.client';

interface CompsModuleProps {
  deal?: any;
  dealId?: string;
  embedded?: boolean;
  onUpdate?: () => void;
  onBack?: () => void;
}

interface CompSet {
  id: string;
  comp_count: number;
  median_price_per_unit: number;
  avg_price_per_unit: number;
  min_price_per_unit: number;
  max_price_per_unit: number;
  median_implied_cap_rate: number | null;
  avg_implied_cap_rate: number | null;
  comps: CompTransaction[];
}

interface CompTransaction {
  id: string;
  recording_date: string;
  property_address: string;
  units: number;
  year_built: number;
  derived_sale_price: number;
  price_per_unit: number;
  implied_cap_rate: number | null;
  grantee_name: string;
  buyer_type: string;
  distance_miles: number;
}

export default function CompsModule({
  deal,
  dealId: propDealId,
  embedded = false,
  onUpdate,
  onBack
}: CompsModuleProps) {
  const dealId = deal?.id || propDealId;
  const [activeTab, setActiveTab] = useState<'grid' | 'patterns' | 'cap-rates'>('grid');
  const [loading, setLoading] = useState(true);
  const [compSet, setCompSet] = useState<CompSet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (dealId) {
      loadCompData();
    }
  }, [dealId]);

  const loadCompData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.get(`/deals/${dealId}/comps`);
      
      if (response.success && response.data) {
        setCompSet(response.data);
      } else {
        setCompSet(null);
      }
    } catch (err: any) {
      console.error('Comp data load error:', err);
      if (err.response?.status === 404) {
        setError(null); // No error for missing comp set, just show generate button
      } else {
        setError(err.message || 'Failed to load comp data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateComps = async () => {
    try {
      setGenerating(true);
      setError(null);
      
      const response = await apiClient.post(`/deals/${dealId}/comps/generate`, {
        radius_miles: 3.0,
        date_range_months: 24,
        min_units: 50,
        max_units: 500,
        exclude_distress: true,
        arms_length_only: true
      });
      
      if (response.success && response.data) {
        setCompSet(response.data);
      }
    } catch (err: any) {
      console.error('Generate comps error:', err);
      setError(err.message || 'Failed to generate comp set');
    } finally {
      setGenerating(false);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderGridTab = () => {
    if (!compSet) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <MapPin className="w-12 h-12 mb-4 text-gray-600" />
          <p className="text-sm text-gray-400 mb-4">No comp set available</p>
          <button
            onClick={handleGenerateComps}
            disabled={generating}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white text-sm font-medium rounded transition-colors"
          >
            {generating ? 'Generating...' : 'Generate Comp Set'}
          </button>
          <p className="text-xs text-gray-500 mt-3">
            3-mile radius • 24 months • Multifamily only
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
              <Building2 className="w-3.5 h-3.5" />
              <span>Comp Count</span>
            </div>
            <div className="text-2xl font-bold text-gray-300">
              {compSet.comp_count}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Sales in last 24 mo
            </div>
          </div>

          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-400 text-xs mb-2">
              <DollarSign className="w-3.5 h-3.5" />
              <span>Median Price/Unit</span>
            </div>
            <div className="text-2xl font-bold text-green-300">
              {formatCurrency(compSet.median_price_per_unit)}
            </div>
            <div className="text-xs text-green-500/70 mt-1">
              Range: {formatCurrency(compSet.min_price_per_unit)} - {formatCurrency(compSet.max_price_per_unit)}
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-400 text-xs mb-2">
              <Target className="w-3.5 h-3.5" />
              <span>Median Cap Rate</span>
            </div>
            <div className="text-2xl font-bold text-blue-300">
              {compSet.median_implied_cap_rate 
                ? formatPercent(compSet.median_implied_cap_rate)
                : 'N/A'}
            </div>
            <div className="text-xs text-blue-500/70 mt-1">
              Transaction-derived
            </div>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-purple-400 text-xs mb-2">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Avg Price/Unit</span>
            </div>
            <div className="text-2xl font-bold text-purple-300">
              {formatCurrency(compSet.avg_price_per_unit)}
            </div>
            <div className="text-xs text-purple-500/70 mt-1">
              {compSet.avg_price_per_unit > compSet.median_price_per_unit ? '+' : ''}
              {formatCurrency(compSet.avg_price_per_unit - compSet.median_price_per_unit)} vs median
            </div>
          </div>
        </div>

        {/* Comp Table */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-700">
            <h4 className="text-sm font-semibold text-gray-300">Comparable Sales</h4>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700 bg-gray-800/30">
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Address</th>
                  <th className="text-center py-2 px-3 text-gray-400 font-medium">Date</th>
                  <th className="text-right py-2 px-3 text-gray-400 font-medium">Units</th>
                  <th className="text-right py-2 px-3 text-gray-400 font-medium">Sale Price</th>
                  <th className="text-right py-2 px-3 text-gray-400 font-medium">$/Unit</th>
                  <th className="text-right py-2 px-3 text-gray-400 font-medium">Cap Rate</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Buyer</th>
                  <th className="text-right py-2 px-3 text-gray-400 font-medium">Distance</th>
                </tr>
              </thead>
              <tbody>
                {compSet.comps.map((comp) => (
                  <tr key={comp.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                    <td className="py-2 px-3 text-gray-300 max-w-[200px] truncate">
                      {comp.property_address}
                    </td>
                    <td className="py-2 px-3 text-center text-gray-400">
                      {formatDate(comp.recording_date)}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-300">
                      {comp.units}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-300 font-medium">
                      {formatCurrency(comp.derived_sale_price)}
                    </td>
                    <td className="py-2 px-3 text-right text-green-400 font-medium">
                      {formatCurrency(comp.price_per_unit)}
                    </td>
                    <td className="py-2 px-3 text-right text-blue-400">
                      {comp.implied_cap_rate ? formatPercent(comp.implied_cap_rate) : '-'}
                    </td>
                    <td className="py-2 px-3 text-gray-400 max-w-[150px] truncate">
                      {comp.grantee_name}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-500">
                      {comp.distance_miles.toFixed(1)} mi
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Refresh Button */}
        <div className="flex justify-center">
          <button
            onClick={handleGenerateComps}
            disabled={generating}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800/50 border border-gray-700 text-gray-300 text-sm font-medium rounded transition-colors"
          >
            {generating ? 'Regenerating...' : 'Regenerate Comp Set'}
          </button>
        </div>
      </div>
    );
  };

  const renderPatternsTab = () => {
    return (
      <div className="space-y-4">
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
          <div className="text-sm font-semibold text-gray-300 mb-3">Transaction Patterns</div>
          <div className="text-xs text-gray-500 mb-4">
            Coming soon: Velocity shifts, price migration, buyer rotation, and holding period analysis.
          </div>
        </div>
      </div>
    );
  };

  const renderCapRatesTab = () => {
    if (!compSet || !compSet.median_implied_cap_rate) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-sm">Cap rate data unavailable</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Target className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-blue-300 mb-1">
                Transaction-Derived Cap Rate
              </div>
              <div className="text-xs text-blue-400/80 mb-3">
                Based on actual recorded sales with documentary stamps - ground truth, not broker quotes.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-blue-400/70 mb-1">Median Cap Rate</div>
                  <div className="text-2xl font-bold text-blue-300">
                    {formatPercent(compSet.median_implied_cap_rate)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-blue-400/70 mb-1">Average Cap Rate</div>
                  <div className="text-2xl font-bold text-blue-300">
                    {compSet.avg_implied_cap_rate ? formatPercent(compSet.avg_implied_cap_rate) : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
          <div className="text-sm font-semibold text-gray-300 mb-3">Cap Rate Intelligence</div>
          <div className="text-xs text-gray-500 mb-4">
            Coming soon: Cap rate trends by class, vintage, and submarket. Spread vs treasuries.
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-400 text-sm">Loading comp data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            Sale Comp Intelligence
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Transaction intelligence and pattern detection
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
        {(['grid', 'patterns', 'cap-rates'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 ${
              activeTab === tab
                ? 'text-green-400 border-green-400'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            {tab.replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-300">{error}</div>
            </div>
          </div>
        )}
        
        {activeTab === 'grid' && renderGridTab()}
        {activeTab === 'patterns' && renderPatternsTab()}
        {activeTab === 'cap-rates' && renderCapRatesTab()}
      </div>
    </div>
  );
}
