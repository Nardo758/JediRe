import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../services/api.client';
import { Users, UserPlus, X, ChevronDown } from 'lucide-react';

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

const PERMISSION_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-700',
  edit: 'bg-blue-100 text-blue-700',
  comment: 'bg-green-100 text-green-700',
  view: 'bg-slate-100 text-slate-600',
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

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-slate-200 rounded w-1/3" />
          <div className="h-10 bg-slate-200 rounded" />
          <div className="h-10 bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Deal Collaborators</span>
          <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-medium">
            {collaborators.length}
          </span>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          <UserPlus size={12} />
          Add
        </button>
      </div>

      {showAddForm && (
        <div className="p-3 bg-blue-50 border-b border-blue-100">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input
              type="text"
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="email"
              placeholder="Email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              className="text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="view">View</option>
              <option value="comment">Comment</option>
              <option value="edit">Edit</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={submitting || !newName.trim() || !newEmail.trim()}
              className="text-xs font-medium px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add Collaborator'}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setError(null); }}
              className="text-xs font-medium px-3 py-1.5 text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {collaborators.length === 0 ? (
        <div className="p-6 text-center">
          <Users size={24} className="text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-500">No collaborators yet</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            Add your first collaborator
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {collaborators.map((c) => (
            <div key={c.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 group">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-[10px] font-bold flex-shrink-0">
                  {c.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-800 truncate">{c.name}</div>
                  <div className="text-[10px] text-slate-400 truncate">{c.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 capitalize">{c.role}</span>
                <div className="relative">
                  <select
                    value={c.permission_level}
                    onChange={(e) => handlePermissionChange(c.id, e.target.value)}
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded appearance-none cursor-pointer pr-4 ${PERMISSION_COLORS[c.permission_level] || PERMISSION_COLORS.view}`}
                  >
                    <option value="view">View</option>
                    <option value="comment">Comment</option>
                    <option value="edit">Edit</option>
                    <option value="admin">Admin</option>
                  </select>
                  <ChevronDown size={8} className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <button
                  onClick={() => handleRemove(c.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
