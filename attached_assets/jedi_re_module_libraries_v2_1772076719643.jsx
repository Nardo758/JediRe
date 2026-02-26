import { useState, useCallback } from "react";

// ─── MODULE LIBRARIES: Interactive Data Hub ───
// This is the ACTUAL interface where users:
//   1. Upload data (monthly actuals, rent rolls, traffic, construction)
//   2. Review & manage their data assets
//   3. Create & apply templates
//   4. See comps auto-generated from their portfolio
//   5. View benchmarks and model performance

// ─── MOCK DATA representing user's existing portfolio ───
const OWNED_ASSETS = [
  { id: "p1", name: "Parkway at 290", type: "Garden 3-Story", units: 290, built: 2020, city: "Frisco, TX", monthsData: 18, lastUpload: "2026-01-15", status: "complete" },
  { id: "p2", name: "Cedar Hills", type: "Garden 2-Story", units: 180, built: 2019, city: "McKinney, TX", monthsData: 12, lastUpload: "2026-01-15", status: "complete" },
  { id: "p3", name: "Summit Ridge", type: "Mid-Rise 4-Story", units: 220, built: 2022, city: "Plano, TX", monthsData: 6, lastUpload: "2025-12-01", status: "partial" },
  { id: "p4", name: "Magnolia Station", type: "Garden 3-Story", units: 310, built: 2021, city: "Allen, TX", monthsData: 3, lastUpload: "2025-11-01", status: "partial" },
  { id: "p5", name: "Westpark Lofts", type: "Mid-Rise 5-Story", units: 150, built: 2023, city: "Frisco, TX", monthsData: 0, lastUpload: null, status: "empty" },
];

const UPLOAD_TEMPLATES = [
  { id: "monthly_pnl", name: "Monthly P&L", description: "Revenue, expenses, NOI by month", requiredFields: ["period", "gpr", "vacancy_loss", "egi", "taxes", "insurance", "utilities", "r_m", "mgmt_fee", "total_opex", "noi"], format: "xlsx/csv" },
  { id: "rent_roll", name: "Rent Roll", description: "Unit-level rents, lease dates, status", requiredFields: ["unit_number", "unit_type", "sqft", "market_rent", "actual_rent", "lease_start", "lease_end", "status"], format: "xlsx/csv" },
  { id: "traffic_leasing", name: "Traffic & Leasing", description: "Walk-ins, tours, web leads, leases signed", requiredFields: ["week_or_month", "walk_ins", "phone_calls", "web_leads", "tours", "applications", "leases_signed"], format: "xlsx/csv" },
  { id: "construction", name: "Construction Budget", description: "Hard costs, soft costs, draw schedule", requiredFields: ["category", "budgeted", "actual_to_date", "remaining", "pct_complete"], format: "xlsx/csv" },
  { id: "t12", name: "Trailing 12 Summary", description: "Annualized P&L with per-unit metrics", requiredFields: ["line_item", "monthly_avg", "annual_total", "per_unit", "pct_of_egi"], format: "xlsx/csv" },
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

export default function ModuleLibraries() {
  const [activeTab, setActiveTab] = useState("upload");
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState("monthly_pnl");
  const [uploadStep, setUploadStep] = useState(0); // 0=select, 1=map, 2=preview, 3=done
  const [dragOver, setDragOver] = useState(false);
  const [mappedFields, setMappedFields] = useState({});
  const [showCompFor, setShowCompFor] = useState(null);

  const handleDrag = useCallback((e) => { e.preventDefault(); setDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setDragOver(false), []);
  const handleDrop = useCallback((e) => { e.preventDefault(); setDragOver(false); setUploadStep(1); }, []);

  const amber = "#b45309";
  const bg0 = "#0c0a09";
  const bg1 = "#1c1917";
  const bg2 = "#292524";
  const border1 = "#44403c";
  const muted = "#78716c";
  const text2 = "#a8a29e";
  const mono = "'JetBrains Mono', monospace";

  return (
    <div style={{ fontFamily: "'DM Sans', -apple-system, sans-serif", background: bg0, color: "#fafaf9", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #44403c; border-radius: 3px; }
        .upload-zone { transition: all 0.2s; }
        .upload-zone:hover { border-color: #b45309 !important; background: #b4530908 !important; }
        .row-hover:hover { background: #29252488 !important; }
        .btn-primary { transition: all 0.15s; }
        .btn-primary:hover { filter: brightness(1.15); }
      `}</style>

      {/* Header */}
      <div style={{ background: bg1, borderBottom: `2px solid ${amber}`, padding: "14px 24px", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 9, fontFamily: mono, color: amber, letterSpacing: 4 }}>SETTINGS → MODULE LIBRARIES</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5, marginTop: 2 }}>Your Intelligence Hub</h1>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ textAlign: "right", marginRight: 12 }}>
              <div style={{ fontSize: 11, color: text2 }}>{OWNED_ASSETS.length} assets · {OWNED_ASSETS.reduce((a, p) => a + p.monthsData, 0)} months of data</div>
              <div style={{ fontSize: 10, color: muted }}>{AUTO_COMPS.filter(c => c.status === "Your Asset").length} active comps · {SAVED_TEMPLATES.length} saved templates</div>
            </div>
            <button className="btn-primary" style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: amber, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              ↑ Upload Data
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, marginTop: 12 }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id === "upload") setUploadStep(0); }}
              style={{
                padding: "8px 16px", borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer",
                background: activeTab === tab.id ? bg2 : "transparent",
                color: activeTab === tab.id ? "#fafaf9" : text2,
                fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 400,
                borderBottom: activeTab === tab.id ? `2px solid ${amber}` : "2px solid transparent",
              }}>
              <span style={{ marginRight: 6, fontSize: 14 }}>{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

        {/* ═══════════════ TAB: UPLOAD DATA ═══════════════ */}
        {activeTab === "upload" && (
          <div>
            {uploadStep === 0 && (
              <div>
                {/* Step 1: Select Asset + Template + Drop File */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                  {/* Select Property */}
                  <div>
                    <div style={{ fontSize: 10, fontFamily: mono, color: amber, letterSpacing: 2, marginBottom: 8 }}>① SELECT PROPERTY</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {OWNED_ASSETS.map(a => (
                        <button key={a.id} onClick={() => setSelectedAsset(a.id)} className="row-hover"
                          style={{
                            textAlign: "left", padding: "12px 14px", borderRadius: 8, cursor: "pointer",
                            border: selectedAsset === a.id ? `2px solid ${amber}` : `1px solid ${border1}`,
                            background: selectedAsset === a.id ? `${amber}11` : bg1,
                          }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: "#fafaf9" }}>{a.name}</div>
                              <div style={{ fontSize: 11, color: text2, marginTop: 2 }}>{a.type} · {a.units} units · {a.city}</div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 12, fontFamily: mono, color: a.monthsData > 0 ? "#10b981" : muted }}>
                                {a.monthsData > 0 ? `${a.monthsData}mo data` : "No data"}
                              </div>
                              {a.lastUpload && <div style={{ fontSize: 10, color: muted }}>Last: {a.lastUpload}</div>}
                            </div>
                          </div>
                          {a.status === "empty" && (
                            <div style={{ marginTop: 6, padding: "4px 8px", borderRadius: 4, background: "#f59e0b11", border: "1px solid #f59e0b33", fontSize: 10, color: "#f59e0b" }}>
                              ⚠ No data uploaded — this asset isn't generating comps yet
                            </div>
                          )}
                        </button>
                      ))}
                      <button style={{ textAlign: "center", padding: "12px", borderRadius: 8, border: `1px dashed ${border1}`, background: "transparent", color: text2, cursor: "pointer", fontSize: 13 }}>
                        + Add New Property
                      </button>
                    </div>
                  </div>

                  {/* Select Data Type + Upload */}
                  <div>
                    <div style={{ fontSize: 10, fontFamily: mono, color: amber, letterSpacing: 2, marginBottom: 8 }}>② SELECT DATA TYPE</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                      {UPLOAD_TEMPLATES.map(t => (
                        <button key={t.id} onClick={() => setSelectedTemplate(t.id)} className="row-hover"
                          style={{
                            textAlign: "left", padding: "10px 14px", borderRadius: 8, cursor: "pointer",
                            border: selectedTemplate === t.id ? `2px solid ${amber}` : `1px solid ${border1}`,
                            background: selectedTemplate === t.id ? `${amber}11` : bg1,
                          }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <span style={{ fontSize: 13, fontWeight: 500, color: "#fafaf9" }}>{t.name}</span>
                              <span style={{ fontSize: 11, color: muted, marginLeft: 8 }}>{t.description}</span>
                            </div>
                            <span style={{ fontSize: 10, fontFamily: mono, color: muted, background: bg2, padding: "2px 8px", borderRadius: 4 }}>{t.format}</span>
                          </div>
                        </button>
                      ))}
                    </div>

                    <div style={{ fontSize: 10, fontFamily: mono, color: amber, letterSpacing: 2, marginBottom: 8 }}>③ DROP YOUR FILE</div>
                    <div className="upload-zone"
                      onDragOver={handleDrag} onDragLeave={handleDragLeave} onDrop={handleDrop}
                      onClick={() => setUploadStep(1)}
                      style={{
                        border: `2px dashed ${dragOver ? amber : border1}`,
                        borderRadius: 12, padding: "40px 20px", textAlign: "center", cursor: "pointer",
                        background: dragOver ? `${amber}08` : "transparent",
                      }}>
                      <div style={{ fontSize: 36, marginBottom: 8, color: dragOver ? amber : muted }}>↑</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#fafaf9", marginBottom: 4 }}>
                        Drag & drop your {UPLOAD_TEMPLATES.find(t => t.id === selectedTemplate)?.name} file
                      </div>
                      <div style={{ fontSize: 12, color: text2, marginBottom: 12 }}>Excel (.xlsx) or CSV — or click to browse</div>
                      <button className="btn-primary" style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: bg2, color: text2, fontSize: 12, cursor: "pointer" }}>
                        Download Template →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {uploadStep === 1 && (
              <div>
                {/* Step 2: Column Mapping */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, fontFamily: mono, color: amber, letterSpacing: 2, marginBottom: 2 }}>STEP 2 OF 3</div>
                    <h2 style={{ fontSize: 18, fontWeight: 700 }}>Map Your Columns</h2>
                    <p style={{ fontSize: 12, color: text2, marginTop: 2 }}>We detected 14 columns in your file. Match them to JEDI fields below.</p>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setUploadStep(0)} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${border1}`, background: "transparent", color: text2, cursor: "pointer", fontSize: 13 }}>← Back</button>
                    <button onClick={() => setUploadStep(2)} className="btn-primary" style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: amber, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Preview Data →</button>
                  </div>
                </div>

                <div style={{ background: bg1, border: `1px solid ${border1}`, borderRadius: 10, overflow: "hidden" }}>
                  {/* Header */}
                  <div style={{ display: "grid", gridTemplateColumns: "200px 40px 200px 1fr", padding: "10px 16px", background: bg2, borderBottom: `1px solid ${border1}`, fontSize: 10, fontFamily: mono, color: muted, letterSpacing: 1 }}>
                    <span>YOUR FILE COLUMN</span>
                    <span></span>
                    <span>JEDI FIELD</span>
                    <span>SAMPLE VALUES</span>
                  </div>
                  {/* Mapping Rows */}
                  {[
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
                  ].map((row, i) => (
                    <div key={i} className="row-hover" style={{
                      display: "grid", gridTemplateColumns: "200px 40px 200px 1fr", padding: "10px 16px", alignItems: "center",
                      borderBottom: `1px solid ${border1}`, background: i % 2 === 0 ? "transparent" : `${bg2}44`
                    }}>
                      <span style={{ fontSize: 13, color: "#fafaf9", fontWeight: 500 }}>{row.fileCol}</span>
                      <span style={{ fontSize: 16, color: row.matched ? "#10b981" : "#ef4444" }}>{row.matched ? "→" : "?"}</span>
                      <select style={{ background: bg2, border: `1px solid ${border1}`, borderRadius: 6, padding: "6px 10px", color: row.matched ? "#10b981" : "#ef4444", fontSize: 12, fontFamily: mono }}>
                        <option>{row.jediField}</option>
                      </select>
                      <span style={{ fontSize: 11, color: muted, fontFamily: mono }}>{row.sample}</span>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 12, padding: "10px 16px", background: "#10b98111", border: "1px solid #10b98133", borderRadius: 8 }}>
                  <span style={{ fontSize: 12, color: "#10b981", fontWeight: 600 }}>✓ 14 of 14 columns auto-matched</span>
                  <span style={{ fontSize: 11, color: text2, marginLeft: 12 }}>Review and adjust if any mappings look wrong, then click Preview Data</span>
                </div>
              </div>
            )}

            {uploadStep === 2 && (
              <div>
                {/* Step 3: Preview + Confirm */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, fontFamily: mono, color: amber, letterSpacing: 2, marginBottom: 2 }}>STEP 3 OF 3</div>
                    <h2 style={{ fontSize: 18, fontWeight: 700 }}>Review & Confirm</h2>
                    <p style={{ fontSize: 12, color: text2, marginTop: 2 }}>18 months of P&L data for Parkway at 290 — ready to import</p>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setUploadStep(1)} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${border1}`, background: "transparent", color: text2, cursor: "pointer", fontSize: 13 }}>← Back</button>
                    <button onClick={() => setUploadStep(3)} className="btn-primary" style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#10b981", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>✓ Import 18 Months</button>
                  </div>
                </div>

                {/* What this upload unlocks */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                  {[
                    { icon: "⬡", title: "Creates 1 New Comp", desc: "Parkway 290 becomes searchable in Comp Library. Any garden 3-story deal within 10mi can use your actual expenses.", color: "#f59e0b" },
                    { icon: "◆", title: "Trains Traffic Model", desc: "14 months of walk-in + lease data improves predictions for all garden-style in Frisco. Accuracy: LOW → MEDIUM.", color: "#8b5cf6" },
                    { icon: "◉", title: "Updates Benchmarks", desc: "Your OpEx joins the anonymized benchmark pool. 47 properties in submarket → 48. Your data is never shown raw.", color: "#3b82f6" },
                  ].map((item, i) => (
                    <div key={i} style={{ background: bg1, border: `1px solid ${item.color}33`, borderRadius: 10, padding: "14px 16px", borderTop: `2px solid ${item.color}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 18, color: item.color }}>{item.icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</span>
                      </div>
                      <p style={{ fontSize: 11, color: text2, lineHeight: 1.5 }}>{item.desc}</p>
                    </div>
                  ))}
                </div>

                {/* Data Preview Table */}
                <div style={{ background: bg1, border: `1px solid ${border1}`, borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ padding: "10px 16px", background: bg2, borderBottom: `1px solid ${border1}`, fontSize: 10, fontFamily: mono, color: muted }}>
                    SHOWING FIRST 6 OF 18 MONTHS
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: bg2 }}>
                          {["Period", "GPR", "Vacancy", "EGI", "Taxes", "Insurance", "R&M", "Mgmt", "Total OpEx", "NOI", "Occ%", "Avg Rent", "Walk-ins", "Leases"].map(h => (
                            <th key={h} style={{ padding: "8px 10px", textAlign: "right", fontSize: 10, fontFamily: mono, color: muted, borderBottom: `1px solid ${border1}`, whiteSpace: "nowrap" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ["Jul 2024", "$421.5K", "$24.3K", "$401.6K", "$34.2K", "$16.4K", "$21.5K", "$12.8K", "$120.1K", "$281.5K", "92.1%", "$1,745", "42", "7"],
                          ["Aug 2024", "$421.5K", "$22.1K", "$405.6K", "$34.2K", "$16.4K", "$19.8K", "$13.1K", "$118.2K", "$287.4K", "93.5%", "$1,762", "38", "6"],
                          ["Sep 2024", "$423.2K", "$19.8K", "$409.5K", "$34.2K", "$16.4K", "$24.1K", "$12.9K", "$122.8K", "$286.7K", "94.8%", "$1,785", "51", "9"],
                          ["Oct 2024", "$423.2K", "$18.2K", "$412.1K", "$34.2K", "$16.4K", "$18.9K", "$13.2K", "$116.4K", "$295.7K", "95.1%", "$1,788", "44", "8"],
                          ["Nov 2024", "$425.0K", "$17.8K", "$414.0K", "$34.2K", "$16.4K", "$22.3K", "$13.0K", "$119.6K", "$294.4K", "95.4%", "$1,792", "35", "5"],
                          ["Dec 2024", "$425.0K", "$19.1K", "$411.8K", "$34.2K", "$16.4K", "$26.8K", "$12.8K", "$124.9K", "$286.9K", "94.8%", "$1,790", "28", "4"],
                        ].map((row, ri) => (
                          <tr key={ri} className="row-hover" style={{ borderBottom: `1px solid ${border1}` }}>
                            {row.map((cell, ci) => (
                              <td key={ci} style={{ padding: "8px 10px", textAlign: ci === 0 ? "left" : "right", fontFamily: ci > 0 ? mono : "inherit", color: ci === 0 ? "#fafaf9" : text2, fontSize: 11, whiteSpace: "nowrap" }}>
                                {cell}
                              </td>
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
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
                <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>18 Months Imported Successfully</h2>
                <p style={{ fontSize: 14, color: text2, maxWidth: 500, margin: "0 auto 24px", lineHeight: 1.6 }}>
                  Parkway at 290 now has 18 months of actuals. Comp Library updated. Traffic model retraining queued. Benchmarks will refresh overnight.
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 32 }}>
                  <button onClick={() => { setUploadStep(0); setActiveTab("comps"); }} className="btn-primary" style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: amber, color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>View Comps →</button>
                  <button onClick={() => { setUploadStep(0); setActiveTab("upload"); }} style={{ padding: "10px 20px", borderRadius: 8, border: `1px solid ${border1}`, background: "transparent", color: text2, cursor: "pointer", fontSize: 14 }}>Upload More</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, maxWidth: 700, margin: "0 auto" }}>
                  {[
                    { label: "Comp Score", value: "92/100", note: "Highest in your portfolio" },
                    { label: "OpEx/Unit", value: "$4,980", note: "23rd percentile (lean)" },
                    { label: "Traffic Accuracy", value: "±5.1%", note: "Was ±18% before your data" },
                    { label: "Templates Available", value: "1 new", note: "Save as proforma template?" },
                  ].map((stat, i) => (
                    <div key={i} style={{ background: bg1, border: `1px solid ${border1}`, borderRadius: 8, padding: "12px" }}>
                      <div style={{ fontSize: 10, color: muted, marginBottom: 4 }}>{stat.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "#fafaf9", fontFamily: mono }}>{stat.value}</div>
                      <div style={{ fontSize: 10, color: text2, marginTop: 2 }}>{stat.note}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ TAB: MY DATA ASSETS ═══════════════ */}
        {activeTab === "assets" && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Data Assets</h2>
              <p style={{ fontSize: 12, color: text2 }}>Every owned property with uploaded data. More data = better comps, more accurate predictions, higher confidence scores.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {OWNED_ASSETS.map(a => {
                const completeness = Math.min(100, Math.round((a.monthsData / 24) * 100));
                return (
                  <div key={a.id} style={{ background: bg1, border: `1px solid ${border1}`, borderRadius: 10, padding: "16px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div>
                        <span style={{ fontSize: 16, fontWeight: 600 }}>{a.name}</span>
                        <span style={{ fontSize: 12, color: text2, marginLeft: 10 }}>{a.type} · {a.units} units · {a.city}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => { setActiveTab("upload"); setSelectedAsset(a.id); setUploadStep(0); }}
                          className="btn-primary" style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: amber, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          ↑ Upload Data
                        </button>
                        <button style={{ padding: "6px 14px", borderRadius: 6, border: `1px solid ${border1}`, background: "transparent", color: text2, fontSize: 12, cursor: "pointer" }}>View Details</button>
                      </div>
                    </div>

                    {/* Data status bar */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 12 }}>
                      {[
                        { label: "Monthly P&L", months: a.monthsData, target: 24, color: a.monthsData >= 12 ? "#10b981" : a.monthsData >= 6 ? "#f59e0b" : "#ef4444" },
                        { label: "Rent Rolls", months: Math.max(0, a.monthsData - 3), target: 24, color: a.monthsData >= 15 ? "#10b981" : a.monthsData >= 9 ? "#f59e0b" : "#ef4444" },
                        { label: "Traffic Data", months: Math.max(0, a.monthsData - 4), target: 12, color: a.monthsData >= 16 ? "#10b981" : a.monthsData >= 10 ? "#f59e0b" : "#ef4444" },
                        { label: "Comp Eligible", months: null, target: null, color: a.monthsData >= 3 ? "#10b981" : "#ef4444" },
                        { label: "Model Training", months: null, target: null, color: a.monthsData >= 6 ? "#10b981" : a.monthsData >= 3 ? "#f59e0b" : "#ef4444" },
                      ].map((d, i) => (
                        <div key={i} style={{ background: bg2, borderRadius: 6, padding: "8px 10px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <span style={{ fontSize: 10, color: muted }}>{d.label}</span>
                            <span style={{ fontSize: 10, fontFamily: mono, color: d.color }}>
                              {d.months !== null ? `${d.months}mo` : (d.color === "#10b981" ? "✓ Active" : d.color === "#f59e0b" ? "Partial" : "✗ Need data")}
                            </span>
                          </div>
                          {d.target && (
                            <div style={{ height: 4, background: "#44403c", borderRadius: 2, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${Math.min(100, (d.months / d.target) * 100)}%`, background: d.color, borderRadius: 2 }} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════════ TAB: COMP LIBRARY ═══════════════ */}
        {activeTab === "comps" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Comp Library</h2>
                <p style={{ fontSize: 12, color: text2 }}>Auto-generated from your portfolio data. These comps populate ProForma Layer 3 when you open a new deal.</p>
              </div>
              <div style={{ background: bg1, border: `1px solid ${border1}`, borderRadius: 8, padding: "8px 14px" }}>
                <div style={{ fontSize: 10, color: muted, marginBottom: 2 }}>COMP POOL</div>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#fafaf9" }}>3 owned</span>
                <span style={{ fontSize: 12, color: text2 }}> + 359 anonymized</span>
              </div>
            </div>

            {/* Simulated comp search */}
            <div style={{ background: bg2, borderRadius: 10, padding: "14px 16px", marginBottom: 16, border: `1px solid ${border1}` }}>
              <div style={{ fontSize: 10, fontFamily: mono, color: amber, letterSpacing: 2, marginBottom: 8 }}>FIND COMPS FOR A DEAL — try it</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input placeholder="Property type (e.g. Garden 3-Story)" style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: `1px solid ${border1}`, background: bg1, color: "#fafaf9", fontSize: 13 }} />
                <input placeholder="City or submarket" style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: `1px solid ${border1}`, background: bg1, color: "#fafaf9", fontSize: 13 }} />
                <input placeholder="Units (e.g. 250)" style={{ width: 120, padding: "8px 12px", borderRadius: 6, border: `1px solid ${border1}`, background: bg1, color: "#fafaf9", fontSize: 13 }} />
                <button className="btn-primary" style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: amber, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Search Comps</button>
              </div>
            </div>

            {/* Comp Results */}
            <div style={{ background: bg1, border: `1px solid ${border1}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr", padding: "10px 16px", background: bg2, borderBottom: `1px solid ${border1}`, fontSize: 10, fontFamily: mono, color: muted, letterSpacing: 1 }}>
                <span>SOURCE</span><span>TYPE</span><span>DIST</span><span style={{ textAlign: "right" }}>SCORE</span><span style={{ textAlign: "right" }}>OPEX/U</span><span style={{ textAlign: "right" }}>NOI/U</span><span style={{ textAlign: "right" }}>OCC</span><span style={{ textAlign: "right" }}>RENT/SF</span><span style={{ textAlign: "right" }}>DATA</span>
              </div>
              {AUTO_COMPS.map((c, i) => (
                <div key={c.id} className="row-hover" style={{
                  display: "grid", gridTemplateColumns: "2fr 1.2fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr",
                  padding: "12px 16px", borderBottom: `1px solid ${border1}`, alignItems: "center", cursor: "pointer",
                  background: c.status === "Your Asset" ? `${amber}06` : "transparent"
                }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#fafaf9" }}>{c.source}</span>
                    {c.status === "Your Asset" && <span style={{ fontSize: 9, fontFamily: mono, color: amber, marginLeft: 8, padding: "1px 6px", background: `${amber}22`, borderRadius: 3 }}>YOUR DATA</span>}
                  </div>
                  <span style={{ fontSize: 12, color: text2 }}>{c.type}</span>
                  <span style={{ fontSize: 12, fontFamily: mono, color: text2 }}>{c.distance}</span>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 13, fontFamily: mono, fontWeight: 600, color: c.compScore >= 80 ? "#10b981" : c.compScore >= 60 ? "#f59e0b" : text2 }}>{c.compScore}</span>
                  </div>
                  <span style={{ fontSize: 12, fontFamily: mono, color: "#fafaf9", textAlign: "right" }}>{c.opexPU}</span>
                  <span style={{ fontSize: 12, fontFamily: mono, color: "#fafaf9", textAlign: "right" }}>{c.noiPU}</span>
                  <span style={{ fontSize: 12, fontFamily: mono, color: "#fafaf9", textAlign: "right" }}>{c.occupancy}</span>
                  <span style={{ fontSize: 12, fontFamily: mono, color: "#fafaf9", textAlign: "right" }}>{c.rentPSF}</span>
                  <span style={{ fontSize: 11, fontFamily: mono, color: muted, textAlign: "right" }}>{c.dataMonths ? `${c.dataMonths}mo` : c.status}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, padding: "12px 16px", background: bg2, borderRadius: 8, border: `1px dashed ${border1}` }}>
              <span style={{ fontSize: 12, color: text2 }}>💡 When you open a ProForma for a new deal, this comp query runs automatically. Results populate </span>
              <span style={{ fontSize: 12, color: "#fafaf9", fontWeight: 600 }}>Layer 3 (Your Data)</span>
              <span style={{ fontSize: 12, color: text2 }}> of the 3-layer assumption model. You don't need to search manually — it just appears.</span>
            </div>
          </div>
        )}

        {/* ═══════════════ TAB: TEMPLATES ═══════════════ */}
        {activeTab === "templates" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Template Library</h2>
                <p style={{ fontSize: 12, color: text2 }}>Saved proforma configurations, scenario presets, and debt structures. Apply to new deals in one click.</p>
              </div>
              <button className="btn-primary" style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: amber, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                + Create Template
              </button>
            </div>

            {SAVED_TEMPLATES.map(t => (
              <div key={t.id} style={{ background: bg1, border: `1px solid ${border1}`, borderRadius: 10, padding: "16px 20px", marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#fafaf9" }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: text2, marginTop: 2 }}>
                      {t.strategy} · {t.productType} · Created from {t.createdFrom} · {t.assumptions} assumptions
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn-primary" style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: "#10b981", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Apply to Deal →</button>
                    <button style={{ padding: "6px 14px", borderRadius: 6, border: `1px solid ${border1}`, background: "transparent", color: text2, fontSize: 12, cursor: "pointer" }}>Edit</button>
                    <button style={{ padding: "6px 14px", borderRadius: 6, border: `1px solid ${border1}`, background: "transparent", color: text2, fontSize: 12, cursor: "pointer" }}>Duplicate</button>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                  {[
                    { label: "Rent Growth", value: "3.5%/yr" },
                    { label: "Vacancy", value: "5.5%" },
                    { label: "OpEx/Unit", value: "$5,100" },
                    { label: "Exit Cap", value: "5.25%" },
                  ].map((a, i) => (
                    <div key={i} style={{ background: bg2, borderRadius: 6, padding: "6px 10px", display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, color: muted }}>{a.label}</span>
                      <span style={{ fontSize: 12, fontFamily: mono, color: "#fafaf9" }}>{a.value}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8, fontSize: 10, color: muted }}>Used {t.timesUsed} times · Last used {t.lastUsed} · Created {t.createdDate}</div>
              </div>
            ))}

            <div style={{ marginTop: 12, padding: "14px 16px", background: bg2, borderRadius: 8, border: `1px dashed ${border1}`, textAlign: "center" }}>
              <span style={{ fontSize: 13, color: text2 }}>Templates are created from within the ProForma (M09). When you finalize a proforma, click </span>
              <span style={{ fontSize: 13, color: "#fafaf9", fontWeight: 600 }}>"Save as Template"</span>
              <span style={{ fontSize: 13, color: text2 }}> and it appears here.</span>
            </div>
          </div>
        )}

        {/* ═══════════════ TAB: MODEL TRAINING ═══════════════ */}
        {activeTab === "models" && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Model Training Dashboard</h2>
              <p style={{ fontSize: 12, color: text2 }}>See how your data trains JEDI RE's predictions. More data = higher accuracy = more confident deal analysis.</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[
                { model: "Traffic-to-Lease", icon: "◆", accuracy: "±5.1%", trend: "improving", yourContrib: "54 months", properties: 3, status: "Training", color: "#8b5cf6" },
                { model: "Expense Benchmark", icon: "◉", accuracy: "±8.3%", trend: "stable", yourContrib: "39 months", properties: 3, status: "Active", color: "#3b82f6" },
                { model: "Rent Achievement", icon: "⬡", accuracy: "±4.7%", trend: "improving", yourContrib: "36 months", properties: 3, status: "Active", color: "#10b981" },
              ].map((m, i) => (
                <div key={i} style={{ background: bg1, border: `1px solid ${m.color}33`, borderRadius: 10, padding: "16px", borderTop: `2px solid ${m.color}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 20, color: m.color }}>{m.icon}</span>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{m.model}</span>
                    </div>
                    <span style={{ fontSize: 10, fontFamily: mono, padding: "2px 8px", borderRadius: 4, background: `${m.color}22`, color: m.color }}>{m.status}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ background: bg2, borderRadius: 6, padding: "8px 10px" }}>
                      <div style={{ fontSize: 10, color: muted }}>Accuracy</div>
                      <div style={{ fontSize: 18, fontFamily: mono, fontWeight: 700, color: "#fafaf9" }}>{m.accuracy}</div>
                      <div style={{ fontSize: 10, color: m.trend === "improving" ? "#10b981" : text2 }}>↑ {m.trend}</div>
                    </div>
                    <div style={{ background: bg2, borderRadius: 6, padding: "8px 10px" }}>
                      <div style={{ fontSize: 10, color: muted }}>Your Data</div>
                      <div style={{ fontSize: 18, fontFamily: mono, fontWeight: 700, color: "#fafaf9" }}>{m.yourContrib}</div>
                      <div style={{ fontSize: 10, color: text2 }}>{m.properties} properties</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: muted, marginBottom: 3 }}>
                      <span>Data Coverage</span>
                      <span>{Math.min(100, Math.round((parseInt(m.yourContrib) / 72) * 100))}%</span>
                    </div>
                    <div style={{ height: 6, background: "#44403c", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, (parseInt(m.yourContrib) / 72) * 100)}%`, background: m.color, borderRadius: 3 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Prediction Validation */}
            <div style={{ background: bg1, border: `1px solid ${border1}`, borderRadius: 10, padding: "16px 20px" }}>
              <div style={{ fontSize: 10, fontFamily: mono, color: amber, letterSpacing: 2, marginBottom: 10 }}>PREDICTION VALIDATION — Did JEDI get it right?</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { property: "Parkway 290", metric: "Leases/week", predicted: "8.2", actual: "7.8", error: "+5.1%", verdict: "close" },
                  { property: "Parkway 290", metric: "OpEx/unit", predicted: "$5,100", actual: "$4,980", error: "+2.4%", verdict: "close" },
                  { property: "Cedar Hills", metric: "Leases/week", predicted: "5.4", actual: "4.9", error: "+10.2%", verdict: "off" },
                  { property: "Cedar Hills", metric: "Occupancy", predicted: "93.5%", actual: "92.1%", error: "+1.5%", verdict: "close" },
                  { property: "Summit Ridge", metric: "Leases/week", predicted: "6.8", actual: "—", error: "—", verdict: "pending" },
                ].map((v, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "160px 120px 100px 100px 80px 80px", padding: "8px 12px", borderRadius: 6, background: bg2, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "#fafaf9" }}>{v.property}</span>
                    <span style={{ fontSize: 11, color: text2 }}>{v.metric}</span>
                    <span style={{ fontSize: 12, fontFamily: mono, color: text2 }}>{v.predicted}</span>
                    <span style={{ fontSize: 12, fontFamily: mono, color: "#fafaf9" }}>{v.actual}</span>
                    <span style={{ fontSize: 11, fontFamily: mono, color: v.verdict === "close" ? "#10b981" : v.verdict === "off" ? "#f59e0b" : muted }}>{v.error}</span>
                    <span style={{ fontSize: 10, fontFamily: mono, padding: "2px 6px", borderRadius: 3,
                      background: v.verdict === "close" ? "#10b98122" : v.verdict === "off" ? "#f59e0b22" : `${bg1}`,
                      color: v.verdict === "close" ? "#10b981" : v.verdict === "off" ? "#f59e0b" : muted
                    }}>{v.verdict === "close" ? "✓ Close" : v.verdict === "off" ? "~ Adjusting" : "⏳ Pending"}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, padding: "8px 12px", background: "#10b98111", borderRadius: 6, border: "1px solid #10b98133" }}>
                <span style={{ fontSize: 11, color: "#10b981" }}>Your data has improved Traffic prediction accuracy in Frisco from ±18% (market only) to ±5.1% (your validated data). This confidence level now shows on every deal analysis in this submarket.</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
