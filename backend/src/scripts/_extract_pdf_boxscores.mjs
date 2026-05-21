/**
 * Extract all PDF BoxScore files to text, parse leasing sections,
 * then POST to the Replit ingest endpoint.
 *
 * Usage: node src/scripts/_extract_pdf_boxscores.mjs
 */

import fs from 'fs';
import path from 'path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.min.mjs';

const ARCHIVE_ROOT = path.resolve(
  process.env.USERPROFILE || 'C:\\Users\\Leon',
  'OneDrive - Myers Apartment Group\\Deals\\Archive',
);

const INGEST_ENDPOINT = 'https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev/api/v1/archive/ingest-rows';

const BATCH_SIZE = 50;

function log(level, msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [${level.toUpperCase()}] ${msg}`);
}

function parseNum(v) {
  if (v == null || v === '') return null;
  const s = String(v).replace(/[^0-9.\-]/g, '');
  if (!s) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ─── PDF Text Extraction with line reconstruction ───────────────────────────

async function extractPdfLines(filePath) {
  const buf = fs.readFileSync(filePath);
  const uint8 = new Uint8Array(buf);
  const doc = await getDocument({ data: uint8, useSystemFonts: true }).promise;
  const allLines = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let lastY = null;
    let lineItems = [];

    for (const item of content.items) {
      const y = Math.round(item.transform[5]);
      const x = Math.round(item.transform[4]);
      if (lastY !== null && y !== lastY) {
        allLines.push({ line: lineItems.join(' '), page: p });
        lineItems = [];
      }
      lineItems.push(item.str);
      lastY = y;
    }
    if (lineItems.length > 0) {
      allLines.push({ line: lineItems.join(' '), page: p });
    }
  }

  return allLines.map(l => l.line);
}

// ─── Parsing ────────────────────────────────────────────────────────────────

function parsePdfLeasing(lines) {
  const activity_rows = [];
  const new_leases = [];
  let period_start = null;
  let period_end = null;
  let total_units = 0;
  let total_occupied = 0;

  // Extract date range from any line
  for (const line of lines) {
    const drMatch = line.match(/Date\s*Range:\s*([\d/]+)\s*through\s*([\d/]+)/i);
    if (drMatch) {
      period_start = drMatch[1];
      period_end = drMatch[2];
      break;
    }
  }

  // Find the "Leasing -" section (starts "Leasing - MM/DD/YYYY")
  let leasingHeaderIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^Leasing\s*-?\s*[\d/]/.test(lines[i].trim())) {
      leasingHeaderIdx = i;
      break;
    }
  }

  if (leasingHeaderIdx >= 0) {
    // Next line after header should contain "Floor Plan Group" header
    // Then data lines follow until we hit a section boundary
    let gotHeader = false;
    for (let i = leasingHeaderIdx + 1; i < Math.min(leasingHeaderIdx + 60, lines.length); i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Detect header
      if (!gotHeader && (line.includes('Floor Plan Group') || line.includes('Floor Plan'))) {
        gotHeader = true;
        continue;
      }

      if (!gotHeader) continue;

      // Stop at section boundaries
      if (/^Leases\s*-/.test(line) || line.includes('Make Ready Status') ||
          line.includes('Not Made Ready') || /^Page\s+\d/.test(line) ||
          line.includes('Availability/Exposure') || line.includes('Availability ') ||
          line.startsWith('Parameters:') || line.startsWith('Vacant Units Make')) {
        break;
      }

      // Parse data rows — format: FloorPlanGroup  FloorPlan  Numbers...
      const parts = line.split(/\s+/).filter(Boolean);
      if (parts.length < 3) continue;

      // Skip header lines and subtotals
      if (parts[0] === 'Floor' || parts[0] === 'Totals:' || parts[0] === 'Grand') continue;

      // Property Totals line
      if (parts[0] === 'Property' && parts[1] === 'Totals:') {
        // Extract total units/occupied from Property Totals line
        // Format: Property Totals: UNITS OCCUPIED VACANT NOTICE...
        const units = parseNum(parts[2]);
        const occupied = parseNum(parts[3]);
        if (units && occupied != null) {
          total_units = units;
          total_occupied = occupied;
        }
        continue;
      }

      // Total lines
      if ((parts[0] === 'Total' || parts[0] === 'Totals:') && parts.length >= 4) {
        // Extract group total — skip but accumulate
        continue;
      }

      // Data rows: first two tokens are floor plan group + floor plan
      if (/^[A-Za-z]/.test(parts[0]) && /^[A-Za-z0-9]/.test(parts[1])) {
        const units = parseNum(parts[2]);
        if (!units || units === 0) continue;
        if (parts[0] === 'Units' || parts[0] === 'Occupied') continue;

        const row = {
          floorPlanGroup: parts[0],
          floorPlan: parts[1],
          units,
        };

        // For the PDF format, the columns after units/occupied are:
        // 2:Units, 3:Occupied, 4:Vacant, 5:Notice, 6:NoticeCnt, 
        // 7:Notice2, 8:NoticeCnt2, 9:MoveIns, 10:MoveOuts, 11:NetChange
        // Sometimes there are fewer columns.
        // Scan for move-in value (should be a small integer)
        for (let c = 8; c < parts.length; c++) {
          const val = parseNum(parts[c]);
          if (val !== null) {
            row.moveIns = val;
            if (c + 1 < parts.length) {
              const val2 = parseNum(parts[c + 1]);
              if (val2 !== null) row.moveOuts = val2;
            }
            if (c + 2 < parts.length) {
              const val3 = parseNum(parts[c + 2]);
              if (val3 !== null) row.netChange = val3;
            }
            break;
          }
        }

        activity_rows.push(row);

        // Also try to get occupied from the total lines
        const occupied = parseNum(parts[3]);
        if (occupied !== null) {
          if (!total_occupied && !total_units) {
            total_units = (total_units || 0) + units;
            total_occupied = (total_occupied || 0) + occupied;
          }
        }
      }
    }
  }

  // Find the "Leases - New Residents" section for individual lease data
  let newLeaseHeaderIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^Leases\s*-/.test(lines[i].trim()) && /Vacant|New|Resident/i.test(lines[i])) {
      newLeaseHeaderIdx = i;
      break;
    }
  }

  if (newLeaseHeaderIdx >= 0) {
    for (let i = newLeaseHeaderIdx + 1; i < Math.min(newLeaseHeaderIdx + 50, lines.length); i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Skip headers and boundaries
      if (line.includes('Community Transfer') || line.includes('Make Ready') ||
          /^Page\s+\d/.test(line) || line.includes('Not Made Ready') ||
          line.includes('Resident Activi')) {
        break;
      }

      // New lease rows: unit number, floor plan, name, apply date, move-in date, ...
      const parts = line.split(/\s+/).filter(Boolean);
      if (parts.length >= 6 && /^[A-Za-z0-9]/.test(parts[0]) && parts[1].length <= 8) {
        const lease = {
          unit: parts[0],
          floorPlan: parts[1],
          moveInDate: parts[4] || undefined,
          marketRent: parseNum(parts[7]) || undefined, // may be offset
        };
        // Skip header-like rows
        if (lease.unit !== 'Unit' && lease.unit !== 'Floor' &&
            lease.floorPlan !== 'Unit' && lease.floorPlan !== 'Name') {
          new_leases.push(lease);
        }
      }
    }
  }

  // Fallback: try to extract total units from "Total Occupied" or "Total Units" lines
  if (!total_units) {
    for (const line of lines) {
      const m = line.match(/Total Units:\s*(\d+)/i) || line.match(/Total Vacant:\s*(\d+)\s+Total Occupied:\s*(\d+)/i);
      if (m && m[1]) {
        total_units = parseInt(m[1], 10);
        if (m[2]) total_occupied = parseInt(m[2], 10);
        break;
      }
    }
  }

  // Fallback: count occupied from "Occupied:" or "Occupied" lines
  if (!total_occupied && !total_units) {
    // Try "Total Occupied:" pattern
    for (const line of lines) {
      const m = line.match(/Total Occupied:\s*(\d+)/i);
      if (m) {
        total_occupied = parseInt(m[1], 10);
      }
    }
  }

  return { activity_rows, new_leases, period_start, period_end, total_units, total_occupied };
}

// ─── Find PDF BoxScore Files ────────────────────────────────────────────────

function findPdfBoxScoreFiles(root) {
  const results = [];
  const entries = fs.readdirSync(root, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    const dirPath = path.join(root, entry.name);

    try {
      const files = fs.readdirSync(dirPath, { recursive: false });
      for (const file of files) {
        if (file.toLowerCase().endsWith('.pdf') &&
            /box.?score/i.test(file) &&
            !file.startsWith('~$')) {
          const filePath = path.join(dirPath, file);
          const stat = fs.statSync(filePath);
          results.push({ folderName: entry.name, fileName: file, filePath, sizeKb: Math.round(stat.size / 1024) });
        }
      }
    } catch {
      // skip unreadable
    }
  }

  return results;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  log('info', `=== PDF BoxScore Extraction ===`);
  log('info', `  Archive: ${ARCHIVE_ROOT}`);

  const pdfFiles = findPdfBoxScoreFiles(ARCHIVE_ROOT);
  log('info', `  Found ${pdfFiles.length} PDF BoxScore files`);
  for (const f of pdfFiles) {
    log('info', `    ${f.folderName} / ${f.fileName} (${f.sizeKb}KB)`);
  }

  let totalCorpusRows = 0;
  const batch = [];

  for (const pdfFile of pdfFiles) {
    log('info', `  Processing ${pdfFile.folderName} / ${pdfFile.fileName}...`);
    try {
      const lines = await extractPdfLines(pdfFile.filePath);
      const parsed = parsePdfLeasing(lines);

      log('info', `    Lines: ${lines.length}, Activity rows: ${parsed.activity_rows.length}, New leases: ${parsed.new_leases.length}, Units: ${parsed.total_units}, Occ: ${parsed.total_occupied}`);

      if (parsed.activity_rows.length === 0 && parsed.new_leases.length === 0 && !parsed.total_units && !parsed.total_occupied) {
        log('warn', `    No leasing data found`);
        // Still upload as metadata-only record
      }

      const obsDate = parsed.period_end || parsed.period_start || '2024-01-01';

      // Build corpus row
      const row = {
        parcel_id: pdfFile.folderName,
        observation_date: obsDate,
        source_signals: ['leasing_stats'],
        data_quality_tier: 'C1',
        source_file: pdfFile.fileName,
        document_type: 'BOX_SCORE',
        property_signing_velocity: parsed.activity_rows.reduce((s, r) => s + (r.moveIns || 0), 0),
      };

      // Add property-level stats
      if (parsed.total_units > 0) {
        row.property_unit_count = parsed.total_units;
      }
      if (parsed.total_occupied > 0 && parsed.total_units > 0) {
        row.property_occupancy = parsed.total_occupied / parsed.total_units;
      }

      batch.push(row);
      totalCorpusRows++;

      if (batch.length >= BATCH_SIZE) {
        await flushBatch(batch);
      }
    } catch (err) {
      log('error', `    Failed: ${err.message}`);
    }
  }

  // Final flush
  if (batch.length > 0) {
    await flushBatch(batch);
  }

  log('info', '');
  log('info', `  === Done: ${totalCorpusRows} corpus rows extracted from PDF BoxScores ===`);
}

async function flushBatch(batch) {
  const rows = batch.splice(0);
  log('info', `  POST ${rows.length} rows...`);
  try {
    const resp = await fetch(INGEST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ingest-secret': 'jedire-archive-2026' },
      body: JSON.stringify({ rows, dryRun: false }),
      signal: AbortSignal.timeout(60000),
    });
    const result = await resp.json();
    if (result.success) {
      log('info', `    ${result.inserted} inserted, ${result.updated} updated`);
    } else {
      log('warn', `    Server error: ${JSON.stringify(result).slice(0, 200)}`);
    }
  } catch (err) {
    log('error', `    POST failed: ${err.message}`);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
