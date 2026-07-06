#!/usr/bin/env node
/**
 * Deterministic-engine type guard (closes the guard-scope hole found 2026-07-06:
 * backend/tsconfig.json's `include` only lists 2 entry files, so test/fixture
 * files under src/services/deterministic and tests/deterministic were
 * structurally never compiled by CI, letting merge-corruption in golden fixtures
 * go undetected for multiple commits).
 *
 * Runs `tsc -p tsconfig.test.json --noEmit --skipLibCheck` and fails only on
 * errors that are NOT in the pre-registered baseline (tsconfig.test.baseline.json).
 * This lets the guard catch new regressions on this surface immediately without
 * being blocked on unrelated pre-existing bugs in production engine/service
 * files, which are out of test-guard fix authority.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const baselinePath = path.join(__dirname, '..', 'tsconfig.test.baseline.json');
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const knownErrors = new Set(baseline.knownErrors);

function normalize(line) {
  // Strip the (line,col) position so drift elsewhere in the same file doesn't
  // false-negative the match against a stable baseline entry.
  return line.replace(/\((\d+),(\d+)\):/, ':');
}

let output = '';
let tscFailed = false;
try {
  output = execSync('npx tsc -p tsconfig.test.json --noEmit --skipLibCheck', {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
  });
} catch (err) {
  tscFailed = true;
  output = (err.stdout || '') + (err.stderr || '');
}

if (!tscFailed) {
  console.log('Deterministic engine type guard: PASS (0 errors, tsc exited 0).');
  process.exit(0);
}

const errorLines = output.split('\n').filter((l) => l.includes('error TS'));
const normalizedErrors = errorLines.map(normalize);
const newErrors = normalizedErrors.filter((l) => !knownErrors.has(l));

if (newErrors.length === 0) {
  console.log(
    `Deterministic engine type guard: PASS (${errorLines.length} error(s), all pre-registered in tsconfig.test.baseline.json).`,
  );
  process.exit(0);
}

console.error('Deterministic engine type guard: FAIL — new TypeScript error(s) not in baseline:\n');
newErrors.forEach((l) => console.error('  NEW: ' + l));
console.error(
  '\nIf this is a genuine new regression, fix it. If it is a legitimate pre-existing issue outside test-guard scope, it must be pre-registered in tsconfig.test.baseline.json with a documented rationale — do not add entries just to silence this failure.',
);
process.exit(1);
