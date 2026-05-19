/**
 * SourceDocPill — extraction provenance badge for F9 ProForma rows.
 *
 * Renders a small coloured pill (T-12 / Rent Roll / OM / Tax Bill) next to
 * the SourceBadge in the source column when a row's value was backed by an
 * extracted document.  Click opens an inline popover showing document
 * provenance: filename, extracted_at, key_fields, and rows_inserted.
 *
 * Graceful degradation: renders nothing when `doc` is null/undefined.
 */

import React, { useState, useRef, useEffect } from 'react';
import type { SourceDocument } from '../../hooks/useSourceDocuments';

const MONO = "'JetBrains Mono','Roboto Mono','Consolas','monospace'";

// ─── Display helpers (mirrors ReconciliationChip pattern) ─────────────────────

const DOC_LABEL: Record<string, string> = {
  t12:              'T-12',
  rent_roll:        'Rent Roll',
  om:               'OM',
  tax_bill:         'Tax Bill',
  operating_statement: 'Op. Stmt',
  lease:            'Lease',
  appraisal:        'Appraisal',
};

const DOC_COLOR: Record<string, string> = {
  t12:              '#34d399',
  rent_roll:        '#06b6d4',
  om:               '#f59e0b',
  tax_bill:         '#60a5fa',
  operating_statement: '#34d399',
  lease:            '#a78bfa',
  appraisal:        '#f472b6',
};

function docLabel(type: string): string {
  return DOC_LABEL[type] ?? type.replace(/_/g, ' ').toUpperCase();
}

function docColor(type: string): string {
  return DOC_COLOR[type] ?? '#6b7a8d';
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ─── Popover ──────────────────────────────────────────────────────────────────

function Popover({
  doc,
  color,
  onClose,
}: {
  doc: SourceDocument;
  color: string;
  onClose: () => void;
}) {
  const truncate = (s: string, n = 38) =>
    s.length > n ? `${s.slice(0, n)}…` : s;

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 9999,
        top: '100%',
        left: 0,
        marginTop: 4,
        width: 270,
        background: '#07101a',
        border: `1px solid ${color}44`,
        borderTop: `2px solid ${color}`,
        borderRadius: 4,
        boxShadow: '0 4px 20px rgba(0,0,0,0.75)',
        fontFamily: MONO,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '5px 10px',
          background: `${color}12`,
          borderBottom: `1px solid ${color}33`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontSize: 8,
            fontWeight: 700,
            color,
            letterSpacing: '0.08em',
          }}
        >
          SOURCE · {docLabel(doc.document_type).toUpperCase()}
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#475569',
            fontSize: 12,
            padding: 0,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div
        style={{
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
        }}
      >
        {/* Filename */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          <span style={{ fontSize: 7, color: '#475569', letterSpacing: '0.06em' }}>
            FILE
          </span>
          <span
            style={{ fontSize: 8.5, color: '#e2e8f0', fontWeight: 600 }}
            title={doc.filename}
          >
            {truncate(doc.filename)}
          </span>
        </div>

        {/* Extracted at */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid #0e2235',
            paddingTop: 4,
          }}
        >
          <span style={{ fontSize: 7, color: '#475569', letterSpacing: '0.06em' }}>
            EXTRACTED
          </span>
          <span style={{ fontSize: 8, color: '#94a3b8' }}>
            {fmtDate(doc.extracted_at)}
          </span>
        </div>

        {/* Key fields */}
        {doc.key_fields && doc.key_fields.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              borderTop: '1px solid #0e2235',
              paddingTop: 4,
            }}
          >
            <span
              style={{ fontSize: 7, color: '#475569', letterSpacing: '0.06em' }}
            >
              FIELDS EXTRACTED
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {doc.key_fields.slice(0, 12).map(f => (
                <span
                  key={f}
                  style={{
                    fontSize: 6.5,
                    color,
                    background: `${color}14`,
                    border: `1px solid ${color}33`,
                    borderRadius: 2,
                    padding: '0 4px',
                    lineHeight: '14px',
                    letterSpacing: '0.04em',
                  }}
                >
                  {f.replace(/_/g, ' ')}
                </span>
              ))}
              {doc.key_fields.length > 12 && (
                <span
                  style={{
                    fontSize: 6.5,
                    color: '#475569',
                    lineHeight: '14px',
                  }}
                >
                  +{doc.key_fields.length - 12} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Rows inserted */}
        {doc.rows_inserted != null && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid #0e2235',
              paddingTop: 4,
            }}
          >
            <span
              style={{ fontSize: 7, color: '#475569', letterSpacing: '0.06em' }}
            >
              ROWS LOADED
            </span>
            <span
              style={{ fontSize: 8, color: '#94a3b8', fontWeight: 600 }}
            >
              {doc.rows_inserted.toLocaleString()}
            </span>
          </div>
        )}

        {/* Footer hint */}
        <div
          style={{
            fontSize: 7,
            color: '#334155',
            fontStyle: 'italic',
            borderTop: '1px solid #0e2235',
            paddingTop: 4,
          }}
        >
          Extraction-backed value · {docLabel(doc.document_type)}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface SourceDocPillProps {
  doc: SourceDocument | null | undefined;
}

export function SourceDocPill({ doc }: SourceDocPillProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!doc) return null;

  const color = docColor(doc.document_type);
  const label = docLabel(doc.document_type);

  return (
    <span
      ref={wrapRef}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
    >
      <button
        onClick={e => {
          e.stopPropagation();
          setOpen(v => !v);
        }}
        title={`Extracted from ${label} · Click for provenance`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 2,
          background: open ? `${color}22` : `${color}14`,
          border: `1px solid ${open ? color : `${color}55`}`,
          borderRadius: 2,
          padding: '0px 4px',
          cursor: 'pointer',
          marginLeft: 3,
          transition: 'background 0.1s, border-color 0.1s',
          whiteSpace: 'nowrap',
          lineHeight: '13px',
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: 7,
            fontWeight: 700,
            color,
            letterSpacing: '0.04em',
          }}
        >
          {label}
        </span>
      </button>

      {open && (
        <Popover doc={doc} color={color} onClose={() => setOpen(false)} />
      )}
    </span>
  );
}
