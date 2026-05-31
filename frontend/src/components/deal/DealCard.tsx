import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BT } from '@/components/deal/bloomberg-ui';
import type { Deal, DealState, TriageStatus } from '../../types/deal';
import { CompletenesBadge } from './CompletenesBadge';

interface DealCardProps {
  deal: Deal;
}

const STATE_CONFIG: Record<DealState, { icon: string; label: string; color: string }> = {
  SIGNAL_INTAKE: { icon: '📥', label: 'Signal Intake', color: BT.text.secondary },
  TRIAGE: { icon: '🔍', label: 'Triage', color: BT.text.cyan },
  INTELLIGENCE_ASSEMBLY: { icon: '📊', label: 'Intelligence', color: BT.text.purple },
  UNDERWRITING: { icon: '💰', label: 'Underwriting', color: BT.text.amber },
  DEAL_PACKAGING: { icon: '📦', label: 'Packaging', color: BT.text.purple },
  EXECUTION: { icon: '⚡', label: 'Execution', color: BT.text.green },
  POST_CLOSE: { icon: '✅', label: 'Post-Close', color: BT.text.cyan },
  MARKET_NOTE: { icon: '📝', label: 'Market Note', color: BT.text.purple },
  STALLED: { icon: '⏸️', label: 'Stalled', color: BT.text.red },
  ARCHIVED: { icon: '📁', label: 'Archived', color: BT.text.muted },
};

const STATUS_CONFIG: Record<TriageStatus, { icon: string; color: string }> = {
  Hot: { icon: '🔥', color: BT.text.red },
  Warm: { icon: '☀️', color: BT.text.orange },
  Watch: { icon: '👀', color: BT.text.amber },
  Pass: { icon: '❌', color: BT.text.muted },
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
      className="block p-4 transition cursor-pointer"
      style={{
        background: BT.bg.panel,
        border: `1px solid ${isStale ? BT.text.orange + '44' : BT.border.subtle}`,
        borderRadius: 0,
        fontFamily: BT.font.mono,
      }}
    >
      {/* Header: Status Badge + State Indicator */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {/* Status Badge */}
          <div className="flex items-center gap-1 px-2 py-1" style={{ background: `${statusInfo.color}22`, color: statusInfo.color, fontSize: 9, fontWeight: 700, borderRadius: 2, letterSpacing: 0.5 }}>
            <span>{statusInfo.icon}</span>
            <span>{triageStatus.toUpperCase()}</span>
          </div>

          {/* Stale Indicator */}
          {isStale && (
            <div className="flex items-center gap-1 px-2 py-1" style={{ background: `${BT.text.orange}22`, color: BT.text.orange, fontSize: 9, fontWeight: 700, borderRadius: 2 }}>
              <span>⏰</span>
              <span>Stale</span>
            </div>
          )}
        </div>

        {/* State Badge + Completeness Badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1" style={{ background: `${stateInfo.color}22`, color: stateInfo.color, fontSize: 9, fontWeight: 500, borderRadius: 2 }}>
            <span>{stateInfo.icon}</span>
            <span>{stateInfo.label}</span>
          </div>
          {/* Stop propagation so clicking the badge panel doesn't navigate to the deal */}
          <div onClick={e => e.stopPropagation()}>
            <CompletenesBadge dealId={deal.id} />
          </div>
        </div>
      </div>

      {/* Deal Name */}
      <h3 className="mb-1 truncate" style={{ fontWeight: 600, color: BT.text.primary, fontSize: 12 }}>
        {deal.name}
      </h3>

      {/* Address */}
      {deal.address && (
        <p className="mb-2 truncate" style={{ fontSize: 10, color: BT.text.secondary }}>
          {deal.address}
        </p>
      )}

      {/* Days in Station */}
      <div className="flex items-center justify-between" style={{ fontSize: 9, color: BT.text.muted }}>
        <span>
          {daysInStation === 0 ? 'Today' : daysInStation === 1 ? '1 day in station' : `${daysInStation} days in station`}
        </span>

        {/* Triage Score */}
        {deal.triageScore !== undefined && (
          <span style={{ fontWeight: 500, color: BT.text.secondary }}>
            Score: {deal.triageScore}/50
          </span>
        )}
      </div>

      {/* Additional Info */}
      <div className="flex items-center gap-3 mt-2" style={{ fontSize: 9, color: BT.text.muted }}>
        <span>{deal.propertyCount || 0} properties</span>
        {deal.pendingTasks > 0 && (
          <span style={{ color: BT.text.orange, fontWeight: 500 }}>{deal.pendingTasks} tasks</span>
        )}
        {deal.acres && (
          <span>{deal.acres.toFixed(1)} acres</span>
        )}
      </div>
    </div>
  );
};
