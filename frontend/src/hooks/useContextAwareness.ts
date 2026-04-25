/**
 * Context Awareness Hooks
 * 
 * Connects the frontend to the neural network's "analyst brain"
 * 
 * When the UI shows data, these hooks:
 * 1. Analyze what the user is looking at
 * 2. Identify gaps in the data
 * 3. Fetch expanded details on demand
 * 4. Trigger research agents to fill gaps
 */

import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';

// ============================================================================
// TYPES
// ============================================================================

export type UIContext = 
  | 'deal_overview'
  | 'market_dashboard'
  | 'submarket_deep_dive'
  | 'property_card'
  | 'comp_analysis'
  | 'supply_pipeline'
  | 'rent_trends'
  | 'cap_rates'
  | 'employer_intel'
  | 'traffic_analysis'
  | 'proforma_review';

export interface UserFocus {
  context: UIContext;
  dealId?: string;
  propertyId?: string;
  marketId?: string;
  submarketId?: string;
  focusedMetric?: string;
  focusedValue?: any;
  timeHorizon?: 'current' | '1yr' | '3yr' | '5yr' | '10yr';
  userRole?: 'acquisitions' | 'asset_manager' | 'investor' | 'lender' | 'analyst';
}

export interface DataGap {
  id: string;
  type: 'missing' | 'stale' | 'incomplete' | 'needs_enrichment';
  entity: string;
  missingFields: string[];
  relevance: 'critical' | 'important' | 'nice_to_have';
  userQuestion: string;
  analystThought: string;
  suggestedAction: string;
  suggestedAgent?: string;
  priority: number;
}

export interface ImmediateQuestion {
  question: string;
  dataNeeded: string[];
  available: boolean;
  source?: string;
  value?: any;
}

export interface Suggestion {
  type: 'drill_down' | 'compare' | 'forecast' | 'alert';
  title: string;
  description: string;
  action: string;
  data?: any;
}

export interface AgentTask {
  agentType: string;
  task: string;
  priority: 'immediate' | 'background' | 'scheduled';
  context: Record<string, any>;
}

export interface ContextAnalysis {
  focus: UserFocus;
  immediateQuestions: ImmediateQuestion[];
  gaps: DataGap[];
  suggestions: Suggestion[];
  agentTasks: AgentTask[];
  summary: {
    unansweredQuestions: number;
    criticalGaps: number;
    suggestionsCount: number;
    pendingAgentTasks: number;
  };
}

export interface DevelopmentProject {
  id: string;
  name: string;
  address: string;
  submarket: string;
  units: number;
  stories?: number;
  assetClass?: string;
  developer?: string;
  deliveryDate?: string;
  deliveryQuarter?: string;
  constructionStatus: 'planned' | 'permitted' | 'under_construction' | 'lease_up';
  targetRents?: number;
  preLeasingPct?: number;
  permitDate?: string;
  dataSource: string;
  dataFreshness: 'fresh' | 'stale' | 'expired';
  gaps: string[];
}

export interface SupplyPipelineData {
  totalUnits: number;
  projects: DevelopmentProject[];
  bySubmarket: Record<string, { units: number; projects: number }>;
  byQuarter: Record<string, { units: number; projects: number }>;
  byDeveloper: Record<string, { units: number; projects: number }>;
  byClass: Record<string, { units: number; projects: number }>;
  gaps: DataGap[];
  summary: {
    totalUnits: number;
    projectCount: number;
    submarketCount: number;
    dataGaps: number;
    topSubmarkets: Array<{ name: string; units: number; projects: number }>;
    topDevelopers: Array<{ name: string; units: number; projects: number }>;
    deliveryTimeline: Array<{ quarter: string; units: number; projects: number }>;
  };
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Analyze the current UI context
 * Returns immediate questions, gaps, suggestions, and agent tasks
 */
export function useContextAnalysis() {
  const [analysis, setAnalysis] = useState<ContextAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (focus: UserFocus): Promise<ContextAnalysis | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await api.post('/context/analyze', focus);
      if (res.data.success) {
        setAnalysis(res.data);
        return res.data;
      } else {
        setError(res.data.error || 'Analysis failed');
        return null;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to analyze context');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
    setError(null);
  }, []);

  return { analysis, loading, error, analyze, clearAnalysis };
}

/**
 * Expand supply pipeline details
 * Called when user clicks on "X units under construction"
 */
export function useSupplyExpansion(marketId: string) {
  const [data, setData] = useState<SupplyPipelineData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expand = useCallback(async (submarketId?: string): Promise<SupplyPipelineData | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const params = submarketId ? `?submarketId=${submarketId}` : '';
      const res = await api.get(`/context/supply-pipeline/${marketId}${params}`);
      
      if (res.data.success) {
        setData(res.data);
        return res.data;
      } else {
        setError(res.data.error || 'Failed to expand pipeline');
        return null;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch supply pipeline');
      return null;
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  const clear = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { data, loading, error, expand, clear };
}

/**
 * Get data gaps for current context
 */
export function useDataGaps() {
  const [gaps, setGaps] = useState<DataGap[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGaps = useCallback(async (focus: UserFocus) => {
    setLoading(true);
    
    try {
      const res = await api.post('/context/gaps', focus);
      if (res.data.success) {
        setGaps(res.data.gaps || []);
      }
    } catch (err) {
      console.error('Failed to fetch gaps:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerResearch = useCallback(async (gapsToFill: DataGap[], priority: 'immediate' | 'background' = 'background') => {
    try {
      const res = await api.post('/context/trigger-research', { 
        gaps: gapsToFill, 
        priority 
      });
      return res.data;
    } catch (err) {
      console.error('Failed to trigger research:', err);
      return null;
    }
  }, []);

  return { gaps, loading, fetchGaps, triggerResearch };
}

/**
 * Run what-if scenario analysis
 */
export function useWhatIfAnalysis() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runScenario = useCallback(async (params: {
    dealId: string;
    scenario: string;
    magnitude?: string;
    timeframe?: string;
  }) => {
    setLoading(true);
    
    try {
      const res = await api.post('/context/what-if', params);
      if (res.data.success) {
        setResult(res.data);
        return res.data;
      }
    } catch (err) {
      console.error('Failed to run scenario:', err);
    } finally {
      setLoading(false);
    }
    
    return null;
  }, []);

  return { result, loading, runScenario };
}

/**
 * Auto-analyze on focus change
 * Use this to automatically analyze context when user navigates
 */
export function useAutoContextAnalysis(focus: UserFocus | null, enabled = true) {
  const { analysis, loading, analyze } = useContextAnalysis();

  useEffect(() => {
    if (enabled && focus && focus.context) {
      analyze(focus);
    }
  }, [enabled, focus?.context, focus?.marketId, focus?.submarketId, focus?.focusedMetric]);

  return { analysis, loading };
}

/**
 * Knowledge Graph search
 */
export function useGraphSearch() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (query: string, nodeTypes?: string[]) => {
    setLoading(true);
    
    try {
      const res = await api.post('/knowledge-graph/search', {
        query,
        nodeTypes,
        limit: 20
      });
      
      if (res.data.success) {
        setResults(res.data.results || []);
        return res.data.results;
      }
    } catch (err) {
      console.error('Failed to search graph:', err);
    } finally {
      setLoading(false);
    }
    
    return [];
  }, []);

  return { results, loading, search };
}

/**
 * Impact analysis (blast radius)
 */
export function useImpactAnalysis() {
  const [impact, setImpact] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const analyzeImpact = useCallback(async (nodeId: string, maxDepth = 3) => {
    setLoading(true);
    
    try {
      const res = await api.get(`/knowledge-graph/impact/${nodeId}?maxDepth=${maxDepth}`);
      
      if (res.data.success) {
        setImpact(res.data.impact);
        return res.data.impact;
      }
    } catch (err) {
      console.error('Failed to analyze impact:', err);
    } finally {
      setLoading(false);
    }
    
    return null;
  }, []);

  return { impact, loading, analyzeImpact };
}
