import { useEffect, useRef } from 'react';
import { XMarkIcon, ArrowTopRightOnSquareIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon, FireIcon } from '@heroicons/react/24/solid';
import type { OwnedAsset } from '@/types/grid';

interface AssetMarker {
  id: string;
  asset: OwnedAsset;
  coordinates: [number, number];
  performance: 'good' | 'watch' | 'alert';
}

interface AssetMapPopupProps {
  marker: AssetMarker;
  onClose: () => void;
  onViewDetails: () => void;
}

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—';
  return `${Number(value).toFixed(1)}%`;
};

const renderVariance = (variance: number | null | undefined) => {
  if (variance === null || variance === undefined) return <span className="text-gray-400">—</span>;
  const num = Number(variance);
  const isPositive = num > 0;
  const colorClass = Math.abs(num) < 5
    ? 'text-gray-700'
    : isPositive
    ? 'text-green-600'
    : 'text-red-600';
  return (
    <span className={`font-semibold ${colorClass}`}>
      {isPositive ? '+' : ''}{num.toFixed(1)}%
    </span>
  );
};

const getPerformanceBadge = (performance: 'good' | 'watch' | 'alert') => {
  switch (performance) {
    case 'good':
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-full">
          <CheckCircleIcon className="w-4 h-4" />
          <span className="text-xs font-semibold">Performing Well</span>
        </div>
      );
    case 'watch':
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full">
          <ExclamationTriangleIcon className="w-4 h-4" />
          <span className="text-xs font-semibold">Watch List</span>
        </div>
      );
    case 'alert':
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-100 text-red-700 rounded-full">
          <FireIcon className="w-4 h-4" />
          <span className="text-xs font-semibold">Needs Attention</span>
        </div>
      );
  }
};

export default function AssetMapPopup({ marker, onClose, onViewDetails }: AssetMapPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const { asset, performance } = marker;

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Check for alerts and issues
  const alerts = [];
  if (asset.refi_risk_flag) {
    alerts.push({
      type: 'refi',
      message: `Loan matures in ${asset.months_to_maturity} months`,
      severity: 'high' as const,
    });
  }
  if (asset.noi_variance && asset.noi_variance < -10) {
    alerts.push({
      type: 'noi',
      message: `NOI ${asset.noi_variance.toFixed(1)}% below target`,
      severity: 'high' as const,
    });
  }
  if (asset.occupancy_variance && asset.occupancy_variance < -10) {
    alerts.push({
      type: 'occupancy',
      message: `Occupancy ${Math.abs(asset.occupancy_variance).toFixed(1)}% below target`,
      severity: 'high' as const,
    });
  }
  if (asset.occupancy_variance && asset.occupancy_variance < -5 && asset.occupancy_variance >= -10) {
    alerts.push({
      type: 'occupancy',
      message: 'Occupancy slightly below target',
      severity: 'medium' as const,
    });
  }

  // Calculate hold period
  const holdYears = Math.floor((asset.hold_period || 0) / 12);
  const holdMonths = (asset.hold_period || 0) % 12;
  const holdPeriodText = holdYears > 0
    ? `${holdYears}y ${holdMonths}m`
    : `${holdMonths}m`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20">
      <div
        ref={popupRef}
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-start justify-between z-10">
          <div className="flex-1 pr-4">
            <h2 className="text-xl font-bold text-gray-900 mb-1">{asset.property_name}</h2>
            <p className="text-sm text-gray-600">{asset.address}</p>
            <div className="mt-2 flex items-center gap-2">
              {getPerformanceBadge(performance)}
              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                {asset.asset_type}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            aria-label="Close popup"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              {alerts.map((alert, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-3 p-3 rounded-lg ${
                    alert.severity === 'high'
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-yellow-50 border border-yellow-200'
                  }`}
                >
                  {alert.severity === 'high' ? (
                    <FireIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p
                      className={`text-sm font-medium ${
                        alert.severity === 'high' ? 'text-red-900' : 'text-yellow-900'
                      }`}
                    >
                      {alert.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-xs text-gray-600 mb-1">Occupancy</div>
              <div className="text-2xl font-bold text-gray-900">
                {formatPercent(asset.actual_occupancy)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Target: {formatPercent(asset.proforma_occupancy)}
                <span className="ml-2">{renderVariance(asset.occupancy_variance)}</span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-xs text-gray-600 mb-1">NOI (Annual)</div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(asset.actual_noi)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Target: {formatCurrency(asset.proforma_noi)}
                <span className="ml-2">{renderVariance(asset.noi_variance)}</span>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-xs text-blue-700 mb-1">Current IRR</div>
              <div className="text-2xl font-bold text-blue-900">
                {formatPercent(asset.current_irr)}
              </div>
              <div className="text-xs text-blue-600 mt-1">
                Projected: {formatPercent(asset.projected_irr)}
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-xs text-blue-700 mb-1">Cash-on-Cash</div>
              <div className="text-2xl font-bold text-blue-900">
                {formatPercent(asset.coc_return)}
              </div>
              <div className="text-xs text-blue-600 mt-1">
                Multiple: {asset.equity_multiple?.toFixed(2)}x
              </div>
            </div>
          </div>

          {/* Additional Details */}
          <div className="border-t border-gray-200 pt-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Avg Rent (Actual)</span>
              <span className="text-sm font-semibold text-gray-900">
                {formatCurrency(asset.actual_avg_rent)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Avg Rent (Pro Forma)</span>
              <span className="text-sm font-semibold text-gray-900">
                {formatCurrency(asset.proforma_rent)}
                <span className="ml-2">{renderVariance(asset.rent_variance)}</span>
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Distributions</span>
              <span className="text-sm font-semibold text-gray-900">
                {formatCurrency(asset.total_distributions)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">OpEx Ratio</span>
              <span className="text-sm font-semibold text-gray-900">
                {formatPercent(asset.actual_opex_ratio)}
              </span>
            </div>
          </div>

          {/* Hold Period & Loan Info */}
          <div className="border-t border-gray-200 pt-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Acquired</span>
              <span className="text-sm font-semibold text-gray-900">
                {asset.acquisition_date
                  ? new Date(asset.acquisition_date).toLocaleDateString()
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Hold Period</span>
              <span className="text-sm font-semibold text-gray-900">{holdPeriodText}</span>
            </div>
            {asset.loan_maturity_date && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Loan Maturity</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {new Date(asset.loan_maturity_date).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Time to Maturity</span>
                  <span
                    className={`text-sm font-semibold ${
                      asset.months_to_maturity && asset.months_to_maturity < 12
                        ? 'text-orange-600'
                        : 'text-gray-900'
                    }`}
                  >
                    {asset.months_to_maturity
                      ? `${asset.months_to_maturity} months`
                      : '—'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* CapEx */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Actual CapEx</span>
              <span className="text-sm font-semibold text-gray-900">
                {formatCurrency(asset.actual_capex)}
              </span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm text-gray-600">Pro Forma CapEx</span>
              <span className="text-sm font-semibold text-gray-900">
                {formatCurrency(asset.proforma_capex)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Asset ID: {asset.id}
          </div>
          <button
            onClick={onViewDetails}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <span>View Full Details</span>
            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
