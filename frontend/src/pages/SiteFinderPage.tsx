import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../services/api.client';
import { useTheme } from '../contexts/ThemeContext';
import SiteFinderWidget, { type SiteFinderCatalog } from '../components/site-finder/SiteFinderWidget';
import type { SiteCriteria, SiteInterpretation, SiteParcel, SiteReview, SiteRun } from '../../../shared/site-finder';
import { SITE_COUNTIES } from '../../../shared/site-finder';

const defaults: SiteCriteria = { counties: [...SITE_COUNTIES], limit: 100 };
type SortKey = 'county' | 'address' | 'parcelId' | 'acres' | 'currentPropertyType' | 'district';
const statusColors: Record<string, string> = { 'by-right': '#00D26A', conditional: '#F5A623', prohibited: '#FF4757', unverified: '#A78BFA', 'not-requested': '#6B7A8D' };
const formatDate = (value?: string) => value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Not reported';
const errorMessage = (error: unknown, fallback: string) => {
  const value = error as { response?: { data?: { error?: string } } };
  return value.response?.data?.error || fallback;
};
const normalizeCriteria = (criteria: SiteCriteria): SiteCriteria => {
  const normalized: SiteCriteria = { ...criteria, counties: [...criteria.counties], limit: Math.min(100, criteria.limit) };
  if (criteria.propertyType?.trim()) normalized.propertyType = criteria.propertyType.trim();
  else {
    delete normalized.propertyType;
    delete normalized.typeSemantics;
  }
  if (criteria.intendedUse?.trim()) normalized.intendedUse = criteria.intendedUse.trim();
  else delete normalized.intendedUse;
  if (criteria.addressText?.trim()) normalized.addressText = criteria.addressText.trim();
  else delete normalized.addressText;
  if (criteria.municipality?.trim()) normalized.municipality = criteria.municipality.trim();
  else delete normalized.municipality;
  if (criteria.zoning?.code.trim() && criteria.zoning.jurisdiction.trim()) {
    normalized.zoning = { code: criteria.zoning.code.trim(), jurisdiction: criteria.zoning.jurisdiction.trim() };
  } else delete normalized.zoning;
  if (criteria.area && (criteria.area.min !== undefined || criteria.area.max !== undefined)) {
    normalized.area = { ...criteria.area };
  } else delete normalized.area;
  return normalized;
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
  const [params, setParams] = useSearchParams();
  const [criteria, setCriteria] = useState<SiteCriteria>(defaults);
  const [catalog, setCatalog] = useState<SiteFinderCatalog | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [naturalText, setNaturalText] = useState('');
  const [interpretation, setInterpretation] = useState<SiteInterpretation | null>(null);
  const [interpretationIssues, setInterpretationIssues] = useState<string[]>([]);
  const [interpretBusy, setInterpretBusy] = useState(false);
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
  const pollRef = useRef<number | null>(null);
  const activeRunRef = useRef('');
  const dark = theme !== 'light';

  const loadRun = useCallback(async (id: string, updateUrl = false) => {
    try {
      const response = await apiClient.get(`/api/v1/site-finder/runs/${encodeURIComponent(id)}`);
      const value = response.data.data as SiteRun;
      setRun(value); setPageError('');
      if (activeRunRef.current !== value.id) {
        activeRunRef.current=value.id;
        setCriteria(normalizeCriteria(value.criteria));
        setTab(value.criteria.intendedUse ? 'qualified' : 'not-requested');
        setPage(0);setFilterText('');setSelectedKey('');
      }
      if (updateUrl) setParams({ run: value.id }, { replace: true });
    } catch (error) {
      setPageError(errorMessage(error, 'Could not restore this server-side run. It may have expired or may not be available to this account.'));
      setRun(null);
    }
  }, [setParams]);

  useEffect(() => {
    let alive = true;
    apiClient.get('/api/v1/site-finder/catalog').then(response => {
      if (alive) { setCatalog(response.data.data as SiteFinderCatalog); setCatalogError(''); }
    }).catch(error => { if (alive) setCatalogError(errorMessage(error, 'Catalog unavailable. Search criteria remain editable, but property type choices require the live catalog.')); });
    apiClient.get('/api/v1/site-finder/runs').then(response => { if (alive) setHistory(response.data.data as SiteRun[]); }).catch(() => { if (alive) setHistory([]); });
    const id = params.get('run');
    if (id) void loadRun(id);
    return () => { alive = false; if (pollRef.current) window.clearTimeout(pollRef.current); };
  }, [loadRun, params]);

  useEffect(() => {
    if (!run || !['queued', 'running'].includes(run.status)) return;
    pollRef.current = window.setTimeout(() => { void loadRun(run.id); }, 1800);
    return () => { if (pollRef.current) window.clearTimeout(pollRef.current); };
  }, [run, loadRun]);

  const interpret = async () => {
    if (!naturalText.trim()) return;
    setInterpretBusy(true); setPageError('');
    try {
      const response = await apiClient.post('/api/v1/site-finder/interpret', { text: naturalText.trim(), criteria: normalizeCriteria(criteria) });
      const parsed = response.data.data as SiteInterpretation;
      setInterpretation(parsed);
      setInterpretationIssues(parsed.issues);
    } catch (error) { setPageError(errorMessage(error, 'Unable to interpret this search. Please try again.')); }
    finally { setInterpretBusy(false); }
  };
  const applyInterpretation = () => {
    if (!interpretation) return;
    setCriteria(normalizeCriteria(interpretation.criteria));
    setNaturalText('');
    setInterpretation(null);
  };
  const startRun = async () => {
    if (naturalText.trim()) { setPageError('Interpret and apply the text first so you can inspect the criteria before searching.'); return; }
    if (interpretationIssues.length) { setPageError('Unsupported interpretation issues are still unresolved. Use structured filters only, or interpret a revised request before running.'); return; }
    setRunBusy(true); setPageError(''); setRun(null); setSelectedKey('');
    try {
      const response = await apiClient.post('/api/v1/site-finder/runs', { criteria: normalizeCriteria(criteria) });
      const created = response.data.data as SiteRun;
      setRun(created); setParams({ run: created.id });
      setHistory(old => [created, ...old.filter(item => item.id !== created.id)].slice(0, 10));
    } catch (error) { setPageError(errorMessage(error, 'The parcel screen could not be started.')); }
    finally { setRunBusy(false); }
  };
  const retryRun = async () => {
    if (!run) return;
    setRunBusy(true); setPageError('');
    try {
      const response = await apiClient.post(`/api/v1/site-finder/runs/${encodeURIComponent(run.id)}/retry`);
      const created = response.data.data as SiteRun;
      setRun(created); setParams({ run: created.id });
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
      .sf-interpret{padding:13px}.sf-interpret textarea{width:100%;min-height:78px;background:var(--sf-input);border:1px solid var(--sf-border);color:var(--sf-text);padding:9px;resize:vertical;font:10px/1.6 'JetBrains Mono',monospace}.sf-interpret button,.sf-secondary-button{background:transparent;border:1px solid var(--sf-border2);color:#00BCD4;padding:8px 10px;font:700 9px 'JetBrains Mono',monospace;margin-top:8px}.sf-interpret button:hover,.sf-secondary-button:hover{border-color:#00BCD4}.sf-interpret-summary{margin-top:11px;border-left:2px solid #00BCD4;padding:8px 10px;background:var(--sf-panel2);font-size:10px;line-height:1.6}.sf-interpret-summary ul{padding-left:15px;margin:7px 0}.sf-issue{color:#FF8C42}.sf-notice{border:1px solid #F5A62355;color:var(--sf-secondary);background:#F5A6230A;padding:9px 11px;font-size:10px;line-height:1.5;margin-bottom:12px}.sf-error{border-left:3px solid #FF4757;background:#FF47570D;color:var(--sf-text);padding:10px 12px;margin-bottom:12px;font-size:10px}
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
    {catalogError && <div className="sf-notice">{catalogError}</div>}
    <div className="sf-workspace">
      <div className="sf-left-column">
        <section className="sf-panel">
          <div className="sf-panel-head"><div><span className="sf-eyebrow">01 / START WITH A DESCRIPTION</span><h2>Describe the search</h2></div><span className="sf-panel-index">TEXT FIRST</span></div>
          <div className="sf-interpret"><textarea value={naturalText} onChange={e => setNaturalText(e.target.value)} placeholder={'Find parcels over 3 acres zoned for assisted living in Broward\nFind industrial sites between 5 and 10 acres in Palm Beach County'} aria-label="Describe your parcel search" />
            <button onClick={interpret} disabled={interpretBusy || !naturalText.trim()}>{interpretBusy ? 'INTERPRETING…' : 'INTERPRET REQUEST'}</button>
            {interpretation && <div className="sf-interpret-summary"><strong>Interpretation</strong>{interpretation.interpretation.map((line, i) => <div key={i}>· {line}</div>)}{interpretation.issues.length > 0 && <div className="sf-issue"><strong>Execution blocked · unsupported request terms</strong><ul>{interpretation.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul></div>}<button onClick={applyInterpretation}>APPLY TO STRUCTURED FILTERS · CLEAR TEXT</button></div>}
            {interpretationIssues.length > 0 && !interpretation && <div className="sf-interpret-summary sf-issue"><strong>Run blocked by unresolved interpretation issues</strong><ul>{interpretationIssues.map((issue, i) => <li key={i}>{issue}</li>)}</ul><button onClick={() => { setInterpretationIssues([]); setPageError(''); }}>USE STRUCTURED FILTERS ONLY</button></div>}
          </div>
        </section>
        <SiteFinderWidget criteria={criteria} setCriteria={setCriteria} catalog={catalog} busy={runBusy} onRun={startRun} />
        <section className="sf-panel sf-history"><div className="sf-history-title">RECENT SERVER RUNS · LAST 10</div>{history.length ? history.slice(0, 10).map(item => <button className="sf-history-item" key={item.id} onClick={() => { setParams({ run: item.id }); void loadRun(item.id); }}><span>{new Date(item.createdAt).toLocaleDateString()} · {item.criteria.counties.join(', ')}</span><span>{item.status.toUpperCase()} ↗</span></button>) : <div style={{ color: 'var(--sf-muted)', fontSize: 9 }}>No recent runs returned.</div>}</section>
      </div>
      <section className="sf-results">
        <div className="sf-results-header"><div><div className="sf-eyebrow">02 / PUBLIC PARCEL EVIDENCE</div><h2>{run ? `Screen ${run.status.toUpperCase()}` : 'Awaiting a parcel screen'}</h2>{run && <div className="sf-run-id">RUN {run.id} · STARTED {formatDate(run.createdAt)}</div>}</div><div className="sf-run-actions">{run && ['error', 'partial'].includes(run.status) && <button onClick={retryRun} disabled={runBusy}>RETRY SOURCES</button>}{run && <button onClick={() => { setRun(null); setSelectedKey(''); setParams({}); }}>NEW SCREEN</button>}</div></div>
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
        {!run && <div className="sf-empty"><div className="sf-empty-mark">⌖</div><strong>Start with one signal. Add more only when needed.</strong><p>Property type, zoning code, parcel size, address text, and geography are independent optional filters. Interpret plain language first, inspect its structured reading, then make a server-backed screen.</p><div className="sf-empty-note">CURRENT PROPERTY CLASSIFICATION ≠ PERMITTED FUTURE USE</div></div>}
        {run && (run.status === 'queued' || run.status === 'running') && <div className="sf-loading"><span /><span /><span /> County assessor sources are working. Results and partial coverage appear as returned.</div>}
      </section>
    </div>
    {selected && <ReviewPane parcel={selected} review={selected.review} busy={reviewBusy} onRefresh={() => void requestReview(selected)} onClose={() => setSelectedKey('')} />}
  </main>;
};

export default SiteFinderPage;