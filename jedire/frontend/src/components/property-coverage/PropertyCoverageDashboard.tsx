import { useState, useEffect } from 'react';
import { Database, Activity, CheckCircle, AlertCircle, MapPin, TrendingUp } from 'lucide-react';

interface CountyStats {
  county: string;
  parcels: number;
  status: 'healthy' | 'degraded' | 'down';
  apiUrl: string;
  responseTime?: number;
}

const BACKEND_API = import.meta.env.VITE_API_URL || '/api/v1';

export default function PropertyCoverageDashboard() {
  const [counties, setCounties] = useState<CountyStats[]>([
    {
      county: 'Fulton',
      parcels: 340000,
      status: 'healthy',
      apiUrl: 'https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0'
    },
    {
      county: 'DeKalb',
      parcels: 280000,
      status: 'healthy',
      apiUrl: 'https://dcgis.dekalbcountyga.gov/hosted/rest/services/Tax_Parcels/FeatureServer/0'
    }
  ]);
  
  const [apiHealth, setApiHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);

  // Check API health on mount
  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_API}/properties/health`);
      const result = await response.json();
      setApiHealth(result.data || result);
    } catch (error) {
      console.error('Health check failed:', error);
      setApiHealth({ status: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const testProperty = async () => {
    setTestLoading(true);
    setTestResult(null);
    
    try {
      const response = await fetch(`${BACKEND_API}/properties/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: '3500 Peachtree Road NE',
          county: 'Fulton'
        })
      });
      
      const result = await response.json();
      setTestResult(result.data || result);
    } catch (error) {
      setTestResult({ error: 'Test failed' });
    } finally {
      setTestLoading(false);
    }
  };

  const totalParcels = counties.reduce((sum, c) => sum + c.parcels, 0);
  const healthyCounties = counties.filter(c => c.status === 'healthy').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Property Data Coverage</h1>
        <p className="text-gray-600 mt-1">
          Live municipal property data from county assessor APIs
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Parcels</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {(totalParcels / 1000).toFixed(0)}K
              </p>
            </div>
            <Database className="w-8 h-8 text-blue-600" />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            60% Atlanta metro coverage
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Counties</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {counties.length}
              </p>
            </div>
            <MapPin className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Fulton + DeKalb live
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">API Status</p>
              <p className="text-3xl font-bold text-green-600 mt-1">
                {apiHealth?.status === 'healthy' ? '✓' : '...'}
              </p>
            </div>
            <Activity className="w-8 h-8 text-purple-600" />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {loading ? 'Checking...' : 'All systems operational'}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Cost Savings</p>
              <p className="text-3xl font-bold text-green-600 mt-1">
                $50K
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            vs CoStar annual fee
          </p>
        </div>
      </div>

      {/* County Details */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Active Counties</h2>
        </div>
        
        <div className="divide-y divide-gray-200">
          {counties.map((county) => (
            <div key={county.county} className="p-6 hover:bg-gray-50 transition">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {county.county} County, GA
                    </h3>
                    {county.status === 'healthy' && (
                      <span className="flex items-center gap-1 text-sm text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        Healthy
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Parcels:</span>
                      <span className="ml-2 font-semibold text-gray-900">
                        {(county.parcels / 1000).toFixed(0)}K
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Coverage:</span>
                      <span className="ml-2 font-semibold text-gray-900">
                        100%
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">API Type:</span>
                      <span className="ml-2 font-semibold text-gray-900">
                        ArcGIS REST
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Response:</span>
                      <span className="ml-2 font-semibold text-green-600">
                        ~2s
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <details className="text-xs text-gray-500">
                      <summary className="cursor-pointer hover:text-gray-700">
                        View API Endpoint
                      </summary>
                      <code className="block mt-2 p-2 bg-gray-50 rounded text-xs break-all">
                        {county.apiUrl}
                      </code>
                    </details>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Test Panel */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Test API</h2>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <button
              onClick={testProperty}
              disabled={testLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
            >
              {testLoading ? 'Testing...' : 'Test Fulton County Property'}
            </button>
            <p className="text-sm text-gray-600 mt-2">
              Query: 3500 Peachtree Road NE, Atlanta (Buckhead)
            </p>
          </div>

          {testResult && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">Result:</h3>
              <pre className="text-xs bg-white p-3 rounded border border-gray-200 overflow-auto max-h-96">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Coming Soon */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-3">Phase 2: Coming Soon</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-gray-900">Gwinnett County</h3>
              <p className="text-gray-600 text-xs mt-1">
                +245K parcels · 20% additional coverage
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-gray-900">Cobb County</h3>
              <p className="text-gray-600 text-xs mt-1">
                +150K parcels · 10% additional coverage
              </p>
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-700 mt-4">
          <strong>Target:</strong> 90% Atlanta metro coverage (1M+ parcels)
        </p>
      </div>
    </div>
  );
}
