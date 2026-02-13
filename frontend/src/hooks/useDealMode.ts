import { Deal } from '../types/deal';

export type DealMode = 'acquisition' | 'performance';

export interface DealModeResult {
  mode: DealMode;
  isPipeline: boolean;
  isOwned: boolean;
}

export const useDealMode = (deal: Deal): DealModeResult => {
  const isPortfolio = deal.dealCategory === 'portfolio' || deal.state === 'POST_CLOSE';
  const mode: DealMode = isPortfolio ? 'performance' : 'acquisition';
  
  return {
    mode,
    isPipeline: !isPortfolio,
    isOwned: isPortfolio
  };
};
