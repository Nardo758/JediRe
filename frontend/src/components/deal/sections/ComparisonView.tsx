import React from 'react';

interface ComparisonViewProps {
  scenarios: any[];
  onSelect?: (scenario: any) => void;
}

const ComparisonView: React.FC<ComparisonViewProps> = ({ scenarios = [], onSelect }) => {
  if (!scenarios || scenarios.length === 0) {
    return (
      <div className="p-4 text-center text-[#6B7585]">
        <p>No scenarios to compare. Create multiple scenarios to use the comparison view.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-[#0F1319]">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7585] uppercase">Metric</th>
            {scenarios.map((s: any, i: number) => (
              <th key={i} className="px-4 py-3 text-left text-xs font-medium text-[#6B7585] uppercase">
                {s.name || `Scenario ${i + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-[#0F1319] divide-y divide-gray-200">
          {['totalDevelopmentCost', 'netOperatingIncome', 'yieldOnCost', 'irr'].map(metric => (
            <tr key={metric}>
              <td className="px-4 py-2 text-sm font-medium text-[#E8E6E1]">{metric}</td>
              {scenarios.map((s: any, i: number) => (
                <td key={i} className="px-4 py-2 text-sm text-[#9EA8B4]">
                  {s[metric] != null ? String(s[metric]) : '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ComparisonView;
