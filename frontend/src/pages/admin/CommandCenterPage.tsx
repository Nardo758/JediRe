/**
 * Command Center Page
 * Mission control for all data synchronization operations
 */

import React, { useState, useEffect } from 'react';
import { 
  Play, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Database,
  Zap,
  TrendingUp,
  Map,
  Building2,
  DollarSign
} from 'lucide-react';
import { apiClient } from '../../services/api.client';

interface DataStatus {
  overall: {
    total_properties: number;
    apartment_locator_synced: number;
    municipal_synced: number;
    with_rent: number;
    with_coords: number;
    with_type: number;
    with_tax: number;
    cities_covered: number;
  };
  by_city: Array<{
    city: string;
    state_code: string;
    count: number;
    enriched: number;
    pct_with_rent: number;
  }>;
}

interface Integration {
  apartment_locator: {
    connected: boolean;
    total_properties_available: number;
    api_url: string;
  };
  municipal_apis: {
    configured: number;
    cities: string[];
  };
}

interface Job {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  total: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
  result?: any;
}

interface DataQuality {
  total: number;
  pct_with_rent: number;
  pct_with_coords: number;
  pct_with_type: number;
  pct_with_tax: number;
  pct_with_units: number;
  pct_with_age: number;
}

export function CommandCenterPage() {
  const [loading, setLoading] = useState(true);
  const [dataStatus, setDataStatus] = useState<DataStatus | null>(null);
  const [integrations, setIntegrations] = useState<Integration | null>(null);
  const [dataQuality, setDataQuality] = useState<DataQuality | null>(null);
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [syncing, setSyncing] = useState(false);
  
  useEffect(() => {
    fetchStatus();
    
    // Poll for updates every 5 seconds if jobs are active
    const interval = setInterval(() => {
      if (activeJobs.length > 0) {
        fetchStatus();
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [activeJobs.length]);
  
  const fetchStatus = async () => {
    try {
      const response = await apiClient.get('/command-center/status');
      
      if (response.data.success) {
        setDataStatus(response.data.data.data_status);
        setIntegrations(response.data.data.integrations);
        setDataQuality(response.data.data.data_quality);
        setActiveJobs(response.data.data.active_jobs);
        setRecentJobs(response.data.data.recent_jobs);
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSyncAtlanta = async () => {
    setSyncing(true);
    try {
      const response = await apiClient.post('/command-center/sync-atlanta');
      
      if (response.data.success) {
        // Start polling for job status
        fetchStatus();
      }
    } catch (error) {
      console.error('Failed to start Atlanta sync:', error);
      alert('Failed to start sync. Check console for details.');
    } finally {
      setSyncing(false);
    }
  };
  
  const handleSyncAllMetros = async () => {
    if (!confirm('This will sync all 17 metros (~7,337 properties). This may take several minutes. Continue?')) {
      return;
    }
    
    setSyncing(true);
    try {
      const response = await apiClient.post('/command-center/sync-all-metros');
      
      if (response.data.success) {
        fetchStatus();
      }
    } catch (error) {
      console.error('Failed to start all metros sync:', error);
      alert('Failed to start sync. Check console for details.');
    } finally {
      setSyncing(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Zap className="w-8 h-8 text-blue-600" />
                Command Center
              </h1>
              <p className="text-gray-600 mt-1">Mission control for data synchronization</p>
            </div>
            
            <button
              onClick={fetchStatus}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Actions */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Play className="w-5 h-5" />
            Quick Actions
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={handleSyncAtlanta}
              disabled={syncing || activeJobs.length > 0}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <Database className="w-5 h-5" />
              Sync Atlanta
            </button>
            
            <button
              onClick={handleSyncAllMetros}
              disabled={syncing || activeJobs.length > 0}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <Map className="w-5 h-5" />
              Sync All Metros
            </button>
            
            <button
              disabled
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
            >
              <Building2 className="w-5 h-5" />
              Import Zoning (Soon)
            </button>
          </div>
        </div>
        
        {/* Active Jobs */}
        {activeJobs.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 animate-spin" />
              Active Jobs ({activeJobs.length})
            </h2>
            
            <div className="space-y-3">
              {activeJobs.map(job => (
                <div key={job.id} className="bg-white rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">{job.type}</span>
                    <span className="text-sm text-gray-600">
                      {job.progress}/{job.total}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(job.progress / job.total) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Data Status */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Data Status
            </h2>
            
            {dataStatus && (
              <div className="space-y-3">
                <StatusRow
                  label="Total Properties"
                  value={dataStatus.overall.total_properties.toLocaleString()}
                  icon={<Building2 className="w-4 h-4" />}
                />
                <StatusRow
                  label="Apartment Locator Synced"
                  value={dataStatus.overall.apartment_locator_synced.toLocaleString()}
                  icon={<CheckCircle className="w-4 h-4 text-green-600" />}
                />
                <StatusRow
                  label="Municipal Synced"
                  value={dataStatus.overall.municipal_synced.toLocaleString()}
                  icon={<CheckCircle className="w-4 h-4 text-blue-600" />}
                />
                <StatusRow
                  label="Cities Covered"
                  value={dataStatus.overall.cities_covered.toString()}
                  icon={<Map className="w-4 h-4" />}
                />
              </div>
            )}
          </div>
          
          {/* Integration Status */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Integrations
            </h2>
            
            {integrations && (
              <div className="space-y-3">
                <IntegrationRow
                  name="Apartment Locator AI"
                  connected={integrations.apartment_locator.connected}
                  detail={`${integrations.apartment_locator.total_properties_available} properties available`}
                />
                <IntegrationRow
                  name="Municipal APIs"
                  connected={true}
                  detail={`${integrations.municipal_apis.configured} cities configured`}
                />
                <IntegrationRow
                  name="Photo Scraper"
                  connected={false}
                  detail="Not configured"
                />
                <IntegrationRow
                  name="M27 Comps Database"
                  connected={false}
                  detail="Database empty"
                />
              </div>
            )}
          </div>
        </div>
        
        {/* Data Quality */}
        {dataQuality && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Data Quality (Atlanta)
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <QualityMetric label="Rent Data" value={dataQuality.pct_with_rent} />
              <QualityMetric label="Coordinates" value={dataQuality.pct_with_coords} />
              <QualityMetric label="Property Type" value={dataQuality.pct_with_type} />
              <QualityMetric label="Tax Data" value={dataQuality.pct_with_tax} />
              <QualityMetric label="Unit Count" value={dataQuality.pct_with_units} />
              <QualityMetric label="Year Built" value={dataQuality.pct_with_age} />
            </div>
          </div>
        )}
        
        {/* City Breakdown */}
        {dataStatus && dataStatus.by_city.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">City Coverage</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">City</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700">Properties</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700">Enriched</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700">Rent Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {dataStatus.by_city.slice(0, 10).map((city, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {city.city}, {city.state_code}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{city.count}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{city.enriched}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          city.pct_with_rent >= 80 
                            ? 'bg-green-100 text-green-700'
                            : city.pct_with_rent >= 40
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {city.pct_with_rent}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Recent Jobs */}
        {recentJobs.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Job History</h2>
            
            <div className="space-y-2">
              {recentJobs.map(job => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {job.status === 'completed' ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : job.status === 'failed' ? (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    ) : (
                      <Clock className="w-5 h-5 text-gray-400" />
                    )}
                    <div>
                      <div className="font-medium text-gray-900">{job.type}</div>
                      <div className="text-sm text-gray-600">
                        {new Date(job.startedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  {job.error && (
                    <span className="text-sm text-red-600">{job.error}</span>
                  )}
                  
                  {job.result && job.result.properties_inserted !== undefined && (
                    <span className="text-sm text-green-600">
                      +{job.result.properties_inserted} properties
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusRow({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        {icon}
        <span>{label}</span>
      </div>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function IntegrationRow({ name, connected, detail }: { name: string; connected: boolean; detail: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
        <span className="text-sm font-medium text-gray-900">{name}</span>
      </div>
      <span className="text-sm text-gray-600">{detail}</span>
    </div>
  );
}

function QualityMetric({ label, value }: { label: string; value: number }) {
  const getColor = (val: number) => {
    if (val >= 80) return 'text-green-600 bg-green-50';
    if (val >= 40) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };
  
  return (
    <div className="text-center p-4 rounded-lg border border-gray-200">
      <div className={`text-2xl font-bold ${getColor(value).split(' ')[0]} mb-1`}>
        {value.toFixed(0)}%
      </div>
      <div className="text-xs text-gray-600">{label}</div>
    </div>
  );
}
