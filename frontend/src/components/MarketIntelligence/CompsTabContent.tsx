import React, { useState, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════
// COMPS TAB CONTENT  
// Displays comparable properties with auto-discovery capability
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

const Badge = ({ children, color = T.text.amber, bg, border: bdr }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", padding: "1px 6px",
    fontSize: 8, fontFamily: T.font.mono, fontWeight: 700, letterSpacing: "0.05em",
    color, background: bg || `${color}15`, border: `1px solid ${bdr || `${color}40`}`,
    borderRadius: 2, lineHeight: "14px", whiteSpace: "nowrap",
  }}>{children}</span>
);

interface Comp {
  id: string;
  comp_property_address: string;
  comp_name: string;
  units?: number;
  year_built?: number;
  stories?: number;
  class_code?: string;
  avg_rent?: number;
  occupancy?: number;
  distance_miles?: number;
  match_score?: number;
  google_rating?: number;
  google_review_count?: number;
  source: string;
  notes?: string;
}

interface CompsTabContentProps {
  dealId: string;
  apiBaseUrl?: string;
}

export const CompsTabContent: React.FC<CompsTabContentProps> = ({ 
  dealId, 
  apiBaseUrl = "/api/v1" 
}) => {
  const [comps, setComps] = useState<Comp[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'distance' | 'score' | 'rent'>('score');

  useEffect(() => {
    fetchComps();
  }, [dealId]);

  const fetchComps = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${apiBaseUrl}/${dealId}/comp-set`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setComps(data.comps || []);
    } catch (err: any) {
      console.error('Error fetching comps:', err);
      setError(err.message || 'Failed to load comps');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscoverComps = async () => {
    try {
      setDiscovering(true);
      setError(null);
      const response = await fetch(`${apiBaseUrl}/${dealId}/comp-set/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ radiusMiles: 3, maxComps: 15 }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setComps(data.comps || []);
    } catch (err: any) {
      console.error('Error discovering comps:', err);
      setError(err.message || 'Failed to discover comps');
    } finally {
      setDiscovering(false);
    }
  };

  const sortedComps = [...comps].sort((a, b) => {
    switch (sortBy) {
      case 'distance':
        return (a.distance_miles || 999) - (b.distance_miles || 999);
      case 'score':
        return (b.match_score || 0) - (a.match_score || 0);
      case 'rent':
        return (b.avg_rent || 0) - (a.avg_rent || 0);
      default:
        return 0;
    }
  });

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
          LOADING COMP DATA...
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
          ⚠️ ERROR LOADING COMPS
        </div>
        <div style={{ 
          fontSize: 9, 
          fontFamily: T.font.mono,
          color: T.text.secondary,
        }}>
          {error}
        </div>
        <button
          onClick={fetchComps}
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

  if (comps.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{
          fontSize: 11,
          fontFamily: T.font.mono,
          color: T.text.muted,
          marginBottom: 16,
        }}>
          No comps found for this property
        </div>
        <button
          onClick={handleDiscoverComps}
          disabled={discovering}
          style={{
            padding: "8px 20px",
            background: discovering ? T.bg.hover : `linear-gradient(135deg, ${T.text.blue} 0%, ${T.text.green} 100%)`,
            border: `1px solid ${discovering ? T.border.medium : T.text.blue}`,
            borderRadius: 3,
            color: T.text.white,
            fontSize: 10,
            fontFamily: T.font.mono,
            fontWeight: 700,
            cursor: discovering ? 'wait' : 'pointer',
            letterSpacing: "0.05em",
            boxShadow: discovering ? 'none' : `0 2px 8px ${T.text.blue}40`,
          }}
        >
          {discovering ? '🔍 DISCOVERING...' : '🔍 DISCOVER COMPS'}
        </button>
        <div style={{
          fontSize: 8,
          fontFamily: T.font.mono,
          color: T.text.muted,
          marginTop: 12,
        }}>
          Auto-discover similar properties within 3 miles
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header with controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        background: T.bg.panel,
        border: `1px solid ${T.border.subtle}`,
        borderRadius: 4,
        marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontSize: 10,
            fontFamily: T.font.mono,
            color: T.text.secondary,
          }}>
            SORT BY:
          </span>
          {(['score', 'distance', 'rent'] as const).map(sort => (
            <button
              key={sort}
              onClick={() => setSortBy(sort)}
              style={{
                background: sortBy === sort ? T.bg.active : 'transparent',
                border: `1px solid ${sortBy === sort ? T.text.amber : T.border.subtle}`,
                borderRadius: 2,
                padding: "3px 8px",
                fontSize: 8,
                fontFamily: T.font.mono,
                fontWeight: 600,
                color: sortBy === sort ? T.text.amber : T.text.secondary,
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {sort}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Badge color={T.text.green}>
            {comps.length} COMPS
          </Badge>
          <button
            onClick={handleDiscoverComps}
            disabled={discovering}
            style={{
              padding: "4px 10px",
              background: T.bg.active,
              border: `1px solid ${T.border.medium}`,
              borderRadius: 2,
              color: discovering ? T.text.muted : T.text.cyan,
              fontSize: 8,
              fontFamily: T.font.mono,
              fontWeight: 700,
              cursor: discovering ? 'wait' : 'pointer',
            }}
          >
            {discovering ? 'DISCOVERING...' : '🔄 REFRESH'}
          </button>
        </div>
      </div>

      {/* Comps Grid */}
      <div style={{ 
        display: 'grid', 
        gap: 10,
      }}>
        {sortedComps.map((comp, idx) => (
          <div
            key={comp.id}
            style={{
              background: T.bg.panel,
              border: `1px solid ${T.border.subtle}`,
              borderLeft: `3px solid ${
                comp.match_score >= 90 ? T.text.green :
                comp.match_score >= 75 ? T.text.amber :
                comp.match_score >= 60 ? T.text.orange : T.text.red
              }`,
              borderRadius: 4,
              overflow: 'hidden',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = T.bg.hover;
              e.currentTarget.style.borderColor = T.border.medium;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = T.bg.panel;
              e.currentTarget.style.borderColor = T.border.subtle;
            }}
          >
            {/* Comp Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              padding: '8px 10px',
              background: T.bg.header,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 10,
                  fontFamily: T.font.mono,
                  fontWeight: 700,
                  color: T.text.white,
                  marginBottom: 3,
                }}>
                  {comp.comp_name || comp.comp_property_address}
                </div>
                <div style={{
                  fontSize: 8,
                  fontFamily: T.font.mono,
                  color: T.text.muted,
                }}>
                  {comp.comp_property_address}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {comp.match_score !== undefined && (
                  <Badge 
                    color={
                      comp.match_score >= 90 ? T.text.green :
                      comp.match_score >= 75 ? T.text.amber :
                      comp.match_score >= 60 ? T.text.orange : T.text.red
                    }
                  >
                    {comp.match_score.toFixed(0)}% MATCH
                  </Badge>
                )}
                {comp.source === 'manual' && (
                  <Badge color={T.text.purple}>MANUAL</Badge>
                )}
              </div>
            </div>

            {/* Comp Stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 0,
            }}>
              {comp.distance_miles !== undefined && (
                <div style={{
                  padding: '6px 10px',
                  borderBottom: `1px solid ${T.border.subtle}08`,
                  borderRight: `1px solid ${T.border.subtle}08`,
                }}>
                  <div style={{ fontSize: 7, fontFamily: T.font.label, color: T.text.muted, marginBottom: 2 }}>
                    DISTANCE
                  </div>
                  <div style={{ fontSize: 10, fontFamily: T.font.mono, fontWeight: 600, color: T.text.cyan }}>
                    {comp.distance_miles.toFixed(1)} mi
                  </div>
                </div>
              )}
              {comp.units !== undefined && (
                <div style={{
                  padding: '6px 10px',
                  borderBottom: `1px solid ${T.border.subtle}08`,
                  borderRight: `1px solid ${T.border.subtle}08`,
                }}>
                  <div style={{ fontSize: 7, fontFamily: T.font.label, color: T.text.muted, marginBottom: 2 }}>
                    UNITS
                  </div>
                  <div style={{ fontSize: 10, fontFamily: T.font.mono, fontWeight: 600, color: T.text.primary }}>
                    {comp.units.toLocaleString()}
                  </div>
                </div>
              )}
              {comp.avg_rent !== undefined && (
                <div style={{
                  padding: '6px 10px',
                  borderBottom: `1px solid ${T.border.subtle}08`,
                  borderRight: `1px solid ${T.border.subtle}08`,
                }}>
                  <div style={{ fontSize: 7, fontFamily: T.font.label, color: T.text.muted, marginBottom: 2 }}>
                    AVG RENT
                  </div>
                  <div style={{ fontSize: 10, fontFamily: T.font.mono, fontWeight: 600, color: T.text.green }}>
                    ${comp.avg_rent.toLocaleString()}
                  </div>
                </div>
              )}
              {comp.occupancy !== undefined && (
                <div style={{
                  padding: '6px 10px',
                  borderBottom: `1px solid ${T.border.subtle}08`,
                  borderRight: `1px solid ${T.border.subtle}08`,
                }}>
                  <div style={{ fontSize: 7, fontFamily: T.font.label, color: T.text.muted, marginBottom: 2 }}>
                    OCCUPANCY
                  </div>
                  <div style={{ fontSize: 10, fontFamily: T.font.mono, fontWeight: 600, color: comp.occupancy >= 95 ? T.text.green : comp.occupancy >= 90 ? T.text.amber : T.text.orange }}>
                    {comp.occupancy.toFixed(1)}%
                  </div>
                </div>
              )}
              {comp.year_built !== undefined && (
                <div style={{
                  padding: '6px 10px',
                  borderBottom: `1px solid ${T.border.subtle}08`,
                  borderRight: `1px solid ${T.border.subtle}08`,
                }}>
                  <div style={{ fontSize: 7, fontFamily: T.font.label, color: T.text.muted, marginBottom: 2 }}>
                    YEAR BUILT
                  </div>
                  <div style={{ fontSize: 10, fontFamily: T.font.mono, fontWeight: 600, color: T.text.primary }}>
                    {comp.year_built}
                  </div>
                </div>
              )}
              {comp.class_code && (
                <div style={{
                  padding: '6px 10px',
                  borderBottom: `1px solid ${T.border.subtle}08`,
                  borderRight: `1px solid ${T.border.subtle}08`,
                }}>
                  <div style={{ fontSize: 7, fontFamily: T.font.label, color: T.text.muted, marginBottom: 2 }}>
                    CLASS
                  </div>
                  <div style={{ fontSize: 10, fontFamily: T.font.mono, fontWeight: 700, color: T.text.amber }}>
                    {comp.class_code}
                  </div>
                </div>
              )}
              {comp.google_rating !== undefined && (
                <div style={{
                  padding: '6px 10px',
                  borderBottom: `1px solid ${T.border.subtle}08`,
                }}>
                  <div style={{ fontSize: 7, fontFamily: T.font.label, color: T.text.muted, marginBottom: 2 }}>
                    GOOGLE RATING
                  </div>
                  <div style={{ fontSize: 10, fontFamily: T.font.mono, fontWeight: 600, color: T.text.primary }}>
                    ⭐ {comp.google_rating.toFixed(1)}
                    {comp.google_review_count && (
                      <span style={{ fontSize: 8, color: T.text.muted, marginLeft: 4 }}>
                        ({comp.google_review_count})
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            {comp.notes && (
              <div style={{
                padding: '8px 10px',
                background: T.bg.panelAlt,
                fontSize: 8,
                fontFamily: T.font.mono,
                color: T.text.secondary,
                lineHeight: 1.4,
                fontStyle: 'italic',
              }}>
                {comp.notes}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CompsTabContent;
