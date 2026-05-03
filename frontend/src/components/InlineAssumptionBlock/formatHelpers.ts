import type { FieldFormat } from './types';

export function formatValue(value: number | null, format: FieldFormat): string {
  if (value == null || isNaN(value)) return '—';
  switch (format) {
    case 'pct':      return `${(value * 100).toFixed(2)}%`;
    case 'currency': return `$${Math.round(value).toLocaleString()}`;
    case 'months':   return `${value.toFixed(1)}mo`;
    case 'days':     return `${value.toFixed(1)}d`;
    case 'ratio':    return `${value.toFixed(2)}x`;
    case 'num':
    default:         return value.toFixed(2);
  }
}
