/**
 * Folder View Component
 * Hierarchical folder navigation with predefined deal-type category folders.
 * Bloomberg dark terminal styling.
 */

import React from 'react';
import { DealFile } from '../DocumentsFilesSection';
import { formatFileSize, getFileIcon, formatDate } from './utils';

const BG_PANEL   = '#0F1319';
const BG_CARD    = '#131821';
const BG_HOVER   = '#1E2538';
const BORDER     = '#1E2538';
const BORDER_MED = '#2A3348';
const TEXT_PRI   = '#E8ECF1';
const TEXT_SEC   = '#8B95A5';
const TEXT_MUTED = '#4A5568';
const CYAN       = '#00BCD4';
const GREEN      = '#00D26A';
const MONO       = "'JetBrains Mono','Fira Code','SF Mono',monospace";

interface FolderViewProps {
  files: DealFile[];
  currentFolder: string;
  onFolderChange: (path: string) => void;
  onDelete: (fileId: string) => void;
  onDownload: (file: DealFile) => void;
  onUpdate: (fileId: string, updates: Partial<DealFile>) => void;
  isPipeline: boolean;
  predefinedFolders?: string[];
}

function formatCategoryLabel(slug: string): string {
  const labels: Record<string, string> = {
    offering_memo:        'Offering Memo',
    rent_roll:            'Rent Roll',
    t12:                  'T-12 P&L',
    inspection:           'Inspection',
    appraisal:            'Appraisal',
    title:                'Title',
    survey:               'Survey',
    insurance:            'Insurance',
    loan_docs:            'Loan Docs',
    site_plans:           'Site Plans',
    architectural:        'Architectural',
    engineering:          'Engineering',
    permits:              'Permits',
    cost_estimates:       'Cost Estimates',
    environmental:        'Environmental',
    geotech:              'Geotech',
    traffic_study:        'Traffic Study',
    structural_assessment:'Structural Assessment',
    hazmat:               'Hazmat',
  };
  return labels[slug] || slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export const FolderView: React.FC<FolderViewProps> = ({
  files,
  currentFolder,
  onFolderChange,
  onDelete,
  onDownload,
  predefinedFolders = [],
}) => {
  const isRoot = currentFolder === '/';

  const categoryFromPath = (path: string): string =>
    path.startsWith('/') ? path.slice(1) : path;

  const currentCategory = isRoot ? null : categoryFromPath(currentFolder);

  const isPredefinedCategory = currentCategory !== null &&
    predefinedFolders.includes(currentCategory);

  const currentFiles: DealFile[] = isRoot
    ? []
    : isPredefinedCategory
      ? files.filter(f => f.category === currentCategory)
      : files.filter(f => f.folder_path === currentFolder);

  const dynamicFolders: string[] = isRoot
    ? Array.from(
        new Set(
          files
            .filter(f => f.folder_path.startsWith('/') && f.folder_path !== '/')
            .map(f => {
              const rel = f.folder_path.slice(1).split('/')[0];
              return rel;
            })
            .filter(Boolean)
            .filter(f => !predefinedFolders.includes(f))
        )
      )
    : [];

  const pathParts = currentFolder.split('/').filter(Boolean);
  const breadcrumbs = ['Home', ...pathParts];

  const handleBreadcrumbClick = (index: number) => {
    if (index === 0) {
      onFolderChange('/');
    } else {
      onFolderChange('/' + pathParts.slice(0, index).join('/'));
    }
  };

  return (
    <div style={{ fontFamily: MONO, color: TEXT_PRI }}>

      {/* Breadcrumb */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        background: BG_CARD,
        borderBottom: `1px solid ${BORDER}`,
        marginBottom: 16,
        fontSize: 11,
        letterSpacing: '0.04em',
      }}>
        {breadcrumbs.map((part, index) => (
          <React.Fragment key={index}>
            <button
              onClick={() => handleBreadcrumbClick(index)}
              style={{
                background: 'none',
                border: 'none',
                cursor: index === breadcrumbs.length - 1 ? 'default' : 'pointer',
                color: index === breadcrumbs.length - 1 ? TEXT_PRI : CYAN,
                fontFamily: MONO,
                fontSize: 11,
                padding: '2px 4px',
                textDecoration: 'none',
              }}
            >
              {index === 0 ? 'ROOT' : part.toUpperCase()}
            </button>
            {index < breadcrumbs.length - 1 && (
              <span style={{ color: TEXT_MUTED }}>›</span>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Root: Predefined category folders */}
      {isRoot && predefinedFolders.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 9,
            color: TEXT_MUTED,
            letterSpacing: '0.12em',
            fontWeight: 700,
            marginBottom: 10,
            paddingLeft: 2,
          }}>
            DOCUMENT CATEGORIES
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 8,
          }}>
            {predefinedFolders.map(folder => {
              const count = files.filter(f => f.category === folder).length;
              return (
                <div
                  key={folder}
                  onClick={() => onFolderChange('/' + folder)}
                  style={{
                    padding: '12px 14px',
                    background: BG_CARD,
                    border: `1px solid ${count > 0 ? BORDER_MED : BORDER}`,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = BG_HOVER;
                    (e.currentTarget as HTMLElement).style.borderColor = CYAN;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = BG_CARD;
                    (e.currentTarget as HTMLElement).style.borderColor = count > 0 ? BORDER_MED : BORDER;
                  }}
                >
                  <div style={{ fontSize: 18, marginBottom: 6, color: count > 0 ? CYAN : TEXT_MUTED }}>
                    {count > 0 ? '▤' : '▱'}
                  </div>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: count > 0 ? TEXT_PRI : TEXT_SEC,
                    marginBottom: 3,
                    letterSpacing: '0.02em',
                  }}>
                    {formatCategoryLabel(folder)}
                  </div>
                  <div style={{ fontSize: 9, color: count > 0 ? GREEN : TEXT_MUTED, letterSpacing: '0.06em' }}>
                    {count} FILE{count === 1 ? '' : 'S'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Root: Dynamic folders (from actual folder_path, not in predefined) */}
      {isRoot && dynamicFolders.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 9,
            color: TEXT_MUTED,
            letterSpacing: '0.12em',
            fontWeight: 700,
            marginBottom: 10,
            paddingLeft: 2,
          }}>
            OTHER FOLDERS
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 8,
          }}>
            {dynamicFolders.map(folder => {
              const count = files.filter(f => f.folder_path.startsWith('/' + folder)).length;
              return (
                <div
                  key={folder}
                  onClick={() => onFolderChange('/' + folder)}
                  style={{
                    padding: '12px 14px',
                    background: BG_CARD,
                    border: `1px solid ${BORDER}`,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = BG_HOVER;
                    (e.currentTarget as HTMLElement).style.borderColor = CYAN;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = BG_CARD;
                    (e.currentTarget as HTMLElement).style.borderColor = BORDER;
                  }}
                >
                  <div style={{ fontSize: 18, marginBottom: 6, color: TEXT_MUTED }}>▤</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: TEXT_SEC, marginBottom: 3 }}>
                    {folder}
                  </div>
                  <div style={{ fontSize: 9, color: TEXT_MUTED, letterSpacing: '0.06em' }}>
                    {count} FILE{count === 1 ? '' : 'S'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Root: truly empty (no predefined, no dynamic) */}
      {isRoot && predefinedFolders.length === 0 && dynamicFolders.length === 0 && (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 32, color: TEXT_MUTED, marginBottom: 12 }}>▱</div>
          <p style={{ fontSize: 11, color: TEXT_MUTED, margin: 0 }}>No folders or files yet</p>
        </div>
      )}

      {/* Category folder contents */}
      {!isRoot && (
        <>
          {currentFiles.length > 0 ? (
            <div>
              <div style={{
                fontSize: 9,
                color: TEXT_MUTED,
                letterSpacing: '0.12em',
                fontWeight: 700,
                marginBottom: 10,
                paddingLeft: 2,
              }}>
                {currentFiles.length} FILE{currentFiles.length === 1 ? '' : 'S'}
              </div>
              {currentFiles.map(file => (
                <div
                  key={file.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    background: BG_CARD,
                    border: `1px solid ${BORDER}`,
                    marginBottom: 4,
                    fontSize: 11,
                  }}
                >
                  <div style={{ fontSize: 20, flexShrink: 0, color: TEXT_SEC }}>
                    {getFileIcon(file.file_extension)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      color: TEXT_PRI,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {file.original_filename}
                    </div>
                    <div style={{ fontSize: 9, color: TEXT_MUTED, marginTop: 2, letterSpacing: '0.04em' }}>
                      {formatFileSize(file.file_size)} · {formatDate(file.created_at)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => onDownload(file)}
                      style={{
                        background: BG_HOVER,
                        border: `1px solid ${BORDER}`,
                        color: CYAN,
                        cursor: 'pointer',
                        padding: '4px 10px',
                        fontSize: 10,
                        fontFamily: MONO,
                        letterSpacing: '0.06em',
                      }}
                    >
                      DL
                    </button>
                    <button
                      onClick={() => onDelete(file.id)}
                      style={{
                        background: BG_HOVER,
                        border: `1px solid ${BORDER}`,
                        color: '#FF4757',
                        cursor: 'pointer',
                        padding: '4px 10px',
                        fontSize: 10,
                        fontFamily: MONO,
                        letterSpacing: '0.06em',
                      }}
                    >
                      DEL
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              padding: '36px 0',
              textAlign: 'center',
              background: BG_CARD,
              border: `1px solid ${BORDER}`,
            }}>
              <div style={{ fontSize: 28, color: TEXT_MUTED, marginBottom: 10 }}>▱</div>
              <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '0 0 4px 0' }}>
                {currentCategory ? formatCategoryLabel(currentCategory) : 'This folder'} is empty
              </p>
              <p style={{ fontSize: 9, color: TEXT_MUTED, margin: 0, letterSpacing: '0.06em' }}>
                UPLOAD FILES TO POPULATE THIS CATEGORY
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
