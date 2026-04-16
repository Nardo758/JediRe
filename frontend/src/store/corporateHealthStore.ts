import { create } from 'zustand';

interface CorporateHealthState {
  health: 'good' | 'warning' | 'critical' | null;
  lastChecked: Date | null;
  checkHealth: () => Promise<void>;
  fetchSubmarketHealth: (submarketId: number) => Promise<void>;
}

export const useCorporateHealthStore = create<CorporateHealthState>((set) => ({
  health: null,
  lastChecked: null,
  checkHealth: async () => {
    set({ health: 'good', lastChecked: new Date() });
  },
  fetchSubmarketHealth: async (_submarketId: number) => {
    // no-op stub — data is fetched directly in TerminalPage
  },
}));

export const useCorporateHealth = () => {
  const store = useCorporateHealthStore();
  return {
    health: store.health,
    lastChecked: store.lastChecked,
    checkHealth: store.checkHealth,
    fetchSubmarketHealth: store.fetchSubmarketHealth,
    isHealthy: store.health === 'good',
    isWarning: store.health === 'warning',
    isCritical: store.health === 'critical',
  };
};

export default useCorporateHealthStore;
