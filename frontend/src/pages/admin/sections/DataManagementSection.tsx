/**
 * Data Management Section
 * Import/export, bulk operations, and data retention
 */

import React, { useState } from 'react';
import { ContextIndicator } from '../../../components/intelligence/ContextIndicator';
import { useAutoContextAnalysis } from '../../../hooks/useContextAwareness';

const BT = {
  bg: { terminal: '#0A0E17', panel: '#0F1319', header: '#1A1F2E', hover: '#1E2538' },
  text: { primary: '#E8ECF1', secondary: '#8B95A5', muted: '#4A5568', amber: '#F5A623', green: '#00D26A', red: '#FF4757', cyan: '#00BCD4' },
  border: { subtle: '#1E2538', medium: '#2A3348' },
};
const MONO = "'JetBrains Mono', monospace";

interface ImportJob {
  id: string;
  filename: string;
  type: 'deals' | 'contacts' | 'documents';
  status: 'completed' | 'processing' | 'failed';
  records: number;
  date: string;
}

const MOCK_IMPORTS: ImportJob[] = [
  { id: '1', filename: 'pipeline_deals_mar2024.csv', type: 'deals', status: 'completed', records: 24, date: '2024-03-25' },
  { id: '2', filename: 'broker_contacts.xlsx', type: 'contacts', status: 'completed', records: 156, date: '2024-03-20' },
  { id: '3', filename: 'q1_deals_backup.csv', type: 'deals', status: 'failed', records: 0, date: '2024-03-18' },
];

export default function DataManagementSection() {
  // Neural network context awareness
  const { analysis: ctxAnalysis, loading: ctxLoading } = useAutoContextAnalysis({ context: 'market_dashboard' });

  const [activeTab, setActiveTab] = useState<'import' | 'export' | 'bulk' | 'retention'>('import');
  const [imports, setImports] = useState<ImportJob[]>(MOCK_IMPORTS);

  const tabs = [
    { id: 'import', label: 'Import Data', icon: '📥' },
    { id: 'export', label: 'Export & Archive', icon: '📤' },
    { id: 'bulk', label: 'Bulk Operations', icon: '⚡' },
    { id: 'retention', label: 'Data Retention', icon: '🗄️' },
  ];

  return (
    <div style={{ padding: 24 }}>
      {ctxAnalysis && <ContextIndicator analysis={ctxAnalysis} loading={ctxLoading} compact />}
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: BT.text.amber, fontFamily: MONO, marginBottom: 8 }}>
          DATA MANAGEMENT
        </h1>
        <p style={{ fontSize: 12, color: BT.text.secondary, fontFamily: MONO }}>
          Import, export, and manage your deal data
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: `1px solid ${BT.border.subtle}` }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '12px 20px',
              background: activeTab === tab.id ? BT.bg.panel : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? `2px solid ${BT.text.amber}` : '2px solid transparent',
              color: activeTab === tab.id ? BT.text.amber : BT.text.secondary,
              fontFamily: MONO,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div>
          {/* Upload Area */}
          <div style={{
            border: `2px dashed ${BT.border.medium}`,
            borderRadius: 8,
            padding: 40,
            textAlign: 'center',
            marginBottom: 24,
            background: BT.bg.panel,
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📁</div>
            <div style={{ fontSize: 14, color: BT.text.primary, fontFamily: MONO, marginBottom: 8 }}>
              Drag & drop files here
            </div>
            <div style={{ fontSize: 11, color: BT.text.muted, fontFamily: MONO, marginBottom: 16 }}>
              Supports CSV, Excel (.xlsx), and JSON formats
            </div>
            <button style={{
              padding: '10px 24px',
              background: BT.text.cyan,
              color: BT.bg.terminal,
              border: 'none',
              borderRadius: 4,
              fontFamily: MONO,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}>
              Browse Files
            </button>
          </div>

          {/* Import Templates */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 12, color: BT.text.amber, fontFamily: MONO, marginBottom: 16, textTransform: 'uppercase' }}>
              Import Templates
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { type: 'Deals', desc: 'Import deal pipeline from CSV/Excel', icon: '🏢' },
                { type: 'Contacts', desc: 'Import contacts and stakeholders', icon: '👥' },
                { type: 'Properties', desc: 'Bulk import property data', icon: '📍' },
              ].map(template => (
                <div
                  key={template.type}
                  style={{
                    padding: 16,
                    background: BT.bg.panel,
                    border: `1px solid ${BT.border.subtle}`,
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{template.icon}</div>
                  <div style={{ fontSize: 12, color: BT.text.primary, fontFamily: MONO, fontWeight: 600, marginBottom: 4 }}>
                    {template.type}
                  </div>
                  <div style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, marginBottom: 12 }}>
                    {template.desc}
                  </div>
                  <button style={{
                    padding: '6px 12px',
                    background: BT.bg.header,
                    color: BT.text.cyan,
                    border: 'none',
                    borderRadius: 4,
                    fontFamily: MONO,
                    fontSize: 9,
                    cursor: 'pointer',
                  }}>
                    Download Template
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Imports */}
          <div>
            <h3 style={{ fontSize: 12, color: BT.text.amber, fontFamily: MONO, marginBottom: 16, textTransform: 'uppercase' }}>
              Recent Imports
            </h3>
            <div style={{
              background: BT.bg.panel,
              border: `1px solid ${BT.border.subtle}`,
              borderRadius: 6,
              overflow: 'hidden',
            }}>
              {imports.map(job => (
                <div
                  key={job.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 16px',
                    borderBottom: `1px solid ${BT.border.subtle}`,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, color: BT.text.primary, fontFamily: MONO }}>
                      {job.filename}
                    </div>
                    <div style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, marginTop: 2 }}>
                      {job.type} • {job.date}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontSize: 11, color: BT.text.secondary, fontFamily: MONO }}>
                      {job.records} records
                    </span>
                    <span style={{
                      padding: '4px 10px',
                      background: job.status === 'completed' ? BT.text.green + '22' : 
                                 job.status === 'failed' ? BT.text.red + '22' : BT.text.amber + '22',
                      color: job.status === 'completed' ? BT.text.green : 
                             job.status === 'failed' ? BT.text.red : BT.text.amber,
                      fontSize: 9,
                      fontFamily: MONO,
                      borderRadius: 3,
                      textTransform: 'uppercase',
                    }}>
                      {job.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {/* Export Options */}
            <div style={{
              background: BT.bg.panel,
              border: `1px solid ${BT.border.subtle}`,
              borderRadius: 6,
              padding: 24,
            }}>
              <h3 style={{ fontSize: 12, color: BT.text.amber, fontFamily: MONO, marginBottom: 16, textTransform: 'uppercase' }}>
                Export Data
              </h3>
              
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, display: 'block', marginBottom: 8 }}>
                  DATA TYPE
                </label>
                <select style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: BT.bg.header,
                  border: `1px solid ${BT.border.medium}`,
                  borderRadius: 4,
                  color: BT.text.primary,
                  fontFamily: MONO,
                  fontSize: 12,
                }}>
                  <option>All Deals</option>
                  <option>Active Deals Only</option>
                  <option>Closed Deals</option>
                  <option>Contacts</option>
                  <option>Documents Metadata</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, display: 'block', marginBottom: 8 }}>
                  FORMAT
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['CSV', 'Excel', 'JSON'].map(format => (
                    <button
                      key={format}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        background: format === 'CSV' ? BT.text.cyan : BT.bg.header,
                        color: format === 'CSV' ? BT.bg.terminal : BT.text.secondary,
                        border: `1px solid ${format === 'CSV' ? BT.text.cyan : BT.border.medium}`,
                        borderRadius: 4,
                        fontFamily: MONO,
                        fontSize: 10,
                        cursor: 'pointer',
                      }}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </div>

              <button style={{
                width: '100%',
                padding: '12px',
                background: BT.text.cyan,
                color: BT.bg.terminal,
                border: 'none',
                borderRadius: 4,
                fontFamily: MONO,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}>
                📤 Export Data
              </button>
            </div>

            {/* Archive Options */}
            <div style={{
              background: BT.bg.panel,
              border: `1px solid ${BT.border.subtle}`,
              borderRadius: 6,
              padding: 24,
            }}>
              <h3 style={{ fontSize: 12, color: BT.text.amber, fontFamily: MONO, marginBottom: 16, textTransform: 'uppercase' }}>
                Archive & Backup
              </h3>
              
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: BT.text.primary, fontFamily: MONO, marginBottom: 8 }}>
                  Full Account Backup
                </div>
                <div style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, marginBottom: 12 }}>
                  Download complete backup of all deals, documents, and settings
                </div>
                <button style={{
                  padding: '10px 16px',
                  background: BT.bg.header,
                  color: BT.text.primary,
                  border: `1px solid ${BT.border.medium}`,
                  borderRadius: 4,
                  fontFamily: MONO,
                  fontSize: 10,
                  cursor: 'pointer',
                }}>
                  Create Backup
                </button>
              </div>

              <div style={{ borderTop: `1px solid ${BT.border.subtle}`, paddingTop: 16, marginTop: 16 }}>
                <div style={{ fontSize: 12, color: BT.text.primary, fontFamily: MONO, marginBottom: 8 }}>
                  Scheduled Backups
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" id="autoBackup" />
                  <label htmlFor="autoBackup" style={{ fontSize: 11, color: BT.text.secondary, fontFamily: MONO }}>
                    Weekly automatic backup (Sundays 2 AM)
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Operations Tab */}
      {activeTab === 'bulk' && (
        <div style={{
          background: BT.bg.panel,
          border: `1px solid ${BT.border.subtle}`,
          borderRadius: 6,
          padding: 32,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚡</div>
          <h3 style={{ fontSize: 14, color: BT.text.primary, fontFamily: MONO, marginBottom: 8 }}>
            Bulk Operations
          </h3>
          <p style={{ fontSize: 12, color: BT.text.secondary, fontFamily: MONO, maxWidth: 400, margin: '0 auto 24px' }}>
            Perform actions across multiple deals, contacts, or documents at once.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 500, margin: '0 auto' }}>
            {[
              { label: 'Bulk Update Stage', icon: '📊' },
              { label: 'Bulk Assign Owner', icon: '👤' },
              { label: 'Bulk Add Tags', icon: '🏷️' },
              { label: 'Bulk Archive', icon: '📦' },
              { label: 'Bulk Delete', icon: '🗑️' },
              { label: 'Bulk Export', icon: '📤' },
            ].map(op => (
              <button
                key={op.label}
                style={{
                  padding: 16,
                  background: BT.bg.header,
                  border: `1px solid ${BT.border.medium}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 20, marginBottom: 8 }}>{op.icon}</div>
                <div style={{ fontSize: 10, color: BT.text.secondary, fontFamily: MONO }}>
                  {op.label}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Retention Tab */}
      {activeTab === 'retention' && (
        <div>
          <div style={{
            background: BT.bg.panel,
            border: `1px solid ${BT.border.subtle}`,
            borderRadius: 6,
            padding: 24,
            marginBottom: 24,
          }}>
            <h3 style={{ fontSize: 12, color: BT.text.amber, fontFamily: MONO, marginBottom: 16, textTransform: 'uppercase' }}>
              Data Retention Settings
            </h3>
            
            {[
              { label: 'Closed Deals', desc: 'How long to keep closed deal data', value: '7 years' },
              { label: 'Activity Logs', desc: 'User activity and audit trails', value: '2 years' },
              { label: 'Email Sync', desc: 'Synced email messages', value: '1 year' },
              { label: 'Document Versions', desc: 'Previous versions of documents', value: '90 days' },
            ].map(setting => (
              <div
                key={setting.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 0',
                  borderBottom: `1px solid ${BT.border.subtle}`,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: BT.text.primary, fontFamily: MONO }}>
                    {setting.label}
                  </div>
                  <div style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, marginTop: 2 }}>
                    {setting.desc}
                  </div>
                </div>
                <select style={{
                  padding: '8px 12px',
                  background: BT.bg.header,
                  border: `1px solid ${BT.border.medium}`,
                  borderRadius: 4,
                  color: BT.text.primary,
                  fontFamily: MONO,
                  fontSize: 11,
                }}>
                  <option>{setting.value}</option>
                  <option>Forever</option>
                  <option>5 years</option>
                  <option>2 years</option>
                  <option>1 year</option>
                  <option>6 months</option>
                  <option>90 days</option>
                </select>
              </div>
            ))}
          </div>

          <div style={{
            background: BT.text.red + '11',
            border: `1px solid ${BT.text.red}44`,
            borderRadius: 6,
            padding: 20,
          }}>
            <h4 style={{ fontSize: 12, color: BT.text.red, fontFamily: MONO, marginBottom: 8 }}>
              ⚠️ Danger Zone
            </h4>
            <p style={{ fontSize: 11, color: BT.text.secondary, fontFamily: MONO, marginBottom: 16 }}>
              Permanently delete all data. This action cannot be undone.
            </p>
            <button style={{
              padding: '10px 20px',
              background: 'transparent',
              color: BT.text.red,
              border: `1px solid ${BT.text.red}`,
              borderRadius: 4,
              fontFamily: MONO,
              fontSize: 10,
              cursor: 'pointer',
              fontWeight: 600,
            }}>
              Delete All Data
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
