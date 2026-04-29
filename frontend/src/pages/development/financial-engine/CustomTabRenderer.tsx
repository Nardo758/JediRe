/**
 * Custom Tab Renderer (Task #451)
 * ===============================
 *
 * Renders an Opus-generated custom tab payload using the declarative block
 * grammar defined by the backend custom-tab schema. Field references resolve
 * through ProvenancedValue surfaces (assumptions / results / f9 / deal /
 * projections). Every value gets a provenance badge sourced from
 * `evidenceFieldMap` when available so users can see source / confidence.
 *
 * Read-only by design — no controls that mutate assumptions ever.
 */

import React, { useMemo } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import type {
  CustomTabBlock,
  CustomTabFormat,
  CustomTabPayload,
} from '../../../services/opusProforma.service';
import type { F9DealFinancials, EvidenceFieldMeta, ModelAssumptions, ModelResults } from './types';
import { fmt$, fmtPct, fmtX } from './types';

const MONO = BT.font.mono;

interface CustomTabRendererProps {
  payload: CustomTabPayload;
  modelVersion?: string | null;
  description?: string | null;
  /** Read-only data surfaces the block refs resolve against. */
  data: {
    assumptions?: ModelAssumptions | null;
    results?: ModelResults | null;
    f9?: F9DealFinancials | null;
    deal?: Record<string, any> | null | undefined;
    projections?: Array<Record<string, any>> | null;
  };
  /** Evidence map keyed by field path → provenance metadata. */
  evidenceFieldMap?: Record<string, EvidenceFieldMeta>;
}

export const CustomTabRenderer: React.FC<CustomTabRendererProps> = ({
  payload,
  modelVersion,
  description,
  data,
  evidenceFieldMap,
}) => {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 8,
        borderBottom: `1px solid ${BT.border.subtle}`, paddingBottom: 8,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: '#8B5CF6' }}>✦</span>
        <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: BT.text.white }}>
          {payload.title}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, marginLeft: 'auto' }}>
          OPUS-GENERATED · {modelVersion ?? 'claude-sonnet-4-5'}
        </span>
      </div>
      {(description ?? payload.description) && (
        <div style={{ fontFamily: MONO, fontSize: 10, color: BT.text.secondary, lineHeight: 1.5 }}>
          {description ?? payload.description}
        </div>
      )}

      {/* Blocks */}
      {payload.blocks.map((block, idx) => (
        <BlockRenderer key={idx} block={block} data={data} evidenceFieldMap={evidenceFieldMap} />
      ))}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// Block dispatcher
// ──────────────────────────────────────────────────────────────────────────

const BlockRenderer: React.FC<{
  block: CustomTabBlock;
  data: CustomTabRendererProps['data'];
  evidenceFieldMap?: Record<string, EvidenceFieldMeta>;
}> = ({ block, data, evidenceFieldMap }) => {
  switch (block.type) {
    case 'markdown':   return <MarkdownBlockView   block={block} data={data} evidenceFieldMap={evidenceFieldMap} />;
    case 'kpi_tile':   return <KpiTileBlockView    block={block} data={data} evidenceFieldMap={evidenceFieldMap} />;
    case 'table':      return <TableBlockView      block={block} data={data} evidenceFieldMap={evidenceFieldMap} />;
    case 'ratio_bar':  return <RatioBarBlockView   block={block} data={data} evidenceFieldMap={evidenceFieldMap} />;
    case 'line_chart': return <LineChartBlockView  block={block} data={data} evidenceFieldMap={evidenceFieldMap} />;
    default: return null;
  }
};

// ──────────────────────────────────────────────────────────────────────────
// Reference resolver — walks dot-paths against the data surface
// ──────────────────────────────────────────────────────────────────────────

function resolveRef(ref: string, data: CustomTabRendererProps['data']): unknown {
  // Strip any `[i]` from the head segment so refs like `projections[0]` still
  // pick the right surface, and accept single-segment refs (e.g. bare
  // `projections`) which resolve to the whole surface — needed by line_chart
  // seriesRef where the catalog entry is the array itself.
  const parts = ref.split('.');
  const headMatch = parts[0].match(/^([a-zA-Z0-9_]+)(\[(\d+)\])?$/);
  if (!headMatch) return undefined;
  const surfaceKey = headMatch[1] as keyof CustomTabRendererProps['data'];
  let cursor: any;
  switch (surfaceKey) {
    case 'assumptions': cursor = data.assumptions; break;
    case 'results':     cursor = data.results; break;
    case 'f9':          cursor = data.f9; break;
    case 'deal':        cursor = data.deal; break;
    case 'projections': cursor = data.projections; break;
    default: return undefined;
  }
  if (headMatch[3] != null && Array.isArray(cursor)) {
    cursor = cursor[Number(headMatch[3])];
  }
  for (let i = 1; i < parts.length; i++) {
    if (cursor == null) return undefined;
    const segment = parts[i];
    const arrMatch = segment.match(/^([a-zA-Z0-9_]+)\[(\d+)\]$/);
    if (arrMatch) {
      cursor = cursor[arrMatch[1]];
      if (Array.isArray(cursor)) cursor = cursor[Number(arrMatch[2])];
      else return undefined;
    } else {
      cursor = cursor[segment];
    }
  }
  return cursor;
}

function resolveSeries(ref: string, data: CustomTabRendererProps['data']): any[] {
  const v = resolveRef(ref, data);
  return Array.isArray(v) ? v : [];
}

function resolveColumnCells(ref: string, data: CustomTabRendererProps['data'], rowCount: number): unknown[] {
  // Replace the first `[*]` with `[i]` for each row and resolve.
  if (!ref.includes('[*]')) {
    const cells: unknown[] = [];
    const v = resolveRef(ref, data);
    for (let i = 0; i < rowCount; i++) cells.push(v);
    return cells;
  }
  const cells: unknown[] = [];
  for (let i = 0; i < rowCount; i++) {
    cells.push(resolveRef(ref.replace('[*]', `[${i}]`), data));
  }
  return cells;
}

type ProvenancedShape = { value?: unknown; confidence?: unknown; source?: unknown; qualityFlag?: unknown };
function isProvenanced(v: unknown): v is ProvenancedShape {
  return typeof v === 'object' && v !== null;
}

function unwrapNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && isFinite(v)) return v;
  if (isProvenanced(v) && 'value' in v) {
    const inner = v.value;
    if (typeof inner === 'number' && isFinite(inner)) return inner;
  }
  return null;
}

function unwrapValue(v: unknown): unknown {
  if (isProvenanced(v) && 'value' in v) return v.value;
  return v;
}

function formatValue(value: number | null, format?: CustomTabFormat): string {
  if (value == null) return '—';
  switch (format) {
    case 'currency': return fmt$(value);
    case 'percent':  return fmtPct(value);
    case 'multiple': return fmtX(value);
    case 'ratio':    return value.toFixed(2);
    case 'number':
    default:         return Number(value).toLocaleString();
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Provenance badge — tiny pill rendered next to a value
// ──────────────────────────────────────────────────────────────────────────

// NOTE: prop is `fieldRef`, not `ref` — `ref` is reserved by React on
// function components and would never reach the implementation.
const ProvenanceBadge: React.FC<{
  fieldRef: string;
  value: unknown;
  evidenceFieldMap?: Record<string, EvidenceFieldMeta>;
}> = ({ fieldRef, value, evidenceFieldMap }) => {
  const meta = evidenceFieldMap?.[fieldRef];
  let confidence: number | undefined;
  let source: string | undefined;
  let qualityFlag: string | undefined;
  if (isProvenanced(value) && 'confidence' in value) {
    if (typeof value.confidence === 'number') confidence = value.confidence;
    if (typeof value.source === 'string') source = value.source;
    if (typeof value.qualityFlag === 'string') qualityFlag = value.qualityFlag;
  } else if (meta) {
    const metaAny = meta as Partial<EvidenceFieldMeta> & { quality_flag?: string };
    if (typeof metaAny.confidence === 'number') confidence = metaAny.confidence;
    if (typeof metaAny.source === 'string') source = metaAny.source;
    if (typeof metaAny.quality_flag === 'string') qualityFlag = metaAny.quality_flag;
    else if (typeof (metaAny as any).qualityFlag === 'string') qualityFlag = (metaAny as any).qualityFlag;
  }
  if (confidence == null && source == null && qualityFlag == null) return null;

  const colour =
    qualityFlag === 'green' ? BT.text.green :
    qualityFlag === 'yellow' ? BT.text.amber :
    qualityFlag === 'red' ? '#FF6B6B' :
    BT.text.muted;

  const label = `${(source ?? 'src').toString().slice(0, 6).toUpperCase()}${
    typeof confidence === 'number' ? ' · ' + (confidence * 100).toFixed(0) + '%' : ''
  }`;
  return (
    <span
      title={`${fieldRef} · source=${source ?? '?'} · confidence=${confidence ?? '?'} · quality=${qualityFlag ?? '?'}`}
      style={{
        display: 'inline-block', marginLeft: 4,
        fontFamily: MONO, fontSize: 8, fontWeight: 700,
        padding: '0 4px', borderRadius: 2,
        background: colour + '20',
        color: colour,
        border: `1px solid ${colour}40`,
        verticalAlign: 'middle',
      }}
    >
      {label}
    </span>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// Per-block renderers
// ──────────────────────────────────────────────────────────────────────────

const MarkdownBlockView: React.FC<{
  block: Extract<CustomTabBlock, { type: 'markdown' }>;
  data: CustomTabRendererProps['data'];
  evidenceFieldMap?: Record<string, EvidenceFieldMeta>;
}> = ({ block, data, evidenceFieldMap }) => {
  // Split text on `{{ ref }}` placeholders and render values inline.
  const segments = useMemo(() => {
    const parts: Array<{ kind: 'text' | 'ref'; value: string }> = [];
    const re = /\{\{\s*([a-zA-Z0-9_.\[\]\*]+)\s*\}\}/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(block.text)) !== null) {
      if (m.index > last) parts.push({ kind: 'text', value: block.text.slice(last, m.index) });
      parts.push({ kind: 'ref', value: m[1] });
      last = m.index + m[0].length;
    }
    if (last < block.text.length) parts.push({ kind: 'text', value: block.text.slice(last) });
    return parts;
  }, [block.text]);

  return (
    <div style={{
      fontFamily: MONO, fontSize: 11, color: BT.text.primary, lineHeight: 1.6,
      padding: '8px 10px', background: BT.bg.panel,
      border: `1px solid ${BT.border.subtle}`, borderRadius: 2,
      whiteSpace: 'pre-wrap',
    }}>
      {segments.map((seg, i) => {
        if (seg.kind === 'text') return <span key={i}>{seg.value}</span>;
        const raw = resolveRef(seg.value, data);
        const num = unwrapNumber(raw);
        const display = num != null
          ? formatValue(num)
          : String(unwrapValue(raw) ?? '—');
        return (
          <span key={i} style={{ color: BT.text.amber, fontWeight: 700 }}>
            {display}
            <ProvenanceBadge fieldRef={seg.value} value={raw} evidenceFieldMap={evidenceFieldMap} />
          </span>
        );
      })}
    </div>
  );
};

const KpiTileBlockView: React.FC<{
  block: Extract<CustomTabBlock, { type: 'kpi_tile' }>;
  data: CustomTabRendererProps['data'];
  evidenceFieldMap?: Record<string, EvidenceFieldMeta>;
}> = ({ block, data, evidenceFieldMap }) => {
  const raw = resolveRef(block.ref, data);
  const num = unwrapNumber(raw);
  const display = formatValue(num, block.format);
  const cmpRaw = block.compareRef ? resolveRef(block.compareRef, data) : undefined;
  const cmpNum = unwrapNumber(cmpRaw);
  const delta = (num != null && cmpNum != null) ? num - cmpNum : null;

  return (
    <div style={{
      display: 'inline-flex', flexDirection: 'column', minWidth: 160,
      padding: '8px 12px', background: BT.bg.panel,
      border: `1px solid ${BT.border.medium}`, borderRadius: 2,
    }}>
      <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>
        {block.label.toUpperCase()}
      </span>
      <span style={{
        fontFamily: MONO, fontSize: 18, fontWeight: 700, color: BT.met.financial,
        marginTop: 2,
      }}>
        {display}
        <ProvenanceBadge fieldRef={block.ref} value={raw} evidenceFieldMap={evidenceFieldMap} />
      </span>
      {block.sublabel && (
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, marginTop: 2 }}>
          {block.sublabel}
        </span>
      )}
      {delta != null && (
        <span style={{
          fontFamily: MONO, fontSize: 9, marginTop: 2,
          color: delta >= 0 ? BT.text.green : '#FF6B6B',
        }}>
          Δ {formatValue(delta, block.format)} vs comp
        </span>
      )}
    </div>
  );
};

const TableBlockView: React.FC<{
  block: Extract<CustomTabBlock, { type: 'table' }>;
  data: CustomTabRendererProps['data'];
  evidenceFieldMap?: Record<string, EvidenceFieldMeta>;
}> = ({ block, data, evidenceFieldMap }) => {
  const rows = resolveSeries(block.rowSourceRef, data);
  const limit = Math.max(1, Math.min(block.limit ?? 10, 60));
  const rowCount = Math.min(rows.length, limit);
  const columnCells = block.columns.map(col => resolveColumnCells(col.ref, data, rowCount));

  return (
    <div style={{
      background: BT.bg.panel, border: `1px solid ${BT.border.medium}`,
      borderRadius: 2, padding: 8,
    }}>
      {block.caption && (
        <div style={{ fontFamily: MONO, fontSize: 10, color: BT.text.secondary, marginBottom: 6 }}>
          {block.caption}
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 10 }}>
        <thead>
          <tr>
            {block.columns.map((col, i) => (
              <th key={i} style={{
                textAlign: 'right', padding: '4px 6px', borderBottom: `1px solid ${BT.border.subtle}`,
                color: BT.text.muted, fontWeight: 700, fontSize: 9, letterSpacing: 0.4,
              }}>
                {col.header.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }).map((_, r) => (
            <tr key={r} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
              {block.columns.map((col, c) => {
                const raw = columnCells[c][r];
                const num = unwrapNumber(raw);
                const display = num != null ? formatValue(num, col.format) : String(unwrapValue(raw) ?? '—');
                // Resolve the per-cell field-ref so each badge looks up the
                // right concrete entry in the evidence map (e.g.
                // `f9.proforma.year1[3].broker` instead of the wildcard
                // `f9.proforma.year1[*].broker`).
                const cellRef = col.ref.includes('[*]') ? col.ref.replace('[*]', `[${r}]`) : col.ref;
                return (
                  <td key={c} style={{ textAlign: 'right', padding: '3px 6px', color: BT.text.primary }}>
                    {display}
                    <ProvenanceBadge fieldRef={cellRef} value={raw} evidenceFieldMap={evidenceFieldMap} />
                  </td>
                );
              })}
            </tr>
          ))}
          {rowCount === 0 && (
            <tr><td colSpan={block.columns.length} style={{ padding: 8, color: BT.text.muted, textAlign: 'center' }}>
              no rows
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const RatioBarBlockView: React.FC<{
  block: Extract<CustomTabBlock, { type: 'ratio_bar' }>;
  data: CustomTabRendererProps['data'];
  evidenceFieldMap?: Record<string, EvidenceFieldMeta>;
}> = ({ block, data, evidenceFieldMap }) => {
  const num = unwrapNumber(resolveRef(block.numeratorRef, data));
  const den = unwrapNumber(resolveRef(block.denominatorRef, data));
  const ratio = (num != null && den != null && den !== 0) ? num / den : null;
  const pct = ratio != null ? Math.max(0, Math.min(1, ratio)) : 0;
  const display = ratio != null
    ? (block.format === 'ratio' ? ratio.toFixed(2) : (pct * 100).toFixed(1) + '%')
    : '—';

  return (
    <div style={{
      background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`,
      borderRadius: 2, padding: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: BT.text.primary, fontWeight: 700 }}>
          {block.label}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: BT.met.financial, fontWeight: 700 }}>
          {display}
        </span>
      </div>
      <div style={{ position: 'relative', height: 8, background: BT.bg.terminal, borderRadius: 1, overflow: 'visible' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, height: '100%',
          width: `${pct * 100}%`, background: BT.met.financial, borderRadius: 1,
        }} />
        {block.benchmark != null && (
          <div title={`benchmark ${(block.benchmark * 100).toFixed(1)}%`} style={{
            position: 'absolute', top: -2, height: 12,
            left: `${block.benchmark * 100}%`, width: 1, background: BT.text.amber,
          }} />
        )}
      </div>
      <div style={{ marginTop: 4, fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
        {block.numeratorRef}
        <ProvenanceBadge fieldRef={block.numeratorRef} value={resolveRef(block.numeratorRef, data)} evidenceFieldMap={evidenceFieldMap} />
        {' / '}
        {block.denominatorRef}
        <ProvenanceBadge fieldRef={block.denominatorRef} value={resolveRef(block.denominatorRef, data)} evidenceFieldMap={evidenceFieldMap} />
      </div>
    </div>
  );
};

const LineChartBlockView: React.FC<{
  block: Extract<CustomTabBlock, { type: 'line_chart' }>;
  data: CustomTabRendererProps['data'];
  evidenceFieldMap?: Record<string, EvidenceFieldMeta>;
}> = ({ block, data, evidenceFieldMap }) => {
  const series = resolveSeries(block.seriesRef, data);
  const compareSeries = block.compareSeriesRef ? resolveSeries(block.compareSeriesRef, data) : [];
  const yKey = inferYKey(series);
  const xKey = inferXKey(series);
  const points = series.map((p, i) => ({ x: p?.[xKey] ?? i, y: unwrapNumber(p?.[yKey]) ?? 0 }));
  const cmpPoints = compareSeries.map((p, i) => ({ x: p?.[xKey] ?? i, y: unwrapNumber(p?.[yKey]) ?? 0 }));
  const allYs = [...points.map(p => p.y), ...cmpPoints.map(p => p.y)];
  const minY = allYs.length ? Math.min(...allYs) : 0;
  const maxY = allYs.length ? Math.max(...allYs) : 1;
  const W = 480, H = 140, PAD = 24;
  const xScale = (i: number) => PAD + (i / Math.max(1, points.length - 1)) * (W - 2 * PAD);
  const yScale = (y: number) => H - PAD - ((y - minY) / Math.max(1, maxY - minY)) * (H - 2 * PAD);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(p.y)}`).join(' ');
  const cmpPath = cmpPoints.length
    ? cmpPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(p.y)}`).join(' ')
    : null;

  return (
    <div style={{
      background: BT.bg.panel, border: `1px solid ${BT.border.medium}`,
      borderRadius: 2, padding: 8,
    }}>
      <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, marginBottom: 4 }}>
        {block.yLabel ?? 'value'} over {block.xLabel ?? 'period'}
        <ProvenanceBadge fieldRef={block.seriesRef} value={null} evidenceFieldMap={evidenceFieldMap} />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ background: BT.bg.terminal, borderRadius: 2 }}>
        {/* axes */}
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke={BT.border.subtle} strokeWidth={1} />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke={BT.border.subtle} strokeWidth={1} />
        {/* primary path */}
        {path && <path d={path} fill="none" stroke={BT.met.financial} strokeWidth={1.5} />}
        {/* compare path */}
        {cmpPath && <path d={cmpPath} fill="none" stroke={BT.text.amber} strokeWidth={1.2} strokeDasharray="3 3" />}
        {/* data points */}
        {points.map((p, i) => (
          <circle key={i} cx={xScale(i)} cy={yScale(p.y)} r={2} fill={BT.met.financial} />
        ))}
      </svg>
      {points.length === 0 && (
        <div style={{ padding: 8, fontFamily: MONO, fontSize: 10, color: BT.text.muted }}>
          (series resolved to an empty array)
        </div>
      )}
    </div>
  );
};

function inferYKey(series: any[]): string {
  if (!series.length) return 'value';
  const first = series[0];
  if (first && typeof first === 'object') {
    const keys = Object.keys(first);
    const preferred = ['noi', 'cashFlow', 'value', 'revenue', 'amount'];
    for (const k of preferred) if (keys.includes(k)) return k;
    const numericKey = keys.find(k => typeof unwrapNumber(first[k]) === 'number');
    if (numericKey) return numericKey;
  }
  return 'value';
}

function inferXKey(series: any[]): string {
  if (!series.length) return 'year';
  const first = series[0];
  if (first && typeof first === 'object') {
    const keys = Object.keys(first);
    const preferred = ['year', 'period', 'month', 'date', 'x'];
    for (const k of preferred) if (keys.includes(k)) return k;
  }
  return 'year';
}

export default CustomTabRenderer;
