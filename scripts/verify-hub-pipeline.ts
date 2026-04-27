/**
 * Hub Pipeline End-to-End Wiring Verification
 *
 * Static checks against the codebase + a couple of HTTP probes against the
 * running backend. Each check is independent and reports pass/fail with a
 * short detail string. Exits 0 if all pass, 1 otherwise.
 *
 * Run:
 *   cd backend && npx tsx ../scripts/verify-hub-pipeline.ts
 *   (or)  npx tsx scripts/verify-hub-pipeline.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const ROOT = path.resolve(__dirname, '..');
const BACKEND_PORT = Number(process.env.PORT ?? 4000);

type Status = 'pass' | 'fail' | 'warn';
interface Check {
  n: number;
  name: string;
  status: Status;
  detail: string;
}

const results: Check[] = [];

function read(p: string): string | null {
  try {
    return fs.readFileSync(path.join(ROOT, p), 'utf8');
  } catch {
    return null;
  }
}

function record(n: number, name: string, status: Status, detail: string) {
  results.push({ n, name, status, detail });
}

// ── 1. "Offering Memorandum" appears in the upload-type dropdown ────────────
{
  const file = 'frontend/src/components/deal/sections/DocumentsSection.tsx';
  const src = read(file);
  if (!src) {
    record(1, '"Offering Memorandum" in upload dropdown', 'fail', `missing file ${file}`);
  } else if (/['"]Offering Memorandum['"]/.test(src)) {
    record(1, '"Offering Memorandum" in upload dropdown', 'pass', `${file}: literal present`);
  } else {
    record(1, '"Offering Memorandum" in upload dropdown', 'fail', `${file}: literal not found`);
  }
}

// ── 2. Acquisitions agent has a trigger for the OM document category ───────
{
  const file = 'backend/src/services/agents/agent-personas.ts';
  const src = read(file);
  if (!src) {
    record(2, 'Acquisitions agent OM trigger', 'fail', `missing file ${file}`);
  } else {
    const hasUploadEvent = /event:\s*['"]document_uploaded['"]/.test(src);
    const hasOMCategory =
      /category:\s*['"]offering_memorandum['"]/i.test(src) ||
      /category:\s*['"]offering['"]/i.test(src);
    if (hasUploadEvent && hasOMCategory) {
      record(2, 'Acquisitions agent OM trigger', 'pass',
        `${file}: document_uploaded + OM category condition present`);
    } else {
      record(2, 'Acquisitions agent OM trigger', 'fail',
        `${file}: event=${hasUploadEvent} category=${hasOMCategory}`);
    }
  }
}

// ── 3. write_underwriting skill is available ───────────────────────────────
{
  const skillFile = 'backend/src/agents/tools/write_underwriting.ts';
  const personasFile = 'backend/src/services/agents/agent-personas.ts';
  const skill = read(skillFile);
  const personas = read(personasFile);
  if (!skill) {
    record(3, 'write_underwriting skill available', 'fail',
      `missing file ${skillFile}`);
  } else {
    const wired = personas && /['"]write_underwriting['"]/.test(personas);
    if (wired) {
      record(3, 'write_underwriting skill available', 'pass',
        `${skillFile} exists and is referenced from agent-personas.ts`);
    } else {
      record(3, 'write_underwriting skill available', 'warn',
        `${skillFile} exists but no reference from agent-personas.ts`);
    }
  }
}

// ── 4. Acquisitions agent prompt references KG + Data Library ──────────────
{
  const file = 'backend/src/services/agents/agent-personas.ts';
  const src = read(file);
  if (!src) {
    record(4, 'Agent prompt references KG + Data Library', 'fail',
      `missing file ${file}`);
  } else {
    const hasKG = /Knowledge Graph/i.test(src);
    const hasLib = /Data Library/i.test(src);
    if (hasKG && hasLib) {
      record(4, 'Agent prompt references KG + Data Library', 'pass',
        `${file}: both phrases present`);
    } else {
      record(4, 'Agent prompt references KG + Data Library', 'fail',
        `${file}: KG=${hasKG} Library=${hasLib}`);
    }
  }
}

// ── 5. Extraction completion fires the agent ───────────────────────────────
{
  const candidates = [
    'backend/src/inngest/functions/auto-extract-on-upload.ts',
    'backend/src/services/document-extraction/auto-extract-on-upload.ts',
  ];
  let foundFile: string | null = null;
  let firesAgent = false;
  for (const f of candidates) {
    const src = read(f);
    if (src) {
      foundFile = f;
      // Look for any of the common dispatch paths.
      firesAgent =
        /dispatchEvent\s*\(/.test(src) ||
        /agentOrchestrator\./.test(src) ||
        /eventDispatcher\.\w+/.test(src) ||
        /inngest\.send\s*\(/.test(src) ||
        /['"]document_uploaded['"]/.test(src) ||
        /['"]extraction\.completed['"]/.test(src) ||
        /['"]extraction_completed['"]/.test(src);
      if (firesAgent) break;
    }
  }
  if (!foundFile) {
    record(5, 'Extraction completion fires agent', 'fail',
      `no auto-extract-on-upload.ts found in expected locations`);
  } else if (firesAgent) {
    record(5, 'Extraction completion fires agent', 'pass',
      `${foundFile}: dispatch path present`);
  } else {
    record(5, 'Extraction completion fires agent', 'fail',
      `${foundFile}: no dispatch/event call found`);
  }
}

// ── 6. checkConditions uses substring matching ─────────────────────────────
{
  const file = 'backend/src/services/agents/agent-orchestrator.ts';
  const src = read(file);
  if (!src) {
    record(6, 'checkConditions uses substring matching', 'fail',
      `missing file ${file}`);
  } else {
    const hasFn = /\bcheckConditions\b/.test(src);
    const hasIncludes =
      /normalizedData\.includes\(normalizedCondition\)/.test(src) ||
      /\.includes\(\s*normalizedCondition\s*\)/.test(src);
    if (hasFn && hasIncludes) {
      record(6, 'checkConditions uses substring matching', 'pass',
        `${file}: function present and uses .includes()`);
    } else {
      record(6, 'checkConditions uses substring matching', 'fail',
        `${file}: fn=${hasFn} includes=${hasIncludes}`);
    }
  }
}

// ── 7. Context Q&A endpoint exists ─────────────────────────────────────────
{
  const file = 'backend/src/api/rest/context-awareness.routes.ts';
  const src = read(file);
  if (!src) {
    record(7, 'Context Q&A endpoint exists', 'fail', `missing file ${file}`);
  } else {
    // Accept POST /query, /qa, /context, /question on this router.
    const m = src.match(/router\.(post|get)\(\s*['"](\/query|\/qa|\/question|\/context)['"]/);
    if (m) {
      record(7, 'Context Q&A endpoint exists', 'pass',
        `${file}: ${m[1].toUpperCase()} ${m[2]} registered`);
    } else {
      record(7, 'Context Q&A endpoint exists', 'fail',
        `${file}: no Q&A route signature matched`);
    }
  }
}

// ── 8. Agent status endpoint exists ────────────────────────────────────────
{
  const file = 'backend/src/api/rest/agent-status.routes.ts';
  const src = read(file);
  if (!src) {
    record(8, 'Agent status endpoint exists', 'fail', `missing file ${file}`);
  } else {
    const m = src.match(/router\.(get|post)\(\s*['"]([^'"]+)['"]/);
    if (m) {
      record(8, 'Agent status endpoint exists', 'pass',
        `${file}: ${m[1].toUpperCase()} ${m[2]} registered`);
    } else {
      record(8, 'Agent status endpoint exists', 'fail',
        `${file}: no route signature found`);
    }
  }
}

// ── 9. NeuralNetworkHub widget exists and is registered/rendered ───────────
{
  const widget = 'frontend/src/components/dashboard/NeuralNetworkHubWidget.tsx';
  const widgetSrc = read(widget);
  if (!widgetSrc) {
    record(9, 'NeuralNetworkHub widget registered', 'fail',
      `missing file ${widget}`);
  } else {
    // Walk likely registration spots, plus the actual page that hosts it.
    const candidates = [
      'frontend/src/components/dashboard/NeuralNetworkHub.tsx',
      'frontend/src/pages/DashboardPage.tsx',
      'frontend/src/pages/HomePage.tsx',
      'frontend/src/pages/TerminalPage.tsx',
      'frontend/src/components/dashboard/index.ts',
    ];
    let registeredIn: string | null = null;
    for (const c of candidates) {
      const s = read(c);
      if (s && /NeuralNetworkHubWidget/.test(s)) {
        registeredIn = c;
        break;
      }
    }
    if (registeredIn) {
      record(9, 'NeuralNetworkHub widget registered', 'pass',
        `${widget} rendered/imported by ${registeredIn}`);
    } else {
      record(9, 'NeuralNetworkHub widget registered', 'warn',
        `${widget} exists but no consumer found in checked candidates`);
    }
  }
}

// ── 10. Migrations exist ───────────────────────────────────────────────────
{
  const required = [
    '20260425_knowledge_graph.sql',
    '20260425_om_intelligence.sql',
    '20260425_data_library_assets_asking_price.sql',
    '20260426_neural_hub_agent_workflow_runs.sql',
  ];
  const dir = 'backend/src/database/migrations';
  let missing: string[] = [];
  for (const m of required) {
    if (!fs.existsSync(path.join(ROOT, dir, m))) missing.push(m);
  }
  if (missing.length === 0) {
    record(10, 'Migrations exist', 'pass',
      `${dir}/: all ${required.length} present`);
  } else {
    record(10, 'Migrations exist', 'fail',
      `missing: ${missing.join(', ')}`);
  }
}

// ── Optional live probes (do not fail the run, just annotate) ──────────────
async function probe(routePath: string): Promise<{ ok: boolean; status: number | string }> {
  return new Promise(resolve => {
    const req = http.get(
      { host: '127.0.0.1', port: BACKEND_PORT, path: routePath, timeout: 1500 },
      res => {
        // 401/403/405 still mean the route is mounted.
        const ok = res.statusCode !== undefined && res.statusCode < 500 && res.statusCode !== 404;
        resolve({ ok, status: res.statusCode ?? 'no-status' });
        res.resume();
      }
    );
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 'timeout' }); });
    req.on('error', e => resolve({ ok: false, status: e.message }));
  });
}

(async () => {
  const liveProbes: Array<{ label: string; route: string }> = [
    { label: '/api/v1/agents/status (live)', route: '/api/v1/agents/status' },
    { label: '/api/v1/context/query (live)', route: '/api/v1/context/query' },
  ];
  const probeResults: string[] = [];
  for (const p of liveProbes) {
    const r = await probe(p.route);
    probeResults.push(`  ${r.ok ? '✅' : '⚠️ '} ${p.label} → ${r.status}`);
  }

  // ── Render report ────────────────────────────────────────────────────────
  const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - s.length));
  const icon = (s: Status) => (s === 'pass' ? '✅' : s === 'warn' ? '⚠️ ' : '❌');

  console.log('\nHub Pipeline Verification\n' + '─'.repeat(80));
  for (const r of results.sort((a, b) => a.n - b.n)) {
    console.log(`${icon(r.status)} ${pad(`${r.n}.`, 4)}${pad(r.name, 50)} ${r.detail}`);
  }
  console.log('─'.repeat(80));
  console.log('Live route probes (404 = unmounted; 401/403 = mounted+protected; 200 = open):');
  for (const line of probeResults) console.log(line);

  const failed = results.filter(r => r.status === 'fail').length;
  const warned = results.filter(r => r.status === 'warn').length;
  const passed = results.filter(r => r.status === 'pass').length;
  console.log('─'.repeat(80));
  console.log(`Summary: ${passed} pass, ${warned} warn, ${failed} fail`);
  process.exit(failed > 0 ? 1 : 0);
})();
