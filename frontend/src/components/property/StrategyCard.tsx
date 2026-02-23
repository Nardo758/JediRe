interface StrategyCardProps {
  name: string;
  annualROI: number;
  investment: number;
  timeline: string;
  profit: string;
  profitLabel: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  isOptimal?: boolean;
  onClick?: () => void;
}

export default function StrategyCard({
  name,
  annualROI,
  investment,
  timeline,
  profit,
  profitLabel,
  riskLevel,
  isOptimal = false,
  onClick,
}: StrategyCardProps) {
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return 'text-green-600 bg-green-50';
      case 'Medium': return 'text-yellow-600 bg-yellow-50';
      case 'High': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-lg ${
        isOptimal
          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className={`font-bold text-sm ${isOptimal ? 'text-blue-700' : 'text-gray-800'}`}>
          {name}
        </h4>
        {isOptimal && (
          <span className="text-yellow-500 text-lg">⭐</span>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">Annual ROI</span>
          <span className={`text-lg font-bold ${isOptimal ? 'text-blue-600' : 'text-gray-800'}`}>
            {annualROI}%
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">Investment</span>
          <span className="text-sm font-medium text-gray-700">
            ${investment.toLocaleString()}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">Timeline</span>
          <span className="text-sm font-medium text-gray-700">{timeline}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">{profitLabel}</span>
          <span className="text-sm font-bold text-green-600">{profit}</span>
        </div>

        <div className="flex justify-between items-center pt-1">
          <span className="text-xs text-gray-500">Risk</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${getRiskColor(riskLevel)}`}>
            {riskLevel}
          </span>
        </div>
      </div>
    </div>
  );
}
