/**
 * Missing File Suggestions Component
 * Context-aware suggestions for files that should be uploaded
 */

import React from 'react';

interface MissingFileSuggestionsProps {
  suggestions: string[];
  onUploadClick: () => void;
}

export const MissingFileSuggestions: React.FC<MissingFileSuggestionsProps> = ({
  suggestions,
  onUploadClick,
}) => {
  if (suggestions.length === 0) return null;

  return (
    <div className="missing-suggestions">
      <div className="suggestion-header">
        <div className="header-icon">💡</div>
        <div className="header-text">
          <h4>Suggested Documents</h4>
          <p>Consider uploading these files for a complete record:</p>
        </div>
      </div>

      <div className="suggestions-list">
        {suggestions.map((suggestion, idx) => (
          <div key={idx} className="suggestion-item">
            <span className="suggestion-icon">📄</span>
            <span className="suggestion-name">{suggestion}</span>
            <button className="upload-btn" onClick={onUploadClick}>
              + Upload
            </button>
          </div>
        ))}
      </div>

      <style jsx>{`
        .missing-suggestions {
          padding: 20px;
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border-radius: 12px;
          margin: 20px 0;
          border: 2px dashed #f59e0b;
        }

        .suggestion-header {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
          align-items: flex-start;
        }

        .header-icon {
          font-size: 32px;
        }

        .header-text h4 {
          margin: 0 0 4px 0;
          font-size: 16px;
          color: #92400e;
        }

        .header-text p {
          margin: 0;
          font-size: 14px;
          color: #78350f;
        }

        .suggestions-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 12px;
        }

        .suggestion-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.9);
          border-radius: 8px;
          transition: all 0.2s;
        }

        .suggestion-item:hover {
          background: white;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
        }

        .suggestion-icon {
          font-size: 20px;
        }

        .suggestion-name {
          flex: 1;
          font-weight: 500;
          color: #78350f;
        }

        .upload-btn {
          padding: 6px 12px;
          background: #f59e0b;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .upload-btn:hover {
          background: #d97706;
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
};
