/**
 * InteractiveProformaTab.tsx
 *
 * Bridges the F9 Financial Engine tabProps system with the ProFormaTab
 * interactive editing component (which has all M36 features: anchor labels,
 * sensitivity overrides, plausibility badges, goal-seeking roadmap).
 *
 * This adapter extracts deal information from f9Financials and the deal
 * prop, and provides enough shape for ProFormaTab to mount correctly
 * inside the Financial Engine page.
 */

import React, { useMemo } from 'react';
import { ProFormaTab } from '../../../components/deal/sections/ProFormaTab';
import type { FinancialEngineTabProps } from './types';

const InteractiveProformaTab: React.FC<FinancialEngineTabProps> = (props) => {
  const { deal: rawDeal, f9Financials, assumptions } = props;

  const builtDeal = useMemo(() => {
    // Prefer the raw deal prop — it has the richest shape
    if (rawDeal && typeof rawDeal === 'object' && 'id' in rawDeal) {
      return rawDeal;
    }

    const ff = f9Financials;
    const a = assumptions;

    // Build a minimal deal shape that ProFormaTab can mount with
    const d: Record<string, any> = {
      id: props.dealId,
      name: ff?.dealName ?? a?.dealInfo?.dealName ?? 'Deal',
      units: ff?.totalUnits ?? a?.dealInfo?.totalUnits ?? 0,
      totalUnits: ff?.totalUnits ?? a?.dealInfo?.totalUnits ?? 0,
      purchasePrice: ff?.capitalStack?.purchasePrice ?? a?.acquisition?.purchasePrice ?? 0,
      loanAmount: ff?.capitalStack?.loanAmount ?? 0,
      capRate: ff?.capitalStack?.purchasePrice && ff?.valuationSnapshot?.goingInCapT12
        ? ff.valuationSnapshot.goingInCapT12 * 100
        : a?.acquisition?.capRate
          ? a.acquisition.capRate * 100
          : 0,
      deal_data: {
        city: a?.dealInfo?.city ?? '',
        state: a?.dealInfo?.state ?? '',
        address: a?.dealInfo?.address ?? '',
        broker_cap_rate: a?.acquisition?.capRate
          ? a.acquisition.capRate * 100
          : null,
      },
    };

    return d;
  }, [rawDeal, f9Financials, assumptions, props.dealId]);

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
