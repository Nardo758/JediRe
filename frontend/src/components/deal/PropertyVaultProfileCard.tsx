/**
 * PropertyVaultProfileCard
 *
 * Collapsible card displayed inside the Deal Intelligence Skills panel.
 * Fetches and renders the enriched property vault profile from
 * GET /api/v1/properties/vault-intel/:dealId.
 *
 * Each field carries a source badge indicating where the data came from:
 *   MUNICIPAL — county assessor / ArcGIS
 *   WEB       — web search enrichment narrative
 *   PLACES    — Google Places amenity signals + reviews
 *   ZONING    — M02 regulatory constraints
 *
 * Shows a "No vault data" placeholder when the deal has no linked parcel or
 * when enrichment has not yet run.
 *
 * The "Re-enrich" button in the card header lets analysts trigger a fresh
 * enrichment job (POST /api/v1/properties/by-parcel/:parcelId/enrich) without
 * leaving the deal view. The card polls for job completion and auto-refreshes
 * vault data when done.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/services/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface VaultMunicipal {
  owner:           string | null;
  owner_source:    string;
  year_built:      number | null;
  total_units:     number | null;
  assessed_value:  number | null;
  appraised_value: number | null;
  land_area_acres: number | null;
  county:          string | null;
  city:            string | null;
  zip_code:        string | null;
}

interface VaultAmenityFlags {
  has_pool:              boolean | null;
  has_fitness:           boolean | null;
  has_clubhouse:         boolean | null;
  has_concierge:         boolean | null;
  has_business_center:   boolean | null;
  has_dog_park:          boolean | null;
  is_master_metered:     boolean | null;
  is_individual_metered: boolean | null;
  parking_type:          string | null;
}

interface VaultWebSearch {
  narrative:     string | null;
  citations:     string[];
  recent_events: { title: string; summary: string | null; date: string | null }[];
}

interface VaultPlaces {
  rating:           number | null;
  review_count:     number | null;
  photo_count:      number | null;
  sentiment_summary: string | null;
}

interface VaultRegulatory {
  zone_code:    string | null;
  jurisdiction: string | null;
  max_height:   number | null;
  max_fsr:      number | null;
  source:       string | null;
}

interface VaultEnrichmentStep {
  step:    string;
  status:  'ok' | 'error' | 'skipped' | 'pending';
  message: string | null;
  ran_at:  string | null;
}

interface VaultIntelResponse {
  found:            boolean;
  parcel_id:        string | null;
  vault_updated_at: string | null;
  message?:         string;
  municipal?:       VaultMunicipal;
  amenity_flags?:   VaultAmenityFlags;
  web_search?:      VaultWebSearch | null;
  places?:          VaultPlaces | null;
  regulatory?:      VaultRegulatory | null;
  enrichment_steps?: VaultEnrichmentStep[];
}

type EnrichStatus = 'idle' | 'enriching' | 'complete' | 'no_match' | 'pending_review' | 'error';

// ── Theme (inherits from parent palette) ──────────────────────────────────────

const T = {
  bg:    { card: '#0F1923', row: '#0A0E14', badge: '#141F2B' },
  text:  { primary: '#E8F4FD', secondary: '#8BA8BF', muted: '#4A6070', green: '#00D26A', red: '#FF4D4D', amber: '#F6A623', cyan: '#00B4D8' },
  border: { subtle: '#1A2C3D' },
  font:  { mono: '"JetBrains Mono","Consolas",monospace' },
};

// Source badge config
const SOURCE_BADGES: Record<string, { label: string; color: string }> = {
  municipal:   { label: 'MUNICIPAL', color: '#00B4D8' },
  web:         { label: 'WEB',       color: '#B794F4' },
  places:      { label: 'PLACES',    color: '#00D26A' },
  zoning:      { label: 'ZONING',    color: '#F6A623' },
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function SourceBadge({ type }: { type: keyof typeof SOURCE_BADGES }) {
  const cfg = SOURCE_BADGES[type] ?? { label: type.toUpperCase(), color: '#8BA8BF' };
  return (
    <span style={{
      fontSize: 8,
      fontFamily: T.font.mono,
      fontWeight: 700,
      color: cfg.color,
      border: `1px solid ${cfg.color}44`,
      borderRadius: 2,
      padding: '1px 5px',
      marginLeft: 6,
      verticalAlign: 'middle',
      letterSpacing: '0.05em',
    }}>
      {cfg.label}
    </span>
  );
}

function FieldRow({ label, value, source, children }: {
  label: string;
  value?: string | number | null;
  source?: keyof typeof SOURCE_BADGES;
  children?: React.ReactNode;
}) {
  if (value == null && !children) return null;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      padding: '4px 0',
      borderBottom: `1px solid ${T.border.subtle}`,
      gap: 8,
    }}>
      <span style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, minWidth: 110, flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontSize: 10, color: T.text.primary, fontFamily: T.font.mono, flex: 1 }}>
        {children ?? (value != null ? String(value) : '—')}
        {source && <SourceBadge type={source} />}
      </span>
    </div>
  );
}

function AmenityChip({ label, value }: { label: string; value: boolean | string | null }) {
  const confirmed = value === true || (typeof value === 'string' && value.length > 0);
  const unknown   = value == null;
  const color     = unknown ? T.text.muted : confirmed ? T.text.green : T.text.muted;
  const icon      = unknown ? '?' : confirmed ? '✓' : '✗';
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 9,
      fontFamily: T.font.mono,
      color,
      border: `1px solid ${color}44`,
      borderRadius: 3,
      padding: '2px 7px',
      background: `${color}0D`,
    }}>
      {icon} {label}
    </span>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      fontSize: 9,
      fontFamily: T.font.mono,
      fontWeight: 700,
      color: T.text.muted,
      letterSpacing: '0.12em',
      marginTop: 10,
      marginBottom: 4,
    }}>
      {title}
    </div>
  );
}

function EnrichmentStepRow({ step }: { step: VaultEnrichmentStep }) {
  const colors = { ok: T.text.green, error: T.text.red, skipped: T.text.muted, pending: T.text.amber };
  const icons  = { ok: '✓', error: '✗', skipped: '○', pending: '…' };
  const color  = colors[step.status] ?? T.text.muted;
  const icon   = icons[step.status]  ?? '?';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0', fontSize: 9, fontFamily: T.font.mono }}>
      <span style={{ color, width: 10, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      <span style={{ color: T.text.secondary, flex: 1 }}>{step.step}</span>
      {step.message && step.status === 'error' && (
        <span style={{ color: T.text.red, fontSize: 8, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={step.message}>
          {step.message}
        </span>
      )}
    </div>
  );
}

// Minimal spinner using CSS animation via a style tag injected once
const SPINNER_CSS = `
@keyframes jedi-vault-spin {
  to { transform: rotate(360deg); }
}
.jedi-vault-spinner {
  display: inline-block;
  width: 10px;
  height: 10px;
  border: 2px solid ${T.text.muted}44;
  border-top-color: ${T.text.cyan};
  border-radius: 50%;
  animation: jedi-vault-spin 0.7s linear infinite;
  vertical-align: middle;
  flex-shrink: 0;
}`;

let spinnerStyleInjected = false;
function ensureSpinnerStyle() {
  if (spinnerStyleInjected) return;
  const el = document.createElement('style');
  el.textContent = SPINNER_CSS;
  document.head.appendChild(el);
  spinnerStyleInjected = true;
}

function Spinner() {
  useEffect(() => { ensureSpinnerStyle(); }, []);
  return <span className="jedi-vault-spinner" />;
}

// ── Re-enrich button ───────────────────────────────────────────────────────────

interface ReEnrichButtonProps {
  parcelId:     string;
  enrichStatus: EnrichStatus;
  onStart:      (jobId: string) => void;
  onError:      (msg: string) => void;
}

function ReEnrichButton({ parcelId, enrichStatus, onStart, onError }: ReEnrichButtonProps) {
  const isRunning = enrichStatus === 'enriching';

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning) return;

    try {
      const res = await api.post<{
        jobId: string;
        status: string;
        message?: string;
      }>(`/properties/by-parcel/${encodeURIComponent(parcelId)}/enrich`);

      onStart(res.data.jobId);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } }; message?: string })
          ?.response?.data?.error ??
        (err as { message?: string })?.message ??
        'Failed to start enrichment';
      onError(msg);
    }
  }, [parcelId, isRunning, onStart, onError]);

  return (
    <button
      onClick={handleClick}
      disabled={isRunning}
      title={isRunning ? 'Enrichment in progress' : 'Re-run web search and Places enrichment'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 8,
        fontFamily: T.font.mono,
        fontWeight: 700,
        letterSpacing: '0.06em',
        color: isRunning ? T.text.muted : T.text.cyan,
        background: 'transparent',
        border: `1px solid ${isRunning ? T.text.muted + '44' : T.text.cyan + '44'}`,
        borderRadius: 3,
        padding: '2px 7px',
        cursor: isRunning ? 'not-allowed' : 'pointer',
        opacity: isRunning ? 0.7 : 1,
        transition: 'opacity 0.15s',
        flexShrink: 0,
      }}
    >
      {isRunning ? (
        <>
          <Spinner />
          RUNNING…
        </>
      ) : (
        '⟳ RE-ENRICH'
      )}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS  = 3000;
const POLL_MAX_ATTEMPTS = 40; // ~2 min max

interface PropertyVaultProfileCardProps {
  dealId: string;
}

export function PropertyVaultProfileCard({ dealId }: PropertyVaultProfileCardProps) {
  const [expanded, setExpanded]         = useState(false);
  const [loading, setLoading]           = useState(false);
  const [data, setData]                 = useState<VaultIntelResponse | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const [showSteps, setShowSteps]       = useState(false);

  // Re-enrichment state
  const [enrichStatus, setEnrichStatus] = useState<EnrichStatus>('idle');
  const [enrichJobId, setEnrichJobId]   = useState<string | null>(null);
  const [enrichError, setEnrichError]   = useState<string | null>(null);

  const pollTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAttemptRef = useRef(0);

  // ── Load vault data ──────────────────────────────────────────────────────────
  const loadVaultData = useCallback((cancelled?: { value: boolean }) => {
    setLoading(true);
    setError(null);

    api.get<VaultIntelResponse>(`/properties/vault-intel/${dealId}`)
      .then(res => {
        if (cancelled?.value) return;
        setData(res.data);
      })
      .catch(err => {
        if (cancelled?.value) return;
        setError(err?.response?.data?.error ?? err?.message ?? 'Failed to load vault data');
      })
      .finally(() => {
        if (cancelled?.value) return;
        setLoading(false);
      });
  }, [dealId]);

  useEffect(() => {
    if (!expanded || data || loading) return;

    const cancelled = { value: false };
    loadVaultData(cancelled);
    return () => { cancelled.value = true; };
  }, [expanded, dealId, data, loading, loadVaultData]);

  // ── Poll enrichment status ───────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const pollStatus = useCallback((parcelId: string, jobId: string) => {
    if (pollAttemptRef.current >= POLL_MAX_ATTEMPTS) {
      setEnrichStatus('error');
      setEnrichError('Enrichment timed out — check the archive inbox for results.');
      stopPolling();
      return;
    }

    pollAttemptRef.current += 1;

    api.get<{
      status: string;
      jobId?: string;
      fieldsEnriched?: string[];
      error_msg?: string;
    }>(`/properties/by-parcel/${encodeURIComponent(parcelId)}/enrich/status?jobId=${encodeURIComponent(jobId)}`)
      .then(res => {
        const { status } = res.data;

        if (status === 'enriching') {
          pollTimerRef.current = setTimeout(() => pollStatus(parcelId, jobId), POLL_INTERVAL_MS);
        } else if (status === 'error') {
          setEnrichJobId(null);
          setEnrichStatus('error');
          setEnrichError(res.data.error_msg ?? 'Enrichment failed.');
          stopPolling();
        } else {
          // complete, no_match, pending_review
          // Clear enrichJobId FIRST so the polling useEffect does not re-fire
          // when data reloads and data?.parcel_id triggers the dependency array.
          setEnrichJobId(null);
          setEnrichStatus(status as EnrichStatus);
          stopPolling();
          // Refresh vault data to show updated results
          setData(null);
          loadVaultData();
        }
      })
      .catch(() => {
        // Network hiccup — keep polling
        pollTimerRef.current = setTimeout(() => pollStatus(parcelId, jobId), POLL_INTERVAL_MS);
      });
  }, [loadVaultData, stopPolling]);

  // Kick off polling whenever enrichJobId is set (and enriching is the current status)
  useEffect(() => {
    const parcelId = data?.parcel_id;
    if (!enrichJobId || !parcelId) return;

    pollAttemptRef.current = 0;
    pollStatus(parcelId, enrichJobId);

    return () => { stopPolling(); };
  }, [enrichJobId, data?.parcel_id, pollStatus, stopPolling]);

  // Proactive check: when parcel data first loads, query enrichment status once.
  // If a job is already running (started from the archive inbox or a script),
  // set the button to "Running…" and begin polling automatically.
  useEffect(() => {
    const parcelId = data?.parcel_id;
    if (!parcelId || enrichStatus !== 'idle') return;

    let cancelled = false;

    api.get<{ status: string; jobId?: string }>(
      `/properties/by-parcel/${encodeURIComponent(parcelId)}/enrich/status`,
    )
      .then(res => {
        if (cancelled) return;
        if (res.data.status === 'enriching') {
          setEnrichStatus('enriching');
          // Use the returned jobId if present; the status endpoint also works
          // without a known jobId by falling back to the property_descriptions scan.
          setEnrichJobId(res.data.jobId ?? `__probe_${parcelId}`);
        }
      })
      .catch(() => { /* best-effort — silently ignore probe failures */ });

    return () => { cancelled = true; };
  // enrichStatus is intentionally included: guard prevents re-firing after 'idle' → 'enriching'
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.parcel_id, enrichStatus]);

  // Cleanup on unmount
  useEffect(() => () => { stopPolling(); }, [stopPolling]);

  // ── Enrich handlers ──────────────────────────────────────────────────────────
  const handleEnrichStart = useCallback((jobId: string) => {
    setEnrichStatus('enriching');
    setEnrichError(null);
    setEnrichJobId(jobId);
  }, []);

  const handleEnrichError = useCallback((msg: string) => {
    setEnrichStatus('error');
    setEnrichError(msg);
  }, []);

  const fmt = {
    currency: (v: number | null) => v != null ? '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : null,
    acres:    (v: number | null) => v != null ? v.toFixed(2) + ' ac' : null,
    units:    (v: number | null) => v != null ? String(v) + ' units' : null,
    stars:    (v: number | null) => v != null ? '★ ' + v.toFixed(1) : null,
  };

  const parcelId = data?.parcel_id ?? null;

  return (
    <div style={{
      border: `1px solid ${T.border.subtle}`,
      borderRadius: 6,
      overflow: 'hidden',
      marginBottom: 8,
    }}>
      {/* Header row — toggle + re-enrich button live side-by-side */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: T.bg.card,
        borderBottom: expanded ? `1px solid ${T.border.subtle}` : 'none',
      }}>
        {/* Expand / collapse toggle (takes most of the width) */}
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: T.text.primary,
            fontFamily: T.font.mono,
            minWidth: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>🏢 PROPERTY PROFILE</span>
            {data?.found && (
              <span style={{ fontSize: 8, color: T.text.green, border: `1px solid ${T.text.green}44`, borderRadius: 2, padding: '1px 5px', flexShrink: 0 }}>
                VAULT
              </span>
            )}
          </div>
          <span style={{ fontSize: 10, color: T.text.muted, flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
        </button>

        {/* Re-enrich button — only shown when parcel_id is known */}
        {parcelId && (
          <div style={{ padding: '0 10px', flexShrink: 0 }}>
            <ReEnrichButton
              parcelId={parcelId}
              enrichStatus={enrichStatus}
              onStart={handleEnrichStart}
              onError={handleEnrichError}
            />
          </div>
        )}
      </div>

      {/* Enrich status / error banner (shown regardless of expand state) */}
      {enrichStatus !== 'idle' && enrichStatus !== 'enriching' && (
        <div style={{
          padding: '5px 12px',
          fontSize: 9,
          fontFamily: T.font.mono,
          background: enrichStatus === 'error'
            ? `${T.text.red}14`
            : enrichStatus === 'complete'
            ? `${T.text.green}14`
            : `${T.text.amber}14`,
          color: enrichStatus === 'error'
            ? T.text.red
            : enrichStatus === 'complete'
            ? T.text.green
            : T.text.amber,
          borderBottom: `1px solid ${T.border.subtle}`,
        }}>
          {enrichStatus === 'error' && `⚠ Enrichment failed: ${enrichError}`}
          {enrichStatus === 'complete' && '✓ Enrichment complete — vault data refreshed.'}
          {enrichStatus === 'no_match' && '○ Enrichment ran but found no new data for this property.'}
          {enrichStatus === 'pending_review' && '✓ Enrichment complete — results pending review in the archive inbox.'}
        </div>
      )}

      {expanded && (
        <div style={{ padding: '10px 12px', background: T.bg.row }}>

          {(loading || enrichStatus === 'enriching') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: T.text.muted, fontFamily: T.font.mono, padding: '12px 0', justifyContent: 'center' }}>
              <Spinner />
              {enrichStatus === 'enriching' ? 'Enrichment running…' : 'Loading vault data…'}
            </div>
          )}

          {error && enrichStatus !== 'enriching' && (
            <div style={{ fontSize: 10, color: T.text.red, fontFamily: T.font.mono, padding: '8px 0' }}>
              ⚠ {error}
            </div>
          )}

          {!loading && !error && data && !data.found && enrichStatus !== 'enriching' && (
            <div style={{ fontSize: 10, color: T.text.muted, fontFamily: T.font.mono, padding: '12px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 18, marginBottom: 6 }}>🔍</div>
              <div>No vault data</div>
              <div style={{ fontSize: 9, marginTop: 4 }}>
                {data.message ?? 'Link a parcel to this deal to enable property enrichment.'}
              </div>
            </div>
          )}

          {!loading && !error && data?.found && enrichStatus !== 'enriching' && (
            <>
              {/* Municipal attributes */}
              {data.municipal && (
                <>
                  <SectionHeader title="MUNICIPAL" />
                  <FieldRow label="Owner"          value={data.municipal.owner}           source="municipal" />
                  <FieldRow label="Year Built"     value={data.municipal.year_built}      source="municipal" />
                  <FieldRow label="Total Units"    value={fmt.units(data.municipal.total_units)}  source="municipal" />
                  <FieldRow label="Assessed Value" value={fmt.currency(data.municipal.assessed_value)} source="municipal" />
                  <FieldRow label="Land Area"      value={fmt.acres(data.municipal.land_area_acres)}  source="municipal" />
                  {data.municipal.county && (
                    <FieldRow label="County" value={`${data.municipal.county}, ${data.municipal.city ?? ''} ${data.municipal.zip_code ?? ''}`.trim()} source="municipal" />
                  )}
                </>
              )}

              {/* Amenity flags */}
              {data.amenity_flags && (
                <>
                  <SectionHeader title="AMENITIES" />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                    <AmenityChip label="Pool"            value={data.amenity_flags.has_pool}            />
                    <AmenityChip label="Fitness"         value={data.amenity_flags.has_fitness}         />
                    <AmenityChip label="Clubhouse"       value={data.amenity_flags.has_clubhouse}       />
                    <AmenityChip label="Concierge"       value={data.amenity_flags.has_concierge}       />
                    <AmenityChip label="Business Ctr"    value={data.amenity_flags.has_business_center} />
                    <AmenityChip label="Dog Park"        value={data.amenity_flags.has_dog_park}        />
                  </div>
                  {data.amenity_flags.parking_type && (
                    <FieldRow label="Parking" value={data.amenity_flags.parking_type} source="municipal" />
                  )}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                    {data.amenity_flags.is_individual_metered === true && (
                      <AmenityChip label="Individual Metered" value={true} />
                    )}
                    {data.amenity_flags.is_master_metered === true && (
                      <AmenityChip label="Master Metered" value={true} />
                    )}
                  </div>
                </>
              )}

              {/* Google Places */}
              {data.places && (
                <>
                  <SectionHeader title="GOOGLE PLACES" />
                  <FieldRow label="Rating"       value={fmt.stars(data.places.rating)} source="places" />
                  <FieldRow label="Reviews"      value={data.places.review_count != null ? data.places.review_count + ' reviews' : null} source="places" />
                  <FieldRow label="Photos"       value={data.places.photo_count != null ? data.places.photo_count + ' photos' : null} source="places" />
                  {data.places.sentiment_summary && (
                    <div style={{ fontSize: 9, color: T.text.secondary, fontFamily: T.font.mono, padding: '4px 0 6px', lineHeight: 1.5 }}>
                      {data.places.sentiment_summary}
                      <SourceBadge type="places" />
                    </div>
                  )}
                </>
              )}

              {/* Regulatory */}
              {data.regulatory && (
                <>
                  <SectionHeader title="ZONING / REGULATORY" />
                  <FieldRow label="Zone Code"    value={data.regulatory.zone_code}    source="zoning" />
                  <FieldRow label="Jurisdiction" value={data.regulatory.jurisdiction} source="zoning" />
                  <FieldRow label="Max Height"   value={data.regulatory.max_height != null ? data.regulatory.max_height + ' ft' : null} source="zoning" />
                  <FieldRow label="Max FSR"      value={data.regulatory.max_fsr != null ? data.regulatory.max_fsr + '× FAR' : null} source="zoning" />
                </>
              )}

              {/* Web search */}
              {data.web_search?.narrative && (
                <>
                  <SectionHeader title="WEB SEARCH NARRATIVE" />
                  <div style={{ fontSize: 9, color: T.text.secondary, fontFamily: T.font.mono, lineHeight: 1.6, padding: '4px 0 6px' }}>
                    {data.web_search.narrative.slice(0, 400)}{data.web_search.narrative.length > 400 ? '…' : ''}
                    <SourceBadge type="web" />
                  </div>
                  {data.web_search.citations.length > 0 && (
                    <div style={{ fontSize: 8, color: T.text.muted, fontFamily: T.font.mono, marginTop: 2 }}>
                      {data.web_search.citations.length} citation{data.web_search.citations.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </>
              )}

              {/* Recent events */}
              {data.web_search?.recent_events && data.web_search.recent_events.length > 0 && (
                <>
                  <SectionHeader title="RECENT EVENTS" />
                  {data.web_search.recent_events.slice(0, 3).map((ev, i) => (
                    <div key={i} style={{
                      padding: '5px 0',
                      borderBottom: `1px solid ${T.border.subtle}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 9, color: T.text.primary, fontFamily: T.font.mono, fontWeight: 700 }}>
                          {ev.title}
                        </span>
                        {ev.date && (
                          <span style={{ fontSize: 8, color: T.text.muted, fontFamily: T.font.mono, flexShrink: 0 }}>
                            {ev.date}
                          </span>
                        )}
                      </div>
                      {ev.summary && (
                        <div style={{ fontSize: 8, color: T.text.secondary, fontFamily: T.font.mono, lineHeight: 1.5, marginTop: 2 }}>
                          {ev.summary.slice(0, 120)}{ev.summary.length > 120 ? '…' : ''}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}

              {/* Enrichment steps (collapsible) */}
              {data.enrichment_steps && data.enrichment_steps.length > 0 && (
                <>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, cursor: 'pointer' }}
                    onClick={() => setShowSteps(s => !s)}
                  >
                    <span style={{ fontSize: 9, fontFamily: T.font.mono, color: T.text.muted, letterSpacing: '0.1em' }}>
                      ENRICHMENT LOG ({data.enrichment_steps.filter(s => s.status === 'ok').length}/{data.enrichment_steps.length} ok)
                    </span>
                    <span style={{ fontSize: 8, color: T.text.muted }}>{showSteps ? '▲' : '▼'}</span>
                    {data.enrichment_steps.some(s => s.status === 'error') && (
                      <span style={{ fontSize: 8, color: T.text.red, marginLeft: 4 }}>
                        {data.enrichment_steps.filter(s => s.status === 'error').length} error{data.enrichment_steps.filter(s => s.status === 'error').length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {showSteps && (
                    <div style={{ marginTop: 4 }}>
                      {data.enrichment_steps.map((step, i) => (
                        <EnrichmentStepRow key={i} step={step} />
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Footer */}
              {data.vault_updated_at && (
                <div style={{ fontSize: 8, color: T.text.muted, fontFamily: T.font.mono, marginTop: 10, textAlign: 'right' }}>
                  vault updated {new Date(data.vault_updated_at).toLocaleDateString()}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default PropertyVaultProfileCard;
