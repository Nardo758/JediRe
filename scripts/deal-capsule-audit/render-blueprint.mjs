#!/usr/bin/env node
// =============================================================================
// JediRe Deal Capsule — Blueprint Renderer
// =============================================================================
// Reads audit-result.json and writes
// docs/architecture/deal-capsule-blueprint.md.
//
// USAGE: node scripts/deal-capsule-audit/render-blueprint.mjs
// =============================================================================

import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const INPUT = join(__dirname, 'audit-result.json');
const OUT = join(ROOT, 'docs/architecture/deal-capsule-blueprint.md');
const F9_SPEC = join(ROOT, 'docs/architecture/f9-proforma-spec.md');
const CROSSLINK = '\n> See also: [Deal Capsule Field Blueprint](./deal-capsule-blueprint.md)\n';

function pad(s, n) { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); }
function escapePipe(s) { return String(s).replace(/\|/g, '\\|'); }

function bySection(typed) {
  const groups = new Map();
  for (const f of typed) {
    if (!groups.has(f.iface)) groups.set(f.iface, []);
    groups.get(f.iface).push(f);
  }
  // stable insertion order = order of first appearance
  return [...groups.entries()];
}

function renderSummary(r) {
  const s = r.summary;
  return [
    '## Summary',
    '',
    '| Metric | Value |',
    '| --- | ---: |',
    `| Generated | \`${r.generatedAt}\` |`,
    `| Audit duration | ${r.durationMs} ms |`,
    `| Typed \`LayeredValue<T>\` fields discovered | **${s.typedFieldCount}** |`,
    `| Smoke roundtrip — passed | **${s.smokePassed}** |`,
    `| Smoke roundtrip — failed | ${s.smokeFailed} |`,
    `| UI files containing inputs | ${s.uiInputFileCount} |`,
    `| Total UI input elements | ${s.uiInputElementCount} |`,
    `| \`setOverride\` / \`patchDeal\` mutation call sites | ${s.uiOverrideMutationCount} |`,
    '',
  ].join('\n');
}

function renderInventory(r) {
  const out = ['## Typed-field inventory by interface', ''];
  for (const [iface, fields] of bySection(r.typedFields)) {
    out.push(`### \`${iface}\` — ${fields.length} field${fields.length === 1 ? '' : 's'}`);
    out.push('');
    out.push('| Field | Path | Leaf type | UI binding files | Smoke |');
    out.push('| --- | --- | --- | ---: | :---: |');
    for (const f of fields) {
      const smoke = f.smoke?.ok ? '✅' : `❌ ${f.smoke?.error ?? 'unknown'}`;
      const uiCount = f.uiBindingFiles?.length ?? 0;
      out.push(`| \`${escapePipe(f.name)}\` | \`${escapePipe(f.path)}\` | \`${escapePipe(f.leafType)}\` | ${uiCount} | ${smoke} |`);
    }
    out.push('');
  }
  return out.join('\n');
}

function renderUIFiles(r) {
  const sorted = [...r.uiBindings].sort((a, b) => (b.inputCount + b.overrideCount) - (a.inputCount + a.overrideCount));
  const out = ['## UI input-bearing files (top 20 by element count)', ''];
  out.push('| File | `<input/select/textarea>` etc. | onChange handlers | override mutation calls |');
  out.push('| --- | ---: | ---: | ---: |');
  for (const b of sorted.slice(0, 20)) {
    out.push(`| \`${escapePipe(b.file)}\` | ${b.inputCount} | ${b.handlerCount} | ${b.overrideCount} |`);
  }
  out.push('');
  return out.join('\n');
}

function renderGaps(r) {
  const noUI = r.typedFields.filter(f => (f.uiBindingFiles?.length ?? 0) === 0);
  const noOverrideCalls = r.uiBindings.filter(b => b.overrideCount === 0);

  const out = ['## Gaps surfaced by this audit', ''];

  out.push(`### Typed fields with no detected UI binding (${noUI.length})`);
  out.push('');
  out.push('Heuristic: file basename contains the interface stem, OR the field name appears as an `id`/`name`/`data-field` attribute in some scanned file. False negatives are likely for fields edited via custom controls without an explicit id hint.');
  out.push('');
  if (noUI.length === 0) {
    out.push('_None — every typed field has at least one heuristic UI hit._');
  } else {
    out.push('| Interface | Field | Path | Leaf type |');
    out.push('| --- | --- | --- | --- |');
    for (const f of noUI) {
      out.push(`| \`${f.iface}\` | \`${escapePipe(f.name)}\` | \`${escapePipe(f.path)}\` | \`${escapePipe(f.leafType)}\` |`);
    }
  }
  out.push('');

  out.push(`### UI files with input elements but no detected store-mutation call (${noOverrideCalls.length})`);
  out.push('');
  out.push('These files render inputs but do not call any of `setOverride(s)`, `updateField`, or `patchDeal`. Either they manage purely local state (acceptable for transient form scratch space) or they are missing a Deal Capsule write path (gap).');
  out.push('');
  if (noOverrideCalls.length === 0) {
    out.push('_None._');
  } else {
    out.push('| File | inputs | onChange |');
    out.push('| --- | ---: | ---: |');
    for (const b of noOverrideCalls.slice(0, 25)) {
      out.push(`| \`${escapePipe(b.file)}\` | ${b.inputCount} | ${b.handlerCount} |`);
    }
    if (noOverrideCalls.length > 25) out.push(`| _… and ${noOverrideCalls.length - 25} more_ | | |`);
  }
  out.push('');
  return out.join('\n');
}

function renderHeader(r) {
  return [
    '# Deal Capsule — Field Blueprint',
    '',
    `_Auto-generated on ${r.generatedAt} by \`scripts/deal-capsule-audit/audit.mjs\` + \`render-blueprint.mjs\`._`,
    '',
    '> **What this is.** A static smoke audit of every typed `LayeredValue<T>` field in the Deal Capsule (`frontend/src/stores/dealContext.types.ts`), cross-referenced against UI input bindings discovered across `frontend/src/pages/development/` and `frontend/src/components/deal/sections/`. The smoke check exercises the LayeredValue contract in-memory: build a broker-sourced value, apply a user override, assert that the user value lifts to the top while the broker layer is preserved in `layers.broker`.',
    '',
    '> **What this is NOT.** A live browser/end-to-end test. There is no Playwright in this repo; a runtime e2e pass over every input across every tab is tracked separately and is out of scope for this audit.',
    '',
    '> **How to regenerate.**',
    '> ```',
    '> node scripts/deal-capsule-audit/audit.mjs',
    '> node scripts/deal-capsule-audit/render-blueprint.mjs',
    '> ```',
    '',
    '> **Companion documents.** This blueprint is a structural inventory of the Deal Capsule. For the F9 Pro Forma data model and audit-trail spec it sits within, see [`f9-proforma-spec.md`](./f9-proforma-spec.md). For the module-by-module wiring map, see [`module_wiring_map.md`](./module_wiring_map.md).',
    '',
  ].join('\n');
}

function ensureCrossLinkInF9Spec() {
  let spec = '';
  try { spec = readFileSync(F9_SPEC, 'utf8'); } catch { return; }
  if (spec.includes('deal-capsule-blueprint.md')) return;
  appendFileSync(F9_SPEC, CROSSLINK);
  console.log(`[render-blueprint] appended cross-link to ${F9_SPEC.replace(ROOT + '/', '')}`);
}

function main() {
  const raw = readFileSync(INPUT, 'utf8');
  const r = JSON.parse(raw);

  const md = [
    renderHeader(r),
    renderSummary(r),
    renderInventory(r),
    renderUIFiles(r),
    renderGaps(r),
  ].join('\n');

  writeFileSync(OUT, md);
  console.log(`[render-blueprint] wrote ${OUT.replace(ROOT + '/', '')} (${md.length} bytes)`);
  ensureCrossLinkInF9Spec();
}

main();
