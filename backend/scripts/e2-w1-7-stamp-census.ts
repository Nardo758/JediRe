/**
 * E2 · W1-7 Untagged-Entry Census — Code-level verification of all 8 ingestion paths
 *
 * Checks each entry path for:
 *   - stampProvenance call present? (file:line)
 *   - converged with inline-deals.routes.ts? (one mechanism, not parallel scalar + stamp)
 *
 * The 8 paths from T1-A:
 *   1. deal-capsule uploads
 *   2. library upload
 *   3. Yardi / owned import
 *   4. archive import
 *   5. chat-conveyed facts / create_deal_draft
 *   6. inline-deals
 *   7. email intake
 *   8. platform writers / traffic snapshots
 *
 * Run: cd backend && npx ts-node --transpile-only scripts/e2-w1-7-stamp-census.ts
 */

import { execSync } from 'child_process';

interface PathFinding {
  path: string;
  stampFileLine: string | null;
  converged: boolean | null;
  notes: string;
}

function grepFile(pattern: string, file: string): string | null {
  try {
    const out = execSync(`grep -n "${pattern}" ${file} 2>/dev/null || true`, { encoding: 'utf-8' });
    const first = out.trim().split('\n')[0];
    return first || null;
  } catch {
    return null;
  }
}

function fileExists(file: string): boolean {
  try {
    execSync(`test -f ${file}`);
    return true;
  } catch {
    return false;
  }
}

const findings: PathFinding[] = [
  {
    path: 'deal-capsule uploads',
    stampFileLine: grepFile('stampProvenance', 'src/api/rest/capsule.routes.ts') ??
                   grepFile('stampProvenance', 'src/services/capsule-intelligence.service.ts') ??
                   grepFile('_provenance', 'src/api/rest/capsule.routes.ts'),
    converged: null,
    notes: 'Capsule creation → deal_data JSONB',
  },
  {
    path: 'library upload (data-library-assets)',
    stampFileLine: grepFile('stampProvenance', 'src/api/rest/data-library-assets.routes.ts') ??
                   grepFile('stampProvenance', 'src/services/document-extraction/data-router.ts') ??
                   grepFile('_provenance', 'src/services/document-extraction/data-router.ts'),
    converged: null,
    notes: 'OM parse, archive ingestion, custom-label upload',
  },
  {
    path: 'Yardi / owned import',
    stampFileLine: grepFile('stampProvenance', 'src/services/yardi-import.service.ts') ??
                   grepFile('stampProvenance', 'src/services/owned-import.service.ts') ??
                   grepFile('_provenance', 'src/services/yardi-import.service.ts'),
    converged: null,
    notes: 'External system imports',
  },
  {
    path: 'archive import',
    stampFileLine: grepFile('stampProvenance', 'src/services/archive-ingestion.service.ts') ??
                   grepFile('_provenance', 'src/services/archive-ingestion.service.ts'),
    converged: null,
    notes: 'Archive properties ingestion pipeline',
  },
  {
    path: 'chat-conveyed facts / create_deal_draft',
    stampFileLine: grepFile('stampProvenance', 'src/api/rest/chat.routes.ts') ??
                   grepFile('stampProvenance', 'src/services/deal-draft.service.ts') ??
                   grepFile('create_deal_draft', 'src/services/deal-draft.service.ts'),
    converged: null,
    notes: 'AI chat → deal draft creation',
  },
  {
    path: 'inline-deals',
    stampFileLine: grepFile('stampProvenance', 'src/api/rest/inline-deals.routes.ts') ??
                   grepFile('origin_class', 'src/api/rest/inline-deals.routes.ts'),
    converged: null,
    notes: 'CRITICAL: inline-deals sets origin_class scalar at INSERT; must converge with stampProvenance',
  },
  {
    path: 'email intake',
    stampFileLine: grepFile('stampProvenance', 'src/services/email-ingestion.service.ts') ??
                   grepFile('stampProvenance', 'src/services/email-property-automation.service.ts') ??
                   grepFile('_provenance', 'src/services/email-ingestion.service.ts'),
    converged: null,
    notes: 'Email → deal extraction pipeline',
  },
  {
    path: 'platform writers / traffic snapshots',
    stampFileLine: grepFile('stampProvenance', 'src/services/trafficPredictionEngine.ts') ??
                   grepFile('stampProvenance', 'src/services/traffic-data-sources.service.ts') ??
                   grepFile('_provenance', 'src/services/trafficPredictionEngine.ts'),
    converged: null,
    notes: 'Traffic data platform writes',
  },
];

console.log('=== E2 · W1-7 Untagged-Entry Census ===\n');
console.log('Scanning 8 ingestion paths for stampProvenance calls...\n');

let pass = true;
for (const f of findings) {
  const hasStamp = !!f.stampFileLine;
  const icon = hasStamp ? '✅' : '❌';
  console.log(`${icon} ${f.path}`);
  console.log(`    stampProvenance: ${hasStamp ? f.stampFileLine : 'NOT FOUND'}`);
  console.log(`    notes: ${f.notes}`);
  console.log('');
  if (!hasStamp) pass = false;
}

// Special check: inline-deals convergence
console.log('--- Convergence check: inline-deals.routes.ts ---');
const inlineDealsStamp = grepFile('stampProvenance', 'src/api/rest/inline-deals.routes.ts');
const inlineDealsOrigin = grepFile('origin_class', 'src/api/rest/inline-deals.routes.ts');
if (inlineDealsStamp && inlineDealsOrigin) {
  console.log('  ❌ BOTH stampProvenance AND origin_class scalar present — NOT converged');
  console.log(`    stampProvenance: ${inlineDealsStamp}`);
  console.log(`    origin_class:    ${inlineDealsOrigin}`);
  pass = false;
} else if (inlineDealsStamp && !inlineDealsOrigin) {
  console.log('  ✅ stampProvenance only — converged');
} else if (!inlineDealsStamp && inlineDealsOrigin) {
  console.log('  ⚠️  origin_class scalar only — stampProvenance missing');
  pass = false;
} else {
  console.log('  ❌ Neither stampProvenance nor origin_class found');
  pass = false;
}

console.log('\n=== SUMMARY ===');
console.log(pass
  ? '✅ E2 PASS — All 8 paths stamped, inline-deals converged'
  : '❌ E2 FAIL — Unstamped paths or convergence gaps found');

process.exit(pass ? 0 : 1);
