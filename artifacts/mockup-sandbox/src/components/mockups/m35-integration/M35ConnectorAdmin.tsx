import React, { useState } from 'react';
import { 
  Play, 
  Settings, 
  ArrowRight, 
  ChevronDown, 
  Check, 
  X, 
  Edit2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle
} from 'lucide-react';

const M35ConnectorAdmin = () => {
  const [activeTab, setActiveTab] = useState('connectors');

  const Magnitude = ({ value }: { value: number }) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <div 
            key={i} 
            className={`w-2 h-2 rounded-full ${i <= value ? 'bg-[#A0ABBE]' : 'border border-[#6B7A8D]'}`} 
          />
        ))}
      </div>
    );
  };

  const queueData = [
    { connector: 'atlanta-permits', date: 'Apr 14', name: 'NEW CONSTRUCTION — 400 W Peachtree', category: 'MAJOR_DEVELOPMENT', scope: 'SUBMARKET', mag: 3, conf: '75%' },
    { connector: 'atlanta-permits', date: 'Apr 14', name: 'MULTI-FAMILY — 670 Boulevard SE', category: 'MAJOR_DEVELOPMENT', scope: 'SUBMARKET', mag: 3, conf: '75%' },
    { connector: 'atlanta-rezoning', date: 'Apr 14', name: 'Rezoning Z-21-083 RG-2→MRC-2', category: 'REGULATORY_CHANGE', scope: 'SUBMARKET', mag: 2, conf: '80%' },
    { connector: 'atlanta-rezoning', date: 'Apr 13', name: 'SUP Mixed-Use 1380 Atlantic Dr', category: 'COMMERCIAL_DEV', scope: 'PROPERTY', mag: 2, conf: '65%' },
    { connector: 'atlanta-permits', date: 'Apr 12', name: 'MIXED USE — 787 Ralph McGill', category: 'MAJOR_DEVELOPMENT', scope: 'SUBMARKET', mag: 2, conf: '75%' },
    { connector: 'atlanta-permits', date: 'Apr 11', name: 'NEW CONSTRUCTION — 180 Ivan Allen', category: 'MAJOR_DEVELOPMENT', scope: 'SUBMARKET', mag: 4, conf: '75%' },
    { connector: 'atlanta-rezoning', date: 'Apr 10', name: 'Rezoning Z-21-091 MR-2→MRC-3', category: 'REGULATORY_CHANGE', scope: 'SUBMARKET', mag: 3, conf: '80%' },
    { connector: 'gdelt-backtest', date: '—', name: 'Pending — run backtest first', category: '—', scope: '—', mag: 0, conf: '—', pending: true },
  ];

  return (
    <div className="min-h-screen bg-[#0B0E1A] text-[#E2E8F0] p-6 font-mono text-[13px]">
      
      {/* PAGE HEADER */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="text-[#A0ABBE] text-xs mb-1">ADMIN / M35 / DATA CONNECTORS</div>
          <h1 className="text-2xl font-bold tracking-tight mb-1 text-white">M35 EVENT INGESTION — ATLANTA CONNECTORS</h1>
          <div className="text-[#6B7A8D]">3 active connectors | 847 draft events in queue | Last run: 4 min ago</div>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-[#A0ABBE] hover:text-white flex items-center gap-1 transition-colors">
            View Draft Queue <ArrowRight className="w-4 h-4" />
          </button>
          <button className="bg-[#0891B2] hover:bg-[#0891B2]/80 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition-colors">
            <Play className="w-4 h-4 fill-current" /> Run All Connectors
          </button>
        </div>
      </div>

      {/* CONNECTOR STATUS CARDS */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        
        {/* CARD 1 */}
        <div className="bg-[#131929] border border-[#1E2538] rounded-sm flex flex-col">
          <div className="p-4 border-b border-[#1E2538]">
            <div className="flex justify-between items-start mb-2">
              <h2 className="font-bold text-[#E2E8F0] text-sm">Atlanta Building Permits (Socrata)</h2>
              <div className="flex items-center gap-1.5 text-xs text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded">
                <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></div> ACTIVE
              </div>
            </div>
            <div className="text-xs text-[#A0ABBE]">Source: data.atlantaga.gov | dataset: Building Permits</div>
          </div>
          
          <div className="p-4 flex-1 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-y-2 text-xs">
              <div className="text-[#6B7A8D]">Schedule:</div>
              <div className="text-[#E2E8F0]">Nightly 2:00 AM ET</div>
              <div className="text-[#6B7A8D]">Last run:</div>
              <div className="text-[#E2E8F0]">4 min ago | Duration: 2.1s</div>
            </div>
            
            <div className="bg-[#0B0E1A] p-2 rounded border border-[#1E2538] text-xs">
              <span className="text-[#0891B2] font-bold">1,284</span> scanned | <span className="text-[#10B981] font-bold">47</span> draft events created | 12 duplicates | 0 errors
            </div>
            
            <div className="text-xs">
              <span className="text-[#6B7A8D]">Threshold config:</span> <span className="text-[#E2E8F0]">Min value: $5M | Min units: 50 | Permit types: NEW CONSTRUCTION, MULTI-FAMILY, MIXED USE</span>
            </div>

            <div className="flex gap-2 mt-2">
              <button className="flex-1 bg-[#1E2538] hover:bg-[#1E2538]/80 text-[#E2E8F0] py-1.5 rounded flex items-center justify-center gap-1.5 text-xs transition-colors">
                <Play className="w-3 h-3 fill-current" /> Run Now
              </button>
              <button className="bg-[#1E2538] hover:bg-[#1E2538]/80 text-[#E2E8F0] px-3 py-1.5 rounded flex items-center justify-center transition-colors">
                <Settings className="w-3 h-3" />
              </button>
              <button className="bg-[#1E2538] hover:bg-[#1E2538]/80 text-[#E2E8F0] px-3 py-1.5 rounded flex items-center justify-center gap-1 text-xs transition-colors">
                Logs <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="mt-2">
              <div className="text-[#6B7A8D] text-xs mb-2 uppercase tracking-wider">Recent Events Found</div>
              <div className="flex flex-col gap-1.5">
                <div className="bg-[#0B0E1A] border border-[#1E2538] px-2 py-1 rounded text-[11px] text-[#A0ABBE] truncate">
                  NEW CONSTRUCTION — 400 W Peachtree St | $28M | Mag 3
                </div>
                <div className="bg-[#0B0E1A] border border-[#1E2538] px-2 py-1 rounded text-[11px] text-[#A0ABBE] truncate">
                  MULTI-FAMILY — 670 Boulevard SE | 120 units | $18M | Mag 3
                </div>
                <div className="bg-[#0B0E1A] border border-[#1E2538] px-2 py-1 rounded text-[11px] text-[#A0ABBE] truncate">
                  MIXED USE — 787 Ralph McGill | $12M | Mag 2
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2 */}
        <div className="bg-[#131929] border border-[#1E2538] rounded-sm flex flex-col">
          <div className="p-4 border-b border-[#1E2538]">
            <div className="flex justify-between items-start mb-2">
              <h2 className="font-bold text-[#E2E8F0] text-sm">Atlanta DPCD Rezoning + SUPs</h2>
              <div className="flex items-center gap-1.5 text-xs text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded">
                <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></div> ACTIVE
              </div>
            </div>
            <div className="text-xs text-[#A0ABBE]">Source: gis.atlantaga.gov | layers: Rezoning (10), SUP (11)</div>
          </div>
          
          <div className="p-4 flex-1 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-y-2 text-xs">
              <div className="text-[#6B7A8D]">Schedule:</div>
              <div className="text-[#E2E8F0]">Nightly 2:05 AM ET</div>
              <div className="text-[#6B7A8D]">Last run:</div>
              <div className="text-[#E2E8F0]">4 min ago | Duration: 3.8s</div>
            </div>
            
            <div className="bg-[#0B0E1A] p-2 rounded border border-[#1E2538] text-xs">
              <span className="text-[#0891B2] font-bold">302</span> scanned | <span className="text-[#10B981] font-bold">11</span> draft events created | 3 duplicates | 0 errors
            </div>
            
            <div className="text-xs">
              <span className="text-[#6B7A8D]">Threshold config:</span> <span className="text-[#E2E8F0]">Min acres: 1.0 | SUP types: HOTEL, RESIDENTIAL, MIXED, SENIOR, COMMERCIAL</span>
            </div>

            <div className="flex gap-2 mt-2">
              <button className="flex-1 bg-[#1E2538] hover:bg-[#1E2538]/80 text-[#E2E8F0] py-1.5 rounded flex items-center justify-center gap-1.5 text-xs transition-colors">
                <Play className="w-3 h-3 fill-current" /> Run Now
              </button>
              <button className="bg-[#1E2538] hover:bg-[#1E2538]/80 text-[#E2E8F0] px-3 py-1.5 rounded flex items-center justify-center transition-colors">
                <Settings className="w-3 h-3" />
              </button>
              <button className="bg-[#1E2538] hover:bg-[#1E2538]/80 text-[#E2E8F0] px-3 py-1.5 rounded flex items-center justify-center gap-1 text-xs transition-colors">
                Logs <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="mt-2">
              <div className="text-[#6B7A8D] text-xs mb-2 uppercase tracking-wider">Recent Events Found</div>
              <div className="flex flex-col gap-1.5">
                <div className="bg-[#0B0E1A] border border-[#1E2538] px-2 py-1 rounded text-[11px] text-[#A0ABBE] truncate">
                  Rezoning Z-21-083 — RG-2 → MRC-2 | 4.2 acres | Mag 2
                </div>
                <div className="bg-[#0B0E1A] border border-[#1E2538] px-2 py-1 rounded text-[11px] text-[#A0ABBE] truncate">
                  SUP — Mixed-Use at 1380 Atlantic Dr NW | Mag 2
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3 */}
        <div className="bg-[#131929] border border-[#1E2538] rounded-sm flex flex-col">
          <div className="p-4 border-b border-[#1E2538]">
            <div className="flex justify-between items-start mb-2">
              <h2 className="font-bold text-[#E2E8F0] text-sm">GDELT GKG Historical Backtest</h2>
              <div className="flex items-center gap-1.5 text-xs text-[#A0ABBE] bg-[#1E2538] px-2 py-0.5 rounded">
                <div className="w-1.5 h-1.5 rounded-full bg-[#A0ABBE]"></div> READY
              </div>
            </div>
            <div className="text-xs text-[#A0ABBE]">Source: gdeltproject.org | Mode: Manual / Backtest</div>
          </div>
          
          <div className="p-4 flex-1 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-y-2 text-xs">
              <div className="text-[#6B7A8D]">Schedule:</div>
              <div className="text-[#E2E8F0]">Manual only</div>
              <div className="text-[#6B7A8D]">Last run:</div>
              <div className="text-[#E2E8F0]">Never</div>
            </div>
            
            <div className="bg-[#0B0E1A] p-2 rounded border border-[#1E2538] text-xs text-[#6B7A8D]">
              0 scanned | 0 draft events | — | —
            </div>
            
            <div className="text-xs flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[#6B7A8D] w-24">Date range:</span>
                <input type="text" value="2013-01-01" readOnly className="bg-[#0B0E1A] border border-[#1E2538] text-[#E2E8F0] px-2 py-1 rounded w-24 text-center text-xs" />
                <span className="text-[#6B7A8D]">→</span>
                <input type="text" value="2024-12-31" readOnly className="bg-[#0B0E1A] border border-[#1E2538] text-[#E2E8F0] px-2 py-1 rounded w-24 text-center text-xs" />
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#6B7A8D] w-24 pt-1">Keywords:</span>
                <textarea 
                  readOnly 
                  className="bg-[#0B0E1A] border border-[#1E2538] text-[#E2E8F0] p-1.5 rounded flex-1 text-[10px] resize-none h-14"
                  value="Atlanta headquarters relocation / Atlanta BeltLine transit MARTA / Atlanta groundbreaking development / Atlanta rezoning ordinance / Atlanta natural disaster tornado"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#6B7A8D] w-24">Conf. thresh:</span>
                <span className="text-[#E2E8F0]">0.50 (low — all articles flagged)</span>
              </div>
            </div>

            <div className="flex gap-2 mt-2">
              <button className="flex-[2] bg-[#D97706] hover:bg-[#D97706]/80 text-white py-1.5 rounded flex items-center justify-center gap-1.5 text-xs font-bold transition-colors">
                <Play className="w-3 h-3 fill-current" /> Run Backtest — 2013-2024
              </button>
              <button className="flex-1 bg-[#1E2538] hover:bg-[#1E2538]/80 text-[#E2E8F0] py-1.5 rounded flex items-center justify-center text-[10px] transition-colors">
                Preview Query
              </button>
              <button className="flex-1 bg-[#1E2538] hover:bg-[#1E2538]/80 text-[#E2E8F0] py-1.5 rounded flex items-center justify-center text-[10px] transition-colors">
                Est. Volume
              </button>
            </div>

            <div className="mt-1 flex items-start gap-1.5 text-[#D97706] text-[10px] bg-[#D97706]/10 p-1.5 rounded border border-[#D97706]/20">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
              <span>⚠ GDELT backtest may generate 2,000–5,000 draft events. Each requires analyst review before promotion to a live M35 event.</span>
            </div>
          </div>
        </div>

      </div>

      {/* DRAFT EVENT QUEUE */}
      <div className="bg-[#131929] border border-[#1E2538] rounded-sm mb-6">
        <div className="flex justify-between items-center p-3 border-b border-[#1E2538]">
          <h3 className="text-[#0891B2] text-[11px] font-bold tracking-widest">DRAFT EVENT QUEUE — PENDING ANALYST REVIEW</h3>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-[#E2E8F0]"><span className="font-bold">847</span> total | <span className="font-bold">23</span> today</span>
            <div className="flex gap-2">
              <button className="bg-[#0B0E1A] border border-[#1E2538] text-[#A0ABBE] px-2 py-1 rounded flex items-center gap-1 hover:text-white transition-colors">
                Filter by connector <ChevronDown className="w-3 h-3" />
              </button>
              <button className="bg-[#0B0E1A] border border-[#1E2538] text-[#A0ABBE] px-2 py-1 rounded flex items-center gap-1 hover:text-white transition-colors">
                Filter by category <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
        
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#1E2538] text-[#6B7A8D] text-xs">
              <th className="py-2 pl-4 pr-2 font-normal">CONNECTOR</th>
              <th className="py-2 px-2 font-normal">DATE</th>
              <th className="py-2 px-2 font-normal">NAME</th>
              <th className="py-2 px-2 font-normal">CATEGORY</th>
              <th className="py-2 px-2 font-normal">SCOPE</th>
              <th className="py-2 px-2 font-normal">MAG</th>
              <th className="py-2 px-2 font-normal">CONF</th>
              <th className="py-2 pl-2 pr-4 font-normal text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="text-xs">
            {queueData.map((row, i) => (
              <tr key={i} className={`border-b border-[#1E2538]/50 ${i % 2 === 0 ? 'bg-[#131929]' : 'bg-[#1E2538]/20'} hover:bg-[#1E2538]/50 transition-colors`}>
                <td className={`py-2 pl-4 pr-2 ${row.pending ? 'text-[#6B7A8D]' : 'text-[#A0ABBE]'}`}>{row.connector}</td>
                <td className={`py-2 px-2 ${row.pending ? 'text-[#6B7A8D]' : 'text-[#E2E8F0]'}`}>{row.date}</td>
                <td className={`py-2 px-2 ${row.pending ? 'text-[#6B7A8D]' : 'text-[#E2E8F0] font-medium'}`}>{row.name}</td>
                <td className={`py-2 px-2 ${row.pending ? 'text-[#6B7A8D]' : 'text-[#A0ABBE]'}`}>{row.category}</td>
                <td className={`py-2 px-2 ${row.pending ? 'text-[#6B7A8D]' : 'text-[#A0ABBE]'}`}>{row.scope}</td>
                <td className="py-2 px-2">
                  {!row.pending ? <Magnitude value={row.mag} /> : <span className="text-[#6B7A8D]">—</span>}
                </td>
                <td className={`py-2 px-2 ${row.pending ? 'text-[#6B7A8D]' : 'text-[#E2E8F0]'}`}>{row.conf}</td>
                <td className="py-2 pl-2 pr-4 text-right">
                  {!row.pending ? (
                    <div className="flex items-center justify-end gap-1.5">
                      <button className="flex items-center gap-1 text-[#10B981] hover:bg-[#10B981]/10 px-2 py-1 rounded transition-colors border border-transparent hover:border-[#10B981]/30">
                        Promote <Check className="w-3 h-3" />
                      </button>
                      <button className="flex items-center gap-1 text-[#EF4444] hover:bg-[#EF4444]/10 px-2 py-1 rounded transition-colors border border-transparent hover:border-[#EF4444]/30">
                        Reject <X className="w-3 h-3" />
                      </button>
                      <button className="flex items-center gap-1 text-[#A0ABBE] hover:bg-[#1E2538] px-2 py-1 rounded transition-colors border border-transparent hover:border-[#1E2538]">
                        Edit <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[#6B7A8D] px-4">[—]</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="p-3 border-t border-[#1E2538] flex justify-between items-center text-xs text-[#A0ABBE]">
          <div>Showing 8 of 847</div>
          <div className="flex items-center gap-1">
            <button className="px-2 py-1 hover:text-white flex items-center gap-1"><ChevronLeft className="w-3 h-3" /> Prev</button>
            <button className="bg-[#1E2538] text-white w-6 h-6 rounded flex items-center justify-center">1</button>
            <button className="hover:bg-[#1E2538]/50 w-6 h-6 rounded flex items-center justify-center">2</button>
            <span className="px-1">...</span>
            <button className="hover:bg-[#1E2538]/50 w-8 h-6 rounded flex items-center justify-center">106</button>
            <button className="px-2 py-1 hover:text-white flex items-center gap-1">Next <ChevronRight className="w-3 h-3" /></button>
          </div>
        </div>
      </div>

      {/* BOTTOM ROW: TWO PANELS */}
      <div className="grid grid-cols-2 gap-6">
        
        {/* LEFT — CONNECTOR HEALTH */}
        <div className="bg-[#131929] border border-[#1E2538] rounded-sm flex flex-col">
          <div className="p-3 border-b border-[#1E2538]">
            <h3 className="font-bold text-[#E2E8F0] text-xs">CONNECTOR HEALTH</h3>
          </div>
          <div className="p-4 bg-[#0B0E1A] font-mono text-[11px] leading-relaxed text-[#A0ABBE] flex-1 overflow-y-auto">
            <div><span className="text-[#6B7A8D]">[02:04:01]</span> atlanta-permits: started</div>
            <div><span className="text-[#6B7A8D]">[02:04:02]</span> atlanta-permits: fetched 1284 permits from Socrata</div>
            <div><span className="text-[#6B7A8D]">[02:04:03]</span> atlanta-permits: <span className="text-[#10B981]">47 created</span>, 12 duplicates — done in 2.1s</div>
            <div><span className="text-[#6B7A8D]">[02:04:05]</span> atlanta-rezoning: started</div>
            <div><span className="text-[#6B7A8D]">[02:04:07]</span> atlanta-rezoning: 302 features from ArcGIS layers 10+11</div>
            <div><span className="text-[#6B7A8D]">[02:04:09]</span> atlanta-rezoning: <span className="text-[#10B981]">11 created</span>, 3 duplicates — done in 3.8s</div>
            <div className="text-[#0891B2] mt-2"><span className="text-[#6B7A8D]">[02:04:09]</span> all connectors: complete — 58 new draft events in queue</div>
            <div className="text-[#0B0E1A] select-none">_</div> {/* Spacing */}
          </div>
        </div>

        {/* RIGHT — BACKTEST READINESS */}
        <div className="bg-[#131929] border border-[#1E2538] rounded-sm flex flex-col">
          <div className="p-3 border-b border-[#1E2538] flex justify-between items-center">
            <h3 className="font-bold text-[#E2E8F0] text-xs">BACKTEST READINESS</h3>
            <span className="text-xs text-[#A0ABBE]">Atlanta MSA backtest est. complete: <span className="text-[#E2E8F0]">May 12, 2026</span></span>
          </div>
          <div className="p-4 flex-1 flex flex-col justify-between">
            <div className="flex flex-col gap-2.5 text-xs">
              <div className="flex items-center gap-2 text-[#E2E8F0]">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" /> Connector code deployed (atlanta-permits, atlanta-rezoning, gdelt-backtest)
              </div>
              <div className="flex items-center gap-2 text-[#E2E8F0]">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" /> m35_draft_events staging table created
              </div>
              <div className="flex items-center gap-2 text-[#E2E8F0]">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" /> Duplicate detection active (source_connector + source_record_id uniqueness)
              </div>
              <div className="flex items-center gap-2 text-[#6B7A8D]">
                <Circle className="w-4 h-4" /> GDELT backtest run (0 / ~3,000 estimated events)
              </div>
              <div className="flex items-center gap-2 text-[#6B7A8D]">
                <Circle className="w-4 h-4" /> CoStar MSA data loaded into metric tables
              </div>
              <div className="flex items-center gap-2 text-[#6B7A8D]">
                <Circle className="w-4 h-4" /> Control group assignment complete
              </div>
              <div className="flex items-center gap-2 text-[#6B7A8D]">
                <Circle className="w-4 h-4" /> First DiD OLS run
              </div>
              <div className="flex items-center gap-2 text-[#6B7A8D]">
                <Circle className="w-4 h-4" /> Results vs pre-registered hypotheses validated
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-[#1E2538]">
              <div className="flex justify-between items-center text-xs mb-2">
                <span className="text-[#A0ABBE]">Progress</span>
                <span className="text-[#E2E8F0] font-bold">2 of 8 steps complete (25%)</span>
              </div>
              <div className="h-1.5 bg-[#0B0E1A] rounded-full overflow-hidden">
                <div className="h-full bg-[#10B981] w-[25%] rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

export default M35ConnectorAdmin;
