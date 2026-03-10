import { useState, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════
// ZONING TAB CONTENT
// Displays zoning profile, regulations, and capacity analysis
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

interface ZoningTabContentProps {
  dealId: string;
  apiBaseUrl?: string;
}

export const ZoningTabContent: React.FC<ZoningTabContentProps> = ({ 
  dealId, 
  apiBaseUrl = "/api/v1" 
}) => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    fetchZoningProfile();
  }, [dealId]);

  const fetchZoningProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${apiBaseUrl}/deals/${dealId}/zoning-profile`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setProfile(data.exists ? data.profile : null);
    } catch (err: any) {
      console.error('Error fetching zoning profile:', err);
      setError(err.message || 'Failed to load zoning data');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveProfile = async () => {
    try {
      setResolving(true);
      const response = await fetch(`${apiBaseUrl}/deals/${dealId}/zoning-profile/resolve`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setProfile(data.profile);
    } catch (err: any) {
      console.error('Error resolving zoning profile:', err);
      setError(err.message || 'Failed to resolve profile');
    } finally {
      setResolving(false);
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
          LOADING ZONING DATA...
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
          ⚠️ ERROR LOADING ZONING DATA
        </div>
        <div style={{ 
          fontSize: 9, 
          fontFamily: T.font.mono,
          color: T.text.secondary,
        }}>
          {error}
        </div>
        <button
          onClick={fetchZoningProfile}
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

  if (!profile) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{
          fontSize: 11,
          fontFamily: T.font.mono,
          color: T.text.muted,
          marginBottom: 16,
        }}>
          No zoning profile found for this property
        </div>
        <button
          onClick={handleResolveProfile}
          disabled={resolving}
          style={{
            padding: "6px 16px",
            background: resolving ? T.bg.hover : T.bg.active,
            border: `1px solid ${T.border.medium}`,
            borderRadius: 2,
            color: resolving ? T.text.muted : T.text.amber,
            fontSize: 10,
            fontFamily: T.font.mono,
            fontWeight: 700,
            cursor: resolving ? 'wait' : 'pointer',
            letterSpacing: "0.05em",
          }}
        >
          {resolving ? 'RESOLVING...' : 'RESOLVE ZONING PROFILE'}
        </button>
      </div>
    );
  }

  // Profile exists - display it
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      
      {/* Left Column: District & Regulations */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        
        {/* Zoning District */}
        <div style={{ 
          background: T.bg.panel, 
          border: `1px solid ${T.border.subtle}`,
          borderRadius: 4,
          overflow: 'hidden',
        }}>
          <SectionHeader 
            title="ZONING DISTRICT" 
            icon="🏛️"
            borderColor={T.text.cyan}
          />
          <div style={{ padding: 10 }}>
            <div style={{
              fontSize: 16,
              fontFamily: T.font.mono,
              fontWeight: 700,
              color: T.text.cyan,
              marginBottom: 8,
            }}>
              {profile.district_code || 'N/A'}
            </div>
            <div style={{
              fontSize: 9,
              fontFamily: T.font.label,
              color: T.text.secondary,
              lineHeight: 1.4,
            }}>
              {profile.district_name || 'District name unavailable'}
            </div>
            {profile.municipality && (
              <div style={{
                fontSize: 8,
                fontFamily: T.font.mono,
                color: T.text.muted,
                marginTop: 6,
              }}>
                {profile.municipality}
              </div>
            )}
          </div>
        </div>

        {/* Base Regulations */}
        {profile.base_regulations && (
          <div style={{ 
            background: T.bg.panel, 
            border: `1px solid ${T.border.subtle}`,
            borderRadius: 4,
            overflow: 'hidden',
          }}>
            <SectionHeader 
              title="BASE REGULATIONS" 
              icon="📋"
              borderColor={T.text.amber}
            />
            <div>
              {profile.base_regulations.max_height && (
                <DataRow 
                  label="Max Height" 
                  value={`${profile.base_regulations.max_height} ft`}
                />
              )}
              {profile.base_regulations.max_far && (
                <DataRow 
                  label="Max FAR" 
                  value={profile.base_regulations.max_far}
                />
              )}
              {profile.base_regulations.max_density && (
                <DataRow 
                  label="Max Density" 
                  value={`${profile.base_regulations.max_density} units/ac`}
                />
              )}
              {profile.base_regulations.min_lot_size && (
                <DataRow 
                  label="Min Lot Size" 
                  value={`${profile.base_regulations.min_lot_size.toLocaleString()} sf`}
                />
              )}
              {profile.base_regulations.setback_front && (
                <DataRow 
                  label="Front Setback" 
                  value={`${profile.base_regulations.setback_front} ft`}
                />
              )}
              {profile.base_regulations.setback_side && (
                <DataRow 
                  label="Side Setback" 
                  value={`${profile.base_regulations.setback_side} ft`}
                />
              )}
              {profile.base_regulations.setback_rear && (
                <DataRow 
                  label="Rear Setback" 
                  value={`${profile.base_regulations.setback_rear} ft`}
                />
              )}
            </div>
          </div>
        )}

        {/* Overlays */}
        {profile.overlays && profile.overlays.length > 0 && (
          <div style={{ 
            background: T.bg.panel, 
            border: `1px solid ${T.border.subtle}`,
            borderRadius: 4,
            overflow: 'hidden',
          }}>
            <SectionHeader 
              title="OVERLAY DISTRICTS" 
              icon="🔄"
              borderColor={T.text.purple}
            />
            <div style={{ padding: 10 }}>
              {profile.overlays.map((overlay: any, idx: number) => (
                <div 
                  key={idx}
                  style={{
                    padding: 8,
                    background: T.bg.panelAlt,
                    border: `1px solid ${T.border.subtle}`,
                    borderRadius: 2,
                    marginBottom: idx < profile.overlays.length - 1 ? 6 : 0,
                  }}
                >
                  <div style={{
                    fontSize: 9,
                    fontFamily: T.font.mono,
                    fontWeight: 700,
                    color: T.text.purple,
                    marginBottom: 4,
                  }}>
                    {overlay.name}
                  </div>
                  {overlay.source && (
                    <div style={{
                      fontSize: 8,
                      fontFamily: T.font.mono,
                      color: T.text.muted,
                    }}>
                      Source: {overlay.source}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Capacity & Analysis */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        
        {/* Effective Regulations (with overlays applied) */}
        {profile.effective_regulations && (
          <div style={{ 
            background: T.bg.panel, 
            border: `1px solid ${T.border.subtle}`,
            borderRadius: 4,
            overflow: 'hidden',
          }}>
            <SectionHeader 
              title="EFFECTIVE REGULATIONS" 
              icon="✓"
              subtitle="WITH OVERLAYS"
              borderColor={T.text.green}
            />
            <div>
              {profile.effective_regulations.max_height && (
                <DataRow 
                  label="Max Height" 
                  value={`${profile.effective_regulations.max_height} ft`}
                  color={T.text.green}
                />
              )}
              {profile.effective_regulations.max_far && (
                <DataRow 
                  label="Max FAR" 
                  value={profile.effective_regulations.max_far}
                  color={T.text.green}
                />
              )}
              {profile.effective_regulations.max_density && (
                <DataRow 
                  label="Max Density" 
                  value={`${profile.effective_regulations.max_density} units/ac`}
                  color={T.text.green}
                />
              )}
              {profile.effective_regulations.parking_ratio && (
                <DataRow 
                  label="Parking Ratio" 
                  value={`${profile.effective_regulations.parking_ratio} spaces/unit`}
                  color={T.text.green}
                />
              )}
            </div>
          </div>
        )}

        {/* Capacity Analysis */}
        {profile.capacity && (
          <div style={{ 
            background: T.bg.panel, 
            border: `1px solid ${T.border.subtle}`,
            borderRadius: 4,
            overflow: 'hidden',
          }}>
            <SectionHeader 
              title="CAPACITY ANALYSIS" 
              icon="📊"
              borderColor={T.text.blue}
            />
            <div>
              {profile.capacity.max_units !== undefined && (
                <DataRow 
                  label="Max Units" 
                  value={profile.capacity.max_units.toLocaleString()}
                  color={T.text.blue}
                />
              )}
              {profile.capacity.max_buildable_sf && (
                <DataRow 
                  label="Max Buildable SF" 
                  value={profile.capacity.max_buildable_sf.toLocaleString()}
                  color={T.text.blue}
                />
              )}
              {profile.capacity.parking_required && (
                <DataRow 
                  label="Parking Required" 
                  value={`${profile.capacity.parking_required} spaces`}
                  color={T.text.blue}
                />
              )}
            </div>
          </div>
        )}

        {/* Overrides (if any) */}
        {profile.overrides && Object.keys(profile.overrides).length > 0 && (
          <div style={{ 
            background: T.bg.panel, 
            border: `1px solid ${T.border.subtle}`,
            borderRadius: 4,
            overflow: 'hidden',
          }}>
            <SectionHeader 
              title="MANUAL OVERRIDES" 
              icon="⚙️"
              borderColor={T.text.orange}
            />
            <div style={{ padding: 10 }}>
              <Badge color={T.text.orange}>
                {Object.keys(profile.overrides).length} ACTIVE
              </Badge>
              <div style={{
                fontSize: 8,
                fontFamily: T.font.mono,
                color: T.text.muted,
                marginTop: 6,
              }}>
                Manual overrides applied to regulations
              </div>
            </div>
          </div>
        )}

        {/* Data Source */}
        <div style={{ 
          background: T.bg.panelAlt, 
          border: `1px solid ${T.border.subtle}`,
          borderRadius: 4,
          padding: 10,
        }}>
          <div style={{
            fontSize: 8,
            fontFamily: T.font.mono,
            color: T.text.muted,
            lineHeight: 1.4,
          }}>
            <div style={{ marginBottom: 4 }}>
              <strong style={{ color: T.text.secondary }}>Data Source:</strong> {profile.source || 'Municipal database'}
            </div>
            {profile.last_verified && (
              <div>
                <strong style={{ color: T.text.secondary }}>Last Verified:</strong> {new Date(profile.last_verified).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZoningTabContent;
