/**
 * PropertyMarketIntelligencePanel
 *
 * Reuses the MSA / Submarket Commentary trio (Refresh Intelligence button +
 * Broker Narratives feed + Replacement Cost panel) on Property and Deal
 * terminal pages.
 *
 * Backend endpoints only accept entityType="msa" | "submarket" (Task #383),
 * so this wrapper derives the property's submarket (preferred) or MSA from
 * the deal/property record and scopes all three panels to it. No new API
 * is required.
 *
 * Renders nothing when neither submarket nor MSA can be resolved — never
 * silently falls back to a hardcoded market.
 */

import React, { useState } from 'react';
import { BT } from '../theme';
import { BrokerNarrativesFeed } from './BrokerNarrativesFeed';
import { ReplacementCostPanel } from './ReplacementCostPanel';
import { RefreshIntelligenceButton } from './RefreshIntelligenceButton';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

interface PropertyMarketIntelligencePanelProps {
  /** Deal or property record. We probe a handful of shapes used across the app. */
  deal?: Record<string, any> | null;
  /** Optional layout override — defaults to side-by-side row on wide containers. */
  layout?: 'row' | 'stack';
}

interface ResolvedMarket {
  entityType: 'submarket' | 'msa';
  entityId: string;
  label: string;
}

/**
 * Derive the canonical submarket / MSA entity from whatever shape the caller
 * passes. Prefer submarket (tighter scope, richer OM matches); fall back to
 * MSA, then city. Returns null when nothing is resolvable — the caller will
 * render an inline "no market scope" notice.
 */
function resolveMarket(deal: Record<string, any> | null | undefined): ResolvedMarket | null {
  if (!deal) return null;
  const property = deal.properties?.[0] || deal.property || {};

  const submarket =
    deal.submarket ?? property.submarket ?? deal.marketContext?.submarket ?? null;
  if (submarket && String(submarket).trim()) {
    return { entityType: 'submarket', entityId: String(submarket).trim(), label: String(submarket).trim() };
  }

  const msa = deal.msa ?? deal.msaId ?? property.msa ?? deal.marketContext?.msa ?? null;
  if (msa && String(msa).trim()) {
    return { entityType: 'msa', entityId: String(msa).trim(), label: String(msa).trim() };
  }

  const city = deal.city ?? property.city ?? deal.marketContext?.city ?? null;
  if (city && String(city).trim()) {
    return { entityType: 'msa', entityId: String(city).trim().toLowerCase(), label: String(city).trim() };
  }

  return null;
}

export const PropertyMarketIntelligencePanel: React.FC<PropertyMarketIntelligencePanelProps> = ({
  deal,
  layout = 'row',
}) => {
  const market = resolveMarket(deal);
  // Bumped by the Refresh button (queue + completion) so broker narratives +
  // replacement cost panels re-fetch in lockstep with the agent run, matching
  // the MSA / Submarket Commentary tab behaviour.
  const [refreshNonce, setRefreshNonce] = useState<number>(0);

  if (!market) {
    return (
      <div style={{
        padding: '10px 12px',
        border: `1px dashed ${BT.border.subtle}`,
        borderRadius: 4,
        background: BT.bg.panel,
        fontSize: 11,
        color: BT.text.muted,
        ...mono,
      }}>
        BROKER OM INTELLIGENCE · No submarket or MSA is set on this property — assign one to surface
        broker narratives and replacement-cost benchmarks.
      </div>
    );
  }

  const isRow = layout === 'row';

  return (
    <div style={{
      border: `1px solid ${BT.border.subtle}`,
      borderRadius: 4,
      background: BT.bg.panel,
      padding: 12,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        gap: 12,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            color: BT.text.amber,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            ...mono,
          }}>
            Broker OM Intelligence
          </div>
          <div style={{ fontSize: 10, color: BT.text.muted, ...mono, marginTop: 2 }}>
            Scoped to {market.entityType.toUpperCase()} · {market.label}
          </div>
        </div>
        <div style={{ width: 220, flexShrink: 0 }}>
          <RefreshIntelligenceButton
            entityType={market.entityType}
            entityId={market.entityId}
            onQueued={() => setRefreshNonce(n => n + 1)}
            onCompleted={() => setRefreshNonce(n => n + 1)}
          />
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isRow ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)',
        gap: 12,
        alignItems: 'start',
      }}>
        <BrokerNarrativesFeed
          entityType={market.entityType}
          entityId={market.entityId}
          refreshNonce={refreshNonce}
        />
        <ReplacementCostPanel
          entityType={market.entityType}
          entityId={market.entityId}
          refreshNonce={refreshNonce}
        />
      </div>
    </div>
  );
};

export default PropertyMarketIntelligencePanel;
