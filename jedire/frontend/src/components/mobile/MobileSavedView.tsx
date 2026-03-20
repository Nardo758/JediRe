import { useState } from 'react';
import { Pin, ChevronRight, TrendingDown, Lightbulb } from 'lucide-react';

interface SavedProperty {
  id: string;
  address: string;
  price: number;
  oldPrice?: number;
  strategy: string;
  score: number;
  lastUpdate: string;
  hasUpdate: boolean;
}

const mockSaved: SavedProperty[] = [
  { id: '1', address: '456 Oak St', price: 280000, oldPrice: 285000, strategy: 'Flip', score: 92, lastUpdate: '2h ago', hasUpdate: true },
  { id: '2', address: '123 Main St', price: 320000, strategy: 'Rental', score: 88, lastUpdate: '1d ago', hasUpdate: false },
  { id: '3', address: '789 Pine Ave', price: 195000, strategy: 'Build', score: 85, lastUpdate: '3d ago', hasUpdate: false },
];

export default function MobileSavedView() {
  const [filter, setFilter] = useState('all');

  const filters = [
    { id: 'all', label: 'All (12)' },
    { id: 'watching', label: 'Watching (5)' },
    { id: 'offers', label: 'Offers' },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 80) return 'bg-blue-500';
    if (score >= 70) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  const formatPrice = (price: number) => {
    return `$${(price / 1000).toFixed(0)}K`;
  };

  return (
    <div className="pt-14 pb-20">
      <div className="sticky top-14 bg-white border-b border-gray-200 px-4 py-2 z-30">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === f.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {mockSaved.map((property) => (
          <div key={property.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                <Pin className="w-5 h-5 text-yellow-600" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-medium text-gray-900">{property.address}</h3>
                  <div className={`px-2 py-0.5 ${getScoreColor(property.score)} text-white text-xs font-bold rounded-full`}>
                    {property.score}
                  </div>
                </div>
                
                <p className="text-xs text-gray-500 mb-1">Updated {property.lastUpdate}</p>
                
                {property.oldPrice && property.oldPrice !== property.price ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 line-through">{formatPrice(property.oldPrice)}</span>
                    <span className="text-green-600 font-medium flex items-center gap-1">
                      <TrendingDown className="w-3 h-3" />
                      {formatPrice(property.price)} (Price drop!)
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-700">
                    {formatPrice(property.price)} | {property.strategy}
                  </p>
                )}
              </div>

              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-2" />
            </div>

            <div className="flex gap-2 mt-3 pl-13">
              <button className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium flex items-center gap-1">
                <Pin className="w-3 h-3" /> Remove
              </button>
              <button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-1">
                View <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">You have 2 updates</p>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-1">
              View All Updates
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
