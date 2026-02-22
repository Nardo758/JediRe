/**
 * Team & Collaboration Section - Dual-Mode (Acquisition & Performance)
 * Switches content based on deal status:
 * - pipeline → Acquisition mode: Deal team, decisions, action items
 * - owned → Performance mode: Property team, vendors, escalations
 */

import React, { useState } from 'react';
import { Deal } from '../../../types/deal';
import { useDealMode } from '../../../hooks/useDealMode';
import {
  acquisitionTeamMembers,
  acquisitionCommunications,
  acquisitionDecisions,
  acquisitionActionItems,
  acquisitionStats,
  performanceTeamMembers,
  performanceCommunications,
  performanceDecisions,
  performanceActionItems,
  performanceStats,
  performanceVendors,
  performanceEscalations,
  TeamMember,
  Communication,
  Decision,
  ActionItem,
  TeamStats,
  Vendor,
  Escalation
} from '../../../data/teamMockData';

interface TeamSectionProps {
  deal: Deal;
}

export const TeamSection: React.FC<TeamSectionProps> = ({ deal }) => {
  const { mode, isPipeline, isOwned } = useDealMode(deal);

  // Select data based on mode
  const teamMembers = isPipeline ? acquisitionTeamMembers : performanceTeamMembers;
  const communications = isPipeline ? acquisitionCommunications : performanceCommunications;
  const decisions = isPipeline ? acquisitionDecisions : performanceDecisions;
  const actionItems = isPipeline ? acquisitionActionItems : performanceActionItems;
  const stats = isPipeline ? acquisitionStats : performanceStats;

  return (
    <div className="space-y-6">
      
      {/* Mode Indicator */}
      <div className={`px-3 py-1 rounded-full text-xs font-semibold inline-block ${
        isPipeline 
          ? 'bg-blue-100 text-blue-700' 
          : 'bg-green-100 text-green-700'
      }`}>
        {isPipeline ? '🎯 Acquisition Team' : '🏢 Property Team'}
      </div>

      {/* Quick Stats */}
      <TeamStatsGrid stats={stats} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Team Members */}
        <div className="lg:col-span-2 space-y-6">
          <TeamMembersCard members={teamMembers} mode={mode} />
          <CommunicationsCard communications={communications} mode={mode} />
        </div>

        {/* Right Column: Decisions & Action Items */}
        <div className="space-y-6">
          <DecisionsCard decisions={decisions} mode={mode} />
          <ActionItemsCard actionItems={actionItems} mode={mode} />
        </div>
      </div>

      {/* Performance Mode: Additional Cards */}
      {isOwned && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <VendorsCard vendors={performanceVendors} />
          <EscalationsCard escalations={performanceEscalations} />
        </div>
      )}

    </div>
  );
};

// ==================== SUB-COMPONENTS ====================

interface TeamStatsGridProps {
  stats: TeamStats[];
}

const TeamStatsGrid: React.FC<TeamStatsGridProps> = ({ stats }) => {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Team Overview</h3>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {stats.map((stat, index) => (
          <div 
            key={index}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">{stat.label}</span>
              <span className="text-2xl">{stat.icon}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {stat.value}
            </div>
            {stat.subtext && (
              <div className="text-xs text-gray-500">{stat.subtext}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

interface TeamMembersCardProps {
  members: TeamMember[];
  mode: 'acquisition' | 'performance';
}

const TeamMembersCard: React.FC<TeamMembersCardProps> = ({ members, mode }) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const getStatusColor = (status: string) => {
    const colors = {
      online: 'bg-green-500',
      offline: 'bg-gray-400',
      away: 'bg-yellow-500'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-400';
  };

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <span>👥</span> Team Directory
          <span className="text-gray-400 font-normal">({members.length})</span>
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex bg-white border border-gray-200 rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === 'grid' 
                  ? 'bg-blue-500 text-white' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === 'list' 
                  ? 'bg-blue-500 text-white' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              List
            </button>
          </div>
          <button className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors">
            + Add Member
          </button>
        </div>
      </div>
      
      <div className="p-4">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {members.map(member => (
              <div
                key={member.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
                onClick={() => setSelectedMember(member)}
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                      {member.avatar}
                    </div>
                    <div 
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(member.status)}`}
                      title={getStatusText(member.status)}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {member.name}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {member.role}
                    </div>
                    <div className="text-xs text-gray-400 mt-1 truncate">
                      {member.department}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <a 
                        href={`mailto:${member.email}`} 
                        className="text-blue-600 hover:text-blue-700 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        📧
                      </a>
                      <a 
                        href={`tel:${member.phone}`} 
                        className="text-blue-600 hover:text-blue-700 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        📞
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {members.map(member => (
              <div
                key={member.id}
                className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setSelectedMember(member)}
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                    {member.avatar}
                  </div>
                  <div 
                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(member.status)}`}
                  />
                </div>
                <div className="flex-1 grid grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{member.name}</div>
                    <div className="text-xs text-gray-500">{member.role}</div>
                  </div>
                  <div className="text-xs text-gray-600">{member.department}</div>
                  <div className="text-xs text-gray-600">{member.email}</div>
                  <div className="text-xs text-gray-600">{member.phone}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Member Detail Modal */}
      {selectedMember && (
        <MemberDetailModal 
          member={selectedMember} 
          onClose={() => setSelectedMember(null)} 
        />
      )}
    </div>
  );
};

interface MemberDetailModalProps {
  member: TeamMember;
  onClose: () => void;
}

const MemberDetailModal: React.FC<MemberDetailModalProps> = ({ member, onClose }) => {
  const getStatusColor = (status: string) => {
    const colors = {
      online: 'bg-green-500',
      offline: 'bg-gray-400',
      away: 'bg-yellow-500'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-400';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Team Member Details</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-xl">
                {member.avatar}
              </div>
              <div 
                className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(member.status)}`}
              />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-900">{member.name}</h4>
              <p className="text-sm text-gray-600">{member.role}</p>
              <p className="text-xs text-gray-500 mt-1">{member.department}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Email</label>
              <a href={`mailto:${member.email}`} className="block text-sm text-blue-600 hover:text-blue-700">
                {member.email}
              </a>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Phone</label>
              <a href={`tel:${member.phone}`} className="block text-sm text-blue-600 hover:text-blue-700">
                {member.phone}
              </a>
            </div>
            {member.contactPreference && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Preferred Contact</label>
                <p className="text-sm text-gray-700 capitalize">{member.contactPreference}</p>
              </div>
            )}
          </div>

          {member.responsibilities && member.responsibilities.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Responsibilities</label>
              <ul className="space-y-1">
                {member.responsibilities.map((resp, index) => (
                  <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span>{resp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-2">
          <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium">
            Send Message
          </button>
          <button 
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

interface CommunicationsCardProps {
  communications: Communication[];
  mode: 'acquisition' | 'performance';
}

const CommunicationsCard: React.FC<CommunicationsCardProps> = ({ communications, mode }) => {
  const getTypeIcon = (type: string) => {
    const icons = {
      email: '📧',
      call: '📞',
      meeting: '📅',
      message: '💬',
      document: '📄'
    };
    return icons[type as keyof typeof icons] || '📋';
  };

  const getTypeColor = (type: string) => {
    const colors = {
      email: 'text-blue-500',
      call: 'text-green-500',
      meeting: 'text-purple-500',
      message: 'text-orange-500',
      document: 'text-indigo-500'
    };
    return colors[type as keyof typeof colors] || 'text-gray-500';
  };

  const getPriorityBadge = (priority?: string) => {
    if (!priority) return null;
    const colors = {
      high: 'bg-red-100 text-red-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-green-100 text-green-700'
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[priority as keyof typeof colors]}`}>
        {priority}
      </span>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <span>💬</span> Recent Communications
        </h3>
        <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
          View All
        </button>
      </div>
      
      <div className="divide-y divide-gray-100">
        {communications.map(comm => (
          <div 
            key={comm.id} 
            className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
          >
            <div className="flex gap-3">
              <div className={`flex-shrink-0 mt-1 text-xl ${getTypeColor(comm.type)}`}>
                {getTypeIcon(comm.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="text-sm font-semibold text-gray-900">{comm.subject}</h4>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {getPriorityBadge(comm.priority)}
                    {comm.hasAttachment && (
                      <span className="text-gray-400 text-xs">📎</span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-600 mb-2">{comm.summary}</p>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    {comm.participants.join(', ')}
                  </div>
                  <div className="text-xs text-gray-400">
                    {comm.timestamp}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface DecisionsCardProps {
  decisions: Decision[];
  mode: 'acquisition' | 'performance';
}

const DecisionsCard: React.FC<DecisionsCardProps> = ({ decisions, mode }) => {
  const [showAll, setShowAll] = useState(false);
  const displayDecisions = showAll ? decisions : decisions.slice(0, 3);

  const getImpactBadge = (impact: string) => {
    const colors = {
      high: 'bg-red-100 text-red-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-green-100 text-green-700'
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[impact as keyof typeof colors]}`}>
        {impact} impact
      </span>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <span>✅</span> Key Decisions
        </h3>
      </div>
      
      <div className="p-4 space-y-4">
        {displayDecisions.map(decision => (
          <div 
            key={decision.id} 
            className="pb-4 border-b border-gray-100 last:border-0 last:pb-0"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <h4 className="text-sm font-semibold text-gray-900">{decision.title}</h4>
              {getImpactBadge(decision.impact)}
            </div>
            <p className="text-sm text-gray-700 mb-2 font-medium">
              "{decision.decision}"
            </p>
            <p className="text-xs text-gray-600 mb-2">{decision.context}</p>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>By {decision.madeBy}</span>
              <span>{decision.date}</span>
            </div>
          </div>
        ))}
        
        {decisions.length > 3 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full text-xs text-blue-600 hover:text-blue-700 font-medium text-center py-2"
          >
            {showAll ? 'Show Less' : `Show ${decisions.length - 3} More`}
          </button>
        )}
      </div>
    </div>
  );
};

interface ActionItemsCardProps {
  actionItems: ActionItem[];
  mode: 'acquisition' | 'performance';
}

const ActionItemsCard: React.FC<ActionItemsCardProps> = ({ actionItems, mode }) => {
  const [showCompleted, setShowCompleted] = useState(false);
  
  const openItems = actionItems.filter(item => item.status !== 'completed');
  const completedItems = actionItems.filter(item => item.status === 'completed');
  const displayItems = showCompleted ? actionItems : openItems;

  const getStatusBadge = (status: string) => {
    const badges = {
      open: { color: 'bg-gray-100 text-gray-700', icon: '⚪' },
      'in-progress': { color: 'bg-blue-100 text-blue-700', icon: '🔵' },
      completed: { color: 'bg-green-100 text-green-700', icon: '✅' },
      overdue: { color: 'bg-red-100 text-red-700', icon: '🔴' }
    };
    const badge = badges[status as keyof typeof badges] || badges.open;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.color} flex items-center gap-1`}>
        <span>{badge.icon}</span>
        {status.replace('-', ' ')}
      </span>
    );
  };

  const getPriorityIcon = (priority: string) => {
    const icons = {
      high: '🔴',
      medium: '🟡',
      low: '🟢'
    };
    return icons[priority as keyof typeof icons] || '⚪';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <span>📋</span> Action Items
          <span className="text-gray-400 font-normal">({openItems.length} open)</span>
        </h3>
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          {showCompleted ? 'Hide Completed' : 'Show Completed'}
        </button>
      </div>
      
      <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
        {displayItems.map(item => (
          <div 
            key={item.id} 
            className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-all"
          >
            <div className="flex items-start gap-2 mb-2">
              <span className="text-lg flex-shrink-0">{getPriorityIcon(item.priority)}</span>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-900 mb-1">{item.title}</h4>
                {item.description && (
                  <p className="text-xs text-gray-600 mb-2">{item.description}</p>
                )}
                <div className="flex items-center gap-2 mb-2">
                  {getStatusBadge(item.status)}
                  <span className="text-xs text-gray-500">{item.category}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div>
                    <span className="font-medium">Assigned to:</span> {item.assignedTo}
                  </div>
                  <div className={`font-medium ${
                    item.status === 'overdue' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    Due: {item.dueDate}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {displayItems.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-sm">No {showCompleted ? '' : 'open'} action items</p>
          </div>
        )}
      </div>
    </div>
  );
};

interface VendorsCardProps {
  vendors: Vendor[];
}

const VendorsCard: React.FC<VendorsCardProps> = ({ vendors }) => {
  const getStatusBadge = (status: string) => {
    const badges = {
      active: { color: 'bg-green-100 text-green-700', icon: '✓' },
      inactive: { color: 'bg-gray-100 text-gray-700', icon: '○' },
      pending: { color: 'bg-yellow-100 text-yellow-700', icon: '⏳' }
    };
    const badge = badges[status as keyof typeof badges] || badges.pending;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.icon} {status}
      </span>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <span>🏢</span> Vendors & Contractors
        </h3>
        <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
          + Add Vendor
        </button>
      </div>
      
      <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
        {vendors.map(vendor => (
          <div 
            key={vendor.id} 
            className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900">{vendor.name}</h4>
                <p className="text-xs text-gray-500">{vendor.category}</p>
              </div>
              {getStatusBadge(vendor.status)}
            </div>
            
            <div className="space-y-1 mb-2 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <span className="font-medium">Contact:</span> {vendor.contact}
              </div>
              <div className="flex items-center gap-2">
                <span>📞</span> {vendor.phone}
              </div>
              <div className="flex items-center gap-2">
                <span>📧</span> {vendor.email}
              </div>
            </div>

            {vendor.contract && (
              <div className="bg-gray-50 rounded p-2 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Contract Value:</span>
                  <span className="font-medium">{formatCurrency(vendor.contract.value)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Period:</span>
                  <span>{vendor.contract.start} → {vendor.contract.end}</span>
                </div>
              </div>
            )}

            {vendor.rating && (
              <div className="flex items-center gap-1 mt-2 text-xs">
                <span className="text-yellow-500">{'⭐'.repeat(Math.floor(vendor.rating))}</span>
                <span className="text-gray-500">({vendor.rating}/5)</span>
              </div>
            )}

            {vendor.lastContact && (
              <div className="text-xs text-gray-400 mt-1">
                Last contact: {vendor.lastContact}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

interface EscalationsCardProps {
  escalations: Escalation[];
}

const EscalationsCard: React.FC<EscalationsCardProps> = ({ escalations }) => {
  const [showResolved, setShowResolved] = useState(false);
  
  const openEscalations = escalations.filter(e => e.status !== 'resolved');
  const resolvedEscalations = escalations.filter(e => e.status === 'resolved');
  const displayEscalations = showResolved ? escalations : openEscalations;

  const getSeverityBadge = (severity: string) => {
    const badges = {
      critical: { color: 'bg-red-600 text-white', icon: '🚨' },
      high: { color: 'bg-orange-500 text-white', icon: '⚠️' },
      medium: { color: 'bg-yellow-500 text-white', icon: '⚡' },
      low: { color: 'bg-blue-500 text-white', icon: 'ℹ️' }
    };
    const badge = badges[severity as keyof typeof badges] || badges.medium;
    return (
      <span className={`px-2 py-1 rounded text-xs font-bold ${badge.color} flex items-center gap-1`}>
        <span>{badge.icon}</span>
        {severity.toUpperCase()}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      open: { color: 'bg-red-100 text-red-700', text: 'Open' },
      'in-progress': { color: 'bg-yellow-100 text-yellow-700', text: 'In Progress' },
      resolved: { color: 'bg-green-100 text-green-700', text: 'Resolved' }
    };
    const badge = badges[status as keyof typeof badges] || badges.open;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <span>🚨</span> Escalations
          <span className="text-gray-400 font-normal">({openEscalations.length} open)</span>
        </h3>
        <button
          onClick={() => setShowResolved(!showResolved)}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          {showResolved ? 'Hide Resolved' : 'Show Resolved'}
        </button>
      </div>
      
      <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
        {displayEscalations.map(escalation => (
          <div 
            key={escalation.id} 
            className="border-2 border-gray-200 rounded-lg p-3 hover:shadow-md transition-all"
          >
            <div className="flex items-start gap-2 mb-2">
              {getSeverityBadge(escalation.severity)}
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900 mb-1">{escalation.title}</h4>
                {getStatusBadge(escalation.status)}
              </div>
            </div>
            
            <p className="text-xs text-gray-700 mb-2">{escalation.description}</p>
            
            {escalation.resolution && escalation.status === 'resolved' && (
              <div className="bg-green-50 border border-green-200 rounded p-2 mb-2 text-xs text-gray-700">
                <strong className="text-green-700">Resolution:</strong> {escalation.resolution}
              </div>
            )}
            
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div>
                <span className="font-medium">Reported by:</span> {escalation.reportedBy}
              </div>
              <div>
                {escalation.reportedDate}
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              <span className="font-medium">Assigned to:</span> {escalation.assignedTo}
            </div>
          </div>
        ))}
        
        {displayEscalations.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-sm">No {showResolved ? '' : 'open'} escalations</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamSection;
