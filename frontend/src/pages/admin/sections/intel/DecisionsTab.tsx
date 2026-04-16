/**
 * Decisions Tab - Stub
 * Track deal decisions with rationale and outcomes
 * TODO: Migrate logic from Context Tracker
 */

import React from 'react';

const BT = {
  bg: { panel: '#0F1319', header: '#1A1F2E' },
  text: { primary: '#E8ECF1', secondary: '#8B95A5', muted: '#4A5568', amber: '#F5A623', green: '#00D26A' },
  border: { subtle: '#1E2538' },
};
const MONO = "'JetBrains Mono', monospace";

export default function DecisionsTab() {
  return (
    <div style={{
      background: BT.bg.panel,
      border: `1px solid ${BT.border.subtle}`,
      borderRadius: 6,
      padding: 32,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>⚖️</div>
      <h3 style={{ 
        fontSize: 14, 
        color: BT.text.primary, 
        fontFamily: MONO,
        marginBottom: 8,
      }}>
        Decisions Tracker
      </h3>
      <p style={{ 
        fontSize: 12, 
        color: BT.text.secondary, 
        fontFamily: MONO,
        marginBottom: 24,
        maxWidth: 400,
        margin: '0 auto 24px',
      }}>
        Track key deal decisions with context, rationale, and outcomes.
        Migrate from Context Tracker decision log.
      </p>
      
      <div style={{
        padding: 16,
        background: BT.bg.header,
        borderRadius: 4,
        display: 'inline-block',
      }}>
        <span style={{ 
          fontSize: 10, 
          color: BT.text.amber, 
          fontFamily: MONO,
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          🚧 Coming Soon — Migrate from Context Tracker
        </span>
      </div>

      {/* Placeholder structure */}
      <div style={{ marginTop: 32, textAlign: 'left', maxWidth: 500, margin: '32px auto 0' }}>
        <h4 style={{ fontSize: 11, color: BT.text.muted, fontFamily: MONO, marginBottom: 12 }}>
          PLANNED FEATURES:
        </h4>
        <ul style={{ 
          fontSize: 11, 
          color: BT.text.secondary, 
          fontFamily: MONO,
          lineHeight: 2,
          paddingLeft: 20,
        }}>
          <li>Decision timeline with key milestones</li>
          <li>Go/No-Go tracking with rationale</li>
          <li>Stakeholder approval workflow</li>
          <li>Decision impact analysis</li>
          <li>Historical decision audit trail</li>
        </ul>
      </div>
    </div>
  );
}
