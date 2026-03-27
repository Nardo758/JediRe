import React from 'react';
import { BT } from '@/components/deal/bloomberg-ui';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

export function ReportsPage() {
  return (
    <div style={{ padding: 24, background: BT.bg.terminal, minHeight: '100vh' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, color: BT.text.amber, letterSpacing: '0.06em', ...mono }}>REPORTS & ANALYTICS</h1>
        <p style={{ fontSize: 12, color: BT.text.secondary, marginTop: 4 }}>Generate insights and track performance</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ padding: 20, background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: BT.text.cyan, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, ...mono }}>QUICK REPORTS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { title: 'Portfolio Summary', desc: 'Overview of all properties' },
              { title: 'Market Analysis', desc: 'Submarket trends and insights' },
              { title: 'Deal Performance', desc: 'ROI and metrics by deal' },
            ].map((item) => (
              <button key={item.title} style={{
                width: '100%',
                textAlign: 'left' as const,
                padding: '12px 16px',
                border: `1px solid ${BT.border.subtle}`,
                background: BT.bg.panelAlt,
                color: BT.text.primary,
                cursor: 'pointer',
              }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: BT.text.secondary, marginTop: 2 }}>{item.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: 20, background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: BT.text.cyan, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, ...mono }}>CUSTOM REPORTS</div>
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 12, color: BT.text.secondary, marginBottom: 16 }}>Build custom reports with your data</div>
            <button style={{
              padding: '8px 20px',
              background: BT.text.cyan,
              color: BT.bg.terminal,
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              ...mono,
            }}>
              Create Custom Report
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: 20, background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: BT.text.cyan, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, ...mono }}>MARKET TRENDS</div>
        <div style={{
          height: 256,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: BT.bg.panelAlt,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: BT.text.muted, ...mono }}>CHART VISUALIZATION</div>
            <div style={{ fontSize: 11, color: BT.text.muted, marginTop: 4 }}>Coming soon</div>
          </div>
        </div>
      </div>
    </div>
  );
}
