import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
// JEDI RE — PROPERTY DETAILS PAGE
// Bloomberg Terminal aesthetic · Asset intelligence view
// Answers: "What IS this property?" (not "Should I buy it?")
// Bridge to Deal Pipeline via CREATE DEAL action
// ═══════════════════════════════════════════════════════════════

const T = {
  bg: { terminal:"#0A0E17",panel:"#0F1319",panelAlt:"#131821",header:"#1A1F2E",hover:"#1E2538",active:"#252D40",input:"#0D1117",topBar:"#050810",photo:"#080B12" },
  text: { primary:"#E8ECF1",secondary:"#8B95A5",muted:"#4A5568",amber:"#F5A623",amberBright:"#FFD166",green:"#00D26A",red:"#FF4757",cyan:"#00BCD4",orange:"#FF8C42",purple:"#A78BFA",white:"#FFFFFF",blue:"#4A9EFF" },
  border: { subtle:"#1E2538",medium:"#2A3348",bright:"#3B4A6B" },
  font: { mono:"'JetBrains Mono','Fira Code','SF Mono',monospace",display:"'IBM Plex Mono',monospace",label:"'IBM Plex Sans',sans-serif" },
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
@keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes glow{0%,100%{box-shadow:0 0 4px #00D26A44}50%{box-shadow:0 0 10px #00D26A66}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
@keyframes scanline{0%{top:-100%}100%{top:100%}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
*{scrollbar-width:thin;scrollbar-color:#2A3348 #0A0E17;box-sizing:border-box}
*::-webkit-scrollbar{width:5px;height:5px}
*::-webkit-scrollbar-track{background:#0A0E17}
*::-webkit-scrollbar-thumb{background:#2A3348;border-radius:2px}
`;

// ─── MOCK PROPERTY DATA ──────────────────────────────────────
const PROPERTY = {
  id: "P-TPA-00247",
  name: "Westshore Commons",
  address: "4201 W Boy Scout Blvd",
  city: "Tampa",
  state: "FL",
  zip: "33607",
  county: "Hillsborough",
  market: "Tampa MSA",
  submarket: "Westshore",
  type: "MULTIFAMILY",
  subtype: "Garden Style",
  class: "B+",
  yearBuilt: 2004,
  yearRenovated: 2019,
  units: 248,
  stories: 3,
  lotSizeSF: 287_540,
  lotSizeAc: 6.6,
  buildingSF: 224_640,
  avgUnitSF: 906,
  parking: { total: 372, ratio: 1.5, type: "Surface + Covered" },
  amenities: ["Pool","Fitness","Dog Park","Business Center","Package Lockers","EV Charging"],
  // Ownership & Tax (M26)
  owner: "Westshore Holdings LLC",
  ownerType: "LLC / Entity",
  acquisitionDate: "2019-03-15",
  acquisitionPrice: 32_200_000,
  lastSalePrice: 32_200_000,
  justValue2025: 38_800_000,
  assessedValue2025: 35_100_000,
  taxableValue2025: 35_100_000,
  millageRate: 21.4536,
  annualTax2025: 753_000,
  homesteadExempt: false,
  assessmentCap: "10% Non-Homestead",
  // Performance
  currentOccupancy: 93.5,
  avgEffectiveRent: 1_842,
  avgMarketRent: 1_908,
  rentPerSF: 2.03,
  concessions: "1 mo free on 14-mo lease",
  noiTrailing12: 2_680_000,
  capRateImplied: 6.92,
  expenseRatio: 48.2,
  // Market context
  submarketVacancy: 8.5,
  submarketRentGrowth: 3.0,
  submarketAbsorption: 11_658,
  walkScore: 62,
  transitScore: 44,
  bikeScore: 51,
  // Zoning
  zoning: "PD-C",
  zoningDesc: "Planned Development – Commercial",
  maxDensity: "18 DU/ac",
  maxHeight: "65 ft",
  far: 2.0,
  zoningSource: "Municode §27-156",
  // Pipeline status
  inPipeline: false,
  dealId: null,
  // Photos (placeholder URLs — aspect ratios for the gallery)
  photos: [
    { id: 1, label: "Exterior", aspect: "16:9", color: "#1a2744" },
    { id: 2, label: "Pool Area", aspect: "16:9", color: "#1a3a2a" },
    { id: 3, label: "Fitness Center", aspect: "16:9", color: "#2a1a3a" },
    { id: 4, label: "Unit Interior", aspect: "16:9", color: "#3a2a1a" },
    { id: 5, label: "Kitchen", aspect: "16:9", color: "#1a3a3a" },
    { id: 6, label: "Aerial View", aspect: "16:9", color: "#2a2a1a" },
    { id: 7, label: "Lobby", aspect: "16:9", color: "#1a2a3a" },
    { id: 8, label: "Parking", aspect: "16:9", color: "#2a1a2a" },
  ],
  // Comp context
  rentComps: [
    { name: "Bay Club at Westshore", units: 312, rent: 1_955, dist: "0.4 mi", class: "A-", occ: 94.1 },
    { name: "ARIUM Westshore", units: 280, rent: 1_878, dist: "0.6 mi", class: "B+", occ: 92.8 },
    { name: "Camden Westchase", units: 340, rent: 1_812, dist: "1.1 mi", class: "B", occ: 95.2 },
    { name: "Cortland Bayport", units: 196, rent: 1_924, dist: "1.3 mi", class: "A-", occ: 91.6 },
    { name: "Modera Westshore", units: 264, rent: 2_108, dist: "0.8 mi", class: "A", occ: 89.3 },
  ],
  saleComps: [
    { name: "Villas at Gateway", units: 220, ppu: 168_000, capRate: 5.8, date: "2025-11", dist: "1.2 mi" },
    { name: "Palms at Gandy", units: 186, ppu: 152_000, capRate: 6.1, date: "2025-08", dist: "2.1 mi" },
    { name: "Reserve at Westshore", units: 304, ppu: 178_000, capRate: 5.5, date: "2025-06", dist: "0.3 mi" },
  ],
  // Ownership history
  ownershipHistory: [
    { date: "2019-03", buyer: "Westshore Holdings LLC", price: 32_200_000, ppu: 129_839 },
    { date: "2014-07", buyer: "SE Multifamily Fund II", price: 24_800_000, ppu: 100_000 },
    { date: "2004-01", buyer: "Original Developer LLC", price: 18_600_000, ppu: 75_000 },
  ],
  // Tax history
  taxHistory: [
    { year: 2025, justValue: 38_800_000, assessed: 35_100_000, tax: 753_000 },
    { year: 2024, justValue: 36_200_000, assessed: 33_800_000, tax: 725_000 },
    { year: 2023, justValue: 34_500_000, assessed: 32_200_000, tax: 691_000 },
    { year: 2022, justValue: 31_800_000, assessed: 30_600_000, tax: 656_000 },
    { year: 2021, justValue: 28_400_000, assessed: 27_300_000, tax: 586_000 },
  ],
};

// ─── UTILITY ─────────────────────────────────────────────────
const fmt = (n) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}K` : `$${n}`;
const fmtFull = (n) => `$${n.toLocaleString()}`;
const pct = (n) => `${n.toFixed(1)}%`;

// ─── SHARED COMPONENTS ───────────────────────────────────────
const Badge = ({ children, color = T.text.amber, bg, border: bdr }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", padding: "1px 6px",
    fontSize: 8, fontFamily: T.font.mono, fontWeight: 700, letterSpacing: "0.05em",
    color, background: bg || `${color}15`, border: `1px solid ${bdr || `${color}40`}`,
    borderRadius: 2, lineHeight: "14px", whiteSpace: "nowrap",
  }}>{children}</span>
);

const SectionHeader = ({ title, subtitle, icon, borderColor = T.text.amber, action }) => (
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

const DataRow = ({ label, value, sub, color, mono = true }) => (
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

const MiniSparkline = ({ data, color = T.text.green, width = 60, height = 16 }) => {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.2} />
    </svg>
  );
};

// ─── PHOTO GALLERY ───────────────────────────────────────────
const PhotoGallery = ({ photos }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const active = photos[activeIdx];

  const PhotoPlaceholder = ({ photo, size = "large" }) => {
    const isLarge = size === "large";
    return (
      <div style={{
        width: "100%", height: "100%", background: photo.color,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden",
      }}>
        {/* Simulated photo with architectural grid overlay */}
        <div style={{ position: "absolute", inset: 0, opacity: 0.08, background: `repeating-linear-gradient(0deg,transparent,transparent 19px,${T.text.secondary} 19px,${T.text.secondary} 20px),repeating-linear-gradient(90deg,transparent,transparent 19px,${T.text.secondary} 19px,${T.text.secondary} 20px)` }} />
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${photo.color}00 0%, ${photo.color} 50%, ${photo.color}aa 100%)` }} />
        {/* Building silhouette */}
        <svg width={isLarge ? 120 : 40} height={isLarge ? 80 : 28} viewBox="0 0 120 80" style={{ opacity: 0.3, position: "relative", zIndex: 1 }}>
          <rect x="10" y="20" width="30" height="60" fill={T.text.secondary} />
          <rect x="15" y="25" width="8" height="8" fill={photo.color} />
          <rect x="27" y="25" width="8" height="8" fill={photo.color} />
          <rect x="15" y="38" width="8" height="8" fill={photo.color} />
          <rect x="27" y="38" width="8" height="8" fill={photo.color} />
          <rect x="45" y="10" width="35" height="70" fill={T.text.secondary} />
          <rect x="50" y="15" width="8" height="8" fill={photo.color} />
          <rect x="62" y="15" width="8" height="8" fill={photo.color} />
          <rect x="50" y="28" width="8" height="8" fill={photo.color} />
          <rect x="62" y="28" width="8" height="8" fill={photo.color} />
          <rect x="50" y="41" width="8" height="8" fill={photo.color} />
          <rect x="62" y="41" width="8" height="8" fill={photo.color} />
          <rect x="85" y="30" width="25" height="50" fill={T.text.secondary} />
          <rect x="90" y="35" width="6" height="6" fill={photo.color} />
          <rect x="100" y="35" width="6" height="6" fill={photo.color} />
          <rect x="90" y="46" width="6" height="6" fill={photo.color} />
          <rect x="100" y="46" width="6" height="6" fill={photo.color} />
        </svg>
        {isLarge && (
          <span style={{ fontSize: 10, fontFamily: T.font.mono, color: `${T.text.secondary}80`, marginTop: 8, position: "relative", zIndex: 1 }}>
            {photo.label}
          </span>
        )}
        {/* Corner reference tag */}
        <div style={{ position: "absolute", top: 4, left: 4, fontSize: 7, fontFamily: T.font.mono, color: T.text.muted, background: "#00000088", padding: "1px 4px", borderRadius: 1, zIndex: 2 }}>
          {String(photos.indexOf(photo) + 1).padStart(2, "0")}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, background: T.bg.photo, borderRadius: 2, overflow: "hidden", border: `1px solid ${T.border.subtle}` }}>
      {/* Hero Image */}
      <div
        onClick={() => setLightbox(true)}
        style={{ width: "100%", height: 200, cursor: "pointer", position: "relative" }}
      >
        <PhotoPlaceholder photo={active} size="large" />
        {/* Photo count overlay */}
        <div style={{ position: "absolute", bottom: 6, right: 6, display: "flex", gap: 4, alignItems: "center" }}>
          <Badge color={T.text.white} bg="#00000099" border="transparent">
            {activeIdx + 1} / {photos.length}
          </Badge>
          <Badge color={T.text.cyan} bg="#00000099" border="transparent">
            EXPAND
          </Badge>
        </div>
        {/* Navigation arrows */}
        {activeIdx > 0 && (
          <div onClick={(e) => { e.stopPropagation(); setActiveIdx(activeIdx - 1); }}
            style={{ position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "#000000aa", borderRadius: 2, cursor: "pointer", color: T.text.white, fontSize: 12, fontFamily: T.font.mono }}>
            ‹
          </div>
        )}
        {activeIdx < photos.length - 1 && (
          <div onClick={(e) => { e.stopPropagation(); setActiveIdx(activeIdx + 1); }}
            style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "#000000aa", borderRadius: 2, cursor: "pointer", color: T.text.white, fontSize: 12, fontFamily: T.font.mono }}>
            ›
          </div>
        )}
      </div>
      {/* Thumbnail Strip */}
      <div style={{ display: "flex", gap: 2, padding: 2, background: T.bg.terminal, overflowX: "auto" }}>
        {photos.map((p, i) => (
          <div
            key={p.id}
            onClick={() => setActiveIdx(i)}
            style={{
              width: 52, height: 36, flexShrink: 0, cursor: "pointer",
              border: i === activeIdx ? `1px solid ${T.text.amber}` : `1px solid ${T.border.subtle}`,
              borderRadius: 1, overflow: "hidden", opacity: i === activeIdx ? 1 : 0.6,
              transition: "opacity 0.15s, border-color 0.15s",
            }}
          >
            <PhotoPlaceholder photo={p} size="small" />
          </div>
        ))}
      </div>

      {/* Lightbox overlay */}
      {lightbox && (
        <div onClick={() => setLightbox(false)} style={{
          position: "fixed", inset: 0, zIndex: 9999, background: "#000000ee",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
        }}>
          <div style={{ width: "80%", maxWidth: 900, height: "70%", position: "relative" }}
            onClick={(e) => e.stopPropagation()}>
            <PhotoPlaceholder photo={active} size="large" />
            <div onClick={() => setLightbox(false)} style={{
              position: "absolute", top: 8, right: 8, width: 28, height: 28,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "#000000cc", borderRadius: 2, cursor: "pointer",
              color: T.text.white, fontSize: 14, fontFamily: T.font.mono,
            }}>×</div>
            <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 4 }}>
              {photos.map((_, i) => (
                <div key={i} onClick={() => setActiveIdx(i)} style={{
                  width: 8, height: 8, borderRadius: "50%", cursor: "pointer",
                  background: i === activeIdx ? T.text.amber : T.text.muted,
                }} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── MINI BAR CHART ──────────────────────────────────────────
const MiniBar = ({ value, max, color = T.text.cyan, width = 60 }) => (
  <div style={{ width, height: 6, background: `${color}15`, borderRadius: 1 }}>
    <div style={{ width: `${(value / max) * 100}%`, height: "100%", background: color, borderRadius: 1 }} />
  </div>
);

// ─── SCORE RING ──────────────────────────────────────────────
const ScoreRing = ({ score, size = 72, strokeWidth = 5 }) => {
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

// ═════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════
export default function PropertyDetailsPage() {
  const [activeTab, setActiveTab] = useState("OVERVIEW");
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const p = PROPERTY;

  const TABS = [
    { key: "OVERVIEW", label: "OVERVIEW", hotkey: "F1" },
    { key: "FINANCIALS", label: "FINANCIALS", hotkey: "F2" },
    { key: "COMPS", label: "COMPS", hotkey: "F3" },
    { key: "TAX", label: "TAX & TITLE", hotkey: "F4" },
    { key: "ZONING", label: "ZONING", hotkey: "F5" },
    { key: "MARKET", label: "MARKET", hotkey: "F6" },
  ];

  useEffect(() => {
    const handler = (e) => {
      const idx = parseInt(e.key.replace("F", "")) - 1;
      if (idx >= 0 && idx < TABS.length) { e.preventDefault(); setActiveTab(TABS[idx].key); }
      if (e.key === "Escape") { setShowCreateDeal(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ─── OVERVIEW TAB ────────────────────────────────────────
  const OverviewTab = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 8, animation: "fadeIn 0.15s" }}>
      {/* LEFT COLUMN */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Photo Gallery */}
        <PhotoGallery photos={p.photos} />

        {/* Property Vitals */}
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="PROPERTY VITALS" icon="◈" borderColor={T.text.cyan} />
          <DataRow label="Type" value={p.type} sub={`· ${p.subtype}`} />
          <DataRow label="Class" value={p.class} />
          <DataRow label="Units" value={p.units} />
          <DataRow label="Stories" value={p.stories} />
          <DataRow label="Year Built" value={p.yearBuilt} sub={p.yearRenovated ? `· Renov ${p.yearRenovated}` : ""} />
          <DataRow label="Lot Size" value={`${p.lotSizeAc} ac`} sub={`${p.lotSizeSF.toLocaleString()} SF`} />
          <DataRow label="Building SF" value={`${p.buildingSF.toLocaleString()}`} />
          <DataRow label="Avg Unit SF" value={`${p.avgUnitSF}`} sub="SF" />
          <DataRow label="Parking" value={`${p.parking.total} spaces`} sub={`${p.parking.ratio}:1 · ${p.parking.type}`} />
        </div>

        {/* Amenities */}
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="AMENITIES" icon="◆" borderColor={T.text.purple} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, padding: "6px 10px" }}>
            {p.amenities.map((a, i) => <Badge key={i} color={T.text.secondary}>{a}</Badge>)}
          </div>
        </div>

        {/* Ownership Summary */}
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="OWNERSHIP" icon="◇" borderColor={T.text.orange} />
          <DataRow label="Current Owner" value={p.owner} mono={false} />
          <DataRow label="Owner Type" value={p.ownerType} />
          <DataRow label="Acquired" value={p.acquisitionDate} sub={fmtFull(p.acquisitionPrice)} />
          <DataRow label="Hold Period" value={`${new Date().getFullYear() - parseInt(p.acquisitionDate)}yr`} color={T.text.amber} />
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Performance Snapshot */}
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="PERFORMANCE SNAPSHOT" icon="▲" borderColor={T.text.green}
            action={<Badge color={T.text.green}>LIVE</Badge>} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
            {[
              { label: "Occupancy", value: pct(p.currentOccupancy), color: p.currentOccupancy >= 93 ? T.text.green : T.text.amber },
              { label: "Avg Eff. Rent", value: `$${p.avgEffectiveRent.toLocaleString()}`, sub: "/mo" },
              { label: "Rent/SF", value: `$${p.rentPerSF}`, sub: "/SF/mo" },
              { label: "NOI (T12)", value: fmt(p.noiTrailing12), color: T.text.green },
              { label: "Implied Cap", value: pct(p.capRateImplied), color: T.text.cyan },
              { label: "Expense Ratio", value: pct(p.expenseRatio), color: p.expenseRatio > 50 ? T.text.red : T.text.amber },
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
          <div style={{ padding: "4px 10px", background: T.bg.panelAlt }}>
            <div style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>CONCESSIONS</div>
            <div style={{ fontSize: 9, fontFamily: T.font.mono, color: T.text.amber }}>{p.concessions}</div>
          </div>
        </div>

        {/* Market Position */}
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="MARKET POSITION" subtitle="vs Westshore Submarket" icon="◉" borderColor={T.text.amber} />
          {[
            { label: "Subject Rent", value: `$${p.avgEffectiveRent}`, vs: `$${p.avgMarketRent}`, delta: `${((p.avgEffectiveRent / p.avgMarketRent - 1) * 100).toFixed(1)}%`, below: p.avgEffectiveRent < p.avgMarketRent },
            { label: "Vacancy", value: pct(100 - p.currentOccupancy), vs: pct(p.submarketVacancy), delta: `${(100 - p.currentOccupancy - p.submarketVacancy).toFixed(1)}%`, below: (100 - p.currentOccupancy) < p.submarketVacancy },
          ].map((row, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", padding: "6px 10px", borderBottom: `1px solid ${T.border.subtle}08`, gap: 8 }}>
              <span style={{ fontSize: 8, fontFamily: T.font.label, color: T.text.secondary, width: 80 }}>{row.label}</span>
              <span style={{ fontSize: 10, fontFamily: T.font.mono, fontWeight: 600, color: T.text.primary, width: 50 }}>{row.value}</span>
              <span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted }}>vs</span>
              <span style={{ fontSize: 10, fontFamily: T.font.mono, color: T.text.secondary, width: 50 }}>{row.vs}</span>
              <Badge color={row.below ? T.text.green : T.text.red}>{row.delta} {row.below ? "BELOW" : "ABOVE"}</Badge>
            </div>
          ))}
          {/* Walkability Scores */}
          <div style={{ display: "flex", padding: "6px 10px", gap: 12 }}>
            {[
              { label: "Walk", value: p.walkScore },
              { label: "Transit", value: p.transitScore },
              { label: "Bike", value: p.bikeScore },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted, width: 36 }}>{s.label}</span>
                <MiniBar value={s.value} max={100} color={s.value >= 70 ? T.text.green : s.value >= 50 ? T.text.amber : T.text.red} width={40} />
                <span style={{ fontSize: 9, fontFamily: T.font.mono, fontWeight: 600, color: T.text.primary }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Rent Comps Preview */}
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="RENT COMPS" subtitle={`${p.rentComps.length} properties`} icon="≡" borderColor={T.text.cyan}
            action={<span onClick={() => setActiveTab("COMPS")} style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.cyan, cursor: "pointer" }}>VIEW ALL →</span>} />
          <div style={{ fontSize: 8, fontFamily: T.font.mono }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 42px 54px 42px 42px", padding: "4px 10px", background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}` }}>
              {["PROPERTY","UNITS","RENT","OCC","DIST"].map(h => (
                <span key={h} style={{ color: T.text.muted, fontWeight: 600, letterSpacing: "0.05em" }}>{h}</span>
              ))}
            </div>
            {p.rentComps.map((c, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 42px 54px 42px 42px", padding: "4px 10px", borderBottom: `1px solid ${T.border.subtle}08`, background: i % 2 === 0 ? T.bg.panel : T.bg.panelAlt }}>
                <span style={{ color: T.text.primary, fontWeight: 500 }}>{c.name}</span>
                <span style={{ color: T.text.secondary }}>{c.units}</span>
                <span style={{ color: c.rent > p.avgEffectiveRent ? T.text.green : T.text.red, fontWeight: 600 }}>${c.rent.toLocaleString()}</span>
                <span style={{ color: T.text.secondary }}>{pct(c.occ)}</span>
                <span style={{ color: T.text.muted }}>{c.dist}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Zoning Quick-Read */}
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="ZONING" icon="▦" borderColor={T.text.purple}
            action={<span onClick={() => setActiveTab("ZONING")} style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.purple, cursor: "pointer" }}>DETAIL →</span>} />
          <DataRow label="Designation" value={p.zoning} sub={p.zoningDesc} />
          <DataRow label="Max Density" value={p.maxDensity} />
          <DataRow label="Max Height" value={p.maxHeight} />
          <DataRow label="FAR" value={p.far.toFixed(1)} />
          <div style={{ padding: "3px 10px" }}>
            <span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>Source: {p.zoningSource}</span>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── FINANCIALS TAB ──────────────────────────────────────
  const FinancialsTab = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 8, animation: "fadeIn 0.15s" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="INCOME & EXPENSE" icon="$" borderColor={T.text.green} />
          <DataRow label="Gross Potential Rent" value={`$${(p.avgEffectiveRent * p.units * 12).toLocaleString()}`} sub="/yr" />
          <DataRow label="Vacancy Loss" value={`(${fmtFull(Math.round(p.avgEffectiveRent * p.units * 12 * (1 - p.currentOccupancy / 100)))})`} color={T.text.red} sub={pct(100 - p.currentOccupancy)} />
          <DataRow label="Effective Gross Income" value={`$${(Math.round(p.avgEffectiveRent * p.units * 12 * p.currentOccupancy / 100)).toLocaleString()}`} />
          <div style={{ height: 1, background: T.border.medium, margin: "2px 10px" }} />
          <DataRow label="Operating Expenses" value={`(${fmtFull(Math.round(p.noiTrailing12 * p.expenseRatio / (100 - p.expenseRatio)))})`} color={T.text.red} sub={pct(p.expenseRatio)} />
          <div style={{ height: 1, background: T.text.amber, margin: "2px 10px" }} />
          <DataRow label="Net Operating Income" value={fmtFull(p.noiTrailing12)} color={T.text.green} />
          <DataRow label="NOI / Unit" value={fmtFull(Math.round(p.noiTrailing12 / p.units))} sub="/yr" />
        </div>

        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="VALUATION INDICATORS" icon="◈" borderColor={T.text.amber} />
          <DataRow label="Implied Cap Rate" value={pct(p.capRateImplied)} color={T.text.cyan} />
          <DataRow label="Price / Unit (Last Sale)" value={fmtFull(Math.round(p.lastSalePrice / p.units))} />
          <DataRow label="Price / SF" value={`$${(p.lastSalePrice / p.buildingSF).toFixed(0)}`} />
          <DataRow label="Just Value (2025)" value={fmtFull(p.justValue2025)} color={T.text.amber} />
          <DataRow label="Value / Unit (Appraiser)" value={fmtFull(Math.round(p.justValue2025 / p.units))} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="RENT ROLL SUMMARY" icon="≡" borderColor={T.text.cyan} />
          <DataRow label="Total Units" value={p.units} />
          <DataRow label="Occupied" value={Math.round(p.units * p.currentOccupancy / 100)} sub={pct(p.currentOccupancy)} color={T.text.green} />
          <DataRow label="Vacant" value={Math.round(p.units * (100 - p.currentOccupancy) / 100)} sub={pct(100 - p.currentOccupancy)} color={T.text.red} />
          <DataRow label="Avg Effective Rent" value={`$${p.avgEffectiveRent.toLocaleString()}`} />
          <DataRow label="Avg Market Rent" value={`$${p.avgMarketRent.toLocaleString()}`} />
          <DataRow label="Loss-to-Lease" value={pct((1 - p.avgEffectiveRent / p.avgMarketRent) * 100)} color={T.text.amber} />
        </div>

        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2, padding: "10px", textAlign: "center" }}>
          <div style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted, marginBottom: 8, letterSpacing: "0.1em" }}>PLATFORM INTELLIGENCE</div>
          <div style={{ fontSize: 10, fontFamily: T.font.mono, color: T.text.amber, lineHeight: 1.6, padding: "0 8px" }}>
            Deeper financial modeling requires a <strong>Deal Capsule</strong>. Create a deal to unlock the 3-Layer ProForma Engine (M09), capital structure analysis (M11), and AI-adjusted assumptions.
          </div>
          <div
            onClick={() => setShowCreateDeal(true)}
            style={{
              margin: "10px auto 4px", padding: "6px 16px", background: `${T.text.amber}20`,
              border: `1px solid ${T.text.amber}60`, borderRadius: 2, cursor: "pointer",
              fontSize: 10, fontFamily: T.font.mono, fontWeight: 700, color: T.text.amber,
              letterSpacing: "0.05em", display: "inline-block",
            }}>
            CREATE DEAL →
          </div>
        </div>
      </div>
    </div>
  );

  // ─── COMPS TAB ───────────────────────────────────────────
  const CompsTab = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 8, animation: "fadeIn 0.15s" }}>
      {/* Rent Comps */}
      <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
        <SectionHeader title="RENT COMPS" subtitle="M05 · Trade Area" icon="≡" borderColor={T.text.cyan} />
        <div style={{ fontSize: 8, fontFamily: T.font.mono }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 40px 56px 40px 46px 40px", padding: "4px 8px", background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}` }}>
            {["PROPERTY","UNITS","RENT","OCC","CLASS","DIST"].map(h => (
              <span key={h} style={{ color: T.text.muted, fontWeight: 600, letterSpacing: "0.05em" }}>{h}</span>
            ))}
          </div>
          {/* Subject property row */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 40px 56px 40px 46px 40px", padding: "4px 8px", borderBottom: `1px solid ${T.text.amber}40`, background: `${T.text.amber}08` }}>
            <span style={{ color: T.text.amber, fontWeight: 700 }}>SUBJECT</span>
            <span style={{ color: T.text.amber }}>{p.units}</span>
            <span style={{ color: T.text.amber, fontWeight: 700 }}>${p.avgEffectiveRent.toLocaleString()}</span>
            <span style={{ color: T.text.amber }}>{pct(p.currentOccupancy)}</span>
            <span style={{ color: T.text.amber }}>{p.class}</span>
            <span style={{ color: T.text.amber }}>—</span>
          </div>
          {p.rentComps.map((c, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1.2fr 40px 56px 40px 46px 40px", padding: "4px 8px", borderBottom: `1px solid ${T.border.subtle}08`, background: i % 2 === 0 ? T.bg.panel : T.bg.panelAlt }}>
              <span style={{ color: T.text.primary, fontWeight: 500 }}>{c.name}</span>
              <span style={{ color: T.text.secondary }}>{c.units}</span>
              <span style={{ color: c.rent > p.avgEffectiveRent ? T.text.green : T.text.red, fontWeight: 600 }}>${c.rent.toLocaleString()}</span>
              <span style={{ color: T.text.secondary }}>{pct(c.occ)}</span>
              <span style={{ color: T.text.secondary }}>{c.class}</span>
              <span style={{ color: T.text.muted }}>{c.dist}</span>
            </div>
          ))}
          <div style={{ padding: "6px 8px", background: T.bg.panelAlt }}>
            <span style={{ color: T.text.muted, fontSize: 7 }}>AVG:</span>
            <span style={{ color: T.text.secondary, marginLeft: 4 }}>
              ${Math.round(p.rentComps.reduce((s, c) => s + c.rent, 0) / p.rentComps.length).toLocaleString()}/mo
            </span>
            <span style={{ color: T.text.muted, marginLeft: 8, fontSize: 7 }}>Subject is </span>
            <span style={{ color: p.avgEffectiveRent < (p.rentComps.reduce((s, c) => s + c.rent, 0) / p.rentComps.length) ? T.text.red : T.text.green, fontWeight: 600 }}>
              {pct(Math.abs((p.avgEffectiveRent / (p.rentComps.reduce((s, c) => s + c.rent, 0) / p.rentComps.length) - 1) * 100))}
              {p.avgEffectiveRent < (p.rentComps.reduce((s, c) => s + c.rent, 0) / p.rentComps.length) ? " below" : " above"} avg
            </span>
          </div>
        </div>
      </div>

      {/* Sale Comps */}
      <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
        <SectionHeader title="SALE COMPS" subtitle="M27 · Recent Transactions" icon="◈" borderColor={T.text.green} />
        <div style={{ fontSize: 8, fontFamily: T.font.mono }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 40px 60px 48px 48px 44px", padding: "4px 8px", background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}` }}>
            {["PROPERTY","UNITS","$/UNIT","CAP","DATE","DIST"].map(h => (
              <span key={h} style={{ color: T.text.muted, fontWeight: 600, letterSpacing: "0.05em" }}>{h}</span>
            ))}
          </div>
          {p.saleComps.map((c, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1.2fr 40px 60px 48px 48px 44px", padding: "5px 8px", borderBottom: `1px solid ${T.border.subtle}08`, background: i % 2 === 0 ? T.bg.panel : T.bg.panelAlt }}>
              <span style={{ color: T.text.primary, fontWeight: 500 }}>{c.name}</span>
              <span style={{ color: T.text.secondary }}>{c.units}</span>
              <span style={{ color: T.text.green, fontWeight: 600 }}>${c.ppu.toLocaleString()}</span>
              <span style={{ color: T.text.cyan }}>{pct(c.capRate)}</span>
              <span style={{ color: T.text.secondary }}>{c.date}</span>
              <span style={{ color: T.text.muted }}>{c.dist}</span>
            </div>
          ))}
          <div style={{ padding: "6px 8px", background: T.bg.panelAlt }}>
            <span style={{ color: T.text.muted, fontSize: 7 }}>MEDIAN $/UNIT:</span>
            <span style={{ color: T.text.green, marginLeft: 4, fontWeight: 600 }}>
              ${p.saleComps.sort((a, b) => a.ppu - b.ppu)[Math.floor(p.saleComps.length / 2)].ppu.toLocaleString()}
            </span>
            <span style={{ color: T.text.muted, marginLeft: 8, fontSize: 7 }}>MEDIAN CAP:</span>
            <span style={{ color: T.text.cyan, marginLeft: 4, fontWeight: 600 }}>
              {pct(p.saleComps.sort((a, b) => a.capRate - b.capRate)[Math.floor(p.saleComps.length / 2)].capRate)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── TAX & TITLE TAB ────────────────────────────────────
  const TaxTab = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 8, animation: "fadeIn 0.15s" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="CURRENT TAX ASSESSMENT" subtitle="M26 · Hillsborough County" icon="$" borderColor={T.text.orange} />
          <DataRow label="Just (Market) Value" value={fmtFull(p.justValue2025)} color={T.text.primary} />
          <DataRow label="Assessed Value" value={fmtFull(p.assessedValue2025)} />
          <DataRow label="Taxable Value" value={fmtFull(p.taxableValue2025)} color={T.text.amber} />
          <DataRow label="Millage Rate" value={`${p.millageRate}`} sub="mills" />
          <DataRow label="Annual Tax" value={fmtFull(p.annualTax2025)} color={T.text.red} />
          <DataRow label="Tax / Unit" value={fmtFull(Math.round(p.annualTax2025 / p.units))} sub="/yr" />
          <div style={{ height: 1, background: T.border.medium, margin: "2px 10px" }} />
          <DataRow label="Homestead Exempt" value={p.homesteadExempt ? "YES" : "NO"} color={T.text.red} />
          <DataRow label="Assessment Cap" value={p.assessmentCap} color={T.text.amber} />
          <div style={{ padding: "4px 10px", background: `${T.text.red}08`, borderTop: `1px solid ${T.text.red}20` }}>
            <div style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.red, lineHeight: 1.5 }}>
              ⚠ REASSESSMENT WARNING: On sale, assessed value resets to just value. Buyer's tax estimate: ~{fmtFull(Math.round(p.justValue2025 * p.millageRate / 1000))}/yr (+{pct((p.justValue2025 * p.millageRate / 1000 / p.annualTax2025 - 1) * 100)} increase)
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Tax History */}
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
          {/* Visual bar chart of tax growth */}
          <div style={{ padding: "6px 8px", display: "flex", alignItems: "flex-end", gap: 4, height: 50 }}>
            {p.taxHistory.slice().reverse().map((t, i) => {
              const maxTax = Math.max(...p.taxHistory.map(h => h.tax));
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <div style={{ width: "80%", height: `${(t.tax / maxTax) * 30}px`, background: T.text.amber, borderRadius: "1px 1px 0 0", opacity: 0.7 + (i * 0.06) }} />
                  <span style={{ fontSize: 6, color: T.text.muted }}>{t.year}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ownership Chain */}
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="OWNERSHIP CHAIN" icon="◇" borderColor={T.text.purple} />
          {p.ownershipHistory.map((o, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", padding: "6px 10px", borderBottom: `1px solid ${T.border.subtle}08`, gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: i === 0 ? T.text.green : T.text.muted, border: `2px solid ${i === 0 ? T.text.green : T.text.muted}40`, flexShrink: 0 }} />
              {i > 0 && <div style={{ position: "absolute", left: 13, top: -8, width: 1, height: 8, background: T.border.medium }} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontFamily: T.font.mono, color: i === 0 ? T.text.primary : T.text.secondary, fontWeight: i === 0 ? 600 : 400 }}>{o.buyer}</div>
                <div style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>{o.date} · {fmtFull(o.price)} · ${o.ppu.toLocaleString()}/unit</div>
              </div>
              {i < p.ownershipHistory.length - 1 && (
                <Badge color={T.text.green}>+{pct(((p.ownershipHistory[i].price / p.ownershipHistory[i + 1].price) - 1) * 100)}</Badge>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ─── ZONING TAB ──────────────────────────────────────────
  const ZoningTab = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 8, animation: "fadeIn 0.15s" }}>
      <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
        <SectionHeader title="ZONING DESIGNATION" subtitle="M02 · Verified" icon="▦" borderColor={T.text.purple} />
        <div style={{ padding: "10px", textAlign: "center", borderBottom: `1px solid ${T.border.subtle}` }}>
          <div style={{ fontSize: 28, fontFamily: T.font.mono, fontWeight: 800, color: T.text.amber }}>{p.zoning}</div>
          <div style={{ fontSize: 10, fontFamily: T.font.mono, color: T.text.secondary }}>{p.zoningDesc}</div>
        </div>
        <DataRow label="Max Density" value={p.maxDensity} color={T.text.cyan} />
        <DataRow label="Max Height" value={p.maxHeight} color={T.text.cyan} />
        <DataRow label="Floor Area Ratio" value={p.far.toFixed(1)} color={T.text.cyan} />
        <DataRow label="Lot Size" value={`${p.lotSizeAc} ac`} />
        <div style={{ height: 1, background: T.border.medium, margin: "2px 10px" }} />
        <DataRow label="Max Units by Density" value={Math.floor(p.lotSizeAc * 18)} sub={`@ ${p.maxDensity}`} color={T.text.green} />
        <DataRow label="Max SF by FAR" value={`${(Math.floor(p.lotSizeSF * p.far)).toLocaleString()} SF`} sub={`@ FAR ${p.far}`} color={T.text.green} />
        <DataRow label="Current Units" value={p.units} />
        <DataRow label="Density Headroom" value={`+${Math.floor(p.lotSizeAc * 18) - p.units} units`} color={T.text.amber} />
        <div style={{ padding: "4px 10px" }}>
          <span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>Source: {p.zoningSource} · Tampa, FL</span>
        </div>
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
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="PARKING ANALYSIS" subtitle="Often the binding constraint" icon="P" borderColor={T.text.red} />
          <DataRow label="Required Ratio" value="1.5:1" sub="per unit" />
          <DataRow label="Current Spaces" value={p.parking.total} />
          <DataRow label="Required @ Current" value={Math.ceil(p.units * 1.5)} />
          <DataRow label="Surplus / (Deficit)" value={`${p.parking.total - Math.ceil(p.units * 1.5)}`} color={p.parking.total >= Math.ceil(p.units * 1.5) ? T.text.green : T.text.red} />
          <DataRow label="Max Units by Parking" value={Math.floor(p.parking.total / 1.5)} color={T.text.amber} sub="if parking-constrained" />
        </div>
      </div>
    </div>
  );

  // ─── MARKET TAB ──────────────────────────────────────────
  const MarketTab = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 8, animation: "fadeIn 0.15s" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="SUBMARKET VITALS" subtitle={`${p.submarket} · ${p.market}`} icon="◉" borderColor={T.text.amber} />
          <DataRow label="Vacancy Rate" value={pct(p.submarketVacancy)} color={p.submarketVacancy < 7 ? T.text.green : p.submarketVacancy < 10 ? T.text.amber : T.text.red} />
          <DataRow label="Rent Growth (YoY)" value={`+${pct(p.submarketRentGrowth)}`} color={T.text.green} />
          <DataRow label="Weekly Absorption" value={`${p.submarketAbsorption.toLocaleString()} units`} />
          <DataRow label="Avg Effective Rent" value={`$${p.avgMarketRent.toLocaleString()}`} sub="/mo" />
        </div>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="LOCATION SCORES" icon="★" borderColor={T.text.cyan} />
          {[
            { label: "Walk Score", value: p.walkScore, desc: "Somewhat Walkable" },
            { label: "Transit Score", value: p.transitScore, desc: "Some Transit" },
            { label: "Bike Score", value: p.bikeScore, desc: "Bikeable" },
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", padding: "6px 10px", borderBottom: `1px solid ${T.border.subtle}08`, gap: 8 }}>
              <span style={{ fontSize: 8, fontFamily: T.font.label, color: T.text.secondary, width: 70 }}>{s.label}</span>
              <MiniBar value={s.value} max={100} color={s.value >= 70 ? T.text.green : s.value >= 50 ? T.text.amber : T.text.red} width={80} />
              <span style={{ fontSize: 11, fontFamily: T.font.mono, fontWeight: 700, color: T.text.primary, width: 24, textAlign: "right" }}>{s.value}</span>
              <span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>{s.desc}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="SUPPLY PIPELINE" subtitle="Within Trade Area" icon="▼" borderColor={T.text.red} />
          <DataRow label="Under Construction" value="1,240 units" color={T.text.orange} />
          <DataRow label="Delivering Q3 2026" value="380 units" />
          <DataRow label="Delivering Q1 2027" value="860 units" />
          <DataRow label="Pipeline-to-Stock" value="4.2%" color={T.text.green} sub="< 5% threshold" />
          <DataRow label="Threat Level" value="MODERATE" color={T.text.amber} />
        </div>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="DEMAND DRIVERS" icon="▲" borderColor={T.text.green} />
          <DataRow label="Population (3mi)" value="42,000" sub="+2.1% YoY" color={T.text.green} />
          <DataRow label="Avg HH Income" value="$78,200" />
          <DataRow label="Renter Pct" value="58%" />
          <DataRow label="Employment Growth" value="+3.2%" color={T.text.green} />
          <DataRow label="Demand Score" value="88" color={T.text.green} sub="/ 100" />
        </div>
      </div>
    </div>
  );

  // ─── TAB CONTENT ROUTER ──────────────────────────────────
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

  // ─── CREATE DEAL MODAL ───────────────────────────────────
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
            <div style={{
              flex: 1, padding: "8px 0", textAlign: "center", cursor: "pointer",
              background: `${T.text.amber}20`, border: `1px solid ${T.text.amber}60`, borderRadius: 2,
              fontSize: 11, fontFamily: T.font.mono, fontWeight: 700, color: T.text.amber, letterSpacing: "0.05em",
            }}>
              CREATE DEAL
            </div>
            <div onClick={() => setShowCreateDeal(false)} style={{
              padding: "8px 16px", textAlign: "center", cursor: "pointer",
              background: T.bg.input, border: `1px solid ${T.border.medium}`, borderRadius: 2,
              fontSize: 11, fontFamily: T.font.mono, fontWeight: 500, color: T.text.secondary,
            }}>
              CANCEL
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── MAIN RENDER ─────────────────────────────────────────
  return (
    <div style={{ width: "100%", height: "100vh", background: T.bg.terminal, fontFamily: T.font.mono, color: T.text.primary, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{css}</style>

      {/* TOP BAR — Property Identity */}
      <div style={{
        display: "flex", alignItems: "center", padding: "6px 12px", gap: 10,
        background: T.bg.topBar, borderBottom: `1px solid ${T.border.subtle}`,
        flexShrink: 0,
      }}>
        {/* Back navigation */}
        <span style={{ fontSize: 10, color: T.text.muted, cursor: "pointer", fontFamily: T.font.mono }}>‹ BACK</span>
        <div style={{ width: 1, height: 16, background: T.border.medium }} />

        {/* Property name + address */}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: T.text.white, fontFamily: T.font.display, letterSpacing: "0.02em" }}>{p.name}</span>
            <Badge color={T.text.cyan}>{p.type}</Badge>
            <Badge color={T.text.purple}>{p.class}</Badge>
            {!p.inPipeline && <Badge color={T.text.muted}>NOT IN PIPELINE</Badge>}
          </div>
          <div style={{ fontSize: 9, color: T.text.secondary, fontFamily: T.font.label, marginTop: 1 }}>
            {p.address} · {p.city}, {p.state} {p.zip} · {p.county} County · {p.submarket} submarket
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {[
            { label: "UNITS", value: p.units },
            { label: "BUILT", value: p.yearBuilt },
            { label: "OCC", value: pct(p.currentOccupancy), color: T.text.green },
            { label: "CAP", value: pct(p.capRateImplied), color: T.text.cyan },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 6, color: T.text.muted, letterSpacing: "0.1em" }}>{s.label}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: s.color || T.text.primary }}>{s.value}</div>
            </div>
          ))}
          <div style={{ width: 1, height: 24, background: T.border.medium }} />
          <ScoreRing score={82} size={40} strokeWidth={3} />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 6 }}>
          <div
            onClick={() => setShowCreateDeal(true)}
            style={{
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
          <div
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
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
          ID: {p.id} · Updated 2h ago · Sources: ATTOM · FDOR · Municode · RentCast
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
          <span>{p.county} County, FL</span>
          <span>·</span>
          <span>Folio: 123456-7890</span>
        </div>
        <div style={{ display: "flex", gap: 8, fontSize: 7, fontFamily: T.font.mono }}>
          <span style={{ color: T.text.muted }}>F1–F6 Navigate</span>
          <span style={{ color: T.text.muted }}>·</span>
          <span style={{ color: T.text.muted }}>/  Command</span>
          <span style={{ color: T.text.muted }}>·</span>
          <span style={{ color: T.text.green }}>JEDI RE v2.1</span>
        </div>
      </div>

      {/* Create Deal Modal */}
      {showCreateDeal && <CreateDealModal />}
    </div>
  );
}
