import React, { useState } from 'react';
import { Table2, Maximize2 } from 'lucide-react';
import { BT } from '../deal/bloomberg-ui';
import { PeriodicTimelineModal } from './PeriodicTimelineModal';
import type { PeriodicGridPreset } from './PeriodicGrid.types';

interface PeriodicTimelineTriggerProps {
  dealId: string;
  preset: PeriodicGridPreset;
  label?: string;
}

export const PeriodicTimelineTrigger: React.FC<PeriodicTimelineTriggerProps> = ({
  dealId,
  preset,
  label = 'View Timeline',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          fontSize: BT.fontSize.xs,
          fontFamily: BT.font.mono,
          fontWeight: 500,
          color: BT.text.secondary,
          backgroundColor: BT.bg.panelAlt,
          border: `1px solid ${BT.border.medium}`,
          borderRadius: '2px',
          cursor: 'pointer',
          letterSpacing: '0.3px',
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = BT.bg.hover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = BT.bg.panelAlt;
        }}
      >
        <Table2 size={12} />
        {label}
        <Maximize2 size={10} style={{ opacity: 0.6 }} />
      </button>

      <PeriodicTimelineModal
        dealId={dealId}
        preset={preset}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
};

export default PeriodicTimelineTrigger;
