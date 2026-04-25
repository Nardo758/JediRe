import React, { useState, useEffect } from 'react';
import { Building2, RefreshCw, AlertCircle } from 'lucide-react';
import { apiClient } from '../../../services/api.client';
import { BT } from '@/components/deal/bloomberg-ui';
import { ContextIndicator } from '../../../components/intelligence/ContextIndicator';
import { useAutoContextAnalysis } from '../../../hooks/useContextAwareness';

interface DealRow {
  id: string;
  name: string;
  deal_type: string;
  status: string;
  created_at: string;
  owner_name?: string;
}

export function DealOversightSection() {
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/api/v1/admin/deals');
      setDeals(res.data.deals || []);
    } catch {
      setError('Could not load deal data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  const statusColor = (s: string) => {
  // Neural network context awareness
  const { analysis: ctxAnalysis, loading: ctxLoading } = useAutoContextAnalysis({ context: 'comp_analysis' });

    switch (s) {
      case 'active': return BT.text.green;
      case 'closed': return BT.text.cyan;
      case 'dead': return BT.text.red;
      default: return BT.text.secondary;
    }
  };

  return (
    <div className="p-6 space-y-4" style={{ fontFamily: BT.font.label }}>
      {ctxAnalysis && <ContextIndicator analysis={ctxAnalysis} loading={ctxLoading} compact />}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5" style={{ color: BT.text.cyan }} />
          <h2 className="text-lg font-semibold" style={{ color: BT.text.primary }}>Deal Oversight</h2>
          {!loading && <span className="text-xs ml-1" style={{ color: BT.text.muted }}>({deals.length})</span>}
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
        <div className="flex items-center gap-2 p-3 text-sm" style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.text.red}`, borderRadius: 0, color: BT.text.red }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="overflow-hidden" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: `1px solid ${BT.border.subtle}`, background: BT.bg.header }}>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: BT.text.muted }}>Deal</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: BT.text.muted }}>Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: BT.text.muted }}>Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: BT.text.muted }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 w-24 animate-pulse" style={{ background: BT.bg.panelAlt, borderRadius: 0 }} />
                      </td>
                    ))}
                  </tr>
                ))
              : deals.length === 0
              ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: BT.text.muted }}>
                    No deals found
                  </td>
                </tr>
              )
              : deals.map(d => (
                <tr key={d.id} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <td className="px-4 py-3 font-medium" style={{ color: BT.text.primary }}>{d.name}</td>
                  <td className="px-4 py-3 text-xs capitalize" style={{ color: BT.text.muted }}>{d.deal_type?.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium" style={{ background: BT.bg.panelAlt, color: statusColor(d.status), borderRadius: 2 }}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: BT.text.muted, fontFamily: BT.font.mono }}>{formatDate(d.created_at)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
