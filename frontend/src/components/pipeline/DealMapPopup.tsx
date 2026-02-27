/**
 * Deal Map Popup
 * Quick deal summary popup on map hover/click
 */

import { useNavigate } from 'react-router-dom';
import { PipelineDeal } from '@/types/grid';
import { 
  BuildingOfficeIcon, 
  CurrencyDollarIcon, 
  ChartBarIcon,
  ClockIcon,
  ArrowTopRightOnSquareIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';

interface DealMapPopupProps {
  deal: PipelineDeal;
  onClose: () => void;
}

// Format currency
const formatCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
};

// Format percent
const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

// Get stage display name and color
const getStageInfo = (stage: string): { label: string; color: string; bgColor: string } => {
  const normalized = stage?.toLowerCase() || '';
  
  const stageMap: Record<string, { label: string; color: string; bgColor: string }> = {
    sourcing: { label: 'Sourcing', color: 'text-green-700', bgColor: 'bg-green-100' },
    underwriting: { label: 'Underwriting', color: 'text-blue-700', bgColor: 'bg-blue-100' },
    'due diligence': { label: 'Due Diligence', color: 'text-amber-700', bgColor: 'bg-amber-100' },
    'under contract': { label: 'Under Contract', color: 'text-purple-700', bgColor: 'bg-purple-100' },
    closing: { label: 'Closing', color: 'text-pink-700', bgColor: 'bg-pink-100' },
    passed: { label: 'Passed', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  };

  return stageMap[normalized] || { label: stage, color: 'text-indigo-700', bgColor: 'bg-indigo-100' };
};

export default function DealMapPopup({ deal, onClose }: DealMapPopupProps) {
  const navigate = useNavigate();
  const stageInfo = getStageInfo(deal.pipeline_stage);

  const handleViewDetails = () => {
    navigate(`/deals/${deal.id}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-30">
      <div 
        className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
          
          <div className="flex items-start gap-3 pr-8">
            <BuildingOfficeIcon className="w-6 h-6 flex-shrink-0 mt-1" />
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg leading-tight">
                {deal.property_name || deal.address || 'Unnamed Property'}
              </h3>
              {deal.address && deal.property_name && (
                <p className="text-blue-100 text-sm mt-1">{deal.address}</p>
              )}
            </div>
          </div>

          {/* AI Score Badge */}
          {deal.ai_opportunity_score && (
            <div className="absolute top-4 right-12 flex items-center gap-1">
              {deal.ai_opportunity_score >= 85 && <span className="text-yellow-300">⭐</span>}
              <span className={cn(
                'text-sm font-bold px-2 py-1 rounded',
                deal.ai_opportunity_score >= 85 ? 'bg-yellow-400 text-yellow-900' :
                deal.ai_opportunity_score >= 70 ? 'bg-blue-400 text-blue-900' :
                'bg-white text-gray-700'
              )}>
                {deal.ai_opportunity_score}
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Stage & Days */}
          <div className="flex items-center justify-between">
            <span className={cn(
              'px-3 py-1 rounded-full text-sm font-medium',
              stageInfo.color,
              stageInfo.bgColor
            )}>
              {stageInfo.label}
            </span>
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <ClockIcon className="w-4 h-4" />
              <span>{deal.days_in_stage} days</span>
              {deal.days_in_stage > 30 && (
                <span className="ml-1 text-orange-600 font-medium">⚠️ Stalled</span>
              )}
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Ask Price */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-600 text-xs mb-1">
                <CurrencyDollarIcon className="w-4 h-4" />
                <span>Ask Price</span>
              </div>
              <div className="font-bold text-gray-900 text-lg">
                {formatCurrency(deal.ask_price)}
              </div>
            </div>

            {/* Units */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-600 text-xs mb-1">
                <BuildingOfficeIcon className="w-4 h-4" />
                <span>Units</span>
              </div>
              <div className="font-bold text-gray-900 text-lg">
                {deal.unit_count || 0}
              </div>
            </div>

            {/* IRR (Broker) */}
            {deal.broker_projected_irr && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-gray-600 text-xs mb-1">
                  <ChartBarIcon className="w-4 h-4" />
                  <span>IRR (Broker)</span>
                </div>
                <div className="font-bold text-gray-900 text-lg">
                  {formatPercent(deal.broker_projected_irr)}
                </div>
              </div>
            )}

            {/* IRR (JEDI) */}
            {deal.jedi_adjusted_irr && (
              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                <div className="flex items-center gap-2 text-green-700 text-xs mb-1">
                  <ChartBarIcon className="w-4 h-4" />
                  <span>IRR (JEDI)</span>
                </div>
                <div className="font-bold text-green-700 text-lg">
                  {formatPercent(deal.jedi_adjusted_irr)}
                </div>
                {deal.broker_projected_irr && deal.jedi_adjusted_irr > deal.broker_projected_irr && (
                  <div className="text-xs text-green-600 mt-1">
                    +{(deal.jedi_adjusted_irr - deal.broker_projected_irr).toFixed(1)}% better
                  </div>
                )}
              </div>
            )}
          </div>

          {/* JEDI Adjusted Price */}
          {deal.jedi_adjusted_price && deal.jedi_adjusted_price < deal.ask_price && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="text-xs text-green-700 font-medium mb-1">JEDI Adjusted Price</div>
              <div className="flex items-baseline justify-between">
                <span className="font-bold text-green-700 text-lg">
                  {formatCurrency(deal.jedi_adjusted_price)}
                </span>
                <span className="text-sm text-green-600 font-medium">
                  💰 {formatCurrency(deal.ask_price - deal.jedi_adjusted_price)} gap
                </span>
              </div>
            </div>
          )}

          {/* Strategy */}
          {deal.best_strategy && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Strategy:</span>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'px-2 py-1 rounded text-xs font-medium',
                  deal.best_strategy === 'build_to_sell' || deal.best_strategy === 'Build-to-Sell' 
                    ? 'bg-green-100 text-green-700'
                    : deal.best_strategy === 'flip' || deal.best_strategy === 'Flip'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-purple-100 text-purple-700'
                )}>
                  {deal.best_strategy.replace('_', ' ')}
                </span>
                {deal.strategy_confidence && (
                  <span className="text-gray-500">{deal.strategy_confidence}%</span>
                )}
              </div>
            </div>
          )}

          {/* Supply Risk Warning */}
          {deal.supply_risk_flag && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-2">
              <span className="text-orange-600 text-lg">⚠️</span>
              <div className="flex-1">
                <div className="text-sm font-medium text-orange-800">Supply Risk</div>
                <div className="text-xs text-orange-700 mt-1">
                  Market imbalance score: {deal.imbalance_score || 'N/A'}
                </div>
              </div>
            </div>
          )}

          {/* Additional Info */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm border-t pt-3">
            {deal.asset_type && (
              <div>
                <span className="text-gray-600">Type:</span>
                <span className="ml-2 text-gray-900 font-medium">{deal.asset_type}</span>
              </div>
            )}
            {deal.source && (
              <div>
                <span className="text-gray-600">Source:</span>
                <span className="ml-2 text-gray-900 font-medium">{deal.source}</span>
              </div>
            )}
            {deal.noi && (
              <div>
                <span className="text-gray-600">NOI:</span>
                <span className="ml-2 text-gray-900 font-medium">{formatCurrency(deal.noi)}</span>
              </div>
            )}
            {deal.loi_deadline && (
              <div>
                <span className="text-gray-600">LOI Due:</span>
                <span className="ml-2 text-gray-900 font-medium">
                  {new Date(deal.loi_deadline).toLocaleDateString()}
                </span>
              </div>
            )}
            {deal.dd_checklist_pct !== null && deal.dd_checklist_pct !== undefined && (
              <div className="col-span-2">
                <span className="text-gray-600">Due Diligence:</span>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className={cn(
                        'h-2 rounded-full transition-all',
                        deal.dd_checklist_pct >= 80 ? 'bg-green-500' :
                        deal.dd_checklist_pct >= 50 ? 'bg-yellow-500' :
                        'bg-blue-500'
                      )}
                      style={{ width: `${Math.min(100, deal.dd_checklist_pct)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 font-medium w-10 text-right">
                    {deal.dd_checklist_pct}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleViewDetails}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
          >
            <span>View Full Details</span>
            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
