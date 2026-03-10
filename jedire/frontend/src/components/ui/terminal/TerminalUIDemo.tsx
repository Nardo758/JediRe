import React from 'react';
import {
  TerminalTheme as T,
  Badge,
  SectionHeader,
  DataRow,
  MiniBar,
  MiniSparkline,
  ScoreRing,
  PhotoGallery,
} from './index';
import { formatCompact, formatFull, formatPercent } from './utils';

/**
 * Demo component showcasing all Terminal UI components
 * Use this as reference for building property pages
 */
export const TerminalUIDemo: React.FC = () => {
  const samplePhotos = [
    { id: 1, label: "Exterior", color: "#1a2744" },
    { id: 2, label: "Pool Area", color: "#1a3a2a" },
    { id: 3, label: "Fitness", color: "#2a1a3a" },
    { id: 4, label: "Unit", color: "#3a2a1a" },
  ];

  return (
    <div style={{ 
      width: "100%", 
      minHeight: "100vh", 
      background: T.bg.terminal, 
      padding: 20,
      fontFamily: T.font.mono,
      color: T.text.primary,
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <h1 style={{ 
          fontSize: 24, 
          fontWeight: 800, 
          color: T.text.white, 
          marginBottom: 20,
          fontFamily: T.font.display,
        }}>
          Terminal UI Component Library
        </h1>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          {/* Badges */}
          <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 16 }}>
            <h2 style={{ fontSize: 14, marginBottom: 12, color: T.text.amber }}>Badges</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <Badge color={T.text.green}>ACTIVE</Badge>
              <Badge color={T.text.amber}>PENDING</Badge>
              <Badge color={T.text.red}>CRITICAL</Badge>
              <Badge color={T.text.cyan}>INFO</Badge>
              <Badge color={T.text.purple}>MULTIFAMILY</Badge>
              <Badge color={T.text.white} bg="#00000099">TRANSPARENT</Badge>
            </div>
          </div>

          {/* Score Ring */}
          <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 16 }}>
            <h2 style={{ fontSize: 14, marginBottom: 12, color: T.text.amber }}>Score Rings</h2>
            <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
              <ScoreRing score={92} size={60} label="A+" />
              <ScoreRing score={75} size={60} label="B+" />
              <ScoreRing score={58} size={60} label="C" />
              <ScoreRing score={42} size={60} label="D" />
            </div>
          </div>
        </div>

        {/* Data Panel */}
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, marginBottom: 20 }}>
          <SectionHeader 
            title="PROPERTY METRICS" 
            subtitle="Live Data"
            icon="◈" 
            borderColor={T.text.green}
            action={<Badge color={T.text.green}>LIVE</Badge>}
          />
          <DataRow label="Occupancy Rate" value="93.5%" color={T.text.green} />
          <DataRow label="Avg Rent" value={formatCompact(1842)} sub="/mo" />
          <DataRow label="NOI (T12)" value={formatCompact(2_680_000)} color={T.text.green} />
          <DataRow label="Cap Rate" value={formatPercent(6.92)} color={T.text.cyan} />
          <DataRow label="Total Value" value={formatFull(32_200_000)} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          {/* Progress Bars */}
          <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 16 }}>
            <h2 style={{ fontSize: 14, marginBottom: 12, color: T.text.amber }}>Progress Bars</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 9, color: T.text.secondary, width: 60 }}>Walk</span>
                <MiniBar value={75} max={100} color={T.text.green} width={120} />
                <span style={{ fontSize: 9, fontWeight: 600 }}>75</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 9, color: T.text.secondary, width: 60 }}>Transit</span>
                <MiniBar value={52} max={100} color={T.text.amber} width={120} />
                <span style={{ fontSize: 9, fontWeight: 600 }}>52</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 9, color: T.text.secondary, width: 60 }}>Bike</span>
                <MiniBar value={38} max={100} color={T.text.red} width={120} />
                <span style={{ fontSize: 9, fontWeight: 600 }}>38</span>
              </div>
            </div>
          </div>

          {/* Sparklines */}
          <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 16 }}>
            <h2 style={{ fontSize: 14, marginBottom: 12, color: T.text.amber }}>Sparklines</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 9, color: T.text.secondary, width: 80 }}>Rent Trend</span>
                <MiniSparkline data={[1200, 1250, 1280, 1320, 1380, 1420]} color={T.text.green} width={120} height={20} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 9, color: T.text.secondary, width: 80 }}>Occupancy</span>
                <MiniSparkline data={[92, 93, 91, 94, 93, 95]} color={T.text.cyan} width={120} height={20} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 9, color: T.text.secondary, width: 80 }}>Expenses</span>
                <MiniSparkline data={[45, 47, 52, 48, 50, 49]} color={T.text.red} width={120} height={20} />
              </div>
            </div>
          </div>
        </div>

        {/* Photo Gallery */}
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 16 }}>
          <h2 style={{ fontSize: 14, marginBottom: 12, color: T.text.amber }}>Photo Gallery</h2>
          <PhotoGallery photos={samplePhotos} placeholderMode={true} />
          <p style={{ fontSize: 9, color: T.text.muted, marginTop: 8 }}>
            In placeholder mode - pass real URLs to display actual photos
          </p>
        </div>

        {/* Utility Functions */}
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 16, marginTop: 20 }}>
          <h2 style={{ fontSize: 14, marginBottom: 12, color: T.text.amber }}>Utility Functions</h2>
          <div style={{ fontSize: 10, fontFamily: T.font.mono, lineHeight: 1.8 }}>
            <div><code>formatCompact(1500000)</code> → {formatCompact(1500000)}</div>
            <div><code>formatFull(1500000)</code> → {formatFull(1500000)}</div>
            <div><code>formatPercent(5.234)</code> → {formatPercent(5.234)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
