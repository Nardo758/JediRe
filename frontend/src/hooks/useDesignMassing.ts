/**
 * useDesignMassing — Hook for F7 AI Generate button.
 *
 * Calls POST /api/v1/design/generate-massing with program targets + zoning envelope.
 * Returns building sections ready to load into Building3DEditor.
 */

import { useState, useCallback } from 'react';
import { apiClient } from '../services/api.client';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MassingSection {
  id: string;
  name: string;
  width: number;
  depth: number;
  floors: number;
  totalStories: number;
  position: { x: number; y: number };
  rotation: number;
  units: {
    studio: number;
    oneBed: number;
    twoBed: number;
    threeBed: number;
    total: number;
  };
  avgUnitSize: number;
  floorPlateSf: number;
  hasRetail: boolean;
  retailSf: number;
}

export interface MassingTotals {
  totalGFA: number;
  totalUnits: number;
  totalFloors: number;
  averageFloors: number;
  far: number;
  buildingFootprintSf: number;
  lotCoverage: number;
  parkingSpaces: number;
  parkingLevels: number;
}

export interface MassingResult {
  success: boolean;
  sections: MassingSection[];
  totals: MassingTotals;
  rationale: string;
  warnings: string[];
}

interface GenerateMassingInput {
  lotSqft: number;
  maxGfaSqft?: number;
  maxStories?: number;
  maxFootprintSqft?: number;
  buildableLotSqft?: number;
  far?: number;
  maxHeightFt?: number;
  targetUnits: number;
  targetGfa: number;
  unitMix?: { studio: number; oneBed: number; twoBed: number; threeBed: number };
  parkingRatio?: number;
  parkingStructure?: 'surface' | 'podium' | 'underground' | 'garage';
  designPriority?: 'density' | 'unit_mix' | 'open_space' | 'parking';
  formFactor?: 'auto' | 'bar' | 'l_shape' | 'u_shape' | 'courtyard' | 'point_tower';
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useDesignMassing() {
  const [result, setResult] = useState<MassingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (input: GenerateMassingInput) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload: Record<string, any> = {
        lot_sqft: input.lotSqft,
        target_units: input.targetUnits,
        target_gfa: input.targetGfa,
        parking_ratio: input.parkingRatio ?? 1.5,
        parking_structure: input.parkingStructure ?? 'podium',
        design_priority: input.designPriority ?? 'density',
        form_factor: input.formFactor ?? 'auto',
      };

      if (input.maxGfaSqft) payload.max_gfa_sqft = input.maxGfaSqft;
      if (input.maxStories) payload.max_stories = input.maxStories;
      if (input.maxFootprintSqft) payload.max_footprint_sqft = input.maxFootprintSqft;
      if (input.buildableLotSqft) payload.buildable_lot_sqft = input.buildableLotSqft;
      if (input.far) {
        payload.far = input.far;
        if (input.maxHeightFt) payload.max_height_ft = input.maxHeightFt;
      }
      if (input.unitMix) {
        payload.unit_mix_studio = input.unitMix.studio;
        payload.unit_mix_one_bed = input.unitMix.oneBed;
        payload.unit_mix_two_bed = input.unitMix.twoBed;
        payload.unit_mix_three_bed = input.unitMix.threeBed;
      }

      const res = await apiClient.post('/api/v1/design/generate-massing', payload);
      setResult(res.data);
      return res.data;
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || 'Failed to generate massing';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setLoading(false);
  }, []);

  return { generate, result, loading, error, reset };
}
