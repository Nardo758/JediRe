/**
 * SourceBadge — provenance label for LayeredValue fields
 *
 * Reads the `source` field from a LayeredValue<T> wrapper and renders a compact
 * badge indicating where the data came from. Used alongside form fields and
 * table cells to make data provenance visible at a glance.
 *
 * Sources:
 *   AGENT  — Written by a Layer 1 agent (Research, Zoning, Supply, CashFlow, Commentary)
 *   T12    — Derived from an uploaded T12 document
 *   RR     — Derived from an uploaded Rent Roll
 *   TAX    — Derived from an uploaded Tax Bill
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

const BADGE_CONFIG: Partial<Record<LayeredValueSource, BadgeConfig>> = {
  'agent:research':  { label: 'AGENT', color: BT.accent.agent, tooltip: 'Written by Research Agent' },
  'agent:zoning':    { label: 'AGENT', color: BT.accent.agent, tooltip: 'Written by Zoning Agent' },
  'agent:supply':    { label: 'AGENT', color: BT.accent.agent, tooltip: 'Written by Supply Agent' },
  'agent:cashflow':  { label: 'AGENT', color: BT.accent.agent, tooltip: 'Written by CashFlow Agent' },
  'agent:commentary':{ label: 'AGENT', color: BT.accent.agent, tooltip: 'Written by Commentary Agent' },
  'agent':           { label: 'AGENT', color: BT.accent.agent, tooltip: 'Written by an agent' },
  't12':             { label: 'T12',   color: BT.accent.doc,   tooltip: 'From uploaded T12' },
  'rent_roll':       { label: 'RR',    color: BT.accent.doc,   tooltip: 'From uploaded Rent Roll' },
  'tax_bill':        { label: 'TAX',   color: BT.accent.doc,   tooltip: 'From uploaded Tax Bill' },
  'override':        { label: 'EDITED',color: BT.accent.user,  tooltip: 'User override — highest priority' },
  'user':            { label: 'EDITED',color: BT.accent.user,  tooltip: 'User override' },
  'platform':        undefined,
  'broker':          undefined,
  'computed':        undefined,
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
