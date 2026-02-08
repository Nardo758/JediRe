import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, Users, Plus, MoreVertical, Mail, Shield, Crown, UserX, Edit2, Trash2, X, Check } from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'active' | 'pending';
  joinedAt: string;
  avatar?: string;
}

const roleLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  owner: { label: 'Owner', color: 'bg-yellow-100 text-yellow-700', icon: <Crown className="w-3 h-3" /> },
  admin: { label: 'Admin', color: 'bg-purple-100 text-purple-700', icon: <Shield className="w-3 h-3" /> },
  member: { label: 'Member', color: 'bg-blue-100 text-blue-700', icon: <Users className="w-3 h-3" /> },
  viewer: { label: 'Viewer', color: 'bg-gray-100 text-gray-700', icon: null },
};

const initialMembers: TeamMember[] = [
  { id: '1', name: 'John Smith', email: 'john@example.com', role: 'owner', status: 'active', joinedAt: 'Jan 15, 2025' },
  { id: '2', name: 'Sarah Johnson', email: 'sarah@example.com', role: 'admin', status: 'active', joinedAt: 'Feb 1, 2025' },
  { id: '3', name: 'Mike Davis', email: 'mike@example.com', role: 'member', status: 'active', joinedAt: 'Feb 10, 2025' },
  { id: '4', name: 'Emily Chen', email: 'emily@example.com', role: 'viewer', status: 'pending', joinedAt: 'Invited Jan 28' },
];

export default function TeamManagementPage() {
  const [members, setMembers] = useState<TeamMember[]>(initialMembers);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');

  const removeMember = (id: string) => {
    setMembers(members.filter(m => m.id !== id));
  };

  const handleInvite = () => {
    if (inviteEmail) {
      setMembers([...members, {
        id: Date.now().toString(),
        name: inviteEmail.split('@')[0],
        email: inviteEmail,
        role: inviteRole as TeamMember['role'],
        status: 'pending',
        joinedAt: 'Just invited',
      }]);
      setInviteEmail('');
      setShowInvite(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link to="/settings" className="text-gray-400 hover:text-gray-600">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <Users className="w-8 h-8 text-blue-600" />
                <span className="text-xl font-bold text-gray-900">Team Management</span>
              </div>
            </div>
            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Invite Member
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Team Members ({members.length})</h3>
            <div className="text-sm text-gray-500">
              {members.filter(m => m.status === 'active').length} active, {members.filter(m => m.status === 'pending').length} pending
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {members.map(member => (
              <div key={member.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{member.name}</span>
                      {member.status === 'pending' && (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">Pending</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{member.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${roleLabels[member.role].color}`}>
                    {roleLabels[member.role].icon}
                    {roleLabels[member.role].label}
                  </span>
                  <span className="text-sm text-gray-500">{member.joinedAt}</span>
                  {member.role !== 'owner' && (
                    <div className="flex items-center gap-1">
                      <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeMember(member.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">Role Permissions</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 text-gray-500 font-medium">Permission</th>
                <th className="text-center py-2 text-gray-500 font-medium">Owner</th>
                <th className="text-center py-2 text-gray-500 font-medium">Admin</th>
                <th className="text-center py-2 text-gray-500 font-medium">Member</th>
                <th className="text-center py-2 text-gray-500 font-medium">Viewer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                { name: 'View properties', owner: true, admin: true, member: true, viewer: true },
                { name: 'Add/edit properties', owner: true, admin: true, member: true, viewer: false },
                { name: 'Delete properties', owner: true, admin: true, member: false, viewer: false },
                { name: 'Manage team', owner: true, admin: true, member: false, viewer: false },
                { name: 'Billing access', owner: true, admin: false, member: false, viewer: false },
                { name: 'Delete workspace', owner: true, admin: false, member: false, viewer: false },
              ].map((perm, i) => (
                <tr key={i}>
                  <td className="py-3 text-gray-700">{perm.name}</td>
                  <td className="py-3 text-center">{perm.owner ? <Check className="w-4 h-4 text-green-500 mx-auto" /> : <X className="w-4 h-4 text-gray-300 mx-auto" />}</td>
                  <td className="py-3 text-center">{perm.admin ? <Check className="w-4 h-4 text-green-500 mx-auto" /> : <X className="w-4 h-4 text-gray-300 mx-auto" />}</td>
                  <td className="py-3 text-center">{perm.member ? <Check className="w-4 h-4 text-green-500 mx-auto" /> : <X className="w-4 h-4 text-gray-300 mx-auto" />}</td>
                  <td className="py-3 text-center">{perm.viewer ? <Check className="w-4 h-4 text-green-500 mx-auto" /> : <X className="w-4 h-4 text-gray-300 mx-auto" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Invite Team Member</h3>
              <button onClick={() => setShowInvite(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  aria-label="Email address"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  aria-label="Role"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setShowInvite(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2"
              >
                <Mail className="w-4 h-4" /> Send Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
