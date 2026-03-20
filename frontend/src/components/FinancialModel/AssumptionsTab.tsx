import { useState, useEffect } from 'react';

const T = {
  bg: { panel:"#0F1319",header:"#1A1F2E",active:"#252D40" },
  text: { primary:"#E8ECF1",secondary:"#8B95A5",muted:"#4A5568",amber:"#F5A623",green:"#00D26A",red:"#FF4757",cyan:"#00BCD4" },
  border: { subtle:"#1E2538",medium:"#2A3348" },
  font: { mono:"'JetBrains Mono','Fira Code','SF Mono',monospace" },
};

interface AssumptionsTabProps {
  dealId: string;
  output: any;
  modelType?: string;
}

export default function AssumptionsTab({ dealId, output, modelType }: AssumptionsTabProps) {
  const [assumptions, setAssumptions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  useEffect(() => {
    fetchAssumptions();
  }, [dealId]);

  const fetchAssumptions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/financial-models/${dealId}/assumptions`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        setAssumptions(result.data);
      }
    } catch (err) {
      console.error('Error fetching assumptions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (key: string, currentValue: any) => {
    setEditMode(key);
    setEditValue(String(currentValue?.value ?? currentValue ?? ''));
  };

  const handleSave = async (key: string) => {
    try {
      const response = await fetch(`/api/v1/financial-models/${dealId}/assumptions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          [key]: parseFloat(editValue) || editValue,
        }),
      });

      if (response.ok) {
        await fetchAssumptions();
        setEditMode(null);
      }
    } catch (err) {
      console.error('Error saving assumption:', err);
    }
  };

  const handleCancel = () => {
    setEditMode(null);
    setEditValue('');
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'user': return T.text.green;
      case 'platform': return T.text.cyan;
      case 'broker': return T.text.amber;
      default: return T.text.muted;
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'user': return 'USER';
      case 'platform': return 'PLATFORM';
      case 'broker': return 'BROKER';
      default: return 'DEFAULT';
    }
  };

  const renderAssumptionValue = (key: string, value: any, isTracked: boolean = false) => {
    const isEditing = editMode === key;

    if (isEditing) {
      return (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            style={{
              padding: '4px 8px',
              background: T.bg.active,
              border: `1px solid ${T.border.medium}`,
              borderRadius: 2,
              color: T.text.primary,
              fontFamily: T.font.mono,
              fontSize: 9,
              width: 120,
            }}
            autoFocus
          />
          <button
            onClick={() => handleSave(key)}
            style={{
              padding: '4px 8px',
              background: T.text.green,
              border: 'none',
              borderRadius: 2,
              color: '#000',
              fontFamily: T.font.mono,
              fontSize: 8,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ✓ SAVE
          </button>
          <button
            onClick={handleCancel}
            style={{
              padding: '4px 8px',
              background: T.bg.active,
              border: `1px solid ${T.border.medium}`,
              borderRadius: 2,
              color: T.text.muted,
              fontFamily: T.font.mono,
              fontSize: 8,
              cursor: 'pointer',
            }}
          >
            CANCEL
          </button>
        </div>
      );
    }

    if (isTracked && value) {
      const displayValue = value.value ?? value;
      const source = value.source || 'default';
      const hasCollision = value.brokerValue || value.platformValue || value.userValue;

      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: T.text.primary, fontWeight: 600 }}>
              {typeof displayValue === 'number' ? displayValue.toLocaleString() : displayValue}
            </span>
            <span style={{ 
              fontSize: 7, 
              padding: '2px 4px', 
              background: getSourceColor(source) + '20',
              color: getSourceColor(source),
              borderRadius: 2,
              fontWeight: 700,
            }}>
              {getSourceLabel(source)}
            </span>
            {hasCollision && (
              <span style={{ fontSize: 7, color: T.text.amber }}>⚠️ COLLISION</span>
            )}
          </div>
          <button
            onClick={() => handleEdit(key, displayValue)}
            style={{
              padding: '2px 6px',
              background: T.bg.active,
              border: `1px solid ${T.border.medium}`,
              borderRadius: 2,
              color: T.text.secondary,
              fontFamily: T.font.mono,
              fontSize: 7,
              cursor: 'pointer',
            }}
          >
            EDIT
          </button>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: T.text.primary, fontWeight: 600 }}>
          {typeof value === 'number' ? value.toLocaleString() : String(value)}
        </span>
        <button
          onClick={() => handleEdit(key, value)}
          style={{
            padding: '2px 6px',
            background: T.bg.active,
            border: `1px solid ${T.border.medium}`,
            borderRadius: 2,
            color: T.text.secondary,
            fontFamily: T.font.mono,
            fontSize: 7,
            cursor: 'pointer',
          }}
        >
          EDIT
        </button>
      </div>
    );
  };

  const renderSection = (title: string, data: any) => {
    if (!data || Object.keys(data).length === 0) return null;

    return (
      <div style={{
        background: T.bg.panel,
        border: `1px solid ${T.border.subtle}`,
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 16,
      }}>
        <div style={{
          background: T.bg.header,
          padding: '8px 12px',
          borderBottom: `1px solid ${T.border.subtle}`,
          fontSize: 10,
          fontFamily: T.font.mono,
          fontWeight: 700,
          color: T.text.amber,
        }}>
          {title}
        </div>
        <div style={{ padding: 16 }}>
          {Object.entries(data).map(([key, value]: any) => (
            <div 
              key={key}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 9,
                fontFamily: T.font.mono,
                marginBottom: 10,
                paddingBottom: 10,
                borderBottom: `1px solid ${T.border.subtle}`,
              }}
            >
              <span style={{ color: T.text.secondary, maxWidth: '40%' }}>
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </span>
              <div style={{ maxWidth: '60%' }}>
                {renderAssumptionValue(key, value, typeof value === 'object' && value !== null && 'source' in value)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: T.text.muted }}>
        Loading assumptions...
      </div>
    );
  }

  if (!assumptions) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: T.text.muted }}>
        No assumptions data available
      </div>
    );
  }

  return (
    <div>
      {/* Info Banner */}
      <div style={{
        background: T.text.cyan + '20',
        border: `1px solid ${T.text.cyan}`,
        borderRadius: 4,
        padding: 12,
        marginBottom: 20,
        fontSize: 9,
        fontFamily: T.font.mono,
        color: T.text.cyan,
      }}>
        💡 Edit assumptions below. Changes will trigger model recomputation and invalidate cache.
      </div>

      {/* Render sections based on model type */}
      {renderSection('PROPERTY DETAILS', assumptions.property)}
      {renderSection('ACQUISITION', assumptions.acquisition)}
      {renderSection('FINANCING', assumptions.financing)}
      {renderSection('OPERATING ASSUMPTIONS', assumptions.operating)}
      {renderSection('DEVELOPMENT', assumptions.development)}
      {renderSection('REDEVELOPMENT', assumptions.redevelopment)}
      {renderSection('DISPOSITION', assumptions.disposition)}
      {renderSection('WATERFALL', assumptions.waterfall)}

      {/* Source Legend */}
      <div style={{
        background: T.bg.panel,
        border: `1px solid ${T.border.subtle}`,
        borderRadius: 4,
        padding: 16,
      }}>
        <div style={{ fontSize: 9, fontFamily: T.font.mono, color: T.text.secondary, marginBottom: 8 }}>
          DATA SOURCE LEGEND
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 8, fontFamily: T.font.mono }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 12, height: 12, background: T.text.green + '40', border: `1px solid ${T.text.green}` }} />
            <span style={{ color: T.text.secondary }}>USER - Manual overrides (highest priority)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 12, height: 12, background: T.text.cyan + '40', border: `1px solid ${T.text.cyan}` }} />
            <span style={{ color: T.text.secondary }}>PLATFORM - System calculated values</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 12, height: 12, background: T.text.amber + '40', border: `1px solid ${T.text.amber}` }} />
            <span style={{ color: T.text.secondary }}>BROKER - Third-party data</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 12, height: 12, background: T.text.muted + '40', border: `1px solid ${T.text.muted}` }} />
            <span style={{ color: T.text.secondary }}>DEFAULT - System defaults</span>
          </div>
        </div>
      </div>
    </div>
  );
}
