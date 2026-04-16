import React, { useState, useEffect } from 'react';
import { Cog, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { apiClient } from '../../../services/api.client';
import { BT } from '@/components/deal/bloomberg-ui';

interface JobRow {
  id: string;
  job_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  pending:   { bg: BT.bg.panelAlt, color: BT.text.amber },
  running:   { bg: BT.bg.panelAlt, color: BT.text.cyan },
  completed: { bg: BT.bg.panelAlt, color: BT.text.green },
  failed:    { bg: BT.bg.panelAlt, color: BT.text.red },
};

export function BackgroundJobsSection() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/api/v1/admin/jobs');
      setJobs(res.data.jobs || []);
    } catch {
      setError('Could not load background jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="p-6 space-y-4" style={{ fontFamily: BT.font.label }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cog className="w-5 h-5" style={{ color: BT.text.cyan }} />
          <h2 className="text-lg font-semibold" style={{ color: BT.text.primary }}>Background Jobs</h2>
          {!loading && <span className="text-xs ml-1" style={{ color: BT.text.muted }}>({jobs.length})</span>}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5"
          style={{ color: BT.text.secondary, border: `1px solid ${BT.border.subtle}`, borderRadius: 2, background: 'transparent' }}
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-sm" style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.text.amber}`, borderRadius: 0, color: BT.text.amber }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="overflow-hidden" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse" style={{ background: BT.bg.panelAlt, borderRadius: 0 }} />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-10 text-center">
            <Clock className="w-8 h-8 mx-auto mb-3" style={{ color: BT.text.muted }} />
            <p className="text-sm" style={{ color: BT.text.muted }}>No background jobs recorded</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${BT.border.subtle}`, background: BT.bg.header }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: BT.text.muted }}>Job Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: BT.text.muted }}>Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: BT.text.muted }}>Started</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: BT.text.muted }}>Completed</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(j => {
                const ss = STATUS_STYLES[j.status] || { bg: BT.bg.panelAlt, color: BT.text.secondary };
                return (
                  <tr key={j.id} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                    <td className="px-4 py-3">
                      <div className="font-medium capitalize" style={{ color: BT.text.primary }}>{j.job_type.replace(/_/g, ' ')}</div>
                      {j.error_message && (
                        <div className="text-xs mt-0.5 truncate max-w-xs" style={{ color: BT.text.red }}>{j.error_message}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium" style={{ background: ss.bg, color: ss.color, borderRadius: 2 }}>
                        {j.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: BT.text.muted, fontFamily: BT.font.mono }}>{formatDate(j.started_at)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: BT.text.muted, fontFamily: BT.font.mono }}>{formatDate(j.completed_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
