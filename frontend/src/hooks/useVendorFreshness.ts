/**
 * useVendorFreshness — Phase 2C
 *
 * Fetches and caches the freshness state of all registered vendors' data for
 * a deal. Used by the VendorFreshnessPrompt component and F-key freshness
 * indicators.
 *
 * Returns null while loading, the freshness result on success, or null on error
 * (errors are logged but do not surface to the user — freshness is advisory).
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api.client';

export type FreshnessStatus = 'fresh' | 'aging' | 'stale' | 'no_data';

export interface VendorFreshnessState {
  vendorId:         string;
  displayName:      string;
  licensePosture:   'restricted' | 'platform_only' | 'open';
  freshnessStatus:  FreshnessStatus;
  mostRecentAsOf:   string | null;
  daysSinceAsOf:    number | null;
  staleDays:        number;
  rowCount:         number;
  promptThreshold:  number;
}

export interface DealVendorFreshnessResult {
  dealId:         string;
  vendors:        VendorFreshnessState[];
  hasAnyData:     boolean;
  hasStaleData:   boolean;
  hasMissingData: boolean;
  computedAt:     string;
}

interface UseVendorFreshnessReturn {
  freshness:    DealVendorFreshnessResult | null;
  isLoading:    boolean;
  /** Stale vendor states only (status === 'stale'). */
  staleVendors: VendorFreshnessState[];
  refetch:      () => void;
}

export function useVendorFreshness(dealId: string | undefined | null): UseVendorFreshnessReturn {
  const [freshness, setFreshness] = useState<DealVendorFreshnessResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchFreshness = useCallback(async () => {
    if (!dealId) return;
    setIsLoading(true);
    try {
      const resp = await apiClient.get<DealVendorFreshnessResult>(
        `/api/v1/deals/${dealId}/vendor-freshness`,
      );
      setFreshness(resp.data);
    } catch {
      // Non-fatal — freshness is advisory; don't surface errors to users
    } finally {
      setIsLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    fetchFreshness();
  }, [fetchFreshness]);

  const staleVendors = freshness?.vendors.filter(v => v.freshnessStatus === 'stale') ?? [];

  return { freshness, isLoading, staleVendors, refetch: fetchFreshness };
}
