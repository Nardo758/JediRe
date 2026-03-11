import { TrendingUp, Target, ArrowRightLeft, Calendar } from 'lucide-react';

interface Insight {
  icon: React.ReactNode;
  text: string;
  type?: 'default' | 'highlight' | 'warning';
}

interface QuickInsightsProps {
  insights?: Insight[];
}

const defaultInsights: Insight[] = [
  {
    icon: <TrendingUp className="w-4 h-4" />,
    text: '23 high-opportunity properties in your search area',
    type: 'default',
  },
  {
    icon: <Target className="w-4 h-4" />,
    text: '8 properties with >15% strategy arbitrage opportunities',
    type: 'highlight',
  },
  {
    icon: <ArrowRightLeft className="w-4 h-4" />,
    text: 'Best strategy shift: 456 Oak St (Rental→Airbnb = +$850/mo)',
    type: 'highlight',
  },
  {
    icon: <Calendar className="w-4 h-4" />,
    text: 'Market timing: Interest rates expected to decline in 3-6 months',
    type: 'default',
  },
];

export default function QuickInsights({ insights = defaultInsights }: QuickInsightsProps) {
  const getTypeStyles = (type: string = 'default') => {
    switch (type) {
      case 'highlight':
        return 'text-blue-700 bg-blue-50';
      case 'warning':
        return 'text-amber-700 bg-amber-50';
      default:
        return 'text-gray-700 bg-gray-50';
    }
  };

  return (
    <div className="bg-white border-t border-gray-200">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Quick Insights</span>
        </div>
        
        <div className="space-y-2">
          {insights.map((insight, index) => (
            <div
              key={index}
              className={`flex items-start gap-2 px-3 py-2 rounded-lg ${getTypeStyles(insight.type)}`}
            >
              <span className="mt-0.5 flex-shrink-0">{insight.icon}</span>
              <span className="text-sm">{insight.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
