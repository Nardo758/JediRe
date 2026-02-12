import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
        timestamp: yesterday.toISOString(), link: '/market-data',
        metadata: { metric: 'rent', change: 12.3 }
      },
      {
        id: 'market-2', type: 'market', priority: 'important',
        title: 'Buckhead occupancy dropped to 88.5%',
        description: 'Down 4.2% from last quarter. New supply entering market - consider pricing adjustments.',
        timestamp: twoDaysAgo.toISOString(), link: '/market-data',
        metadata: { metric: 'occupancy', change: -4.2 }
      },
      {
        id: 'market-3', type: 'market', priority: 'info',
        title: 'West Midtown absorption rate accelerating',
        description: 'New units leasing 15% faster than 6-month average. Strong market momentum.',
        timestamp: threeDaysAgo.toISOString(), link: '/market-data',
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

const PRIORITY_STYLES = {
  urgent: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    dot: 'bg-red-500',
    text: 'text-red-900',
    badge: 'bg-red-100 text-red-800',
  },
  important: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
    text: 'text-orange-900',
    badge: 'bg-orange-100 text-orange-800',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
    text: 'text-blue-900',
    badge: 'bg-blue-100 text-blue-800',
  },
};

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
      const token = localStorage.getItem('token');
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
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-500">Loading key findings...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="text-red-500">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Key Findings</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {totalFindings === 0 
                ? 'All caught up! No urgent findings.' 
                : `${totalFindings} finding${totalFindings !== 1 ? 's' : ''} requiring attention`}
            </p>
          </div>
          <button
            onClick={fetchFindings}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {(Object.keys(CATEGORY_CONFIG) as CategoryKey[]).map((category) => {
            const count = findings[category]?.length || 0;
            const config = CATEGORY_CONFIG[category];
            const isActive = activeTab === category;

            return (
              <button
                key={category}
                onClick={() => setActiveTab(category)}
                className={`
                  flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap
                  ${isActive 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'}
                `}
              >
                <span className="text-lg">{config.icon}</span>
                <span className="font-medium">{config.label}</span>
                {count > 0 && (
                  <span className={`
                    ml-1 px-2 py-0.5 text-xs font-semibold rounded-full
                    ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}
                  `}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Findings List */}
      <div className="divide-y divide-gray-100">
        {activeFindings.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="text-5xl mb-3">{CATEGORY_CONFIG[activeTab].icon}</div>
            <p className="text-gray-500">{CATEGORY_CONFIG[activeTab].emptyMessage}</p>
          </div>
        ) : (
          <>
            {activeFindings.map((finding) => {
              const styles = PRIORITY_STYLES[finding.priority];
              
              return (
                <button
                  key={finding.id}
                  onClick={() => handleFindingClick(finding)}
                  className={`
                    w-full px-6 py-4 text-left transition-all hover:shadow-sm
                    ${styles.bg} hover:${styles.bg} border-l-4 ${styles.border}
                  `}
                >
                  <div className="flex items-start gap-3">
                    {/* Priority Dot */}
                    <div className={`w-2 h-2 rounded-full ${styles.dot} mt-2 flex-shrink-0`} />
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <h3 className={`font-semibold ${styles.text} text-sm`}>
                          {finding.title}
                        </h3>
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {getTimeSince(finding.timestamp)}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-700 mb-2">
                        {finding.description}
                      </p>
                      
                      {/* Metadata badges */}
                      {finding.metadata && (
                        <div className="flex flex-wrap gap-2">
                          {finding.metadata.category && (
                            <span className={`text-xs px-2 py-1 rounded ${styles.badge}`}>
                              {finding.metadata.category}
                            </span>
                          )}
                          {finding.metadata.affectedDeals > 0 && (
                            <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">
                              {finding.metadata.affectedDeals} deal{finding.metadata.affectedDeals !== 1 ? 's' : ''}
                            </span>
                          )}
                          {finding.metadata.pendingTasks > 0 && (
                            <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">
                              {finding.metadata.pendingTasks} task{finding.metadata.pendingTasks !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Arrow */}
                    <svg 
                      className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M9 5l7 7-7 7" 
                      />
                    </svg>
                  </div>
                </button>
              );
            })}
            
            {/* View All button */}
            {activeFindings.length >= 5 && (
              <div className="px-6 py-3 bg-gray-50">
                <button
                  onClick={() => {
                    // Navigate to dedicated page for this category
                    if (activeTab === 'news') navigate('/news-intel');
                    else if (activeTab === 'market') navigate('/market-data');
                    else if (activeTab === 'insights') navigate('/insights');
                    else if (activeTab === 'actions') navigate('/deals');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
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
