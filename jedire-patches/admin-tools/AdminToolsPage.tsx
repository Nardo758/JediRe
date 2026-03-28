/**
 * Admin Tools Page - Bloomberg Terminal Style
 * Central hub for deal administration, team management, and integrations
 * 
 * Location: frontend/src/pages/admin/AdminToolsPage.tsx
 */

import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';

// Section imports (adjust paths after placing in your project)
import DealIntelligenceSection from './sections/DealIntelligenceSection';
import TeamSection from './sections/TeamSection';
import AIConfigSection from './sections/AIConfigSection';
import IntegrationsSection from './sections/IntegrationsSection';
import DataRoomSection from './sections/DataRoomSection';
import VerificationSection from './sections/VerificationSection';
import BillingSection from './sections/BillingSection';
import NotificationsSection from './sections/NotificationsSection';

// Bloomberg Terminal tokens
const BT = {
  bg: { 
    terminal: '#0A0E17', 
    panel: '#0F1319', 
    panelAlt: '#131821',
    header: '#1A1F2E', 
    hover: '#1E2538', 
    active: '#252D40',
    input: '#0D1117',
    sidebar: '#080B10'
  },
  text: { 
    primary: '#E8ECF1', 
    secondary: '#8B95A5', 
    muted: '#4A5568', 
    amber: '#F5A623', 
    amberBright: '#FFD166',
    green: '#00D26A', 
    red: '#FF4757',
    cyan: '#00BCD4',
    orange: '#FF8C42',
    purple: '#A78BFA'
  },
  border: { 
    subtle: '#1E2538', 
    medium: '#2A3348',
    bright: '#3B4A6B'
  },
};

const MONO = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

interface NavItem {
  key: string;
  label: string;
  icon: string;
  path: string;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'intel', label: 'DEAL INTELLIGENCE', icon: '📊', path: 'intel', description: 'Notes, decisions, risks, contacts' },
  { key: 'team', label: 'TEAM & ACCESS', icon: '👥', path: 'team', description: 'Members, roles, permissions' },
  { key: 'ai', label: 'AI CONFIGURATION', icon: '🤖', path: 'ai', description: 'Model preferences, tokens' },
  { key: 'integrations', label: 'INTEGRATIONS', icon: '🔗', path: 'integrations', description: 'DocuSign, Plaid, notarization' },
  { key: 'dataroom', label: 'DATA ROOM', icon: '📁', path: 'dataroom', description: 'Secure document sharing' },
  { key: 'verification', label: 'VERIFICATION', icon: '✅', path: 'verification', description: 'KYC, background checks, AML' },
  { key: 'billing', label: 'BILLING & USAGE', icon: '💳', path: 'billing', description: 'Credits, invoices, limits' },
  { key: 'notifications', label: 'NOTIFICATIONS', icon: '🔔', path: 'notifications', description: 'Alerts, channels, preferences' },
];

export default function AdminToolsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine active section from URL
  const currentPath = location.pathname.split('/admin/')[1] || 'intel';
  const activeSection = NAV_ITEMS.find(item => currentPath.startsWith(item.path))?.key || 'intel';

  const handleNavClick = (item: NavItem) => {
    navigate(`/admin/${item.path}`);
  };

  return (
    <div style={{ 
      display: 'flex', 
      minHeight: '100vh', 
      background: BT.bg.terminal,
      color: BT.text.primary,
      fontFamily: MONO
    }}>
      {/* Sidebar Navigation */}
      <aside style={{
        width: 260,
        background: BT.bg.sidebar,
        borderRight: `1px solid ${BT.border.subtle}`,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 16px',
          borderBottom: `1px solid ${BT.border.subtle}`,
        }}>
          <div style={{
            fontSize: 11,
            color: BT.text.amber,
            letterSpacing: '1px',
            marginBottom: 4,
          }}>
            JEDI RE
          </div>
          <div style={{
            fontSize: 16,
            fontWeight: 600,
            color: BT.text.primary,
          }}>
            Admin Tools
          </div>
        </div>

        {/* Navigation Items */}
        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleNavClick(item)}
                style={{
                  width: '100%',
                  padding: '12px 12px',
                  marginBottom: 4,
                  background: isActive ? BT.bg.active : 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = BT.bg.hover;
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <div>
                    <div style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: isActive ? BT.text.amber : BT.text.primary,
                      letterSpacing: '0.3px',
                    }}>
                      {item.label}
                    </div>
                    <div style={{
                      fontSize: 9,
                      color: BT.text.muted,
                      marginTop: 2,
                    }}>
                      {item.description}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{
          padding: '16px',
          borderTop: `1px solid ${BT.border.subtle}`,
          fontSize: 9,
          color: BT.text.muted,
        }}>
          <div>ADMIN TOOLS v1.0</div>
          <div style={{ marginTop: 4 }}>Press F1 for help</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        <Routes>
          <Route path="/" element={<DealIntelligenceSection />} />
          <Route path="intel/*" element={<DealIntelligenceSection />} />
          <Route path="team" element={<TeamSection />} />
          <Route path="ai" element={<AIConfigSection />} />
          <Route path="integrations" element={<IntegrationsSection />} />
          <Route path="dataroom" element={<DataRoomSection />} />
          <Route path="verification" element={<VerificationSection />} />
          <Route path="billing" element={<BillingSection />} />
          <Route path="notifications" element={<NotificationsSection />} />
        </Routes>
      </main>
    </div>
  );
}
