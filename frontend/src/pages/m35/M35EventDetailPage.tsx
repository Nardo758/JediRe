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

        {/* Placeholder for other tabs */}
        {activeTab !== 'FORECAST' && (
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
