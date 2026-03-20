import React from 'react';
import { T as BT, mono } from '../components/deal/bloomberg-tokens';
import { useParams } from 'react-router-dom';

const PropertyDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return (
    <div style={{ background: BT.bg.terminal, minHeight: '100%', padding: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: BT.cyanL, letterSpacing: 2, textTransform: 'uppercase', ...mono, marginBottom: 16 }}>Property Details</div>
      <div style={{ background: BT.bgCard, border: `1px solid ${BT.border}`, borderRadius: 4, padding: 24, color: BT.td, fontSize: 12, ...mono }}>
        {id ? `Property ID: ${id}` : 'No property selected.'}
      </div>
    </div>
  );
};

export default PropertyDetailsPage;
