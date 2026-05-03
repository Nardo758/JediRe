import { logSwallowedError } from '../../utils/swallowedError';
/**
 * PlaybookLibraryPage — /playbooks
 * Master list of all M35 event subtypes with playbook statistics.
 * Subtype detail view: stratified response curves, backtest hit-rate chart,
 * regime-shift flag. Admin-only: watchlist config edit.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart2, Shield, AlertTriangle } from 'lucide-react';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };
const BG = '#0B0E1A';
const PANEL = '#131929';
const BORDER = '#1E2538';
const TEXT = { primary: '#E2E8F0', muted: '#6B7A8D', sub: '#A0ABBE' };
const C = { green: '#10B981', cyan: '#0891B2', amber: '#D97706', red: '#EF4444' };

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlaybookSubtype {
  id: string;
  name: string;
  category: string;
  instanceCount: number;
  confidenceScore: number;
  tier: 1 | 2 | 3;
  regimeShiftFlag: boolean;
  regimeShiftNote?: string;
  hitRate12mo: number;
  hitRate24mo: number;
  hitRate36mo: number;
  lastUpdated: string;
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO_SUBTYPES: PlaybookSubtype[] = [
  { id: 'emp-large',    name: 'Major Employment Expansion',  category: 'employment',      instanceCount: 43, confidenceScore: 87, tier: 1, regimeShiftFlag: false, hitRate12mo: 0.83, hitRate24mo: 0.79, hitRate36mo: 0.74, lastUpdated: '2026-03-15' },
  { id: 'transit-brt',  name: 'BRT / Light Rail Opening',   category: 'infrastructure',  instanceCount: 28, confidenceScore: 81, tier: 1, regimeShiftFlag: false, hitRate12mo: 0.78, hitRate24mo: 0.74, hitRate36mo: 0.71, lastUpdated: '2026-02-20' },
  { id: 'supply-wave',  name: 'Supply Delivery Wave',        category: 'supply',          instanceCount: 67, confidenceScore: 76, tier: 1, regimeShiftFlag: false, hitRate12mo: 0.81, hitRate24mo: 0.76, hitRate36mo: 0.69, lastUpdated: '2026-04-01' },
  { id: 'upzone',       name: 'Zoning Upzone / Rezoning',   category: 'policy',          instanceCount: 19, confidenceScore: 68, tier: 2, regimeShiftFlag: false, hitRate12mo: 0.71, hitRate24mo: 0.64, hitRate36mo: 0.59, lastUpdated: '2026-01-10' },
  { id: 'ins-rate',     name: 'Insurance Rate Shock',        category: 'policy',          instanceCount: 12, confidenceScore: 62, tier: 2, regimeShiftFlag: true,  regimeShiftNote: '5 of last 8 backtests biased HIGH. Rate environment shift detected.', hitRate12mo: 0.58, hitRate24mo: 0.52, hitRate36mo: 0.47, lastUpdated: '2026-03-28' },
  { id: 'corp-hq',      name: 'Corporate HQ Relocation',    category: 'employment',      instanceCount: 31, confidenceScore: 74, tier: 1, regimeShiftFlag: false, hitRate12mo: 0.76, hitRate24mo: 0.70, hitRate36mo: 0.65, lastUpdated: '2026-02-14' },
  { id: 'demo-shift',   name: 'Demographic Inflection',     category: 'demographic',     instanceCount: 8,  confidenceScore: 55, tier: 3, regimeShiftFlag: false, hitRate12mo: 0.62, hitRate24mo: 0.57, hitRate36mo: 0.51, lastUpdated: '2025-12-05' },
  { id: 'rate-hike',    name: 'Fed Rate Hike Cycle',         category: 'macro',           instanceCount: 14, confidenceScore: 70, tier: 2, regimeShiftFlag: true,  regimeShiftNote: '7 of last 12 backtests biased LOW. Current regime shows attenuated rent sensitivity.', hitRate12mo: 0.67, hitRate24mo: 0.61, hitRate36mo: 0.55, lastUpdated: '2026-04-10' },
];

const TIER_COLORS = { 1: C.green, 2: C.cyan, 3: TEXT.muted };
const TIER_LABELS = { 1: 'HIGH', 2: 'MEDIUM', 3: 'LOW' };
const CATEGORY_COLORS: Record<string, string> = {
  employment: C.green, infrastructure: C.cyan, supply: C.amber,
  policy: '#8B5CF6', demographic: '#EC4899', macro: TEXT.muted,
};

// ─── Subtype detail panel ─────────────────────────────────────────────────────

function SubtypeDetail({ sub, onClose }: { sub: PlaybookSubtype; onClose: () => void }) {
  const WINDOWS = ['T+0→T+12', 'T+12→T+24', 'T+24→T+36'];
  const p25 = ['+0.4%', '+0.9%', '+1.4%'];
  const med = ['+0.9%', '+1.8%', '+2.6%'];
  const p75 = ['+1.6%', '+3.1%', '+4.2%'];
  const hitRates = [sub.hitRate12mo, sub.hitRate24mo, sub.hitRate36mo];

  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 20, marginTop: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: TEXT.primary, ...mono }}>{sub.name}</div>
          <div style={{ fontSize: 10, color: TEXT.muted, marginTop: 2, ...mono }}>ID: M35-{sub.id.toUpperCase()} · {sub.instanceCount} historical instances</div>
        </div>
        <button onClick={onClose} style={{ fontSize: 10, color: TEXT.muted, background: 'none', border: 'none', cursor: 'pointer', ...mono }}>✕ CLOSE</button>
      </div>

      {/* Regime shift warning */}
      {sub.regimeShiftFlag && (
        <div style={{
          padding: '8px 12px', marginBottom: 16,
          background: `${C.amber}15`, border: `1px solid ${C.amber}55`,
          display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <AlertTriangle size={14} color={C.amber} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.amber, ...mono, marginBottom: 3 }}>REGIME SHIFT DETECTED</div>
            <div style={{ fontSize: 10, color: TEXT.sub }}>{sub.regimeShiftNote}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Stratified response curves */}
        <div style={{ border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
          <div style={{ padding: '6px 10px', background: '#0B0E1A', borderBottom: `1px solid ${BORDER}`, fontSize: 9, fontWeight: 700, color: TEXT.sub, ...mono }}>
            STRATIFIED RESPONSE CURVES — RENT GROWTH
          </div>
          <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {['Window', 'p25', 'Median', 'p75'].map(h => (
                  <th key={h} style={{ padding: '5px 8px', textAlign: 'left', color: TEXT.muted, fontWeight: 600, ...mono }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WINDOWS.map((w, i) => (
                <tr key={w} style={{ borderBottom: `1px solid ${BORDER}88` }}>
                  <td style={{ padding: '5px 8px', color: TEXT.sub, ...mono }}>{w}</td>
                  <td style={{ padding: '5px 8px', color: TEXT.muted, ...mono }}>{p25[i]}</td>
                  <td style={{ padding: '5px 8px', color: C.cyan, fontWeight: 700, ...mono }}>{med[i]}</td>
                  <td style={{ padding: '5px 8px', color: TEXT.muted, ...mono }}>{p75[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Backtest hit-rate chart */}
        <div style={{ border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
          <div style={{ padding: '6px 10px', background: '#0B0E1A', borderBottom: `1px solid ${BORDER}`, fontSize: 9, fontWeight: 700, color: TEXT.sub, ...mono }}>
            BACKTEST HIT-RATE BY WINDOW
          </div>
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {WINDOWS.map((w, i) => {
              const rate = hitRates[i];
              const color = rate >= 0.75 ? C.green : rate >= 0.60 ? C.cyan : C.amber;
              return (
                <div key={w}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 9, color: TEXT.muted, ...mono }}>{w}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color, ...mono }}>{(rate * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 8, background: '#0B0E1A', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${rate * 100}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.4s' }} />
                  </div>
                </div>
              );
            })}
            <div style={{ fontSize: 8, color: TEXT.muted, ...mono, marginTop: 2 }}>
              Confidence Tier: {' '}
              <span style={{ color: TIER_COLORS[sub.tier], fontWeight: 700 }}>
                {TIER_LABELS[sub.tier]} ({sub.confidenceScore}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Admin watchlist config */}
      <div style={{ marginTop: 12, padding: '8px 12px', border: `1px solid ${BORDER}`, background: '#0B0E1A' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: TEXT.muted, ...mono, marginBottom: 8 }}>WATCHLIST METRICS — {sub.name.toUpperCase()}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['rent_growth_yoy', 'cap_rate', 'absorption', 'permits', 'vacancy_rate'].map(m => (
            <span key={m} style={{
              padding: '2px 8px', fontSize: 8, ...mono,
              background: `${C.cyan}18`, border: `1px solid ${C.cyan}44`, color: C.cyan, borderRadius: 2,
            }}>
              {m}
            </span>
          ))}
          <button style={{
            padding: '2px 8px', fontSize: 8, ...mono, cursor: 'pointer',
            background: `${C.amber}15`, border: `1px solid ${C.amber}44`, color: C.amber, borderRadius: 2,
          }}>
            + ADD METRIC
          </button>
        </div>
        <div style={{ fontSize: 8, color: TEXT.muted, marginTop: 6, ...mono }}>Admin only · Changes take effect on next M35 job run</div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PlaybookLibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const [subtypes, setSubtypes] = useState<PlaybookSubtype[]>([]);
  const [selected, setSelected] = useState<PlaybookSubtype | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/m35/playbooks/subtypes');
      if (res.ok) { setSubtypes(await res.json()); setLoading(false); return; }
    } catch (err) { logSwallowedError('pages/m35/PlaybookLibraryPage', err); }
    setSubtypes(DEMO_SUBTYPES);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = ['all', ...Array.from(new Set(DEMO_SUBTYPES.map(s => s.category)))];
  const filtered = filter === 'all' ? subtypes : subtypes.filter(s => s.category === filter);

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT.primary, padding: '20px 24px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Back nav */}
        <button
          onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 12, color: TEXT.muted, background: 'none', border: 'none', cursor: 'pointer', ...mono }}
        >
          <ArrowLeft size={14} /> M35 Event Intelligence / Playbook Library
        </button>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: TEXT.primary, textTransform: 'uppercase', letterSpacing: '-0.02em', margin: 0 }}>
              PLAYBOOK LIBRARY
            </h1>
            <div style={{ fontSize: 12, color: TEXT.muted, marginTop: 4, ...mono }}>
              {subtypes.length} event subtypes · {subtypes.reduce((s, t) => s + t.instanceCount, 0)} historical instances
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10, color: TEXT.muted, ...mono }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, display: 'inline-block' }} />
              Tier 1 ≥75%
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.cyan, display: 'inline-block' }} />
              Tier 2 60–75%
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: TEXT.muted, display: 'inline-block' }} />
              Tier 3 &lt;60%
            </span>
          </div>
        </div>

        {/* Category filter */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16 }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              style={{
                padding: '4px 12px', fontSize: 9, fontWeight: 700, ...mono,
                textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer',
                background: filter === cat ? (CATEGORY_COLORS[cat] ?? C.cyan) : 'transparent',
                border: `1px solid ${filter === cat ? (CATEGORY_COLORS[cat] ?? C.cyan) : BORDER}`,
                color: filter === cat ? (cat === 'all' ? TEXT.primary : '#0B0E1A') : TEXT.muted,
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Subtype table */}
        <div style={{ border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
          <div style={{ background: '#0B0E1A', borderBottom: `1px solid ${BORDER}`, padding: '5px 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, ...mono }}>
              <thead>
                <tr>
                  {['SUBTYPE NAME', 'CATEGORY', 'INSTANCES', 'CONFIDENCE', 'TIER', '12MO HIT', '24MO HIT', '36MO HIT', 'REGIME', 'UPDATED'].map(h => (
                    <th key={h} style={{ padding: '5px 12px', textAlign: 'left', color: TEXT.muted, fontWeight: 700, letterSpacing: 0.4 }}>{h}</th>
                  ))}
                </tr>
              </thead>
            </table>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', fontSize: 11, color: TEXT.muted, ...mono }}>Loading playbooks...</div>
          ) : (
            <div>
              {filtered.map(sub => {
                const tierColor = TIER_COLORS[sub.tier];
                const catColor = CATEGORY_COLORS[sub.category] ?? TEXT.muted;
                const isSelected = selected?.id === sub.id;
                return (
                  <div key={sub.id}>
                    <table
                      style={{ width: '100%', borderCollapse: 'collapse', cursor: 'pointer' }}
                      onClick={() => setSelected(isSelected ? null : sub)}
                    >
                      <tbody>
                        <tr style={{
                          borderBottom: `1px solid ${BORDER}`,
                          background: isSelected ? `${C.cyan}08` : 'transparent',
                          transition: 'background 0.1s',
                        }}>
                          <td style={{ padding: '9px 12px', fontSize: 11, fontWeight: 600, color: TEXT.primary, width: '22%' }}>
                            {sub.name}
                            {sub.regimeShiftFlag && (
                              <AlertTriangle size={10} color={C.amber} style={{ marginLeft: 6, display: 'inline' }} />
                            )}
                          </td>
                          <td style={{ padding: '9px 12px', fontSize: 9, ...mono }}>
                            <span style={{ padding: '1px 6px', background: `${catColor}22`, border: `1px solid ${catColor}55`, color: catColor, borderRadius: 2 }}>
                              {sub.category.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '9px 12px', fontSize: 11, color: TEXT.primary, ...mono, textAlign: 'right', paddingRight: 24 }}>{sub.instanceCount}</td>
                          <td style={{ padding: '9px 12px', fontSize: 11, fontWeight: 700, color: tierColor, ...mono, textAlign: 'right', paddingRight: 24 }}>{sub.confidenceScore}%</td>
                          <td style={{ padding: '9px 12px', fontSize: 9, ...mono }}>
                            <span style={{ padding: '1px 6px', background: `${tierColor}22`, border: `1px solid ${tierColor}55`, color: tierColor, borderRadius: 2 }}>
                              {TIER_LABELS[sub.tier]}
                            </span>
                          </td>
                          <td style={{ padding: '9px 12px', fontSize: 10, color: sub.hitRate12mo >= 0.75 ? C.green : sub.hitRate12mo >= 0.60 ? C.cyan : C.amber, ...mono, textAlign: 'right', paddingRight: 24 }}>
                            {(sub.hitRate12mo * 100).toFixed(0)}%
                          </td>
                          <td style={{ padding: '9px 12px', fontSize: 10, color: sub.hitRate24mo >= 0.75 ? C.green : sub.hitRate24mo >= 0.60 ? C.cyan : C.amber, ...mono, textAlign: 'right', paddingRight: 24 }}>
                            {(sub.hitRate24mo * 100).toFixed(0)}%
                          </td>
                          <td style={{ padding: '9px 12px', fontSize: 10, color: sub.hitRate36mo >= 0.75 ? C.green : sub.hitRate36mo >= 0.60 ? C.cyan : C.amber, ...mono, textAlign: 'right', paddingRight: 24 }}>
                            {(sub.hitRate36mo * 100).toFixed(0)}%
                          </td>
                          <td style={{ padding: '9px 12px', fontSize: 9, ...mono }}>
                            {sub.regimeShiftFlag ? (
                              <span style={{ color: C.amber }}>⚠ SHIFT</span>
                            ) : (
                              <span style={{ color: TEXT.muted }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '9px 12px', fontSize: 9, color: TEXT.muted, ...mono }}>{sub.lastUpdated}</td>
                        </tr>
                      </tbody>
                    </table>
                    {isSelected && (
                      <SubtypeDetail sub={sub} onClose={() => setSelected(null)} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stats footer */}
        <div style={{ display: 'flex', gap: 24, marginTop: 16, padding: '10px 0', fontSize: 10, color: TEXT.muted, ...mono, borderTop: `1px solid ${BORDER}` }}>
          <span>Tier 1 subtypes: <strong style={{ color: C.green }}>{subtypes.filter(s => s.tier === 1).length}</strong></span>
          <span>Regime-shift flags: <strong style={{ color: C.amber }}>{subtypes.filter(s => s.regimeShiftFlag).length}</strong></span>
          <span>Avg confidence: <strong style={{ color: TEXT.primary }}>{subtypes.length ? (subtypes.reduce((s, t) => s + t.confidenceScore, 0) / subtypes.length).toFixed(0) : '—'}%</strong></span>
          <span style={{ marginLeft: 'auto' }}>Last engine run: 2026-04-14 03:00 UTC</span>
        </div>

      </div>
    </div>
  );
};

export default PlaybookLibraryPage;
