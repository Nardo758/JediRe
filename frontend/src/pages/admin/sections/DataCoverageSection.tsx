import React, { useState, useEffect } from 'react';
import { Map, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../../services/api.client';
import { BT } from '@/components/deal/bloomberg-ui';
import { ContextIndicator } from '../../../components/intelligence/ContextIndicator';
import { useAutoContextAnalysis } from '../../../hooks/useContextAwareness';

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

  // Neural network context awareness
  const { analysis: ctxAnalysis, loading: ctxLoading } = useAutoContextAnalysis({ context: 'market_dashboard' });

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
      case 'active': return BT.text.green;
      case 'pending': return BT.text.amber;
      case 'error': return BT.text.red;
      default: return BT.text.secondary;
    }
  };

  return (
    <div className="p-6 space-y-4" style={{ fontFamily: BT.font.label }}>
      {ctxAnalysis && <ContextIndicator analysis={ctxAnalysis} loading={ctxLoading} compact />}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Map className="w-5 h-5" style={{ color: BT.text.cyan }} />
          <h2 className="text-lg font-semibold" style={{ color: BT.text.primary }}>Data Coverage</h2>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/property-coverage"
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5"
            style={{ color: BT.text.cyan, border: `1px solid ${BT.text.cyan}`, borderRadius: 2 }}
          >
            <ExternalLink className="w-3 h-3" />
            Full Coverage Map
          </Link>
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
          {error} — showing summary only
        </div>
      )}

      {counties.length > 0 ? (
        <div className="overflow-hidden" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${BT.border.subtle}`, background: BT.bg.header }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: BT.text.muted }}>County / State</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: BT.text.muted }}>Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: BT.text.muted }}>Properties</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: BT.text.muted }}>Last Scraped</th>
              </tr>
            </thead>
            <tbody>
              {counties.map((c, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <td className="px-4 py-3 font-medium" style={{ color: BT.text.primary }}>
                    {c.county}, {c.state}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium" style={{ background: BT.bg.panelAlt, color: statusColor(c.status), borderRadius: 2 }}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs" style={{ color: BT.text.secondary, fontFamily: BT.font.mono }}>
                    {c.property_count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: BT.text.muted, fontFamily: BT.font.mono }}>{formatDate(c.last_scraped)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !loading && (
        <div className="p-8 text-center" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
          <Map className="w-8 h-8 mx-auto mb-3" style={{ color: BT.text.muted }} />
          <p className="text-sm mb-3" style={{ color: BT.text.muted }}>No county coverage data configured yet.</p>
          <Link
            to="/admin/property-coverage"
            className="inline-flex items-center gap-1.5 text-sm"
            style={{ color: BT.text.cyan }}
          >
            <ExternalLink className="w-4 h-4" />
            Open Coverage Map
          </Link>
        </div>
      )}
    </div>
  );
}
