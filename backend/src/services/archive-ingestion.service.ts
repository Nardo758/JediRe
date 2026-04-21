/**
 * Archive Ingestion Service
 * 
 * Scans archive deal folders, parses documents (T12, Rent Roll, Tax Bill, OM),
 * and populates data_library_assets with bucketed comparable data.
 * 
 * The CashFlow agent uses this data via fetch_archive_assumption_distribution
 * to benchmark underwriting assumptions against historical closed deals.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import { getPool } from '../database/connection';
import { parseT12 } from './document-extraction/parsers/t12-parser';
import { parseRentRoll } from './document-extraction/parsers/rent-roll-parser';
import { parseTaxBillAsync } from './document-extraction/parsers/tax-bill-parser';
import { parseOMAsync, type OMExtraction } from './document-extraction/parsers/om-parser';
import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArchiveDealFolder {
  name: string;
  path: string;
  files: ArchiveFile[];
}

export interface ArchiveFile {
  name: string;
  path: string;
  type: 'T12' | 'RENT_ROLL' | 'TAX_BILL' | 'OM' | 'OTHER' | 'UNKNOWN';
  extension: string;
}

export interface ArchiveScanResult {
  totalFolders: number;
  parsedFolders: number;
  skippedFolders: number;
  errors: string[];
  warnings: string[];
}

export interface ParsedArchiveDeal {
  folderName: string;
  folderPath: string;
  
  // Extracted metadata
  propertyName: string;
  city: string | null;
  state: string | null;
  units: number | null;
  yearBuilt: number | null;
  
  // Financial metrics (from T12)
  trailingNoi: number | null;
  trailingRevenue: number | null;
  trailingOpex: number | null;
  opexRatio: number | null;
  noiPerUnit: number | null;
  opexPerUnit: number | null;
  
  // Rent roll metrics
  avgRent: number | null;
  occupancyPct: number | null;
  lossToLeasePct: number | null;
  
  // Tax info
  annualTax: number | null;
  assessedValue: number | null;
  
  // Broker claims (from OM)
  brokerClaims: Record<string, unknown>;
  
  // Raw extraction data
  extractionData: Record<string, unknown>;
  sourceFiles: ArchiveFile[];
  parseWarnings: string[];
}

// ─── File Classification ──────────────────────────────────────────────────────

const T12_PATTERNS = [
  /t12/i, /t-12/i, /trailing.*12/i, /operating.*statement/i, /os_/i, /financial/i,
];

const RR_PATTERNS = [
  /rent.*roll/i, /rr_/i, /rr\d/i, /unit.*list/i,
];

const TAX_PATTERNS = [
  /tax.*bill/i, /tax_/i, /property.*tax/i, /ad.*valorem/i,
];

const OM_PATTERNS = [
  /offering.*memo/i, /om\b/i, /investment.*overview/i, /cbre.*om/i, /jll.*om/i,
  /cushman.*om/i, /newmark.*om/i, /berkadia.*om/i, /walker.*dunlop/i,
];

function classifyFile(filename: string): ArchiveFile['type'] {
  const lower = filename.toLowerCase();
  
  // Check patterns in order of specificity
  if (T12_PATTERNS.some(p => p.test(lower))) return 'T12';
  if (RR_PATTERNS.some(p => p.test(lower))) return 'RENT_ROLL';
  if (TAX_PATTERNS.some(p => p.test(lower))) return 'TAX_BILL';
  if (OM_PATTERNS.some(p => p.test(lower))) return 'OM';
  
  return 'UNKNOWN';
}

function getExtension(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return ext.startsWith('.') ? ext.slice(1) : ext;
}

// ─── Bucketing Helpers ────────────────────────────────────────────────────────

function getVintageBand(yearBuilt: number | null): string | null {
  if (!yearBuilt) return null;
  if (yearBuilt < 1980) return 'pre-1980';
  if (yearBuilt < 2000) return '1980-1999';
  if (yearBuilt < 2010) return '2000-2009';
  if (yearBuilt < 2020) return '2010-2019';
  return '2020+';
}

function getUnitCountBand(units: number | null): string | null {
  if (!units) return null;
  if (units < 100) return '<100';
  if (units < 200) return '100-199';
  if (units < 300) return '200-299';
  if (units < 400) return '300-399';
  return '400+';
}

function getPropertyType(stories: number | null, units: number | null): string {
  if (!stories) return 'garden'; // default
  if (stories <= 3) return 'garden';
  if (stories <= 6) return 'mid-rise';
  return 'high-rise';
}

// ─── Folder Scanner ───────────────────────────────────────────────────────────

export function scanArchiveFolder(archivePath: string): ArchiveDealFolder[] {
  const folders: ArchiveDealFolder[] = [];
  
  if (!fs.existsSync(archivePath)) {
    logger.error(`Archive path does not exist: ${archivePath}`);
    return folders;
  }
  
  const entries = fs.readdirSync(archivePath, { withFileTypes: true });
  
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    
    const folderPath = path.join(archivePath, entry.name);
    const files = findFilesRecursive(folderPath);
    
    if (files.length === 0) continue;
    
    folders.push({
      name: entry.name,
      path: folderPath,
      files,
    });
  }
  
  logger.info(`Scanned ${folders.length} deal folders in archive`);
  return folders;
}

function findFilesRecursive(dirPath: string, maxDepth = 3, currentDepth = 0): ArchiveFile[] {
  const files: ArchiveFile[] = [];
  
  if (currentDepth > maxDepth) return files;
  
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        files.push(...findFilesRecursive(fullPath, maxDepth, currentDepth + 1));
      } else if (entry.isFile()) {
        const ext = getExtension(entry.name);
        if (['xlsx', 'xls', 'pdf', 'csv'].includes(ext)) {
          files.push({
            name: entry.name,
            path: fullPath,
            type: classifyFile(entry.name),
            extension: ext,
          });
        }
      }
    }
  } catch (err) {
    logger.warn(`Error reading directory ${dirPath}: ${err}`);
  }
  
  return files;
}

// ─── Document Parsing ─────────────────────────────────────────────────────────

async function parseArchiveDeal(folder: ArchiveDealFolder): Promise<ParsedArchiveDeal> {
  const warnings: string[] = [];
  const extractionData: Record<string, unknown> = {};
  
  let trailingNoi: number | null = null;
  let trailingRevenue: number | null = null;
  let trailingOpex: number | null = null;
  let units: number | null = null;
  let avgRent: number | null = null;
  let occupancyPct: number | null = null;
  let lossToLeasePct: number | null = null;
  let annualTax: number | null = null;
  let assessedValue: number | null = null;
  
  // Find and parse T12
  const t12Files = folder.files.filter(f => f.type === 'T12' && ['xlsx', 'xls'].includes(f.extension));
  if (t12Files.length > 0) {
    // Use the most recent T12 (by filename date or last in list)
    const t12File = t12Files[t12Files.length - 1];
    try {
      const buffer = fs.readFileSync(t12File.path);
      const result = parseT12(buffer, t12File.name);
      
      if (result.success && result.summary) {
        trailingRevenue = result.summary.t12Revenue || null;
        trailingOpex = result.summary.t12OpEx || null;
        trailingNoi = result.summary.t12NOI || null;
        extractionData.t12 = result.summary;
        
        if (result.warnings?.length) {
          warnings.push(...result.warnings.map(w => `[T12] ${w}`));
        }
      } else {
        warnings.push(`[T12] Parse failed: ${result.error || 'unknown'}`);
      }
    } catch (err) {
      warnings.push(`[T12] Error reading ${t12File.name}: ${err}`);
    }
  } else {
    warnings.push('[T12] No T12 file found');
  }
  
  // Find and parse Rent Roll
  const rrFiles = folder.files.filter(f => f.type === 'RENT_ROLL' && ['xlsx', 'xls'].includes(f.extension));
  if (rrFiles.length > 0) {
    const rrFile = rrFiles[rrFiles.length - 1];
    try {
      const buffer = fs.readFileSync(rrFile.path);
      const result = parseRentRoll(buffer, rrFile.name);
      
      if (result.success && result.summary) {
        units = result.summary.totalUnits || null;
        avgRent = result.summary.avgEffectiveRent || result.summary.avgMarketRent || null;
        occupancyPct = result.summary.occupancyRate || null;
        lossToLeasePct = result.summary.lossToLeasePct || null;
        extractionData.rentRoll = result.summary;
        
        if (result.warnings?.length) {
          warnings.push(...result.warnings.map(w => `[RR] ${w}`));
        }
      } else {
        warnings.push(`[RR] Parse failed: ${result.error || 'unknown'}`);
      }
    } catch (err) {
      warnings.push(`[RR] Error reading ${rrFile.name}: ${err}`);
    }
  } else {
    warnings.push('[RR] No Rent Roll file found');
  }
  
  // Find and parse Tax Bill
  const taxFiles = folder.files.filter(f => f.type === 'TAX_BILL' && f.extension === 'pdf');
  if (taxFiles.length > 0) {
    const taxFile = taxFiles[0];
    try {
      const buffer = fs.readFileSync(taxFile.path);
      const result = await parseTaxBillAsync(buffer, taxFile.name);
      
      if (result.success && result.data) {
        annualTax = result.data.totalAnnualTax || null;
        assessedValue = result.data.assessedValue || null;
        extractionData.taxBill = result.data;
      } else {
        warnings.push(`[TAX] Parse failed: ${result.error || 'unknown'}`);
      }
    } catch (err) {
      warnings.push(`[TAX] Error reading ${taxFile.name}: ${err}`);
    }
  }
  
  // Find and parse OM (AI-assisted)
  let omData: OMExtraction | null = null;
  let brokerClaims: Record<string, unknown> = {};
  let yearBuilt: number | null = null;
  let city: string | null = null;
  
  const omFiles = folder.files.filter(f => f.type === 'OM' && f.extension === 'pdf');
  if (omFiles.length > 0) {
    const omFile = omFiles[0];
    try {
      const buffer = fs.readFileSync(omFile.path);
      const result = await parseOMAsync(buffer, omFile.name);
      
      if (result.success && result.data) {
        omData = result.data;
        extractionData.om = omData;
        
        // Extract metadata from OM
        if (omData.property.yearBuilt) yearBuilt = omData.property.yearBuilt;
        if (omData.property.city) city = omData.property.city;
        if (omData.property.units && !units) units = omData.property.units;
        
        // Build broker claims object
        brokerClaims = {
          proforma: omData.brokerProforma,
          replacementCost: omData.replacementCost,
          capitalPlan: omData.capitalPlan,
          investmentHighlights: omData.investmentHighlights,
          metadata: omData.metadata,
        };
        
        if (result.warnings?.length) {
          warnings.push(...result.warnings.map(w => `[OM] ${w}`));
        }
      } else {
        warnings.push(`[OM] Parse failed: ${result.error || 'unknown'}`);
      }
    } catch (err) {
      warnings.push(`[OM] Error reading ${omFile.name}: ${err}`);
    }
  }
  
  // Calculate derived metrics
  const opexRatio = trailingRevenue && trailingRevenue > 0 && trailingOpex 
    ? trailingOpex / trailingRevenue 
    : null;
  const noiPerUnit = trailingNoi && units && units > 0 
    ? trailingNoi / units 
    : null;
  const opexPerUnit = trailingOpex && units && units > 0 
    ? trailingOpex / units 
    : null;
  
  // Try to extract city/state from folder name or OM
  const locationMatch = folder.name.match(/[-–]\s*([A-Z]{2})$/i) || 
                        folder.name.match(/,\s*([A-Z]{2})$/i);
  let state = locationMatch ? locationMatch[1].toUpperCase() : null;
  
  // Override with OM data if available
  if (omData?.property.state) state = omData.property.state;
  if (omData?.property.city) city = omData.property.city;
  
  return {
    folderName: folder.name,
    folderPath: folder.path,
    propertyName: omData?.property.name || folder.name.replace(/[-–]\s*[A-Z]{2}$/i, '').trim(),
    city,
    state,
    units,
    yearBuilt,
    trailingNoi,
    trailingRevenue,
    trailingOpex,
    opexRatio,
    noiPerUnit,
    opexPerUnit,
    avgRent,
    occupancyPct,
    lossToLeasePct,
    annualTax,
    assessedValue,
    brokerClaims,
    extractionData,
    sourceFiles: folder.files,
    parseWarnings: warnings,
  };
}

// ─── Database Upsert ──────────────────────────────────────────────────────────

async function upsertArchiveDeal(pool: Pool, deal: ParsedArchiveDeal): Promise<string> {
  const vintageBand = getVintageBand(deal.yearBuilt);
  const unitCountBand = getUnitCountBand(deal.units);
  const propertyType = getPropertyType(null, deal.units);
  
  const result = await pool.query(
    `INSERT INTO data_library_assets (
      property_name, city, state, unit_count, year_built,
      source_type, archive_folder_path,
      property_type, vintage_band, unit_count_band,
      trailing_noi, trailing_revenue, trailing_opex, opex_ratio, noi_per_unit, opex_per_unit,
      avg_rent, occupancy_pct, loss_to_lease_pct,
      broker_claims, extraction_data, source_files, parse_warnings,
      parse_status, parsed_at, data_quality_score, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      'archive', $6,
      $7, $8, $9,
      $10, $11, $12, $13, $14, $15,
      $16, $17, $18,
      $19, $20, $21, $22,
      'complete', NOW(), 60, NOW(), NOW()
    )
    ON CONFLICT (archive_folder_path) WHERE archive_folder_path IS NOT NULL
    DO UPDATE SET
      property_name = EXCLUDED.property_name,
      city = COALESCE(EXCLUDED.city, data_library_assets.city),
      state = COALESCE(EXCLUDED.state, data_library_assets.state),
      unit_count = COALESCE(EXCLUDED.unit_count, data_library_assets.unit_count),
      property_type = EXCLUDED.property_type,
      vintage_band = EXCLUDED.vintage_band,
      unit_count_band = EXCLUDED.unit_count_band,
      trailing_noi = EXCLUDED.trailing_noi,
      trailing_revenue = EXCLUDED.trailing_revenue,
      trailing_opex = EXCLUDED.trailing_opex,
      opex_ratio = EXCLUDED.opex_ratio,
      noi_per_unit = EXCLUDED.noi_per_unit,
      opex_per_unit = EXCLUDED.opex_per_unit,
      avg_rent = EXCLUDED.avg_rent,
      occupancy_pct = EXCLUDED.occupancy_pct,
      loss_to_lease_pct = EXCLUDED.loss_to_lease_pct,
      broker_claims = EXCLUDED.broker_claims,
      extraction_data = EXCLUDED.extraction_data,
      source_files = EXCLUDED.source_files,
      parse_warnings = EXCLUDED.parse_warnings,
      parse_status = 'complete',
      parsed_at = NOW(),
      updated_at = NOW()
    RETURNING id`,
    [
      deal.propertyName,
      deal.city,
      deal.state,
      deal.units,
      deal.yearBuilt,
      deal.folderPath,
      propertyType,
      vintageBand,
      unitCountBand,
      deal.trailingNoi,
      deal.trailingRevenue,
      deal.trailingOpex,
      deal.opexRatio,
      deal.noiPerUnit,
      deal.opexPerUnit,
      deal.avgRent,
      deal.occupancyPct,
      deal.lossToLeasePct,
      JSON.stringify(deal.brokerClaims),
      JSON.stringify(deal.extractionData),
      JSON.stringify(deal.sourceFiles.map(f => ({ name: f.name, type: f.type, path: f.path }))),
      deal.parseWarnings,
    ]
  );
  
  return result.rows[0]?.id;
}

// ─── Main Ingestion Function ──────────────────────────────────────────────────

export async function ingestArchiveDeals(
  archivePath: string,
  options: { limit?: number; skipExisting?: boolean } = {}
): Promise<ArchiveScanResult> {
  const pool = getPool();
  const result: ArchiveScanResult = {
    totalFolders: 0,
    parsedFolders: 0,
    skippedFolders: 0,
    errors: [],
    warnings: [],
  };
  
  logger.info(`Starting archive ingestion from: ${archivePath}`);
  
  // Scan for deal folders
  const folders = scanArchiveFolder(archivePath);
  result.totalFolders = folders.length;
  
  if (options.limit) {
    folders.splice(options.limit);
  }
  
  // Check existing if skipExisting
  let existingPaths = new Set<string>();
  if (options.skipExisting) {
    const existing = await pool.query(
      `SELECT archive_folder_path FROM data_library_assets WHERE archive_folder_path IS NOT NULL`
    );
    existingPaths = new Set(existing.rows.map(r => r.archive_folder_path));
  }
  
  // Process each folder
  for (const folder of folders) {
    if (existingPaths.has(folder.path)) {
      result.skippedFolders++;
      continue;
    }
    
    try {
      const parsed = await parseArchiveDeal(folder);
      await upsertArchiveDeal(pool, parsed);
      result.parsedFolders++;
      
      if (parsed.parseWarnings.length > 0) {
        result.warnings.push(`${folder.name}: ${parsed.parseWarnings.join('; ')}`);
      }
      
      logger.info(`Parsed archive deal: ${folder.name} (${parsed.units || '?'} units, NOI: $${parsed.trailingNoi?.toLocaleString() || '?'})`);
    } catch (err) {
      result.errors.push(`${folder.name}: ${err instanceof Error ? err.message : String(err)}`);
      logger.error(`Error parsing ${folder.name}:`, err);
    }
  }
  
  logger.info(`Archive ingestion complete: ${result.parsedFolders}/${result.totalFolders} parsed, ${result.errors.length} errors`);
  return result;
}

// ─── Query Functions for CashFlow Agent ───────────────────────────────────────

export interface ArchiveCompQuery {
  state?: string;
  msa?: string;
  propertyType?: string;
  vintageBand?: string;
  unitCountBand?: string;
  minUnits?: number;
  maxUnits?: number;
}

export interface ArchiveCompStats {
  field: string;
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  sampleCount: number;
}

export async function getArchiveCompStats(
  query: ArchiveCompQuery,
  fields: string[] = ['opex_ratio', 'noi_per_unit', 'opex_per_unit', 'occupancy_pct', 'avg_rent']
): Promise<ArchiveCompStats[]> {
  const pool = getPool();
  const conditions: string[] = ["source_type = 'archive'"];
  const params: (string | number)[] = [];
  let paramIndex = 1;
  
  if (query.state) {
    conditions.push(`state = $${paramIndex++}`);
    params.push(query.state);
  }
  if (query.propertyType) {
    conditions.push(`property_type = $${paramIndex++}`);
    params.push(query.propertyType);
  }
  if (query.vintageBand) {
    conditions.push(`vintage_band = $${paramIndex++}`);
    params.push(query.vintageBand);
  }
  if (query.unitCountBand) {
    conditions.push(`unit_count_band = $${paramIndex++}`);
    params.push(query.unitCountBand);
  }
  if (query.minUnits) {
    conditions.push(`unit_count >= $${paramIndex++}`);
    params.push(query.minUnits);
  }
  if (query.maxUnits) {
    conditions.push(`unit_count <= $${paramIndex++}`);
    params.push(query.maxUnits);
  }
  
  const whereClause = conditions.join(' AND ');
  const stats: ArchiveCompStats[] = [];
  
  for (const field of fields) {
    const result = await pool.query(
      `SELECT 
        PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY ${field}) as p10,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ${field}) as p25,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY ${field}) as p50,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${field}) as p75,
        PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY ${field}) as p90,
        COUNT(*) as sample_count
      FROM data_library_assets
      WHERE ${whereClause} AND ${field} IS NOT NULL`,
      params
    );
    
    const row = result.rows[0];
    stats.push({
      field,
      p10: row?.p10 ? parseFloat(row.p10) : null,
      p25: row?.p25 ? parseFloat(row.p25) : null,
      p50: row?.p50 ? parseFloat(row.p50) : null,
      p75: row?.p75 ? parseFloat(row.p75) : null,
      p90: row?.p90 ? parseFloat(row.p90) : null,
      sampleCount: parseInt(row?.sample_count) || 0,
    });
  }
  
  return stats;
}

export async function getArchiveComps(
  query: ArchiveCompQuery,
  limit = 10
): Promise<Array<{
  id: string;
  propertyName: string;
  city: string | null;
  state: string | null;
  units: number | null;
  trailingNoi: number | null;
  opexRatio: number | null;
  avgRent: number | null;
  occupancyPct: number | null;
}>> {
  const pool = getPool();
  const conditions: string[] = ["source_type = 'archive'"];
  const params: (string | number)[] = [];
  let paramIndex = 1;
  
  if (query.state) {
    conditions.push(`state = $${paramIndex++}`);
    params.push(query.state);
  }
  if (query.propertyType) {
    conditions.push(`property_type = $${paramIndex++}`);
    params.push(query.propertyType);
  }
  if (query.vintageBand) {
    conditions.push(`vintage_band = $${paramIndex++}`);
    params.push(query.vintageBand);
  }
  if (query.unitCountBand) {
    conditions.push(`unit_count_band = $${paramIndex++}`);
    params.push(query.unitCountBand);
  }
  
  params.push(limit);
  
  const result = await pool.query(
    `SELECT id, property_name, city, state, unit_count, 
            trailing_noi, opex_ratio, avg_rent, occupancy_pct
     FROM data_library_assets
     WHERE ${conditions.join(' AND ')}
     ORDER BY trailing_noi DESC NULLS LAST
     LIMIT $${paramIndex}`,
    params
  );
  
  return result.rows.map(r => ({
    id: r.id,
    propertyName: r.property_name,
    city: r.city,
    state: r.state,
    units: r.unit_count,
    trailingNoi: r.trailing_noi ? parseFloat(r.trailing_noi) : null,
    opexRatio: r.opex_ratio ? parseFloat(r.opex_ratio) : null,
    avgRent: r.avg_rent ? parseFloat(r.avg_rent) : null,
    occupancyPct: r.occupancy_pct ? parseFloat(r.occupancy_pct) : null,
  }));
}
