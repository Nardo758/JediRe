import React, { useState } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Building2, Activity, FileText, BarChart3, PieChart } from 'lucide-react';
import { Deal } from '@/types';
import { ModuleUpsellBanner } from './ModuleUpsellBanner';

interface MarketAnalysisSectionProps {
  deal: Deal;
  enhanced?: boolean;
  onToggleModule?: () => void;
}

export function MarketAnalysisSection({ deal, enhanced = false, onToggleModule }: MarketAnalysisSectionProps) {
  const [editMode, setEditMode] = useState(false);
  const [marketData, setMarketData] = useState({
    occupancyRate: 0,
    avgRent: 0,
    classDistribution: { A: 0, B: 0, C: 0, D: 0 }
  });

  if (!enhanced) {
    return (
      <div className="space-y-6">
        {/* Basic Market Stats */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Market Statistics</h3>
            <button
              onClick={() => setEditMode(!editMode)}
              className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              {editMode ? 'Done' : 'Edit'}
            </button>
          </div>

          <div className="space-y-6">
            {/* Occupancy Rate */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Activity className="w-4 h-4" />
                Submarket Occupancy Rate
              </label>
              {editMode ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={marketData.occupancyRate}
                    onChange={(e) => setMarketData({ ...marketData, occupancyRate: parseFloat(e.target.value) })}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <span className="text-sm text-gray-600">%</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold text-gray-900">
                    {marketData.occupancyRate > 0 ? `${marketData.occupancyRate}%` : '—'}
                  </div>
                  {marketData.occupancyRate === 0 && (
                    <span className="text-sm text-gray-500 italic">Click Edit to enter data</span>
                  )}
                </div>
              )}
            </div>

            {/* Average Rent */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <TrendingUp className="w-4 h-4" />
                Average Rent
              </label>
              {editMode ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">$</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={marketData.avgRent}
                    onChange={(e) => setMarketData({ ...marketData, avgRent: parseFloat(e.target.value) })}
                    className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <span className="text-sm text-gray-600">/month</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold text-gray-900">
                    {marketData.avgRent > 0 ? `$${marketData.avgRent.toLocaleString()}` : '—'}
                  </div>
                  {marketData.avgRent === 0 && (
                    <span className="text-sm text-gray-500 italic">Click Edit to enter data</span>
                  )}
                </div>
              )}
            </div>

            {/* Building Class Distribution */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Building2 className="w-4 h-4" />
                Building Class Distribution
              </label>
              {editMode ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(marketData.classDistribution).map(([cls, value]) => (
                    <div key={cls} className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">Class {cls}</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={value}
                          onChange={(e) => setMarketData({
                            ...marketData,
                            classDistribution: {
                              ...marketData.classDistribution,
                              [cls]: parseFloat(e.target.value)
                            }
                          })}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <span className="text-xs text-gray-600">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(marketData.classDistribution).map(([cls, value]) => (
                    <div key={cls} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700 w-16">Class {cls}</span>
                      <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${value}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-12 text-right">
                        {value > 0 ? `${value}%` : '—'}
                      </span>
                    </div>
                  ))}
                  {Object.values(marketData.classDistribution).every(v => v === 0) && (
                    <span className="text-sm text-gray-500 italic">Click Edit to enter distribution</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Data Entry Prompt */}
        {!editMode && Object.values(marketData).every(v => 
          typeof v === 'number' ? v === 0 : Object.values(v).every(x => x === 0)
        ) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900 mb-1">
                  Manual Data Entry Required
                </p>
                <p className="text-sm text-blue-700">
                  Enter your market research data manually or upgrade to Market Signals for automated tracking.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Module Upsell */}
        {onToggleModule && (
          <ModuleUpsellBanner
            moduleName="Market Signals"
            benefits={[
              'Supply pipeline monitoring (track new developments)',
              'Competitor intelligence (competing properties)',
              'Absorption rates and market velocity',
              'Early warning alerts for market shifts',
              'Historical trend analysis'
            ]}
            price="$39"
            onAddModule={onToggleModule}
            onLearnMore={() => {}}
          />
        )}
      </div>
    );
  }

  // Enhanced version with Market Signals
  return (
    <div className="space-y-6">
      {/* Market Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-green-500" />
            <span className="text-sm font-medium text-gray-700">Occupancy Rate</span>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold text-gray-900">94.2%</p>
            <span className="flex items-center text-sm text-green-600 mb-1">
              <TrendingUp className="w-4 h-4 mr-1" />
              +2.1%
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">vs. last quarter</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            <span className="text-sm font-medium text-gray-700">Average Rent</span>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold text-gray-900">$2,450</p>
            <span className="flex items-center text-sm text-green-600 mb-1">
              <TrendingUp className="w-4 h-4 mr-1" />
              +5.3%
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">YoY growth</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-5 h-5 text-purple-500" />
            <span className="text-sm font-medium text-gray-700">Absorption Rate</span>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold text-gray-900">87%</p>
            <span className="flex items-center text-sm text-gray-600 mb-1">
              <TrendingUp className="w-4 h-4 mr-1" />
              Stable
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">30-day average</p>
        </div>
      </div>

      {/* Supply Pipeline */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Supply Pipeline
          </h3>
          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
            5 developments tracked
          </span>
        </div>
        
        <div className="space-y-3">
          {[
            { name: 'Riverside Towers', units: 120, completion: '2024 Q3', status: 'construction' },
            { name: 'Park Place Lofts', units: 85, completion: '2024 Q4', status: 'planning' },
            { name: 'Downtown Commons', units: 200, completion: '2025 Q1', status: 'construction' },
            { name: 'Greenway Apartments', units: 60, completion: '2025 Q2', status: 'planning' },
            { name: 'Harbor View', units: 150, completion: '2025 Q3', status: 'planning' }
          ].map((dev, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{dev.name}</p>
                <p className="text-xs text-gray-500">{dev.units} units · Est. completion {dev.completion}</p>
              </div>
              <span className={`px-2 py-1 text-xs font-medium rounded ${
                dev.status === 'construction' 
                  ? 'bg-orange-100 text-orange-700' 
                  : 'bg-gray-200 text-gray-700'
              }`}>
                {dev.status === 'construction' ? 'Under Construction' : 'Planning'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Competitor Intelligence */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <PieChart className="w-5 h-5" />
            Competitor Intelligence
          </h3>
          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
            3 competing properties
          </span>
        </div>
        
        <div className="space-y-3">
          {[
            { name: 'Oak Street Residences', avgRent: 2600, occupancy: 96, concessions: 'None' },
            { name: 'Metro Plaza', avgRent: 2350, occupancy: 92, concessions: '1 month free' },
            { name: 'Westside Commons', avgRent: 2500, occupancy: 89, concessions: '$500 off' }
          ].map((comp, idx) => (
            <div key={idx} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{comp.name}</p>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs text-gray-600">Avg Rent: ${comp.avgRent}</span>
                    <span className="text-xs text-gray-600">Occupancy: {comp.occupancy}%</span>
                  </div>
                </div>
              </div>
              {comp.concessions !== 'None' && (
                <div className="flex items-center gap-2 mt-2 text-xs">
                  <AlertTriangle className="w-3 h-3 text-orange-500" />
                  <span className="text-orange-700 font-medium">Active concessions: {comp.concessions}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Early Warning Alerts */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          Early Warning Alerts
        </h3>
        
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-900">Supply Surge Expected</p>
              <p className="text-sm text-yellow-700 mt-1">
                3 major developments (435 units total) completing within next 6 months
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900">Rent Growth Accelerating</p>
              <p className="text-sm text-blue-700 mt-1">
                Market rents up 5.3% YoY, outpacing regional average of 3.8%
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <TrendingDown className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-900">Competitor Concessions Rising</p>
              <p className="text-sm text-red-700 mt-1">
                2 of 3 competitors now offering move-in incentives
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Market Trend Charts Placeholder */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Trends</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Occupancy Trend */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Occupancy Rate (12 months)</p>
            <div className="h-48 bg-gradient-to-t from-green-50 to-white border border-gray-200 rounded-lg flex items-center justify-center">
              <div className="text-center text-gray-500">
                <BarChart3 className="w-8 h-8 mx-auto mb-2" />
                <p className="text-xs">Chart visualization</p>
              </div>
            </div>
          </div>

          {/* Rent Growth Trend */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Average Rent Growth (12 months)</p>
            <div className="h-48 bg-gradient-to-t from-blue-50 to-white border border-gray-200 rounded-lg flex items-center justify-center">
              <div className="text-center text-gray-500">
                <TrendingUp className="w-8 h-8 mx-auto mb-2" />
                <p className="text-xs">Chart visualization</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full Report Button */}
      <div className="flex justify-center">
        <button className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
          <FileText className="w-5 h-5" />
          View Full Market Report
        </button>
      </div>
    </div>
  );
}
