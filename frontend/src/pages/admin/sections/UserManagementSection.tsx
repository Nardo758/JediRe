import React, { useEffect, useState, useCallback } from 'react';
import {
  Users, Search, RefreshCw, ChevronLeft, ChevronRight,
  Shield, ShieldOff, Trash2, Eye, XCircle, CheckCircle2,
} from 'lucide-react';
import { apiClient } from '../../../services/api.client';

interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  deal_count: string;
}

interface UserDetail {
  user: User;
  deal_count: number;
  recent_activity: Array<{ action: string; deal_id: string; created_at: string }>;
}

export function UserManagementSection() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = { page, limit: 20 };
      if (search) params.search = search;
      const res = await apiClient.get('/api/v1/admin/users', { params });
      setUsers(res.data.users);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const viewDetail = async (userId: string) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
      setUserDetail(null);
      return;
    }
    setExpandedUser(userId);
    try {
      const res = await apiClient.get(`/api/v1/admin/users/${userId}`);
      setUserDetail(res.data);
    } catch {
      setUserDetail(null);
    }
  };

  const toggleSuspend = async (userId: string) => {
    setActionLoading(userId);
    try {
      await apiClient.post(`/api/v1/admin/users/${userId}/suspend`);
      fetchUsers();
    } catch (err: any) {
      setError(`Suspend failed: ${err.response?.data?.error || err.message}`);
    }
    setActionLoading(null);
  };

  const deleteUser = async (userId: string) => {
    setActionLoading(userId);
    try {
      await apiClient.delete(`/api/v1/admin/users/${userId}`);
      setConfirmDelete(null);
      fetchUsers();
    } catch (err: any) {
      setError(`Delete failed: ${err.response?.data?.error || err.message}`);
    }
    setActionLoading(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-600" />
          User Management
          <span className="text-sm font-normal text-gray-500">({total} total)</span>
        </h2>
        <button onClick={fetchUsers} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by email or name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button onClick={handleSearch} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Search
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading users...</span>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Deals</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Last Login</th>
                  <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <React.Fragment key={u.id}>
                    <tr className={`border-b border-gray-100 hover:bg-gray-50 ${expandedUser === u.id ? 'bg-blue-50' : ''}`}>
                      <td className="py-2 px-4 font-medium text-gray-900">{u.email}</td>
                      <td className="py-2 px-4 text-gray-600">{[u.first_name, u.last_name].filter(Boolean).join(' ') || '--'}</td>
                      <td className="py-2 px-4">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                        }`}>{u.role}</span>
                      </td>
                      <td className="py-2 px-4">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>{u.is_active ? 'Active' : 'Suspended'}</span>
                      </td>
                      <td className="py-2 px-4 text-right font-medium">{u.deal_count}</td>
                      <td className="py-2 px-4 text-gray-500 text-xs">
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="py-2 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => viewDetail(u.id)} className="p-1 rounded hover:bg-gray-200" title="View details">
                            <Eye className="w-3.5 h-3.5 text-gray-500" />
                          </button>
                          <button
                            onClick={() => toggleSuspend(u.id)}
                            disabled={actionLoading === u.id}
                            className="p-1 rounded hover:bg-gray-200"
                            title={u.is_active ? 'Suspend' : 'Reactivate'}
                          >
                            {u.is_active ? <ShieldOff className="w-3.5 h-3.5 text-orange-500" /> : <Shield className="w-3.5 h-3.5 text-green-500" />}
                          </button>
                          {confirmDelete === u.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => deleteUser(u.id)} className="p-1 rounded bg-red-100 hover:bg-red-200" title="Confirm delete">
                                <CheckCircle2 className="w-3.5 h-3.5 text-red-600" />
                              </button>
                              <button onClick={() => setConfirmDelete(null)} className="p-1 rounded hover:bg-gray-200" title="Cancel">
                                <XCircle className="w-3.5 h-3.5 text-gray-400" />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDelete(u.id)} className="p-1 rounded hover:bg-gray-200" title="Delete user">
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedUser === u.id && userDetail && (
                      <tr>
                        <td colSpan={7} className="bg-blue-50 px-4 py-3 border-b border-blue-100">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="font-medium text-gray-700 mb-1">User Details</div>
                              <div className="text-gray-500">Created: {new Date(userDetail.user.created_at).toLocaleString()}</div>
                              <div className="text-gray-500">Deals: {userDetail.deal_count}</div>
                            </div>
                            <div>
                              <div className="font-medium text-gray-700 mb-1">Recent Activity</div>
                              {userDetail.recent_activity.length > 0 ? (
                                <div className="space-y-1">
                                  {userDetail.recent_activity.slice(0, 5).map((a, i) => (
                                    <div key={i} className="text-xs text-gray-500">
                                      {a.action} <span className="text-gray-400">- {new Date(a.created_at).toLocaleDateString()}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-xs text-gray-400">No recent activity</div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">No users found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              <div className="text-xs text-gray-500">Page {page} of {pages}</div>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded border border-gray-300 hover:bg-white disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(pages, p + 1))}
                  disabled={page === pages}
                  className="p-1.5 rounded border border-gray-300 hover:bg-white disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
