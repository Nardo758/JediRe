/**
 * Deals List Page - Bloomberg Terminal Style
 * Shows all deals from JediRe platform with Terminal UI
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  TrendingUp,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';

// Import Terminal UI Components
import {
  TerminalTheme as T,
  Badge,
  SectionHeader,
  formatCurrency,
} from '@/components/ui/terminal';

// Import API Service
import { fetchDeals } from '@/services/api';

interface Deal {
  id: string;
  name: string;
  projectType: string;
  status: string;
  state: string;
  tier: string;
  budget: string | null;
  targetUnits: number | null;
  dealCategory: string;
  address: string;
  createdAt: string;
  updatedAt: string;
  propertyCount: number;
  pendingTasks: number;
}

export default function DealsPage() {
  const navigate = useNavigate();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadDeals();
  }, []);

  const loadDeals = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchDeals();
      setDeals(data);
    } catch (err) {
      console.error('Error loading deals:', err);
      setError(err instanceof Error ? err.message : 'Failed to load deals');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      'active': T.text.green,
      'lead': T.text.blue,
      'under_contract': T.text.orange,
      'qualified': T.text.purple,
      'closed_won': T.text.green,
      'due_diligence': T.text.blue,
    };
    return colors[status] || T.text.secondary;
  };

  const getTierColor = (tier: string): string => {
    const colors: Record<string, string> = {
      'basic': T.text.secondary,
      'pro': T.text.blue,
      'enterprise': T.text.purple,
    };
    return colors[tier] || T.text.secondary;
  };

  const filteredDeals = filter === 'all' 
    ? deals 
    : deals.filter(d => d.dealCategory === filter);

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: T.bg.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48,
            height: 48,
            border: `3px solid ${T.text.blue}`,
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: T.text.secondary, fontFamily: T.font.mono }}>
            LOADING DEALS...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: T.bg.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}>
        <div style={{ 
          background: T.bg.panel,
          border: `1px solid ${T.text.red}`,
          borderRadius: 4,
          padding: 32,
          textAlign: 'center',
          maxWidth: 480
        }}>
          <AlertCircle style={{ 
            width: 48, 
            height: 48, 
            color: T.text.red, 
            margin: '0 auto 16px' 
          }} />
          <h2 style={{ 
            fontFamily: T.font.mono,
            fontSize: 18,
            fontWeight: 600,
            color: T.text.primary,
            marginBottom: 8
          }}>
            ERROR LOADING DEALS
          </h2>
          <p style={{ 
            color: T.text.secondary, 
            marginBottom: 24,
            fontFamily: T.font.mono,
            fontSize: 13
          }}>
            {error}
          </p>
          <button
            onClick={loadDeals}
            style={{
              padding: '10px 20px',
              background: T.text.blue,
              color: T.bg.primary,
              border: 'none',
              borderRadius: 4,
              fontFamily: T.font.mono,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            RETRY
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg.primary }}>
      {/* Header */}
      <div style={{ 
        background: T.bg.panel,
        borderBottom: `1px solid ${T.border.default}`,
        position: 'sticky',
        top: 0,
        zIndex: 1000
      }}>
        <div style={{ 
          maxWidth: 1400, 
          margin: '0 auto', 
          padding: '20px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h1 style={{
                fontFamily: T.font.mono,
                fontSize: 24,
                fontWeight: 700,
                color: T.text.primary,
                marginBottom: 8,
                letterSpacing: 1
              }}>
                JEDIRE DEALS
              </h1>
              <div style={{
                fontFamily: T.font.mono,
                fontSize: 12,
                color: T.text.secondary
              }}>
                {filteredDeals.length} DEALS • LAST UPDATED: {new Date().toLocaleTimeString().toUpperCase()}
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setFilter('all')}
                style={{
                  padding: '8px 16px',
                  background: filter === 'all' ? T.text.blue : 'transparent',
                  border: `1px solid ${T.border.default}`,
                  borderRadius: 2,
                  color: filter === 'all' ? T.bg.primary : T.text.secondary,
                  fontFamily: T.font.mono,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  letterSpacing: 0.5
                }}
              >
                ALL
              </button>
              <button
                onClick={() => setFilter('portfolio')}
                style={{
                  padding: '8px 16px',
                  background: filter === 'portfolio' ? T.text.blue : 'transparent',
                  border: `1px solid ${T.border.default}`,
                  borderRadius: 2,
                  color: filter === 'portfolio' ? T.bg.primary : T.text.secondary,
                  fontFamily: T.font.mono,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  letterSpacing: 0.5
                }}
              >
                PORTFOLIO
              </button>
              <button
                onClick={() => setFilter('pipeline')}
                style={{
                  padding: '8px 16px',
                  background: filter === 'pipeline' ? T.text.blue : 'transparent',
                  border: `1px solid ${T.border.default}`,
                  borderRadius: 2,
                  color: filter === 'pipeline' ? T.bg.primary : T.text.secondary,
                  fontFamily: T.font.mono,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  letterSpacing: 0.5
                }}
              >
                PIPELINE
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Deals Grid */}
      <div style={{ 
        maxWidth: 1400, 
        margin: '0 auto', 
        padding: '24px 20px'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
          gap: 16
        }}>
          {filteredDeals.map((deal) => (
            <div
              key={deal.id}
              onClick={() => navigate(`/properties/${deal.id}`)}
              style={{
                background: T.bg.panel,
                border: `1px solid ${T.border.default}`,
                borderRadius: 4,
                padding: 16,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = T.text.blue;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = T.border.default;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Deal Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 12
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 14,
                    fontWeight: 600,
                    color: T.text.primary,
                    marginBottom: 6
                  }}>
                    {deal.name.toUpperCase()}
                  </div>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 10,
                    color: T.text.secondary,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <span>◉</span>
                    <span>{deal.address}</span>
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: T.text.dim }} />
              </div>

              {/* Deal Metrics */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 12,
                marginBottom: 12
              }}>
                <div>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 9,
                    color: T.text.dim,
                    marginBottom: 4,
                    letterSpacing: 0.5
                  }}>
                    BUDGET
                  </div>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 13,
                    fontWeight: 600,
                    color: T.text.primary
                  }}>
                    {deal.budget ? formatCurrency(parseFloat(deal.budget)) : 'N/A'}
                  </div>
                </div>

                <div>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 9,
                    color: T.text.dim,
                    marginBottom: 4,
                    letterSpacing: 0.5
                  }}>
                    UNITS
                  </div>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 13,
                    fontWeight: 600,
                    color: T.text.primary
                  }}>
                    {deal.targetUnits || 'N/A'}
                  </div>
                </div>

                <div>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 9,
                    color: T.text.dim,
                    marginBottom: 4,
                    letterSpacing: 0.5
                  }}>
                    TYPE
                  </div>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 13,
                    fontWeight: 600,
                    color: T.text.primary
                  }}>
                    {deal.projectType.replace('_', ' ').toUpperCase()}
                  </div>
                </div>

                <div>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 9,
                    color: T.text.dim,
                    marginBottom: 4,
                    letterSpacing: 0.5
                  }}>
                    STATE
                  </div>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 13,
                    fontWeight: 600,
                    color: T.text.primary
                  }}>
                    {deal.state}
                  </div>
                </div>
              </div>

              {/* Deal Badges */}
              <div style={{
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap'
              }}>
                <Badge color={getStatusColor(deal.status)}>
                  {deal.status.replace('_', ' ').toUpperCase()}
                </Badge>
                <Badge color={getTierColor(deal.tier)}>
                  {deal.tier.toUpperCase()}
                </Badge>
                {deal.pendingTasks > 0 && (
                  <Badge color={T.text.orange}>
                    {deal.pendingTasks} TASKS
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
