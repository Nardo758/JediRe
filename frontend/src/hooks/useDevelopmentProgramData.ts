/**
 * useDevelopmentProgramData Hook
 *
 * Fetches real zoning and demand data from M02/M03 (Zoning Agent) and M05/M06 (Market Analysis).
 * Provides fallback defaults if API calls fail.
 */

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

// Default fallback values (same as in DevelopmentProgramBuilder)
const DEFAULT_ZONING = {
  code: "PD-MF", maxDensity: 24, lotAcres: 12.4, maxHeight: 65, stories: 4,
  far: 2.0, lotSF: 540144, setbackSF: 48600, buildableSF: 491544,
  maxUnitsByDensity: 298, maxUnitsByFAR: 312, maxUnitsByHeight: 320,
  bindingConstraint: "density", maxUnits: 298,
  parkingRatio: 1.5, parkingSpaces: 447,
};

const DEFAULT_DEMAND = {
  optimalMix: { studio: 5, "1br": 35, "2br": 45, "3br": 15 },
  avgRents: { studio: 1350, "1br": 1575, "2br": 1925, "3br": 2280 },
  avgSF: { studio: 520, "1br": 750, "2br": 1050, "3br": 1300 },
  rentGrowth: 3.2, vacancy: 5.8, absorption: 18,
  submarketRank: "78th percentile", pipelineRatio: 4.2,
};

export interface ZoningData {
  code: string;
  maxDensity: number;
  lotAcres: number;
  maxHeight: number;
  stories: number;
  far: number;
  lotSF: number;
  setbackSF: number;
  buildableSF: number;
  maxUnitsByDensity: number;
  maxUnitsByFAR: number;
  maxUnitsByHeight: number;
  bindingConstraint: string;
  maxUnits: number;
  parkingRatio: number;
  parkingSpaces: number;
}

export interface DemandData {
  optimalMix: { studio: number; "1br": number; "2br": number; "3br": number };
  avgRents: { studio: number; "1br": number; "2br": number; "3br": number };
  avgSF: { studio: number; "1br": number; "2br": number; "3br": number };
  rentGrowth: number;
  vacancy: number;
  absorption: number;
  submarketRank: string;
  pipelineRatio: number;
}

interface UseDevelopmentProgramDataResult {
  zoning: ZoningData | null;
  demand: DemandData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetch development program data from M02/M03 and M05/M06 APIs
 * @param dealId - Deal ID to fetch data for
 * @param tradeAreaId - Trade area ID for market/demand data
 * @returns { zoning, demand, loading, error, refetch }
 */
export function useDevelopmentProgramData(
  dealId?: string,
  tradeAreaId?: string
): UseDevelopmentProgramDataResult {
  const [zoning, setZoning] = useState<ZoningData | null>(null);
  const [demand, setDemand] = useState<DemandData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!dealId && !tradeAreaId) {
      // No IDs provided, use defaults
      setZoning(DEFAULT_ZONING);
      setDemand(DEFAULT_DEMAND);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch zoning data from M02/M03
      // API endpoint: /api/v1/deals/{dealId}/zoning-output or /api/v1/zoning/{dealId}
      const zoningPromise = dealId
        ? axios
            .get(`/api/v1/deals/${dealId}/zoning-output`)
            .then(res => res.data?.data || DEFAULT_ZONING)
            .catch(() => DEFAULT_ZONING)
        : Promise.resolve(DEFAULT_ZONING);

      // Fetch demand data from M05/M06
      // API endpoint: /api/v1/trade-areas/{tradeAreaId}/market-analysis or /api/v1/deals/{dealId}/demand-signals
      const demandPromise = tradeAreaId || dealId
        ? axios
            .get(`/api/v1/trade-areas/${tradeAreaId}/demand-signals`)
            .then(res => {
              const data = res.data?.data;
              if (!data) return DEFAULT_DEMAND;
              // Map API response to our interface
              return {
                optimalMix: data.optimalMix || DEFAULT_DEMAND.optimalMix,
                avgRents: data.avgRents || DEFAULT_DEMAND.avgRents,
                avgSF: data.avgSF || DEFAULT_DEMAND.avgSF,
                rentGrowth: data.rentGrowth ?? DEFAULT_DEMAND.rentGrowth,
                vacancy: data.vacancy ?? DEFAULT_DEMAND.vacancy,
                absorption: data.absorption ?? DEFAULT_DEMAND.absorption,
                submarketRank: data.submarketRank || DEFAULT_DEMAND.submarketRank,
                pipelineRatio: data.pipelineRatio ?? DEFAULT_DEMAND.pipelineRatio,
              };
            })
            .catch(() =>
              // Fallback to deal-specific demand endpoint
              dealId
                ? axios
                    .get(`/api/v1/deals/${dealId}/demand-signals`)
                    .then(res => res.data?.data || DEFAULT_DEMAND)
                    .catch(() => DEFAULT_DEMAND)
                : Promise.resolve(DEFAULT_DEMAND)
            )
        : Promise.resolve(DEFAULT_DEMAND);

      const [zoningData, demandData] = await Promise.all([zoningPromise, demandPromise]);

      setZoning(zoningData);
      setDemand(demandData);
    } catch (err: any) {
      console.error('Error fetching development program data:', err);
      setError(err.message || 'Failed to fetch development program data');
      // Fallback to defaults even on error
      setZoning(DEFAULT_ZONING);
      setDemand(DEFAULT_DEMAND);
    } finally {
      setLoading(false);
    }
  }, [dealId, tradeAreaId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    zoning: zoning || DEFAULT_ZONING,
    demand: demand || DEFAULT_DEMAND,
    loading,
    error,
    refetch: fetchData,
  };
}

export default useDevelopmentProgramData;
