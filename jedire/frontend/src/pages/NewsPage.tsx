import React, { useState } from 'react';

type ViewType = 'feed' | 'dashboard' | 'network' | 'alerts';

export function NewsPage() {
  const [activeView, setActiveView] = useState<ViewType>('feed');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { id: 'all', label: 'All Events', icon: '📋' },
    { id: 'employment', label: 'Employment', icon: '👥' },
    { id: 'development', label: 'Development', icon: '🏗️' },
    { id: 'transactions', label: 'Transactions', icon: '💰' },
    { id: 'government', label: 'Government', icon: '🏛️' },
    { id: 'amenities', label: 'Amenities', icon: '🏪' },
  ];

  const mockEvents = [
    {
      id: 1,
      category: 'employment',
      type: 'company_relocation_inbound',
      headline: 'Microsoft relocating 3,200 employees to Midtown Atlanta',
      source: 'Atlanta Business Chronicle',
      sourceType: 'public',
      date: '2 hours ago',
      location: 'Midtown Atlanta, GA',
      impact: {
        housingDemand: 2100,
        targetRent: [1800, 3200],
        severity: 'high',
      },
      affectedDeals: 2,
      confidence: 0.92,
    },
    {
      id: 2,
      category: 'development',
      type: 'multifamily_permit_approval',
      headline: '400-unit luxury apartment project approved in Buckhead',
      source: 'Email: John Smith (CBRE)',
      sourceType: 'email',
      date: '4 hours ago',
      location: 'Buckhead, Atlanta, GA',
      impact: {
        supplyPressure: 0.08,
        severity: 'moderate',
      },
      affectedDeals: 1,
      confidence: 0.78,
      earlySignalDays: 14,
    },
    {
      id: 3,
      category: 'transactions',
      type: 'property_sale',
      headline: 'Summit Ridge Apartments sells for $68M ($272K/unit)',
      source: 'Real Capital Analytics',
      sourceType: 'public',
      date: '1 day ago',
      location: 'Peachtree Corners, GA',
      impact: {
        compDeviation: 0.12,
        severity: 'medium',
      },
      affectedDeals: 3,
      confidence: 0.95,
    },
  ];

  const renderEventFeed = () => (
    <div className="space-y-4">
      {/* Category Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              selectedCategory === cat.id
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <span className="mr-2">{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Events List */}
      <div className="space-y-3">
        {mockEvents.map((event) => (
          <div
            key={event.id}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">
                  {event.headline}
                </h3>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    📍 {event.location}
                  </span>
                  <span>•</span>
                  <span>{event.date}</span>
                  {event.earlySignalDays && (
                    <>
                      <span>•</span>
                      <span className="text-green-600 font-medium">
                        {event.earlySignalDays} days early
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                {event.sourceType === 'email' && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                    🔵 Email Intel
                  </span>
                )}
                <span
                  className={`px-2 py-1 text-xs font-medium rounded ${
                    event.impact.severity === 'high'
                      ? 'bg-red-100 text-red-700'
                      : event.impact.severity === 'moderate'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {event.impact.severity === 'high'
                    ? '⚠️ High Impact'
                    : event.impact.severity === 'moderate'
                    ? '⚡ Moderate Impact'
                    : 'ℹ️ Low Impact'}
                </span>
              </div>
            </div>

            {/* Impact Summary */}
            <div className="bg-gray-50 rounded p-3 mb-2">
              {event.impact.housingDemand && (
                <div className="text-sm text-gray-700">
                  <strong>Demand Impact:</strong> ~
                  {event.impact.housingDemand.toLocaleString()} housing units
                  needed • Target rent: $
                  {event.impact.targetRent[0].toLocaleString()}–$
                  {event.impact.targetRent[1].toLocaleString()}/mo
                </div>
              )}
              {event.impact.supplyPressure && (
                <div className="text-sm text-gray-700">
                  <strong>Supply Impact:</strong>{' '}
                  {(event.impact.supplyPressure * 100).toFixed(1)}% supply
                  pressure increase • Watch concessions in Class A
                </div>
              )}
              {event.impact.compDeviation && (
                <div className="text-sm text-gray-700">
                  <strong>Comp Impact:</strong>{' '}
                  {(event.impact.compDeviation * 100).toFixed(0)}% above market
                  average • May influence valuations
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-sm">
              <div className="text-gray-600">
                Source: <span className="font-medium">{event.source}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-500">
                  Confidence: {(event.confidence * 100).toFixed(0)}%
                </span>
                {event.affectedDeals > 0 && (
                  <span className="text-blue-600 font-medium">
                    {event.affectedDeals}{' '}
                    {event.affectedDeals === 1 ? 'deal' : 'deals'} affected
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderMarketDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {/* Demand Momentum */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Demand Momentum</h3>
          <div className="text-4xl font-bold text-green-600 mb-2">+3.2%</div>
          <div className="text-sm text-gray-600 mb-4">Strong growth</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Inbound jobs</span>
              <span className="font-medium text-green-600">+4,200</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Outbound jobs</span>
              <span className="font-medium text-red-600">-800</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Layoffs</span>
              <span className="font-medium text-red-600">-200</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-semibold">
              <span>Net Impact</span>
              <span className="text-green-600">+3,200 jobs</span>
            </div>
          </div>
        </div>

        {/* Supply Pressure */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Supply Pressure</h3>
          <div className="text-4xl font-bold text-yellow-600 mb-2">8.5%</div>
          <div className="text-sm text-gray-600 mb-4">Moderate pressure</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Pipeline units</span>
              <span className="font-medium">1,800</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Existing inventory</span>
              <span className="font-medium">21,200</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Delivering in</span>
              <span className="font-medium">18 months</span>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Activity */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Transaction Activity</h3>
        <div className="text-center py-8 text-gray-500">
          Chart placeholder: Volume, avg cap rate, price/unit over time
        </div>
      </div>
    </div>
  );

  const renderNetworkIntelligence = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Contact Credibility</h3>
        <div className="space-y-3">
          {[
            {
              name: 'John Smith',
              company: 'CBRE',
              credibility: 0.88,
              signals: 13,
              corroborated: 12,
            },
            {
              name: 'Sarah Johnson',
              company: 'JLL',
              credibility: 0.75,
              signals: 8,
              corroborated: 6,
            },
            {
              name: 'Mike Davis',
              company: 'Colliers',
              credibility: 0.82,
              signals: 11,
              corroborated: 9,
            },
          ].map((contact, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 bg-gray-50 rounded"
            >
              <div>
                <div className="font-medium">
                  {contact.name} • {contact.company}
                </div>
                <div className="text-sm text-gray-600">
                  {contact.corroborated}/{contact.signals} signals
                  corroborated
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-green-600">
                  {(contact.credibility * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-gray-500">
                  {contact.credibility >= 0.85
                    ? '⭐ Highly Reliable'
                    : '✅ Reliable'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Early Signal Performance</h3>
        <div className="text-center">
          <div className="text-4xl font-bold text-blue-600 mb-2">
            18 days
          </div>
          <div className="text-sm text-gray-600">
            Average advance notice from your network
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex">
      {/* Left Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
        <div className="p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">VIEWS</h2>

          <div className="space-y-1">
            <button
              onClick={() => setActiveView('feed')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left ${
                activeView === 'feed'
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>📋</span>
              <span>Event Feed</span>
            </button>

            <button
              onClick={() => setActiveView('dashboard')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left ${
                activeView === 'dashboard'
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>📊</span>
              <span>Market Dashboard</span>
            </button>

            <button
              onClick={() => setActiveView('network')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left ${
                activeView === 'network'
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>🔗</span>
              <span>Network Intelligence</span>
            </button>

            <button
              onClick={() => setActiveView('alerts')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left ${
                activeView === 'alerts'
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>🔔</span>
              <span>Alerts</span>
              <span className="ml-auto px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-600 rounded-full">
                3
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            {activeView === 'feed' && '📋 Event Feed'}
            {activeView === 'dashboard' && '📊 Market Dashboard'}
            {activeView === 'network' && '🔗 Network Intelligence'}
            {activeView === 'alerts' && '🔔 Alerts'}
          </h1>

          {activeView === 'feed' && renderEventFeed()}
          {activeView === 'dashboard' && renderMarketDashboard()}
          {activeView === 'network' && renderNetworkIntelligence()}
          {activeView === 'alerts' && (
            <div className="text-center py-12 text-gray-500">
              Alerts view coming soon
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
