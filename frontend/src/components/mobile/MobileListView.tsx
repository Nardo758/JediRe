import { useState } from 'react';
import { MapPin, ChevronRight } from 'lucide-react';

interface Property {
  id: string;
  address: string;
  city: string;
  price: number;
  strategy: string;
  roi: number;
  score: number;
}

interface MobileListViewProps {
  onPropertySelect: (property: Property) => void;
}

const mockProperties: Property[] = [
  { id: '1', address: '456 Oak St', city: 'Atlanta, GA', price: 285000, strategy: 'Flip', roi: 24, score: 92 },
  { id: '2', address: '123 Main St', city: 'Phoenix, AZ', price: 320000, strategy: 'Rental', roi: 42, score: 88 },
  { id: '3', address: '789 Pine Ave', city: 'Dallas, TX', price: 195000, strategy: 'Build', roi: 28, score: 85 },
  { id: '4', address: '321 Elm Blvd', city: 'Austin, TX', price: 415000, strategy: 'Airbnb', roi: 35, score: 82 },
  { id: '5', address: '555 Cedar Ln', city: 'Denver, CO', price: 275000, strategy: 'Flip', roi: 22, score: 79 },
];

export default function MobileListView({ onPropertySelect }: MobileListViewProps) {
  const [filter, setFilter] = useState('all');

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'saved', label: 'Saved' },
    { id: 'arbitrage', label: 'Arbitrage' },
    { id: 'recent', label: 'Recent' },
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
        {mockProperties.map((property) => (
          <button
            key={property.id}
            onClick={() => onPropertySelect(property)}
            className="w-full p-4 flex items-start gap-3 hover:bg-gray-50 text-left"
          >
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-medium text-gray-900 truncate">{property.address}</h3>
                <div className={`px-2 py-0.5 ${getScoreColor(property.score)} text-white text-xs font-bold rounded-full`}>
                  {property.score}
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-1">{property.city}</p>
              <p className="text-sm text-gray-700">
                {formatPrice(property.price)} | {property.strategy} | ROI: {property.roi}%
              </p>
            </div>

            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-2" />
          </button>
        ))}
      </div>

      <div className="p-4 text-center">
        <p className="text-sm text-gray-500 mb-3">Showing {mockProperties.length} properties</p>
        <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
          Load More
        </button>
      </div>
    </div>
  );
}
