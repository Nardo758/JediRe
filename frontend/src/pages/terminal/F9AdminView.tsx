/**
 * F9AdminView - Admin Tools rendered inside Terminal
 * Matches the Terminal shell pattern (F1-F8, F10)
 */

import React, { useState } from 'react';

// Section imports from admin
import DealIntelligenceSection from '../admin/sections/DealIntelligenceSection';
import TeamSection from '../admin/sections/TeamSection';
import AIConfigSection from '../admin/sections/AIConfigSection';
import IntegrationsSection from '../admin/sections/IntegrationsSection';
import DataRoomSection from '../admin/sections/DataRoomSection';
import VerificationSection from '../admin/sections/VerificationSection';
import BillingSection from '../admin/sections/BillingSection';
import NotificationsSection from '../admin/sections/NotificationsSection';
import TemplatesSection from '../admin/sections/TemplatesSection';
import DataManagementSection from '../admin/sections/DataManagementSection';
import { ContextIndicator } from '../../components/intelligence/ContextIndicator';
import { useContextAnalysis } from '../../hooks/useContextAwareness';

// Bloomberg Terminal tokens (passed from parent or use shared)
interface ThemeType {
  bg: { terminal: string; panel: string; panelAlt: string; header: string; hover: string; active: string; input: string; topBar: string; sidebar?: string };
  text: { primary: string; secondary: string; muted: string; amber: string; amberBright: string; green: string; red: string; cyan: string; orange: string; purple: string; white: string };
  border: { subtle: string; medium: string; bright: string };
  font: { mono: string; display: string; label: string };
}

interface NavItem {
  key: string;
  label: string;
  icon: string;
  description: string;
  group: 'intel' | 'config' | 'data';
}

const NAV_ITEMS: NavItem[] = [
  // Intel Group
  { key: 'intel', label: 'DEAL INTELLIGENCE', icon: '🔒', description: 'Notes, decisions, risks, contacts', group: 'intel' },
  { key: 'team', label: 'TEAM & ACCESS', icon: '👥', description: 'Members, roles, permissions', group: 'intel' },
  
  // Config Group
  { key: 'ai', label: 'AI CONFIGURATION', icon: '🤖', description: 'Model preferences, tokens', group: 'config' },
  { key: 'integrations', label: 'INTEGRATIONS', icon: '🔗', description: 'External services', group: 'config' },
  { key: 'notifications', label: 'NOTIFICATIONS', icon: '🔔', description: 'Alerts, channels', group: 'config' },
  { key: 'templates', label: 'TEMPLATES', icon: '📋', description: 'Pro forma, reports, checklists', group: 'config' },
  
  // Data Group
  { key: 'dataroom', label: 'DATA ROOM', icon: '📁', description: 'Secure document sharing', group: 'data' },
  { key: 'verification', label: 'VERIFICATION', icon: '✅', description: 'KYC, background checks', group: 'data' },
  { key: 'datamanagement', label: 'DATA MANAGEMENT', icon: '📦', description: 'Import, export, retention', group: 'data' },
  { key: 'billing', label: 'BILLING & USAGE', icon: '💳', description: 'Credits, invoices', group: 'data' },
];

interface F9AdminViewProps {
  T: ThemeType;
}

export default function F9AdminView({ T }: F9AdminViewProps) {
  const [activeSection, setActiveSection] = useState('intel');

  // Neural network context for settings
  const { analysis: settingsContext, loading: settingsContextLoading, analyze: analyzeSettings } = useContextAnalysis();
  React.useEffect(() => {
    analyzeSettings({ context: 'market_dashboard' });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Task #425: legacy hook deps frozen during bulk triage; revisit when touching this hook.
  }, []);

  const renderNavGroup = (groupId: string, groupLabel: string) => {
    const items = NAV_ITEMS.filter(item => item.group === groupId);
    return (
      <div key={groupId} style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 9,
          color: T.text.muted,
          fontFamily: T.font.mono,
          padding: '8px 12px',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          {groupLabel}
        </div>
        {items.map((item) => {
          const isActive = activeSection === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              style={{
                width: '100%',
                padding: '10px 12px',
                marginBottom: 2,
                background: isActive ? T.bg.active : 'transparent',
                border: 'none',
                borderRadius: 4,
                borderLeft: isActive ? `2px solid ${T.text.amber}` : '2px solid transparent',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = T.bg.hover;
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14 }}>{item.icon}</span>
                <div>
                  <div style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: isActive ? T.text.amber : T.text.primary,
                    fontFamily: T.font.mono,
                    letterSpacing: '0.3px',
                  }}>
                    {item.label}
                  </div>
                  <div style={{
                    fontSize: 9,
                    color: T.text.muted,
                    fontFamily: T.font.mono,
                    marginTop: 1,
                  }}>
                    {item.description}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'intel': return <DealIntelligenceSection />;
      case 'team': return <TeamSection />;
      case 'ai': return <AIConfigSection />;
      case 'integrations': return <IntegrationsSection />;
      case 'dataroom': return <DataRoomSection />;
      case 'verification': return <VerificationSection />;
      case 'billing': return <BillingSection />;
      case 'notifications': return <NotificationsSection />;
      case 'templates': return <TemplatesSection />;
      case 'datamanagement': return <DataManagementSection />;
      default: return <DealIntelligenceSection />;
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flex: 1, 
      overflow: 'hidden',
      animation: 'fadeIn 0.15s',
    }}>
      {/* Sidebar Navigation */}
      <aside style={{
        width: 200,
        background: T.bg.panel,
        borderRight: `1px solid ${T.border.subtle}`,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        flexShrink: 0,
      }}>
        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {renderNavGroup('intel', 'Intelligence')}
          {renderNavGroup('config', 'Configuration')}
          {renderNavGroup('data', 'Data & Billing')}
        </nav>

        <div style={{
          padding: '12px',
          borderTop: `1px solid ${T.border.subtle}`,
          fontSize: 9,
          color: T.text.muted,
          fontFamily: T.font.mono,
        }}>
          <div>ADMIN TOOLS v1.2</div>
          <div style={{ marginTop: 4 }}>Press ? for shortcuts</div>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ 
        flex: 1, 
        overflow: 'auto', 
        background: T.bg.terminal,
      }}>
        {/* Context for AI, Templates, Data Room, Data Management */}
        {settingsContext && ['ai', 'templates', 'dataroom', 'datamanagement'].includes(activeSection) && (
          <div style={{ padding: '8px 16px', borderBottom: `1px solid ${T.border.subtle}` }}>
            <ContextIndicator analysis={settingsContext} loading={settingsContextLoading} compact />
          </div>
        )}
        {renderContent()}
      </main>
    </div>
  );
}
