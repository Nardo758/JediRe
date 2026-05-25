/**
 * Asset Detail Modal
 * 
 * Pops up after custom-label uploads to let users fill in key property details.
 * This enables proper categorization for the underwriting agent to use as comps.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Building2, MapPin, DollarSign, Percent, Calendar, Layers, CheckCircle, Upload, FileText, Loader2 } from 'lucide-react';
import { apiClient } from '../../services/api.client';
import { cloudStorageService } from '../../services/cloudStorage.service';

const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const C = {
  bg: '#0F1117',
  panel: '#161B27',
  input: '#1A2236',
  border: '#1E2D45',
  borderHover: '#2A3F5F',
  amber: '#F5A623',
  cyan: '#00BCD4',
  green: '#00D26A',
  red: '#FF4757',
  muted: '#475569',
  secondary: '#94A3B8',
  primary: '#E2E8F0',
};

interface AssetDetailModalProps {
  assetId: string;
  customLabel: string;
  onClose: () => void;
  onSave: () => void;
  /** When true, fetch existing asset data and prefill the form. */
  editMode?: boolean;
}

interface AssetDetails {
  propertyName: string;
  address: string;
  city: string;
  state: string;
  propertyType: string;
  assetClass: string;
  dealType: string;
  units: string;
  yearBuilt: string;
  stories: string;
  avgRent: string;
  occupancyPct: string;
  capRate: string;
  askingPrice: string;
  soldPrice: string;
  soldDate: string;
  noi: string;
}

// Strip everything except digits and a single decimal point so paste of
// "$233,621.00" → "233621.00" and the underlying state stays a plain number
// string. Negative signs are stripped — none of these fields support negatives.
const sanitizeMoney = (raw: string): string => {
  if (!raw) return '';
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
};

const formatMoneyDisplay = (raw: string): string => {
  if (!raw) return '';
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return raw;
  // Preserve trailing decimals if user typed them (e.g. "233621.5")
  const dotIdx = raw.indexOf('.');
  const decimals = dotIdx === -1 ? 0 : Math.min(2, raw.length - dotIdx - 1);
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

// Percent stays as plain digits (no negatives) and is clamped to [0, 100].
// Returns the cleaned + clamped value. Used in both onChange and onBlur.
const sanitizePercent = (raw: string): string => {
  if (!raw) return '';
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  const oneDot = firstDot === -1
    ? cleaned
    : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
  const n = parseFloat(oneDot);
  if (!Number.isFinite(n)) return oneDot;
  if (n > 100) return '100';
  if (n < 0) return '0';
  return oneDot;
};

// Render a stored 0-1 fraction as the cleanest possible percent string —
// integers stay integers ("0.91" → "91", "0.20" → "20", "1.00" → "100"),
// decimals are kept verbatim ("0.915" → "91.5") so reopen always shows
// exactly what the user typed.
const fractionToPercentString = (val: unknown): string => {
  if (val == null) return '';
  const n = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(n)) return '';
  // Defensive: if the stored value is already in percent form (>1), keep as-is.
  const percent = n <= 1 ? n * 100 : n;
  // Use 4 fractional digits as max precision (covers 0.0001 of a percent),
  // then trim trailing zeros only AFTER the decimal point so "20" stays "20"
  // and "100" stays "100" but "91.50" becomes "91.5" and "91.00" becomes "91".
  const s = percent.toFixed(4);
  if (!s.includes('.')) return s;
  return s.replace(/0+$/, '').replace(/\.$/, '');
};

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

const PROPERTY_TYPES = [
  { value: 'garden', label: 'Garden (1-3 stories)' },
  { value: 'mid-rise', label: 'Mid-Rise (4-6 stories)' },
  { value: 'high-rise', label: 'High-Rise (7+ stories)' },
  { value: 'mixed-use', label: 'Mixed-Use' },
  { value: 'townhome', label: 'Townhome / Build-to-Rent' },
  { value: 'senior', label: 'Senior Living' },
  { value: 'student', label: 'Student Housing' },
];

const ASSET_CLASSES = [
  { value: 'A', label: 'Class A — Luxury / New Construction' },
  { value: 'B', label: 'Class B — Market Rate / Well-Maintained' },
  { value: 'C', label: 'Class C — Workforce / Value-Add Opportunity' },
  { value: 'D', label: 'Class D — Distressed / Heavy Lift' },
];

const DEAL_TYPES = [
  { value: 'stabilized', label: 'Stabilized — 90%+ occupancy' },
  { value: 'value-add', label: 'Value-Add — Renovation / Repositioning' },
  { value: 'lease-up', label: 'Lease-Up — New construction filling' },
  { value: 'development', label: 'Development — Ground-up or entitled' },
  { value: 'distressed', label: 'Distressed — REO / Foreclosure' },
];

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  assetId,
  customLabel,
  onClose,
  onSave,
  editMode = false,
}) => {
  const [details, setDetails] = useState<AssetDetails>({
    propertyName: customLabel,
    address: '',
    city: '',
    state: '',
    propertyType: '',
    assetClass: '',
    dealType: '',
    units: '',
    yearBuilt: '',
    stories: '',
    avgRent: '',
    occupancyPct: '',
    capRate: '',
    askingPrice: '',
    soldPrice: '',
    soldDate: '',
    noi: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(editMode);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  interface AttachedFile {
    id: number;
    file_name: string;
    file_size: number;
    mime_type: string | null;
    parsing_status: string;
    parsing_stage: string | null;
    uploaded_at: string;
  }
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

  const fetchAttachedFiles = useCallback(async () => {
    if (!assetId || !editMode) return;
    try {
      const res = await apiClient.get(`/api/v1/data-library-assets/${assetId}/files`);
      setAttachedFiles(res.data?.files ?? []);
    } catch { /* non-critical */ }
  }, [assetId, editMode]);

  // Auto-Enrich state. The flow is:
  //   1) Click "Auto-Enrich" → POST /enrich/:assetId (preview only, no DB write)
  //   2) Stage per-field decisions in `decisions` state (no API calls yet)
  //   3) Click "Apply" → POST /enrichment-log/:logId/resolve once,
  //      either with {accept:true} (apply all proposed) or with the
  //      {resolutions:{field:'keep'|'overwrite'}} map for per-field control.
  //      "Discard" sends {accept:false} and persists nothing.
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<{
    fieldsEnriched: string[];
    conflicts: Array<{ field: string; existingValue: unknown; enrichedValue: unknown; source: string }>;
    previousScore: number;
    newScore: number;
    logId?: string;
  } | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  // Per-field staged decisions (only set when user explicitly chooses).
  const [decisions, setDecisions] = useState<Record<string, 'overwrite' | 'keep'>>({});
  // Track which money field is currently focused so we can show raw digits
  // while typing and only apply thousands-separator formatting on blur. This
  // avoids caret-jump glitches that happen when a controlled <input>'s value
  // shifts character count between keystrokes.
  const [focusedMoneyField, setFocusedMoneyField] = useState<keyof AssetDetails | null>(null);

  // Load attached files on mount (edit mode only)
  useEffect(() => {
    fetchAttachedFiles();
  }, [fetchAttachedFiles]);

  // Prefill from existing asset when in edit mode
  useEffect(() => {
    if (!editMode) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get(`/api/v1/data-library-assets/${assetId}`);
        if (cancelled) return;
        const a = res.data;
        // Canonical scale: occupancy_rate and cap_rate stored as 0-1 fractions,
        // displayed as 0-100 percent. Round-trip: typed 91 → saved 0.91 →
        // loaded "91" (no forced decimals — user-entered precision is preserved).
        const occPct = fractionToPercentString(a.occupancy_rate);
        const capPct = fractionToPercentString(a.cap_rate);
        setDetails({
          propertyName: a.property_name || customLabel || '',
          address: a.address || '',
          city: a.city || '',
          state: a.state || '',
          propertyType: a.property_type || '',
          assetClass: a.asset_class || '',
          dealType: a.deal_type || '',
          units: a.unit_count != null ? String(a.unit_count) : '',
          yearBuilt: a.year_built != null ? String(a.year_built) : '',
          stories: a.stories != null ? String(a.stories) : '',
          avgRent: a.avg_rent != null ? String(Number(a.avg_rent)) : '',
          occupancyPct: occPct,
          capRate: capPct,
          askingPrice: a.asking_price != null ? String(Number(a.asking_price)) : '',
          soldPrice: a.sale_price != null ? String(Number(a.sale_price)) : '',
          soldDate: a.sale_date ? String(a.sale_date).slice(0, 10) : '',
          noi: a.noi != null ? String(Number(a.noi)) : '',
        });
      } catch (err) {
        console.error('Failed to load asset:', err);
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [assetId, customLabel, editMode]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadStatus('Uploading...');
    setError(null);
    try {
      const fileArray = Array.from(files);

      // ── OM auto-fill: if exactly one PDF was dropped, parse it for field extraction first ──
      const singlePdf = fileArray.length === 1 && fileArray[0].name.toLowerCase().endsWith('.pdf');
      if (singlePdf && editMode) {
        setUploadStatus('Reading OM...');
        try {
          const form = new FormData();
          form.append('file', fileArray[0]);
          const omRes = await apiClient.post(
            `/api/v1/data-library-assets/${assetId}/parse-om`,
            form,
            { headers: { 'Content-Type': 'multipart/form-data' } },
          );
          if (omRes.data?.success && omRes.data?.extracted) {
            const ex = omRes.data.extracted as Record<string, string | null>;
            // Fill blank fields only — never overwrite what the user already typed.
            setDetails(d => ({
              propertyName: !d.propertyName || d.propertyName === customLabel ? (ex.propertyName ?? d.propertyName) : d.propertyName,
              address:      d.address      || ex.address      || '',
              city:         d.city         || ex.city         || '',
              state:        d.state        || ex.state        || '',
              propertyType: d.propertyType || '',
              assetClass:   d.assetClass   || '',
              dealType:     d.dealType     || '',
              units:        d.units        || ex.units        || '',
              yearBuilt:    d.yearBuilt    || ex.yearBuilt    || '',
              stories:      d.stories      || ex.stories      || '',
              avgRent:      d.avgRent      || ex.avgRent      || '',
              occupancyPct: d.occupancyPct || ex.occupancyPct || '',
              capRate:      d.capRate      || ex.capRate      || '',
              askingPrice:  d.askingPrice  || ex.askingPrice  || '',
              soldPrice:    d.soldPrice    || ex.soldPrice    || '',
              soldDate:     d.soldDate     || '',
              noi:          d.noi          || ex.noi          || '',
            }));
            setUploadStatus(omRes.data.usedOcr ? 'OCR complete — fields filled' : 'OM parsed — fields filled');
          }
        } catch {
          // OM parse failing should not block the regular upload
          setUploadStatus('Uploading...');
        }
      }

      // If exactly one ZIP was dropped, send it to the zip endpoint so it gets unpacked.
      const isSingleZip = fileArray.length === 1 && fileArray[0].name.toLowerCase().endsWith('.zip');
      const job = isSingleZip
        ? await cloudStorageService.uploadZip(
            fileArray[0],
            (p) => setUploadProgress(p),
            undefined,
            undefined,
            assetId,
          )
        : await cloudStorageService.uploadFiles(
            fileArray,
            (p) => setUploadProgress(p),
            undefined,
            undefined,
            assetId,
          );
      setUploadStatus('Parsing...');
      // Poll job status
      const start = Date.now();
      while (Date.now() - start < 120_000) {
        await new Promise(r => setTimeout(r, 1500));
        const s = await cloudStorageService.getUploadJob(job.id);
        if (s.status === 'complete') {
          setUploadStatus(`Files attached. Reloading...`);
          // Re-fetch asset and refresh form
          try {
            const res = await apiClient.get(`/api/v1/data-library-assets/${assetId}`);
            const a = res.data;
            const occ = a.occupancy_rate != null ? Number(a.occupancy_rate) : null;
            const occPct = occ == null ? '' : occ <= 1 ? (occ * 100).toFixed(1) : occ.toFixed(1);
            const cap = a.cap_rate != null ? Number(a.cap_rate) : null;
            const capPct = cap == null ? '' : cap <= 1 ? (cap * 100).toFixed(2) : cap.toFixed(2);
            setDetails(d => ({
              ...d,
              city: a.city || d.city,
              state: a.state || d.state,
              propertyType: a.property_type || d.propertyType,
              units: a.unit_count != null ? String(a.unit_count) : d.units,
              yearBuilt: a.year_built != null ? String(a.year_built) : d.yearBuilt,
              stories: a.stories != null ? String(a.stories) : d.stories,
              avgRent: a.avg_rent != null ? String(Number(a.avg_rent)) : d.avgRent,
              occupancyPct: occPct || d.occupancyPct,
              capRate: capPct || d.capRate,
              noi: a.noi != null ? String(Number(a.noi)) : d.noi,
            }));
            onSave(); // notify parent so list refreshes
            fetchAttachedFiles(); // refresh the file list in this modal
          } catch { /* ignore */ }
          setTimeout(() => { setUploadStatus(null); setUploading(false); }, 1200);
          return;
        }
        if (s.status === 'error') {
          setError(s.errors?.[0] || 'Upload failed');
          setUploading(false);
          setUploadStatus(null);
          return;
        }
      }
      setError('Upload timed out — check the data library shortly');
      setUploading(false);
      setUploadStatus(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(msg);
      setUploading(false);
      setUploadStatus(null);
    }
  };

  const updateField = (field: keyof AssetDetails, value: string) => {
    setDetails(prev => ({ ...prev, [field]: value }));
  };

  const calculateDQScore = (): number => {
    let score = 0;
    // Required fields (10 pts each, max 50)
    if (details.city && details.state) score += 10;
    if (details.propertyType) score += 10;
    if (details.assetClass) score += 10;
    if (details.units) score += 10;
    if (details.yearBuilt) score += 10;
    // Financial fields (10 pts each, max 50)
    if (details.avgRent) score += 10;
    if (details.occupancyPct) score += 10;
    if (details.capRate || details.noi) score += 10;
    // Either Asking Price OR Sold Price counts — never both, so DQ stays ≤ 100.
    if (details.askingPrice || details.soldPrice) score += 10;
    if (details.dealType) score += 10;
    return Math.min(score, 100);
  };

  const handleAutoEnrich = async () => {
    if (!assetId) return;
    setEnriching(true);
    setEnrichError(null);
    setEnrichResult(null);
    try {
      const parcelId = details.propertyName || customLabel;
      const res = await apiClient.post(
        `/api/v1/properties/by-parcel/${encodeURIComponent(parcelId)}/enrich`,
      );
      const r = res.data;
      setEnrichResult({
        fieldsEnriched: r.fieldsEnriched || [],
        conflicts: r.conflicts || [],
        previousScore: r.previousScore ?? 0,
        newScore: r.newScore ?? 0,
        logId: r.logId,
      });
      const init: Record<string, 'overwrite' | 'keep'> = {};
      for (const c of (r.conflicts || [])) init[c.field] = 'overwrite';
      setDecisions(init);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setEnrichError(e.response?.data?.error || e.message || 'Enrichment failed');
    } finally {
      setEnriching(false);
    }
  };

  const refreshAssetAfterApply = async () => {
    if (!assetId) return;
    try {
      const res = await apiClient.get(`/api/v1/data-library-assets/${assetId}`);
      const a = res.data;
      // Same canonical scale conversion as the editMode prefill: occupancy_rate
      // and cap_rate live in the DB as 0-1 fractions but the UI uses 0-100 %.
      // Without this, a save→enrich→save sequence would divide by 100 twice.
      const occPct = fractionToPercentString(a.occupancy_rate);
      setDetails(prev => ({
        ...prev,
        propertyName: a.property_name ?? prev.propertyName,
        address: a.address ?? prev.address,
        city: a.city ?? prev.city,
        state: a.state ?? prev.state,
        propertyType: a.property_type ?? prev.propertyType,
        assetClass: a.asset_class ?? prev.assetClass,
        yearBuilt: a.year_built != null ? String(a.year_built) : prev.yearBuilt,
        units: a.unit_count != null ? String(a.unit_count) : prev.units,
        occupancyPct: occPct || prev.occupancyPct,
      }));
    } catch {
      /* non-fatal */
    }
  };

  // Stage a single per-field decision (no API call).
  const stageDecision = (field: string, decision: 'overwrite' | 'keep') => {
    setDecisions(prev => ({ ...prev, [field]: decision }));
  };

  // Stage all conflicts at once (no API call).
  const stageAll = (decision: 'overwrite' | 'keep') => {
    if (!enrichResult) return;
    const next: Record<string, 'overwrite' | 'keep'> = {};
    for (const c of enrichResult.conflicts) next[c.field] = decision;
    setDecisions(next);
  };

  // Apply enrichment with the staged decisions. Single network call. If there
  // are no conflicts at all (e.g. only missing-field fills), this still works:
  // we send {accept: true} which applies every proposed field.
  const handleApply = async () => {
    if (!enrichResult?.logId) return;
    setResolving(true);
    try {
      const hasConflicts = enrichResult.conflicts.length > 0;
      if (hasConflicts) {
        await apiClient.post(`/api/v1/property-discovery/enrichment-log/${enrichResult.logId}/resolve`, {
          resolutions: decisions,
        });
      } else {
        await apiClient.post(`/api/v1/property-discovery/enrichment-log/${enrichResult.logId}/resolve`, {
          accept: true,
        });
      }
      const acceptedConflictFields = enrichResult.conflicts
        .filter(c => decisions[c.field] === 'overwrite')
        .map(c => c.field);
      setEnrichResult(prev => prev ? {
        ...prev,
        conflicts: [],
        fieldsEnriched: [...prev.fieldsEnriched, ...acceptedConflictFields],
      } : prev);
      setDecisions({});
      await refreshAssetAfterApply();
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setEnrichError(e.response?.data?.error || e.message || 'Failed to apply enrichment');
    } finally {
      setResolving(false);
    }
  };

  // Discard the proposal entirely. Server marks the log rejected; no asset writes.
  const handleDiscard = async () => {
    if (!enrichResult?.logId) return;
    setResolving(true);
    try {
      await apiClient.post(`/api/v1/property-discovery/enrichment-log/${enrichResult.logId}/resolve`, {
        accept: false,
      });
      setEnrichResult(null);
      setDecisions({});
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setEnrichError(e.response?.data?.error || e.message || 'Failed to discard enrichment');
    } finally {
      setResolving(false);
    }
  };

  const handleSave = async () => {
    if (!assetId) {
      setError('Asset ID missing — finish the upload first, then re-open this modal.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Canonical scales:
      //   occupancy_rate, cap_rate → 0-1 fraction in DB (UI shows 0-100 %)
      //   asking_price             → numeric dollars, separate column
      //   sale_price               → ACTUAL sold price (only set when soldPrice provided)
      //   sale_date                → ISO date string for sold date
      const payload: Record<string, unknown> = {
        property_name: details.propertyName || customLabel,
        address: details.address || null,
        city: details.city || null,
        state: details.state || null,
        property_type: details.propertyType || null,
        asset_class: details.assetClass || null,
        deal_type: details.dealType || null,
        unit_count: details.units ? parseInt(details.units) : null,
        year_built: details.yearBuilt ? parseInt(details.yearBuilt) : null,
        stories: details.stories ? parseInt(details.stories) : null,
        avg_rent: details.avgRent ? parseFloat(details.avgRent) : null,
        occupancy_rate: details.occupancyPct ? parseFloat(details.occupancyPct) / 100 : null,
        cap_rate: details.capRate ? parseFloat(details.capRate) / 100 : null,
        asking_price: details.askingPrice ? parseFloat(details.askingPrice) : null,
        sale_price: details.soldPrice ? parseFloat(details.soldPrice) : null,
        sale_date: details.soldDate || null,
        noi: details.noi ? parseFloat(details.noi) : null,
        data_quality_score: calculateDQScore(),
      };

      // Calculate vintage band
      if (details.yearBuilt) {
        const year = parseInt(details.yearBuilt);
        if (year < 1980) payload.vintage_band = 'pre-1980';
        else if (year < 2000) payload.vintage_band = '1980-1999';
        else if (year < 2010) payload.vintage_band = '2000-2009';
        else if (year < 2020) payload.vintage_band = '2010-2019';
        else payload.vintage_band = '2020+';
      }

      // Calculate unit count band
      if (details.units) {
        const units = parseInt(details.units);
        if (units < 100) payload.unit_count_band = '<100';
        else if (units < 200) payload.unit_count_band = '100-199';
        else if (units < 300) payload.unit_count_band = '200-299';
        else if (units < 400) payload.unit_count_band = '300-399';
        else payload.unit_count_band = '400+';
      }

      await apiClient.patch(`/api/v1/data-library-assets/${assetId}`, payload);
      setSuccess(true);
      setTimeout(() => {
        onSave();
        onClose();
      }, 800);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save details');
      setSuccess(false);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    background: C.input,
    border: `1px solid ${C.border}`,
    color: C.primary,
    fontFamily: MONO,
    fontSize: 11,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 9,
    color: C.muted,
    marginBottom: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  };

  const dqScore = calculateDQScore();
  const dqColor = dqScore >= 70 ? C.green : dqScore >= 40 ? C.amber : C.red;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: C.panel, border: `1px solid ${C.border}`,
          maxWidth: 600, width: '100%', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: C.bg,
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.cyan, letterSpacing: 0.5, fontFamily: MONO }}>
              {editMode ? `EDIT: ${details.propertyName || customLabel}` : 'ADD ASSET DETAILS'}
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
              {editMode ? 'Update fields or attach more files' : 'Fill in property details for better comp matching'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* DQ Score Preview */}
        <div style={{
          padding: '10px 18px', background: `${dqColor}11`, borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 10, color: C.secondary }}>
            Data Quality Score
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 100, height: 6, background: C.input, borderRadius: 3 }}>
              <div style={{ width: `${dqScore}%`, height: '100%', background: dqColor, borderRadius: 3, transition: 'all 0.3s' }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: dqColor, fontFamily: MONO }}>{dqScore}</span>
          </div>
        </div>

        {/* Auto-Enrich Bar (edit mode only) */}
        {editMode && assetId && (
          <div style={{
            padding: '10px 18px', background: C.bg, borderBottom: `1px solid ${C.border}`,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Auto-Enrich (Municipal APIs + Apartment Locator)
              </div>
              {(() => {
                const canEnrich = !!(details.address && details.city && details.state);
                const disabled = enriching || !canEnrich;
                return (
                  <button
                    onClick={handleAutoEnrich}
                    disabled={disabled}
                    title={canEnrich ? '' : 'Address, City, and State are required to auto-enrich'}
                    style={{
                      padding: '6px 14px', fontSize: 11, fontWeight: 700,
                      background: disabled ? C.input : C.cyan,
                      color: disabled ? C.muted : '#001018',
                      border: 'none', cursor: enriching ? 'wait' : (canEnrich ? 'pointer' : 'not-allowed'),
                      fontFamily: MONO, letterSpacing: 0.5,
                    }}
                  >
                    {enriching ? 'ENRICHING…' : 'AUTO-ENRICH'}
                  </button>
                );
              })()}
            </div>
            {!(details.address && details.city && details.state) && (
              <div style={{ fontSize: 10, color: C.muted, fontFamily: MONO }}>
                Requires Address + City + State to enrich.
              </div>
            )}
            {enrichError && (
              <div style={{ fontSize: 10, color: '#FCA5A5', fontFamily: MONO }}>{enrichError}</div>
            )}
            {enrichResult && (
              <div style={{ fontSize: 10, color: C.secondary, fontFamily: MONO }}>
                Enriched <strong style={{ color: C.cyan }}>{enrichResult.fieldsEnriched.length}</strong> field(s);
                DQ <strong style={{ color: C.cyan }}>{enrichResult.previousScore}</strong> → <strong style={{ color: dqColor }}>{enrichResult.newScore}</strong>
                {enrichResult.conflicts.length > 0 && (
                  <> · <span style={{ color: '#FCD34D' }}>{enrichResult.conflicts.length} conflict(s) need review</span></>
                )}
              </div>
            )}
            {enrichResult && enrichResult.logId && (
              <div style={{
                marginTop: 4, border: `1px solid ${C.border}`, background: C.panel,
              }}>
                {enrichResult.conflicts.length > 0 && (
                  <div style={{ maxHeight: 200, overflow: 'auto' }}>
                    {enrichResult.conflicts.map((c, idx) => {
                      const decision = decisions[c.field] || 'overwrite';
                      const accepted = decision === 'overwrite';
                      return (
                        <div key={`${c.field}-${idx}`} style={{
                          padding: '8px 10px', borderBottom: idx < enrichResult.conflicts.length - 1 ? `1px solid ${C.border}` : 'none',
                          display: 'flex', flexDirection: 'column', gap: 4,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ fontSize: 10, color: C.cyan, fontFamily: MONO, fontWeight: 700 }}>
                              {c.field} <span style={{ color: C.muted, fontWeight: 400 }}>· {c.source}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                onClick={() => stageDecision(c.field, 'overwrite')}
                                disabled={resolving}
                                style={{
                                  padding: '2px 8px', fontSize: 9, fontWeight: 700,
                                  background: accepted ? '#10B981' : 'transparent',
                                  color: accepted ? '#001018' : '#10B981',
                                  border: accepted ? 'none' : '1px solid #10B981',
                                  cursor: resolving ? 'wait' : 'pointer', fontFamily: MONO,
                                }}
                              >
                                ACCEPT
                              </button>
                              <button
                                onClick={() => stageDecision(c.field, 'keep')}
                                disabled={resolving}
                                style={{
                                  padding: '2px 8px', fontSize: 9, fontWeight: 700,
                                  background: !accepted ? '#7F1D1D' : 'transparent',
                                  color: !accepted ? '#FFF' : '#FCA5A5',
                                  border: !accepted ? 'none' : '1px solid #7F1D1D',
                                  cursor: resolving ? 'wait' : 'pointer', fontFamily: MONO,
                                }}
                              >
                                KEEP
                              </button>
                            </div>
                          </div>
                          <div style={{ fontSize: 10, color: C.secondary, display: 'flex', gap: 12 }}>
                            <div>Existing: <span style={{ color: C.primary, fontFamily: MONO }}>{String(c.existingValue ?? '—')}</span></div>
                            <div>Proposed: <span style={{ color: '#FCD34D', fontFamily: MONO }}>{String(c.enrichedValue ?? '—')}</span></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{
                  display: 'flex', gap: 6, padding: '8px 10px', alignItems: 'center', flexWrap: 'wrap',
                  borderTop: enrichResult.conflicts.length > 0 ? `1px solid ${C.border}` : 'none',
                  background: C.bg,
                }}>
                  {enrichResult.conflicts.length > 0 && (
                    <>
                      <button
                        onClick={() => stageAll('overwrite')}
                        disabled={resolving}
                        style={{
                          padding: '2px 8px', fontSize: 9, fontWeight: 700,
                          background: 'transparent', color: '#10B981',
                          border: '1px solid #10B981',
                          cursor: resolving ? 'wait' : 'pointer', fontFamily: MONO,
                        }}
                      >
                        ACCEPT ALL
                      </button>
                      <button
                        onClick={() => stageAll('keep')}
                        disabled={resolving}
                        style={{
                          padding: '2px 8px', fontSize: 9, fontWeight: 700,
                          background: 'transparent', color: '#FCA5A5',
                          border: '1px solid #7F1D1D',
                          cursor: resolving ? 'wait' : 'pointer', fontFamily: MONO,
                        }}
                      >
                        KEEP ALL
                      </button>
                      <div style={{ flex: 1 }} />
                    </>
                  )}
                  <button
                    onClick={handleApply}
                    disabled={resolving}
                    style={{
                      padding: '4px 14px', fontSize: 10, fontWeight: 700,
                      background: '#10B981', color: '#001018', border: 'none',
                      cursor: resolving ? 'wait' : 'pointer', fontFamily: MONO,
                    }}
                  >
                    {resolving ? '…' : 'APPLY ENRICHMENT'}
                  </button>
                  <button
                    onClick={handleDiscard}
                    disabled={resolving}
                    style={{
                      padding: '4px 12px', fontSize: 10, fontWeight: 700,
                      background: 'transparent', color: '#FCA5A5',
                      border: '1px solid #7F1D1D', cursor: resolving ? 'wait' : 'pointer', fontFamily: MONO,
                    }}
                  >
                    DISCARD
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Form */}
        <div style={{ flex: 1, overflow: 'auto', padding: 18 }}>
          {error && (
            <div style={{ marginBottom: 16, padding: '10px 12px', background: `${C.red}18`, border: `1px solid ${C.red}44`, fontSize: 11, color: '#FCA5A5' }}>
              {error}
            </div>
          )}

          {/* Property Name */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>
              <Building2 size={10} style={{ display: 'inline', marginRight: 4 }} />
              Property Name
            </label>
            <input
              value={details.propertyName}
              onChange={e => updateField('propertyName', e.target.value)}
              placeholder="e.g. The Arbors at Midtown"
              style={inputStyle}
            />
          </div>

          {/* Location Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>
                <MapPin size={10} style={{ display: 'inline', marginRight: 4 }} />
                City
              </label>
              <input
                value={details.city}
                onChange={e => updateField('city', e.target.value)}
                placeholder="Atlanta"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Address</label>
              <input
                value={details.address}
                onChange={e => updateField('address', e.target.value)}
                placeholder="123 Main St"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>State</label>
              <select value={details.state} onChange={e => updateField('state', e.target.value)} style={selectStyle}>
                <option value="">—</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Property Classification */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>
                <Layers size={10} style={{ display: 'inline', marginRight: 4 }} />
                Property Type
              </label>
              <select value={details.propertyType} onChange={e => updateField('propertyType', e.target.value)} style={selectStyle}>
                <option value="">Select type...</option>
                {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Asset Class</label>
              <select value={details.assetClass} onChange={e => updateField('assetClass', e.target.value)} style={selectStyle}>
                <option value="">Select class...</option>
                {ASSET_CLASSES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Deal Type</label>
            <select value={details.dealType} onChange={e => updateField('dealType', e.target.value)} style={selectStyle}>
              <option value="">Select deal type...</option>
              {DEAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Physical Attributes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>
                <Building2 size={10} style={{ display: 'inline', marginRight: 4 }} />
                Units
              </label>
              <input
                type="number"
                value={details.units}
                onChange={e => updateField('units', e.target.value)}
                placeholder="200"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                <Calendar size={10} style={{ display: 'inline', marginRight: 4 }} />
                Year Built
              </label>
              <input
                type="number"
                value={details.yearBuilt}
                onChange={e => updateField('yearBuilt', e.target.value)}
                placeholder="1998"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Stories</label>
              <input
                type="number"
                value={details.stories}
                onChange={e => updateField('stories', e.target.value)}
                placeholder="3"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Financial Metrics */}
          <div style={{ fontSize: 10, fontWeight: 600, color: C.amber, marginBottom: 10, marginTop: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
            <DollarSign size={12} />
            FINANCIAL METRICS
          </div>

          {/* Money / Percent affordances:
              - $ prefix shown via absolute-positioned glyph; underlying state is plain digits.
              - Money: raw digits while focused; thousands separators only after blur
                (prevents caret-jump UX issue on every keystroke).
              - Paste of "$233,621.00" → state "233621.00" via sanitizeMoney.
              - % suffix on Cap Rate + Occupancy; values fully clamped to [0, 100]. */}
          {(() => {
            const moneyInputStyle: React.CSSProperties = { ...inputStyle, paddingLeft: 22 };
            const percentInputStyle: React.CSSProperties = { ...inputStyle, paddingRight: 22 };
            const wrapStyle: React.CSSProperties = { position: 'relative' };
            const dollarGlyph: React.CSSProperties = {
              position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
              fontFamily: MONO, fontSize: 11, color: C.muted, pointerEvents: 'none',
            };
            const percentGlyph: React.CSSProperties = {
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              fontFamily: MONO, fontSize: 11, color: C.muted, pointerEvents: 'none',
            };
            // While the field is focused, render the raw digits so the caret
            // stays put. Once focus leaves, swap in the comma-formatted value.
            const moneyDisplay = (field: keyof AssetDetails, val: string) =>
              focusedMoneyField === field ? val : formatMoneyDisplay(val);
            const onMoneyChange = (field: keyof AssetDetails) => (e: React.ChangeEvent<HTMLInputElement>) => {
              updateField(field, sanitizeMoney(e.target.value));
            };
            const onMoneyFocus = (field: keyof AssetDetails) => () => setFocusedMoneyField(field);
            const onMoneyBlur = (field: keyof AssetDetails) => () => {
              setFocusedMoneyField(null);
              // Drop any trailing dot the user may have left.
              const raw = sanitizeMoney(details[field] as string).replace(/\.$/, '');
              if (raw !== details[field]) updateField(field, raw);
            };
            // sanitizePercent already clamps to [0, 100] and strips negatives,
            // so the same call works for both onChange and onBlur.
            const onPercentChange = (field: keyof AssetDetails) => (e: React.ChangeEvent<HTMLInputElement>) => {
              updateField(field, sanitizePercent(e.target.value));
            };
            const onPercentBlur = (field: keyof AssetDetails) => () => {
              const v = sanitizePercent(details[field] as string).replace(/\.$/, '');
              if (v !== details[field]) updateField(field, v);
            };
            return (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={labelStyle}>Avg Rent ($/unit/mo)</label>
                    <div style={wrapStyle}>
                      <span style={dollarGlyph}>$</span>
                      <input
                        inputMode="decimal"
                        value={moneyDisplay('avgRent', details.avgRent)}
                        onChange={onMoneyChange('avgRent')}
                        onFocus={onMoneyFocus('avgRent')}
                        onBlur={onMoneyBlur('avgRent')}
                        placeholder="1,450"
                        style={moneyInputStyle}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>
                      <Percent size={10} style={{ display: 'inline', marginRight: 4 }} />
                      Occupancy
                    </label>
                    <div style={wrapStyle}>
                      <input
                        inputMode="decimal"
                        value={details.occupancyPct}
                        onChange={onPercentChange('occupancyPct')}
                        onBlur={onPercentBlur('occupancyPct')}
                        placeholder="94"
                        style={percentInputStyle}
                      />
                      <span style={percentGlyph}>%</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={labelStyle}>Cap Rate</label>
                    <div style={wrapStyle}>
                      <input
                        inputMode="decimal"
                        value={details.capRate}
                        onChange={onPercentChange('capRate')}
                        onBlur={onPercentBlur('capRate')}
                        placeholder="5.25"
                        style={percentInputStyle}
                      />
                      <span style={percentGlyph}>%</span>
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Asking Price</label>
                    <div style={wrapStyle}>
                      <span style={dollarGlyph}>$</span>
                      <input
                        inputMode="decimal"
                        value={moneyDisplay('askingPrice', details.askingPrice)}
                        onChange={onMoneyChange('askingPrice')}
                        onFocus={onMoneyFocus('askingPrice')}
                        onBlur={onMoneyBlur('askingPrice')}
                        placeholder="25,000,000"
                        style={moneyInputStyle}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>NOI</label>
                    <div style={wrapStyle}>
                      <span style={dollarGlyph}>$</span>
                      <input
                        inputMode="decimal"
                        value={moneyDisplay('noi', details.noi)}
                        onChange={onMoneyChange('noi')}
                        onFocus={onMoneyFocus('noi')}
                        onBlur={onMoneyBlur('noi')}
                        placeholder="1,312,500"
                        style={moneyInputStyle}
                      />
                    </div>
                  </div>
                </div>

                {/* Sold Price + Sold Date — distinct from Asking Price.
                    Sold Price → sale_price; Sold Date → sale_date. */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={labelStyle}>Sold Price</label>
                    <div style={wrapStyle}>
                      <span style={dollarGlyph}>$</span>
                      <input
                        inputMode="decimal"
                        value={moneyDisplay('soldPrice', details.soldPrice)}
                        onChange={onMoneyChange('soldPrice')}
                        onFocus={onMoneyFocus('soldPrice')}
                        onBlur={onMoneyBlur('soldPrice')}
                        placeholder="24,500,000"
                        style={moneyInputStyle}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>
                      <Calendar size={10} style={{ display: 'inline', marginRight: 4 }} />
                      Sold Date
                    </label>
                    <input
                      type="date"
                      value={details.soldDate}
                      onChange={e => updateField('soldDate', e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </>
            );
          })()}

          {/* Files / Documents */}
          {editMode && (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.amber, marginBottom: 10, marginTop: 24, display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={12} />
                ATTACHED DOCUMENTS{attachedFiles.length > 0 && ` (${attachedFiles.length})`}
              </div>

              {/* Existing file list */}
              {attachedFiles.length > 0 && (
                <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {attachedFiles.map(f => {
                    const ext = f.file_name.split('.').pop()?.toLowerCase() ?? '';
                    const sizeKb = f.file_size > 0 ? (f.file_size / 1024).toFixed(0) : null;
                    const statusColor =
                      f.parsing_status === 'complete' ? C.green :
                      f.parsing_status === 'error'    ? C.red    : C.amber;
                    const statusLabel =
                      f.parsing_status === 'complete' ? (f.parsing_stage ?? 'parsed') :
                      f.parsing_status === 'error'    ? 'error'   : 'processing';
                    const uploadedDate = new Date(f.uploaded_at).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric', year: '2-digit',
                    });
                    return (
                      <div
                        key={f.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          background: C.input, padding: '7px 10px',
                          border: `1px solid ${C.border}`,
                          fontFamily: MONO, fontSize: 10,
                        }}
                      >
                        <FileText size={11} style={{ color: C.cyan, flexShrink: 0 }} />
                        <span style={{ color: C.primary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.file_name}
                        </span>
                        {ext && (
                          <span style={{ color: C.muted, fontSize: 9, background: C.bg, padding: '1px 4px', borderRadius: 2, flexShrink: 0 }}>
                            {ext.toUpperCase()}
                          </span>
                        )}
                        {sizeKb && (
                          <span style={{ color: C.muted, fontSize: 9, flexShrink: 0 }}>
                            {Number(sizeKb) >= 1024 ? `${(Number(sizeKb)/1024).toFixed(1)} MB` : `${sizeKb} KB`}
                          </span>
                        )}
                        <span style={{ color: C.muted, fontSize: 9, flexShrink: 0 }}>{uploadedDate}</span>
                        <span style={{ color: statusColor, fontSize: 9, flexShrink: 0 }}>{statusLabel}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.xlsx,.xls,.csv,.zip"
                style={{ display: 'none' }}
                onChange={e => handleFiles(e.target.files)}
              />
              <div
                onClick={() => !uploading && fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); }}
                onDrop={e => { e.preventDefault(); if (!uploading) handleFiles(e.dataTransfer.files); }}
                style={{
                  border: `1px dashed ${uploading ? C.cyan : C.borderHover}`,
                  background: C.input,
                  padding: 18,
                  textAlign: 'center',
                  cursor: uploading ? 'wait' : 'pointer',
                  fontFamily: MONO,
                  fontSize: 11,
                  color: C.secondary,
                }}
              >
                {uploading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <Loader2 size={16} style={{ color: C.cyan, animation: 'spin 1s linear infinite' }} />
                    <div>{uploadStatus || 'Working...'}</div>
                    {uploadProgress > 0 && uploadProgress < 100 && (
                      <div style={{ width: 200, height: 4, background: C.bg, borderRadius: 2 }}>
                        <div style={{ width: `${uploadProgress}%`, height: '100%', background: C.cyan, borderRadius: 2 }} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <Upload size={18} style={{ color: C.cyan }} />
                    <div>Drop T12, rent roll, OM, or ZIP here — or click to browse</div>
                    <div style={{ fontSize: 9, color: C.muted }}>
                      PDF · XLSX · CSV · ZIP — extracted fields will fill in any blanks above
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 18px', borderTop: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: C.bg,
        }}>
          <div style={{ fontSize: 9, color: C.muted }}>
            Fill in more fields to improve comp matching accuracy
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px', background: 'transparent',
                border: `1px solid ${C.border}`, color: C.muted,
                fontFamily: MONO, fontSize: 11, cursor: 'pointer',
              }}
            >
              SKIP
            </button>
            <button
              onClick={handleSave}
              disabled={saving || success}
              style={{
                padding: '8px 20px', background: C.green,
                border: 'none', color: '#000',
                fontFamily: MONO, fontSize: 11, fontWeight: 700,
                cursor: saving || success ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              {success ? (
                <>
                  <CheckCircle size={12} />
                  SAVED
                </>
              ) : saving ? 'SAVING...' : 'SAVE DETAILS'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetDetailModal;
