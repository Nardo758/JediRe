/**
 * useDealMode Hook
 * Detects and returns the current deal mode based on deal status
 */

import { Deal } from '../types/deal';

export type DealMode = 'acquisition' | 'performance';

export interface DealModeResult {
  mode: DealMode;
  isPipeline: boolean;
  isOwned: boolean;
}

/**
 * Determines the deal mode based on status
 * - pipeline status → Acquisition mode
 * - owned status → Performance mode
 */
export const useDealMode = (deal: Deal): DealModeResult => {
  const mode: DealMode = (deal.status === 'owned' || deal.status === 'closed_won') ? 'performance' : 'acquisition';
  
  return {
    mode,
    isPipeline: mode === 'acquisition',
    isOwned: mode === 'performance'
  };
};
