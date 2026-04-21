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
 * - Templates → F9 templates (TODO)
 * - Billing → F9 subscription
 * - User Integrations → F9 integrations
 */

import React, { useState, useEffect } from 'react';
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

function CompetitiveSetsSection({ T }: { T: ThemeType }) {
  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.text.primary, marginBottom: 8, fontFamily: T.font.mono }}>
        🏘️ COMPETITIVE SET MONITORING
      </div>
      <div style={{ fontSize: 10, color: T.text.secondary, marginBottom: 20 }}>
        Track competitor pricing changes across portfolio. Alerts on &gt;3% rent changes.
      </div>
      <div style={{ background: T.bg.panel, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 20, marginBottom: 8 }}>🔔</div>
        <div style={{ fontSize: 11, color: T.text.secondary }}>No pricing alerts</div>
      </div>
    </div>
  );
}

function MarketDataSection({ T }: { T: ThemeType }) {
  const connections = [
    { provider: 'CoStar', status: 'not_configured', dataTypes: 'Sale comps, rent comps, market stats' },
    { provider: 'Yardi Matrix', status: 'not_configured', dataTypes: 'Rent comps, supply pipeline' },
    { provider: 'ATTOM', status: 'not_configured', dataTypes: 'Sale comps, tax records' },
    { provider: 'US Census', status: 'available', dataTypes: 'Demographics, employment' },
    { provider: 'BLS', status: 'available', dataTypes: 'Employment, wages, CPI' },
  ];

  const statusColor = (s: string) => s === 'connected' ? T.text.green : s === 'available' ? T.text.cyan : T.text.muted;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.text.primary, marginBottom: 16, fontFamily: T.font.mono }}>
        📡 MARKET DATA CONNECTIONS
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: T.bg.header }}>
            {['PROVIDER', 'STATUS', 'DATA TYPES', ''].map(h => (
              <th key={h} style={{ padding: '10px', fontSize: 9, color: T.text.muted, textAlign: 'left', fontFamily: T.font.mono }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {connections.map((conn, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
              <td style={{ padding: '12px 10px', fontSize: 11, fontWeight: 600 }}>{conn.provider}</td>
              <td style={{ padding: '12px 10px', fontSize: 10, color: statusColor(conn.status) }}>{conn.status === 'connected' ? '● CONNECTED' : conn.status === 'available' ? '○ AVAILABLE' : '○ NOT CONFIGURED'}</td>
              <td style={{ padding: '12px 10px', fontSize: 10, color: T.text.secondary }}>{conn.dataTypes}</td>
              <td style={{ padding: '12px 10px' }}>
                <button style={{ fontSize: 10, color: T.text.amber, background: 'transparent', border: `1px solid ${T.text.amber}44`, padding: '4px 12px', cursor: 'pointer' }}>
                  {conn.status === 'not_configured' ? 'CONFIGURE' : 'SYNC'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ORG INTEGRATIONS SECTION (NEW)
// ═══════════════════════════════════════════════════════════════════

function OrgIntegrationsSection({ T }: { T: ThemeType }) {
  const integrations = [
    { name: 'DocuSign', icon: '✍️', description: 'Document signing for PSAs, LOIs, loan docs', status: 'not_configured', category: 'Signing' },
    { name: 'Notarize', icon: '📜', description: 'Remote online notarization', status: 'not_configured', category: 'Signing' },
    { name: 'Plaid', icon: '🏦', description: 'Identity & bank account verification', status: 'not_configured', category: 'KYC' },
    { name: 'Stripe', icon: '💳', description: 'Payment processing & billing', status: 'connected', category: 'Billing' },
    { name: 'Gmail', icon: '📧', description: 'Email sync for deal tracking', status: 'available', category: 'Email' },
    { name: 'Outlook', icon: '📬', description: 'Email sync for deal tracking', status: 'available', category: 'Email' },
  ];

  const statusColor = (s: string) => s === 'connected' ? T.text.green : s === 'available' ? T.text.cyan : T.text.muted;
  const statusLabel = (s: string) => s === 'connected' ? '● CONNECTED' : s === 'available' ? '○ AVAILABLE' : '○ NOT CONFIGURED';

  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.text.primary, marginBottom: 8, fontFamily: T.font.mono }}>
        🔌 ORGANIZATION INTEGRATIONS
      </div>
      <div style={{ fontSize: 10, color: T.text.secondary, marginBottom: 20 }}>
        Connect third-party services at the organization level. Members bring their own email accounts.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {integrations.map((int, i) => (
          <div key={i} style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>{int.icon}</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.text.primary }}>{int.name}</div>
                  <div style={{ fontSize: 9, color: T.text.muted }}>{int.category}</div>
                </div>
              </div>
              <span style={{ fontSize: 9, color: statusColor(int.status) }}>{statusLabel(int.status)}</span>
            </div>
            <div style={{ fontSize: 10, color: T.text.secondary, marginBottom: 12 }}>{int.description}</div>
            <button style={{ width: '100%', fontSize: 10, fontWeight: 600, color: int.status === 'connected' ? T.text.muted : T.text.amber, background: 'transparent', border: `1px solid ${int.status === 'connected' ? T.text.muted : T.text.amber}44`, padding: '6px 12px', cursor: 'pointer' }}>
              {int.status === 'connected' ? 'MANAGE' : 'CONNECT'}
            </button>
          </div>
        ))}
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
