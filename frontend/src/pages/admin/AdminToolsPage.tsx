/**
 * Admin Tools Page - Bloomberg Terminal Style
 * Central hub for deal administration, team management, and integrations
 * 
 * Location: frontend/src/pages/admin/AdminToolsPage.tsx
 */

import React, { useState, useEffect } from 'react';
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
import TemplatesSection from './sections/TemplatesSection';
import DataManagementSection from './sections/DataManagementSection';

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
    purple: '#A78BFA'
  },
  border: { 
    subtle: '#1E2538', 
    medium: '#2A3348',
    bright: '#3B4A6B'
  },
};

const MONO = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

const AdminClock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return <>{now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}</>;
};

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

// Mock deals for selector
const MOCK_DEALS = [
  { id: 'all', name: 'All Deals' },
  { id: '1', name: 'Atlanta Development' },
  { id: '2', name: 'Tampa MF Acquisition' },
  { id: '3', name: 'Orlando BTR Project' },
];

// Access Control Matrix
const ACCESS_MATRIX = {
  admin: { dealCapsules: 'Full', adminTools: 'Full', teamMgmt: 'Full', billing: 'Full' },
  analyst: { dealCapsules: 'Full', adminTools: 'Intel Only', teamMgmt: '❌', billing: '❌' },
  viewer: { dealCapsules: 'Read-only', adminTools: '❌', teamMgmt: '❌', billing: '❌' },
  external: { dealCapsules: 'Shared Only', adminTools: '❌', teamMgmt: '❌', billing: '❌' },
};

export default function AdminToolsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedDeal, setSelectedDeal] = useState('all');
  
  // Determine active section from URL
  const currentPath = location.pathname.split('/admin/')[1] || 'intel';
  const activeSection = NAV_ITEMS.find(item => currentPath.startsWith(item.path))?.key || 'intel';

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
          fontFamily: MONO,
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
                    fontFamily: MONO,
                    letterSpacing: '0.3px',
                  }}>
                    {item.label}
                  </div>
                  <div style={{
                    fontSize: 9,
                    color: BT.text.muted,
                    fontFamily: MONO,
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
      fontFamily: MONO
    }}>
      {/* Status Bar */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 8px",height:28,background:BT.bg.topBar,borderBottom:`1px solid ${BT.border.subtle}`,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontFamily:MONO,fontSize:13,fontWeight:800,color:BT.text.amber,letterSpacing:2}}>JediRE</span>
          <span style={{fontSize:9,color:BT.text.muted}}>|</span>
          <span style={{fontSize:9,color:BT.text.purple,fontWeight:600}}>ADMIN</span>
          <span style={{fontSize:9,color:BT.text.muted}}>|</span>
          <span style={{fontSize:9,color:BT.text.secondary}}>{new Date().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:9,color:BT.text.green,display:"flex",alignItems:"center",gap:3}}><span style={{width:4,height:4,borderRadius:"50%",background:BT.text.green,display:"inline-block"}}/>ONLINE</span>
          <span style={{fontSize:9,color:BT.text.secondary}}>KAFKA: 312/s</span>
          <span style={{fontSize:9,color:BT.text.amber,fontWeight:600}}><AdminClock /></span>
          <button onClick={()=>navigate("/terminal/dashboard")} style={{fontFamily:MONO,fontSize:9,fontWeight:700,background:"transparent",border:`1px solid ${BT.text.cyan}44`,color:BT.text.cyan,padding:"2px 8px",cursor:"pointer",letterSpacing:0.5}}>TERMINAL</button>
        </div>
      </div>

      {/* Top Bar */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 20px',
        background: BT.bg.topBar,
        borderBottom: `1px solid ${BT.border.subtle}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            fontSize: 14,
            fontWeight: 700,
            color: BT.text.amber,
            letterSpacing: '1px',
          }}>
            ADMIN TOOLS
          </div>
          
          {/* Deal Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: BT.text.muted }}>Deal:</span>
            <select
              value={selectedDeal}
              onChange={(e) => setSelectedDeal(e.target.value)}
              style={{
                padding: '6px 12px',
                background: BT.bg.input,
                border: `1px solid ${BT.border.medium}`,
                borderRadius: 4,
                color: BT.text.primary,
                fontFamily: MONO,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              {MOCK_DEALS.map(deal => (
                <option key={deal.id} value={deal.id}>{deal.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* User Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            padding: '4px 10px',
            background: BT.text.amber + '22',
            color: BT.text.amber,
            fontSize: 9,
            fontFamily: MONO,
            borderRadius: 3,
            textTransform: 'uppercase',
          }}>
            Admin
          </span>
          <span style={{ fontSize: 11, color: BT.text.secondary }}>
            Leon D.
          </span>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1 }}>
        {/* Sidebar Navigation */}
        <aside style={{
          width: 240,
          background: BT.bg.sidebar,
          borderRight: `1px solid ${BT.border.subtle}`,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}>
          {/* Navigation Groups */}
          <nav style={{ flex: 1, padding: '12px 8px' }}>
            {renderNavGroup('intel', 'Intelligence')}
            {renderNavGroup('config', 'Configuration')}
            {renderNavGroup('data', 'Data & Billing')}
          </nav>

          {/* Access Control Info */}
          <div style={{
            padding: 12,
            borderTop: `1px solid ${BT.border.subtle}`,
            background: BT.bg.panel,
          }}>
            <div style={{ fontSize: 9, color: BT.text.muted, fontFamily: MONO, marginBottom: 8, textTransform: 'uppercase' }}>
              Access Level
            </div>
            <div style={{ fontSize: 10, color: BT.text.primary, fontFamily: MONO }}>
              Full Admin Access
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: '12px',
            borderTop: `1px solid ${BT.border.subtle}`,
            fontSize: 9,
            color: BT.text.muted,
            fontFamily: MONO,
          }}>
            <div>ADMIN TOOLS v1.1</div>
            <div style={{ marginTop: 4 }}>Press ? for shortcuts</div>
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
            <Route path="templates" element={<TemplatesSection />} />
            <Route path="data" element={<DataManagementSection />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
