import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronDown, Check, ArrowLeft, ArrowRight, Activity } from 'lucide-react';

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

        {/* GEOGRAPHY Tab — CascadeMap */}
        {activeTab === 'GEOGRAPHY' && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4" style={{ color: '#E2E8F0' }}>
              Geographic Impact Map <span className="font-normal text-sm" style={{ color: '#6B7A8D' }}>| Tampa MSA — Amazon HQ2 Cascade</span>
            </h2>
            <div className="flex gap-4">
              {/* SVG Map */}
              <div className="flex-1 rounded border relative overflow-hidden" style={{ background: '#0d1120', borderColor: '#1E2538', minHeight: 400 }}>
                <svg className="w-full h-full" viewBox="0 0 500 420" style={{ position: 'absolute', inset: 0 }}>
                  {/* Ocean/bay background */}
                  <rect width="500" height="420" fill="#0a0e1a" />
                  {/* Tampa Bay */}
                  <path d="M180,280 Q200,260 220,250 Q240,240 260,260 Q280,280 300,300 Q320,320 310,350 Q300,380 280,400 L220,400 Q200,380 180,360 Z" fill="#0d1928" stroke="#162235" strokeWidth="1" />
                  {/* Distance rings from HQ2 site */}
                  <circle cx="255" cy="195" r="60" fill="none" stroke="#0891B2" strokeWidth="0.5" strokeDasharray="3,3" opacity="0.4" />
                  <circle cx="255" cy="195" r="110" fill="none" stroke="#0891B2" strokeWidth="0.5" strokeDasharray="3,3" opacity="0.25" />
                  <circle cx="255" cy="195" r="160" fill="none" stroke="#0891B2" strokeWidth="0.5" strokeDasharray="3,3" opacity="0.15" />
                  {/* Westshore submarket — high impact */}
                  <path d="M210,160 L260,155 L280,180 L270,220 L230,225 L205,200 Z" fill="rgba(16,185,129,0.25)" stroke="#10B981" strokeWidth="1.5" />
                  <text x="235" y="195" textAnchor="middle" fontSize="9" fill="#10B981" fontFamily="monospace" fontWeight="700">WESTSHORE</text>
                  <text x="235" y="207" textAnchor="middle" fontSize="8" fill="#10B981" fontFamily="monospace">+3.2pp rent</text>
                  {/* Downtown Tampa submarket */}
                  <path d="M260,220 L300,215 L315,250 L295,270 L260,265 Z" fill="rgba(8,145,178,0.2)" stroke="#0891B2" strokeWidth="1" />
                  <text x="287" y="245" textAnchor="middle" fontSize="8" fill="#0891B2" fontFamily="monospace" fontWeight="700">DOWNTOWN</text>
                  <text x="287" y="256" textAnchor="middle" fontSize="8" fill="#0891B2" fontFamily="monospace">+1.8pp rent</text>
                  {/* Ybor City */}
                  <path d="M300,200 L340,195 L350,225 L330,240 L300,235 Z" fill="rgba(8,145,178,0.12)" stroke="#0891B2" strokeWidth="0.8" />
                  <text x="325" y="218" textAnchor="middle" fontSize="8" fill="#0891B2" fontFamily="monospace">YBOR</text>
                  <text x="325" y="229" textAnchor="middle" fontSize="8" fill="#0891B2" fontFamily="monospace">+1.2pp</text>
                  {/* South Tampa */}
                  <path d="M195,230 L235,225 L240,265 L215,280 L185,265 Z" fill="rgba(217,119,6,0.12)" stroke="#D97706" strokeWidth="0.8" />
                  <text x="213" y="255" textAnchor="middle" fontSize="8" fill="#D97706" fontFamily="monospace">S. TAMPA</text>
                  <text x="213" y="266" textAnchor="middle" fontSize="8" fill="#D97706" fontFamily="monospace">+0.7pp</text>
                  {/* Brandon submarket — low impact */}
                  <path d="M360,210 L400,205 L408,240 L380,255 L355,240 Z" fill="rgba(107,114,128,0.1)" stroke="#6B7280" strokeWidth="0.6" />
                  <text x="382" y="230" textAnchor="middle" fontSize="8" fill="#6B7280" fontFamily="monospace">BRANDON</text>
                  <text x="382" y="241" textAnchor="middle" fontSize="8" fill="#6B7280" fontFamily="monospace">+0.3pp</text>
                  {/* HQ2 epicenter */}
                  <circle cx="255" cy="195" r="6" fill="#10B981" />
                  <circle cx="255" cy="195" r="10" fill="none" stroke="#10B981" strokeWidth="1.5" opacity="0.6" />
                  <circle cx="255" cy="195" r="15" fill="none" stroke="#10B981" strokeWidth="1" opacity="0.3" />
                  <text x="255" y="175" textAnchor="middle" fontSize="9" fill="#E2E8F0" fontFamily="monospace" fontWeight="700">HQ2 SITE</text>
                  {/* Deal pins */}
                  <rect x="222" y="188" width="8" height="8" rx="1" fill="#0891B2" />
                  <text x="226" y="180" textAnchor="middle" fontSize="7" fill="#0891B2" fontFamily="monospace">3820 W</text>
                  <rect x="268" y="230" width="8" height="8" rx="1" fill="#D97706" />
                  <text x="272" y="248" textAnchor="middle" fontSize="7" fill="#D97706" fontFamily="monospace">1005 DT</text>
                  {/* Ring labels */}
                  <text x="310" y="140" fontSize="8" fill="#0891B2" fontFamily="monospace" opacity="0.6">1mi</text>
                  <text x="355" y="100" fontSize="8" fill="#0891B2" fontFamily="monospace" opacity="0.4">2mi</text>
                  <text x="400" y="65" fontSize="8" fill="#0891B2" fontFamily="monospace" opacity="0.25">3mi</text>
                  {/* Compass */}
                  <text x="460" y="30" fontSize="10" fill="#6B7A8D" fontFamily="monospace">N↑</text>
                </svg>
                {/* Legend */}
                <div className="absolute bottom-3 left-3 p-2 rounded border" style={{ background: 'rgba(11,14,26,0.9)', borderColor: '#1E2538' }}>
                  <div className="text-[9px] font-mono mb-1" style={{ color: '#6B7A8D' }}>IMPACT INTENSITY</div>
                  {[
                    { color: '#10B981', label: 'High (+2pp+ rent)' },
                    { color: '#0891B2', label: 'Medium (+1–2pp)' },
                    { color: '#D97706', label: 'Low (+0.5–1pp)' },
                    { color: '#6B7280', label: 'Minimal (<0.5pp)' },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5 mb-0.5">
                      <div className="w-2 h-2 rounded-sm" style={{ background: l.color }} />
                      <span className="text-[8px]" style={{ color: '#A0ABBE' }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right panel — impact hierarchy */}
              <div className="w-72 flex flex-col gap-3">
                <div className="rounded border p-3" style={{ background: '#131929', borderColor: '#1E2538' }}>
                  <div className="text-[10px] font-mono font-semibold uppercase tracking-widest mb-3" style={{ color: '#6B7A8D' }}>Submarket Impact Hierarchy</div>
                  {[
                    { name: 'Westshore', proximity: 0.74, rentDelta: '+3.2pp', absorb: '+4.8pp', score: 94 },
                    { name: 'Downtown Tampa', proximity: 0.61, rentDelta: '+1.8pp', absorb: '+2.9pp', score: 78 },
                    { name: 'Ybor City', proximity: 0.49, rentDelta: '+1.2pp', absorb: '+1.8pp', score: 62 },
                    { name: 'South Tampa', proximity: 0.38, rentDelta: '+0.7pp', absorb: '+1.1pp', score: 45 },
                    { name: 'Brandon', proximity: 0.21, rentDelta: '+0.3pp', absorb: '+0.5pp', score: 24 },
                  ].map((sm, i) => (
                    <div key={sm.name} className="border-b py-2 last:border-b-0" style={{ borderColor: '#1E2538' }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold" style={{ color: '#E2E8F0' }}>{sm.name}</span>
                        <span className="text-[10px] font-mono font-bold" style={{ color: sm.score >= 70 ? '#10B981' : sm.score >= 40 ? '#0891B2' : '#6B7280' }}>
                          {sm.score}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px]" style={{ color: '#A0ABBE' }}>
                        <span>Prox: <strong style={{ color: '#E2E8F0' }}>{sm.proximity}</strong></span>
                        <span>Rent Δ: <strong style={{ color: '#10B981' }}>{sm.rentDelta}</strong></span>
                        <span>Abs: <strong style={{ color: '#0891B2' }}>{sm.absorb}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded border p-3" style={{ background: '#131929', borderColor: '#1E2538' }}>
                  <div className="text-[10px] font-mono font-semibold uppercase tracking-widest mb-2" style={{ color: '#6B7A8D' }}>Your Deal Exposure</div>
                  {[
                    { address: '3820 W Kennedy', distance: '0.8mi', submarket: 'Westshore', impact: '+1.8pp IRR', color: '#10B981' },
                    { address: '1005 DT Meridian', distance: '1.4mi', submarket: 'Downtown', impact: '+0.9pp IRR', color: '#0891B2' },
                  ].map(d => (
                    <div key={d.address} className="mb-2 pb-2 border-b last:border-b-0 last:mb-0 last:pb-0" style={{ borderColor: '#1E2538' }}>
                      <div className="text-xs font-semibold mb-0.5" style={{ color: '#E2E8F0' }}>{d.address}</div>
                      <div className="text-[10px]" style={{ color: '#A0ABBE' }}>
                        {d.distance} · {d.submarket} · <span style={{ color: d.color }}>{d.impact}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MULTI-METRIC Tab — MultiMetricPanel */}
        {activeTab === 'MULTI-METRIC' && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-1" style={{ color: '#E2E8F0' }}>Multi-Metric Dashboard</h2>
            <p className="text-sm mb-6" style={{ color: '#6B7A8D' }}>All tracked metrics vs forecast — actual vs model with M35 event markers</p>
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

        {/* PLAYBOOK / TIMELINE — Coming Soon */}
        {(activeTab === 'PLAYBOOK' || activeTab === 'TIMELINE') && (
          <div className="flex items-center justify-center h-48 rounded border" style={{ borderColor: '#1E2538', color: '#6B7A8D' }}>
            <div className="text-center">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <div className="text-sm font-mono uppercase tracking-wider">{activeTab} — Coming Soon</div>
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
