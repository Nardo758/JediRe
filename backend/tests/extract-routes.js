#!/usr/bin/env node
/**
 * Route inventory extractor — covers ALL backend/src/api/rest/*.ts files
 * Emits TSV: METHOD<TAB>FULL_PATH<TAB>FILE_BASE
 */
const fs = require('fs');
const path = require('path');

const ROUTE_DIR = path.join(__dirname, '../../backend/src/api/rest');

// Mount prefix for every route file
// Derived from app.use() calls in backend/src/api/rest/index.ts (primary)
// and backend/src/index.replit.ts (supplementary)
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
  'entitlements.routes':           '/api/v1/entitlements',
  'regulatory-alert.routes':       '/api/v1/regulatory-alerts',
  'regulatory-alerts.routes':      '/api/v1/regulatory-alerts',
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
  'intelligence.routes':           '/api/v1/intelligence',
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
};

const DEAL_ID = 'e044db04-439b-4442-82df-b36a840f2fd8';
const ORG_ID  = '00000000-0000-0000-0000-000000000001';
const USER_ID = '6253ba3f-d40d-4597-86ab-270c8397a857';
const PROP_ID = '00000000-0000-0000-0000-000000000001';
const UUID0   = '00000000-0000-0000-0000-000000000001';

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

// Scan all .ts files in ROUTE_DIR
const routeFiles = fs.readdirSync(ROUTE_DIR)
  .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))
  .map(f => ({ abs: path.join(ROUTE_DIR, f), base: f.replace(/\.ts$/, '') }));

const routes = [];
const RE = /router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;

for (const { abs, base } of routeFiles) {
  const prefix = MOUNT_PREFIX[base] || '/api/v1';
  let src;
  try { src = fs.readFileSync(abs, 'utf8'); } catch { continue; }
  let m;
  RE.lastIndex = 0;
  while ((m = RE.exec(src)) !== null) {
    const method = m[1].toUpperCase();
    const rpath  = m[2];
    if (rpath.includes('(')) continue; // skip regex patterns
    const full = (prefix + rpath).replace(/\/\//g, '/');
    routes.push({ method, path: subParams(full), file: base, original: full });
  }
}

// Deduplicate by method+testPath
const seen = new Set();
const unique = routes.filter(r => {
  const k = r.method + ':' + r.path;
  if (seen.has(k)) return false;
  seen.add(k); return true;
});

for (const r of unique) {
  process.stdout.write(`${r.method}\t${r.path}\t${r.file}\n`);
}
process.stderr.write(`Extracted ${unique.length} unique routes from ${routeFiles.length} files\n`);
