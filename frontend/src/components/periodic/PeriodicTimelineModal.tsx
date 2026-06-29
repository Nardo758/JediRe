import React, { useState } from 'react';
import { X, Table2, LineChart } from 'lucide-react';
import { BT } from '../deal/bloomberg-ui';
import { PeriodicGrid } from './PeriodicGrid';
import type { PeriodicGridPreset } from './PeriodicGrid.types';

interface PeriodicTimelineModalProps {
  dealId: string;
  preset: PeriodicGridPreset;
  isOpen: boolean;
  onClose: () => void;
}

export const PeriodicTimelineModal: React.FC<PeriodicTimelineModalProps> = ({
  dealId,
  preset,
  isOpen,
  onClose,
}) => {
  const [activeView, setActiveView] = useState<'grid' | 'chart'>('grid');

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
            {/* View toggle */}
            <div style={{ display: 'flex', gap: 2 }}>
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
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: BT.text.muted,
                fontFamily: BT.font.mono,
                fontSize: BT.fontSize.md,
              }}
            >
              CHART view — Step 3 (new renderer, same data)
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PeriodicTimelineModal;
