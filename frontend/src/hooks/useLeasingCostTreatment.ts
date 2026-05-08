/**
 * useLeasingCostTreatment — shared accessor + write hook for leasingCostTreatment.
 *
 * Canonical storage: deals.deal_data.leasing_cost_treatment (JSONB).
 * Canonical write surface: PATCH /api/v1/deals/:id/context
 *
 * Migration to operator_stance is out of scope until a future task.
 * All consumers that need to SET the treatment import from this hook so the
 * write path is never duplicated across tabs.
 *
 * After a successful save, `onSaved` is called so the parent (FinancialEnginePage)
 * can update its lvCostTreatmentView state + emit the leasing_cost_treatment.changed
 * DOM event that triggers the F9 re-fetch.
 */

import { useState, useCallback } from 'react';
import { apiClient } from '../services/api.client';
import type { LeasingCostTreatment } from '../pages/development/financial-engine/types';

export function useLeasingCostTreatment(
  dealId: string | undefined,
  current: LeasingCostTreatment,
  onSaved: (v: LeasingCostTreatment) => void,
): {
  treatment: LeasingCostTreatment;
  setTreatment: (v: LeasingCostTreatment) => Promise<void>;
  saving: boolean;
  error: string | null;
} {
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const setTreatment = useCallback(async (v: LeasingCostTreatment) => {
    if (!dealId) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.patch(`/api/v1/deals/${dealId}/context`, {
        leasing_cost_treatment: v,
      });
      onSaved(v);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [dealId, onSaved]);

  return { treatment: current, setTreatment, saving, error };
}
