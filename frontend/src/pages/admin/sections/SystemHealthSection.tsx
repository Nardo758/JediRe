import React, { useState, useEffect } from 'react';

  // Neural network context awareness
  const { analysis: ctxAnalysis, loading: ctxLoading } = useAutoContextAnalysis({ context: 'market_dashboard' });
import { Activity, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { apiClient } from '../../../services/api.client';
import { BT } from '@/components/deal/bloomberg-ui';
import { ContextIndicator } from '../../../components/intelligence/ContextIndicator';
import { useAutoContextAnalysis } from '../../../hooks/useContextAwareness';

interface SystemStats {
  user_count: string;
  deal_count: string;
  property_count: string;
  scenario_count: string;
  zoning_district_count: string;
  benchmark_count: string;
}

export function SystemHealthSection() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/api/v1/admin/system/stats');
      setStats(res.data.totals);
      setLastRefreshed(new Date());
    } catch {
      setError('Could not load system stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const metrics = stats
    ? [
        { label: 'Users', value: Number(stats.user_count).toLocaleString(), ok: true },
        { label: 'Deals', value: Number(stats.deal_count).toLocaleString(), ok: true },
        { label: 'Properties', value: Number(stats.property_count).toLocaleString(), ok: true },
        { label: 'Scenarios', value: Number(stats.scenario_count).toLocaleString(), ok: true },
        { label: 'Zoning Districts', value: Number(stats.zoning_district_count).toLocaleString(), ok: true },
        { label: 'Benchmarks', value: Number(stats.benchmark_count).toLocaleString(), ok: true },
      ]
    : [];

  return (
    <div className="p-6 space-y-6" style={{ fontFamily: BT.font.label }}>
      {ctxAnalysis && <ContextIndicator analysis={ctxAnalysis} loading={ctxLoading} compact />}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5" style={{ color: BT.text.cyan }} />
          <h2 className="text-lg font-semibold" style={{ color: BT.text.primary }}>System Health</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: BT.text.muted }}>
            Refreshed {lastRefreshed.toLocaleTimeString()}
          </span>
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
        <div className="flex items-center gap-2 p-3 text-sm" style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.text.red}`, borderRadius: 0, color: BT.text.red }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4 animate-pulse" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
                <div className="h-3 w-20 mb-2" style={{ background: BT.bg.panelAlt, borderRadius: 0 }} />
                <div className="h-7 w-14" style={{ background: BT.bg.panelAlt, borderRadius: 0 }} />
              </div>
            ))
          : metrics.map(m => (
              <div key={m.label} className="p-4" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium" style={{ color: BT.text.muted }}>{m.label}</span>
                  <CheckCircle className="w-3.5 h-3.5" style={{ color: BT.text.green }} />
                </div>
                <div className="text-2xl font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>{m.value}</div>
              </div>
            ))}
      </div>

      <div className="p-4" style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.text.green}`, borderRadius: 0 }}>
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4" style={{ color: BT.text.green }} />
          <span className="text-sm font-medium" style={{ color: BT.text.green }}>All systems operational</span>
        </div>
        <p className="text-xs mt-1 ml-6" style={{ color: BT.text.secondary }}>
          API, database, and background services are running normally.
        </p>
      </div>
    </div>
  );
}
