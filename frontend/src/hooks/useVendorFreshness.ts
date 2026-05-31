/**
 * useVendorFreshness — Phase 2C
 *
 * Fetches and caches the freshness state of all registered vendors' data for
 * a deal. Used by the VendorFreshnessPrompt component and F-key freshness
 * indicators.
 *
 * Returns null while loading, the freshness result on success, or null on error
 * (errors are logged but do not surface to the user — freshness is advisory).
 *
 * triggerRefresh(vendorId) calls POST /api/v1/deals/:dealId/vendor-refresh,
 * then re-polls the freshness endpoint so the banner disappears automatically
 * when the re-import completes.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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

export type RefreshState = 'idle' | 'loading' | 'success' | 'no_files' | 'error';

interface UseVendorFreshnessReturn {
  freshness:      DealVendorFreshnessResult | null;
  isLoading:      boolean;
  /** Stale vendor states only (status === 'stale'). */
  staleVendors:   VendorFreshnessState[];
  refetch:        () => void;
  /** Fire a re-import for a specific vendor and re-poll on completion. */
  triggerRefresh: (vendorId: string) => Promise<void>;
  /** Per-vendor refresh state keyed by vendorId. */
  refreshStates:  Record<string, RefreshState>;
}

/** How long (ms) to keep polling after a successful refresh enqueue. */
const POLL_DURATION_MS = 30_000;
const POLL_INTERVAL_MS = 3_000;

export function useVendorFreshness(dealId: string | undefined | null): UseVendorFreshnessReturn {
  const [freshness, setFreshness]       = useState<DealVendorFreshnessResult | null>(null);
  const [isLoading, setIsLoading]       = useState(false);
  const [refreshStates, setRefreshStates] = useState<Record<string, RefreshState>>({});

  const pollTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollDeadline  = useRef<number>(0);

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

  // Stop any active poll when unmounted or dealId changes
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [dealId]);

  const startPolling = useCallback((vendorId: string) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollDeadline.current = Date.now() + POLL_DURATION_MS;

    pollTimerRef.current = setInterval(async () => {
      if (Date.now() >= pollDeadline.current) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        setRefreshStates(prev => ({ ...prev, [vendorId]: 'idle' }));
        return;
      }
      try {
        const resp = await apiClient.get<DealVendorFreshnessResult>(
          `/api/v1/deals/${dealId}/vendor-freshness`,
        );
        setFreshness(resp.data);
        const vendor = resp.data.vendors.find(v => v.vendorId === vendorId);
        if (vendor && vendor.freshnessStatus !== 'stale') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setRefreshStates(prev => ({ ...prev, [vendorId]: 'idle' }));
        }
      } catch {
        // silent
      }
    }, POLL_INTERVAL_MS);
  }, [dealId]);

  const triggerRefresh = useCallback(async (vendorId: string) => {
    if (!dealId) return;
    setRefreshStates(prev => ({ ...prev, [vendorId]: 'loading' }));

    try {
      await apiClient.post(`/api/v1/deals/${dealId}/vendor-refresh`, { vendorId });
      setRefreshStates(prev => ({ ...prev, [vendorId]: 'success' }));
      startPolling(vendorId);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) {
        setRefreshStates(prev => ({ ...prev, [vendorId]: 'no_files' }));
      } else if (status === 409) {
        // Already running — poll anyway so the banner updates when done
        setRefreshStates(prev => ({ ...prev, [vendorId]: 'success' }));
        startPolling(vendorId);
      } else {
        setRefreshStates(prev => ({ ...prev, [vendorId]: 'error' }));
      }
    }
  }, [dealId, startPolling]);

  const staleVendors = freshness?.vendors.filter(v => v.freshnessStatus === 'stale') ?? [];

  return { freshness, isLoading, staleVendors, refetch: fetchFreshness, triggerRefresh, refreshStates };
}
