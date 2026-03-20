import { create } from 'zustand';

interface Agent {
  id: string;
  name: string;
  emoji: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  progress: number; // 0-100
  message?: string;
  startedAt?: Date;
  completedAt?: Date;
}

interface AgentStore {
  agents: Record<string, Agent>;
  
  // Actions
  registerAgent: (agent: Omit<Agent, 'status' | 'progress'>) => void;
  startAgent: (id: string, message?: string) => void;
  updateProgress: (id: string, progress: number, message?: string) => void;
  completeAgent: (id: string, message?: string) => void;
  errorAgent: (id: string, message: string) => void;
  resetAgent: (id: string) => void;
  getAgent: (id: string) => Agent | undefined;
  getRunningAgents: () => Agent[];
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  agents: {},

  registerAgent: (agent) => {
    set((state) => ({
      agents: {
        ...state.agents,
        [agent.id]: {
          ...agent,
          status: 'idle',
          progress: 0,
        },
      },
    }));
  },

  startAgent: (id, message) => {
    set((state) => ({
      agents: {
        ...state.agents,
        [id]: {
          ...state.agents[id],
          status: 'running',
          progress: 0,
          message,
          startedAt: new Date(),
        },
      },
    }));
  },

  updateProgress: (id, progress, message) => {
    set((state) => ({
      agents: {
        ...state.agents,
        [id]: {
          ...state.agents[id],
          progress: Math.min(100, Math.max(0, progress)),
          message: message || state.agents[id].message,
        },
      },
    }));
  },

  completeAgent: (id, message) => {
    set((state) => ({
      agents: {
        ...state.agents,
        [id]: {
          ...state.agents[id],
          status: 'completed',
          progress: 100,
          message,
          completedAt: new Date(),
        },
      },
    }));
  },

  errorAgent: (id, message) => {
    set((state) => ({
      agents: {
        ...state.agents,
        [id]: {
          ...state.agents[id],
          status: 'error',
          message,
          completedAt: new Date(),
        },
      },
    }));
  },

  resetAgent: (id) => {
    set((state) => ({
      agents: {
        ...state.agents,
        [id]: {
          ...state.agents[id],
          status: 'idle',
          progress: 0,
          message: undefined,
          startedAt: undefined,
          completedAt: undefined,
        },
      },
    }));
  },

  getAgent: (id) => {
    return get().agents[id];
  },

  getRunningAgents: () => {
    return Object.values(get().agents).filter((agent) => agent.status === 'running');
  },
}));

// Initialize default agents
const defaultAgents = [
  { id: 'property-search', name: 'Property Search', emoji: '🔍' },
  { id: 'strategy-arbitrage', name: 'Strategy Arbitrage', emoji: '🎯' },
  { id: 'zoning-analysis', name: 'Zoning Analysis', emoji: '📋' },
  { id: 'cash-flow', name: 'Cash Flow', emoji: '💰' },
  { id: 'supply-demand', name: 'Supply/Demand', emoji: '📊' },
];

defaultAgents.forEach((agent) => {
  useAgentStore.getState().registerAgent(agent);
});
