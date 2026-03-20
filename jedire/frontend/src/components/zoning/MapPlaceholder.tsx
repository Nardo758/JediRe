import React from 'react';
import { useZoningModuleStore } from '../../stores/zoningModuleStore';

const LAYER_DEFINITIONS = [
  { id: 'zoningDistricts', label: 'Zoning Districts', color: '#6366f1' },
  { id: 'parcelBoundaries', label: 'Parcel Boundaries', color: '#f59e0b' },
  { id: 'floodZones', label: 'Flood Zones', color: '#3b82f6' },
  { id: 'historicDistricts', label: 'Historic Districts', color: '#a855f7' },
  { id: 'overlayDistricts', label: 'Overlay Districts', color: '#ec4899' },
  { id: 'threeDEnvelope', label: '3D Buildable Envelope', color: '#14b8a6' },
];

const ENTITLEMENT_PIN_LEGEND = [
  { status: 'Pre-Application', color: '#94a3b8' },
  { status: 'Submitted', color: '#3b82f6' },
  { status: 'Under Review', color: '#f59e0b' },
  { status: 'Hearing', color: '#f97316' },
  { status: 'Approved', color: '#22c55e' },
  { status: 'Denied', color: '#ef4444' },
];

export default function MapPlaceholder() {
  const { layerVisibility, toggleLayer } = useZoningModuleStore();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      borderRadius: '12px',
      border: '1px solid rgba(148, 163, 184, 0.15)',
      overflow: 'hidden',
    }}>
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        minHeight: 0,
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.06,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
        }} />

        <div style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.08,
          pointerEvents: 'none',
        }}>
          <svg width="100%" height="100%" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice">
            <path d="M50,200 Q150,100 250,180 T450,150 T600,200" fill="none" stroke="#6366f1" strokeWidth="2" opacity="0.5" />
            <path d="M0,250 Q100,180 200,250 T400,220 T600,260" fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity="0.4" />
            <rect x="120" y="130" width="80" height="60" fill="none" stroke="#6366f1" strokeWidth="1" opacity="0.3" rx="2" />
            <rect x="220" y="150" width="100" height="80" fill="none" stroke="#3b82f6" strokeWidth="1" opacity="0.3" rx="2" />
            <rect x="350" y="120" width="70" height="90" fill="none" stroke="#a855f7" strokeWidth="1" opacity="0.3" rx="2" />
            <circle cx="160" cy="160" r="4" fill="#22c55e" opacity="0.4" />
            <circle cx="270" cy="190" r="4" fill="#f59e0b" opacity="0.4" />
            <circle cx="385" cy="165" r="4" fill="#3b82f6" opacity="0.4" />
          </svg>
        </div>

        <div style={{ textAlign: 'center', zIndex: 1 }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(99, 102, 241, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            border: '1px solid rgba(99, 102, 241, 0.3)',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <h3 style={{
            color: '#e2e8f0',
            fontSize: '18px',
            fontWeight: 600,
            margin: '0 0 8px',
          }}>
            Map Integration Coming Soon
          </h3>
          <p style={{
            color: '#94a3b8',
            fontSize: '13px',
            margin: 0,
            maxWidth: '300px',
            lineHeight: 1.5,
          }}>
            Interactive zoning map with parcel boundaries, district overlays, and 3D buildable envelope visualization
          </p>
        </div>

        <div style={{
          marginTop: '32px',
          padding: '16px 20px',
          background: 'rgba(20, 184, 166, 0.08)',
          border: '1px solid rgba(20, 184, 166, 0.2)',
          borderRadius: '8px',
          textAlign: 'center',
          zIndex: 1,
        }}>
          <div style={{
            color: '#5eead4',
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.05em',
            marginBottom: '4px',
          }}>
            3D Buildable Envelope
          </div>
          <div style={{ color: '#94a3b8', fontSize: '12px' }}>
            Volumetric massing visualization based on zoning constraints
          </div>
        </div>
      </div>

      <div style={{
        borderTop: '1px solid rgba(148, 163, 184, 0.1)',
        padding: '16px',
        background: 'rgba(15, 23, 42, 0.6)',
      }}>
        <div style={{
          color: '#94a3b8',
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.05em',
          marginBottom: '12px',
        }}>
          Map Layers
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
        }}>
          {LAYER_DEFINITIONS.map((layer) => (
            <label
              key={layer.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                padding: '6px 8px',
                borderRadius: '6px',
                background: layerVisibility[layer.id]
                  ? 'rgba(99, 102, 241, 0.08)'
                  : 'transparent',
                transition: 'background 0.15s',
              }}
            >
              <input
                type="checkbox"
                checked={!!layerVisibility[layer.id]}
                onChange={() => toggleLayer(layer.id)}
                style={{ display: 'none' }}
              />
              <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '4px',
                border: `2px solid ${layerVisibility[layer.id] ? layer.color : '#475569'}`,
                background: layerVisibility[layer.id] ? layer.color : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
                flexShrink: 0,
              }}>
                {layerVisibility[layer.id] && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span style={{
                color: layerVisibility[layer.id] ? '#e2e8f0' : '#94a3b8',
                fontSize: '12px',
                transition: 'color 0.15s',
              }}>
                {layer.label}
              </span>
            </label>
          ))}
        </div>

        <div style={{
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(148, 163, 184, 0.1)',
        }}>
          <div style={{
            color: '#94a3b8',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.05em',
            marginBottom: '8px',
          }}>
            Entitlement Status Pins
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap' as const,
            gap: '8px',
          }}>
            {ENTITLEMENT_PIN_LEGEND.map((pin) => (
              <div
                key={pin.status}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: pin.color,
                  boxShadow: `0 0 4px ${pin.color}60`,
                }} />
                <span style={{ color: '#94a3b8', fontSize: '11px' }}>
                  {pin.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
