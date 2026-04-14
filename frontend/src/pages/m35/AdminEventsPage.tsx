/**
 * AdminEventsPage — /admin/events
 * M35 Admin verification queue:
 * - Ingestion review queue (confidence 0.3-0.6, awaiting human review)
 * - Regime-shift alerts
 * - Forecast override log
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, Edit3, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };
const BG = '#0B0E1A';
const PANEL = '#131929';
const BORDER = '#1E2538';
const TEXT = { primary: '#E2E8F0', muted: '#6B7A8D', sub: '#A0ABBE' };
const C = { green: '#10B981', cyan: '#0891B2', amber: '#D97706', red: '#EF4444' };

// ─── Types ────────────────────────────────────────────────────────────────────

type QueueStatus = 'pending' | 'approved' | 'rejected';

interface QueueEvent {
  id: string;
  name: string;
  category: string;
  scope: string;
  geography: string;
  confidence: number;
  extractedAt: string;
  source: string;
  rawText: string;
  status: QueueStatus;
}

interface RegimeAlert {
  subtypeId: string;
  subtypeName: string;
  biasedCount: number;
  totalCount: number;
  direction: 'HIGH' | 'LOW';
  recommendation: string;
}

interface OverrideLog {
  id: string;
  eventName: string;
  metric: string;
  window: string;
  original: string;
  overridden: string;
  adminUser: string;
  overrideAt: string;
  usedAsSignal: boolean;
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO_QUEUE: QueueEvent[] = [
  {
    id: 'q-001', name: 'Amazon Distribution Center — Phoenix', category: 'employment',
    scope: 'submarket', geography: 'Phoenix-Mesa-Scottsdale, AZ',
    confidence: 0.52, extractedAt: '2026-04-14 08:30', source: 'WSJ Article',
    rawText: 'Amazon announced a new 2M sqft distribution center in Goodyear, AZ creating 1,200 permanent jobs.',
    status: 'pending',
  },
  {
    id: 'q-002', name: 'Midtown Rail Extension — Atlanta', category: 'infrastructure',
    scope: 'submarket', geography: 'Atlanta-Sandy Springs, GA',
    confidence: 0.44, extractedAt: '2026-04-13 14:15', source: 'AJC',
    rawText: 'MARTA board approved $1.2B extension connecting Buckhead to Midtown via new underground alignment.',
    status: 'pending',
  },
  {
    id: 'q-003', name: 'FL Senate HB-1421 — Insurance Reform', category: 'policy',
    scope: 'msa', geography: 'Florida statewide',
    confidence: 0.38, extractedAt: '2026-04-12 10:05', source: 'FL Legislature feed',
    rawText: 'Senate Bill HB-1421 passed committee, proposing 18% cap on property insurance rate increases over 24mo.',
    status: 'pending',
  },
  {
    id: 'q-004', name: 'Meta Office Expansion — Austin', category: 'employment',
    scope: 'submarket', geography: 'Austin-Round Rock, TX',
    confidence: 0.57, extractedAt: '2026-04-11 16:45', source: 'Business Insider',
    rawText: 'Meta leased 180,000 sqft in new Domain office tower, expanding Austin headcount by 1,800 roles.',
    status: 'approved',
  },
];

const DEMO_REGIMES: RegimeAlert[] = [
  {
    subtypeId: 'ins-rate', subtypeName: 'Insurance Rate Shock',
    biasedCount: 5, totalCount: 8, direction: 'HIGH',
    recommendation: 'Inflate impact magnitude by 15-20% to account for post-pandemic insurance environment.',
  },
  {
    subtypeId: 'rate-hike', subtypeName: 'Fed Rate Hike Cycle',
    biasedCount: 7, totalCount: 12, direction: 'LOW',
    recommendation: 'Reduce cap rate expansion magnitude. Rental demand resilience exceeds historical pattern.',
  },
];

const DEMO_OVERRIDES: OverrideLog[] = [
  { id: 'ov-001', eventName: 'Amazon HQ2 — Tampa', metric: 'rent_growth_yoy', window: 'T+12→T+24', original: '+1.8%', overridden: '+2.4%', adminUser: 'L.Dixon', overrideAt: '2026-03-22 09:15', usedAsSignal: true },
  { id: 'ov-002', eventName: 'BRT Phase 1 — Denver', metric: 'absorption', window: 'T+6→T+12', original: '+180u', overridden: '+220u', adminUser: 'L.Dixon', overrideAt: '2026-02-18 14:30', usedAsSignal: false },
  { id: 'ov-003', eventName: 'Tesla Giga — Austin', metric: 'cap_rate', window: 'T+0→T+12', original: '-0.4%', overridden: '-0.6%', adminUser: 'L.Dixon', overrideAt: '2026-01-30 11:00', usedAsSignal: true },
];

// ─── Ingestion Queue ──────────────────────────────────────────────────────────

function IngestionQueue({ items, onApprove, onReject }: {
  items: QueueEvent[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const pending = items.filter(i => i.status === 'pending');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: TEXT.sub, ...mono, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          INGESTION REVIEW QUEUE
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, padding: '2px 8px', background: `${C.amber}18`, border: `1px solid ${C.amber}44`, color: C.amber, ...mono }}>
            {pending.length} PENDING REVIEW
          </span>
          <span style={{ fontSize: 9, color: TEXT.muted, ...mono }}>Confidence 0.3–0.6</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(item => {
          const isExpanded = expanded === item.id;
          const confColor = item.confidence >= 0.5 ? C.cyan : item.confidence >= 0.4 ? C.amber : TEXT.muted;
          const statusColor = item.status === 'approved' ? C.green : item.status === 'rejected' ? C.red : C.amber;
          return (
            <div key={item.id} style={{ border: `1px solid ${BORDER}`, background: PANEL, overflow: 'hidden' }}>
              <div
                style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                onClick={() => setExpanded(isExpanded ? null : item.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 9, padding: '1px 6px', background: `${statusColor}18`, border: `1px solid ${statusColor}44`, color: statusColor, ...mono }}>
                    {item.status.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: TEXT.primary }}>{item.name}</div>
                    <div style={{ fontSize: 9, color: TEXT.muted, marginTop: 1, ...mono }}>
                      {item.category.toUpperCase()} · {item.scope.toUpperCase()} · {item.geography}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: confColor, textAlign: 'right', ...mono }}>
                      {(item.confidence * 100).toFixed(0)}%
                    </div>
                    <div style={{ fontSize: 8, color: TEXT.muted, ...mono }}>confidence</div>
                  </div>
                  <div style={{ fontSize: 9, color: TEXT.muted, ...mono }}>{item.extractedAt}</div>
                  {item.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={e => { e.stopPropagation(); onApprove(item.id); }}
                        style={{ padding: '4px 10px', fontSize: 9, background: `${C.green}18`, border: `1px solid ${C.green}55`, color: C.green, cursor: 'pointer', ...mono }}
                      >
                        <Check size={10} style={{ display: 'inline', marginRight: 3 }} /> APPROVE
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); onReject(item.id); }}
                        style={{ padding: '4px 10px', fontSize: 9, background: `${C.red}18`, border: `1px solid ${C.red}55`, color: C.red, cursor: 'pointer', ...mono }}
                      >
                        <X size={10} style={{ display: 'inline', marginRight: 3 }} /> REJECT
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div style={{ borderTop: `1px solid ${BORDER}`, padding: '10px 14px', background: '#0B0E1A' }}>
                  <div style={{ fontSize: 9, color: TEXT.muted, ...mono, marginBottom: 4 }}>SOURCE: {item.source}</div>
                  <div style={{ fontSize: 11, color: TEXT.sub, lineHeight: 1.5, fontStyle: 'italic' }}>"{item.rawText}"</div>
                  {item.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button
                        onClick={() => onApprove(item.id)}
                        style={{ padding: '5px 16px', fontSize: 10, background: `${C.green}18`, border: `1px solid ${C.green}66`, color: C.green, cursor: 'pointer', ...mono }}
                      >
                        APPROVE → Create Key Event
                      </button>
                      <button
                        style={{ padding: '5px 16px', fontSize: 10, background: `${C.cyan}18`, border: `1px solid ${C.cyan}66`, color: C.cyan, cursor: 'pointer', ...mono }}
                      >
                        <Edit3 size={9} style={{ display: 'inline', marginRight: 4 }} /> EDIT & APPROVE
                      </button>
                      <button
                        onClick={() => onReject(item.id)}
                        style={{ padding: '5px 16px', fontSize: 10, background: `${C.red}18`, border: `1px solid ${C.red}66`, color: C.red, cursor: 'pointer', ...mono }}
                      >
                        REJECT
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const AdminEventsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'queue' | 'regime' | 'overrides'>('queue');
  const [queue, setQueue] = useState<QueueEvent[]>(DEMO_QUEUE);
  const [regimes] = useState<RegimeAlert[]>(DEMO_REGIMES);
  const [overrides] = useState<OverrideLog[]>(DEMO_OVERRIDES);

  const handleApprove = (id: string) => {
    setQueue(q => q.map(item => item.id === id ? { ...item, status: 'approved' } : item));
  };
  const handleReject = (id: string) => {
    setQueue(q => q.map(item => item.id === id ? { ...item, status: 'rejected' } : item));
  };

  const TABS = [
    { id: 'queue', label: 'INGESTION QUEUE', badge: queue.filter(q => q.status === 'pending').length },
    { id: 'regime', label: 'REGIME ALERTS', badge: regimes.length },
    { id: 'overrides', label: 'OVERRIDE LOG', badge: overrides.length },
  ] as const;

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT.primary, padding: '20px 24px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Back nav */}
        <button
          onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 12, color: TEXT.muted, background: 'none', border: 'none', cursor: 'pointer', ...mono }}
        >
          <ArrowLeft size={14} /> Admin / M35 Events
        </button>

        {/* Page header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: TEXT.primary, textTransform: 'uppercase', letterSpacing: '-0.02em', margin: 0 }}>
            M35 ADMIN — EVENT VERIFICATION
          </h1>
          <div style={{ fontSize: 12, color: TEXT.muted, marginTop: 4, ...mono }}>
            Review auto-extracted events · Monitor regime shifts · Manage forecast overrides
          </div>
        </div>

        {/* Tab strip */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, marginBottom: 20 }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 20px', fontSize: 10, fontWeight: 700, ...mono,
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: activeTab === tab.id ? `2px solid ${C.cyan}` : '2px solid transparent',
                color: activeTab === tab.id ? C.cyan : TEXT.muted,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {tab.label}
              {tab.badge > 0 && (
                <span style={{
                  fontSize: 8, padding: '1px 5px',
                  background: activeTab === tab.id ? `${C.cyan}22` : `${TEXT.muted}22`,
                  border: `1px solid ${activeTab === tab.id ? C.cyan : TEXT.muted}44`,
                  color: activeTab === tab.id ? C.cyan : TEXT.muted, borderRadius: 8,
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* INGESTION QUEUE */}
        {activeTab === 'queue' && (
          <IngestionQueue items={queue} onApprove={handleApprove} onReject={handleReject} />
        )}

        {/* REGIME ALERTS */}
        {activeTab === 'regime' && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: TEXT.sub, ...mono, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
              REGIME SHIFT ALERTS — BACKTESTING
            </div>
            {regimes.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', fontSize: 11, color: TEXT.muted, ...mono }}>No regime shifts detected</div>
            ) : regimes.map(r => (
              <div key={r.subtypeId} style={{ border: `1px solid ${C.amber}55`, background: PANEL, padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <AlertTriangle size={14} color={C.amber} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: TEXT.primary }}>{r.subtypeName}</span>
                      <span style={{ fontSize: 9, padding: '1px 6px', background: `${C.amber}18`, border: `1px solid ${C.amber}44`, color: C.amber, ...mono }}>
                        {r.direction === 'HIGH' ? <TrendingUp size={9} style={{ display: 'inline' }} /> : <TrendingDown size={9} style={{ display: 'inline' }} />}
                        {' '}BIASED {r.direction}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: TEXT.muted, ...mono }}>
                      {r.biasedCount} of {r.totalCount} recent backtests biased {r.direction.toLowerCase()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ padding: '4px 12px', fontSize: 9, background: `${C.green}18`, border: `1px solid ${C.green}55`, color: C.green, cursor: 'pointer', ...mono }}>
                      ACKNOWLEDGE
                    </button>
                    <button style={{ padding: '4px 12px', fontSize: 9, background: `${C.cyan}18`, border: `1px solid ${C.cyan}55`, color: C.cyan, cursor: 'pointer', ...mono }}>
                      ADJUST PLAYBOOK
                    </button>
                  </div>
                </div>
                <div style={{ padding: '8px 12px', background: '#0B0E1A', border: `1px solid ${BORDER}`, fontSize: 10, color: TEXT.sub }}>
                  <strong style={{ color: C.amber }}>Recommendation: </strong>{r.recommendation}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* OVERRIDE LOG */}
        {activeTab === 'overrides' && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: TEXT.sub, ...mono, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
              FORECAST OVERRIDE LOG
            </div>
            <div style={{ border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr style={{ background: '#0B0E1A', borderBottom: `1px solid ${BORDER}` }}>
                    {['EVENT', 'METRIC', 'WINDOW', 'ORIGINAL', 'OVERRIDDEN', 'ADMIN', 'DATE', 'TRAINING SIGNAL'].map(h => (
                      <th key={h} style={{ padding: '7px 12px', textAlign: 'left', color: TEXT.muted, fontWeight: 600, ...mono, fontSize: 9 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {overrides.map(ov => (
                    <tr key={ov.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                      <td style={{ padding: '9px 12px', color: TEXT.primary, fontWeight: 600 }}>{ov.eventName}</td>
                      <td style={{ padding: '9px 12px', color: TEXT.sub, ...mono }}>{ov.metric}</td>
                      <td style={{ padding: '9px 12px', color: TEXT.sub, ...mono }}>{ov.window}</td>
                      <td style={{ padding: '9px 12px', color: TEXT.muted, ...mono }}>{ov.original}</td>
                      <td style={{ padding: '9px 12px', color: C.amber, fontWeight: 700, ...mono }}>{ov.overridden}</td>
                      <td style={{ padding: '9px 12px', color: TEXT.sub, ...mono }}>{ov.adminUser}</td>
                      <td style={{ padding: '9px 12px', color: TEXT.muted, ...mono, fontSize: 9 }}>{ov.overrideAt}</td>
                      <td style={{ padding: '9px 12px' }}>
                        {ov.usedAsSignal ? (
                          <span style={{ fontSize: 9, color: C.green, ...mono }}>✓ USED</span>
                        ) : (
                          <span style={{ fontSize: 9, color: TEXT.muted, ...mono }}>— EXCLUDED</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminEventsPage;
