import { useState, useCallback } from "react";

const OWNED_ASSETS = [
  { id: "p1", name: "Parkway at 290", type: "Garden 3-Story", units: 290, built: 2020, city: "Frisco, TX", monthsData: 18, lastUpload: "2026-01-15", status: "complete" },
  { id: "p2", name: "Cedar Hills", type: "Garden 2-Story", units: 180, built: 2019, city: "McKinney, TX", monthsData: 12, lastUpload: "2026-01-15", status: "complete" },
  { id: "p3", name: "Summit Ridge", type: "Mid-Rise 4-Story", units: 220, built: 2022, city: "Plano, TX", monthsData: 6, lastUpload: "2025-12-01", status: "partial" },
  { id: "p4", name: "Magnolia Station", type: "Garden 3-Story", units: 310, built: 2021, city: "Allen, TX", monthsData: 3, lastUpload: "2025-11-01", status: "partial" },
  { id: "p5", name: "Westpark Lofts", type: "Mid-Rise 5-Story", units: 150, built: 2023, city: "Frisco, TX", monthsData: 0, lastUpload: null, status: "empty" },
];

const UPLOAD_TEMPLATES = [
  { id: "monthly_pnl", name: "Monthly P&L", description: "Revenue, expenses, NOI by month", format: "xlsx/csv" },
  { id: "rent_roll", name: "Rent Roll", description: "Unit-level rents, lease dates, status", format: "xlsx/csv" },
  { id: "traffic_leasing", name: "Traffic & Leasing", description: "Walk-ins, tours, web leads, leases signed", format: "xlsx/csv" },
  { id: "construction", name: "Construction Budget", description: "Hard costs, soft costs, draw schedule", format: "xlsx/csv" },
  { id: "t12", name: "Trailing 12 Summary", description: "Annualized P&L with per-unit metrics", format: "xlsx/csv" },
];

const SAVED_TEMPLATES = [
  { id: "t1", name: "Garden Value-Add — DFW 2024", strategy: "Rental", productType: "Garden 1-3 Stories", createdFrom: "Parkway at 290", createdDate: "2025-08-15", assumptions: 42, lastUsed: "2026-01-20", timesUsed: 3 },
  { id: "t2", name: "Mid-Rise Stabilized — Plano", strategy: "Rental", productType: "Mid-Rise 4-5 Stories", createdFrom: "Summit Ridge", createdDate: "2025-11-01", assumptions: 38, lastUsed: "2025-12-10", timesUsed: 1 },
];

const AUTO_COMPS = [
  { id: "c1", source: "Parkway at 290", type: "Garden 3-Story", distance: "—", compScore: 100, opexPU: "$4,980", noiPU: "$8,420", occupancy: "94.2%", rentPSF: "$1.92", dataMonths: 18, status: "Your Asset" },
  { id: "c2", source: "Cedar Hills", type: "Garden 2-Story", distance: "4.8mi", compScore: 74, opexPU: "$5,340", noiPU: "$7,890", occupancy: "92.1%", rentPSF: "$1.78", dataMonths: 12, status: "Your Asset" },
  { id: "c3", source: "Magnolia Station", type: "Garden 3-Story", distance: "6.2mi", compScore: 68, opexPU: "$5,180", noiPU: "$8,100", occupancy: "93.5%", rentPSF: "$1.85", dataMonths: 3, status: "Your Asset" },
  { id: "c4", source: "Submarket Avg (anon)", type: "Garden 1-3 Story", distance: "< 5mi", compScore: 55, opexPU: "$5,280", noiPU: "$7,650", occupancy: "92.8%", rentPSF: "$1.80", dataMonths: null, status: "47 Properties" },
  { id: "c5", source: "MSA Avg (anon)", type: "All Garden", distance: "< 15mi", compScore: 35, opexPU: "$5,420", noiPU: "$7,400", occupancy: "91.9%", rentPSF: "$1.74", dataMonths: null, status: "312 Properties" },
];

const TABS = [
  { id: "upload", label: "Upload Data", icon: "↑" },
  { id: "assets", label: "My Data Assets", icon: "◈" },
  { id: "comps", label: "Comp Library", icon: "⬡" },
  { id: "templates", label: "Templates", icon: "◇" },
  { id: "models", label: "Model Training", icon: "◆" },
];

const MAPPING_ROWS = [
  { fileCol: "Month", jediField: "period", sample: "2025-01, 2025-02, 2025-03...", matched: true },
  { fileCol: "Gross Potential Rent", jediField: "gross_potential_rent", sample: "$421,500, $421,500, $423,200...", matched: true },
  { fileCol: "Vacancy", jediField: "vacancy_loss", sample: "$24,300, $22,100, $19,800...", matched: true },
  { fileCol: "Concessions", jediField: "concessions", sample: "$8,400, $6,200, $4,100...", matched: true },
  { fileCol: "Other Rev", jediField: "other_income", sample: "$12,800, $13,100, $12,900...", matched: true },
  { fileCol: "RE Taxes", jediField: "taxes", sample: "$34,200, $34,200, $34,200...", matched: true },
  { fileCol: "Property Insurance", jediField: "insurance", sample: "$16,400, $16,400, $16,400...", matched: true },
  { fileCol: "Electric/Gas/Water", jediField: "utilities", sample: "$18,900, $21,200, $19,400...", matched: true },
  { fileCol: "Maint & Repairs", jediField: "repairs_maintenance", sample: "$21,500, $19,800, $24,100...", matched: true },
  { fileCol: "Mgmt Fee", jediField: "management_fee", sample: "$12,800, $13,100, $12,900...", matched: true },
  { fileCol: "Occupancy %", jediField: "occupancy_rate", sample: "92.1%, 93.5%, 94.8%...", matched: true },
  { fileCol: "Avg Rent", jediField: "avg_rent_achieved", sample: "$1,745, $1,762, $1,785...", matched: true },
  { fileCol: "Walk-ins", jediField: "walk_in_count", sample: "42, 38, 51...", matched: true },
  { fileCol: "Leases Signed", jediField: "leases_signed", sample: "7, 6, 9...", matched: true },
];

const PREVIEW_ROWS = [
  ["Jul 2024", "$421.5K", "$24.3K", "$401.6K", "$34.2K", "$16.4K", "$21.5K", "$12.8K", "$120.1K", "$281.5K", "92.1%", "$1,745", "42", "7"],
  ["Aug 2024", "$421.5K", "$22.1K", "$405.6K", "$34.2K", "$16.4K", "$19.8K", "$13.1K", "$118.2K", "$287.4K", "93.5%", "$1,762", "38", "6"],
  ["Sep 2024", "$423.2K", "$19.8K", "$409.5K", "$34.2K", "$16.4K", "$24.1K", "$12.9K", "$122.8K", "$286.7K", "94.8%", "$1,785", "51", "9"],
  ["Oct 2024", "$423.2K", "$18.2K", "$412.1K", "$34.2K", "$16.4K", "$18.9K", "$13.2K", "$116.4K", "$295.7K", "95.1%", "$1,788", "44", "8"],
  ["Nov 2024", "$425.0K", "$17.8K", "$414.0K", "$34.2K", "$16.4K", "$22.3K", "$13.0K", "$119.6K", "$294.4K", "95.4%", "$1,792", "35", "5"],
  ["Dec 2024", "$425.0K", "$19.1K", "$411.8K", "$34.2K", "$16.4K", "$26.8K", "$12.8K", "$124.9K", "$286.9K", "94.8%", "$1,790", "28", "4"],
];

const PREVIEW_HEADERS = ["Period", "GPR", "Vacancy", "EGI", "Taxes", "Insurance", "R&M", "Mgmt", "Total OpEx", "NOI", "Occ%", "Avg Rent", "Walk-ins", "Leases"];

const MODEL_CARDS = [
  { model: "Traffic-to-Lease", icon: "◆", accuracy: "±5.1%", trend: "improving", yourContrib: "54 months", properties: 3, status: "Training", color: "purple" },
  { model: "Expense Benchmark", icon: "◉", accuracy: "±8.3%", trend: "stable", yourContrib: "39 months", properties: 3, status: "Active", color: "blue" },
  { model: "Rent Achievement", icon: "⬡", accuracy: "±4.7%", trend: "improving", yourContrib: "36 months", properties: 3, status: "Active", color: "emerald" },
];

const VALIDATION_ROWS = [
  { property: "Parkway 290", metric: "Leases/week", predicted: "8.2", actual: "7.8", error: "+5.1%", verdict: "close" },
  { property: "Parkway 290", metric: "OpEx/unit", predicted: "$5,100", actual: "$4,980", error: "+2.4%", verdict: "close" },
  { property: "Cedar Hills", metric: "Leases/week", predicted: "5.4", actual: "4.9", error: "+10.2%", verdict: "off" },
  { property: "Cedar Hills", metric: "Occupancy", predicted: "93.5%", actual: "92.1%", error: "+1.5%", verdict: "close" },
  { property: "Summit Ridge", metric: "Leases/week", predicted: "6.8", actual: "—", error: "—", verdict: "pending" },
];

const MODEL_COLOR: Record<string, { border: string; bg: string; text: string; bar: string }> = {
  purple: { border: "border-purple-300", bg: "bg-purple-50", text: "text-purple-700", bar: "bg-purple-500" },
  blue: { border: "border-blue-300", bg: "bg-blue-50", text: "text-blue-700", bar: "bg-blue-500" },
  emerald: { border: "border-emerald-300", bg: "bg-emerald-50", text: "text-emerald-700", bar: "bg-emerald-500" },
};

export function ModuleLibrariesPage() {
  const [activeTab, setActiveTab] = useState("upload");
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState("monthly_pnl");
  const [uploadStep, setUploadStep] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setDragOver(false), []);
  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(false); setUploadStep(1); }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b-2 border-amber-500 px-6 py-3.5 shrink-0">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-[9px] font-mono text-amber-600 tracking-[4px]">SETTINGS → MODULE LIBRARIES</div>
            <h1 className="text-xl font-bold text-gray-900 mt-0.5">Your Intelligence Hub</h1>
          </div>
          <div className="flex gap-3 items-center">
            <div className="text-right mr-3">
              <div className="text-[11px] text-gray-500">{OWNED_ASSETS.length} assets · {OWNED_ASSETS.reduce((a, p) => a + p.monthsData, 0)} months of data</div>
              <div className="text-[10px] text-gray-400">{AUTO_COMPS.filter(c => c.status === "Your Asset").length} active comps · {SAVED_TEMPLATES.length} saved templates</div>
            </div>
            <button className="px-4 py-2 rounded-lg bg-amber-600 text-white text-[13px] font-semibold hover:bg-amber-700 transition-colors">
              ↑ Upload Data
            </button>
          </div>
        </div>

        <div className="flex gap-0.5 mt-3">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id === "upload") setUploadStep(0); }}
              className={`px-4 py-2 rounded-t-lg text-[13px] transition-colors border-b-2 ${activeTab === tab.id ? 'bg-gray-100 text-gray-900 font-semibold border-amber-500' : 'bg-transparent text-gray-500 border-transparent hover:text-gray-700'}`}>
              <span className="mr-1.5 text-sm">{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">

        {activeTab === "upload" && (
          <div>
            {uploadStep === 0 && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] font-mono text-amber-600 tracking-[2px] mb-2">① SELECT PROPERTY</div>
                  <div className="flex flex-col gap-1.5">
                    {OWNED_ASSETS.map(a => (
                      <button key={a.id} onClick={() => setSelectedAsset(a.id)}
                        className={`text-left p-3 rounded-lg border transition-colors ${selectedAsset === a.id ? 'border-amber-500 border-2 bg-amber-50/50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{a.name}</div>
                            <div className="text-[11px] text-gray-500 mt-0.5">{a.type} · {a.units} units · {a.city}</div>
                          </div>
                          <div className="text-right">
                            <div className={`text-xs font-mono ${a.monthsData > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                              {a.monthsData > 0 ? `${a.monthsData}mo data` : "No data"}
                            </div>
                            {a.lastUpload && <div className="text-[10px] text-gray-400">Last: {a.lastUpload}</div>}
                          </div>
                        </div>
                        {a.status === "empty" && (
                          <div className="mt-1.5 px-2 py-1 rounded bg-amber-50 border border-amber-200 text-[10px] text-amber-700">
                            No data uploaded — this asset isn't generating comps yet
                          </div>
                        )}
                      </button>
                    ))}
                    <button className="text-center p-3 rounded-lg border border-dashed border-gray-300 text-gray-500 text-[13px] hover:border-gray-400 transition-colors">
                      + Add New Property
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-mono text-amber-600 tracking-[2px] mb-2">② SELECT DATA TYPE</div>
                  <div className="flex flex-col gap-1.5 mb-4">
                    {UPLOAD_TEMPLATES.map(t => (
                      <button key={t.id} onClick={() => setSelectedTemplate(t.id)}
                        className={`text-left px-3.5 py-2.5 rounded-lg border transition-colors ${selectedTemplate === t.id ? 'border-amber-500 border-2 bg-amber-50/50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-[13px] font-medium text-gray-900">{t.name}</span>
                            <span className="text-[11px] text-gray-400 ml-2">{t.description}</span>
                          </div>
                          <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{t.format}</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="text-[10px] font-mono text-amber-600 tracking-[2px] mb-2">③ DROP YOUR FILE</div>
                  <div onDragOver={handleDrag} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => setUploadStep(1)}
                    className={`border-2 border-dashed rounded-xl py-10 px-5 text-center cursor-pointer transition-colors ${dragOver ? 'border-amber-500 bg-amber-50/30' : 'border-gray-300 hover:border-amber-400'}`}>
                    <div className={`text-4xl mb-2 ${dragOver ? 'text-amber-600' : 'text-gray-400'}`}>↑</div>
                    <div className="text-[15px] font-semibold text-gray-900 mb-1">
                      Drag & drop your {UPLOAD_TEMPLATES.find(t => t.id === selectedTemplate)?.name} file
                    </div>
                    <div className="text-xs text-gray-500 mb-3">Excel (.xlsx) or CSV — or click to browse</div>
                    <button className="px-4 py-1.5 rounded-md bg-gray-100 border border-gray-200 text-gray-500 text-xs hover:bg-gray-200 transition-colors">
                      Download Template →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {uploadStep === 1 && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <div className="text-[10px] font-mono text-amber-600 tracking-[2px] mb-0.5">STEP 2 OF 3</div>
                    <h2 className="text-lg font-bold text-gray-900">Map Your Columns</h2>
                    <p className="text-xs text-gray-500 mt-0.5">We detected 14 columns in your file. Match them to JEDI fields below.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setUploadStep(0)} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-500 text-[13px] hover:bg-gray-50">← Back</button>
                    <button onClick={() => setUploadStep(2)} className="px-4 py-2 rounded-lg bg-amber-600 text-white text-[13px] font-semibold hover:bg-amber-700">Preview Data →</button>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-[200px_40px_200px_1fr] px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-[10px] font-mono text-gray-400 tracking-[1px]">
                    <span>YOUR FILE COLUMN</span><span></span><span>JEDI FIELD</span><span>SAMPLE VALUES</span>
                  </div>
                  {MAPPING_ROWS.map((row, i) => (
                    <div key={i} className={`grid grid-cols-[200px_40px_200px_1fr] px-4 py-2.5 items-center border-b border-gray-100 last:border-0 ${i % 2 === 1 ? 'bg-gray-50/50' : ''} hover:bg-gray-50 transition-colors`}>
                      <span className="text-[13px] text-gray-900 font-medium">{row.fileCol}</span>
                      <span className={`text-base ${row.matched ? 'text-emerald-500' : 'text-red-500'}`}>{row.matched ? "→" : "?"}</span>
                      <select className={`bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5 text-xs font-mono ${row.matched ? 'text-emerald-600' : 'text-red-500'}`}>
                        <option>{row.jediField}</option>
                      </select>
                      <span className="text-[11px] text-gray-400 font-mono">{row.sample}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <span className="text-xs text-emerald-700 font-semibold">✓ 14 of 14 columns auto-matched</span>
                  <span className="text-[11px] text-gray-500 ml-3">Review and adjust if any mappings look wrong, then click Preview Data</span>
                </div>
              </div>
            )}

            {uploadStep === 2 && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <div className="text-[10px] font-mono text-amber-600 tracking-[2px] mb-0.5">STEP 3 OF 3</div>
                    <h2 className="text-lg font-bold text-gray-900">Review & Confirm</h2>
                    <p className="text-xs text-gray-500 mt-0.5">18 months of P&L data for Parkway at 290 — ready to import</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setUploadStep(1)} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-500 text-[13px] hover:bg-gray-50">← Back</button>
                    <button onClick={() => setUploadStep(3)} className="px-5 py-2 rounded-lg bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600">✓ Import 18 Months</button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { icon: "⬡", title: "Creates 1 New Comp", desc: "Parkway 290 becomes searchable in Comp Library. Any garden 3-story deal within 10mi can use your actual expenses.", color: "amber" },
                    { icon: "◆", title: "Trains Traffic Model", desc: "14 months of walk-in + lease data improves predictions for all garden-style in Frisco. Accuracy: LOW → MEDIUM.", color: "purple" },
                    { icon: "◉", title: "Updates Benchmarks", desc: "Your OpEx joins the anonymized benchmark pool. 47 properties in submarket → 48. Your data is never shown raw.", color: "blue" },
                  ].map((item, i) => (
                    <div key={i} className={`bg-white border rounded-xl p-4 border-t-2 ${item.color === 'amber' ? 'border-t-amber-400 border-amber-200' : item.color === 'purple' ? 'border-t-purple-400 border-purple-200' : 'border-t-blue-400 border-blue-200'}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-lg ${item.color === 'amber' ? 'text-amber-600' : item.color === 'purple' ? 'text-purple-600' : 'text-blue-600'}`}>{item.icon}</span>
                        <span className="text-[13px] font-semibold text-gray-900">{item.title}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-snug">{item.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-[10px] font-mono text-gray-400">
                    SHOWING FIRST 6 OF 18 MONTHS
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          {PREVIEW_HEADERS.map(h => (
                            <th key={h} className="px-2.5 py-2 text-right text-[10px] font-mono text-gray-400 border-b border-gray-200 whitespace-nowrap first:text-left">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {PREVIEW_ROWS.map((row, ri) => (
                          <tr key={ri} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            {row.map((cell, ci) => (
                              <td key={ci} className={`px-2.5 py-2 whitespace-nowrap ${ci === 0 ? 'text-left text-gray-900' : 'text-right font-mono text-gray-500'} text-[11px]`}>{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {uploadStep === 3 && (
              <div className="text-center py-16 px-5">
                <div className="text-5xl mb-4 text-emerald-500">✓</div>
                <h2 className="text-[22px] font-bold text-gray-900 mb-2">18 Months Imported Successfully</h2>
                <p className="text-sm text-gray-500 max-w-[500px] mx-auto mb-6 leading-relaxed">
                  Parkway at 290 now has 18 months of actuals. Comp Library updated. Traffic model retraining queued. Benchmarks will refresh overnight.
                </p>
                <div className="flex gap-3 justify-center mb-8">
                  <button onClick={() => { setUploadStep(0); setActiveTab("comps"); }} className="px-5 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700">View Comps →</button>
                  <button onClick={() => { setUploadStep(0); setActiveTab("upload"); }} className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-500 text-sm hover:bg-gray-50">Upload More</button>
                </div>
                <div className="grid grid-cols-4 gap-3 max-w-[700px] mx-auto">
                  {[
                    { label: "Comp Score", value: "92/100", note: "Highest in your portfolio" },
                    { label: "OpEx/Unit", value: "$4,980", note: "23rd percentile (lean)" },
                    { label: "Traffic Accuracy", value: "±5.1%", note: "Was ±18% before your data" },
                    { label: "Templates Available", value: "1 new", note: "Save as proforma template?" },
                  ].map((stat, i) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-lg p-3">
                      <div className="text-[10px] text-gray-400 mb-1">{stat.label}</div>
                      <div className="text-xl font-bold text-gray-900 font-mono">{stat.value}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{stat.note}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "assets" && (
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Data Assets</h2>
              <p className="text-xs text-gray-500">Every owned property with uploaded data. More data = better comps, more accurate predictions, higher confidence scores.</p>
            </div>
            <div className="flex flex-col gap-2">
              {OWNED_ASSETS.map(a => (
                <div key={a.id} className="bg-white border border-gray-200 rounded-xl px-5 py-4">
                  <div className="flex justify-between items-center mb-2.5">
                    <div>
                      <span className="text-base font-semibold text-gray-900">{a.name}</span>
                      <span className="text-xs text-gray-500 ml-2.5">{a.type} · {a.units} units · {a.city}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setActiveTab("upload"); setSelectedAsset(a.id); setUploadStep(0); }}
                        className="px-3.5 py-1.5 rounded-md bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors">
                        ↑ Upload Data
                      </button>
                      <button className="px-3.5 py-1.5 rounded-md border border-gray-200 text-gray-500 text-xs hover:bg-gray-50 transition-colors">View Details</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    {[
                      { label: "Monthly P&L", months: a.monthsData, target: 24 },
                      { label: "Rent Rolls", months: Math.max(0, a.monthsData - 3), target: 24 },
                      { label: "Traffic Data", months: Math.max(0, a.monthsData - 4), target: 12 },
                      { label: "Comp Eligible", months: null, target: null, active: a.monthsData >= 3 },
                      { label: "Model Training", months: null, target: null, active: a.monthsData >= 6, partial: a.monthsData >= 3 && a.monthsData < 6 },
                    ].map((d, i) => {
                      const statusColor = d.target
                        ? (d.months! >= d.target * 0.5 ? 'text-emerald-600' : d.months! >= d.target * 0.25 ? 'text-amber-600' : 'text-red-500')
                        : (d.active ? 'text-emerald-600' : d.partial ? 'text-amber-600' : 'text-red-500');
                      const barColor = d.target
                        ? (d.months! >= d.target * 0.5 ? 'bg-emerald-500' : d.months! >= d.target * 0.25 ? 'bg-amber-500' : 'bg-red-400')
                        : '';
                      return (
                        <div key={i} className="bg-gray-50 rounded-md px-2.5 py-2">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] text-gray-400">{d.label}</span>
                            <span className={`text-[10px] font-mono ${statusColor}`}>
                              {d.target ? `${d.months}mo` : (d.active ? "✓ Active" : d.partial ? "Partial" : "✗ Need data")}
                            </span>
                          </div>
                          {d.target && (
                            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, ((d.months ?? 0) / d.target) * 100)}%` }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "comps" && (
          <div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Comp Library</h2>
                <p className="text-xs text-gray-500">Auto-generated from your portfolio data. These comps populate ProForma Layer 3 when you open a new deal.</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg px-3.5 py-2">
                <div className="text-[10px] text-gray-400 mb-0.5">COMP POOL</div>
                <span className="text-sm font-bold text-gray-900">3 owned</span>
                <span className="text-xs text-gray-500"> + 359 anonymized</span>
              </div>
            </div>

            <div className="bg-gray-100 rounded-xl p-4 mb-4 border border-gray-200">
              <div className="text-[10px] font-mono text-amber-600 tracking-[2px] mb-2">FIND COMPS FOR A DEAL — try it</div>
              <div className="flex gap-2">
                <input placeholder="Property type (e.g. Garden 3-Story)" className="flex-1 px-3 py-2 rounded-md border border-gray-200 bg-white text-gray-900 text-[13px] focus:outline-none focus:border-amber-400" />
                <input placeholder="City or submarket" className="flex-1 px-3 py-2 rounded-md border border-gray-200 bg-white text-gray-900 text-[13px] focus:outline-none focus:border-amber-400" />
                <input placeholder="Units (e.g. 250)" className="w-[120px] px-3 py-2 rounded-md border border-gray-200 bg-white text-gray-900 text-[13px] focus:outline-none focus:border-amber-400" />
                <button className="px-5 py-2 rounded-md bg-amber-600 text-white text-[13px] font-semibold hover:bg-amber-700 whitespace-nowrap">Search Comps</button>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[2fr_1.2fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_1fr] px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-[10px] font-mono text-gray-400 tracking-[1px]">
                <span>SOURCE</span><span>TYPE</span><span>DIST</span><span className="text-right">SCORE</span><span className="text-right">OPEX/U</span><span className="text-right">NOI/U</span><span className="text-right">OCC</span><span className="text-right">RENT/SF</span><span className="text-right">DATA</span>
              </div>
              {AUTO_COMPS.map((c) => (
                <div key={c.id} className={`grid grid-cols-[2fr_1.2fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_1fr] px-4 py-3 border-b border-gray-100 items-center cursor-pointer hover:bg-gray-50 transition-colors ${c.status === "Your Asset" ? 'bg-amber-50/40' : ''}`}>
                  <div>
                    <span className="text-[13px] font-medium text-gray-900">{c.source}</span>
                    {c.status === "Your Asset" && <span className="text-[9px] font-mono text-amber-700 ml-2 px-1.5 py-px bg-amber-100 rounded">YOUR DATA</span>}
                  </div>
                  <span className="text-xs text-gray-500">{c.type}</span>
                  <span className="text-xs font-mono text-gray-500">{c.distance}</span>
                  <div className="text-right">
                    <span className={`text-[13px] font-mono font-semibold ${c.compScore >= 80 ? 'text-emerald-600' : c.compScore >= 60 ? 'text-amber-600' : 'text-gray-500'}`}>{c.compScore}</span>
                  </div>
                  <span className="text-xs font-mono text-gray-900 text-right">{c.opexPU}</span>
                  <span className="text-xs font-mono text-gray-900 text-right">{c.noiPU}</span>
                  <span className="text-xs font-mono text-gray-900 text-right">{c.occupancy}</span>
                  <span className="text-xs font-mono text-gray-900 text-right">{c.rentPSF}</span>
                  <span className="text-[11px] font-mono text-gray-400 text-right">{c.dataMonths ? `${c.dataMonths}mo` : c.status}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 px-4 py-3 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <span className="text-xs text-gray-500">When you open a ProForma for a new deal, this comp query runs automatically. Results populate </span>
              <span className="text-xs text-gray-900 font-semibold">Layer 3 (Your Data)</span>
              <span className="text-xs text-gray-500"> of the 3-layer assumption model. You don't need to search manually — it just appears.</span>
            </div>
          </div>
        )}

        {activeTab === "templates" && (
          <div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Template Library</h2>
                <p className="text-xs text-gray-500">Saved proforma configurations, scenario presets, and debt structures. Apply to new deals in one click.</p>
              </div>
              <button className="px-4 py-2 rounded-lg bg-amber-600 text-white text-[13px] font-semibold hover:bg-amber-700">
                + Create Template
              </button>
            </div>

            {SAVED_TEMPLATES.map(t => (
              <div key={t.id} className="bg-white border border-gray-200 rounded-xl px-5 py-4 mb-2.5">
                <div className="flex justify-between items-center mb-2.5">
                  <div>
                    <div className="text-base font-semibold text-gray-900">{t.name}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {t.strategy} · {t.productType} · Created from {t.createdFrom} · {t.assumptions} assumptions
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-4 py-1.5 rounded-md bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600">Apply to Deal →</button>
                    <button className="px-3.5 py-1.5 rounded-md border border-gray-200 text-gray-500 text-xs hover:bg-gray-50">Edit</button>
                    <button className="px-3.5 py-1.5 rounded-md border border-gray-200 text-gray-500 text-xs hover:bg-gray-50">Duplicate</button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Rent Growth", value: "3.5%/yr" },
                    { label: "Vacancy", value: "5.5%" },
                    { label: "OpEx/Unit", value: "$5,100" },
                    { label: "Exit Cap", value: "5.25%" },
                  ].map((a, i) => (
                    <div key={i} className="bg-gray-50 rounded-md px-2.5 py-1.5 flex justify-between">
                      <span className="text-[11px] text-gray-400">{a.label}</span>
                      <span className="text-xs font-mono text-gray-900">{a.value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-[10px] text-gray-400">Used {t.timesUsed} times · Last used {t.lastUsed} · Created {t.createdDate}</div>
              </div>
            ))}

            <div className="mt-3 px-4 py-3.5 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-center">
              <span className="text-[13px] text-gray-500">Templates are created from within the ProForma (M09). When you finalize a proforma, click </span>
              <span className="text-[13px] text-gray-900 font-semibold">"Save as Template"</span>
              <span className="text-[13px] text-gray-500"> and it appears here.</span>
            </div>
          </div>
        )}

        {activeTab === "models" && (
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Model Training Dashboard</h2>
              <p className="text-xs text-gray-500">See how your data trains JEDI RE's predictions. More data = higher accuracy = more confident deal analysis.</p>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-5">
              {MODEL_CARDS.map((m, i) => {
                const c = MODEL_COLOR[m.color];
                const pct = Math.min(100, Math.round((parseInt(m.yourContrib) / 72) * 100));
                return (
                  <div key={i} className={`bg-white border ${c.border} rounded-xl p-4 border-t-2`}>
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-xl ${c.text}`}>{m.icon}</span>
                        <span className="text-[15px] font-semibold text-gray-900">{m.model}</span>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${c.bg} ${c.text}`}>{m.status}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-gray-50 rounded-md p-2.5">
                        <div className="text-[10px] text-gray-400">Accuracy</div>
                        <div className="text-lg font-mono font-bold text-gray-900">{m.accuracy}</div>
                        <div className={`text-[10px] ${m.trend === "improving" ? 'text-emerald-600' : 'text-gray-500'}`}>↑ {m.trend}</div>
                      </div>
                      <div className="bg-gray-50 rounded-md p-2.5">
                        <div className="text-[10px] text-gray-400">Your Data</div>
                        <div className="text-lg font-mono font-bold text-gray-900">{m.yourContrib}</div>
                        <div className="text-[10px] text-gray-500">{m.properties} properties</div>
                      </div>
                    </div>
                    <div className="mt-2.5">
                      <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                        <span>Data Coverage</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
              <div className="text-[10px] font-mono text-amber-600 tracking-[2px] mb-2.5">PREDICTION VALIDATION — Did JEDI get it right?</div>
              <div className="flex flex-col gap-1.5">
                {VALIDATION_ROWS.map((v, i) => (
                  <div key={i} className="grid grid-cols-[160px_120px_100px_100px_80px_80px] px-3 py-2 rounded-md bg-gray-50 items-center">
                    <span className="text-xs text-gray-900">{v.property}</span>
                    <span className="text-[11px] text-gray-500">{v.metric}</span>
                    <span className="text-xs font-mono text-gray-500">{v.predicted}</span>
                    <span className="text-xs font-mono text-gray-900">{v.actual}</span>
                    <span className={`text-[11px] font-mono ${v.verdict === "close" ? 'text-emerald-600' : v.verdict === "off" ? 'text-amber-600' : 'text-gray-400'}`}>{v.error}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${v.verdict === "close" ? 'bg-emerald-50 text-emerald-600' : v.verdict === "off" ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
                      {v.verdict === "close" ? "✓ Close" : v.verdict === "off" ? "~ Adjusting" : "⏳ Pending"}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-2.5 px-3 py-2 bg-emerald-50 rounded-md border border-emerald-200">
                <span className="text-[11px] text-emerald-700">Your data has improved Traffic prediction accuracy in Frisco from ±18% (market only) to ±5.1% (your validated data). This confidence level now shows on every deal analysis in this submarket.</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
