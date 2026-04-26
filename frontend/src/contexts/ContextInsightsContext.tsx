/**
 * ContextInsightsContext
 * ============================================================================
 * App-wide bus for the neural-network "context analysis" output (data gaps,
 * unanswered questions, suggestions, queued agent tasks).
 *
 * Pages that run a context analysis (TerminalPage F1/F5, NewsIntelligencePage
 * F6, MSA tabs, etc.) publish their latest ContextAnalysis here keyed by a
 * stable `source` id. The Neural Network Hub widget reads from this bus and
 * presents the cumulative insights in one place, so individual pages no
 * longer need their own inline ContextIndicator pill.
 *
 * Design notes:
 * - Insight per source is "last-write-wins" — re-analyzing the same page
 *   replaces its previous entry rather than appending.
 * - `usePublishContextInsight` is a thin convenience hook so call sites stay
 *   one line instead of an effect + dep array.
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { ContextAnalysis } from '../hooks/useContextAwareness';

export interface PublishedInsight {
  source: string;
  label: string;
  analysis: ContextAnalysis;
  updatedAt: number;
}

interface ContextInsightsValue {
  insights: PublishedInsight[];
  pushInsight: (source: string, label: string, analysis: ContextAnalysis | null) => void;
  clearInsight: (source: string) => void;
}

const ContextInsightsContext = createContext<ContextInsightsValue>({
  insights: [],
  pushInsight: () => {},
  clearInsight: () => {},
});

export function ContextInsightsProvider({ children }: { children: React.ReactNode }) {
  const [insightMap, setInsightMap] = useState<Record<string, PublishedInsight>>({});

  const pushInsight = useCallback(
    (source: string, label: string, analysis: ContextAnalysis | null) => {
      if (!analysis) return;
      setInsightMap(prev => {
        const existing = prev[source];
        // Avoid spurious re-renders if the same analysis object is pushed twice.
        if (existing && existing.analysis === analysis && existing.label === label) return prev;
        return {
          ...prev,
          [source]: { source, label, analysis, updatedAt: Date.now() },
        };
      });
    },
    [],
  );

  const clearInsight = useCallback((source: string) => {
    setInsightMap(prev => {
      if (!(source in prev)) return prev;
      const { [source]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const insights = useMemo(
    () => Object.values(insightMap).sort((a, b) => b.updatedAt - a.updatedAt),
    [insightMap],
  );

  const value = useMemo(
    () => ({ insights, pushInsight, clearInsight }),
    [insights, pushInsight, clearInsight],
  );

  return <ContextInsightsContext.Provider value={value}>{children}</ContextInsightsContext.Provider>;
}

export function useContextInsights() {
  return useContext(ContextInsightsContext);
}

/**
 * Convenience: publish a page's latest analysis to the global hub.
 * Call from inside the component body — it sets up the effect for you.
 */
export function usePublishContextInsight(
  source: string,
  label: string,
  analysis: ContextAnalysis | null,
) {
  const { pushInsight } = useContextInsights();
  useEffect(() => {
    if (analysis) pushInsight(source, label, analysis);
  }, [source, label, analysis, pushInsight]);
}
