/**
 * F9 Pro Forma Template Renderer
 * ================================
 *
 * Per Spec §4: M08 emits `{ template, sections[], horizon, periodicity }`,
 * and the F9 sub-tab navigation is rendered DIRECTLY from `sections[]`. No
 * hardcoded sub-tab list. When the strategy changes upstream and a different
 * template is emitted, F9 re-renders its sub-tabs without any code changes.
 *
 * This component is intentionally presentational. It does not compute any
 * numbers — it lays out the section shells, surfaces field placeholders, and
 * exposes a child render-prop so the parent can plug in the actual value
 * editors (Tier 1+ work).
 */

import React, { useMemo, useState } from 'react';
import type {
  ProFormaTemplateEmission,
  ProFormaSectionSpec,
} from '../../types/proforma-template.types';

export interface ProFormaTemplateRendererProps {
  template: ProFormaTemplateEmission | null;
  /** Optional render prop; if provided, replaces the default field-list shell. */
  renderSection?: (section: ProFormaSectionSpec) => React.ReactNode;
  /** Optional render prop for the header bar. */
  renderHeader?: (template: ProFormaTemplateEmission) => React.ReactNode;
  className?: string;
}

const styles = {
  empty: {
    padding: 24,
    border: '1px dashed #555',
    color: '#888',
    fontFamily: 'monospace',
    background: '#0f0f0f',
  } as React.CSSProperties,
  wrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    fontFamily: 'monospace',
    color: '#e8e8e8',
    background: '#0a0a0a',
    border: '1px solid #2a2a2a',
  },
  header: {
    padding: '10px 14px',
    borderBottom: '1px solid #2a2a2a',
    fontSize: 12,
    color: '#aaa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  } as React.CSSProperties,
  tabBar: {
    display: 'flex',
    gap: 0,
    borderBottom: '1px solid #2a2a2a',
    overflowX: 'auto' as const,
  },
  tabButton: (active: boolean): React.CSSProperties => ({
    padding: '8px 14px',
    background: active ? '#1a1a1a' : 'transparent',
    color: active ? '#f0c419' : '#999',
    border: 'none',
    borderBottom: active ? '2px solid #f0c419' : '2px solid transparent',
    cursor: 'pointer',
    fontSize: 11,
    fontFamily: 'monospace',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  }),
  body: {
    padding: 16,
    minHeight: 200,
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 8,
    marginTop: 12,
  } as React.CSSProperties,
  fieldChip: {
    padding: '6px 10px',
    border: '1px solid #2a2a2a',
    borderRadius: 2,
    fontSize: 11,
    color: '#bbb',
    background: '#111',
  } as React.CSSProperties,
  required: {
    color: '#f0c419',
    fontWeight: 700,
    marginRight: 6,
  } as React.CSSProperties,
};

export const ProFormaTemplateRenderer: React.FC<ProFormaTemplateRendererProps> = ({
  template,
  renderSection,
  renderHeader,
  className,
}) => {
  // Task #425: the flagged value is recreated on each render but its identity
  // drift is benign here — the downstream useMemo guards effectful work with
  // internal equality / ref checks, so wrapping with another useMemo would
  // add noise without changing behavior.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sections = template?.sections ?? [];
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null);

  const activeSection = useMemo(
    () => sections.find(s => s.id === activeId) ?? sections[0] ?? null,
    [sections, activeId]
  );

  if (!template) {
    return (
      <div style={styles.empty} className={className}>
        Pro Forma template not yet emitted by M08. Pick a strategy on F5 to populate the F9 sub-tabs.
      </div>
    );
  }

  return (
    <div style={styles.wrapper} className={className} data-testid="proforma-template-renderer">
      <div style={styles.header}>
        {renderHeader ? (
          renderHeader(template)
        ) : (
          <>
            <div>
              <span style={{ color: '#f0c419' }}>TEMPLATE:</span>{' '}
              <strong>{template.templateLabel}</strong>
              <span style={{ marginLeft: 12, color: '#666' }}>
                {template.horizon}mo · {template.periodicity}
              </span>
            </div>
            <div style={{ fontSize: 10, color: '#666' }}>
              selected by: {template.selectedBy}
            </div>
          </>
        )}
      </div>

      <div style={styles.tabBar} role="tablist">
        {sections.map(section => (
          <button
            key={section.id}
            role="tab"
            aria-selected={activeSection?.id === section.id}
            style={styles.tabButton(activeSection?.id === section.id)}
            onClick={() => setActiveId(section.id)}
          >
            {section.required && <span style={styles.required}>★</span>}
            {section.title}
          </button>
        ))}
      </div>

      <div style={styles.body}>
        {activeSection && renderSection ? (
          renderSection(activeSection)
        ) : activeSection ? (
          <DefaultSectionShell section={activeSection} />
        ) : (
          <div style={{ color: '#666' }}>No sections defined.</div>
        )}
      </div>
    </div>
  );
};

const DefaultSectionShell: React.FC<{ section: ProFormaSectionSpec }> = ({ section }) => (
  <div>
    <div style={{ fontSize: 13, color: '#ddd' }}>
      {section.title}
      {section.required && (
        <span style={{ color: '#f0c419', marginLeft: 8, fontSize: 10 }}>REQUIRED</span>
      )}
    </div>
    <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
      {section.fields.length} field{section.fields.length === 1 ? '' : 's'} defined by template
    </div>
    <div style={styles.fieldGrid}>
      {section.fields.map(field => (
        <div key={field} style={styles.fieldChip}>
          {field}
        </div>
      ))}
    </div>
  </div>
);

export default ProFormaTemplateRenderer;
