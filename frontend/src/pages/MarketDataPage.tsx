import React from 'react';

interface Submarket {
  id: string;
  name: string;
  location: string;
  rentTrend: string;
  rentTrendValue: number;
  supply: string;
  supplyPercent: number;
  jediScore: number;
  status: 'strong' | 'moderate' | 'weak';
}

export function MarketDataPage() {
  const submarkets: Submarket[] = [
    {
      id: '1',
      name: 'Buckhead',
      location: 'Atlanta, GA',
      rentTrend: '+4.2% YoY',
      rentTrendValue: 4.2,
      supply: '68% of capacity',
      supplyPercent: 68,
      jediScore: 85,
      status: 'strong'
    },
    {
      id: '2',
      name: 'Midtown',
      location: 'Atlanta, GA',
      rentTrend: '+6.1% YoY',
      rentTrendValue: 6.1,
      supply: '92% of capacity',
      supplyPercent: 92,
      jediScore: 72,
      status: 'moderate'
    },
    {
      id: '3',
      name: 'Virginia Highland',
      location: 'Atlanta, GA',
      rentTrend: '+2.8% YoY',
      rentTrendValue: 2.8,
      supply: '81% of capacity',
      supplyPercent: 81,
      jediScore: 68,
      status: 'moderate'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'strong':
        return 'text-green-600 bg-green-50';
      case 'moderate':
        return 'text-yellow-600 bg-yellow-50';
      case 'weak':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              📊 Market Data Intelligence
            </h1>
            <p className="text-gray-600">
              Platform-wide market intelligence that auto-links to your deals by geography
            </p>
          </div>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
            + Add Submarket
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Tracked Submarkets</div>
          <div className="text-3xl font-bold text-gray-900">
            {submarkets.length}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Avg Rent Growth</div>
          <div className="text-3xl font-bold text-green-600">+4.4%</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Avg Supply Level</div>
          <div className="text-3xl font-bold text-yellow-600">80%</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Avg JEDI Score</div>
          <div className="text-3xl font-bold text-blue-600">75</div>
        </div>
      </div>

      {/* Tracked Submarkets */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Tracked Submarkets</h2>
          <p className="text-sm text-gray-600 mt-1">
            Submarkets are auto-tracked when you create deals or own properties in these areas
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {submarkets.map((submarket) => (
            <div
              key={submarket.id}
              className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {submarket.name}
                    </h3>
                    <span className="text-sm text-gray-500">
                      {submarket.location}
                    </span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                        submarket.status
                      )}`}
                    >
                      {submarket.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <span className="text-gray-600">Rent Trend: </span>
                      <span
                        className={`font-semibold ${
                          submarket.rentTrendValue > 4
                            ? 'text-green-600'
                            : 'text-yellow-600'
                        }`}
                      >
                        {submarket.rentTrend}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Supply: </span>
                      <span className="font-semibold text-gray-900">
                        {submarket.supply}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">JEDI Score: </span>
                      <span
                        className={`font-semibold ${getScoreColor(
                          submarket.jediScore
                        )}`}
                      >
                        {submarket.jediScore}
                      </span>
                    </div>
                  </div>
                </div>

                <button className="ml-4 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  View Details →
                </button>
              </div>

              {/* Progress Bar - Supply */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>Supply Capacity</span>
                  <span>{submarket.supplyPercent}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      submarket.supplyPercent > 85
                        ? 'bg-red-500'
                        : submarket.supplyPercent > 70
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${submarket.supplyPercent}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">
              How Market Data Layer Works
            </h3>
            <p className="text-sm text-blue-800">
              When you create a deal with a boundary, the platform automatically finds
              relevant submarket data and links it to your deal. This intelligence feeds
              into Strategy Arbitrage, Comp Analysis, and other modules to give you
              data-driven insights.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
