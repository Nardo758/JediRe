import React from 'react';
import { useDesignDashboardStore } from '../../../stores/DesignDashboardStore';
import { Eye, EyeOff, MapPin } from 'lucide-react';

export const CompetitionTable: React.FC = () => {
  const { competingProperties, toggleCompetitorVisibility, selectCompetitor } = useDesignDashboardStore();

  if (competingProperties.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>No competing properties added yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left px-4 py-2 text-sm font-medium text-gray-700">Property</th>
            <th className="text-right px-4 py-2 text-sm font-medium text-gray-700">Units</th>
            <th className="text-right px-4 py-2 text-sm font-medium text-gray-700">Year Built</th>
            <th className="text-right px-4 py-2 text-sm font-medium text-gray-700">Avg Rent</th>
            <th className="text-right px-4 py-2 text-sm font-medium text-gray-700">Occupancy</th>
            <th className="text-right px-4 py-2 text-sm font-medium text-gray-700">Distance</th>
            <th className="text-center px-4 py-2 text-sm font-medium text-gray-700">Actions</th>
          </tr>
        </thead>
        <tbody>
          {competingProperties.map((property) => (
            <tr
              key={property.id}
              className="border-b hover:bg-gray-50 cursor-pointer"
              onClick={() => selectCompetitor(property.id)}
            >
              <td className="px-4 py-3">
                <div className="font-medium text-sm">{property.name}</div>
              </td>
              <td className="text-right px-4 py-3 text-sm">{property.units}</td>
              <td className="text-right px-4 py-3 text-sm">{property.yearBuilt}</td>
              <td className="text-right px-4 py-3 text-sm">${property.monthlyRent}</td>
              <td className="text-right px-4 py-3 text-sm">
                <span className={property.occupancy >= 95 ? 'text-green-600' : ''}>
                  {property.occupancy}%
                </span>
              </td>
              <td className="text-right px-4 py-3 text-sm">{property.distance.toFixed(1)} mi</td>
              <td className="text-center px-4 py-3">
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCompetitorVisibility(property.id);
                    }}
                    className="p-1 text-gray-600 hover:text-gray-800"
                  >
                    {property.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Zoom to property on map
                    }}
                    className="p-1 text-blue-600 hover:text-blue-800"
                  >
                    <MapPin className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50">
            <td className="px-4 py-3 text-sm font-medium">Average</td>
            <td className="text-right px-4 py-3 text-sm font-medium">
              {Math.round(competingProperties.reduce((sum, p) => sum + p.units, 0) / competingProperties.length)}
            </td>
            <td className="text-right px-4 py-3 text-sm font-medium">-</td>
            <td className="text-right px-4 py-3 text-sm font-medium">
              ${Math.round(competingProperties.reduce((sum, p) => sum + p.monthlyRent, 0) / competingProperties.length)}
            </td>
            <td className="text-right px-4 py-3 text-sm font-medium">
              {(competingProperties.reduce((sum, p) => sum + p.occupancy, 0) / competingProperties.length).toFixed(1)}%
            </td>
            <td className="text-right px-4 py-3 text-sm font-medium">
              {(competingProperties.reduce((sum, p) => sum + p.distance, 0) / competingProperties.length).toFixed(1)} mi
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};