import React, { useState, useEffect } from 'react';
import { PlaybookAccuracyDashboard } from '../../components/terminal/tabs/msa/PlaybookAccuracyDashboard';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, AlertTriangle, Clock, RefreshCw, Play, Pause, ChevronDown, ChevronRight, Database, Wifi, WifiOff } from 'lucide-react';

const BG = '#0B0E1A';
const PANEL = '#0F1320';
const PANEL_ALT = '#131929';
const BORDER = '#1E2538';
const CYAN = '#0891B2';
const GREEN = '#10B981';
const AMBER = '#F59E0B';
const RED = '#EF4444';
const MUTED = '#A0ABBE';
const DIM = '#6B7A8D';
const PRIMARY = '#E2E8F0';
const mono: React.CSSProperties = { fontFamily: '"JetBrains Mono", monospace' };

function StatusBadge({ status }: { status: 'LIVE' | 'STAGED' | 'ERROR' | 'PAUSED' }) {
  const map = {
    LIVE: { color: GREEN, bg: `${GREEN}20`, border: `${GREEN}50` },
    STAGED: { color: CYAN, bg: `${CYAN}20`, border: `${CYAN}50` },
    ERROR: { color: RED, bg: `${RED}20`, border: `${RED}50` },
    PAUSED: { color: AMBER, bg: `${AMBER}20`, border: `${AMBER}50` },
  };
  const s = map[status];
  return (
    <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: s.color, backgroundColor: s.bg, border: `1px solid ${s.border}`, borderRadius: 2, padding: '2px 7px', letterSpacing: '0.06em' }}>
      {status}
    </span>
  );
}

function ConnectorCard({ connector, isExpanded, onToggle }: {
  connector: {
    id: string;
    name: string;
    type: string;
    status: 'LIVE' | 'STAGED' | 'ERROR' | 'PAUSED';
    source: string;
    lastPull: string;
    nextPull: string;
    eventsQueued: number;
    eventsFired: number;
    errorRate: string;
    latency: string;
    description: string;
    fields: { label: string; value: string; highlight?: boolean }[];
    log: { time: string; level: 'INFO' | 'WARN' | 'ERROR'; msg: string }[];
  };
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const statusIcon = connector.status === 'LIVE'
    ? <Wifi size={13} color={GREEN} />
    : connector.status === 'ERROR'
    ? <WifiOff size={13} color={RED} />
    : connector.status === 'PAUSED'
    ? <Pause size={13} color={AMBER} />
    : <Clock size={13} color={CYAN} />;

  return (
    <div style={{ border: `1px solid ${connector.status === 'ERROR' ? RED + '60' : BORDER}`, borderRadius: 3, overflow: 'hidden', backgroundColor: PANEL }}>
      <div
        onClick={onToggle}
        style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
      >
        <div style={{ width: 36, height: 36, backgroundColor: `${PANEL_ALT}`, border: `1px solid ${BORDER}`, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {statusIcon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ color: PRIMARY, fontSize: 13, fontWeight: 700 }}>{connector.name}</span>
            <StatusBadge status={connector.status} />
            <span style={{ ...mono, color: DIM, fontSize: 9, backgroundColor: PANEL_ALT, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '1px 5px' }}>{connector.type}</span>
          </div>
          <div style={{ color: DIM, fontSize: 10 }}>{connector.description}</div>
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' as const }}>
            <div style={{ ...mono, color: CYAN, fontSize: 12, fontWeight: 700 }}>{connector.eventsQueued}</div>
            <div style={{ color: DIM, fontSize: 9 }}>queued</div>
          </div>
          <div style={{ textAlign: 'right' as const }}>
            <div style={{ ...mono, color: GREEN, fontSize: 12, fontWeight: 700 }}>{connector.eventsFired}</div>
            <div style={{ color: DIM, fontSize: 9 }}>fired</div>
          </div>
          <div style={{ textAlign: 'right' as const }}>
            <div style={{ ...mono, color: connector.errorRate !== '0%' ? AMBER : GREEN, fontSize: 12, fontWeight: 700 }}>{connector.errorRate}</div>
            <div style={{ color: DIM, fontSize: 9 }}>error rate</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={e => { e.stopPropagation(); }}
              style={{ ...mono, fontSize: 9, padding: '4px 8px', color: CYAN, border: `1px solid ${CYAN}50`, borderRadius: 2, backgroundColor: `${CYAN}10`, cursor: 'pointer' }}
            >
              <RefreshCw size={10} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); }}
              style={{ ...mono, fontSize: 9, padding: '4px 8px', color: connector.status === 'PAUSED' ? GREEN : AMBER, border: `1px solid ${connector.status === 'PAUSED' ? GREEN + '50' : AMBER + '50'}`, borderRadius: 2, backgroundColor: 'transparent', cursor: 'pointer' }}
            >
              {connector.status === 'PAUSED' ? <Play size={10} /> : <Pause size={10} />}
            </button>
          </div>
          {isExpanded ? <ChevronDown size={14} color={DIM} /> : <ChevronRight size={14} color={DIM} />}
        </div>
      </div>

      {isExpanded && (
        <div style={{ borderTop: `1px solid ${BORDER}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
          <div style={{ padding: '14px 16px', borderRight: `1px solid ${BORDER}` }}>
            <div style={{ ...mono, color: DIM, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 10 }}>CONNECTOR DETAILS</div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 1 }}>
              {connector.fields.map((f, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${BORDER}30` }}>
                  <span style={{ color: DIM, fontSize: 10 }}>{f.label}</span>
                  <span style={{ ...mono, color: f.highlight ? CYAN : PRIMARY, fontSize: 10, fontWeight: f.highlight ? 600 : 400 }}>{f.value}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button style={{ flex: 1, ...mono, fontSize: 9, padding: '5px', color: CYAN, border: `1px solid ${CYAN}40`, borderRadius: 2, backgroundColor: `${CYAN}08`, cursor: 'pointer' }}>
                CONFIGURE
              </button>
              <button style={{ flex: 1, ...mono, fontSize: 9, padding: '5px', color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 2, backgroundColor: 'transparent', cursor: 'pointer' }}>
                VIEW HISTORY
              </button>
            </div>
          </div>
          <div style={{ padding: '14px 16px' }}>
            <div style={{ ...mono, color: DIM, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 10 }}>CONNECTOR LOG</div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 3 }}>
              {connector.log.map((entry, i) => {
                const col = entry.level === 'ERROR' ? RED : entry.level === 'WARN' ? AMBER : DIM;
                return (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 10 }}>
                    <span style={{ ...mono, color: DIM, minWidth: 50 }}>{entry.time}</span>
                    <span style={{ ...mono, color: col, minWidth: 35, fontWeight: 700 }}>{entry.level}</span>
                    <span style={{ color: entry.level === 'INFO' ? MUTED : col }}>{entry.msg}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const connectors = [
  {
    id: 'atl-permits',
    name: 'Atlanta Permits Feed',
    type: 'REST POLL',
    status: 'LIVE' as const,
    source: 'Atlanta Building Permits API',
    lastPull: '4 min ago',
    nextPull: 'in 11 min',
    eventsQueued: 3,
    eventsFired: 47,
    errorRate: '0%',
    latency: '1.2s',
    description: 'Monitors Atlanta Fulton/Dekalb permit filings. Auto-classifies SUPPLY events when permit value >$5M.',
    fields: [
      { label: 'Endpoint', value: 'api.atlantaga.gov/permits/v2' },
      { label: 'Auth', value: 'API Key (active)' },
      { label: 'Poll interval', value: '15 min' },
      { label: 'Last response', value: '200 OK · 1.2s' },
      { label: 'Min permit value', value: '$5,000,000', highlight: true },
      { label: 'Scope filter', value: 'Residential + Mixed Use' },
      { label: 'Events this week', value: '12 new' },
      { label: 'Auto-classify', value: 'Confidence >0.72 → FIRE', highlight: true },
    ],
    log: [
      { time: '14:02', level: 'INFO' as const, msg: '3 permits ingested · 1 classified SUPPLY_SHOCK · staged' },
      { time: '13:47', level: 'INFO' as const, msg: 'Pull complete · 0 new permits above threshold' },
      { time: '13:32', level: 'INFO' as const, msg: 'Pull complete · 2 permits staged for review' },
      { time: '12:58', level: 'WARN' as const, msg: 'Rate limit approaching · 85/100 req used' },
      { time: '12:43', level: 'INFO' as const, msg: 'Pull complete · 4 permits → 2 events auto-filed' },
    ],
  },
  {
    id: 'dpcd',
    name: 'Atlanta DPCD Zoning Feed',
    type: 'WEBHOOK',
    status: 'STAGED' as const,
    source: 'City of Atlanta DPCD',
    lastPull: '22 min ago',
    nextPull: 'On push',
    eventsQueued: 7,
    eventsFired: 0,
    errorRate: '0%',
    latency: '—',
    description: 'Ingests rezoning decisions and variance approvals. Staged for manual review before firing REGULATORY events.',
    fields: [
      { label: 'Webhook URL', value: '/api/m35/webhook/dpcd' },
      { label: 'Secret', value: '●●●●●●● (verified)' },
      { label: 'Last push', value: '22 min ago · 3 filings' },
      { label: 'Review mode', value: 'MANUAL (all events)', highlight: true },
      { label: 'Auto-classify', value: 'REGULATORY scope' },
      { label: 'Scope', value: 'ITP + BeltLine corridors' },
      { label: 'Events pending', value: '7 in review queue', highlight: true },
      { label: 'Publish SLA', value: '48h after filing' },
    ],
    log: [
      { time: '13:41', level: 'INFO' as const, msg: 'Received DPCD push · 3 rezoning filings · staged' },
      { time: '11:20', level: 'INFO' as const, msg: 'Received DPCD push · 2 variance decisions · staged' },
      { time: '09:15', level: 'INFO' as const, msg: 'Received DPCD push · 2 BeltLine corridor updates · staged' },
      { time: 'Yest', level: 'WARN' as const, msg: 'Payload schema change detected · mapped OK' },
    ],
  },
  {
    id: 'gdelt',
    name: 'GDELT Backtest Feed',
    type: 'BATCH / S3',
    status: 'PAUSED' as const,
    source: 'GDELT 2.0 BigQuery Export',
    lastPull: '2 days ago',
    nextPull: 'Paused',
    eventsQueued: 0,
    eventsFired: 23,
    errorRate: '4.3%',
    latency: '—',
    description: 'Historical GDELT event extraction for backtest calibration. Paused pending backtest window configuration.',
    fields: [
      { label: 'Source', value: 'GDELT 2.0 GKG + Events' },
      { label: 'Mode', value: 'Batch / nightly', highlight: true },
      { label: 'Backtest window', value: '2018-01-01 → 2023-12-31' },
      { label: 'Records loaded', value: '1.2M filtered / 48M raw' },
      { label: 'Events created', value: '23 historical events' },
      { label: 'Precision', value: '68% (vs known outcomes)', highlight: true },
      { label: 'Recall', value: '74%' },
      { label: 'Status', value: 'Awaiting window config' },
    ],
    log: [
      { time: '2d ago', level: 'INFO' as const, msg: 'Batch complete · 23 events classified · paused for review' },
      { time: '2d ago', level: 'WARN' as const, msg: '4.3% classification error rate — above 3% threshold' },
      { time: '2d ago', level: 'INFO' as const, msg: '1.2M records processed from GDELT GKG export' },
      { time: '3d ago', level: 'INFO' as const, msg: 'Backtest batch initiated · Tampa + Atlanta MSAs' },
      { time: '3d ago', level: 'ERROR' as const, msg: 'S3 auth expired mid-batch · resumed after token refresh' },
    ],
  },
];

const draftEvents = [
  { id: 'EVT-2041', source: 'Atlanta Permits', type: 'SUPPLY_SHOCK', desc: 'Fulton County — 312-unit permit filed · developer Toll Brothers', scope: 'Submarket', confidence: 87, age: '4 min', action: 'REVIEW' },
  { id: 'EVT-2042', source: 'Atlanta Permits', type: 'SUPPLY_SHOCK', desc: 'Dekalb County — 204-unit permit filed · unknown developer', scope: 'Submarket', confidence: 71, age: '4 min', action: 'REVIEW' },
  { id: 'EVT-2043', source: 'Atlanta Permits', type: 'SUPPLY_SHOCK', desc: 'Midtown Atlanta — mixed-use permit $48M · developer Portman', scope: 'Submarket', confidence: 93, age: '4 min', action: 'AUTO-FIRE' },
  { id: 'EVT-2044', source: 'DPCD Zoning', type: 'REGULATORY', desc: 'BeltLine NW corridor — Tier 2 rezoning approved · +15 du/acre', scope: 'Submarket', confidence: 88, age: '22 min', action: 'REVIEW' },
  { id: 'EVT-2045', source: 'DPCD Zoning', type: 'REGULATORY', desc: 'ITP variance granted · 2.4M sqft mixed-use override', scope: 'MSA', confidence: 62, age: '22 min', action: 'REVIEW' },
];

// ─── Playbook Library Data ────────────────────────────────────────────────────

interface PlaybookSubtype {
  id: string;
  name: string;
  category: string;
  instanceCount: number;
  confidenceScore: number;
  tier: 1 | 2 | 3;
  regimeShiftFlag: boolean;
  regimeShiftNote?: string;
  hitRate12mo: number;
  hitRate24mo: number;
  hitRate36mo: number;
  triggerConditions: string;
  lastUpdated: string;
}

const PLAYBOOK_SUBTYPES: PlaybookSubtype[] = [
  { id: 'emp-large',   name: 'Major Employment Expansion', category: 'employment',    instanceCount: 43, confidenceScore: 87, tier: 1, regimeShiftFlag: false, hitRate12mo: 0.83, hitRate24mo: 0.79, hitRate36mo: 0.74, triggerConditions: 'Announced headcount ≥ 500 · construction permit >$20M · relocation announcement', lastUpdated: '2026-03-15' },
  { id: 'transit-brt', name: 'BRT / Light Rail Opening',   category: 'infrastructure',instanceCount: 28, confidenceScore: 81, tier: 1, regimeShiftFlag: false, hitRate12mo: 0.78, hitRate24mo: 0.74, hitRate36mo: 0.71, triggerConditions: 'Groundbreaking or funding milestone · within 0.5mi station radius submarket', lastUpdated: '2026-02-20' },
  { id: 'supply-wave', name: 'Supply Delivery Wave',        category: 'supply',       instanceCount: 67, confidenceScore: 76, tier: 1, regimeShiftFlag: false, hitRate12mo: 0.81, hitRate24mo: 0.76, hitRate36mo: 0.69, triggerConditions: '>500 units in pipeline vs 18-mo absorption · delivery within 6-18mo window', lastUpdated: '2026-04-01' },
  { id: 'upzone',      name: 'Zoning Upzone / Rezoning',   category: 'policy',       instanceCount: 19, confidenceScore: 68, tier: 2, regimeShiftFlag: false, hitRate12mo: 0.71, hitRate24mo: 0.64, hitRate36mo: 0.59, triggerConditions: 'Density increase ≥ +20% FAR · city council approval · ITP or BeltLine corridor', lastUpdated: '2026-01-10' },
  { id: 'ins-rate',    name: 'Insurance Rate Shock',        category: 'policy',       instanceCount: 12, confidenceScore: 62, tier: 2, regimeShiftFlag: true,  regimeShiftNote: '5 of last 8 backtests biased HIGH. Rate environment shift detected.', hitRate12mo: 0.58, hitRate24mo: 0.52, hitRate36mo: 0.47, triggerConditions: 'State-level rate change >15% · wind zone reclassification · >3 carrier exits', lastUpdated: '2026-03-28' },
  { id: 'corp-hq',     name: 'Corporate HQ Relocation',    category: 'employment',   instanceCount: 31, confidenceScore: 74, tier: 1, regimeShiftFlag: false, hitRate12mo: 0.76, hitRate24mo: 0.70, hitRate36mo: 0.65, triggerConditions: 'F500 HQ move ≥ 1,000 employees · lease signed > 200K sqft · tax incentive deal', lastUpdated: '2026-02-14' },
  { id: 'demo-shift',  name: 'Demographic Inflection',     category: 'demographic',  instanceCount: 8,  confidenceScore: 55, tier: 3, regimeShiftFlag: false, hitRate12mo: 0.62, hitRate24mo: 0.57, hitRate36mo: 0.51, triggerConditions: 'Age cohort shift >+10% in submarket · college graduation migration pulse', lastUpdated: '2025-12-05' },
  { id: 'rate-hike',   name: 'Fed Rate Hike Cycle',         category: 'macro',        instanceCount: 14, confidenceScore: 70, tier: 2, regimeShiftFlag: true,  regimeShiftNote: '7 of last 12 backtests biased LOW. Current regime shows attenuated rent sensitivity.', hitRate12mo: 0.67, hitRate24mo: 0.61, hitRate36mo: 0.55, triggerConditions: 'FOMC hike ≥ 50bps single meeting · cumulative 200bps cycle · 10Y spread >250bps', lastUpdated: '2026-04-10' },
];

const TIER_COLORS: Record<number, string> = { 1: GREEN, 2: CYAN, 3: MUTED };
const TIER_LABELS: Record<number, string> = { 1: 'HIGH', 2: 'MEDIUM', 3: 'LOW' };
const CAT_COLORS: Record<string, string> = {
  employment: GREEN, infrastructure: CYAN, supply: AMBER,
  policy: '#8B5CF6', demographic: '#EC4899', macro: MUTED,
};

interface ApiPlaybook {
  subtype: string;
  displayName: string;
  category: string;
  instanceCount: number;
  confidence: number;
  status: 'preliminary' | 'publishable';
  metricWindowCount: number;
  lastUpdated: string | null;
}

function PlaybookLibraryPanel() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState('');
  const [apiData, setApiData] = useState<ApiPlaybook[]>([]);
  const [apiLoaded, setApiLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/v1/m35/playbooks')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.playbooks?.length) setApiData(d.playbooks as ApiPlaybook[]);
      })
      .catch(() => {})
      .finally(() => setApiLoaded(true));
  }, []);

  const mergedPlaybooks = apiLoaded && apiData.length > 0
    ? apiData.map(api => {
        const stat = PLAYBOOK_SUBTYPES.find(s => s.id === api.subtype);
        return {
          id: api.subtype,
          name: api.displayName,
          category: api.category.toLowerCase(),
          instanceCount: api.instanceCount,
          confidenceScore: Math.round(api.confidence * 100),
          tier: api.status === 'publishable' ? 'CORE' : 'DRAFT',
          regimeShiftFlag: false,
          hitRate12mo: stat?.hitRate12mo ?? api.confidence,
          hitRate24mo: stat?.hitRate24mo ?? api.confidence,
          hitRate36mo: stat?.hitRate36mo ?? api.confidence,
          triggerConditions: stat?.triggerConditions ?? [],
          lastUpdated: api.lastUpdated ?? stat?.lastUpdated ?? '',
        };
      })
    : PLAYBOOK_SUBTYPES;

  const cats = [...new Set(mergedPlaybooks.map(s => s.category))];
  const filtered = filterCat ? mergedPlaybooks.filter(s => s.category === filterCat) : mergedPlaybooks;
  const selected = mergedPlaybooks.find(s => s.id === selectedId) ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 16 }}>
      {/* Filter */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
        <button
          onClick={() => setFilterCat('')}
          style={{ ...mono, padding: '3px 10px', fontSize: 8, cursor: 'pointer', background: !filterCat ? CYAN : PANEL, color: !filterCat ? BG : DIM, border: `1px solid ${!filterCat ? CYAN : BORDER}`, borderRadius: 2 }}
        >
          ALL
        </button>
        {cats.map(c => (
          <button
            key={c}
            onClick={() => setFilterCat(c)}
            style={{ ...mono, padding: '3px 10px', fontSize: 8, cursor: 'pointer', background: filterCat === c ? CAT_COLORS[c] ?? CYAN : PANEL, color: filterCat === c ? BG : DIM, border: `1px solid ${filterCat === c ? (CAT_COLORS[c] ?? CYAN) : BORDER}`, borderRadius: 2 }}
          >
            {c.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ border: `1px solid ${BORDER}`, overflow: 'hidden', borderRadius: 3 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px 80px 80px 80px 80px', padding: '7px 14px', background: PANEL_ALT, borderBottom: `1px solid ${BORDER}`, fontSize: 8, fontWeight: 700, color: DIM, letterSpacing: '0.08em', ...mono }}>
          <span>PLAYBOOK SUBTYPE</span>
          <span>CATEGORY</span>
          <span>TIER</span>
          <span>INSTANCES</span>
          <span>T+12 HIT%</span>
          <span>T+24 HIT%</span>
          <span>CONF.</span>
        </div>
        {filtered.map((sub, i) => {
          const tierColor = TIER_COLORS[sub.tier] ?? MUTED;
          const catColor = CAT_COLORS[sub.category] ?? MUTED;
          const isSelected = selectedId === sub.id;
          return (
            <div key={sub.id}>
              <div
                onClick={() => setSelectedId(isSelected ? null : sub.id)}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 80px 60px 80px 80px 80px 80px',
                  padding: '9px 14px', cursor: 'pointer',
                  background: isSelected ? `${CYAN}0A` : i % 2 === 0 ? PANEL : BG,
                  borderBottom: `1px solid ${BORDER}20`,
                  borderLeft: `3px solid ${isSelected ? CYAN : 'transparent'}`,
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = `${CYAN}06`; }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = i % 2 === 0 ? PANEL : BG; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {sub.regimeShiftFlag && <span style={{ color: AMBER, fontSize: 9 }}>⚠</span>}
                  <span style={{ fontSize: 11, fontWeight: 600, color: PRIMARY }}>{sub.name}</span>
                </div>
                <span style={{ ...mono, fontSize: 9, color: catColor, fontWeight: 700 }}>
                  {sub.category.toUpperCase().substring(0, 6)}
                </span>
                <span style={{ ...mono, fontSize: 9, color: tierColor, fontWeight: 700 }}>
                  {TIER_LABELS[sub.tier]}
                </span>
                <span style={{ ...mono, fontSize: 10, color: MUTED }}>{sub.instanceCount}</span>
                <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: sub.hitRate12mo >= 0.75 ? GREEN : sub.hitRate12mo >= 0.6 ? AMBER : RED }}>
                  {(sub.hitRate12mo * 100).toFixed(0)}%
                </span>
                <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: sub.hitRate24mo >= 0.7 ? GREEN : sub.hitRate24mo >= 0.55 ? AMBER : RED }}>
                  {(sub.hitRate24mo * 100).toFixed(0)}%
                </span>
                <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: sub.confidenceScore >= 75 ? GREEN : sub.confidenceScore >= 60 ? AMBER : RED }}>
                  {sub.confidenceScore}%
                </span>
              </div>

              {/* Expanded detail */}
              {isSelected && selected && (
                <div style={{ background: `${CYAN}06`, borderBottom: `1px solid ${BORDER}`, padding: '12px 14px', display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                  {selected.regimeShiftFlag && (
                    <div style={{ padding: '8px 12px', background: `${AMBER}12`, border: `1px solid ${AMBER}44`, borderRadius: 2, fontSize: 10, color: AMBER }}>
                      ⚠ REGIME SHIFT: {selected.regimeShiftNote}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <div style={{ ...mono, fontSize: 8, fontWeight: 700, color: DIM, letterSpacing: '0.08em', marginBottom: 6 }}>TRIGGER CONDITIONS</div>
                      <div style={{ fontSize: 10, color: MUTED, lineHeight: 1.6 }}>{selected.triggerConditions}</div>
                    </div>
                    <div>
                      <div style={{ ...mono, fontSize: 8, fontWeight: 700, color: DIM, letterSpacing: '0.08em', marginBottom: 6 }}>HIT RATE BY WINDOW</div>
                      {([
                        { label: 'T+12mo', val: selected.hitRate12mo },
                        { label: 'T+24mo', val: selected.hitRate24mo },
                        { label: 'T+36mo', val: selected.hitRate36mo },
                      ]).map(row => {
                        const pct = Math.round(row.val * 100);
                        const barColor = pct >= 75 ? GREEN : pct >= 60 ? AMBER : RED;
                        return (
                          <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ ...mono, fontSize: 9, color: DIM, minWidth: 44 }}>{row.label}</span>
                            <div style={{ flex: 1, height: 4, background: BORDER, position: 'relative' as const, overflow: 'hidden' }}>
                              <div style={{ position: 'absolute' as const, left: 0, top: 0, bottom: 0, width: `${pct}%`, background: barColor }} />
                            </div>
                            <span style={{ ...mono, fontSize: 9, color: barColor, fontWeight: 700, minWidth: 28 }}>{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 9, color: DIM, ...mono, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
                    <span>ID: M35-{selected.id.toUpperCase()}</span>
                    <span>Instances: {selected.instanceCount}</span>
                    <span>Updated: {selected.lastUpdated}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type AdminTab = 'connectors' | 'queue' | 'playbooks' | 'accuracy' | 'readiness';

const ADMIN_TABS: { id: AdminTab; label: string }[] = [
  { id: 'connectors', label: 'CONNECTORS' },
  { id: 'queue',      label: `DRAFT QUEUE (${draftEvents.length})` },
  { id: 'playbooks',  label: 'PLAYBOOK LIBRARY' },
  { id: 'accuracy',   label: 'ACCURACY' },
  { id: 'readiness',  label: 'READINESS' },
];

const M35ConnectorAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<string | null>('atl-permits');
  const [selectedDrafts, setSelectedDrafts] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<AdminTab>('connectors');

  const readiness = [
    { label: 'DB schema applied (m35_events tables)', done: true },
    { label: 'Kafka topics registered (event.ingested, event.status_changed)', done: true },
    { label: 'Atlanta permits connector live', done: true },
    { label: 'DPCD webhook registered + secret verified', done: true },
    { label: 'GDELT backtest backfill complete', done: false },
    { label: 'Taxonomy seed loaded (8 categories)', done: true },
    { label: 'M06 NLP classifier enabled', done: true },
    { label: 'Event detail page routing (/events/:id)', done: true },
  ];

  const toggleDraft = (id: string) => {
    setSelectedDrafts(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div style={{ minHeight: '100vh', background: BG, color: PRIMARY, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '24px 24px' }}>

        {/* Nav */}
        <button
          onClick={() => navigate(-1)}
          style={{ ...mono, display: 'flex', alignItems: 'center', gap: 6, color: DIM, fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 20, padding: 0 }}
        >
          <ArrowLeft size={13} />
          Admin / M35 Connectors
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4, color: PRIMARY }}>
              M35 CONNECTOR ADMIN
            </h1>
            <div style={{ color: DIM, fontSize: 12 }}>
              Event intelligence ingestion — connector status, draft event queue, playbook library, backtest accuracy
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ ...mono, fontSize: 10, padding: '6px 12px', backgroundColor: `${GREEN}15`, border: `1px solid ${GREEN}40`, borderRadius: 2, color: GREEN }}>
              ● 2 LIVE
            </div>
            <div style={{ ...mono, fontSize: 10, padding: '6px 12px', backgroundColor: `${CYAN}10`, border: `1px solid ${CYAN}40`, borderRadius: 2, color: CYAN }}>
              1 STAGED
            </div>
            <div style={{ ...mono, fontSize: 10, padding: '6px 12px', backgroundColor: `${AMBER}10`, border: `1px solid ${AMBER}40`, borderRadius: 2, color: AMBER }}>
              1 PAUSED
            </div>
          </div>
        </div>

        {/* Health bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, marginBottom: 20, backgroundColor: BORDER }}>
          {[
            { label: 'CONNECTORS', value: '3', sub: '2 active', color: PRIMARY },
            { label: 'EVENTS QUEUED', value: '10', sub: '3 auto-fire eligible', color: CYAN },
            { label: 'EVENTS FIRED (7d)', value: '70', sub: '+12% WoW', color: GREEN },
            { label: 'AVG LATENCY', value: '1.2s', sub: 'permits · p99 4.1s', color: GREEN },
          ].map((k, i) => (
            <div key={i} style={{ backgroundColor: PANEL, padding: '12px 16px' }}>
              <div style={{ ...mono, color: DIM, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6 }}>{k.label}</div>
              <div style={{ ...mono, color: k.color, fontSize: 22, fontWeight: 700 }}>{k.value}</div>
              <div style={{ color: DIM, fontSize: 10, marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: `1px solid ${BORDER}` }}>
          {ADMIN_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                ...mono, fontSize: 9, fontWeight: 700, padding: '8px 16px', cursor: 'pointer',
                background: activeTab === tab.id ? PANEL : 'transparent',
                color: activeTab === tab.id ? CYAN : DIM,
                border: 'none',
                borderBottom: activeTab === tab.id ? `2px solid ${CYAN}` : '2px solid transparent',
                letterSpacing: '0.06em',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── CONNECTORS tab ──────────────────────────────────────────────────── */}
        {activeTab === 'connectors' && (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Database size={13} color={DIM} />
              <span style={{ ...mono, color: DIM, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em' }}>DATA CONNECTORS</span>
            </div>
            {connectors.map(c => (
              <ConnectorCard
                key={c.id}
                connector={c}
                isExpanded={expanded === c.id}
                onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
              />
            ))}
          </div>
        )}

        {/* ── QUEUE tab ───────────────────────────────────────────────────────── */}
        {activeTab === 'queue' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={13} color={DIM} />
                <span style={{ ...mono, color: DIM, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em' }}>DRAFT EVENT QUEUE — {draftEvents.length} PENDING</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {selectedDrafts.size > 0 && (
                  <>
                    <button style={{ ...mono, fontSize: 9, padding: '4px 10px', color: GREEN, border: `1px solid ${GREEN}50`, borderRadius: 2, backgroundColor: `${GREEN}10`, cursor: 'pointer' }}>
                      FIRE SELECTED ({selectedDrafts.size})
                    </button>
                    <button style={{ ...mono, fontSize: 9, padding: '4px 10px', color: RED, border: `1px solid ${RED}40`, borderRadius: 2, backgroundColor: 'transparent', cursor: 'pointer' }}>
                      DISCARD
                    </button>
                  </>
                )}
                <button style={{ ...mono, fontSize: 9, padding: '4px 10px', color: CYAN, border: `1px solid ${CYAN}40`, borderRadius: 2, backgroundColor: `${CYAN}08`, cursor: 'pointer' }}>
                  FIRE ALL ELIGIBLE
                </button>
              </div>
            </div>
            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 3, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                <thead>
                  <tr style={{ backgroundColor: PANEL_ALT }}>
                    <th style={{ width: 32, padding: '8px 12px' }}></th>
                    {['ID', 'Source', 'Type', 'Description', 'Scope', 'Confidence', 'Age', 'Action'].map(h => (
                      <th key={h} style={{ ...mono, textAlign: 'left' as const, padding: '8px 12px', color: DIM, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {draftEvents.map((ev, i) => (
                    <tr key={ev.id} style={{ backgroundColor: selectedDrafts.has(ev.id) ? `${CYAN}08` : i % 2 === 0 ? PANEL : BG, borderTop: `1px solid ${BORDER}30` }}>
                      <td style={{ padding: '8px 12px' }}>
                        <input type="checkbox" checked={selectedDrafts.has(ev.id)} onChange={() => toggleDraft(ev.id)} />
                      </td>
                      <td style={{ ...mono, padding: '8px 12px', color: CYAN, fontSize: 10 }}>{ev.id}</td>
                      <td style={{ padding: '8px 12px', color: MUTED, fontSize: 10 }}>{ev.source}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ ...mono, fontSize: 9, fontWeight: 700, color: ev.type === 'SUPPLY_SHOCK' ? AMBER : CYAN, backgroundColor: `${ev.type === 'SUPPLY_SHOCK' ? AMBER : CYAN}15`, border: `1px solid ${ev.type === 'SUPPLY_SHOCK' ? AMBER : CYAN}30`, borderRadius: 2, padding: '1px 5px' }}>
                          {ev.type}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', color: MUTED, fontSize: 10, maxWidth: 300 }}>{ev.desc}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ ...mono, fontSize: 9, color: ev.scope === 'MSA' ? '#6B7280' : ev.scope === 'Submarket' ? CYAN : AMBER }}>{ev.scope}</span>
                      </td>
                      <td style={{ ...mono, padding: '8px 12px', color: ev.confidence >= 85 ? GREEN : ev.confidence >= 70 ? AMBER : RED, fontSize: 11, fontWeight: 700 }}>
                        {ev.confidence}%
                      </td>
                      <td style={{ ...mono, padding: '8px 12px', color: DIM, fontSize: 10 }}>{ev.age}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ ...mono, fontSize: 9, color: ev.action === 'AUTO-FIRE' ? GREEN : CYAN, backgroundColor: `${ev.action === 'AUTO-FIRE' ? GREEN : CYAN}15`, border: `1px solid ${ev.action === 'AUTO-FIRE' ? GREEN : CYAN}30`, borderRadius: 2, padding: '2px 6px' }}>
                          {ev.action}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── PLAYBOOKS tab ────────────────────────────────────────────────────── */}
        {activeTab === 'playbooks' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: PRIMARY, marginBottom: 2 }}>Playbook Library</div>
                <div style={{ fontSize: 10, color: DIM }}>{PLAYBOOK_SUBTYPES.length} subtypes · click a row to expand trigger conditions and hit-rate chart</div>
              </div>
              <button
                onClick={() => navigate('/playbooks')}
                style={{ ...mono, fontSize: 9, padding: '5px 12px', color: CYAN, border: `1px solid ${CYAN}44`, borderRadius: 2, background: `${CYAN}10`, cursor: 'pointer' }}
              >
                OPEN FULL LIBRARY ↗
              </button>
            </div>
            <PlaybookLibraryPanel />
          </div>
        )}

        {/* ── ACCURACY tab ─────────────────────────────────────────────────────── */}
        {activeTab === 'accuracy' && (
          <div style={{ border: `1px solid ${BORDER}`, borderRadius: 3, overflow: 'hidden', backgroundColor: PANEL }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}` }}>
              <span style={{ ...mono, color: DIM, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em' }}>
                PLAYBOOK ACCURACY &amp; BACKTEST ENGINE
              </span>
            </div>
            <div style={{ padding: 16 }}>
              <PlaybookAccuracyDashboard />
            </div>
          </div>
        )}

        {/* ── READINESS tab ────────────────────────────────────────────────────── */}
        {activeTab === 'readiness' && (
          <div style={{ border: `1px solid ${BORDER}`, borderRadius: 3, overflow: 'hidden', backgroundColor: PANEL }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ ...mono, color: DIM, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em' }}>BACKTEST READINESS CHECKLIST</span>
              <span style={{ ...mono, color: GREEN, fontSize: 9 }}>
                {readiness.filter(r => r.done).length}/{readiness.length} complete
              </span>
            </div>
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {readiness.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: `1px solid ${BORDER}20` }}>
                  {item.done
                    ? <CheckCircle size={12} color={GREEN} style={{ marginTop: 1, flexShrink: 0 }} />
                    : <AlertTriangle size={12} color={AMBER} style={{ marginTop: 1, flexShrink: 0 }} />}
                  <span style={{ color: item.done ? MUTED : AMBER, fontSize: 11 }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default M35ConnectorAdminPage;
