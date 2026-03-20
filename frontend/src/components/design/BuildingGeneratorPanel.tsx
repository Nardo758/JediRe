import React, { useState } from 'react';
import { T as BT, mono } from '../deal/bloomberg-tokens';

interface BuildingGeneratorPanelProps {
  dealId?: string;
  onGenerated?: (design: any) => void;
  initialConfig?: any;
}

export const BuildingGeneratorPanel: React.FC<BuildingGeneratorPanelProps> = ({
  dealId,
  onGenerated,
  initialConfig,
}) => {
  const [config, setConfig] = useState({
    totalUnits: initialConfig?.totalUnits || 100,
    stories: initialConfig?.stories || 4,
    buildingType: initialConfig?.buildingType || 'garden',
    efficiency: initialConfig?.efficiency || 0.82,
  });
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/design/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, ...config }),
      });
      if (response.ok) {
        const data = await response.json();
        onGenerated?.(data.design || data);
      }
    } catch (err) {
      console.error('Building generation error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16, background: BT.bgCard, border: `1px solid ${BT.border}`, borderRadius: 4 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: BT.cyanL, letterSpacing: 2, textTransform: 'uppercase', ...mono, marginBottom: 16 }}>
        Building Generator
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Total Units', key: 'totalUnits' as const, type: 'number', min: 1, max: 1000 },
          { label: 'Stories', key: 'stories' as const, type: 'number', min: 1, max: 40 },
        ].map(field => (
          <div key={field.key}>
            <div style={{ fontSize: 9, color: BT.td, letterSpacing: 1, textTransform: 'uppercase', ...mono, marginBottom: 4 }}>{field.label}</div>
            <input
              type={field.type}
              value={config[field.key]}
              onChange={e => setConfig(s => ({ ...s, [field.key]: Number(e.target.value) }))}
              min={field.min}
              max={field.max}
              style={{
                width: '100%',
                background: BT.bg.terminal,
                border: `1px solid ${BT.border}`,
                color: BT.text.white,
                padding: '6px 8px',
                borderRadius: 3,
                fontSize: 12,
                outline: 'none',
                ...mono,
              }}
            />
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 9, color: BT.td, letterSpacing: 1, textTransform: 'uppercase', ...mono, marginBottom: 4 }}>Building Type</div>
        <select
          value={config.buildingType}
          onChange={e => setConfig(s => ({ ...s, buildingType: e.target.value }))}
          style={{
            width: '100%',
            background: BT.bg.terminal,
            border: `1px solid ${BT.border}`,
            color: BT.text.white,
            padding: '6px 8px',
            borderRadius: 3,
            fontSize: 12,
            outline: 'none',
          }}
        >
          <option value="garden">Garden (2-4 Stories)</option>
          <option value="midrise">Mid-Rise (5-12 Stories)</option>
          <option value="highrise">High-Rise (13+ Stories)</option>
          <option value="townhome">Townhome</option>
        </select>
      </div>

      <button
        onClick={generate}
        disabled={loading}
        style={{
          width: '100%',
          padding: '10px',
          background: loading ? BT.border : BT.cyanL,
          color: loading ? BT.td : BT.bg.terminal,
          border: 'none',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          cursor: loading ? 'not-allowed' : 'pointer',
          ...mono,
        }}
      >
        {loading ? 'Generating…' : 'Generate Building'}
      </button>
    </div>
  );
};

export default BuildingGeneratorPanel;
