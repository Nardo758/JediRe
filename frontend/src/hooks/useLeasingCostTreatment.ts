/**
 * useLeasingCostTreatment — shared accessor + write hook for leasingCostTreatment.
 *
 * Canonical storage: deals.operator_stance.leasingCostTreatment (JSONB).
 * Canonical write surface: StanceTab → PUT /api/v1/deals/:id/stance.
 *
 * All consumers that need to SET the treatment import from this hook.
 * Read-only consumers (Projections header badge, ProFormaSummaryTab fetch param)
 * can read lvCostTreatmentView from parent props without importing this hook.
 *
 * Returns:
 *   treatment — current effective value, defaulting to 'OPERATING'
 *   setTreatment(v) — saves to operator_stance via dealStore.saveOperatorStance
 *   saving — true while the PUT /stance request is in-flight
 *   error — last save error message, or null
 */

import { useState, useCallback } from 'react';
import { useDealStore } from '../stores/dealStore';
import type { LeasingCostTreatment } from '../stores/dealContext.types';

export function useLeasingCostTreatment(dealId: string | undefined): {
  treatment: LeasingCostTreatment;
  setTreatment: (v: LeasingCostTreatment) => Promise<void>;
  saving: boolean;
  error: string | null;
} {
  const operatorStance  = useDealStore(s => s.operatorStance);
  const saveStance      = useDealStore(s => s.saveOperatorStance);

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const treatment: LeasingCostTreatment =
    (operatorStance?.leasingCostTreatment as LeasingCostTreatment | undefined) ?? 'OPERATING';

  const setTreatment = useCallback(async (v: LeasingCostTreatment) => {
    if (!dealId) return;
    setSaving(true);
    setError(null);
    try {
      await saveStance(dealId, { leasingCostTreatment: v });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [dealId, saveStance]);

  return { treatment, setTreatment, saving, error };
}
