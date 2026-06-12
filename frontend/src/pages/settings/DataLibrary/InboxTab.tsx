import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../services/api.client';
import { ChevronDown, ChevronRight, AlertTriangle, Clock, RefreshCw, Send, GitMerge } from 'lucide-react';

const MONO = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

interface LogEntry {
  step: string;
  status: 'ok' | 'blocked' | 'not_implemented' | 'error';
  ts: string;
  detail?: Record<string, unknown>;
}

interface ConflictEntry {
  step: string;
  field: string;
  value_a: string;
  source_a: string;
  value_b: string;
  source_b: string;
  detected_at: string;
}

interface IntakeJob {
  id: string;
  file_id: string | null;
  parcel_id: string | null;
  state: string;
  block_reason: string | null;
  conflict_data: ConflictEntry[] | null;
  user_input: Record<string, string> | null;
  source_type: string | null;
  source_data: Record<string, unknown> | null;
  enrichment_log: LogEntry[];
  created_at: string;
  updated_at: string;
  original_filename: string | null;
  document_type: string | null;
  size_bytes: number | null;
  mime_type: string | null;
}

interface IntakeSummary {
  pending?: number;
  parsing?: number;
  enriching?: number;
  awaiting_review?: number;
  complete?: number;
  blocked_needs_user?: number;
  failed?: number;
}

const STATE_FILTERS = ['ALL', 'pending', 'parsing', 'enriching', 'awaiting_review', 'complete', 'blocked_needs_user', 'failed'];
const STATE_COLOR: Record<string, string> = {
  pending: '#8892b0', parsing: '#4fc3f7', enriching: '#a78bfa',
  awaiting_review: '#f59e0b',
  complete: '#4ade80', blocked_needs_user: '#e06c75', failed: '#e06c75',
};
const STATE_LABEL: Record<string, string> = {
  pending: 'PENDING', parsing: 'PARSING', enriching: 'ENRICHING',
  awaiting_review: 'AWAITING REVIEW',
  complete: 'COMPLETE', blocked_needs_user: 'NEEDS INFO', failed: 'FAILED',
};

const IN_FLIGHT_STATES = new Set(['pending', 'parsing', 'enriching']);

const BLOCK_REASON_LABEL: Record<string, { short: string; detail: string }> = {
  no_parcel_id: {
    short: 'No parcel ID',
    detail: "The document doesn't contain a recognizable parcel identifier. Provide the parcel ID from the county assessor's website.",
  },
  no_address_match: {
    short: 'Address not matched',
    detail: 'The property address returned no results from the geocoder. Try supplying a cleaner address (e.g. "123 Main St, Atlanta, GA 30301").',
  },
  no_municipal_hit: {
    short: 'No municipal record',
    detail: 'County/municipal records returned no data for this property. Verify the parcel ID or address and resubmit.',
  },
  parcel_not_found: {
    short: 'Parcel not found',
    detail: 'The parcel ID was not found in the county database. Check for typos or try a different county.',
  },
  ambiguous_address: {
    short: 'Ambiguous address',
    detail: 'Multiple properties matched this address. Supply a parcel ID to uniquely identify the property.',
  },
  geocode_failed: {
    short: 'Geocoding failed',
    detail: 'The address could not be converted to coordinates. Provide a full street address with city and state.',
  },
  missing_property_name: {
    short: 'No property name',
    detail: 'The intake source did not include a property name. Provide a name so the record can be matched.',
  },
  duplicate_parcel: {
    short: 'Duplicate parcel',
    detail: 'A record with this parcel ID already exists. Confirm this is a new submission or supply a different parcel ID.',
  },
  parcel_id_conflict: {
    short: 'Parcel ID conflict',
    detail: 'Two different sources returned different parcel IDs for this property. Select the correct one below or enter the right ID manually.',
  },
};

function resolveBlockReason(raw: string | null): { short: string; detail: string } {
  if (!raw) return { short: 'Unknown block', detail: 'No block reason was recorded. Supply a parcel ID, address, or property name to retry.' };
  const known = BLOCK_REASON_LABEL[raw];
  if (known) return known;
  return { short: raw.replace(/_/g, ' '), detail: 'Provide a parcel ID, address, or property name to retry enrichment.' };
}

function getPropertyDisplay(job: IntakeJob): { name: string | null; address: string | null } {
  const sd = job.source_data || {};
  const name =
    (sd.property_name as string) ||
    (sd.name as string) ||
    job.original_filename ||
    null;
  const address =
    (sd.address as string) ||
    (sd.street_address as string) ||
    (sd.full_address as string) ||
    null;
  return { name, address };
}

function fmtDateTime(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtRelative(d: string | null): string {
  if (!d) return '—';
  const diffMs = Date.now() - new Date(d).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks} wk${diffWeeks === 1 ? '' : 's'} ago`;
}

function getAgeMs(d: string | null): number {
  if (!d) return 0;
  return Date.now() - new Date(d).getTime();
}

const LOG_STATUS_COLOR: Record<string, string> = {
  ok: '#4ade80', blocked: '#e06c75', error: '#e06c75', not_implemented: '#8892b0',
};

const chipBtn = (active: boolean): React.CSSProperties => ({
  background: active ? '#1f3a5c' : 'transparent',
  border: `1px solid ${active ? '#388bfd' : '#30363d'}`,
  color: active ? '#4fc3f7' : '#8892b0',
  borderRadius: '12px', padding: '2px 10px', cursor: 'pointer',
  fontFamily: MONO, fontSize: 11,
});

interface BlockedJobCardProps {
  job: IntakeJob;
  onResolved: (jobId: string, updatedJob: Partial<IntakeJob>) => void;
}

/** Sub-component rendered inside BlockedJobCard when block_reason === 'parcel_id_conflict' */
function ParcelConflictResolver({ job, onResolved }: BlockedJobCardProps) {
  const conflicts = Array.isArray(job.conflict_data) ? job.conflict_data : [];
  // Use the first parcel_id conflict entry; fall back to first entry of any kind
  const entry = conflicts.find(c => c.field === 'parcel_id') ?? conflicts[0] ?? null;

  const [selected, setSelected] = useState<'a' | 'b' | 'custom' | null>(null);
  const [customValue, setCustomValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const resolvedValue =
    selected === 'a' ? (entry?.value_a ?? '')
    : selected === 'b' ? (entry?.value_b ?? '')
    : selected === 'custom' ? customValue.trim()
    : '';

  const canSubmit = !submitting && resolvedValue.length > 0;

  const handlePickAndSubmit = async (pick: 'a' | 'b' | 'custom') => {
    const value =
      pick === 'a' ? (entry?.value_a ?? '')
      : pick === 'b' ? (entry?.value_b ?? '')
      : customValue.trim();

    if (!value) {
      setSubmitError('Enter a parcel ID before submitting.');
      return;
    }
    setSelected(pick);
    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiClient.patch(`/api/v1/intake-jobs/${job.id}/user-input`, { resolved_parcel_id: value });
      onResolved(job.id, { state: 'pending', block_reason: null, conflict_data: null, enrichment_log: [] });
    } catch (err: any) {
      setSubmitError(err?.response?.data?.error || 'Failed to submit. Please try again.');
      setSelected(null);
    } finally {
      setSubmitting(false);
    }
  };

  const candidateCard = (
    label: string,
    value: string,
    source: string,
    side: 'a' | 'b',
  ) => (
    <div style={{
      flex: 1,
      background: '#0d1117',
      border: '1px solid #21262d',
      borderRadius: 6,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ color: '#8892b0', fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}>
        {label}
      </div>
      <div style={{
        color: '#e3c07e',
        fontFamily: MONO,
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: '0.04em',
        wordBreak: 'break-all',
      }}>
        {value || <span style={{ color: '#555e6b' }}>(empty)</span>}
      </div>
      <div style={{ color: '#8892b0', fontFamily: MONO, fontSize: 10 }}>
        <span style={{ color: '#555e6b' }}>source:</span> {source}
      </div>
      <button
        disabled={submitting}
        onClick={() => handlePickAndSubmit(side)}
        style={{
          marginTop: 'auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          background: submitting ? '#161b22' : '#1f3a1f',
          border: `1px solid ${submitting ? '#30363d' : '#4ade8066'}`,
          color: submitting ? '#555e6b' : '#4ade80',
          borderRadius: 4, padding: '7px 14px',
          cursor: submitting ? 'default' : 'pointer',
          fontFamily: MONO, fontSize: 11, fontWeight: 700,
          transition: 'all 0.15s ease',
        }}
      >
        {submitting && selected === side
          ? <><RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> Requeueing…</>
          : 'Use this'}
      </button>
    </div>
  );

  return (
    <div>
      {/* Explanation banner */}
      <div style={{
        background: '#1a1200', border: '1px solid #b8860b44', borderRadius: 4,
        padding: '10px 12px', marginBottom: 16,
        display: 'flex', alignItems: 'flex-start', gap: 8,
      }}>
        <GitMerge size={13} style={{ color: '#e3c07e', flexShrink: 0, marginTop: 1 }} />
        <div style={{ color: '#cdd9e5', fontFamily: MONO, fontSize: 11, lineHeight: 1.6 }}>
          Two sources disagree on the parcel ID for this property. Pick the correct one
          or enter the right ID manually — the job will requeue immediately.
        </div>
      </div>

      {/* Side-by-side candidates */}
      {entry ? (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {candidateCard('OPTION A', entry.value_a, entry.source_a, 'a')}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#555e6b', fontFamily: MONO, fontSize: 10, fontWeight: 700,
            flexShrink: 0,
          }}>
            VS
          </div>
          {candidateCard('OPTION B', entry.value_b, entry.source_b, 'b')}
        </div>
      ) : (
        <div style={{ color: '#8892b0', fontFamily: MONO, fontSize: 11, marginBottom: 16 }}>
          No conflict details were recorded. Enter the correct parcel ID manually below.
        </div>
      )}

      {/* Manual entry fallback */}
      <div style={{
        borderTop: '1px solid #21262d', paddingTop: 14,
        display: 'flex', alignItems: 'flex-end', gap: 10,
      }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', color: '#8892b0', fontFamily: MONO, fontSize: 10, fontWeight: 700, marginBottom: 4, letterSpacing: '0.08em' }}>
            OR ENTER PARCEL ID MANUALLY
          </label>
          <input
            type="text"
            value={customValue}
            onChange={e => { setCustomValue(e.target.value); setSelected('custom'); }}
            placeholder="e.g. 18-200-01-023"
            disabled={submitting}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#0d1117', border: '1px solid #30363d', borderRadius: 4,
              color: '#cdd9e5', fontFamily: MONO, fontSize: 11,
              padding: '7px 10px', outline: 'none',
              opacity: submitting ? 0.5 : 1,
            }}
          />
        </div>
        <button
          disabled={!canSubmit || !customValue.trim()}
          onClick={() => handlePickAndSubmit('custom')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: canSubmit && customValue.trim() ? '#1a3a1f' : '#161b22',
            border: `1px solid ${canSubmit && customValue.trim() ? '#4ade8066' : '#30363d'}`,
            color: canSubmit && customValue.trim() ? '#4ade80' : '#555e6b',
            borderRadius: 4, padding: '7px 14px',
            cursor: canSubmit && customValue.trim() ? 'pointer' : 'default',
            fontFamily: MONO, fontSize: 11, fontWeight: 700,
            transition: 'all 0.15s ease', whiteSpace: 'nowrap',
          }}
        >
          {submitting && selected === 'custom'
            ? <><RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> Requeueing…</>
            : <><Send size={11} /> Use manual ID</>
          }
        </button>
      </div>

      {submitError && (
        <div style={{ color: '#e06c75', fontFamily: MONO, fontSize: 11, marginTop: 10 }}>
          {submitError}
        </div>
      )}
    </div>
  );
}

function BlockedJobCard({ job, onResolved }: BlockedJobCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [formParcelId, setFormParcelId] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formPropertyName, setFormPropertyName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { name, address } = getPropertyDisplay(job);
  const { short: reasonShort, detail: reasonDetail } = resolveBlockReason(job.block_reason);

  const isConflict = job.block_reason === 'parcel_id_conflict';

  // Determine the best age reference: earliest detected_at from conflict entries, else updated_at
  const ageRefTs: string | null = (() => {
    if (Array.isArray(job.conflict_data) && job.conflict_data.length > 0) {
      const dates = job.conflict_data.map(c => c.detected_at).filter(Boolean);
      if (dates.length > 0) return dates.reduce((a, b) => (a < b ? a : b));
    }
    return job.updated_at;
  })();

  const ageMs = getAgeMs(ageRefTs);
  const isUrgent = ageMs > 24 * 60 * 60 * 1000;
  const ageBadgeLabel = fmtRelative(ageRefTs);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input: Record<string, string> = {};
    if (formParcelId.trim()) input.parcel_id = formParcelId.trim();
    if (formAddress.trim()) input.address = formAddress.trim();
    if (formPropertyName.trim()) input.property_name = formPropertyName.trim();

    if (Object.keys(input).length === 0) {
      setSubmitError('Please fill in at least one field before submitting.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiClient.post(`/api/v1/intake-jobs/${job.id}/user-input`, input);
      onResolved(job.id, { state: 'pending', block_reason: null, enrichment_log: [] });
    } catch (err: any) {
      setSubmitError(err?.response?.data?.error || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const hasAnyInput = formParcelId.trim() || formAddress.trim() || formPropertyName.trim();

  // Urgent (>24h) cards get a warmer orange accent regardless of type
  const accentColor = isUrgent ? '#f97316' : (isConflict ? '#e3c07e' : '#e06c75');
  const borderColor = isUrgent ? '#4a2800' : (isConflict ? '#4a3a10' : '#4a2020');
  const bgColor = isUrgent ? '#1a0d00' : (isConflict ? '#1a1200' : '#1a0f0f');
  const chipBg = isUrgent ? '#2d1800' : (isConflict ? '#2d2200' : '#2d1515');
  const chipBorder = isUrgent ? '#f9731644' : (isConflict ? '#e3c07e44' : '#e06c7544');
  const expandedBorder = isUrgent ? '#2d1800' : (isConflict ? '#2d2200' : '#2d1515');

  return (
    <div style={{
      border: `1px solid ${borderColor}`,
      borderLeft: `3px solid ${accentColor}`,
      borderRadius: 6,
      background: bgColor,
      marginBottom: 8,
      overflow: 'hidden',
    }}>
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
        }}
      >
        {isConflict
          ? <GitMerge size={14} style={{ color: accentColor, flexShrink: 0 }} />
          : <AlertTriangle size={14} style={{ color: accentColor, flexShrink: 0 }} />
        }

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: '#cdd9e5', fontFamily: MONO, fontSize: 12, fontWeight: 600 }}>
              {name || '(unnamed property)'}
            </span>
            {address && (
              <span style={{ color: '#8892b0', fontFamily: MONO, fontSize: 11 }}>
                {address}
              </span>
            )}
          </div>
          <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              background: chipBg, border: `1px solid ${chipBorder}`,
              color: accentColor, borderRadius: 3,
              padding: '1px 7px', fontFamily: MONO, fontSize: 10, fontWeight: 700,
            }}>
              {reasonShort}
            </span>
            {job.original_filename && (
              <span style={{ color: '#555e6b', fontFamily: MONO, fontSize: 10 }}>
                {job.original_filename}
              </span>
            )}
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
              {isUrgent && (
                <span style={{
                  background: '#f9731622', border: `1px solid #f9731655`,
                  color: '#f97316', borderRadius: 3,
                  padding: '1px 6px', fontFamily: MONO, fontSize: 10, fontWeight: 700,
                }}>
                  URGENT
                </span>
              )}
              <span style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: isUrgent ? '#f9731618' : 'transparent',
                border: isUrgent ? `1px solid #f9731633` : '1px solid transparent',
                color: isUrgent ? '#f97316' : '#555e6b',
                borderRadius: 3, padding: isUrgent ? '1px 6px' : '1px 0',
                fontFamily: MONO, fontSize: 10,
              }}>
                <Clock size={9} style={{ flexShrink: 0 }} />
                {ageBadgeLabel}
              </span>
            </span>
          </div>
        </div>

        <div style={{ color: '#8892b0', flexShrink: 0 }}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${expandedBorder}`, padding: '14px 16px' }}>

          {/* Conflict resolution UI — replaces generic form for parcel_id_conflict */}
          {isConflict ? (
            <ParcelConflictResolver job={job} onResolved={onResolved} />
          ) : (
            <>
              {/* Block reason explanation */}
              <div style={{
                background: '#1f1212', border: '1px solid #3d1f1f', borderRadius: 4,
                padding: '10px 12px', marginBottom: 14,
              }}>
                <div style={{ color: '#e06c75', fontFamily: MONO, fontSize: 10, fontWeight: 700, marginBottom: 4 }}>
                  WHY THIS JOB IS BLOCKED
                </div>
                <div style={{ color: '#cdd9e5', fontFamily: MONO, fontSize: 11, lineHeight: 1.6 }}>
                  {reasonDetail}
                </div>
              </div>

              {/* Enrichment log */}
              {Array.isArray(job.enrichment_log) && job.enrichment_log.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ color: '#8892b0', fontFamily: MONO, fontSize: 10, fontWeight: 700, marginBottom: 6, letterSpacing: '0.08em' }}>
                    ENRICHMENT STEPS TRIED
                  </div>
                  <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 4, overflow: 'hidden' }}>
                    {job.enrichment_log.map((entry, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '7px 12px', display: 'flex', alignItems: 'flex-start', gap: 10,
                          borderBottom: idx < job.enrichment_log.length - 1 ? '1px solid #21262d' : 'none',
                        }}
                      >
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%', marginTop: 3, flexShrink: 0,
                          background: LOG_STATUS_COLOR[entry.status] || '#8892b0',
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: '#cdd9e5', fontFamily: MONO, fontSize: 11 }}>{entry.step}</span>
                            <span style={{
                              color: LOG_STATUS_COLOR[entry.status] || '#8892b0',
                              fontFamily: MONO, fontSize: 10, textTransform: 'uppercase',
                            }}>{entry.status}</span>
                            <span style={{ color: '#555e6b', fontFamily: MONO, fontSize: 10, marginLeft: 'auto' }}>
                              {entry.ts ? new Date(entry.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                            </span>
                          </div>
                          {entry.detail && Object.keys(entry.detail).length > 0 && (
                            <div style={{ color: '#8892b0', fontFamily: MONO, fontSize: 10, marginTop: 2, wordBreak: 'break-all' }}>
                              {Object.entries(entry.detail).map(([k, v]) => (
                                <span key={k} style={{ marginRight: 10 }}>
                                  <span style={{ color: '#555e6b' }}>{k}:</span> {String(v)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resolution form */}
              <div style={{ borderTop: '1px solid #2d1515', paddingTop: 14 }}>
                <div style={{ color: '#8892b0', fontFamily: MONO, fontSize: 10, fontWeight: 700, marginBottom: 10, letterSpacing: '0.08em' }}>
                  SUBMIT CORRECTION — fill in what you know
                </div>
                <form onSubmit={handleSubmit}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div>
                      <label style={{ display: 'block', color: '#8892b0', fontFamily: MONO, fontSize: 10, marginBottom: 4 }}>
                        PARCEL ID
                      </label>
                      <input
                        type="text"
                        value={formParcelId}
                        onChange={e => setFormParcelId(e.target.value)}
                        placeholder="e.g. 18-200-01-023"
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          background: '#0d1117', border: '1px solid #30363d', borderRadius: 4,
                          color: '#cdd9e5', fontFamily: MONO, fontSize: 11,
                          padding: '7px 10px', outline: 'none',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', color: '#8892b0', fontFamily: MONO, fontSize: 10, marginBottom: 4 }}>
                        ADDRESS
                      </label>
                      <input
                        type="text"
                        value={formAddress}
                        onChange={e => setFormAddress(e.target.value)}
                        placeholder="e.g. 123 Main St, Atlanta, GA"
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          background: '#0d1117', border: '1px solid #30363d', borderRadius: 4,
                          color: '#cdd9e5', fontFamily: MONO, fontSize: 11,
                          padding: '7px 10px', outline: 'none',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', color: '#8892b0', fontFamily: MONO, fontSize: 10, marginBottom: 4 }}>
                        PROPERTY NAME
                      </label>
                      <input
                        type="text"
                        value={formPropertyName}
                        onChange={e => setFormPropertyName(e.target.value)}
                        placeholder="e.g. Highlands at Sweetwater"
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          background: '#0d1117', border: '1px solid #30363d', borderRadius: 4,
                          color: '#cdd9e5', fontFamily: MONO, fontSize: 11,
                          padding: '7px 10px', outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  {submitError && (
                    <div style={{ color: '#e06c75', fontFamily: MONO, fontSize: 11, marginBottom: 10 }}>
                      {submitError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || !hasAnyInput}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: hasAnyInput && !submitting ? '#1a3a1f' : '#161b22',
                      border: `1px solid ${hasAnyInput && !submitting ? '#4ade8066' : '#30363d'}`,
                      color: hasAnyInput && !submitting ? '#4ade80' : '#555e6b',
                      borderRadius: 4, padding: '7px 14px', cursor: hasAnyInput && !submitting ? 'pointer' : 'default',
                      fontFamily: MONO, fontSize: 11, fontWeight: 700,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {submitting
                      ? <><RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Requeueing…</>
                      : <><Send size={12} /> Requeue Job</>
                    }
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface PendingJobRowProps {
  job: IntakeJob;
  navigate: ReturnType<typeof useNavigate>;
  isPolling?: boolean;
}

function PendingJobRow({ job, navigate, isPolling }: PendingJobRowProps) {
  return (
    <tr
      style={{ borderBottom: '1px solid #21262d' }}
      onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#161b22'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
    >
      <td style={{ padding: '8px', color: '#cdd9e5', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {job.original_filename || '—'}
      </td>
      <td style={{ padding: '8px' }}>
        <span style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 3, padding: '1px 6px', fontSize: 10, color: '#93c5fd' }}>
          {job.document_type || '—'}
        </span>
      </td>
      <td style={{ padding: '8px', fontFamily: MONO, fontSize: 11 }}>
        <span style={{ color: STATE_COLOR[job.state] || '#8892b0', fontWeight: 600 }}>
          {STATE_LABEL[job.state] || job.state}
        </span>
        {isPolling && IN_FLIGHT_STATES.has(job.state) && (
          <RefreshCw size={10} style={{ marginLeft: 6, color: '#555e6b', animation: 'spin 2s linear infinite', verticalAlign: 'middle' }} />
        )}
      </td>
      <td style={{ padding: '8px', color: '#8892b0', fontSize: 10, fontFamily: MONO }}>{job.parcel_id || '—'}</td>
      <td style={{ padding: '8px', color: '#8892b0', fontSize: 10, fontFamily: MONO }}>{fmtDateTime(job.updated_at)}</td>
      <td style={{ padding: '8px' }}>
        {job.state === 'awaiting_review' && job.parcel_id && (
          <button
            onClick={() => navigate(`/archive/properties/${encodeURIComponent(job.parcel_id!)}`)}
            style={{
              background: '#f59e0b22', border: '1px solid #f59e0b66', color: '#f59e0b',
              borderRadius: 3, padding: '3px 8px', cursor: 'pointer',
              fontFamily: MONO, fontSize: 10, fontWeight: 700,
            }}
          >Review →</button>
        )}
      </td>
    </tr>
  );
}

const POLL_INTERVAL_MS = 10_000;

export function InboxTab() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<IntakeJob[]>([]);
  const [summary, setSummary] = useState<IntakeSummary | null>(null);
  const [pagination, setPagination] = useState<{ total: number; page: number; limit: number; pages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  // pollingJobIds: IDs of jobs requeued by the analyst that need state-transition tracking.
  // Polling must NOT use the current stateFilter — a requeued job moves to 'pending', which
  // won't appear in a 'blocked_needs_user' filter query. We always fetch unfiltered for polling.
  const [pollingJobIds, setPollingJobIds] = useState<Set<string>>(new Set());
  const pollingJobIdsRef = useRef<Set<string>>(new Set());
  // Keep the ref in sync so the interval closure never reads stale IDs
  useEffect(() => { pollingJobIdsRef.current = pollingJobIds; }, [pollingJobIds]);

  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (stateFilter !== 'ALL') params.set('state', stateFilter);
      params.set('page', String(page));
      params.set('limit', '25');
      const res = await apiClient.get(`/api/v1/intake-jobs?${params}`);
      setJobs(res.data.jobs || []);
      setPagination(res.data.pagination || null);
    } catch (err) {
      console.error('Failed to fetch intake jobs:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [stateFilter, page]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/v1/intake-jobs/summary');
      setSummary(res.data);
    } catch (err) {
      console.error('Failed to fetch intake summary:', err);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // Polling effect — decoupled from stateFilter so requeued jobs are always found.
  // Uses an unfiltered (ALL) fetch so the job is visible regardless of its current state.
  // Cleans up the interval every time pollingJobIds changes (new job added or all removed).
  useEffect(() => {
    if (pollingJobIds.size === 0) return;

    const timer = setInterval(async () => {
      const ids = pollingJobIdsRef.current;
      if (ids.size === 0) return;

      try {
        // Always fetch without a state filter so requeued jobs are found at any state
        const res = await apiClient.get('/api/v1/intake-jobs?limit=100&page=1');
        const freshJobs: IntakeJob[] = res.data.jobs || [];

        const toRemove: string[] = [];

        setJobs(prev => prev.map(job => {
          if (!ids.has(job.id)) return job;
          const fresh = freshJobs.find(j => j.id === job.id);
          if (!fresh) {
            // Job not returned at all — stop watching it to prevent orphan
            toRemove.push(job.id);
            return job;
          }
          if (!IN_FLIGHT_STATES.has(fresh.state)) {
            // Reached a terminal/stable state — stop polling
            toRemove.push(job.id);
          }
          return fresh;
        }));

        // Refresh summary counts after a polled job transitions
        try {
          const summaryRes = await apiClient.get('/api/v1/intake-jobs/summary');
          setSummary(summaryRes.data);
        } catch { /* non-critical */ }

        if (toRemove.length > 0) {
          setPollingJobIds(prev => {
            const next = new Set(prev);
            toRemove.forEach(id => next.delete(id));
            return next;
          });
        }
      } catch {
        // Network error — will retry next tick
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [pollingJobIds]); // Recreate interval whenever the watched set changes

  const handleResolved = useCallback((jobId: string, updatedFields: Partial<IntakeJob>) => {
    // Optimistically update the row so the analyst sees 'pending' immediately,
    // even if the current filter would hide it on the next normal fetch.
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...updatedFields } : j));
    // Register for polling — next tick will track state transitions without the filter constraint
    setPollingJobIds(prev => new Set([...prev, jobId]));
    fetchSummary();
  }, [fetchSummary]);

  const blockedJobs = jobs.filter(j => j.state === 'blocked_needs_user');
  const nonBlockedJobs = jobs.filter(j => j.state !== 'blocked_needs_user');

  const showBlockedSection = stateFilter === 'ALL' || stateFilter === 'blocked_needs_user';
  const showOtherTable = stateFilter !== 'blocked_needs_user' && nonBlockedJobs.length > 0;

  return (
    <div style={{ padding: '16px 20px' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Summary chips */}
      {summary && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'PENDING', value: summary.pending ?? 0, color: '#8892b0' },
            { label: 'PARSING', value: summary.parsing ?? 0, color: '#4fc3f7' },
            { label: 'ENRICHING', value: summary.enriching ?? 0, color: '#a78bfa' },
            { label: 'AWAITING REVIEW', value: summary.awaiting_review ?? 0, color: '#f59e0b' },
            { label: 'COMPLETE', value: summary.complete ?? 0, color: '#4ade80' },
            { label: 'NEEDS INFO', value: summary.blocked_needs_user ?? 0, color: '#e06c75' },
            { label: 'FAILED', value: summary.failed ?? 0, color: '#e06c75' },
          ].map((s, i) => (
            <div key={i} style={{
              padding: '10px 14px', background: '#161b22',
              border: `1px solid ${s.label === 'NEEDS INFO' && s.value > 0 ? '#4a2020' : '#21262d'}`,
              borderRadius: 6, minWidth: 80, textAlign: 'center',
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color, fontFamily: MONO }}>{s.value}</div>
              <div style={{ fontSize: 9, color: '#8892b0', fontFamily: MONO, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
          <button
            onClick={() => { fetchJobs(); fetchSummary(); }}
            title="Refresh"
            style={{
              background: 'none', border: '1px solid #30363d', borderRadius: 6,
              color: '#8892b0', cursor: 'pointer', padding: '10px 12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      )}

      {/* State filter chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {STATE_FILTERS.map(sf => (
          <button key={sf} onClick={() => { setStateFilter(sf); setPage(1); }} style={chipBtn(stateFilter === sf)}>
            {sf === 'ALL' ? 'All' : (STATE_LABEL[sf] ?? sf)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#8892b0', padding: '40px', textAlign: 'center', fontFamily: MONO, fontSize: 12 }}>
          Loading jobs…
        </div>
      ) : jobs.length === 0 ? (
        <div style={{ color: '#8892b0', padding: '40px', textAlign: 'center', fontFamily: MONO, fontSize: 12 }}>
          No intake jobs match the current filter.
        </div>
      ) : (
        <>
          {/* ── Blocked jobs section ── */}
          {showBlockedSection && blockedJobs.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
                paddingBottom: 8, borderBottom: '1px solid #2d1515',
              }}>
                <AlertTriangle size={14} style={{ color: '#e06c75' }} />
                <span style={{ color: '#e06c75', fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}>
                  NEEDS RESOLUTION ({blockedJobs.length})
                </span>
                <span style={{ color: '#555e6b', fontFamily: MONO, fontSize: 10, marginLeft: 4 }}>
                  — expand a job to submit a correction
                </span>
              </div>
              {blockedJobs.map(job => (
                <BlockedJobCard key={job.id} job={job} onResolved={handleResolved} />
              ))}
            </div>
          )}

          {/* ── Other jobs table ── */}
          {showOtherTable && (
            <div>
              {showBlockedSection && blockedJobs.length > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
                  paddingBottom: 8, borderBottom: '1px solid #21262d',
                }}>
                  <Clock size={13} style={{ color: '#8892b0' }} />
                  <span style={{ color: '#8892b0', fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}>
                    OTHER JOBS
                  </span>
                </div>
              )}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 11 }}>
                <thead>
                  <tr>
                    {['Filename', 'Type', 'State', 'Parcel', 'Updated', ''].map((h, i) => (
                      <th key={i} style={{
                        padding: '8px', textAlign: 'left', color: '#8892b0',
                        fontWeight: 600, fontSize: 10, borderBottom: '2px solid #21262d',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {nonBlockedJobs.map(job => (
                    <PendingJobRow
                      key={job.id}
                      job={job}
                      navigate={navigate}
                      isPolling={pollingJobIds.has(job.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Blocked-only view showing no other jobs */}
          {stateFilter === 'blocked_needs_user' && nonBlockedJobs.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
                paddingBottom: 8, borderBottom: '1px solid #21262d',
              }}>
                <Clock size={13} style={{ color: '#8892b0' }} />
                <span style={{ color: '#8892b0', fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}>
                  RECENTLY REQUEUED
                </span>
                <span style={{ color: '#555e6b', fontFamily: MONO, fontSize: 10 }}>
                  — jobs submitted from this session
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 11 }}>
                <thead>
                  <tr>
                    {['Filename', 'Type', 'State', 'Parcel', 'Updated', ''].map((h, i) => (
                      <th key={i} style={{
                        padding: '8px', textAlign: 'left', color: '#8892b0',
                        fontWeight: 600, fontSize: 10, borderBottom: '2px solid #21262d',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {nonBlockedJobs.map(job => (
                    <PendingJobRow
                      key={job.id}
                      job={job}
                      navigate={navigate}
                      isPolling={pollingJobIds.has(job.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', marginTop: 16 }}>
          <span style={{ color: '#8892b0', fontSize: 11, fontFamily: MONO }}>
            Page {pagination.page} of {pagination.pages} · {pagination.total.toLocaleString()} jobs
          </span>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}
            style={{
              background: 'none', border: '1px solid #30363d', color: page <= 1 ? '#30363d' : '#8892b0',
              borderRadius: 4, padding: '4px 12px', cursor: page <= 1 ? 'default' : 'pointer',
              fontFamily: MONO, fontSize: 11,
            }}
          >← Prev</button>
          <button disabled={page >= (pagination?.pages || 1)} onClick={() => setPage(page + 1)}
            style={{
              background: 'none', border: '1px solid #30363d', color: page >= (pagination?.pages || 1) ? '#30363d' : '#8892b0',
              borderRadius: 4, padding: '4px 12px', cursor: page >= (pagination?.pages || 1) ? 'default' : 'pointer',
              fontFamily: MONO, fontSize: 11,
            }}
          >Next →</button>
        </div>
      )}
    </div>
  );
}
