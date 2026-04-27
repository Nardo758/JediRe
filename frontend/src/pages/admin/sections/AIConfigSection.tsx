/**
 * AI Configuration Section
 * Wrapper for AI Model Settings
 * This integrates the AIModelSettings component from jedire-patches
 */

import React from 'react';
import { ContextIndicator } from '../../../components/intelligence/ContextIndicator';
import { useAutoContextAnalysis } from '../../../hooks/useContextAwareness';

const BT = {
  bg: { terminal: '#0A0E17', panel: '#0F1319', header: '#1A1F2E' },
  text: { primary: '#E8ECF1', secondary: '#8B95A5', muted: '#4A5568', amber: '#F5A623', cyan: '#00BCD4' },
  border: { subtle: '#1E2538' },
};
const MONO = "'JetBrains Mono', monospace";

// Import AIModelSettings if it's been applied
// import AIModelSettings from '../../settings/AIModelSettings';

export default function AIConfigSection() {
  // Neural network context awareness
  const { analysis: ctxAnalysis, loading: ctxLoading } = useAutoContextAnalysis({ context: 'deal_overview' });

  return (
    <div style={{ padding: 24 }}>
      {ctxAnalysis && <ContextIndicator analysis={ctxAnalysis} loading={ctxLoading} compact />}
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontSize: 18,
          fontWeight: 600,
          color: BT.text.amber,
          fontFamily: MONO,
          marginBottom: 8,
        }}>
          AI CONFIGURATION
        </h1>
        <p style={{
          fontSize: 12,
          color: BT.text.secondary,
          fontFamily: MONO,
        }}>
          Configure AI model preferences and usage settings
        </p>
      </div>

      {/* Placeholder - replace with actual AIModelSettings component */}
      <div style={{
        background: BT.bg.panel,
        border: `1px solid ${BT.border.subtle}`,
        borderRadius: 6,
        padding: 32,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🤖</div>
        <h3 style={{
          fontSize: 14,
          color: BT.text.primary,
          fontFamily: MONO,
          marginBottom: 8,
        }}>
          AI Model Settings
        </h3>
        <p style={{
          fontSize: 12,
          color: BT.text.secondary,
          fontFamily: MONO,
          marginBottom: 24,
          maxWidth: 400,
          margin: '0 auto 24px',
        }}>
          Apply the AIModelSettings.tsx patch from jedire-patches,
          then import and render it here.
        </p>

        <div style={{
          padding: 16,
          background: BT.bg.header,
          borderRadius: 4,
          display: 'inline-block',
          marginBottom: 24,
        }}>
          <code style={{
            fontSize: 11,
            color: BT.text.cyan,
            fontFamily: MONO,
          }}>
            {`import AIModelSettings from '../../settings/AIModelSettings';`}
          </code>
        </div>

        {/* Quick Settings Preview */}
        <div style={{ textAlign: 'left', maxWidth: 500, margin: '0 auto' }}>
          <h4 style={{ fontSize: 11, color: BT.text.muted, fontFamily: MONO, marginBottom: 16 }}>
            SETTINGS AVAILABLE:
          </h4>
          
          <div style={{ display: 'grid', gap: 12 }}>
            {[
              { label: 'Default Model', value: 'Claude Sonnet 4' },
              { label: 'Risk Analysis Model', value: 'Claude Opus 4' },
              { label: 'Strategy Model', value: 'Claude Sonnet 4' },
              { label: 'Streaming', value: 'Enabled' },
            ].map((setting) => (
              <div
                key={setting.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: BT.bg.header,
                  borderRadius: 4,
                }}
              >
                <span style={{ fontSize: 11, color: BT.text.secondary, fontFamily: MONO }}>
                  {setting.label}
                </span>
                <span style={{ fontSize: 11, color: BT.text.primary, fontFamily: MONO }}>
                  {setting.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
