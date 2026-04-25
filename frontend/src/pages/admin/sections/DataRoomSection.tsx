/**
 * Data Room Section
 * Secure document sharing for deals
 */

import React from 'react';
import { ContextIndicator } from '../../../components/intelligence/ContextIndicator';
import { useAutoContextAnalysis } from '../../../hooks/useContextAwareness';

const BT = {
  bg: { panel: '#0F1319', header: '#1A1F2E' },
  text: { primary: '#E8ECF1', secondary: '#8B95A5', muted: '#4A5568', amber: '#F5A623', cyan: '#00BCD4' },
  border: { subtle: '#1E2538' },
};
const MONO = "'JetBrains Mono', monospace";

export default function DataRoomSection() {
  return (
    <div style={{ padding: 24 }}>
      {ctxAnalysis && <ContextIndicator analysis={ctxAnalysis} loading={ctxLoading} compact />}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: BT.text.amber, fontFamily: MONO, marginBottom: 8 }}>
          DATA ROOM
        </h1>
        <p style={{ fontSize: 12, color: BT.text.secondary, fontFamily: MONO }}>
          Secure document sharing for due diligence and deal execution
        </p>
      </div>

      <div style={{
        background: BT.bg.panel,
        border: `1px solid ${BT.border.subtle}`,
        borderRadius: 6,
        padding: 32,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📁</div>
        <h3 style={{ fontSize: 14, color: BT.text.primary, fontFamily: MONO, marginBottom: 8 }}>
          Virtual Data Room
        </h3>
        <p style={{ fontSize: 12, color: BT.text.secondary, fontFamily: MONO, maxWidth: 400, margin: '0 auto 24px' }}>
          Create secure data rooms for sharing confidential deal documents with investors, lenders, and partners.
        </p>

        <div style={{ padding: 16, background: BT.bg.header, borderRadius: 4, display: 'inline-block' }}>
          <span style={{ fontSize: 10, color: BT.text.amber, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '1px' }}>
            🚧 Coming Soon
          </span>
        </div>

        <div style={{ marginTop: 32, textAlign: 'left', maxWidth: 500, margin: '32px auto 0' }}>
          <h4 style={{ fontSize: 11, color: BT.text.muted, fontFamily: MONO, marginBottom: 12 }}>PLANNED FEATURES:</h4>
          <ul style={{ fontSize: 11, color: BT.text.secondary, fontFamily: MONO, lineHeight: 2, paddingLeft: 20 }}>
            <li>Folder organization with access controls</li>
            <li>Watermarked document viewing</li>
            <li>Download tracking and audit logs</li>
            <li>Expiring access links</li>
            <li>Q&A module for investor questions</li>
            <li>Activity analytics per document</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
