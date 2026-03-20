import React, { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useDesignDashboardStore } from '../../stores/DesignDashboardStore';

interface CollapsiblePanelProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  position: 'left' | 'right';
  children: ReactNode;
  icon?: ReactNode;
}

export const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
  title,
  isOpen,
  onToggle,
  position,
  children,
  icon,
}) => {
  return (
    <div className={`
      relative h-full bg-white border-gray-200
      ${position === 'left' ? 'border-r' : 'border-l'}
      ${isOpen ? 'w-80' : 'w-12'}
      transition-all duration-300 ease-in-out
    `}>
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className={`
          absolute top-4 bg-white border border-gray-300 rounded-lg p-1.5 shadow-sm hover:shadow-md transition-shadow z-10
          ${position === 'left' ? '-right-3' : '-left-3'}
        `}
        title={isOpen ? `Hide ${title}` : `Show ${title}`}
      >
        {position === 'left' ? (
          isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
        ) : (
          isOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />
        )}
      </button>

      {/* Content */}
      {isOpen ? (
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              {icon}
              {title}
            </h2>
          </div>
          {/* Panel Content */}
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        </div>
      ) : (
        <div className="h-full flex items-center justify-center">
          <div className="transform -rotate-90 whitespace-nowrap text-sm font-medium text-gray-600">
            {title}
          </div>
        </div>
      )}
    </div>
  );
};

interface BottomPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  activeTab: 'competition' | 'traffic' | 'trends';
  onTabChange: (tab: 'competition' | 'traffic' | 'trends') => void;
  children: ReactNode;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  isOpen,
  onToggle,
  activeTab,
  onTabChange,
  children,
}) => {
  return (
    <div className={`
      absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg
      transition-transform duration-300 ease-in-out z-20
      ${isOpen ? 'transform translate-y-0' : 'transform translate-y-full'}
    `}>
      {/* Toggle Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
        <div className="flex items-center gap-4">
          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => onTabChange('competition')}
              className={`px-4 py-1.5 text-sm font-medium rounded transition-colors ${
                activeTab === 'competition'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Competition
            </button>
            <button
              onClick={() => onTabChange('traffic')}
              className={`px-4 py-1.5 text-sm font-medium rounded transition-colors ${
                activeTab === 'traffic'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Traffic Data
            </button>
            <button
              onClick={() => onTabChange('trends')}
              className={`px-4 py-1.5 text-sm font-medium rounded transition-colors ${
                activeTab === 'trends'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Market Trends
            </button>
          </div>
        </div>
        
        <button
          onClick={onToggle}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
        >
          <ChevronLeft className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-90' : '-rotate-90'}`} />
        </button>
      </div>
      
      {/* Content */}
      <div className="h-80 overflow-hidden">
        {children}
      </div>
    </div>
  );
};