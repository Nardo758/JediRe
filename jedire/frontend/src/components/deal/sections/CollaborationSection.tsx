import React, { useState } from 'react';
import { Users, Mail, Plus, MoreVertical, Shield, Eye, Edit, Trash2, Clock, X } from 'lucide-react';
import { Deal } from '@/types';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  addedAt: Date;
  lastActive?: Date;
}

interface CollaborationSectionProps {
  deal: Deal;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  editor: 'Editor',
  viewer: 'Viewer'
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  owner: 'Full access - can manage team and delete deal',
  editor: 'Can edit deal details and add documents',
  viewer: 'Read-only access to deal information'
};

const ROLE_ICONS: Record<string, React.ComponentType<any>> = {
  owner: Shield,
  editor: Edit,
  viewer: Eye
};

function getRoleColor(role: string): string {
  switch (role) {
    case 'owner':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'editor':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'viewer':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

export function CollaborationSection({ deal }: CollaborationSectionProps) {
  // Stub data - would normally come from props or API
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    {
      id: '1',
      name: 'Leon D',
      email: 'leon@jedire.com',
      role: 'owner',
      addedAt: new Date(Date.now() - 86400000 * 5),
      lastActive: new Date(Date.now() - 3600000)
    }
  ]);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('viewer');
  const [inviteMessage, setInviteMessage] = useState('');

  const handleInvite = () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    // TODO: Implement actual invite logic
    console.log('Inviting:', { email: inviteEmail, role: inviteRole, message: inviteMessage });
    
    // Simulate adding team member
    const newMember: TeamMember = {
      id: Date.now().toString(),
      name: inviteEmail.split('@')[0],
      email: inviteEmail,
      role: inviteRole,
      addedAt: new Date()
    };
    
    setTeamMembers([...teamMembers, newMember]);
    setShowInviteModal(false);
    setInviteEmail('');
    setInviteRole('viewer');
    setInviteMessage('');
  };

  const handleRemoveMember = (memberId: string) => {
    if (confirm('Are you sure you want to remove this team member?')) {
      setTeamMembers(members => members.filter(m => m.id !== memberId));
      // TODO: Implement actual remove logic
    }
  };

  const handleChangeRole = (memberId: string, newRole: 'owner' | 'editor' | 'viewer') => {
    setTeamMembers(members =>
      members.map(m => m.id === memberId ? { ...m, role: newRole } : m)
    );
    // TODO: Implement actual role change logic
  };

  return (
    <div className="space-y-6">
      {/* Header with Invite Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Team Access</h3>
          <p className="text-sm text-gray-600 mt-1">
            Manage who can view and edit this deal
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Invite Team Member
        </button>
      </div>

      {/* Team Members List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {teamMembers.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No team members yet
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Invite colleagues to collaborate on this deal
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {teamMembers.map(member => {
              const RoleIcon = ROLE_ICONS[member.role];
              return (
                <div
                  key={member.id}
                  className="p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                        {member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-semibold text-gray-900">
                            {member.name}
                          </h4>
                          {member.role === 'owner' && (
                            <span className="text-xs text-gray-500">(You)</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{member.email}</p>
                        
                        {/* Role Badge */}
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getRoleColor(member.role)}`}>
                            <RoleIcon className="w-3 h-3" />
                            {ROLE_LABELS[member.role]}
                          </span>
                          
                          {member.lastActive && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Active {formatRelativeTime(member.lastActive)}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-gray-500 mt-1">
                          {ROLE_DESCRIPTIONS[member.role]}
                        </p>
                      </div>
                    </div>

                    {/* Actions (only show if not owner or if multiple owners) */}
                    {member.role !== 'owner' && (
                      <div className="relative group">
                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        
                        {/* Dropdown menu (simplified - would use proper dropdown component) */}
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-10">
                          <button
                            onClick={() => handleChangeRole(member.id, 'editor')}
                            disabled={member.role === 'editor'}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Edit className="w-4 h-4 inline mr-2" />
                            Make Editor
                          </button>
                          <button
                            onClick={() => handleChangeRole(member.id, 'viewer')}
                            disabled={member.role === 'viewer'}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Eye className="w-4 h-4 inline mr-2" />
                            Make Viewer
                          </button>
                          <div className="border-t border-gray-200 my-1" />
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4 inline mr-2" />
                            Remove Access
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Role Permissions Guide */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Permission Levels
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(ROLE_DESCRIPTIONS).map(([role, description]) => {
            const RoleIcon = ROLE_ICONS[role];
            return (
              <div key={role} className="flex items-start gap-2">
                <RoleIcon className="w-4 h-4 text-blue-700 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    {ROLE_LABELS[role]}
                  </p>
                  <p className="text-xs text-blue-700">{description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Invite Team Member
              </h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Email Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Access Level
                </label>
                <div className="space-y-2">
                  {(['editor', 'viewer'] as const).map(role => {
                    const RoleIcon = ROLE_ICONS[role];
                    return (
                      <label
                        key={role}
                        className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                          inviteRole === role
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={role}
                          checked={inviteRole === role}
                          onChange={() => setInviteRole(role)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <RoleIcon className="w-4 h-4 text-gray-600" />
                            <span className="text-sm font-medium text-gray-900">
                              {ROLE_LABELS[role]}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">
                            {ROLE_DESCRIPTIONS[role]}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Optional Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message (Optional)
                </label>
                <textarea
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  placeholder="Add a personal message to the invitation..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Mail className="w-4 h-4" />
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
