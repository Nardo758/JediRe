/**
 * F8AdminView - Admin Tools rendered inside Terminal
 * 
 * Comprehensive admin panel organized into:
 * - PLATFORM: System health, background jobs, agents, users
 * - INTELLIGENCE: Deal oversight, enrichment, data coverage
 * - LIFECYCLE: Dispositions, reforecasts, debt tracking, learning
 * - CONFIG: AI, integrations, notifications, templates
 * - DATA: Data room, import/export, billing
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../services/api.client';

// Existing section imports
import DealIntelligenceSection from '../admin/sections/DealIntelligenceSection';
import TeamSection from '../admin/sections/TeamSection';
import AIConfigSection from '../admin/sections/AIConfigSection';
import IntegrationsSection from '../admin/sections/IntegrationsSection';
import DataRoomSection from '../admin/sections/DataRoomSection';
import VerificationSection from '../admin/sections/VerificationSection';
import BillingSection from '../admin/sections/BillingSection';
import NotificationsSection from '../admin/sections/NotificationsSection';
import TemplatesSection from '../admin/sections/TemplatesSection';
import DataManagementSection from '../admin/sections/DataManagementSection';
import { SystemHealthSection } from '../admin/sections/SystemHealthSection';
import { BackgroundJobsSection } from '../admin/sections/BackgroundJobsSection';
import { AgentsPlatformSection } from '../admin/sections/AgentsPlatformSection';
import { DealOversightSection } from '../admin/sections/DealOversightSection';
import { DataCoverageSection } from '../admin/sections/DataCoverageSection';
import { EnrichmentStatusSection } from '../admin/sections/EnrichmentStatusSection';
import { UserManagementSection } from '../admin/sections/UserManagementSection';

// Bloomberg Terminal tokens
interface ThemeType {
  bg: { terminal: string; panel: string; panelAlt: string; header: string; hover: string; active: string; input: string; topBar: string; sidebar?: string };
  text: { primary: string; secondary: string; muted: string; amber: string; amberBright: string; green: string; red: string; cyan: string; orange: string; purple: string; white: string };
  border: { subtle: string; medium: string; bright: string };
  font: { mono: string; display: string; label: string };
}

interface NavItem {
  key: string;
  label: string;
  icon: string;
  description: string;
  group: 'platform' | 'intel' | 'lifecycle' | 'config' | 'data';
  badge?: string;
  badgeColor?: string;
}

const NAV_ITEMS: NavItem[] = [
  // Platform Group (System Operations)
  { key: 'health', label: 'SYSTEM HEALTH', icon: '💚', description: 'Server stats, uptime, errors', group: 'platform' },
  { key: 'jobs', label: 'BACKGROUND JOBS', icon: '⚙️', description: 'Queues, workers, failed jobs', group: 'platform' },
  { key: 'agents', label: 'AI AGENTS', icon: '🤖', description: 'Agent runs, performance, errors', group: 'platform' },
  { key: 'users', label: 'USER MANAGEMENT', icon: '👤', description: 'Users, roles, activity', group: 'platform' },
  
  // Intelligence Group (Data Quality)
  { key: 'deals', label: 'DEAL OVERSIGHT', icon: '📊', description: 'All deals, status, scores', group: 'intel' },
  { key: 'enrichment', label: 'ENRICHMENT', icon: '✨', description: 'Data enrichment pipelines', group: 'intel' },
  { key: 'coverage', label: 'DATA COVERAGE', icon: '🗺️', description: 'Geographic coverage', group: 'intel' },
  { key: 'intel', label: 'DEAL INTEL', icon: '🔒', description: 'Notes, risks, contacts', group: 'intel' },
  
  // Lifecycle Group (NEW - Full deal lifecycle)
  { key: 'lifecycle', label: 'LIFECYCLE MONITOR', icon: '🔄', description: 'Dispositions, reforecasts, debt', group: 'lifecycle', badge: 'NEW' },
  { key: 'learning', label: 'LEARNING SYSTEM', icon: '🧠', description: 'Calibration adjustments', group: 'lifecycle', badge: 'NEW' },
  { key: 'compsets', label: 'COMPETITIVE SETS', icon: '🏘️', description: 'Comp tracking & alerts', group: 'lifecycle' },
  { key: 'marketdata', label: 'MARKET DATA', icon: '📡', description: 'CoStar, ATTOM, municipal', group: 'lifecycle' },
  
  // Config Group
  { key: 'ai', label: 'AI CONFIG', icon: '⚡', description: 'Model prefs, tokens', group: 'config' },
  { key: 'integrations', label: 'INTEGRATIONS', icon: '🔗', description: 'External services', group: 'config' },
  { key: 'notifications', label: 'NOTIFICATIONS', icon: '🔔', description: 'Alerts, channels', group: 'config' },
  { key: 'templates', label: 'TEMPLATES', icon: '📋', description: 'Pro forma, reports', group: 'config' },
  { key: 'team', label: 'TEAM & ACCESS', icon: '👥', description: 'Members, permissions', group: 'config' },
  
  // Data Group
  { key: 'dataroom', label: 'DATA ROOM', icon: '📁', description: 'Secure sharing', group: 'data' },
  { key: 'datamanagement', label: 'IMPORT/EXPORT', icon: '📦', description: 'Bulk operations', group: 'data' },
  { key: 'verification', label: 'VERIFICATION', icon: '✅', description: 'KYC, background', group: 'data' },
  { key: 'billing', label: 'BILLING', icon: '💳', description: 'Credits, invoices', group: 'data' },
];

const GROUP_LABELS: Record<string, string> = {
  platform: '⚡ PLATFORM',
  intel: '🔍 INTELLIGENCE',
  lifecycle: '🔄 LIFECYCLE',
  config: '⚙️ CONFIGURATION',
  data: '📦 DATA & BILLING',
};

interface F8AdminViewProps {
  T: ThemeType;
}

// ═══════════════════════════════════════════════════════════════════
// NEW LIFECYCLE SECTIONS
// ═══════════════════════════════════════════════════════════════════

function LifecycleMonitorSection({ T }: { T: ThemeType }) {
  const [stats, setStats] = useState<{
    pendingDispositions: number;
    activeReforecasts: number;
    maturingDebt: number;
    compAlerts: number;
  } | null>(null);
  const [dispositions, setDispositions] = useState<any[]>([]);
  const [reforecasts, setReforecasts] = useState<any[]>([]);
  const [maturities, setMaturities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiClient.get('/api/v1/lifecycle/dispositions/stats').catch(() => ({ data: {} })),
      apiClient.get('/api/v1/lifecycle/debt/maturities?months=12').catch(() => ({ data: { maturities: [] } })),
    ]).then(([statsRes, matRes]) => {
      setStats({
        pendingDispositions: statsRes.data?.totalDispositions ?? 0,
        activeReforecasts: 0,
        maturingDebt: matRes.data?.maturities?.length ?? 0,
        compAlerts: 0,
      });
      setMaturities(matRes.data?.maturities ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const StatCard = ({ label, value, color, icon }: { label: string; value: number | string; color: string; icon: string }) => (
    <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 10, color: T.text.muted, letterSpacing: 1 }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: T.font.mono }}>{value}</div>
    </div>
  );

  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.text.primary, marginBottom: 16, fontFamily: T.font.mono }}>
        LIFECYCLE MONITORING
      </div>

      {loading ? (
        <div style={{ color: T.text.muted, fontFamily: T.font.mono, fontSize: 10 }}>Loading...</div>
      ) : (
        <>
          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            <StatCard label="DISPOSITIONS" value={stats?.pendingDispositions ?? 0} color={T.text.green} icon="🏷️" />
            <StatCard label="ACTIVE REFORECASTS" value={stats?.activeReforecasts ?? 0} color={T.text.amber} icon="📈" />
            <StatCard label="DEBT MATURING <12MO" value={stats?.maturingDebt ?? 0} color={stats?.maturingDebt ? T.text.red : T.text.muted} icon="⏰" />
            <StatCard label="COMP ALERTS" value={stats?.compAlerts ?? 0} color={T.text.cyan} icon="🔔" />
          </div>

          {/* Debt Maturities Table */}
          {maturities.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.text.amber, marginBottom: 8, letterSpacing: 1 }}>
                ⚠️ UPCOMING LOAN MATURITIES
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.bg.header }}>
                    {['DEAL', 'LENDER', 'BALANCE', 'MATURITY', 'DAYS', 'URGENCY'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', fontSize: 10, color: T.text.muted, textAlign: 'left', fontFamily: T.font.mono, letterSpacing: 1 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {maturities.slice(0, 10).map((m: any, i: number) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}`, background: i % 2 === 0 ? T.bg.panel : T.bg.panelAlt }}>
                      <td style={{ padding: '8px 10px', fontSize: 10, color: T.text.primary, fontWeight: 600 }}>{m.dealName}</td>
                      <td style={{ padding: '8px 10px', fontSize: 10, color: T.text.secondary }}>{m.lenderName || '—'}</td>
                      <td style={{ padding: '8px 10px', fontSize: 10, color: T.text.primary, fontFamily: T.font.mono }}>${(m.currentBalance / 1e6).toFixed(1)}M</td>
                      <td style={{ padding: '8px 10px', fontSize: 10, color: T.text.secondary }}>{new Date(m.maturityDate).toLocaleDateString()}</td>
                      <td style={{ padding: '8px 10px', fontSize: 10, fontWeight: 700, color: m.daysToMaturity < 90 ? T.text.red : m.daysToMaturity < 180 ? T.text.orange : T.text.muted }}>{m.daysToMaturity}d</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 6px',
                          background: m.urgency === 'critical' ? T.text.red + '22' : m.urgency === 'watch' ? T.text.orange + '22' : T.text.muted + '22',
                          color: m.urgency === 'critical' ? T.text.red : m.urgency === 'watch' ? T.text.orange : T.text.muted,
                        }}>{m.urgency?.toUpperCase() || 'OK'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Quick Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ fontFamily: T.font.mono, fontSize: 10, fontWeight: 700, background: T.text.amber, color: T.bg.terminal, border: 'none', padding: '8px 16px', cursor: 'pointer' }}>
              + NEW DISPOSITION
            </button>
            <button style={{ fontFamily: T.font.mono, fontSize: 10, fontWeight: 600, background: 'transparent', color: T.text.cyan, border: `1px solid ${T.text.cyan}44`, padding: '8px 16px', cursor: 'pointer' }}>
              RUN REFORECAST CHECK
            </button>
            <button style={{ fontFamily: T.font.mono, fontSize: 10, fontWeight: 600, background: 'transparent', color: T.text.purple, border: `1px solid ${T.text.purple}44`, padding: '8px 16px', cursor: 'pointer' }}>
              DEBT SUMMARY REPORT
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function LearningSystemSection({ T }: { T: ThemeType }) {
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [outcomes, setOutcomes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/api/v1/learning/adjustments?limit=20')
      .then(res => setAdjustments(res.data?.adjustments ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.text.primary, marginBottom: 8, fontFamily: T.font.mono }}>
        🧠 LEARNING SYSTEM
      </div>
      <div style={{ fontSize: 10, color: T.text.secondary, marginBottom: 20, lineHeight: 1.5 }}>
        The learning system calibrates underwriting assumptions based on actual outcomes from operations and dispositions.
        Adjustments are applied automatically by the CashFlow agent when underwriting similar deals.
      </div>

      {loading ? (
        <div style={{ color: T.text.muted, fontFamily: T.font.mono, fontSize: 10 }}>Loading...</div>
      ) : adjustments.length === 0 ? (
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📚</div>
          <div style={{ fontSize: 11, color: T.text.secondary, marginBottom: 4 }}>No learning adjustments yet</div>
          <div style={{ fontSize: 10, color: T.text.muted }}>
            Adjustments are generated when operations actuals or dispositions diverge from underwriting assumptions
          </div>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: T.bg.header }}>
              {['ASSUMPTION', 'STATE', 'MSA', 'ASSET CLASS', 'AVG BIAS', 'ADJUSTMENT', 'CONFIDENCE', 'SAMPLE'].map(h => (
                <th key={h} style={{ padding: '8px 10px', fontSize: 10, color: T.text.muted, textAlign: 'left', fontFamily: T.font.mono, letterSpacing: 1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {adjustments.map((adj: any, i: number) => (
              <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}`, background: i % 2 === 0 ? T.bg.panel : T.bg.panelAlt }}>
                <td style={{ padding: '8px 10px', fontSize: 10, color: T.text.primary, fontWeight: 600 }}>{adj.assumptionName?.replace(/_/g, ' ')}</td>
                <td style={{ padding: '8px 10px', fontSize: 10, color: T.text.secondary }}>{adj.state || '—'}</td>
                <td style={{ padding: '8px 10px', fontSize: 10, color: T.text.secondary }}>{adj.msa || '—'}</td>
                <td style={{ padding: '8px 10px', fontSize: 10, color: T.text.amber }}>{adj.assetClass || '—'}</td>
                <td style={{ padding: '8px 10px', fontSize: 10, fontWeight: 700, fontFamily: T.font.mono, color: adj.avgBias > 0 ? T.text.green : T.text.red }}>
                  {adj.avgBias > 0 ? '+' : ''}{(adj.avgBias * 100).toFixed(1)}%
                </td>
                <td style={{ padding: '8px 10px', fontSize: 10, fontWeight: 700, fontFamily: T.font.mono, color: T.text.cyan }}>
                  {adj.recommendedAdjustment > 0 ? '+' : ''}{(adj.recommendedAdjustment * 100).toFixed(2)}%
                </td>
                <td style={{ padding: '8px 10px', fontSize: 10, fontFamily: T.font.mono, color: adj.confidenceScore > 0.7 ? T.text.green : adj.confidenceScore > 0.4 ? T.text.amber : T.text.muted }}>
                  {(adj.confidenceScore * 100).toFixed(0)}%
                </td>
                <td style={{ padding: '8px 10px', fontSize: 10, color: T.text.muted }}>{adj.sampleSize}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
        <button style={{ fontFamily: T.font.mono, fontSize: 10, fontWeight: 700, background: T.text.green, color: T.bg.terminal, border: 'none', padding: '8px 16px', cursor: 'pointer' }}>
          REFRESH ADJUSTMENTS
        </button>
        <button style={{ fontFamily: T.font.mono, fontSize: 10, fontWeight: 600, background: 'transparent', color: T.text.amber, border: `1px solid ${T.text.amber}44`, padding: '8px 16px', cursor: 'pointer' }}>
          VIEW OUTCOME HISTORY
        </button>
      </div>
    </div>
  );
}

function CompetitiveSetsSection({ T }: { T: ThemeType }) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Would fetch from /api/v1/lifecycle/comp-alerts/all when available
    setLoading(false);
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.text.primary, marginBottom: 8, fontFamily: T.font.mono }}>
        🏘️ COMPETITIVE SET MANAGEMENT
      </div>
      <div style={{ fontSize: 10, color: T.text.secondary, marginBottom: 20, lineHeight: 1.5 }}>
        Track competitor pricing changes across all deals. Alerts are generated when comps change rents by &gt;3%.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, padding: 16 }}>
          <div style={{ fontSize: 10, color: T.text.muted, letterSpacing: 1, marginBottom: 4 }}>TOTAL COMPS TRACKED</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.text.cyan, fontFamily: T.font.mono }}>—</div>
        </div>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, padding: 16 }}>
          <div style={{ fontSize: 10, color: T.text.muted, letterSpacing: 1, marginBottom: 4 }}>UNACKNOWLEDGED ALERTS</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.text.amber, fontFamily: T.font.mono }}>—</div>
        </div>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, padding: 16 }}>
          <div style={{ fontSize: 10, color: T.text.muted, letterSpacing: 1, marginBottom: 4 }}>AVG COMPS PER DEAL</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.text.purple, fontFamily: T.font.mono }}>—</div>
        </div>
      </div>

      <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>🔔</div>
        <div style={{ fontSize: 11, color: T.text.secondary, marginBottom: 4 }}>No pricing alerts</div>
        <div style={{ fontSize: 10, color: T.text.muted }}>
          Alerts appear when competitors change rents by &gt;3%
        </div>
      </div>
    </div>
  );
}

function MarketDataSection({ T }: { T: ThemeType }) {
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Would fetch from /api/v1/lifecycle/market-data/connections
    setConnections([
      { provider: 'CoStar', status: 'not_configured', lastSync: null },
      { provider: 'Yardi Matrix', status: 'not_configured', lastSync: null },
      { provider: 'ATTOM', status: 'not_configured', lastSync: null },
      { provider: 'US Census', status: 'available', lastSync: '2024-04-15' },
      { provider: 'BLS', status: 'available', lastSync: '2024-04-18' },
    ]);
    setLoading(false);
  }, []);

  const statusColor = (s: string) => s === 'connected' ? T.text.green : s === 'available' ? T.text.cyan : T.text.muted;
  const statusLabel = (s: string) => s === 'connected' ? '● CONNECTED' : s === 'available' ? '○ AVAILABLE' : '○ NOT CONFIGURED';

  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.text.primary, marginBottom: 8, fontFamily: T.font.mono }}>
        📡 MARKET DATA CONNECTIONS
      </div>
      <div style={{ fontSize: 10, color: T.text.secondary, marginBottom: 20, lineHeight: 1.5 }}>
        Connect to external data sources for sale comps, rent comps, and market intelligence.
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: T.bg.header }}>
            {['PROVIDER', 'STATUS', 'LAST SYNC', 'DATA TYPES', 'ACTIONS'].map(h => (
              <th key={h} style={{ padding: '10px 12px', fontSize: 10, color: T.text.muted, textAlign: 'left', fontFamily: T.font.mono, letterSpacing: 1 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {connections.map((conn, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}`, background: i % 2 === 0 ? T.bg.panel : T.bg.panelAlt }}>
              <td style={{ padding: '12px', fontSize: 11, color: T.text.primary, fontWeight: 600 }}>{conn.provider}</td>
              <td style={{ padding: '12px' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: statusColor(conn.status) }}>{statusLabel(conn.status)}</span>
              </td>
              <td style={{ padding: '12px', fontSize: 10, color: T.text.muted }}>{conn.lastSync || '—'}</td>
              <td style={{ padding: '12px', fontSize: 10, color: T.text.secondary }}>
                {conn.provider === 'CoStar' && 'Sale comps, rent comps, market stats'}
                {conn.provider === 'Yardi Matrix' && 'Rent comps, supply pipeline'}
                {conn.provider === 'ATTOM' && 'Sale comps, tax records'}
                {conn.provider === 'US Census' && 'Demographics, employment'}
                {conn.provider === 'BLS' && 'Employment, wages, CPI'}
              </td>
              <td style={{ padding: '12px' }}>
                {conn.status === 'not_configured' ? (
                  <button style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.amber, background: 'transparent', border: `1px solid ${T.text.amber}44`, padding: '4px 12px', cursor: 'pointer' }}>
                    CONFIGURE →
                  </button>
                ) : (
                  <button style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.cyan, background: 'transparent', border: `1px solid ${T.text.cyan}44`, padding: '4px 12px', cursor: 'pointer' }}>
                    SYNC NOW
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
      <div key={groupId} style={{ marginBottom: 12 }}>
        <div style={{
          fontSize: 9,
          color: T.text.muted,
          fontFamily: T.font.mono,
          padding: collapsed ? '8px 6px' : '8px 12px',
          letterSpacing: '0.5px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}>
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
                padding: collapsed ? '8px 6px' : '8px 10px',
                marginBottom: 1,
                background: isActive ? T.bg.active : 'transparent',
                border: 'none',
                borderLeft: isActive ? `2px solid ${T.text.amber}` : '2px solid transparent',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = T.bg.hover;
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 8 }}>
                <span style={{ fontSize: 12, flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && (
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontSize: 9,
                        fontWeight: 600,
                        color: isActive ? T.text.amber : T.text.primary,
                        fontFamily: T.font.mono,
                        letterSpacing: '0.3px',
                      }}>
                        {item.label}
                      </span>
                      {item.badge && (
                        <span style={{
                          fontSize: 8,
                          fontWeight: 700,
                          padding: '1px 4px',
                          background: T.text.green + '22',
                          color: T.text.green,
                          borderRadius: 2,
                        }}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: 8,
                      color: T.text.muted,
                      fontFamily: T.font.mono,
                      marginTop: 1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {item.description}
                    </div>
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
      // Platform
      case 'health': return <SystemHealthSection />;
      case 'jobs': return <BackgroundJobsSection />;
      case 'agents': return <AgentsPlatformSection />;
      case 'users': return <UserManagementSection />;
      
      // Intelligence
      case 'deals': return <DealOversightSection />;
      case 'enrichment': return <EnrichmentStatusSection />;
      case 'coverage': return <DataCoverageSection />;
      case 'intel': return <DealIntelligenceSection />;
      
      // Lifecycle (NEW)
      case 'lifecycle': return <LifecycleMonitorSection T={T} />;
      case 'learning': return <LearningSystemSection T={T} />;
      case 'compsets': return <CompetitiveSetsSection T={T} />;
      case 'marketdata': return <MarketDataSection T={T} />;
      
      // Config
      case 'ai': return <AIConfigSection />;
      case 'integrations': return <IntegrationsSection />;
      case 'notifications': return <NotificationsSection />;
      case 'templates': return <TemplatesSection />;
      case 'team': return <TeamSection />;
      
      // Data
      case 'dataroom': return <DataRoomSection />;
      case 'datamanagement': return <DataManagementSection />;
      case 'verification': return <VerificationSection />;
      case 'billing': return <BillingSection />;
      
      default: return <SystemHealthSection />;
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flex: 1, 
      overflow: 'hidden',
      animation: 'fadeIn 0.15s',
    }}>
      {/* Sidebar Navigation */}
      <aside style={{
        width: collapsed ? 48 : 180,
        background: T.bg.panel,
        borderRight: `1px solid ${T.border.subtle}`,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
        flexShrink: 0,
        transition: 'width 0.15s',
      }}>
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            padding: '8px',
            background: 'transparent',
            border: 'none',
            borderBottom: `1px solid ${T.border.subtle}`,
            cursor: 'pointer',
            display: 'flex',
            justifyContent: collapsed ? 'center' : 'flex-end',
          }}
        >
          <span style={{ fontSize: 12, color: T.text.muted }}>{collapsed ? '→' : '←'}</span>
        </button>

        <nav style={{ flex: 1, padding: collapsed ? '8px 4px' : '8px' }}>
          {renderNavGroup('platform')}
          {renderNavGroup('intel')}
          {renderNavGroup('lifecycle')}
          {renderNavGroup('config')}
          {renderNavGroup('data')}
        </nav>

        {!collapsed && (
          <div style={{
            padding: '10px 12px',
            borderTop: `1px solid ${T.border.subtle}`,
            fontSize: 8,
            color: T.text.muted,
            fontFamily: T.font.mono,
          }}>
            <div>F8 ADMIN v2.0</div>
            <div style={{ marginTop: 2 }}>? for shortcuts</div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main style={{ 
        flex: 1, 
        overflow: 'auto', 
        background: T.bg.terminal,
      }}>
        {renderContent()}
      </main>
    </div>
  );
}
