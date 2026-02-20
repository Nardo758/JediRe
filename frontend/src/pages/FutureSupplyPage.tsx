/**
 * Future Supply Page
 * Construction pipeline visualization and tracking
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Construction,
  Building2,
  Users,
  ArrowLeft,
  Calendar,
  MapPin,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus
} from 'lucide-react';
import { IntelligenceTabNav } from '../components/intelligence/IntelligenceTabNav';

interface PipelineProject {
  id: string;
  project_name: string;
  location: string;
  developer: string;
  projected_units: number;
  phase: 'Planning' | 'Permitted' | 'Construction' | 'Completion';
  estimated_completion_date: string | null;
  created_at: string;
  updated_at: string;
}

interface PhaseSummary {
  phase: string;
  project_count: number;
  total_units: number;
}

interface Alert {
  id: string;
  title: string;
  description: string;
  alert_type: string;
  severity: string;
  created_at: string;
}

export const FutureSupplyPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<PipelineProject[]>([]);
  const [phaseSummary, setPhaseSummary] = useState<PhaseSummary[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [selectedPhase, setSelectedPhase] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState('');
  const [minUnits, setMinUnits] = useState('');

  useEffect(() => {
    fetchFutureSupply();
  }, [selectedPhase, selectedCity, minUnits]);

  const fetchFutureSupply = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        ...(selectedPhase && { phase: selectedPhase }),
        ...(selectedCity && { city: selectedCity }),
        ...(minUnits && { minUnits })
      });

      const response = await fetch(`/api/v1/market-research/future-supply?${params}`);
      const result = await response.json();

      if (result.success) {
        setProjects(result.data.projects || []);
        setPhaseSummary(result.data.phaseSummary || []);
        setAlerts(result.data.relatedAlerts || []);
      }
    } catch (error) {
      console.error('Error fetching future supply:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'Planning':
        return <Clock className="w-5 h-5 text-blue-600" />;
      case 'Permitted':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'Construction':
        return <Construction className="w-5 h-5 text-orange-600" />;
      case 'Completion':
        return <Building2 className="w-5 h-5 text-purple-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'Planning':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Permitted':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Construction':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Completion':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'TBD';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  };

  const totalUnits = phaseSummary.reduce((sum, phase) => sum + (phase.total_units || 0), 0);
  const totalProjects = phaseSummary.reduce((sum, phase) => sum + (phase.project_count || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Intelligence Tab Navigation */}
      <IntelligenceTabNav />
      
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => navigate('/market-research')}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Properties
              </button>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Construction className="w-8 h-8 text-purple-600" />
                Future Supply Pipeline
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Construction projects and development tracking
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/market-research')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Building2 className="w-4 h-4" />
                Properties
              </button>
              <button
                onClick={() => navigate('/market-research/active-owners')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Users className="w-4 h-4" />
                Active Owners
              </button>
            </div>
          </div>

          {/* Phase Summary Cards */}
          <div className="grid grid-cols-5 gap-4 mt-6">
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-900">
                {totalProjects}
              </div>
              <div className="text-xs text-purple-700 mt-1">Total Projects</div>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-emerald-900">
                {totalUnits.toLocaleString()}
              </div>
              <div className="text-xs text-emerald-700 mt-1">Pipeline Units</div>
            </div>
            {phaseSummary.slice(0, 3).map((phase) => (
              <div
                key={phase.phase}
                className={`border rounded-lg p-4 ${getPhaseColor(phase.phase)}`}
              >
                <div className="flex items-center justify-between mb-2">
                  {getPhaseIcon(phase.phase)}
                  <span className="text-xs font-medium">{phase.phase}</span>
                </div>
                <div className="text-xl font-bold">
                  {(phase.total_units || 0).toLocaleString()}
                </div>
                <div className="text-xs mt-1">
                  {phase.project_count} {phase.project_count === 1 ? 'project' : 'projects'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-3 gap-6">
          {/* Main Content - Projects List */}
          <div className="col-span-2">
            {/* Filters */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Phase
                  </label>
                  <select
                    value={selectedPhase}
                    onChange={(e) => setSelectedPhase(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">All Phases</option>
                    <option value="Planning">Planning</option>
                    <option value="Permitted">Permitted</option>
                    <option value="Construction">Construction</option>
                    <option value="Completion">Completion</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    placeholder="Filter by city..."
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Min Units
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 100"
                    value={minUnits}
                    onChange={(e) => setMinUnits(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Projects List */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {loading ? (
                <div className="p-12 text-center text-gray-500">
                  Loading pipeline projects...
                </div>
              ) : projects.length === 0 ? (
                <div className="p-12 text-center">
                  <Construction className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No projects found matching your filters.</p>
                  <button className="flex items-center gap-2 mx-auto px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                    <Plus className="w-4 h-4" />
                    Add New Project
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {projects.map((project) => (
                    <div key={project.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {project.project_name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                            <MapPin className="w-4 h-4" />
                            {project.location}
                          </div>
                        </div>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getPhaseColor(project.phase)}`}>
                          {project.phase}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mt-4">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Developer</div>
                          <div className="text-sm font-medium text-gray-900">
                            {project.developer || 'N/A'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Units</div>
                          <div className="text-sm font-medium text-gray-900">
                            {project.projected_units.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Est. Completion</div>
                          <div className="flex items-center gap-1 text-sm font-medium text-gray-900">
                            <Calendar className="w-3 h-3" />
                            {formatDate(project.estimated_completion_date)}
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar (mock based on phase) */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                          <span>Progress</span>
                          <span>
                            {project.phase === 'Planning' ? '15%' :
                             project.phase === 'Permitted' ? '35%' :
                             project.phase === 'Construction' ? '65%' : '95%'}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              project.phase === 'Planning' ? 'bg-blue-600 w-[15%]' :
                              project.phase === 'Permitted' ? 'bg-green-600 w-[35%]' :
                              project.phase === 'Construction' ? 'bg-orange-600 w-[65%]' : 'bg-purple-600 w-[95%]'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Related Alerts */}
          <div className="col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 p-4 sticky top-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <h3 className="font-semibold text-gray-900">Related Alerts</h3>
              </div>

              {alerts.length === 0 ? (
                <p className="text-sm text-gray-500">No active alerts</p>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-start justify-between mb-2">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getSeverityColor(alert.severity)}`}>
                          {alert.alert_type}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(alert.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="text-sm font-medium text-gray-900 mb-1">
                        {alert.title}
                      </h4>
                      <p className="text-xs text-gray-600 line-clamp-2">
                        {alert.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Project Button */}
              <button className="w-full mt-6 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                <Plus className="w-4 h-4" />
                Add New Project
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FutureSupplyPage;
