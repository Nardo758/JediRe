import React, { useEffect, useState, useCallback } from 'react';
import {
  Building2, RefreshCw, ChevronLeft, ChevronRight, Eye, Wrench,
  Trash2, AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  Shield, FileWarning,
} from 'lucide-react';
import { apiClient } from '../../../services/api.client';

interface Deal {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  status: string;
  user_id: string;
  user_email: string;
  scenario_count: string;
  active_scenarios: string;
  created_at: string;
  updated_at: string;
}

interface AuditData {
  deal: any;
  scenarios: any[];
  state_history: any[];
  activity: any[];
}

interface QualityData {
  missingZoning: number;
  invalidBoundaries: number;
  orphaned: { scenarios: number; boundaries: number; activity: number };
}

export function DealOversightSection() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDeal, setExpandedDeal] = useState<string | null>(null);
  const [auditData, setAuditData] = useState<AuditData | null>(null);
  const [quality, setQuality] = useState<QualityData | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [fixResult, setFixResult] = useState<{ dealId: string; fixes: string[] } | null>(null);
  const [autoFixResult, setAutoFixResult] = useState<Record<string, number> | null>(null);
  const [showQuality, setShowQuality] = useState(false);

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/api/v1/admin/deals', { params: { page, limit: 20 } });
      setDeals(res.data.deals);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load deals');
    } finally {
      setLoading(false);
    }
  }, [page]);

  const fetchQuality = async () => {
    try {
      const [mz, ib, od] = await Promise.all([
        apiClient.get('/api/v1/admin/quality/missing-zoning'),
        apiClient.get('/api/v1/admin/quality/invalid-boundaries'),
        apiClient.get('/api/v1/admin/quality/orphaned-data'),
      ]);
      setQuality({
        missingZoning: mz.data.total_missing,
        invalidBoundaries: ib.data.total_missing_boundaries,
        orphaned: od.data.orphaned,
      });
    } catch {}
  };

  useEffect(() => { fetchDeals(); fetchQuality(); }, [fetchDeals]);

  const viewAudit = async (dealId: string) => {
    if (expandedDeal === dealId) {
      setExpandedDeal(null);
      setAuditData(null);
      return;
    }
    setExpandedDeal(dealId);
    setAuditData(null);
    try {
      const res = await apiClient.get(`/api/v1/admin/deals/${dealId}/audit`);
      setAuditData(res.data);
    } catch {
      setAuditData({ deal: {}, scenarios: [], state_history: [], activity: [] });
    }
  };

  const fixDeal = async (dealId: string) => {
    setActionLoading(dealId);
    setFixResult(null);
    try {
      const res = await apiClient.post(`/api/v1/admin/deals/${dealId}/fix`);
      setFixResult({ dealId, fixes: res.data.fixes });
      fetchDeals();
    } catch (err: any) {
      setFixResult({ dealId, fixes: [`Error: ${err.response?.data?.error || err.message}`] });
    }
    setActionLoading(null);
  };

  const forceDelete = async (dealId: string) => {
    setActionLoading(dealId);
    try {
      await apiClient.delete(`/api/v1/admin/deals/${dealId}/force`);
      setConfirmDelete(null);
      fetchDeals();
      fetchQuality();
    } catch (err: any) {
      setError(`Delete failed: ${err.response?.data?.error || err.message}`);
    }
    setActionLoading(null);
  };

  const runAutoFix = async () => {
    setAutoFixResult(null);
    try {
      const res = await apiClient.post('/api/v1/admin/quality/auto-fix');
      setAutoFixResult(res.data.fixes);
      fetchQuality();
      fetchDeals();
    } catch (err: any) {
      setError(`Auto-fix failed: ${err.response?.data?.error || err.message}`);
    }
  };

  const statusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'closed': return 'bg-gray-100 text-gray-600';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-blue-100 text-blue-700';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-green-600" />
          Deal Oversight
          <span className="text-sm font-normal text-gray-500">({total} total)</span>
        </h2>
        <button onClick={fetchDeals} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <button
        onClick={() => setShowQuality(!showQuality)}
        className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <FileWarning className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium text-gray-700">Data Quality</span>
          {quality && (
            <span className="text-xs text-gray-500">
              {(quality.missingZoning || 0) + (quality.invalidBoundaries || 0) + (quality.orphaned?.scenarios || 0) + (quality.orphaned?.boundaries || 0) + (quality.orphaned?.activity || 0)} issues
            </span>
          )}
        </div>
        {showQuality ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {showQuality && quality && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-amber-50 rounded-lg p-3">
              <div className="text-xs text-amber-600">Missing Zoning</div>
              <div className="text-xl font-bold text-amber-700">{quality.missingZoning}</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3">
              <div className="text-xs text-orange-600">Invalid Boundaries</div>
              <div className="text-xl font-bold text-orange-700">{quality.invalidBoundaries}</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <div className="text-xs text-red-600">Orphaned Scenarios</div>
              <div className="text-xl font-bold text-red-700">{quality.orphaned.scenarios}</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <div className="text-xs text-red-600">Orphaned Boundaries</div>
              <div className="text-xl font-bold text-red-700">{quality.orphaned.boundaries}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={runAutoFix}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700"
            >
              <Wrench className="w-3.5 h-3.5" />
              Auto-Fix Orphaned Data
            </button>
            {autoFixResult && (
              <div className="text-xs text-green-600">
                Fixed: {Object.entries(autoFixResult).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(', ')}
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading deals...</span>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Location</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Scenarios</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Updated</th>
                  <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <React.Fragment key={d.id}>
                    <tr className={`border-b border-gray-100 hover:bg-gray-50 ${expandedDeal === d.id ? 'bg-blue-50' : ''}`}>
                      <td className="py-2 px-4">
                        <div className="font-medium text-gray-900 truncate max-w-[200px]">{d.name}</div>
                        <div className="text-xs text-gray-400 truncate max-w-[200px]">{d.address}</div>
                      </td>
                      <td className="py-2 px-4 text-gray-600 text-xs">{[d.city, d.state].filter(Boolean).join(', ')}</td>
                      <td className="py-2 px-4">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor(d.status)}`}>
                          {d.status || 'unknown'}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-xs text-gray-500 truncate max-w-[150px]">{d.user_email || '--'}</td>
                      <td className="py-2 px-4 text-right">
                        <span className="font-medium">{d.active_scenarios}</span>
                        <span className="text-gray-400">/{d.scenario_count}</span>
                      </td>
                      <td className="py-2 px-4 text-xs text-gray-500">{d.updated_at ? new Date(d.updated_at).toLocaleDateString() : '--'}</td>
                      <td className="py-2 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => viewAudit(d.id)} className="p-1 rounded hover:bg-gray-200" title="View audit">
                            <Eye className="w-3.5 h-3.5 text-gray-500" />
                          </button>
                          <button
                            onClick={() => fixDeal(d.id)}
                            disabled={actionLoading === d.id}
                            className="p-1 rounded hover:bg-gray-200"
                            title="Fix deal"
                          >
                            <Wrench className="w-3.5 h-3.5 text-blue-500" />
                          </button>
                          {confirmDelete === d.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => forceDelete(d.id)} className="p-1 rounded bg-red-100 hover:bg-red-200" title="Confirm delete">
                                <CheckCircle2 className="w-3.5 h-3.5 text-red-600" />
                              </button>
                              <button onClick={() => setConfirmDelete(null)} className="p-1 rounded hover:bg-gray-200" title="Cancel">
                                <XCircle className="w-3.5 h-3.5 text-gray-400" />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDelete(d.id)} className="p-1 rounded hover:bg-gray-200" title="Force delete">
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {fixResult && fixResult.dealId === d.id && (
                      <tr>
                        <td colSpan={7} className="bg-green-50 px-4 py-2 border-b border-green-100 text-xs text-green-700">
                          Fix result: {fixResult.fixes.join('; ')}
                        </td>
                      </tr>
                    )}
                    {expandedDeal === d.id && (
                      <tr>
                        <td colSpan={7} className="bg-blue-50 px-4 py-3 border-b border-blue-100">
                          {auditData ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <div className="font-medium text-gray-700 mb-2">Scenarios ({auditData.scenarios.length})</div>
                                {auditData.scenarios.length > 0 ? (
                                  <div className="space-y-1">
                                    {auditData.scenarios.slice(0, 5).map((s: any) => (
                                      <div key={s.id} className="flex items-center gap-1.5 text-xs">
                                        {s.is_active && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                                        <span className="text-gray-700">{s.name || 'Unnamed'}</span>
                                        <span className="text-gray-400 capitalize">{s.entitlement_type?.replace(/_/g, ' ')}</span>
                                        {s.max_units && <span className="text-gray-400">{s.max_units} units</span>}
                                      </div>
                                    ))}
                                  </div>
                                ) : <div className="text-xs text-gray-400">No scenarios</div>}
                              </div>
                              <div>
                                <div className="font-medium text-gray-700 mb-2">State History ({auditData.state_history.length})</div>
                                {auditData.state_history.length > 0 ? (
                                  <div className="space-y-1">
                                    {auditData.state_history.slice(0, 5).map((s: any, i: number) => (
                                      <div key={i} className="text-xs text-gray-500">
                                        v{s.version} - {new Date(s.created_at).toLocaleDateString()}
                                      </div>
                                    ))}
                                  </div>
                                ) : <div className="text-xs text-gray-400">No state history</div>}
                              </div>
                              <div>
                                <div className="font-medium text-gray-700 mb-2">Recent Activity ({auditData.activity.length})</div>
                                {auditData.activity.length > 0 ? (
                                  <div className="space-y-1">
                                    {auditData.activity.slice(0, 5).map((a: any, i: number) => (
                                      <div key={i} className="text-xs text-gray-500">
                                        {a.action} - {new Date(a.created_at).toLocaleDateString()}
                                      </div>
                                    ))}
                                  </div>
                                ) : <div className="text-xs text-gray-400">No activity</div>}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <RefreshCw className="w-4 h-4 animate-spin" /> Loading audit trail...
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {deals.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">No deals found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              <div className="text-xs text-gray-500">Page {page} of {pages}</div>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded border border-gray-300 hover:bg-white disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(pages, p + 1))}
                  disabled={page === pages}
                  className="p-1.5 rounded border border-gray-300 hover:bg-white disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
