interface AgentInsight {
  name: string;
  icon: string;
  confidence: number;
  insight: string;
}

interface AgentInsightsProps {
  insights?: AgentInsight[];
}

const defaultInsights: AgentInsight[] = [
  {
    name: 'Supply Agent',
    icon: '🏠',
    confidence: 92,
    insight: 'Low inventory in area - only 2.1 months supply. Strong rental demand with minimal new construction planned in 5-year pipeline.',
  },
  {
    name: 'Demand Agent',
    icon: '📈',
    confidence: 88,
    insight: 'Population growing 2.3% annually. Major employer expansions announced. Strong job growth in target demographic.',
  },
  {
    name: 'News Agent',
    icon: '📰',
    confidence: 85,
    insight: 'Recent news: Transit expansion announced near property. Positive sentiment from 8 recent articles. Rental market strengthening.',
  },
  {
    name: 'Debt Agent',
    icon: '💰',
    confidence: 91,
    insight: 'Current rates: 6.875% for investment property. Cycle analysis suggests rates may decrease 50-100bp in next 6 months.',
  },
  {
    name: 'Cash Flow Agent',
    icon: '💵',
    confidence: 89,
    insight: 'Market rent analysis shows conservative estimate. Similar properties renting for 10-15% higher. Upside potential through value-add.',
  },
];

export default function AgentInsights({ insights = defaultInsights }: AgentInsightsProps) {
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'bg-green-100 text-green-700';
    if (confidence >= 80) return 'bg-blue-100 text-blue-700';
    if (confidence >= 70) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Agent Insights</h3>
      
      <div className="space-y-3">
        {insights.map((agent) => (
          <div
            key={agent.name}
            className="bg-gray-50 rounded-lg p-3 border border-gray-200"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{agent.icon}</span>
                <span className="text-sm font-medium text-gray-800">{agent.name}</span>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${getConfidenceColor(agent.confidence)}`}>
                {agent.confidence}%
              </span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">{agent.insight}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
