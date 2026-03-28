/**
 * Integrations Section
 * Connect external services (DocuSign, Plaid, Notarize, etc.)
 */

import React, { useState } from 'react';

const BT = {
  bg: { terminal: '#0A0E17', panel: '#0F1319', header: '#1A1F2E', hover: '#1E2538' },
  text: { primary: '#E8ECF1', secondary: '#8B95A5', muted: '#4A5568', amber: '#F5A623', green: '#00D26A', red: '#FF4757', cyan: '#00BCD4' },
  border: { subtle: '#1E2538', medium: '#2A3348' },
};
const MONO = "'JetBrains Mono', monospace";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'connected' | 'disconnected' | 'coming_soon';
  category: string;
}

const INTEGRATIONS: Integration[] = [
  { id: 'docusign', name: 'DocuSign', description: 'E-signatures for contracts and agreements', icon: '✍️', status: 'disconnected', category: 'Documents' },
  { id: 'notarize', name: 'Notarize', description: 'Online notarization services', icon: '📜', status: 'coming_soon', category: 'Documents' },
  { id: 'plaid', name: 'Plaid', description: 'Bank verification and financial data', icon: '🏦', status: 'disconnected', category: 'Financial' },
  { id: 'stripe', name: 'Stripe', description: 'Payment processing', icon: '💳', status: 'disconnected', category: 'Financial' },
  { id: 'gmail', name: 'Gmail', description: 'Email synchronization', icon: '📧', status: 'connected', category: 'Communication' },
  { id: 'slack', name: 'Slack', description: 'Team notifications', icon: '💬', status: 'disconnected', category: 'Communication' },
  { id: 'dropbox', name: 'Dropbox', description: 'Cloud document storage', icon: '📁', status: 'disconnected', category: 'Storage' },
  { id: 'google_drive', name: 'Google Drive', description: 'Cloud document storage', icon: '📂', status: 'connected', category: 'Storage' },
];

export default function IntegrationsSection() {
  const categories = [...new Set(INTEGRATIONS.map(i => i.category))];

  const getStatusBadge = (status: Integration['status']) => {
    const styles = {
      connected: { bg: BT.text.green + '22', color: BT.text.green, text: 'Connected' },
      disconnected: { bg: BT.bg.header, color: BT.text.muted, text: 'Not Connected' },
      coming_soon: { bg: BT.text.amber + '22', color: BT.text.amber, text: 'Coming Soon' },
    };
    const s = styles[status];
    return (
      <span style={{
        padding: '4px 10px',
        background: s.bg,
        color: s.color,
        fontSize: 9,
        fontFamily: MONO,
        borderRadius: 3,
        textTransform: 'uppercase',
      }}>
        {s.text}
      </span>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontSize: 18,
          fontWeight: 600,
          color: BT.text.amber,
          fontFamily: MONO,
          marginBottom: 8,
        }}>
          INTEGRATIONS
        </h1>
        <p style={{
          fontSize: 12,
          color: BT.text.secondary,
          fontFamily: MONO,
        }}>
          Connect external services to enhance JediRe functionality
        </p>
      </div>

      {/* Categories */}
      {categories.map(category => (
        <div key={category} style={{ marginBottom: 32 }}>
          <h3 style={{
            fontSize: 11,
            color: BT.text.muted,
            fontFamily: MONO,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: 16,
          }}>
            {category}
          </h3>

          <div style={{ display: 'grid', gap: 12 }}>
            {INTEGRATIONS.filter(i => i.category === category).map(integration => (
              <div
                key={integration.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 16,
                  background: BT.bg.panel,
                  border: `1px solid ${BT.border.subtle}`,
                  borderRadius: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: 28 }}>{integration.icon}</span>
                  <div>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: BT.text.primary,
                      fontFamily: MONO,
                      marginBottom: 4,
                    }}>
                      {integration.name}
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: BT.text.muted,
                      fontFamily: MONO,
                    }}>
                      {integration.description}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {getStatusBadge(integration.status)}
                  
                  {integration.status !== 'coming_soon' && (
                    <button
                      style={{
                        padding: '8px 16px',
                        background: integration.status === 'connected' ? 'transparent' : BT.text.cyan,
                        color: integration.status === 'connected' ? BT.text.secondary : BT.bg.terminal,
                        border: integration.status === 'connected' ? `1px solid ${BT.border.medium}` : 'none',
                        borderRadius: 4,
                        fontFamily: MONO,
                        fontSize: 10,
                        fontWeight: 600,
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                      }}
                    >
                      {integration.status === 'connected' ? 'Manage' : 'Connect'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
