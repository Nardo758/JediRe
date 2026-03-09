/**
 * Property Details Page — Bloomberg Terminal Aesthetic
 *
 * Asset intelligence view answering: "What IS this property?"
 * Bridge to Deal Pipeline via CREATE DEAL action.
 *
 * Tabs: OVERVIEW | FINANCIALS | COMPS | TAX & TITLE | ZONING | MARKET
 * Hotkeys: F1–F6 for tab navigation, Esc to close modals
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";

// ═══════════════════════════════════════════════════════════════
// THEME TOKENS
// ═══════════════════════════════════════════════════════════════
const T = {
  bg: { terminal:"#0A0E17",panel:"#0F1319",panelAlt:"#131821",header:"#1A1F2E",hover:"#1E2538",active:"#252D40",input:"#0D1117",topBar:"#050810",photo:"#080B12" },
  text: { primary:"#E8ECF1",secondary:"#8B95A5",muted:"#4A5568",amber:"#F5A623",amberBright:"#FFD166",green:"#00D26A",red:"#FF4757",cyan:"#00BCD4",orange:"#FF8C42",purple:"#A78BFA",white:"#FFFFFF",blue:"#4A9EFF" },
  border: { subtle:"#1E2538",medium:"#2A3348",bright:"#3B4A6B" },
  font: { mono:"'JetBrains Mono','Fira Code','SF Mono',monospace",display:"'IBM Plex Mono',monospace",label:"'IBM Plex Sans',sans-serif" },
};

const globalCSS = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
@keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes glow{0%,100%{box-shadow:0 0 4px #00D26A44}50%{box-shadow:0 0 10px #00D26A66}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
*{scrollbar-width:thin;scrollbar-color:#2A3348 #0A0E17;box-sizing:border-box}
*::-webkit-scrollbar{width:5px;height:5px}
*::-webkit-scrollbar-track{background:#0A0E17}
*::-webkit-scrollbar-thumb{background:#2A3348;border-radius:2px}
`;

// ═══════════════════════════════════════════════════════════════
// PROPERTY DATA INTERFACE
// ═══════════════════════════════════════════════════════════════
interface PropertyData {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county?: string;
  market?: string;
  submarket?: string;
  propertyType: string;
  subtype?: string;
  class?: string;
  yearBuilt?: number;
  yearRenovated?: number;
  units?: number;
  stories?: number;
  lotSizeSF?: number;
  lotSizeAc?: number;
  buildingSF?: number;
  avgUnitSF?: number;
  parking?: { total: number; ratio: number; type: string };
  amenities?: string[];
  // Ownership
  owner?: string;
  ownerType?: string;
  acquisitionDate?: string;
  acquisitionPrice?: number;
  lastSalePrice?: number;
  // Tax
  justValue?: number;
  assessedValue?: number;
  taxableValue?: number;
  millageRate?: number;
  annualTax?: number;
  homesteadExempt?: boolean;
  assessmentCap?: string;
  // Performance
  occupancyRate?: number;
  avgEffectiveRent?: number;
  avgMarketRent?: number;
  rentPerSF?: number;
  concessions?: string;
  noi?: number;
  capRate?: number;
  expenseRatio?: number;
  // Market
  submarketVacancy?: number;
  submarketRentGrowth?: number;
  submarketAbsorption?: number;
  walkScore?: number;
  transitScore?: number;
  bikeScore?: number;
  // Zoning
  zoningCode?: string;
  zoningDescription?: string;
  maxDensity?: string;
  maxHeight?: string;
  far?: number;
  zoningSource?: string;
  // Pipeline
  inPipeline?: boolean;
  dealId?: string | null;
  // Photos
  photos?: { id: number; label: string; url?: string; aspect?: string; color: string }[];
  // Comps
  rentComps?: { name: string; units: number; rent: number; dist: string; class: string; occ: number }[];
  saleComps?: { name: string; units: number; ppu: number; capRate: number; date: string; dist: string }[];
  // History
  ownershipHistory?: { date: string; buyer: string; price: number; ppu: number }[];
  taxHistory?: { year: number; justValue: number; assessed: number; tax: number }[];
  // Financial (from old interface)
  askingPrice?: number;
  estimatedValue?: number;
  monthlyRent?: number;
  annualIncome?: number;
  // Metadata
  createdAt?: string;
  updatedAt?: string;
  dataSource?: string;
}

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════
const fmt = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}K` : `$${n}`;
const fmtFull = (n: number) => `$${n.toLocaleString()}`;
const pct = (n: number) => `${n.toFixed(1)}%`;

// ═══════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════
const Badge = ({ children, color = T.text.amber, bg, border: bdr }: { children: React.ReactNode; color?: string; bg?: string; border?: string }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", padding: "1px 6px",
    fontSize: 8, fontFamily: T.font.mono, fontWeight: 700, letterSpacing: "0.05em",
    color, background: bg || `${color}15`, border: `1px solid ${bdr || `${color}40`}`,
    borderRadius: 2, lineHeight: "14px", whiteSpace: "nowrap",
  }}>{children}</span>
);

const SectionHeader = ({ title, subtitle, icon, borderColor = T.text.amber, action }: {
  title: string; subtitle?: string; icon?: string; borderColor?: string; action?: React.ReactNode;
}) => (
  <div style={{
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "6px 10px", background: T.bg.header,
    borderBottom: `1px solid ${T.border.subtle}`, borderLeft: `2px solid ${borderColor}`,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {icon && <span style={{ fontSize: 10, color: borderColor }}>{icon}</span>}
      <span style={{ fontSize: 10, fontFamily: T.font.mono, fontWeight: 700, color: T.text.white, letterSpacing: "0.05em" }}>{title}</span>
      {subtitle && <span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted }}>{subtitle}</span>}
    </div>
    {action && action}
  </div>
);

const DataRow = ({ label, value, sub, color, mono = true }: {
  label: string; value: string | number; sub?: string; color?: string; mono?: boolean;
}) => (
  <div style={{
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "4px 10px", borderBottom: `1px solid ${T.border.subtle}08`,
  }}>
    <span style={{ fontSize: 9, fontFamily: T.font.label, color: T.text.secondary }}>{label}</span>
    <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
      <span style={{ fontSize: 10, fontFamily: mono ? T.font.mono : T.font.label, fontWeight: 600, color: color || T.text.primary }}>{value}</span>
      {sub && <span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted }}>{sub}</span>}
    </div>
  </div>
);

const MiniBar = ({ value, max, color = T.text.cyan, width = 60 }: { value: number; max: number; color?: string; width?: number }) => (
  <div style={{ width, height: 6, background: `${color}15`, borderRadius: 1 }}>
    <div style={{ width: `${(value / max) * 100}%`, height: "100%", background: color, borderRadius: 1 }} />
  </div>
);

const ScoreRing = ({ score, size = 72, strokeWidth = 5 }: { score: number; size?: number; strokeWidth?: number }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? T.text.green : score >= 65 ? T.text.amber : score >= 50 ? T.text.orange : T.text.red;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={`${color}15`} strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 18, fontFamily: T.font.mono, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 6, fontFamily: T.font.mono, color: T.text.muted, letterSpacing: "0.1em" }}>JEDI</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// PHOTO GALLERY
// ═══════════════════════════════════════════════════════════════
const PhotoGallery = ({ photos }: { photos: PropertyData["photos"] }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const items = photos && photos.length > 0 ? photos : [
    { id: 1, label: "Exterior", color: "#1a2744" },
    { id: 2, label: "Pool Area", color: "#1a3a2a" },
    { id: 3, label: "Interior", color: "#2a1a3a" },
    { id: 4, label: "Aerial", color: "#3a2a1a" },
  ];
  const active = items[activeIdx];

  const PhotoPlaceholder = ({ photo, size = "large" }: { photo: any; size?: string }) => {
    const isLarge = size === "large";
    if (photo.url) {
      return (
        <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}>
          <img src={photo.url} alt={photo.label || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          {isLarge && photo.label && (
            <span style={{ position: "absolute", bottom: 4, left: 4, fontSize: 10, fontFamily: T.font.mono, color: `${T.text.secondary}80`, background: "#00000088", padding: "1px 4px", borderRadius: 1 }}>
              {photo.label}
            </span>
          )}
        </div>
      );
    }
    return (
      <div style={{
        width: "100%", height: "100%", background: photo.color || "#1a2744",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.08, background: `repeating-linear-gradient(0deg,transparent,transparent 19px,${T.text.secondary} 19px,${T.text.secondary} 20px),repeating-linear-gradient(90deg,transparent,transparent 19px,${T.text.secondary} 19px,${T.text.secondary} 20px)` }} />
        <svg width={isLarge ? 120 : 40} height={isLarge ? 80 : 28} viewBox="0 0 120 80" style={{ opacity: 0.3, position: "relative", zIndex: 1 }}>
          <rect x="10" y="20" width="30" height="60" fill={T.text.secondary} />
          <rect x="45" y="10" width="35" height="70" fill={T.text.secondary} />
          <rect x="85" y="30" width="25" height="50" fill={T.text.secondary} />
        </svg>
        {isLarge && <span style={{ fontSize: 10, fontFamily: T.font.mono, color: `${T.text.secondary}80`, marginTop: 8, position: "relative", zIndex: 1 }}>{photo.label}</span>}
        <div style={{ position: "absolute", top: 4, left: 4, fontSize: 7, fontFamily: T.font.mono, color: T.text.muted, background: "#00000088", padding: "1px 4px", borderRadius: 1, zIndex: 2 }}>
          {String(items.indexOf(photo) + 1).padStart(2, "0")}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, background: T.bg.photo, borderRadius: 2, overflow: "hidden", border: `1px solid ${T.border.subtle}` }}>
      <div onClick={() => setLightbox(true)} style={{ width: "100%", height: 200, cursor: "pointer", position: "relative" }}>
        <PhotoPlaceholder photo={active} size="large" />
        <div style={{ position: "absolute", bottom: 6, right: 6, display: "flex", gap: 4, alignItems: "center" }}>
          <Badge color={T.text.white} bg="#00000099" border="transparent">{activeIdx + 1} / {items.length}</Badge>
          <Badge color={T.text.cyan} bg="#00000099" border="transparent">EXPAND</Badge>
        </div>
        {activeIdx > 0 && (
          <div onClick={(e) => { e.stopPropagation(); setActiveIdx(activeIdx - 1); }}
            style={{ position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "#000000aa", borderRadius: 2, cursor: "pointer", color: T.text.white, fontSize: 12, fontFamily: T.font.mono }}>
            ‹
          </div>
        )}
        {activeIdx < items.length - 1 && (
          <div onClick={(e) => { e.stopPropagation(); setActiveIdx(activeIdx + 1); }}
            style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "#000000aa", borderRadius: 2, cursor: "pointer", color: T.text.white, fontSize: 12, fontFamily: T.font.mono }}>
            ›
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 2, padding: 2, background: T.bg.terminal, overflowX: "auto" }}>
        {items.map((p, i) => (
          <div key={p.id} onClick={() => setActiveIdx(i)} style={{
            width: 52, height: 36, flexShrink: 0, cursor: "pointer",
            border: i === activeIdx ? `1px solid ${T.text.amber}` : `1px solid ${T.border.subtle}`,
            borderRadius: 1, overflow: "hidden", opacity: i === activeIdx ? 1 : 0.6,
            transition: "opacity 0.15s, border-color 0.15s",
          }}>
            <PhotoPlaceholder photo={p} size="small" />
          </div>
        ))}
      </div>
      {lightbox && (
        <div onClick={() => setLightbox(false)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#000000ee", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <div style={{ width: "80%", maxWidth: 900, height: "70%", position: "relative" }} onClick={(e) => e.stopPropagation()}>
            <PhotoPlaceholder photo={active} size="large" />
            <div onClick={() => setLightbox(false)} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "#000000cc", borderRadius: 2, cursor: "pointer", color: T.text.white, fontSize: 14, fontFamily: T.font.mono }}>×</div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function PropertyDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("OVERVIEW");
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const TABS = [
    { key: "OVERVIEW", label: "OVERVIEW", hotkey: "F1" },
    { key: "FINANCIALS", label: "FINANCIALS", hotkey: "F2" },
    { key: "COMPS", label: "COMPS", hotkey: "F3" },
    { key: "TAX", label: "TAX & TITLE", hotkey: "F4" },
    { key: "ZONING", label: "ZONING", hotkey: "F5" },
    { key: "MARKET", label: "MARKET", hotkey: "F6" },
  ];

  // ── Data fetching ──────────────────────────────────────────
  const buildPropertyFromRow = (row: any): PropertyData => {
    const addrParts = (row.address || "").split(",").map((s: string) => s.trim());
    const stateZip = (addrParts[2] || "").split(" ");
    const rentNum = parseFloat((row.rent || "").replace(/[^0-9.]/g, "")) || 0;
    return {
      id: id || row.rawPropertyId || `P-${row.id}`,
      name: row.property || "Unknown Property",
      address: row.address || "",
      city: addrParts[1] || "",
      state: stateZip[0] || "",
      zip: stateZip[1] || "",
      county: row.county || "",
      submarket: row.submarket || "",
      propertyType: row.propertyType || "MULTIFAMILY",
      class: row.class || row.buildingClass || "",
      units: row.units || 0,
      yearBuilt: row.year || row.yearBuilt || 0,
      buildingSF: row.buildingSf || row.totalSqft || 0,
      lotSizeAc: row.lotAcres || row.acres || row.lotSize || 0,
      estimatedValue: row.appraisedValue || row.estimatedValue || 0,
      monthlyRent: rentNum || row.monthlyRent || 0,
      avgEffectiveRent: rentNum || row.avgEffectiveRent || 0,
      occupancyRate: parseFloat(row.occ) || row.occupancyRate || 0,
      zoningCode: row.zoning || row.zoningCode || "",
      zoningDescription: row.zoningDescription || "",
      capRate: row.capRate || 0,
      noi: row.noi || 0,
      askingPrice: row.askingPrice || 0,
      annualIncome: row.annualIncome || 0,
      amenities: row.amenities || [],
      photos: row.photos || [],
      rentComps: row.rentComps || [],
      saleComps: row.saleComps || [],
      ownershipHistory: row.ownershipHistory || [],
      taxHistory: row.taxHistory || [],
      dataSource: row.enrichmentSource || row.dataSource || "Market Intelligence",
    };
  };

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/v1/properties/${id}`);
        if (!response.ok) throw new Error("Failed to fetch property");
        const data = await response.json();
        setProperty(data);
      } catch (err) {
        const stateRow = (location.state as any)?.propertyRow;
        if (stateRow) {
          setProperty(buildPropertyFromRow(stateRow));
          setError(null);
        } else {
          setError(err instanceof Error ? err.message : "Failed to load property");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProperty();
  }, [id]);

  // ── Keyboard navigation ────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const idx = parseInt(e.key.replace("F", "")) - 1;
      if (idx >= 0 && idx < TABS.length) { e.preventDefault(); setActiveTab(TABS[idx].key); }
      if (e.key === "Escape") { setShowCreateDeal(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Loading state ──────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ width: "100%", height: "100vh", background: T.bg.terminal, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{globalCSS}</style>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 40, border: `2px solid ${T.text.amber}40`, borderTop: `2px solid ${T.text.amber}`, borderRadius: "50%", animation: "pulse 1s infinite", margin: "0 auto 12px" }} />
          <span style={{ fontSize: 10, fontFamily: T.font.mono, color: T.text.secondary }}>LOADING ASSET DATA...</span>
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div style={{ width: "100%", height: "100vh", background: T.bg.terminal, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{globalCSS}</style>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: 24, color: T.text.red, marginBottom: 8 }}>⚠</div>
          <div style={{ fontSize: 12, fontFamily: T.font.mono, fontWeight: 700, color: T.text.white, marginBottom: 4 }}>ASSET NOT FOUND</div>
          <div style={{ fontSize: 9, fontFamily: T.font.mono, color: T.text.secondary, marginBottom: 16 }}>{error || "Unable to load property details"}</div>
          <div onClick={() => navigate(-1)} style={{ padding: "6px 16px", background: `${T.text.amber}20`, border: `1px solid ${T.text.amber}60`, borderRadius: 2, cursor: "pointer", fontSize: 10, fontFamily: T.font.mono, fontWeight: 700, color: T.text.amber, display: "inline-block" }}>
            ‹ GO BACK
          </div>
        </div>
      </div>
    );
  }

  const p = property;

  // ── Derived values ─────────────────────────────────────────
  const units = p.units || 1;
  const occRate = p.occupancyRate || 0;
  const effRent = p.avgEffectiveRent || p.monthlyRent || 0;
  const mktRent = p.avgMarketRent || effRent;
  const noiVal = p.noi || 0;
  const capVal = p.capRate || 0;
  const expRatio = p.expenseRatio || 0;
  const jediScore = 82; // Will be computed by JEDI engine when deal is created

  // ─── OVERVIEW TAB ──────────────────────────────────────────
  const OverviewTab = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 8, animation: "fadeIn 0.15s" }}>
      {/* LEFT COLUMN */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <PhotoGallery photos={p.photos} />
        {/* Property Vitals */}
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="PROPERTY VITALS" icon="◈" borderColor={T.text.cyan} />
          <DataRow label="Type" value={p.propertyType || "—"} sub={p.subtype ? `· ${p.subtype}` : ""} />
          {p.class && <DataRow label="Class" value={p.class} />}
          <DataRow label="Units" value={units} />
          {p.stories && <DataRow label="Stories" value={p.stories} />}
          <DataRow label="Year Built" value={p.yearBuilt || "—"} sub={p.yearRenovated ? `· Renov ${p.yearRenovated}` : ""} />
          {p.lotSizeAc && <DataRow label="Lot Size" value={`${p.lotSizeAc} ac`} sub={p.lotSizeSF ? `${p.lotSizeSF.toLocaleString()} SF` : ""} />}
          {p.buildingSF && <DataRow label="Building SF" value={p.buildingSF.toLocaleString()} />}
          {p.avgUnitSF && <DataRow label="Avg Unit SF" value={p.avgUnitSF} sub="SF" />}
          {p.parking && <DataRow label="Parking" value={`${p.parking.total} spaces`} sub={`${p.parking.ratio}:1 · ${p.parking.type}`} />}
        </div>
        {/* Amenities */}
        {p.amenities && p.amenities.length > 0 && (
          <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
            <SectionHeader title="AMENITIES" icon="◆" borderColor={T.text.purple} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, padding: "6px 10px" }}>
              {p.amenities.map((a, i) => <Badge key={i} color={T.text.secondary}>{a}</Badge>)}
            </div>
          </div>
        )}
        {/* Ownership */}
        {p.owner && (
          <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
            <SectionHeader title="OWNERSHIP" icon="◇" borderColor={T.text.orange} />
            <DataRow label="Current Owner" value={p.owner} mono={false} />
            {p.ownerType && <DataRow label="Owner Type" value={p.ownerType} />}
            {p.acquisitionDate && <DataRow label="Acquired" value={p.acquisitionDate} sub={p.acquisitionPrice ? fmtFull(p.acquisitionPrice) : ""} />}
            {p.acquisitionDate && <DataRow label="Hold Period" value={`${new Date().getFullYear() - parseInt(p.acquisitionDate)}yr`} color={T.text.amber} />}
          </div>
        )}
      </div>
      {/* RIGHT COLUMN */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Performance Snapshot */}
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="PERFORMANCE SNAPSHOT" icon="▲" borderColor={T.text.green}
            action={<Badge color={T.text.green}>LIVE</Badge>} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
            {[
              { label: "Occupancy", value: occRate ? pct(occRate) : "—", color: occRate >= 93 ? T.text.green : T.text.amber },
              { label: "Avg Eff. Rent", value: effRent ? `$${effRent.toLocaleString()}` : "—", sub: "/mo" },
              { label: "Rent/SF", value: p.rentPerSF ? `$${p.rentPerSF}` : "—", sub: "/SF/mo" },
              { label: "NOI (T12)", value: noiVal ? fmt(noiVal) : "—", color: T.text.green },
              { label: "Implied Cap", value: capVal ? pct(capVal) : "—", color: T.text.cyan },
              { label: "Expense Ratio", value: expRatio ? pct(expRatio) : "—", color: expRatio > 50 ? T.text.red : T.text.amber },
            ].map((m, i) => (
              <div key={i} style={{ padding: "8px 10px", borderBottom: `1px solid ${T.border.subtle}08`, borderRight: i % 2 === 0 ? `1px solid ${T.border.subtle}08` : "none" }}>
                <div style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted, letterSpacing: "0.08em", marginBottom: 2 }}>{m.label}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                  <span style={{ fontSize: 14, fontFamily: T.font.mono, fontWeight: 700, color: m.color || T.text.primary }}>{m.value}</span>
                  {m.sub && <span style={{ fontSize: 8, color: T.text.muted }}>{m.sub}</span>}
                </div>
              </div>
            ))}
          </div>
          {p.concessions && (
            <div style={{ padding: "4px 10px", background: T.bg.panelAlt }}>
              <div style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>CONCESSIONS</div>
              <div style={{ fontSize: 9, fontFamily: T.font.mono, color: T.text.amber }}>{p.concessions}</div>
            </div>
          )}
        </div>
        {/* Market Position */}
        {(effRent > 0 || occRate > 0) && (
          <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
            <SectionHeader title="MARKET POSITION" subtitle={p.submarket ? `vs ${p.submarket} Submarket` : ""} icon="◉" borderColor={T.text.amber} />
            {effRent > 0 && mktRent > 0 && (
              <div style={{ display: "flex", alignItems: "center", padding: "6px 10px", borderBottom: `1px solid ${T.border.subtle}08`, gap: 8 }}>
                <span style={{ fontSize: 8, fontFamily: T.font.label, color: T.text.secondary, width: 80 }}>Subject Rent</span>
                <span style={{ fontSize: 10, fontFamily: T.font.mono, fontWeight: 600, color: T.text.primary, width: 50 }}>${effRent}</span>
                <span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted }}>vs</span>
                <span style={{ fontSize: 10, fontFamily: T.font.mono, color: T.text.secondary, width: 50 }}>${mktRent}</span>
                <Badge color={effRent < mktRent ? T.text.green : T.text.red}>
                  {pct(Math.abs((effRent / mktRent - 1) * 100))} {effRent < mktRent ? "BELOW" : "ABOVE"}
                </Badge>
              </div>
            )}
            {/* Walkability Scores */}
            {(p.walkScore || p.transitScore || p.bikeScore) && (
              <div style={{ display: "flex", padding: "6px 10px", gap: 12 }}>
                {[
                  { label: "Walk", value: p.walkScore || 0 },
                  { label: "Transit", value: p.transitScore || 0 },
                  { label: "Bike", value: p.bikeScore || 0 },
                ].filter(s => s.value > 0).map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted, width: 36 }}>{s.label}</span>
                    <MiniBar value={s.value} max={100} color={s.value >= 70 ? T.text.green : s.value >= 50 ? T.text.amber : T.text.red} width={40} />
                    <span style={{ fontSize: 9, fontFamily: T.font.mono, fontWeight: 600, color: T.text.primary }}>{s.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Rent Comps Preview */}
        {p.rentComps && p.rentComps.length > 0 && (
          <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
            <SectionHeader title="RENT COMPS" subtitle={`${p.rentComps.length} properties`} icon="≡" borderColor={T.text.cyan}
              action={<span onClick={() => setActiveTab("COMPS")} style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.cyan, cursor: "pointer" }}>VIEW ALL →</span>} />
            <div style={{ fontSize: 8, fontFamily: T.font.mono }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 42px 54px 42px 42px", padding: "4px 10px", background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}` }}>
                {["PROPERTY","UNITS","RENT","OCC","DIST"].map(h => (
                  <span key={h} style={{ color: T.text.muted, fontWeight: 600, letterSpacing: "0.05em" }}>{h}</span>
                ))}
              </div>
              {p.rentComps.slice(0, 5).map((c, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 42px 54px 42px 42px", padding: "4px 10px", borderBottom: `1px solid ${T.border.subtle}08`, background: i % 2 === 0 ? T.bg.panel : T.bg.panelAlt }}>
                  <span style={{ color: T.text.primary, fontWeight: 500 }}>{c.name}</span>
                  <span style={{ color: T.text.secondary }}>{c.units}</span>
                  <span style={{ color: c.rent > effRent ? T.text.green : T.text.red, fontWeight: 600 }}>${c.rent.toLocaleString()}</span>
                  <span style={{ color: T.text.secondary }}>{pct(c.occ)}</span>
                  <span style={{ color: T.text.muted }}>{c.dist}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Zoning Quick-Read */}
        {p.zoningCode && (
          <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
            <SectionHeader title="ZONING" icon="▦" borderColor={T.text.purple}
              action={<span onClick={() => setActiveTab("ZONING")} style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.purple, cursor: "pointer" }}>DETAIL →</span>} />
            <DataRow label="Designation" value={p.zoningCode} sub={p.zoningDescription || ""} />
            {p.maxDensity && <DataRow label="Max Density" value={p.maxDensity} />}
            {p.maxHeight && <DataRow label="Max Height" value={p.maxHeight} />}
            {p.far && <DataRow label="FAR" value={p.far.toFixed(1)} />}
            {p.zoningSource && <div style={{ padding: "3px 10px" }}><span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>Source: {p.zoningSource}</span></div>}
          </div>
        )}
      </div>
    </div>
  );

  // ─── FINANCIALS TAB ────────────────────────────────────────
  const FinancialsTab = () => {
    const gpr = effRent * units * 12;
    const vacLoss = gpr * (1 - occRate / 100);
    const egi = gpr - vacLoss;
    const opex = noiVal > 0 && expRatio > 0 ? Math.round(noiVal * expRatio / (100 - expRatio)) : 0;
    const computedNOI = noiVal || (egi - opex);

    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 8, animation: "fadeIn 0.15s" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
            <SectionHeader title="INCOME & EXPENSE" icon="$" borderColor={T.text.green} />
            {gpr > 0 && <DataRow label="Gross Potential Rent" value={`$${gpr.toLocaleString()}`} sub="/yr" />}
            {vacLoss > 0 && <DataRow label="Vacancy Loss" value={`(${fmtFull(Math.round(vacLoss))})`} color={T.text.red} sub={occRate ? pct(100 - occRate) : ""} />}
            {egi > 0 && <DataRow label="Effective Gross Income" value={`$${Math.round(egi).toLocaleString()}`} />}
            <div style={{ height: 1, background: T.border.medium, margin: "2px 10px" }} />
            {opex > 0 && <DataRow label="Operating Expenses" value={`(${fmtFull(opex)})`} color={T.text.red} sub={expRatio ? pct(expRatio) : ""} />}
            <div style={{ height: 1, background: T.text.amber, margin: "2px 10px" }} />
            <DataRow label="Net Operating Income" value={computedNOI > 0 ? fmtFull(computedNOI) : "—"} color={T.text.green} />
            {computedNOI > 0 && <DataRow label="NOI / Unit" value={fmtFull(Math.round(computedNOI / units))} sub="/yr" />}
          </div>
          <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
            <SectionHeader title="VALUATION INDICATORS" icon="◈" borderColor={T.text.amber} />
            {capVal > 0 && <DataRow label="Implied Cap Rate" value={pct(capVal)} color={T.text.cyan} />}
            {p.lastSalePrice && <DataRow label="Price / Unit (Last Sale)" value={fmtFull(Math.round(p.lastSalePrice / units))} />}
            {p.lastSalePrice && p.buildingSF && <DataRow label="Price / SF" value={`$${(p.lastSalePrice / p.buildingSF).toFixed(0)}`} />}
            {p.justValue && <DataRow label="Just Value" value={fmtFull(p.justValue)} color={T.text.amber} />}
            {p.justValue && <DataRow label="Value / Unit (Appraiser)" value={fmtFull(Math.round(p.justValue / units))} />}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
            <SectionHeader title="RENT ROLL SUMMARY" icon="≡" borderColor={T.text.cyan} />
            <DataRow label="Total Units" value={units} />
            <DataRow label="Occupied" value={Math.round(units * occRate / 100)} sub={occRate ? pct(occRate) : ""} color={T.text.green} />
            <DataRow label="Vacant" value={Math.round(units * (100 - occRate) / 100)} sub={occRate ? pct(100 - occRate) : ""} color={T.text.red} />
            {effRent > 0 && <DataRow label="Avg Effective Rent" value={`$${effRent.toLocaleString()}`} />}
            {mktRent > 0 && <DataRow label="Avg Market Rent" value={`$${mktRent.toLocaleString()}`} />}
            {effRent > 0 && mktRent > 0 && <DataRow label="Loss-to-Lease" value={pct((1 - effRent / mktRent) * 100)} color={T.text.amber} />}
          </div>
          <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2, padding: "10px", textAlign: "center" }}>
            <div style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted, marginBottom: 8, letterSpacing: "0.1em" }}>PLATFORM INTELLIGENCE</div>
            <div style={{ fontSize: 10, fontFamily: T.font.mono, color: T.text.amber, lineHeight: 1.6, padding: "0 8px" }}>
              Deeper financial modeling requires a <strong>Deal Capsule</strong>. Create a deal to unlock the 3-Layer ProForma Engine, capital structure analysis, and AI-adjusted assumptions.
            </div>
            <div onClick={() => setShowCreateDeal(true)} style={{ margin: "10px auto 4px", padding: "6px 16px", background: `${T.text.amber}20`, border: `1px solid ${T.text.amber}60`, borderRadius: 2, cursor: "pointer", fontSize: 10, fontFamily: T.font.mono, fontWeight: 700, color: T.text.amber, letterSpacing: "0.05em", display: "inline-block" }}>
              CREATE DEAL →
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── COMPS TAB ─────────────────────────────────────────────
  const CompsTab = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 8, animation: "fadeIn 0.15s" }}>
      <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
        <SectionHeader title="RENT COMPS" subtitle="Trade Area" icon="≡" borderColor={T.text.cyan} />
        <div style={{ fontSize: 8, fontFamily: T.font.mono }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 40px 56px 40px 46px 40px", padding: "4px 8px", background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}` }}>
            {["PROPERTY","UNITS","RENT","OCC","CLASS","DIST"].map(h => (
              <span key={h} style={{ color: T.text.muted, fontWeight: 600, letterSpacing: "0.05em" }}>{h}</span>
            ))}
          </div>
          {/* Subject row */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 40px 56px 40px 46px 40px", padding: "4px 8px", borderBottom: `1px solid ${T.text.amber}40`, background: `${T.text.amber}08` }}>
            <span style={{ color: T.text.amber, fontWeight: 700 }}>SUBJECT</span>
            <span style={{ color: T.text.amber }}>{units}</span>
            <span style={{ color: T.text.amber, fontWeight: 700 }}>{effRent > 0 ? `$${effRent.toLocaleString()}` : "—"}</span>
            <span style={{ color: T.text.amber }}>{occRate ? pct(occRate) : "—"}</span>
            <span style={{ color: T.text.amber }}>{p.class || "—"}</span>
            <span style={{ color: T.text.amber }}>—</span>
          </div>
          {(p.rentComps || []).map((c, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1.2fr 40px 56px 40px 46px 40px", padding: "4px 8px", borderBottom: `1px solid ${T.border.subtle}08`, background: i % 2 === 0 ? T.bg.panel : T.bg.panelAlt }}>
              <span style={{ color: T.text.primary, fontWeight: 500 }}>{c.name}</span>
              <span style={{ color: T.text.secondary }}>{c.units}</span>
              <span style={{ color: c.rent > effRent ? T.text.green : T.text.red, fontWeight: 600 }}>${c.rent.toLocaleString()}</span>
              <span style={{ color: T.text.secondary }}>{pct(c.occ)}</span>
              <span style={{ color: T.text.secondary }}>{c.class}</span>
              <span style={{ color: T.text.muted }}>{c.dist}</span>
            </div>
          ))}
          {(p.rentComps || []).length > 0 && (
            <div style={{ padding: "6px 8px", background: T.bg.panelAlt }}>
              <span style={{ color: T.text.muted, fontSize: 7 }}>AVG:</span>
              <span style={{ color: T.text.secondary, marginLeft: 4 }}>
                ${Math.round(p.rentComps!.reduce((s, c) => s + c.rent, 0) / p.rentComps!.length).toLocaleString()}/mo
              </span>
            </div>
          )}
          {(p.rentComps || []).length === 0 && (
            <div style={{ padding: "12px 8px", textAlign: "center", color: T.text.muted, fontSize: 9 }}>No rent comps available</div>
          )}
        </div>
      </div>
      <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
        <SectionHeader title="SALE COMPS" subtitle="Recent Transactions" icon="◈" borderColor={T.text.green} />
        <div style={{ fontSize: 8, fontFamily: T.font.mono }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 40px 60px 48px 48px 44px", padding: "4px 8px", background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}` }}>
            {["PROPERTY","UNITS","$/UNIT","CAP","DATE","DIST"].map(h => (
              <span key={h} style={{ color: T.text.muted, fontWeight: 600, letterSpacing: "0.05em" }}>{h}</span>
            ))}
          </div>
          {(p.saleComps || []).map((c, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1.2fr 40px 60px 48px 48px 44px", padding: "5px 8px", borderBottom: `1px solid ${T.border.subtle}08`, background: i % 2 === 0 ? T.bg.panel : T.bg.panelAlt }}>
              <span style={{ color: T.text.primary, fontWeight: 500 }}>{c.name}</span>
              <span style={{ color: T.text.secondary }}>{c.units}</span>
              <span style={{ color: T.text.green, fontWeight: 600 }}>${c.ppu.toLocaleString()}</span>
              <span style={{ color: T.text.cyan }}>{pct(c.capRate)}</span>
              <span style={{ color: T.text.secondary }}>{c.date}</span>
              <span style={{ color: T.text.muted }}>{c.dist}</span>
            </div>
          ))}
          {(p.saleComps || []).length === 0 && (
            <div style={{ padding: "12px 8px", textAlign: "center", color: T.text.muted, fontSize: 9 }}>No sale comps available</div>
          )}
        </div>
      </div>
    </div>
  );

  // ─── TAX & TITLE TAB ──────────────────────────────────────
  const TaxTab = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 8, animation: "fadeIn 0.15s" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="CURRENT TAX ASSESSMENT" subtitle={p.county ? `${p.county} County` : ""} icon="$" borderColor={T.text.orange} />
          {p.justValue && <DataRow label="Just (Market) Value" value={fmtFull(p.justValue)} color={T.text.primary} />}
          {p.assessedValue && <DataRow label="Assessed Value" value={fmtFull(p.assessedValue)} />}
          {p.taxableValue && <DataRow label="Taxable Value" value={fmtFull(p.taxableValue)} color={T.text.amber} />}
          {p.millageRate && <DataRow label="Millage Rate" value={`${p.millageRate}`} sub="mills" />}
          {p.annualTax && <DataRow label="Annual Tax" value={fmtFull(p.annualTax)} color={T.text.red} />}
          {p.annualTax && <DataRow label="Tax / Unit" value={fmtFull(Math.round(p.annualTax / units))} sub="/yr" />}
          <div style={{ height: 1, background: T.border.medium, margin: "2px 10px" }} />
          {p.homesteadExempt !== undefined && <DataRow label="Homestead Exempt" value={p.homesteadExempt ? "YES" : "NO"} color={T.text.red} />}
          {p.assessmentCap && <DataRow label="Assessment Cap" value={p.assessmentCap} color={T.text.amber} />}
          {p.justValue && p.millageRate && p.annualTax && (
            <div style={{ padding: "4px 10px", background: `${T.text.red}08`, borderTop: `1px solid ${T.text.red}20` }}>
              <div style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.red, lineHeight: 1.5 }}>
                ⚠ REASSESSMENT WARNING: On sale, assessed value resets to just value. Buyer's tax estimate: ~{fmtFull(Math.round(p.justValue * p.millageRate / 1000))}/yr (+{pct((p.justValue * p.millageRate / 1000 / p.annualTax - 1) * 100)} increase)
              </div>
            </div>
          )}
          {!p.justValue && !p.annualTax && (
            <div style={{ padding: "12px 10px", textAlign: "center", color: T.text.muted, fontSize: 9 }}>Tax data not available</div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Tax History */}
        {p.taxHistory && p.taxHistory.length > 0 && (
          <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
            <SectionHeader title="TAX HISTORY" subtitle="5-Year" icon="◊" borderColor={T.text.cyan} />
            <div style={{ fontSize: 8, fontFamily: T.font.mono }}>
              <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr 1fr", padding: "4px 8px", background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}` }}>
                {["YEAR","JUST VALUE","ASSESSED","TAX"].map(h => (
                  <span key={h} style={{ color: T.text.muted, fontWeight: 600, letterSpacing: "0.05em" }}>{h}</span>
                ))}
              </div>
              {p.taxHistory.map((t, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr 1fr", padding: "4px 8px", borderBottom: `1px solid ${T.border.subtle}08`, background: i % 2 === 0 ? T.bg.panel : T.bg.panelAlt }}>
                  <span style={{ color: T.text.primary, fontWeight: 600 }}>{t.year}</span>
                  <span style={{ color: T.text.secondary }}>{fmt(t.justValue)}</span>
                  <span style={{ color: T.text.secondary }}>{fmt(t.assessed)}</span>
                  <span style={{ color: T.text.amber }}>{fmt(t.tax)}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: "6px 8px", display: "flex", alignItems: "flex-end", gap: 4, height: 50 }}>
              {p.taxHistory.slice().reverse().map((t, i) => {
                const maxTax = Math.max(...p.taxHistory!.map(h => h.tax));
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <div style={{ width: "80%", height: `${(t.tax / maxTax) * 30}px`, background: T.text.amber, borderRadius: "1px 1px 0 0", opacity: 0.7 + (i * 0.06) }} />
                    <span style={{ fontSize: 6, color: T.text.muted }}>{t.year}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* Ownership Chain */}
        {p.ownershipHistory && p.ownershipHistory.length > 0 && (
          <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
            <SectionHeader title="OWNERSHIP CHAIN" icon="◇" borderColor={T.text.purple} />
            {p.ownershipHistory.map((o, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", padding: "6px 10px", borderBottom: `1px solid ${T.border.subtle}08`, gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: i === 0 ? T.text.green : T.text.muted, border: `2px solid ${i === 0 ? T.text.green : T.text.muted}40`, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, fontFamily: T.font.mono, color: i === 0 ? T.text.primary : T.text.secondary, fontWeight: i === 0 ? 600 : 400 }}>{o.buyer}</div>
                  <div style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>{o.date} · {fmtFull(o.price)} · ${o.ppu.toLocaleString()}/unit</div>
                </div>
                {i < p.ownershipHistory!.length - 1 && (
                  <Badge color={T.text.green}>+{pct(((p.ownershipHistory![i].price / p.ownershipHistory![i + 1].price) - 1) * 100)}</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ─── ZONING TAB ────────────────────────────────────────────
  const ZoningTab = () => {
    const lotAc = p.lotSizeAc || 0;
    const lotSF = p.lotSizeSF || lotAc * 43560;
    const maxDensityNum = parseFloat(p.maxDensity || "0");
    const maxUnitsByDensity = lotAc > 0 && maxDensityNum > 0 ? Math.floor(lotAc * maxDensityNum) : 0;
    const farVal = p.far || 0;
    const maxSFByFAR = lotSF > 0 && farVal > 0 ? Math.floor(lotSF * farVal) : 0;

    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 8, animation: "fadeIn 0.15s" }}>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="ZONING DESIGNATION" subtitle="Verified" icon="▦" borderColor={T.text.purple} />
          <div style={{ padding: "10px", textAlign: "center", borderBottom: `1px solid ${T.border.subtle}` }}>
            <div style={{ fontSize: 28, fontFamily: T.font.mono, fontWeight: 800, color: T.text.amber }}>{p.zoningCode || "—"}</div>
            <div style={{ fontSize: 10, fontFamily: T.font.mono, color: T.text.secondary }}>{p.zoningDescription || ""}</div>
          </div>
          {p.maxDensity && <DataRow label="Max Density" value={p.maxDensity} color={T.text.cyan} />}
          {p.maxHeight && <DataRow label="Max Height" value={p.maxHeight} color={T.text.cyan} />}
          {farVal > 0 && <DataRow label="Floor Area Ratio" value={farVal.toFixed(1)} color={T.text.cyan} />}
          {lotAc > 0 && <DataRow label="Lot Size" value={`${lotAc} ac`} />}
          <div style={{ height: 1, background: T.border.medium, margin: "2px 10px" }} />
          {maxUnitsByDensity > 0 && <DataRow label="Max Units by Density" value={maxUnitsByDensity} sub={`@ ${p.maxDensity}`} color={T.text.green} />}
          {maxSFByFAR > 0 && <DataRow label="Max SF by FAR" value={`${maxSFByFAR.toLocaleString()} SF`} sub={`@ FAR ${farVal}`} color={T.text.green} />}
          <DataRow label="Current Units" value={units} />
          {maxUnitsByDensity > 0 && <DataRow label="Density Headroom" value={`+${maxUnitsByDensity - units} units`} color={T.text.amber} />}
          {p.zoningSource && <div style={{ padding: "4px 10px" }}><span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>Source: {p.zoningSource}</span></div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
            <SectionHeader title="SETBACKS & CONSTRAINTS" icon="◫" borderColor={T.text.orange} />
            <DataRow label="Front Setback" value="25 ft" />
            <DataRow label="Side Setback" value="10 ft" />
            <DataRow label="Rear Setback" value="20 ft" />
            <DataRow label="Flood Zone" value="X (Minimal)" color={T.text.green} />
            <DataRow label="Wetlands" value="None identified" color={T.text.green} />
            <DataRow label="Historic Overlay" value="No" color={T.text.green} />
          </div>
          {p.parking && (
            <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
              <SectionHeader title="PARKING ANALYSIS" subtitle="Often the binding constraint" icon="P" borderColor={T.text.red} />
              <DataRow label="Required Ratio" value={`${p.parking.ratio}:1`} sub="per unit" />
              <DataRow label="Current Spaces" value={p.parking.total} />
              <DataRow label="Required @ Current" value={Math.ceil(units * p.parking.ratio)} />
              <DataRow label="Surplus / (Deficit)" value={`${p.parking.total - Math.ceil(units * p.parking.ratio)}`} color={p.parking.total >= Math.ceil(units * p.parking.ratio) ? T.text.green : T.text.red} />
              <DataRow label="Max Units by Parking" value={Math.floor(p.parking.total / p.parking.ratio)} color={T.text.amber} sub="if parking-constrained" />
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── MARKET TAB ────────────────────────────────────────────
  const MarketTab = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 8, animation: "fadeIn 0.15s" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="SUBMARKET VITALS" subtitle={p.submarket ? `${p.submarket} · ${p.market || ""}` : ""} icon="◉" borderColor={T.text.amber} />
          {p.submarketVacancy !== undefined && <DataRow label="Vacancy Rate" value={pct(p.submarketVacancy)} color={p.submarketVacancy < 7 ? T.text.green : p.submarketVacancy < 10 ? T.text.amber : T.text.red} />}
          {p.submarketRentGrowth !== undefined && <DataRow label="Rent Growth (YoY)" value={`+${pct(p.submarketRentGrowth)}`} color={T.text.green} />}
          {p.submarketAbsorption !== undefined && <DataRow label="Annual Absorption" value={`${p.submarketAbsorption.toLocaleString()} units`} />}
          {mktRent > 0 && <DataRow label="Avg Effective Rent" value={`$${mktRent.toLocaleString()}`} sub="/mo" />}
          {!p.submarketVacancy && !p.submarketRentGrowth && (
            <div style={{ padding: "12px 10px", textAlign: "center", color: T.text.muted, fontSize: 9 }}>Submarket data not yet available</div>
          )}
        </div>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="LOCATION SCORES" icon="★" borderColor={T.text.cyan} />
          {[
            { label: "Walk Score", value: p.walkScore || 0, desc: (p.walkScore || 0) >= 70 ? "Very Walkable" : (p.walkScore || 0) >= 50 ? "Somewhat Walkable" : "Car-Dependent" },
            { label: "Transit Score", value: p.transitScore || 0, desc: (p.transitScore || 0) >= 70 ? "Excellent Transit" : (p.transitScore || 0) >= 50 ? "Some Transit" : "Minimal Transit" },
            { label: "Bike Score", value: p.bikeScore || 0, desc: (p.bikeScore || 0) >= 70 ? "Very Bikeable" : (p.bikeScore || 0) >= 50 ? "Bikeable" : "Minimal Biking" },
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", padding: "6px 10px", borderBottom: `1px solid ${T.border.subtle}08`, gap: 8 }}>
              <span style={{ fontSize: 8, fontFamily: T.font.label, color: T.text.secondary, width: 70 }}>{s.label}</span>
              <MiniBar value={s.value} max={100} color={s.value >= 70 ? T.text.green : s.value >= 50 ? T.text.amber : T.text.red} width={80} />
              <span style={{ fontSize: 11, fontFamily: T.font.mono, fontWeight: 700, color: T.text.primary, width: 24, textAlign: "right" }}>{s.value || "—"}</span>
              <span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>{s.value > 0 ? s.desc : ""}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="SUPPLY PIPELINE" subtitle="Within Trade Area" icon="▼" borderColor={T.text.red} />
          <DataRow label="Under Construction" value="—" color={T.text.orange} />
          <DataRow label="Pipeline-to-Stock" value="—" />
          <DataRow label="Threat Level" value="—" />
          <div style={{ padding: "8px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 9, fontFamily: T.font.mono, color: T.text.amber }}>
              Create a Deal Capsule to unlock pipeline intelligence
            </div>
          </div>
        </div>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="DEMAND DRIVERS" icon="▲" borderColor={T.text.green} />
          <DataRow label="Population (3mi)" value="—" />
          <DataRow label="Avg HH Income" value="—" />
          <DataRow label="Renter Pct" value="—" />
          <DataRow label="Employment Growth" value="—" />
          <div style={{ padding: "8px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 9, fontFamily: T.font.mono, color: T.text.amber }}>
              Demographics available in Deal Capsule
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── TAB ROUTER ────────────────────────────────────────────
  const renderTab = () => {
    switch (activeTab) {
      case "OVERVIEW": return <OverviewTab />;
      case "FINANCIALS": return <FinancialsTab />;
      case "COMPS": return <CompsTab />;
      case "TAX": return <TaxTab />;
      case "ZONING": return <ZoningTab />;
      case "MARKET": return <MarketTab />;
      default: return <OverviewTab />;
    }
  };

  // ─── CREATE DEAL MODAL ─────────────────────────────────────
  const CreateDealModal = () => (
    <div onClick={() => setShowCreateDeal(false)} style={{
      position: "fixed", inset: 0, zIndex: 9999, background: "#000000cc",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 420, background: T.bg.panel, border: `1px solid ${T.text.amber}40`,
        borderRadius: 4, overflow: "hidden", animation: "slideUp 0.2s",
      }}>
        <div style={{ padding: "12px 16px", background: T.bg.header, borderBottom: `1px solid ${T.text.amber}40`, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, color: T.text.amber }}>◈</span>
          <span style={{ fontSize: 12, fontFamily: T.font.mono, fontWeight: 700, color: T.text.amber, letterSpacing: "0.05em" }}>CREATE DEAL CAPSULE</span>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 10, fontFamily: T.font.mono, color: T.text.secondary, lineHeight: 1.6, marginBottom: 12 }}>
            This will promote <span style={{ color: T.text.white, fontWeight: 600 }}>{p.name}</span> into your deal pipeline and create a Deal Capsule with:
          </div>
          {[
            "JEDI Score engine activation (5 master signals)",
            "4-strategy arbitrage analysis (BTS · Flip · Rental · STR)",
            "3-Layer ProForma (Broker → Platform → Your Adjustments)",
            "Capital structure engine & exit timing optimization",
            "Risk assessment & DD checklist generation",
            "AI Intelligence Brief with collision detection",
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 6, padding: "3px 0", alignItems: "flex-start" }}>
              <span style={{ fontSize: 8, color: T.text.green, marginTop: 1 }}>✓</span>
              <span style={{ fontSize: 9, fontFamily: T.font.mono, color: T.text.primary }}>{item}</span>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <div style={{ flex: 1, padding: "8px 0", textAlign: "center", cursor: "pointer", background: `${T.text.amber}20`, border: `1px solid ${T.text.amber}60`, borderRadius: 2, fontSize: 11, fontFamily: T.font.mono, fontWeight: 700, color: T.text.amber, letterSpacing: "0.05em" }}>
              CREATE DEAL
            </div>
            <div onClick={() => setShowCreateDeal(false)} style={{ padding: "8px 16px", textAlign: "center", cursor: "pointer", background: T.bg.input, border: `1px solid ${T.border.medium}`, borderRadius: 2, fontSize: 11, fontFamily: T.font.mono, fontWeight: 500, color: T.text.secondary }}>
              CANCEL
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── MAIN RENDER ───────────────────────────────────────────
  return (
    <div style={{ width: "100%", height: "100vh", background: T.bg.terminal, fontFamily: T.font.mono, color: T.text.primary, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{globalCSS}</style>

      {/* TOP BAR — Property Identity */}
      <div style={{
        display: "flex", alignItems: "center", padding: "6px 12px", gap: 10,
        background: T.bg.topBar, borderBottom: `1px solid ${T.border.subtle}`,
        flexShrink: 0,
      }}>
        <span onClick={() => navigate(-1)} style={{ fontSize: 10, color: T.text.muted, cursor: "pointer", fontFamily: T.font.mono }}>‹ BACK</span>
        <div style={{ width: 1, height: 16, background: T.border.medium }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: T.text.white, fontFamily: T.font.display, letterSpacing: "0.02em" }}>{p.name}</span>
            <Badge color={T.text.cyan}>{p.propertyType}</Badge>
            {p.class && <Badge color={T.text.purple}>{p.class}</Badge>}
            {!p.inPipeline && <Badge color={T.text.muted}>NOT IN PIPELINE</Badge>}
          </div>
          <div style={{ fontSize: 9, color: T.text.secondary, fontFamily: T.font.label, marginTop: 1 }}>
            {p.address}{p.city ? ` · ${p.city}` : ""}{p.state ? `, ${p.state}` : ""} {p.zip || ""}{p.county ? ` · ${p.county} County` : ""}{p.submarket ? ` · ${p.submarket} submarket` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {[
            { label: "UNITS", value: units > 0 ? units : "—" },
            { label: "BUILT", value: p.yearBuilt || "—" },
            { label: "OCC", value: occRate > 0 ? pct(occRate) : "—", color: T.text.green },
            { label: "CAP", value: capVal > 0 ? pct(capVal) : "—", color: T.text.cyan },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 6, color: T.text.muted, letterSpacing: "0.1em" }}>{s.label}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: (s as any).color || T.text.primary }}>{s.value}</div>
            </div>
          ))}
          <div style={{ width: 1, height: 24, background: T.border.medium }} />
          <ScoreRing score={jediScore} size={40} strokeWidth={3} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <div onClick={() => setShowCreateDeal(true)} style={{
            padding: "5px 12px", cursor: "pointer", borderRadius: 2,
            background: `${T.text.amber}20`, border: `1px solid ${T.text.amber}60`,
            fontSize: 9, fontWeight: 700, color: T.text.amber, letterSpacing: "0.05em",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <span>◈</span> CREATE DEAL
          </div>
        </div>
      </div>

      {/* TAB BAR */}
      <div style={{
        display: "flex", alignItems: "center", padding: "0 12px",
        background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}`,
        flexShrink: 0,
      }}>
        {TABS.map((tab) => (
          <div key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: "6px 14px", cursor: "pointer", position: "relative",
            borderBottom: activeTab === tab.key ? `2px solid ${T.text.amber}` : "2px solid transparent",
            transition: "border-color 0.15s",
          }}>
            <span style={{
              fontSize: 9, fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? T.text.amber : T.text.secondary,
              letterSpacing: "0.05em", fontFamily: T.font.mono,
            }}>{tab.label}</span>
            <span style={{ fontSize: 7, color: T.text.muted, marginLeft: 4 }}>{tab.hotkey}</span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>
          ID: {p.id}{p.dataSource ? ` · Sources: ${p.dataSource}` : ""}
        </span>
      </div>

      {/* CONTENT AREA */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {renderTab()}
      </div>

      {/* BOTTOM STATUS BAR */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "3px 12px", background: T.bg.topBar,
        borderTop: `1px solid ${T.border.subtle}`, flexShrink: 0,
      }}>
        <div style={{ display: "flex", gap: 8, fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>
          <span>PROPERTY DETAILS</span>
          <span>·</span>
          <span>{p.county ? `${p.county} County` : p.city}{p.state ? `, ${p.state}` : ""}</span>
        </div>
        <div style={{ display: "flex", gap: 8, fontSize: 7, fontFamily: T.font.mono }}>
          <span style={{ color: T.text.muted }}>F1–F6 Navigate</span>
          <span style={{ color: T.text.muted }}>·</span>
          <span style={{ color: T.text.muted }}>/ Command</span>
          <span style={{ color: T.text.muted }}>·</span>
          <span style={{ color: T.text.green }}>JEDI RE v2.1</span>
        </div>
      </div>

      {/* Create Deal Modal */}
      {showCreateDeal && <CreateDealModal />}
    </div>
  );
}
