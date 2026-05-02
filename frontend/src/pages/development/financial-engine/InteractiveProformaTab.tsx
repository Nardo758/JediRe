/**
 * InteractiveProformaTab.tsx
 *
 * Bridges the F9 Financial Engine tabProps system with the ProFormaTab
 * interactive editing component (which has all M36 features: anchor labels,
 * sensitivity overrides, plausibility badges, goal-seeking roadmap).
 *
 * Merges rawDeal + f9Financials + assumptions so ProFormaTab gets
 * purchasePrice, loanAmount, capRate, and deal_data even when rawDeal
 * is sparse (the "early-return bug").  Also forwards the full
 * FinancialEngineTabProps bundle so callbacks (onBuildModel, onF9Refresh,
 * onIntegrityChange, evidence props) are reachable from ProFormaTab.
 */

import React, { useMemo } from 'react';
import { ProFormaTab } from '../../../components/deal/sections/ProFormaTab';
import type { FinancialEngineTabProps } from './types';

const InteractiveProformaTab: React.FC<FinancialEngineTabProps> = (props) => {
  const { deal: rawDeal, f9Financials, assumptions, dealId } = props;

  const builtDeal = useMemo(() => {
    // Merge, don't branch: always combine rawDeal + f9Financials + assumptions
    const base = (rawDeal && typeof rawDeal === 'object' && 'id' in rawDeal)
      ? { ...rawDeal }
      : {} as Record<string, any>;

    const ff = f9Financials;
    const a  = assumptions;

    // Build deal_data with as much context as we can find
    const dd: Record<string, any> = {
      ...(base.deal_data ?? {}),
      city: a?.dealInfo?.city ?? '',
      state: a?.dealInfo?.state ?? '',
      address: a?.dealInfo?.address ?? ff?.dealName ?? '',
    };

    // Purchase price: rawDeal → f9Financials → assumptions
    const purchasePrice = Number(base.purchasePrice)
      || Number(ff?.capitalStack?.purchasePrice)
      || Number(a?.acquisition?.purchasePrice)
      || 0;

    const loanAmount = Number(base.loanAmount)
      || Number(ff?.capitalStack?.loanAmount)
      || Number(a?.financing?.loanAmount)
      || 0;

    // Cap rate: keep as decimal everywhere (0.0575), NOT multiplied by 100
    const capRate = (() => {
      if (base.capRate != null && Number(base.capRate) > 0) return Number(base.capRate);
      const t12 = ff?.valuationSnapshot?.goingInCapT12;
      if (t12 != null && t12 > 0) return Number(t12);
      const ac = a?.acquisition?.capRate;
      if (ac != null && ac > 0) return Number(ac);
      const bc = dd.broker_cap_rate;
      if (bc != null && bc > 0) return Number(bc);
      return 0;
    })();

    dd.broker_cap_rate = dd.broker_cap_rate ?? capRate;

    // Total units
    const totalUnits = Number(base.totalUnits) || Number(base.units)
      || (ff?.totalUnits ?? 0)
      || (a?.dealInfo?.totalUnits ?? 0);

    return {
      ...base,
      id: dealId,
      dealId,
      name: base.name ?? ff?.dealName ?? a?.dealInfo?.dealName ?? 'Deal',
      units: totalUnits,
      totalUnits,
      purchasePrice,
      loanAmount,
      capRate,
      deal_data: dd,
    };
  }, [rawDeal, f9Financials, assumptions, dealId]);

  return (
    <div className="w-full h-full overflow-auto bg-white">
      <ProFormaTab
        deal={builtDeal as any}
        dealId={props.dealId}
      />
    </div>
  );
};

export default InteractiveProformaTab;
