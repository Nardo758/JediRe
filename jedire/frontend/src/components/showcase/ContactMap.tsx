import React from 'react';
import type { TeamMember } from '../../types/showcase.types';

interface Props {
  team: TeamMember[];
}

export function ContactMap({ team }: Props) {
  const getResponsivenessColor = (responsiveness: string) => {
    switch (responsiveness) {
      case 'high': return 'bg-green-100 text-green-800 border-green-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getRoleIcon = (role: string) => {
    const icons: Record<string, string> = {
      broker: '🏢',
      lender: '💰',
      attorney: '⚖️',
      inspector: '🔍',
      contractor: '🔨',
      'property-manager': '🏘️',
      other: '👤'
    };
    return icons[role] || '👤';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {team.map(member => (
        <div
          key={member.id}
          className={`p-4 rounded-lg border-2 ${getResponsivenessColor(member.responsiveness)} transition-all hover:shadow-md`}
        >
          <div className="flex items-start gap-3">
            <div className="text-2xl">{getRoleIcon(member.role)}</div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">{member.name}</h4>
                  <p className="text-sm text-gray-600 capitalize">{member.role.replace('-', ' ')}</p>
                  <p className="text-xs text-gray-500">{member.company}</p>
                </div>
                
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-700">{member.reliability}%</div>
                  <div className="text-xs text-gray-500">reliability</div>
                </div>
              </div>
              
              <div className="mt-3 space-y-1 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <span>📧</span>
                  <span className="truncate">{member.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>📞</span>
                  <span>{member.phone}</span>
                </div>
              </div>
              
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-gray-600">
                  Avg response: <span className="font-medium">{member.avgResponseTime}</span>
                </span>
                <span className="text-gray-500">
                  Last contact: {new Date(member.lastContact).toLocaleDateString()}
                </span>
              </div>
              
              <div className="mt-2 flex gap-2">
                <button className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700">
                  Email
                </button>
                <button className="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700">
                  Call
                </button>
                <button className="px-2 py-1 text-xs rounded bg-gray-600 text-white hover:bg-gray-700">
                  Text
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
