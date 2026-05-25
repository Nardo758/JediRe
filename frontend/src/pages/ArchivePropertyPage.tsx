import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api.client';
import {
  archivePropertiesService,
  type PropertySummary,
  type DataLibraryFile,
  type LayeredValue,
} from '../services/archiveProperties.service';

// ─── tiny helpers ─────────────────────────────────────────────────────────────

function rv<T>(lv?: LayeredValue<T> | null): T | null {
  return lv?.resolved ?? null;
}

function fmtSize(bytes?: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function fmtDate(d?: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function resolveAddress(desc: PropertySummary['description']): string {
  if (!desc) return '';
  const addr = rv(desc.address);
  if (addr && typeof addr === 'object') {
    const { street, city, state, zip } = addr as { street?: string; city?: string; state?: string; zip?: string };
    return [street, city, state, zip].filter(Boolean).join(', ');
  }
  return '';
}

const DOC_TYPE_ORDER = ['OM', 'T12', 'RENT_ROLL', 'TAX_BILL', 'LEASING_STATS', 'OTHER'];

function docTypeLabel(t: string): string {
  const map: Record<string, string> = {
    OM: 'OM', T12: 'T-12', RENT_ROLL: 'Rent Roll',
    TAX_BILL: 'Tax Bill', LEASING_STATS: 'Leasing Stats', OTHER: 'Other',
  };
  return map[t] ?? t;
}

const STATUS_DOT: Record<string, string> = {
  success: '#4ade80', partial: '#f59e0b',
  failed: '#e06c75', unparsed: '#8892b0',
};

function provenanceBadge(lv?: LayeredValue | null): string | null {
  if (!lv?.layers) return null;
  const { manual, municipal, om, web } = lv.layers;
  if (manual) return 'manual';
  if (municipal) return 'county';
  if (om) return 'OM';
  if (web) return 'web';
  return null;
}

// ─── Sparkline (pure SVG, no dep) ────────────────────────────────────────────

function Sparkline({ points }: { points: { value: number | null }[] }) {
  const vals = points.map((p) => p.value).filter((v): v is number => v != null);
  if (vals.length < 2) {
    return (
      <svg width="100%" height="40" viewBox="0 0 100 40">
        <text x="50" y="24" textAnchor="middle" fontSize="9" fill="#8892b0">no data</text>
      </svg>
    );
  }
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const W = 100;
  const H = 40;
  const xs = vals.map((_, i) => (i / (vals.length - 1)) * W);
  const ys = vals.map((v) => H - 4 - ((v - min) / range) * (H - 8));
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  return (
    <svg width="100%" height="40" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <polyline points={xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')}
        fill="none" stroke="#4fc3f7" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={xs[xs.length - 1].toFixed(1)} cy={ys[ys.length - 1].toFixed(1)} r="2" fill="#4fc3f7" />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ArchivePropertyPage() {
  const { parcelId } = useParams<{ parcelId: string }>();
  const navigate = useNavigate();

  const [summary, setSummary] = useState<PropertySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileFilter, setFileFilter] = useState<string>('ALL');

  const load = useCallback(async () => {
    if (!parcelId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await archivePropertiesService.getSummary(parcelId);
      setSummary(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load property';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [parcelId]);

  useEffect(() => { void load(); }, [load]);

  // ── file list filtered by type ──────────────────────────────────────────────
  const allFiles = summary?.files ?? [];
  const filteredFiles = fileFilter === 'ALL'
    ? allFiles
    : allFiles.filter((f) => f.document_type === fileFilter);

  const docTypesPresent = Array.from(new Set(allFiles.map((f) => f.document_type)))
    .sort((a, b) => DOC_TYPE_ORDER.indexOf(a) - DOC_TYPE_ORDER.indexOf(b));

  const desc = summary?.description ?? null;
  const cov = summary?.coverage_diagnostics;
  const ts = summary?.time_series;

  // Amenity tags from boolean flags
  const amenityTags: string[] = [];
  if (desc) {
    if (rv(desc.has_pool)) amenityTags.push('Pool');
    if (rv(desc.has_fitness)) amenityTags.push('Fitness Center');
    if (rv(desc.has_clubhouse)) amenityTags.push('Clubhouse');
    if (rv(desc.has_concierge)) amenityTags.push('Concierge');
    if (rv(desc.has_business_center)) amenityTags.push('Business Center');
    if (rv(desc.has_dog_park)) amenityTags.push('Dog Park');
    if (rv(desc.is_master_metered)) amenityTags.push('Master Metered');
    if (rv(desc.is_individual_metered)) amenityTags.push('Indiv. Metered');
  }

  // ── styles ──────────────────────────────────────────────────────────────────
  const S = {
    page: {
      minHeight: '100vh',
      background: '#0d1117',
      color: '#cdd9e5',
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: '13px',
    } as React.CSSProperties,
    topBar: {
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '12px 20px', borderBottom: '1px solid #21262d',
      background: '#161b22',
    } as React.CSSProperties,
    backBtn: {
      background: 'none', border: '1px solid #30363d', color: '#8892b0',
      borderRadius: '4px', padding: '4px 10px', cursor: 'pointer',
      fontFamily: 'inherit', fontSize: '11px', letterSpacing: '0.05em',
    } as React.CSSProperties,
    breadcrumb: { color: '#8892b0', fontSize: '11px', letterSpacing: '0.08em' } as React.CSSProperties,
    crumbSep: { color: '#30363d', margin: '0 6px' } as React.CSSProperties,
    crumbActive: { color: '#cdd9e5' } as React.CSSProperties,
    main: { padding: '24px 28px', maxWidth: '1200px' } as React.CSSProperties,
    header: {
      marginBottom: '24px',
      paddingBottom: '20px',
      borderBottom: '1px solid #21262d',
    } as React.CSSProperties,
    propertyName: {
      fontSize: '22px', fontWeight: 600, color: '#f0f6fc',
      marginBottom: '6px', letterSpacing: '0',
    } as React.CSSProperties,
    metaLine: {
      display: 'flex', flexWrap: 'wrap' as const, gap: '16px',
      color: '#8892b0', fontSize: '12px', marginBottom: '10px',
    } as React.CSSProperties,
    badge: {
      display: 'inline-block', padding: '2px 8px',
      borderRadius: '4px', fontSize: '11px', fontWeight: 600,
      border: '1px solid #30363d', color: '#cdd9e5',
      letterSpacing: '0.06em',
    } as React.CSSProperties,
    section: { marginBottom: '28px' } as React.CSSProperties,
    sectionTitle: {
      fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em',
      color: '#8892b0', textTransform: 'uppercase' as const,
      marginBottom: '12px', borderBottom: '1px solid #21262d',
      paddingBottom: '6px',
    } as React.CSSProperties,
    narrative: {
      color: '#cdd9e5', lineHeight: 1.65, background: '#161b22',
      border: '1px solid #21262d', borderRadius: '6px',
      padding: '14px 16px', fontSize: '13px', marginBottom: '12px',
    } as React.CSSProperties,
    attrGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: '10px',
    } as React.CSSProperties,
    attrCard: {
      background: '#161b22', border: '1px solid #21262d',
      borderRadius: '6px', padding: '10px 12px',
    } as React.CSSProperties,
    attrLabel: { fontSize: '10px', color: '#8892b0', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '4px' } as React.CSSProperties,
    attrValue: { fontSize: '14px', color: '#f0f6fc', fontWeight: 500 } as React.CSSProperties,
    attrSrc: { fontSize: '10px', color: '#388bfd', marginTop: '2px' } as React.CSSProperties,
    amenityRow: { display: 'flex', flexWrap: 'wrap' as const, gap: '6px', marginTop: '8px' } as React.CSSProperties,
    amenityTag: {
      background: '#1f2937', border: '1px solid #374151',
      borderRadius: '4px', padding: '3px 8px',
      fontSize: '11px', color: '#93c5fd',
    } as React.CSSProperties,
    sparkGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: '12px',
    } as React.CSSProperties,
    sparkCard: {
      background: '#161b22', border: '1px solid #21262d',
      borderRadius: '6px', padding: '10px 12px',
    } as React.CSSProperties,
    sparkLabel: { fontSize: '10px', color: '#8892b0', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '6px' } as React.CSSProperties,
    sparkValue: { fontSize: '16px', color: '#f0f6fc', fontWeight: 600, marginBottom: '4px' } as React.CSSProperties,
    filterRow: { display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' as const } as React.CSSProperties,
    filterBtn: (active: boolean): React.CSSProperties => ({
      background: active ? '#1f3a5c' : 'none',
      border: `1px solid ${active ? '#388bfd' : '#30363d'}`,
      color: active ? '#4fc3f7' : '#8892b0',
      borderRadius: '4px', padding: '3px 10px',
      cursor: 'pointer', fontFamily: 'inherit', fontSize: '11px',
      letterSpacing: '0.05em',
    }),
    fileTable: { width: '100%', borderCollapse: 'collapse' as const } as React.CSSProperties,
    fileRow: {
      borderBottom: '1px solid #21262d',
      transition: 'background 0.1s',
    } as React.CSSProperties,
    fileTd: { padding: '8px 10px', verticalAlign: 'middle' as const } as React.CSSProperties,
    covBar: {
      display: 'flex', gap: '16px', flexWrap: 'wrap' as const,
      background: '#161b22', border: '1px solid #21262d',
      borderRadius: '6px', padding: '12px 16px', marginBottom: '20px',
    } as React.CSSProperties,
    covItem: { display: 'flex', flexDirection: 'column' as const, gap: '3px' } as React.CSSProperties,
    covLabel: { fontSize: '10px', color: '#8892b0', textTransform: 'uppercase' as const, letterSpacing: '0.08em' } as React.CSSProperties,
    covValue: { fontSize: '13px', color: '#f0f6fc', fontWeight: 500 } as React.CSSProperties,
  };

  if (loading) {
    return (
      <div style={S.page}>
        <div style={{ padding: '60px', textAlign: 'center', color: '#8892b0' }}>
          Loading property…
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div style={S.page}>
        <div style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ color: '#e06c75', marginBottom: '12px' }}>
            {error ?? 'Property not found'}
          </div>
          <button style={S.backBtn} onClick={() => navigate(-1)}>← Back</button>
        </div>
      </div>
    );
  }

  const displayName = rv(desc?.property_name) ?? parcelId ?? 'Unknown Property';
  const address = resolveAddress(desc);
  const msaVal = rv(desc?.msa);
  const yearBuilt = rv(desc?.year_built);
  const yearRenovated = rv(desc?.year_renovated);
  const units = rv(desc?.unit_count);
  const assetClass = rv(desc?.asset_class);
  const propType = rv(desc?.property_type);
  const constrType = rv(desc?.construction_type);
  const parkType = rv(desc?.parking_type);
  const stories = rv(desc?.stories);
  const sqft = rv(desc?.rentable_sqft);
  const parkingSpaces = rv(desc?.parking_spaces);
  const narrativeText = rv(desc?.narrative);
  const zoning = rv(desc?.zoning_code);

  const lastAskingRentPt = ts?.series?.asking_rent.slice(-1)[0];
  const lastAskingRent = lastAskingRentPt?.value;
  const lastVelocityPt = ts?.series?.signing_velocity.slice(-1)[0];
  const lastVelocity = lastVelocityPt?.value;

  return (
    <div style={S.page}>
      {/* ── Top bar ── */}
      <div style={S.topBar}>
        <button style={S.backBtn} onClick={() => navigate('/settings/data-library?tab=files')}>← Library</button>
        <div style={S.breadcrumb}>
          <span>Archive</span>
          <span style={S.crumbSep}>/</span>
          <span style={{ cursor: 'pointer', color: '#8892b0' }} onClick={() => navigate('/settings/data-library?tab=files')}>Library</span>
          <span style={S.crumbSep}>/</span>
          <span style={S.crumbActive}>{displayName}</span>
        </div>
      </div>

      <div style={S.main}>
        {/* ── Header ── */}
        <div style={S.header}>
          <div style={S.propertyName}>{displayName}</div>
          <div style={S.metaLine}>
            {address && <span>{address}</span>}
            {msaVal && <span>{msaVal} MSA</span>}
            {units != null && <span>{units.toLocaleString()} units</span>}
            {yearBuilt != null && <span>Built {yearBuilt}</span>}
            {yearRenovated != null && <span>Renovated {yearRenovated}</span>}
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {assetClass && <span style={{ ...S.badge, borderColor: '#1f3a5c', color: '#4fc3f7' }}>Class {assetClass}</span>}
            {propType && <span style={{ ...S.badge }}>{propType}</span>}
            {constrType && <span style={{ ...S.badge }}>{constrType}</span>}
            {parkType && <span style={{ ...S.badge }}>{parkType}</span>}
            {stories != null && <span style={{ ...S.badge }}>{stories} stories</span>}
          </div>
        </div>

        {/* ── Coverage diagnostics ── */}
        {cov && (
          <div style={S.covBar}>
            <div style={S.covItem}>
              <span style={S.covLabel}>OM</span>
              <span style={{ ...S.covValue, color: cov.has_om ? '#4ade80' : '#8892b0' }}>
                {cov.has_om ? '✓' : '—'}
              </span>
            </div>
            <div style={S.covItem}>
              <span style={S.covLabel}>T-12</span>
              <span style={{ ...S.covValue, color: cov.has_t12_count > 0 ? '#4ade80' : '#8892b0' }}>
                {cov.has_t12_count > 0 ? `${cov.has_t12_count}` : '—'}
              </span>
            </div>
            <div style={S.covItem}>
              <span style={S.covLabel}>Rent Rolls</span>
              <span style={{ ...S.covValue, color: cov.has_rent_roll_count > 0 ? '#4ade80' : '#8892b0' }}>
                {cov.has_rent_roll_count > 0 ? `${cov.has_rent_roll_count}` : '—'}
              </span>
            </div>
            <div style={S.covItem}>
              <span style={S.covLabel}>Tax Bill</span>
              <span style={{ ...S.covValue, color: cov.has_tax_bill ? '#4ade80' : '#8892b0' }}>
                {cov.has_tax_bill ? '✓' : '—'}
              </span>
            </div>
            <div style={S.covItem}>
              <span style={S.covLabel}>Description</span>
              <span style={S.covValue}>{Math.round(cov.description_completeness * 100)}%</span>
            </div>
            <div style={S.covItem}>
              <span style={S.covLabel}>Time Series</span>
              <span style={S.covValue}>{Math.round(cov.time_series_completeness * 100)}%</span>
            </div>
            <div style={S.covItem}>
              <span style={S.covLabel}>Files Total</span>
              <span style={S.covValue}>{allFiles.length}</span>
            </div>
          </div>
        )}

        {/* ── Description section ── */}
        <div style={S.section}>
          <div style={S.sectionTitle}>Description</div>

          {narrativeText && (
            <div style={S.narrative}>
              <ParsedNarrative text={narrativeText} />
            </div>
          )}

          <div style={S.attrGrid}>
            {sqft != null && (
              <div style={S.attrCard}>
                <div style={S.attrLabel}>Rentable SF</div>
                <div style={S.attrValue}>{sqft.toLocaleString()}</div>
                {provenanceBadge(desc?.rentable_sqft) && (
                  <div style={S.attrSrc}>src: {provenanceBadge(desc?.rentable_sqft)}</div>
                )}
              </div>
            )}
            {rv(desc?.lot_size_acres) != null && (
              <div style={S.attrCard}>
                <div style={S.attrLabel}>Lot Acres</div>
                <div style={S.attrValue}>{rv(desc?.lot_size_acres)}</div>
              </div>
            )}
            {parkingSpaces != null && (
              <div style={S.attrCard}>
                <div style={S.attrLabel}>Parking Spaces</div>
                <div style={S.attrValue}>{parkingSpaces.toLocaleString()}</div>
                {rv(desc?.parking_ratio) != null && (
                  <div style={S.attrSrc}>{rv(desc?.parking_ratio)} / unit</div>
                )}
              </div>
            )}
            {rv(desc?.building_count) != null && (
              <div style={S.attrCard}>
                <div style={S.attrLabel}>Buildings</div>
                <div style={S.attrValue}>{rv(desc?.building_count)}</div>
              </div>
            )}
            {zoning && (
              <div style={S.attrCard}>
                <div style={S.attrLabel}>Zoning</div>
                <div style={S.attrValue}>{zoning}</div>
                {provenanceBadge(desc?.zoning_code) && (
                  <div style={S.attrSrc}>src: {provenanceBadge(desc?.zoning_code)}</div>
                )}
              </div>
            )}
            {rv(desc?.county) && (
              <div style={S.attrCard}>
                <div style={S.attrLabel}>County</div>
                <div style={S.attrValue}>{rv(desc?.county)}</div>
              </div>
            )}
          </div>

          {amenityTags.length > 0 && (
            <div>
              <div style={S.amenityRow}>
                {amenityTags.map((tag) => (
                  <span key={tag} style={S.amenityTag}>{tag}</span>
                ))}
              </div>
              {rv(desc?.sentiment_summary) && (
                <div style={{ fontSize: '10px', color: '#8892b0', marginTop: '6px' }}>
                  Source: Google Places
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Photos (Phase 8) ── */}
        {(() => {
          const photos = rv(desc?.photos);
          if (!photos || photos.length === 0) return null;
          return (
            <div style={S.section}>
              <div style={S.sectionTitle}>Photos ({photos.length})</div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {photos.map((p, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img
                      src={p.proxy_url}
                      alt={`Property photo ${i + 1}`}
                      style={{
                        width: '180px', height: '120px', objectFit: 'cover',
                        borderRadius: '6px', border: '1px solid #21262d',
                      }}
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                    {p.attribution && (
                      <div style={{ fontSize: '9px', color: '#8892b0', marginTop: '3px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        © {p.attribution}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '10px', color: '#8892b0', marginTop: '8px' }}>
                Source: Google Places
              </div>
            </div>
          );
        })()}

        {/* ── Reviews & Sentiment (Phase 8) ── */}
        {(() => {
          const reviews = rv(desc?.reviews);
          const sentiment = rv(desc?.sentiment_summary);
          if (!reviews || reviews.length === 0) return null;
          return (
            <div style={S.section}>
              <div style={S.sectionTitle}>
                Reviews & Sentiment ({reviews.length})
                {sentiment && (
                  <span style={{ marginLeft: '8px', color: sentiment.overall_score >= 0.3 ? '#4ade80' : sentiment.overall_score >= 0 ? '#f59e0b' : '#e06c75', fontWeight: 600 }}>
                    · score {(sentiment.overall_score >= 0 ? '+' : '')}{sentiment.overall_score.toFixed(2)}
                  </span>
                )}
              </div>
              {sentiment && (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  {sentiment.rating != null && (
                    <div style={{ ...S.attrCard, minWidth: '90px', textAlign: 'center' as const }}>
                      <div style={S.attrLabel}>Google Rating</div>
                      <div style={{ ...S.attrValue, color: '#f59e0b' }}>{sentiment.rating} ★</div>
                      {sentiment.total_ratings != null && (
                        <div style={{ fontSize: '10px', color: '#8892b0' }}>{sentiment.total_ratings.toLocaleString()} reviews</div>
                      )}
                    </div>
                  )}
                  {sentiment.hazard_flags.length > 0 && (
                    <div style={{ ...S.attrCard, flexGrow: 1 }}>
                      <div style={S.attrLabel}>Hazard Flags</div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {sentiment.hazard_flags.map(h => (
                          <span key={h} style={{ background: '#2d1a1a', border: '1px solid #7f1d1d', borderRadius: '3px', padding: '2px 6px', fontSize: '10px', color: '#fca5a5' }}>
                            {h}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {sentiment.amenity_gaps.length > 0 && (
                    <div style={{ ...S.attrCard, flexGrow: 1 }}>
                      <div style={S.attrLabel}>Amenity Gaps</div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {sentiment.amenity_gaps.map(g => (
                          <span key={g} style={{ background: '#1a1f2d', border: '1px solid #374151', borderRadius: '3px', padding: '2px 6px', fontSize: '10px', color: '#93c5fd' }}>
                            {g}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {reviews.map((r, i) => (
                  <div key={i} style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: '6px', padding: '10px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#f0f6fc' }}>{r.author}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#f59e0b' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                        <span style={{ fontSize: '10px', color: '#8892b0' }}>{r.publishTime.slice(0, 10)}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#cdd9e5', lineHeight: 1.55 }}>{r.text}</div>
                    {(r.hazard_mentions.length > 0 || r.amenity_mentions.length > 0) && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                        {r.hazard_mentions.map(h => (
                          <span key={h} style={{ background: '#2d1a1a', border: '1px solid #7f1d1d', borderRadius: '3px', padding: '1px 5px', fontSize: '9px', color: '#fca5a5' }}>⚠ {h}</span>
                        ))}
                        {r.amenity_mentions.map(a => (
                          <span key={a} style={{ background: '#0f2d1a', border: '1px solid #14532d', borderRadius: '3px', padding: '1px 5px', fontSize: '9px', color: '#86efac' }}>✓ {a}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '10px', color: '#8892b0', marginTop: '8px' }}>Source: Google Places</div>
            </div>
          );
        })()}

        {/* ── Recent Events (Phase 8) ── */}
        {(() => {
          const allEvents = rv(desc?.recent_events);
          if (!allEvents || allEvents.length === 0) return null;
          const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;
          const events = allEvents.filter(e => {
            const d = new Date(e.date);
            return !isNaN(d.getTime()) && Date.now() - d.getTime() < TWO_YEARS_MS;
          });
          if (events.length === 0) return (
            <div style={S.section}>
              <div style={S.sectionTitle}>Recent Events</div>
              <div style={{ color: '#8892b0', fontSize: '12px' }}>No events within the last 2 years.</div>
            </div>
          );
          const eventColor: Record<string, string> = {
            renovation: '#4ade80',
            ownership_change: '#4fc3f7',
            capex: '#a78bfa',
            news: '#8892b0',
          };
          return (
            <div style={S.section}>
              <div style={S.sectionTitle}>Recent Events ({events.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {events.map((e, i) => (
                  <div key={i} style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: '6px', padding: '10px 14px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: '80px' }}>
                      <div style={{ fontSize: '10px', color: '#8892b0' }}>{e.date.slice(0, 10)}</div>
                      <span style={{ background: '#0d1117', border: `1px solid ${eventColor[e.type] ?? '#30363d'}`, borderRadius: '3px', padding: '2px 6px', fontSize: '9px', color: eventColor[e.type] ?? '#8892b0', marginTop: '4px', display: 'inline-block', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
                        {e.type.replace('_', ' ')}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#f0f6fc', marginBottom: '3px' }}>{e.title}</div>
                      <div style={{ fontSize: '11px', color: '#8892b0', lineHeight: 1.4 }}>{e.summary}</div>
                      {e.source_url && (
                        <a href={e.source_url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: '10px', color: '#388bfd', textDecoration: 'none', marginTop: '4px', display: 'inline-block' }}>
                          → source
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '10px', color: '#8892b0', marginTop: '8px' }}>Source: web search synthesis</div>
            </div>
          );
        })()}

        {/* ── Time-series sparklines ── */}
        {ts && (
          <div style={S.section}>
            <div style={S.sectionTitle}>Time Series</div>
            <div style={S.sparkGrid}>
              <div style={S.sparkCard}>
                <div style={S.sparkLabel}>Asking Rent</div>
                {lastAskingRent != null && (
                  <div style={S.sparkValue}>${lastAskingRent.toLocaleString()}</div>
                )}
                <Sparkline points={ts.series.asking_rent} />
                <div style={{ fontSize: '10px', color: '#8892b0', marginTop: '4px' }}>
                  {ts.coverage.asking_rent?.observations_count ?? 0} obs
                  {ts.coverage.asking_rent?.date_range.start && ` · ${ts.coverage.asking_rent.date_range.start.slice(0,7)} → ${ts.coverage.asking_rent.date_range.end?.slice(0,7) ?? ''}`}
                </div>
              </div>

              <div style={S.sparkCard}>
                <div style={S.sparkLabel}>Avg Rent</div>
                {ts.series.avg_rent.slice(-1)[0]?.value != null && (
                  <div style={S.sparkValue}>${ts.series.avg_rent.slice(-1)[0].value!.toLocaleString()}</div>
                )}
                <Sparkline points={ts.series.avg_rent} />
                <div style={{ fontSize: '10px', color: '#8892b0', marginTop: '4px' }}>
                  {ts.coverage.avg_rent?.observations_count ?? 0} obs
                </div>
              </div>

              <div style={S.sparkCard}>
                <div style={S.sparkLabel}>Occupancy</div>
                {ts.series.occupancy.slice(-1)[0]?.value != null && (
                  <div style={S.sparkValue}>{ts.series.occupancy.slice(-1)[0].value!.toFixed(1)}%</div>
                )}
                <Sparkline points={ts.series.occupancy} />
                <div style={{ fontSize: '10px', color: '#8892b0', marginTop: '4px' }}>
                  {ts.coverage.occupancy?.observations_count ?? 0} obs
                </div>
              </div>

              <div style={S.sparkCard}>
                <div style={S.sparkLabel}>Signing Velocity</div>
                {lastVelocity != null && (
                  <div style={S.sparkValue}>{lastVelocity} leases/mo</div>
                )}
                <Sparkline points={ts.series.signing_velocity} />
                <div style={{ fontSize: '10px', color: '#8892b0', marginTop: '4px' }}>
                  {ts.coverage.signing_velocity?.observations_count ?? 0} obs
                </div>
              </div>

              <div style={S.sparkCard}>
                <div style={S.sparkLabel}>Concession / Unit</div>
                {ts.series.concession_per_unit.slice(-1)[0]?.value != null && (
                  <div style={S.sparkValue}>${ts.series.concession_per_unit.slice(-1)[0].value!.toLocaleString()}</div>
                )}
                <Sparkline points={ts.series.concession_per_unit} />
                <div style={{ fontSize: '10px', color: '#8892b0', marginTop: '4px' }}>
                  {ts.coverage.concession_per_unit?.observations_count ?? 0} obs
                </div>
              </div>
            </div>

            {(ts.series.asking_rent.length === 0 && ts.series.avg_rent.length === 0 &&
            ts.series.occupancy.length === 0) && (
              <div style={{ color: '#8892b0', fontSize: '12px', padding: '12px 0' }}>
                No time-series data yet for this property. Upload T-12 or rent roll files to populate.
              </div>
            )}
          </div>
        )}

        {/* ── Source documents ── */}
        <div style={S.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={S.sectionTitle}>Source Documents ({allFiles.length})</div>
          </div>

          {/* Filter tabs */}
          {docTypesPresent.length > 1 && (
            <div style={S.filterRow}>
              <button style={S.filterBtn(fileFilter === 'ALL')} onClick={() => setFileFilter('ALL')}>
                All ({allFiles.length})
              </button>
              {docTypesPresent.map((dt) => (
                <button key={dt} style={S.filterBtn(fileFilter === dt)} onClick={() => setFileFilter(dt)}>
                  {docTypeLabel(dt)} ({allFiles.filter((f) => f.document_type === dt).length})
                </button>
              ))}
            </div>
          )}

          {filteredFiles.length === 0 ? (
            <div style={{ color: '#8892b0', fontSize: '12px', padding: '12px 0' }}>
              No source documents attached yet.
            </div>
          ) : (
            <table style={S.fileTable}>
              <thead>
                <tr style={{ borderBottom: '1px solid #30363d' }}>
                  {['', 'Filename', 'Type', 'Parser', 'Size', 'Uploaded', ''].map((h, i) => (
                    <th key={i} style={{ ...S.fileTd, color: '#8892b0', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, textAlign: 'left' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file) => (
                  <FileRow key={file.id} file={file} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ParsedNarrative — inline citation links ──────────────────────────────────

function ParsedNarrative({ text }: { text: string }) {
  const CITATION_RE = /\[(https?:\/\/[^\]]+)\]/g;
  const parts: Array<{ type: 'text' | 'link'; content: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CITATION_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'link', content: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }
  let citationNum = 0;
  return (
    <span>
      {parts.map((p, i) => {
        if (p.type === 'text') return <span key={i}>{p.content}</span>;
        citationNum++;
        const num = citationNum;
        return (
          <a
            key={i}
            href={p.content}
            target="_blank"
            rel="noopener noreferrer"
            title={p.content}
            style={{
              color: '#388bfd', textDecoration: 'none', fontSize: '10px',
              verticalAlign: 'super', marginLeft: '1px',
            }}
          >
            [{num}]
          </a>
        );
      })}
    </span>
  );
}

// ─── FileRow sub-component ────────────────────────────────────────────────────

function FileRow({ file }: { file: DataLibraryFile }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const statusColor = STATUS_DOT[file.parser_status ?? ''] ?? '#8892b0';

  const td: React.CSSProperties = {
    padding: '8px 10px', verticalAlign: 'middle', borderBottom: '1px solid #21262d',
  };

  const handleDownload = () => {
    if (file.cdn_url) {
      window.open(file.cdn_url, '_blank', 'noopener');
    } else {
      void apiClient.get(`/api/v1/archive/files/${file.id}/url`)
        .then(({ data }) => { if (data.url) window.open(data.url, '_blank', 'noopener'); })
        .catch(() => alert('Download URL unavailable'));
    }
  };

  return (
    <tr style={{ transition: 'background 0.1s' }}>
      {/* status dot */}
      <td style={{ ...td, width: '18px' }}>
        <span title={file.parser_status ?? 'unknown'}
          style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: statusColor }} />
      </td>
      {/* filename */}
      <td style={{ ...td, maxWidth: '340px' }}>
        <span style={{ color: '#cdd9e5', wordBreak: 'break-all' }}>{file.original_filename}</span>
      </td>
      {/* doc type */}
      <td style={{ ...td, whiteSpace: 'nowrap' }}>
        <span style={{
          background: '#1f2937', border: '1px solid #374151', borderRadius: '3px',
          padding: '2px 6px', fontSize: '10px', color: '#93c5fd', letterSpacing: '0.06em',
        }}>
          {file.document_type}
        </span>
      </td>
      {/* parser status */}
      <td style={{ ...td, fontSize: '11px', color: statusColor, whiteSpace: 'nowrap' }}>
        {file.parser_status ?? '—'}
      </td>
      {/* size */}
      <td style={{ ...td, color: '#8892b0', fontSize: '11px', whiteSpace: 'nowrap' }}>
        {file.size_bytes != null ? formatSize(file.size_bytes) : '—'}
      </td>
      {/* uploaded */}
      <td style={{ ...td, color: '#8892b0', fontSize: '11px', whiteSpace: 'nowrap' }}>
        {file.uploaded_at ? new Date(file.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
      </td>
      {/* actions */}
      <td style={{ ...td, whiteSpace: 'nowrap' }}>
        <button
          onClick={handleDownload}
          style={{
            background: 'none', border: '1px solid #30363d', color: '#8892b0',
            borderRadius: '3px', padding: '2px 8px', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: '10px',
          }}
          onMouseEnter={e => { (e.currentTarget.style.borderColor = '#388bfd'); (e.currentTarget.style.color = '#4fc3f7'); }}
          onMouseLeave={e => { (e.currentTarget.style.borderColor = '#30363d'); (e.currentTarget.style.color = '#8892b0'); }}
        >
          ↓ Download
        </button>
      </td>
    </tr>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}
