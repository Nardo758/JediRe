import { useState, useEffect } from 'react';
import { TrendingUp, Users, Building2, Briefcase, AlertCircle, ArrowRight } from 'lucide-react';
import { Deal } from '@/types';
import api from '@/lib/api';
import { useModuleCheck } from '@/utils/modules';
import { ModuleUpsellBanner } from './ModuleUpsellBanner';

interface MarketReport {
  submarket_name: string;
  supply_analysis: {
    existing_total_units: number;
    near_term_pipeline_total: number;
    pipeline_ratio: number;
    realistic_buildable_units: number;
    estimated_years_to_buildout: number;
  };
  demand_indicators: {
    current_occupancy: number;
    rent_annual_growth: number;
    units_per_1000_people: number;
    rent_to_income_ratio: number;
  };
  employment_impact: {
    total_jobs_from_news: number;
    units_demand_from_news: number;
    jobs_to_units_ratio: number;
  };
}

interface MarketResearchSectionProps {
  deal: Deal;
}

export function MarketResearchSection({ deal }: MarketResearchSectionProps) {
  const { loading: moduleLoading, enabled: hasMarketResearch } = useModuleCheck('market-research-pro');
  const [report, setReport] = useState<MarketReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasMarketResearch && deal.id) {
      loadMarketReport();
    }
  }, [hasMarketResearch, deal.id]);

  const loadMarketReport = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get(`/api/market-research/report/${deal.id}`);
      
      if (response.data.success) {
        setReport(response.data.report);
      }
    } catch (err: any) {
      console.error('Failed to load market report:', err);
      setError(err.message || 'Failed to load market data');
    } finally {
      setLoading(false);
    }
  };

  if (moduleLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  if (!hasMarketResearch) {
    return (
      <ModuleUpsellBanner
        moduleSlug="market-research-pro"
        moduleName="Market Research Pro"
        description="Advanced market intelligence with supply/demand analysis, per capita metrics, employment impact, and predictive modeling. Respects your market preferences."
        price="$49/month"
        benefits={[
          'Supply & demand analysis',
          'Per capita metrics',
          'Employment impact modeling',
          'Rent-to-income analysis',
          'Pipeline tracking',
          'Market-specific insights'
        ]}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
          <p className="text-sm text-gray-600">Loading market research...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Failed to load market data</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            <button
              onClick={loadMarketReport}
              className="mt-3 text-sm font-medium text-red-600 hover:text-red-700"
            >
              Try again →
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="font-semibold text-gray-900 mb-2">No Market Data Available</h3>
        <p className="text-sm text-gray-600 mb-4">
          Market research requires deal location data.
        </p>
        <button
          onClick={loadMarketReport}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Generate Report
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Market Header */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
        <h3 className="text-xl font-bold text-gray-900 mb-2">{report.submarket_name}</h3>
        <p className="text-sm text-gray-600">Market intelligence summary for this deal's location</p>
      </div>

      {/* Supply Analysis */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Building2 className="w-6 h-6 text-blue-600" />
          <h4 className="text-lg font-semibold text-gray-900">Supply Analysis</h4>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-gray-600 mb-1">Existing Units</div>
            <div className="text-2xl font-bold text-gray-900">
              {report.supply_analysis.existing_total_units.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Pipeline</div>
            <div className="text-2xl font-bold text-orange-600">
              {report.supply_analysis.near_term_pipeline_total.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {report.supply_analysis.pipeline_ratio.toFixed(1)}% of existing
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Future Buildable</div>
            <div className="text-2xl font-bold text-purple-600">
              {report.supply_analysis.realistic_buildable_units.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              ~{report.supply_analysis.estimated_years_to_buildout.toFixed(1)} years
            </div>
          </div>
        </div>
      </div>

      {/* Demand Indicators */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="w-6 h-6 text-green-600" />
          <h4 className="text-lg font-semibold text-gray-900">Demand Indicators</h4>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-600 mb-1">Occupancy</div>
            <div className="text-2xl font-bold text-green-600">
              {report.demand_indicators.current_occupancy.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Rent Growth</div>
            <div className="text-2xl font-bold text-blue-600">
              +{report.demand_indicators.rent_annual_growth.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Units/1K People</div>
            <div className="text-2xl font-bold text-gray-900">
              {report.demand_indicators.units_per_1000_people.toFixed(0)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Rent/Income</div>
            <div className="text-2xl font-bold text-purple-600">
              {(report.demand_indicators.rent_to_income_ratio * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>

      {/* Employment Impact */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Briefcase className="w-6 h-6 text-indigo-600" />
          <h4 className="text-lg font-semibold text-gray-900">Employment Impact</h4>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-gray-600 mb-1">New Jobs (News)</div>
            <div className="text-2xl font-bold text-indigo-600">
              +{report.employment_impact.total_jobs_from_news.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Housing Demand</div>
            <div className="text-2xl font-bold text-green-600">
              {report.employment_impact.units_demand_from_news.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Jobs-to-Units</div>
            <div className="text-2xl font-bold text-gray-900">
              {report.employment_impact.jobs_to_units_ratio.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Link to Full Research */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900">View Full Market Research</h4>
            <p className="text-sm text-gray-600 mt-1">
              Explore comprehensive market analysis across all your markets
            </p>
          </div>
          <button
            onClick={() => window.location.href = '/market-data'}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm font-medium"
          >
            View Research
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
