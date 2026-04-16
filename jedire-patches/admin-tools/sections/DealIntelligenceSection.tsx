/**
 * Deal Intelligence Section
 * Central hub for deal notes, decisions, risks, contacts, activity, and checklists
 */

import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';

// Intel tab components
import NotesTab from './intel/NotesTab';
import DecisionsTab from './intel/DecisionsTab';
import RisksTab from './intel/RisksTab';
import ContactsTab from './intel/ContactsTab';
import ActivityTab from './intel/ActivityTab';
import ChecklistTab from './intel/ChecklistTab';

const BT = {
  bg: { terminal: '#0A0E17', panel: '#0F1319', header: '#1A1F2E', hover: '#1E2538', active: '#252D40' },
  text: { primary: '#E8ECF1', secondary: '#8B95A5', muted: '#4A5568', amber: '#F5A623', green: '#00D26A', red: '#FF4757', cyan: '#00BCD4' },
  border: { subtle: '#1E2538', medium: '#2A3348' },
};

const MONO = "'JetBrains Mono', monospace";

interface Tab {
  key: string;
  label: string;
  path: string;
  count?: number;
}

const TABS: Tab[] = [
  { key: 'notes', label: 'NOTES', path: 'notes' },
  { key: 'decisions', label: 'DECISIONS', path: 'decisions' },
  { key: 'risks', label: 'RISKS', path: 'risks' },
  { key: 'contacts', label: 'CONTACTS', path: 'contacts' },
  { key: 'activity', label: 'ACTIVITY', path: 'activity' },
  { key: 'checklist', label: 'CHECKLIST', path: 'checklist' },
];

export default function DealIntelligenceSection() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const currentPath = location.pathname.split('/intel/')[1] || 'notes';
  const activeTab = TABS.find(t => currentPath.startsWith(t.path))?.key || 'notes';

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
          DEAL INTELLIGENCE
        </h1>
        <p style={{
          fontSize: 12,
          color: BT.text.secondary,
          fontFamily: MONO,
        }}>
          Centralized deal context — notes, decisions, risks, and activity tracking
        </p>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: 4,
        borderBottom: `1px solid ${BT.border.subtle}`,
        marginBottom: 24,
      }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => navigate(`/admin/intel/${tab.path}`)}
              style={{
                padding: '10px 16px',
                background: isActive ? BT.bg.active : 'transparent',
                border: 'none',
                borderBottom: isActive ? `2px solid ${BT.text.amber}` : '2px solid transparent',
                color: isActive ? BT.text.amber : BT.text.secondary,
                fontFamily: MONO,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: '0.5px',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = BT.text.primary;
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = BT.text.secondary;
              }}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span style={{
                  marginLeft: 6,
                  padding: '2px 6px',
                  background: BT.bg.header,
                  borderRadius: 10,
                  fontSize: 9,
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <Routes>
        <Route path="/" element={<NotesTab />} />
        <Route path="notes" element={<NotesTab />} />
        <Route path="decisions" element={<DecisionsTab />} />
        <Route path="risks" element={<RisksTab />} />
        <Route path="contacts" element={<ContactsTab />} />
        <Route path="activity" element={<ActivityTab />} />
        <Route path="checklist" element={<ChecklistTab />} />
      </Routes>
    </div>
  );
}
