import React from 'react';

export function ReportsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports & Analytics</h1>
        <p className="text-gray-600">Generate insights and track performance</p>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Quick Reports */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">📊 Quick Reports</h2>
          <div className="space-y-3">
            <button className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="font-medium">Portfolio Summary</div>
              <div className="text-sm text-gray-600">Overview of all properties</div>
            </button>
            <button className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="font-medium">Market Analysis</div>
              <div className="text-sm text-gray-600">Submarket trends and insights</div>
            </button>
            <button className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="font-medium">Deal Performance</div>
              <div className="text-sm text-gray-600">ROI and metrics by deal</div>
            </button>
          </div>
        </div>

        {/* Custom Reports */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">🎯 Custom Reports</h2>
          <div className="text-center py-8">
            <div className="text-6xl mb-4">📈</div>
            <p className="text-gray-600 mb-4">Build custom reports with your data</p>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Create Custom Report
            </button>
          </div>
        </div>
      </div>

      {/* Charts Placeholder */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">📉 Market Trends</h2>
        <div className="h-64 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-2">📊</div>
            <p className="text-gray-600">Chart visualization coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}
