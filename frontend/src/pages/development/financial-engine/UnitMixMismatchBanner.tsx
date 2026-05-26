import React, { useState } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';

const MONO = BT.font.mono;

function sessionKey(dealId: string) {
  return `unitMixMismatch:dismissed:${dealId}`;
}

function isDismissed(dealId: string): boolean {
  try {
    return sessionStorage.getItem(sessionKey(dealId)) === '1';
  } catch {
    return false;
  }
}

function setDismissed(dealId: string) {
  try {
    sessionStorage.setItem(sessionKey(dealId), '1');
  } catch {
    // sessionStorage unavailable — degrade to no-op
  }
}

interface UnitMixMismatchBannerProps {
  mixTotal: number;
  targetUnits: number;
  dealId: string;
  onGoToUnitMix: () => void;
}

export function UnitMixMismatchBanner({ mixTotal, targetUnits, dealId, onGoToUnitMix }: UnitMixMismatchBannerProps) {
  const [dismissed, setDismissedState] = useState(() => isDismissed(dealId));

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(dealId);
    setDismissedState(true);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '6px 14px',
      background: '#1a1200',
      borderBottom: `1px solid ${BT.text.amber}44`,
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 11, color: BT.text.amber, flexShrink: 0 }}>⚠</span>
      <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber, letterSpacing: 0.4, flex: 1 }}>
        UNIT MIX MISMATCH — mix total ({mixTotal}) does not match deal target ({targetUnits} units).
        Rent and NOI projections may be understated or overstated.
      </span>
      <button
        onClick={onGoToUnitMix}
        style={{
          fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
          color: BT.text.amber, background: `${BT.text.amber}18`,
          border: `1px solid ${BT.text.amber}66`,
          borderRadius: 2, padding: '2px 10px', cursor: 'pointer', flexShrink: 0,
        }}
      >
        GO TO UNIT MIX →
      </button>
      <button
        onClick={handleDismiss}
        title="Dismiss for this session"
        style={{
          fontFamily: MONO, fontSize: 11, color: BT.text.muted,
          background: 'transparent', border: 'none', cursor: 'pointer',
          lineHeight: 1, padding: '0 2px', flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

/**
 * Reads unit mix totals from f9Financials and deal, returning the banner
 * if a mismatch exists. Returns null when data is insufficient or matches.
 */
export function UnitMixMismatchBannerConnected({
  f9Financials,
  deal,
  dealId,
  onGoToUnitMix,
}: {
  f9Financials?: { totalUnits?: number; rentRollSummary?: { unitMix?: unknown[] | null } | null } | null;
  deal?: Record<string, unknown> | null;
  dealId: string;
  onGoToUnitMix: () => void;
}) {
  const mixRows = f9Financials?.rentRollSummary?.unitMix ?? [];
  const mixTotal = f9Financials?.totalUnits ?? 0;
  const targetUnits = deal?.target_units as number | null | undefined;

  const hasMixData = mixRows.length > 0;
  const hasTarget = targetUnits != null && (targetUnits as number) > 0;
  const isMismatch = hasMixData && hasTarget && mixTotal !== (targetUnits as number);

  if (!isMismatch) return null;

  return (
    <UnitMixMismatchBanner
      mixTotal={mixTotal}
      targetUnits={targetUnits as number}
      dealId={dealId}
      onGoToUnitMix={onGoToUnitMix}
    />
  );
}
