/**
 * Leasing Forecast Page
 * Detailed 12-week leasing forecast table (matches Excel format)
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface WeeklyData {
  week_ending: string;
  traffic: number;
  tours: number;
  net_leases: number;
  closing_pct: number;
  occupancy: number;
}

interface LeasingForecast {
  property_id: string;
  weeks_forecast: number;
  weekly_data: WeeklyData[];
  summary: {
    total_leases: string;
    avg_per_week: number;
    annual_projection: number;
    turnover_rate: number;
  };
}

export const LeasingForecastPage: React.FC = () => {
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  
  const [forecast, setForecast] = useState<LeasingForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weeks, setWeeks] = useState(12);
  
  useEffect(() => {
    if (propertyId) {
      loadForecast();
    }
  }, [propertyId, weeks]);
  
  const loadForecast = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/v1/leasing-traffic/forecast/${propertyId}?weeks=${weeks}`);
      
      if (!response.ok) {
        throw new Error('Failed to load leasing forecast');
      }
      
      const data = await response.json();
      setForecast(data.forecast);
      
    } catch (err: any) {
      console.error('Error loading forecast:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-12 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (error || !forecast) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-900 mb-2">Error Loading Forecast</h2>
            <p className="text-red-700">{error || 'Failed to load forecast data'}</p>
            <button
              onClick={() => navigate(-1)}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <button
            onClick={() => navigate(-1)}
            className="text-white/80 hover:text-white mb-4 flex items-center gap-2"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold mb-2">Leasing Traffic Forecast</h1>
          <p className="text-white/90">Property ID: {propertyId}</p>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="max-w-7xl mx-auto px-8 -mt-8 mb-8">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-lg p-4">
            <div className="text-xs text-gray-600 mb-1">Total Leases</div>
            <div className="text-2xl font-bold text-purple-600">{forecast.summary.total_leases}</div>
            <div className="text-xs text-gray-500">{weeks} weeks</div>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-4">
            <div className="text-xs text-gray-600 mb-1">Avg/Week</div>
            <div className="text-2xl font-bold text-blue-600">{forecast.summary.avg_per_week}</div>
            <div className="text-xs text-gray-500">leases/week</div>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-4">
            <div className="text-xs text-gray-600 mb-1">Annual Projection</div>
            <div className="text-2xl font-bold text-green-600">{forecast.summary.annual_projection}</div>
            <div className="text-xs text-gray-500">leases/year</div>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-4">
            <div className="text-xs text-gray-600 mb-1">Turnover Rate</div>
            <div className="text-2xl font-bold text-orange-600">{forecast.summary.turnover_rate}%</div>
            <div className="text-xs text-gray-500">annual</div>
          </div>
        </div>
      </div>
      
      {/* Weekly Table */}
      <div className="max-w-7xl mx-auto px-8 pb-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Controls */}
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Weekly Breakdown</h2>
            
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-700">
                Forecast Period:
              </label>
              <select
                value={weeks}
                onChange={(e) => setWeeks(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="4">4 weeks</option>
                <option value="8">8 weeks</option>
                <option value="12">12 weeks</option>
                <option value="26">26 weeks</option>
                <option value="52">52 weeks (1 year)</option>
              </select>
            </div>
          </div>
          
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Week Ending
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Traffic
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Tours
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Net Leases
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Closing %
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Occupancy
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {forecast.weekly_data.map((week, index) => (
                  <tr 
                    key={index}
                    className={`hover:bg-gray-50 transition-colors ${index === 0 ? 'bg-purple-50' : ''}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatDate(week.week_ending)}
                      {index === 0 && (
                        <span className="ml-2 text-xs text-purple-600 font-semibold">(This Week)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 font-semibold">
                        {week.traffic}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-purple-100 text-purple-800 font-semibold">
                        {week.tours}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800 font-bold">
                        {week.net_leases}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                      <span className={`font-semibold ${
                        week.closing_pct >= 25 ? 'text-green-600' :
                        week.closing_pct >= 20 ? 'text-blue-600' :
                        'text-orange-600'
                      }`}>
                        {week.closing_pct}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                      <span className={`font-semibold ${
                        week.occupancy >= 95 ? 'text-green-600' :
                        week.occupancy >= 90 ? 'text-blue-600' :
                        'text-orange-600'
                      }`}>
                        {week.occupancy}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Export Button */}
          <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
            <button
              onClick={() => {
                // TODO: Implement CSV export
                alert('CSV export coming soon!');
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <span>📥</span>
              Export to Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeasingForecastPage;
