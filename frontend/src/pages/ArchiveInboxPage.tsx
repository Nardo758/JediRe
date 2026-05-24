import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api.client';

// ─── types ────────────────────────────────────────────────────────────────────

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

interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface Summary {
  pending?: number;
  parsing?: number;
  enriching?: number;
  complete?: number;
  blocked_needs_user?: number;
  failed?: number;
}

// ─── constants ────────────────────────────────────────────────────────────────

const STATE_FILTERS = ['ALL', 'pending', 'parsing', 'enriching', 'complete', 'blocked_needs_user', 'failed'];

const STATE_COLOR: Record<string, string> = {
  pending:            '#8892b0',
  parsing:            '#4fc3f7',
  enriching:          '#a78bfa',
  complete:           '#4ade80',
  blocked_needs_user: '#f59e0b',
  failed:             '#e06c75',
};

const STATE_LABEL: Record<string, string> = {
  pending:            'PENDING',
  parsing:            'PARSING',
  enriching:          'ENRICHING',
  complete:           'COMPLETE',
  blocked_needs_user: 'NEEDS INFO',
  failed:             'FAILED',
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

// ─── UserInputForm ────────────────────────────────────────────────────────────

function UserInputForm({
  jobId,
  onSubmit,
}: {
  jobId: string;
  onSubmit: (jobId: string, input: Record<string, string>) => void;
}) {
  const [parcelId, setParcelId] = useState('');
  const [address, setAddress]   = useState('');
  const [propName, setPropName] = useState('');
  const [saving, setSaving]     = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    const input: Record<string, string> = {};
    if (parcelId.trim()) input.parcel_id      = parcelId.trim();
    if (address.trim())  input.address        = address.trim();
    if (propName.trim()) input.property_name  = propName.trim();
    if (Object.keys(input).length === 0) return;
    setSaving(true);
    try {
      await onSubmit(jobId, input);
    } finally {
      setSaving(false);
    }
  };

  const inp = (value: string, setter: (v: string) => void, placeholder: string): React.CSSProperties => ({
    background: '#0d1117', border: '1px solid #30363d', color: '#cdd9e5',
    borderRadius: '4px', padding: '5px 10px', fontFamily: 'inherit',
    fontSize: '12px', outline: 'none', width: '180px',
  });

  return (
    <form onSubmit={handle} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '10px' }}>
      <span style={{ fontSize: '10px', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Provide one or more:
      </span>
      <input
        style={inp(parcelId, setParcelId, 'Parcel ID')}
        placeholder="Parcel ID"
        value={parcelId}
        onChange={e => setParcelId(e.target.value)}
      />
      <input
        style={inp(address, setAddress, 'Address')}
        placeholder="Address"
        value={address}
        onChange={e => setAddress(e.target.value)}
      />
      <input
        style={inp(propName, setPropName, 'Property name')}
        placeholder="Property name"
        value={propName}
        onChange={e => setPropName(e.target.value)}
      />
      <button
        type="submit"
        disabled={saving || (!parcelId.trim() && !address.trim() && !propName.trim())}
        style={{
          background: saving ? '#1f2937' : '#1f3a5c',
          border: '1px solid #388bfd', color: '#4fc3f7',
          borderRadius: '4px', padding: '5px 14px', cursor: saving ? 'default' : 'pointer',
          fontFamily: 'inherit', fontSize: '11px', letterSpacing: '0.05em',
        }}
      >
        {saving ? 'Saving…' : 'Requeue'}
      </button>
    </form>
  );
}

// ─── LogSummary ───────────────────────────────────────────────────────────────

function LogSummary({ log }: { log: LogEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!log || log.length === 0) return null;

  const dots = log.map((e, i) => (
    <span
      key={i}
      title={`${e.step}: ${e.status}`}
      style={{
        display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
        background: e.status === 'ok' ? '#4ade80' : e.status === 'blocked' ? '#f59e0b' : e.status === 'error' ? '#e06c75' : '#30363d',
        marginRight: '3px',
      }}
    />
  ));

  return (
    <div style={{ marginTop: '6px' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', color: '#8892b0',
          fontFamily: 'inherit', fontSize: '10px', padding: 0, display: 'flex', alignItems: 'center', gap: '6px',
        }}
      >
        {dots}
        <span>{log.length} steps {expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div style={{
          marginTop: '8px', background: '#161b22', border: '1px solid #21262d',
          borderRadius: '4px', padding: '8px 10px', fontSize: '11px',
        }}>
          {log.map((e, i) => (
            <div key={i} style={{ marginBottom: '4px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <span style={{
                color: e.status === 'ok' ? '#4ade80' : e.status === 'blocked' ? '#f59e0b' : e.status === 'error' ? '#e06c75' : '#8892b0',
                minWidth: '100px', fontWeight: 500,
              }}>
                {e.step}
              </span>
              <span style={{ color: '#8892b0' }}>{e.status}</span>
              {e.detail && (
                <span style={{ color: '#8892b0', fontSize: '10px', wordBreak: 'break-all' }}>
                  {JSON.stringify(e.detail).slice(0, 120)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ArchiveInboxPage() {
  const navigate = useNavigate();

  const [jobs, setJobs]             = useState<IntakeJob[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [summary, setSummary]       = useState<Summary>({});
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<string>('ALL');
  const [page, setPage]             = useState(1);
  const pollRef                     = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { page: String(page), limit: '50' };
      if (stateFilter !== 'ALL') params.state = stateFilter;
      const { data } = await apiClient.get('/api/v1/archive/inbox', { params });
      setJobs(data.jobs ?? []);
      setPagination(data.pagination ?? null);
      setSummary(data.summary ?? {});
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load inbox');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [stateFilter, page]);

  useEffect(() => { void load(); }, [load]);

  // auto-poll every 15s
  useEffect(() => {
    pollRef.current = setInterval(() => void load(true), 15_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  const handleUserInput = async (jobId: string, input: Record<string, string>) => {
    try {
      await apiClient.patch(`/api/v1/archive/inbox/${jobId}`, { user_input: input });
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, state: 'pending', block_reason: null, user_input: input } : j));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update job');
    }
  };

  // ── styles ──────────────────────────────────────────────────────────────────
  const S = {
    page: {
      minHeight: '100vh', background: '#0d1117', color: '#cdd9e5',
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '13px',
    } as React.CSSProperties,
    topBar: {
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '12px 20px', borderBottom: '1px solid #21262d', background: '#161b22',
    } as React.CSSProperties,
    backBtn: {
      background: 'none', border: '1px solid #30363d', color: '#8892b0',
      borderRadius: '4px', padding: '4px 10px', cursor: 'pointer',
      fontFamily: 'inherit', fontSize: '11px', letterSpacing: '0.05em',
    } as React.CSSProperties,
    navLink: (active: boolean): React.CSSProperties => ({
      background: 'none', border: 'none', cursor: 'pointer',
      fontFamily: 'inherit', fontSize: '11px', letterSpacing: '0.08em',
      color: active ? '#f0f6fc' : '#8892b0',
      borderBottom: active ? '2px solid #388bfd' : '2px solid transparent',
      padding: '2px 8px', textTransform: 'uppercase',
    }),
    main: { padding: '24px 28px' } as React.CSSProperties,
    summaryRow: {
      display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px',
    } as React.CSSProperties,
    summaryChip: (state: string, active: boolean): React.CSSProperties => ({
      background: active ? '#1f2937' : 'transparent',
      border: `1px solid ${active ? STATE_COLOR[state] ?? '#30363d' : '#30363d'}`,
      borderRadius: '4px', padding: '4px 12px', cursor: 'pointer',
      fontFamily: 'inherit', fontSize: '11px', letterSpacing: '0.06em',
      color: active ? (STATE_COLOR[state] ?? '#cdd9e5') : '#8892b0',
      display: 'flex', gap: '6px', alignItems: 'center',
    }),
    jobCard: {
      background: '#0d1117', border: '1px solid #21262d',
      borderRadius: '6px', padding: '14px 16px', marginBottom: '10px',
    } as React.CSSProperties,
    jobHeader: {
      display: 'flex', gap: '12px', alignItems: 'flex-start', justifyContent: 'space-between',
    } as React.CSSProperties,
    stateBadge: (state: string): React.CSSProperties => ({
      background: '#1f2937', border: `1px solid ${STATE_COLOR[state] ?? '#30363d'}`,
      color: STATE_COLOR[state] ?? '#cdd9e5',
      borderRadius: '3px', padding: '2px 8px',
      fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em',
      whiteSpace: 'nowrap',
    }),
    jobMeta: {
      color: '#8892b0', fontSize: '11px', display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '4px',
    } as React.CSSProperties,
    blockReason: {
      marginTop: '8px', padding: '6px 10px',
      background: '#1c1309', border: '1px solid #7c3c00',
      borderRadius: '4px', color: '#f59e0b', fontSize: '11px',
    } as React.CSSProperties,
  };

  const total = pagination?.total ?? 0;
  const blocked = summary.blocked_needs_user ?? 0;

  return (
    <div style={S.page}>
      {/* ── Top bar ── */}
      <div style={S.topBar}>
        <button style={S.backBtn} onClick={() => navigate('/terminal/dashboard')}>← Terminal</button>
        <span style={{ color: '#8892b0', fontSize: '11px', letterSpacing: '0.08em' }}>Archive</span>
        <span style={{ color: '#30363d' }}>/</span>
        <button style={S.navLink(false)} onClick={() => navigate('/archive/library')}>Library</button>
        <button style={S.navLink(true)}>Inbox</button>
        {blocked > 0 && (
          <span style={{
            background: '#7c3c00', color: '#f59e0b', borderRadius: '10px',
            fontSize: '10px', fontWeight: 600, padding: '1px 8px',
          }}>
            {blocked} need info
          </span>
        )}
      </div>

      <div style={S.main}>
        {/* ── Header ── */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '20px', fontWeight: 600, color: '#f0f6fc', marginBottom: '4px' }}>
            Intake Inbox
          </div>
          <div style={{ color: '#8892b0', fontSize: '12px' }}>
            {loading ? 'Loading…' : `${total.toLocaleString()} jobs · auto-refreshes every 15s`}
          </div>
        </div>

        {/* ── State filter summary ── */}
        <div style={S.summaryRow}>
          {STATE_FILTERS.map(s => {
            const count = s === 'ALL'
              ? Object.values(summary).reduce((a, b) => a + b, 0)
              : (summary as Record<string, number>)[s] ?? 0;
            return (
              <button
                key={s}
                style={S.summaryChip(s, stateFilter === s)}
                onClick={() => { setStateFilter(s); setPage(1); }}
              >
                <span>{s === 'ALL' ? 'All' : (STATE_LABEL[s] ?? s)}</span>
                <span style={{ opacity: 0.7 }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* ── Job list ── */}
        {error ? (
          <div style={{ color: '#e06c75', padding: '20px 0' }}>{error}</div>
        ) : loading ? (
          <div style={{ color: '#8892b0', textAlign: 'center', padding: '60px 0' }}>Loading…</div>
        ) : jobs.length === 0 ? (
          <div style={{ color: '#8892b0', textAlign: 'center', padding: '60px 0' }}>
            No jobs match the current filter.
          </div>
        ) : (
          jobs.map(job => {
            const displayName = job.parcel_id
              || (job.source_data as any)?.name
              || (job.source_data as any)?.address
              || job.original_filename
              || job.id.slice(0, 8);

            return (
              <div key={job.id} style={S.jobCard}>
                <div style={S.jobHeader}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#f0f6fc', fontWeight: 500, marginBottom: '2px', wordBreak: 'break-word' }}>
                      {displayName}
                    </div>
                    <div style={S.jobMeta}>
                      {job.original_filename && (
                        <span title={job.original_filename}>
                          📄 {job.original_filename.length > 40 ? job.original_filename.slice(0, 40) + '…' : job.original_filename}
                        </span>
                      )}
                      {job.document_type && <span>{job.document_type}</span>}
                      {job.size_bytes && <span>{fmtSize(job.size_bytes)}</span>}
                      <span>src: {job.source_type ?? '—'}</span>
                      <span>updated {fmtDate(job.updated_at)}</span>
                    </div>
                  </div>
                  <span style={S.stateBadge(job.state)}>
                    {STATE_LABEL[job.state] ?? job.state}
                  </span>
                </div>

                {job.block_reason && (
                  <div style={S.blockReason}>
                    {job.block_reason}
                  </div>
                )}

                {job.state === 'blocked_needs_user' && (
                  <UserInputForm jobId={job.id} onSubmit={handleUserInput} />
                )}

                <LogSummary log={job.enrichment_log ?? []} />
              </div>
            );
          })
        )}

        {/* ── Pagination ── */}
        {pagination && pagination.pages > 1 && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end', marginTop: '16px' }}>
            <span style={{ color: '#8892b0', fontSize: '11px' }}>
              Page {pagination.page} of {pagination.pages}
            </span>
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              style={{
                background: 'none', border: '1px solid #30363d', color: page <= 1 ? '#30363d' : '#8892b0',
                borderRadius: '4px', padding: '4px 12px', cursor: page <= 1 ? 'default' : 'pointer',
                fontFamily: 'inherit', fontSize: '11px',
              }}
            >
              ← Prev
            </button>
            <button
              disabled={page >= pagination.pages}
              onClick={() => setPage(p => p + 1)}
              style={{
                background: 'none', border: '1px solid #30363d',
                color: page >= pagination.pages ? '#30363d' : '#8892b0',
                borderRadius: '4px', padding: '4px 12px', cursor: page >= pagination.pages ? 'default' : 'pointer',
                fontFamily: 'inherit', fontSize: '11px',
              }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
