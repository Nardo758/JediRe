import React, { useState, useEffect } from 'react';
import { Users, RefreshCw, AlertCircle } from 'lucide-react';
import { apiClient } from '../../../services/api.client';
import { BT } from '@/components/deal/bloomberg-ui';

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
}

export function UserManagementSection() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/api/v1/admin/users');
      setUsers(res.data.users || []);
    } catch {
      setError('Could not load user data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <div className="p-6 space-y-4" style={{ fontFamily: BT.font.label }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5" style={{ color: BT.text.cyan }} />
          <h2 className="text-lg font-semibold" style={{ color: BT.text.primary }}>User Management</h2>
          {!loading && <span className="text-xs ml-1" style={{ color: BT.text.muted }}>({users.length})</span>}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5"
          style={{ color: BT.text.secondary, border: `1px solid ${BT.border.subtle}`, borderRadius: 2, background: 'transparent' }}
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-sm" style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.text.red}`, borderRadius: 0, color: BT.text.red }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="overflow-hidden" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: `1px solid ${BT.border.subtle}`, background: BT.bg.header }}>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: BT.text.muted }}>Name / Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: BT.text.muted }}>Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: BT.text.muted }}>Joined</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: BT.text.muted }}>Last Sign In</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                    <td className="px-4 py-3"><div className="h-3 w-40 animate-pulse" style={{ background: BT.bg.panelAlt, borderRadius: 0 }} /></td>
                    <td className="px-4 py-3"><div className="h-3 w-16 animate-pulse" style={{ background: BT.bg.panelAlt, borderRadius: 0 }} /></td>
                    <td className="px-4 py-3"><div className="h-3 w-20 animate-pulse" style={{ background: BT.bg.panelAlt, borderRadius: 0 }} /></td>
                    <td className="px-4 py-3"><div className="h-3 w-20 animate-pulse" style={{ background: BT.bg.panelAlt, borderRadius: 0 }} /></td>
                  </tr>
                ))
              : users.length === 0
              ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: BT.text.muted }}>
                    No users found
                  </td>
                </tr>
              )
              : users.map(u => (
                <tr key={u.id} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: BT.text.primary }}>{u.full_name || '—'}</div>
                    <div className="text-xs" style={{ color: BT.text.muted }}>{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium" style={{
                      background: BT.bg.panelAlt,
                      color: u.role === 'admin' ? BT.text.purple : BT.text.secondary,
                      borderRadius: 2,
                    }}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: BT.text.muted, fontFamily: BT.font.mono }}>{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: BT.text.muted, fontFamily: BT.font.mono }}>{formatDate(u.last_sign_in_at)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
