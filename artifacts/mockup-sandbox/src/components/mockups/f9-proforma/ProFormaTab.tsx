import React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export function ProFormaTab() {
  return (
    <div
      className="flex flex-col h-full w-full overflow-hidden text-xs"
      style={{
        backgroundColor: "#0a0a0a",
        color: "#e2e8f0",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Header Bar */}
      <header
        className="flex-none flex items-center justify-between px-3 sticky top-0 z-20 border-b"
        style={{
          backgroundColor: "#111111",
          borderColor: "#1e1e1e",
          height: "40px",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="px-2 py-0.5 rounded font-bold tracking-wider"
            style={{
              backgroundColor: "#27272a",
              color: "#f8fafc",
              fontSize: "10px",
            }}
          >
            F9 PRO FORMA
          </div>
          <div className="font-semibold text-white">Sentosa Apartments</div>
          <div className="text-slate-400">304 Units · Atlanta, GA</div>
        </div>

        <div className="flex items-center gap-2">
          <KpiPill label="GPR" value="$7.33M" />
          <KpiPill label="EGI" value="$5.89M" />
          <KpiPill label="NOI" value="$3.21M" />
          <KpiPill label="NOI/Unit" value="$10,559" />
        </div>

        <div className="flex items-center gap-3">
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

          <div className="flex gap-2">
            <button className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-[10px] font-bold tracking-wide uppercase transition-colors">
              Seed from Docs
            </button>
            <button className="px-2 py-1 bg-blue-900 hover:bg-blue-800 text-blue-100 rounded text-[10px] font-bold tracking-wide uppercase transition-colors">
              Run Traffic
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto relative">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead
            className="sticky top-0 z-10 text-[10px] font-bold tracking-wider text-slate-400 uppercase"
            style={{ backgroundColor: "#111111" }}
          >
            <tr>
              <th className="px-3 py-2 border-b border-r" style={{ borderColor: "#1e1e1e" }}>Line Item</th>
              <th className="px-3 py-2 border-b" style={{ borderColor: "#1e1e1e" }}>Broker</th>
              <th className="px-3 py-2 border-b" style={{ borderColor: "#1e1e1e" }}>Platform</th>
              <th className="px-3 py-2 border-b" style={{ borderColor: "#1e1e1e" }}>T12</th>
              <th className="px-3 py-2 border-b border-l border-r bg-black/20" style={{ borderColor: "#1e1e1e" }}>Resolved</th>
              <th className="px-3 py-2 border-b" style={{ borderColor: "#1e1e1e" }}>$/Unit</th>
              <th className="px-3 py-2 border-b" style={{ borderColor: "#1e1e1e" }}>Notes</th>
            </tr>
          </thead>
          <tbody style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: "10px" }}>
            {/* Section 1 — Revenue */}
            <tr>
              <td
                colSpan={7}
                className="px-3 py-1.5 font-bold uppercase tracking-wider text-slate-200"
                style={{ backgroundColor: "#1a1a1a", borderBottom: "1px solid #1e1e1e", fontFamily: "Inter, sans-serif" }}
              >
                Revenue
              </td>
            </tr>
            <DataRow
              label="Gross Potential Rent"
              broker="$7,330,080"
              platform="$7,198,416"
              t12="$7,241,520"
              resolved="$7,241,520"
              resolvedSource="T12"
              perUnit="$23,820"
              note="T12 wins"
              isEven
            />
            <DataRow
              label="Loss to Lease (%)"
              broker="2.1%"
              platform="2.4%"
              t12="2.2%"
              resolved="2.2%"
              resolvedSource="T12"
              perUnit="-$524"
              note=""
            />
            <DataRow
              label="Vacancy & Credit Loss"
              broker="17.4%"
              platform="14.8%"
              t12="15.1%"
              resolved="17.4%"
              resolvedSource="Broker"
              perUnit="-$4,144"
              note="Broker >100bps vs Platform"
              flag="yellow"
              isEven
            />
            <DataRow
              label="Concessions"
              broker="1.2%"
              platform="0.8%"
              t12="0.9%"
              resolved="0.9%"
              resolvedSource="T12"
              perUnit="-$214"
              note=""
            />
            <DataRow
              label="Bad Debt"
              broker="0.5%"
              platform="0.3%"
              t12="0.4%"
              resolved="0.4%"
              resolvedSource="T12"
              perUnit="-$95"
              note=""
              isEven
            />
            <DataRow
              label="Non-Revenue Units"
              broker="0.8%"
              platform="1.0%"
              t12="0.7%"
              resolved="0.7%"
              resolvedSource="T12"
              perUnit="-$166"
              note=""
            />
            <DataRow
              label="Other Income / unit"
              broker="$68"
              platform="$72"
              t12="$65"
              resolved="$65"
              resolvedSource="T12"
              perUnit="$65"
              note=""
              isEven
            />
            <tr style={{ backgroundColor: "#0f172a" }}>
              <td className="px-3 py-2 border-y font-bold" style={{ borderColor: "#1e1e1e", fontFamily: "Inter, sans-serif" }}>─── EGI SUBTOTAL ───</td>
              <td colSpan={3} className="border-y" style={{ borderColor: "#1e1e1e" }}></td>
              <td className="px-3 py-2 border-y border-x text-green-500 font-bold bg-black/40 text-[11px]" style={{ borderColor: "#1e1e1e" }}>$5,891,234</td>
              <td className="px-3 py-2 border-y text-green-500 font-bold" style={{ borderColor: "#1e1e1e" }}>$19,379</td>
              <td className="px-3 py-2 border-y" style={{ borderColor: "#1e1e1e" }}></td>
            </tr>

            {/* Section 2 — Operating Expenses */}
            <tr>
              <td
                colSpan={7}
                className="px-3 py-1.5 font-bold uppercase tracking-wider text-slate-200 mt-4"
                style={{ backgroundColor: "#151515", borderBottom: "1px solid #1e1e1e", borderTop: "1px solid #1e1e1e", fontFamily: "Inter, sans-serif" }}
              >
                Operating Expenses
              </td>
            </tr>
            <DataRow
              label="Payroll"
              broker="$412,000"
              platform="$398,000"
              t12="$428,500"
              resolved="$428,500"
              resolvedSource="T12"
              perUnit="$1,409"
              note=""
              bgClass="bg-[#0c0c0c]"
            />
            <DataRow
              label="Repairs & Maintenance"
              broker="$285,600"
              platform="$271,000"
              t12="$298,400"
              resolved="$298,400"
              resolvedSource="T12"
              perUnit="$981"
              note=""
              bgClass="bg-[#0f0f0f]"
            />
            <DataRow
              label="Turnover"
              broker="$91,200"
              platform="$85,500"
              t12="$94,100"
              resolved="$94,100"
              resolvedSource="T12"
              perUnit="$309"
              note=""
              bgClass="bg-[#0c0c0c]"
            />
            <DataRow
              label="Contract Services"
              broker="$152,000"
              platform="$144,600"
              t12="$158,300"
              resolved="$158,300"
              resolvedSource="T12"
              perUnit="$520"
              note=""
              bgClass="bg-[#0f0f0f]"
            />
            <DataRow
              label="Marketing"
              broker="$76,000"
              platform="$81,200"
              t12="$68,500"
              resolved="$81,200"
              resolvedSource="Platform"
              perUnit="$267"
              note=""
              bgClass="bg-[#0c0c0c]"
            />
            <DataRow
              label="Utilities"
              broker="$228,000"
              platform="$216,400"
              t12="$235,700"
              resolved="$235,700"
              resolvedSource="T12"
              perUnit="$775"
              note=""
              bgClass="bg-[#0f0f0f]"
            />
            <DataRow
              label="Management Fee (%)"
              broker="3.5%"
              platform="3.0%"
              t12="3.2%"
              resolved="3.0%"
              resolvedSource="Platform"
              perUnit="$581"
              note=""
              bgClass="bg-[#0c0c0c]"
            />
            <DataRow
              label="Property Insurance"
              broker="$182,400"
              platform="$174,800"
              t12="$188,200"
              resolved="$188,200"
              resolvedSource="T12"
              perUnit="$619"
              note=""
              bgClass="bg-[#0f0f0f]"
            />
            <DataRow
              label="Real Estate Tax"
              broker="$608,000"
              platform="$622,400"
              t12="$588,000"
              resolved="$622,400"
              resolvedSource="Platform"
              perUnit="$2,047"
              note="T12 differs >2σ"
              flag="red"
              bgClass="bg-[#0c0c0c]"
            />
            <DataRow
              label="G&A / Admin"
              broker="$45,600"
              platform="$42,800"
              t12="$47,200"
              resolved="$47,200"
              resolvedSource="T12"
              perUnit="$155"
              note=""
              bgClass="bg-[#0f0f0f]"
            />
            <DataRow
              label="Replacement Reserves"
              broker="$76,000"
              platform="$76,000"
              t12="$76,000"
              resolved="$76,000"
              resolvedSource="Platform"
              perUnit="$250"
              note=""
              bgClass="bg-[#0c0c0c]"
            />
            <tr style={{ backgroundColor: "#1e1b4b" }}>
              <td className="px-3 py-2 border-y font-bold" style={{ borderColor: "#1e1e1e", fontFamily: "Inter, sans-serif" }}>─── TOTAL OPEX ───</td>
              <td colSpan={3} className="border-y" style={{ borderColor: "#1e1e1e" }}></td>
              <td className="px-3 py-2 border-y border-x text-white font-bold bg-black/40 text-[11px]" style={{ borderColor: "#1e1e1e" }}>$2,156,800</td>
              <td className="px-3 py-2 border-y text-slate-300" style={{ borderColor: "#1e1e1e" }}>$7,095/unit</td>
              <td className="px-3 py-2 border-y text-slate-400" style={{ borderColor: "#1e1e1e", fontFamily: "Inter, sans-serif" }}>OpEx ratio: 36.6%</td>
            </tr>
          </tbody>
        </table>

        {/* Section 3 — NOI Bridge */}
        <div className="p-6 border-t" style={{ borderColor: "#1e1e1e", backgroundColor: "#080808" }}>
          <div className="max-w-md mx-auto" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
            <div className="flex justify-between items-center py-2 text-green-500">
              <span style={{ fontFamily: "Inter, sans-serif" }} className="text-slate-400 text-xs">EFFECTIVE GROSS INCOME</span>
              <span className="font-bold text-sm">$5,891,234</span>
            </div>
            <div className="flex justify-between items-center py-2 text-red-400 border-b" style={{ borderColor: "#1e1e1e" }}>
              <span style={{ fontFamily: "Inter, sans-serif" }} className="text-slate-400 text-xs">TOTAL OPERATING EXPENSES</span>
              <span className="font-bold text-sm">($2,156,800)</span>
            </div>
            <div className="flex justify-between items-center py-4 text-green-500">
              <span style={{ fontFamily: "Inter, sans-serif" }} className="font-bold text-sm tracking-widest text-slate-200">═══ NET OPERATING INCOME ═══</span>
              <span className="font-bold text-lg tracking-tight">$3,734,434</span>
            </div>
            <div className="flex justify-between items-center py-2 text-[10px] text-slate-500 mt-2">
              <span>NOI per unit: $12,284</span>
              <span>Cap Rate Implication @ 5.50%: $67.9M</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer
        className="flex-none flex items-center justify-between px-3 py-1.5 border-t text-[10px]"
        style={{ backgroundColor: "#111111", borderColor: "#1e1e1e" }}
      >
        <div className="flex items-center gap-4">
          <span className="text-slate-400">SOURCE LEGEND:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#f59e0b" }}></span> Broker
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#06b6d4" }}></span> Platform
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#64748b" }}></span> T12
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#3b82f6" }}></span> Override
          </div>
        </div>
        <div className="text-slate-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          LAST UPDATED: 2026-03-05 14:32:01 UTC
        </div>
      </footer>
    </div>
  );
}

function KpiPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5 px-2 py-0.5 rounded border border-slate-800 bg-slate-900/50">
      <span className="text-[10px] text-slate-400">{label}</span>
      <span className="text-xs font-bold text-slate-200" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        {value}
      </span>
    </div>
  );
}

function DataRow({
  label,
  broker,
  platform,
  t12,
  resolved,
  resolvedSource,
  perUnit,
  note,
  isEven,
  flag,
  bgClass,
}: {
  label: string;
  broker: string;
  platform: string;
  t12: string;
  resolved: string;
  resolvedSource: "Broker" | "Platform" | "T12" | "Override";
  perUnit: string;
  note: string;
  isEven?: boolean;
  flag?: "yellow" | "red";
  bgClass?: string;
}) {
  let resolvedBg = "bg-black/20";
  let resolvedText = "text-white";
  let showWarning = false;

  if (flag === "yellow") {
    resolvedBg = "bg-[#fef08a]";
    resolvedText = "text-black";
  } else if (flag === "red") {
    resolvedBg = "bg-[#fca5a5]";
    resolvedText = "text-black";
    showWarning = true;
  }

  const defaultBg = bgClass ? bgClass : isEven ? "bg-[#0c0c0c]" : "bg-[#0a0a0a]";

  return (
    <tr className={`h-[22px] hover:bg-slate-900/50 transition-colors group ${defaultBg}`}>
      <td
        className="px-3 py-1 border-r text-slate-300"
        style={{ borderColor: "#1e1e1e", fontFamily: "Inter, sans-serif" }}
      >
        {label}
      </td>
      <td className="px-3 py-1 text-slate-400">{broker}</td>
      <td className="px-3 py-1 text-slate-400">{platform}</td>
      <td className="px-3 py-1 text-slate-400">{t12}</td>
      <td
        className={`px-3 py-1 border-x flex items-center justify-between gap-2 ${resolvedBg} ${resolvedText}`}
        style={{ borderColor: "#1e1e1e" }}
      >
        <div className="flex flex-col">
          <span className="font-bold">{resolved}</span>
          <div className="flex gap-1 mt-[1px]">
            {resolvedSource === "Broker" && (
              <span className="w-[10px] h-[3px] rounded-full bg-[#f59e0b]" title="Broker" />
            )}
            {resolvedSource === "Platform" && (
              <span className="w-[10px] h-[3px] rounded-full bg-[#06b6d4]" title="Platform" />
            )}
            {resolvedSource === "T12" && (
              <span className="w-[10px] h-[3px] rounded-full bg-[#64748b]" title="T12" />
            )}
            {resolvedSource === "Override" && (
              <span className="w-[10px] h-[3px] rounded-full bg-[#3b82f6]" title="Override" />
            )}
          </div>
        </div>
        {showWarning && <AlertTriangle className="w-3 h-3 text-red-700 shrink-0" />}
      </td>
      <td className="px-3 py-1 text-slate-500">{perUnit}</td>
      <td
        className="px-3 py-1 text-slate-500 text-[9px]"
        style={{ fontFamily: "Inter, sans-serif" }}
      >
        {note}
      </td>
    </tr>
  );
}
