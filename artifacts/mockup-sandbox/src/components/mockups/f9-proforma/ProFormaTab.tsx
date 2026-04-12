import React, { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

type Period = "T1" | "T3" | "T6" | "T12";

interface RowData {
  label: string;
  broker: string;
  platform: string;
  t1: string;
  t3: string;
  t6: string;
  t12: string;
  resolvedSource: "Broker" | "Platform" | "T12" | "T6" | "T3" | "T1" | "Override";
  resolvedByPeriod: Record<Period, string>;
  perUnitByPeriod: Record<Period, string>;
  note?: string;
  flag?: "yellow" | "red";
}

const REVENUE_ROWS: RowData[] = [
  {
    label: "Gross Potential Rent",
    broker: "$7,330,080", platform: "$7,198,416",
    t1: "$6,918,240", t3: "$7,102,560", t6: "$7,189,080", t12: "$7,241,520",
    resolvedSource: "T12",
    resolvedByPeriod: { T1: "$6,918,240", T3: "$7,102,560", T6: "$7,189,080", T12: "$7,241,520" },
    perUnitByPeriod:  { T1: "$22,757", T3: "$23,363", T6: "$23,648", T12: "$23,820" },
    note: "T12 wins",
  },
  {
    label: "Loss to Lease (%)",
    broker: "2.1%", platform: "2.4%",
    t1: "3.1%", t3: "2.6%", t6: "2.3%", t12: "2.2%",
    resolvedSource: "T12",
    resolvedByPeriod: { T1: "3.1%", T3: "2.6%", T6: "2.3%", T12: "2.2%" },
    perUnitByPeriod:  { T1: "-$714", T3: "-$598", T6: "-$543", T12: "-$524" },
  },
  {
    label: "Vacancy & Credit Loss",
    broker: "17.4%", platform: "14.8%",
    t1: "21.2%", t3: "18.9%", t6: "16.4%", t12: "15.1%",
    resolvedSource: "Broker",
    resolvedByPeriod: { T1: "21.2%", T3: "18.9%", T6: "16.4%", T12: "17.4%" },
    perUnitByPeriod:  { T1: "-$4,877", T3: "-$4,349", T6: "-$3,773", T12: "-$4,144" },
    note: "Broker >100bps vs Platform",
    flag: "yellow",
  },
  {
    label: "Concessions",
    broker: "1.2%", platform: "0.8%",
    t1: "1.8%", t3: "1.4%", t6: "1.0%", t12: "0.9%",
    resolvedSource: "T12",
    resolvedByPeriod: { T1: "1.8%", T3: "1.4%", T6: "1.0%", T12: "0.9%" },
    perUnitByPeriod:  { T1: "-$414", T3: "-$322", T6: "-$230", T12: "-$214" },
  },
  {
    label: "Bad Debt",
    broker: "0.5%", platform: "0.3%",
    t1: "0.7%", t3: "0.5%", t6: "0.4%", t12: "0.4%",
    resolvedSource: "T12",
    resolvedByPeriod: { T1: "0.7%", T3: "0.5%", T6: "0.4%", T12: "0.4%" },
    perUnitByPeriod:  { T1: "-$161", T3: "-$115", T6: "-$92", T12: "-$95" },
  },
  {
    label: "Non-Revenue Units",
    broker: "0.8%", platform: "1.0%",
    t1: "0.7%", t3: "0.7%", t6: "0.7%", t12: "0.7%",
    resolvedSource: "T12",
    resolvedByPeriod: { T1: "0.7%", T3: "0.7%", T6: "0.7%", T12: "0.7%" },
    perUnitByPeriod:  { T1: "-$153", T3: "-$161", T6: "-$163", T12: "-$166" },
  },
  {
    label: "Other Income / Unit",
    broker: "$68", platform: "$72",
    t1: "$58", t3: "$61", t6: "$63", t12: "$65",
    resolvedSource: "T12",
    resolvedByPeriod: { T1: "$58", T3: "$61", T6: "$63", T12: "$65" },
    perUnitByPeriod:  { T1: "$58", T3: "$61", T6: "$63", T12: "$65" },
  },
];

const CONTROLLABLE_ROWS: RowData[] = [
  {
    label: "Payroll",
    broker: "$412,000", platform: "$398,000",
    t1: "$448,200", t3: "$438,800", t6: "$431,200", t12: "$428,500",
    resolvedSource: "T12",
    resolvedByPeriod: { T1: "$448,200", T3: "$438,800", T6: "$431,200", T12: "$428,500" },
    perUnitByPeriod:  { T1: "$1,474", T3: "$1,443", T6: "$1,418", T12: "$1,409" },
  },
  {
    label: "Repairs & Maintenance",
    broker: "$285,600", platform: "$271,000",
    t1: "$312,800", t3: "$305,200", t6: "$301,100", t12: "$298,400",
    resolvedSource: "T12",
    resolvedByPeriod: { T1: "$312,800", T3: "$305,200", T6: "$301,100", T12: "$298,400" },
    perUnitByPeriod:  { T1: "$1,029", T3: "$1,003", T6: "$990", T12: "$981" },
  },
  {
    label: "Turnover / Make Ready",
    broker: "$91,200", platform: "$85,500",
    t1: "$118,400", t3: "$102,600", t6: "$97,300", t12: "$94,100",
    resolvedSource: "T12",
    resolvedByPeriod: { T1: "$118,400", T3: "$102,600", T6: "$97,300", T12: "$94,100" },
    perUnitByPeriod:  { T1: "$389", T3: "$337", T6: "$320", T12: "$309" },
  },
  {
    label: "Contract Services",
    broker: "$152,000", platform: "$144,600",
    t1: "$164,200", t3: "$160,400", t6: "$159,100", t12: "$158,300",
    resolvedSource: "T12",
    resolvedByPeriod: { T1: "$164,200", T3: "$160,400", T6: "$159,100", T12: "$158,300" },
    perUnitByPeriod:  { T1: "$540", T3: "$527", T6: "$523", T12: "$520" },
  },
  {
    label: "Marketing",
    broker: "$76,000", platform: "$81,200",
    t1: "$84,600", t3: "$79,800", t6: "$71,200", t12: "$68,500",
    resolvedSource: "Platform",
    resolvedByPeriod: { T1: "$84,600", T3: "$79,800", T6: "$71,200", T12: "$81,200" },
    perUnitByPeriod:  { T1: "$278", T3: "$262", T6: "$234", T12: "$267" },
  },
  {
    label: "Utilities",
    broker: "$228,000", platform: "$216,400",
    t1: "$248,600", t3: "$241,200", t6: "$238,400", t12: "$235,700",
    resolvedSource: "T12",
    resolvedByPeriod: { T1: "$248,600", T3: "$241,200", T6: "$238,400", T12: "$235,700" },
    perUnitByPeriod:  { T1: "$818", T3: "$793", T6: "$784", T12: "$775" },
  },
  {
    label: "G&A / Admin",
    broker: "$45,600", platform: "$42,800",
    t1: "$49,100", t3: "$48,200", t6: "$47,600", t12: "$47,200",
    resolvedSource: "T12",
    resolvedByPeriod: { T1: "$49,100", T3: "$48,200", T6: "$47,600", T12: "$47,200" },
    perUnitByPeriod:  { T1: "$161", T3: "$158", T6: "$157", T12: "$155" },
  },
];

const NON_CONTROLLABLE_ROWS: RowData[] = [
  {
    label: "Management Fee (%)",
    broker: "3.5%", platform: "3.0%",
    t1: "3.2%", t3: "3.2%", t6: "3.2%", t12: "3.2%",
    resolvedSource: "Platform",
    resolvedByPeriod: { T1: "3.0%", T3: "3.0%", T6: "3.0%", T12: "3.0%" },
    perUnitByPeriod:  { T1: "$557", T3: "$569", T6: "$576", T12: "$581" },
  },
  {
    label: "Property Insurance",
    broker: "$182,400", platform: "$174,800",
    t1: "$192,100", t3: "$189,800", t6: "$188,900", t12: "$188,200",
    resolvedSource: "T12",
    resolvedByPeriod: { T1: "$192,100", T3: "$189,800", T6: "$188,900", T12: "$188,200" },
    perUnitByPeriod:  { T1: "$632", T3: "$624", T6: "$621", T12: "$619" },
  },
  {
    label: "Real Estate Tax",
    broker: "$608,000", platform: "$622,400",
    t1: "$584,100", t3: "$585,600", t6: "$587,200", t12: "$588,000",
    resolvedSource: "Platform",
    resolvedByPeriod: { T1: "$622,400", T3: "$622,400", T6: "$622,400", T12: "$622,400" },
    perUnitByPeriod:  { T1: "$2,047", T3: "$2,047", T6: "$2,047", T12: "$2,047" },
    note: "T12 differs >2σ",
    flag: "red",
  },
  {
    label: "Replacement Reserves",
    broker: "$76,000", platform: "$76,000",
    t1: "$76,000", t3: "$76,000", t6: "$76,000", t12: "$76,000",
    resolvedSource: "Platform",
    resolvedByPeriod: { T1: "$76,000", T3: "$76,000", T6: "$76,000", T12: "$76,000" },
    perUnitByPeriod:  { T1: "$250", T3: "$250", T6: "$250", T12: "$250" },
  },
];

const PERIOD_LABELS: Period[] = ["T1", "T3", "T6", "T12"];
const PERIOD_DESCRIPTIONS: Record<Period, string> = {
  T1: "Trailing 1-Month (Annualized)",
  T3: "Trailing 3-Month (Annualized)",
  T6: "Trailing 6-Month (Annualized)",
  T12: "Trailing 12-Month",
};

const EGI_BY_PERIOD: Record<Period, { egi: string; perUnit: string }> = {
  T1: { egi: "$5,124,340", perUnit: "$16,856" },
  T3: { egi: "$5,612,480", perUnit: "$18,462" },
  T6: { egi: "$5,789,100", perUnit: "$19,042" },
  T12: { egi: "$5,891,234", perUnit: "$19,379" },
};

const CTRL_OPEX_BY_PERIOD: Record<Period, { total: string; perUnit: string }> = {
  T1: { total: "$1,425,900", perUnit: "$4,690" },
  T3: { total: "$1,376,200", perUnit: "$4,527" },
  T6: { total: "$1,345,900", perUnit: "$4,427" },
  T12: { total: "$1,330,700", perUnit: "$4,376" },
};

const NCTRL_OPEX_BY_PERIOD: Record<Period, { total: string; perUnit: string }> = {
  T1: { total: "$943,800", perUnit: "$3,104" },
  T3: { total: "$891,100", perUnit: "$2,931" },
  T6: { total: "$876,700", perUnit: "$2,884" },
  T12: { total: "$826,100", perUnit: "$2,717" },
};

const TOTAL_OPEX_BY_PERIOD: Record<Period, { total: string; ratio: string; perUnit: string }> = {
  T1: { total: "$2,369,700", ratio: "46.3%", perUnit: "$7,794" },
  T3: { total: "$2,267,300", ratio: "40.4%", perUnit: "$7,458" },
  T6: { total: "$2,222,600", ratio: "38.4%", perUnit: "$7,311" },
  T12: { total: "$2,156,800", ratio: "36.6%", perUnit: "$7,095" },
};

const NOI_BY_PERIOD: Record<Period, { noi: string; perUnit: string; capValue: string }> = {
  T1: { noi: "$2,754,640", perUnit: "$9,062", capValue: "$50.1M" },
  T3: { noi: "$3,345,180", perUnit: "$11,005", capValue: "$60.8M" },
  T6: { noi: "$3,566,500", perUnit: "$11,731", capValue: "$64.8M" },
  T12: { noi: "$3,734,434", perUnit: "$12,284", capValue: "$67.9M" },
};

export function ProFormaTab() {
  const [activePeriod, setActivePeriod] = useState<Period>("T12");
  const colSpanTotal = 9; // LINE ITEM + BROKER + PLATFORM + T1 + T3 + T6 + T12 + RESOLVED + $/UNIT + NOTES

  return (
    <div
      className="flex flex-col h-screen w-full overflow-hidden text-xs"
      style={{ backgroundColor: "#0a0a0a", color: "#e2e8f0", fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* ── Header Bar ── */}
      <header
        className="flex-none flex items-center justify-between px-3 sticky top-0 z-20 border-b gap-3"
        style={{ backgroundColor: "#111111", borderColor: "#1e1e1e", height: "40px" }}
      >
        <div className="flex items-center gap-3 shrink-0">
          <div className="px-2 py-0.5 rounded font-bold tracking-wider text-[10px]"
            style={{ backgroundColor: "#27272a", color: "#f8fafc" }}>
            F9 PRO FORMA
          </div>
          <span className="font-semibold text-white">Sentosa Apartments</span>
          <span className="text-slate-400">304 Units · Atlanta, GA</span>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-1 rounded border px-1 py-0.5 shrink-0"
          style={{ borderColor: "#2d2d2d", backgroundColor: "#0d0d0d" }}>
          <span className="text-slate-500 text-[9px] mr-1 uppercase tracking-wider">Period:</span>
          {PERIOD_LABELS.map((p) => (
            <button
              key={p}
              onClick={() => setActivePeriod(p)}
              title={PERIOD_DESCRIPTIONS[p]}
              className="px-2 py-0.5 rounded text-[10px] font-bold transition-all"
              style={{
                backgroundColor: activePeriod === p ? "#06b6d4" : "transparent",
                color: activePeriod === p ? "#083344" : "#64748b",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <KpiPill label="GPR" value="$7.33M" />
          <KpiPill label="EGI" value={EGI_BY_PERIOD[activePeriod].egi.replace("$", "$").slice(0, 7)} />
          <KpiPill label="NOI" value={NOI_BY_PERIOD[activePeriod].noi.slice(0, 7)} />
          <KpiPill label="NOI/Unit" value={NOI_BY_PERIOD[activePeriod].perUnit} />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 text-[10px]">
            <span className="flex items-center gap-1 text-green-500">
              <CheckCircle2 className="w-3 h-3" /> T12 Reconciled
            </span>
            <span className="flex items-center gap-1 text-yellow-500">
              <AlertTriangle className="w-3 h-3" /> Rent Roll +14%
            </span>
            <span className="flex items-center gap-1 text-green-500">
              <CheckCircle2 className="w-3 h-3" /> Tax Confirmed
            </span>
          </div>
          <div className="flex gap-1.5">
            <button className="px-2 py-1 rounded text-[10px] font-bold tracking-wide uppercase transition-colors"
              style={{ backgroundColor: "#1e293b", color: "#e2e8f0" }}>
              Seed from Docs
            </button>
            <button className="px-2 py-1 rounded text-[10px] font-bold tracking-wide uppercase transition-colors"
              style={{ backgroundColor: "#1e3a5f", color: "#93c5fd" }}>
              Run Traffic
            </button>
          </div>
        </div>
      </header>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse" style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: "10px" }}>
          <thead className="sticky top-0 z-10 text-[9px] font-bold tracking-wider text-slate-400 uppercase"
            style={{ backgroundColor: "#111111" }}>
            <tr>
              <th className="px-3 py-2 border-b border-r whitespace-nowrap min-w-[180px]" style={{ borderColor: "#1e1e1e", fontFamily: "Inter,sans-serif" }}>Line Item</th>
              <th className="px-3 py-2 border-b text-center" style={{ borderColor: "#1e1e1e", color: "#f59e0b" }}>Broker</th>
              <th className="px-3 py-2 border-b text-center" style={{ borderColor: "#1e1e1e", color: "#06b6d4" }}>Platform</th>
              {PERIOD_LABELS.map((p) => (
                <th
                  key={p}
                  className="px-3 py-2 border-b text-center relative"
                  style={{
                    borderColor: "#1e1e1e",
                    color: activePeriod === p ? "#e2e8f0" : "#475569",
                    borderBottom: activePeriod === p ? "2px solid #06b6d4" : undefined,
                    backgroundColor: activePeriod === p ? "#0d1f2d" : undefined,
                  }}
                >
                  {p}
                  {activePeriod === p && (
                    <span className="ml-1 text-cyan-400 text-[8px]">▲</span>
                  )}
                </th>
              ))}
              <th className="px-3 py-2 border-b border-l border-r text-center" style={{ borderColor: "#1e1e1e", backgroundColor: "#0a0f14", color: "#e2e8f0" }}>
                Resolved ({activePeriod})
              </th>
              <th className="px-3 py-2 border-b text-center" style={{ borderColor: "#1e1e1e" }}>$/Unit</th>
              <th className="px-3 py-2 border-b" style={{ borderColor: "#1e1e1e", fontFamily: "Inter,sans-serif" }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {/* ── REVENUE ── */}
            <SectionHeader label="Revenue" colSpan={10} color="#162032" />
            {REVENUE_ROWS.map((row, i) => (
              <DataRow key={row.label} row={row} activePeriod={activePeriod} isEven={i % 2 === 0} />
            ))}
            <SubtotalRow
              label="─── EGI SUBTOTAL ───"
              value={EGI_BY_PERIOD[activePeriod].egi}
              perUnit={EGI_BY_PERIOD[activePeriod].perUnit}
              color="#0f172a"
              textColor="#22c55e"
            />

            {/* ── CONTROLLABLE EXPENSES ── */}
            <SectionHeader label="Controllable Expenses" colSpan={10} color="#1a120a" accent="#f59e0b" />
            {CONTROLLABLE_ROWS.map((row, i) => (
              <DataRow key={row.label} row={row} activePeriod={activePeriod} isEven={i % 2 === 0} shade="warm" />
            ))}
            <SubtotalRow
              label="─── CONTROLLABLE OPEX ───"
              value={CTRL_OPEX_BY_PERIOD[activePeriod].total}
              perUnit={CTRL_OPEX_BY_PERIOD[activePeriod].perUnit}
              color="#1a110a"
              textColor="#fb923c"
            />

            {/* ── NON-CONTROLLABLE EXPENSES ── */}
            <SectionHeader label="Non-Controllable Expenses" colSpan={10} color="#16101a" accent="#a855f7" />
            {NON_CONTROLLABLE_ROWS.map((row, i) => (
              <DataRow key={row.label} row={row} activePeriod={activePeriod} isEven={i % 2 === 0} shade="purple" />
            ))}
            <SubtotalRow
              label="─── NON-CTRL OPEX ───"
              value={NCTRL_OPEX_BY_PERIOD[activePeriod].total}
              perUnit={NCTRL_OPEX_BY_PERIOD[activePeriod].perUnit}
              color="#160f1a"
              textColor="#c084fc"
            />

            {/* ── TOTAL OPEX ── */}
            <tr style={{ backgroundColor: "#1e1b4b" }}>
              <td className="px-3 py-2 border-y font-bold tracking-wide" style={{ borderColor: "#1e1e1e", fontFamily: "Inter,sans-serif", color: "#e2e8f0" }}>
                ═══ TOTAL OPEX ═══
              </td>
              <td colSpan={5} className="border-y" style={{ borderColor: "#1e1e1e" }} />
              <td className="px-3 py-2 border-y border-x text-white font-bold text-[11px]"
                style={{ borderColor: "#1e1e1e", backgroundColor: "#0d0b2e" }}>
                {TOTAL_OPEX_BY_PERIOD[activePeriod].total}
              </td>
              <td className="px-3 py-2 border-y text-slate-300 font-bold" style={{ borderColor: "#1e1e1e" }}>
                {TOTAL_OPEX_BY_PERIOD[activePeriod].perUnit}
              </td>
              <td className="px-3 py-2 border-y text-slate-400" style={{ borderColor: "#1e1e1e", fontFamily: "Inter,sans-serif" }}>
                OpEx ratio: {TOTAL_OPEX_BY_PERIOD[activePeriod].ratio}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── NOI Bridge ── */}
        <div className="p-6 border-t" style={{ borderColor: "#1e1e1e", backgroundColor: "#080808" }}>
          <div className="max-w-lg mx-auto" style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>
            <div className="text-[9px] text-slate-600 text-center mb-3 uppercase tracking-widest">
              {PERIOD_DESCRIPTIONS[activePeriod]}
            </div>
            <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: "#1e1e1e" }}>
              <span style={{ fontFamily: "Inter,sans-serif" }} className="text-slate-400 text-xs">EFFECTIVE GROSS INCOME</span>
              <span className="font-bold text-sm text-green-400">{EGI_BY_PERIOD[activePeriod].egi}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b" style={{ borderColor: "#1e1e1e" }}>
              <span style={{ fontFamily: "Inter,sans-serif" }} className="text-slate-500 text-[11px] pl-4">Controllable OpEx</span>
              <span className="text-orange-400 text-[11px]">({CTRL_OPEX_BY_PERIOD[activePeriod].total})</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b" style={{ borderColor: "#1e1e1e" }}>
              <span style={{ fontFamily: "Inter,sans-serif" }} className="text-slate-500 text-[11px] pl-4">Non-Controllable OpEx</span>
              <span className="text-purple-400 text-[11px]">({NCTRL_OPEX_BY_PERIOD[activePeriod].total})</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b" style={{ borderColor: "#1e1e1e" }}>
              <span style={{ fontFamily: "Inter,sans-serif" }} className="text-slate-400 text-xs">TOTAL OPERATING EXPENSES</span>
              <span className="font-bold text-sm text-red-400">({TOTAL_OPEX_BY_PERIOD[activePeriod].total})</span>
            </div>
            <div className="flex justify-between items-center py-4">
              <span style={{ fontFamily: "Inter,sans-serif" }} className="font-bold text-sm tracking-widest text-slate-200">
                ═══ NET OPERATING INCOME ═══
              </span>
              <span className="font-bold text-xl text-green-400" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                {NOI_BY_PERIOD[activePeriod].noi}
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
              <span>NOI per unit: {NOI_BY_PERIOD[activePeriod].perUnit}</span>
              <span>Cap Rate @ 5.50%: {NOI_BY_PERIOD[activePeriod].capValue}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="flex-none flex items-center justify-between px-3 py-1.5 border-t text-[10px]"
        style={{ backgroundColor: "#111111", borderColor: "#1e1e1e" }}>
        <div className="flex items-center gap-4">
          <span className="text-slate-400">SOURCE LEGEND:</span>
          {[
            { color: "#f59e0b", label: "Broker" },
            { color: "#06b6d4", label: "Platform" },
            { color: "#64748b", label: `${activePeriod} Actuals` },
            { color: "#3b82f6", label: "Override" },
            { color: "#a855f7", label: "Non-Ctrl" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-slate-400">{label}</span>
            </div>
          ))}
        </div>
        <div className="text-slate-500" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
          LAST UPDATED: 2026-03-05 14:32:01 UTC
        </div>
      </footer>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function KpiPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5 px-2 py-0.5 rounded border border-slate-800 bg-slate-900/50">
      <span className="text-[10px] text-slate-400">{label}</span>
      <span className="text-xs font-bold text-slate-200" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
        {value}
      </span>
    </div>
  );
}

function SectionHeader({ label, colSpan, color, accent }: { label: string; colSpan: number; color: string; accent?: string }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-3 py-1.5 font-bold uppercase tracking-wider text-slate-200"
        style={{
          backgroundColor: color,
          borderBottom: `1px solid #1e1e1e`,
          borderTop: "1px solid #1e1e1e",
          fontFamily: "Inter,sans-serif",
          borderLeft: accent ? `3px solid ${accent}` : undefined,
        }}
      >
        {label}
      </td>
    </tr>
  );
}

function SubtotalRow({
  label, value, perUnit, color, textColor,
}: {
  label: string; value: string; perUnit: string; color: string; textColor: string;
}) {
  return (
    <tr style={{ backgroundColor: color }}>
      <td className="px-3 py-2 border-y font-bold" style={{ borderColor: "#1e1e1e", fontFamily: "Inter,sans-serif", color: "#cbd5e1" }}>
        {label}
      </td>
      <td colSpan={5} className="border-y" style={{ borderColor: "#1e1e1e" }} />
      <td className="px-3 py-2 border-y border-x font-bold text-[11px]"
        style={{ borderColor: "#1e1e1e", color: textColor, backgroundColor: "rgba(0,0,0,0.3)" }}>
        {value}
      </td>
      <td className="px-3 py-2 border-y font-bold" style={{ borderColor: "#1e1e1e", color: textColor }}>
        {perUnit}
      </td>
      <td className="border-y" style={{ borderColor: "#1e1e1e" }} />
    </tr>
  );
}

function DataRow({
  row, activePeriod, isEven, shade,
}: {
  row: RowData; activePeriod: Period; isEven: boolean; shade?: "warm" | "purple";
}) {
  const baseBg = shade === "warm"
    ? isEven ? "#0e0a06" : "#0c0907"
    : shade === "purple"
      ? isEven ? "#0d0a10" : "#0b0810"
      : isEven ? "#0c0c0c" : "#0a0a0a";

  let resolvedBg = "transparent";
  let resolvedText = "#f8fafc";
  const showWarning = row.flag === "red";

  if (row.flag === "yellow") { resolvedBg = "#fef08a"; resolvedText = "#1a1a00"; }
  else if (row.flag === "red") { resolvedBg = "#fca5a5"; resolvedText = "#1a0000"; }

  const periodCells: Record<Period, string> = {
    T1: row.t1, T3: row.t3, T6: row.t6, T12: row.t12,
  };

  return (
    <tr className="h-[22px] hover:bg-slate-900/40 transition-colors" style={{ backgroundColor: baseBg }}>
      <td className="px-3 py-1 border-r text-slate-300 whitespace-nowrap"
        style={{ borderColor: "#1e1e1e", fontFamily: "Inter,sans-serif" }}>
        {row.label}
      </td>
      {/* Broker */}
      <td className="px-3 py-1 text-center" style={{ color: "#d97706" }}>{row.broker}</td>
      {/* Platform */}
      <td className="px-3 py-1 text-center" style={{ color: "#0891b2" }}>{row.platform}</td>
      {/* Period columns */}
      {PERIOD_LABELS.map((p) => (
        <td
          key={p}
          className="px-3 py-1 text-center"
          style={{
            color: activePeriod === p ? "#e2e8f0" : "#475569",
            backgroundColor: activePeriod === p ? "rgba(6,182,212,0.04)" : undefined,
            fontWeight: activePeriod === p ? 600 : 400,
          }}
        >
          {periodCells[p]}
        </td>
      ))}
      {/* Resolved */}
      <td
        className="px-3 py-1 border-x"
        style={{
          borderColor: "#1e1e1e",
          backgroundColor: resolvedBg !== "transparent" ? resolvedBg : "rgba(0,0,0,0.2)",
          color: resolvedText,
        }}
      >
        <div className="flex items-center justify-between gap-1">
          <div className="flex flex-col">
            <span className="font-bold">{row.resolvedByPeriod[activePeriod]}</span>
            <span className="w-[10px] h-[2px] rounded-full mt-[1px]" style={{
              backgroundColor:
                row.resolvedSource === "Broker" ? "#f59e0b" :
                  row.resolvedSource === "Platform" ? "#06b6d4" : "#64748b",
            }} />
          </div>
          {showWarning && <AlertTriangle className="w-3 h-3 shrink-0" style={{ color: "#b91c1c" }} />}
        </div>
      </td>
      {/* $/Unit */}
      <td className="px-3 py-1 text-center text-slate-500">
        {row.perUnitByPeriod[activePeriod]}
      </td>
      {/* Notes */}
      <td className="px-3 py-1 text-slate-500 text-[9px]" style={{ fontFamily: "Inter,sans-serif" }}>
        {row.note}
      </td>
    </tr>
  );
}
