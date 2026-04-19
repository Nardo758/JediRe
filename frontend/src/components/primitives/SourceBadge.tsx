/**
 * SourceBadge — provenance label for LayeredValue fields
 *
 * Reads the `source` field from a LayeredValue<T> wrapper and renders a compact
 * badge indicating where the data came from. Used alongside form fields and
 * table cells to make data provenance visible at a glance.
 *
 * Sources:
 *   AGENT  — Written by a Layer 1 agent (Research, Zoning, Supply, CashFlow, Commentary)
 *   T12    — Derived from an uploaded T12 document (Tier 1)
 *   RR     — Derived from an uploaded Rent Roll (Tier 1)
 *   TAX    — Derived from an uploaded Tax Bill (Tier 1)
 *   OWNED  — From owned portfolio actuals (Tier 2)
 *   MARKET — From platform market intelligence (Tier 3 comps, forecasts)
 *   BROKER — Broker OM value (Tier 4, lowest authority)
 *   EDITED — User override (always wins in merge order)
 *   (blank)— Platform default / fallback — no badge shown
 */

import React from 'react';
import { BT } from '../deal/bloomberg-ui';

export type LayeredValueSource =
  | 'agent:research'
  | 'agent:zoning'
  | 'agent:supply'
  | 'agent:cashflow'
  | 'agent:commentary'
  | 'tier1:t12'
  | 'tier1:rent_roll'
  | 'tier1:tax_bill'
  | 'tier2:owned_asset'
  | 'tier3:platform'
  | 'tier3:market_comp'
  | 'tier3:jurisdiction'
  | 'tier4:broker'
  | 't12'
  | 'rent_roll'
  | 'tax_bill'
  | 'override'
  | 'platform'
  | 'agent'
  | 'broker'
  | 'user'
  | 'computed';

interface BadgeConfig {
  label: string;
  color: string;
  tooltip: string;
}

const BADGE_CONFIG: Partial<Record<LayeredValueSource | string, BadgeConfig>> = {
  'agent:research':   { label: 'AGENT',  color: BT.accent.agent, tooltip: 'Written by Research Agent' },
  'agent:zoning':     { label: 'AGENT',  color: BT.accent.agent, tooltip: 'Written by Zoning Agent' },
  'agent:supply':     { label: 'AGENT',  color: BT.accent.agent, tooltip: 'Written by Supply Agent' },
  'agent:cashflow':   { label: 'AGENT',  color: BT.accent.agent, tooltip: 'Written by CashFlow Agent' },
  'agent:commentary': { label: 'AGENT',  color: BT.accent.agent, tooltip: 'Written by Commentary Agent' },
  'agent':            { label: 'AGENT',  color: BT.accent.agent, tooltip: 'Written by an agent' },
  // Tier 1 — deal documents
  'tier1:t12':        { label: 'T12',    color: BT.accent.doc,   tooltip: 'Tier 1 · From uploaded T12' },
  'tier1:rent_roll':  { label: 'RR',     color: BT.accent.doc,   tooltip: 'Tier 1 · From uploaded Rent Roll' },
  'tier1:tax_bill':   { label: 'TAX',    color: BT.accent.doc,   tooltip: 'Tier 1 · From uploaded Tax Bill' },
  't12':              { label: 'T12',    color: BT.accent.doc,   tooltip: 'From uploaded T12' },
  'rent_roll':        { label: 'RR',     color: BT.accent.doc,   tooltip: 'From uploaded Rent Roll' },
  'tax_bill':         { label: 'TAX',    color: BT.accent.doc,   tooltip: 'From uploaded Tax Bill' },
  // Tier 2 — owned portfolio actuals
  'tier2:owned_asset': { label: 'OWNED', color: '#60A5FA',       tooltip: 'Tier 2 · Owned portfolio actuals' },
  // Tier 3 — platform market intelligence
  'tier3:platform':   { label: 'MARKET', color: BT.text.purple,  tooltip: 'Tier 3 · Platform market intelligence' },
  'tier3:market_comp':{ label: 'MARKET', color: BT.text.purple,  tooltip: 'Tier 3 · Market comp data' },
  'tier3:jurisdiction':{ label: 'MARKET',color: BT.text.purple,  tooltip: 'Tier 3 · Jurisdiction forecast' },
  // Tier 4 — broker OM (low authority)
  'tier4:broker':     { label: 'BROKER', color: BT.text.orange,  tooltip: 'Tier 4 · Broker OM (unverified)' },
  'broker':           { label: 'BROKER', color: BT.text.orange,  tooltip: 'Broker OM value (unverified)' },
  // User overrides
  'override':         { label: 'EDITED', color: BT.accent.user,  tooltip: 'User override — highest priority' },
  'user':             { label: 'EDITED', color: BT.accent.user,  tooltip: 'User override' },
  // Silent — no badge
  'platform':         undefined,
  'computed':         undefined,
};

interface SourceBadgeProps {
  source: LayeredValueSource | string;
  agentRunId?: string;
  agentId?: string;
  runAt?: string;
  style?: React.CSSProperties;
}

export function SourceBadge({ source, agentRunId, agentId, runAt, style }: SourceBadgeProps) {
  const config = BADGE_CONFIG[source as LayeredValueSource];
  if (!config) return null;

  let tooltip = config.tooltip;
  if (agentId) tooltip += ` (${agentId})`;
  if (runAt) tooltip += ` at ${new Date(runAt).toLocaleString()}`;
  if (agentRunId) tooltip += ` · run ${agentRunId.slice(0, 8)}`;

  return (
    <span
      title={tooltip}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0 3px',
        fontFamily: BT.font.mono,
        fontSize: '7px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        color: config.color,
        background: `${config.color}18`,
        border: `1px solid ${config.color}44`,
        borderRadius: 2,
        lineHeight: '12px',
        height: 12,
        flexShrink: 0,
        cursor: agentRunId ? 'help' : 'default',
        userSelect: 'none',
        ...style,
      }}
    >
      {config.label}
    </span>
  );
}

interface SourceBadgeInlineProps extends SourceBadgeProps {
  children?: React.ReactNode;
}

/**
 * Wraps content inline with a SourceBadge to the right.
 * Use inside table cells or form field labels.
 */
export function SourceBadgeInline({ children, ...badgeProps }: SourceBadgeInlineProps) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {children}
      <SourceBadge {...badgeProps} />
    </span>
  );
}

/** Confidence badge — shown alongside evidence tier labels. */
export function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const color =
    confidence === 'high' ? BT.text.green :
    confidence === 'medium' ? BT.text.amber :
    BT.text.red;
  return (
    <span
      title={`Evidence confidence: ${confidence}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0 3px',
        fontFamily: BT.font.mono,
        fontSize: '7px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        color,
        background: `${color}18`,
        border: `1px solid ${color}44`,
        borderRadius: 2,
        lineHeight: '12px',
        height: 12,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {confidence.toUpperCase()}
    </span>
  );
}
