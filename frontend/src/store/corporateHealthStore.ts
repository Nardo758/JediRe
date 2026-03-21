import { create } from 'zustand';

interface CorporateHealthState {
  health: 'good' | 'warning' | 'critical' | null;
  lastChecked: Date | null;
  checkHealth: () => Promise<void>;
}

export const useCorporateHealthStore = create<CorporateHealthState>((set) => ({
  health: null,
  lastChecked: null,
  checkHealth: async () => {
    set({ health: 'good', lastChecked: new Date() });
  },
}));

export const useCorporateHealth = () => {
  const store = useCorporateHealthStore();
  return {
    health: store.health,
    lastChecked: store.lastChecked,
    checkHealth: store.checkHealth,
    isHealthy: store.health === 'good',
    isWarning: store.health === 'warning',
    isCritical: store.health === 'critical',
  };
};

export default useCorporateHealthStore;
