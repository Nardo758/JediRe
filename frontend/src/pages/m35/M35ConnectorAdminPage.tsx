import React, { useState } from 'react';
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

const M35ConnectorAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<string | null>('atl-permits');
  const [selectedDrafts, setSelectedDrafts] = useState<Set<string>>(new Set());
  const [readinessOpen, setReadinessOpen] = useState(true);

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
              Event intelligence ingestion — connector status, draft event queue, backtest readiness
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

        {/* Connectors */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Database size={13} color={DIM} />
            <span style={{ ...mono, color: DIM, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em' }}>DATA CONNECTORS</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
            {connectors.map(c => (
              <ConnectorCard
                key={c.id}
                connector={c}
                isExpanded={expanded === c.id}
                onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
              />
            ))}
          </div>
        </div>

        {/* Draft Event Queue */}
        <div style={{ marginBottom: 24 }}>
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
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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

        {/* Backtest Readiness */}
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 3, overflow: 'hidden', backgroundColor: PANEL }}>
          <div
            onClick={() => setReadinessOpen(!readinessOpen)}
            style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: readinessOpen ? `1px solid ${BORDER}` : 'none' }}
          >
            {readinessOpen ? <ChevronDown size={12} color={DIM} /> : <ChevronRight size={12} color={DIM} />}
            <span style={{ ...mono, color: DIM, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em' }}>BACKTEST READINESS CHECKLIST</span>
            <span style={{ ...mono, color: GREEN, fontSize: 9, marginLeft: 'auto' }}>
              {readiness.filter(r => r.done).length}/{readiness.length} complete
            </span>
          </div>
          {readinessOpen && (
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
          )}
        </div>

      </div>
    </div>
  );
};

export default M35ConnectorAdminPage;
