/**
 * Billing Section
 * Credits, usage, and billing management
 */

import React from 'react';

const BT = {
  bg: { panel: '#0F1319', header: '#1A1F2E' },
  text: { primary: '#E8ECF1', secondary: '#8B95A5', muted: '#4A5568', amber: '#F5A623', green: '#00D26A', cyan: '#00BCD4' },
  border: { subtle: '#1E2538' },
};
const MONO = "'JetBrains Mono', monospace";

export default function BillingSection() {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: BT.text.amber, fontFamily: MONO, marginBottom: 8 }}>
          BILLING & USAGE
        </h1>
        <p style={{ fontSize: 12, color: BT.text.secondary, fontFamily: MONO }}>
          Monitor usage, manage credits, and view billing history
        </p>
      </div>

      {/* Usage Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'AI Credits', value: '8,420', max: '10,000', percent: 84 },
          { label: 'API Calls', value: '12.4K', max: '50K', percent: 25 },
          { label: 'Storage', value: '2.1 GB', max: '10 GB', percent: 21 },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: BT.bg.panel,
              border: `1px solid ${BT.border.subtle}`,
              borderRadius: 6,
              padding: 20,
            }}
          >
            <div style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, marginBottom: 8, textTransform: 'uppercase' }}>
              {stat.label}
            </div>
            <div style={{ fontSize: 24, color: BT.text.primary, fontFamily: MONO, fontWeight: 600, marginBottom: 4 }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, marginBottom: 12 }}>
              of {stat.max}
            </div>
            <div style={{ height: 4, background: BT.bg.header, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                width: `${stat.percent}%`,
                height: '100%',
                background: stat.percent > 80 ? BT.text.amber : BT.text.cyan,
                borderRadius: 2,
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Current Plan */}
      <div style={{
        background: BT.bg.panel,
        border: `1px solid ${BT.border.subtle}`,
        borderRadius: 6,
        padding: 24,
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, marginBottom: 4, textTransform: 'uppercase' }}>
              Current Plan
            </div>
            <div style={{ fontSize: 18, color: BT.text.amber, fontFamily: MONO, fontWeight: 600 }}>
              Professional
            </div>
            <div style={{ fontSize: 11, color: BT.text.secondary, fontFamily: MONO, marginTop: 4 }}>
              $299/month • Renews April 15, 2024
            </div>
          </div>
          <button style={{
            padding: '10px 20px',
            background: BT.text.cyan,
            color: BT.bg.panel,
            border: 'none',
            borderRadius: 4,
            fontFamily: MONO,
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}>
            Upgrade Plan
          </button>
        </div>
      </div>

      {/* Coming Soon Features */}
      <div style={{
        background: BT.bg.panel,
        border: `1px solid ${BT.border.subtle}`,
        borderRadius: 6,
        padding: 32,
        textAlign: 'center',
      }}>
        <div style={{ padding: 16, background: BT.bg.header, borderRadius: 4, display: 'inline-block' }}>
          <span style={{ fontSize: 10, color: BT.text.amber, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '1px' }}>
            🚧 Full Billing Dashboard Coming Soon
          </span>
        </div>

        <div style={{ marginTop: 24, textAlign: 'left', maxWidth: 500, margin: '24px auto 0' }}>
          <h4 style={{ fontSize: 11, color: BT.text.muted, fontFamily: MONO, marginBottom: 12 }}>PLANNED FEATURES:</h4>
          <ul style={{ fontSize: 11, color: BT.text.secondary, fontFamily: MONO, lineHeight: 2, paddingLeft: 20 }}>
            <li>Detailed usage analytics by feature</li>
            <li>Invoice history and downloads</li>
            <li>Payment method management</li>
            <li>Credit purchase and top-ups</li>
            <li>Usage alerts and limits</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
