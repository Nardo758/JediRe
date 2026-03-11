import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Clock, PieChart } from 'lucide-react';
import { commissionAPI } from '@/services/api';
import { CommissionSummary as CommissionSummaryType } from '@/types';

export default function CommissionSummary() {
  const [summary, setSummary] = useState<CommissionSummaryType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    setIsLoading(true);
    try {
      const data = await commissionAPI.getSummary();
      setSummary(data);
    } catch (error) {
      console.error('Failed to load commission summary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center text-gray-500 py-8">Failed to load commission data</div>
      </div>
    );
  }

  const totalByType = summary.commissionsByType.sale + summary.commissionsByType.lease + summary.commissionsByType.rental;
  const typePercentages = {
    sale: totalByType > 0 ? (summary.commissionsByType.sale / totalByType) * 100 : 0,
    lease: totalByType > 0 ? (summary.commissionsByType.lease / totalByType) * 100 : 0,
    rental: totalByType > 0 ? (summary.commissionsByType.rental / totalByType) * 100 : 0,
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Commission Dashboard</h2>
        </div>
        <button
          onClick={loadSummary}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Refresh
        </button>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* YTD Total */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">Year to Date</span>
          </div>
          <div className="text-3xl font-bold text-blue-900 mb-1">
            {formatCurrency(summary.ytdTotal)}
          </div>
          <div className="text-xs text-blue-600">Total commissions earned</div>
        </div>

        {/* MTD Total */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-700">Month to Date</span>
          </div>
          <div className="text-3xl font-bold text-green-900 mb-1">
            {formatCurrency(summary.mtdTotal)}
          </div>
          <div className="text-xs text-green-600">
            {summary.ytdTotal > 0
              ? `${((summary.mtdTotal / summary.ytdTotal) * 100).toFixed(1)}% of YTD`
              : 'This month'}
          </div>
        </div>

        {/* Pending */}
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-6 border border-yellow-200">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-700">Pending</span>
          </div>
          <div className="text-3xl font-bold text-yellow-900 mb-1">
            {formatCurrency(summary.pendingTotal)}
          </div>
          <div className="text-xs text-yellow-600">Deals under contract</div>
        </div>
      </div>

      {/* Commission by Deal Type */}
      <div className="bg-gray-50 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <PieChart className="w-5 h-5 text-gray-700" />
          <h3 className="text-lg font-semibold text-gray-900">Commission by Deal Type</h3>
        </div>

        {/* Chart - Horizontal Stacked Bar */}
        <div className="mb-4">
          <div className="h-12 flex rounded-lg overflow-hidden shadow-sm">
            {summary.commissionsByType.sale > 0 && (
              <div
                className="bg-blue-500 flex items-center justify-center text-white text-sm font-medium transition-all hover:opacity-90"
                style={{ width: `${typePercentages.sale}%` }}
                title={`Sales: ${formatCurrency(summary.commissionsByType.sale)}`}
              >
                {typePercentages.sale > 15 && `${typePercentages.sale.toFixed(0)}%`}
              </div>
            )}
            {summary.commissionsByType.lease > 0 && (
              <div
                className="bg-green-500 flex items-center justify-center text-white text-sm font-medium transition-all hover:opacity-90"
                style={{ width: `${typePercentages.lease}%` }}
                title={`Leases: ${formatCurrency(summary.commissionsByType.lease)}`}
              >
                {typePercentages.lease > 15 && `${typePercentages.lease.toFixed(0)}%`}
              </div>
            )}
            {summary.commissionsByType.rental > 0 && (
              <div
                className="bg-purple-500 flex items-center justify-center text-white text-sm font-medium transition-all hover:opacity-90"
                style={{ width: `${typePercentages.rental}%` }}
                title={`Rentals: ${formatCurrency(summary.commissionsByType.rental)}`}
              >
                {typePercentages.rental > 15 && `${typePercentages.rental.toFixed(0)}%`}
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <div>
              <div className="text-xs text-gray-600">Sales</div>
              <div className="text-sm font-semibold text-gray-900">
                {formatCurrency(summary.commissionsByType.sale)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <div>
              <div className="text-xs text-gray-600">Leases</div>
              <div className="text-sm font-semibold text-gray-900">
                {formatCurrency(summary.commissionsByType.lease)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-purple-500 rounded"></div>
            <div>
              <div className="text-xs text-gray-600">Rentals</div>
              <div className="text-sm font-semibold text-gray-900">
                {formatCurrency(summary.commissionsByType.rental)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Footer */}
      <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-2 gap-4">
        <div className="text-center">
          <div className="text-sm text-gray-600 mb-1">Average Deal</div>
          <div className="text-xl font-bold text-gray-900">
            {totalByType > 0
              ? formatCurrency(
                  (summary.commissionsByType.sale +
                    summary.commissionsByType.lease +
                    summary.commissionsByType.rental) /
                    3
                )
              : '$0'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-600 mb-1">Pipeline Value</div>
          <div className="text-xl font-bold text-gray-900">
            {formatCurrency(summary.pendingTotal)}
          </div>
        </div>
      </div>
    </div>
  );
}
