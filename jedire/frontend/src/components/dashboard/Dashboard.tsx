import { useState } from 'react';
import { Search, Filter, Layers, Users, Settings } from 'lucide-react';
import { useAppStore } from '@/store';
import SearchBar from './SearchBar';
import FilterPanel from './FilterPanel';
import ModuleToggle from './ModuleToggle';
import CollaboratorsList from './CollaboratorsList';

export default function Dashboard() {
  const [showFilters, setShowFilters] = useState(false);
  const [showModules, setShowModules] = useState(false);
  const { sidebarOpen, setSidebarOpen, properties, collaborators } = useAppStore();

  return (
    <div
      className={`fixed left-0 top-0 h-full bg-white shadow-lg transition-all duration-300 z-30 ${
        sidebarOpen ? 'w-96' : 'w-16'
      }`}
    >
      {/* Sidebar Header */}
      <div className="h-16 border-b border-gray-200 flex items-center px-4 bg-gradient-to-r from-primary-600 to-purple-600">
        {sidebarOpen ? (
          <div className="flex items-center justify-between w-full">
            <h1 className="text-xl font-bold text-white">JediRe</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 hover:bg-white/20 rounded transition-colors"
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 hover:bg-white/20 rounded transition-colors mx-auto"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* Sidebar Content */}
      {sidebarOpen && (
        <div className="flex flex-col h-[calc(100%-4rem)] overflow-hidden">
          {/* Search Bar */}
          <div className="p-4 border-b border-gray-200">
            <SearchBar />
          </div>

          {/* Action Buttons */}
          <div className="p-4 border-b border-gray-200 space-y-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="w-full btn btn-secondary flex items-center justify-center gap-2"
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
            </button>
            <button
              onClick={() => setShowModules(!showModules)}
              className="w-full btn btn-secondary flex items-center justify-center gap-2"
            >
              <Layers className="w-4 h-4" />
              <span>Modules</span>
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="border-b border-gray-200">
              <FilterPanel />
            </div>
          )}

          {/* Module Toggle */}
          {showModules && (
            <div className="border-b border-gray-200">
              <ModuleToggle />
            </div>
          )}

          {/* Stats */}
          <div className="p-4 border-b border-gray-200">
            <div className="grid grid-cols-2 gap-3">
              <div className="card text-center">
                <div className="text-2xl font-bold text-primary-600">
                  {properties.length}
                </div>
                <div className="text-xs text-gray-600 mt-1">Properties</div>
              </div>
              <div className="card text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {collaborators.length}
                </div>
                <div className="text-xs text-gray-600 mt-1">Online</div>
              </div>
            </div>
          </div>

          {/* Collaborators */}
          {collaborators.length > 0 && (
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-gray-600" />
                <h3 className="font-semibold text-gray-900 text-sm">Collaborators</h3>
              </div>
              <CollaboratorsList collaborators={collaborators} />
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1"></div>

          {/* Settings */}
          <div className="p-4 border-t border-gray-200">
            <button className="w-full btn btn-ghost flex items-center justify-center gap-2">
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
