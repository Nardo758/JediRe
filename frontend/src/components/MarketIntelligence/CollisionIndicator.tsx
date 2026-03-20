import { useState } from 'react';
import type { LayeredValue, DataSource } from '../../stores/dealContext.types';

const T = {
  bg: { terminal:"#0A0E17",panel:"#0F1319",panelAlt:"#131821",header:"#1A1F2E",hover:"#1E2538" },
  text: { primary:"#E8ECF1",secondary:"#8B95A5",muted:"#4A5568",amber:"#F5A623",green:"#00D26A",red:"#FF4757",cyan:"#00BCD4",orange:"#FF8C42",purple:"#A78BFA" },
  border: { subtle:"#1E2538",medium:"#2A3348" },
  font: { mono:"'JetBrains Mono','Fira Code','SF Mono',monospace" },
};

const SOURCE_COLORS: Record<DataSource, string> = {
  broker: T.text.orange,
  platform: T.text.cyan,
  user: T.text.green,
  agent: T.text.purple,
  computed: T.text.muted,
};

const SOURCE_LABELS: Record<DataSource, string> = {
  broker: 'Broker',
  platform: 'Platform',
  user: 'You',
  agent: 'Agent',
  computed: 'Computed',
};

interface CollisionIndicatorProps<T> {
  layeredValue: LayeredValue<T>;
  formatter?: (value: T) => string;
  onResetTo?: (source: DataSource) => void;
}

export function CollisionIndicator<T>({ 
  layeredValue, 
  formatter = (v) => String(v),
  onResetTo,
}: CollisionIndicatorProps<T>) {
  const [showDetail, setShowDetail] = useState(false);
  const { value, source, layers } = layeredValue;

  // Count how many layers exist
  const layerCount = layers ? Object.keys(layers).length : 1;

  // If only one layer, no collision - don't show indicator
  if (layerCount <= 1) {
    return null;
  }

  const sourceColor = SOURCE_COLORS[source];

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {/* Collision indicator badge */}
      <button
        onClick={() => setShowDetail(!showDetail)}
        style={{
          padding: '2px 6px',
          background: `${sourceColor}15`,
          border: `1px solid ${sourceColor}40`,
          borderRadius: 2,
          fontSize: 7,
          fontFamily: T.font.mono,
          fontWeight: 700,
          color: sourceColor,
          cursor: 'pointer',
          letterSpacing: '0.05em',
        }}
        title="Multiple values available - click to view"
      >
        {layerCount} SOURCES
      </button>

      {/* Detail popup */}
      {showDetail && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowDetail(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999,
            }}
          />

          {/* Popup */}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              minWidth: 250,
              background: T.bg.panel,
              border: `1px solid ${T.border.medium}`,
              borderRadius: 3,
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              zIndex: 1000,
              padding: 8,
            }}
          >
            <div style={{
              fontSize: 8,
              fontFamily: T.font.mono,
              color: T.text.muted,
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Value Sources:
            </div>

            {/* Show all layers */}
            {layers && Object.entries(layers).map(([src, layer]: [string, any]) => {
              const layerSource = src as DataSource;
              const isActive = layerSource === source;
              const layerColor = SOURCE_COLORS[layerSource];

              return (
                <div
                  key={src}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px 6px',
                    background: isActive ? `${layerColor}15` : 'transparent',
                    border: `1px solid ${isActive ? layerColor : 'transparent'}`,
                    borderRadius: 2,
                    marginBottom: 3,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 8,
                      fontFamily: T.font.mono,
                      color: layerColor,
                      fontWeight: isActive ? 700 : 500,
                    }}>
                      {SOURCE_LABELS[layerSource]}
                      {isActive && ' ✓'}
                    </div>
                    <div style={{
                      fontSize: 10,
                      fontFamily: T.font.mono,
                      color: T.text.primary,
                      fontWeight: 600,
                    }}>
                      {formatter(layer.value)}
                    </div>
                    <div style={{
                      fontSize: 7,
                      fontFamily: T.font.mono,
                      color: T.text.muted,
                    }}>
                      {Math.round(layer.confidence * 100)}% confident
                    </div>
                  </div>

                  {/* Reset button */}
                  {!isActive && onResetTo && (
                    <button
                      onClick={() => {
                        onResetTo(layerSource);
                        setShowDetail(false);
                      }}
                      style={{
                        padding: '2px 6px',
                        background: T.bg.hover,
                        border: `1px solid ${T.border.medium}`,
                        borderRadius: 2,
                        fontSize: 7,
                        fontFamily: T.font.mono,
                        color: T.text.secondary,
                        cursor: 'pointer',
                      }}
                    >
                      USE
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default CollisionIndicator;
