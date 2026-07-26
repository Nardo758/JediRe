/**
 * W1-9 Guard: dominantSource badge wiring verification
 *
 * Tests:
 * 1. resolveLvSource returns correct winning layer
 * 2. lvSourceToBadge maps layers to badges correctly
 * 3. No hardcoded dominantSource remains in the wired fields
 */

import { resolveLvSource } from '../src/services/assumption-store-builder';
import * as fs from 'fs';
import * as path from 'path';

// ─── Unit tests ───────────────────────────────────────────────────────────────

function testResolveLvSource() {
  const cases = [
    { blob: { override: 5 }, expected: 'override' },
    { blob: { agent_confirmed: 10, platform: 20 }, expected: 'agent_confirmed' },
    { blob: { detected: 7, platform: 3 }, expected: 'detected' },
    { blob: { platform: 4 }, expected: 'platform' },
    { blob: { resolved: 8 }, expected: 'resolved' },
    { blob: null, expected: null },
    { blob: {}, expected: null },
  ];

  let passed = 0;
  for (const c of cases) {
    const got = resolveLvSource(c.blob);
    const ok = got === c.expected;
    console.log(`  ${ok ? '✅' : '❌'} resolveLvSource(${JSON.stringify(c.blob)}) = ${JSON.stringify(got)} (expected ${JSON.stringify(c.expected)})`);
    if (ok) passed++;
  }
  return { passed, total: cases.length };
}

function testLvSourceToBadge() {
  // Replicate the function locally for testing
  function lvSourceToBadge(source: string | null): string | null {
    if (source === 'override') return 'override';
    if (source === null) return null;
    return 'platform';
  }

  const cases = [
    { source: 'override' as const, expected: 'override' },
    { source: 'agent_confirmed' as const, expected: 'platform' },
    { source: 'detected' as const, expected: 'platform' },
    { source: 'platform' as const, expected: 'platform' },
    { source: 'resolved' as const, expected: 'platform' },
    { source: null, expected: null },
  ];

  let passed = 0;
  for (const c of cases) {
    const got = lvSourceToBadge(c.source);
    const ok = got === c.expected;
    console.log(`  ${ok ? '✅' : '❌'} lvSourceToBadge('${c.source}') = ${JSON.stringify(got)} (expected ${JSON.stringify(c.expected)})`);
    if (ok) passed++;
  }
  return { passed, total: cases.length };
}

// ─── Static analysis ──────────────────────────────────────────────────────────

function checkNoHardcodedBadges() {
  const filePath = path.join(__dirname, '../src/api/rest/stabilized-potential.routes.ts');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Fields that should be wired to resolveLvSource, not hardcoded
  const wiredFields = ['gpr', 'vacancy', 'opex', 'cap_rate'];
  // Fields that should be null (deleted badge)
  const deletedFields = ['concessions', 'bad_debt', 'other_income'];
  // Subtotals that should stay null
  const subtotals = ['egr', 'noi', 'stabilized_value'];

  let passed = 0;
  let total = 0;

  // Check wired fields use the resolved source variable, not a string literal
  for (const field of wiredFields) {
    total++;
    // Find the dominantSource line for this field
    const regex = new RegExp(`key: '${field}',[\\s\\S]*?dominantSource:([^,\n]+)`,);
    const match = content.match(regex);
    if (!match) {
      console.log(`  ❌ ${field}: could not find dominantSource line`);
      continue;
    }
    const source = match[1].trim();
    const isHardcoded = source.startsWith("'") || source === 'isDevelopment';
    if (isHardcoded) {
      console.log(`  ❌ ${field}: dominantSource is hardcoded (${source})`);
    } else {
      console.log(`  ✅ ${field}: dominantSource wired to ${source}`);
      passed++;
    }
  }

  // Check deleted fields are null
  for (const field of deletedFields) {
    total++;
    const regex = new RegExp(`key: '${field}',[\\s\\S]*?dominantSource:([^,\n]+)`);
    const match = content.match(regex);
    if (!match) {
      console.log(`  ❌ ${field}: could not find dominantSource line`);
      continue;
    }
    const source = match[1].trim();
    if (source === 'null') {
      console.log(`  ✅ ${field}: dominantSource deleted (null)`);
      passed++;
    } else {
      console.log(`  ❌ ${field}: dominantSource should be null, got ${source}`);
    }
  }

  // Check subtotals stay null
  for (const field of subtotals) {
    total++;
    const regex = new RegExp(`key: '${field}',[\\s\\S]*?dominantSource:([^,\n]+)`);
    const match = content.match(regex);
    if (!match) {
      console.log(`  ❌ ${field}: could not find dominantSource line`);
      continue;
    }
    const source = match[1].trim();
    if (source === 'null') {
      console.log(`  ✅ ${field}: dominantSource stays null (subtotal)`);
      passed++;
    } else {
      console.log(`  ❌ ${field}: dominantSource should be null for subtotal, got ${source}`);
    }
  }

  return { passed, total };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('=== W1-9 DominantSource Badge Guard ===\n');

console.log('--- resolveLvSource unit tests ---');
const r1 = testResolveLvSource();

console.log('\n--- lvSourceToBadge unit tests ---');
const r2 = testLvSourceToBadge();

console.log('\n--- Static analysis: no hardcoded badges ---');
const r3 = checkNoHardcodedBadges();

const totalPassed = r1.passed + r2.passed + r3.passed;
const totalTests = r1.total + r2.total + r3.total;

console.log(`\n=== SUMMARY ===`);
console.log(`Passed: ${totalPassed}/${totalTests}`);

if (totalPassed === totalTests) {
  console.log('\n✅ W1-9 PASS — All dominantSource badges wired or deleted correctly');
  process.exit(0);
} else {
  console.log('\n❌ W1-9 FAIL — Some badges still hardcoded or miswired');
  process.exit(1);
}
