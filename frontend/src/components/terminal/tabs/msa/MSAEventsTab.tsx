/**
 * MSAEventsTab — M35 Event Impact Engine overlay for MSA Terminal
 * Graduated from canvas mockup: MSAIntelligencePage.tsx
 */
import React, { useState } from 'react';
import { ArrowRight, Activity, ChevronDown } from 'lucide-react';
import { BT } from '../../theme';
import { MSAData } from '../../MSATerminal';

interface MSAEventsTabProps {
  msaId: string;
  msa: MSAData | null;
}

const SCOPE_COLORS: Record<string, string> = {
  MSA: '#6B7A8D',
  Submarket: '#0891B2',
  Property: '#D97706',
  State: '#6B7A8D',
};

const STATUS_COLORS: Record<string, string> = {
  AHEAD: '#10B981',
  'ON PACE': '#A0ABBE',
  FORECAST: '#D97706',
  FIRED: '#10B981',
  PENDING: '#D97706',
};

interface EventCard {
  emoji: string;
  name: string;
  scope: string;
  status: string;
  timing: string;
  trackingStatus: string;
  metric1Label: string;
  metric1Value: string;
  metric1Color: string;
  metric2Label: string;
  metric2Value: string;
  metric2Color: string;
}

const MOCK_EVENTS: EventCard[] = [
  {
    emoji: '📣',
    name: 'Amazon HQ2 Tampa',
    scope: 'Submarket',
    status: 'FIRED',
    timing: 'T+8mo',
    trackingStatus: 'AHEAD',
    metric1Label: 'Rent Growth',
    metric1Value: '+1.4pp by T+12',
    metric1Color: '#10B981',
    metric2Label: 'Absorption',
    metric2Value: '+18% by T+12',
    metric2Color: '#A0ABBE',
  },
  {
    emoji: '🌀',
    name: 'Hurricane Idalia Recovery',
    scope: 'MSA',
    status: 'FIRED',
    timing: 'T+14mo',
    trackingStatus: 'ON PACE',
    metric1Label: 'Rent Growth',
    metric1Value: '+0.8pp by T+12',
    metric1Color: '#A0ABBE',
    metric2Label: 'Permit Velocity',
    metric2Value: '-12% by T+12',
    metric2Color: '#EF4444',
  },
  {
    emoji: '🚆',
    name: 'BRT Phase 2 Extension',
    scope: 'Submarket',
    status: 'PENDING',
    timing: 'T-6mo',
    trackingStatus: 'FORECAST',
    metric1Label: 'Rent Growth',
    metric1Value: '+1.2pp by T+24',
    metric1Color: '#D97706',
    metric2Label: 'Cap Rate',
    metric2Value: '-0.15pp by T+24',
    metric2Color: '#D97706',
  },
  {
    emoji: '📜',
    name: 'FL Insurance Rate Reform',
    scope: 'State',
    status: 'PENDING',
    timing: 'T-2mo',
    trackingStatus: 'FORECAST',
    metric1Label: 'Cap Rate',
    metric1Value: '-0.25pp by T+12',
    metric1Color: '#D97706',
    metric2Label: 'Transaction Vol',
    metric2Value: '+22% by T+12',
    metric2Color: '#D97706',
  },
];

interface PlaybookForecast {
  name: string;
  subtitle: string;
  trackStatus: string;
  trackColor: string;
}

const PLAYBOOK_FORECASTS: PlaybookForecast[] = [
  { name: 'Amazon HQ2 x Rent Growth', subtitle: 'Submarket Impact', trackStatus: 'AHEAD', trackColor: '#10B981' },
  { name: 'Hurricane x Absorption', subtitle: 'MSA Impact', trackStatus: 'ON PACE', trackColor: '#A0ABBE' },
  { name: 'Rate Reform x Cap Rate', subtitle: 'State Impact', trackStatus: 'PROJ', trackColor: '#D97706' },
];

export const MSAEventsTab: React.FC<MSAEventsTabProps> = ({ msaId, msa }) => {
  const [metricFilter, setMetricFilter] = useState<string>('rent');
  const msaName = msa?.name || msaId || 'MSA';

  return (
    <div style={{ color: BT.text.primary, fontFamily: "'JetBrains Mono', monospace" }}>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 pb-4" style={{ borderBottom: `1px solid #1E2538` }}>
        <div>
          <h2 className="text-xl font-bold tracking-tight uppercase mb-1" style={{ color: '#E2E8F0' }}>
            {msaName.toUpperCase()} — EVENT IMPACT ENGINE
          </h2>
          <div className="text-xs font-medium uppercase tracking-wider flex items-center gap-3" style={{ color: '#A0ABBE' }}>
            <span>M35 Structured Events</span>
            <span className="w-1 h-1 rounded-full" style={{ background: '#6B7A8D' }}></span>
            <span>Playbook Forecasts Active</span>
          </div>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-6 font-mono text-sm px-4 py-2 rounded-md border" style={{ background: '#131929', borderColor: '#1E2538' }}>
          <div className="flex flex-col">
            <span className="text-xs" style={{ color: '#6B7A8D' }}>JEDI Score</span>
            <span className="text-xl font-bold" style={{ color: '#E2E8F0' }}>{msa?.healthScore ?? 72}</span>
          </div>
          <div className="w-px h-8" style={{ background: '#1E2538' }}></div>
          <div className="flex flex-col">
            <span className="text-xs" style={{ color: '#6B7A8D' }}>Event Sensitivity</span>
            <span className="text-xl font-bold" style={{ color: '#EF4444' }}>HIGH</span>
          </div>
          <div className="w-px h-8" style={{ background: '#1E2538' }}></div>
          <div className="flex flex-col">
            <span className="text-xs" style={{ color: '#6B7A8D' }}>Active Events</span>
            <span className="text-xl font-bold" style={{ color: '#0891B2' }}>5</span>
          </div>
        </div>
      </div>

      {/* Active Events Banner */}
      <div className="rounded-md p-4 mb-6 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 border" style={{ background: '#131929', borderColor: '#1E2538', borderLeft: '3px solid #0891B2' }}>
        <div className="flex flex-col lg:flex-row xl:items-center gap-4">
          <span className="font-bold text-sm tracking-wide" style={{ color: '#E2E8F0', whiteSpace: 'nowrap' }}>
            4 ACTIVE EVENTS AFFECTING THIS MSA
          </span>
          <div className="hidden lg:block w-px h-5" style={{ background: '#1E2538' }}></div>
          <div className="flex flex-wrap gap-4 text-sm font-mono items-center">
            <div className="flex items-center gap-2">
              <span>📣</span>
              <span style={{ color: '#E2E8F0' }}>Amazon HQ2 Tampa</span>
              <span style={{ color: '#6B7A8D' }}>(fired, T+8mo)</span>
              <span className="text-xs font-semibold px-1.5 py-0 rounded-sm border" style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)', color: '#10B981' }}>AHEAD</span>
            </div>
            <span style={{ color: '#6B7A8D' }}>|</span>
            <div className="flex items-center gap-2">
              <span>🌀</span>
              <span style={{ color: '#E2E8F0' }}>Hurricane Idalia Recovery</span>
              <span style={{ color: '#6B7A8D' }}>(MSA, T+14mo)</span>
            </div>
            <span style={{ color: '#6B7A8D' }}>|</span>
            <div className="flex items-center gap-2">
              <span>📜</span>
              <span style={{ color: '#E2E8F0' }}>FL Insurance Rate Reform</span>
              <span style={{ color: '#6B7A8D' }}>(state, pending)</span>
            </div>
          </div>
        </div>
        <button
          className="flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded transition-colors"
          style={{ color: '#0891B2' }}
        >
          View All Events <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Trajectory Chart */}
      <div className="rounded-md p-4 mb-2 border" style={{ background: '#131929', borderColor: '#1E2538' }}>
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <h3 className="text-base font-semibold" style={{ color: '#E2E8F0' }}>MSA Trajectory Overlay</h3>
            <div className="flex" style={{ background: '#0B0E1A', border: '1px solid #1E2538', borderRadius: 6, overflow: 'hidden' }}>
              {[
                { key: 'rent', label: 'Rent Growth' },
                { key: 'cap', label: 'Cap Rate' },
                { key: 'permit', label: 'Permits' },
                { key: 'trans', label: 'Transactions' },
              ].map((m, i, arr) => (
                <button
                  key={m.key}
                  onClick={() => setMetricFilter(m.key)}
                  className="px-3 py-1 text-xs font-mono transition-colors"
                  style={{
                    background: metricFilter === m.key ? '#1E2538' : 'transparent',
                    color: metricFilter === m.key ? '#E2E8F0' : '#A0ABBE',
                    borderRight: i < arr.length - 1 ? '1px solid #1E2538' : 'none',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            {[
              { color: '#0891B2', label: 'Submarket' },
              { color: '#6B7A8D', label: 'MSA Scope' },
              { color: '#D97706', label: 'Property' },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-2">
                <span className="w-3 h-0.5 inline-block" style={{ background: l.color }}></span>
                <span style={{ color: '#A0ABBE' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative w-full h-[240px] rounded overflow-hidden border" style={{ background: '#0B0E1A', borderColor: '#1E2538' }}>
          <div className="absolute inset-0 flex flex-col justify-between opacity-10 pointer-events-none">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="w-full h-px" style={{ background: '#A0ABBE' }}></div>)}
          </div>

          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 240">
            <rect x="330" y="0" width="170" height="240" fill="#0891B2" fillOpacity="0.05" />
            <rect x="670" y="0" width="170" height="240" fill="#0891B2" fillOpacity="0.05" />

            <path d="M 0,160 C 50,152 100,168 150,144 C 200,120 250,128 300,112 C 350,96 400,104 450,80 L 500,96"
              fill="none" stroke="#E2E8F0" strokeWidth="2" />

            <path d="M 500,96 C 600,64 700,56 1000,40 L 1000,120 C 700,120 600,128 500,96 Z"
              fill="#0891B2" fillOpacity="0.1" />
            <path d="M 500,96 C 600,88 700,80 1000,72"
              fill="none" stroke="#0891B2" strokeWidth="2" strokeDasharray="4 4" />

            <line x1="330" y1="0" x2="330" y2="240" stroke="#0891B2" strokeWidth="1.5" />
            <text x="335" y="16" fill="#0891B2" fontSize="11" fontFamily="monospace">📣 Amazon HQ2</text>

            <line x1="375" y1="0" x2="375" y2="240" stroke="#0891B2" strokeWidth="1.5" strokeDasharray="4 4" />
            <text x="380" y="32" fill="#0891B2" fontSize="11" fontFamily="monospace">🚆 BRT Phase 2</text>

            <line x1="460" y1="0" x2="460" y2="240" stroke="#6B7A8D" strokeWidth="1.5" />
            <text x="465" y="48" fill="#6B7A8D" fontSize="11" fontFamily="monospace">🌀 Hurricane Idalia</text>

            <line x1="500" y1="0" x2="500" y2="240" stroke="#E2E8F0" strokeWidth="2" />
            <rect x="475" y="215" width="50" height="18" fill="#E2E8F0" rx="2" />
            <text x="500" y="228" fill="#0B0E1A" fontSize="9" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">TODAY</text>

            <line x1="670" y1="0" x2="670" y2="240" stroke="#6B7A8D" strokeWidth="1.5" strokeDasharray="4 4" />
            <text x="675" y="16" fill="#6B7A8D" fontSize="11" fontFamily="monospace">📣 Apple Campus</text>
          </svg>

          <div className="absolute left-2 top-0 bottom-0 py-2 flex flex-col justify-between font-mono text-[10px]" style={{ color: '#A0ABBE' }}>
            <span>+6%</span>
            <span>+4%</span>
            <span>+2%</span>
            <span>0%</span>
            <span>-2%</span>
          </div>
        </div>

        <div className="flex justify-between px-4 mt-2 font-mono text-[10px]" style={{ color: '#6B7A8D' }}>
          {['T-24m', 'T-18m', 'T-12m', 'T-6m', 'T-0', 'T+6m', 'T+12m', 'T+18m', 'T+24m'].map((label) => (
            <span key={label} style={label === 'T-0' ? { color: '#E2E8F0', fontWeight: 700 } : {}}>{label}</span>
          ))}
        </div>
      </div>

      {/* Event Density Strip */}
      <div className="w-full h-12 relative overflow-hidden flex items-end px-4 mb-6 border-x border-b rounded-b-md" style={{ background: '#0B0E1A', borderColor: '#1E2538' }}>
        <div className="absolute bottom-0 w-full h-full flex items-end gap-[3px] px-1 opacity-80">
          {Array.from({ length: 60 }, (_, i) => {
            const h = 15 + ((i * 37 + 13) % 70);
            let color = '#1E2538';
            if (i === 20 || i === 22 || i === 28) color = '#0891B2';
            if (i === 15 || i === 40) color = '#6B7A8D';
            if (i === 45) color = '#D97706';
            if (h > 55 && color === '#1E2538') color = '#2E3851';
            return (
              <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, background: color }}></div>
            );
          })}
        </div>
        <div className="absolute inset-0 pointer-events-none border-t" style={{ borderColor: 'rgba(30,37,56,0.5)' }}></div>
        <div className="absolute left-1/2 top-0 bottom-0 w-px z-10" style={{ background: 'rgba(226,232,240,0.2)' }}></div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Active Event Cards */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#A0ABBE' }}>Active Event Profiles</h3>

          {MOCK_EVENTS.map((ev) => {
            const scopeColor = SCOPE_COLORS[ev.scope] || '#6B7A8D';
            const trackColor = STATUS_COLORS[ev.trackingStatus] || '#A0ABBE';
            return (
              <div
                key={ev.name}
                className="rounded-md flex flex-col border"
                style={{ background: '#131929', borderColor: '#1E2538', borderLeft: `3px solid ${scopeColor}` }}
              >
                <div className="p-4 flex-1">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded flex items-center justify-center text-xl" style={{ background: `${scopeColor}1A` }}>
                        {ev.emoji}
                      </div>
                      <div>
                        <div className="font-semibold flex items-center gap-2" style={{ color: '#E2E8F0' }}>
                          {ev.name}
                          <span className="text-[10px] h-5 px-1.5 rounded-sm border font-mono" style={{ background: `${scopeColor}1A`, borderColor: `${scopeColor}33`, color: scopeColor }}>
                            {ev.scope.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-xs font-mono mt-1" style={{ color: '#6B7A8D' }}>{ev.status} • {ev.timing}</div>
                      </div>
                    </div>
                    <span className="text-xs font-mono px-2 py-0.5 rounded border" style={{ background: `${trackColor}1A`, borderColor: `${trackColor}33`, color: trackColor }}>
                      {ev.trackingStatus}
                    </span>
                  </div>
                  <div className="rounded p-3 text-sm font-mono flex flex-col gap-2 border" style={{ background: '#0B0E1A', borderColor: '#1E2538' }}>
                    <div className="flex justify-between items-center">
                      <span style={{ color: '#A0ABBE' }}>{ev.metric1Label}:</span>
                      <span style={{ color: '#E2E8F0' }}>{ev.metric1Value} <span style={{ color: ev.metric1Color }}>({ev.trackingStatus})</span></span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span style={{ color: '#A0ABBE' }}>{ev.metric2Label}:</span>
                      <span style={{ color: '#E2E8F0' }}>{ev.metric2Value} <span style={{ color: ev.metric2Color }}>(ON PACE)</span></span>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-2 flex justify-end border-t" style={{ borderColor: '#1E2538' }}>
                  <button className="text-xs font-medium flex items-center gap-1" style={{ color: '#0891B2' }}>
                    View Details <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Playbook Forecasts */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: '#A0ABBE' }}>
              <Activity className="w-4 h-4" /> Active Playbook Forecasts
            </h3>
            <div className="flex flex-col gap-3">
              {PLAYBOOK_FORECASTS.map((pf) => (
                <div key={pf.name} className="rounded-md p-3 relative overflow-hidden border" style={{ background: '#131929', borderColor: '#1E2538' }}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-xs font-semibold truncate max-w-[180px]" style={{ color: '#E2E8F0' }}>{pf.name}</div>
                      <div className="text-[10px] font-mono uppercase" style={{ color: '#6B7A8D' }}>{pf.subtitle}</div>
                    </div>
                    <span className="text-[10px] py-0 px-1.5 h-4 rounded border font-mono" style={{ background: `${pf.trackColor}1A`, borderColor: `${pf.trackColor}33`, color: pf.trackColor }}>
                      {pf.trackStatus}
                    </span>
                  </div>
                  <div className="h-[60px] w-full relative">
                    <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 200 60">
                      <path d="M0,40 C50,40 100,30 150,15 L200,10" fill="none" stroke="#0891B2" strokeWidth="1.5" />
                      <path d="M0,40 C50,40 100,30 150,20 L200,25" fill="none" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />
                      <path d="M100,30 L200,10 L200,25 Z" fill="#0891B2" fillOpacity="0.1" />
                      <line x1="100" y1="0" x2="100" y2="60" stroke="#1E2538" strokeWidth="1" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Watchlist */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: '#A0ABBE' }}>
              <ChevronDown className="w-4 h-4" /> Event Watchlist
            </h3>
            <div className="rounded-md border overflow-hidden" style={{ borderColor: '#1E2538' }}>
              {[
                { emoji: '🏗️', name: 'Apple Campus Phase 2', timing: 'T+18mo', tag: 'WATCH' },
                { emoji: '📊', name: 'Fed Rate Cut Impact', timing: 'ongoing', tag: 'MONITOR' },
                { emoji: '🏙️', name: 'Downtown Rezoning', timing: 'T-3mo', tag: 'PENDING' },
              ].map((item, i, arr) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between px-3 py-2.5 transition-colors cursor-pointer"
                  style={{
                    background: '#131929',
                    borderBottom: i < arr.length - 1 ? '1px solid #1E2538' : 'none',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{item.emoji}</span>
                    <span className="text-xs" style={{ color: '#E2E8F0' }}>{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono" style={{ color: '#6B7A8D' }}>{item.timing}</span>
                    <span className="text-[9px] px-1 py-0.5 rounded-sm font-mono border" style={{ color: '#D97706', borderColor: '#D97706', background: 'rgba(217,119,6,0.1)' }}>{item.tag}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MSAEventsTab;
