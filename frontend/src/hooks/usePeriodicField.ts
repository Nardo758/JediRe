import { useMemo } from 'react';
import { usePeriodicData } from './usePeriodicData';
import type { PeriodicPeriod } from '../components/periodic/PeriodicGrid.types';

interface UsePeriodicFieldOptions {
  dealId: string | null | undefined;
  field: string;
  /** Which zone to prefer when picking a single value. Default: 'projection' */
  preferZone?: 'actual' | 'gap' | 'projection' | 'override' | 'computed';
  /** Which month to pick (YYYY-MM). If omitted, picks first period matching preferZone. */
  month?: string;
}

interface UsePeriodicFieldReturn {
  value: number | null;
  period: PeriodicPeriod | null;
  series: PeriodicPeriod[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Extract a single field's value from the periodic API.
 *
 * Replaces inline `[0]` flattens with a zone-aware selector.
 * Use this for input flattens (e.g., goal-seek parameters, projection scalars).
 *
 * @example
 *   const { value: y1Noi } = usePeriodicField({ dealId, field: 'noi' });
 *   // Returns the first projection-period NOI value, or null if no periodic seed.
 *
 * @example
 *   const { value: latestActual } = usePeriodicField({ dealId, field: 'noi', preferZone: 'actual' });
 *   // Returns the latest actual-month NOI value.
 */
export function usePeriodicField(options: UsePeriodicFieldOptions): UsePeriodicFieldReturn {
  const { dealId, field, preferZone = 'projection', month } = options;
  const { singleField, loading, error, refetch } = usePeriodicData({ dealId, field });

  const series = useMemo(() => singleField?.series ?? [], [singleField]);

  const selected = useMemo(() => {
    if (!series.length) return null;

    if (month) {
      return series.find(p => p.month === month) ?? null;
    }

    // Prefer the requested zone; fall back to first non-null resolved
    const byZone = series.find(p => p.zone === preferZone && p.resolved != null);
    if (byZone) return byZone;

    const firstResolved = series.find(p => p.resolved != null);
    return firstResolved ?? series[0] ?? null;
  }, [series, preferZone, month]);

  return {
    value: selected?.resolved ?? null,
    period: selected,
    series,
    loading,
    error,
    refetch,
  };
}
