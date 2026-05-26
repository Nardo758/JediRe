// ============================================================================
// OtherIncomeTab — Editable ancillary / other income page (Phase 1 + Phase 4)
// Task #1145: Split Unit Mix and Other Income into separate ConsoleHubTab pages
// Task #1153: Adoption timeline for new income sources (ramp-up schedule)
// ============================================================================
//
// Hosts the AncillaryPanel content that was previously read-only inside
// UnitMixTab. Categories are now editable inline; user-added custom lines
// can be managed (add / edit / delete) directly here without navigating to
// the Pro Forma tab.
//
// Phase 4 (Task #1153): Each custom line can optionally carry an adoption
// timeline block (ramp_start_period, ramp_duration_months,
// steady_state_monthly, probability_adopted). Development deals default all
// new lines to adoption_required: true. The backend proforma-seeder applies
// the ramp formula per year when adoption is set.
//
// Data flow:
//   READ  — GET /api/v1/deals/:dealId/financials  (otherIncomeBreakdown + otherIncomeUserLines)
//   WRITE — PATCH /api/v1/deals/:dealId/financials/other-income/category-overrides
//           POST/PATCH/DELETE /api/v1/deals/:dealId/financials/other-income/user-lines[/:id]
// ============================================================================

import React, { useState, useCallback, useEffect } from 'react';
import {
  RefreshCw, Loader2, Plus, Edit3, Trash2, Check, X, RotateCcw,
  AlertTriangle, ChevronDown, ChevronRight, Lightbulb, TrendingUp, BarChart2,
} from 'lucide-react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { apiClient } from '../../../services/api.client';
import { useDesignProgramStore } from '../../../stores/designProgram.store';
import type { FinancialEngineTabProps } from './types';

const MONO  = BT.font.mono;
const LABEL = BT.font.label;

const C = {
  bg:       '#080c12',
  panel:    '#0d1520',
  panelAlt: '#0a1018',
  border:   '#1a2535',
  borderHi: '#1e3a5f',
  cyan:     '#00d4ff',
  cyanDim:  '#0a3040',
  amber:    '#f59e0b',
  amberDim: '#2a1a00',
  green:    '#22c55e',
  greenDim: '#0a2010',
  red:      '#ef4444',
  redDim:   '#2a0808',
  purple:   '#a78bfa',
  purpleDim:'#1a1030',
  teal:     '#2dd4bf',
  tealDim:  '#0a2020',
  text:     '#e2e8f0',
  muted:    '#64748b',
  dim:      '#334155',
};

const fmt$ = (v: number | null | undefined) =>
  v == null ? '—' : `$${Math.round(v).toLocaleString()}`;

function th(right = false): React.CSSProperties {
  return {
    padding: '5px 8px',
    fontFamily: LABEL, fontSize: 8, fontWeight: 700,
    color: C.muted, textAlign: right ? 'right' : 'left',
    borderBottom: `1px solid ${C.border}`,
    whiteSpace: 'nowrap', letterSpacing: '0.06em',
  };
}
function td(right = false, bold = false, color?: string): React.CSSProperties {
  return {
    padding: '5px 8px',
    fontFamily: MONO, fontSize: 10,
    color: color ?? C.text,
    fontWeight: bold ? 700 : 400,
    textAlign: right ? 'right' : 'left',
    borderBottom: `1px solid ${C.border}`,
    whiteSpace: 'nowrap',
  };
}

const ANCILLARY_LABELS: Record<string, string> = {
  parking:         'Parking',
  pet:             'Pet Rent',
  storage:         'Storage',
  laundry:         'Laundry',
  rubs:            'RUBS / Utility Reimb.',
  fees:            'Admin / App / Late Fees',
  insurance_admin: 'Renters Insurance',
  other:           'Other Ancillary',
};

const SRC_BADGE: Record<string, { label: string; color: string }> = {
  rent_roll:        { label: 'RR',    color: C.cyan   },
  t12:              { label: 'T-12',  color: C.muted  },
  om:               { label: 'OM',    color: C.amber  },
  override:         { label: 'OVR',   color: C.purple },
  user_override:    { label: 'OVR',   color: C.purple },
  platform_fallback:{ label: '—',     color: C.dim    },
  unseeded:         { label: '—',     color: C.dim    },
};

interface AdoptionBlock {
  ramp_start_period: number;
  ramp_duration_months: number;
  steady_state_monthly: number;
  probability_adopted: number;
}

interface OtherIncomeBreakdownRow {
  category: string;
  rent_roll: number | null;
  t12: number | null;
  om: number | null;
  resolved: number | null;
  resolution: string;
  conflict: boolean;
}

interface OtherIncomeBreakdown {
  rows: OtherIncomeBreakdownRow[];
  total: { rent_roll: number | null; t12: number | null; om: number | null; resolved: number };
}

interface UserLine {
  id: string;
  label: string;
  monthly: number;
  qty?: number;
  rate?: number;
  frequency?: 'monthly' | 'annual';
  note?: string;
  source_tag?: string;
  confirmed?: boolean;
  created_at: string;
  adoption?: AdoptionBlock | null;
  confirmed?: boolean;
}

// ── Program suggestion config ────────────────────────────────────────────────
interface AmenitySuggestion {
  sourceTagKey: string;
  label: string;
  incomeCategory: string;
  rangeMin: number;
  rangeMax: number;
  rangeUnit: 'unit' | 'space';
  note: string;
}

const AMENITY_SUGGESTION_MAP: Record<string, AmenitySuggestion> = {
  'Pool & Sundeck': {
    sourceTagKey: 'pool', label: 'Pool / Amenity Fee',
    incomeCategory: 'fees', rangeMin: 15, rangeMax: 30, rangeUnit: 'unit',
    note: 'Monthly amenity fee per unit — pool & sundeck',
  },
  'Fitness Center': {
    sourceTagKey: 'fitness', label: 'Fitness Membership Fee',
    incomeCategory: 'fees', rangeMin: 0, rangeMax: 20, rangeUnit: 'unit',
    note: 'Optional fitness membership fee per unit',
  },
  'Co-Working Lounge': {
    sourceTagKey: 'coworking', label: 'Co-Working Membership',
    incomeCategory: 'coworking', rangeMin: 50, rangeMax: 150, rangeUnit: 'unit',
    note: 'Monthly co-working membership per resident',
  },
  'Rooftop Lounge': {
    sourceTagKey: 'lounge', label: 'Private Event / Venue Revenue',
    incomeCategory: 'event_revenue', rangeMin: 10, rangeMax: 40, rangeUnit: 'unit',
    note: 'Estimated rooftop lounge event bookings averaged per unit',
  },
  'Pet Spa': {
    sourceTagKey: 'pet_spa', label: 'Pet Spa / Grooming Fee',
    incomeCategory: 'pet_rent', rangeMin: 10, rangeMax: 25, rangeUnit: 'unit',
    note: 'Additional pet-program fee beyond base pet rent',
  },
  'Concierge Desk': {
    sourceTagKey: 'concierge', label: 'Concierge Service Fee',
    incomeCategory: 'fees', rangeMin: 20, rangeMax: 50, rangeUnit: 'unit',
    note: 'Premium concierge tier fee per unit',
  },
  'Resident Theater': {
    sourceTagKey: 'theatre', label: 'Media / Theater Room Fee',
    incomeCategory: 'fees', rangeMin: 5, rangeMax: 20, rangeUnit: 'unit',
    note: 'Reservation-based theater room fee per unit',
  },
  'Outdoor Kitchen & Grills': {
    sourceTagKey: 'outdoor', label: 'Outdoor Amenity Fee',
    incomeCategory: 'fees', rangeMin: 5, rangeMax: 15, rangeUnit: 'unit',
    note: 'Outdoor kitchen / grill reservation fee per unit',
  },
  'Package Lockers': {
    sourceTagKey: 'package_fee', label: 'Package Locker Fee',
    incomeCategory: 'package_fee', rangeMin: 5, rangeMax: 15, rangeUnit: 'unit',
    note: 'Monthly package locker subscription per unit',
  },
  'Bike Storage': {
    sourceTagKey: 'bike_storage', label: 'Bike Storage Fee',
    incomeCategory: 'storage', rangeMin: 5, rangeMax: 20, rangeUnit: 'unit',
    note: 'Monthly bike storage fee per unit',
  },
  'Covered Parking': {
    sourceTagKey: 'parking', label: 'Covered Parking Revenue',
    incomeCategory: 'parking', rangeMin: 75, rangeMax: 200, rangeUnit: 'space',
    note: 'Monthly parking fee per covered space',
  },
  'EV Charging Stations': {
    sourceTagKey: 'ev_charging', label: 'EV Charging Revenue',
    incomeCategory: 'ev_charging', rangeMin: 20, rangeMax: 60, rangeUnit: 'space',
    note: 'Monthly EV charging fee per station',
  },
};

const CATEGORY_ICONS: Record<string, string> = {
  pool: '🏊', fitness: '💪', coworking: '💼', lounge: '🍸',
  pet: '🐾', pet_spa: '🐾', concierge: '🛎️', parking: '🅿️',
  storage: '📦', bike_storage: '🚲', theatre: '🎬', outdoor: '🌳',
  security: '🔒', package_fee: '📦', ev_charging: '⚡', other: '📋',
};

/**
 * Maps a suggestion sourceTagKey to its canonical breakdown row category.
 * Only keys with a direct match in otherIncomeBreakdown.rows are listed.
 * Suggestions for new/incremental revenue streams (coworking, ev_charging, etc.)
 * are not suppressed by breakdown data — they are genuinely additive.
 */
const SUGGESTION_BREAKDOWN_CATEGORY: Record<string, string> = {
  parking:      'parking',
  pet_spa:      'pet',
  bike_storage: 'storage',
};

interface FinancialsData {
  totalUnits: number;
  otherIncomeBreakdown?: OtherIncomeBreakdown | null;
  otherIncomeUserLines?: UserLine[];
}

// ── Ramp formula — mirrors backend computeUserLineAnnual (proforma-seeder.service.ts §5B) ──
// yearIndex: 0-based (0 = Year 1)
function computeRampAwareAnnual(
  monthly: number,
  adoption: AdoptionBlock | null | undefined,
  yearIndex: number,
): number {
  if (!adoption) return monthly * 12;
  const steadyMo   = Number.isFinite(adoption.steady_state_monthly) ? adoption.steady_state_monthly : monthly;
  const rampStart  = Number.isFinite(adoption.ramp_start_period)    ? adoption.ramp_start_period    : 0;
  const rampDur    = Number.isFinite(adoption.ramp_duration_months) ? adoption.ramp_duration_months : 0;
  const prob       = Number.isFinite(adoption.probability_adopted)  ? adoption.probability_adopted  : 1;
  const Y = yearIndex + 1;
  const periodMonth = (Y - 1) * 12 + 6; // midpoint of year Y
  if (periodMonth < rampStart) return 0;
  if (rampDur <= 0 || periodMonth >= rampStart + rampDur) return steadyMo * 12 * prob;
  const rampFraction = (periodMonth - rampStart) / rampDur;
  return steadyMo * rampFraction * 12 * prob;
}

// ── Inline add/edit form ───────────────────────────────────────────────────
interface LineFormState {
  label: string;
  monthly: string;
  qty: string;
  rate: string;
  frequency: 'monthly' | 'annual';
  note: string;
  useQtyRate: boolean;
  // Adoption timeline fields
  adoptionRequired: boolean;
  rampStartPeriod: string;
  rampDurationMonths: string;
  steadyStateMonthly: string;
  probabilityAdopted: string;
  confirmed: boolean;
}

function emptyForm(isDevelopment = false, renoCompletionMonths?: number): LineFormState {
  const isValueAdd = !isDevelopment && renoCompletionMonths != null && renoCompletionMonths > 0;
  return {
    label: '', monthly: '', qty: '', rate: '',
    frequency: 'monthly', note: '', useQtyRate: false,
    adoptionRequired: isDevelopment,
    rampStartPeriod: isDevelopment ? '12' : isValueAdd ? String(renoCompletionMonths!) : '0',
    rampDurationMonths: '6',
    steadyStateMonthly: '',
    probabilityAdopted: '1.0',
    confirmed: false,
  };
}

export function OtherIncomeTab(props: FinancialEngineTabProps) {
  const { dealId, dealType, onF9Refresh, f9Financials } = props;
  const isDevelopment = dealType === 'development';

  // Hold period from the deal's assumptions — drives IncomeRampChart year count (up to 10)
  const holdYears = Math.min(10, Math.max(1, props.f9Financials?.assumptions?.holdYears ?? 5));

  // For value-add deals, derive the renovation completion month from the CapEx schedule
  // so the adoption ramp form pre-fills START MONTH automatically.
  // Looks for 'renovation_period_years' in the proforma year-1 rows (set by the CashFlow Agent)
  // or falls back to the user overrides map. Falls back to null (→ 0) if no capex schedule set.
  const renoCompletionMonths = React.useMemo((): number | undefined => {
    if (isDevelopment) return undefined;
    // Primary: proforma year1 resolved field
    const proformaRow = f9Financials?.proforma?.year1?.find(r => r.field === 'renovation_period_years');
    const fromProforma = proformaRow?.resolved ?? proformaRow?.platform ?? proformaRow?.broker ?? null;
    if (fromProforma != null && fromProforma > 0) return Math.round(fromProforma * 12);
    // Secondary: user overrides map (year index 1 = Y1)
    const fromOverride = f9Financials?.userOverrides?.['renovation_period_years']?.[1] ?? null;
    if (fromOverride != null && fromOverride > 0) return Math.round(fromOverride * 12);
    return undefined;
  }, [isDevelopment, f9Financials]);

  const approvedAmenities = useDesignProgramStore(s => s.program.approvedAmenities);

  const [data,    setData]    = useState<FinancialsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [addingSuggestion, setAddingSuggestion] = useState<string | null>(null);

  // Category override editing state — keyed by category string
  const [editingCat, setEditingCat]   = useState<string | null>(null);
  const [editVal,    setEditVal]      = useState('');
  const [savingCat,  setSavingCat]    = useState<string | null>(null);
  const [savedCat,   setSavedCat]     = useState<string | null>(null);

  // User-lines state
  const [showAddForm,   setShowAddForm]   = useState(false);
  const [addForm,       setAddForm]       = useState<LineFormState>(() => emptyForm(isDevelopment, renoCompletionMonths));
  const [addingLine,    setAddingLine]    = useState(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editForm,      setEditForm]      = useState<LineFormState>(() => emptyForm(isDevelopment, renoCompletionMonths));
  const [savingLineId,  setSavingLineId]  = useState<string | null>(null);
  const [deletingLineId,setDeletingLineId]= useState<string | null>(null);
  const [expandedRampLineId, setExpandedRampLineId] = useState<string | null>(null);

  // Collapse state for the breakdown section
  const [breakdownCollapsed, setBreakdownCollapsed] = useState(false);
  const [userLinesCollapsed,  setUserLinesCollapsed]  = useState(false);

  // Renovation period banner — dismissed per session
  const RENO_BANNER_KEY = `reno_banner_dismissed_${dealId}`;
  const [renoBannerDismissed, setRenoBannerDismissed] = useState<boolean>(
    () => sessionStorage.getItem(RENO_BANNER_KEY) === '1'
  );
  const dismissRenoBanner = () => {
    sessionStorage.setItem(RENO_BANNER_KEY, '1');
    setRenoBannerDismissed(true);
  };
  const showRenoBanner = !isDevelopment && renoCompletionMonths === undefined && !renoBannerDismissed;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<{ success: boolean; data: FinancialsData }>(
        `/api/v1/deals/${dealId}/financials`
      );
      if (res.data.success) {
        setData(res.data.data);
      } else {
        setError('Failed to load other income data');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Error loading data');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  // ── Category override commit ────────────────────────────────────────────
  const commitCatOverride = useCallback(async (category: string, value: number | null) => {
    setSavingCat(category);
    try {
      await apiClient.patch(
        `/api/v1/deals/${dealId}/financials/other-income/category-overrides`,
        { category, value }
      );
      await load();
      setSavedCat(category);
      setTimeout(() => setSavedCat(c => c === category ? null : c), 1800);
      try { onF9Refresh?.(); } catch { /* noop */ }
    } catch (e) {
      console.error(`Failed to save other income category override (${category}):`, e);
    } finally {
      setSavingCat(null);
    }
  }, [dealId, load, onF9Refresh]);

  // ── User line mutations ─────────────────────────────────────────────────

  /**
   * Derive the flat monthly value from the form for use as a steady-state
   * fallback when steadyStateMonthly is left blank.
   * In QTY×RATE mode compute qty * rate (or qty * rate / 12 for annual).
   * Falls back to 0 rather than NaN so adoption is never silently dropped.
   */
  const deriveMonthlyFromForm = useCallback((form: LineFormState): number => {
    if (form.useQtyRate) {
      const qty  = parseFloat(form.qty)  || 0;
      const rate = parseFloat(form.rate) || 0;
      return form.frequency === 'annual' ? (qty * rate) / 12 : qty * rate;
    }
    return parseFloat(form.monthly) || 0;
  }, []);

  /**
   * Build an AdoptionBlock for the API payload.
   * Returns null  when adoption is off (clears any existing ramp on the server).
   * Returns block when adoption is on — always succeeds; invalid numeric fields
   * are clamped to safe defaults (0/1) rather than silently dropping the block.
   */
  const buildAdoptionPayload = useCallback((form: LineFormState): AdoptionBlock | null => {
    if (!form.adoptionRequired) return null;
    const rampStart  = Math.max(0, parseFloat(form.rampStartPeriod)    || 0);
    const rampDur    = Math.max(0, parseFloat(form.rampDurationMonths) || 0);
    // Derive steady-state: explicit field → flat monthly field → qty*rate computation
    const steadyMo   = Math.max(0,
      form.steadyStateMonthly.trim() !== ''
        ? (parseFloat(form.steadyStateMonthly) || 0)
        : deriveMonthlyFromForm(form)
    );
    const rawProb    = parseFloat(form.probabilityAdopted);
    const prob       = Math.min(1, Math.max(0, Number.isFinite(rawProb) ? rawProb : 1));
    return {
      ramp_start_period:    rampStart,
      ramp_duration_months: rampDur,
      steady_state_monthly: steadyMo,
      probability_adopted:  prob,
    };
  }, [deriveMonthlyFromForm]);

  const buildLinePayload = useCallback((form: LineFormState) => {
    // adoption is always null (off) or a full AdoptionBlock (on) — never omitted
    const adoption = buildAdoptionPayload(form);
    const base = form.useQtyRate
      ? {
          label:     form.label.trim(),
          qty:       parseFloat(form.qty) || 0,
          rate:      parseFloat(form.rate) || 0,
          frequency: form.frequency,
          note:      form.note.trim() || undefined,
          confirmed: form.confirmed,
        }
      : {
          label:   form.label.trim(),
          monthly: parseFloat(form.monthly) || 0,
          note:    form.note.trim() || undefined,
          confirmed: form.confirmed,
        };
    return { ...base, adoption };
  }, [buildAdoptionPayload]);

  const handleAddLine = useCallback(async () => {
    if (!addForm.label.trim()) return;
    setAddingLine(true);
    try {
      await apiClient.post(
        `/api/v1/deals/${dealId}/financials/other-income/user-lines`,
        buildLinePayload(addForm)
      );
      setAddForm(emptyForm(isDevelopment, renoCompletionMonths));
      setShowAddForm(false);
      await load();
      try { onF9Refresh?.(); } catch { /* noop */ }
    } catch (e) {
      console.error('Failed to add user line:', e);
    } finally {
      setAddingLine(false);
    }
  }, [dealId, addForm, load, onF9Refresh, isDevelopment]);

  const handleEditLine = useCallback(async (lineId: string) => {
    setSavingLineId(lineId);
    try {
      await apiClient.patch(
        `/api/v1/deals/${dealId}/financials/other-income/user-lines/${lineId}`,
        buildLinePayload(editForm)
      );
      setEditingLineId(null);
      await load();
      try { onF9Refresh?.(); } catch { /* noop */ }
    } catch (e) {
      console.error('Failed to edit user line:', e);
    } finally {
      setSavingLineId(null);
    }
  }, [dealId, editForm, load, onF9Refresh]);

  const handleDeleteLine = useCallback(async (lineId: string) => {
    setDeletingLineId(lineId);
    try {
      await apiClient.delete(
        `/api/v1/deals/${dealId}/financials/other-income/user-lines/${lineId}`
      );
      await load();
      try { onF9Refresh?.(); } catch { /* noop */ }
    } catch (e) {
      console.error('Failed to delete user line:', e);
    } finally {
      setDeletingLineId(null);
    }
  }, [dealId, load, onF9Refresh]);

  const handleAddFromSuggestion = useCallback(async (
    suggestion: AmenitySuggestion,
    totalUnits: number,
  ) => {
    const sourceTag = `program_suggestion:${suggestion.sourceTagKey}`;
    setAddingSuggestion(sourceTag);
    try {
      const midpoint = Math.round((suggestion.rangeMin + suggestion.rangeMax) / 2);
      const monthly  = totalUnits > 0 ? midpoint * totalUnits : midpoint;
      await apiClient.post(
        `/api/v1/deals/${dealId}/financials/other-income/user-lines`,
        {
          label:      suggestion.label,
          monthly,
          note:       suggestion.note,
          source_tag: sourceTag,
        }
      );
      await load();
      try { onF9Refresh?.(); } catch { /* noop */ }
    } catch (e) {
      console.error('Failed to add suggestion line:', e);
    } finally {
      setAddingSuggestion(null);
    }
  }, [dealId, load, onF9Refresh]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, background: C.bg }}>
        <Loader2 size={20} color={C.cyan} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontFamily: LABEL, fontSize: 11, color: C.muted, marginLeft: 10 }}>Loading other income...</span>
      </div>
    );
  }
  if (error) {
    return <div style={{ padding: 24, color: C.red, fontFamily: LABEL, fontSize: 11 }}>{error}</div>;
  }

  const breakdown   = data?.otherIncomeBreakdown ?? null;
  const userLines   = data?.otherIncomeUserLines ?? [];
  const totalUnits  = data?.totalUnits ?? 0;

  // Use ramp-aware Year 1 projections (same formula as backend computeUserLineAnnual, yearIndex=0)
  // so KPI strip and totals match what the proforma-seeder will actually produce in Year 1.
  const userLinesAnnual = userLines.reduce((s, l) => s + computeRampAwareAnnual(l.monthly, l.adoption, 0), 0);
  const breakdownTotal  = breakdown?.total.resolved ?? 0;
  const grandTotal      = breakdownTotal + userLinesAnnual;

  // ── Program suggestions: find unaddressed amenities ──
  // An amenity is considered "addressed" when either:
  //   1. A user line already exists with source_tag === 'program_suggestion:<key>'
  //   2. The canonical breakdown row for this suggestion has a non-null, non-zero
  //      resolved value (e.g. parking revenue already in T-12/RR breakdown)
  const breakdownByCategory: Record<string, OtherIncomeBreakdownRow> =
    Object.fromEntries((breakdown?.rows ?? []).map(r => [r.category, r]));

  const programSuggestions: Array<{ amenityName: string; suggestion: AmenitySuggestion }> =
    approvedAmenities.flatMap(amenity => {
      const suggestion = AMENITY_SUGGESTION_MAP[amenity.name];
      if (!suggestion) return [];

      const sourceTag = `program_suggestion:${suggestion.sourceTagKey}`;

      // Check 1: user already added this suggestion (by source_tag)
      const alreadyAddedByTag = userLines.some(l => l.source_tag === sourceTag);
      if (alreadyAddedByTag) return [];

      // Check 2: breakdown row already has meaningful resolved value for this category
      const breakdownCat = SUGGESTION_BREAKDOWN_CATEGORY[suggestion.sourceTagKey];
      if (breakdownCat) {
        const row = breakdownByCategory[breakdownCat];
        if (row && row.resolved != null && row.resolved > 0) return [];
      }

      return [{ amenityName: amenity.name, suggestion }];
    });

  const rampingCount = userLines.filter(l => l.adoption != null).length;

  return (
    <div style={{ background: C.bg, minHeight: '100%', overflowY: 'auto' }}>

      {/* ── Header bar ── */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontFamily: LABEL, fontSize: 10, fontWeight: 700, color: C.amber, letterSpacing: '0.1em' }}>F14 · OTHER INCOME</span>
          <span style={{ fontFamily: LABEL, fontSize: 9, color: C.muted, marginLeft: 12 }}>
            Ancillary revenue · RR / T-12 / OM reconciliation · custom lines
          </span>
          {isDevelopment && (
            <span style={{ marginLeft: 10, fontFamily: LABEL, fontSize: 8, fontWeight: 700, color: C.teal, background: C.tealDim, border: `1px solid ${C.teal}55`, borderRadius: 3, padding: '2px 6px', letterSpacing: '0.06em' }}>
              DEVELOPMENT · new lines default to ramp-up
            </span>
          )}
        </div>
        <button
          onClick={load}
          style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 4, padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: C.muted, fontFamily: LABEL, fontSize: 9 }}
        >
          <RefreshCw size={11} /> REFRESH
        </button>
      </div>

      {/* ── KPI strip ── */}
      <div style={{ display: 'flex', gap: 10, padding: '14px 20px', flexWrap: 'wrap' }}>
        {[
          { label: 'RECONCILED SOURCES', value: fmt$(breakdownTotal), color: C.cyan,   sub: 'RR / T-12 / OM resolved' },
          { label: 'USER-ADDED LINES',   value: fmt$(userLinesAnnual), color: C.purple, sub: `${userLines.length} custom line${userLines.length !== 1 ? 's' : ''}` },
          { label: 'TOTAL ANCILLARY',    value: fmt$(grandTotal),      color: C.amber,  sub: 'feeds EGI in F9' },
          ...(totalUnits > 0 && grandTotal > 0 ? [{ label: '$/UNIT/YR', value: `$${Math.round(grandTotal / totalUnits).toLocaleString()}`, color: C.green, sub: 'blended all sources' }] : []),
          ...(rampingCount > 0 ? [{ label: 'RAMPING LINES', value: String(rampingCount), color: C.teal, sub: 'adoption timeline set' }] : []),
        ].map(pill => (
          <div key={pill.label} style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 14px', minWidth: 140 }}>
            <div style={{ fontFamily: LABEL, fontSize: 8, color: C.muted, letterSpacing: '0.06em', marginBottom: 4 }}>{pill.label}</div>
            <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: pill.color }}>{pill.value}</div>
            <div style={{ fontFamily: LABEL, fontSize: 8, color: C.muted, marginTop: 2 }}>{pill.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '0 20px 20px' }}>

        {/* ── Program Suggestions Banner ── */}
        {programSuggestions.length > 0 && (
          <div style={{ background: '#0a1020', border: `1px solid #1e3a5f`, borderRadius: 6, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid #1e3a5f`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lightbulb size={12} color={C.cyan} />
              <span style={{ fontFamily: LABEL, fontSize: 9, fontWeight: 700, color: C.cyan, letterSpacing: '0.06em' }}>
                PROGRAM SUGGESTIONS
              </span>
              <span style={{ fontFamily: LABEL, fontSize: 8, color: C.muted, marginLeft: 4 }}>
                {programSuggestions.length} amenit{programSuggestions.length === 1 ? 'y' : 'ies'} from F3 Programming may generate ancillary income
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#080c12' }}>
                    <th style={th()}>AMENITY</th>
                    <th style={th()}>SUGGESTED INCOME LINE</th>
                    <th style={th()}>CATEGORY</th>
                    <th style={th(true)}>TYPICAL $/UNIT/MO</th>
                    <th style={th()}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {programSuggestions.map(({ amenityName, suggestion }, idx) => {
                    const sourceTag   = `program_suggestion:${suggestion.sourceTagKey}`;
                    const isAdding    = addingSuggestion === sourceTag;
                    const icon        = CATEGORY_ICONS[suggestion.sourceTagKey] ?? '📋';
                    const rangeLabel  = suggestion.rangeMin === 0
                      ? `$0–$${suggestion.rangeMax}/${suggestion.rangeUnit}`
                      : `$${suggestion.rangeMin}–$${suggestion.rangeMax}/${suggestion.rangeUnit}`;

                    return (
                      <tr key={sourceTag} style={{ background: idx % 2 === 0 ? '#0d1520' : '#080c12' }}>
                        <td style={{ ...td(), color: C.cyan, fontWeight: 700 }}>
                          <span style={{ marginRight: 6 }}>{icon}</span>
                          {amenityName}
                        </td>
                        <td style={{ ...td(), color: C.text }}>
                          {suggestion.label}
                        </td>
                        <td style={{ ...td() }}>
                          <span style={{ fontFamily: LABEL, fontSize: 8, fontWeight: 700, color: C.muted, background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 3, padding: '2px 6px', letterSpacing: '0.06em' }}>
                            {suggestion.incomeCategory.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ ...td(true), color: C.amber }}>
                          {rangeLabel}
                        </td>
                        <td style={td()}>
                          <button
                            onClick={() => void handleAddFromSuggestion(suggestion, totalUnits)}
                            disabled={isAdding}
                            title={`Add "${suggestion.label}" as a custom income line`}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              background: isAdding ? C.cyanDim : C.cyanDim,
                              border: `1px solid ${C.cyan}55`,
                              borderRadius: 4, padding: '4px 10px', cursor: isAdding ? 'not-allowed' : 'pointer',
                              color: C.cyan, fontFamily: LABEL, fontSize: 8, fontWeight: 700, letterSpacing: '0.06em',
                              opacity: isAdding ? 0.6 : 1,
                            }}
                          >
                            {isAdding
                              ? <Loader2 size={9} style={{ animation: 'spin 1s linear infinite' }} />
                              : <Plus size={9} />}
                            {isAdding ? 'ADDING…' : 'ADD'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '6px 12px', background: '#050a0f', borderTop: `1px solid #1e3a5f` }}>
              <span style={{ fontFamily: LABEL, fontSize: 8, color: C.muted }}>
                Clicking Add creates a prefilled custom line at the midpoint of the typical range — edit the value in CUSTOM INCOME LINES below.
                Suggestions disappear once added.
              </span>
            </div>
          </div>
        )}

        {/* ── Per-Category Breakdown ── */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden', marginBottom: 14 }}>
          <div
            onClick={() => setBreakdownCollapsed(c => !c)}
            style={{ padding: '8px 12px', borderBottom: breakdownCollapsed ? undefined : `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          >
            {breakdownCollapsed
              ? <ChevronRight size={12} color={C.muted} />
              : <ChevronDown  size={12} color={C.muted} />}
            <span style={{ fontFamily: LABEL, fontSize: 9, fontWeight: 700, color: C.text, letterSpacing: '0.06em' }}>
              CATEGORY BREAKDOWN · RR · T-12 · OM · RESOLVED
            </span>
            <span style={{ fontFamily: LABEL, fontSize: 8, color: C.dim, marginLeft: 4 }}>
              click resolved value to override · OVR badge + reset when overridden
            </span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.amber, marginLeft: 'auto' }}>
              {fmt$(breakdownTotal)}/yr
            </span>
          </div>

          {!breakdownCollapsed && (
            breakdown == null ? (
              <div style={{ padding: '24px 20px', textAlign: 'center' }}>
                <div style={{ fontFamily: LABEL, fontSize: 10, color: C.muted, marginBottom: 4 }}>NO ANCILLARY DATA</div>
                <div style={{ fontFamily: LABEL, fontSize: 9, color: C.dim }}>
                  Upload a rent roll, T-12, or OM to populate this section. Or add custom lines below.
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: C.panelAlt }}>
                      <th style={th()}>CATEGORY</th>
                      <th style={th(true)}>RENT ROLL</th>
                      <th style={th(true)}>T-12</th>
                      <th style={th(true)}>OM</th>
                      <th style={th(true)}>RESOLVED (EDITABLE)</th>
                      <th style={th()}>SOURCE</th>
                      <th style={th(true)}>$/UNIT/YR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.rows.map((row, idx) => {
                      const meta       = SRC_BADGE[row.resolution] ?? SRC_BADGE.unseeded;
                      const isOverridden = row.resolution === 'user_override';
                      const isEditing  = editingCat === row.category;
                      const isSaving   = savingCat  === row.category;
                      const isJustSaved= savedCat   === row.category;
                      const perUnit    = totalUnits > 0 && row.resolved != null
                        ? Math.round(row.resolved / totalUnits)
                        : null;

                      return (
                        <tr key={row.category} style={{ background: idx % 2 === 0 ? C.panel : C.panelAlt }}>

                          {/* Category label */}
                          <td style={{ ...td(), color: C.cyan, fontWeight: 700 }}>
                            {ANCILLARY_LABELS[row.category] ?? row.category}
                          </td>

                          {/* RR */}
                          <td style={td(true)}>
                            <span style={{ color: row.rent_roll != null ? C.cyan : C.dim }}>
                              {row.rent_roll != null ? fmt$(row.rent_roll) : '—'}
                            </span>
                          </td>

                          {/* T-12 */}
                          <td style={td(true)}>
                            <span style={{ color: row.t12 != null ? C.muted : C.dim }}>
                              {row.t12 != null ? fmt$(row.t12) : '—'}
                            </span>
                          </td>

                          {/* OM */}
                          <td style={td(true)}>
                            <span style={{ color: row.om != null ? C.amber : C.dim }}>
                              {row.om != null ? fmt$(row.om) : '—'}
                            </span>
                          </td>

                          {/* Resolved — editable */}
                          <td style={{ ...td(true), position: 'relative', minWidth: 140 }}>
                            {isEditing ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                                <input
                                  autoFocus
                                  type="number"
                                  value={editVal}
                                  onChange={e => setEditVal(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      const v = parseFloat(editVal);
                                      if (!isNaN(v)) {
                                        void commitCatOverride(row.category, v);
                                        setEditingCat(null);
                                      }
                                    } else if (e.key === 'Escape') {
                                      setEditingCat(null);
                                    }
                                  }}
                                  placeholder="$/yr"
                                  style={{ width: 90, background: C.panelAlt, border: `1px solid ${C.amber}`, borderRadius: 3, color: C.amber, fontFamily: MONO, fontSize: 10, padding: '2px 4px', textAlign: 'right' }}
                                />
                                <button
                                  onClick={() => {
                                    const v = parseFloat(editVal);
                                    if (!isNaN(v)) {
                                      void commitCatOverride(row.category, v);
                                    }
                                    setEditingCat(null);
                                  }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: C.green }}
                                >
                                  <Check size={12} />
                                </button>
                                <button
                                  onClick={() => setEditingCat(null)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: C.red }}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>

                                {/* OVR badge + reset */}
                                {isOverridden && (
                                  <span
                                    style={{ fontFamily: LABEL, fontSize: 7, fontWeight: 700, color: C.purple, background: C.purpleDim, border: `1px solid ${C.purple}55`, borderRadius: 3, padding: '1px 5px', letterSpacing: '0.06em', cursor: 'default' }}
                                    title="User override — click ↺ to restore reconciled value"
                                  >
                                    OVR
                                  </span>
                                )}

                                {isSaving ? (
                                  <Loader2 size={12} color={C.amber} style={{ animation: 'spin 1s linear infinite' }} />
                                ) : isJustSaved ? (
                                  <span style={{ fontFamily: LABEL, fontSize: 8, color: C.green }}>SAVED</span>
                                ) : (
                                  <span
                                    style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: row.resolved != null ? C.text : C.dim, cursor: 'text' }}
                                    onClick={() => {
                                      setEditingCat(row.category);
                                      setEditVal(row.resolved != null ? String(Math.round(row.resolved)) : '');
                                    }}
                                    title="Click to edit"
                                  >
                                    {row.resolved != null ? fmt$(row.resolved) : '—'}
                                    {row.conflict && (
                                      <span title="Sources disagree by > 15%" style={{ color: C.red, marginLeft: 4 }}>⚠</span>
                                    )}
                                  </span>
                                )}

                                {/* Edit pencil */}
                                {!isSaving && !isJustSaved && (
                                  <button
                                    onClick={() => {
                                      setEditingCat(row.category);
                                      setEditVal(row.resolved != null ? String(Math.round(row.resolved)) : '');
                                    }}
                                    title="Edit resolved value"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: C.muted, opacity: 0.5 }}
                                  >
                                    <Edit3 size={10} />
                                  </button>
                                )}

                                {/* Reset override */}
                                {isOverridden && !isSaving && (
                                  <button
                                    onClick={() => void commitCatOverride(row.category, null)}
                                    title="Reset to reconciled value"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: C.purple, opacity: 0.7 }}
                                  >
                                    <RotateCcw size={10} />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Source badge */}
                          <td style={{ ...td() }}>
                            <span style={{ fontFamily: LABEL, fontSize: 8, fontWeight: 700, color: meta.color, letterSpacing: '0.06em' }}>
                              {meta.label}
                            </span>
                          </td>

                          {/* $/unit/yr */}
                          <td style={{ ...td(true), color: C.dim, fontSize: 9 }}>
                            {perUnit != null ? `$${perUnit.toLocaleString()}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#050a0f', borderTop: `2px solid ${C.borderHi}` }}>
                      <td style={{ ...td(), fontWeight: 700, color: C.text }}>TOTAL RECONCILED</td>
                      <td style={td(true, true, C.cyan)}>{breakdown.total.rent_roll != null ? fmt$(breakdown.total.rent_roll) : '—'}</td>
                      <td style={td(true, true, C.muted)}>{breakdown.total.t12 != null ? fmt$(breakdown.total.t12) : '—'}</td>
                      <td style={td(true, true, C.amber)}>{breakdown.total.om != null ? fmt$(breakdown.total.om) : '—'}</td>
                      <td style={td(true, true, C.green)}>{fmt$(breakdownTotal)}</td>
                      <td style={{ ...td(), color: C.dim, fontSize: 8 }}>resolved</td>
                      <td style={{ ...td(true), color: C.dim, fontSize: 8 }}>
                        {totalUnits > 0 ? `$${Math.round(breakdownTotal / totalUnits).toLocaleString()}/yr` : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          )}
        </div>

        {/* ── User-Added Custom Lines ── */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
          <div
            onClick={() => setUserLinesCollapsed(c => !c)}
            style={{ padding: '8px 12px', borderBottom: userLinesCollapsed ? undefined : `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          >
            {userLinesCollapsed
              ? <ChevronRight size={12} color={C.muted} />
              : <ChevronDown  size={12} color={C.muted} />}
            <span style={{ fontFamily: LABEL, fontSize: 9, fontWeight: 700, color: C.purple, letterSpacing: '0.06em' }}>
              CUSTOM INCOME LINES
            </span>
            <span style={{ fontFamily: LABEL, fontSize: 8, color: C.dim, marginLeft: 4 }}>
              solar revenue, cell towers, vending, co-working memberships…
            </span>
            {rampingCount > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontFamily: LABEL, fontSize: 8, color: C.teal, background: C.tealDim, border: `1px solid ${C.teal}44`, borderRadius: 3, padding: '1px 6px', letterSpacing: '0.05em' }}>
                <TrendingUp size={9} /> {rampingCount} RAMPING
              </span>
            )}
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.purple, marginLeft: 'auto' }}>
              {fmt$(userLinesAnnual)}/yr
            </span>
          </div>

          {!userLinesCollapsed && (
            <>
              {showRenoBanner && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  margin: '10px 12px 4px',
                  padding: '9px 12px',
                  background: '#0f1e2e',
                  border: `1px solid #1e4a7a`,
                  borderLeft: `3px solid #3b82f6`,
                  borderRadius: 5,
                }}>
                  <Lightbulb size={13} color="#3b82f6" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontFamily: LABEL, fontSize: 9, fontWeight: 700, color: '#93c5fd', letterSpacing: '0.06em' }}>
                      RENOVATION PERIOD NOT SET
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: '#94a3b8', display: 'block', marginTop: 3 }}>
                      Set <strong style={{ color: '#cbd5e1' }}>renovation_period_years</strong> in{' '}
                      <button
                        onClick={() => window.dispatchEvent(new CustomEvent('fe-console-subtab', { detail: { subTab: 'inputs' } }))}
                        style={{
                          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                          fontFamily: MONO, fontSize: 10, color: '#3b82f6',
                          textDecoration: 'underline', textUnderlineOffset: 2,
                        }}
                      >
                        INPUTS → CapEx
                      </button>
                      {' '}to auto-fill adoption ramp start months for new income lines.
                    </span>
                  </div>
                  <button
                    onClick={dismissRenoBanner}
                    title="Dismiss"
                    style={{
                      background: 'none', border: 'none', padding: '0 2px',
                      cursor: 'pointer', color: '#475569', fontSize: 14, lineHeight: 1,
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
              )}

              {userLines.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: C.panelAlt }}>
                        <th style={th()}>LABEL</th>
                        <th style={th()}>BILLING</th>
                        <th style={th(true)}>STEADY $/MO</th>
                        <th style={th(true)}>PROJ $/YR 1 ↑</th>
                        <th style={th(true)}>$/UNIT/YR 1</th>
                        <th style={th()}>ADOPTION RAMP</th>
                        <th style={th()}>NOTE</th>
                        <th style={th()}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userLines.map((line, idx) => {
                        // Ramp-aware Year 1 projection (same formula as backend computeUserLineAnnual)
                        const y1Annual    = computeRampAwareAnnual(line.monthly, line.adoption, 0);
                        const steadyAnnual= line.adoption
                          ? line.adoption.steady_state_monthly * 12 * line.adoption.probability_adopted
                          : line.monthly * 12;
                        const perUnit     = totalUnits > 0 ? Math.round(y1Annual / totalUnits) : null;
                        const isEditingThis = editingLineId === line.id;
                        const isSavingThis  = savingLineId  === line.id;
                        const isDeletingThis= deletingLineId=== line.id;
                        const hasAdoption   = line.adoption != null;
                        // For ramping lines: Year 1 may be 0 or partial; show steady-state in secondary column
                        const isRamping     = hasAdoption && y1Annual < steadyAnnual - 0.01;
                        const isChartExpanded = expandedRampLineId === line.id;

                        return (
                          <React.Fragment key={line.id}>
                          <tr style={{ background: idx % 2 === 0 ? C.panel : C.panelAlt }}>
                            {isEditingThis ? (
                              <>
                                <td style={td()} colSpan={7}>
                                  <InlineLineForm
                                    form={editForm}
                                    setForm={setEditForm}
                                    holdYears={holdYears}
                                    compact
                                  />
                                </td>
                                <td style={td()}>
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    <button
                                      onClick={() => void handleEditLine(line.id)}
                                      disabled={isSavingThis}
                                      style={{ background: C.green, border: 'none', borderRadius: 3, padding: '3px 8px', cursor: 'pointer', color: C.bg, fontFamily: LABEL, fontSize: 8, fontWeight: 700 }}
                                    >
                                      {isSavingThis ? '…' : 'SAVE'}
                                    </button>
                                    <button
                                      onClick={() => { setEditingLineId(null); }}
                                      style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 3, padding: '3px 8px', cursor: 'pointer', color: C.muted, fontFamily: LABEL, fontSize: 8 }}
                                    >
                                      CANCEL
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td style={{ ...td(), color: C.purple, fontWeight: 700 }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                                    {line.label}
                                    {hasAdoption && (() => {
                                      const isConfirmed = line.confirmed === true || /confirmed/i.test(line.note ?? '');
                                      return (
                                        <span style={{
                                          fontFamily: LABEL,
                                          fontSize: 7,
                                          fontWeight: 700,
                                          letterSpacing: '0.06em',
                                          padding: '1px 5px',
                                          borderRadius: 3,
                                          background: isConfirmed ? C.greenDim : C.panelAlt,
                                          border: `1px solid ${isConfirmed ? C.green + '66' : C.border}`,
                                          color: isConfirmed ? C.green : C.muted,
                                          flexShrink: 0,
                                        }}>
                                          {isConfirmed ? 'Confirmed' : 'Projected'}
                                        </span>
                                      );
                                    })()}
                                  </span>
                                </td>
                                <td style={{ ...td(), color: C.dim, fontSize: 9 }}>
                                  {line.qty != null && line.rate != null
                                    ? `${line.qty.toLocaleString()} × $${line.rate}/${line.frequency === 'annual' ? 'yr' : 'mo'}`
                                    : 'flat monthly'}
                                </td>
                                {/* Steady-state $/mo */}
                                <td style={td(true, false, C.text)}>
                                  ${Math.round(line.adoption?.steady_state_monthly ?? line.monthly).toLocaleString()}
                                </td>
                                {/* Ramp-aware Yr 1 — the actual projected value the seeder will use */}
                                <td style={td(true, true, isRamping ? C.teal : C.amber)}>
                                  <span title={isRamping ? `Ramping — steady state: ${fmt$(steadyAnnual)}/yr` : undefined}>
                                    {fmt$(y1Annual)}
                                    {isRamping && (
                                      <TrendingUp size={9} style={{ marginLeft: 3, verticalAlign: 'middle', color: C.teal }} />
                                    )}
                                  </span>
                                </td>
                                <td style={{ ...td(true), color: C.dim, fontSize: 9 }}>
                                  {perUnit != null ? `$${perUnit.toLocaleString()}` : '—'}
                                </td>
                                {/* Adoption ramp summary */}
                                <td style={{ ...td(), minWidth: 160 }}>
                                  {hasAdoption ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                                        <AdoptionSummaryBadge adoption={line.adoption!} />
                                        <button
                                          onClick={() => setExpandedRampLineId(isChartExpanded ? null : line.id)}
                                          title={isChartExpanded ? 'Hide income ramp chart' : 'Show income ramp chart'}
                                          style={{
                                            background: isChartExpanded ? C.tealDim : 'none',
                                            border: `1px solid ${isChartExpanded ? C.teal : C.border}`,
                                            borderRadius: 3,
                                            cursor: 'pointer',
                                            padding: '2px 4px',
                                            color: isChartExpanded ? C.teal : C.muted,
                                            display: 'flex',
                                            alignItems: 'center',
                                            flexShrink: 0,
                                          }}
                                        >
                                          <BarChart2 size={10} />
                                        </button>
                                      </div>
                                      {line.confirmed && (
                                        <span
                                          title="Confirmed contract — Excel export labels this line RAMP (Confirmed)"
                                          style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 3,
                                            fontFamily: LABEL, fontSize: 7, fontWeight: 700,
                                            color: C.green, background: C.greenDim,
                                            border: `1px solid ${C.green}55`,
                                            borderRadius: 3, padding: '1px 5px',
                                            letterSpacing: '0.06em', width: 'fit-content',
                                          }}
                                        >
                                          ✓ CONFIRMED
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span style={{ fontFamily: LABEL, fontSize: 8, color: C.dim }}>immediate / flat</span>
                                  )}
                                </td>
                                <td style={{ ...td(), color: C.dim, fontSize: 9, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {line.note || '—'}
                                </td>
                                <td style={td()}>
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <button
                                      onClick={() => {
                                        setEditingLineId(line.id);
                                        const a = line.adoption;
                                        setEditForm({
                                          label:      line.label,
                                          monthly:    String(Math.round(line.monthly)),
                                          qty:        line.qty != null ? String(line.qty) : '',
                                          rate:       line.rate != null ? String(line.rate) : '',
                                          frequency:  line.frequency ?? 'monthly',
                                          note:       line.note ?? '',
                                          useQtyRate: line.qty != null && line.rate != null,
                                          adoptionRequired:     a != null,
                                          rampStartPeriod:      a != null && a.ramp_start_period > 0
                                            ? String(a.ramp_start_period)
                                            : isDevelopment
                                              ? '12'
                                              : renoCompletionMonths != null && renoCompletionMonths > 0
                                                ? String(renoCompletionMonths)
                                                : '0',
                                          rampDurationMonths:   a != null ? String(a.ramp_duration_months) : '6',
                                          steadyStateMonthly:   a != null ? String(a.steady_state_monthly) : String(Math.round(line.monthly)),
                                          probabilityAdopted:   a != null ? String(a.probability_adopted) : '1.0',
                                          confirmed:            line.confirmed ?? false,
                                        });
                                      }}
                                      title="Edit line"
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: C.cyan }}
                                    >
                                      <Edit3 size={12} />
                                    </button>
                                    <button
                                      onClick={() => void handleDeleteLine(line.id)}
                                      disabled={isDeletingThis}
                                      title="Delete line"
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: isDeletingThis ? C.dim : C.red }}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                          {isChartExpanded && hasAdoption && (
                            <tr style={{ background: idx % 2 === 0 ? C.panel : C.panelAlt }}>
                              <td
                                colSpan={8}
                                style={{
                                  padding: '10px 16px 12px',
                                  borderTop: `1px solid ${C.teal}33`,
                                  borderBottom: `1px solid ${C.border}`,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                  <TrendingUp size={10} color={C.teal} />
                                  <span style={{ fontFamily: LABEL, fontSize: 8, fontWeight: 700, color: C.teal, letterSpacing: '0.05em' }}>
                                    INCOME RAMP · {line.label}
                                  </span>
                                </div>
                                <IncomeRampChart
                                  rampStart={line.adoption!.ramp_start_period}
                                  rampDuration={line.adoption!.ramp_duration_months}
                                  steadyMonthly={line.adoption!.steady_state_monthly}
                                  probability={line.adoption!.probability_adopted}
                                />
                              </td>
                            </tr>
                          )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                    {userLines.length > 1 && (
                      <tfoot>
                        <tr style={{ background: '#050a0f', borderTop: `2px solid ${C.borderHi}` }}>
                          <td style={{ ...td(), fontWeight: 700, color: C.text }}>TOTAL CUSTOM · YR 1</td>
                          <td style={td()} />
                          <td style={{ ...td(true), color: C.dim, fontSize: 8 }}>steady state</td>
                          <td style={td(true, true, C.purple)}>{fmt$(userLinesAnnual)}</td>
                          <td style={{ ...td(true), color: C.dim, fontSize: 8 }}>
                            {totalUnits > 0 ? `$${Math.round(userLinesAnnual / totalUnits).toLocaleString()}/yr` : '—'}
                          </td>
                          <td style={td()} />
                          <td style={td()} />
                          <td style={td()} />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}

              {userLines.length === 0 && !showAddForm && (
                <div style={{ padding: '16px 20px', textAlign: 'center' }}>
                  <span style={{ fontFamily: LABEL, fontSize: 9, color: C.dim }}>
                    No custom income lines added yet.
                  </span>
                </div>
              )}

              {/* Add form */}
              {showAddForm ? (
                <div style={{ padding: '12px 14px', background: C.panelAlt, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontFamily: LABEL, fontSize: 9, fontWeight: 700, color: C.purple, marginBottom: 10 }}>
                    ADD CUSTOM LINE
                  </div>
                  <InlineLineForm
                    form={addForm}
                    setForm={setAddForm}
                    holdYears={holdYears}
                    startMonthTooltip={renoCompletionMonths != null && renoCompletionMonths > 0 ? 'Pre-filled from CapEx schedule — edit if needed' : undefined}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button
                      onClick={() => void handleAddLine()}
                      disabled={addingLine || !addForm.label.trim()}
                      style={{ background: C.purple, border: 'none', borderRadius: 4, padding: '5px 14px', cursor: addingLine || !addForm.label.trim() ? 'not-allowed' : 'pointer', color: C.bg, fontFamily: LABEL, fontSize: 9, fontWeight: 700, opacity: !addForm.label.trim() ? 0.5 : 1 }}
                    >
                      {addingLine ? '…' : 'ADD LINE'}
                    </button>
                    <button
                      onClick={() => { setShowAddForm(false); setAddForm(emptyForm(isDevelopment, renoCompletionMonths)); }}
                      style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 4, padding: '5px 14px', cursor: 'pointer', color: C.muted, fontFamily: LABEL, fontSize: 9 }}
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '10px 14px', borderTop: userLines.length > 0 ? `1px solid ${C.border}` : undefined }}>
                  <button
                    onClick={() => { setAddForm(emptyForm(isDevelopment, renoCompletionMonths)); setShowAddForm(true); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: `1px solid ${C.purple}55`, borderRadius: 4, padding: '5px 12px', cursor: 'pointer', color: C.purple, fontFamily: LABEL, fontSize: 9 }}
                  >
                    <Plus size={11} /> ADD CUSTOM LINE
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── EGI feed footer ── */}
        {grandTotal > 0 && (
          <div style={{ marginTop: 12, background: C.amberDim, border: `1px solid ${C.amber}33`, borderRadius: 6, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.amber }} />
              <span style={{ fontFamily: LABEL, fontSize: 9, color: C.amber }}>
                OTHER INCOME → FINANCIAL ENGINE (F9 EGI)
              </span>
            </div>
            <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: C.amber }}>
              {fmt$(grandTotal)}/yr
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Adoption summary badge ──────────────────────────────────────────────────
function AdoptionSummaryBadge({ adoption }: { adoption: AdoptionBlock }) {
  const pct = Math.round(adoption.probability_adopted * 100);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <TrendingUp size={9} color={C.teal} />
        <span style={{ fontFamily: LABEL, fontSize: 8, fontWeight: 700, color: C.teal, letterSpacing: '0.05em' }}>
          RAMPS MO {adoption.ramp_start_period}
        </span>
        {adoption.ramp_duration_months > 0 && (
          <span style={{ fontFamily: LABEL, fontSize: 8, color: C.muted }}>
            over {adoption.ramp_duration_months}mo
          </span>
        )}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 9, color: C.dim }}>
        ${Math.round(adoption.steady_state_monthly).toLocaleString()}/mo · {pct}% prob
      </div>
    </div>
  );
}

// ── Inline form sub-component ───────────────────────────────────────────────
function InlineLineForm({
  form, setForm, compact = false, holdYears = 5, startMonthTooltip,
}: {
  form: LineFormState;
  setForm: React.Dispatch<React.SetStateAction<LineFormState>>;
  compact?: boolean;
  holdYears?: number;
  startMonthTooltip?: string;
}) {
  const inputStyle: React.CSSProperties = {
    background: '#0a1018',
    border: `1px solid ${C.border}`,
    borderRadius: 3,
    color: C.text,
    fontFamily: MONO,
    fontSize: 10,
    padding: '4px 6px',
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: LABEL, fontSize: 8, color: C.muted, marginBottom: 3, display: 'block',
  };
  const adoptionInputStyle: React.CSSProperties = {
    ...inputStyle,
    border: `1px solid ${C.teal}55`,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 10 : 14 }}>

      {/* ── Basic fields row ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: compact ? 8 : 12 }}>
        {/* Label */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: compact ? 120 : 160 }}>
          <label style={labelStyle}>LABEL *</label>
          <input
            type="text"
            value={form.label}
            onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
            placeholder="e.g. EV Charging"
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>

        {/* Billing mode toggle */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={labelStyle}>BILLING MODE</label>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, useQtyRate: false }))}
              style={{ fontFamily: LABEL, fontSize: 8, padding: '4px 8px', border: `1px solid ${!form.useQtyRate ? C.amber : C.border}`, borderRadius: 3, background: !form.useQtyRate ? C.amberDim : 'transparent', color: !form.useQtyRate ? C.amber : C.muted, cursor: 'pointer' }}
            >
              FLAT $/MO
            </button>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, useQtyRate: true }))}
              style={{ fontFamily: LABEL, fontSize: 8, padding: '4px 8px', border: `1px solid ${form.useQtyRate ? C.amber : C.border}`, borderRadius: 3, background: form.useQtyRate ? C.amberDim : 'transparent', color: form.useQtyRate ? C.amber : C.muted, cursor: 'pointer' }}
            >
              QTY × RATE
            </button>
          </div>
        </div>

        {form.useQtyRate ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>QTY</label>
              <input type="number" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} style={{ ...inputStyle, width: 70 }} placeholder="e.g. 50" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>RATE</label>
              <input type="number" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} style={{ ...inputStyle, width: 80 }} placeholder="$/unit" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>FREQ</label>
              <select
                value={form.frequency}
                onChange={e => setForm(f => ({ ...f, frequency: e.target.value as 'monthly' | 'annual' }))}
                style={{ ...inputStyle, width: 90 }}
              >
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={labelStyle}>$/MONTH</label>
            <input type="number" value={form.monthly} onChange={e => setForm(f => ({ ...f, monthly: e.target.value }))} style={{ ...inputStyle, width: 90 }} placeholder="e.g. 1200" />
          </div>
        )}

        {/* Note */}
        {!compact && (
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 200, flex: 1 }}>
            <label style={labelStyle}>NOTE (optional)</label>
            <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Description or source" style={{ ...inputStyle, width: '100%' }} />
          </div>
        )}
      </div>

      {/* ── Adoption timeline section ── */}
      <div style={{ background: form.adoptionRequired ? C.tealDim : C.panelAlt, border: `1px solid ${form.adoptionRequired ? C.teal + '55' : C.border}`, borderRadius: 5, padding: '10px 12px' }}>
        {/* Toggle header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: form.adoptionRequired ? 10 : 0, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, adoptionRequired: !f.adoptionRequired }))}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'none', border: `1px solid ${form.adoptionRequired ? C.teal : C.border}`,
              borderRadius: 12, padding: '3px 10px', cursor: 'pointer',
              color: form.adoptionRequired ? C.teal : C.muted,
              fontFamily: LABEL, fontSize: 8, fontWeight: 700, letterSpacing: '0.06em',
            }}
          >
            <TrendingUp size={10} />
            {form.adoptionRequired ? 'ADOPTION RAMP · ON' : 'ADOPTION RAMP · OFF'}
          </button>
          <span style={{ fontFamily: LABEL, fontSize: 8, color: C.dim }}>
            {form.adoptionRequired
              ? 'income ramps up from zero — configure schedule below'
              : 'income starts immediately at full rate'}
          </span>

          {/* Confirmed contract toggle — only relevant when adoption ramp is on */}
          {form.adoptionRequired && (
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, confirmed: !f.confirmed }))}
              title={form.confirmed
                ? 'Confirmed contract — Excel export will label this line "RAMP (Confirmed)". Click to unset.'
                : 'Mark as confirmed contract — Excel export will label this line "RAMP (Confirmed)" instead of "RAMP (Projected)".'}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: form.confirmed ? '#0a2010' : 'none',
                border: `1px solid ${form.confirmed ? C.green : C.border}`,
                borderRadius: 12, padding: '3px 10px', cursor: 'pointer',
                color: form.confirmed ? C.green : C.muted,
                fontFamily: LABEL, fontSize: 8, fontWeight: 700, letterSpacing: '0.06em',
                marginLeft: 4,
              }}
            >
              <Check size={10} />
              {form.confirmed ? 'CONFIRMED CONTRACT' : 'MARK AS CONFIRMED'}
            </button>
          )}
        </div>

        {/* Adoption fields — only when enabled */}
        {form.adoptionRequired && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>

            {/* Ramp start period */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ ...labelStyle, color: C.teal }}>
                START MONTH
                <span style={{ color: C.dim, fontWeight: 400, marginLeft: 4 }}>from acq.</span>
                {startMonthTooltip && (
                  <span
                    title={startMonthTooltip}
                    style={{ marginLeft: 5, color: C.teal, fontSize: 8, fontWeight: 700, cursor: 'help', opacity: 0.8 }}
                  >
                    ⓘ
                  </span>
                )}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="number"
                  min={0}
                  value={form.rampStartPeriod}
                  onChange={e => setForm(f => ({ ...f, rampStartPeriod: e.target.value }))}
                  style={{ ...adoptionInputStyle, width: 70 }}
                  placeholder="e.g. 12"
                  title={startMonthTooltip}
                />
                <span style={{ fontFamily: LABEL, fontSize: 8, color: C.dim }}>mo</span>
              </div>
              <span style={{ fontFamily: LABEL, fontSize: 7, color: startMonthTooltip ? C.teal : C.dim, marginTop: 2, opacity: startMonthTooltip ? 0.8 : 1 }}>
                {startMonthTooltip ? 'from CapEx schedule' : '0 = day of closing'}
              </span>
            </div>

            {/* Ramp duration */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ ...labelStyle, color: C.teal }}>
                RAMP DURATION
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="number"
                  min={0}
                  value={form.rampDurationMonths}
                  onChange={e => setForm(f => ({ ...f, rampDurationMonths: e.target.value }))}
                  style={{ ...adoptionInputStyle, width: 70 }}
                  placeholder="e.g. 6"
                />
                <span style={{ fontFamily: LABEL, fontSize: 8, color: C.dim }}>mo</span>
              </div>
              <span style={{ fontFamily: LABEL, fontSize: 7, color: C.dim, marginTop: 2 }}>0 = instant full rate</span>
            </div>

            {/* Steady-state monthly */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ ...labelStyle, color: C.teal }}>
                STEADY STATE $/MO
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.dim }}>$</span>
                <input
                  type="number"
                  min={0}
                  value={form.steadyStateMonthly}
                  onChange={e => setForm(f => ({ ...f, steadyStateMonthly: e.target.value }))}
                  placeholder={form.monthly || '0'}
                  style={{ ...adoptionInputStyle, width: 90 }}
                />
              </div>
              <span style={{ fontFamily: LABEL, fontSize: 7, color: C.dim, marginTop: 2 }}>
                full run-rate (blank = use $/mo)
              </span>
            </div>

            {/* Probability adopted */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ ...labelStyle, color: C.teal }}>
                PROBABILITY
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={form.probabilityAdopted}
                  onChange={e => setForm(f => ({ ...f, probabilityAdopted: e.target.value }))}
                  style={{ ...adoptionInputStyle, width: 70 }}
                  placeholder="1.0"
                />
                <span style={{ fontFamily: LABEL, fontSize: 8, color: C.dim }}>0–1</span>
              </div>
              <span style={{ fontFamily: LABEL, fontSize: 7, color: C.dim, marginTop: 2 }}>1.0 = certain to launch</span>
            </div>

            {/* Visual summary — income ramp chart */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 2 }}>
              {(() => {
                const flatMonthly = form.useQtyRate
                  ? (() => {
                      const qty  = parseFloat(form.qty)  || 0;
                      const rate = parseFloat(form.rate) || 0;
                      return form.frequency === 'annual' ? (qty * rate) / 12 : qty * rate;
                    })()
                  : (parseFloat(form.monthly) || 0);
                const steadyMo = form.steadyStateMonthly.trim() !== ''
                  ? (parseFloat(form.steadyStateMonthly) || 0)
                  : flatMonthly;
                const rawProb = parseFloat(form.probabilityAdopted);
                const prob = Math.min(1, Math.max(0, Number.isFinite(rawProb) ? rawProb : 1));
                return (
                  <IncomeRampChart
                    rampStart={parseFloat(form.rampStartPeriod) || 0}
                    rampDuration={parseFloat(form.rampDurationMonths) || 0}
                    steadyMonthly={steadyMo}
                    probability={prob}
                    holdYears={holdYears}
                  />
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Income ramp bar chart — Y1–YN annual income preview ─────────────────────
// Shows computed dollar amounts per year so analysts can see the full adoption
// curve before saving. holdYears controls the number of bars (1–10, default 5).
function IncomeRampChart({
  rampStart, rampDuration, steadyMonthly, probability, holdYears = 5,
}: {
  rampStart: number;
  rampDuration: number;
  steadyMonthly: number;
  probability: number;
  holdYears?: number;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const NUM_BARS = Math.min(10, Math.max(1, holdYears));
  // Scale chart width so bars stay a readable size across 1–10 years
  const CHART_W = NUM_BARS <= 5
    ? 210
    : NUM_BARS * 32 + (NUM_BARS - 1) * 4;
  const CHART_H = 72;
  const LABEL_H = 14;  // reserved at bottom for X-axis labels
  const BAR_AREA_H = CHART_H - LABEL_H;
  const BAR_GAP = NUM_BARS <= 5 ? 5 : 4;
  const BAR_W = Math.floor((CHART_W - BAR_GAP * (NUM_BARS - 1)) / NUM_BARS);
  const LABELS = Array.from({ length: NUM_BARS }, (_, i) => `Y${i + 1}`);

  // Build a synthetic adoption block for computeRampAwareAnnual
  const adoption: AdoptionBlock = {
    ramp_start_period:    rampStart,
    ramp_duration_months: rampDuration,
    steady_state_monthly: steadyMonthly,
    probability_adopted:  probability,
  };

  const values = LABELS.map((_, i) =>
    computeRampAwareAnnual(steadyMonthly, adoption, i)
  );
  const maxVal = Math.max(...values, 1); // avoid div-by-zero

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontFamily: LABEL, fontSize: 7, color: C.teal, letterSpacing: '0.05em' }}>
        ANNUAL INCOME · Y1–Y{NUM_BARS}
      </span>
      <div style={{ position: 'relative', width: CHART_W }}>
        {/* Hover tooltip */}
        {hoveredIdx !== null && (
          <div style={{
            position: 'absolute',
            bottom: CHART_H + 2,
            left: Math.min(
              hoveredIdx * (BAR_W + BAR_GAP) + BAR_W / 2 - 28,
              CHART_W - 60,
            ),
            background: C.panel,
            border: `1px solid ${C.teal}66`,
            borderRadius: 3,
            padding: '2px 7px',
            fontFamily: MONO,
            fontSize: 9,
            color: C.teal,
            whiteSpace: 'nowrap',
            zIndex: 10,
            pointerEvents: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}>
            {fmt$(values[hoveredIdx])}
          </div>
        )}

        <svg
          width={CHART_W}
          height={CHART_H}
          style={{ display: 'block', overflow: 'visible' }}
        >
          {/* Subtle baseline */}
          <line
            x1={0} y1={BAR_AREA_H}
            x2={CHART_W} y2={BAR_AREA_H}
            stroke={C.border} strokeWidth={1}
          />

          {values.map((v, i) => {
            const barH = maxVal > 0
              ? Math.max(2, Math.round((v / maxVal) * (BAR_AREA_H - 4)))
              : 2;
            const x = i * (BAR_W + BAR_GAP);
            const y = BAR_AREA_H - barH;
            const isHovered = hoveredIdx === i;
            const isZero = v === 0;
            const fill = isZero
              ? C.dim + '55'
              : isHovered
                ? C.teal
                : C.teal + 'aa';

            return (
              <g
                key={i}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'default' }}
              >
                {/* Bar */}
                <rect
                  x={x} y={y}
                  width={BAR_W} height={barH}
                  fill={fill}
                  rx={2}
                />
                {/* Y-axis label */}
                <text
                  x={x + BAR_W / 2}
                  y={CHART_H - 2}
                  textAnchor="middle"
                  fill={isHovered ? C.teal : C.dim}
                  fontSize={7}
                  fontFamily={LABEL}
                >
                  {LABELS[i]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <span style={{ fontFamily: LABEL, fontSize: 7, color: C.dim }}>
        hover bar for dollar amount · {Math.round(probability * 100)}% prob
      </span>
    </div>
  );
}
