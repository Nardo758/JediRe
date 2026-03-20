import React from 'react';
import { T as BT, mono } from '../deal/bloomberg-tokens';

interface TradeAreaDrawMapProps {
  dealId?: string;
  onDrawComplete?: (shape: any) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
  [key: string]: any;
}

export const TradeAreaDrawMap: React.FC<TradeAreaDrawMapProps> = ({ dealId, onDrawComplete, center }) => (
  <div style={{
    width: '100%',
    height: '100%',
    minHeight: 400,
    background: BT.bgCard,
    border: `1px solid ${BT.border}`,
    borderRadius: 4,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  }}>
    <div style={{ fontSize: 32, opacity: 0.3 }}>🗺</div>
    <div style={{ fontSize: 11, color: BT.td, ...mono, textAlign: 'center' }}>
      Trade Area Map
      {center && <div style={{ marginTop: 4, fontSize: 10 }}>{center.lat.toFixed(4)}, {center.lng.toFixed(4)}</div>}
    </div>
    <button
      onClick={() => onDrawComplete?.({ type: 'radius', radius: 1609 })}
      style={{
        padding: '6px 16px',
        background: BT.cyanBg,
        border: `1px solid ${BT.cyanL}`,
        color: BT.cyanL,
        borderRadius: 4,
        fontSize: 11,
        cursor: 'pointer',
        ...mono,
      }}
    >
      Draw Trade Area
    </button>
  </div>
);

export default TradeAreaDrawMap;
