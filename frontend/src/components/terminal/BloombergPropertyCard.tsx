import React from 'react';
import { BT } from './theme';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

interface BloombergPropertyCardProps {
  property: any;
  showComps?: boolean;
  strategyScore?: any;
}

export const BloombergPropertyCard: React.FC<BloombergPropertyCardProps> = ({ property }) => (
  <div style={{
    background: BT.bg.panel,
    border: `1px solid ${BT.border.medium}`,
    borderRadius: 6,
    padding: 16,
    textAlign: 'center',
  }}>
    <div style={{ ...mono, fontSize: 11, color: BT.text.amber, fontWeight: 700, marginBottom: 6 }}>
      {property?.name || 'Property'}
    </div>
    <div style={{ ...mono, fontSize: 9, color: BT.text.muted }}>
      Awaiting new wireframe
    </div>
  </div>
);

export default BloombergPropertyCard;
