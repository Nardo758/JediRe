import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BT } from '../components/terminal/theme';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

export const PropertyCardPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: BT.bg.terminal,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.medium}`,
        flexShrink: 0,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            ...mono,
            fontSize: 10,
            fontWeight: 700,
            background: 'transparent',
            color: BT.text.cyan,
            border: `1px solid ${BT.text.cyan}44`,
            padding: '4px 12px',
            cursor: 'pointer',
          }}
        >
          ← BACK
        </button>
        <span style={{ ...mono, fontSize: 9, color: BT.text.muted }}>PROPERTY CARD</span>
        <span style={{ ...mono, fontSize: 9, color: BT.text.muted }}>›</span>
        <span style={{ ...mono, fontSize: 11, color: BT.text.primary, fontWeight: 700 }}>
          {(id || 'property').toUpperCase().replace(/-/g, ' ')}
        </span>
      </div>

      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...mono, fontSize: 18, color: BT.text.amber, fontWeight: 700, marginBottom: 12 }}>
            PROPERTY CARD v3.0
          </div>
          <div style={{ ...mono, fontSize: 12, color: BT.text.primary, marginBottom: 6 }}>
            {(id || 'property').replace(/-/g, ' ')}
          </div>
          <div style={{ ...mono, fontSize: 10, color: BT.text.muted }}>
            Awaiting new wireframe
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 16px',
        background: BT.bg.header,
        borderTop: `1px solid ${BT.border.subtle}`,
        flexShrink: 0,
      }}>
        <span style={{ ...mono, fontSize: 9, color: BT.text.muted }}>
          JEDIRE PROPERTY CARD v3.0
        </span>
        <span style={{ ...mono, fontSize: 9, color: BT.text.green }}>
          PLACEHOLDER
        </span>
      </div>
    </div>
  );
};

export default PropertyCardPage;
