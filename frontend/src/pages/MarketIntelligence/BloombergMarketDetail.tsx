import React from 'react';
import { T as BT, mono } from '../../components/deal/bloomberg-tokens';

interface BloombergMarketDetailProps {
  submarketId?: string | number;
  submarketName?: string;
  onClose?: () => void;
}

const BloombergMarketDetail: React.FC<BloombergMarketDetailProps> = ({ submarketId, submarketName, onClose }) => {
  return (
    <div style={{ background: BT.bg.terminal, minHeight: '100%', color: BT.text.white, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, borderBottom: `2px solid ${BT.cyanL}`, paddingBottom: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: BT.cyanL, letterSpacing: 2, textTransform: 'uppercase', ...mono }}>
            Market Detail
          </div>
          {submarketName && (
            <div style={{ fontSize: 18, fontWeight: 700, color: BT.text.white, marginTop: 4 }}>
              {submarketName}
            </div>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: `1px solid ${BT.border}`, color: BT.td, padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
          >
            ✕ Close
          </button>
        )}
      </div>
      <div style={{ color: BT.td, fontSize: 12, ...mono }}>
        {submarketId ? `Submarket ID: ${submarketId}` : 'Select a submarket to view detail.'}
      </div>
    </div>
  );
};

export default BloombergMarketDetail;
