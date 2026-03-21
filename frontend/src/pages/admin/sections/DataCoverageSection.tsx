import React, { useState, useEffect } from 'react';
import { Map, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../../services/api.client';

interface CountyCoverage {
  county: string;
  state: string;
  status: string;
  last_scraped: string | null;
  property_count: number;
  data_quality_score: number | null;
}

export function DataCoverageSection() {
  const [counties, setCounties] = useState<CountyCoverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/api/v1/admin/data-coverage');
      setCounties(res.data.counties || []);
    } catch {
      setError('Could not load coverage data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never';

  const statusColor = (s: string) => {
    switch (s) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Map className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Data Coverage</h2>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/property-coverage"
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2.5 py-1.5"
          >
            <ExternalLink className="w-3 h-3" />
            Full Coverage Map
          </Link>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2.5 py-1.5"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error} — showing summary only
        </div>
      )}

      {counties.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">County / State</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Properties</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Scraped</th>
              </tr>
            </thead>
            <tbody>
              {counties.map((c, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {c.county}, {c.state}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColor(c.status)}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 font-mono text-xs">
                    {c.property_count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(c.last_scraped)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !loading && (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <Map className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-3">No county coverage data configured yet.</p>
          <Link
            to="/admin/property-coverage"
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
          >
            <ExternalLink className="w-4 h-4" />
            Open Coverage Map
          </Link>
        </div>
      )}
    </div>
  );
}
