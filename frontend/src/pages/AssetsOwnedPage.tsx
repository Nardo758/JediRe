import React, { useState } from 'react';

interface Property {
  id: string;
  name: string;
  address: string;
  class: string;
  units: number;
  occupancy: number;
  avgRent: number;
  noi: number;
  noiTarget: number;
  leaseExpirations: number;
  renewalRate: number;
}

export function AssetsOwnedPage() {
  const [viewMode, setViewMode] = useState<'map' | 'grid'>('grid');

  const properties: Property[] = [
    {
      id: '1',
      name: 'Midtown Towers',
      address: '123 Peachtree St, Atlanta, GA',
      class: 'A+',
      units: 250,
      occupancy: 94,
      avgRent: 2100,
      noi: 4200000,
      noiTarget: 4000000,
      leaseExpirations: 12,
      renewalRate: 68
    },
    {
      id: '2',
      name: 'Buckhead Plaza',
      address: '456 Pharr Rd, Atlanta, GA',
      class: 'A',
      units: 180,
      occupancy: 91,
      avgRent: 1950,
      noi: 3100000,
      noiTarget: 3200000,
      leaseExpirations: 8,
      renewalRate: 72
    },
    {
      id: '3',
      name: 'Virginia Highlands Lofts',
      address: '789 N Highland Ave, Atlanta, GA',
      class: 'B+',
      units: 120,
      occupancy: 88,
      avgRent: 1600,
      noi: 1800000,
      noiTarget: 1900000,
      leaseExpirations: 15,
      renewalRate: 65
    }
  ];

  const portfolioTotals = {
    totalUnits: properties.reduce((sum, p) => sum + p.units, 0),
    avgOccupancy: Math.round(
      properties.reduce((sum, p) => sum + p.occupancy, 0) / properties.length
    ),
    totalNOI: properties.reduce((sum, p) => sum + p.noi, 0),
    avgRenewalRate: Math.round(
      properties.reduce((sum, p) => sum + p.renewalRate, 0) / properties.length
    )
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    return `$${(value / 1000).toFixed(0)}K`;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              🏢 Assets Owned
            </h1>
            <p className="text-gray-600">
              Your portfolio management + intelligence contribution layer
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('map')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'map'
                    ? 'bg-white text-gray-900 shadow'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🗺️ Map View
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white text-gray-900 shadow'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                📊 Grid View
              </button>
            </div>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
              + Add Property
            </button>
          </div>
        </div>
      </div>

      {/* Portfolio KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Total Units</div>
          <div className="text-3xl font-bold text-gray-900">
            {portfolioTotals.totalUnits.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {properties.length} properties
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Avg Occupancy</div>
          <div className="text-3xl font-bold text-green-600">
            {portfolioTotals.avgOccupancy}%
          </div>
          <div className="text-sm text-gray-500 mt-1">vs 89% market avg</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Total NOI</div>
          <div className="text-3xl font-bold text-blue-600">
            {formatCurrency(portfolioTotals.totalNOI)}
          </div>
          <div className="text-sm text-green-600 mt-1">+5.2% vs budget</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Avg Renewal Rate</div>
          <div className="text-3xl font-bold text-yellow-600">
            {portfolioTotals.avgRenewalRate}%
          </div>
          <div className="text-sm text-gray-500 mt-1">vs 72% market avg</div>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Portfolio Properties</h2>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  id="assets-search"
                  name="assetsSearch"
                  placeholder="Search properties..."
                  aria-label="Search properties"
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select id="assets-building-class" name="assetsBuildingClass" aria-label="Filter by building class" className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>All Classes</option>
                  <option>Class A+</option>
                  <option>Class A</option>
                  <option>Class B+</option>
                  <option>Class B</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Property
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Class
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Units
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Occupancy
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Rent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    NOI
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lease Intel
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {properties.map((property) => (
                  <tr key={property.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {property.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {property.address}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                        {property.class}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {property.units}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span
                          className={`text-sm font-medium ${
                            property.occupancy >= 90
                              ? 'text-green-600'
                              : property.occupancy >= 85
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }`}
                        >
                          {property.occupancy}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${property.avgRent.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(property.noi)}
                        </div>
                        <div
                          className={`text-xs ${
                            property.noi >= property.noiTarget
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {property.noi >= property.noiTarget ? '+' : ''}
                          {(
                            ((property.noi - property.noiTarget) /
                              property.noiTarget) *
                            100
                          ).toFixed(1)}
                          % vs budget
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="text-gray-900">
                          {property.leaseExpirations} exp. next 60d
                        </div>
                        <div
                          className={`text-xs ${
                            property.renewalRate >= 70
                              ? 'text-green-600'
                              : 'text-yellow-600'
                          }`}
                        >
                          {property.renewalRate}% renewal rate
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-blue-600 hover:text-blue-900">
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Map View Placeholder */}
      {viewMode === 'map' && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="text-6xl mb-4">🗺️</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Map View Coming Soon
          </h3>
          <p className="text-gray-600 mb-6">
            Properties will appear as markers on the central map canvas
          </p>
          <button
            onClick={() => setViewMode('grid')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Switch to Grid View
          </button>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <h3 className="font-semibold text-green-900 mb-1">
              How Assets Owned Layer Works
            </h3>
            <p className="text-sm text-green-800">
              Your portfolio data feeds into modules (Strategy Arbitrage uses your actual
              expense ratios, Comp Analysis includes your properties as comps). Your
              anonymized data also enriches the Market Data Layer, creating a network
              effect - more users = better intelligence for everyone.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
