import React from 'react';
import { BT } from './theme';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

interface PropertyCardProps {
  property: any;
  comps?: any[];
  saleHistory?: any[];
  taxHistory?: any[];
  rentHistory?: any[];
  occupancyHistory?: any[];
  noiHistory?: any[];
  trafficHistory?: any[];
  onCompClick?: (id: string) => void;
  onCreateDeal?: () => void;
  onTrack?: () => void;
}

export const PropertyCard: React.FC<PropertyCardProps> = ({ property }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: 400,
    background: BT.bg.panel,
    border: `1px solid ${BT.border.medium}`,
    borderRadius: 8,
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ ...mono, fontSize: 14, color: BT.text.amber, fontWeight: 700, marginBottom: 8 }}>
        PROPERTY CARD v3.0
      </div>
      <div style={{ ...mono, fontSize: 11, color: BT.text.primary, marginBottom: 4 }}>
        {property?.name || 'Property'}
      </div>
      <div style={{ ...mono, fontSize: 10, color: BT.text.muted }}>
        Awaiting new wireframe
      </div>
    </div>
  </div>
);

export default PropertyCard;
