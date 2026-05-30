/**
 * CompletenesBadge — Deal Completeness Framework (Piece C1)
 *
 * Self-contained badge + panel for the deal header.  Uses apiClient (axios)
 * so the Authorization: Bearer token is sent automatically — raw fetch() is
 * not used here because auth is token-based (localStorage), not cookie-based.
 *
 * Badge rendering:
 *   Green  ◉ READY   — overallStatus = 'complete'
 *   Amber  ◉ N SIGNALS — overallStatus = 'degraded' (advisory only)
 *   Red    ◉ N SIGNALS — overallStatus = 'incomplete' (blocker present)
 *
 * Panel shows each signal with status icon, severity badge, description,
 * recommended action, optional CTA link, and acknowledge / retract button.
 */

import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '../../services/api.client';

const MONO = "'JetBrains Mono','Fira Code','SF Mono',monospace";
const CLR  = {
  green:  '#00D26A',
  amber:  '#F5A623',
  red:    '#EF4444',
  muted:  '#6B7A8D',
  border: '#1E2538',
  text:   '#E8ECF1',
  sub:    '#94A3B8',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface SignalState {
  id:                string;
  severity:          'blocker' | 'advisory';
  status:            'incomplete' | 'complete' | 'degraded';
  title:             string;
  description:       string;
  recommendedAction: string;
  ctaLabel?:         string;
  ctaLink?:          string;
  acknowledged:      boolean;
  acknowledgedAt?:   string;
}

interface DealCompleteness {
  dealId:            string;
  overallStatus:     'complete' | 'incomplete' | 'degraded';
  signals:           SignalState[];
  incompleteCount:   number;
  acknowledgedCount: number;
  computedAt:        string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusIcon(s: SignalState): string {
  if (s.status === 'complete')   return '✓';
  if (s.severity === 'blocker')  return '⚡';
  return '△';
}

function statusColor(s: SignalState): string {
  if (s.status === 'complete')  return CLR.green;
  if (s.severity === 'blocker') return CLR.red;
  return CLR.amber;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  dealId: string;
}

export function CompletenesBadge({ dealId }: Props) {
  const [data,   setData]   = useState<DealCompleteness | null>(null);
  const [open,   setOpen]   = useState(false);
  const [acking, setAcking] = useState<string | null>(null);
  const panelRef  = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // ── fetch ──────────────────────────────────────────────────────────────────

  const fetchData = async () => {
    try {
      const res = await apiClient.get<DealCompleteness>(
        `/api/v1/deals/${dealId}/completeness`,
      );
      setData(res.data);
    } catch { /* silent — badge is non-critical */ }
  };

  useEffect(() => {
    if (!dealId) return;
    fetchData();
  }, [dealId]);

  // ── close-on-outside-click ─────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current  && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ── acknowledge / unacknowledge ────────────────────────────────────────────

  const handleAck = async (signalId: string, currentlyAcknowledged: boolean) => {
    setAcking(signalId);
    try {
      const method = currentlyAcknowledged ? 'delete' : 'post';
      const res = await apiClient[method]<DealCompleteness>(
        `/api/v1/deals/${dealId}/completeness/${signalId}/acknowledge`,
      );
      setData(res.data);
    } finally {
      setAcking(null);
    }
  };

  // ── render nothing until data loads ───────────────────────────────────────

  if (!data) return null;

  const { overallStatus, signals, incompleteCount } = data;

  // Green READY state — still render (gives operator positive confirmation)
  if (overallStatus === 'complete') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '2px 8px',
        border: `1px solid ${CLR.green}44`,
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: 800,
        color: CLR.green,
        letterSpacing: 0.8,
        flexShrink: 0,
      }}
        title="All completeness signals pass — deal data is ready"
      >
        <span style={{ fontSize: 8 }}>◉</span>
        READY
      </div>
    );
  }

  const badgeColor =
    overallStatus === 'incomplete' ? CLR.red : CLR.amber;

  const badgeLabel = `${incompleteCount} SIGNAL${incompleteCount !== 1 ? 'S' : ''}`;

  // Sort: incomplete blockers → incomplete advisories → acknowledged → complete
  const sorted = [...signals].sort((a, b) => {
    const rank = (s: SignalState) =>
      !s.acknowledged && s.status !== 'complete' && s.severity === 'blocker' ? 0
      : !s.acknowledged && s.status !== 'complete'                           ? 1
      : s.acknowledged                                                        ? 2
      : 3;
    return rank(a) - rank(b);
  });

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {/* ── Badge button ── */}
      <button
        ref={buttonRef}
        onClick={() => setOpen(o => !o)}
        title="Deal completeness signals — click to review"
        style={{
          background: 'transparent',
          border: `1px solid ${badgeColor}55`,
          cursor: 'pointer',
          padding: '2px 8px',
          fontFamily: MONO,
          fontSize: 9,
          fontWeight: 800,
          color: badgeColor,
          letterSpacing: 0.8,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          transition: 'border-color 0.15s, background 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = badgeColor;
          e.currentTarget.style.background  = `${badgeColor}10`;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = `${badgeColor}55`;
          e.currentTarget.style.background  = 'transparent';
        }}
      >
        <span style={{ fontSize: 8 }}>◉</span>
        {badgeLabel}
        <span style={{ fontSize: 7, opacity: 0.7 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* ── Panel ── */}
      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            zIndex: 9999,
            marginTop: 4,
            width: 400,
            maxHeight: 560,
            overflowY: 'auto',
            background: '#0F1319',
            border: `1px solid ${badgeColor}55`,
            borderTop: `2px solid ${badgeColor}`,
            boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
            fontFamily: MONO,
          }}
        >
          {/* Panel header */}
          <div style={{
            padding: '8px 12px',
            borderBottom: `1px solid ${CLR.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <span style={{ fontSize: 9, fontWeight: 800, color: badgeColor, letterSpacing: 1 }}>
                DEAL COMPLETENESS
              </span>
              <span style={{ fontSize: 8, color: CLR.muted, marginLeft: 8 }}>
                {`${incompleteCount} unresolved · ${data.acknowledgedCount} acknowledged`}
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: CLR.muted, fontSize: 10, padding: 2 }}
            >
              ✕
            </button>
          </div>

          {/* Signal rows */}
          {sorted.map(sig => {
            const color     = statusColor(sig);
            const icon      = statusIcon(sig);
            const isLoading = acking === sig.id;

            return (
              <div key={sig.id} style={{
                padding: '10px 12px',
                borderBottom: `1px solid ${CLR.border}40`,
                background: sig.status !== 'complete' && !sig.acknowledged ? `${color}05` : 'transparent',
              }}>
                {/* Row header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontSize: 11, color, flexShrink: 0, marginTop: 1, lineHeight: 1 }}>
                    {icon}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: CLR.text, lineHeight: 1.3 }}>
                        {sig.title}
                      </span>
                      <span style={{
                        fontSize: 6.5, fontWeight: 700, letterSpacing: 0.5,
                        padding: '1px 4px',
                        color: sig.severity === 'blocker' ? CLR.red : CLR.amber,
                        border: `1px solid ${sig.severity === 'blocker' ? CLR.red : CLR.amber}44`,
                      }}>
                        {sig.severity.toUpperCase()}
                      </span>
                      {sig.acknowledged && (
                        <span style={{ fontSize: 6.5, color: CLR.muted, letterSpacing: 0.5 }}>
                          ACKNOWLEDGED
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    <p style={{
                      fontSize: 8, color: CLR.sub, margin: '4px 0 0 0',
                      lineHeight: 1.5, letterSpacing: 0.2,
                    }}>
                      {sig.description}
                    </p>

                    {/* Recommended action — only for non-complete, non-acknowledged signals */}
                    {sig.status !== 'complete' && !sig.acknowledged && (
                      <div style={{
                        marginTop: 6, padding: '4px 8px',
                        background: `${color}08`,
                        border: `1px solid ${color}22`,
                        fontSize: 8, color: CLR.text, lineHeight: 1.5,
                      }}>
                        <span style={{ color, fontWeight: 700 }}>→ </span>
                        {sig.recommendedAction}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      {sig.ctaLabel && sig.ctaLink && sig.status !== 'complete' && !sig.acknowledged && (
                        <a
                          href={sig.ctaLink}
                          style={{
                            fontSize: 8, fontWeight: 700, color, letterSpacing: 0.5,
                            textDecoration: 'none',
                            padding: '2px 6px',
                            border: `1px solid ${color}44`,
                          }}
                          onClick={() => setOpen(false)}
                        >
                          {sig.ctaLabel} →
                        </a>
                      )}

                      {sig.status !== 'complete' && (
                        <button
                          onClick={() => handleAck(sig.id, sig.acknowledged)}
                          disabled={isLoading}
                          style={{
                            background: 'none',
                            border: `1px solid ${CLR.border}`,
                            cursor: 'pointer',
                            padding: '2px 6px',
                            fontFamily: MONO,
                            fontSize: 7.5,
                            color: sig.acknowledged ? CLR.muted : CLR.sub,
                            letterSpacing: 0.4,
                            opacity: isLoading ? 0.5 : 1,
                          }}
                        >
                          {isLoading ? '...' : sig.acknowledged ? '↩ RETRACT' : 'PROCEED ANYWAY'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Footer */}
          <div style={{
            padding: '6px 12px',
            borderTop: `1px solid ${CLR.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: 7, color: CLR.muted, letterSpacing: 0.5 }}>
              COMPLETENESS FRAMEWORK · C1
            </span>
            <span style={{ fontSize: 7, color: CLR.muted }}>
              {new Date(data.computedAt).toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
