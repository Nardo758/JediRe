/**
 * KGContextPanel — Reusable sidebar/panel that displays knowledge graph context
 * for any deal, market, or zoning code.
 *
 * Props:
 *   dealId?        — Fetches full deal context (similar deals, zoning, market)
 *   msa?           — Fetches market insights (avg envelope, active deals)
 *   jurisdiction? + zoneCode? — Fetches zoning precedents
 *   compact?       — Minimal mode (just summary cards)
 *
 * Self-contained — calls /api/v1/knowledge-graph/context/* directly.
 */

import React, { useState, useEffect } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DealContext {
  dealId: string;
  name: string;
  jurisdiction: string;
  zoneCode: string;
  envelope?: Record<string, any>;
  similarDeals: SimilarDealItem[];
  zoningPrecedents: ZoningPrecedentItem[];
  marketInsights: MarketInsightItem | null;
}

export interface SimilarDealItem {
  dealId: string;
  name: string;
  zoningCode: string;
  envelope: Record<string, any> | null;
  market: string;
  similarity: string;
}

export interface ZoningPrecedentItem {
  zoneCode: string;
  jurisdiction: string;
  dimensional: Record<string, any>;
  parking: Record<string, any>;
  count: number;
}

export interface MarketInsightItem {
  msa: string;
  name: string;
  region: string;
  dealCount: number;
  avgEnvelope: {
    avgUnits: number;
    avgGfaSf: number;
    avgFloors: number;
    avgFAR: number | null;
  } | null;
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface KGContextPanelProps {
  dealId?: string;
  msa?: string;
  jurisdiction?: string;
  zoneCode?: string;
  compact?: boolean;
  className?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const SimilarityBadge: React.FC<{ level: string }> = ({ level }) => {
  const colors: Record<string, string> = {
    exact_zone: 'bg-blue-100 text-blue-700',
    same_jurisdiction: 'bg-green-100 text-green-700',
    same_market: 'bg-yellow-100 text-yellow-700',
    similar_zone: 'bg-purple-100 text-purple-700',
  };
  const labels: Record<string, string> = {
    exact_zone: 'Same zone',
    same_jurisdiction: 'Same city',
    same_market: 'Same market',
    similar_zone: 'Similar zone',
  };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${colors[level] || 'bg-gray-100 text-gray-600'}`}>
      {labels[level] || level}
    </span>
  );
};

const LoadingPulse: React.FC = () => (
  <div className="animate-pulse space-y-2 p-3">
    <div className="h-3 bg-gray-200 rounded w-3/4" />
    <div className="h-3 bg-gray-200 rounded w-1/2" />
    <div className="h-3 bg-gray-200 rounded w-2/3" />
  </div>
);

// ─── Components ─────────────────────────────────────────────────────────────

const SimilarDealsCard: React.FC<{ items: SimilarDealItem[] }> = ({ items }) => {
  if (!items.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <h4 className="text-sm font-semibold text-gray-700 mb-2">Similar Deals</h4>
      <div className="space-y-2">
        {items.slice(0, 5).map((d) => (
          <div key={`${d.dealId}-${d.similarity}`} className="text-xs border-b border-gray-100 pb-1.5 last:border-0">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-gray-900 truncate">{d.name}</span>
              <SimilarityBadge level={d.similarity} />
            </div>
            <div className="text-gray-500 mt-0.5">
              {d.zoningCode} · {d.market}
              {d.envelope?.maxUnits && <span> · {d.envelope.maxUnits} units</span>}
            </div>
          </div>
        ))}
        {items.length > 5 && (
          <div className="text-xs text-gray-400 text-center pt-1">+{items.length - 5} more</div>
        )}
      </div>
    </div>
  );
};

const ZoningPrecedentsCard: React.FC<{ items: ZoningPrecedentItem[] }> = ({ items }) => {
  if (!items.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <h4 className="text-sm font-semibold text-gray-700 mb-2">Zoning Precedents</h4>
      {items.map((z) => (
        <div key={`${z.jurisdiction}-${z.zoneCode}`} className="text-xs space-y-1">
          <div className="text-gray-900 font-medium">{z.zoneCode} · {z.jurisdiction}</div>
          <div className="text-gray-500">
            Max height: {z.dimensional?.maxHeightFt ?? '?'}ft · FAR: {z.dimensional?.maxFAR ?? '?'} · Density: {z.dimensional?.maxDensityUnitsPerAcre ?? '?'} du/ac
          </div>
          {z.count > 0 && <div className="text-gray-400">{z.count} deal{z.count !== 1 ? 's' : ''} using this zone</div>}
        </div>
      ))}
    </div>
  );
};

const MarketInsightsCard: React.FC<{ insight: MarketInsightItem }> = ({ insight }) => {
  if (!insight) return null;
  const env = insight.avgEnvelope;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <h4 className="text-sm font-semibold text-gray-700 mb-2">{insight.name} Market</h4>
      <div className="text-xs space-y-1">
        <div className="flex justify-between text-gray-500">
          <span>Active deals</span>
          <span className="font-medium text-gray-900">{insight.dealCount}</span>
        </div>
        {env && (
          <>
            <div className="flex justify-between text-gray-500">
              <span>Avg units</span>
              <span className="font-medium text-gray-900">{env.avgUnits}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Avg GFA</span>
              <span className="font-medium text-gray-900">{env.avgGfaSf.toLocaleString()} sf</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Avg floors</span>
              <span className="font-medium text-gray-900">{env.avgFloors}</span>
            </div>
            {env.avgFAR && (
              <div className="flex justify-between text-gray-500">
                <span>Avg FAR</span>
                <span className="font-medium text-gray-900">{env.avgFAR}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const EnvelopeSummaryCard: React.FC<{ envelope: Record<string, any> }> = ({ envelope }) => {
  if (!envelope || !envelope.maxUnits) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <h4 className="text-sm font-semibold text-gray-700 mb-2">Your Envelope</h4>
      <div className="text-xs space-y-1">
        <div className="flex justify-between text-gray-500">
          <span>Max units</span>
          <span className="font-medium text-gray-900">{envelope.maxUnits}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Max GFA</span>
          <span className="font-medium text-gray-900">{envelope.maxGfaSf?.toLocaleString()} sf</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Max height</span>
          <span className="font-medium text-gray-900">{envelope.maxHeightFt} ft</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Parking</span>
          <span className="font-medium text-gray-900">{envelope.parkingSpaces} spaces</span>
        </div>
      </div>
    </div>
  );
};

// ─── Main Panel ─────────────────────────────────────────────────────────────

const KGContextPanel: React.FC<KGContextPanelProps> = ({
  dealId,
  msa,
  jurisdiction,
  zoneCode,
  compact,
  className = '',
}) => {
  const [context, setContext] = useState<DealContext | null>(null);
  const [marketInsight, setMarketInsight] = useState<MarketInsightItem | null>(null);
  const [zoningPrecedent, setZoningPrecedent] = useState<ZoningPrecedentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchContext = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem('auth_token');

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        // Fetch deal context if dealId provided
        if (dealId) {
          const res = await fetch(`/api/v1/knowledge-graph/context/deals/${dealId}`, { headers });
          if (res.ok) {
            const data = await res.json();
            if (!cancelled) {
              setContext(data);
              // Also pre-load the market insight from the context
              if (data.marketInsights) setMarketInsight(data.marketInsights);
            }
          } else if (res.status !== 404) {
            const err = await res.json().catch(() => ({ error: 'Failed' }));
            setError(err.error);
          }
        }

        // Fetch market insights if msa provided and not from deal context
        if (msa && !dealId) {
          const res = await fetch(`/api/v1/knowledge-graph/context/markets/${encodeURIComponent(msa)}`, { headers });
          if (res.ok) {
            const data = await res.json();
            if (!cancelled) setMarketInsight(data);
          }
        }

        // Fetch zoning precedents if jurisdiction + zoneCode provided
        if (jurisdiction && zoneCode) {
          const res = await fetch(
            `/api/v1/knowledge-graph/context/zoning/${encodeURIComponent(jurisdiction)}/${encodeURIComponent(zoneCode)}`,
            { headers },
          );
          if (res.ok) {
            const data = await res.json();
            if (!cancelled) setZoningPrecedent(data.precedents || []);
          }
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load context');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchContext();
    return () => { cancelled = true; };
  }, [dealId, msa, jurisdiction, zoneCode]);

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={`rounded-lg border border-gray-100 bg-gray-50 ${className}`}>
        <div className="px-3 py-2 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">KG Context</h3>
        </div>
        <LoadingPulse />
      </div>
    );
  }

  const hasData = context || marketInsight || zoningPrecedent.length > 0;

  if (!hasData) {
    if (error) {
      return (
        <div className={`rounded-lg border border-gray-100 bg-gray-50 p-3 ${className}`}>
          <h3 className="text-sm font-semibold text-gray-500 mb-1">KG Context</h3>
          <p className="text-xs text-gray-400">Could not load context</p>
          {!compact && <p className="text-xs text-gray-400 mt-1">First deal? Make sure zoning and market analysis have been run.</p>}
        </div>
      );
    }
    return <div className={`${className}`} />;
  }

  if (compact) {
    return (
      <div className={`space-y-2 ${className}`}>
        {context?.envelope && <EnvelopeSummaryCard envelope={context.envelope} />}
        {context?.similarDeals && context.similarDeals.length > 0 && (
          <div className="text-xs text-gray-500">
            <span className="font-medium">{context.similarDeals.length}</span> similar deals
          </div>
        )}
        {marketInsight && (
          <div className="text-xs text-gray-500">
            <span className="font-medium">{marketInsight.dealCount}</span> deals in {marketInsight.name}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-gray-100 bg-gray-50 ${className}`}>
      {/* Panel Header */}
      <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          KG Context
        </h3>
        {context?.zoneCode && (
          <span className="text-xs text-gray-400">{context.jurisdiction} · {context.zoneCode}</span>
        )}
      </div>

      {/* Panel Content */}
      <div className="p-2 space-y-2">
        {context?.envelope && <EnvelopeSummaryCard envelope={context.envelope} />}
        {context?.similarDeals && <SimilarDealsCard items={context.similarDeals} />}
        {zoningPrecedent.length > 0 && <ZoningPrecedentsCard items={zoningPrecedent} />}
        {marketInsight && <MarketInsightsCard insight={marketInsight} />}

        {!hasData && !error && (
          <p className="text-xs text-gray-400 text-center py-4">
            No KG data yet. Run zoning and market analysis first.
          </p>
        )}
      </div>
    </div>
  );
};

export default KGContextPanel;
