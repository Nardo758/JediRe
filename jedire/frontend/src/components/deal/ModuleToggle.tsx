/**
 * ModuleToggle Component
 * Toggle between Basic (Free) and Enhanced (Premium) modes
 */

import React from 'react';
import { ModuleToggleProps } from '../../types/deal-enhanced.types';

export const ModuleToggle: React.FC<ModuleToggleProps> = ({
  mode,
  onModeChange,
  isPremium = false
}) => {
  return (
    <div className="flex items-center justify-center gap-0 bg-gray-100 rounded-lg p-1 w-fit">
      {/* Basic Toggle */}
      <button
        onClick={() => onModeChange('basic')}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
          mode === 'basic'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <span className="flex items-center gap-2">
          <span>📊</span>
          <span>Basic (Free)</span>
        </span>
      </button>

      {/* Enhanced Toggle */}
      <button
        onClick={() => onModeChange('enhanced')}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
          mode === 'enhanced'
            ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        disabled={!isPremium}
      >
        <span className="flex items-center gap-2">
          <span>✨</span>
          <span>Enhanced (Premium)</span>
          {!isPremium && (
            <span className="ml-1 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">
              🔒
            </span>
          )}
        </span>
      </button>
    </div>
  );
};

export default ModuleToggle;
