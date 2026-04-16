/**
 * M35 EventDependencyModal
 *
 * Pre-run acknowledgment modal triggered before "Apply to ProForma" or "Run Strategy".
 * Lists all event-dependent assumptions with confidence, event status, and what they drive.
 * Three action buttons: Proceed with forecasts | Run without events | Customize.
 * Includes a risk callout for pending (not yet fired) events.
 */

import React from 'react';
import { BT } from '../deal/bloomberg-ui';
import { X, AlertTriangle, CheckCircle, Clock, Sliders } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EventDependency {
  eventId: string;
  eventName: string;
  eventStatus: string;
  confidence: number;
  drives: string[];       // e.g. ['Rent Growth YoY T+12', 'Cap Rate T+24']
  scope: string;
  magnitudeScore: number;
}

interface EventDependencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  onRunWithoutEvents: () => void;
  onCustomize: () => void;
  dependencies: EventDependency[];
  context?: 'proforma' | 'strategy';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SCOPE_COLOR: Record<string, string> = {
  msa:       '#6B7280',
  submarket: '#0891B2',
  property:  '#D97706',
};

function StatusIcon({ status }: { status: string }) {
  if (status === 'materialized') {
    return <CheckCircle size={10} style={{ color: BT.text.green, flexShrink: 0 }} />;
  }
  if (status === 'in_progress') {
    return <CheckCircle size={10} style={{ color: BT.text.cyan, flexShrink: 0 }} />;
  }
  return <Clock size={10} style={{ color: BT.text.amber, flexShrink: 0 }} />;
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 0.7 ? BT.text.green : value >= 0.5 ? BT.text.cyan : BT.text.amber;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 48, height: 3, background: BT.border.medium, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${value * 100}%`, background: color }} />
      </div>
      <span style={{ fontSize: 7, color, fontFamily: BT.font.mono, fontWeight: 700, width: 24 }}>
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EventDependencyModal({
  isOpen,
  onClose,
  onProceed,
  onRunWithoutEvents,
  onCustomize,
  dependencies,
  context = 'proforma',
}: EventDependencyModalProps) {
  const mono = BT.font.mono;

  if (!isOpen) return null;

  const pendingCount = dependencies.filter(d =>
    !['materialized', 'in_progress'].includes(d.eventStatus)
  ).length;

  const contextLabel = context === 'proforma' ? 'PRO FORMA' : 'STRATEGY';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: '#00000088', zIndex: 9998,
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9999,
        width: 480,
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        background: BT.bg.panel,
        border: `1px solid ${BT.border.medium}`,
        boxShadow: '0 16px 48px #00000099',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: `1px solid ${BT.border.subtle}`,
          flexShrink: 0,
          background: BT.bg.header,
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: BT.text.primary, fontFamily: mono, letterSpacing: 0.4 }}>
              EVENT DEPENDENCY REVIEW
            </div>
            <div style={{ fontSize: 8, color: BT.text.muted, fontFamily: mono, marginTop: 1 }}>
              Before running {contextLabel} · {dependencies.length} event-dependent assumption{dependencies.length !== 1 ? 's' : ''}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: BT.text.muted, padding: 2 }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Risk callout for pending events */}
        {pendingCount > 0 && (
          <div style={{
            margin: '10px 14px 0',
            padding: '7px 10px',
            background: `${BT.text.amber}12`,
            border: `1px solid ${BT.text.amber}44`,
            display: 'flex',
            gap: 7,
            alignItems: 'flex-start',
            flexShrink: 0,
          }}>
            <AlertTriangle size={11} style={{ color: BT.text.amber, flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 8, color: BT.text.amber, fontFamily: mono, lineHeight: 1.5 }}>
              <strong>{pendingCount} pending event{pendingCount !== 1 ? 's' : ''}</strong> not yet fired.
              Forecasts for these events carry higher uncertainty. Using them introduces assumption risk
              if the event is delayed or cancelled.
            </div>
          </div>
        )}

        {/* Event list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {dependencies.map(dep => (
            <div
              key={dep.eventId}
              style={{
                padding: '8px 10px',
                background: BT.bg.panelAlt,
                border: `1px solid ${BT.border.subtle}`,
                borderLeft: `3px solid ${SCOPE_COLOR[dep.scope?.toLowerCase()] || SCOPE_COLOR.msa}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, minWidth: 0 }}>
                  <StatusIcon status={dep.eventStatus} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: BT.text.primary, fontFamily: mono, letterSpacing: 0.2 }}>
                      {dep.eventName}
                    </div>
                    <div style={{ fontSize: 7, color: BT.text.muted, fontFamily: mono, marginTop: 1, textTransform: 'uppercase' }}>
                      {dep.eventStatus.replace(/_/g, ' ')} · {dep.scope}
                    </div>
                  </div>
                </div>
                <ConfidenceBar value={dep.confidence} />
              </div>

              {dep.drives.length > 0 && (
                <div style={{ marginTop: 5, paddingTop: 5, borderTop: `1px solid ${BT.border.subtle}` }}>
                  <div style={{ fontSize: 7, color: BT.text.muted, fontFamily: mono, marginBottom: 2 }}>DRIVES:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {dep.drives.slice(0, 5).map((d, i) => (
                      <span key={i} style={{
                        fontSize: 7, color: BT.text.secondary, fontFamily: mono,
                        background: BT.bg.hover, padding: '1px 5px',
                      }}>
                        {d}
                      </span>
                    ))}
                    {dep.drives.length > 5 && (
                      <span style={{ fontSize: 7, color: BT.text.muted, fontFamily: mono }}>
                        +{dep.drives.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {dependencies.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: BT.text.muted, fontSize: 9, fontFamily: mono }}>
              No active event dependencies for this deal.
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{
          display: 'flex',
          gap: 8,
          padding: '10px 14px',
          borderTop: `1px solid ${BT.border.subtle}`,
          flexShrink: 0,
          background: BT.bg.header,
        }}>
          <button
            onClick={onProceed}
            style={{
              flex: 1,
              padding: '7px 12px',
              background: BT.text.cyan,
              border: 'none',
              cursor: 'pointer',
              fontFamily: mono,
              fontSize: 9,
              fontWeight: 700,
              color: BT.bg.terminal,
              letterSpacing: 0.4,
            }}
          >
            PROCEED WITH FORECASTS
          </button>
          <button
            onClick={onRunWithoutEvents}
            style={{
              flex: 1,
              padding: '7px 12px',
              background: 'transparent',
              border: `1px solid ${BT.border.medium}`,
              cursor: 'pointer',
              fontFamily: mono,
              fontSize: 9,
              fontWeight: 700,
              color: BT.text.secondary,
              letterSpacing: 0.4,
            }}
          >
            RUN WITHOUT EVENTS
          </button>
          <button
            onClick={onCustomize}
            style={{
              padding: '7px 10px',
              background: 'transparent',
              border: `1px solid ${BT.border.medium}`,
              cursor: 'pointer',
              fontFamily: mono,
              fontSize: 8,
              color: BT.text.muted,
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <Sliders size={10} /> CUSTOMIZE
          </button>
        </div>
      </div>
    </>
  );
}
