import * as XLSX from 'xlsx';
import { BoxScoreData, BoxScoreAvailability, BoxScoreActivity, BoxScoreConversion, ExtractionResult } from '../types';

function parseNum(val: any): number {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let s = String(val).trim().replace(/[$,%\s]/g, '');
  if (!s || s === '-' || s === '—') return 0;
  let neg = false;
  if (s.startsWith('(') && s.endsWith(')')) { neg = true; s = s.slice(1, -1); }
  else if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : (neg ? -n : n);
}

function parsePct(val: any): number {
  const n = parseNum(val);
  return n > 1 ? n / 100 : n;
}

function findCol(headers: string[], patterns: RegExp[]): string | null {
  for (const h of headers) {
    for (const p of patterns) {
      if (p.test(h)) return h;
    }
  }
  return null;
}

export function parseBoxScore(buffer: Buffer, filename: string): ExtractionResult {
  const warnings: string[] = [];

  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const availability: BoxScoreAvailability[] = [];
    const conversions: BoxScoreConversion[] = [];
    const activity: BoxScoreActivity = {
      moveIns: 0, moveOuts: 0, notices: 0, renewals: 0,
      transfers: 0, mtmConversions: 0, evictions: 0, skips: 0,
    };

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: null });
      if (rows.length === 0) continue;

      const headers = Object.keys(rows[0]);
      const headerStr = headers.join(' ').toLowerCase();

      if (headerStr.includes('occupied') && headerStr.includes('vacant')) {
        const fpCol = findCol(headers, [/floor[\s_-]*plan/i, /type/i, /model/i, /unit/i]) || headers[0];
        const occCol = findCol(headers, [/occupied/i, /occ$/i]);
        const vacCol = findCol(headers, [/vacant/i, /vac$/i]);
        const noticeCol = findCol(headers, [/notice/i, /ntv/i]);
        const rentedCol = findCol(headers, [/rented/i, /pre-leased/i]);
        const modelCol = findCol(headers, [/model/i]);
        const downCol = findCol(headers, [/down/i, /offline/i]);
        const adminCol = findCol(headers, [/admin/i]);
        const totalCol = findCol(headers, [/total/i, /units/i]);
        const occPctCol = findCol(headers, [/occ[\s_]*%/i, /%[\s_]*occ/i, /occupancy/i]);
        const leasedPctCol = findCol(headers, [/leased[\s_]*%/i, /%[\s_]*leased/i]);

        for (const row of rows) {
          const fp = String(row[fpCol] || '').trim();
          if (!fp || /^(total|subtotal|grand|summary)/i.test(fp)) continue;

          const occ = occCol ? parseNum(row[occCol]) : 0;
          const vac = vacCol ? parseNum(row[vacCol]) : 0;
          const total = totalCol ? parseNum(row[totalCol]) : (occ + vac);

          availability.push({
            floorPlan: fp,
            occupied: occ,
            vacant: vac,
            notice: noticeCol ? parseNum(row[noticeCol]) : 0,
            rented: rentedCol ? parseNum(row[rentedCol]) : 0,
            model: modelCol ? parseNum(row[modelCol]) : 0,
            down: downCol ? parseNum(row[downCol]) : 0,
            admin: adminCol ? parseNum(row[adminCol]) : 0,
            total,
            occupancyPct: occPctCol ? parsePct(row[occPctCol]) : (total > 0 ? occ / total : 0),
            leasedPct: leasedPctCol ? parsePct(row[leasedPctCol]) : 0,
          });
        }
      }

      if (headerStr.includes('move') || headerStr.includes('renewal') || headerStr.includes('notice')) {
        for (const row of rows) {
          const label = String(Object.values(row)[0] || '').toLowerCase();
          const val = parseNum(Object.values(row)[1]);
          if (label.includes('move-in') || label.includes('move in')) activity.moveIns += val;
          else if (label.includes('move-out') || label.includes('move out')) activity.moveOuts += val;
          else if (label.includes('notice')) activity.notices += val;
          else if (label.includes('renewal')) activity.renewals += val;
          else if (label.includes('transfer')) activity.transfers += val;
          else if (label.includes('mtm') || label.includes('month-to-month')) activity.mtmConversions += val;
          else if (label.includes('eviction')) activity.evictions += val;
          else if (label.includes('skip')) activity.skips += val;
        }
      }

      if (headerStr.includes('contact') || headerStr.includes('show') || headerStr.includes('applied')) {
        const channelCol = findCol(headers, [/channel/i, /source/i, /type/i]) || headers[0];
        const contactCol = findCol(headers, [/contact/i, /inquiry/i, /lead/i]);
        const showCol = findCol(headers, [/show/i, /tour/i, /visit/i]);
        const appliedCol = findCol(headers, [/applied/i, /application/i, /app$/i]);
        const approvedCol = findCol(headers, [/approved/i, /approve/i]);
        const leasedCol = findCol(headers, [/leased/i, /signed/i, /close/i]);

        for (const row of rows) {
          const channel = String(row[channelCol] || '').trim();
          if (!channel || /^(total|grand)/i.test(channel)) continue;

          const contacts = contactCol ? parseNum(row[contactCol]) : 0;
          const shows = showCol ? parseNum(row[showCol]) : 0;
          const applied = appliedCol ? parseNum(row[appliedCol]) : 0;
          const approved = approvedCol ? parseNum(row[approvedCol]) : 0;
          const leased = leasedCol ? parseNum(row[leasedCol]) : 0;

          conversions.push({
            channel,
            firstContacts: contacts,
            shows,
            applied,
            approved,
            leased,
            conversionRate: contacts > 0 ? leased / contacts : 0,
          });
        }
      }
    }

    const totalOcc = availability.reduce((s, a) => s + a.occupied, 0);
    const totalVac = availability.reduce((s, a) => s + a.vacant, 0);
    const totalUnits = availability.reduce((s, a) => s + a.total, 0);
    const totalContacts = conversions.reduce((s, c) => s + c.firstContacts, 0);
    const totalLeased = conversions.reduce((s, c) => s + c.leased, 0);

    const data: BoxScoreData = {
      availability,
      activity,
      conversions,
      summary: {
        totalUnits,
        totalOccupied: totalOcc,
        totalVacant: totalVac,
        occupancyPct: totalUnits > 0 ? totalOcc / totalUnits : 0,
        leasedPct: availability.length > 0 ? availability.reduce((s, a) => s + a.leasedPct, 0) / availability.length : 0,
        netAbsorption: activity.moveIns - activity.moveOuts,
        overallConversionRate: totalContacts > 0 ? totalLeased / totalContacts : 0,
      },
    };

    return { documentType: 'BOX_SCORE', success: true, data, summary: data.summary, warnings };
  } catch (err) {
    return {
      documentType: 'BOX_SCORE', success: false,
      error: err instanceof Error ? err.message : 'Unknown parse error',
      data: null, summary: {}, warnings,
    };
  }
}
