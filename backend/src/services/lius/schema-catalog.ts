/**
 * Schema Catalog — Loads, validates, and indexes LIUS schema files.
 *
 * Schemas are in src/services/lius/lines/{section}/{name}.yaml
 * The catalog:
 *  1. Discovers all YAML/JSON files
 *  2. Parses + validates against LIUSSchema
 *  3. Resolves valid_dependency graph (topological sort)
 *  4. Provides lookups by liuid, section, and archetype
 */

import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';
import { z } from 'zod';
import {
  LIUSSchema,
  type LIUSchema,
  type SchemaCatalog,
  type SchemaCatalogEntry,
  type Liuid,
} from './types';
import { logger } from '../../utils/logger';

const LINES_DIR = path.resolve(__dirname, '../../services/lius/lines');

/**
 * Load the full schema catalog from filesystem.
 * Throws on validation errors — schemas must be valid on boot.
 */
export function loadSchemaCatalog(): SchemaCatalog {
  const start = Date.now();
  const entries: SchemaCatalogEntry[] = [];
  
  const sections = loadSectionDirectories();
  
  for (const section of sections) {
    const sectionDir = path.join(LINES_DIR, section);
    if (!fs.existsSync(sectionDir)) continue;
    
    const files = fs.readdirSync(sectionDir)
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml') || f.endsWith('.json'))
      .sort();
    
    for (const file of files) {
      const filePath = path.join(sectionDir, file);
      const entry = loadSchemaFile(filePath, section, file);
      if (entry) entries.push(entry);
    }
  }
  
  // Build index
  const bySection: Record<string, SchemaCatalogEntry[]> = {};
  const byLiuid: Record<string, SchemaCatalogEntry> = {};
  
  for (const entry of entries) {
    if (!bySection[entry.schema.section]) bySection[entry.schema.section] = [];
    bySection[entry.schema.section].push(entry);
    
    if (byLiuid[entry.liuid]) {
      throw new Error(
        `Duplicate liuid "${entry.liuid}" in ${byLiuid[entry.liuid].filePath} and ${entry.filePath}`
      );
    }
    byLiuid[entry.liuid] = entry;
  }
  
  // Topological sort
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const dagOrder: string[] = [];
  
  function visit(id: string) {
    if (visiting.has(id)) {
      throw new Error(`Circular dependency detected involving "${id}"`);
    }
    if (visited.has(id)) return;
    visiting.add(id);
    
    const entry = byLiuid[id];
    if (entry) {
      for (const dep of (entry.schema.dependsOn?.required ?? [])) {
        visit(dep);
      }
    }
    
    visiting.delete(id);
    visited.add(id);
    dagOrder.push(id);
  }
  
  for (const entry of entries) {
    if (!visited.has(entry.liuid)) visit(entry.liuid);
  }
  
  const catalog: SchemaCatalog = {
    version: '0.3',
    entries,
    bySection,
    byLiuid,
    dagOrder,
  };
  
  logger.info(`[LIUS] Schema catalog loaded: ${entries.length} schemas in ${sections.length} sections (${Date.now() - start}ms)`);
  
  return catalog;
}

function loadSectionDirectories(): string[] {
  try {
    return fs.readdirSync(LINES_DIR)
      .filter(f => fs.statSync(path.join(LINES_DIR, f)).isDirectory() && !f.startsWith('.'))
      .sort();
  } catch {
    logger.warn('[LIUS] Lines directory not found at', LINES_DIR);
    return [];
  }
}

function loadSchemaFile(
  filePath: string,
  section: string,
  fileName: string,
): SchemaCatalogEntry | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = filePath.endsWith('.json') ? JSON.parse(raw) : YAML.parse(raw);
    
    if (!parsed || typeof parsed !== 'object') {
      logger.warn(`[LIUS] Empty schema file: ${fileName}`);
      return null;
    }
    
    // Infer liuid from file stem if not set
    if (!parsed.liuid) {
      const stem = path.basename(fileName, path.extname(fileName));
      parsed.liuid = `${section}.${stem}`;
    }
    
    // Validation
    const schema = LIUSSchema.parse(parsed);
    
    // Cross-section section match
    if (schema.section !== section) {
      throw new Error(`Schema declares section "${schema.section}" but lives in "${section}/"`);
    }
    
    return {
      liuid: schema.liuid,
      schema,
      filePath,
      source: filePath.endsWith('.json') ? 'json' : 'yaml',
    };
  } catch (err) {
    if (err instanceof z.ZodError) {
      const details = (err.errors ?? []).map((e: any) => `  ${(e.path ?? []).join('.')}: ${e.message}`).join('\n');
      throw new Error(`Schema validation failed for ${fileName}:\n${details}`);
    }
    throw err;
  }
}

/**
 * Get a single schema by liuid.
 */
export function getSchema(liuid: Liuid, catalog: SchemaCatalog): LIUSchema | null {
  return catalog.byLiuid[liuid]?.schema ?? null;
}

/**
 * Get all schemas for a section (e.g. 'opex', 'income').
 */
export function getSectionSchemas(section: string, catalog: SchemaCatalog): LIUSchema[] {
  return (catalog.bySection[section] ?? []).map(e => e.schema);
}

/**
 * Get schemas filtered by archetype.
 */
export function getSchemasByArchetype(archetype: string, catalog: SchemaCatalog): LIUSchema[] {
  return catalog.entries
    .filter(e => e.schema.archetype === archetype)
    .map(e => e.schema);
}

/**
 * Hot-reload a single schema file (for development).
 */
export function reloadSchema(liuid: Liuid, catalog: SchemaCatalog): SchemaCatalogEntry | null {
  const existing = catalog.byLiuid[liuid];
  if (!existing) return null;
  
  const entry = loadSchemaFile(existing.filePath, existing.schema.section, path.basename(existing.filePath));
  if (!entry) return null;
  
  // Update indexes
  catalog.byLiuid[liuid] = entry;
  catalog.bySection[entry.schema.section] = catalog.bySection[entry.schema.section] ?? [];
  const idx = catalog.bySection[entry.schema.section].findIndex(e => e.liuid === liuid);
  if (idx >= 0) catalog.bySection[entry.schema.section][idx] = entry;
  else catalog.bySection[entry.schema.section].push(entry);
  
  return entry;
}
