import { Deal, DealType } from '@/types';
import { Home, User, DollarSign, Calendar, Flag, TrendingUp, TrendingDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface DealCardProps {
  deal: Deal;
  onClick: (deal: Deal) => void;
  isDragging?: boolean;
}

const dealTypeConfig: Record<DealType, { label: string; color: string; icon: typeof Home }> = {
  buyer: { label: 'Buyer', color: 'bg-blue-100 text-blue-700', icon: Home },
  seller: { label: 'Seller', color: 'bg-green-100 text-green-700', icon: TrendingUp },
  both: { label: 'Both', color: 'bg-purple-100 text-purple-700', icon: TrendingDown },
};

const priorityConfig = {
  low: { color: 'bg-gray-100 text-gray-600', label: 'Low' },
  medium: { color: 'bg-yellow-100 text-yellow-700', label: 'Medium' },
  high: { color: 'bg-red-100 text-red-700', label: 'High' },
};

export default function DealCard({ deal, onClick, isDragging }: DealCardProps) {
  const typeConfig = dealTypeConfig[deal.dealType];
  const TypeIcon = typeConfig.icon;
  const priorityStyle = priorityConfig[deal.priority];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div
      onClick={() => onClick(deal)}
      className={`
        bg-white rounded-lg border border-gray-200 p-4 cursor-pointer
        transition-all duration-200 hover:shadow-md hover:border-blue-300
        ${isDragging ? 'opacity-50 rotate-2 scale-105' : ''}
      `}
    >
      {/* Priority Indicator */}
      {deal.priority !== 'low' && (
        <div className="flex items-center gap-1 mb-2">
          <Flag className={`w-3 h-3 ${priorityStyle.color.split(' ')[1]}`} />
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${priorityStyle.color}`}>
            {priorityStyle.label}
          </span>
        </div>
      )}

      {/* Property Address */}
      <h3 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2">
        {deal.propertyAddress}
      </h3>

      {/* Deal Type Badge */}
      <div className="flex items-center gap-1 mb-3">
        <TypeIcon className="w-3 h-3" />
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${typeConfig.color}`}>
          {typeConfig.label} Side
        </span>
      </div>

      {/* Deal Value & Commission */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            Deal Value
          </span>
          <span className="font-bold text-gray-900">
            {formatCurrency(deal.dealValue)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Commission</span>
          <span className="font-semibold text-green-600">
            {formatCurrency(deal.commissionEstimate)}
          </span>
        </div>
      </div>

      {/* Client Name */}
      <div className="flex items-center gap-2 text-xs text-gray-600 mb-2 pb-2 border-b border-gray-100">
        <User className="w-3 h-3" />
        <span className="font-medium text-blue-600 hover:underline">
          {deal.clientName}
        </span>
      </div>

      {/* Days in Stage & Expected Close */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          <span>
            {deal.daysInStage} {deal.daysInStage === 1 ? 'day' : 'days'} in stage
          </span>
        </div>
        {deal.expectedCloseDate && (
          <span className="text-gray-400">
            Close: {formatDistanceToNow(new Date(deal.expectedCloseDate), { addSuffix: true })}
          </span>
        )}
      </div>
    </div>
  );
}
