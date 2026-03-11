import React, { useState } from 'react';
import { useDesignDashboardStore } from '../../../stores/DesignDashboardStore';
import { 
  Car, 
  Building, 
  ShoppingBag, 
  Train, 
  GraduationCap, 
  Music,
  Plus,
  Trash2,
  MapPin
} from 'lucide-react';

const typeIcons = {
  employer: Building,
  retail: ShoppingBag,
  transit: Train,
  school: GraduationCap,
  entertainment: Music,
};

const typeColors = {
  employer: 'text-blue-600',
  retail: 'text-green-600',
  transit: 'text-purple-600',
  school: 'text-orange-600',
  entertainment: 'text-pink-600',
};

export const TrafficPanel: React.FC = () => {
  const {
    trafficGenerators,
    selectedTrafficGen,
    layerVisibility,
    addTrafficGenerator,
    removeTrafficGenerator,
    selectTrafficGen,
    toggleLayer,
  } = useDesignDashboardStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newGenerator, setNewGenerator] = useState({
    name: '',
    type: 'employer' as const,
    employeeCount: 1000,
    visitorTraffic: 500,
  });

  const handleAddGenerator = () => {
    const id = Date.now().toString();
    addTrafficGenerator({
      id,
      name: newGenerator.name || 'New Traffic Generator',
      type: newGenerator.type,
      location: [-118.2437, 34.0522], // Default location
      employeeCount: newGenerator.type === 'employer' ? newGenerator.employeeCount : undefined,
      visitorTraffic: newGenerator.visitorTraffic,
      score: Math.floor(Math.random() * 100), // Random score for demo
    });
    setNewGenerator({
      name: '',
      type: 'employer',
      employeeCount: 1000,
      visitorTraffic: 500,
    });
    setShowAddForm(false);
  };

  const totalScore = trafficGenerators.reduce((sum, gen) => sum + gen.score, 0);
  const avgScore = trafficGenerators.length > 0 ? totalScore / trafficGenerators.length : 0;

  const generatorsByType = trafficGenerators.reduce((acc, gen) => {
    acc[gen.type] = (acc[gen.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold">Traffic Analysis</h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="p-1 text-blue-600 hover:text-blue-700"
            title="Add Generator"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Heat Map Toggle */}
        <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={layerVisibility.trafficHeatMap}
            onChange={() => toggleLayer('trafficHeatMap')}
            className="rounded"
          />
          <span>Show Traffic Heat Map</span>
        </label>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-gray-600 text-xs">Traffic Score</div>
            <div className="font-semibold">{avgScore.toFixed(0)}/100</div>
          </div>
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-gray-600 text-xs">Generators</div>
            <div className="font-semibold">{trafficGenerators.length}</div>
          </div>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="p-4 bg-green-50 border-b">
          <h4 className="text-sm font-medium mb-2">Add Traffic Generator</h4>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Generator Name"
              value={newGenerator.name}
              onChange={(e) => setNewGenerator({ ...newGenerator, name: e.target.value })}
              className="w-full px-2 py-1 text-sm border rounded"
            />
            <select
              value={newGenerator.type}
              onChange={(e) => setNewGenerator({ ...newGenerator, type: e.target.value as any })}
              className="w-full px-2 py-1 text-sm border rounded"
            >
              <option value="employer">Major Employer</option>
              <option value="retail">Retail Center</option>
              <option value="transit">Transit Station</option>
              <option value="school">School/University</option>
              <option value="entertainment">Entertainment Venue</option>
            </select>
            {newGenerator.type === 'employer' && (
              <input
                type="number"
                placeholder="Employee Count"
                value={newGenerator.employeeCount}
                onChange={(e) => setNewGenerator({ ...newGenerator, employeeCount: parseInt(e.target.value) })}
                className="w-full px-2 py-1 text-sm border rounded"
              />
            )}
            <input
              type="number"
              placeholder="Daily Visitor Traffic"
              value={newGenerator.visitorTraffic}
              onChange={(e) => setNewGenerator({ ...newGenerator, visitorTraffic: parseInt(e.target.value) })}
              className="w-full px-2 py-1 text-sm border rounded"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddGenerator}
                className="flex-1 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                Add
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="flex-1 px-3 py-1 border border-gray-300 text-sm rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Type Summary */}
      <div className="px-4 py-2 border-b bg-gray-50">
        <div className="flex justify-between text-xs">
          {Object.entries(generatorsByType).map(([type, count]) => {
            const Icon = typeIcons[type as keyof typeof typeIcons];
            return (
              <div key={type} className="flex items-center gap-1">
                <Icon className={`w-3 h-3 ${typeColors[type as keyof typeof typeColors]}`} />
                <span>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Generators List */}
      <div className="flex-1 overflow-y-auto">
        {trafficGenerators.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            <Car className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>No traffic generators identified</p>
            <p className="text-xs mt-1">Add major employers, retail centers, and transit stations</p>
          </div>
        ) : (
          <div className="divide-y">
            {trafficGenerators.map((generator) => {
              const Icon = typeIcons[generator.type];
              return (
                <div
                  key={generator.id}
                  className={`p-3 hover:bg-gray-50 cursor-pointer ${
                    selectedTrafficGen === generator.id ? 'bg-green-50' : ''
                  }`}
                  onClick={() => selectTrafficGen(generator.id)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-start gap-2">
                      <Icon className={`w-5 h-5 mt-0.5 ${typeColors[generator.type]}`} />
                      <div>
                        <h4 className="font-medium text-sm">{generator.name}</h4>
                        <p className="text-xs text-gray-600 capitalize">{generator.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-lg font-semibold text-green-600">
                          {generator.score}
                        </div>
                        <div className="text-xs text-gray-500">score</div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTrafficGenerator(generator.id);
                        }}
                        className="p-1 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                    {generator.employeeCount && (
                      <div>
                        <span className="text-gray-600">Employees:</span>
                        <span className="font-medium ml-1">{generator.employeeCount.toLocaleString()}</span>
                      </div>
                    )}
                    {generator.visitorTraffic && (
                      <div>
                        <span className="text-gray-600">Daily Traffic:</span>
                        <span className="font-medium ml-1">{generator.visitorTraffic.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Traffic Analysis */}
      <div className="p-4 border-t bg-gray-50">
        <h4 className="text-sm font-medium mb-2">Traffic Analysis</h4>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-600">Peak Hours:</span>
            <span className="font-medium">7-9 AM, 5-7 PM</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Transit Access:</span>
            <span className="font-medium text-green-600">Good</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Walkability:</span>
            <span className="font-medium text-orange-600">Moderate</span>
          </div>
        </div>
        <button className="w-full mt-3 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
          Generate Detailed Report
        </button>
      </div>
    </div>
  );
};