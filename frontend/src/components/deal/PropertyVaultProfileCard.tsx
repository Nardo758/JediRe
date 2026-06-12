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
 */

import React, { useEffect, useState } from 'react';
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

// ── Main component ─────────────────────────────────────────────────────────────

interface PropertyVaultProfileCardProps {
  dealId: string;
}

export function PropertyVaultProfileCard({ dealId }: PropertyVaultProfileCardProps) {
  const [expanded, setExpanded]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [data, setData]           = useState<VaultIntelResponse | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    if (!expanded || data || loading) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    api.get<VaultIntelResponse>(`/properties/vault-intel/${dealId}`)
      .then(res => {
        if (!cancelled) setData(res.data);
      })
      .catch(err => {
        if (!cancelled) setError(err?.response?.data?.error ?? err?.message ?? 'Failed to load vault data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [expanded, dealId]);

  const fmt = {
    currency: (v: number | null) => v != null ? '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : null,
    acres:    (v: number | null) => v != null ? v.toFixed(2) + ' ac' : null,
    units:    (v: number | null) => v != null ? String(v) + ' units' : null,
    stars:    (v: number | null) => v != null ? '★ ' + v.toFixed(1) : null,
  };

  return (
    <div style={{
      border: `1px solid ${T.border.subtle}`,
      borderRadius: 6,
      overflow: 'hidden',
      marginBottom: 8,
    }}>
      {/* Header / toggle */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: T.bg.card,
          border: 'none',
          cursor: 'pointer',
          color: T.text.primary,
          fontFamily: T.font.mono,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700 }}>🏢 PROPERTY PROFILE</span>
          {data?.found && (
            <span style={{ fontSize: 8, color: T.text.green, border: `1px solid ${T.text.green}44`, borderRadius: 2, padding: '1px 5px' }}>
              VAULT
            </span>
          )}
        </div>
        <span style={{ fontSize: 10, color: T.text.muted }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{ padding: '10px 12px', background: T.bg.row }}>

          {loading && (
            <div style={{ fontSize: 10, color: T.text.muted, fontFamily: T.font.mono, padding: '12px 0', textAlign: 'center' }}>
              Loading vault data…
            </div>
          )}

          {error && (
            <div style={{ fontSize: 10, color: T.text.red, fontFamily: T.font.mono, padding: '8px 0' }}>
              ⚠ {error}
            </div>
          )}

          {!loading && !error && data && !data.found && (
            <div style={{ fontSize: 10, color: T.text.muted, fontFamily: T.font.mono, padding: '12px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 18, marginBottom: 6 }}>🔍</div>
              <div>No vault data</div>
              <div style={{ fontSize: 9, marginTop: 4 }}>
                {data.message ?? 'Link a parcel to this deal to enable property enrichment.'}
              </div>
            </div>
          )}

          {!loading && !error && data?.found && (
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
