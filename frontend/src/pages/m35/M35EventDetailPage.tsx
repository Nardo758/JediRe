import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronDown, Check, ArrowLeft, ArrowRight, Activity } from 'lucide-react';
import { ForecastTracker } from '../../components/m35/ForecastTracker';
import { MultiMetricPanel } from '../../components/m35/MultiMetricPanel';
import { EventDensityStrip } from '../../components/m35/EventDensityStrip';
import { CascadeMap } from '../../components/m35/CascadeMap';
import { AttributionWaterfall } from '../../components/m35/AttributionWaterfall';

const TABS = ['FORECAST', 'MULTI-METRIC', 'PLAYBOOK', 'GEOGRAPHY', 'TIMELINE'] as const;
type EventTab = typeof TABS[number];

const M35EventDetailPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<EventTab>('FORECAST');
  const [activeMetric, setActiveMetric] = useState('Rent Growth');

  return (
    <div className="min-h-screen font-sans overflow-y-auto" style={{ background: '#0B0E1A', color: '#E2E8F0' }}>
      <div className="max-w-[1400px] mx-auto p-6">

        {/* Back nav */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 mb-4 text-sm font-mono tracking-wide transition-colors"
          style={{ color: '#6B7A8D' }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Events / Amazon HQ2 — Tampa
        </button>

        {/* Page Header */}
        <header className="mb-6">
          <h1 className="text-3xl font-bold uppercase tracking-tight mb-3" style={{ color: '#E2E8F0' }}>
            AMAZON HQ2 — TAMPA MSA
          </h1>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="text-xs font-semibold px-2 py-1 uppercase rounded-sm flex items-center gap-1 border" style={{ background: '#131929', borderColor: '#1E2538', color: '#E2E8F0' }}>
              📣 EMPLOYMENT
            </span>
            <span className="text-xs font-semibold px-2 py-1 uppercase rounded-sm border" style={{ background: '#131929', borderColor: '#1E2538', color: '#A0ABBE' }}>
              MSA SCOPE
            </span>
            <span className="text-xs font-semibold px-2 py-1 uppercase rounded-sm border" style={{ background: 'rgba(16,185,129,0.2)', borderColor: 'rgba(16,185,129,0.5)', color: '#10B981' }}>
              FIRED
            </span>
            <span className="text-xs font-semibold px-2 py-1 uppercase rounded-sm border" style={{ background: 'rgba(8,145,178,0.2)', borderColor: 'rgba(8,145,178,0.5)', color: '#0891B2' }}>
              T+8 MONTHS
            </span>
          </div>

          <div className="text-sm font-mono p-3 rounded flex items-center divide-x border" style={{ background: '#131929', borderColor: '#1E2538', color: '#A0ABBE', divideColor: '#1E2538' }}>
            <span className="px-3 first:pl-0" style={{ borderColor: '#1E2538' }}>Announced: <span style={{ color: '#E2E8F0' }}>Mar 2024</span></span>
            <span className="px-3" style={{ borderColor: '#1E2538' }}>Magnitude: <span style={{ color: '#E2E8F0' }}>25,000 Jobs</span></span>
            <span className="px-3" style={{ borderColor: '#1E2538' }}>Confidence: <span style={{ color: '#E2E8F0' }}>87%</span></span>
            <span className="px-3 last:pr-0" style={{ borderColor: '#1E2538' }}>MSA: <span style={{ color: '#E2E8F0' }}>Tampa-St. Pete</span></span>
          </div>
        </header>

        {/* Sensitivity Banner */}
        <div className="rounded-md mb-8 flex divide-x border" style={{ background: '#131929', borderColor: '#1E2538' }}>
          <div className="flex-1 p-4">
            <div className="text-xs font-semibold uppercase mb-1" style={{ color: '#A0ABBE' }}>Event Sensitivity</div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-white text-xs font-bold px-1.5 py-0.5 rounded-sm" style={{ background: '#EF4444' }}>HIGH</span>
            </div>
            <div className="text-sm" style={{ color: '#E2E8F0' }}>42% of projected IRR uplift from this event</div>
          </div>
          <div className="flex-1 p-4" style={{ borderColor: '#1E2538' }}>
            <div className="text-xs font-semibold uppercase mb-1" style={{ color: '#A0ABBE' }}>Proximity Score</div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-lg font-medium" style={{ color: '#E2E8F0' }}>0.74</span>
            </div>
            <div className="text-sm" style={{ color: '#E2E8F0' }}>Property at 2.1mi from epicenter</div>
          </div>
          <div className="flex-1 p-4" style={{ borderColor: '#1E2538' }}>
            <div className="text-xs font-semibold uppercase mb-1" style={{ color: '#A0ABBE' }}>Forecast Status</div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-lg font-medium tracking-tight" style={{ color: '#10B981' }}>AHEAD</span>
            </div>
            <div className="text-sm" style={{ color: '#E2E8F0' }}>+0.8pp above playbook median at T+8</div>
          </div>
        </div>

        {/* Tab Strip */}
        <div className="flex border-b mb-6" style={{ borderColor: '#1E2538' }}>
          {TABS.map((tab, idx) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-6 py-3 text-sm font-semibold uppercase tracking-wider border-b-2 transition-colors"
              style={{
                borderBottomColor: activeTab === tab ? '#0891B2' : 'transparent',
                color: activeTab === tab ? '#0891B2' : '#6B7A8D',
              }}
            >
              {tab} {activeTab === tab && '●'}
            </button>
          ))}
        </div>

        {/* FORECAST Tab */}
        {activeTab === 'FORECAST' && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4" style={{ color: '#E2E8F0' }}>
              Rent Growth (YoY) — Primary Metric{' '}
              <span className="font-normal" style={{ color: '#6B7A8D' }}>| Tampa Westshore Submarket</span>
            </h2>

            {/* ForecastTracker component */}
            <div className="mb-4">
              <ForecastTracker
                eventId={eventId ?? 'demo-event'}
                eventName="Amazon HQ2 — Tampa"
                metric="rent_growth_yoy"
                height={240}
              />
            </div>

            {/* EventDensityStrip */}
            <div className="mb-6">
              <EventDensityStrip msaId="tampa" height={30} />
            </div>

            {/* Metric selectors */}
            <div className="flex items-center gap-2 mb-6">
              <button
                className="text-sm font-medium px-3 py-1.5 rounded flex items-center gap-1 border"
                style={{ background: 'rgba(8,145,178,0.2)', borderColor: 'rgba(8,145,178,0.5)', color: '#0891B2' }}
              >
                Rent Growth <ChevronDown className="w-4 h-4" />
              </button>
              {['Absorption', 'Cap Rate', 'Permits', 'Search Momentum'].map((m) => (
                <button
                  key={m}
                  onClick={() => setActiveMetric(m)}
                  className="text-sm font-medium px-3 py-1.5 rounded transition-colors border"
                  style={{
                    background: '#131929',
                    borderColor: '#1E2538',
                    color: activeMetric === m ? '#E2E8F0' : '#A0ABBE',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Main chart */}
            <div className="rounded-md p-4 mb-6 relative h-[320px] flex flex-col border" style={{ background: '#131929', borderColor: '#1E2538' }}>
              <div className="absolute top-4 right-4 text-xs font-bold px-2 py-1 uppercase rounded border" style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)', color: '#10B981' }}>
                AHEAD
              </div>

              <div className="flex-1 relative mt-8 mb-6 ml-10">
                <div className="absolute -left-10 top-0 bottom-0 flex flex-col justify-between text-xs font-mono h-full py-0" style={{ color: '#6B7A8D' }}>
                  <span>+4.0%</span>
                  <span>+2.0%</span>
                  <span>0.0%</span>
                </div>

                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  <div className="w-full border-t" style={{ borderColor: '#1E2538' }}></div>
                  <div className="w-full border-t" style={{ borderColor: '#1E2538' }}></div>
                  <div className="w-full border-t" style={{ borderColor: '#1E2538' }}></div>
                </div>

                <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                  <path d="M0,80 L20,70 L40,55 L60,35 L80,20 L100,10 L100,90 L80,85 L60,80 L40,75 L20,75 L0,80 Z" fill="#0891B2" fillOpacity="0.08" />
                  <path d="M0,80 L20,70 L40,55 L60,35 L80,20 L100,10" fill="none" stroke="#0891B2" strokeWidth="1" strokeDasharray="2,2" />
                  <path d="M0,80 L20,75 L40,65 L60,50 L80,40 L100,30" fill="none" stroke="#A0ABBE" strokeWidth="1" strokeDasharray="2,2" />
                  <path d="M0,80 L20,75 L40,75 L60,80 L80,85 L100,90" fill="none" stroke="#0891B2" strokeWidth="1" strokeDasharray="2,2" />
                  <path d="M0,80 L5,77 L10,72 L15,68 L20,62 L22,60" fill="none" stroke="#10B981" strokeWidth="2" />
                  <circle cx="22" cy="60" r="3" fill="#10B981" />
                  <line x1="22" y1="60" x2="22" y2="100" stroke="#10B981" strokeWidth="1" strokeDasharray="2,2" />
                </svg>

                <div className="absolute top-[35%] left-[23%] shadow-lg rounded p-2 text-xs z-10 w-48 border" style={{ background: '#0B0E1A', borderColor: '#1E2538' }}>
                  <div className="font-mono flex justify-between mb-1"><span style={{ color: '#A0ABBE' }}>Actual:</span> <span style={{ color: '#10B981' }}>+2.1%</span></div>
                  <div className="font-mono flex justify-between mb-1"><span style={{ color: '#A0ABBE' }}>Forecast:</span> <span style={{ color: '#E2E8F0' }}>+1.3%</span></div>
                  <div className="font-mono flex justify-between pt-1 mt-1 border-t" style={{ borderColor: '#1E2538' }}><span style={{ color: '#A0ABBE' }}>Delta:</span> <span style={{ color: '#10B981' }}>+0.8pp</span></div>
                </div>
              </div>

              <div className="flex justify-between text-xs font-mono ml-10 relative" style={{ color: '#6B7A8D' }}>
                <span>T+0</span>
                <span className="absolute left-[16.6%]">T+6</span>
                <span className="absolute left-[33.3%]">T+12</span>
                <span className="absolute left-[50%]">T+18</span>
                <span className="absolute left-[66.6%]">T+24</span>
                <span className="absolute right-0">T+36</span>
              </div>
            </div>

            {/* Window summary table */}
            <div className="rounded-md overflow-hidden border" style={{ background: '#131929', borderColor: '#1E2538' }}>
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase border-b" style={{ color: '#A0ABBE', background: '#0B0E1A', borderColor: '#1E2538' }}>
                  <tr>
                    <th className="px-4 py-3 font-semibold">Window</th>
                    <th className="px-4 py-3 font-semibold">Forecast</th>
                    <th className="px-4 py-3 font-semibold">Actual</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="font-mono divide-y" style={{ divideColor: '#1E2538' }}>
                  {[
                    { window: 'T+0 to T+3: Immediate', forecast: '+0.4%', actual: '+0.6%', status: 'AHEAD', statusColor: '#10B981', highlight: false },
                    { window: 'T+3 to T+12: Short-term', forecast: '+1.3%', actual: '+2.1%', status: 'AHEAD', statusColor: '#10B981', highlight: true, actualNote: '(current)' },
                    { window: 'T+12 to T+24: Medium-term', forecast: '+2.8%', actual: '—', status: 'PENDING', statusColor: '#6B7A8D', highlight: false },
                    { window: 'T+24 to T+60: Long-term', forecast: '+3.9%', actual: '—', status: 'PENDING', statusColor: '#6B7A8D', highlight: false },
                  ].map((row) => (
                    <tr key={row.window} className="transition-colors" style={{ background: row.highlight ? 'rgba(30,37,56,0.2)' : 'transparent' }}>
                      <td className="px-4 py-3 font-sans" style={{ color: '#E2E8F0' }}>{row.window}</td>
                      <td className="px-4 py-3" style={{ color: '#A0ABBE' }}>{row.forecast}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: row.actual === '—' ? '#6B7A8D' : row.statusColor }}>
                        {row.actual}
                        {row.actualNote && <span className="font-normal text-xs ml-1" style={{ color: '#6B7A8D' }}>{row.actualNote}</span>}
                      </td>
                      <td className="px-4 py-3 font-sans font-semibold text-xs flex items-center gap-1" style={{ color: row.statusColor }}>
                        {row.status === 'AHEAD' && <Check className="w-3 h-3" />}
                        {row.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}


        {/* MULTI-METRIC Tab — MultiMetricPanel */}
        {activeTab === 'MULTI-METRIC' && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-1" style={{ color: '#E2E8F0' }}>Multi-Metric Dashboard</h2>
            <p className="text-sm mb-4" style={{ color: '#6B7A8D' }}>All tracked metrics vs forecast — actual vs model with M35 event markers</p>
            <div className="mb-6">
              <MultiMetricPanel
                eventId={eventId ?? 'demo-event'}
                eventName="Amazon HQ2 — Tampa"
              />
            </div>
            <div className="mb-4">
              <AttributionWaterfall
                eventId={eventId ?? 'demo-event'}
                metric="rent_growth_yoy"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { metric: 'Rent Growth (YoY)', actual: '+2.1%', forecast: '+1.3%', delta: '+0.8pp', status: 'AHEAD', statusColor: '#10B981', points: '0,80 20,70 40,55 60,35 80,20 100,10', eventX: 62 },
                { metric: 'Absorption Rate', actual: '+4.8pp', forecast: '+2.9pp', delta: '+1.9pp', status: 'AHEAD', statusColor: '#10B981', points: '0,75 20,68 40,58 60,40 80,28 100,18', eventX: 60 },
                { metric: 'Search Momentum', actual: '+18%', forecast: '+8%', delta: '+10pp', status: 'AHEAD', statusColor: '#10B981', points: '0,70 20,60 40,45 60,30 80,15 100,8', eventX: 58 },
                { metric: 'Cap Rate', actual: '5.4%', forecast: '5.6%', delta: '−0.2pp', status: 'COMPRESSING', statusColor: '#0891B2', points: '0,40 20,42 40,48 60,55 80,60 100,62', eventX: 58, inverted: true },
                { metric: 'Permit Velocity', actual: '+12%', forecast: '+5%', delta: '+7pp', status: 'WATCH', statusColor: '#D97706', points: '0,60 20,55 40,50 60,42 80,35 100,30', eventX: 60 },
                { metric: 'AADT / Traffic', actual: '+18%', forecast: '+9%', delta: '+9pp', status: 'AHEAD', statusColor: '#10B981', points: '0,72 20,65 40,55 60,40 80,25 100,15', eventX: 60 },
              ].map((m) => (
                <div key={m.metric} className="rounded border p-3 flex flex-col gap-2" style={{ background: '#131929', borderColor: '#1E2538' }}>
                  <div className="text-[10px] font-mono font-semibold uppercase tracking-wide" style={{ color: '#A0ABBE' }}>{m.metric}</div>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-xl font-bold font-mono" style={{ color: '#E2E8F0' }}>{m.actual}</div>
                      <div className="text-[10px]" style={{ color: '#6B7A8D' }}>actual</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono" style={{ color: m.statusColor }}>{m.delta}</div>
                      <div className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded border" style={{ color: m.statusColor, background: `${m.statusColor}1A`, borderColor: `${m.statusColor}4D` }}>{m.status}</div>
                    </div>
                  </div>
                  {/* Mini chart */}
                  <div className="relative" style={{ height: 60 }}>
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      {/* Forecast line (dashed) */}
                      <polyline
                        points={m.points.split(' ').map((pt, i) => {
                          const [x, y] = pt.split(',');
                          return `${x},${parseFloat(y) + 15}`;
                        }).join(' ')}
                        fill="none" stroke="#6B7A8D" strokeWidth="1" strokeDasharray="2,2"
                      />
                      {/* Actual fill area */}
                      <polyline points={m.points} fill="none" stroke={m.statusColor} strokeWidth="1.5" strokeLinejoin="round" />
                      {/* Event marker */}
                      <line x1={m.eventX} y1="0" x2={m.eventX} y2="100" stroke="#0891B2" strokeWidth="0.8" strokeDasharray="2,2" />
                      <circle cx={m.eventX} cy={parseFloat(m.points.split(' ')[Math.floor(m.points.split(' ').length / 2)].split(',')[1])} r="3" fill="#0891B2" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-3 text-[9px]" style={{ color: '#6B7A8D' }}>
                    <span>Forecast: <span style={{ color: '#A0ABBE' }}>{m.forecast}</span></span>
                    <span className="ml-auto">T+0 → T+36</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-6 text-[10px]" style={{ color: '#6B7A8D' }}>
              <div className="flex items-center gap-1.5"><div className="w-6 h-0.5" style={{ background: '#0891B2' }}></div><span>Actual</span></div>
              <div className="flex items-center gap-1.5"><div className="w-6 h-0.5 border-t border-dashed" style={{ borderColor: '#6B7A8D' }}></div><span>Forecast</span></div>
              <div className="flex items-center gap-1.5"><div className="w-0.5 h-3" style={{ background: '#0891B2' }}></div><span>Event marker (Amazon HQ2)</span></div>
            </div>
          </div>
        )}

        {/* PLAYBOOK Tab */}
        {activeTab === 'PLAYBOOK' && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4" style={{ color: '#E2E8F0' }}>
              Playbook Citation
              <span className="text-sm font-normal ml-2" style={{ color: '#6B7A8D' }}>Major Employment Expansion · Subtype M35-EMP-LARGE</span>
            </h2>

            {/* Confidence + regime */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Playbook Confidence', value: '87%', color: '#10B981', sub: '43 comparable events' },
                { label: 'Confidence Tier', value: 'HIGH', color: '#10B981', sub: 'Tier 1 (≥75%)' },
                { label: 'Regime Shift', value: 'NONE', color: '#6B7A8D', sub: 'Stable rate environment' },
              ].map(c => (
                <div key={c.label} className="rounded border p-4" style={{ background: '#131929', borderColor: '#1E2538' }}>
                  <div className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: '#6B7A8D' }}>{c.label}</div>
                  <div className="text-2xl font-bold font-mono" style={{ color: c.color }}>{c.value}</div>
                  <div className="text-xs mt-1" style={{ color: '#6B7A8D' }}>{c.sub}</div>
                </div>
              ))}
            </div>

            {/* Stratified response curves */}
            <div className="rounded border mb-4" style={{ background: '#131929', borderColor: '#1E2538' }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: '#1E2538' }}>
                <div className="text-xs font-mono uppercase tracking-widest font-semibold" style={{ color: '#A0ABBE' }}>Stratified Response Curves — Rent Growth</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: `1px solid #1E2538` }}>
                      {['Window', 'p25', 'Median', 'p75', 'This Event'].map(h => (
                        <th key={h} className="px-4 py-2 text-left font-mono uppercase" style={{ color: '#6B7A8D' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { window: 'T+0 to T+3',  p25: '+0.1%', med: '+0.4%', p75: '+0.7%', cur: '+0.6%', color: '#10B981' },
                      { window: 'T+3 to T+12', p25: '+0.6%', med: '+1.3%', p75: '+2.2%', cur: '+2.1%', color: '#10B981' },
                      { window: 'T+12 to T+24',p25: '+1.4%', med: '+2.8%', p75: '+4.1%', cur: '—',     color: '#6B7A8D' },
                      { window: 'T+24 to T+60',p25: '+2.0%', med: '+3.9%', p75: '+5.5%', cur: '—',     color: '#6B7A8D' },
                    ].map(row => (
                      <tr key={row.window} className="border-b" style={{ borderColor: '#1E2538' }}>
                        <td className="px-4 py-2 font-mono" style={{ color: '#E2E8F0' }}>{row.window}</td>
                        <td className="px-4 py-2 font-mono" style={{ color: '#6B7A8D' }}>{row.p25}</td>
                        <td className="px-4 py-2 font-mono font-semibold" style={{ color: '#0891B2' }}>{row.med}</td>
                        <td className="px-4 py-2 font-mono" style={{ color: '#6B7A8D' }}>{row.p75}</td>
                        <td className="px-4 py-2 font-mono font-bold" style={{ color: row.color }}>{row.cur}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Comparable events */}
            <div className="rounded border" style={{ background: '#131929', borderColor: '#1E2538' }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: '#1E2538' }}>
                <div className="text-xs font-mono uppercase tracking-widest font-semibold" style={{ color: '#A0ABBE' }}>Comparable Historical Events</div>
              </div>
              <div className="divide-y" style={{ borderColor: '#1E2538' }}>
                {[
                  { name: 'Apple Park — Cupertino', yr: '2017', out: '+4.8pp rent / 36mo', status: 'AHEAD', fin: 'CLOSED', irrDelta: '+2.1pp' },
                  { name: 'Amazon HQ1 — Seattle', yr: '2010', out: '+6.2pp rent / 48mo', status: 'AHEAD', fin: 'CLOSED', irrDelta: '+3.4pp' },
                  { name: 'Tesla Gigafactory — Austin', yr: '2021', out: '+3.1pp rent / 24mo', status: 'ON PACE', fin: 'ACTIVE', irrDelta: '+1.6pp' },
                  { name: 'Boeing HQ — Chicago', yr: '2001', out: '+0.8pp rent / 12mo', status: 'BEHIND', fin: 'CLOSED', irrDelta: '+0.3pp' },
                ].map(ev => (
                  <div key={ev.name} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold" style={{ color: '#E2E8F0' }}>{ev.name}</div>
                      <div className="text-xs font-mono mt-0.5" style={{ color: '#6B7A8D' }}>
                        {ev.yr} · Outcome: <span style={{ color: '#A0ABBE' }}>{ev.out}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span style={{ color: ev.status === 'AHEAD' ? '#10B981' : ev.status === 'ON PACE' ? '#0891B2' : '#EF4444' }}>{ev.status}</span>
                      <span style={{ color: '#6B7A8D' }}>{ev.fin}</span>
                      <span style={{ color: '#D97706' }}>IRR Δ {ev.irrDelta}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* GEOGRAPHY Tab — enhanced with CascadeMap */}
        {activeTab === 'GEOGRAPHY' && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4" style={{ color: '#E2E8F0' }}>
              Geographic Impact Map <span className="font-normal text-sm" style={{ color: '#6B7A8D' }}>| Tampa MSA — Amazon HQ2 Cascade</span>
            </h2>
            <div className="mb-4">
              <CascadeMap
                eventId={eventId ?? 'demo-event'}
                height={340}
              />
            </div>
          </div>
        )}

        {/* TIMELINE Tab */}
        {activeTab === 'TIMELINE' && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4" style={{ color: '#E2E8F0' }}>Status History</h2>
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[11px] top-0 bottom-0 w-0.5" style={{ background: '#1E2538' }} />
              <div className="flex flex-col gap-0">
                {[
                  { date: 'Mar 2024', status: 'ANNOUNCED', color: '#0891B2', desc: 'Amazon announces Tampa as HQ2 location. 25,000 jobs over 10 years. Initial market reaction: +0.4pp rent growth signal detected.' },
                  { date: 'May 2024', status: 'CONFIRMED', color: '#10B981', desc: 'Construction permits filed. Site preparation begins at Westshore corridor. Submarket confidence upgraded to Tier 1.' },
                  { date: 'Aug 2024', status: 'MATERIALIZING', color: '#10B981', desc: 'First cohort hiring announcements (2,500 roles). Absorption rate jumps +1.9pp above forecast. AHEAD status triggered.' },
                  { date: 'Nov 2024', status: 'T+8 CURRENT', color: '#D97706', desc: 'Rent growth tracking +2.1% vs +1.3% forecast. Playbook confidence upgraded to 87%. IRR impact +1.8pp on Westshore properties.' },
                  { date: 'Q1 2025', status: 'PENDING', color: '#6B7A8D', desc: 'Phase 2 hiring wave expected. BRT transit alignment may amplify proximity effects.' },
                  { date: '2027–2034', status: 'LONG-TERM', color: '#6B7A8D', desc: 'Remaining 22,500 jobs phased in. Full MSA absorption over multi-year window.' },
                ].map((item, i) => (
                  <div key={i} className="relative flex gap-6 pl-8 pb-6">
                    <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10"
                      style={{
                        background: item.status === 'PENDING' || item.status === 'LONG-TERM' ? '#0B0E1A' : item.color,
                        borderColor: item.color,
                      }}>
                      {item.status === 'T+8 CURRENT' && <div className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                    </div>
                    <div className="flex-1 rounded border p-4" style={{ background: '#131929', borderColor: '#1E2538' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono font-bold" style={{ color: '#A0ABBE' }}>{item.date}</span>
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border"
                          style={{ color: item.color, background: `${item.color}1A`, borderColor: `${item.color}4D` }}>
                          {item.status}
                        </span>
                      </div>
                      <p className="text-sm" style={{ color: '#A0ABBE' }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Related Events */}
        <div className="mt-8">
          <h3 className="text-sm font-semibold mb-3" style={{ color: '#A0ABBE' }}>Other events affecting Tampa Westshore:</h3>
          <div className="space-y-2">
            {[
              { emoji: '🚆', name: 'BRT Phase 2', scope: 'Submarket', timing: 'T-4mo pending', impact: '+0.5pp projected', impactColor: '#10B981' },
              { emoji: '📜', name: 'FL Insurance Rate Cap', scope: 'State', timing: 'T+2mo', impact: '-4% expense', impactColor: '#10B981' },
              { emoji: '🏢', name: 'New Supply Wave', scope: 'Submarket', timing: 'T-6mo fired', impact: '-0.3pp', impactColor: '#EF4444' },
            ].map((ev) => (
              <div
                key={ev.name}
                className="rounded p-3 flex items-center justify-between cursor-pointer text-sm transition-colors border"
                style={{ background: '#131929', borderColor: '#1E2538' }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{ev.emoji}</span>
                  <span className="font-semibold" style={{ color: '#E2E8F0' }}>{ev.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded border" style={{ color: '#A0ABBE', borderColor: '#1E2538' }}>{ev.scope}</span>
                </div>
                <div className="flex items-center gap-4 font-mono text-xs">
                  <span style={{ color: '#A0ABBE' }}>{ev.timing}</span>
                  <span style={{ color: ev.impactColor }}>{ev.impact}</span>
                  <ArrowRight className="w-3.5 h-3.5" style={{ color: '#6B7A8D' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default M35EventDetailPage;
