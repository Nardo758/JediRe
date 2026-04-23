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
  type: 'T12' | 'RENT_ROLL' | 'TAX_BILL' | 'OM' | 'COSTAR' | 'OTHER' | 'UNKNOWN';
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
  msa: string | null;
  units: number | null;
  yearBuilt: number | null;
  stories: number | null;
  assetClass: string | null;  // A, B, C, D
  dealType: string | null;    // stabilized, value-add, lease-up, development
  
  // Financial metrics (from T12)
  trailingNoi: number | null;
  trailingRevenue: number | null;
  trailingOpex: number | null;
  opexRatio: number | null;
  noiPerUnit: number | null;
  opexPerUnit: number | null;
  
  // Cap rates (from OM)
  goingInCapRate: number | null;
  stabilizedCapRate: number | null;
  exitCapRate: number | null;
  
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

const COSTAR_PATTERNS = [
  /costar/i, /property.*summary/i, /market.*analytics/i,
];

function classifyFile(filename: string): ArchiveFile['type'] {
  const lower = filename.toLowerCase();
  
  // Check patterns in order of specificity
  if (COSTAR_PATTERNS.some(p => p.test(lower))) return 'COSTAR';
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

// MSA mapping (simplified - major metros)
const CITY_TO_MSA: Record<string, string> = {
  // Georgia
  'atlanta': 'Atlanta-Sandy Springs-Alpharetta, GA',
  'sandy springs': 'Atlanta-Sandy Springs-Alpharetta, GA',
  'alpharetta': 'Atlanta-Sandy Springs-Alpharetta, GA',
  'marietta': 'Atlanta-Sandy Springs-Alpharetta, GA',
  'roswell': 'Atlanta-Sandy Springs-Alpharetta, GA',
  'johns creek': 'Atlanta-Sandy Springs-Alpharetta, GA',
  'duluth': 'Atlanta-Sandy Springs-Alpharetta, GA',
  'lawrenceville': 'Atlanta-Sandy Springs-Alpharetta, GA',
  'kennesaw': 'Atlanta-Sandy Springs-Alpharetta, GA',
  'smyrna': 'Atlanta-Sandy Springs-Alpharetta, GA',
  'decatur': 'Atlanta-Sandy Springs-Alpharetta, GA',
  // Florida
  'miami': 'Miami-Fort Lauderdale-Pompano Beach, FL',
  'fort lauderdale': 'Miami-Fort Lauderdale-Pompano Beach, FL',
  'pompano beach': 'Miami-Fort Lauderdale-Pompano Beach, FL',
  'boca raton': 'Miami-Fort Lauderdale-Pompano Beach, FL',
  'west palm beach': 'Miami-Fort Lauderdale-Pompano Beach, FL',
  'orlando': 'Orlando-Kissimmee-Sanford, FL',
  'kissimmee': 'Orlando-Kissimmee-Sanford, FL',
  'tampa': 'Tampa-St. Petersburg-Clearwater, FL',
  'st. petersburg': 'Tampa-St. Petersburg-Clearwater, FL',
  'clearwater': 'Tampa-St. Petersburg-Clearwater, FL',
  'jacksonville': 'Jacksonville, FL',
  // Texas
  'dallas': 'Dallas-Fort Worth-Arlington, TX',
  'fort worth': 'Dallas-Fort Worth-Arlington, TX',
  'arlington': 'Dallas-Fort Worth-Arlington, TX',
  'plano': 'Dallas-Fort Worth-Arlington, TX',
  'frisco': 'Dallas-Fort Worth-Arlington, TX',
  'houston': 'Houston-The Woodlands-Sugar Land, TX',
  'the woodlands': 'Houston-The Woodlands-Sugar Land, TX',
  'sugar land': 'Houston-The Woodlands-Sugar Land, TX',
  'austin': 'Austin-Round Rock-Georgetown, TX',
  'round rock': 'Austin-Round Rock-Georgetown, TX',
  'san antonio': 'San Antonio-New Braunfels, TX',
  // North Carolina
  'charlotte': 'Charlotte-Concord-Gastonia, NC-SC',
  'concord': 'Charlotte-Concord-Gastonia, NC-SC',
  'raleigh': 'Raleigh-Cary, NC',
  'cary': 'Raleigh-Cary, NC',
  'durham': 'Durham-Chapel Hill, NC',
  'chapel hill': 'Durham-Chapel Hill, NC',
  // Tennessee
  'nashville': 'Nashville-Davidson-Murfreesboro-Franklin, TN',
  'murfreesboro': 'Nashville-Davidson-Murfreesboro-Franklin, TN',
  'franklin': 'Nashville-Davidson-Murfreesboro-Franklin, TN',
  // South Carolina
  'charleston': 'Charleston-North Charleston, SC',
  'greenville': 'Greenville-Anderson, SC',
  'columbia': 'Columbia, SC',
  // Arizona
  'phoenix': 'Phoenix-Mesa-Chandler, AZ',
  'mesa': 'Phoenix-Mesa-Chandler, AZ',
  'scottsdale': 'Phoenix-Mesa-Chandler, AZ',
  'chandler': 'Phoenix-Mesa-Chandler, AZ',
  // Colorado
  'denver': 'Denver-Aurora-Lakewood, CO',
  'aurora': 'Denver-Aurora-Lakewood, CO',
};

function inferMSA(city: string | null, state: string | null): string | null {
  if (!city) return null;
  const key = city.toLowerCase().trim();
  return CITY_TO_MSA[key] || null;
}

function inferAssetClass(
  yearBuilt: number | null, 
  avgRent: number | null,
  amenities: string[] | undefined
): string {
  // Simple heuristic based on year built and rent levels
  const currentYear = new Date().getFullYear();
  const age = yearBuilt ? currentYear - yearBuilt : null;
  
  // Premium amenities suggest Class A
  const premiumAmenities = ['rooftop', 'concierge', 'valet', 'wine', 'co-working', 'smart home'];
  const hasPremiumAmenities = amenities?.some(a => 
    premiumAmenities.some(p => a.toLowerCase().includes(p))
  );
  
  if (hasPremiumAmenities) return 'A';
  if (age !== null && age <= 10) return 'A';
  if (age !== null && age <= 20) return 'B';
  if (age !== null && age <= 35) return 'C';
  if (age !== null && age > 35) return 'D';
  
  // Fallback to rent-based classification
  if (avgRent && avgRent >= 2000) return 'A';
  if (avgRent && avgRent >= 1400) return 'B';
  if (avgRent && avgRent >= 1000) return 'C';
  
  return 'B'; // default
}

function inferDealType(
  omData: OMExtraction | null,
  occupancyPct: number | null
): string {
  // Check OM signals
  if (omData?.keyEvents.leaseUpInProgress) return 'lease-up';
  if (omData?.keyEvents.renovationPlanned) return 'value-add';
  if (omData?.capitalPlan.totalCapexBudget && omData.capitalPlan.totalCapexBudget > 1000000) return 'value-add';
  if (omData?.capitalPlan.valueAddStrategy) return 'value-add';
  
  // Check occupancy
  if (occupancyPct !== null && occupancyPct < 0.85) return 'lease-up';
  
  // Check investment thesis keywords
  const thesis = omData?.investmentThesis?.toLowerCase() || '';
  const highlights = (omData?.investmentHighlights || []).join(' ').toLowerCase();
  const combined = thesis + ' ' + highlights;
  
  if (combined.includes('value-add') || combined.includes('renovation') || combined.includes('upgrade')) {
    return 'value-add';
  }
  if (combined.includes('lease-up') || combined.includes('stabiliz')) {
    return 'lease-up';
  }
  if (combined.includes('development') || combined.includes('new construction')) {
    return 'development';
  }
  
  return 'stabilized'; // default
}

// ─── Folder Scanner ───────────────────────────────────────────────────────────

export function scanArchiveFolder(archivePath: string, rootLabel?: string): ArchiveDealFolder[] {
  const folders: ArchiveDealFolder[] = [];
  
  if (!fs.existsSync(archivePath)) {
    logger.error(`Archive path does not exist: ${archivePath}`);
    return folders;
  }
  
  const entries = fs.readdirSync(archivePath, { withFileTypes: true });

  // Collect subdirectory-based deal folders (standard ZIP structure)
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

  // If no subdirectories found, treat root-level files as a single deal folder.
  // This handles flat uploads where files are dropped individually (not zipped into folders).
  if (folders.length === 0) {
    const rootFiles = entries
      .filter(e => e.isFile())
      .map(e => {
        const ext = getExtension(e.name);
        if (!['xlsx', 'xls', 'pdf', 'csv'].includes(ext)) return null;
        return {
          name: e.name,
          path: path.join(archivePath, e.name),
          type: classifyFile(e.name),
          extension: ext,
        } as ArchiveFile;
      })
      .filter((f): f is ArchiveFile => f !== null);

    if (rootFiles.length > 0) {
      folders.push({
        name: rootLabel || path.basename(archivePath),
        path: archivePath,
        files: rootFiles,
      });
      logger.info(`No subfolders found — treating ${rootFiles.length} root-level file(s) as a single deal`);
    }
  }
  
  logger.info(`Scanned ${folders.length} deal folder(s) in archive`);
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
        trailingRevenue = result.summary.t12Revenue ? Number(result.summary.t12Revenue) : null;
        trailingOpex = result.summary.t12OpEx ? Number(result.summary.t12OpEx) : null;
        trailingNoi = result.summary.t12NOI ? Number(result.summary.t12NOI) : null;
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
        units = result.summary.totalUnits ? Number(result.summary.totalUnits) : null;
        avgRent = result.summary.avgEffectiveRent ? Number(result.summary.avgEffectiveRent) : (result.summary.avgMarketRent ? Number(result.summary.avgMarketRent) : null);
        occupancyPct = result.summary.occupancyRate ? Number(result.summary.occupancyRate) : null;
        lossToLeasePct = result.summary.lossToLeasePct ? Number(result.summary.lossToLeasePct) : null;
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
        const taxData = result.data as any;
        annualTax = taxData.totalAnnualTax || null;
        assessedValue = taxData.assessedValue || null;
        extractionData.taxBill = result.data;
      } else {
        warnings.push(`[TAX] Parse failed: ${result.error || 'unknown'}`);
      }
    } catch (err) {
      warnings.push(`[TAX] Error reading ${taxFile.name}: ${err}`);
    }
  }
  
  // Find and parse CoStar Property Summary
  const costarFiles = folder.files.filter(f => f.type === 'COSTAR' && f.extension === 'pdf');
  let costarData: any = null;
  if (costarFiles.length > 0) {
    const costarFile = costarFiles[0];
    try {
      const buffer = fs.readFileSync(costarFile.path);
      const { parseCoStarPDF } = await import('./document-extraction/parsers/costar-parser');
      const result = await parseCoStarPDF(buffer, costarFile.name);
      
      if (result.success && result.data) {
        costarData = result.data;
        extractionData.costar = costarData;
        
        // Extract data from CoStar (can override other sources as it's typically most accurate)
        if (costarData.units) units = costarData.units;
        if (costarData.askingRentPerUnit) avgRent = costarData.askingRentPerUnit;
        if (costarData.vacancyPct !== null) occupancyPct = 100 - costarData.vacancyPct;
        
        if (result.warnings?.length) {
          warnings.push(...result.warnings.map((w: string) => `[COSTAR] ${w}`));
        }
      } else {
        warnings.push(`[COSTAR] Parse failed: ${result.error || 'unknown'}`);
      }
    } catch (err) {
      warnings.push(`[COSTAR] Error reading ${costarFile.name}: ${err}`);
    }
  }
  
  // Find and parse OM (AI-assisted)
  let omData: OMExtraction | null = null;
  let brokerClaims: Record<string, unknown> = {};
  let yearBuilt: number | null = null;
  let city: string | null = null;
  
  // Use CoStar data for year/city if available
  if (costarData) {
    if (costarData.yearBuilt) yearBuilt = costarData.yearBuilt;
    if (costarData.city) city = costarData.city;
  }
  
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
  
  // Extract stories from OM
  const stories = omData?.property.stories || null;
  
  // Extract cap rates from OM
  const goingInCapRate = omData?.brokerProforma.goingInCapRate || null;
  const stabilizedCapRate = omData?.brokerProforma.stabilizedNOI && omData?.metadata.askingPrice
    ? omData.brokerProforma.stabilizedNOI / omData.metadata.askingPrice
    : null;
  const exitCapRate = omData?.brokerProforma.exitCapRate || null;
  
  // Infer MSA from city/state (simplified mapping)
  const msa = inferMSA(city, state);
  
  // Infer asset class from year built and rent levels
  const assetClass = inferAssetClass(yearBuilt, avgRent, omData?.property.amenities);
  
  // Infer deal type from OM signals
  const dealType = inferDealType(omData, occupancyPct);
  
  return {
    folderName: folder.name,
    folderPath: folder.path,
    propertyName: omData?.property.name || folder.name.replace(/[-–]\s*[A-Z]{2}$/i, '').trim(),
    city,
    state,
    msa,
    units,
    yearBuilt,
    stories,
    assetClass,
    dealType,
    trailingNoi,
    trailingRevenue,
    trailingOpex,
    opexRatio,
    noiPerUnit,
    opexPerUnit,
    goingInCapRate,
    stabilizedCapRate,
    exitCapRate,
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

async function upsertArchiveDeal(pool: Pool, deal: ParsedArchiveDeal, existingAssetId?: string): Promise<string> {
  const propertyType = deal.stories ? getPropertyType(deal.stories, deal.units) : 'garden';

  const mergedExtraction = {
    ...deal.extractionData,
    brokerClaims: deal.brokerClaims,
    sourceFiles: deal.sourceFiles.map(f => ({ name: f.name, type: f.type })),
    parseWarnings: deal.parseWarnings,
  };

  const dqScore = computeDQ({
    unit_count: deal.units,
    avg_rent: deal.avgRent,
    occupancy_rate: deal.occupancyPct,
    cap_rate: deal.goingInCapRate,
    noi: deal.trailingNoi,
    city: deal.city,
    year_built: deal.yearBuilt,
  });

  // If updating an existing asset, only fill in blanks (COALESCE) and merge extraction_data.
  if (existingAssetId) {
    const upd = await pool.query(
      `UPDATE data_library_assets SET
         city           = COALESCE(city,           $2),
         state          = COALESCE(state,          $3),
         unit_count     = COALESCE(unit_count,     $4),
         year_built     = COALESCE(year_built,     $5),
         property_type  = COALESCE(property_type,  $6),
         stories        = COALESCE(stories,        $7),
         msa_name       = COALESCE(msa_name,       $8),
         asset_class    = COALESCE(asset_class,    $9),
         cap_rate       = COALESCE(cap_rate,       $10),
         noi            = COALESCE(noi,            $11),
         noi_per_unit   = COALESCE(noi_per_unit,   $12),
         expense_ratio  = COALESCE(expense_ratio,  $13),
         avg_rent       = COALESCE(avg_rent,       $14),
         occupancy_rate = COALESCE(occupancy_rate, $15),
         extraction_data = COALESCE(extraction_data, '{}'::jsonb) || $16::jsonb,
         data_quality_score = GREATEST(COALESCE(data_quality_score, 0), $17),
         source_type    = CASE WHEN source_type = 'manual' THEN 'archive' ELSE source_type END,
         updated_at     = NOW()
       WHERE id = $1
       RETURNING id`,
      [
        existingAssetId,
        deal.city, deal.state, deal.units, deal.yearBuilt,
        propertyType, deal.stories, deal.msa, deal.assetClass,
        deal.goingInCapRate, deal.trailingNoi, deal.noiPerUnit, deal.opexRatio,
        deal.avgRent, deal.occupancyPct,
        JSON.stringify(mergedExtraction),
        dqScore,
      ]
    );
    return upd.rows[0]?.id;
  }

  const result = await pool.query(
    `INSERT INTO data_library_assets (
      property_name, city, state, unit_count, year_built,
      source_type,
      property_type,
      stories, msa_name, asset_class,
      cap_rate,
      noi, noi_per_unit, expense_ratio,
      avg_rent, occupancy_rate,
      extraction_data, data_quality_score, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      'archive',
      $6,
      $7, $8, $9,
      $10,
      $11, $12, $13,
      $14, $15,
      $16, $17, NOW(), NOW()
    )
    RETURNING id`,
    [
      deal.propertyName,
      deal.city,
      deal.state,
      deal.units,
      deal.yearBuilt,
      propertyType,
      deal.stories,
      deal.msa,
      deal.assetClass,
      deal.goingInCapRate,
      deal.trailingNoi,
      deal.noiPerUnit,
      deal.opexRatio,
      deal.avgRent,
      deal.occupancyPct,
      JSON.stringify(mergedExtraction),
      dqScore,
    ]
  );

  return result.rows[0]?.id;
}

function computeDQ(fields: Record<string, unknown>): number {
  const weights: Record<string, number> = {
    unit_count: 15, avg_rent: 20, occupancy_rate: 20,
    cap_rate: 15, noi: 15, city: 10, year_built: 5,
  };
  let score = 0;
  for (const [key, weight] of Object.entries(weights)) {
    if (fields[key] !== null && fields[key] !== undefined) score += weight;
  }
  return score;
}

// ─── Main Ingestion Function ──────────────────────────────────────────────────

export async function ingestArchiveDeals(
  archivePath: string,
  options: { limit?: number; skipExisting?: boolean; rootLabel?: string; existingAssetId?: string } = {}
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
  
  // Scan for deal folders (pass rootLabel so flat uploads get named correctly)
  const folders = scanArchiveFolder(archivePath, options.rootLabel);
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
      await upsertArchiveDeal(pool, parsed, options.existingAssetId);
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
  assetClass?: string;
  dealType?: string;
  minUnits?: number;
  maxUnits?: number;
  minStories?: number;
  maxStories?: number;
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
  fields: string[] = ['opex_ratio', 'noi_per_unit', 'opex_per_unit', 'occupancy_pct', 'avg_rent', 'going_in_cap_rate', 'stabilized_cap_rate', 'exit_cap_rate']
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
  if (query.assetClass) {
    conditions.push(`asset_class = $${paramIndex++}`);
    params.push(query.assetClass);
  }
  if (query.dealType) {
    conditions.push(`deal_type = $${paramIndex++}`);
    params.push(query.dealType);
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
