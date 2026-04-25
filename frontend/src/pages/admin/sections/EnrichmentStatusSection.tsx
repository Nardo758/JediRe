import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, AlertCircle, Play, CheckCircle, XCircle } from 'lucide-react';
import { apiClient } from '../../../services/api.client';
import { BT } from '@/components/deal/bloomberg-ui';
import { ContextIndicator } from '../../../components/intelligence/ContextIndicator';
import { useAutoContextAnalysis } from '../../../hooks/useContextAwareness';

interface EnrichmentCoverage {
  total_properties: number;
  geocoded: number;
  has_msa: number;
  has_submarket: number;
  has_parcel: number;
  has_market_data: number;
  has_census: number;
}

interface EnrichmentJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_properties: number;
  processed: number;
  errors: number;
  started_at: string | null;
  completed_at: string | null;
}

interface EnrichmentProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  geocoded: boolean;
  has_msa: boolean;
  has_submarket: boolean;
  has_parcel_data: boolean;
}

export function EnrichmentStatusSection() {
  // Neural network context awareness
  const { analysis: ctxAnalysis, loading: ctxLoading } = useAutoContextAnalysis({ context: 'property_card' });

  const [coverage, setCoverage] = useState<EnrichmentCoverage | null>(null);
  const [jobs, setJobs] = useState<EnrichmentJob[]>([]);
  const [properties, setProperties] = useState<EnrichmentProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/api/v1/admin/enrichment/status');
      setCoverage(res.data.coverage ?? null);
      setJobs(res.data.recent_jobs ?? []);
      setProperties(res.data.properties ?? []);
    } catch {
      setError('Enrichment status endpoint not available yet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const runBulkEnrichment = async () => {
    setRunning(true);
    try {
      await apiClient.post('/api/v1/admin/enrichment/enrich-bulk');
      await load();
    } catch {
      setError('Failed to start bulk enrichment');
    } finally {
      setRunning(false);
    }
  };

  const pct = (n: number | undefined, total: number) =>
    total > 0 && n !== undefined ? Math.round((n / total) * 100) : 0;

  const coverageBars = coverage
    ? [
        { label: 'Geocoded', value: pct(coverage.geocoded, coverage.total_properties) },
        { label: 'MSA Assigned', value: pct(coverage.has_msa, coverage.total_properties) },
        { label: 'Submarket Assigned', value: pct(coverage.has_submarket, coverage.total_properties) },
        { label: 'Parcel Data', value: pct(coverage.has_parcel, coverage.total_properties) },
        { label: 'Market Data', value: pct(coverage.has_market_data, coverage.total_properties) },
        { label: 'Census Demographics', value: pct(coverage.has_census, coverage.total_properties) },
      ]
    : [];

  return (
    <div className="p-6 space-y-6" style={{ fontFamily: BT.font.label }}>
      {ctxAnalysis && <ContextIndicator analysis={ctxAnalysis} loading={ctxLoading} compact />}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5" style={{ color: BT.text.cyan }} />
          <h2 className="text-lg font-semibold" style={{ color: BT.text.primary }}>Property Enrichment</h2>
          {coverage && (
            <span className="text-xs ml-1" style={{ color: BT.text.muted }}>
              ({coverage.total_properties.toLocaleString()} properties)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runBulkEnrichment}
            disabled={running || loading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 disabled:opacity-50"
            style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 2 }}
          >
            <Play className={`w-3 h-3 ${running ? 'animate-pulse' : ''}`} />
            {running ? 'Running...' : 'Run Bulk Enrichment'}
          </button>
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
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-sm" style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.text.amber}`, borderRadius: 0, color: BT.text.amber }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Coverage bars */}
      {coverageBars.length > 0 && (
        <div className="p-4 space-y-3" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
          <h3 className="text-sm font-semibold" style={{ color: BT.text.secondary }}>Enrichment Coverage</h3>
          {coverageBars.map(bar => (
            <div key={bar.label}>
              <div className="flex justify-between text-xs mb-1" style={{ color: BT.text.muted }}>
                <span>{bar.label}</span>
                <span style={{ fontFamily: BT.font.mono }}>{bar.value}%</span>
              </div>
              <div className="h-1.5 overflow-hidden" style={{ background: BT.bg.input, borderRadius: 0 }}>
                <div
                  className="h-full transition-all"
                  style={{ width: `${bar.value}%`, background: BT.text.cyan, borderRadius: 0 }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent jobs */}
      {jobs.length > 0 && (
        <div className="overflow-hidden" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${BT.border.subtle}`, background: BT.bg.header }}>
            <h3 className="text-sm font-semibold" style={{ color: BT.text.secondary }}>Recent Jobs</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: BT.text.muted }}>Status</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: BT.text.muted }}>Total</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: BT.text.muted }}>Processed</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: BT.text.muted }}>Errors</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: BT.text.muted }}>Started</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(j => (
                <tr key={j.id} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {j.status === 'completed' && <CheckCircle className="w-3.5 h-3.5" style={{ color: BT.text.green }} />}
                      {j.status === 'failed' && <XCircle className="w-3.5 h-3.5" style={{ color: BT.text.red }} />}
                      {j.status === 'running' && <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ color: BT.text.cyan }} />}
                      {j.status === 'pending' && <AlertCircle className="w-3.5 h-3.5" style={{ color: BT.text.amber }} />}
                      <span className="text-xs capitalize" style={{ color: BT.text.secondary }}>{j.status}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs" style={{ color: BT.text.secondary, fontFamily: BT.font.mono }}>{j.total_properties}</td>
                  <td className="px-4 py-2.5 text-right text-xs" style={{ color: BT.text.secondary, fontFamily: BT.font.mono }}>{j.processed}</td>
                  <td className="px-4 py-2.5 text-right text-xs" style={{ fontFamily: BT.font.mono }}>
                    <span style={{ color: j.errors > 0 ? BT.text.red : BT.text.muted }}>{j.errors}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: BT.text.muted, fontFamily: BT.font.mono }}>
                    {j.started_at ? new Date(j.started_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Per-property table */}
      {properties.length > 0 && (
        <div className="overflow-hidden" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${BT.border.subtle}`, background: BT.bg.header }}>
            <h3 className="text-sm font-semibold" style={{ color: BT.text.secondary }}>Properties Needing Enrichment</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: BT.text.muted }}>Property</th>
                <th className="text-center px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: BT.text.muted }}>Geo</th>
                <th className="text-center px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: BT.text.muted }}>MSA</th>
                <th className="text-center px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: BT.text.muted }}>Sub</th>
                <th className="text-center px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: BT.text.muted }}>Parcel</th>
              </tr>
            </thead>
            <tbody>
              {properties.map(p => (
                <tr key={p.id} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <td className="px-4 py-2.5">
                    <div className="text-xs font-medium" style={{ color: BT.text.primary }}>{p.address}</div>
                    <div className="text-xs" style={{ color: BT.text.muted }}>{p.city}, {p.state}</div>
                  </td>
                  {[p.geocoded, p.has_msa, p.has_submarket, p.has_parcel_data].map((v, i) => (
                    <td key={i} className="px-3 py-2.5 text-center">
                      {v
                        ? <CheckCircle className="w-3.5 h-3.5 mx-auto" style={{ color: BT.text.green }} />
                        : <XCircle className="w-3.5 h-3.5 mx-auto" style={{ color: BT.text.muted }} />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !coverage && jobs.length === 0 && (
        <div className="py-10 text-center" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
          <Database className="w-8 h-8 mx-auto mb-3" style={{ color: BT.text.muted }} />
          <p className="text-sm mb-1" style={{ color: BT.text.muted }}>Enrichment pipeline not yet initialized.</p>
          <p className="text-xs" style={{ color: BT.text.muted }}>Click "Run Bulk Enrichment" to start enriching property data.</p>
        </div>
      )}
    </div>
  );
}
