import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Cog, RefreshCw, Play, XCircle, Eye, ChevronDown, ChevronUp,
  CheckCircle2, AlertTriangle, Clock, Loader2,
} from 'lucide-react';
import { apiClient } from '../../../services/api.client';

interface Job {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt: string | null;
  progress: string;
  errorCount: number;
}

interface JobLogs {
  job: { id: string; type: string; status: string; progress: string };
  logs: string[];
  errors: string[];
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  running: { color: 'bg-blue-100 text-blue-700', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  completed: { color: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="w-3 h-3" /> },
  failed: { color: 'bg-red-100 text-red-700', icon: <AlertTriangle className="w-3 h-3" /> },
  cancelled: { color: 'bg-gray-100 text-gray-600', icon: <XCircle className="w-3 h-3" /> },
  pending: { color: 'bg-yellow-100 text-yellow-700', icon: <Clock className="w-3 h-3" /> },
};

const TRIGGER_JOBS = [
  { label: 'Ingest Zoning Districts', endpoint: '/api/v1/admin/ingest/zoning-districts' },
  { label: 'Ingest Atlanta Benchmarks', endpoint: '/api/v1/admin/ingest/atlanta-benchmarks' },
  { label: 'Ingest Florida Benchmarks', endpoint: '/api/v1/admin/ingest/florida-benchmarks' },
  { label: 'Map Properties to Zoning', endpoint: '/api/v1/admin/ingest/map-properties-to-zoning' },
];

export function BackgroundJobsSection() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [runningCount, setRunningCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [jobLogs, setJobLogs] = useState<JobLogs | null>(null);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [triggerResult, setTriggerResult] = useState<string | null>(null);
  const refreshTimer = useRef<NodeJS.Timeout | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const params: Record<string, any> = {};
      if (statusFilter) params.status = statusFilter;
      const res = await apiClient.get('/api/v1/admin/jobs', { params });
      setJobs(res.data.jobs);
      setRunningCount(res.data.running);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    if (runningCount > 0) {
      refreshTimer.current = setInterval(fetchJobs, 10000);
    } else if (refreshTimer.current) {
      clearInterval(refreshTimer.current);
      refreshTimer.current = null;
    }
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [runningCount, fetchJobs]);

  const viewLogs = async (jobId: string) => {
    if (expandedJob === jobId) {
      setExpandedJob(null);
      setJobLogs(null);
      return;
    }
    setExpandedJob(jobId);
    setJobLogs(null);
    try {
      const res = await apiClient.get(`/api/v1/admin/jobs/${jobId}/logs`);
      setJobLogs(res.data);
    } catch {}
  };

  const cancelJob = async (jobId: string) => {
    try {
      await apiClient.post(`/api/v1/admin/jobs/${jobId}/cancel`);
      fetchJobs();
    } catch (err: any) {
      setTriggerResult(`Cancel failed: ${err.response?.data?.error || err.message}`);
    }
  };

  const triggerJob = async (endpoint: string, label: string) => {
    setTriggering(endpoint);
    setTriggerResult(null);
    try {
      const res = await apiClient.post(endpoint);
      setTriggerResult(`Started: ${label} (Job ID: ${res.data.jobId})`);
      setTimeout(fetchJobs, 1000);
    } catch (err: any) {
      setTriggerResult(`Failed to start ${label}: ${err.response?.data?.error || err.message}`);
    }
    setTriggering(null);
  };

  const parseProgress = (progress: string) => {
    const parts = progress.split('/');
    if (parts.length !== 2) return 0;
    const [done, total] = parts.map(Number);
    return total > 0 ? Math.round((done / total) * 100) : 0;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Cog className="w-5 h-5 text-orange-600" />
          Background Jobs
          {runningCount > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 animate-pulse">
              {runningCount} running
            </span>
          )}
        </h2>
        <button onClick={fetchJobs} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Trigger New Job</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {TRIGGER_JOBS.map((tj) => (
            <button
              key={tj.endpoint}
              onClick={() => triggerJob(tj.endpoint, tj.label)}
              disabled={triggering === tj.endpoint}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-50 border border-blue-200 text-blue-700 rounded-md hover:bg-blue-100 disabled:opacity-50"
            >
              {triggering === tj.endpoint ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              {tj.label}
            </button>
          ))}
        </div>
        {triggerResult && (
          <div className={`mt-3 text-sm ${triggerResult.startsWith('Failed') ? 'text-red-600' : 'text-green-600'}`}>
            {triggerResult}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {['', 'running', 'completed', 'failed', 'cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setLoading(true); }}
            className={`px-3 py-1.5 text-xs rounded-md border ${
              statusFilter === s
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading jobs...</span>
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <Cog className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No jobs found. Trigger a new job above to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Job ID</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Progress</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Started</th>
                  <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Errors</th>
                  <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => {
                  const cfg = STATUS_CONFIG[j.status] || STATUS_CONFIG.pending;
                  const pct = parseProgress(j.progress);
                  return (
                    <React.Fragment key={j.id}>
                      <tr className={`border-b border-gray-100 hover:bg-gray-50 ${expandedJob === j.id ? 'bg-blue-50' : ''}`}>
                        <td className="py-2 px-4 font-mono text-xs text-gray-600">{j.id}</td>
                        <td className="py-2 px-4 text-gray-700 capitalize">{j.type.replace(/-/g, ' ')}</td>
                        <td className="py-2 px-4">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
                            {cfg.icon}
                            {j.status}
                          </span>
                        </td>
                        <td className="py-2 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full transition-all ${j.status === 'completed' ? 'bg-green-500' : j.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">{j.progress}</span>
                          </div>
                        </td>
                        <td className="py-2 px-4 text-xs text-gray-500">
                          {new Date(j.startedAt).toLocaleString()}
                        </td>
                        <td className="py-2 px-4 text-right">
                          {j.errorCount > 0 ? (
                            <span className="text-xs font-medium text-red-600">{j.errorCount}</span>
                          ) : (
                            <span className="text-xs text-gray-400">0</span>
                          )}
                        </td>
                        <td className="py-2 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => viewLogs(j.id)} className="p-1 rounded hover:bg-gray-200" title="View logs">
                              <Eye className="w-3.5 h-3.5 text-gray-500" />
                            </button>
                            {j.status === 'running' && (
                              <button onClick={() => cancelJob(j.id)} className="p-1 rounded hover:bg-gray-200" title="Cancel job">
                                <XCircle className="w-3.5 h-3.5 text-red-500" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedJob === j.id && (
                        <tr>
                          <td colSpan={7} className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                            {jobLogs ? (
                              <div className="space-y-3">
                                <div>
                                  <div className="text-xs font-medium text-gray-700 mb-1">Logs ({jobLogs.logs.length})</div>
                                  <div className="bg-gray-900 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs text-gray-300 space-y-0.5">
                                    {jobLogs.logs.length > 0 ? (
                                      jobLogs.logs.map((line, i) => <div key={i}>{line}</div>)
                                    ) : (
                                      <div className="text-gray-500">No logs yet</div>
                                    )}
                                  </div>
                                </div>
                                {jobLogs.errors.length > 0 && (
                                  <div>
                                    <div className="text-xs font-medium text-red-600 mb-1">Errors ({jobLogs.errors.length})</div>
                                    <div className="bg-red-50 rounded-lg p-3 max-h-32 overflow-y-auto text-xs text-red-700 space-y-0.5">
                                      {jobLogs.errors.map((err, i) => <div key={i}>{err}</div>)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <RefreshCw className="w-4 h-4 animate-spin" /> Loading logs...
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {runningCount > 0 && (
        <div className="text-xs text-gray-400 text-center">Auto-refreshing every 10 seconds while jobs are running</div>
      )}
    </div>
  );
}
