import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../services/api.client';
import { useTheme } from '../contexts/ThemeContext';
import SiteFinderWidget, { type SiteInstructionView } from '../components/site-finder/SiteFinderWidget';
import type { SiteParcel, SiteReview, SiteRun } from '../../../shared/site-finder';

type SortKey = 'county' | 'address' | 'parcelId' | 'acres' | 'currentPropertyType' | 'district';
const statusColors: Record<string, string> = { 'by-right': '#00D26A', conditional: '#F5A623', prohibited: '#FF4757', unverified: '#A78BFA', 'not-requested': '#6B7A8D' };
const formatDate = (value?: string) => value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Not reported';
const errorMessage = (error: unknown, fallback: string) => {
  const value = error as { response?: { data?: { error?: string } } };
  return value.response?.data?.error || fallback;
};
const actionableError = (error: unknown, fallback: string) => {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 401) return 'Your sign-in has expired. Sign in again, then resume this instruction.';
  if (status === 404) return 'This instruction route is unavailable or the instruction has expired. Your text is retained; submit it again as a new request.';
  if (status === 429) return 'Too many requests. Wait briefly, then retry the same instruction.';
  if (status === 503) return 'The screening service, provider, or parcel catalog is temporarily unavailable. Your instruction is retained; retry shortly.';
  return errorMessage(error, fallback);
};
const instructionStorageKey = (userId: string) => `site-finder:pending-instruction:${userId}`;
const isInstruction = (value: unknown): value is SiteInstructionView => {
  if (!value || typeof value !== 'object') return false;
  const item = value as SiteInstructionView;
  return typeof item.id === 'string' && typeof item.text === 'string' && ['queued', 'understanding', 'clarification', 'searching', 'error'].includes(item.status);
};
function GeometryOutline({ parcel }: { parcel: SiteParcel }) {
  const rings = parcel.geometry?.type === 'MultiPolygon' ? parcel.geometry.coordinates.flat() : parcel.geometry?.coordinates;
  if (!rings?.[0]?.length) return <div className="sf-no-geometry">No verified parcel boundary supplied for this record.</div>;
  const xs = rings.flat().map(point => point[0]); const ys = rings.flat().map(point => point[1]);
  const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const width = maxX - minX || 1; const height = maxY - minY || 1;
  const scale=Math.min(176/width,96/height);
  const path = rings.map(ring => ring.map(([x,y],i)=>`${i?'L':'M'}${12+(x-minX)*scale},${108-(y-minY)*scale}`).join(' ')+' Z').join(' ');
  return <div className="sf-geometry"><div className="sf-section-label">SUPPLIED PARCEL GEOMETRY</div><svg viewBox="0 0 200 120" role="img" aria-label="Outline of supplied parcel polygon"><path d={path} fillRule="evenodd" fill="#00BCD41B" stroke="#00BCD4" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg><span>Boundary from parcel record; not a basemap.</span></div>;
}

function ReviewPane({ parcel, review, busy, onRefresh, onClose }: { parcel: SiteParcel; review: SiteReview; busy: boolean; onRefresh: () => void; onClose: () => void }) {
  const color = statusColors[review.status] ?? '#6B7A8D';
  return <aside className="sf-review">
    <div className="sf-review-head"><div><div className="sf-eyebrow">PARCEL REVIEW · NO DEAL CREATED</div><h2>{parcel.address || 'Address not reported'}</h2><div className="sf-parcel-ref">{parcel.county} · {parcel.parcelId}</div></div><button className="sf-icon-button" onClick={onClose} aria-label="Close parcel review">×</button></div>
    <div className="sf-review-body">
      <div className="sf-permission" style={{ borderColor: `${color}55`, background: `${color}0B` }}>
        <span className="sf-eyebrow">REQUESTED USE · SCREENING STATUS</span>
        <strong style={{ color }}>{review.status.replace('-', ' ').toUpperCase()}</strong>
        <span>{review.requestedUse || 'No intended use requested'}</span>
        {review.legalUse && <span>Recorded legal use: {review.legalUse}</span>}
        {review.districtName && <span>District: {review.districtName}</span>}
      </div>
      <div className="sf-facts">
        <div><span>Parcel area</span><b>{parcel.acres.toLocaleString(undefined, { maximumFractionDigits: 3 })} ac</b><small>{parcel.areaSqft.toLocaleString()} sqft</small></div>
        <div><span>Current property type</span><b>{parcel.currentPropertyType || 'Not reported'}</b><small>{parcel.currentLandUse || 'Land use not reported'}</small></div>
        <div><span>Jurisdiction / district</span><b>{parcel.jurisdiction || 'Not verified'}</b><small>{parcel.district || 'District not reported'}</small></div>
      </div>
      <section className="sf-evidence-section"><div className="sf-section-label">PARCEL PROVENANCE</div><div className="sf-check-date">Retrieved {formatDate(parcel.retrievedAt)}{parcel.sourceUpdatedAt ? ` · Source updated ${formatDate(parcel.sourceUpdatedAt)}` : ' · Source update date not provided'}</div><a href={parcel.areaSourceUrl} target="_blank" rel="noreferrer">Unrounded acreage source ↗</a>{parcel.classificationSourceUrl && <div><a href={parcel.classificationSourceUrl} target="_blank" rel="noreferrer">Current assessor classification source ↗</a></div>}{parcel.jurisdictionSourceUrl && <div><a href={parcel.jurisdictionSourceUrl} target="_blank" rel="noreferrer">Controlling boundary source ↗</a></div>}</section>
      <GeometryOutline parcel={parcel} />
      {review.conditions?.length > 0 && <section className="sf-evidence-section"><div className="sf-section-label">CONDITIONS</div><ul>{review.conditions.map((item, i) => <li key={i}>{item}</li>)}</ul></section>}
      {review.standards?.length > 0 && <section className="sf-evidence-section"><div className="sf-section-label">REPORTED STANDARDS</div>{review.standards.map((item, i) => <article className="sf-standard" key={`${item.name}-${i}`}><div><b>{item.name}</b><strong>{item.value}</strong></div><Evidence evidence={item.evidence} /></article>)}</section>}
      {review.evidence?.length > 0 && <section className="sf-evidence-section"><div className="sf-section-label">PRIMARY-SOURCE CITATIONS</div>{review.evidence.map((item, i) => <Evidence key={`${item.url}-${i}`} evidence={item} />)}</section>}
      {review.limitations?.length > 0 && <section className="sf-caution"><div className="sf-section-label">LIMITATIONS</div><ul>{review.limitations.map((item, i) => <li key={i}>{item}</li>)}</ul></section>}
      {parcel.warnings?.length > 0 && <section className="sf-caution"><div className="sf-section-label">PARCEL WARNINGS</div><ul>{parcel.warnings.map((item, i) => <li key={i}>{item}</li>)}</ul></section>}
      <div className="sf-check-date">ZONING SOURCES CHECKED · {formatDate(review.checkedAt)}</div>
    </div>
    <div className="sf-review-actions"><button className="sf-secondary-button" onClick={onRefresh} disabled={busy}>{busy ? 'CHECKING…' : 'REFRESH REVIEW'}</button><a href={parcel.sourceUrl} target="_blank" rel="noreferrer">Parcel source ↗</a></div>
  </aside>;
}

function Evidence({ evidence }: { evidence: { section: string; excerpt: string; url: string; checkedAt: string } }) {
  return <div className="sf-citation"><div className="sf-citation-title">{evidence.section || 'Official source'} <span>Checked {formatDate(evidence.checkedAt)}</span></div><blockquote>“{evidence.excerpt}”</blockquote><a href={evidence.url} target="_blank" rel="noreferrer">Open source document ↗</a></div>;
}

export const SiteFinderPage: React.FC = () => {
  const { theme } = useTheme();
  // This app bootstraps its signed-in user before mounting routes; AuthContext is not mounted here.
  // This identity scopes local drafts only. Every server request still verifies the bearer session.
  const [user] = useState<{ id: string } | null>(() => {
    try {
      const value = JSON.parse(localStorage.getItem('jedi_user') || 'null');
      return typeof value?.id === 'string' ? { id: value.id } : null;
    } catch { return null; }
  });
  const [params, setParams] = useSearchParams();
  const navigationRef = useRef({ instructionId: params.get('instruction'), runId: params.get('run') });
  navigationRef.current = { instructionId: params.get('instruction'), runId: params.get('run') };
  const [instructionText, setInstructionText] = useState('');
  const [instruction, setInstruction] = useState<SiteInstructionView | null>(null);
  const [instructionHistory, setInstructionHistory] = useState<SiteInstructionView[]>([]);
  const [instructionBusy, setInstructionBusy] = useState(false);
  const [instructionError, setInstructionError] = useState('');
  const [clarificationOf, setClarificationOf] = useState<string | undefined>();
  const [canRetryNetwork, setCanRetryNetwork] = useState(false);
  const [pollingPaused, setPollingPaused] = useState(false);
  const [pollFailures, setPollFailures] = useState(0);
  const [run, setRun] = useState<SiteRun | null>(null);
  const [history, setHistory] = useState<SiteRun[]>([]);
  const [runBusy, setRunBusy] = useState(false);
  const [pageError, setPageError] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [tab, setTab] = useState<'qualified' | 'leads' | 'prohibited' | 'not-requested'>('qualified');
  const [sortKey, setSortKey] = useState<SortKey>('acres');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [filterText, setFilterText] = useState('');
  const instructionPollRef = useRef<number | null>(null);
  const runPollRef = useRef<number | null>(null);
  const activeRunRef = useRef('');
  const retryRequestRef = useRef<{ id: string; text: string; clarificationOf?: string } | null>(null);
  const runRetryIdRef = useRef<{ runId: string; id: string } | null>(null);
  const recoveryKeyRef = useRef('');
  const historyLoadedForRef = useRef('');
  const [runPollFailures, setRunPollFailures] = useState(0);
  const [runPollingPaused, setRunPollingPaused] = useState(false);
  const dark = theme !== 'light';

  const loadRun = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await apiClient.get(`/api/v1/site-finder/runs/${encodeURIComponent(id)}`);
      const value = response.data.data as SiteRun;
      if (navigationRef.current.runId !== id) return true;
      setRun(value); setPageError('');
      if (activeRunRef.current !== value.id) {
        activeRunRef.current=value.id;
        setTab(value.criteria.intendedUse ? 'qualified' : 'not-requested');
        setPage(0);setFilterText('');setSelectedKey('');
      }
      return true;
    } catch (error) {
      if (navigationRef.current.runId !== id) return true;
      setPageError(errorMessage(error, 'Could not restore this server-side run. It may have expired or may not be available to this account.'));
      return false;
    }
  }, []);

  const loadInstructionRun = useCallback(async (id: string, instructionId: string) => {
    const navigation = navigationRef.current;
    if (navigation.instructionId !== instructionId || (navigation.runId && navigation.runId !== id)) return;
    navigationRef.current = { instructionId, runId: id };
    setParams(current => { current.set('run', id); return current; }, { replace: true });
    const loaded = await loadRun(id);
    if (!loaded) setRunPollingPaused(true);
    return loaded;
  }, [loadRun, setParams]);

  const loadInstruction = useCallback(async (id: string, updateUrl = false, preserveDraft = false) => {
    const response = await apiClient.get(`/api/v1/site-finder/instructions/${encodeURIComponent(id)}`);
    const value = response.data.data as SiteInstructionView;
    if (!isInstruction(value)) throw new Error('The instruction response was not valid.');
    if (navigationRef.current.instructionId !== id) return value;
    setInstruction(value);
    setInstructionHistory(old => [value, ...old.filter(item => item.id !== value.id)].slice(0, 10));
    setInstructionError('');
    setCanRetryNetwork(false);
    retryRequestRef.current = null;
    setPollFailures(0);
    setPollingPaused(false);
    if (!preserveDraft) {
      setInstructionText(value.status === 'clarification' ? '' : value.text);
      if (value.status === 'clarification') setClarificationOf(value.id);
      else setClarificationOf(undefined);
    } else if (value.status === 'clarification') {
      setClarificationOf(value.id);
      setInstructionText(current => current === value.text ? '' : current);
    } else {
      setClarificationOf(undefined);
    }
    if (updateUrl) setParams(current => { current.set('instruction', value.id); return current; }, { replace: true });
    if (value.status === 'searching' && value.runId) void loadInstructionRun(value.runId, value.id);
    return value;
  }, [loadInstructionRun, setParams]);

  const postInstruction = useCallback(async (request: { id: string; text: string; clarificationOf?: string }) => {
    setInstructionBusy(true);
    setInstructionError('');
    setCanRetryNetwork(false);
    retryRequestRef.current = request;
    navigationRef.current = { instructionId: request.id, runId: null };
    setRun(null); setSelectedKey('');
    if (user?.id) localStorage.setItem(instructionStorageKey(user.id), JSON.stringify(request));
    setParams(current => { current.set('instruction', request.id); current.delete('run'); return current; });
    try {
      const response = await apiClient.post('/api/v1/site-finder/instructions', request);
      const value = response.data.data as SiteInstructionView;
      if (!isInstruction(value)) throw new Error('The instruction response was not valid.');
      if (navigationRef.current.instructionId !== request.id) return value;
      retryRequestRef.current = null;
      setInstruction(value);
      setInstructionHistory(old => [value, ...old.filter(item => item.id !== value.id)].slice(0, 10));
      setInstructionText(value.status === 'clarification' ? '' : value.text);
      setClarificationOf(value.status === 'clarification' ? value.id : undefined);
      setInstructionError('');
      setPollFailures(0);
      setPollingPaused(false);
      if (value.status === 'searching' && value.runId) void loadInstructionRun(value.runId, value.id);
      if (value.status === 'error') setInstructionError(value.message || 'This instruction could not be processed. Review it and explicitly retry as a new request.');
      return value;
    } catch (error) {
      if (navigationRef.current.instructionId !== request.id) return null;
      const status = (error as { response?: { status?: number } })?.response?.status;
      setInstructionError(actionableError(error, 'Could not submit the instruction. Your request is retained and can be retried.'));
      const safelyRetryable = status === undefined || status === 401 || status === 429 || status === 503 || (status !== undefined && status >= 500);
      setCanRetryNetwork(safelyRetryable);
      if (!safelyRetryable) retryRequestRef.current = null;
      return null;
    } finally {
      if (navigationRef.current.instructionId === request.id) setInstructionBusy(false);
    }
  }, [loadInstructionRun, setParams, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (historyLoadedForRef.current !== user.id) {
      historyLoadedForRef.current = user.id;
      apiClient.get('/api/v1/site-finder/instructions').then(response => {
        const values = response.data.data;
        if (Array.isArray(values)) setInstructionHistory(values.filter(isInstruction).slice(0, 10));
      }).catch(() => { /* History is optional; instruction recovery remains available by URL/local storage. */ });
      apiClient.get('/api/v1/site-finder/runs').then(response => setHistory(response.data.data as SiteRun[])).catch(() => setHistory([]));
    }
    const instructionId = params.get('instruction');
    const runId = params.get('run');
    const recoveryKey = `${user.id}:${instructionId ?? ''}:${runId ?? ''}`;
    if (recoveryKeyRef.current === recoveryKey) return;
    recoveryKeyRef.current = recoveryKey;
    if (instructionId && retryRequestRef.current?.id === instructionId) return;
    if (instructionId) {
      let savedRequest: { id: string; text: string; clarificationOf?: string } | null = null;
      try {
        const saved = JSON.parse(localStorage.getItem(instructionStorageKey(user.id)) || 'null');
        if (saved?.id === instructionId && typeof saved.text === 'string') {
          savedRequest = saved;
          setInstructionText(saved.text);
        }
      } catch { /* A malformed local draft is not a server request. */ }
      void loadInstruction(instructionId).catch(error => {
        if (navigationRef.current.instructionId !== instructionId) return;
        if (savedRequest) { retryRequestRef.current = savedRequest; setCanRetryNetwork(true); }
        setInstructionError(actionableError(error, 'Could not restore this instruction. Its saved text remains available for a new request.'));
      });
    } else if (!runId) {
      const saved = localStorage.getItem(instructionStorageKey(user.id));
      if (saved) {
        try {
          const pending = JSON.parse(saved) as { id?: string; text?: string; clarificationOf?: string };
          if (pending.id && pending.text) {
            const request = { id: pending.id, text: pending.text, ...(pending.clarificationOf ? { clarificationOf: pending.clarificationOf } : {}) };
            retryRequestRef.current = request;
            navigationRef.current = { instructionId: pending.id, runId: null };
            setParams(current => { current.set('instruction', pending.id!); return current; }, { replace: true });
            setInstructionText(pending.text);
            void loadInstruction(pending.id).catch(error => {
              if (navigationRef.current.instructionId !== pending.id) return;
              setInstructionText(pending.text || '');
              retryRequestRef.current = request;
              setCanRetryNetwork(true);
              setInstructionError(actionableError(error, 'Could not restore the saved instruction. Retry the same ID to safely recover the request.'));
            });
          }
        } catch { localStorage.removeItem(instructionStorageKey(user.id)); }
      }
    }
    if (runId) void loadRun(runId);
  }, [loadInstruction, loadRun, params, setParams, user?.id]);

  useEffect(() => {
    if (!instruction || !['queued', 'understanding'].includes(instruction.status) || pollingPaused) return;
    instructionPollRef.current = window.setTimeout(() => {
      void loadInstruction(instruction.id, false, true).catch(error => {
        if (navigationRef.current.instructionId !== instruction.id) return;
        const next = pollFailures + 1;
        setPollFailures(next);
        if (next >= 5) setPollingPaused(true);
        setInstructionError(actionableError(error, 'Connection interrupted while checking progress. Existing results are preserved; resume checks to try again.'));
      });
    }, 1800);
    return () => { if (instructionPollRef.current) window.clearTimeout(instructionPollRef.current); };
  }, [instruction, loadInstruction, pollingPaused, pollFailures]);

  useEffect(() => {
    if (!run || !['queued', 'running'].includes(run.status) || runPollingPaused) return;
    runPollRef.current = window.setTimeout(() => {
      void loadRun(run.id).then(ok => {
        if (ok) setRunPollFailures(0);
        else {
          const next = runPollFailures + 1;
          setRunPollFailures(next);
          if (next >= 5) setRunPollingPaused(true);
        }
      });
    }, 1800);
    return () => { if (runPollRef.current) window.clearTimeout(runPollRef.current); };
  }, [run, loadRun, runPollingPaused, runPollFailures]);

  const submitInstruction = () => {
    const text = instructionText.trim();
    if (!text || text.length > 1000) return;
    setSelectedKey('');
    void postInstruction({ id: crypto.randomUUID(), text, ...(clarificationOf ? { clarificationOf } : {}) });
  };
  const retrySameInstruction = () => {
    if (retryRequestRef.current) void postInstruction(retryRequestRef.current);
  };
  const retryInstructionAsNew = () => {
    const text = instructionText.trim() || instruction?.text || '';
    if (!text) return;
    setInstructionText(text);
    const parent = instruction?.clarificationOf ?? clarificationOf;
    void postInstruction({ id: crypto.randomUUID(), text, ...(parent ? { clarificationOf: parent } : {}) });
  };
  const restoreInstruction = (id: string) => {
    setInstructionError('');
    navigationRef.current = { instructionId: id, runId: null };
    setRun(null); setInstruction(null); setSelectedKey('');
    setParams(current => { current.set('instruction', id); current.delete('run'); return current; });
    void loadInstruction(id).catch(error => setInstructionError(actionableError(error, 'Could not restore this instruction.')));
  };
  const resumePolling = () => {
    setPollFailures(0);
    setPollingPaused(false);
    setRunPollFailures(0);
    setRunPollingPaused(false);
    setInstructionError('');
    if (!run && instruction?.status === 'searching' && instruction.runId) void loadInstructionRun(instruction.runId, instruction.id);
  };
  const selectRun = (id: string) => {
    navigationRef.current = { instructionId: null, runId: id };
    setInstruction(null); setClarificationOf(undefined); setInstructionBusy(false);
    setInstructionError(''); setCanRetryNetwork(false); retryRequestRef.current = null;
    setRun(null); setSelectedKey(''); setRunPollingPaused(false); setRunPollFailures(0);
    setParams(current => { current.delete('instruction'); current.set('run', id); return current; });
    void loadRun(id);
  };
  const newScreen = () => {
    navigationRef.current = { instructionId: null, runId: null };
    if (user?.id) localStorage.removeItem(instructionStorageKey(user.id));
    setInstruction(null); setInstructionText(''); setClarificationOf(undefined); setInstructionBusy(false);
    setInstructionError(''); setCanRetryNetwork(false); retryRequestRef.current = null;
    setRun(null); setSelectedKey(''); setPageError(''); activeRunRef.current = '';
    setParams(current => { current.delete('instruction'); current.delete('run'); return current; });
  };
  const retryRun = async () => {
    if (!run) return;
    setRunBusy(true); setPageError('');
    const sourceRunId = run.id;
    try {
      const retryId = runRetryIdRef.current?.runId === run.id ? runRetryIdRef.current.id : crypto.randomUUID();
      runRetryIdRef.current = { runId: run.id, id: retryId };
      const response = await apiClient.post(`/api/v1/site-finder/runs/${encodeURIComponent(run.id)}/retry`, { id: retryId });
      const created = response.data.data as SiteRun;
      runRetryIdRef.current = null;
      if (navigationRef.current.runId !== sourceRunId) return;
      selectRun(created.id);
      setHistory(old => [created, ...old.filter(item => item.id !== created.id)].slice(0, 10));
    } catch (error) { setPageError(errorMessage(error, 'Retry could not be started.')); }
    finally { setRunBusy(false); }
  };
  const requestReview = async (parcel: SiteParcel) => {
    if (!run) return;
    setSelectedKey(parcel.key); setReviewBusy(true);
    try {
      const response = await apiClient.post(`/api/v1/site-finder/runs/${encodeURIComponent(run.id)}/parcels/${encodeURIComponent(parcel.key)}/review`);
      const review = response.data.data as SiteReview;
      setRun(current => current ? { ...current, results: current.results.map(item => item.key === parcel.key ? { ...item, review } : item) } : current);
      await loadRun(run.id);
    } catch (error) { setPageError(errorMessage(error, 'Parcel review could not be refreshed.')); }
    finally { setReviewBusy(false); }
  };

  const selected = run?.results.find(parcel => parcel.key === selectedKey);
  const parcelStatus = (parcel: SiteParcel) => parcel.review.status;
  const shown = useMemo(() => {
    if (!run) return [];
    const filtered = run.results.filter(parcel => {
      const status = parcelStatus(parcel);
      if (tab === 'qualified' && !['by-right', 'conditional'].includes(status)) return false;
      if (tab === 'leads' && status !== 'unverified') return false;
      if (tab === 'prohibited' && status !== 'prohibited') return false;
      if (tab === 'not-requested' && status !== 'not-requested') return false;
      const needle = filterText.trim().toLowerCase();
      return !needle || [parcel.address, parcel.parcelId, parcel.county, parcel.jurisdiction, parcel.district, parcel.currentPropertyType].some(value => value?.toLowerCase().includes(needle));
    });
    return filtered.sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''));
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [run, tab, filterText, sortKey, sortDirection]);
  const pageSize = 12;
  const visible = shown.slice(page * pageSize, (page + 1) * pageSize);
  const qualifiedCount = run?.results.filter(parcel => ['by-right', 'conditional'].includes(parcelStatus(parcel))).length ?? 0;
  const unverifiedCount = run?.results.filter(parcel => parcelStatus(parcel) === 'unverified').length ?? 0;
  const notRequestedCount = run?.results.filter(parcel => parcelStatus(parcel) === 'not-requested').length ?? 0;
  const prohibitedCount = run?.results.filter(parcel => parcelStatus(parcel) === 'prohibited').length ?? 0;

  const toggleSort = (key: SortKey) => { if (sortKey === key) setSortDirection(value => value === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDirection(key === 'acres' ? 'desc' : 'asc'); } setPage(0); };
  const themeStyle = {
    '--sf-bg': dark ? '#0A0E17' : '#F0F4F8', '--sf-panel': dark ? '#0F1319' : '#FFFFFF',
    '--sf-panel2': dark ? '#131821' : '#F8FAFC', '--sf-header': dark ? '#1A1F2E' : '#E8ECF1',
    '--sf-input': dark ? '#0D1117' : '#F1F5F9', '--sf-text': dark ? '#E8ECF1' : '#1E293B',
    '--sf-secondary': dark ? '#A0ABBE' : '#475569', '--sf-muted': dark ? '#6B7A8D' : '#64748B',
    '--sf-border': dark ? '#1E2538' : '#CBD5E1', '--sf-border2': dark ? '#2A3348' : '#CBD5E1',
  } as React.CSSProperties;

  return <main className={`sf-root ${dark ? 'sf-dark' : 'sf-light'}`} style={themeStyle}>
    <style>{`
      .sf-root{min-height:100dvh;background:var(--sf-bg);color:var(--sf-text);font-family:'IBM Plex Sans',sans-serif;padding:22px clamp(14px,2.2vw,34px) 48px;box-sizing:border-box}
      .sf-root *{box-sizing:border-box}.sf-root button,.sf-root input,.sf-root select,.sf-root textarea{font:inherit}
      .sf-open-review{display:block;border:0;background:none;color:#00BCD4;padding:5px 0 0;font:8px 'JetBrains Mono',monospace}.sf-loading{display:flex;align-items:center;gap:6px;padding:12px;color:var(--sf-muted);font:9px 'JetBrains Mono',monospace}.sf-loading span{height:5px;width:5px;background:#00BCD4;animation:sf-pulse 1s ease-in-out infinite alternate}.sf-loading span:nth-child(2){animation-delay:.2s}.sf-loading span:nth-child(3){animation-delay:.4s}.sf-empty-note{display:inline-block;margin-top:8px;padding:5px 8px;border:1px solid var(--sf-border);color:var(--sf-muted);font:8px 'JetBrains Mono',monospace;letter-spacing:.7px}
      @keyframes sf-pulse{to{opacity:.25;transform:translateY(-2px)}}
      .sf-root button{cursor:pointer}.sf-root button:disabled{cursor:not-allowed;opacity:.55}
      .sf-root a{color:#00BCD4;text-decoration:none}.sf-root a:hover{text-decoration:underline}
      .sf-mono,.sf-eyebrow,.sf-panel-index,.sf-status,.sf-section-label,.sf-check-date{font-family:'JetBrains Mono','SFMono-Regular',monospace}
      .sf-topline{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--sf-border2);padding:0 0 12px;margin-bottom:22px;gap:12px}
      .sf-brand{display:flex;gap:9px;align-items:center;color:var(--sf-muted);font:600 10px 'JetBrains Mono',monospace;letter-spacing:1.2px}.sf-brand-mark{width:24px;height:24px;border:1px solid #00BCD455;color:#00BCD4;display:grid;place-items:center;font-weight:800}
      .sf-status{color:var(--sf-muted);font-size:9px;letter-spacing:.7px}.sf-status i{display:inline-block;width:6px;height:6px;border-radius:50%;background:#00D26A;margin-right:7px}
      .sf-hero{display:grid;grid-template-columns:1fr auto;align-items:end;gap:24px;margin-bottom:20px}.sf-kicker{font:700 9px 'JetBrains Mono',monospace;color:#00BCD4;letter-spacing:1.5px}.sf-hero h1{margin:7px 0 5px;font:600 clamp(24px,3vw,38px) 'IBM Plex Mono',monospace;letter-spacing:-1.6px}.sf-hero p{margin:0;color:var(--sf-secondary);font-size:12px;max-width:680px;line-height:1.6}.sf-hero-stamp{border-left:1px solid var(--sf-border2);padding:4px 0 4px 18px;color:var(--sf-muted);font:10px/1.8 'JetBrains Mono',monospace;text-align:right}
      .sf-workspace{display:grid;grid-template-columns:minmax(285px,350px) minmax(0,1fr);gap:14px;align-items:start}.sf-left-column{display:flex;flex-direction:column;gap:12px;min-width:0}.sf-panel{background:var(--sf-panel);border:1px solid var(--sf-border);min-width:0}.sf-panel-head{padding:12px 14px;background:var(--sf-header);border-bottom:1px solid var(--sf-border);display:flex;justify-content:space-between;align-items:center}.sf-panel-head h2{font:600 12px 'JetBrains Mono',monospace;margin:4px 0 0}.sf-eyebrow{font-size:8px;font-weight:700;letter-spacing:1px;color:var(--sf-muted)}.sf-panel-index{font-size:9px;color:var(--sf-muted)}
      .sf-search-form{padding:13px;display:flex;flex-direction:column;gap:12px}.sf-grid{display:grid;gap:10px}.sf-grid-two{grid-template-columns:1fr 1fr}.sf-area-row{margin-top:1px}.sf-hint{color:var(--sf-muted);font:9px/1.55 'IBM Plex Sans',sans-serif;margin:-7px 0 0}.sf-segment{display:flex;border:1px solid var(--sf-border);height:34px}.sf-segment button{flex:1;border:0;background:transparent;color:var(--sf-muted);font:9px 'JetBrains Mono',monospace}.sf-segment button.selected{background:#00BCD41B;color:#00BCD4;box-shadow:inset 0 -2px #00BCD4}.sf-inline-field{display:flex;gap:4px}.sf-inline-field select{width:52px;flex:none}.sf-unit{max-width:180px}.sf-field{min-width:0}.sf-county-list{display:grid;grid-template-columns:1fr;gap:2px}.sf-county{display:flex;align-items:center;gap:8px;background:transparent;border:1px solid transparent;color:var(--sf-secondary);text-align:left;padding:5px;font-size:10px}.sf-county:hover,.sf-county.active{border-color:var(--sf-border);background:var(--sf-panel2);color:var(--sf-text)}.sf-checkbox{height:13px;width:13px;border:1px solid var(--sf-border2);display:grid;place-items:center;color:#00BCD4;font-size:10px}.sf-county.active .sf-checkbox{border-color:#00BCD4}.sf-municipality{margin-top:9px}.sf-run-button{width:100%;display:flex;justify-content:space-between;align-items:center;border:1px solid #00BCD4;background:#00BCD4;color:#08121A;padding:11px 12px;font:700 10px 'JetBrains Mono',monospace;letter-spacing:.7px}.sf-run-button:hover:not(:disabled){background:#23c9dc}.sf-disclaimer{font-size:9px;line-height:1.5;color:var(--sf-muted);border-top:1px solid var(--sf-border);padding-top:9px}
       .sf-interpret{padding:13px}.sf-interpret textarea{width:100%;min-height:108px;background:var(--sf-input);border:1px solid var(--sf-border);color:var(--sf-text);padding:10px;resize:vertical;font:10px/1.6 'JetBrains Mono',monospace}.sf-interpret form>button,.sf-interpret button,.sf-secondary-button{background:transparent;border:1px solid var(--sf-border2);color:#00BCD4;padding:8px 10px;font:700 9px 'JetBrains Mono',monospace;margin-top:8px}.sf-interpret button:hover,.sf-secondary-button:hover{border-color:#00BCD4}.sf-interpret-summary{margin-top:11px;border-left:2px solid #00BCD4;padding:8px 10px;background:var(--sf-panel2);font-size:10px;line-height:1.6}.sf-interpret-summary ul{padding-left:15px;margin:7px 0}.sf-issue{color:#FF8C42}.sf-notice{border:1px solid #F5A62355;color:var(--sf-secondary);background:#F5A6230A;padding:9px 11px;font-size:10px;line-height:1.5;margin-bottom:12px}.sf-error{border-left:3px solid #FF4757;background:#FF47570D;color:var(--sf-text);padding:10px 12px;margin-bottom:12px}
       .sf-instruction-meta{display:flex;justify-content:space-between;gap:8px;color:var(--sf-muted);font:8px/1.5 'JetBrains Mono',monospace;margin-top:5px}.sf-instruction-status{display:flex;justify-content:space-between;gap:8px;color:#00BCD4;font:9px 'JetBrains Mono',monospace}.sf-instruction-status span{color:var(--sf-muted)}.sf-validated-criteria{border-top:1px solid var(--sf-border);margin-top:9px;padding-top:9px}.sf-validated-criteria>strong{color:var(--sf-muted);font:700 8px 'JetBrains Mono',monospace;letter-spacing:.6px}.sf-validated-criteria ul{margin:6px 0 0}.sf-clarification-hint{color:#F5A623}.sf-instruction-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid var(--sf-border);padding-top:8px;margin-top:8px;color:var(--sf-muted);font-size:9px}.sf-instruction-actions button{flex:none}.sf-instruction-history{margin-top:14px}.sf-instruction-history .sf-history-item{align-items:flex-start}.sf-instruction-history .sf-history-item span:first-child{max-width:68%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .sf-results{min-width:0;background:var(--sf-panel);border:1px solid var(--sf-border)}.sf-results-header{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 14px;background:var(--sf-header);border-bottom:1px solid var(--sf-border)}.sf-results-header h2{margin:4px 0 0;font:600 12px 'JetBrains Mono',monospace}.sf-run-id{color:var(--sf-muted);font:9px 'JetBrains Mono',monospace;margin-top:5px}.sf-run-actions{display:flex;gap:8px;align-items:center}.sf-run-actions button{background:transparent;border:1px solid var(--sf-border2);color:var(--sf-secondary);padding:6px 9px;font:9px 'JetBrains Mono',monospace}.sf-run-actions button:hover{border-color:#00BCD4;color:#00BCD4}
      .sf-progress{border-bottom:1px solid var(--sf-border);padding:9px 14px;background:var(--sf-panel2)}.sf-progress-title{display:flex;justify-content:space-between;color:var(--sf-secondary);font:9px 'JetBrains Mono',monospace;margin-bottom:7px}.sf-source-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.sf-source{border:1px solid var(--sf-border);padding:7px 8px;min-width:0}.sf-source-top{display:flex;justify-content:space-between;gap:5px;font:8px 'JetBrains Mono',monospace}.sf-source-count{margin-top:4px;color:var(--sf-muted);font:8px 'JetBrains Mono',monospace}.sf-source-msg{font:8px/1.4 'IBM Plex Sans',sans-serif;color:#FF8C42;margin-top:4px}
      .sf-run-warnings{padding:8px 14px;border-bottom:1px solid var(--sf-border);color:#F5A623;font-size:9px;line-height:1.6}.sf-result-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-bottom:1px solid var(--sf-border)}.sf-tabs{display:flex;gap:2px;overflow:auto}.sf-tabs button{white-space:nowrap;border:0;border-bottom:2px solid transparent;background:none;padding:8px 9px;color:var(--sf-muted);font:9px 'JetBrains Mono',monospace}.sf-tabs button.active{color:#00BCD4;border-color:#00BCD4}.sf-tabs em{font-style:normal;color:var(--sf-secondary);margin-left:4px}.sf-filter{width:200px;max-width:40%;padding:7px 8px;background:var(--sf-input);border:1px solid var(--sf-border);color:var(--sf-text);font:9px 'JetBrains Mono',monospace}
      .sf-table-wrap{overflow:auto}.sf-table{width:100%;border-collapse:collapse;min-width:720px;font:9px 'JetBrains Mono',monospace}.sf-table th{text-align:left;background:var(--sf-panel2);color:var(--sf-muted);font-weight:600;letter-spacing:.5px;padding:9px 10px;border-bottom:1px solid var(--sf-border);white-space:nowrap}.sf-table th button{border:0;background:none;padding:0;color:inherit;font:inherit;cursor:pointer}.sf-table td{padding:10px;border-bottom:1px solid var(--sf-border);color:var(--sf-secondary);vertical-align:middle}.sf-table tr.parcel-row{cursor:pointer}.sf-table tr.parcel-row:hover,.sf-table tr.parcel-row.is-selected{background:#00BCD40A}.sf-table .parcel-address{color:var(--sf-text);font-weight:600}.sf-table .subcell{display:block;color:var(--sf-muted);font-size:8px;margin-top:3px}.sf-badge{display:inline-block;padding:3px 5px;border:1px solid currentColor;font-size:8px;letter-spacing:.35px;white-space:nowrap}.sf-table-footer{display:flex;justify-content:space-between;align-items:center;padding:9px 12px;color:var(--sf-muted);font:9px 'JetBrains Mono',monospace}.sf-pager{display:flex;gap:5px}.sf-pager button{background:transparent;border:1px solid var(--sf-border);color:var(--sf-secondary);padding:4px 8px}.sf-empty{padding:55px 20px;text-align:center}.sf-empty-mark{font:500 26px 'IBM Plex Mono',monospace;color:#00BCD4;margin-bottom:9px}.sf-empty strong{font:600 12px 'JetBrains Mono',monospace}.sf-empty p{max-width:390px;margin:8px auto;color:var(--sf-muted);font-size:10px;line-height:1.6}
      .sf-history{padding:12px 13px}.sf-history-title{font:700 9px 'JetBrains Mono',monospace;color:var(--sf-muted);letter-spacing:1px;margin-bottom:8px}.sf-history-item{display:flex;width:100%;justify-content:space-between;gap:8px;text-align:left;color:var(--sf-secondary);background:transparent;border:0;border-top:1px solid var(--sf-border);padding:8px 2px;font:9px 'JetBrains Mono',monospace}.sf-history-item:hover{color:#00BCD4}.sf-review{position:fixed;right:14px;top:14px;bottom:14px;width:min(470px,calc(100vw - 28px));z-index:1000;background:var(--sf-panel);border:1px solid var(--sf-border2);box-shadow:0 18px 55px #0008;display:flex;flex-direction:column;animation:sf-in .18s ease-out}.sf-review-head{display:flex;justify-content:space-between;gap:12px;padding:15px;background:var(--sf-header);border-bottom:1px solid var(--sf-border)}.sf-review-head h2{font:600 13px 'JetBrains Mono',monospace;margin:7px 0 5px}.sf-parcel-ref{font:9px 'JetBrains Mono',monospace;color:var(--sf-muted)}.sf-icon-button{border:0;background:none;color:var(--sf-muted);font:22px 'IBM Plex Sans',sans-serif;align-self:flex-start}.sf-review-body{overflow:auto;padding:14px;flex:1}.sf-permission{display:flex;flex-direction:column;gap:6px;padding:11px;border:1px solid;margin-bottom:12px}.sf-permission strong{font:700 14px 'JetBrains Mono',monospace}.sf-permission>span:not(.sf-eyebrow){font-size:10px;color:var(--sf-secondary)}.sf-facts{display:grid;grid-template-columns:1fr 1fr;gap:6px}.sf-facts>div{padding:9px;background:var(--sf-panel2);border:1px solid var(--sf-border);display:flex;flex-direction:column;gap:4px}.sf-facts span,.sf-facts small{color:var(--sf-muted);font-size:8px}.sf-facts b{font:600 10px 'JetBrains Mono',monospace;color:var(--sf-text)}.sf-geometry{margin:13px 0;border:1px solid var(--sf-border);padding:9px}.sf-geometry svg{display:block;width:100%;height:100px;margin:4px 0}.sf-geometry polygon{fill:#00BCD41B;stroke:#00BCD4;stroke-width:2;vector-effect:non-scaling-stroke}.sf-geometry span,.sf-no-geometry{font-size:8px;color:var(--sf-muted)}.sf-no-geometry{padding:12px;border:1px dashed var(--sf-border);margin-top:10px;line-height:1.5}.sf-section-label{font-size:8px;letter-spacing:1px;font-weight:700;color:var(--sf-muted);margin-bottom:8px}.sf-evidence-section{margin:15px 0}.sf-evidence-section ul,.sf-caution ul{margin:0;padding-left:16px;color:var(--sf-secondary);font-size:10px;line-height:1.65}.sf-standard{border-top:1px solid var(--sf-border);padding:8px 0}.sf-standard>div:first-child{display:flex;justify-content:space-between;gap:10px;color:var(--sf-secondary);font-size:10px;margin-bottom:5px}.sf-standard strong{color:#F5A623}.sf-citation{padding:8px 0;border-top:1px solid var(--sf-border)}.sf-citation-title{display:flex;justify-content:space-between;gap:8px;color:var(--sf-text);font:600 9px 'JetBrains Mono',monospace}.sf-citation-title span{color:var(--sf-muted);font-weight:400;font-size:8px}.sf-citation blockquote{margin:7px 0;color:var(--sf-secondary);font-size:10px;line-height:1.6}.sf-citation a{font:9px 'JetBrains Mono',monospace}.sf-caution{padding:10px;border:1px solid #F5A62344;background:#F5A6230A;margin:12px 0}.sf-check-date{border-top:1px solid var(--sf-border);padding:10px 0;color:var(--sf-muted);font-size:8px}.sf-review-actions{display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--sf-border);padding:10px 14px}.sf-review-actions .sf-secondary-button{margin:0}.sf-review-actions a{font:9px 'JetBrains Mono',monospace}
      @keyframes sf-in{from{opacity:0;transform:translateX(8px)}to{opacity:1;transform:translateX(0)}}
      @media(max-width:900px){.sf-workspace{grid-template-columns:1fr}.sf-left-column{display:grid;grid-template-columns:1fr 1fr}.sf-search-form{gap:11px}}
      @media(max-width:620px){.sf-root{padding:14px 10px 30px}.sf-topline{margin-bottom:15px}.sf-status{font-size:8px}.sf-hero{grid-template-columns:1fr;gap:10px}.sf-hero-stamp{display:none}.sf-left-column{display:flex}.sf-grid-two{grid-template-columns:1fr 1fr}.sf-results-header{align-items:flex-start;flex-direction:column}.sf-run-actions{width:100%;justify-content:space-between}.sf-source-grid{grid-template-columns:1fr}.sf-result-toolbar{align-items:flex-start;flex-direction:column}.sf-filter{max-width:100%;width:100%}.sf-tabs{width:100%}.sf-review{right:5px;top:5px;bottom:5px;width:calc(100vw - 10px)}}
    `}</style>
    <div className="sf-topline"><div className="sf-brand"><span className="sf-brand-mark">J</span> JEDIRE / RESEARCH TERMINAL <span style={{ color: 'var(--sf-border2)' }}>/</span> SITE FINDER</div><div className="sf-status"><i /> PARCEL SCREENING · SOUTH FLORIDA</div></div>
    <header className="sf-hero"><div><div className="sf-kicker">LAND INTELLIGENCE / FIELD NOTE 01</div><h1>Site Finder</h1><p>Screen public parcel records across Miami-Dade, Broward, and Palm Beach. Every match carries source coverage, jurisdiction signals, and an explicit evidence status.</p></div><div className="sf-hero-stamp">FLORIDA · 3 COUNTIES<br/>EVIDENCE-LED · PRELIMINARY</div></header>
    {pageError && <div className="sf-error" role="alert">{pageError}</div>}
    {instructionError && <div className="sf-error" role="alert">{instructionError}</div>}
    <div className="sf-workspace">
      <div className="sf-left-column">
        <SiteFinderWidget
          text={instructionText}
          onTextChange={setInstructionText}
          onSubmit={submitInstruction}
          busy={instructionBusy}
          instruction={instruction}
          clarification={instruction?.status === 'clarification' || Boolean(clarificationOf)}
          canRetryNetwork={canRetryNetwork}
          onRetryNetwork={retrySameInstruction}
          onRetryNew={retryInstructionAsNew}
          onResume={resumePolling}
          pollingPaused={pollingPaused || runPollingPaused}
          history={instructionHistory}
          onRestore={restoreInstruction}
        />
        <section className="sf-panel sf-history"><div className="sf-history-title">RECENT SERVER RUNS · LAST 10</div>{history.length ? history.slice(0, 10).map(item => <button className="sf-history-item" key={item.id} onClick={() => selectRun(item.id)}><span>{new Date(item.createdAt).toLocaleDateString()} · {item.criteria.counties.join(', ')}</span><span>{item.status.toUpperCase()} ↗</span></button>) : <div style={{ color: 'var(--sf-muted)', fontSize: 9 }}>No recent runs returned.</div>}</section>
      </div>
      <section className="sf-results">
        <div className="sf-results-header"><div><div className="sf-eyebrow">02 / PUBLIC PARCEL EVIDENCE</div><h2>{run ? `Screen ${run.status.toUpperCase()}` : 'Awaiting a parcel screen'}</h2>{run && <div className="sf-run-id">RUN {run.id} · STARTED {formatDate(run.createdAt)}</div>}</div><div className="sf-run-actions">{run && ['error', 'partial'].includes(run.status) && <button onClick={retryRun} disabled={runBusy}>RETRY SOURCES</button>}{run && <button onClick={newScreen}>NEW SCREEN</button>}</div></div>
        {run && <>
          <div className="sf-progress"><div className="sf-progress-title"><span>COUNTY SOURCE COVERAGE</span><span>{run.results.length} returned · cap {run.criteria.limit}</span></div><div className="sf-source-grid">{run.sources.map(source => {
            const color = source.status === 'error' ? '#FF4757' : source.status === 'partial' ? '#F5A623' : source.status === 'working' ? '#00BCD4' : source.status === 'pending' ? '#6B7A8D' : '#00D26A';
            return <div className="sf-source" key={source.county}><div className="sf-source-top"><span>{source.county.toUpperCase()}</span><span style={{ color }}>{source.status.toUpperCase()}</span></div><div className="sf-source-count">{source.scanned.toLocaleString()} scanned · {source.matched.toLocaleString()} matched{source.limited ? ' · LIMIT REACHED' : ''}</div>{source.checkedAt && <div className="sf-source-count">Checked {formatDate(source.checkedAt)}</div>}{source.messages.map((message, i) => <div className="sf-source-msg" key={i}>{message}</div>)}{source.sourceUrl && <a className="sf-source-count" href={source.sourceUrl} target="_blank" rel="noreferrer">Source ↗</a>}</div>;
          })}</div></div>
          {run.warnings.length > 0 && <div className="sf-run-warnings">{run.warnings.map((warning, i) => <div key={i}>! {warning}</div>)}</div>}
          <div className="sf-result-toolbar"><div className="sf-tabs"><button className={tab === 'qualified' ? 'active' : ''} onClick={() => { setTab('qualified'); setPage(0); }}>BY-RIGHT / CONDITIONAL <em>{qualifiedCount}</em></button><button className={tab === 'leads' ? 'active' : ''} onClick={() => { setTab('leads'); setPage(0); }}>UNVERIFIED LEADS <em>{unverifiedCount}</em></button><button className={tab === 'prohibited' ? 'active' : ''} onClick={() => { setTab('prohibited'); setPage(0); }}>PROHIBITED <em>{prohibitedCount}</em></button><button className={tab === 'not-requested' ? 'active' : ''} onClick={() => { setTab('not-requested'); setPage(0); }}>USE NOT REQUESTED <em>{notRequestedCount}</em></button></div><input className="sf-filter" value={filterText} onChange={e => { setFilterText(e.target.value); setPage(0); }} placeholder="Filter shown parcels…" /></div>
          {visible.length ? <><div className="sf-table-wrap"><table className="sf-table"><thead><tr><th><button onClick={() => toggleSort('county')}>COUNTY {sortKey === 'county' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</button></th><th><button onClick={() => toggleSort('address')}>PARCEL / ADDRESS {sortKey === 'address' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</button></th><th><button onClick={() => toggleSort('acres')}>AREA {sortKey === 'acres' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</button></th><th><button onClick={() => toggleSort('currentPropertyType')}>CURRENT TYPE</button></th><th><button onClick={() => toggleSort('district')}>DISTRICT / JURISDICTION</button></th><th>USE SCREEN</th></tr></thead><tbody>{visible.map(parcel => {
            const status = parcelStatus(parcel); const statusColor = statusColors[status] ?? '#6B7A8D';
            return <tr key={parcel.key} className={`parcel-row ${selectedKey === parcel.key ? 'is-selected' : ''}`} onClick={() => { setSelectedKey(parcel.key); }} onDoubleClick={() => void requestReview(parcel)} onKeyDown={event => { if (event.key === 'Enter') setSelectedKey(parcel.key); }} tabIndex={0}>
              <td>{parcel.county}</td><td><span className="parcel-address">{parcel.address || 'Address not reported'}</span><span className="subcell">{parcel.parcelId}</span></td><td>{parcel.acres.toLocaleString(undefined, { maximumFractionDigits: 3 })} ac<span className="subcell">{parcel.areaSqft.toLocaleString()} sqft</span></td><td>{parcel.currentPropertyType || 'Catalog classification unknown'}<span className="subcell">{parcel.currentLandUse || 'Assessor land use not reported'}</span></td><td>{parcel.district || 'Unknown'}<span className="subcell">{parcel.jurisdiction || 'Jurisdiction unverified'}</span></td><td><span className="sf-badge" style={{ color: statusColor }}>{status.replace('-', ' ').toUpperCase()}</span><button className="sf-open-review" onClick={event => { event.stopPropagation(); void requestReview(parcel); }}>REVIEW</button></td>
            </tr>;
          })}</tbody></table></div><div className="sf-table-footer"><span>{shown.length} parcel{shown.length === 1 ? '' : 's'} · preliminary screen, not a legal determination</span><div className="sf-pager"><button disabled={page === 0} onClick={() => setPage(value => Math.max(0, value - 1))}>PREV</button><span>{page + 1} / {Math.max(1, Math.ceil(shown.length / pageSize))}</span><button disabled={(page + 1) * pageSize >= shown.length} onClick={() => setPage(value => value + 1)}>NEXT</button></div></div></> : <div className="sf-empty"><div className="sf-empty-mark">∅</div><strong>{run.results.length ? 'No parcels in this screen' : 'No matched parcels returned'}</strong><p>{run.results.length ? 'Try another evidence tab, clear the local filter, or widen the criteria and run another screen.' : 'Source coverage is shown above. A zero-result screen is not evidence that no parcels exist in the geography.'}</p></div>}
        </>}
         {!run && <div className="sf-empty"><div className="sf-empty-mark">⌖</div><strong>Describe the site. The server resolves the search.</strong><p>Share the geography, intended use, parcel size, or other requirements in one instruction. Validated criteria and evidence appear here as the screen progresses.</p><div className="sf-empty-note">CURRENT PROPERTY CLASSIFICATION ≠ PERMITTED FUTURE USE</div></div>}
        {run && (run.status === 'queued' || run.status === 'running') && <div className="sf-loading"><span /><span /><span /> County assessor sources are working. Results and partial coverage appear as returned.</div>}
      </section>
    </div>
    {selected && <ReviewPane parcel={selected} review={selected.review} busy={reviewBusy} onRefresh={() => void requestReview(selected)} onClose={() => setSelectedKey('')} />}
  </main>;
};

export default SiteFinderPage;