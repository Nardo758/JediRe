import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Download, Share2, TrendingUp, Loader2, AlertTriangle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api.client';
import { useAuthStore } from '../stores/authStore';

// ═══════════════════════════════════════════════════════════════
// BLOOMBERG DESIGN SYSTEM TOKENS
// ═══════════════════════════════════════════════════════════════
const T = {
  bg: { 
    terminal: "#0A0E17", 
    panel: "#0F1319", 
    panelAlt: "#131821", 
    header: "#1A1F2E", 
    hover: "#1E2538", 
    active: "#252D40", 
    input: "#0D1117" 
  },
  text: { 
    primary: "#E8ECF1", 
    secondary: "#8B95A5", 
    muted: "#4A5568", 
    amber: "#F5A623", 
    amberBright: "#FFD166", 
    green: "#00D26A", 
    red: "#FF4757", 
    cyan: "#00BCD4", 
    orange: "#FF8C42", 
    purple: "#A78BFA", 
    white: "#FFFFFF" 
  },
  border: { 
    subtle: "#1E2538", 
    medium: "#2A3348", 
    bright: "#3B4A6B" 
  },
  font: { 
    mono: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace", 
    display: "'IBM Plex Mono', monospace", 
    label: "'IBM Plex Sans', sans-serif" 
  },
};

interface DealCapsule {
  id: string;
  property_address: string;
  asset_class: string;
  asking_price: number;
  jedi_score: number;
  status: string;
  created_at: string;
  broker_name?: string;
  deal_data?: any;
}

const DealCapsulesPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [capsules, setCapsules] = useState<DealCapsule[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userId = user?.id || 'demo-user';
    setLoading(true);
    const params: Record<string, string> = { user_id: userId };
    if (searchQuery.trim()) params.search = searchQuery.trim();

    apiClient.get('/api/v1/capsules', { params })
      .then((res) => {
        const data = res.data;
        const rows: DealCapsule[] = (data.capsules || []).map((c: any) => ({
          id: c.id,
          property_address: c.property_address || 'Unknown Address',
          asset_class: c.asset_class || c.deal_data?.asset_class || 'N/A',
          asking_price: c.deal_data?.asking_price || c.asking_price || 0,
          jedi_score: c.deal_data?.jedi_score || c.jedi_score || 0,
          status: c.status || 'DISCOVER',
          created_at: c.created_at,
          broker_name: c.deal_data?.broker_name || c.broker_name,
          deal_data: c.deal_data,
        }));
        setCapsules(rows);
        setTotal(data.total ?? rows.length);
        setError(null);
      })
      .catch((err) => {
        console.error('Failed to load capsules:', err);
        setError('Failed to load capsules');
        setCapsules([]);
      })
      .finally(() => setLoading(false));
  }, [user?.id, searchQuery]);

  const getScoreColor = (score: number) => {
    if (score >= 85) return { color: T.text.green, bg: 'rgba(0, 210, 106, 0.15)' };
    if (score >= 70) return { color: T.text.amber, bg: 'rgba(245, 166, 35, 0.15)' };
    return { color: T.text.red, bg: 'rgba(255, 71, 87, 0.15)' };
  };

  const getStatusStyle = (status: string) => {
    const styles: Record<string, { color: string; bg: string }> = {
      'DISCOVER': { color: T.text.cyan, bg: 'rgba(0, 188, 212, 0.15)' },
      'RESEARCH': { color: T.text.purple, bg: 'rgba(167, 139, 250, 0.15)' },
      'ANALYZE': { color: T.text.amber, bg: 'rgba(245, 166, 35, 0.15)' },
      'MODEL': { color: T.text.cyan, bg: 'rgba(0, 188, 212, 0.15)' },
      'EXECUTE': { color: T.text.orange, bg: 'rgba(255, 140, 66, 0.15)' },
      'TRACK': { color: T.text.green, bg: 'rgba(0, 210, 106, 0.15)' }
    };
    return styles[status] || { color: T.text.secondary, bg: 'rgba(139, 149, 165, 0.15)' };
  };

  const avgScore = capsules.length > 0
    ? Math.round(capsules.reduce((sum, c) => sum + (c.jedi_score || 0), 0) / capsules.length)
    : 0;
  const totalValue = capsules.reduce((sum, c) => sum + (c.asking_price || 0), 0);
  const activeCount = capsules.filter((c) => c.status === 'ANALYZE' || c.status === 'MODEL').length;

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: T.bg.terminal, 
      fontFamily: T.font.mono,
      color: T.text.primary 
    }}>
      {/* Header Bar */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '12px 24px',
        background: T.bg.header,
        borderBottom: `1px solid ${T.border.medium}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div>
            <div style={{ 
              fontSize: 11, 
              fontWeight: 700, 
              color: T.text.amber, 
              letterSpacing: 1.2,
              marginBottom: 2 
            }}>
              DEAL CAPSULES
            </div>
            <div style={{ fontSize: 10, color: T.text.secondary }}>
              Intelligent deal packages with enriched market data
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            background: T.text.amber,
            color: '#000',
            border: 'none',
            fontSize: 10,
            fontWeight: 700,
            fontFamily: T.font.mono,
            cursor: 'pointer',
            letterSpacing: 0.5
          }}
        >
          <Plus size={14} />
          CREATE CAPSULE
        </button>
      </div>

      {/* Search & Filters Bar */}
      <div style={{ 
        display: 'flex', 
        gap: 12, 
        padding: '12px 24px',
        background: T.bg.panelAlt,
        borderBottom: `1px solid ${T.border.subtle}`
      }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search 
            size={14} 
            style={{ 
              position: 'absolute', 
              left: 12, 
              top: '50%', 
              transform: 'translateY(-50%)',
              color: T.text.muted 
            }} 
          />
          <input
            type="text"
            placeholder="Search by address, broker, or deal characteristics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              background: T.bg.input,
              border: `1px solid ${T.border.subtle}`,
              color: T.text.primary,
              fontSize: 11,
              fontFamily: T.font.mono,
              outline: 'none'
            }}
          />
        </div>
        <button style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 16px',
          background: T.bg.panel,
          border: `1px solid ${T.border.subtle}`,
          color: T.text.secondary,
          fontSize: 10,
          fontFamily: T.font.mono,
          cursor: 'pointer'
        }}>
          <Filter size={14} />
          FILTERS
        </button>
      </div>

      {/* Stats Row */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: 1,
        background: T.border.subtle,
        margin: '0 24px',
        marginTop: 16
      }}>
        <div style={{ background: T.bg.panel, padding: '12px 16px' }}>
          <div style={{ fontSize: 8, color: T.text.muted, letterSpacing: 1, fontWeight: 600, marginBottom: 4 }}>
            TOTAL CAPSULES
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.text.amber }}>{total}</div>
        </div>
        <div style={{ background: T.bg.panel, padding: '12px 16px' }}>
          <div style={{ fontSize: 8, color: T.text.muted, letterSpacing: 1, fontWeight: 600, marginBottom: 4 }}>
            AVG JEDI SCORE
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: avgScore >= 70 ? T.text.green : T.text.amber }}>
            {avgScore || '—'}
          </div>
        </div>
        <div style={{ background: T.bg.panel, padding: '12px 16px' }}>
          <div style={{ fontSize: 8, color: T.text.muted, letterSpacing: 1, fontWeight: 600, marginBottom: 4 }}>
            TOTAL DEAL VALUE
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.text.cyan }}>
            {totalValue > 0 ? `$${(totalValue / 1000000).toFixed(1)}M` : '—'}
          </div>
        </div>
        <div style={{ background: T.bg.panel, padding: '12px 16px' }}>
          <div style={{ fontSize: 8, color: T.text.muted, letterSpacing: 1, fontWeight: 600, marginBottom: 4 }}>
            ACTIVE ANALYSIS
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.text.orange }}>{activeCount}</div>
        </div>
      </div>

      {/* Capsules List */}
      <div style={{ padding: '16px 24px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 64 }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: T.text.amber }} />
            <span style={{ marginLeft: 12, color: T.text.secondary, fontSize: 11 }}>Loading capsules...</span>
          </div>
        ) : error ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 64, gap: 16 }}>
            <AlertTriangle size={32} style={{ color: T.text.amber }} />
            <p style={{ color: T.text.secondary, fontSize: 12 }}>{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              style={{
                padding: '8px 16px',
                background: T.text.amber,
                color: '#000',
                border: 'none',
                fontSize: 10,
                fontWeight: 700,
                fontFamily: T.font.mono,
                cursor: 'pointer'
              }}
            >
              RETRY
            </button>
          </div>
        ) : capsules.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 64, gap: 16 }}>
            <div style={{ 
              width: 64, 
              height: 64, 
              background: T.bg.panel, 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              border: `1px solid ${T.border.subtle}`
            }}>
              <Search size={24} style={{ color: T.text.muted }} />
            </div>
            <p style={{ color: T.text.primary, fontSize: 14, fontWeight: 600 }}>No capsules found</p>
            <p style={{ color: T.text.secondary, fontSize: 11 }}>Create a capsule to get started with deal analysis</p>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                padding: '10px 20px',
                background: T.text.amber,
                color: '#000',
                border: 'none',
                fontSize: 10,
                fontWeight: 700,
                fontFamily: T.font.mono,
                cursor: 'pointer'
              }}
            >
              CREATE YOUR FIRST CAPSULE
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Table Header */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '2fr 1fr 1fr 100px 100px 120px',
              gap: 1,
              background: T.bg.header,
              padding: '8px 12px',
              borderBottom: `1px solid ${T.border.medium}`
            }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: T.text.muted, letterSpacing: 1 }}>ADDRESS</div>
              <div style={{ fontSize: 8, fontWeight: 700, color: T.text.muted, letterSpacing: 1 }}>ASSET CLASS</div>
              <div style={{ fontSize: 8, fontWeight: 700, color: T.text.muted, letterSpacing: 1 }}>BROKER</div>
              <div style={{ fontSize: 8, fontWeight: 700, color: T.text.muted, letterSpacing: 1, textAlign: 'right' }}>PRICE</div>
              <div style={{ fontSize: 8, fontWeight: 700, color: T.text.muted, letterSpacing: 1, textAlign: 'center' }}>JEDI</div>
              <div style={{ fontSize: 8, fontWeight: 700, color: T.text.muted, letterSpacing: 1, textAlign: 'center' }}>STATUS</div>
            </div>

            {/* Table Rows */}
            {capsules.map((capsule) => {
              const scoreStyle = getScoreColor(capsule.jedi_score);
              const statusStyle = getStatusStyle(capsule.status);
              return (
                <div
                  key={capsule.id}
                  onClick={() => navigate(`/capsules/${capsule.id}`)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 100px 100px 120px',
                    gap: 1,
                    background: T.bg.panel,
                    padding: '12px',
                    borderBottom: `1px solid ${T.border.subtle}`,
                    cursor: 'pointer',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = T.bg.hover}
                  onMouseLeave={(e) => e.currentTarget.style.background = T.bg.panel}
                >
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.text.primary, marginBottom: 2 }}>
                      {capsule.property_address}
                    </div>
                    <div style={{ fontSize: 9, color: T.text.muted }}>
                      Created {new Date(capsule.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: T.text.secondary, display: 'flex', alignItems: 'center' }}>
                    {capsule.asset_class}
                  </div>
                  <div style={{ fontSize: 10, color: T.text.secondary, display: 'flex', alignItems: 'center' }}>
                    {capsule.broker_name || '—'}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.text.cyan, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    {capsule.asking_price > 0 ? `$${(capsule.asking_price / 1000000).toFixed(1)}M` : '—'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {capsule.jedi_score > 0 ? (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 8px',
                        background: scoreStyle.bg,
                        color: scoreStyle.color,
                        fontSize: 11,
                        fontWeight: 700
                      }}>
                        <TrendingUp size={12} />
                        {capsule.jedi_score}
                      </div>
                    ) : (
                      <span style={{ color: T.text.muted }}>—</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{
                      padding: '4px 10px',
                      background: statusStyle.bg,
                      color: statusStyle.color,
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: 0.5
                    }}>
                      {capsule.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50
        }}>
          <div style={{
            background: T.bg.panel,
            border: `1px solid ${T.border.medium}`,
            maxWidth: 600,
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              background: T.bg.header,
              borderBottom: `1px solid ${T.border.medium}`
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.text.amber, letterSpacing: 1 }}>
                CREATE DEAL CAPSULE
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.text.secondary }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: 20 }}>
              <p style={{ fontSize: 11, color: T.text.secondary, marginBottom: 20 }}>
                Choose how to create your capsule:
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                <button 
                  style={{
                    padding: 20,
                    background: T.bg.panelAlt,
                    border: `1px solid ${T.border.subtle}`,
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = T.text.amber;
                    e.currentTarget.style.background = T.bg.hover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = T.border.subtle;
                    e.currentTarget.style.background = T.bg.panelAlt;
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.text.primary, marginBottom: 4 }}>UPLOAD OM</div>
                  <div style={{ fontSize: 9, color: T.text.muted }}>Drag & drop offering memorandum</div>
                </button>
                
                <button 
                  style={{
                    padding: 20,
                    background: T.bg.panelAlt,
                    border: `1px solid ${T.border.subtle}`,
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = T.text.amber;
                    e.currentTarget.style.background = T.bg.hover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = T.border.subtle;
                    e.currentTarget.style.background = T.bg.panelAlt;
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 8 }}>✍️</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.text.primary, marginBottom: 4 }}>MANUAL ENTRY</div>
                  <div style={{ fontSize: 9, color: T.text.muted }}>Enter deal details manually</div>
                </button>
                
                <button 
                  style={{
                    padding: 20,
                    background: T.bg.panelAlt,
                    border: `1px solid ${T.border.subtle}`,
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = T.text.amber;
                    e.currentTarget.style.background = T.bg.hover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = T.border.subtle;
                    e.currentTarget.style.background = T.bg.panelAlt;
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🔗</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.text.primary, marginBottom: 4 }}>FROM EMAIL</div>
                  <div style={{ fontSize: 9, color: T.text.muted }}>Extract from broker email</div>
                </button>
              </div>

              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  background: T.bg.panelAlt,
                  border: `1px solid ${T.border.subtle}`,
                  color: T.text.secondary,
                  fontSize: 10,
                  fontFamily: T.font.mono,
                  cursor: 'pointer'
                }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default DealCapsulesPage;
