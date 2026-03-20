import React from 'react';
import { useDesignDashboardStore } from '../../../stores/DesignDashboardStore';
import { Building, ShoppingBag, Train, GraduationCap, Music, MapPin } from 'lucide-react';

const typeIcons = {
  employer: Building,
  retail: ShoppingBag,
  transit: Train,
  school: GraduationCap,
  entertainment: Music,
};

export const TrafficDataTable: React.FC = () => {
  const { trafficGenerators, selectTrafficGen } = useDesignDashboardStore();

  if (trafficGenerators.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>No traffic generators identified yet</p>
      </div>
    );
  }

  // Calculate impact scores
  const totalScore = trafficGenerators.reduce((sum, gen) => sum + gen.score, 0);
  const maxScore = Math.max(...trafficGenerators.map(gen => gen.score));

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left px-4 py-2 text-sm font-medium text-gray-700">Generator</th>
            <th className="text-left px-4 py-2 text-sm font-medium text-gray-700">Type</th>
            <th className="text-right px-4 py-2 text-sm font-medium text-gray-700">Employees</th>
            <th className="text-right px-4 py-2 text-sm font-medium text-gray-700">Daily Traffic</th>
            <th className="text-right px-4 py-2 text-sm font-medium text-gray-700">Score</th>
            <th className="text-left px-4 py-2 text-sm font-medium text-gray-700">Impact</th>
            <th className="text-center px-4 py-2 text-sm font-medium text-gray-700">Action</th>
          </tr>
        </thead>
        <tbody>
          {trafficGenerators.map((generator) => {
            const Icon = typeIcons[generator.type];
            const impactPercentage = (generator.score / totalScore) * 100;
            
            return (
              <tr
                key={generator.id}
                className="border-b hover:bg-gray-50 cursor-pointer"
                onClick={() => selectTrafficGen(generator.id)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-gray-600" />
                    <span className="font-medium text-sm">{generator.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm capitalize">{generator.type}</td>
                <td className="text-right px-4 py-3 text-sm">
                  {generator.employeeCount ? generator.employeeCount.toLocaleString() : '-'}
                </td>
                <td className="text-right px-4 py-3 text-sm">
                  {generator.visitorTraffic?.toLocaleString() || '-'}
                </td>
                <td className="text-right px-4 py-3">
                  <span className={`text-sm font-medium ${
                    generator.score >= 80 ? 'text-green-600' : 
                    generator.score >= 60 ? 'text-yellow-600' : 'text-gray-600'
                  }`}>
                    {generator.score}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                      <div 
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${(generator.score / maxScore) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600">{impactPercentage.toFixed(0)}%</span>
                  </div>
                </td>
                <td className="text-center px-4 py-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Zoom to generator on map
                    }}
                    className="p-1 text-blue-600 hover:text-blue-800"
                  >
                    <MapPin className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50">
            <td colSpan={2} className="px-4 py-3 text-sm font-medium">Total Impact</td>
            <td className="text-right px-4 py-3 text-sm font-medium">
              {trafficGenerators.reduce((sum, g) => sum + (g.employeeCount || 0), 0).toLocaleString()}
            </td>
            <td className="text-right px-4 py-3 text-sm font-medium">
              {trafficGenerators.reduce((sum, g) => sum + (g.visitorTraffic || 0), 0).toLocaleString()}
            </td>
            <td className="text-right px-4 py-3 text-sm font-medium text-green-600">
              {totalScore}
            </td>
            <td colSpan={2}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};