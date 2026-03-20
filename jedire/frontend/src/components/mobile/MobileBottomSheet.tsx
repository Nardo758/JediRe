import { useState } from 'react';
import { ChevronUp, ChevronDown, X, DollarSign, TrendingUp, MapPin } from 'lucide-react';

interface Property {
  id: string;
  address: string;
  city?: string;
  price: number;
  strategy: string;
  roi: number;
  score: number;
}

interface MobileBottomSheetProps {
  property: Property | null;
  onClose: () => void;
  onViewDetails: () => void;
}

export default function MobileBottomSheet({ property, onClose, onViewDetails }: MobileBottomSheetProps) {
  const [expanded, setExpanded] = useState(false);

  if (!property) return null;

  const formatPrice = (price: number) => {
    return `$${(price / 1000).toFixed(0)}K`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 80) return 'bg-blue-500';
    if (score >= 70) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  return (
    <div
      className={`fixed left-0 right-0 bg-white rounded-t-2xl shadow-2xl transition-all duration-300 z-40 ${
        expanded ? 'bottom-16 h-[60vh]' : 'bottom-16 h-32'
      }`}
    >
      <div
        className="flex justify-center py-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-12 h-1 bg-gray-300 rounded-full" />
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 text-gray-500" />
              <h3 className="font-bold text-gray-900">{property.address}</h3>
              <div className={`px-2 py-0.5 ${getScoreColor(property.score)} text-white text-xs font-bold rounded-full`}>
                {property.score}
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                {formatPrice(property.price)}
              </span>
              <span>|</span>
              <span>{property.strategy}</span>
              <span>|</span>
              <span className="flex items-center gap-1 text-green-600">
                <TrendingUp className="w-4 h-4" />
                ROI: {property.roi}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <button
          onClick={onViewDetails}
          className="mt-3 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
        >
          View Details →
        </button>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Strategy Comparison</h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { name: 'Flip', roi: 24, color: 'bg-green-100 text-green-700' },
                  { name: 'Rental', roi: 18, color: 'bg-blue-100 text-blue-700' },
                  { name: 'Build', roi: 32, color: 'bg-purple-100 text-purple-700' },
                  { name: 'Airbnb', roi: 28, color: 'bg-orange-100 text-orange-700' },
                ].map((strat) => (
                  <div key={strat.name} className={`p-3 rounded-lg ${strat.color}`}>
                    <div className="text-xs font-medium opacity-70">{strat.name}</div>
                    <div className="text-lg font-bold">{strat.roi}% ROI</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Agent Insights</h4>
              <div className="space-y-2">
                {[
                  { agent: 'Supply', insight: 'Low inventory in area', confidence: 92 },
                  { agent: 'Demand', insight: 'High buyer interest', confidence: 88 },
                ].map((item) => (
                  <div key={item.agent} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{item.agent}</div>
                      <div className="text-xs text-gray-500">{item.insight}</div>
                    </div>
                    <div className="text-sm font-bold text-blue-600">{item.confidence}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
