/**
 * VendorFreshnessPrompt — Phase 2C
 *
 * Non-blocking banner shown when a deal's vendor market data has crossed
 * the stale threshold declared in the vendor registry. Surfaces at the top
 * of any F-key view that benefits from current market context.
 *
 * Rules:
 *   - Only rendered when at least one vendor's data is stale
 *   - Dismissible per-session (does not block workflow)
 *   - Shows the stalest vendor + days elapsed
 *   - Refresh CTA calls POST /api/v1/deals/:dealId/vendor-refresh and shows
 *     loading / success / no-files feedback inline
 *   - Falls back to "Upload Data" nav when no prior file exists (no_files)
 */

import React, { useState } from 'react';
import { AlertTriangle, X, Upload, RefreshCw, CheckCircle } from 'lucide-react';
import type { VendorFreshnessState, RefreshState } from '../../hooks/useVendorFreshness';

interface VendorFreshnessPromptProps {
  staleVendors: VendorFreshnessState[];
  dealId: string;
  onRefresh?: (vendorId: string) => Promise<void>;
  refreshStates?: Record<string, RefreshState>;
  onNavigateToDataLibrary?: () => void;
}

export function VendorFreshnessPrompt({
  staleVendors,
  dealId,
  onRefresh,
  refreshStates = {},
  onNavigateToDataLibrary,
}: VendorFreshnessPromptProps): React.ReactElement | null {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || staleVendors.length === 0) return null;

  // Show the vendor with the highest days elapsed (stalest first)
  const sorted = [...staleVendors].sort(
    (a, b) => (b.daysSinceAsOf ?? 0) - (a.daysSinceAsOf ?? 0),
  );
  const worst = sorted[0];
  const othersCount = sorted.length - 1;

  const daysLabel = worst.daysSinceAsOf != null
    ? `${worst.daysSinceAsOf} day${worst.daysSinceAsOf !== 1 ? 's' : ''} old`
    : 'overdue for refresh';

  const label = othersCount > 0
    ? `${worst.displayName} data is ${daysLabel} (+${othersCount} other vendor${othersCount !== 1 ? 's' : ''})`
    : `${worst.displayName} data is ${daysLabel}`;

  const refreshState: RefreshState = refreshStates[worst.vendorId] ?? 'idle';
  const isRefreshing = refreshState === 'loading' || refreshState === 'success';
  const showNoFiles  = refreshState === 'no_files';

  const handleRefresh = () => {
    if (onRefresh && !isRefreshing) {
      onRefresh(worst.vendorId);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        background: '#1C1A10',
        border: '1px solid #5A4A00',
        borderRadius: 4,
        fontSize: 11,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        color: '#D4A017',
        marginBottom: 4,
      }}
    >
      <AlertTriangle size={12} style={{ flexShrink: 0, color: '#D4A017' }} />
      <span style={{ flex: 1 }}>
        {label}
        {showNoFiles && (
          <span style={{ color: '#8B7A40', marginLeft: 6 }}>
            — no prior upload found; use Upload Data below
          </span>
        )}
        {refreshState === 'success' && (
          <span style={{ color: '#4A8A4A', marginLeft: 6 }}>
            — re-import running…
          </span>
        )}
        {refreshState === 'error' && (
          <span style={{ color: '#8B4040', marginLeft: 6 }}>
            — refresh failed; try again
          </span>
        )}
      </span>

      {/* Refresh CTA — calls the new endpoint */}
      {onRefresh && !showNoFiles && (
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          title={refreshState === 'success' ? 'Re-import running' : 'Re-import from last upload'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'transparent',
            border: '1px solid #5A4A00',
            borderRadius: 3,
            color: refreshState === 'success' ? '#4A8A4A' : '#D4A017',
            cursor: isRefreshing ? 'default' : 'pointer',
            fontSize: 10,
            padding: '2px 8px',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
            opacity: refreshState === 'loading' ? 0.6 : 1,
          }}
        >
          {refreshState === 'success' ? (
            <>
              <CheckCircle size={9} />
              Running…
            </>
          ) : (
            <>
              <RefreshCw
                size={9}
                style={{
                  animation: refreshState === 'loading' ? 'spin 1s linear infinite' : undefined,
                }}
              />
              {refreshState === 'loading' ? 'Queuing…' : 'Refresh'}
            </>
          )}
        </button>
      )}

      {/* Upload fallback — shown when no prior file exists, or always as secondary CTA */}
      {(showNoFiles || !onRefresh) && onNavigateToDataLibrary && (
        <button
          onClick={onNavigateToDataLibrary}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'transparent',
            border: '1px solid #5A4A00',
            borderRadius: 3,
            color: '#D4A017',
            cursor: 'pointer',
            fontSize: 10,
            padding: '2px 8px',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          <Upload size={9} />
          Upload Data
        </button>
      )}

      <button
        onClick={() => setDismissed(true)}
        title="Dismiss"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#8B7A40',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

/**
 * Provenance watermark chip rendered next to data values sourced from a
 * restricted vendor. Internal-only — never rendered in external share views.
 */
interface VendorProvenanceBadgeProps {
  vendorDisplayName: string;
  asOfDate: string | null;
  licensePosture: 'restricted' | 'platform_only' | 'open';
}

export function VendorProvenanceBadge({
  vendorDisplayName,
  asOfDate,
  licensePosture,
}: VendorProvenanceBadgeProps): React.ReactElement {
  const datePart = asOfDate
    ? ` · ${new Date(asOfDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
    : '';

  const isRestricted = licensePosture === 'restricted';

  return (
    <span
      title={
        isRestricted
          ? `Sourced from ${vendorDisplayName} — for internal use only. Not included in external exports.`
          : `Sourced from ${vendorDisplayName} (platform licensed)`
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '1px 5px',
        borderRadius: 2,
        fontSize: 9,
        fontFamily: "'JetBrains Mono', monospace",
        background: isRestricted ? '#1A1200' : '#0A1A0A',
        border: `1px solid ${isRestricted ? '#4A3800' : '#1A4A1A'}`,
        color: isRestricted ? '#A07800' : '#4A8A4A',
        letterSpacing: '0.02em',
        textTransform: 'uppercase' as const,
        whiteSpace: 'nowrap' as const,
      }}
    >
      {isRestricted && (
        <span style={{ color: '#A07800', fontSize: 8 }}>⚿</span>
      )}
      {vendorDisplayName}{datePart}
    </span>
  );
}
