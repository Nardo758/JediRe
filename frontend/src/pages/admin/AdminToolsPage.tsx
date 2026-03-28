/**
 * Admin Tools Page - Bloomberg Terminal Style
 * Matches Terminal/Dashboard header design
 */

import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';

// Section imports
import DealIntelligenceSection from './sections/DealIntelligenceSection';
import TeamSection from './sections/TeamSection';
import AIConfigSection from './sections/AIConfigSection';
import IntegrationsSection from './sections/IntegrationsSection';
import DataRoomSection from './sections/DataRoomSection';
import VerificationSection from './sections/VerificationSection';
import BillingSection from './sections/BillingSection';
import NotificationsSection from './sections/NotificationsSection';
import TemplatesSection from './sections/TemplatesSection';
import DataManagementSection from './sections/DataManagementSection';

// ═══════════════════════════════════════════════════════════════════════════
// BLOOMBERG TERMINAL TOKENS (matches TerminalPage.tsx)
// ═══════════════════════════════════════════════════════════════════════════
const BT = {
  bg: { 
    terminal: '#0A0E17', 
    panel: '#0F1319', 
    panelAlt: '#131821',
    header: '#1A1F2E', 
    hover: '#1E2538', 
    active: '#252D40',
    input: '#0D1117',
    sidebar: '#080B10',
    topBar: '#050810'
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
    purple: '#A78BFA',
    white: '#FFFFFF'
  },
  border: { 
    subtle: '#1E2538', 
    medium: '#2A3348',
    bright: '#3B4A6B'
  },
  font: {
    mono: "'JetBrains Mono','Fira Code','SF Mono',monospace",
    display: "'IBM Plex Mono',monospace",
    label: "'IBM Plex Sans',sans-serif"
  }
};

// Terminal-style CSS (matches TerminalPage)
const TERMINAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes glow{0%,100%{box-shadow:0 0 4px #00D26A44}50%{box-shadow:0 0 10px #00D26A66}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
*{scrollbar-width:thin;scrollbar-color:#2A3348 #0A0E17}
*::-webkit-scrollbar{width:5px;height:5px}
*::-webkit-scrollbar-track{background:#0A0E17}
*::-webkit-scrollbar-thumb{background:#2A3348}
`;

interface NavItem {
  key: string;
  label: string;
  icon: string;
  path: string;
  description: string;
  group: 'intel' | 'config' | 'data';
}

const NAV_ITEMS: NavItem[] = [
  // Intel Group
  { key: 'intel', label: 'DEAL INTELLIGENCE', icon: '🔒', path: 'intel', description: 'Notes, decisions, risks, contacts', group: 'intel' },
  { key: 'team', label: 'TEAM & ACCESS', icon: '👥', path: 'team', description: 'Members, roles, permissions', group: 'intel' },
  
  // Config Group
  { key: 'ai', label: 'AI CONFIGURATION', icon: '🤖', path: 'ai', description: 'Model preferences, tokens', group: 'config' },
  { key: 'integrations', label: 'INTEGRATIONS', icon: '🔗', path: 'integrations', description: 'External services', group: 'config' },
  { key: 'notifications', label: 'NOTIFICATIONS', icon: '🔔', path: 'notifications', description: 'Alerts, channels', group: 'config' },
  { key: 'templates', label: 'TEMPLATES', icon: '📋', path: 'templates', description: 'Pro forma, reports, checklists', group: 'config' },
  
  // Data Group
  { key: 'dataroom', label: 'DATA ROOM', icon: '📁', path: 'dataroom', description: 'Secure document sharing', group: 'data' },
  { key: 'verification', label: 'VERIFICATION', icon: '✅', path: 'verification', description: 'KYC, background checks', group: 'data' },
  { key: 'datamanagement', label: 'DATA MANAGEMENT', icon: '📦', path: 'data', description: 'Import, export, retention', group: 'data' },
  { key: 'billing', label: 'BILLING & USAGE', icon: '💳', path: 'billing', description: 'Credits, invoices', group: 'data' },
];

const MOCK_DEALS = [
  { id: 'all', name: 'All Deals' },
  { id: '1', name: 'Atlanta Development' },
  { id: '2', name: 'Tampa MF Acquisition' },
  { id: '3', name: 'Orlando BTR Project' },
];

export default function AdminToolsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedDeal, setSelectedDeal] = useState('all');
  const [time, setTime] = useState(new Date());
  
  // Live clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Determine active section from URL
  const currentPath = location.pathname.split('/admin/')[1] || 'intel';
  const activeSection = NAV_ITEMS.find(item => currentPath.startsWith(item.path))?.key || 'intel';
  const activeSectionLabel = NAV_ITEMS.find(item => item.key === activeSection)?.label || 'ADMIN';

  const handleNavClick = (item: NavItem) => {
    navigate(`/admin/${item.path}`);
  };

  const renderNavGroup = (groupId: string, groupLabel: string) => {
    const items = NAV_ITEMS.filter(item => item.group === groupId);
    return (
      <div key={groupId} style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 9,
          color: BT.text.muted,
          fontFamily: BT.font.mono,
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
              onClick={() => handleNavClick(item)}
              style={{
                width: '100%',
                padding: '10px 12px',
                marginBottom: 2,
                background: isActive ? BT.bg.active : 'transparent',
                border: 'none',
                borderRadius: 4,
                borderLeft: isActive ? `2px solid ${BT.text.amber}` : '2px solid transparent',
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
                <span style={{ fontSize: 14 }}>{item.icon}</span>
                <div>
                  <div style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: isActive ? BT.text.amber : BT.text.primary,
                    fontFamily: BT.font.mono,
                    letterSpacing: '0.3px',
                  }}>
                    {item.label}
                  </div>
                  <div style={{
                    fontSize: 9,
                    color: BT.text.muted,
                    fontFamily: BT.font.mono,
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

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      minHeight: '100vh', 
      background: BT.bg.terminal,
      color: BT.text.primary,
      fontFamily: BT.font.mono
    }}>
      <style>{TERMINAL_CSS}</style>
      
      {/* ═══════════════════════════════════════════════════════════════════
          TOP BAR - Matches Terminal/Dashboard exactly
          ═══════════════════════════════════════════════════════════════════ */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px',
        height: 28,
        background: BT.bg.topBar,
        borderBottom: `1px solid ${BT.border.subtle}`,
        flexShrink: 0
      }}>
        {/* Left side - Branding & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{
            fontFamily: BT.font.display,
            fontSize: 13,
            fontWeight: 800,
            color: BT.text.amber,
            letterSpacing: 2,
            flexShrink: 0
          }}>JediRE</span>
          
          <span style={{ fontSize: 9, color: BT.text.muted, flexShrink: 0 }}>|</span>
          <span style={{ fontSize: 9, color: BT.text.purple, fontWeight: 600, flexShrink: 0 }}>ADMIN TOOLS</span>
          
          <span style={{ fontSize: 9, color: BT.text.muted, flexShrink: 0 }}>|</span>
          <span style={{ fontSize: 9, color: BT.text.secondary, flexShrink: 0 }}>{activeSectionLabel}</span>
          
          <span style={{ fontSize: 9, color: BT.text.muted, flexShrink: 0 }}>|</span>
          <select
            value={selectedDeal}
            onChange={(e) => setSelectedDeal(e.target.value)}
            style={{
              padding: '2px 6px',
              background: BT.bg.input,
              border: `1px solid ${BT.border.subtle}`,
              borderRadius: 2,
              color: BT.text.cyan,
              fontFamily: BT.font.mono,
              fontSize: 9,
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            {MOCK_DEALS.map(deal => (
              <option key={deal.id} value={deal.id}>{deal.name}</option>
            ))}
          </select>
          
          <span style={{ fontSize: 9, color: BT.text.muted, flexShrink: 0 }}>|</span>
          <span style={{ 
            fontSize: 9, 
            color: BT.text.muted, 
            flexShrink: 0, 
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            whiteSpace: 'nowrap' 
          }}>
            {time.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </span>
        </div>

        {/* Right side - Status indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ 
            fontSize: 9, 
            color: BT.text.green, 
            display: 'flex', 
            alignItems: 'center', 
            gap: 3 
          }}>
            <span style={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: BT.text.green,
              animation: 'glow 2s infinite'
            }}/>
            ONLINE
          </span>
          
          <span style={{ fontSize: 9, color: BT.text.secondary }}>
            {time.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          
          <Link 
            to="/terminal/dashboard"
            style={{
              fontFamily: BT.font.mono,
              fontSize: 9,
              fontWeight: 700,
              background: 'transparent',
              border: `1px solid ${BT.text.cyan}44`,
              color: BT.text.cyan,
              padding: '2px 8px',
              cursor: 'pointer',
              letterSpacing: 0.5,
              textDecoration: 'none'
            }}
          >
            ← TERMINAL
          </Link>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          F-KEY NAVIGATION BAR (like Terminal)
          ═══════════════════════════════════════════════════════════════════ */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        height: 32,
        background: BT.bg.panel,
        borderBottom: `1px solid ${BT.border.subtle}`,
        gap: 2,
        flexShrink: 0
      }}>
        {NAV_ITEMS.slice(0, 8).map((item, idx) => {
          const isActive = activeSection === item.key;
          return (
            <button
              key={item.key}
              onClick={() => handleNavClick(item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                background: isActive ? BT.bg.active : 'transparent',
                border: 'none',
                borderBottom: isActive ? `2px solid ${BT.text.amber}` : '2px solid transparent',
                color: isActive ? BT.text.amber : BT.text.secondary,
                fontFamily: BT.font.mono,
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ 
                fontSize: 8, 
                color: isActive ? BT.text.amberBright : BT.text.muted,
                fontWeight: 700 
              }}>
                F{idx + 1}
              </span>
              {item.label.split(' ')[0]}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN CONTENT AREA
          ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar Navigation */}
        <aside style={{
          width: 200,
          background: BT.bg.sidebar,
          borderRight: `1px solid ${BT.border.subtle}`,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}>
          <nav style={{ flex: 1, padding: '12px 8px' }}>
            {renderNavGroup('intel', 'Intelligence')}
            {renderNavGroup('config', 'Configuration')}
            {renderNavGroup('data', 'Data & Billing')}
          </nav>

          <div style={{
            padding: '12px',
            borderTop: `1px solid ${BT.border.subtle}`,
            fontSize: 9,
            color: BT.text.muted,
            fontFamily: BT.font.mono,
          }}>
            <div>ADMIN TOOLS v1.2</div>
            <div style={{ marginTop: 4 }}>Press ? for shortcuts</div>
          </div>
        </aside>

        {/* Main Content */}
        <main style={{ flex: 1, overflow: 'auto', background: BT.bg.terminal }}>
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
            <Route path="templates" element={<TemplatesSection />} />
            <Route path="data" element={<DataManagementSection />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
