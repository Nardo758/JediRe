import { useState } from 'react';
import { Search, Filter, Layers, Users, Settings, Building2 } from 'lucide-react';
import { useAppStore } from '@/store';
import { BT } from '@/components/deal/bloomberg-ui';
import SearchBar from './SearchBar';
import FilterPanel from './FilterPanel';
import ModuleToggle from './ModuleToggle';
import CollaboratorsList from './CollaboratorsList';
import PropertyAnalyzer from '../property/PropertyAnalyzer';

export default function Dashboard() {
  const [showFilters, setShowFilters] = useState(false);
  const [showModules, setShowModules] = useState(false);
  const [showAnalyzer, setShowAnalyzer] = useState(true);
  const { sidebarOpen, setSidebarOpen, properties, collaborators } = useAppStore();

  return (
    <div
      className={`fixed left-0 top-0 h-full transition-all duration-300 z-30 ${
        sidebarOpen ? 'w-96' : 'w-16'
      }`}
      style={{ background: BT.bg.panel }}
    >
      {/* Sidebar Header */}
      <div
        className="h-16 flex items-center px-4"
        style={{ borderBottom: `1px solid ${BT.border.subtle}`, background: BT.bg.header }}
      >
        {sidebarOpen ? (
          <div className="flex items-center justify-between w-full">
            <h1 className="text-xl font-bold" style={{ color: BT.text.amber, fontFamily: BT.font.display }}>{`JediRe`}</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 transition-colors"
              style={{ borderRadius: 2 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = BT.bg.hover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <svg className="w-5 h-5" style={{ color: BT.text.primary }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 transition-colors mx-auto"
            style={{ borderRadius: 2 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = BT.bg.hover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <svg className="w-5 h-5" style={{ color: BT.text.primary }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* Sidebar Content */}
      {sidebarOpen && (
        <div className="flex flex-col h-[calc(100%-4rem)] overflow-hidden">
          {/* Search Bar */}
          <div className="p-4" style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
            <SearchBar />
          </div>

          {/* Tab Buttons */}
          <div className="p-4 flex gap-2" style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
            <button
              onClick={() => { setShowAnalyzer(true); setShowFilters(false); setShowModules(false); }}
              className="flex-1 py-2 px-3 font-medium text-sm flex items-center justify-center gap-1"
              style={{
                borderRadius: 0,
                background: showAnalyzer ? BT.bg.active : BT.bg.panelAlt,
                color: showAnalyzer ? BT.text.cyan : BT.text.secondary,
                fontFamily: BT.font.label,
              }}
            >
              <Building2 className="w-4 h-4" />
              Analyze
            </button>
            <button
              onClick={() => { setShowAnalyzer(false); setShowFilters(!showFilters); }}
              className="flex-1 py-2 px-3 font-medium text-sm flex items-center justify-center gap-1"
              style={{
                borderRadius: 0,
                background: showFilters ? BT.bg.active : BT.bg.panelAlt,
                color: showFilters ? BT.text.cyan : BT.text.secondary,
                fontFamily: BT.font.label,
              }}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <button
              onClick={() => { setShowAnalyzer(false); setShowModules(!showModules); }}
              className="flex-1 py-2 px-3 font-medium text-sm flex items-center justify-center gap-1"
              style={{
                borderRadius: 0,
                background: showModules ? BT.bg.active : BT.bg.panelAlt,
                color: showModules ? BT.text.cyan : BT.text.secondary,
                fontFamily: BT.font.label,
              }}
            >
              <Layers className="w-4 h-4" />
              Modules
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
              <FilterPanel />
            </div>
          )}

          {/* Module Toggle */}
          {showModules && !showAnalyzer && (
            <div style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
              <ModuleToggle />
            </div>
          )}

          {/* Property Analyzer */}
          {showAnalyzer && (
            <div className="flex-1 overflow-hidden">
              <PropertyAnalyzer />
            </div>
          )}

          {/* Stats (only when not showing analyzer) */}
          {!showAnalyzer && (
            <>
              <div className="p-4" style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
                    <div className="text-2xl font-bold" style={{ color: BT.text.cyan, fontFamily: BT.font.mono }}>
                      {properties.length}
                    </div>
                    <div className="text-xs mt-1" style={{ color: BT.text.secondary, fontFamily: BT.font.label }}>Properties</div>
                  </div>
                  <div className="text-center p-3" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
                    <div className="text-2xl font-bold" style={{ color: BT.text.purple, fontFamily: BT.font.mono }}>
                      {collaborators.length}
                    </div>
                    <div className="text-xs mt-1" style={{ color: BT.text.secondary, fontFamily: BT.font.label }}>Online</div>
                  </div>
                </div>
              </div>

              {/* Collaborators */}
              {collaborators.length > 0 && (
                <div className="p-4" style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4" style={{ color: BT.text.secondary }} />
                    <h3 className="font-semibold text-sm" style={{ color: BT.text.primary, fontFamily: BT.font.label }}>Collaborators</h3>
                  </div>
                  <CollaboratorsList collaborators={collaborators} />
                </div>
              )}

              {/* Spacer */}
              <div className="flex-1"></div>

              {/* Settings */}
              <div className="p-4" style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
                <button
                  className="w-full flex items-center justify-center gap-2 py-2 px-4"
                  style={{ color: BT.text.secondary, fontFamily: BT.font.label }}
                >
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
