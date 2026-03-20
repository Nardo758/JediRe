import React, { useState } from 'react';
import { T as BT, mono } from '../../components/deal/bloomberg-tokens';

export const IntelligenceSettings: React.FC = () => {
  const [settings, setSettings] = useState({
    enableAI: true,
    enableLiveMarket: true,
    autoRefreshInterval: 30,
    confidenceThreshold: 0.7,
    preferredDataSource: 'platform',
  });

  const toggle = (key: keyof typeof settings) => {
    setSettings(s => ({ ...s, [key]: !s[key] }));
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: BT.cyanL, letterSpacing: 2, textTransform: 'uppercase', ...mono, marginBottom: 20 }}>
        Intelligence Settings
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
        {[
          { key: 'enableAI' as const, label: 'Enable AI Analysis', description: 'Use AI agents for market intelligence and deal analysis' },
          { key: 'enableLiveMarket' as const, label: 'Live Market Data', description: 'Fetch real-time market data feeds' },
        ].map(item => (
          <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: BT.bgCard, border: `1px solid ${BT.border}`, borderRadius: 4 }}>
            <div>
              <div style={{ fontSize: 13, color: BT.text.white, marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 11, color: BT.td }}>{item.description}</div>
            </div>
            <button
              onClick={() => toggle(item.key)}
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                border: 'none',
                cursor: 'pointer',
                background: settings[item.key] ? BT.cyanL : BT.border,
                position: 'relative',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
            >
              <div style={{
                position: 'absolute',
                top: 3,
                left: settings[item.key] ? 23 : 3,
                width: 18,
                height: 18,
                background: '#fff',
                borderRadius: '50%',
                transition: 'left 0.2s',
              }} />
            </button>
          </div>
        ))}

        <div style={{ padding: '16px', background: BT.bgCard, border: `1px solid ${BT.border}`, borderRadius: 4 }}>
          <div style={{ fontSize: 13, color: BT.text.white, marginBottom: 4 }}>Auto-Refresh Interval</div>
          <div style={{ fontSize: 11, color: BT.td, marginBottom: 10 }}>How often to refresh market data (minutes)</div>
          <input
            type="number"
            value={settings.autoRefreshInterval}
            onChange={e => setSettings(s => ({ ...s, autoRefreshInterval: Number(e.target.value) }))}
            min={5}
            max={120}
            style={{
              background: BT.bg.terminal,
              border: `1px solid ${BT.border}`,
              color: BT.text.white,
              padding: '6px 10px',
              borderRadius: 4,
              fontSize: 13,
              width: 80,
              outline: 'none',
            }}
          />
        </div>

        <div style={{ padding: '16px', background: BT.bgCard, border: `1px solid ${BT.border}`, borderRadius: 4 }}>
          <div style={{ fontSize: 13, color: BT.text.white, marginBottom: 4 }}>Preferred Data Source</div>
          <div style={{ fontSize: 11, color: BT.td, marginBottom: 10 }}>Primary source for market intelligence data</div>
          <select
            value={settings.preferredDataSource}
            onChange={e => setSettings(s => ({ ...s, preferredDataSource: e.target.value }))}
            style={{
              background: BT.bg.terminal,
              border: `1px solid ${BT.border}`,
              color: BT.text.white,
              padding: '6px 10px',
              borderRadius: 4,
              fontSize: 13,
              outline: 'none',
            }}
          >
            <option value="platform">Platform (CoStar / RealPage)</option>
            <option value="broker">Broker Provided</option>
            <option value="user">User Input</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default IntelligenceSettings;
