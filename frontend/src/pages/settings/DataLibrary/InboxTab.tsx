import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../../services/api.client';

const MONO = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

interface LogEntry {
  step: string;
  status: 'ok' | 'blocked' | 'not_implemented' | 'error';
  ts: string;
  detail?: Record<string, unknown>;
}

interface IntakeJob {
  id: string;
  file_id: string | null;
  parcel_id: string | null;
  state: string;
  block_reason: string | null;
  user_input: Record<string, string> | null;
  source_type: string | null;
  source_data: Record<string, unknown> | null;
  enrichment_log: LogEntry[];
  created_at: string;
  updated_at: string;
  original_filename: string | null;
  document_type: string | null;
  size_bytes: number | null;
  mime_type: string | null;
}

interface IntakeSummary {
  pending?: number;
  parsing?: number;
  enriching?: number;
  complete?: number;
  blocked_needs_user?: number;
  failed?: number;
}

const STATE_FILTERS = ['ALL', 'pending', 'parsing', 'enriching', 'complete', 'blocked_needs_user', 'failed'];
const STATE_COLOR: Record<string, string> = {
  pending: '#8892b0', parsing: '#4fc3f7', enriching: '#a78bfa',
  complete: '#4ade80', blocked_needs_user: '#f59e0b', failed: '#e06c75',
};
const STATE_LABEL: Record<string, string> = {
  pending: 'PENDING', parsing: 'PARSING', enriching: 'ENRICHING',
  complete: 'COMPLETE', blocked_needs_user: 'NEEDS INFO', failed: 'FAILED',
};

function fmtDateTime(d: string | null): string {
  if (!d) return '\u2014';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const chipBtn = (active: boolean): React.CSSProperties => ({
  background: active ? '#1f3a5c' : 'transparent',
  border: `1px solid ${active ? '#388bfd' : '#30363d'}`,
  color: active ? '#4fc3f7' : '#8892b0',
  borderRadius: '12px', padding: '2px 10px', cursor: 'pointer',
  fontFamily: MONO, fontSize: 11,
});

export function InboxTab() {
  const [jobs, setJobs] = useState<IntakeJob[]>([]);
  const [summary, setSummary] = useState<IntakeSummary | null>(null);
  const [pagination, setPagination] = useState<{ total: number; page: number; limit: number; pages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (stateFilter !== 'ALL') params.set('state', stateFilter);
      params.set('page', String(page));
      params.set('limit', '25');
      const res = await apiClient.get(`/api/v1/intake-jobs?${params}`);
      setJobs(res.data.jobs || []);
      setPagination(res.data.pagination || null);
    } catch (err) {
      console.error('Failed to fetch intake jobs:', err);
    } finally { setLoading(false); }
  }, [stateFilter, page]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/v1/intake-jobs/summary');
      setSummary(res.data);
    } catch (err) {
      console.error('Failed to fetch intake summary:', err);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const submitUserInput = async (jobId: string, input: Record<string, string>) => {
    try {
      await apiClient.post(`/api/v1/intake-jobs/${jobId}/user-input`, input);
      fetchJobs();
      fetchSummary();
    } catch (err) {
      console.error('Failed to submit user input:', err);
    }
  };

  return (
    <div style={{ padding: '16px 20px' }}>
      {summary && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'PENDING', value: summary.pending ?? 0, color: '#8892b0' },
            { label: 'PARSING', value: summary.parsing ?? 0, color: '#4fc3f7' },
            { label: 'ENRICHING', value: summary.enriching ?? 0, color: '#a78bfa' },
            { label: 'COMPLETE', value: summary.complete ?? 0, color: '#4ade80' },
            { label: 'NEEDS INFO', value: summary.blocked_needs_user ?? 0, color: '#f59e0b' },
            { label: 'FAILED', value: summary.failed ?? 0, color: '#e06c75' },
          ].map((s, i) => (
            <div key={i} style={{ padding: '10px 14px', background: '#161b22', border: '1px solid #21262d', borderRadius: 6, minWidth: 80, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color, fontFamily: MONO }}>{s.value}</div>
              <div style={{ fontSize: 9, color: '#8892b0', fontFamily: MONO, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {STATE_FILTERS.map(sf => (
          <button key={sf} onClick={() => { setStateFilter(sf); setPage(1); }} style={chipBtn(stateFilter === sf)}>
            {sf === 'ALL' ? 'All' : (STATE_LABEL[sf] ?? sf)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#8892b0', padding: '40px', textAlign: 'center' }}>Loading jobs...</div>
      ) : jobs.length === 0 ? (
        <div style={{ color: '#8892b0', padding: '40px', textAlign: 'center' }}>No intake jobs match the current filter.</div>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ padding: '8px', textAlign: 'left', color: '#8892b0', fontWeight: 600, fontSize: 10, borderBottom: '2px solid #21262d' }}>Filename</th>
                <th style={{ padding: '8px', textAlign: 'left', color: '#8892b0', fontWeight: 600, fontSize: 10, borderBottom: '2px solid #21262d' }}>Type</th>
                <th style={{ padding: '8px', textAlign: 'left', color: '#8892b0', fontWeight: 600, fontSize: 10, borderBottom: '2px solid #21262d' }}>State</th>
                <th style={{ padding: '8px', textAlign: 'left', color: '#8892b0', fontWeight: 600, fontSize: 10, borderBottom: '2px solid #21262d' }}>Parcel</th>
                <th style={{ padding: '8px', textAlign: 'left', color: '#8892b0', fontWeight: 600, fontSize: 10, borderBottom: '2px solid #21262d' }}>Updated</th>
                <th style={{ padding: '8px' }}></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id} style={{ borderBottom: '1px solid #21262d' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#161b22'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                >
                  <td style={{ padding: '8px', color: '#cdd9e5', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {job.original_filename || '\u2014'}
                  </td>
                  <td style={{ padding: '8px' }}>
                    <span style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 3, padding: '1px 6px', fontSize: 10, color: '#93c5fd' }}>
                      {job.document_type || '\u2014'}
                    </span>
                  </td>
                  <td style={{ padding: '8px', color: STATE_COLOR[job.state] || '#8892b0', fontWeight: 600 }}>
                    {STATE_LABEL[job.state] || job.state}
                  </td>
                  <td style={{ padding: '8px', color: '#8892b0', fontSize: 10 }}>{job.parcel_id || '\u2014'}</td>
                  <td style={{ padding: '8px', color: '#8892b0', fontSize: 10 }}>{fmtDateTime(job.updated_at)}</td>
                  <td style={{ padding: '8px' }}>
                    {job.state === 'blocked_needs_user' && (
                      <button onClick={() => {
                        const pid = prompt('Enter parcel_id:');
                        if (pid) submitUserInput(job.id, { parcel_id: pid });
                      }}
                        style={{
                          background: '#f59e0b22', border: '1px solid #f59e0b44', color: '#f59e0b',
                          borderRadius: 3, padding: '3px 8px', cursor: 'pointer',
                          fontFamily: MONO, fontSize: 10,
                        }}
                      >Resolve</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagination && pagination.pages > 1 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', marginTop: 16 }}>
              <span style={{ color: '#8892b0', fontSize: 11 }}>
                Page {pagination.page} of {pagination.pages} \u00b7 {pagination.total.toLocaleString()} jobs
              </span>
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                style={{
                  background: 'none', border: '1px solid #30363d', color: page <= 1 ? '#30363d' : '#8892b0',
                  borderRadius: 4, padding: '4px 12px', cursor: page <= 1 ? 'default' : 'pointer',
                  fontFamily: MONO, fontSize: 11,
                }}
              >\u2190 Prev</button>
              <button disabled={page >= (pagination?.pages || 1)} onClick={() => setPage(page + 1)}
                style={{
                  background: 'none', border: '1px solid #30363d', color: page >= (pagination?.pages || 1) ? '#30363d' : '#8892b0',
                  borderRadius: 4, padding: '4px 12px', cursor: page >= (pagination?.pages || 1) ? 'default' : 'pointer',
                  fontFamily: MONO, fontSize: 11,
                }}
              >Next \u2192</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
