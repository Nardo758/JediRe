import React from 'react';

export function DealsPage() {
  const deals = [
    { name: 'Buckhead Tower', stage: 'Due Diligence', properties: 5, budget: '$25M', score: 78 },
    { name: 'Midtown Mixed Use', stage: 'Qualified', properties: 12, budget: '$42M', score: 65 },
    { name: 'Virginia Highland', stage: 'Lead', properties: 8, budget: '$18M', score: 72 },
  ];

  const stages = ['Lead', 'Qualified', 'Due Diligence', 'Under Contract', 'Closing', 'Closed'];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Deal Pipeline</h1>
          <p className="text-gray-600">Track and manage your active deals</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          + Create Deal
        </button>
      </div>

      {/* Pipeline View */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Pipeline Progress</h2>
        <div className="flex gap-1 mb-4">
          {stages.map((stage, idx) => (
            <div key={stage} className="flex-1">
              <div className={`h-2 rounded ${
                idx < 2 ? 'bg-blue-600' : 'bg-gray-200'
              }`}></div>
              <div className="text-xs text-gray-600 mt-2">{stage}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Deals List */}
      <div className="space-y-4">
        {deals.map((deal, idx) => (
          <div key={idx} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-semibold text-gray-900">{deal.name}</h3>
                  <span className="px-3 py-1 text-sm font-medium bg-blue-100 text-blue-700 rounded-full">
                    {deal.stage}
                  </span>
                  <span className={`px-3 py-1 text-sm font-bold rounded-full ${
                    deal.score >= 75 ? 'bg-green-100 text-green-700' :
                    deal.score >= 65 ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    JEDI Score: {deal.score}
                  </span>
                </div>

                <div className="flex gap-6 text-sm text-gray-600">
                  <span>🏢 {deal.properties} properties</span>
                  <span>💰 {deal.budget} budget</span>
                  <span>📅 Updated 2 days ago</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                  View
                </button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Analyze
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
