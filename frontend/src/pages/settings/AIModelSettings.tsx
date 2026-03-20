import React, { useState } from 'react';
import { T as BT, mono } from '../../components/deal/bloomberg-tokens';

export const AIModelSettings: React.FC = () => {
  const [model, setModel] = useState('gpt-4o');
  const [temperature, setTemperature] = useState(0.3);
  const [enabled, setEnabled] = useState(true);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: BT.violL, letterSpacing: 2, textTransform: 'uppercase', ...mono, marginBottom: 20 }}>
        AI Model Settings
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
        <div style={{ padding: '16px', background: BT.bgCard, border: `1px solid ${BT.border}`, borderRadius: 4 }}>
          <div style={{ fontSize: 13, color: BT.text.white, marginBottom: 4 }}>AI Model</div>
          <div style={{ fontSize: 11, color: BT.td, marginBottom: 10 }}>Select the default AI model for analysis tasks</div>
          <select
            value={model}
            onChange={e => setModel(e.target.value)}
            style={{ background: BT.bg.terminal, border: `1px solid ${BT.border}`, color: BT.text.white, padding: '6px 10px', borderRadius: 4, fontSize: 13, outline: 'none' }}
          >
            <option value="gpt-4o">GPT-4o (Recommended)</option>
            <option value="gpt-4-turbo">GPT-4 Turbo</option>
            <option value="claude-3-opus">Claude 3 Opus</option>
            <option value="claude-3-sonnet">Claude 3 Sonnet</option>
          </select>
        </div>

        <div style={{ padding: '16px', background: BT.bgCard, border: `1px solid ${BT.border}`, borderRadius: 4 }}>
          <div style={{ fontSize: 13, color: BT.text.white, marginBottom: 4 }}>Temperature: {temperature}</div>
          <div style={{ fontSize: 11, color: BT.td, marginBottom: 10 }}>Lower = more deterministic, Higher = more creative</div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={temperature}
            onChange={e => setTemperature(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: BT.bgCard, border: `1px solid ${BT.border}`, borderRadius: 4 }}>
          <div>
            <div style={{ fontSize: 13, color: BT.text.white }}>Enable AI Features</div>
            <div style={{ fontSize: 11, color: BT.td }}>Toggle all AI-powered analysis features</div>
          </div>
          <button
            onClick={() => setEnabled(e => !e)}
            style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: enabled ? BT.violL : BT.border, position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
          >
            <div style={{ position: 'absolute', top: 3, left: enabled ? 23 : 3, width: 18, height: 18, background: '#fff', borderRadius: '50%', transition: 'left 0.2s' }} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIModelSettings;
