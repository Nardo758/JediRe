/**
 * F8AdminView - Platform Administration
 * 
 * Admin-only functions, distinct from F9 user settings.
 * Organized into:
 * - PLATFORM: System health, jobs, agents, users
 * - INTELLIGENCE: Deal oversight, enrichment, data coverage
 * - LIFECYCLE: Dispositions, reforecasts, debt, learning
 * - ORGANIZATION: Team management, integrations, compliance
 * 
 * REMOVED (moved to F9 Settings):
 * - AI Config → F9 ai-model
 * - Notifications → F9 notifications  
 * - Templates → F9 templates ✓
 * - Billing → F9 subscription
 * - User Integrations → F9 integrations
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../../services/api.client';

// Existing section imports
import { SystemHealthSection } from '../admin/sections/SystemHealthSection';
import { BackgroundJobsSection } from '../admin/sections/BackgroundJobsSection';
import { AgentsPlatformSection } from '../admin/sections/AgentsPlatformSection';
import { UserManagementSection } from '../admin/sections/UserManagementSection';
import { DealOversightSection } from '../admin/sections/DealOversightSection';
import { EnrichmentStatusSection } from '../admin/sections/EnrichmentStatusSection';
import { DataCoverageSection } from '../admin/sections/DataCoverageSection';
import DataRoomSection from '../admin/sections/DataRoomSection';
import DataManagementSection from '../admin/sections/DataManagementSection';
import VerificationSection from '../admin/sections/VerificationSection';
import TeamSection from '../admin/sections/TeamSection';

// Theme type
interface ThemeType {
  bg: { terminal: string; panel: string; panelAlt: string; header: string; hover: string; active: string; input: string; topBar: string };
  text: { primary: string; secondary: string; muted: string; amber: string; amberBright: string; green: string; red: string; cyan: string; orange: string; purple: string; white: string };
  border: { subtle: string; medium: string; bright: string };
  font: { mono: string; display: string; label: string };
}

interface NavItem {
  key: string;
  label: string;
  icon: string;
  description: string;
  group: 'platform' | 'intel' | 'lifecycle' | 'org';
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  // Platform Group (System Operations)
  { key: 'health', label: 'SYSTEM HEALTH', icon: '💚', description: 'Uptime, errors, metrics', group: 'platform' },
  { key: 'jobs', label: 'BACKGROUND JOBS', icon: '⚙️', description: 'Queues, workers', group: 'platform' },
  { key: 'agents', label: 'AI AGENTS', icon: '🤖', description: 'Runs, performance', group: 'platform' },
  { key: 'users', label: 'PLATFORM USERS', icon: '👤', description: 'All users, activity', group: 'platform' },
  
  // Intelligence Group (Data Quality)
  { key: 'deals', label: 'DEAL OVERSIGHT', icon: '📊', description: 'All deals, scores', group: 'intel' },
  { key: 'enrichment', label: 'ENRICHMENT', icon: '✨', description: 'Data pipelines', group: 'intel' },
  { key: 'coverage', label: 'DATA COVERAGE', icon: '🗺️', description: 'Geographic map', group: 'intel' },
  
  // Lifecycle Group
  { key: 'lifecycle', label: 'LIFECYCLE MONITOR', icon: '🔄', description: 'Dispositions, debt', group: 'lifecycle', badge: 'NEW' },
  { key: 'learning', label: 'LEARNING SYSTEM', icon: '🧠', description: 'Calibration', group: 'lifecycle', badge: 'NEW' },
  { key: 'compsets', label: 'COMP SETS', icon: '🏘️', description: 'Pricing alerts', group: 'lifecycle' },
  { key: 'marketdata', label: 'MARKET DATA', icon: '📡', description: 'Data connections', group: 'lifecycle' },
  
  // Organization Group (NEW - Multi-tenant, integrations)
  { key: 'team', label: 'TEAM MANAGEMENT', icon: '👥', description: 'Members, roles', group: 'org' },
  { key: 'orgintegrations', label: 'ORG INTEGRATIONS', icon: '🔌', description: 'DocuSign, Plaid, etc', group: 'org', badge: 'NEW' },
  { key: 'dataroom', label: 'DATA ROOM', icon: '📁', description: 'Secure sharing', group: 'org' },
  { key: 'verification', label: 'KYC / COMPLIANCE', icon: '✅', description: 'Identity checks', group: 'org' },
  { key: 'dataops', label: 'DATA OPERATIONS', icon: '📦', description: 'Import/export', group: 'org' },
];

const GROUP_LABELS: Record<string, string> = {
  platform: '⚡ PLATFORM',
  intel: '🔍 INTELLIGENCE',
  lifecycle: '🔄 LIFECYCLE',
  org: '🏢 ORGANIZATION',
};

interface F8AdminViewProps {
  T: ThemeType;
}

// ═══════════════════════════════════════════════════════════════════
// LIFECYCLE SECTIONS
// ═══════════════════════════════════════════════════════════════════

function LifecycleMonitorSection({ T }: { T: ThemeType }) {
  const [stats, setStats] = useState<any>(null);
  const [maturities, setMaturities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiClient.get('/api/v1/lifecycle/dispositions/stats').catch(() => ({ data: {} })),
      apiClient.get('/api/v1/lifecycle/debt/maturities?months=12').catch(() => ({ data: { maturities: [] } })),
    ]).then(([statsRes, matRes]) => {
      setStats(statsRes.data);
      setMaturities(matRes.data?.maturities ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const StatCard = ({ label, value, color, icon }: { label: string; value: number | string; color: string; icon: string }) => (
    <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 9, color: T.text.muted, letterSpacing: 1 }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color, fontFamily: T.font.mono }}>{value}</div>
    </div>
  );

  if (loading) return <div style={{ padding: 20, color: T.text.muted }}>Loading...</div>;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.text.primary, marginBottom: 16, fontFamily: T.font.mono }}>
        LIFECYCLE MONITORING
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard label="TOTAL DISPOSITIONS" value={stats?.totalDispositions ?? 0} color={T.text.green} icon="🏷️" />
        <StatCard label="AVG IRR VARIANCE" value={stats?.avgIrrVarianceBps ? `${stats.avgIrrVarianceBps > 0 ? '+' : ''}${Math.round(stats.avgIrrVarianceBps)}bps` : '—'} color={T.text.amber} icon="📈" />
        <StatCard label="DEBT MATURING <12MO" value={maturities.length} color={maturities.length > 0 ? T.text.red : T.text.muted} icon="⏰" />
        <StatCard label="OUTPERFORMED %" value={stats?.outperformedPct ? `${Math.round(stats.outperformedPct)}%` : '—'} color={T.text.cyan} icon="🎯" />
      </div>

      {maturities.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.text.amber, marginBottom: 8, letterSpacing: 1 }}>
            ⚠️ UPCOMING LOAN MATURITIES
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: T.bg.header }}>
                {['DEAL', 'LENDER', 'BALANCE', 'MATURITY', 'DAYS', 'STATUS'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', fontSize: 9, color: T.text.muted, textAlign: 'left', fontFamily: T.font.mono }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {maturities.slice(0, 8).map((m: any, i: number) => (
                <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}`, background: i % 2 === 0 ? T.bg.panel : T.bg.panelAlt }}>
                  <td style={{ padding: '8px 10px', fontSize: 10, color: T.text.primary, fontWeight: 600 }}>{m.dealName}</td>
                  <td style={{ padding: '8px 10px', fontSize: 10, color: T.text.secondary }}>{m.lenderName || '—'}</td>
                  <td style={{ padding: '8px 10px', fontSize: 10, fontFamily: T.font.mono }}>${(m.currentBalance / 1e6).toFixed(1)}M</td>
                  <td style={{ padding: '8px 10px', fontSize: 10, color: T.text.secondary }}>{new Date(m.maturityDate).toLocaleDateString()}</td>
                  <td style={{ padding: '8px 10px', fontSize: 10, fontWeight: 700, color: m.daysToMaturity < 90 ? T.text.red : m.daysToMaturity < 180 ? T.text.orange : T.text.muted }}>{m.daysToMaturity}d</td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', background: m.urgency === 'critical' ? T.text.red + '22' : T.text.muted + '22', color: m.urgency === 'critical' ? T.text.red : T.text.muted }}>{m.urgency?.toUpperCase() || 'OK'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LearningSystemSection({ T }: { T: ThemeType }) {
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/api/v1/learning/adjustments?limit=20')
      .then(res => setAdjustments(res.data?.adjustments ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 20, color: T.text.muted }}>Loading...</div>;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.text.primary, marginBottom: 8, fontFamily: T.font.mono }}>
        🧠 LEARNING SYSTEM
      </div>
      <div style={{ fontSize: 10, color: T.text.secondary, marginBottom: 20 }}>
        Calibration adjustments derived from operations actuals and disposition outcomes.
      </div>

      {adjustments.length === 0 ? (
        <div style={{ background: T.bg.panel, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>📚</div>
          <div style={{ fontSize: 11, color: T.text.secondary }}>No adjustments yet</div>
          <div style={{ fontSize: 9, color: T.text.muted, marginTop: 4 }}>Feed actuals or record dispositions to generate learnings</div>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: T.bg.header }}>
              {['ASSUMPTION', 'STATE', 'MSA', 'CLASS', 'BIAS', 'ADJUSTMENT', 'CONF', 'N'].map(h => (
                <th key={h} style={{ padding: '8px 10px', fontSize: 9, color: T.text.muted, textAlign: 'left', fontFamily: T.font.mono }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {adjustments.map((adj: any, i: number) => (
              <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
                <td style={{ padding: '8px 10px', fontSize: 10, color: T.text.primary, fontWeight: 600 }}>{adj.assumptionName?.replace(/_/g, ' ')}</td>
                <td style={{ padding: '8px 10px', fontSize: 10, color: T.text.secondary }}>{adj.state || '—'}</td>
                <td style={{ padding: '8px 10px', fontSize: 10, color: T.text.secondary }}>{adj.msa || '—'}</td>
                <td style={{ padding: '8px 10px', fontSize: 10, color: T.text.amber }}>{adj.assetClass || '—'}</td>
                <td style={{ padding: '8px 10px', fontSize: 10, fontFamily: T.font.mono, color: adj.avgBias > 0 ? T.text.green : T.text.red }}>{adj.avgBias > 0 ? '+' : ''}{(adj.avgBias * 100).toFixed(1)}%</td>
                <td style={{ padding: '8px 10px', fontSize: 10, fontFamily: T.font.mono, color: T.text.cyan }}>{adj.recommendedAdjustment > 0 ? '+' : ''}{(adj.recommendedAdjustment * 100).toFixed(2)}%</td>
                <td style={{ padding: '8px 10px', fontSize: 10, color: adj.confidenceScore > 0.7 ? T.text.green : T.text.muted }}>{(adj.confidenceScore * 100).toFixed(0)}%</td>
                <td style={{ padding: '8px 10px', fontSize: 10, color: T.text.muted }}>{adj.sampleSize}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

interface CompProp {
  id: string;
  property_name: string;
  address: string | null;
  submarket: string | null;
  distance_mi: number | null;
  avg_rent_sf: number | null;
  occupancy_pct: number | null;
  last_scraped: string | null;
}

interface PropertySearchResult {
  id: string;
  property_name: string;
  address: string;
  city: string | null;
  state: string | null;
  submarket: string | null;
  units: number | null;
}

function CompetitiveSetsSection({ T }: { T: ThemeType }) {
  const [comps, setComps] = useState<CompProp[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Add comp form state (city/state populated from search result, not shown as fields)
  const [form, setForm] = useState({ property_name: '', address: '', city: '', state: '', submarket: '', distance_mi: '', avg_rent_sf: '', occupancy_pct: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PropertySearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiClient.get('/api/v1/admin/comp-sets')
      .then(r => setComps(r.data.comps ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(() => {
      setSearchLoading(true);
      apiClient.get(`/api/v1/admin/comp-sets/property-search?q=${encodeURIComponent(q)}`)
        .then(r => setSearchResults(r.data.results ?? []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 350);
  };

  const selectProperty = (p: PropertySearchResult) => {
    setForm(f => ({
      ...f,
      property_name: f.property_name || p.property_name,
      address: p.address,
      city: p.city ?? '',
      state: p.state ?? '',
      submarket: f.submarket || p.submarket || '',
    }));
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleAdd = async () => {
    if (!form.property_name.trim()) { setError('Property name is required'); return; }
    setSaving(true);
    setError(null);
    try {
      await apiClient.post('/api/v1/admin/comp-sets', {
        property_name: form.property_name,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        submarket: form.submarket || null,
        distance_mi: form.distance_mi ? parseFloat(form.distance_mi) : null,
        avg_rent_sf: form.avg_rent_sf ? parseFloat(form.avg_rent_sf) : null,
        occupancy_pct: form.occupancy_pct ? parseFloat(form.occupancy_pct) : null,
      });
      setShowModal(false);
      setForm({ property_name: '', address: '', city: '', state: '', submarket: '', distance_mi: '', avg_rent_sf: '', occupancy_pct: '' });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to add comp');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await apiClient.delete(`/api/v1/admin/comp-sets/${id}`);
      setComps(c => c.filter(x => x.id !== id));
    } catch {}
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', fontSize: 10, padding: '5px 8px',
    background: T.bg.panelAlt, border: `1px solid ${T.border.medium}`,
    color: T.text.primary, outline: 'none', fontFamily: T.font.mono, boxSizing: 'border-box',
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text.primary, fontFamily: T.font.mono }}>
          🏘️ COMPETITIVE SET MONITORING
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{ fontSize: 10, fontWeight: 700, padding: '5px 14px', background: T.text.amber, color: T.bg.terminal, border: 'none', cursor: 'pointer' }}
        >
          + ADD COMP
        </button>
      </div>
      <div style={{ fontSize: 10, color: T.text.secondary, marginBottom: 16 }}>
        Org-wide comp properties tracked for pricing benchmarks and variance alerts.
      </div>

      {loading ? (
        <div style={{ padding: 20, color: T.text.muted, fontSize: 10 }}>Loading...</div>
      ) : comps.length === 0 ? (
        <div style={{ background: T.bg.panel, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>🏘️</div>
          <div style={{ fontSize: 11, color: T.text.secondary }}>No comp properties configured</div>
          <div style={{ fontSize: 9, color: T.text.muted, marginTop: 4 }}>Click "+ ADD COMP" to add your first comp property</div>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: T.bg.header }}>
              {['PROPERTY', 'SUBMARKET', 'DIST (MI)', 'AVG RENT/SF', 'OCC %', 'LAST SCRAPED', ''].map(h => (
                <th key={h} style={{ padding: '8px 10px', fontSize: 9, color: T.text.muted, textAlign: 'left', fontFamily: T.font.mono, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comps.map((c, i) => (
              <tr key={c.id} style={{ borderBottom: `1px solid ${T.border.subtle}`, background: i % 2 === 0 ? T.bg.panel : T.bg.panelAlt }}>
                <td style={{ padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: T.text.primary }}>{c.property_name}</div>
                  {c.address && <div style={{ fontSize: 9, color: T.text.muted }}>{c.address}</div>}
                </td>
                <td style={{ padding: '8px 10px', fontSize: 10, color: T.text.secondary }}>{c.submarket || '—'}</td>
                <td style={{ padding: '8px 10px', fontSize: 10, fontFamily: T.font.mono, color: T.text.secondary }}>{c.distance_mi != null ? c.distance_mi.toFixed(1) : '—'}</td>
                <td style={{ padding: '8px 10px', fontSize: 10, fontFamily: T.font.mono }}>{c.avg_rent_sf != null ? `$${c.avg_rent_sf.toFixed(2)}` : '—'}</td>
                <td style={{ padding: '8px 10px', fontSize: 10, fontFamily: T.font.mono, color: c.occupancy_pct != null && c.occupancy_pct < 88 ? T.text.red : T.text.green }}>{c.occupancy_pct != null ? `${c.occupancy_pct.toFixed(1)}%` : '—'}</td>
                <td style={{ padding: '8px 10px', fontSize: 9, color: T.text.muted }}>{c.last_scraped ? new Date(c.last_scraped).toLocaleDateString() : '—'}</td>
                <td style={{ padding: '8px 10px' }}>
                  <button
                    onClick={() => handleRemove(c.id)}
                    style={{ fontSize: 9, color: T.text.red, background: 'transparent', border: `1px solid ${T.text.red}44`, padding: '3px 8px', cursor: 'pointer' }}
                  >
                    REMOVE
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Add Comp Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000088', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: T.bg.panel, border: `1px solid ${T.border.bright}`, width: 480, padding: 24, position: 'relative' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.text.primary, marginBottom: 16, fontFamily: T.font.mono }}>+ ADD COMP PROPERTY</div>

            {/* Property search */}
            <div style={{ marginBottom: 14, position: 'relative' }}>
              <div style={{ fontSize: 9, color: T.text.secondary, marginBottom: 4, fontFamily: T.font.mono }}>SEARCH PROPERTY RECORDS</div>
              <input
                type="text"
                placeholder="Type address or owner name..."
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                style={inputStyle}
              />
              {searchLoading && <div style={{ fontSize: 9, color: T.text.muted, marginTop: 2 }}>Searching...</div>}
              {searchResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: T.bg.panelAlt, border: `1px solid ${T.border.medium}`, zIndex: 10, maxHeight: 160, overflowY: 'auto' }}>
                  {searchResults.map(p => (
                    <div
                      key={p.id}
                      onClick={() => selectProperty(p)}
                      style={{ padding: '6px 10px', fontSize: 10, color: T.text.primary, cursor: 'pointer', borderBottom: `1px solid ${T.border.subtle}` }}
                      onMouseEnter={e => (e.currentTarget.style.background = T.bg.hover)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ fontWeight: 600 }}>{p.property_name}</div>
                      <div style={{ fontSize: 9, color: T.text.muted }}>{[p.address, p.city, p.state].filter(Boolean).join(', ')} · {p.submarket ?? ''} · {p.units ?? '?'} units</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {([
                { key: 'property_name', label: 'PROPERTY NAME *', placeholder: 'The Lofts at Midtown' },
                { key: 'address', label: 'ADDRESS', placeholder: '123 Main St, Atlanta, GA' },
                { key: 'submarket', label: 'SUBMARKET', placeholder: 'Midtown' },
                { key: 'distance_mi', label: 'DISTANCE (MI)', placeholder: '0.8' },
                { key: 'avg_rent_sf', label: 'AVG RENT / SF', placeholder: '1.95' },
                { key: 'occupancy_pct', label: 'OCCUPANCY %', placeholder: '93.5' },
              ] as { key: keyof typeof form; label: string; placeholder: string }[]).map(f => (
                <div key={f.key}>
                  <div style={{ fontSize: 9, color: T.text.secondary, marginBottom: 2, fontFamily: T.font.mono }}>{f.label}</div>
                  <input
                    type="text"
                    placeholder={f.placeholder}
                    value={form[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>

            {error && (
              <div style={{ fontSize: 9, color: T.text.red, marginBottom: 10, padding: '4px 8px', background: T.text.red + '11', border: `1px solid ${T.text.red}44` }}>{error}</div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleAdd}
                disabled={saving}
                style={{ fontSize: 10, fontWeight: 700, padding: '6px 16px', background: T.text.amber, color: T.bg.terminal, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'SAVING...' : 'ADD COMP'}
              </button>
              <button
                onClick={() => { setShowModal(false); setError(null); setSearchQuery(''); setSearchResults([]); setForm({ property_name: '', address: '', city: '', state: '', submarket: '', distance_mi: '', avg_rent_sf: '', occupancy_pct: '' }); }}
                style={{ fontSize: 10, padding: '6px 14px', background: 'transparent', color: T.text.muted, border: `1px solid ${T.border.medium}`, cursor: 'pointer' }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface PricingAlertRule {
  id: string;
  submarket: string;
  metric: 'avg_rent' | 'occupancy';
  threshold_pct: number;
  direction: 'above' | 'below';
  notification_pref: 'email' | 'sms' | 'both' | 'none';
  is_enabled: boolean;
  created_at: string;
}

const EMPTY_ALERT_FORM = { submarket: '', metric: 'avg_rent' as const, threshold_pct: '', direction: 'below' as const, notification_pref: 'email' as const };

function MarketDataSection({ T }: { T: ThemeType }) {
  const [alerts, setAlerts] = useState<PricingAlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_ALERT_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadAlerts = useCallback(() => {
    setLoading(true);
    apiClient.get('/api/v1/admin/pricing-alerts')
      .then(r => setAlerts(r.data.alerts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  const handleAdd = async () => {
    if (!form.submarket.trim()) { setFormError('Submarket is required'); return; }
    if (!form.threshold_pct || isNaN(parseFloat(form.threshold_pct))) { setFormError('Threshold must be a number'); return; }
    setSaving(true);
    setFormError(null);
    try {
      await apiClient.post('/api/v1/admin/pricing-alerts', {
        submarket: form.submarket,
        metric: form.metric,
        threshold_pct: parseFloat(form.threshold_pct),
        direction: form.direction,
        notification_pref: form.notification_pref,
      });
      setShowForm(false);
      setForm(EMPTY_ALERT_FORM);
      loadAlerts();
    } catch (e: any) {
      setFormError(e?.response?.data?.error || 'Failed to save alert');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (alert: PricingAlertRule) => {
    try {
      await apiClient.put(`/api/v1/admin/pricing-alerts/${alert.id}`, { is_enabled: !alert.is_enabled });
      setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, is_enabled: !a.is_enabled } : a));
    } catch {}
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/api/v1/admin/pricing-alerts/${id}`);
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch {}
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', fontSize: 10, padding: '5px 8px',
    background: T.bg.panelAlt, border: `1px solid ${T.border.medium}`,
    color: T.text.primary, outline: 'none', fontFamily: T.font.mono, boxSizing: 'border-box',
  };

  const metricLabel = (m: string) => m === 'avg_rent' ? 'Avg Rent/SF' : 'Occupancy %';
  const dirLabel = (d: string, pct: number) => `${d === 'below' ? 'drops' : 'rises'} >${pct}%`;
  const notifLabel = (n: string) => ({ email: '📧 Email', sms: '📱 SMS', both: '📧+📱 Both', none: '🔕 None' }[n] ?? n);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text.primary, fontFamily: T.font.mono }}>
          📡 PRICING ALERT RULES
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          style={{ fontSize: 10, fontWeight: 700, padding: '5px 14px', background: showForm ? T.bg.panelAlt : T.text.amber, color: showForm ? T.text.muted : T.bg.terminal, border: showForm ? `1px solid ${T.border.medium}` : 'none', cursor: 'pointer' }}
        >
          {showForm ? 'CANCEL' : '+ NEW ALERT'}
        </button>
      </div>
      <div style={{ fontSize: 10, color: T.text.secondary, marginBottom: 16 }}>
        Get notified when submarket metrics breach configured thresholds.
      </div>

      {/* Add alert form */}
      {showForm && (
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.bright}`, padding: 18, marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.text.amber, marginBottom: 14, fontFamily: T.font.mono }}>NEW PRICING ALERT</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 9, color: T.text.secondary, marginBottom: 3, fontFamily: T.font.mono }}>SUBMARKET *</div>
              <input type="text" placeholder="e.g. Midtown" value={form.submarket} onChange={e => setForm(f => ({ ...f, submarket: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: T.text.secondary, marginBottom: 3, fontFamily: T.font.mono }}>METRIC</div>
              <select value={form.metric} onChange={e => setForm(f => ({ ...f, metric: e.target.value as 'avg_rent' | 'occupancy' }))} style={inputStyle}>
                <option value="avg_rent">Avg Rent / SF</option>
                <option value="occupancy">Occupancy %</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 9, color: T.text.secondary, marginBottom: 3, fontFamily: T.font.mono }}>THRESHOLD %</div>
              <input type="number" placeholder="3.0" min="0" step="0.5" value={form.threshold_pct} onChange={e => setForm(f => ({ ...f, threshold_pct: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: T.text.secondary, marginBottom: 3, fontFamily: T.font.mono }}>DIRECTION</div>
              <select value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value as 'above' | 'below' }))} style={inputStyle}>
                <option value="below">Drops below</option>
                <option value="above">Rises above</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 9, color: T.text.secondary, marginBottom: 3, fontFamily: T.font.mono }}>NOTIFICATION</div>
              <select value={form.notification_pref} onChange={e => setForm(f => ({ ...f, notification_pref: e.target.value as 'email' | 'sms' | 'both' | 'none' }))} style={inputStyle}>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="both">Email + SMS</option>
                <option value="none">None (log only)</option>
              </select>
            </div>
          </div>
          {formError && (
            <div style={{ fontSize: 9, color: T.text.red, marginBottom: 10, padding: '4px 8px', background: T.text.red + '11', border: `1px solid ${T.text.red}44` }}>{formError}</div>
          )}
          <button
            onClick={handleAdd}
            disabled={saving}
            style={{ fontSize: 10, fontWeight: 700, padding: '6px 18px', background: T.text.amber, color: T.bg.terminal, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'SAVING...' : 'CREATE ALERT'}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 20, color: T.text.muted, fontSize: 10 }}>Loading...</div>
      ) : alerts.length === 0 ? (
        <div style={{ background: T.bg.panel, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>🔔</div>
          <div style={{ fontSize: 11, color: T.text.secondary }}>No pricing alerts configured</div>
          <div style={{ fontSize: 9, color: T.text.muted, marginTop: 4 }}>Click "+ NEW ALERT" to create your first rule</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.map(a => (
            <div
              key={a.id}
              style={{
                background: T.bg.panel,
                border: `1px solid ${a.is_enabled ? T.text.amber + '44' : T.border.subtle}`,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                opacity: a.is_enabled ? 1 : 0.55,
              }}
            >
              {/* Toggle */}
              <button
                onClick={() => handleToggle(a)}
                title={a.is_enabled ? 'Disable alert' : 'Enable alert'}
                style={{
                  width: 32, height: 18, borderRadius: 9,
                  background: a.is_enabled ? T.text.amber : T.border.medium,
                  border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 2, width: 14, height: 14, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.2s',
                  left: a.is_enabled ? 16 : 2,
                }} />
              </button>

              {/* Description */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.text.primary }}>
                  Notify when <span style={{ color: T.text.amber }}>{metricLabel(a.metric)}</span> in{' '}
                  <span style={{ color: T.text.cyan }}>{a.submarket}</span>{' '}
                  {dirLabel(a.direction, a.threshold_pct)}
                </div>
                <div style={{ fontSize: 9, color: T.text.muted, marginTop: 2, fontFamily: T.font.mono }}>
                  {notifLabel(a.notification_pref)} · Created {new Date(a.created_at).toLocaleDateString()}
                </div>
              </div>

              {/* Badges */}
              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', background: (a.direction === 'below' ? T.text.red : T.text.green) + '22', color: a.direction === 'below' ? T.text.red : T.text.green, flexShrink: 0 }}>
                {a.direction.toUpperCase()} {a.threshold_pct}%
              </span>

              {/* Delete */}
              <button
                onClick={() => handleDelete(a.id)}
                style={{ fontSize: 9, color: T.text.red, background: 'transparent', border: `1px solid ${T.text.red}44`, padding: '3px 8px', cursor: 'pointer', flexShrink: 0 }}
              >
                DELETE
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ORG INTEGRATIONS SECTION
// ═══════════════════════════════════════════════════════════════════

type IntegrationKey = 'docusign' | 'notarize' | 'plaid' | 'stripe' | 'gmail' | 'outlook';

interface IntegrationDef {
  key: IntegrationKey;
  name: string;
  icon: string;
  description: string;
  category: string;
  credentialFields?: { key: string; label: string; placeholder: string; secret?: boolean }[];
  apiPath?: string;
}

const INTEGRATION_DEFS: IntegrationDef[] = [
  {
    key: 'docusign', name: 'DocuSign', icon: '✍️', description: 'Document signing for PSAs, LOIs, loan docs', category: 'Signing',
    apiPath: '/api/v1/organization/integrations/docusign/credentials',
    credentialFields: [
      { key: 'accountId', label: 'Account ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
      { key: 'integrationKey', label: 'Integration Key', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
      { key: 'secretKey', label: 'Secret Key', placeholder: 'Your DocuSign secret key', secret: true },
      { key: 'baseUrl', label: 'Base URL', placeholder: 'https://demo.docusign.net/restapi' },
    ],
  },
  {
    key: 'notarize', name: 'Notarize', icon: '📜', description: 'Remote online notarization', category: 'Signing',
    apiPath: '/api/v1/organization/integrations/notarize/credentials',
    credentialFields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'Your Notarize API key', secret: true },
      { key: 'environment', label: 'Environment', placeholder: 'sandbox or production' },
    ],
  },
  {
    key: 'plaid', name: 'Plaid', icon: '🏦', description: 'Identity & bank account verification (KYC/KYB)', category: 'KYC',
    apiPath: '/api/v1/organization/integrations/plaid/credentials',
    credentialFields: [
      { key: 'clientId', label: 'Client ID', placeholder: 'Your Plaid client_id' },
      { key: 'secret', label: 'Secret', placeholder: 'Your Plaid secret', secret: true },
      { key: 'environment', label: 'Environment', placeholder: 'sandbox, development, or production' },
    ],
  },
  { key: 'stripe', name: 'Stripe', icon: '💳', description: 'Payment processing & billing', category: 'Billing' },
  { key: 'gmail', name: 'Gmail', icon: '📧', description: 'Email sync for deal context tracking', category: 'Email' },
  { key: 'outlook', name: 'Outlook', icon: '📬', description: 'Email sync for deal context tracking', category: 'Email' },
];

function OrgIntegrationsSection({ T }: { T: ThemeType }) {
  const [statuses, setStatuses] = useState<Record<string, string>>({ stripe: 'connected', gmail: 'available', outlook: 'available' });
  const [openForm, setOpenForm] = useState<IntegrationKey | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ key: IntegrationKey; type: 'success' | 'error'; text: string } | null>(null);

  const statusColor = (s: string) => s === 'connected' ? T.text.green : s === 'available' ? T.text.cyan : T.text.muted;
  const statusLabel = (s: string) => s === 'connected' ? '● CONNECTED' : s === 'available' ? '○ AVAILABLE' : '○ NOT CONFIGURED';

  const handleConnect = async (def: IntegrationDef) => {
    if (!def.apiPath || !def.credentialFields) return;
    setSaving(true);
    setMessage(null);
    try {
      const body: Record<string, string> = {};
      def.credentialFields.forEach(f => { body[f.key] = formValues[f.key] || ''; });
      await apiClient.post(def.apiPath, body);
      setStatuses(prev => ({ ...prev, [def.key]: 'connected' }));
      setOpenForm(null);
      setFormValues({});
      setMessage({ key: def.key, type: 'success', text: `${def.name} connected successfully` });
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({ key: def.key, type: 'error', text: err?.response?.data?.error || `Failed to connect ${def.name}` });
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', fontSize: 10, padding: '5px 8px',
    background: T.bg.panelAlt, border: `1px solid ${T.border.medium}`,
    color: T.text.primary, outline: 'none', fontFamily: T.font.mono,
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.text.primary, marginBottom: 6, fontFamily: T.font.mono }}>
        🔌 ORGANIZATION INTEGRATIONS
      </div>
      <div style={{ fontSize: 10, color: T.text.secondary, marginBottom: 20 }}>
        Connect third-party services at the organization level. Credentials are encrypted at rest.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {INTEGRATION_DEFS.map((def) => {
          const status = statuses[def.key] || 'not_configured';
          const isOpen = openForm === def.key;
          const msg = message?.key === def.key ? message : null;
          return (
            <div key={def.key} style={{ background: T.bg.panel, border: `1px solid ${isOpen ? T.text.amber + '88' : T.border.subtle}`, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{def.icon}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.text.primary }}>{def.name}</div>
                    <div style={{ fontSize: 9, color: T.text.muted }}>{def.category}</div>
                  </div>
                </div>
                <span style={{ fontSize: 9, color: statusColor(status) }}>{statusLabel(status)}</span>
              </div>
              <div style={{ fontSize: 10, color: T.text.secondary, marginBottom: 12 }}>{def.description}</div>

              {msg && (
                <div style={{ fontSize: 9, padding: '4px 8px', marginBottom: 8, color: msg.type === 'success' ? T.text.green : T.text.red, background: (msg.type === 'success' ? T.text.green : T.text.red) + '11', border: `1px solid ${(msg.type === 'success' ? T.text.green : T.text.red)}44` }}>
                  {msg.text}
                </div>
              )}

              {isOpen && def.credentialFields && (
                <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {def.credentialFields.map(f => (
                    <div key={f.key}>
                      <div style={{ fontSize: 9, color: T.text.secondary, marginBottom: 2, fontFamily: T.font.mono }}>{f.label}</div>
                      <input
                        type={f.secret ? 'password' : 'text'}
                        placeholder={f.placeholder}
                        value={formValues[f.key] || ''}
                        onChange={e => setFormValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <button
                      onClick={() => handleConnect(def)}
                      disabled={saving}
                      style={{ fontSize: 9, fontWeight: 700, padding: '5px 12px', background: T.text.amber, color: T.bg.terminal, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
                    >
                      {saving ? 'SAVING...' : 'SAVE CREDENTIALS'}
                    </button>
                    <button
                      onClick={() => { setOpenForm(null); setFormValues({}); }}
                      style={{ fontSize: 9, padding: '5px 10px', background: 'transparent', color: T.text.muted, border: `1px solid ${T.border.medium}`, cursor: 'pointer' }}
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              )}

              {!isOpen && (
                <button
                  onClick={() => { if (def.credentialFields) { setOpenForm(def.key); setFormValues({}); } }}
                  style={{ width: '100%', fontSize: 10, fontWeight: 600, color: status === 'connected' ? T.text.muted : T.text.amber, background: 'transparent', border: `1px solid ${status === 'connected' ? T.text.muted : T.text.amber}44`, padding: '6px 12px', cursor: def.credentialFields ? 'pointer' : 'default' }}
                >
                  {status === 'connected' ? 'RECONFIGURE' : def.credentialFields ? 'CONNECT' : 'MANAGED VIA STRIPE'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, padding: '8px 12px', background: T.bg.panelAlt, border: `1px solid ${T.border.subtle}`, fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>
        Credentials are AES-256 encrypted before storage. API keys are never exposed in logs.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function F8AdminView({ T }: F8AdminViewProps) {
  const [activeSection, setActiveSection] = useState('health');
  const [collapsed, setCollapsed] = useState(false);

  const renderNavGroup = (groupId: string) => {
    const items = NAV_ITEMS.filter(item => item.group === groupId);
    const label = GROUP_LABELS[groupId];
    return (
      <div key={groupId} style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 8, color: T.text.muted, fontFamily: T.font.mono, padding: collapsed ? '6px 4px' : '6px 10px', letterSpacing: '0.5px' }}>
          {collapsed ? label.split(' ')[0] : label}
        </div>
        {items.map((item) => {
          const isActive = activeSection === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              title={collapsed ? item.label : undefined}
              style={{
                width: '100%',
                padding: collapsed ? '6px 4px' : '6px 8px',
                marginBottom: 1,
                background: isActive ? T.bg.active : 'transparent',
                border: 'none',
                borderLeft: isActive ? `2px solid ${T.text.amber}` : '2px solid transparent',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = T.bg.hover; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 6 }}>
                <span style={{ fontSize: 11 }}>{item.icon}</span>
                {!collapsed && (
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 9, fontWeight: 600, color: isActive ? T.text.amber : T.text.primary, fontFamily: T.font.mono }}>{item.label}</span>
                      {item.badge && <span style={{ fontSize: 7, fontWeight: 700, padding: '1px 3px', background: T.text.green + '22', color: T.text.green }}>{item.badge}</span>}
                    </div>
                    <div style={{ fontSize: 8, color: T.text.muted, fontFamily: T.font.mono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.description}</div>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'health': return <SystemHealthSection />;
      case 'jobs': return <BackgroundJobsSection />;
      case 'agents': return <AgentsPlatformSection />;
      case 'users': return <UserManagementSection />;
      case 'deals': return <DealOversightSection />;
      case 'enrichment': return <EnrichmentStatusSection />;
      case 'coverage': return <DataCoverageSection />;
      case 'lifecycle': return <LifecycleMonitorSection T={T} />;
      case 'learning': return <LearningSystemSection T={T} />;
      case 'compsets': return <CompetitiveSetsSection T={T} />;
      case 'marketdata': return <MarketDataSection T={T} />;
      case 'team': return <TeamSection />;
      case 'orgintegrations': return <OrgIntegrationsSection T={T} />;
      case 'dataroom': return <DataRoomSection />;
      case 'verification': return <VerificationSection />;
      case 'dataops': return <DataManagementSection />;
      default: return <SystemHealthSection />;
    }
  };

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <aside style={{
        width: collapsed ? 44 : 170,
        background: T.bg.panel,
        borderRight: `1px solid ${T.border.subtle}`,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
        flexShrink: 0,
        transition: 'width 0.15s',
      }}>
        <button onClick={() => setCollapsed(!collapsed)} style={{ padding: '6px', background: 'transparent', border: 'none', borderBottom: `1px solid ${T.border.subtle}`, cursor: 'pointer', display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end' }}>
          <span style={{ fontSize: 11, color: T.text.muted }}>{collapsed ? '→' : '←'}</span>
        </button>
        <nav style={{ flex: 1, padding: collapsed ? '6px 2px' : '6px' }}>
          {renderNavGroup('platform')}
          {renderNavGroup('intel')}
          {renderNavGroup('lifecycle')}
          {renderNavGroup('org')}
        </nav>
        {!collapsed && (
          <div style={{ padding: '8px 10px', borderTop: `1px solid ${T.border.subtle}`, fontSize: 8, color: T.text.muted, fontFamily: T.font.mono }}>
            F8 ADMIN v2.1
          </div>
        )}
      </aside>
      <main style={{ flex: 1, overflow: 'auto', background: T.bg.terminal }}>
        {renderContent()}
      </main>
    </div>
  );
}
