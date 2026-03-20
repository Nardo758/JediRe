import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Deal, DealState, TriageStatus } from '../../types/deal';

interface DealCardProps {
  deal: Deal;
}

const STATE_CONFIG: Record<DealState, { icon: string; label: string; color: string }> = {
  SIGNAL_INTAKE: { icon: '📥', label: 'Signal Intake', color: 'bg-[#131920] text-[#9EA8B4]' },
  TRIAGE: { icon: '🔍', label: 'Triage', color: 'bg-[#0d1e3d] text-blue-400' },
  INTELLIGENCE_ASSEMBLY: { icon: '📊', label: 'Intelligence', color: 'bg-[#1a0d3d] text-purple-400' },
  UNDERWRITING: { icon: '💰', label: 'Underwriting', color: 'bg-[#1a1200] text-amber-400' },
  DEAL_PACKAGING: { icon: '📦', label: 'Packaging', color: 'bg-pink-100 text-pink-700' },
  EXECUTION: { icon: '⚡', label: 'Execution', color: 'bg-[#022c22] text-green-400' },
  POST_CLOSE: { icon: '✅', label: 'Post-Close', color: 'bg-teal-100 text-teal-700' },
  MARKET_NOTE: { icon: '📝', label: 'Market Note', color: 'bg-indigo-100 text-indigo-400' },
  STALLED: { icon: '⏸️', label: 'Stalled', color: 'bg-[#1c0a0a] text-red-400' },
  ARCHIVED: { icon: '📁', label: 'Archived', color: 'bg-[#131920] text-slate-700' },
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
    navigate(`/deals/${deal.id}`);
  };

  return (
    <div
      onClick={handleClick}
      className={`
        block p-4 rounded-lg transition border bg-[#0F1319] cursor-pointer
        hover:shadow-md hover:border-blue-700
        ${isStale ? 'border-orange-300 bg-[#1a0d00]/30' : 'border-[#1e2a3d]'}
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
            <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-[#1a0d00] text-orange-700">
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
      <h3 className="font-semibold text-[#E8E6E1] text-base mb-1 truncate">
        {deal.name}
      </h3>
      
      {/* Address */}
      {deal.address && (
        <p className="text-sm text-[#9EA8B4] mb-2 truncate">
          {deal.address}
        </p>
      )}
      
      {/* Days in Station */}
      <div className="flex items-center justify-between text-xs text-[#6B7585]">
        <span>
          {daysInStation === 0 ? 'Today' : daysInStation === 1 ? '1 day in station' : `${daysInStation} days in station`}
        </span>
        
        {/* Triage Score */}
        {deal.triageScore !== undefined && (
          <span className="font-medium text-[#9EA8B4]">
            Score: {deal.triageScore}/50
          </span>
        )}
      </div>
      
      {/* Additional Info */}
      <div className="flex items-center gap-3 mt-2 text-xs text-[#6B7585]">
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
