/**
 * ModuleToggle Component
 * Toggle between Basic (Free) and Enhanced (Premium) modes
 */

import React from 'react';
import { BT } from '@/components/deal/bloomberg-ui';
import { ModuleToggleProps } from '../../types/deal-enhanced.types';

export const ModuleToggle: React.FC<ModuleToggleProps> = ({
  mode,
  onModeChange,
  isPremium = false
}) => {
  return (
    <div className="flex items-center justify-center gap-0 p-1 w-fit" style={{ background: BT.bg.header, fontFamily: BT.font.mono }}>
      {/* Basic Toggle */}
      <button
        onClick={() => onModeChange('basic')}
        className="px-4 py-2 transition-all"
        style={{
          fontSize: 10,
          fontWeight: mode === 'basic' ? 700 : 400,
          background: mode === 'basic' ? BT.bg.active : 'transparent',
          color: mode === 'basic' ? BT.text.primary : BT.text.secondary,
          borderRadius: 0,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <span className="flex items-center gap-2">
          <span>📊</span>
          <span>Basic (Free)</span>
        </span>
      </button>

      {/* Enhanced Toggle */}
      <button
        onClick={() => onModeChange('enhanced')}
        className="px-4 py-2 transition-all"
        style={{
          fontSize: 10,
          fontWeight: mode === 'enhanced' ? 700 : 400,
          background: mode === 'enhanced' ? BT.text.amber : 'transparent',
          color: mode === 'enhanced' ? BT.bg.terminal : BT.text.secondary,
          borderRadius: 0,
          border: 'none',
          cursor: isPremium ? 'pointer' : 'not-allowed',
          opacity: isPremium ? 1 : 0.5,
        }}
        disabled={!isPremium}
      >
        <span className="flex items-center gap-2">
          <span>✨</span>
          <span>Enhanced (Premium)</span>
          {!isPremium && (
            <span className="ml-1 px-1.5 py-0.5" style={{ background: `${BT.text.amber}22`, color: BT.text.amber, fontSize: 9, borderRadius: 2 }}>
              🔒
            </span>
          )}
        </span>
      </button>
    </div>
  );
};

export default ModuleToggle;
