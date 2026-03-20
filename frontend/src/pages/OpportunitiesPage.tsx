import React from 'react';

export const OpportunitiesPage: React.FC = () => {
  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: 40,
    }}>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 14px',
        border: '1px solid #F5A623',
        borderRadius: 4,
        background: '#F5A62318',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 2,
        color: '#F5A623',
      }}>
        F7 · OPPORTUNITIES
      </div>

      <h1 style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 28,
        fontWeight: 700,
        color: '#E8ECF1',
        margin: 0,
        textAlign: 'center',
      }}>
        Opportunity Engine
      </h1>

      <p style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12,
        color: '#8B95A5',
        maxWidth: 480,
        textAlign: 'center',
        lineHeight: 1.7,
        margin: 0,
      }}>
        Detects distress signals, off-market opportunities, and arbitrage windows across
        your tracked submarkets. Surfaces deals before they hit the market.
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        marginTop: 16,
        maxWidth: 560,
        width: '100%',
      }}>
        {[
          { icon: '⚡', label: 'Distress Signals', desc: 'Tax delinquencies, lis pendens, deferred maintenance' },
          { icon: '🎯', label: 'Arbitrage Windows', desc: 'Strategy score mismatches vs market pricing' },
          { icon: '📡', label: 'Off-Market Intel', desc: 'Owner outreach triggers + motivation scoring' },
        ].map(card => (
          <div key={card.label} style={{
            background: '#0F1319',
            border: '1px solid #1E2538',
            borderRadius: 6,
            padding: '16px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}>
            <span style={{ fontSize: 20 }}>{card.icon}</span>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              fontWeight: 700,
              color: '#E8ECF1',
              letterSpacing: 0.4,
            }}>
              {card.label}
            </div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              color: '#4A5568',
              lineHeight: 1.5,
            }}>
              {card.desc}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 9,
        color: '#2A3348',
        letterSpacing: 1,
        marginTop: 8,
      }}>
        COMING SOON — OPPORTUNITY ENGINE IN DEVELOPMENT
      </div>
    </div>
  );
};

export default OpportunitiesPage;
