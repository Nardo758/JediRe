import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ZoningTabContent } from "../../components/MarketIntelligence/ZoningTabContent";
import { CompsTabContent } from "../../components/MarketIntelligence/CompsTabContent";
import { MarketTabContent } from "../../components/MarketIntelligence/MarketTabContent";

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
        <div style={{ position: "absolute", inset: 0, opacity: 0.08, background: `repeating-linear-gradient(0deg,transparent,transparent 19px,${T.text.secondary} 19px,${T.text.secondary} 20px),repeating-linear-gradient(90deg,transparent,transparent 19px,${T.text.secondary} 19px,${T.text.secondary} 20px)` }} />
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${photo.color}00 0%, ${photo.color} 50%, ${photo.color}aa 100%)` }} />
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
        <div style={{ position: "absolute", top: 4, left: 4, fontSize: 7, fontFamily: T.font.mono, color: T.text.muted, background: "#00000088", padding: "1px 4px", borderRadius: 1, zIndex: 2 }}>
          {String(photos.indexOf(photo) + 1).padStart(2, "0")}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, background: T.bg.photo, borderRadius: 2, overflow: "hidden", border: `1px solid ${T.border.subtle}` }}>
      <div
        onClick={() => setLightbox(true)}
        style={{ width: "100%", height: 200, cursor: "pointer", position: "relative" }}
      >
        <PhotoPlaceholder photo={active} size="large" />
        <div style={{ position: "absolute", bottom: 6, right: 6, display: "flex", gap: 4, alignItems: "center" }}>
          <Badge color={T.text.white} bg="#00000099" border="transparent">
            {activeIdx + 1} / {photos.length}
          </Badge>
          <Badge color={T.text.cyan} bg="#00000099" border="transparent">
            EXPAND
          </Badge>
        </div>
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
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("OVERVIEW");
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);

  // Mock data for now - will be replaced with API call
  const MOCK_PROPERTY = {
    id: propertyId || "P-TPA-00247",
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
    currentOccupancy: 93.5,
    avgEffectiveRent: 1_842,
    avgMarketRent: 1_908,
    rentPerSF: 2.03,
    concessions: "1 mo free on 14-mo lease",
    noiTrailing12: 2_680_000,
    capRateImplied: 6.92,
    expenseRatio: 48.2,
    submarketVacancy: 8.5,
    submarketRentGrowth: 3.0,
    submarketAbsorption: 11_658,
    walkScore: 62,
    transitScore: 44,
    bikeScore: 51,
    zoning: "PD-C",
    zoningDesc: "Planned Development – Commercial",
    maxDensity: "18 DU/ac",
    maxHeight: "65 ft",
    far: 2.0,
    zoningSource: "Municode §27-156",
    inPipeline: false,
    dealId: null,
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
    ownershipHistory: [
      { date: "2019-03", buyer: "Westshore Holdings LLC", price: 32_200_000, ppu: 129_839 },
      { date: "2014-07", buyer: "SE Multifamily Fund II", price: 24_800_000, ppu: 100_000 },
      { date: "2004-01", buyer: "Original Developer LLC", price: 18_600_000, ppu: 75_000 },
    ],
    taxHistory: [
      { year: 2025, justValue: 38_800_000, assessed: 35_100_000, tax: 753_000 },
      { year: 2024, justValue: 36_200_000, assessed: 33_800_000, tax: 725_000 },
      { year: 2023, justValue: 34_500_000, assessed: 32_200_000, tax: 691_000 },
      { year: 2022, justValue: 31_800_000, assessed: 30_600_000, tax: 656_000 },
      { year: 2021, justValue: 28_400_000, assessed: 27_300_000, tax: 586_000 },
    ],
  };

  useEffect(() => {
    // Load property data
    // TODO: Replace with actual API call
    setProperty(MOCK_PROPERTY);
    setLoading(false);
  }, [propertyId]);

  useEffect(() => {
    const handler = (e) => {
      const TABS = ["OVERVIEW", "FINANCIALS", "COMPS", "TAX", "ZONING", "MARKET"];
      const idx = parseInt(e.key.replace("F", "")) - 1;
      if (idx >= 0 && idx < TABS.length) { e.preventDefault(); setActiveTab(TABS[idx]); }
      if (e.key === "Escape") { setShowCreateDeal(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (loading || !property) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: T.bg.terminal }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, fontFamily: T.font.mono, color: T.text.amber, marginBottom: 8 }}>LOADING PROPERTY...</div>
          <div style={{ fontSize: 10, fontFamily: T.font.mono, color: T.text.muted }}>{propertyId}</div>
        </div>
      </div>
    );
  }

  const p = property;

  // Breadcrumb logic
  const referrer = location.state?.from || "Property Search";

  return (
    <div style={{ minHeight: "100vh", background: T.bg.terminal, color: T.text.primary, fontFamily: T.font.label }}>
      <style>{css}</style>
      
      {/* Top Bar */}
      <div style={{ background: T.bg.topBar, borderBottom: `1px solid ${T.border.medium}`, padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: T.text.cyan, fontSize: 12, fontFamily: T.font.mono, cursor: "pointer", padding: "4px 8px" }}>
            ← {referrer}
          </button>
          <div style={{ height: 16, width: 1, background: T.border.subtle }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 14, fontFamily: T.font.mono, fontWeight: 700, color: T.text.white }}>{p.name}</div>
            <div style={{ fontSize: 9, fontFamily: T.font.mono, color: T.text.muted }}>{p.address}, {p.city}, {p.state} {p.zip}</div>
          </div>
          <Badge color={T.text.amber}>{p.id}</Badge>
          <Badge color={T.text.cyan}>{p.class}</Badge>
          <Badge color={T.text.green}>{p.units} UNITS</Badge>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowCreateDeal(true)} style={{
            background: `${T.text.amber}20`, border: `1px solid ${T.text.amber}60`,
            borderRadius: 2, padding: "6px 12px", cursor: "pointer",
            fontSize: 10, fontFamily: T.font.mono, fontWeight: 700,
            color: T.text.amber, letterSpacing: "0.05em",
          }}>
            CREATE DEAL
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}`, display: "flex", gap: 0 }}>
        {[
          { key: "OVERVIEW", label: "OVERVIEW", hotkey: "F1" },
          { key: "FINANCIALS", label: "FINANCIALS", hotkey: "F2" },
          { key: "COMPS", label: "COMPS", hotkey: "F3" },
          { key: "TAX", label: "TAX & TITLE", hotkey: "F4" },
          { key: "ZONING", label: "ZONING", hotkey: "F5" },
          { key: "MARKET", label: "MARKET", hotkey: "F6" },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              background: activeTab === tab.key ? T.bg.active : "transparent",
              border: "none",
              borderBottom: activeTab === tab.key ? `2px solid ${T.text.amber}` : "2px solid transparent",
              padding: "10px 16px",
              cursor: "pointer",
              fontSize: 10,
              fontFamily: T.font.mono,
              fontWeight: 700,
              color: activeTab === tab.key ? T.text.amber : T.text.secondary,
              letterSpacing: "0.05em",
              transition: "all 0.15s",
            }}
          >
            {tab.label}
            <span style={{ fontSize: 7, marginLeft: 6, color: T.text.muted }}>{tab.hotkey}</span>
          </button>
        ))}
      </div>

      {/* Tab Content - Simplified for now, will add all tabs */}
      <div style={{ padding: "16px", maxWidth: "1600px", margin: "0 auto" }}>
        {activeTab === "OVERVIEW" && (
          <div style={{ fontSize: 14, fontFamily: T.font.mono, color: T.text.amber, textAlign: "center", padding: "40px" }}>
            OVERVIEW TAB CONTENT COMING SOON
            <div style={{ fontSize: 10, color: T.text.muted, marginTop: 8 }}>
              Full Bloomberg Terminal-style property details with photo gallery, vitals, performance, comps, etc.
            </div>
          </div>
        )}
        {activeTab === "FINANCIALS" && <div style={{ padding: 40, textAlign: "center", color: T.text.muted }}>FINANCIALS TAB</div>}
        {activeTab === "COMPS" && (
          property.dealId ? (
            <CompsTabContent dealId={property.dealId} />
          ) : (
            <div style={{ padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 11, fontFamily: T.font.mono, color: T.text.muted, marginBottom: 12 }}>
                Comparables data available after creating a deal
              </div>
              <div style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted }}>
                Click "CREATE DEAL" to enable comp discovery
              </div>
            </div>
          )
        )}
        {activeTab === "TAX" && <div style={{ padding: 40, textAlign: "center", color: T.text.muted }}>TAX & TITLE TAB</div>}
        {activeTab === "ZONING" && (
          property.dealId ? (
            <ZoningTabContent dealId={property.dealId} />
          ) : (
            <div style={{ padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 11, fontFamily: T.font.mono, color: T.text.muted, marginBottom: 12 }}>
                Zoning data available after creating a deal
              </div>
              <div style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted }}>
                Click "CREATE DEAL" to enable zoning analysis
              </div>
            </div>
          )
        )}
        {activeTab === "MARKET" && (
          property.dealId ? (
            <MarketTabContent dealId={property.dealId} />
          ) : (
            <div style={{ padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 11, fontFamily: T.font.mono, color: T.text.muted, marginBottom: 12 }}>
                Market intelligence available after creating a deal
              </div>
              <div style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted }}>
                Click "CREATE DEAL" to enable market analysis
              </div>
            </div>
          )
        )}
      </div>

      {/* Create Deal Modal */}
      {showCreateDeal && (
        <div onClick={() => setShowCreateDeal(false)} style={{
          position: "fixed", inset: 0, zIndex: 9999, background: "#000000dd",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: T.bg.panel, border: `1px solid ${T.border.medium}`,
            borderRadius: 4, padding: "24px", maxWidth: 500, width: "90%",
          }}>
            <div style={{ fontSize: 16, fontFamily: T.font.mono, fontWeight: 700, color: T.text.amber, marginBottom: 16 }}>
              CREATE DEAL CAPSULE
            </div>
            <div style={{ fontSize: 12, fontFamily: T.font.label, color: T.text.secondary, lineHeight: 1.6, marginBottom: 20 }}>
              Create a Deal Capsule to unlock the full 3-Layer ProForma Engine (M09), capital structure analysis (M11), and AI-adjusted assumptions.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowCreateDeal(false)} style={{
                background: "none", border: `1px solid ${T.border.medium}`,
                borderRadius: 2, padding: "8px 16px", cursor: "pointer",
                fontSize: 10, fontFamily: T.font.mono, color: T.text.secondary,
              }}>
                CANCEL
              </button>
              <button onClick={() => { /* TODO: Navigate to deal creation */ }} style={{
                background: T.text.amber, border: "none",
                borderRadius: 2, padding: "8px 16px", cursor: "pointer",
                fontSize: 10, fontFamily: T.font.mono, fontWeight: 700,
                color: T.bg.terminal, letterSpacing: "0.05em",
              }}>
                CREATE →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
