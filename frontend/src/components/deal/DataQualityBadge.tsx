/**
 * DataQualityBadge — F9 Pro Forma Tier-2 (Spec §12).
 *
 * Renders a tiny inline badge next to a cell value showing whether the number
 * is ACTUAL (no badge — clean) / INFERRED ("library") / ESTIMATED ("est") /
 * DEFAULT ("default"). Tooltip exposes the fill method when available.
 */

import React from 'react';
import { deriveLayeredDataQuality, type DataQuality, type LayeredValue } from '../../stores/dealContext.types';

interface Props {
  value?: LayeredValue<unknown> | null;
  /** Override the derived quality (e.g., when caller has its own signal). */
  quality?: DataQuality;
  /** Override the tooltip / fill method. */
  fillMethod?: string;
}

const STYLES: Record<DataQuality, { bg: string; fg: string; label: string }> = {
  ACTUAL:    { bg: 'transparent', fg: 'transparent', label: '' },
  INFERRED:  { bg: '#dbeafe', fg: '#1e40af', label: 'library' },
  ESTIMATED: { bg: '#fef3c7', fg: '#92400e', label: 'est' },
  DEFAULT:   { bg: '#fed7aa', fg: '#9a3412', label: 'default' },
};

export function DataQualityBadge({ value, quality, fillMethod }: Props) {
  const dq: DataQuality = quality ?? value?.dataQuality ?? (value ? deriveLayeredDataQuality(value.source) : 'DEFAULT');
  if (dq === 'ACTUAL') return null;

  const s = STYLES[dq];
  const tip = fillMethod ?? value?.fillMethod ?? `${dq.toLowerCase()} value`;

  return (
    <span
      title={tip}
      style={{
        display: 'inline-block',
        marginLeft: 6,
        padding: '1px 5px',
        fontSize: 9,
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        fontWeight: 600,
        color: s.fg,
        background: s.bg,
        borderRadius: 3,
        verticalAlign: 'middle',
        textTransform: 'lowercase',
      }}
    >
      {s.label}
    </span>
  );
}
