import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../services/api.client';
import { Users, UserPlus, X, ChevronDown } from 'lucide-react';
import { BT } from '@/components/deal/bloomberg-ui';

interface Collaborator {
  id: string;
  deal_id: string;
  user_id: string | null;
  name: string;
  email: string;
  company: string | null;
  role: string;
  permission_level: string;
  status: string;
  last_active_at: string | null;
  created_at: string;
}

interface DealTeamPanelProps {
  dealId: string;
}

const PERMISSION_STYLES: Record<string, { bg: string; text: string }> = {
  admin: { bg: BT.bg.active, text: BT.text.red },
  edit: { bg: BT.bg.active, text: BT.text.cyan },
  comment: { bg: BT.bg.active, text: BT.text.green },
  view: { bg: BT.bg.active, text: BT.text.secondary },
};

export function DealTeamPanel({ dealId }: DealTeamPanelProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('member');
  const [newPermission, setNewPermission] = useState('view');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCollaborators = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/api/v1/deals/${dealId}/collaborators`) as any;
      setCollaborators(response?.data || []);
    } catch (err) {
      console.error('Failed to fetch collaborators:', err);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    fetchCollaborators();
  }, [fetchCollaborators]);

  const handleAdd = async () => {
    if (!newName.trim() || !newEmail.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post(`/api/v1/deals/${dealId}/collaborators`, {
        name: newName,
        email: newEmail,
        role: newRole,
        permission_level: newPermission,
      });
      setNewName('');
      setNewEmail('');
      setNewRole('member');
      setNewPermission('view');
      setShowAddForm(false);
      fetchCollaborators();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to add collaborator');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (collabId: string) => {
    try {
      await apiClient.delete(`/api/v1/deals/${dealId}/collaborators/${collabId}`);
      fetchCollaborators();
    } catch (err) {
      console.error('Failed to remove collaborator:', err);
    }
  };

  const handlePermissionChange = async (collabId: string, level: string) => {
    try {
      await apiClient.put(`/api/v1/deals/${dealId}/collaborators/${collabId}`, {
        permission_level: level,
      });
      fetchCollaborators();
    } catch (err) {
      console.error('Failed to update permission:', err);
    }
  };

  const inputStyle: React.CSSProperties = {
    fontSize: '11px',
    fontFamily: BT.font.label,
    border: `1px solid ${BT.border.medium}`,
    borderRadius: 0,
    background: BT.bg.input,
    color: BT.text.primary,
    outline: 'none',
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-1/3" style={{ background: BT.bg.active, borderRadius: '2px' }} />
          <div className="h-10" style={{ background: BT.bg.active, borderRadius: '2px' }} />
          <div className="h-10" style={{ background: BT.bg.active, borderRadius: '2px' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.medium}` }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: BT.bg.header, borderBottom: `1px solid ${BT.border.medium}` }}>
        <div className="flex items-center gap-2">
          <Users size={14} style={{ color: BT.text.muted }} />
          <span style={{ fontSize: '11px', fontWeight: 600, color: BT.text.primary, fontFamily: BT.font.mono }}>Deal Collaborators</span>
          <span className="px-1.5 py-0.5" style={{ fontSize: '10px', background: BT.bg.active, color: BT.text.secondary, borderRadius: '2px', fontWeight: 500, fontFamily: BT.font.mono }}>
            {collaborators.length}
          </span>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1"
          style={{ fontSize: '10px', fontWeight: 500, color: BT.text.cyan, fontFamily: BT.font.mono, background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <UserPlus size={12} />
          Add
        </button>
      </div>

      {showAddForm && (
        <div className="p-3" style={{ background: BT.bg.panelAlt, borderBottom: `1px solid ${BT.border.medium}` }}>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input
              type="text"
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="px-2.5 py-1.5"
              style={inputStyle}
            />
            <input
              type="email"
              placeholder="Email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="px-2.5 py-1.5"
              style={inputStyle}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="px-2.5 py-1.5"
              style={inputStyle}
            >
              <option value="member">Member</option>
              <option value="analyst">Analyst</option>
              <option value="partner">Partner</option>
              <option value="architect">Architect</option>
              <option value="contractor">Contractor</option>
              <option value="consultant">Consultant</option>
            </select>
            <select
              value={newPermission}
              onChange={(e) => setNewPermission(e.target.value)}
              className="px-2.5 py-1.5"
              style={inputStyle}
            >
              <option value="view">View</option>
              <option value="comment">Comment</option>
              <option value="edit">Edit</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {error && <p style={{ fontSize: '10px', color: BT.text.red, fontFamily: BT.font.label, marginBottom: '8px' }}>{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={submitting || !newName.trim() || !newEmail.trim()}
              className="px-3 py-1.5 disabled:opacity-50"
              style={{ fontSize: '10px', fontWeight: 500, fontFamily: BT.font.mono, background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 0, border: 'none', cursor: 'pointer' }}
            >
              {submitting ? 'Adding...' : 'Add Collaborator'}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setError(null); }}
              style={{ fontSize: '10px', fontWeight: 500, fontFamily: BT.font.mono, color: BT.text.secondary, background: 'transparent', border: 'none', cursor: 'pointer' }}
              className="px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {collaborators.length === 0 ? (
        <div className="p-6 text-center">
          <Users size={24} style={{ color: BT.text.muted }} className="mx-auto mb-2" />
          <p style={{ fontSize: '10px', color: BT.text.muted, fontFamily: BT.font.label }}>No collaborators yet</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-2"
            style={{ fontSize: '10px', fontWeight: 500, color: BT.text.cyan, fontFamily: BT.font.mono, background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            Add your first collaborator
          </button>
        </div>
      ) : (
        <div>
          {collaborators.map((c, idx) => {
            const ps = PERMISSION_STYLES[c.permission_level] || PERMISSION_STYLES.view;
            return (
              <div
                key={c.id}
                className="px-4 py-2.5 flex items-center justify-between group"
                style={{ borderBottom: idx < collaborators.length - 1 ? `1px solid ${BT.border.subtle}` : 'none' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-7 h-7 flex items-center justify-center flex-shrink-0"
                    style={{ borderRadius: '50%', background: BT.bg.active, color: BT.text.secondary, fontSize: '9px', fontWeight: 700, fontFamily: BT.font.mono }}
                  >
                    {c.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate" style={{ fontSize: '11px', fontWeight: 500, color: BT.text.primary, fontFamily: BT.font.label }}>{c.name}</div>
                    <div className="truncate" style={{ fontSize: '9px', color: BT.text.muted, fontFamily: BT.font.label }}>{c.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: '9px', color: BT.text.muted, textTransform: 'capitalize', fontFamily: BT.font.label }}>{c.role}</span>
                  <div className="relative">
                    <select
                      value={c.permission_level}
                      onChange={(e) => handlePermissionChange(c.id, e.target.value)}
                      className="appearance-none cursor-pointer pr-4"
                      style={{
                        fontSize: '9px',
                        fontWeight: 500,
                        fontFamily: BT.font.mono,
                        padding: '2px 16px 2px 6px',
                        borderRadius: '2px',
                        background: ps.bg,
                        color: ps.text,
                        border: 'none',
                      }}
                    >
                      <option value="view">View</option>
                      <option value="comment">Comment</option>
                      <option value="edit">Edit</option>
                      <option value="admin">Admin</option>
                    </select>
                    <ChevronDown size={8} className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: ps.text }} />
                  </div>
                  <button
                    onClick={() => handleRemove(c.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: BT.text.muted, background: 'transparent', border: 'none', cursor: 'pointer' }}
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
