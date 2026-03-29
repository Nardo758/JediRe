/**
 * PropertyTerminalPage - Standalone page wrapper for PropertyTerminal
 * 
 * Routes: /terminal/property/:id
 * 
 * Full Bloomberg-style property terminal with 8 tabs:
 * OVERVIEW | TRAFFIC | FINANCIALS | CAPITAL | MARKET | COMPS | NEWS | STRATEGY
 * 
 * Navigation: Back button returns to previous level (submarket/MSA/markets)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { PropertyTerminal } from '../../components/terminal/PropertyTerminal';
import { BloombergPropertyCard } from '../../components/terminal/BloombergPropertyCard';
import { BT } from '../../components/terminal/theme';
import { ChevronLeft, ExternalLink, Star, Plus } from 'lucide-react';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

interface PropertyContext {
  msaId?: string;
  msaName?: string;
  submarketId?: string;
  submarketName?: string;
  propertyName?: string;
}

// Mock property data (would come from API)
const MOCK_PROPERTIES: Record<string, any> = {
  'the-metropolitan': {
    id: 'the-metropolitan',
    name: 'The Metropolitan',
    address: '999 Peachtree St NE, Atlanta, GA 30309',
    submarket: 'Midtown',
    msa: 'Atlanta, GA',
    class: 'A',
    units: 412,
    yearBuilt: 2019,
    avgRent: 2450,
    rentChange: 85,
    rentChangePercent: 3.6,
    occupancy: 96.2,
    occupancyChange: 1.4,
    capRate: 4.6,
    owner: 'Greystar',
    jediScore: 94,
  },
  'avalon-buckhead': {
    id: 'avalon-buckhead',
    name: 'Avalon Buckhead',
    address: '3300 Peachtree Rd NE, Atlanta, GA 30326',
    submarket: 'Buckhead',
    msa: 'Atlanta, GA',
    class: 'A',
    units: 380,
    yearBuilt: 2017,
    avgRent: 2280,
    rentChange: 120,
    rentChangePercent: 5.5,
    occupancy: 95.8,
    occupancyChange: 0.8,
    capRate: 4.8,
    owner: 'AvalonBay',
    jediScore: 91,
  },
  'camden-midtown': {
    id: 'camden-midtown',
    name: 'Camden Midtown',
    address: '1055 Piedmont Ave NE, Atlanta, GA 30309',
    submarket: 'Midtown',
    msa: 'Atlanta, GA',
    class: 'A',
    units: 305,
    yearBuilt: 2015,
    avgRent: 2120,
    rentChange: 95,
    rentChangePercent: 4.7,
    occupancy: 94.6,
    occupancyChange: 0.5,
    capRate: 5.0,
    owner: 'Camden',
    jediScore: 89,
  },
  'channel-district-lofts': {
    id: 'channel-district-lofts',
    name: 'Channel District Lofts',
    address: '615 Channelside Dr, Tampa, FL 33602',
    submarket: 'Downtown Tampa',
    msa: 'Tampa, FL',
    class: 'A',
    units: 248,
    yearBuilt: 2018,
    avgRent: 1920,
    rentChange: 72,
    rentChangePercent: 3.9,
    occupancy: 93.4,
    occupancyChange: -0.2,
    capRate: 5.2,
    owner: 'ZOM Living',
    jediScore: 85,
  },
  'the-edison': {
    id: 'the-edison',
    name: 'The Edison',
    address: '315 S Dawson St, Raleigh, NC 27601',
    submarket: 'Downtown Raleigh',
    msa: 'Raleigh, NC',
    class: 'A',
    units: 280,
    yearBuilt: 2020,
    avgRent: 1780,
    rentChange: 88,
    rentChangePercent: 5.2,
    occupancy: 95.2,
    occupancyChange: 1.1,
    capRate: 5.0,
    owner: 'Crescent',
    jediScore: 88,
  },
  'midtown-terrace': {
    id: 'midtown-terrace',
    name: 'Midtown Terrace',
    address: '1280 Spring St NW, Atlanta, GA 30309',
    submarket: 'Midtown',
    msa: 'Atlanta, GA',
    class: 'C',
    units: 180,
    yearBuilt: 1998,
    avgRent: 1420,
    rentChange: 180,
    rentChangePercent: 14.5,
    occupancy: 88.4,
    occupancyChange: -2.1,
    capRate: 6.2,
    owner: 'Local LLC',
    jediScore: 42,
    // Value-add opportunity
    lossToLease: 220,
    lossToLeasePct: 14.8,
    sellerMotivation: 78,
  },
};

export const PropertyTerminalPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [property, setProperty] = useState<any>(null);
  const [showQuickCard, setShowQuickCard] = useState(false);

  // Get navigation context from location state
  const context: PropertyContext = useMemo(() => {
    const state = location.state as PropertyContext | undefined;
    return {
      msaId: state?.msaId,
      msaName: state?.msaName,
      submarketId: state?.submarketId,
      submarketName: state?.submarketName,
      propertyName: state?.propertyName,
    };
  }, [location.state]);

  // Load property data
  useEffect(() => {
    const loadProperty = async () => {
      setLoading(true);
      setError(null);

      try {
        // First check mock data
        const mockProp = id ? MOCK_PROPERTIES[id] : null;
        if (mockProp) {
          setProperty(mockProp);
          setLoading(false);
          return;
        }

        // Try API
        const response = await fetch(`/api/v1/properties/${id}`);
        if (!response.ok) throw new Error('Property not found');
        const data = await response.json();
        setProperty(data);
      } catch (err: any) {
        // Fallback to first mock property for demo
        const fallback = Object.values(MOCK_PROPERTIES)[0];
        setProperty({ ...fallback, id, name: context.propertyName || id });
      } finally {
        setLoading(false);
      }
    };

    loadProperty();
  }, [id, context.propertyName]);

  // Handle back navigation
  const handleBack = () => {
    if (context.submarketId) {
      // Go back to submarket
      navigate('/f4', { 
        state: { 
          level: 'submarket-terminal',
          msaId: context.msaId,
          msaName: context.msaName,
          submarketId: context.submarketId,
          submarketName: context.submarketName,
        }
      });
    } else if (context.msaId) {
      // Go back to MSA
      navigate('/f4', {
        state: {
          level: 'msa-terminal',
          msaId: context.msaId,
          msaName: context.msaName,
        }
      });
    } else {
      // Go back to markets landing
      navigate('/f4');
    }
  };

  // Build breadcrumb items
  const breadcrumbs = useMemo(() => {
    const items: { label: string; onClick?: () => void }[] = [
      { label: 'F4 MARKETS', onClick: () => navigate('/f4') },
    ];
    
    if (context.msaName) {
      items.push({
        label: context.msaName.toUpperCase(),
        onClick: () => navigate('/f4', { state: { level: 'msa-terminal', msaId: context.msaId, msaName: context.msaName } }),
      });
    }
    
    if (context.submarketName) {
      items.push({
        label: context.submarketName.toUpperCase(),
        onClick: () => navigate('/f4', { state: { level: 'submarket-terminal', msaId: context.msaId, msaName: context.msaName, submarketId: context.submarketId, submarketName: context.submarketName } }),
      });
    }
    
    items.push({ label: (property?.name || id || 'PROPERTY').toUpperCase() });
    
    return items;
  }, [context, property, id, navigate]);

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: BT.bg.terminal,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40,
            height: 40,
            border: `3px solid ${BT.border.subtle}`,
            borderTopColor: BT.text.amber,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }} />
          <div style={{ ...mono, fontSize: 11, color: BT.text.muted }}>
            Loading property terminal...
          </div>
        </div>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: BT.bg.terminal,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
          <div style={{ ...mono, fontSize: 14, color: BT.text.red, marginBottom: 8 }}>
            Failed to load property
          </div>
          <div style={{ ...mono, fontSize: 11, color: BT.text.muted, marginBottom: 16 }}>
            {error}
          </div>
          <button
            onClick={handleBack}
            style={{
              ...mono,
              fontSize: 11,
              fontWeight: 600,
              padding: '8px 16px',
              background: BT.bg.active,
              border: `1px solid ${BT.text.amber}`,
              borderRadius: 4,
              color: BT.text.amber,
              cursor: 'pointer',
            }}
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: BT.bg.terminal,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Top Navigation Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 16px',
        background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.medium}`,
        flexShrink: 0,
      }}>
        {/* Back Button */}
        <button
          onClick={handleBack}
          style={{
            ...mono,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10,
            fontWeight: 700,
            padding: '4px 10px',
            background: 'transparent',
            border: `1px solid ${BT.text.cyan}44`,
            borderRadius: 3,
            color: BT.text.cyan,
            cursor: 'pointer',
          }}
        >
          <ChevronLeft size={12} />
          BACK
        </button>

        {/* Breadcrumbs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {breadcrumbs.map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={{ ...mono, fontSize: 9, color: BT.text.muted }}>›</span>}
              {item.onClick ? (
                <button
                  onClick={item.onClick}
                  style={{
                    ...mono,
                    fontSize: i === breadcrumbs.length - 1 ? 11 : 9,
                    fontWeight: i === breadcrumbs.length - 1 ? 700 : 500,
                    color: i === breadcrumbs.length - 1 ? BT.text.primary : BT.text.amber,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px 4px',
                  }}
                >
                  {item.label}
                </button>
              ) : (
                <span style={{
                  ...mono,
                  fontSize: 11,
                  fontWeight: 700,
                  color: BT.text.primary,
                }}>
                  {item.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Quick Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Toggle Quick Card */}
          <button
            onClick={() => setShowQuickCard(!showQuickCard)}
            style={{
              ...mono,
              fontSize: 9,
              fontWeight: 600,
              padding: '4px 10px',
              background: showQuickCard ? BT.bg.active : 'transparent',
              border: `1px solid ${showQuickCard ? BT.text.amber : BT.border.subtle}`,
              borderRadius: 3,
              color: showQuickCard ? BT.text.amber : BT.text.muted,
              cursor: 'pointer',
            }}
          >
            {showQuickCard ? 'HIDE CARD' : 'QUICK VIEW'}
          </button>

          {/* Track Property */}
          <button
            style={{
              ...mono,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 9,
              fontWeight: 600,
              padding: '4px 10px',
              background: 'transparent',
              border: `1px solid ${BT.border.subtle}`,
              borderRadius: 3,
              color: BT.text.muted,
              cursor: 'pointer',
            }}
          >
            <Star size={10} />
            TRACK
          </button>

          {/* Create Deal */}
          <button
            onClick={() => navigate('/deals/create', { 
              state: { 
                sourcePropertyId: property?.id,
                propertyName: property?.name,
                address: property?.address,
                units: property?.units,
              }
            })}
            style={{
              ...mono,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 9,
              fontWeight: 700,
              padding: '4px 12px',
              background: `${BT.text.green}22`,
              border: `1px solid ${BT.text.green}66`,
              borderRadius: 3,
              color: BT.text.green,
              cursor: 'pointer',
            }}
          >
            <Plus size={10} />
            CREATE DEAL
          </button>

          {/* LIVE Indicator */}
          <div style={{
            ...mono,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 9,
            fontWeight: 600,
            color: BT.text.green,
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: BT.text.green,
              animation: 'pulse 2s infinite',
            }} />
            LIVE
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Quick Card Sidebar */}
        {showQuickCard && property && (
          <div style={{
            width: 380,
            flexShrink: 0,
            borderRight: `1px solid ${BT.border.medium}`,
            overflow: 'auto',
            padding: 12,
            background: BT.bg.panel,
          }}>
            <BloombergPropertyCard
              property={{
                id: property.id,
                name: property.name,
                address: property.address,
                class: property.class,
                avgRent: property.avgRent,
                rentChange: property.rentChange,
                rentChangePercent: property.rentChangePercent,
                units: property.units,
                yearBuilt: property.yearBuilt,
                occupancy: property.occupancy,
                occupancyChange: property.occupancyChange,
                capRate: property.capRate,
                owner: property.owner,
              }}
              showComps={true}
              strategyScore={{
                score: property.jediScore || 80,
                strategy: property.jediScore > 80 ? 'core-plus' : 'value-add',
                arbitrageFlag: (property.sellerMotivation || 0) > 70,
              }}
            />
          </div>
        )}

        {/* Property Terminal */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <PropertyTerminal
            dealId={property?.id || id || 'unknown'}
            deal={property}
            embedded={true}
          />
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '6px 16px',
        background: BT.bg.header,
        borderTop: `1px solid ${BT.border.subtle}`,
        fontSize: 9,
        color: BT.text.dim,
        gap: 16,
        flexShrink: 0,
      }}>
        <span style={{ color: BT.text.green }}>● FEDRATE 4.25%</span>
        <span>|</span>
        <span style={{ color: BT.text.cyan }}>10Y 4.18%</span>
        <span>|</span>
        <span style={{ color: BT.text.amber }}>SOFR 4.31%</span>
        <span>|</span>
        <span>{property?.msa || 'Market'} Vacancy {property?.submarketVacancy || '6.2%'}</span>
        <span style={{ marginLeft: 'auto', color: BT.text.muted }}>
          {property?.submarket} Submarket • {property?.owner || 'Owner TBD'}
        </span>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default PropertyTerminalPage;
