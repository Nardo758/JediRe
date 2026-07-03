import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Loader2, Brain, TrendingUp, AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
import { apiClient } from '../../../services/api.client';
import { BT } from '../../../components/deal/bloomberg-ui';
import { MarketSentimentTrend } from '../../../components/terminal/commentary';

const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

interface CommentaryPanelProps {
  dealId: string;
  dealName: string;
}

// Property-level sentiment uses the same entityId the commentary endpoint
// receives (dealId). The backend resolver collapses dealId → properties.id via
// properties.deal_id so the trend row keys stay stable.

interface CommentaryItem {
  id: string;
  title: string;
  narrative: string;
  strategyScores: Record<string, any>;
  created_at: string;
}

export function CommentaryPanel({ dealId, dealName }: CommentaryPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [commentary, setCommentary] = useState<CommentaryItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded || commentary || loading) return;
    setLoading(true);
    setError(null);
    apiClient.get(`/api/v1/commentary/property/${dealId}`)
      .then((res: any) => {
        const d = res?.data?.data ?? res?.data ?? null;
        if (d) setCommentary(Array.isArray(d) ? d[0] : d);
        else setError('No commentary available yet. Run the CashFlow agent first.');
      })
      .catch(() => {
        setError('Failed to load AI commentary.');
      })
      .finally(() => setLoading(false));
  }, [expanded, dealId, commentary, loading]);

  const getRatingColor = (rating: string | null) => {
    switch (rating?.toLowerCase()) {
      case 'strong': return '#22c55e';
      case 'adequate': return '#06b6d4';
      case 'marginal': return '#f59e0b';
      case 'weak': return '#ef4444';
      default: return '#475569';
    }
  };

  const getRatingBg = (rating: string | null) => {
    switch (rating?.toLowerCase()) {
      case 'strong': return '#052e16';
      case 'adequate': return '#0c1929';
      case 'marginal': return '#1a1200';
      case 'weak': return '#1c0a0a';
      default: return '#111111';
    }
  };

  return (
    <div style={{
      marginTop: 12,
      border: '1px solid #1e293b',
      borderRadius: 4,
      background: BT.bg.panel,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', padding: '6px 10px',
          background: 'transparent', border: 'none',
          cursor: 'pointer', color: '#94a3b8',
          fontFamily: MONO, fontSize: 9,
        }}
      >
        <Brain size={12} color="#818cf8" />
        <span style={{ fontWeight: 600 }}>AI COMMENTARY</span>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {!expanded && commentary && (
          <span style={{
            marginLeft: 'auto', fontSize: 8, color: '#64748b',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: getRatingColor(null),
              display: 'inline-block',
            }} />
            Ready
          </span>
        )}
      </button>

      {expanded && (
        <div style={{ padding: '8px 10px 10px', borderTop: '1px solid #1e293b' }}>
          <MarketSentimentTrend
            entityType="property"
            entityId={dealId}
            entityName={dealName}
          />

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontFamily: MONO, fontSize: 9 }}>
              <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              Loading commentary…
            </div>
          )}

          {error && !loading && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, color: '#94a3b8', fontFamily: MONO, fontSize: 9 }}>
              <AlertTriangle size={12} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ color: '#f59e0b', marginBottom: 4 }}>Agent Commentary</div>
                <div style={{ color: '#64748b' }}>{error}</div>
                <div style={{ marginTop: 6, color: '#475569', fontSize: 8, lineHeight: 1.5 }}>
                  Run the CashFlow agent to generate strategy scores, investment rating, and narrative commentary.
                </div>
              </div>
            </div>
          )}

          {commentary && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Investment Rating */}
              {commentary.strategyScores?.investment_rating && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', borderRadius: 4,
                  background: getRatingBg(commentary.strategyScores.investment_rating),
                  border: `1px solid ${getRatingColor(commentary.strategyScores.investment_rating)}33`,
                }}>
                  <TrendingUp size={14} color={getRatingColor(commentary.strategyScores.investment_rating)} />
                  <span style={{
                    fontFamily: MONO, fontSize: 10, fontWeight: 700,
                    color: getRatingColor(commentary.strategyScores.investment_rating),
                    textTransform: 'uppercase',
                  }}>
                    {commentary.strategyScores.investment_rating}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 7, color: '#475569', marginLeft: 'auto' }}>
                    INVESTMENT RATING
                  </span>
                </div>
              )}

              {/* Confidence */}
              {commentary.strategyScores?.confidence_score != null && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '4px 10px',
                }}>
                  <CheckCircle2 size={10} color={commentary.strategyScores.confidence_score >= 0.7 ? '#22c55e' : commentary.strategyScores.confidence_score >= 0.4 ? '#f59e0b' : '#ef4444'} />
                  <span style={{ fontFamily: MONO, fontSize: 8, color: '#94a3b8' }}>
                    Confidence: {Math.round(commentary.strategyScores.confidence_score * 100)}%
                  </span>
                  {commentary.strategyScores.fields_written?.length > 0 && (
                    <span style={{ fontFamily: MONO, fontSize: 7, color: '#475569' }}>
                      {commentary.strategyScores.fields_written.length} fields
                    </span>
                  )}
                </div>
              )}

              {/* Narrative */}
              {commentary.narrative && (
                <div style={{
                  padding: '8px 10px',
                  background: '#0d0d0d',
                  border: '1px solid #1e293b',
                  borderRadius: 4,
                  fontFamily: MONO, fontSize: 9, color: '#cbd5e1',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}>
                  {commentary.narrative}
                </div>
              )}

              {/* Strategy Scores */}
              {commentary.strategyScores && Object.keys(commentary.strategyScores).filter(k => !['investment_rating', 'confidence_score', 'fields_written'].includes(k)).length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontFamily: MONO, fontSize: 7, color: '#475569', marginBottom: 4, letterSpacing: 0.5 }}>
                    STRATEGY SCORES
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {Object.entries(commentary.strategyScores).filter(([k]) => !['investment_rating', 'confidence_score', 'fields_written'].includes(k)).map(([key, val]) => (
                      <div key={key} style={{
                        padding: '2px 6px',
                        background: '#111111',
                        border: '1px solid #1e293b',
                        borderRadius: 3,
                        fontFamily: MONO, fontSize: 7,
                        color: '#64748b',
                      }}>
                        {key.replace(/_/g, ' ')}: {String(val)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timestamp */}
              {commentary.created_at && (
                <div style={{ fontFamily: MONO, fontSize: 7, color: '#334155', textAlign: 'right' }}>
                  Generated {new Date(commentary.created_at).toLocaleString()}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
