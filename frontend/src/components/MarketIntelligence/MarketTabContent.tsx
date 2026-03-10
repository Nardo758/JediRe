import { useState, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════
// MARKET TAB CONTENT
// Displays market intelligence: demographics, economy, supply context
// ═══════════════════════════════════════════════════════════════

const T = {
  bg: { terminal:"#0A0E17",panel:"#0F1319",panelAlt:"#131821",header:"#1A1F2E",hover:"#1E2538",active:"#252D40",input:"#0D1117" },
  text: { primary:"#E8ECF1",secondary:"#8B95A5",muted:"#4A5568",amber:"#F5A623",green:"#00D26A",red:"#FF4757",cyan:"#00BCD4",orange:"#FF8C42",purple:"#A78BFA",white:"#FFFFFF",blue:"#4A9EFF" },
  border: { subtle:"#1E2538",medium:"#2A3348",bright:"#3B4A6B" },
  font: { mono:"'JetBrains Mono','Fira Code','SF Mono',monospace",display:"'IBM Plex Mono',monospace",label:"'IBM Plex Sans',sans-serif" },
};

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

const Badge = ({ children, color = T.text.amber, bg, border: bdr }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", padding: "1px 6px",
    fontSize: 8, fontFamily: T.font.mono, fontWeight: 700, letterSpacing: "0.05em",
    color, background: bg || `${color}15`, border: `1px solid ${bdr || `${color}40`}`,
    borderRadius: 2, lineHeight: "14px", whiteSpace: "nowrap",
  }}>{children}</span>
);

interface MarketTabContentProps {
  dealId: string;
  apiBaseUrl?: string;
}

export const MarketTabContent: React.FC<MarketTabContentProps> = ({ 
  dealId, 
  apiBaseUrl = "/api/v1" 
}) => {
  const [marketData, setMarketData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMarketIntelligence();
  }, [dealId]);

  const fetchMarketIntelligence = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${apiBaseUrl}/${dealId}/market-intelligence`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      setMarketData(result.data || null);
    } catch (err: any) {
      console.error('Error fetching market intelligence:', err);
      setError(err.message || 'Failed to load market data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: 60,
        color: T.text.muted,
        fontFamily: T.font.mono,
        fontSize: 11,
      }}>
        <div style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
          LOADING MARKET INTELLIGENCE...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: `${T.text.red}10`,
        border: `1px solid ${T.text.red}40`,
        borderRadius: 4,
        padding: 16,
        margin: 16,
      }}>
        <div style={{ 
          fontSize: 10, 
          fontFamily: T.font.mono, 
          fontWeight: 700,
          color: T.text.red,
          marginBottom: 6,
        }}>
          ⚠️ ERROR LOADING MARKET DATA
        </div>
        <div style={{ 
          fontSize: 9, 
          fontFamily: T.font.mono,
          color: T.text.secondary,
        }}>
          {error}
        </div>
        <button
          onClick={fetchMarketIntelligence}
          style={{
            marginTop: 12,
            padding: "4px 12px",
            background: T.bg.active,
            border: `1px solid ${T.border.medium}`,
            borderRadius: 2,
            color: T.text.amber,
            fontSize: 9,
            fontFamily: T.font.mono,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          RETRY
        </button>
      </div>
    );
  }

  if (!marketData) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: T.text.muted, fontFamily: T.font.mono, fontSize: 11 }}>
        No market intelligence available for this deal
      </div>
    );
  }

  const { demographics, economy, supplyContext, news } = marketData;
  const census = demographics?.census;
  const submarket = demographics?.submarket;
  const msa = demographics?.msa;

  return (
    <div>
      {/* Top Row: Demographics & Economy */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        
        {/* Demographics */}
        <div style={{ 
          background: T.bg.panel, 
          border: `1px solid ${T.border.subtle}`,
          borderRadius: 4,
          overflow: 'hidden',
        }}>
          <SectionHeader 
            title="DEMOGRAPHICS" 
            icon="👥"
            subtitle="CENSUS + SUBMARKET"
            borderColor={T.text.cyan}
          />
          <div>
            {census?.population && (
              <DataRow 
                label="Population (Trade Area)" 
                value={census.population.toLocaleString()}
                color={T.text.cyan}
              />
            )}
            {census?.medianIncome && (
              <DataRow 
                label="Median Income" 
                value={`$${census.medianIncome.toLocaleString()}`}
                color={T.text.green}
              />
            )}
            {census?.totalHousingUnits && (
              <DataRow 
                label="Housing Units" 
                value={census.totalHousingUnits.toLocaleString()}
              />
            )}
            {census?.medianRent && (
              <DataRow 
                label="Median Rent (Census)" 
                value={`$${census.medianRent.toLocaleString()}`}
                color={T.text.amber}
              />
            )}
            {submarket?.avg_rent && (
              <DataRow 
                label="Avg Rent (Submarket)" 
                value={`$${Math.round(submarket.avg_rent).toLocaleString()}`}
                color={T.text.amber}
              />
            )}
            {submarket?.avg_occupancy && (
              <DataRow 
                label="Avg Occupancy (Submarket)" 
                value={`${(submarket.avg_occupancy).toFixed(1)}%`}
                color={submarket.avg_occupancy >= 95 ? T.text.green : submarket.avg_occupancy >= 90 ? T.text.amber : T.text.orange}
              />
            )}
            {msa?.population && (
              <DataRow 
                label="MSA Population" 
                value={msa.population.toLocaleString()}
                sub="metro area"
                color={T.text.muted}
              />
            )}
          </div>
        </div>

        {/* Economy */}
        <div style={{ 
          background: T.bg.panel, 
          border: `1px solid ${T.border.subtle}`,
          borderRadius: 4,
          overflow: 'hidden',
        }}>
          <SectionHeader 
            title="ECONOMY" 
            icon="💼"
            subtitle="EMPLOYERS & INDUSTRIES"
            borderColor={T.text.green}
          />
          <div style={{ padding: 10 }}>
            {economy?.employers && economy.employers.length > 0 ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{
                  fontSize: 8,
                  fontFamily: T.font.mono,
                  color: T.text.muted,
                  marginBottom: 6,
                  textTransform: 'uppercase',
                }}>
                  Major Employers:
                </div>
                {economy.employers.slice(0, 5).map((emp: any, idx: number) => (
                  <div 
                    key={idx}
                    style={{
                      padding: '4px 8px',
                      background: T.bg.panelAlt,
                      border: `1px solid ${T.border.subtle}`,
                      borderRadius: 2,
                      marginBottom: 4,
                      fontSize: 9,
                      fontFamily: T.font.mono,
                      color: T.text.primary,
                    }}
                  >
                    <strong>{emp.name}</strong>
                    {emp.employees && (
                      <span style={{ color: T.text.muted, marginLeft: 6 }}>
                        ({emp.employees.toLocaleString()} employees)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>
                No employer data available
              </div>
            )}

            {economy?.wageRentAlignment && (
              <div style={{
                padding: 8,
                background: economy.wageRentAlignment.ratio >= 30 ? `${T.text.green}15` : `${T.text.orange}15`,
                border: `1px solid ${economy.wageRentAlignment.ratio >= 30 ? T.text.green : T.text.orange}40`,
                borderRadius: 2,
                marginTop: 8,
              }}>
                <div style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted, marginBottom: 3 }}>
                  Wage-Rent Alignment:
                </div>
                <div style={{ fontSize: 10, fontFamily: T.font.mono, fontWeight: 700, color: economy.wageRentAlignment.ratio >= 30 ? T.text.green : T.text.orange }}>
                  {economy.wageRentAlignment.ratio.toFixed(1)}% income to rent
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Supply Context */}
      {supplyContext?.competingProperties && (
        <div style={{ 
          background: T.bg.panel, 
          border: `1px solid ${T.border.subtle}`,
          borderRadius: 4,
          overflow: 'hidden',
          marginBottom: 12,
        }}>
          <SectionHeader 
            title="SUPPLY CONTEXT" 
            icon="🏢"
            subtitle={`${supplyContext.radiusMiles} MILE RADIUS`}
            borderColor={T.text.orange}
          />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 0,
          }}>
            <DataRow 
              label="Competing Properties" 
              value={supplyContext.competingProperties.count}
              color={T.text.orange}
            />
            <DataRow 
              label="Avg Units" 
              value={supplyContext.competingProperties.avgUnits.toLocaleString()}
            />
            <DataRow 
              label="Avg Occupancy" 
              value={`${supplyContext.competingProperties.avgOccupancy}%`}
              color={supplyContext.competingProperties.avgOccupancy >= 95 ? T.text.green : T.text.amber}
            />
            <DataRow 
              label="Avg Rent" 
              value={`$${supplyContext.competingProperties.avgRent.toLocaleString()}`}
              color={T.text.green}
            />
            <DataRow 
              label="Total Pipeline Units" 
              value={supplyContext.competingProperties.totalPipelineUnits.toLocaleString()}
              color={T.text.purple}
            />
          </div>
        </div>
      )}

      {/* News Events */}
      {news && news.length > 0 && (
        <div style={{ 
          background: T.bg.panel, 
          border: `1px solid ${T.border.subtle}`,
          borderRadius: 4,
          overflow: 'hidden',
        }}>
          <SectionHeader 
            title="MARKET NEWS" 
            icon="📰"
            subtitle={`${news.length} RECENT EVENTS`}
            borderColor={T.text.purple}
          />
          <div style={{ padding: 10 }}>
            {news.slice(0, 8).map((item: any, idx: number) => (
              <div 
                key={idx}
                style={{
                  padding: '8px 10px',
                  background: T.bg.panelAlt,
                  border: `1px solid ${T.border.subtle}`,
                  borderRadius: 2,
                  marginBottom: idx < Math.min(news.length, 8) - 1 ? 8 : 0,
                }}
              >
                <div style={{
                  fontSize: 9,
                  fontFamily: T.font.mono,
                  fontWeight: 600,
                  color: T.text.primary,
                  marginBottom: 4,
                  lineHeight: 1.4,
                }}>
                  {item.title || item.summary}
                </div>
                {item.date && (
                  <div style={{
                    fontSize: 7,
                    fontFamily: T.font.mono,
                    color: T.text.muted,
                  }}>
                    {new Date(item.date).toLocaleDateString()}
                  </div>
                )}
                {item.category && (
                  <Badge color={
                    item.category === 'development' ? T.text.green :
                    item.category === 'policy' ? T.text.amber :
                    item.category === 'economy' ? T.text.cyan : T.text.purple
                  }>
                    {item.category.toUpperCase()}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Development Pipeline */}
      {economy?.developmentPipeline && economy.developmentPipeline.length > 0 && (
        <div style={{ 
          background: T.bg.panel, 
          border: `1px solid ${T.border.subtle}`,
          borderRadius: 4,
          overflow: 'hidden',
          marginTop: 12,
        }}>
          <SectionHeader 
            title="DEVELOPMENT PIPELINE" 
            icon="🏗️"
            borderColor={T.text.blue}
          />
          <div style={{ padding: 10 }}>
            {economy.developmentPipeline.map((project: any, idx: number) => (
              <div 
                key={idx}
                style={{
                  padding: '6px 8px',
                  background: T.bg.panelAlt,
                  border: `1px solid ${T.border.subtle}`,
                  borderRadius: 2,
                  marginBottom: 4,
                  fontSize: 9,
                  fontFamily: T.font.mono,
                  color: T.text.primary,
                }}
              >
                <strong>{project.name}</strong>
                {project.type && (
                  <span style={{ color: T.text.muted, marginLeft: 6 }}>
                    ({project.type})
                  </span>
                )}
                {project.status && (
                  <Badge 
                    color={
                      project.status === 'completed' ? T.text.green :
                      project.status === 'under_construction' ? T.text.amber : T.text.blue
                    }
                    style={{ marginLeft: 6 }}
                  >
                    {project.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketTabContent;
