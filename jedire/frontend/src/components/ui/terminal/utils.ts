/**
 * Utility functions for Terminal UI components
 */

/**
 * Format number as compact currency ($1.5M, $250K, $500)
 */
export const formatCompact = (n: number): string => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
};

/**
 * Format number as full currency with commas ($1,500,000)
 */
export const formatFull = (n: number): string => {
  return `$${n.toLocaleString()}`;
};

/**
 * Format number as currency ($1,500,000)
 * Alias for formatFull for backward compatibility
 */
export const formatCurrency = (n: number): string => {
  if (n == null || isNaN(n)) return '$0';
  return `$${n.toLocaleString()}`;
};

/**
 * Format number as percentage (5.2%)
 */
export const formatPercent = (n: number): string => {
  return `${n.toFixed(1)}%`;
};

/**
 * Format date as YYYY-MM-DD
 */
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
};

/**
 * Calculate color based on numeric threshold
 */
export const getColorByThreshold = (
  value: number,
  thresholds: { good: number; warning: number },
  colors: { good: string; warning: string; bad: string }
): string => {
  if (value >= thresholds.good) return colors.good;
  if (value >= thresholds.warning) return colors.warning;
  return colors.bad;
};
