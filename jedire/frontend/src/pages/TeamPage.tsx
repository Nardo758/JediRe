import React from 'react';

export function TeamPage() {
  const team = [
    { name: 'Leon D', role: 'Owner', email: 'leon@example.com', status: 'active' },
    { name: 'Jeremy Myers', role: 'Partner', email: 'jeremy@example.com', status: 'active' },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Team Management</h1>
          <p className="text-gray-600">Manage team members and permissions</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          + Invite Member
        </button>
      </div>

      {/* Team Members */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Team Members</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {team.map((member, idx) => (
            <div key={idx} className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-xl">
                  👤
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{member.name}</div>
                  <div className="text-sm text-gray-600">{member.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="px-3 py-1 text-sm font-medium bg-blue-100 text-blue-700 rounded-full">
                  {member.role}
                </span>
                <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                  Manage
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Permissions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mt-6">
        <div className="p-6 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Role Permissions</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Owner</div>
                <div className="text-sm text-gray-600">Full access to all features</div>
              </div>
              <span className="text-green-600">✓ All permissions</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Partner</div>
                <div className="text-sm text-gray-600">Access to deals and analytics</div>
              </div>
              <button className="text-blue-600 hover:text-blue-700">Edit</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
