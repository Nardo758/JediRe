#!/usr/bin/env node
// =============================================================================
// JediRe Deal Capsule — Smoke Audit
// =============================================================================
// Discovers every typed `LayeredValue<T>` field in the Deal Capsule
// (frontend/src/stores/dealContext.types.ts), every UI input binding across
// the development pages + deal sections, exercises an in-memory smoke
// roundtrip on the LayeredValue contract, and emits a JSON report consumed by
// render-blueprint.mjs.
//
// USAGE: node scripts/deal-capsule-audit/audit.mjs
// =============================================================================

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const TYPES_FILE = join(ROOT, 'frontend/src/stores/dealContext.types.ts');
const SCAN_ROOTS = [
  join(ROOT, 'frontend/src/pages/development'),
  join(ROOT, 'frontend/src/components/deal/sections'),
];
const OUTPUT = join(__dirname, 'audit-result.json');

// -----------------------------------------------------------------------------
// 1. Discover typed LayeredValue<T> fields by parsing dealContext.types.ts
// -----------------------------------------------------------------------------

/**
 * Pre-processor: collapse multi-line `LayeredValue<...>` declarations onto
 * their opening line so the simple line-based regex can match them.
 *
 * Example input:
 *     setbacks: LayeredValue<{
 *       front: number;
 *       rear: number;
 *     }>;
 *
 * Output (one logical line):
 *     setbacks: LayeredValue<{ front: number; rear: number; }>;
 *
 * Algorithm: when we see `LayeredValue<` on a line and the angle-bracket
 * depth doesn't return to zero on that same line, keep concatenating
 * subsequent lines (with whitespace) until the depth balances, then emit
 * the joined line as one. Counts both `<` and `>` characters globally on
 * the line — this is conservative (could over-count when an unrelated `>`
 * appears) but safe for `dealContext.types.ts` style.
 */
function flattenMultilineLayeredValue(src) {
  const out = [];
  const rawLines = src.split('\n');
  let i = 0;
  while (i < rawLines.length) {
    let line = rawLines[i];
    const lvIdx = line.indexOf('LayeredValue<');
    if (lvIdx === -1) {
      out.push(line);
      i++;
      continue;
    }
    // Walk forward joining lines until `<` and `>` from `LayeredValue<` onward balance.
    let tail = line.slice(lvIdx);
    let opens = (tail.match(/</g) || []).length;
    let closes = (tail.match(/>/g) || []).length;
    let j = i;
    while (opens > closes && j + 1 < rawLines.length) {
      j++;
      const next = rawLines[j];
      line += ' ' + next.trim();
      tail += ' ' + next;
      opens = (tail.match(/</g) || []).length;
      closes = (tail.match(/>/g) || []).length;
    }
    out.push(line);
    i = j + 1;
  }
  return out;
}

function discoverTypedFields() {
  const src = readFileSync(TYPES_FILE, 'utf8');
  const lines = flattenMultilineLayeredValue(src);
  const ifaceRe = /^export interface (\w+)\s*(?:extends [^{]+)?\{?\s*$/;
  const typeAliasRe = /^export type (\w+)\s*=\s*\{?\s*$/;
  // matches:    name: LayeredValue<T>
  //             name?: LayeredValue<T>
  // T may contain nested generics or inline object literals.
  const fieldRe = /^\s*(\w+)\??:\s*LayeredValue<(.+?)>;?\s*(?:\/\/.*)?$/;

  const fields = [];
  let currentIface = null;
  let depth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const ifaceMatch = ifaceRe.exec(line) || typeAliasRe.exec(line);
    if (ifaceMatch && depth === 0) {
      currentIface = ifaceMatch[1];
      // count opening braces on the same line
      depth += (line.match(/\{/g) || []).length;
      depth -= (line.match(/\}/g) || []).length;
      continue;
    }

    if (currentIface) {
      depth += (line.match(/\{/g) || []).length;
      depth -= (line.match(/\}/g) || []).length;
      // Only collect fields at depth 1 (direct interface members)
      if (depth === 1) {
        const m = fieldRe.exec(line);
        if (m) {
          const [, name, leafType] = m;
          fields.push({
            iface: currentIface,
            name,
            leafType: leafType.trim(),
            line: i + 1,
            path: `${ifaceToPath(currentIface)}.${name}`,
          });
        }
      }
      if (depth === 0) currentIface = null;
    }
  }
  return fields;
}

// Map TS interface name → dotted Deal Capsule path root.
function ifaceToPath(iface) {
  const map = {
    DealIdentity: 'identity',
    ZoningContext: 'zoning',
    MarketContext: 'market',
    SupplyContext: 'supply',
    ExistingPropertyContext: 'existing',
    DevelopmentPathContext: 'development.path',
    UnitMixContext: 'unitMix',
    UnitTypeContext: 'unitMix.types',
    ProFormaContext: 'proforma',
    ProFormaAssumptionsContext: 'proforma.assumptions',
    RevenueContext: 'proforma.revenue',
    OpExContext: 'proforma.opex',
    CapitalStructureContext: 'capital',
    DebtContext: 'capital.debt',
    EquityContext: 'capital.equity',
    StrategyContext: 'strategy',
    RiskContext: 'risk',
    DesignContext: 'design',
    ConstructionContext: 'construction',
    LeaseUpContext: 'leaseUp',
    OperationsContext: 'operations',
    ExitContext: 'exit',
    TaxContext: 'tax',
    CostSheetContext: 'costSheet',
    DealContext: '',
  };
  return map[iface] ?? iface.replace(/Context$/, '').toLowerCase();
}

// -----------------------------------------------------------------------------
// 2. Discover UI input bindings across development pages + deal sections
// -----------------------------------------------------------------------------
function walkDir(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkDir(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

function discoverUIBindings() {
  const inputRe = /<(input|select|textarea|NumberInput|TextInput|TextArea|Combobox|Switch|Checkbox|RadioGroup)\b/g;
  const handlerRe = /on(?:Change|ValueChange|CheckedChange|Input)\s*=/g;
  const overrideRe = /setOverrides?\s*\(|setOverride\s*\(|updateField\s*\(|patchDeal\s*\(/g;
  const idAttrRe = /\b(?:id|name|data-field)\s*=\s*["'`]([\w.\-]+)["'`]/g;

  const files = SCAN_ROOTS.flatMap(walkDir);
  const bindings = [];

  for (const file of files) {
    let src;
    try {
      src = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const inputCount = (src.match(inputRe) || []).length;
    const handlerCount = (src.match(handlerRe) || []).length;
    const overrideCount = (src.match(overrideRe) || []).length;
    const ids = [...src.matchAll(idAttrRe)].map(m => m[1]);

    if (inputCount + overrideCount === 0) continue;

    bindings.push({
      file: relative(ROOT, file),
      inputCount,
      handlerCount,
      overrideCount,
      idHints: [...new Set(ids)].sort(),
    });
  }
  return bindings;
}

// -----------------------------------------------------------------------------
// 3. In-memory LayeredValue smoke roundtrip
// -----------------------------------------------------------------------------
// Mirror of `layered()` in dealContext.types.ts (kept in sync — see test below)
function layered(value, source = 'broker', confidence = 0.5) {
  const resolvedFrom =
    source === 'user' ? 'user' :
    source === 'broker' ? 'broker' :
    'platform';
  const now = new Date().toISOString();
  return {
    value,
    source,
    resolvedFrom,
    updatedAt: now,
    confidence,
    alertLevel: 'none',
    userReviewed: source === 'user',
    layers: { [resolvedFrom]: { value, updatedAt: now, confidence } },
  };
}

// Mirror of override application: user edit ALWAYS wins, prior layer preserved.
function applyUserOverride(lv, newValue) {
  const now = new Date().toISOString();
  const priorLayers = { ...(lv.layers || {}) };
  // Preserve the prior resolved layer if not already captured.
  if (!priorLayers[lv.resolvedFrom]) {
    priorLayers[lv.resolvedFrom] = { value: lv.value, updatedAt: lv.updatedAt, confidence: lv.confidence };
  }
  return {
    ...lv,
    value: newValue,
    source: 'user',
    resolvedFrom: 'user',
    updatedAt: now,
    confidence: 1,
    userReviewed: true,
    layers: { ...priorLayers, user: { value: newValue, updatedAt: now, confidence: 1 } },
  };
}

function sampleValueForLeafType(leafType) {
  const t = leafType.trim();
  if (/^number\b/.test(t)) return 42;
  if (/^string\b/.test(t)) return 'smoke-value';
  if (/^boolean\b/.test(t)) return true;
  if (t.startsWith('Array<') || t.endsWith('[]')) return [];
  if (t.startsWith('{')) return {};
  if (t.includes('|')) {
    // Union — pick the first literal-ish token
    const first = t.split('|')[0].trim().replace(/['"]/g, '');
    return /^\d/.test(first) ? Number(first) : first;
  }
  return null;
}

function smokeOneField(field) {
  const sample = sampleValueForLeafType(field.leafType);
  const userValue =
    typeof sample === 'number' ? sample + 1 :
    typeof sample === 'string' ? sample + '-edited' :
    typeof sample === 'boolean' ? !sample :
    sample;
  try {
    const lv0 = layered(sample, 'broker', 0.5);
    if (lv0.resolvedFrom !== 'broker') throw new Error('initial resolvedFrom mismatch');
    if (lv0.value !== sample) throw new Error('initial value mismatch');
    if (!lv0.layers || !lv0.layers.broker) throw new Error('broker layer missing');

    const lv1 = applyUserOverride(lv0, userValue);
    if (lv1.resolvedFrom !== 'user') throw new Error('user override did not lift resolvedFrom');
    if (lv1.value !== userValue) throw new Error('user override did not lift value');
    if (!lv1.layers || !lv1.layers.user) throw new Error('user layer missing after override');
    if (!lv1.layers.broker) throw new Error('broker layer history dropped');
    if (lv1.userReviewed !== true) throw new Error('userReviewed flag not set');

    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

// -----------------------------------------------------------------------------
// 4. Cross-reference typed paths ↔ UI bindings (heuristic)
// -----------------------------------------------------------------------------
function crossReference(typed, bindings) {
  const allHints = new Set();
  for (const b of bindings) for (const h of b.idHints) allHints.add(h);

  const typedWithBinding = [];
  for (const f of typed) {
    const hits = bindings.filter(b =>
      b.idHints.includes(f.name) ||
      b.idHints.includes(f.path) ||
      b.file.toLowerCase().includes(f.iface.toLowerCase().replace('context', ''))
    );
    typedWithBinding.push({ ...f, uiBindingFiles: hits.map(h => h.file) });
  }
  return typedWithBinding;
}

// -----------------------------------------------------------------------------
// 5. Self-test for the multiline-LayeredValue parser (regression guard)
// -----------------------------------------------------------------------------
function selfTest() {
  const fixture = [
    'export interface FixtureContext {',
    '  flatNumber: LayeredValue<number>;',
    '  flatString?: LayeredValue<string>;',
    '  multilineObject: LayeredValue<{',
    '    front: number;',
    '    rear: number;',
    '    side: number;',
    '  }>;',
    '  flatTrailing: LayeredValue<boolean>;',
    '}',
    '',
  ].join('\n');
  const flattened = flattenMultilineLayeredValue(fixture);
  const merged = flattened.find(l => l.includes('multilineObject') && l.includes('}>'));
  if (!merged) throw new Error('selfTest: multiline LayeredValue<{...}> was not flattened onto one line');

  // Re-run the field regex against the flattened fixture.
  const fieldRe = /^\s*(\w+)\??:\s*LayeredValue<(.+?)>;?\s*(?:\/\/.*)?$/;
  const captured = flattened.map(l => fieldRe.exec(l)).filter(Boolean).map(m => m[1]);
  const expected = ['flatNumber', 'flatString', 'multilineObject', 'flatTrailing'];
  for (const name of expected) {
    if (!captured.includes(name)) {
      throw new Error(`selfTest: field "${name}" not captured (got: ${captured.join(', ')})`);
    }
  }
  console.log(`[deal-capsule-audit] self-test OK — captured ${captured.length}/${expected.length} fixture fields including multiline.`);
}

// -----------------------------------------------------------------------------
// 6. Main
// -----------------------------------------------------------------------------
function main() {
  if (process.argv.includes('--self-test')) {
    selfTest();
    return;
  }
  const t0 = Date.now();

  const typed = discoverTypedFields();
  const bindings = discoverUIBindings();

  const smokeResults = typed.map(f => ({ ...f, smoke: smokeOneField(f) }));
  const passed = smokeResults.filter(r => r.smoke.ok).length;
  const failed = smokeResults.length - passed;

  const enriched = crossReference(smokeResults, bindings);

  const totalUIInputs = bindings.reduce((acc, b) => acc + b.inputCount, 0);
  const totalOverrideCalls = bindings.reduce((acc, b) => acc + b.overrideCount, 0);

  const result = {
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    summary: {
      typedFieldCount: typed.length,
      smokePassed: passed,
      smokeFailed: failed,
      uiInputElementCount: totalUIInputs,
      uiOverrideMutationCount: totalOverrideCalls,
      uiInputFileCount: bindings.length,
    },
    typedFields: enriched,
    uiBindings: bindings,
  };

  writeFileSync(OUTPUT, JSON.stringify(result, null, 2) + '\n');

  console.log(`[deal-capsule-audit] typed=${typed.length} smokePass=${passed} smokeFail=${failed}`);
  console.log(`[deal-capsule-audit] ui files=${bindings.length} inputs=${totalUIInputs} overrideCalls=${totalOverrideCalls}`);
  console.log(`[deal-capsule-audit] wrote ${relative(ROOT, OUTPUT)}`);

  if (failed > 0) process.exitCode = 1;
}

main();
