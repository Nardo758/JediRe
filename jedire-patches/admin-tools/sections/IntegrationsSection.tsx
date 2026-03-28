/**
 * Integrations Section - Full External Services Landscape
 * Based on real estate admin requirements
 */

import React, { useState } from 'react';

const BT = {
  bg: { terminal: '#0A0E17', panel: '#0F1319', header: '#1A1F2E', hover: '#1E2538' },
  text: { primary: '#E8ECF1', secondary: '#8B95A5', muted: '#4A5568', amber: '#F5A623', green: '#00D26A', red: '#FF4757', cyan: '#00BCD4', purple: '#A78BFA', orange: '#FF8C42' },
  border: { subtle: '#1E2538', medium: '#2A3348' },
};
const MONO = "'JetBrains Mono', monospace";

interface Integration {
  id: string;
  name: string;
  description: string;
  status: 'connected' | 'available' | 'coming_soon';
  phase: 1 | 2 | 3;
}

interface IntegrationCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  integrations: Integration[];
}

const INTEGRATION_CATEGORIES: IntegrationCategory[] = [
  {
    id: 'documents',
    name: 'Document & Signing',
    icon: '📝',
    color: BT.text.cyan,
    integrations: [
      { id: 'docusign', name: 'DocuSign', description: 'E-signatures for contracts and agreements', status: 'available', phase: 1 },
      { id: 'pandadoc', name: 'PandaDoc', description: 'Document automation & e-signatures', status: 'available', phase: 1 },
      { id: 'notarize', name: 'Notarize', description: 'Remote online notarization (RON)', status: 'available', phase: 1 },
      { id: 'proof', name: 'Proof', description: 'Identity verification for signers', status: 'coming_soon', phase: 2 },
      { id: 'dotloop', name: 'Dotloop', description: 'Transaction management platform', status: 'coming_soon', phase: 2 },
    ],
  },
  {
    id: 'title_escrow',
    name: 'Title & Escrow',
    icon: '🏛️',
    color: BT.text.purple,
    integrations: [
      { id: 'qualia', name: 'Qualia', description: 'Digital closing platform', status: 'coming_soon', phase: 2 },
      { id: 'snapclose', name: 'Snapclose', description: 'Title & escrow automation', status: 'coming_soon', phase: 2 },
      { id: 'certifid', name: 'CertifID', description: 'Wire fraud protection', status: 'coming_soon', phase: 2 },
      { id: 'title_portal', name: 'Title Company Portal', description: 'Title search & insurance tracking', status: 'coming_soon', phase: 2 },
    ],
  },
  {
    id: 'due_diligence',
    name: 'Due Diligence Services',
    icon: '🔍',
    color: BT.text.orange,
    integrations: [
      { id: 'phase1_esa', name: 'Phase I ESA Ordering', description: 'Environmental assessments (Partner, EDR)', status: 'coming_soon', phase: 2 },
      { id: 'pca', name: 'PCA Vendors', description: 'Property condition assessments', status: 'coming_soon', phase: 2 },
      { id: 'survey', name: 'Survey Ordering', description: 'ALTA survey management', status: 'coming_soon', phase: 2 },
      { id: 'appraisal', name: 'Appraisal Management', description: 'Order & track appraisals', status: 'coming_soon', phase: 2 },
      { id: 'zoning', name: 'Zoning Reports', description: 'Third-party zoning letters', status: 'coming_soon', phase: 2 },
    ],
  },
  {
    id: 'legal',
    name: 'Legal & Compliance',
    icon: '⚖️',
    color: BT.text.amber,
    integrations: [
      { id: 'entity_formation', name: 'Entity Formation', description: 'LLC setup (Stripe Atlas, ZenBusiness)', status: 'coming_soon', phase: 3 },
      { id: '1031_exchange', name: '1031 Exchange', description: 'Qualified intermediary integration', status: 'coming_soon', phase: 3 },
      { id: 'firpta', name: 'FIRPTA Calculator', description: 'Foreign investor compliance', status: 'coming_soon', phase: 3 },
      { id: 'sec_filing', name: 'SEC Filing', description: 'Reg D syndication documents', status: 'coming_soon', phase: 3 },
      { id: 'legal_research', name: 'Lexis/Westlaw', description: 'Legal research integration', status: 'coming_soon', phase: 3 },
    ],
  },
  {
    id: 'finance',
    name: 'Finance & Lending',
    icon: '💰',
    color: BT.text.green,
    integrations: [
      { id: 'plaid', name: 'Plaid', description: 'Bank account verification', status: 'available', phase: 1 },
      { id: 'mercury', name: 'Mercury', description: 'Business banking integration', status: 'available', phase: 1 },
      { id: 'relay', name: 'Relay', description: 'Banking & expense management', status: 'coming_soon', phase: 2 },
      { id: 'lender_portal', name: 'Lender Portals', description: 'Loan status & document tracking', status: 'coming_soon', phase: 2 },
      { id: 'draw_tracking', name: 'Draw Tracking', description: 'Construction loan draws', status: 'coming_soon', phase: 2 },
      { id: 'coi', name: 'Insurance COI', description: 'Certificate of insurance management', status: 'coming_soon', phase: 2 },
    ],
  },
  {
    id: 'operations',
    name: 'Property Operations',
    icon: '🏠',
    color: BT.text.cyan,
    integrations: [
      { id: 'appfolio', name: 'AppFolio', description: 'Property management software', status: 'coming_soon', phase: 3 },
      { id: 'buildium', name: 'Buildium', description: 'Property management platform', status: 'coming_soon', phase: 3 },
      { id: 'rent_manager', name: 'Rent Manager', description: 'Rent collection & accounting', status: 'coming_soon', phase: 3 },
      { id: 'latchel', name: 'Latchel', description: 'Maintenance coordination', status: 'coming_soon', phase: 3 },
      { id: 'tenant_screening', name: 'TransUnion/Experian', description: 'Tenant screening & credit', status: 'coming_soon', phase: 3 },
    ],
  },
  {
    id: 'investor',
    name: 'Investor & Communication',
    icon: '👥',
    color: BT.text.purple,
    integrations: [
      { id: 'gmail', name: 'Gmail (GWS)', description: 'Email synchronization', status: 'connected', phase: 1 },
      { id: 'calendar', name: 'Google Calendar', description: 'Calendar sync & scheduling', status: 'connected', phase: 1 },
      { id: 'investor_portal', name: 'Investor Portal', description: 'LP reporting, K-1 distribution', status: 'coming_soon', phase: 3 },
      { id: 'data_room', name: 'Data Room', description: 'Secure doc sharing (Box, Ansarada)', status: 'available', phase: 1 },
      { id: 'slack', name: 'Slack', description: 'Team notifications', status: 'available', phase: 1 },
    ],
  },
  {
    id: 'verification',
    name: 'Verification & Compliance',
    icon: '✅',
    color: BT.text.green,
    integrations: [
      { id: 'persona', name: 'Persona', description: 'KYC/identity verification', status: 'coming_soon', phase: 2 },
      { id: 'onfido', name: 'Onfido', description: 'Identity verification & fraud detection', status: 'coming_soon', phase: 2 },
      { id: 'checkr', name: 'Checkr', description: 'Background checks', status: 'coming_soon', phase: 2 },
      { id: 'comply', name: 'ComplyAdvantage', description: 'AML screening', status: 'coming_soon', phase: 2 },
    ],
  },
];

export default function IntegrationsSection() {
  const [selectedPhase, setSelectedPhase] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const getStatusBadge = (status: Integration['status']) => {
    const styles = {
      connected: { bg: BT.text.green + '22', color: BT.text.green, text: '● Connected' },
      available: { bg: BT.bg.header, color: BT.text.secondary, text: 'Available' },
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
        letterSpacing: '0.5px',
      }}>
        {s.text}
      </span>
    );
  };

  const getPhaseBadge = (phase: number) => {
    const colors = {
      1: BT.text.green,
      2: BT.text.cyan,
      3: BT.text.purple,
    };
    return (
      <span style={{
        padding: '2px 6px',
        background: colors[phase as keyof typeof colors] + '22',
        color: colors[phase as keyof typeof colors],
        fontSize: 8,
        fontFamily: MONO,
        borderRadius: 2,
      }}>
        P{phase}
      </span>
    );
  };

  const filteredCategories = INTEGRATION_CATEGORIES.map(cat => ({
    ...cat,
    integrations: cat.integrations.filter(int => {
      const matchesSearch = !searchQuery || 
        int.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        int.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPhase = !selectedPhase || int.phase === selectedPhase;
      return matchesSearch && matchesPhase;
    }),
  })).filter(cat => cat.integrations.length > 0);

  const totalIntegrations = INTEGRATION_CATEGORIES.reduce((sum, cat) => sum + cat.integrations.length, 0);
  const connectedCount = INTEGRATION_CATEGORIES.reduce((sum, cat) => 
    sum + cat.integrations.filter(i => i.status === 'connected').length, 0);

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
          {connectedCount} connected • {totalIntegrations} total services available
        </p>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: 12,
        marginBottom: 24,
        flexWrap: 'wrap',
      }}>
        <input
          type="text"
          placeholder="Search integrations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            minWidth: 200,
            padding: '10px 14px',
            background: BT.bg.panel,
            border: `1px solid ${BT.border.medium}`,
            borderRadius: 4,
            color: BT.text.primary,
            fontFamily: MONO,
            fontSize: 12,
          }}
        />
        
        <div style={{ display: 'flex', gap: 8 }}>
          {[null, 1, 2, 3].map(phase => (
            <button
              key={phase ?? 'all'}
              onClick={() => setSelectedPhase(phase)}
              style={{
                padding: '8px 16px',
                background: selectedPhase === phase ? BT.text.cyan : BT.bg.panel,
                color: selectedPhase === phase ? BT.bg.terminal : BT.text.secondary,
                border: `1px solid ${selectedPhase === phase ? BT.text.cyan : BT.border.medium}`,
                borderRadius: 4,
                fontFamily: MONO,
                fontSize: 10,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {phase ? `Phase ${phase}` : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Phase Legend */}
      <div style={{
        display: 'flex',
        gap: 24,
        marginBottom: 24,
        padding: 16,
        background: BT.bg.panel,
        border: `1px solid ${BT.border.subtle}`,
        borderRadius: 6,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {getPhaseBadge(1)}
            <span style={{ fontSize: 11, color: BT.text.primary, fontFamily: MONO, fontWeight: 600 }}>Phase 1 (Core)</span>
          </div>
          <span style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO }}>DocuSign, Notarize, Plaid, Data Room</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {getPhaseBadge(2)}
            <span style={{ fontSize: 11, color: BT.text.primary, fontFamily: MONO, fontWeight: 600 }}>Phase 2 (DD Workflow)</span>
          </div>
          <span style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO }}>ESA, Survey, Title, COI Management</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {getPhaseBadge(3)}
            <span style={{ fontSize: 11, color: BT.text.primary, fontFamily: MONO, fontWeight: 600 }}>Phase 3 (Operations)</span>
          </div>
          <span style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO }}>Property Mgmt, Investor Portal, 1031</span>
        </div>
      </div>

      {/* Categories */}
      {filteredCategories.map(category => (
        <div key={category.id} style={{ marginBottom: 32 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 20 }}>{category.icon}</span>
            <h3 style={{
              fontSize: 13,
              color: category.color,
              fontFamily: MONO,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              {category.name}
            </h3>
            <span style={{
              fontSize: 10,
              color: BT.text.muted,
              fontFamily: MONO,
            }}>
              {category.integrations.filter(i => i.status === 'connected').length}/{category.integrations.length} connected
            </span>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {category.integrations.map(integration => (
              <div
                key={integration.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  background: BT.bg.panel,
                  border: `1px solid ${integration.status === 'connected' ? BT.text.green + '44' : BT.border.subtle}`,
                  borderRadius: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {getPhaseBadge(integration.phase)}
                  <div>
                    <div style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: BT.text.primary,
                      fontFamily: MONO,
                      marginBottom: 2,
                    }}>
                      {integration.name}
                    </div>
                    <div style={{
                      fontSize: 10,
                      color: BT.text.muted,
                      fontFamily: MONO,
                    }}>
                      {integration.description}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {getStatusBadge(integration.status)}
                  
                  {integration.status !== 'coming_soon' && (
                    <button
                      style={{
                        padding: '6px 14px',
                        background: integration.status === 'connected' ? 'transparent' : BT.text.cyan,
                        color: integration.status === 'connected' ? BT.text.secondary : BT.bg.terminal,
                        border: integration.status === 'connected' ? `1px solid ${BT.border.medium}` : 'none',
                        borderRadius: 4,
                        fontFamily: MONO,
                        fontSize: 9,
                        fontWeight: 600,
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                      }}
                    >
                      {integration.status === 'connected' ? 'Configure' : 'Connect'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {filteredCategories.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: 40,
          color: BT.text.muted,
          fontFamily: MONO,
        }}>
          No integrations match your filters
        </div>
      )}
    </div>
  );
}
