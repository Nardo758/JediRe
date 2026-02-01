import { useState } from 'react';
import { Search, SlidersHorizontal, Bookmark, Eye, Star, ChevronDown } from 'lucide-react';

interface Property {
  id: string;
  address: string;
  city: string;
  zip: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number | string;
  strategy: string;
  roi: number;
  score: number;
  timeline?: string;
  noi?: number;
  arbitrage?: { percent: number; vs: string };
  image: string;
  isLand?: boolean;
  acres?: number;
}

interface MobileListViewProps {
  onPropertySelect: (property: Property) => void;
}

const mockProperties: Property[] = [
  { 
    id: '1', 
    address: '456 Oak Street', 
    city: 'Atlanta', 
    zip: 'GA 30308',
    price: 285000, 
    beds: 3, 
    baths: 2, 
    sqft: 1850,
    strategy: 'Flip', 
    roi: 24, 
    score: 92,
    timeline: '6mo',
    arbitrage: { percent: 18, vs: 'rental' },
    image: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400&h=300&fit=crop'
  },
  { 
    id: '2', 
    address: '123 Main Street', 
    city: 'Phoenix', 
    zip: 'AZ 85001',
    price: 320000, 
    beds: 4, 
    baths: 2, 
    sqft: 2100,
    strategy: 'Rental', 
    roi: 42, 
    score: 88,
    noi: 1050,
    image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&h=300&fit=crop'
  },
  { 
    id: '3', 
    address: '789 Pine Avenue', 
    city: 'Dallas', 
    zip: 'TX 75201',
    price: 195000, 
    beds: 0, 
    baths: 0, 
    sqft: '0.5 acres',
    strategy: 'Build-to-Sell', 
    roi: 28, 
    score: 85,
    timeline: '18mo',
    isLand: true,
    acres: 0.5,
    image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&h=300&fit=crop'
  },
  { 
    id: '4', 
    address: '321 Elm Boulevard', 
    city: 'Austin', 
    zip: 'TX 78701',
    price: 415000, 
    beds: 5, 
    baths: 3, 
    sqft: 2800,
    strategy: 'Airbnb', 
    roi: 35, 
    score: 82,
    noi: 2200,
    image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=300&fit=crop'
  },
  { 
    id: '5', 
    address: '555 Cedar Lane', 
    city: 'Denver', 
    zip: 'CO 80202',
    price: 275000, 
    beds: 3, 
    baths: 2, 
    sqft: 1650,
    strategy: 'Flip', 
    roi: 22, 
    score: 79,
    timeline: '4mo',
    arbitrage: { percent: 12, vs: 'rental' },
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=300&fit=crop'
  },
];

export default function MobileListView({ onPropertySelect }: MobileListViewProps) {
  const [filter, setFilter] = useState('all');
  const [showingCount] = useState(12);
  const [totalCount] = useState(247);

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

  const getStrategyColor = (strategy: string) => {
    switch (strategy) {
      case 'Flip': return 'text-green-600';
      case 'Rental': return 'text-blue-600';
      case 'Build-to-Sell': return 'text-purple-600';
      case 'Airbnb': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatSqft = (sqft: number | string) => {
    if (typeof sqft === 'string') return sqft;
    return `${sqft.toLocaleString()}sf`;
  };

  return (
    <div className="pt-14 pb-20 bg-gray-50">
      <div className="sticky top-14 bg-white border-b border-gray-200 z-30">
        <div className="px-4 py-3 flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search properties..."
              className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg">
            <SlidersHorizontal className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
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

      <div className="p-4 space-y-4">
        {mockProperties.map((property) => (
          <div
            key={property.id}
            className="bg-white rounded-xl shadow-sm overflow-hidden"
          >
            <div className="relative">
              <img
                src={property.image}
                alt={property.address}
                className="w-full h-40 object-cover"
              />
              <div className={`absolute top-3 right-3 px-2.5 py-1 ${getScoreColor(property.score)} text-white text-sm font-bold rounded-full shadow-lg`}>
                {property.score}
              </div>
            </div>

            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{property.address}</h3>
                  <p className="text-sm text-gray-500">{property.city}, {property.zip}</p>
                </div>
              </div>

              <div className="text-sm text-gray-600 mb-3">
                {property.isLand ? (
                  <span>{formatPrice(property.price)} | Land | {property.acres} acres</span>
                ) : (
                  <span>{formatPrice(property.price)} | {property.beds}bd {property.baths}ba | {formatSqft(property.sqft)}</span>
                )}
              </div>

              <div className="mb-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Strategy:</span>
                  <span className={`font-medium ${getStrategyColor(property.strategy)}`}>{property.strategy}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>ROI: <span className="font-medium text-green-600">{property.roi}%</span></span>
                  {property.timeline && (
                    <>
                      <span>|</span>
                      <span>Timeline: {property.timeline}</span>
                    </>
                  )}
                  {property.noi && (
                    <>
                      <span>|</span>
                      <span>NOI: ${property.noi.toLocaleString()}/mo</span>
                    </>
                  )}
                </div>
              </div>

              {property.arbitrage && (
                <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <Star className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm text-yellow-800">
                    Arbitrage: <span className="font-medium">{property.arbitrage.percent}%</span> vs {property.arbitrage.vs}
                  </span>
                </div>
              )}

              <div className="flex gap-2">
                <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700">
                  <Bookmark className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={() => onPropertySelect(property)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium text-white"
                >
                  <Eye className="w-4 h-4" />
                  View Details
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 text-center">
        <button className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium text-gray-700">
          Load More
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      <div className="pb-4 text-center text-sm text-gray-500">
        Showing {showingCount} of {totalCount} properties
      </div>
    </div>
  );
}
