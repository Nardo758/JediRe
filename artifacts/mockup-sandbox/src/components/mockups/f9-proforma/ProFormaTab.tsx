import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, Pencil, RotateCcw, RefreshCw, XCircle } from "lucide-react";

// ─── Mock data (mirrors DealFinancials contract from /api/v1/deals/:id/financials) ──
const DEAL = { name: "Sentosa Epperson", units: 304, purchasePrice: 52_200_000 };
const CAP_RATE = 0.0552;

interface OSRow {
  field: string; label: string;
  broker: number | null; platform: number | null;
  t12: number | null; rentRoll: number | null; taxBill: number | null;
  resolved: number | null; source: string | null;
  perUnit: number | null; benchmarkPosition: "above" | "below" | "within" | null;
}

const REVENUE: OSRow[] = [
  { field:"gpr",                  label:"Gross Potential Rent",        broker:7_330_080, platform:7_198_416, t12:7_241_520, rentRoll:7_289_000, taxBill:null, resolved:7_241_520, source:"t12",      perUnit:23_820, benchmarkPosition:"within"  },
  { field:"loss_to_lease_pct",    label:"Loss to Lease (%)",           broker:0.021,     platform:0.024,    t12:0.022,     rentRoll:null,       taxBill:null, resolved:0.022,     source:"t12",      perUnit:null,   benchmarkPosition:"within"  },
  { field:"vacancy_pct",          label:"Vacancy & Credit Loss (%)",   broker:0.174,     platform:0.148,    t12:0.151,     rentRoll:null,       taxBill:null, resolved:0.174,     source:"om",       perUnit:null,   benchmarkPosition:"above"   },
  { field:"concessions_pct",      label:"Concessions (%)",             broker:0.012,     platform:0.008,    t12:0.009,     rentRoll:null,       taxBill:null, resolved:0.009,     source:"t12",      perUnit:null,   benchmarkPosition:"within"  },
  { field:"bad_debt_pct",         label:"Bad Debt (%)",                broker:0.005,     platform:0.003,    t12:0.004,     rentRoll:null,       taxBill:null, resolved:0.004,     source:"t12",      perUnit:null,   benchmarkPosition:"within"  },
  { field:"non_revenue_units_pct",label:"Non-Revenue Units (%)",       broker:0.008,     platform:0.010,    t12:0.007,     rentRoll:null,       taxBill:null, resolved:0.007,     source:"t12",      perUnit:null,   benchmarkPosition:"within"  },
  { field:"other_income_per_unit",label:"Other Income / Unit",         broker:68,        platform:72,       t12:65,        rentRoll:null,       taxBill:null, resolved:65,        source:"t12",      perUnit:65,     benchmarkPosition:"within"  },
  { field:"egi",                  label:"Effective Gross Income",      broker:5_840_000, platform:5_924_000,t12:5_891_234, rentRoll:null,       taxBill:null, resolved:5_891_234, source:"t12",      perUnit:19_379, benchmarkPosition:"within"  },
];

const CTRL_OPEX: OSRow[] = [
  { field:"payroll",             label:"Payroll",               broker:412_000, platform:398_000, t12:428_500, rentRoll:null, taxBill:null, resolved:428_500, source:"t12", perUnit:1_409, benchmarkPosition:"within" },
  { field:"repairs_maintenance", label:"Repairs & Maintenance", broker:285_600, platform:271_000, t12:298_400, rentRoll:null, taxBill:null, resolved:298_400, source:"t12", perUnit:981,   benchmarkPosition:"within" },
  { field:"turnover",            label:"Turnover / Make Ready", broker:91_200,  platform:85_500,  t12:94_100,  rentRoll:null, taxBill:null, resolved:94_100,  source:"t12", perUnit:309,   benchmarkPosition:"within" },
  { field:"contract_services",   label:"Contract Services",     broker:152_000, platform:144_600, t12:158_300, rentRoll:null, taxBill:null, resolved:158_300, source:"t12", perUnit:520,   benchmarkPosition:"within" },
  { field:"marketing",           label:"Marketing",             broker:76_000,  platform:81_200,  t12:68_500,  rentRoll:null, taxBill:null, resolved:81_200,  source:"platform", perUnit:267, benchmarkPosition:"below" },
  { field:"utilities",           label:"Utilities",             broker:228_000, platform:216_400, t12:235_700, rentRoll:null, taxBill:null, resolved:235_700, source:"t12", perUnit:775,   benchmarkPosition:"within" },
  { field:"g_and_a",             label:"G&A / Admin",           broker:45_600,  platform:42_800,  t12:47_200,  rentRoll:null, taxBill:null, resolved:47_200,  source:"t12", perUnit:155,   benchmarkPosition:"within" },
];

const NCTRL_OPEX: OSRow[] = [
  { field:"management_fee_pct",  label:"Management Fee (%)",    broker:0.035,   platform:0.030,   t12:0.032,   rentRoll:null, taxBill:null, resolved:0.030,   source:"platform", perUnit:null,  benchmarkPosition:"within" },
  { field:"insurance",           label:"Property Insurance",    broker:182_400, platform:174_800, t12:188_200, rentRoll:null, taxBill:null, resolved:188_200, source:"t12", perUnit:619,   benchmarkPosition:"within" },
  { field:"real_estate_tax",     label:"Real Estate Tax",       broker:608_000, platform:622_400, t12:588_000, rentRoll:null, taxBill:588_000, resolved:622_400, source:"platform", perUnit:2_047, benchmarkPosition:"above" },
  { field:"replacement_reserves",label:"Replacement Reserves",  broker:76_000,  platform:76_000,  t12:76_000,  rentRoll:null, taxBill:null, resolved:76_000,  source:"platform", perUnit:250,   benchmarkPosition:"within" },
];

const NOI_ROW: OSRow = { field:"noi", label:"Net Operating Income", broker:3_734_434, platform:3_821_620, t12:3_734_434, rentRoll:null, taxBill:null, resolved:3_734_434, source:"t12", perUnit:12_284, benchmarkPosition:"within" };

const INTEGRITY = [
  { id:"IC-01", status:"ok",   message:"T-12 NOI reconciled within $1,000 (gap $0)" },
  { id:"IC-02", status:"warn", message:"GPR mismatch: rent roll $7,289,000 vs T-12 $7,241,520 (0.7% — threshold 3%)" },
  { id:"IC-03", status:"ok",   message:"All 7 controllable OpEx fields sourced" },
  { id:"IC-04", status:"warn", message:"Tax-line assessor gap: T-12 $588,000 vs tax bill $588,000 (0.0%)" },
];

// ─── Formatters ───────────────────────────────────────────────────────────────
const PCT_FIELDS = new Set(["loss_to_lease_pct","vacancy_pct","concessions_pct","bad_debt_pct","non_revenue_units_pct","management_fee_pct"]);
const PER_UNIT_FIELDS = new Set(["other_income_per_unit"]);

function fmt$(n: number | null): string {
  if (n == null) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${n.toLocaleString()}`;
  return `$${n}`;
}
function fmtPct(n: number | null): string { return n == null ? "—" : `${(n * 100).toFixed(1)}%`; }
function fmtVal(field: string, v: number | null): string {
  if (PCT_FIELDS.has(field)) return fmtPct(v);
  if (PER_UNIT_FIELDS.has(field)) return v != null ? `$${v}/unit` : "—";
  return fmt$(v);
}

// ─── Source badge ─────────────────────────────────────────────────────────────
const SRC: Record<string, { label: string; color: string; bg: string }> = {
  t12:       { label:"T-12",           color:"#f8fafc", bg:"#334155" },
  rent_roll: { label:"Rent Roll",      color:"#f8fafc", bg:"#1e3a5f" },
  tax_bill:  { label:"County Assessor",color:"#06b6d4", bg:"#083344" },
  om:        { label:"OM Narrative",   color:"#f59e0b", bg:"#292101" },
  broker:    { label:"OM Narrative",   color:"#f59e0b", bg:"#292101" },
  platform:  { label:"Platform",       color:"#60a5fa", bg:"#1e3a5f" },
  override:  { label:"Override",       color:"#c084fc", bg:"#2e1065" },
};
function Badge({ source }: { source: string | null }) {
  const m = source ? SRC[source] : null;
  if (!m) return <span style={{ display:"inline-block", padding:"1px 5px", borderRadius:2, fontFamily:"JetBrains Mono,monospace", fontSize:8, color:"#475569", background:"#1e293b" }}>Not Provided</span>;
  return <span style={{ display:"inline-block", padding:"1px 5px", borderRadius:2, fontFamily:"JetBrains Mono,monospace", fontSize:8, color:m.color, background:m.bg }}>{m.label}</span>;
}

// ─── Layout helpers ───────────────────────────────────────────────────────────
function SecHdr({ label, accent, bg }: { label: string; accent: string; bg: string }) {
  return (
    <tr>
      <td colSpan={7} style={{ padding:"5px 8px 5px 12px", background:bg, borderTop:"1px solid #1e1e1e", borderBottom:"1px solid #1e1e1e", borderLeft:`3px solid ${accent}`, fontFamily:"Inter,sans-serif", fontSize:9, fontWeight:700, color:"#cbd5e1", letterSpacing:0.8, textTransform:"uppercase" }}>{label}</td>
    </tr>
  );
}

function SubTotalRow({ label, row, color, tc }: { label: string; row: OSRow; color: string; tc: string }) {
  return (
    <tr style={{ background:color }}>
      <td style={{ padding:"4px 8px", fontWeight:700, color:"#cbd5e1", fontFamily:"Inter,sans-serif", fontSize:9 }}>─── {label} ───</td>
      <td style={{ padding:"4px 8px", textAlign:"right", color:tc, fontSize:9 }}>{fmtVal(row.field, row.broker)}</td>
      <td style={{ padding:"4px 8px", textAlign:"right", color:tc, fontSize:9 }}>{fmtVal(row.field, row.t12)}</td>
      <td style={{ padding:"4px 8px", textAlign:"right", color:tc, fontSize:9 }}>{fmtVal(row.field, row.platform)}</td>
      <td style={{ padding:"4px 8px", textAlign:"right", color:tc, fontWeight:700, background:"rgba(0,0,0,0.3)" }}>{fmtVal(row.field, row.resolved)}</td>
      <td style={{ padding:"4px 8px" }}><Badge source={row.source} /></td>
      <td style={{ padding:"4px 8px", textAlign:"right", color:tc, fontSize:9 }}>{row.perUnit != null ? `$${row.perUnit.toLocaleString()}` : "—"}</td>
    </tr>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export function ProFormaTab() {
  const [corrected, setCorrected] = useState<Record<string, boolean>>({});

  const egiRow = REVENUE.find(r => r.field === "egi")!;
  const ctrlSum = CTRL_OPEX.reduce((s, r) => s + (r.resolved ?? 0), 0);
  const nctrlSum = NCTRL_OPEX.reduce((s, r) => s + (r.resolved ?? 0), 0);
  const totalOpex = ctrlSum + nctrlSum;
  const noi = NOI_ROW.resolved ?? 0;
  const impliedCap = noi / DEAL.purchasePrice;
  const ppUnit = Math.round(DEAL.purchasePrice / DEAL.units);

  const warnChecks = INTEGRITY.filter(c => c.status !== "ok");

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", width:"100%", overflow:"hidden", background:"#0a0a0a", color:"#e2e8f0", fontFamily:"Inter,system-ui,sans-serif" }}>

      {/* ── Header ── */}
      <header style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 12px", height:40, flexShrink:0, background:"#111111", borderBottom:"1px solid #1e1e1e" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontFamily:"JetBrains Mono,monospace", fontSize:9, fontWeight:700, color:"#f8fafc", background:"#27272a", padding:"2px 6px", borderRadius:2, letterSpacing:1 }}>AS-IS · BROKER LAYER</span>
          <span style={{ fontFamily:"JetBrains Mono,monospace", fontSize:10, fontWeight:600, color:"#f8fafc" }}>{DEAL.name}</span>
          <span style={{ fontFamily:"Inter,sans-serif", fontSize:9, color:"#64748b" }}>{DEAL.units} Units · At-Acquisition Snapshot</span>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {[
            { l:"GPR",     v:fmt$(egiRow?.broker ?? null) },
            { l:"EGI",     v:fmt$(egiRow.resolved) },
            { l:"NOI",     v:fmt$(noi) },
            { l:"NOI/Unit",v:`$${NOI_ROW.perUnit?.toLocaleString()}` },
          ].map(k => (
            <div key={k.l} style={{ display:"flex", alignItems:"baseline", gap:4, padding:"2px 8px", borderRadius:2, border:"1px solid #27272a", background:"#111827" }}>
              <span style={{ fontFamily:"Inter,sans-serif", fontSize:9, color:"#64748b" }}>{k.l}</span>
              <span style={{ fontFamily:"JetBrains Mono,monospace", fontSize:10, fontWeight:700, color:"#e2e8f0" }}>{k.v}</span>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {INTEGRITY.map(c => c.status === "ok"
            ? <span key={c.id} title={c.message} style={{ display:"flex", alignItems:"center", gap:3, fontSize:9, color:"#22c55e", fontFamily:"Inter,sans-serif" }}><CheckCircle2 size={11} />{c.id}</span>
            : <span key={c.id} title={c.message} style={{ display:"flex", alignItems:"center", gap:3, fontSize:9, color:"#f59e0b", fontFamily:"Inter,sans-serif" }}><AlertTriangle size={11} />{c.id}</span>
          )}
          <button style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 8px", borderRadius:2, border:"none", background:"#1e293b", color:"#93c5fd", cursor:"pointer", fontFamily:"JetBrains Mono,monospace", fontSize:9, fontWeight:700, letterSpacing:0.5 }}>
            <RefreshCw size={10} />REPARSE
          </button>
        </div>
      </header>

      {/* ── Warn banners ── */}
      {warnChecks.map(c => (
        <div key={c.id} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"5px 12px", background:"#1c1200", borderLeft:"3px solid #f59e0b", flexShrink:0 }}>
          <AlertTriangle size={11} style={{ color:"#f59e0b", flexShrink:0, marginTop:1 }} />
          <span style={{ fontFamily:"Inter,sans-serif", fontSize:9, color:"#fcd34d", lineHeight:1.4 }}>
            <strong style={{ fontFamily:"JetBrains Mono,monospace" }}>{c.id}</strong> — {c.message}
          </span>
        </div>
      ))}

      {/* ── Table ── */}
      <div style={{ flex:1, overflowY:"auto", overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"JetBrains Mono,monospace", fontSize:10 }}>
          <thead style={{ position:"sticky", top:0, zIndex:10, background:"#111111" }}>
            <tr style={{ borderBottom:"1px solid #2d2d2d" }}>
              {[
                { l:"Line Item",  left:true, min:180, sticky:true, color:"#64748b" },
                { l:"Broker",     color:"#f59e0b" },
                { l:"T-12",       color:"#e2e8f0" },
                { l:"Platform",   color:"#06b6d4" },
                { l:"Resolved",   color:"#e2e8f0", highlight:true },
                { l:"Source",     color:"#64748b" },
                { l:"$/Unit",     color:"#64748b" },
              ].map(h => (
                <th key={h.l} style={{
                  padding:"5px 8px", textAlign:h.left ? "left" : "right",
                  color:h.color, fontWeight:700, fontSize:9, letterSpacing:0.5,
                  minWidth:h.min, whiteSpace:"nowrap", fontFamily:"Inter,sans-serif",
                  ...(h.sticky ? { position:"sticky", left:0, background:"#111111" } : {}),
                  ...(h.highlight ? { borderBottom:"2px solid #06b6d4", background:"#0d1f2d" } : { borderBottom:"1px solid #2d2d2d" }),
                }}>{h.l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <SecHdr label="Revenue" accent="#06b6d4" bg="#051a24" />
            {REVENUE.map((r, i) => <Row key={r.field} row={r} isEven={i % 2 === 0} shade="blue" corrected={corrected} setCorrected={setCorrected} />)}
            <SubTotalRow label="EGI" row={egiRow} color="#0f172a" tc="#22c55e" />

            <SecHdr label="Controllable Expenses" accent="#f59e0b" bg="#1a110a" />
            {CTRL_OPEX.map((r, i) => <Row key={r.field} row={r} isEven={i % 2 === 0} shade="warm" corrected={corrected} setCorrected={setCorrected} />)}
            <tr style={{ background:"#1a110a" }}>
              <td style={{ padding:"4px 12px", color:"#fb923c", fontWeight:700, fontFamily:"Inter,sans-serif", fontSize:9 }}>─── CONTROLLABLE OPEX ───</td>
              <td /><td /><td />
              <td style={{ padding:"4px 8px", textAlign:"right", color:"#fb923c", fontWeight:700 }}>{fmt$(ctrlSum)}</td>
              <td colSpan={2} />
            </tr>

            <SecHdr label="Non-Controllable Expenses" accent="#a855f7" bg="#0d0a14" />
            {NCTRL_OPEX.map((r, i) => <Row key={r.field} row={r} isEven={i % 2 === 0} shade="purple" corrected={corrected} setCorrected={setCorrected} />)}

            {/* TOTAL OPEX */}
            <tr style={{ background:"#1e1b4b", borderTop:"1px solid #312e81", borderBottom:"1px solid #312e81" }}>
              <td style={{ padding:"5px 8px", fontWeight:700, color:"#e2e8f0", fontFamily:"Inter,sans-serif", fontSize:9, position:"sticky", left:0, background:"#1e1b4b" }}>═══ TOTAL OPEX ═══</td>
              <td /><td /><td />
              <td style={{ padding:"5px 8px", textAlign:"right", color:"#ffffff", fontWeight:700, fontSize:11 }}>{fmt$(totalOpex)}</td>
              <td />
              <td style={{ padding:"5px 8px", textAlign:"right", color:"#94a3b8", fontSize:9 }}>${Math.round(totalOpex / DEAL.units).toLocaleString()}/unit</td>
            </tr>

            {/* NOI */}
            <tr style={{ background:"#042304", borderTop:"2px solid #166534", borderBottom:"2px solid #166534" }}>
              <td style={{ padding:"7px 8px", fontWeight:700, color:"#f8fafc", fontFamily:"Inter,sans-serif", letterSpacing:1, position:"sticky", left:0, background:"#042304" }}>═══ NET OPERATING INCOME ═══</td>
              <td style={{ padding:"7px 8px", textAlign:"right", color:"#86efac" }}>{fmt$(NOI_ROW.broker)}</td>
              <td style={{ padding:"7px 8px", textAlign:"right", color:"#86efac" }}>{fmt$(NOI_ROW.t12)}</td>
              <td style={{ padding:"7px 8px", textAlign:"right", color:"#86efac" }}>{fmt$(NOI_ROW.platform)}</td>
              <td style={{ padding:"7px 8px", textAlign:"right", color:"#4ade80", fontWeight:700, fontSize:13 }}>{fmt$(noi)}</td>
              <td style={{ padding:"7px 8px" }}><Badge source={NOI_ROW.source} /></td>
              <td style={{ padding:"7px 8px", textAlign:"right", color:"#86efac", fontSize:9 }}>${NOI_ROW.perUnit?.toLocaleString()}/unit</td>
            </tr>
          </tbody>
        </table>

        {/* NOI Bridge */}
        <div style={{ padding:"16px 24px", borderTop:"1px solid #1e1e1e", background:"#080808" }}>
          <div style={{ maxWidth:520, margin:"0 auto", fontFamily:"JetBrains Mono,monospace" }}>
            <div style={{ fontSize:8, color:"#334155", textAlign:"center", marginBottom:12, letterSpacing:1, textTransform:"uppercase" }}>At-Acquisition NOI Bridge · Year 1 AS-IS</div>
            {[
              { label:"EFFECTIVE GROSS INCOME", value:fmt$(egiRow.resolved), color:"#22c55e", bold:true, border:true },
              { label:"  Less: Controllable OpEx", value:`(${fmt$(ctrlSum)})`, color:"#fb923c", border:false },
              { label:"  Less: Non-Controllable OpEx", value:`(${fmt$(nctrlSum)})`, color:"#c084fc", border:false },
              { label:"NET OPERATING INCOME", value:fmt$(noi), color:"#4ade80", bold:true, border:true, big:true },
            ].map(r => (
              <div key={r.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:r.big ? "10px 0" : "5px 0", borderBottom:r.border ? "1px solid #1e1e1e" : undefined }}>
                <span style={{ fontFamily:"Inter,sans-serif", color:"#64748b", fontSize:r.bold ? 11 : 10, fontWeight:r.bold ? 700 : 400 }}>{r.label}</span>
                <span style={{ color:r.color, fontSize:r.big ? 16 : 11, fontWeight:r.big ? 700 : r.bold ? 600 : 400 }}>{r.value}</span>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:"#334155", marginTop:6 }}>
              <span>NOI per unit: ${NOI_ROW.perUnit?.toLocaleString()}</span>
              <span>@ {(CAP_RATE * 100).toFixed(2)}% cap: {fmt$(Math.round(noi / CAP_RATE))}</span>
            </div>
          </div>
        </div>

        {/* Capital Stack */}
        <div style={{ padding:"16px 24px 24px", borderTop:"1px solid #1e1e1e", background:"#08080e" }}>
          <div style={{ maxWidth:520, margin:"0 auto" }}>
            <div style={{ fontSize:8, color:"#334155", letterSpacing:1, textTransform:"uppercase", marginBottom:12, fontFamily:"JetBrains Mono,monospace" }}>Capital Stack at Close</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
              {[
                { l:"Purchase Price",   v:fmt$(DEAL.purchasePrice),        c:"#f8fafc" },
                { l:"Price / Unit",     v:`$${ppUnit.toLocaleString()}`,    c:"#94a3b8" },
                { l:"Implied Cap Rate", v:`${(impliedCap * 100).toFixed(2)}%`, c:"#06b6d4" },
                { l:"Broker Cap Rate",  v:`${(CAP_RATE * 100).toFixed(2)}%`,   c:"#f59e0b" },
                { l:"NOI (AS-IS)",      v:fmt$(noi),                        c:"#4ade80" },
                { l:"NOI / Unit",       v:`$${NOI_ROW.perUnit?.toLocaleString()}`, c:"#86efac" },
              ].map(k => (
                <div key={k.l} style={{ background:"#0d0d0d", border:"1px solid #1e1e1e", padding:"8px 10px", borderRadius:2 }}>
                  <div style={{ fontFamily:"Inter,sans-serif", fontSize:8, color:"#475569", marginBottom:4, textTransform:"uppercase", letterSpacing:0.5 }}>{k.l}</div>
                  <div style={{ fontFamily:"JetBrains Mono,monospace", fontSize:13, fontWeight:700, color:k.c }}>{k.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"4px 12px", borderTop:"1px solid #1e1e1e", background:"#111111" }}>
        <div style={{ display:"flex", gap:16, alignItems:"center" }}>
          <span style={{ fontFamily:"JetBrains Mono,monospace", fontSize:8, color:"#475569", letterSpacing:0.5 }}>SOURCE LEGEND:</span>
          {[
            { color:"#f59e0b", label:"OM Narrative" },
            { color:"#f8fafc", label:"T-12" },
            { color:"#06b6d4", label:"County Assessor" },
            { color:"#60a5fa", label:"Platform" },
            { color:"#c084fc", label:"Override" },
            { color:"#475569", label:"Not Provided" },
          ].map(({ color, label }) => (
            <div key={label} style={{ display:"flex", alignItems:"center", gap:4 }}>
              <span style={{ width:6, height:6, borderRadius:1, background:color, display:"inline-block" }} />
              <span style={{ fontFamily:"Inter,sans-serif", fontSize:8, color:"#475569" }}>{label}</span>
            </div>
          ))}
        </div>
        <div style={{ fontFamily:"JetBrains Mono,monospace", fontSize:8, color:"#334155" }}>SEEDED 2026-04-12 23:21 UTC</div>
      </footer>
    </div>
  );
}

// ─── Row component ─────────────────────────────────────────────────────────────
function Row({ row, isEven, shade, corrected, setCorrected }: {
  row: OSRow; isEven: boolean; shade?: "blue"|"warm"|"purple";
  corrected: Record<string,boolean>;
  setCorrected: React.Dispatch<React.SetStateAction<Record<string,boolean>>>;
}) {
  const isDeviant = row.benchmarkPosition === "above" || row.benchmarkPosition === "below";
  const baseBg = shade === "warm" ? (isEven ? "#0e0a06" : "#0c0907") : shade === "purple" ? (isEven ? "#0d0a10" : "#0b0810") : (isEven ? "#0c0c0c" : "#0a0a0a");
  const rowBg = isDeviant ? "rgba(234,179,8,0.07)" : baseBg;

  return (
    <tr style={{ background:rowBg, borderBottom:"1px solid #161616" }}>
      <td style={{ padding:"4px 8px 4px 16px", whiteSpace:"nowrap", color:"#94a3b8", fontFamily:"Inter,sans-serif", fontSize:9, position:"sticky", left:0, background:rowBg }}>{row.label}</td>
      <td style={{ padding:"4px 8px", textAlign:"right", color:"#f59e0b", fontSize:9 }}>{fmtVal(row.field, row.broker)}</td>
      <td style={{ padding:"4px 8px", textAlign:"right", color:"#e2e8f0", fontSize:9 }}>{fmtVal(row.field, row.t12)}</td>
      <td style={{ padding:"4px 8px", textAlign:"right", color:"#06b6d4", fontSize:9 }}>{fmtVal(row.field, row.platform)}</td>
      <td style={{ padding:"4px 8px", textAlign:"right", color:"#e2e8f0", fontWeight:600, background:"#0d1f2d" }}>
        {corrected[row.field] ? <span style={{ borderBottom:"1px dotted #f59e0b" }}>{fmtVal(row.field, row.resolved)} <span style={{ fontSize:8, color:"#f59e0b" }}>✎</span></span> : fmtVal(row.field, row.resolved)}
      </td>
      <td style={{ padding:"4px 8px" }}><Badge source={row.source} /></td>
      <td style={{ padding:"4px 8px", textAlign:"right", color:"#475569", fontSize:9 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:4 }}>
          {row.perUnit != null ? `$${row.perUnit.toLocaleString()}` : "—"}
          {isDeviant && <span style={{ fontSize:7, color:"#f59e0b", letterSpacing:0.3 }}>⚠{row.benchmarkPosition?.toUpperCase()}</span>}
          <button onClick={() => setCorrected(p => ({ ...p, [row.field]: true }))} style={{ background:"none", border:"none", cursor:"pointer", color:"#334155", padding:"1px 2px", lineHeight:1 }}><Pencil size={8} /></button>
          {corrected[row.field] && <button onClick={() => setCorrected(p => { const n = {...p}; delete n[row.field]; return n; })} style={{ background:"none", border:"none", cursor:"pointer", color:"#f59e0b", padding:"1px 2px", lineHeight:1 }}><RotateCcw size={8} /></button>}
        </div>
      </td>
    </tr>
  );
}
