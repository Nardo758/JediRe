import { TrendingUp, Target, ArrowRightLeft, Calendar } from 'lucide-react';
import { BT } from '@/components/deal/bloomberg-ui';

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

const getTypeStyles = (type: string = 'default'): { color: string; background: string } => {
  switch (type) {
    case 'highlight':
      return { color: BT.text.cyan, background: `${BT.text.cyan}11` };
    case 'warning':
      return { color: BT.text.amber, background: `${BT.text.amber}11` };
    default:
      return { color: BT.text.secondary, background: BT.bg.panelAlt };
  }
};

export default function QuickInsights({ insights = defaultInsights }: QuickInsightsProps) {
  return (
    <div style={{ background: BT.bg.panel, borderTop: `1px solid ${BT.border.subtle}` }}>
      <div className="px-6 py-3">
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: BT.text.muted, fontFamily: BT.font.label }}
          >
            Quick Insights
          </span>
        </div>

        <div className="space-y-2">
          {insights.map((insight, index) => {
            const typeStyle = getTypeStyles(insight.type);
            return (
              <div
                key={index}
                className="flex items-start gap-2 px-3 py-2"
                style={{
                  borderRadius: 0,
                  color: typeStyle.color,
                  background: typeStyle.background,
                }}
              >
                <span className="mt-0.5 flex-shrink-0">{insight.icon}</span>
                <span className="text-sm" style={{ fontFamily: BT.font.label }}>{insight.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
