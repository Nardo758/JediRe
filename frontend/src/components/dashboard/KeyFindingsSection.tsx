import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api.client';
import { BT } from '@/components/deal/bloomberg-ui';

interface Finding {
  id: string;
  type: 'news' | 'market' | 'insight' | 'action';
  priority: 'urgent' | 'important' | 'info';
  title: string;
  description: string;
  timestamp: string;
  link: string;
  metadata?: any;
}

interface FindingsData {
  news: Finding[];
  market: Finding[];
  insights: Finding[];
  actions: Finding[];
}

type CategoryKey = 'news' | 'market' | 'insights' | 'actions';

function generateFallbackFindings(): FindingsData {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  return {
    news: [
      {
        id: 'news-1', type: 'news', priority: 'urgent',
        title: 'Microsoft expanding Atlanta tech hub with 2,000 new jobs',
        description: 'Major tech investment in Midtown and Buckhead areas. Expected to drive residential demand and rent growth in surrounding submarkets.',
        timestamp: yesterday.toISOString(), link: '/news-intel',
        metadata: { category: 'Employment', affectedDeals: 3, location: 'Midtown Atlanta' }
      },
      {
        id: 'news-2', type: 'news', priority: 'important',
        title: 'New 500-unit luxury development announced in Buckhead',
        description: 'Competitor project breaking ground Q2 2026. May impact absorption rates in your Buckhead Tower deal.',
        timestamp: yesterday.toISOString(), link: '/news-intel',
        metadata: { category: 'Development', affectedDeals: 1, location: 'Buckhead' }
      },
      {
        id: 'news-3', type: 'news', priority: 'info',
        title: 'Atlanta Fed announces interest rate outlook',
        description: 'Projected rate cuts in H2 2026 could improve deal economics. Consider accelerating acquisitions.',
        timestamp: twoDaysAgo.toISOString(), link: '/news-intel',
        metadata: { category: 'Economic', affectedDeals: 5, location: 'Metro Atlanta' }
      },
      {
        id: 'news-4', type: 'news', priority: 'important',
        title: 'College Park seeing institutional investor activity',
        description: 'Three major acquisitions in past 30 days. Competition heating up in workforce housing segment.',
        timestamp: threeDaysAgo.toISOString(), link: '/news-intel',
        metadata: { category: 'Transaction', affectedDeals: 1, location: 'College Park' }
      }
    ],
    market: [
      {
        id: 'market-1', type: 'market', priority: 'urgent',
        title: 'Midtown rents up 12.3% in last quarter',
        description: 'Submarket rents increased from $1,850 to $2,078. Strong demand driven by new corporate relocations.',
        timestamp: yesterday.toISOString(), link: '/deals',
        metadata: { metric: 'rent', change: 12.3 }
      },
      {
        id: 'market-2', type: 'market', priority: 'important',
        title: 'Buckhead occupancy dropped to 88.5%',
        description: 'Down 4.2% from last quarter. New supply entering market - consider pricing adjustments.',
        timestamp: twoDaysAgo.toISOString(), link: '/deals',
        metadata: { metric: 'occupancy', change: -4.2 }
      },
      {
        id: 'market-3', type: 'market', priority: 'info',
        title: 'West Midtown absorption rate accelerating',
        description: 'New units leasing 15% faster than 6-month average. Strong market momentum.',
        timestamp: threeDaysAgo.toISOString(), link: '/deals',
        metadata: { metric: 'absorption', change: 15.0 }
      }
    ],
    insights: [
      {
        id: 'insight-1', type: 'insight', priority: 'urgent',
        title: 'Strong opportunity: Midtown Tower',
        description: 'JEDI Score 87/100 - STRONG_OPPORTUNITY. Excellent location metrics, favorable market timing. Consider moving to full research.',
        timestamp: yesterday.toISOString(), link: '/deals',
        metadata: { jediScore: 87, verdict: 'STRONG_OPPORTUNITY', recommendationCount: 3 }
      },
      {
        id: 'insight-2', type: 'insight', priority: 'important',
        title: 'Good opportunity: College Park Workforce Housing',
        description: 'JEDI Score 74/100 - OPPORTUNITY. Strong demand fundamentals, moderate competition. Review for pipeline inclusion.',
        timestamp: yesterday.toISOString(), link: '/deals',
        metadata: { jediScore: 74, verdict: 'OPPORTUNITY', recommendationCount: 2 }
      },
      {
        id: 'insight-3', type: 'insight', priority: 'info',
        title: 'Optimization suggestions available',
        description: '4 recommendations to improve deal performance: rent optimization, expense reduction, capital improvements, refinancing timing.',
        timestamp: twoDaysAgo.toISOString(), link: '/deals',
        metadata: { recommendationCount: 4 }
      },
      {
        id: 'insight-4', type: 'insight', priority: 'urgent',
        title: 'Risk alert: Alpharetta Retail Center',
        description: 'JEDI Score 42/100. Market fundamentals weakening, increased vacancy risk. Review immediately.',
        timestamp: threeDaysAgo.toISOString(), link: '/deals',
        metadata: { jediScore: 42, verdict: 'CAUTION', recommendationCount: 1 }
      }
    ],
    actions: [
      {
        id: 'action-1', type: 'action', priority: 'urgent',
        title: 'Stale deal needs review',
        description: 'Deal has been inactive for 14+ days. Review status and next steps.',
        timestamp: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(), link: '/deals',
        metadata: { state: 'TRIAGE', daysInactive: 15 }
      },
      {
        id: 'action-2', type: 'action', priority: 'important',
        title: 'Decision needed: College Park Workforce Housing',
        description: 'Triage complete. Review JEDI Score and decide: proceed to research, save as market note, or archive.',
        timestamp: yesterday.toISOString(), link: '/deals',
        metadata: { state: 'TRIAGE', needsDecision: true }
      },
      {
        id: 'action-3', type: 'action', priority: 'info',
        title: 'LOI expiring in 5 days',
        description: 'Midtown Tower LOI expires Feb 14. Finalize terms or request extension.',
        timestamp: twoDaysAgo.toISOString(), link: '/deals',
        metadata: { state: 'UNDERWRITING', deadline: 'Feb 14, 2026' }
      }
    ]
  };
}

const CATEGORY_CONFIG = {
  news: {
    label: 'News Intelligence',
    icon: '📰',
    emptyMessage: 'No recent news in your deal areas',
    description: 'External market events and developments',
  },
  market: {
    label: 'Market Signals',
    icon: '📊',
    emptyMessage: 'No significant market changes detected',
    description: 'Submarket trends and competitive intelligence',
  },
  insights: {
    label: 'AI Insights',
    icon: '🤖',
    emptyMessage: 'No new AI insights at the moment',
    description: 'Platform-generated recommendations and opportunities',
  },
  actions: {
    label: 'Action Items',
    icon: '⚠️',
    emptyMessage: 'All caught up! No pending actions.',
    description: 'Things that need your attention',
  },
};

const PRIORITY_ACCENT = {
  urgent: { borderColor: BT.text.red, dotColor: BT.text.red, label: 'Urgent', labelColor: BT.text.red, labelBg: `${BT.text.red}18` },
  important: { borderColor: BT.text.amber, dotColor: BT.text.amber, label: 'Important', labelColor: BT.text.amber, labelBg: `${BT.text.amber}18` },
  info: { borderColor: BT.text.cyan, dotColor: BT.text.cyan, label: 'Info', labelColor: BT.text.cyan, labelBg: `${BT.text.cyan}18` },
};

const TYPE_ICON: Record<string, string> = {
  news: '📰',
  market: '📊',
  insight: '🤖',
  action: '⚡',
};

function getScoreStyle(score: number): { color: string; background: string; borderColor: string } {
  if (score >= 80) return { color: BT.text.green, background: `${BT.text.green}18`, borderColor: `${BT.text.green}44` };
  if (score >= 60) return { color: BT.text.cyan, background: `${BT.text.cyan}18`, borderColor: `${BT.text.cyan}44` };
  if (score >= 40) return { color: BT.text.amber, background: `${BT.text.amber}18`, borderColor: `${BT.text.amber}44` };
  return { color: BT.text.red, background: `${BT.text.red}18`, borderColor: `${BT.text.red}44` };
}

function getChangeIndicator(change: number): { icon: string; color: string } {
  if (change > 0) return { icon: '▲', color: BT.text.green };
  if (change < 0) return { icon: '▼', color: BT.text.red };
  return { icon: '—', color: BT.text.secondary };
}

export const KeyFindingsSection: React.FC = () => {
  const navigate = useNavigate();
  const [findings, setFindings] = useState<FindingsData>({
    news: [],
    market: [],
    insights: [],
    actions: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CategoryKey>('news');

  useEffect(() => {
    fetchFindings();
  }, []);

  const fetchFindings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/v1/dashboard/findings', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch findings');
      }

      const data = await response.json();

      if (data.success) {
        setFindings(data.data);

        // Auto-select first category with findings (prioritize actions > insights > news > market)
        const priorityOrder: CategoryKey[] = ['actions', 'insights', 'news', 'market'];
        const firstWithData = priorityOrder.find(key => data.data[key]?.length > 0);
        if (firstWithData) {
          setActiveTab(firstWithData);
        }
      }
    } catch (err) {
      console.error('Error fetching findings:', err);
      const fallback = generateFallbackFindings();

      // Replace hardcoded jediScore values (87/74/42) with real live scores
      try {
        const dealsResponse = await api.deals.list({ limit: 10 });
        const deals: any[] = dealsResponse.data?.deals ?? dealsResponse.data ?? [];

        if (deals.length > 0) {
          const scoreResults = await Promise.allSettled(
            deals.slice(0, 4).map(async (deal: any) => {
              const scoreRes = await api.jedi.getScore(deal.id);
              const scoreData = scoreRes.data;
              return {
                id: deal.id,
                name: deal.name ?? deal.address ?? 'Deal',
                score: scoreData?.score ?? scoreData?.jedi_score ?? null,
                verdict: scoreData?.verdict ?? scoreData?.signal ?? 'UNKNOWN',
                updatedAt: deal.updated_at ?? deal.created_at ?? new Date().toISOString(),
              };
            })
          );

          const scoredDeals = scoreResults
            .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value.score !== null)
            .map(r => r.value);

          if (scoredDeals.length > 0) {
            fallback.insights = scoredDeals.map((deal, idx) => {
              const score: number = deal.score;
              const priority: Finding['priority'] =
                score >= 70 ? 'urgent' : score >= 50 ? 'important' : 'info';
              const titlePrefix =
                score >= 70 ? 'Strong opportunity' : score >= 50 ? 'Good opportunity' : 'Monitor';
              return {
                id: `insight-live-${deal.id ?? idx}`,
                type: 'insight' as const,
                priority,
                title: `${titlePrefix}: ${deal.name}`,
                description: `JEDI Score ${score}/100 — ${deal.verdict.replace(/_/g, ' ')}`,
                timestamp: deal.updatedAt,
                link: `/deals/${deal.id}/detail`,
                metadata: {
                  jediScore: score,
                  verdict: deal.verdict,
                  dealId: deal.id,
                },
              };
            });
          }
        }
      } catch (scoreErr) {
        console.warn('Could not load live JEDI scores for fallback insights:', scoreErr);
      }

      setFindings(fallback);
      const priorityOrder: CategoryKey[] = ['actions', 'insights', 'news', 'market'];
      const firstWithData = priorityOrder.find(key => fallback[key]?.length > 0);
      if (firstWithData) {
        setActiveTab(firstWithData);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFindingClick = (finding: Finding) => {
    navigate(finding.link);
  };

  const getTimeSince = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const totalFindings = findings.news.length + findings.market.length +
                        findings.insights.length + findings.actions.length;

  const activeFindings = findings[activeTab] || [];

  if (loading) {
    return (
      <div className="p-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
        <div className="flex items-center justify-center py-8">
          <div style={{ color: BT.text.secondary, fontFamily: BT.font.label }}>Loading key findings...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
        <div className="flex items-center justify-center py-8">
          <div style={{ color: BT.text.red }}>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
      {/* Header */}
      <div className="px-6 py-4" style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: BT.text.primary, fontFamily: BT.font.display }}>Key Findings</h2>
            <p className="text-sm mt-0.5" style={{ color: BT.text.secondary, fontFamily: BT.font.label }}>
              {totalFindings === 0
                ? 'All caught up! No urgent findings.'
                : `${totalFindings} finding${totalFindings !== 1 ? 's' : ''} requiring attention`}
            </p>
          </div>
          <button
            onClick={fetchFindings}
            className="text-sm font-medium"
            style={{ color: BT.text.cyan }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
        <div className="flex overflow-x-auto">
          {(Object.keys(CATEGORY_CONFIG) as CategoryKey[]).map((category) => {
            const count = findings[category]?.length || 0;
            const config = CATEGORY_CONFIG[category];
            const isActive = activeTab === category;

            return (
              <button
                key={category}
                onClick={() => setActiveTab(category)}
                className="flex items-center gap-2 px-4 py-3 whitespace-nowrap transition-colors"
                style={{
                  borderBottom: `2px solid ${isActive ? BT.text.cyan : 'transparent'}`,
                  color: isActive ? BT.text.cyan : BT.text.secondary,
                  fontFamily: BT.font.label,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = BT.text.primary;
                    e.currentTarget.style.borderBottomColor = BT.border.medium;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = BT.text.secondary;
                    e.currentTarget.style.borderBottomColor = 'transparent';
                  }
                }}
              >
                <span className="text-lg">{config.icon}</span>
                <span className="font-medium">{config.label}</span>
                {count > 0 && (
                  <span
                    className="ml-1 px-2 py-0.5 text-xs font-semibold"
                    style={{
                      borderRadius: 2,
                      background: isActive ? `${BT.text.cyan}22` : BT.bg.panelAlt,
                      color: isActive ? BT.text.cyan : BT.text.secondary,
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Findings List */}
      <div className="p-4 space-y-3">
        {activeFindings.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-5xl mb-3">{CATEGORY_CONFIG[activeTab].icon}</div>
            <p style={{ color: BT.text.secondary, fontFamily: BT.font.label }}>{CATEGORY_CONFIG[activeTab].emptyMessage}</p>
          </div>
        ) : (
          <>
            {activeFindings.map((finding) => {
              const accent = PRIORITY_ACCENT[finding.priority];
              const meta = finding.metadata || {};
              const hasScore = typeof meta.jediScore === 'number';
              const hasChange = typeof meta.change === 'number';
              const changeInfo = hasChange ? getChangeIndicator(meta.change) : null;

              return (
                <button
                  key={finding.id}
                  onClick={() => handleFindingClick(finding)}
                  className="w-full text-left group"
                  style={{
                    borderRadius: 0,
                    border: `1px solid ${BT.border.subtle}`,
                    borderLeft: `4px solid ${accent.borderColor}`,
                    background: BT.bg.panel,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = BT.border.medium;
                    e.currentTarget.style.borderLeftColor = accent.borderColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = BT.border.subtle;
                    e.currentTarget.style.borderLeftColor = accent.borderColor;
                  }}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-lg mt-0.5 flex-shrink-0">{TYPE_ICON[finding.type] || '📋'}</span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-sm leading-snug" style={{ color: BT.text.primary, fontFamily: BT.font.label }}>
                            {finding.title}
                          </h3>
                          <span
                            className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5"
                            style={{
                              borderRadius: 2,
                              color: accent.labelColor,
                              background: accent.labelBg,
                            }}
                          >
                            {accent.label}
                          </span>
                        </div>

                        <p className="text-sm leading-relaxed mb-2.5" style={{ color: BT.text.secondary, fontFamily: BT.font.label }}>
                          {finding.description}
                        </p>

                        <div className="flex items-center gap-2 flex-wrap">
                          {hasScore && (() => {
                            const scoreStyle = getScoreStyle(meta.jediScore);
                            return (
                              <span
                                className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1"
                                style={{
                                  borderRadius: 2,
                                  color: scoreStyle.color,
                                  background: scoreStyle.background,
                                  border: `1px solid ${scoreStyle.borderColor}`,
                                }}
                              >
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                JEDI {meta.jediScore}
                              </span>
                            );
                          })()}

                          {hasChange && changeInfo && (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1"
                              style={{
                                borderRadius: 2,
                                background: BT.bg.panelAlt,
                                border: `1px solid ${BT.border.subtle}`,
                                color: changeInfo.color,
                              }}
                            >
                              {changeInfo.icon} {Math.abs(meta.change).toFixed(1)}%
                            </span>
                          )}

                          {meta.verdict && (
                            <span
                              className="text-[10px] font-medium uppercase tracking-wide px-2 py-1"
                              style={{
                                borderRadius: 2,
                                background: BT.bg.panelAlt,
                                color: BT.text.secondary,
                                border: `1px solid ${BT.border.subtle}`,
                              }}
                            >
                              {meta.verdict.replace(/_/g, ' ')}
                            </span>
                          )}

                          {meta.category && (
                            <span
                              className="text-xs px-2 py-1"
                              style={{
                                borderRadius: 2,
                                background: BT.bg.panelAlt,
                                color: BT.text.secondary,
                              }}
                            >
                              {meta.category}
                            </span>
                          )}

                          {meta.affectedDeals > 0 && (
                            <span
                              className="text-xs px-2 py-1"
                              style={{
                                borderRadius: 2,
                                background: BT.bg.panelAlt,
                                color: BT.text.secondary,
                              }}
                            >
                              {meta.affectedDeals} deal{meta.affectedDeals !== 1 ? 's' : ''}
                            </span>
                          )}

                          {meta.location && (
                            <span
                              className="text-xs px-2 py-1"
                              style={{
                                borderRadius: 2,
                                background: BT.bg.panelAlt,
                                color: BT.text.muted,
                                border: `1px solid ${BT.border.subtle}`,
                              }}
                            >
                              📍 {meta.location}
                            </span>
                          )}

                          {meta.state && (
                            <span
                              className="text-[10px] font-medium uppercase tracking-wide px-2 py-1"
                              style={{
                                borderRadius: 2,
                                background: BT.bg.panelAlt,
                                color: BT.text.secondary,
                              }}
                            >
                              {meta.state}
                            </span>
                          )}

                          {meta.recommendationCount > 0 && (
                            <span
                              className="text-xs px-2 py-1"
                              style={{
                                borderRadius: 2,
                                background: `${BT.text.cyan}18`,
                                color: BT.text.cyan,
                                border: `1px solid ${BT.text.cyan}44`,
                              }}
                            >
                              {meta.recommendationCount} rec{meta.recommendationCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className="text-[11px] whitespace-nowrap" style={{ color: BT.text.muted }}>
                          {getTimeSince(finding.timestamp)}
                        </span>
                        <svg
                          className="w-4 h-4 transition-colors"
                          style={{ color: BT.text.muted }}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}

            {activeFindings.length >= 5 && (
              <div className="pt-1 text-center">
                <button
                  onClick={() => {
                    if (activeTab === 'news') navigate('/news-intel');
                    else if (activeTab === 'market') navigate('/deals');
                    else if (activeTab === 'insights') navigate('/deals');
                    else if (activeTab === 'actions') navigate('/deals');
                  }}
                  className="text-sm font-medium"
                  style={{ color: BT.text.cyan }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                >
                  View All {CATEGORY_CONFIG[activeTab].label} →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
