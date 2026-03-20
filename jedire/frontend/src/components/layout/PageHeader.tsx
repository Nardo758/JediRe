import React from 'react';
import { Link } from 'react-router-dom';
import { useArchitecture } from '../../contexts/ArchitectureContext';
import { ArchitectureInfo } from '../ArchitectureOverlay';

interface PageHeaderProps {
  title: string;
  description: string;
  icon?: string;
  actions?: React.ReactNode;
  architectureDiagram?: string; // Link to relevant architecture diagram
  documentation?: string; // Link to relevant docs
  architectureInfo?: ArchitectureInfo; // Architecture metadata for this page
}

export function PageHeader({
  title,
  description,
  icon,
  actions,
  architectureDiagram,
  documentation,
  architectureInfo
}: PageHeaderProps) {
  const { openArchitecture } = useArchitecture();

  const handleArchitectureClick = () => {
    if (architectureInfo) {
      openArchitecture(architectureInfo);
    }
  };

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {icon && <span className="text-3xl">{icon}</span>}
            <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          </div>
          <p className="text-gray-600">{description}</p>
          
          {/* Quick Links */}
          {(architectureDiagram || documentation) && (
            <div className="flex gap-3 mt-3">
              {architectureDiagram && (
                <Link
                  to={`/architecture?diagram=${architectureDiagram}`}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <span>🏗️</span>
                  <span>View Architecture</span>
                </Link>
              )}
              {documentation && (
                <a
                  href={documentation}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
                >
                  <span>📖</span>
                  <span>Documentation</span>
                </a>
              )}
            </div>
          )}
        </div>
        
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
    </div>
  );
}
