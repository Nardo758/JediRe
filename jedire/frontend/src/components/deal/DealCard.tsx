import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Deal, DealState, TriageStatus } from '../../types/deal';

interface DealCardProps {
  deal: Deal;
}

const STATE_CONFIG: Record<DealState, { icon: string; label: string; color: string }> = {
  SIGNAL_INTAKE: { icon: '📥', label: 'Signal Intake', color: 'bg-gray-100 text-gray-700' },
  TRIAGE: { icon: '🔍', label: 'Triage', color: 'bg-blue-100 text-blue-700' },
  INTELLIGENCE_ASSEMBLY: { icon: '📊', label: 'Intelligence', color: 'bg-purple-100 text-purple-700' },
  UNDERWRITING: { icon: '💰', label: 'Underwriting', color: 'bg-amber-100 text-amber-700' },
  DEAL_PACKAGING: { icon: '📦', label: 'Packaging', color: 'bg-pink-100 text-pink-700' },
  EXECUTION: { icon: '⚡', label: 'Execution', color: 'bg-green-100 text-green-700' },
  POST_CLOSE: { icon: '✅', label: 'Post-Close', color: 'bg-teal-100 text-teal-700' },
  MARKET_NOTE: { icon: '📝', label: 'Market Note', color: 'bg-indigo-100 text-indigo-700' },
  STALLED: { icon: '⏸️', label: 'Stalled', color: 'bg-red-100 text-red-700' },
  ARCHIVED: { icon: '📁', label: 'Archived', color: 'bg-slate-100 text-slate-700' },
};

const STATUS_CONFIG: Record<TriageStatus, { icon: string; bgColor: string; textColor: string }> = {
  Hot: { icon: '🔥', bgColor: 'bg-red-500', textColor: 'text-white' },
  Warm: { icon: '☀️', bgColor: 'bg-orange-500', textColor: 'text-white' },
  Watch: { icon: '👀', bgColor: 'bg-yellow-500', textColor: 'text-white' },
  Pass: { icon: '❌', bgColor: 'bg-gray-400', textColor: 'text-white' },
};

export const DealCard: React.FC<DealCardProps> = ({ deal }) => {
  const navigate = useNavigate();
  
  const state = deal.state || 'TRIAGE';
  const stateInfo = STATE_CONFIG[state];
  
  const triageStatus = deal.triageStatus || 'Watch';
  const statusInfo = STATUS_CONFIG[triageStatus];
  
  const daysInStation = deal.daysInStation || 0;
  const isStale = daysInStation > 14;
  
  const handleClick = () => {
    navigate(`/deals/${deal.id}/view`);
  };

  return (
    <div
      onClick={handleClick}
      className={`
        block p-4 rounded-lg transition border bg-white cursor-pointer
        hover:shadow-md hover:border-blue-300
        ${isStale ? 'border-orange-300 bg-orange-50/30' : 'border-gray-200'}
      `}
    >
      {/* Header: Status Badge + State Indicator */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {/* Status Badge */}
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${statusInfo.bgColor} ${statusInfo.textColor}`}>
            <span>{statusInfo.icon}</span>
            <span>{triageStatus.toUpperCase()}</span>
          </div>
          
          {/* Stale Indicator */}
          {isStale && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
              <span>⏰</span>
              <span>Stale</span>
            </div>
          )}
        </div>
        
        {/* State Badge */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${stateInfo.color}`}>
          <span>{stateInfo.icon}</span>
          <span>{stateInfo.label}</span>
        </div>
      </div>
      
      {/* Deal Name */}
      <h3 className="font-semibold text-gray-900 text-base mb-1 truncate">
        {deal.name}
      </h3>
      
      {/* Address */}
      {deal.address && (
        <p className="text-sm text-gray-600 mb-2 truncate">
          {deal.address}
        </p>
      )}
      
      {/* Days in Station */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {daysInStation === 0 ? 'Today' : daysInStation === 1 ? '1 day in station' : `${daysInStation} days in station`}
        </span>
        
        {/* Triage Score */}
        {deal.triageScore !== undefined && (
          <span className="font-medium text-gray-700">
            Score: {deal.triageScore}/50
          </span>
        )}
      </div>
      
      {/* Additional Info */}
      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
        <span>{deal.propertyCount || 0} properties</span>
        {deal.pendingTasks > 0 && (
          <span className="text-orange-600 font-medium">{deal.pendingTasks} tasks</span>
        )}
        {deal.acres && (
          <span>{deal.acres.toFixed(1)} acres</span>
        )}
      </div>
    </div>
  );
};
