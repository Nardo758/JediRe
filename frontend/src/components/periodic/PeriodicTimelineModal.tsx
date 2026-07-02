import React, { useState, useEffect } from 'react';
import { X, Table2, LineChart } from 'lucide-react';
import { BT } from '../deal/bloomberg-ui';
import { PeriodicGrid } from './PeriodicGrid';
import { PeriodicChart } from './PeriodicChart';
import type { M35Event } from './PeriodicChart';
import type { PeriodicGridPreset } from './PeriodicGrid.types';

interface PeriodicTimelineModalProps {
  dealId: string;
  preset: PeriodicGridPreset;
  isOpen: boolean;
  onClose: () => void;
}

interface MarketEventsResponse {
  events: M35Event[];
  strategy?: string;
  reason?: string;
}

export const PeriodicTimelineModal: React.FC<PeriodicTimelineModalProps> = ({
  dealId,
  preset,
  isOpen,
  onClose,
}) => {
  const [activeView, setActiveView] = useState<'grid' | 'chart'>('chart');
  const [m35Events, setM35Events] = useState<M35Event[]>([]);
  const [m35Strategy, setM35Strategy] = useState<string | null>(null);
  const [m35Reason, setM35Reason] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !dealId) return;
    let cancelled = false;

    fetch(`/api/v1/deals/${dealId}/market-events`, { credentials: 'include' })
      .then(r => r.json())
      .then((body: MarketEventsResponse) => {
        if (cancelled) return;
        setM35Events(body.events ?? []);
        setM35Strategy(body.strategy ?? null);
        setM35Reason(body.reason ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setM35Events([]);
          setM35Reason('fetch_error');
        }
      });

    return () => { cancelled = true; };
  }, [isOpen, dealId]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(5, 8, 16, 0.85)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(96vw, 1400px)',
          height: 'min(92vh, 900px)',
          backgroundColor: BT.bg.terminal,
          border: `1px solid ${BT.border.medium}`,
          borderRadius: '2px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            backgroundColor: BT.bg.header,
            borderBottom: `1px solid ${BT.border.medium}`,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                fontFamily: BT.font.mono,
                fontSize: BT.fontSize.md,
                fontWeight: 600,
                color: BT.text.primary,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Periodic Timeline
            </span>
            {/* M35 strategy badge */}
            {m35Strategy && (
              <span
                style={{
                  fontFamily: BT.font.mono,
                  fontSize: BT.fontSize.xs,
                  color: '#A78BFA',
                  backgroundColor: '#A78BFA11',
                  padding: '2px 6px',
                  borderRadius: '2px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                M35 · {m35Events.length} event{m35Events.length !== 1 ? 's' : ''} · via {m35Strategy}
              </span>
            )}
            {m35Reason === 'no_geography_resolved' && (
              <span
                style={{
                  fontFamily: BT.font.mono,
                  fontSize: BT.fontSize.xs,
                  color: BT.text.muted,
                  backgroundColor: BT.bg.panelAlt,
                  padding: '2px 6px',
                  borderRadius: '2px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                M35 · no geography resolved
              </span>
            )}
            {/* View toggle — CHART is primary */}
            <div style={{ display: 'flex', gap: 2 }}>
              <button
                onClick={() => setActiveView('chart')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  fontSize: BT.fontSize.xs,
                  fontFamily: BT.font.mono,
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  backgroundColor: activeView === 'chart' ? BT.bg.active : BT.bg.panelAlt,
                  color: activeView === 'chart' ? BT.text.amber : BT.text.muted,
                }}
              >
                <LineChart size={12} />
                CHART
              </button>
              <button
                onClick={() => setActiveView('grid')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  fontSize: BT.fontSize.xs,
                  fontFamily: BT.font.mono,
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  backgroundColor: activeView === 'grid' ? BT.bg.active : BT.bg.panelAlt,
                  color: activeView === 'grid' ? BT.text.amber : BT.text.muted,
                }}
              >
                <Table2 size={12} />
                GRID
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: BT.text.muted,
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', padding: 8 }}>
          {activeView === 'grid' && (
            <PeriodicGrid dealId={dealId} preset={preset} />
          )}
          {activeView === 'chart' && (
            <PeriodicChart dealId={dealId} events={m35Events} />
          )}
        </div>
      </div>
    </div>
  );
};

export default PeriodicTimelineModal;
