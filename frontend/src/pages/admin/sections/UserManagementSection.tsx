import React, { useState } from 'react';
import { T as BT, mono } from '../../../components/deal/bloomberg-tokens';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'analyst' | 'viewer';
  status: 'active' | 'inactive';
}

export const UserManagementSection: React.FC = () => {
  const [users] = useState<User[]>([
    { id: '1', name: 'Admin User', email: 'admin@jedire.com', role: 'admin', status: 'active' },
    { id: '2', name: 'Analyst One', email: 'analyst@jedire.com', role: 'analyst', status: 'active' },
  ]);

  const roleColor = (role: string) => {
    if (role === 'admin') return BT.redL;
    if (role === 'analyst') return BT.cyanL;
    return BT.td;
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: BT.cyanL, letterSpacing: 2, textTransform: 'uppercase', ...mono, marginBottom: 20 }}>
        User Management
      </div>
      <div style={{ background: BT.bgCard, border: `1px solid ${BT.border}`, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', padding: '8px 16px', background: BT.bgPanel, borderBottom: `1px solid ${BT.border}` }}>
          {['Name', 'Email', 'Role', 'Status'].map(h => (
            <div key={h} style={{ fontSize: 9, fontWeight: 700, color: BT.td, letterSpacing: 1.5, textTransform: 'uppercase', ...mono }}>{h}</div>
          ))}
        </div>
        {users.map((user, i) => (
          <div key={user.id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', padding: '10px 16px', borderBottom: i < users.length - 1 ? `1px solid ${BT.border}` : 'none', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: BT.text.white, ...mono }}>{user.name}</div>
            <div style={{ fontSize: 12, color: BT.ts, ...mono }}>{user.email}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: roleColor(user.role), textTransform: 'uppercase', ...mono }}>{user.role}</div>
            <div style={{ fontSize: 11, color: user.status === 'active' ? BT.greenL : BT.td, ...mono }}>● {user.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserManagementSection;
