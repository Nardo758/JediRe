import React from 'react';

interface PropertyCardProps {
  property: any;
  onClick?: () => void;
  loading?: boolean;
}

export function PropertyCard({ property, onClick, loading }: PropertyCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#1a1a2e',
        border: '1px solid #333',
        borderRadius: 6,
        padding: 16,
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'center',
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      <div style={{ fontSize: 11, color: '#ff9800', fontWeight: 700, marginBottom: 6 }}>
        {property?.name || 'Property'}
      </div>
      <div style={{ fontSize: 9, color: '#888' }}>
        Awaiting new wireframe
      </div>
    </div>
  );
}

export default PropertyCard;
