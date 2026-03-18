#!/usr/bin/env node
/**
 * JediRe Full API Smoke Test Runner
 * - Extracts all routes via extract-routes.js logic (inline)
 * - Tests each with JWT auth using parallel HTTP requests
 * - Emits a consolidated report with per-file stats
 * Exit 0 = zero 500s | Exit 1 = failures found
 */
const http   = require('http');
const https  = require('https');
const path   = require('path');
const fs     = require('fs');

// ── Config ───────────────────────────────────────────────────
const BASE_URL  = process.env.BASE_URL  || 'http://localhost:4000';
const DEAL_ID   = process.env.DEAL_ID   || 'e044db04-439b-4442-82df-b36a840f2fd8';
const ORG_ID    = process.env.ORG_ID    || '00000000-0000-0000-0000-000000000001';
const USER_ID   = process.env.USER_ID   || '6253ba3f-d40d-4597-86ab-270c8397a857';
const PROP_ID   = process.env.PROP_ID   || '00000000-0000-0000-0000-000000000001';
const JWT_SECRET= process.env.JWT_SECRET|| 'your-secret-key-change-this';
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '25');
const TIMEOUT_MS  = parseInt(process.env.TIMEOUT_MS  || '5000');
const REPORT_OUT  = process.env.REPORT_OUT || '';

// ── JWT ──────────────────────────────────────────────────────
let TOKEN = '';
try {
  const jwt = require('jsonwebtoken');
  TOKEN = jwt.sign(
    { userId: USER_ID, email: 'demo@jedire.com', role: 'investor' },
    JWT_SECRET,
    { expiresIn: '1h', algorithm: 'HS256', issuer: 'jedire-api', audience: 'jedire-client' }
  );
} catch(e) {
  console.error('JWT error:', e.message);
  process.exit(1);
}

// ── Route extractor (inline, same logic as extract-routes.js) ─
const ROUTE_DIR = path.join(__dirname, '../../backend/src/api/rest');

const MOUNT_PREFIX = {
  'auth.routes':                   '/api/v1/auth',
  'inline-auth.routes':            '/api/v1/auth',
  'admin.routes':                  '/api/v1/admin',
  'dot-admin.routes':              '/api/v1/admin',
  'admin-api-key.routes':          '/api/v1/admin-api',
  'admin-data-coverage.routes':    '/api/v1/admin',
  'audit.routes':                  '/api/v1/audit',
  'atlanta-url-discovery.routes':  '/api/v1/admin/atlanta-url-discovery',
  'data-tracker.routes':           '/api/v1/admin/data-tracker',
  'rent-scraper-admin.routes':     '/api/v1/admin/rent-scraper',
  'ingestion.routes':              '/api/v1/admin/ingest',
  'inline-deals.routes':           '/api/v1/deals',
  'inline-data.routes':            '/api/v1',
  'inline-health.routes':          '/health',
  'inline-inbox.routes':           '/api/v1/inbox',
  'inline-news.routes':            '/api/v1/news',
  'inline-tasks.routes':           '/api/v1/tasks',
  'inline-microsoft.routes':       '/api/v1/microsoft',
  'inline-zoning-analyze.routes':  '/api/v1',
  'health.routes':                 '/health',
  'tasks.routes':                  '/api/v1/tasks',
  'task-completion.routes':        '/api/v1/tasks',
  'inbox.routes':                  '/api/v1/inbox',
  'zoning.routes':                 '/api/v1/zoning',
  'zoning-capacity.routes':        '/api/v1/zoning',
  'zoning-triangulation.routes':   '/api/v1',
  'zoning-intelligence.routes':    '/api/v1/zoning-intelligence',
  'zoning-learning.routes':        '/api/v1/zoning-learning',
  'zoning-verification.routes':    '/api/v1/zoning-verification',
  'zoning-profile.routes':         '/api/v1',
  'zoning-comparator.routes':      '/api/v1/zoning-comparator',
  'jedi.routes':                   '/api/v1/jedi',
  'market-intelligence.routes':    '/api/v1/markets',
  'market-intelligence-enhanced.routes': '/api/v1/markets',
  'market.routes':                 '/api/v1/market',
  'properties.routes':             '/api/v1/properties',
  'property.routes':               '/api/v1/properties',
  'property-boundary.routes':      '/api/v1',
  'property-proxy.routes':         '/api/v1',
  'property-scoring.routes':       '/api/v1/property-scoring',
  'property-metrics.routes':       '/api/v1/property-metrics',
  'property-analytics.routes':     '/api/v1/property-analytics',
  'property-types.routes':         '/api/v1/property-types',
  'property-type-strategies.routes': '/api/v1/property-type-strategies',
  'org.routes':                    '/api/v1/orgs',
  'gmail.routes':                  '/api/v1/gmail',
  'email.routes':                  '/api/v1/emails',
  'email-extractions.routes':      '/api/v1/email-extractions',
  'extractions.routes':            '/api/v1/extractions',
  'news.routes':                   '/api/v1/news',
  'trade-areas.routes':            '/api/v1/trade-areas',
  'leasing-traffic.routes':        '/api/v1/leasing-traffic',
  'leasingTraffic.routes':         '/api/v1/leasing-traffic',
  'custom-strategies.routes':      '/api/v1/custom-strategies',
  'strategies.routes':             '/api/v1/strategies',
  'strategy-definitions.routes':   '/api/v1/strategy-definitions',
  'strategy-analyses.routes':      '/api/v1/strategy-analyses',
  'metrics-catalog.routes':        '/api/v1/metrics',
  'capital-structure.routes':      '/api/v1/capital-structure',
  'context-tracker.routes':        '/api/v1/context',
  'module-wiring.routes':          '/api/v1/module-wiring',
  'development-scenarios.routes':  '/api/v1',
  'team-management.routes':        '/api/v1',
  'collaboration.routes':          '/api/v1',
  'risk.routes':                   '/api/v1/risk',
  'proforma.routes':               '/api/v1/proforma',
  'capital.routes':                '/api/v1/deals',
  'competition.routes':            '/api/v1/deals',
  'deal-market-intelligence.routes': '/api/v1/deals',
  'deal-comp-sets.routes':         '/api/v1/deals',
  'deal-photos.routes':            '/api/v1/deals',
  'deal-context.routes':           '/api/v1/deals',
  'deal-actuals.routes':           '/api/v1/deals',
  'deal-assumptions.routes':       '/api/v1/deals',
  'deal-timeline.routes':          '/api/v1/deal-timelines',
  'deal-validation.routes':        '/api/v1/deals',
  'dealState.routes':              '/api/v1/deals',
  'unit-mix-propagation.routes':   '/api/v1/deals',
  'documentsFiles.routes':         '/api/v1',
  'supply.routes':                 '/api/v1/supply',
  'demand.routes':                 '/api/v1/demand',
  'demand-intelligence.routes':    '/api/v1/demand-intelligence',
  'm28-cycle-intelligence.routes': '/api/v1/cycle-intelligence',
  'm22-archive.routes':            '/api/v1',
  'm26-tax.routes':                '/api/v1',
  'm27-comps.routes':              '/api/v1',
  'microsoft.routes':              '/api/v1/microsoft',
  'scenarios.routes':              '/api/v1/scenarios',
  'corporate-health.routes':       '/api/v1/corporate-health',
  'geography.routes':              '/api/v1/geography',
  'geographic-context.routes':     '/api/v1/deals',
  'proforma-generator.routes':     '/api/v1/properties',
  'entitlement.routes':            '/api/v1/entitlements',
  'regulatory-alert.routes':       '/api/v1/regulatory-alerts',
  'capsule.routes':                '/api/capsules',
  'trafficPrediction.routes':      '/api/v1/traffic',
  'traffic-comps.routes':          '/api/v1/traffic-comps',
  'traffic-data.routes':           '/api/v1/traffic-data',
  'traffic-intelligence.routes':   '/api/v1/traffic-ai',
  'traffic-ai.routes':             '/api/v1/traffic-ai',
  'marketResearch.routes':         '/api/v1/market-research',
  'financial-models.routes':       '/api/v1/financial-models',
  'financial-model.routes':        '/api/v1/financial-model',
  'financial-assumptions.routes':  '/api/v1',
  'financial-dashboard.routes':    '/api/v1/financial-dashboard',
  'opus.routes':                   '/api/v1/opus',
  'calibration.routes':            '/api/calibration',
  'training.routes':               '/api/training',
  'qwen.routes':                   '/api/v1/ai',
  'chat.routes':                   '/api/v1/chat',
  'agent.routes':                  '/api/v1/agents',
  'ai-rendering.routes':           '/api/v1/ai',
  'llm.routes':                    '/api/v1/llm',
  'analysis.routes':               '/api/v1/analysis',
  'dashboard.routes':              '/api/v1/dashboard',
  'billing.routes':                '/api/v1/billing',
  'portfolio.routes':              '/api/v1/portfolio',
  'grid.routes':                   '/api/v1/grid',
  'rankings.routes':               '/api/v1/rankings',
  'f40-performance.routes':        '/api/v1/f40',
  'opportunities.routes':          '/api/v1/opportunities',
  'opportunity-engine.routes':     '/api/v1/opportunities',
  'pipeline':                      '/api/v1/pipeline',
  'isochrone.routes':              '/api/v1/isochrone',
  'building-envelope.routes':      '/api/v1',
  'building-design-3d.routes':     '/api/v1/deals',
  'site-intelligence.routes':      '/api/v1',
  'data-library.routes':           '/api/v1/data-library',
  'data-upload.routes':            '/api/v1/properties',
  'pst-upload.routes':             '/api/v1/data-upload/pst',
  'upload-templates.routes':       '/api/v1/upload-templates',
  'upload.routes':                 '/api/v1/uploads',
  'uploads.routes':                '/api/v1/uploads',
  'files.routes':                  '/api/v1',
  'comp-query.routes':             '/api/v1/comps',
  'benchmark-timeline.routes':     '/api/v1/benchmark-timeline',
  'design-references.routes':      '/api/v1/design-references',
  'design.routes':                 '/api/v1/design-assistant',
  'design-assistant.routes':       '/api/v1/design-assistant',
  'visibility.routes':             '/api/v1/visibility',
  'intelligence.routes':           '/api/v1/zoning-intelligence',
  'correlation.routes':            '/api/v1/correlations',
  'contacts-sync.routes':          '/api/v1',
  'notarize.routes':               '/api/v1/deals',
  'maps.routes':                   '/api/v1/maps',
  'mapAnnotations.routes':         '/api/v1/map-annotations',
  'map-configs.routes':            '/api/v1/map-configs',
  'layers.routes':                 '/api/v1/layers',
  'dd-checklists.routes':          '/api/v1/dd-checklists',
  'modules.routes':                '/api/v1/modules',
  'module-libraries.routes':       '/api/v1/module-libraries',
  'preferences.routes':            '/api/v1/preferences',
  'userPreferences.routes':        '/api/v1/preferences',
  'settings-ai.routes':            '/api/v1/settings/ai-preferences',
  'kafka-events.routes':           '/api/v1/kafka-events',
  'events.routes':                 '/api/v1',
  'errors.routes':                 '/api/v1/errors',
  'credibility.routes':            '/api/v1/credibility',
  'command-center.routes':         '/api/v1/command-center',
  'clawdbot-webhooks.routes':      '/api/v1/clawdbot',
  'assetNotes.routes':             '/api/v1/assets',
  'assetNews.routes':              '/api/v1/assets',
  'asset-map-intelligence.routes': '/api/v1/assets',
  'apartment-locator.routes':      '/api/v1/apartment-locator',
  'proposals.routes':              '/api/v1/proposals',
  'noteCategories.routes':         '/api/v1/note-categories',
  'noteReplies.routes':            '/api/v1',
  'neighboringProperties.routes':  '/api/v1/properties',
  'unitMix.routes':                '/api/v1/unit-mix',
  'unit-mix.routes':               '/api/v1/unit-mix',
  'municode.routes':               '/api/v1/municode',
  'scrape.routes':                 '/api/v1/scrape',
  'tax-comp-analysis.routes':      '/api/v1',
  'unified-properties.routes':     '/api/v1/properties',
  'notifications.routes':          '/api/v1/notifications',
  'media.routes':                  '/api/media',
  'validation':                    '/api/v1',
  'pipeline':                      '/api/v1',
};

const UUID0 = '00000000-0000-0000-0000-000000000001';
function subParams(p) {
  return p
    .replace(/:dealId\b/g,     DEAL_ID)
    .replace(/:orgId\b/g,      ORG_ID)
    .replace(/:userId\b/g,     USER_ID)
    .replace(/:propertyId\b/g, PROP_ID)
    .replace(/:id\b/g,         UUID0)
    .replace(/:memberId\b/g,   '00000000-0000-0000-0000-000000000002')
    .replace(/:moduleId\b/g,   'deal-overview')
    .replace(/:pipelineId\b/g, 'default')
    .replace(/:metricId\b/g,   'rent_index_yoy')
    .replace(/:type\b/g,       'summary')
    .replace(/:category\b/g,   'residential')
    .replace(/:name\b/g,       'test')
    .replace(/:slug\b/g,       'test-slug')
    .replace(/:key\b/g,        'test-key')
    .replace(/:code\b/g,       'TEST')
    .replace(/:municipalityId\b/g, '1')
    .replace(/:strategyId\b/g,    UUID0)
    .replace(/:scenarioId\b/g,    UUID0)
    .replace(/:tradeAreaId\b/g,   UUID0)
    .replace(/:modelId\b/g,       UUID0)
    .replace(/:capsuleId\b/g,     UUID0)
    .replace(/:definitionId\b/g,  UUID0)
    .replace(/:analysisId\b/g,    UUID0)
    .replace(/:checklistId\b/g,   UUID0)
    .replace(/:itemId\b/g,        UUID0)
    .replace(/:alertId\b/g,       UUID0)
    .replace(/:templateId\b/g,    UUID0)
    .replace(/:compSetId\b/g,     UUID0)
    .replace(/:contextId\b/g,     UUID0)
    .replace(/:documentId\b/g,    UUID0)
    .replace(/:fileId\b/g,        UUID0)
    .replace(/:referenceId\b/g,     UUID0)
    .replace(/:accountId\b/g,       UUID0)
    .replace(/:taskId\b/g,          UUID0)
    .replace(/:dataId\b/g,          UUID0)
    .replace(/:recordId\b/g,        UUID0)
    .replace(/:memberId\b/g,        UUID0)
    .replace(/:collabId\b/g,        UUID0)
    .replace(/:commentId\b/g,       UUID0)
    .replace(/:photoId\b/g,         UUID0)
    .replace(/:exportId\b/g,        UUID0)
    .replace(/:extractionId\b/g,    UUID0)
    .replace(/:assumptionId\b/g,    UUID0)
    .replace(/:districtId\b/g,      UUID0)
    .replace(/:geographyId\b/g,     UUID0)
    .replace(/:milestoneId\b/g,     UUID0)
    .replace(/:submarketId\b/g,     UUID0)
    .replace(/:snapshotId\b/g,      UUID0)
    .replace(/:suggestionId\b/g,    UUID0)
    .replace(/:shareId\b/g,         UUID0)
    .replace(/:newsItemId\b/g,      UUID0)
    .replace(/:emailId\b/g,         UUID0)
    .replace(/:pin_id\b/g,          UUID0)
    .replace(/:map_id\b/g,          UUID0)
    .replace(/:marketId\b/g,        UUID0)
    .replace(/:jurisdictionId\b/g,  UUID0)
    .replace(/:parcelId\b/g,        UUID0)
    .replace(/:filename\b/g,        'test-file.pdf')
    .replace(/:path\b/g,            'test-path')
    .replace(/:ownerName\b/g,       'Test+Owner')
    .replace(/:sourceName\b/g,      'TestSource')
    .replace(/:source_type\b/g,     'manual')
    .replace(/:assumptionType\b/g,  'base')
    .replace(/:geographyType\b/g,   'submarket')
    .replace(/:districtCode\b/g,    'TEST-01')
    .replace(/:lat\b/g,             '29.7604')
    .replace(/:lng\b/g,             '-95.3698')
    .replace(/:county\b/g,          'harris')
    .replace(/:state\b/g,           'TX')
    .replace(/:city\b/g,            'houston')
    .replace(/:market\b/g,          'houston')
    .replace(/:municipality\b/g,    'houston')
    .replace(/:noteId\b/g,        UUID0)
    .replace(/:categoryId\b/g,    UUID0)
    .replace(/:replyId\b/g,       UUID0)
    .replace(/:eventId\b/g,       UUID0)
    .replace(/:jobId\b/g,         UUID0)
    .replace(/:proposalId\b/g,    UUID0)
    .replace(/:compId\b/g,        UUID0)
    .replace(/:reportId\b/g,      UUID0)
    .replace(/:priority\b/g,      'high')
    .replace(/:format\b/g,        'json')
    .replace(/:period\b/g,        'monthly')
    .replace(/:step\b/g,          '1')
    .replace(/:phase\b/g,         '1')
    .replace(/:layer\b/g,         'residential')
    .replace(/:version\b/g,       '1')
    .replace(/\(\?:[^)]+\)/g,     'any')
    .replace(/:[a-zA-Z][a-zA-Z0-9_]*/g, 'placeholder');
}

function buildRoutes() {
  const routeFiles = fs.readdirSync(ROUTE_DIR)
    .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map(f => ({ abs: path.join(ROUTE_DIR, f), base: f.replace(/\.ts$/, '') }));
  const RE = /router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
  const routes = [];
  const seen = new Set();
  // Baseline routes
  for (const r of [
    { method:'GET',  path:'/health',              file:'health.routes' },
    { method:'POST', path:'/api/v1/auth/login',   file:'auth.routes' },
    { method:'POST', path:'/api/v1/auth/register',file:'auth.routes' },
    { method:'POST', path:'/api/v1/auth/refresh', file:'auth.routes' },
  ]) {
    const k = r.method+':'+r.path;
    if (!seen.has(k)) { seen.add(k); routes.push(r); }
  }
  for (const { abs, base } of routeFiles) {
    const prefix = MOUNT_PREFIX[base] || '/api/v1';
    let src; try { src = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    RE.lastIndex = 0;
    let m;
    while ((m = RE.exec(src)) !== null) {
      const method = m[1].toUpperCase();
      const rpath  = m[2];
      if (rpath.includes('(')) continue;
      const full = (prefix + rpath).replace(/\/\//g, '/');
      const testPath = subParams(full);
      const k = method + ':' + testPath;
      if (seen.has(k)) continue;
      seen.add(k);
      routes.push({ method, path: testPath, file: base });
    }
  }
  return routes;
}

// ── HTTP request helper ────────────────────────────────────────
function request(method, urlStr) {
  return new Promise((resolve) => {
    const url  = new URL(urlStr);
    const lib  = url.protocol === 'https:' ? https : http;
    const body = ['POST','PUT','PATCH'].includes(method) ? '{"_smoke":true}' : undefined;
    const opts = {
      hostname : url.hostname,
      port     : url.port || (url.protocol === 'https:' ? 443 : 80),
      path     : url.pathname + url.search,
      method,
      headers  : {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type' : 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      },
      timeout  : TIMEOUT_MS,
    };
    const t0 = Date.now();
    const req = lib.request(opts, (res) => {
      res.resume();
      resolve({ status: res.statusCode, ms: Date.now() - t0 });
    });
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, ms: TIMEOUT_MS }); });
    req.on('error',   () => { resolve({ status: 0, ms: Date.now() - t0 }); });
    if (body) req.write(body);
    req.end();
  });
}

// ── Parallel runner ────────────────────────────────────────────
async function runAll(routes) {
  const results  = [];
  const queue    = [...routes];
  let   inFlight = 0;
  let   idx      = 0;

  return new Promise((resolve) => {
    function next() {
      while (inFlight < CONCURRENCY && idx < queue.length) {
        const route = queue[idx++];
        inFlight++;
        const url = BASE_URL + route.path;
        const t0  = Date.now();
        request(route.method, url).then((r) => {
          results.push({ ...route, status: r.status, ms: r.ms });
          inFlight--;
          next();
          if (idx >= queue.length && inFlight === 0) resolve(results);
        });
      }
      if (idx >= queue.length && inFlight === 0) resolve(results);
    }
    next();
  });
}

// ── Main ──────────────────────────────────────────────────────
(async () => {
  const START = Date.now();
  const RUN_DATE = new Date().toISOString().slice(0,19).replace('T',' ');

  console.log('Building route inventory...');
  const routes = buildRoutes();
  console.log(`Testing ${routes.length} unique routes (concurrency=${CONCURRENCY})...`);
  console.log('');

  const results = await runAll(routes);

  // Sort by file then method then path
  results.sort((a,b) => (a.file+a.method+a.path).localeCompare(b.file+b.method+b.path));

  // Print results
  let prevFile = '';
  let total=0, pass=0, warn=0, fail=0;
  const failLines = [];
  const fileStats = {};

  for (const r of results) {
    if (r.file !== prevFile) {
      console.log('');
      console.log(`--- ${r.file} ---`);
      prevFile = r.file;
    }
    if (!fileStats[r.file]) fileStats[r.file] = { pass:0, warn:0, fail:0 };
    total++;
    let verdict;
    if      (r.status >= 200 && r.status < 300) { verdict='PASS'; pass++; fileStats[r.file].pass++; }
    else if (r.status >= 500 || r.status === 0)  { verdict='FAIL'; fail++; fileStats[r.file].fail++;
      failLines.push(`FAIL | ${r.method.padEnd(6)} | ${r.status} | ${r.ms}ms | ${r.file}: ${r.method} ${r.path}`);
    } else { verdict='WARN'; warn++; fileStats[r.file].warn++; }

    const label = `${r.file}: ${r.method} ${r.path}`.slice(0,70);
    console.log(`${verdict.padEnd(4)} | ${r.method.padEnd(6)} | ${String(r.status).padStart(3)} | ${String(r.ms).padStart(5)}ms | ${label}`);
  }

  const DURATION = Math.round((Date.now() - START) / 1000);
  const PCT = total > 0 ? Math.round(pass*100/total) : 0;

  console.log('');
  console.log('==================================================================================================================================');
  console.log('');
  console.log('  JEDIRE FULL API SMOKE TEST — CONSOLIDATED REPORT');
  console.log(`  Run date : ${RUN_DATE}`);
  console.log(`  Duration : ${DURATION}s`);
  console.log(`  Base URL : ${BASE_URL}`);
  console.log(`  Deal ID  : ${DEAL_ID}`);
  console.log('');
  console.log('  ┌──────────────────────────────┐');
  console.log(`  │  TOTAL  : ${String(total).padStart(5)} endpoints    │`);
  console.log(`  │  PASS   : ${String(pass).padStart(5)} (2xx)        │`);
  console.log(`  │  WARN   : ${String(warn).padStart(5)} (3xx/4xx)    │`);
  console.log(`  │  FAIL   : ${String(fail).padStart(5)} (5xx)        │`);
  console.log(`  │  HEALTH :   ${PCT}%             │`);
  console.log('  └──────────────────────────────┘');

  console.log('');
  console.log('  === PER-ROUTE-FILE SUMMARY ===');
  for (const [fkey, s] of Object.entries(fileStats).sort()) {
    const ft = s.pass + s.warn + s.fail;
    console.log(`  ${fkey.padEnd(55)} PASS=${String(s.pass).padStart(3)} WARN=${String(s.warn).padStart(3)} FAIL=${String(s.fail).padStart(3)} TOTAL=${String(ft).padStart(3)}`);
  }

  if (failLines.length > 0) {
    console.log('');
    console.log('  === 500-LEVEL FAILURES (need fixing) ===');
    failLines.forEach(l => console.log('  ' + l));
  }

  console.log('');
  console.log('==================================================================================================================================');

  if (REPORT_OUT) {
    const rpt = [
      'JEDIRE FULL API SMOKE TEST REPORT',
      `Run date : ${RUN_DATE}`,
      `Duration : ${DURATION}s`,
      `Total    : ${total} | Pass: ${pass} | Warn: ${warn} | Fail: ${fail}`,
      '',
      failLines.length > 0 ? '500-LEVEL FAILURES:\n' + failLines.map(l=>'  '+l).join('\n') : 'NO 500-LEVEL FAILURES',
    ].join('\n');
    fs.writeFileSync(REPORT_OUT, rpt);
    console.log(`  Full results written to: ${REPORT_OUT}`);
  }

  process.exit(fail === 0 ? 0 : 1);
})();
