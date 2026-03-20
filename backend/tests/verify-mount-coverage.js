#!/usr/bin/env node
/**
 * verify-mount-coverage.js
 * Parses index.replit.ts to extract actual mount prefixes and compares them
 * against the MOUNT_PREFIXES map in run-smoke-test.js to identify coverage gaps.
 */
const fs = require('fs');
const path = require('path');

// Read index.replit.ts
const indexPath = path.join(__dirname, '../../backend/src/index.replit.ts');
const indexContent = fs.readFileSync(indexPath, 'utf8');

// Extract all app.use('/api/...', ...) mount lines
const mountLines = indexContent
  .split('\n')
  .filter(line => /^\s*app\.use\(/.test(line) && line.includes("'"));

const actualMounts = new Set();
for (const line of mountLines) {
  const m = line.match(/app\.use\(\s*['"`]([^'"`]+)['"`]/);
  if (m && m[1].startsWith('/api')) {
    actualMounts.add(m[1]);
  }
}

// Read run-smoke-test.js to get the MOUNT_PREFIXES map
const runnerPath = path.join(__dirname, 'run-smoke-test.js');
const runnerContent = fs.readFileSync(runnerPath, 'utf8');

const prefixMap = new Map();
const prefixRegex = /^\s*'([^']+)'\s*:\s*'([^']+)'/gm;
let pm;
while ((pm = prefixRegex.exec(runnerContent)) !== null) {
  prefixMap.set(pm[1], pm[2]);
}

// Get all unique prefixes used in the runner map
const runnerPrefixes = new Set([...prefixMap.values()]);

// Compare
const onlyInActual = [...actualMounts].filter(p => !runnerPrefixes.has(p));
const onlyInRunner = [...runnerPrefixes].filter(p => !actualMounts.has(p) && p.startsWith('/api'));

console.log('\n=== MOUNT COVERAGE RECONCILIATION ===');
console.log(`Actual mounts in index.replit.ts: ${actualMounts.size}`);
console.log(`Runner prefix values: ${runnerPrefixes.size}`);

if (onlyInActual.length > 0) {
  console.log('\nActual mounts NOT in runner (coverage gap):');
  onlyInActual.forEach(p => console.log(`  MISSING: ${p}`));
} else {
  console.log('\nAll actual mounts are covered by runner prefix map.');
}

if (onlyInRunner.length > 0) {
  console.log('\nRunner prefixes not in actual mounts (stale entries):');
  onlyInRunner.forEach(p => console.log(`  STALE: ${p}`));
} else {
  console.log('No stale runner prefix entries.');
}

// Output actual mounts for documentation
console.log('\n=== ACTUAL MOUNT PREFIXES FROM index.replit.ts ===');
[...actualMounts].sort().forEach(p => console.log(`  ${p}`));
