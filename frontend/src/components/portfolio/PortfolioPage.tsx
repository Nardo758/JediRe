import { useState } from 'react';
import { Plus, TrendingUp, Building2, BarChart3, DollarSign, ChevronRight, Pin, TrendingDown, Lightbulb, Star, Home, Calendar, User } from 'lucide-react';

interface Investment {
  id: string;
  address: string;
  city: string;
  state: string;
  score: number;
  status: 'renovation' | 'rented' | 'listed' | 'sold';
  daysHolding: number;
  purchasePrice: number;
  currentValue: number;
  strategy: string;
  projectedRoi?: number;
  monthlyNoi?: number;
  renovationProgress?: number;
  renovationBudget?: { spent: number; total: number };
  timeline?: string;
  tenant?: { name: string; leaseExpires: string };
  occupancy?: number;
  optimization?: string;
  image: string;
}

interface WatchingProperty {
  id: string;
  address: string;
  city: string;
  score: number;
  price: number;
  update?: { type: 'price_drop' | 'zoning' | 'arbitrage' | 'none'; message: string };
}

const mockInvestments: Investment[] = [
  {
    id: '1',
    address: '456 Oak Street',
    city: 'Atlanta',
    state: 'GA',
    score: 92,
    status: 'renovation',
    daysHolding: 45,
    purchasePrice: 285000,
    currentValue: 295000,
    strategy: 'Flip',
    projectedRoi: 24,
    renovationProgress: 80,
    renovationBudget: { spent: 38000, total: 45000 },
    timeline: 'On track',
    optimization: '+$127/mo identified',
    image: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=200&h=150&fit=crop'
  },
  {
    id: '2',
    address: '123 Main Street',
    city: 'Phoenix',
    state: 'AZ',
    score: 88,
    status: 'rented',
    daysHolding: 180,
    purchasePrice: 320000,
    currentValue: 335000,
    strategy: 'Rental',
    monthlyNoi: 1050,
    tenant: { name: 'Sarah Johnson', leaseExpires: 'Dec 2026' },
    occupancy: 100,
    optimization: '+$150/mo possible rent increase',
    image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=200&h=150&fit=crop'
  }
];

const mockWatching: WatchingProperty[] = [
  { id: '1', address: '789 Elm St', city: 'Dallas', score: 90, price: 238000, update: { type: 'price_drop', message: 'Price drop: $245K → $238K (2 days ago)' } },
  { id: '2', address: '234 Oak Ave', city: 'Nashville', score: 87, price: 310000, update: { type: 'zoning', message: 'Zoning analysis completed' } },
  { id: '3', address: '567 Pine Rd', city: 'Atlanta', score: 85, price: 195000, update: { type: 'arbitrage', message: 'Airbnb vs Rental = 21% spread' } },
  { id: '4', address: '890 Maple Dr', city: 'Phoenix', score: 83, price: 280000, update: { type: 'none', message: 'No updates' } },
];

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState('all');

  const tabs = [
    { id: 'all', label: 'All (12)' },
    { id: 'active', label: 'Active (8)' },
    { id: 'watching', label: 'Watching (4)' },
    { id: 'sold', label: 'Sold (15)' },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 80) return 'bg-blue-500';
    return 'bg-yellow-500';
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    return `$${(value / 1000).toFixed(0)}K`;
  };

  const getUpdateIcon = (type: string) => {
    switch (type) {
      case 'price_drop': return <TrendingDown className="w-4 h-4 text-green-600" />;
      case 'zoning': return <Building2 className="w-4 h-4 text-green-600" />;
      case 'arbitrage': return <Star className="w-4 h-4 text-yellow-600" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">My Portfolio</h1>
          <button className="flex items-center gap-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" />
            Add Property
          </button>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Value', value: '$3.2M', icon: DollarSign },
            { label: 'Properties', value: '12', icon: Home },
            { label: 'Avg Score', value: '86', icon: BarChart3 },
            { label: 'Total ROI', value: '32%', icon: TrendingUp },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/10 rounded-xl p-3 text-center">
              <stat.icon className="w-5 h-5 mx-auto mb-1 opacity-80" />
              <div className="text-lg font-bold">{stat.value}</div>
              <div className="text-xs opacity-70">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-2 z-30">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {(activeTab === 'all' || activeTab === 'active') && (
        <div className="p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Active Investments</h2>
          <div className="space-y-4">
            {mockInvestments.map((investment) => (
              <div key={investment.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="flex p-4 gap-3">
                  <img
                    src={investment.image}
                    alt={investment.address}
                    className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{investment.address}</h3>
                        <p className="text-sm text-gray-500">{investment.city}, {investment.state}</p>
                      </div>
                      <div className={`px-2 py-0.5 ${getScoreColor(investment.score)} text-white text-xs font-bold rounded-full`}>
                        {investment.score}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span className="capitalize">Status: {investment.status === 'renovation' ? 'In Renovation' : investment.status}</span>
                      <span>•</span>
                      <span>Days Holding: {investment.daysHolding}</span>
                    </div>
                  </div>
                </div>

                <div className="px-4 pb-4 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Purchase: {formatCurrency(investment.purchasePrice)}</span>
                    <span>Current: {formatCurrency(investment.currentValue)}</span>
                  </div>
                  <div className="text-gray-700">
                    Strategy: <span className="font-medium">{investment.strategy}</span>
                    {investment.projectedRoi && <span> | Projected ROI: <span className="text-green-600 font-medium">{investment.projectedRoi}%</span></span>}
                    {investment.monthlyNoi && <span> | Monthly NOI: <span className="font-medium">${investment.monthlyNoi.toLocaleString()}</span></span>}
                  </div>

                  {investment.renovationProgress !== undefined && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Renovation Progress</span>
                        <span>{investment.renovationProgress}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${investment.renovationProgress}%` }}
                        />
                      </div>
                      {investment.renovationBudget && (
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>Budget: ${(investment.renovationBudget.spent / 1000).toFixed(0)}K / ${(investment.renovationBudget.total / 1000).toFixed(0)}K</span>
                          <span>Timeline: {investment.timeline}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {investment.tenant && (
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        Tenant: {investment.tenant.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Expires: {investment.tenant.leaseExpires}
                      </span>
                      <span>Occupancy: {investment.occupancy}%</span>
                    </div>
                  )}

                  {investment.optimization && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <Lightbulb className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-blue-800">Cash Flow Optimization: {investment.optimization}</span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700">
                      View Details
                    </button>
                    <button className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700">
                      Update Status
                    </button>
                    <button className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700">
                      Add Notes
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(activeTab === 'all' || activeTab === 'watching') && (
        <div className="p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Watching ({mockWatching.length} properties)</h2>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden divide-y divide-gray-100">
            {mockWatching.map((property) => (
              <div key={property.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Pin className="w-4 h-4 text-yellow-600" />
                    <div>
                      <span className="font-medium text-gray-900">{property.address}, {property.city}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 ${getScoreColor(property.score)} text-white text-xs font-bold rounded-full`}>
                      {property.score}
                    </span>
                    <span className="text-sm text-gray-600">{formatCurrency(property.price)}</span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
                {property.update && property.update.type !== 'none' && (
                  <div className="flex items-center gap-2 mt-2 text-sm">
                    {getUpdateIcon(property.update.type)}
                    <span className="text-gray-600">
                      {property.update.message}
                    </span>
                  </div>
                )}
                {property.update?.type === 'none' && (
                  <p className="text-sm text-gray-400 mt-1 ml-6">{property.update.message}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
