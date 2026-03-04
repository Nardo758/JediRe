import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Building2,
  Users,
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Copy,
  Plus,
  Calendar,
  Clock,
  Filter,
} from 'lucide-react';
import api from '@/services/api';
import {
  exportToCSV,
  exportToExcel,
  copyToClipboard,
  formatFutureSupplyDataForExport,
} from '@/services/marketResearchExport.service';

interface Project {
  id: string;
  project_name: string;
  developer: string;
  units: number;
  phase: 'Planning' | 'Permitted' | 'Construction' | 'Completion';
  expected_date: string;
  location?: string;
}

interface Stats {
  totalProjects: number;
  totalUnits: number;
  avgCompletionTime: number; // in months
}

const PHASES = ['Planning', 'Permitted', 'Construction', 'Completion'] as const;
const PHASE_COLORS = {
  Planning: 'bg-gray-100 text-gray-700',
  Permitted: 'bg-blue-100 text-blue-700',
  Construction: 'bg-orange-100 text-orange-700',
  Completion: 'bg-green-100 text-green-700',
};

export default function FutureSupplyPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalProjects: 0,
    totalUnits: 0,
    avgCompletionTime: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [selectedPhase, setSelectedPhase] = useState<string>('');
  
  // UI state
  const [exportLoading, setExportLoading] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [selectedPhase]);

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params: any = {};
      if (selectedPhase) params.phase = selectedPhase;
      
      const { data } = await api.get('/market-research/future-supply', { params });
      
      setProjects(data.projects || []);
      setStats(data.stats || stats);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load future supply data');
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    setExportLoading(true);
    try {
      const formatted = formatFutureSupplyDataForExport(projects);
      exportToCSV(formatted, `future-supply-${new Date().toISOString().split('T')[0]}`);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportExcel = async () => {
    setExportLoading(true);
    try {
      const formatted = formatFutureSupplyDataForExport(projects);
      exportToExcel(formatted, `future-supply-${new Date().toISOString().split('T')[0]}`, 'Future Supply');
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExportLoading(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      const formatted = formatFutureSupplyDataForExport(projects);
      await copyToClipboard(formatted);
      alert('Data copied to clipboard!');
    } catch (err) {
      console.error('Copy error:', err);
      alert('Failed to copy to clipboard');
    }
  };

  // Group projects by phase for timeline
  const projectsByPhase = PHASES.map(phase => ({
    phase,
    count: projects.filter(p => p.phase === phase).length,
    units: projects.filter(p => p.phase === phase).reduce((sum, p) => sum + p.units, 0),
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link to="/market-research" className="text-gray-400 hover:text-gray-600 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-purple-600" />
                <h1 className="text-2xl font-bold text-gray-900">Future Supply Pipeline</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/market-research"
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                <Building2 className="w-4 h-4 inline mr-2" />
                Properties
              </Link>
              <Link
                to="/market-research/active-owners"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Users className="w-4 h-4 inline mr-2" />
                Active Owners
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Total Pipeline Projects</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalProjects}</p>
              </div>
              <Building2 className="w-10 h-10 text-purple-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Total Units Coming</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalUnits.toLocaleString()}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-emerald-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Avg Completion Time</p>
                <p className="text-2xl font-bold text-gray-900">{stats.avgCompletionTime} months</p>
              </div>
              <Clock className="w-10 h-10 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Timeline Visualization */}
        <div className="bg-white rounded-lg p-6 border border-gray-200 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pipeline by Phase</h3>
          <div className="space-y-4">
            {projectsByPhase.map(({ phase, count, units }) => (
              <div key={phase}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${PHASE_COLORS[phase]}`}>
                      {phase}
                    </span>
                    <span className="text-sm text-gray-600">
                      {count} {count === 1 ? 'project' : 'projects'} • {units.toLocaleString()} units
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {stats.totalUnits > 0 ? Math.round((units / stats.totalUnits) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      phase === 'Planning' ? 'bg-gray-400' :
                      phase === 'Permitted' ? 'bg-blue-500' :
                      phase === 'Construction' ? 'bg-orange-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: stats.totalUnits > 0 ? `${(units / stats.totalUnits) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="bg-white rounded-lg p-4 border border-gray-200 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Filter className="w-5 h-5 text-gray-400" />
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Phase:</label>
                <select
                  value={selectedPhase}
                  onChange={(e) => setSelectedPhase(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">All Phases</option>
                  {PHASES.map(phase => (
                    <option key={phase} value={phase}>{phase}</option>
                  ))}
                </select>
              </div>
              
              <button
                onClick={() => setShowAddProject(true)}
                className="ml-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Project
              </button>
            </div>

            {/* Export Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                disabled={exportLoading || projects.length === 0}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="w-4 h-4 inline mr-1" />
                CSV
              </button>
              <button
                onClick={handleExportExcel}
                disabled={exportLoading || projects.length === 0}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 inline mr-1" />
                Excel
              </button>
              <button
                onClick={handleCopyToClipboard}
                disabled={projects.length === 0}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Copy className="w-4 h-4 inline mr-1" />
                Copy
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="bg-white rounded-lg p-12 border border-gray-200 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading pipeline projects...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg p-12 border border-red-200 text-center">
            <p className="text-red-600">{error}</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white rounded-lg p-12 border border-gray-200 text-center">
            <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
            <p className="text-gray-500 mb-6">
              {selectedPhase ? 'Try selecting a different phase' : 'Start by adding a new project'}
            </p>
            <button
              onClick={() => setShowAddProject(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
            >
              Add Project
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Project Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Developer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Units
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Phase
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Expected Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Location
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {projects.map((project) => (
                    <tr key={project.id} className="hover:bg-purple-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {project.project_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {project.developer}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-purple-600">
                        {project.units.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${PHASE_COLORS[project.phase]}`}>
                          {project.phase}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {project.expected_date ? new Date(project.expected_date).toLocaleDateString() : 'TBD'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {project.location || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add Project Modal (Placeholder) */}
        {showAddProject && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddProject(false)}>
            <div className="bg-white rounded-xl w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Add New Project</h3>
                <button 
                  onClick={() => setShowAddProject(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
                  <input
                    type="text"
                    placeholder="e.g., The Heights at Midtown"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Developer</label>
                    <input
                      type="text"
                      placeholder="Developer name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Units</label>
                    <input
                      type="number"
                      placeholder="e.g., 250"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phase</label>
                    <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                      {PHASES.map(phase => (
                        <option key={phase} value={phase}>{phase}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expected Date</label>
                    <input
                      type="date"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    placeholder="e.g., Atlanta, GA"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                
                <div className="pt-4 text-center text-sm text-gray-500">
                  <p>Form submission will be implemented with backend integration</p>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
                <button
                  onClick={() => setShowAddProject(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    alert('Project creation will be implemented');
                    setShowAddProject(false);
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
                >
                  Add Project
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
