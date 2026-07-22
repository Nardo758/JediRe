#!/usr/bin/env ts-node
/**
 * SECURITY MICRO-BATCH APPLIER
 * Run in Replit: npx ts-node scripts/apply-security-fixes.ts
 * Applies all four fixes idempotently (safe to re-run).
 */

import * as fs from 'fs';
import * as path from 'path';

const BACKEND = path.resolve(__dirname, '..', 'src');

function applyFix(filePath: string, replacements: Array<{ from: string; to: string }>): void {
  const fullPath = path.resolve(BACKEND, filePath);
  let content = fs.readFileSync(fullPath, 'utf-8');
  let changed = false;

  for (const { from, to } of replacements) {
    if (content.includes(from)) {
      content = content.replace(from, to);
      changed = true;
      console.log(`  ✓ patched ${filePath}`);
    } else if (content.includes(to)) {
      console.log(`  − already patched ${filePath}`);
    } else {
      console.log(`  ✗ FAILED to find target in ${filePath}`);
      console.log(`    Looking for: ${from.slice(0, 80)}…`);
    }
  }

  if (changed) {
    fs.writeFileSync(fullPath, content, 'utf-8');
  }
}

console.log('=== Applying Security Micro-Batch ===\n');

// ── Fix 1: proxy secret throw ───────────────────────────────────────────
applyFix('api/rest/archive.routes.ts', [
  {
    from: `function proxyTokenSecret(): string {\n  return process.env.JWT_SECRET ?? process.env.SESSION_SECRET ?? 'r2-proxy-fallback-secret';\n}`,
    to: `function proxyTokenSecret(): string {\n  const secret = process.env.JWT_SECRET ?? process.env.SESSION_SECRET;\n  if (!secret) {\n    throw new Error('FATAL: JWT_SECRET or SESSION_SECRET must be configured for upload proxy token signing');\n  }\n  return secret;\n}`,
  },
]);

// ── Fix 2: restricted-by-default + heuristic ────────────────────────────
applyFix('services/intake-sources/data-library-upload/index.ts', [
  {
    from: `  if (!meta.sha256) throw new Error('[data-library-upload] sha256 is required');\n  if (!meta.storage_key) throw new Error('[data-library-upload] storage_key is required');\n  if (!meta.original_filename) throw new Error('[data-library-upload] original_filename is required');\n\n  const docType = normalizeDocType(meta.document_type);`,
    to: `  if (!meta.sha256) throw new Error('[data-library-upload] sha256 is required');\n  if (!meta.storage_key) throw new Error('[data-library-upload] storage_key is required');\n  if (!meta.original_filename) throw new Error('[data-library-upload] original_filename is required');\n\n  // ── License classification (restricted-by-default) ─────────────────────────\n  // Heuristic: filename patterns that indicate third-party vendor data.\n  // Unknown / undeclared source → restricted until proven free (honest-absence).\n  const filenameLower = meta.original_filename.toLowerCase();\n  const vendorPatterns: Array<{ pattern: RegExp; source: string }> = [\n    { pattern: /costar/, source: 'costar' },\n    { pattern: /axio/, source: 'axiometrics' },\n    { pattern: /axiom/, source: 'axiometrics' },\n    { pattern: /submarket/, source: 'suspected_restricted' },\n  ];\n\n  let licenseRestricted = true;  // DEFAULT: restricted until classified\n  let licenseSource: string | null = null;\n\n  const matchedVendor = vendorPatterns.find(v => v.pattern.test(filenameLower));\n  if (matchedVendor) {\n    licenseRestricted = true;\n    licenseSource = matchedVendor.source;\n  }\n  // TODO: add explicit source-declaration override when req.body.source is wired\n\n  const scopeId = licenseRestricted\n    ? 'RESTRICTED_PENDING_DEAL'\n    : (meta.uploaded_by ? 'user:' + meta.uploaded_by : 'GLOBAL');\n\n  const docType = normalizeDocType(meta.document_type);`,
  },
  {
    from: `    \`INSERT INTO data_library_files\n       (original_filename, sha256, mime_type, size_bytes,\n        storage_provider, storage_bucket, storage_key,\n        document_type, parser_status, parcel_id, uploaded_by, scope_id, redistribution_restricted)\n     VALUES (\$1, \$2, \$3, \$4, 'r2', \$5, \$6, \$7, 'unparsed', \$8, \$9, \$10, FALSE)\n     ON CONFLICT (sha256) DO NOTHING\n     RETURNING id, true AS inserted\``,
    to: `    \`INSERT INTO data_library_files\n       (original_filename, sha256, mime_type, size_bytes,\n        storage_provider, storage_bucket, storage_key, document_type,\n        parser_status, parcel_id, uploaded_by, scope_id,\n        redistribution_restricted, license_source)\n     VALUES (\$1, \$2, \$3, \$4, 'r2', \$5, \$6, \$7, 'unparsed', \$8, \$9, \$10, \$11, \$12)\n     ON CONFLICT (sha256) DO NOTHING\n     RETURNING id, true AS inserted\``,
  },
  {
    from: `      meta.uploaded_by ?? null,\n      meta.uploaded_by ? 'user:' + meta.uploaded_by : 'GLOBAL',`,
    to: `      meta.uploaded_by ?? null,\n      scopeId,\n      licenseRestricted,\n      licenseSource,`,
  },
]);

// ── Fix 3: PII minimize-at-source + redact guard ────────────────────────
applyFix('services/deal-financial-context.service.ts', [
  {
    from: `    pool.query(\n      \`SELECT unit_number, tenant_name, monthly_rent, effective_rent,\n              lease_start, lease_end, lease_status, concession_amount, source_type\n       FROM deal_lease_transactions\n       WHERE deal_id = \$1\n       ORDER BY unit_number\``,`,
    to: `    pool.query(\n      \`SELECT unit_number, monthly_rent, effective_rent,\n              lease_start, lease_end, lease_status, concession_amount, source_type\n       FROM deal_lease_transactions\n       WHERE deal_id = \$1\n       ORDER BY unit_number\``,`,
  },
  {
    from: `        tenantName: l.tenant_name,`,
    to: `        tenantName: '[REDACTED]',`,
  },
  {
    from: `  let prompt = '';`,
    to: `  // ── PII redaction guard ───────────────────────────────────────────────────\n  // Belt-and-suspenders: tenant names must never reach LLM prompts.\n  // (Source-layer fix: tenant_name dropped from SELECT above.)\n  for (const lease of ctx.leases.items) {\n    if (lease.tenantName && lease.tenantName !== '[REDACTED]') {\n      throw new Error(\`PII leak blocked: unredacted tenant name in unit \${lease.unitNumber}\`);\n    }\n  }\n\n  let prompt = '';`,
  },
]);

// ── Fix 4: calibration constant ─────────────────────────────────────────
applyFix('services/traffic-calibration.service.ts', [
  {
    from: `        comparisons['Tour Conversion'] = {\n          calibrated: Number(cal.avg_tour_conversion),\n          default: 0.99,\n        };`,
    to: `        comparisons['Tour Conversion'] = {\n          calibrated: Number(cal.avg_tour_conversion),\n          // Platform default: must match BASELINE_DATA in multifamilyTrafficService\n          default: 0.50,\n        };`,
  },
]);

console.log('\n=== Done ===');
console.log('Verify: git diff --stat');
console.log('Build:  npm run build');
