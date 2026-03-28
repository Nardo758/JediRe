/**
 * Team Section
 * Team members and permissions management
 */

import React, { useState } from 'react';

const BT = {
  bg: { terminal: '#0A0E17', panel: '#0F1319', header: '#1A1F2E', hover: '#1E2538', input: '#0D1117' },
  text: { primary: '#E8ECF1', secondary: '#8B95A5', muted: '#4A5568', amber: '#F5A623', green: '#00D26A', red: '#FF4757', cyan: '#00BCD4' },
  border: { subtle: '#1E2538', medium: '#2A3348' },
};
const MONO = "'JetBrains Mono', monospace";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  avatar?: string;
  lastActive: string;
}

const MOCK_TEAM: TeamMember[] = [
  { id: '1', name: 'Leon Dixon', email: 'leon@jedire.com', role: 'Owner', permissions: ['all'], lastActive: '2 min ago' },
  { id: '2', name: 'Marcus Chen', email: 'marcus@jedire.com', role: 'Admin', permissions: ['deals', 'documents', 'team'], lastActive: '1 hr ago' },
  { id: '3', name: 'Sarah Torres', email: 'sarah@jedire.com', role: 'Analyst', permissions: ['deals', 'documents'], lastActive: '3 hrs ago' },
];

const PERMISSIONS = [
  { key: 'deals', label: 'Deals', desc: 'View and manage deals' },
  { key: 'documents', label: 'Documents', desc: 'Upload and manage documents' },
  { key: 'financial', label: 'Financial', desc: 'View financial data and pro formas' },
  { key: 'team', label: 'Team', desc: 'Manage team members' },
  { key: 'billing', label: 'Billing', desc: 'View and manage billing' },
  { key: 'integrations', label: 'Integrations', desc: 'Configure integrations' },
];

export default function TeamSection() {
  const [team, setTeam] = useState<TeamMember[]>(MOCK_TEAM);
  const [showInvite, setShowInvite] = useState(false);

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{
            fontSize: 18,
            fontWeight: 600,
            color: BT.text.amber,
            fontFamily: MONO,
            marginBottom: 8,
          }}>
            TEAM & ACCESS
          </h1>
          <p style={{
            fontSize: 12,
            color: BT.text.secondary,
            fontFamily: MONO,
          }}>
            Manage team members, roles, and permissions
          </p>
        </div>
        
        <button
          onClick={() => setShowInvite(true)}
          style={{
            padding: '10px 20px',
            background: BT.text.cyan,
            color: BT.bg.terminal,
            border: 'none',
            borderRadius: 4,
            fontFamily: MONO,
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          + INVITE MEMBER
        </button>
      </div>

      {/* Team Members */}
      <div style={{
        background: BT.bg.panel,
        border: `1px solid ${BT.border.subtle}`,
        borderRadius: 6,
        overflow: 'hidden',
      }}>
        {/* Table Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 100px',
          padding: '12px 16px',
          background: BT.bg.header,
          borderBottom: `1px solid ${BT.border.subtle}`,
        }}>
          <span style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, textTransform: 'uppercase' }}>Member</span>
          <span style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, textTransform: 'uppercase' }}>Role</span>
          <span style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, textTransform: 'uppercase' }}>Last Active</span>
          <span style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, textTransform: 'uppercase' }}>Actions</span>
        </div>

        {/* Team Rows */}
        {team.map((member) => (
          <div
            key={member.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 100px',
              padding: '16px',
              borderBottom: `1px solid ${BT.border.subtle}`,
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: BT.text.primary, fontFamily: MONO, fontWeight: 500 }}>
                {member.name}
              </div>
              <div style={{ fontSize: 11, color: BT.text.muted, fontFamily: MONO }}>
                {member.email}
              </div>
            </div>
            <div>
              <span style={{
                padding: '4px 10px',
                background: member.role === 'Owner' ? BT.text.amber + '22' : BT.bg.header,
                color: member.role === 'Owner' ? BT.text.amber : BT.text.secondary,
                fontSize: 10,
                fontFamily: MONO,
                borderRadius: 3,
              }}>
                {member.role}
              </span>
            </div>
            <div style={{ fontSize: 11, color: BT.text.muted, fontFamily: MONO }}>
              {member.lastActive}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{
                background: 'transparent',
                border: 'none',
                color: BT.text.cyan,
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: MONO,
              }}>
                Edit
              </button>
              {member.role !== 'Owner' && (
                <button style={{
                  background: 'transparent',
                  border: 'none',
                  color: BT.text.red,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontFamily: MONO,
                }}>
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Permissions Matrix */}
      <div style={{ marginTop: 32 }}>
        <h3 style={{
          fontSize: 12,
          color: BT.text.amber,
          fontFamily: MONO,
          marginBottom: 16,
          textTransform: 'uppercase',
        }}>
          Permissions Matrix
        </h3>
        
        <div style={{
          background: BT.bg.panel,
          border: `1px solid ${BT.border.subtle}`,
          borderRadius: 6,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '150px repeat(6, 1fr)',
            padding: '12px 16px',
            background: BT.bg.header,
            borderBottom: `1px solid ${BT.border.subtle}`,
          }}>
            <span style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO }}>MEMBER</span>
            {PERMISSIONS.map(p => (
              <span key={p.key} style={{ fontSize: 9, color: BT.text.muted, fontFamily: MONO, textAlign: 'center' }}>
                {p.label.toUpperCase()}
              </span>
            ))}
          </div>

          {/* Rows */}
          {team.map((member) => (
            <div
              key={member.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '150px repeat(6, 1fr)',
                padding: '12px 16px',
                borderBottom: `1px solid ${BT.border.subtle}`,
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 11, color: BT.text.primary, fontFamily: MONO }}>
                {member.name}
              </span>
              {PERMISSIONS.map(p => {
                const hasPermission = member.permissions.includes('all') || member.permissions.includes(p.key);
                return (
                  <div key={p.key} style={{ textAlign: 'center' }}>
                    <span style={{
                      color: hasPermission ? BT.text.green : BT.text.muted,
                      fontSize: 14,
                    }}>
                      {hasPermission ? '✓' : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
