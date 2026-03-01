import * as XLSX from 'xlsx';
import { pool } from '../database';
import { logger } from '../utils/logger';

export interface WeeklySnapshot {
  deal_id: string;
  property_name: string | null;
  week_ending: Date;
  total_units: number | null;
  traffic: number | null;
  in_person_tours: number | null;
  website_leads: number | null;
  apps: number | null;
  cancellations: number | null;
  denials: number | null;
  net_leases: number | null;
  closing_ratio: number | null;
  beg_occ: number | null;
  move_ins: number | null;
  move_outs: number | null;
  transfers: number | null;
  end_occ: number | null;
  vacant_model: number | null;
  vacant_rented: number | null;
  vacant_unrented: number | null;
  vacant_total: number | null;
  notice_rented: number | null;
  notice_unrented: number | null;
  notice_total: number | null;
  avail_1br: number | null;
  avail_2br: number | null;
  avail_3br: number | null;
  occ_pct: number | null;
  leased_pct: number | null;
  avail_pct: number | null;
  source: string;
}

export interface ProjectionPeriod {
  label: string;
  index: number;
  isActual: boolean;
  baseTraffic: number;
  baseTours: number;
  baseWebsite: number;
  baseWalkIn: number;
  baseApps: number;
  baseCancellations: number;
  baseDenials: number;
  baseNetLeases: number;
  baseClosingRatio: number;
  baseOccPct: number;
  baseLeasedPct: number;
  demandFactor: number;
  supplyFactor: number;
  digitalFactor: number;
  seasonalFactor: number;
  combinedFactor: number;
  adjTraffic: number;
  adjTours: number;
  adjWebsite: number;
  adjWalkIn: number;
  adjApps: number;
  adjNetLeases: number;
  adjClosingRatio: number;
  adjOccPct: number;
  adjLeasedPct: number;
  totalUnits: number;
  vacantTotal: number | null;
  noticeTotal: number | null;
}

export interface MarketIntelligence {
  demandSummary: string;
  demandFactor: number;
  demandDirection: 'up' | 'down' | 'neutral';
  supplySummary: string;
  supplyFactor: number;
  supplyDirection: 'up' | 'down' | 'neutral';
  digitalSummary: string;
  digitalFactor: number;
  digitalDirection: 'up' | 'down' | 'neutral';
  seasonalSummary: string;
  seasonalFactor: number;
  seasonalDirection: 'up' | 'down' | 'neutral';
  overallAdjustment: number;
  overallSummary: string;
}

export interface ProjectionResult {
  periods: ProjectionPeriod[];
  marketIntelligence: MarketIntelligence;
  actualsCount: number;
  projectedCount: number;
  view: 'weekly' | 'monthly' | 'yearly';
}

function excelDateToJS(serial: number): Date {
  const epoch = new Date(1899, 11, 30);
  return new Date(epoch.getTime() + serial * 86400000);
}

function safeNum(val: any): number | null {
  if (val === null || val === undefined || val === '' || val === '-') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function safeInt(val: any): number | null {
  const n = safeNum(val);
  return n !== null ? Math.round(n) : null;
}

export class WeeklyReportParserService {
  async parseAndStore(filePath: string, dealId: string): Promise<{ count: number; snapshots: WeeklySnapshot[] }> {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('weekly')) || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    const headerRow1 = rows[0] || [];
    const headerRow2 = rows[1] || [];

    const colMap = this.buildColumnMap(headerRow1, headerRow2);

    const snapshots: WeeklySnapshot[] = [];
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[colMap.weekEnding]) continue;

      const weekEndingRaw = row[colMap.weekEnding];
      let weekEnding: Date;
      if (typeof weekEndingRaw === 'number') {
        weekEnding = excelDateToJS(weekEndingRaw);
      } else if (weekEndingRaw instanceof Date) {
        weekEnding = weekEndingRaw;
      } else {
        const parsed = new Date(weekEndingRaw);
        if (isNaN(parsed.getTime())) continue;
        weekEnding = parsed;
      }

      const traffic = safeInt(row[colMap.traffic]);
      const inPersonTours = safeInt(row[colMap.inPersonTours]);
      const websiteLeads = traffic !== null && inPersonTours !== null
        ? Math.max(0, traffic - inPersonTours)
        : null;

      const snapshot: WeeklySnapshot = {
        deal_id: dealId,
        property_name: null,
        week_ending: weekEnding,
        total_units: safeInt(row[colMap.totalUnits]),
        traffic,
        in_person_tours: inPersonTours,
        website_leads: websiteLeads,
        apps: safeInt(row[colMap.apps]),
        cancellations: colMap.cancellations >= 0 ? safeInt(row[colMap.cancellations]) : safeInt(row[colMap.cancDeny]),
        denials: colMap.denials >= 0 ? safeInt(row[colMap.denials]) : null,
        net_leases: safeInt(row[colMap.netLeases]),
        closing_ratio: safeNum(row[colMap.closingRatio]),
        beg_occ: safeInt(row[colMap.begOcc]),
        move_ins: safeInt(row[colMap.moveIns]),
        move_outs: safeInt(row[colMap.moveOuts]),
        transfers: safeInt(row[colMap.transfers]),
        end_occ: safeInt(row[colMap.endOcc]),
        vacant_model: safeInt(row[colMap.vacantModel]),
        vacant_rented: safeInt(row[colMap.vacantRented]),
        vacant_unrented: safeInt(row[colMap.vacantUnrented]),
        vacant_total: safeInt(row[colMap.vacantTotal]),
        notice_rented: safeInt(row[colMap.noticeRented]),
        notice_unrented: safeInt(row[colMap.noticeUnrented]),
        notice_total: safeInt(row[colMap.noticeTotal]),
        avail_1br: safeInt(row[colMap.avail1br]),
        avail_2br: safeInt(row[colMap.avail2br]),
        avail_3br: safeInt(row[colMap.avail3br]),
        occ_pct: safeNum(row[colMap.occPct]),
        leased_pct: safeNum(row[colMap.leasedPct]),
        avail_pct: safeNum(row[colMap.availPct]),
        source: 'upload',
      };
      snapshots.push(snapshot);
    }

    for (const s of snapshots) {
      await this.upsertSnapshot(s);
    }

    logger.info(`[WeeklyReportParser] Parsed ${snapshots.length} weekly snapshots for deal ${dealId}`);
    return { count: snapshots.length, snapshots };
  }

  private buildColumnMap(row1: any[], row2: any[]): Record<string, number> {
    const combined = row1.map((h, i) => {
      const h1 = String(h || '').toLowerCase().trim();
      const h2 = String(row2[i] || '').toLowerCase().trim();
      return { h1, h2, idx: i };
    });

    const map: Record<string, number> = {
      weekEnding: 0, totalUnits: 1, traffic: 2, inPersonTours: 3,
      apps: 4, cancDeny: 5, cancellations: -1, denials: -1, netLeases: 6, closingRatio: 7,
      begOcc: 8, moveIns: 9, moveOuts: 10, transfers: 11, endOcc: 12,
      vacantModel: 13, vacantRented: 14, vacantUnrented: 15, vacantTotal: 16,
      noticeRented: 17, noticeUnrented: 18, noticeTotal: 19,
      avail1br: 20, avail2br: 21, avail3br: 22,
      occPct: 23, leasedPct: 24, availPct: 25,
    };

    for (const col of combined) {
      const label = col.h2 || col.h1;
      if (label.includes('week end')) map.weekEnding = col.idx;
      else if (label === 'total units' || label === 'units') map.totalUnits = col.idx;
      else if (label === 'traffic' && !label.includes('digital')) map.traffic = col.idx;
      else if (label.includes('in-person') || label.includes('in person') || label === 'tours') map.inPersonTours = col.idx;
      else if (label === 'apps' || label === 'applications') map.apps = col.idx;
      else if (label.includes('canc') && label.includes('deny')) map.cancDeny = col.idx;
      else if (label.includes('canc') && !label.includes('deny')) map.cancellations = col.idx;
      else if (label.includes('deny') || label.includes('denial')) map.denials = col.idx;
      else if (label.includes('net lease')) map.netLeases = col.idx;
      else if (label.includes('closing') || label.includes('close ratio')) map.closingRatio = col.idx;
      else if (label.includes('beg') && label.includes('occ')) map.begOcc = col.idx;
      else if (label.includes('move in')) map.moveIns = col.idx;
      else if (label.includes('move out')) map.moveOuts = col.idx;
      else if (label === 'transfers' || label === 'transfer') map.transfers = col.idx;
      else if (label.includes('end') && label.includes('occ')) map.endOcc = col.idx;
      else if (label === 'model') map.vacantModel = col.idx;
      else if (col.h1.includes('vacant') && label === 'rented') map.vacantRented = col.idx;
      else if (col.h1.includes('vacant') && label === 'unrented') map.vacantUnrented = col.idx;
      else if (col.h1.includes('vacant') && label === 'total') map.vacantTotal = col.idx;
      else if (col.h1.includes('notice') && label === 'rented') map.noticeRented = col.idx;
      else if (col.h1.includes('notice') && label === 'unrented') map.noticeUnrented = col.idx;
      else if (col.h1.includes('notice') && label === 'total') map.noticeTotal = col.idx;
      else if (label === '1 br' || label === '1br') map.avail1br = col.idx;
      else if (label === '2 br' || label === '2br') map.avail2br = col.idx;
      else if (label === '3 br' || label === '3br') map.avail3br = col.idx;
      else if (label === 'occ' || label === 'occ %' || label === 'occupancy') map.occPct = col.idx;
      else if (label === 'leased' || label === 'leased %') map.leasedPct = col.idx;
      else if (label === 'avail' || label === 'avail %' || label === 'availability') map.availPct = col.idx;
    }

    return map;
  }

  private async upsertSnapshot(s: WeeklySnapshot): Promise<void> {
    await pool.query(
      `INSERT INTO weekly_traffic_snapshots (
        deal_id, property_name, week_ending, total_units,
        traffic, in_person_tours, website_leads, apps, cancellations, denials, net_leases, closing_ratio,
        beg_occ, move_ins, move_outs, transfers, end_occ,
        vacant_model, vacant_rented, vacant_unrented, vacant_total,
        notice_rented, notice_unrented, notice_total,
        avail_1br, avail_2br, avail_3br,
        occ_pct, leased_pct, avail_pct, source
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
      ON CONFLICT (deal_id, week_ending) DO UPDATE SET
        property_name = COALESCE(EXCLUDED.property_name, weekly_traffic_snapshots.property_name),
        total_units = EXCLUDED.total_units,
        traffic = EXCLUDED.traffic,
        in_person_tours = EXCLUDED.in_person_tours,
        website_leads = EXCLUDED.website_leads,
        apps = EXCLUDED.apps,
        cancellations = EXCLUDED.cancellations,
        denials = EXCLUDED.denials,
        net_leases = EXCLUDED.net_leases,
        closing_ratio = EXCLUDED.closing_ratio,
        beg_occ = EXCLUDED.beg_occ,
        move_ins = EXCLUDED.move_ins,
        move_outs = EXCLUDED.move_outs,
        transfers = EXCLUDED.transfers,
        end_occ = EXCLUDED.end_occ,
        vacant_model = EXCLUDED.vacant_model,
        vacant_rented = EXCLUDED.vacant_rented,
        vacant_unrented = EXCLUDED.vacant_unrented,
        vacant_total = EXCLUDED.vacant_total,
        notice_rented = EXCLUDED.notice_rented,
        notice_unrented = EXCLUDED.notice_unrented,
        notice_total = EXCLUDED.notice_total,
        avail_1br = EXCLUDED.avail_1br,
        avail_2br = EXCLUDED.avail_2br,
        avail_3br = EXCLUDED.avail_3br,
        occ_pct = EXCLUDED.occ_pct,
        leased_pct = EXCLUDED.leased_pct,
        avail_pct = EXCLUDED.avail_pct,
        source = EXCLUDED.source`,
      [
        s.deal_id, s.property_name, s.week_ending, s.total_units,
        s.traffic, s.in_person_tours, s.website_leads, s.apps, s.cancellations, s.denials, s.net_leases, s.closing_ratio,
        s.beg_occ, s.move_ins, s.move_outs, s.transfers, s.end_occ,
        s.vacant_model, s.vacant_rented, s.vacant_unrented, s.vacant_total,
        s.notice_rented, s.notice_unrented, s.notice_total,
        s.avail_1br, s.avail_2br, s.avail_3br,
        s.occ_pct, s.leased_pct, s.avail_pct, s.source,
      ]
    );
  }

  async getHistory(dealId: string): Promise<WeeklySnapshot[]> {
    const result = await pool.query(
      `SELECT * FROM weekly_traffic_snapshots WHERE deal_id = $1 ORDER BY week_ending ASC`,
      [dealId]
    );
    return result.rows;
  }

  async generateProjection(
    dealId: string,
    view: 'weekly' | 'monthly' | 'yearly',
    marketFactors?: { demand?: number; supply?: number; digital?: number }
  ): Promise<ProjectionResult> {
    const actuals = await this.getHistory(dealId);
    const totalWeeks = 520;
    const actualWeeks = actuals.length;

    const demandFactor = marketFactors?.demand ?? 1.05;
    const supplyFactor = marketFactors?.supply ?? 0.97;
    const digitalFactor = marketFactors?.digital ?? 1.03;

    const recentWindow = Math.min(26, actualWeeks);
    const recentActuals = actuals.slice(-recentWindow);

    const avgTraffic = this.avg(recentActuals.map(a => a.traffic));
    const avgTours = this.avg(recentActuals.map(a => a.in_person_tours));
    const avgWebsite = this.avg(recentActuals.map(a => a.website_leads));
    const avgApps = this.avg(recentActuals.map(a => a.apps));
    const avgCancellations = this.avg(recentActuals.map(a => a.cancellations));
    const avgDenials = this.avg(recentActuals.map(a => a.denials));
    const avgNetLeases = this.avg(recentActuals.map(a => a.net_leases));
    const avgClosingRatio = this.avg(recentActuals.map(a => a.closing_ratio));
    const avgOccPct = this.avg(recentActuals.map(a => a.occ_pct));
    const avgLeasedPct = this.avg(recentActuals.map(a => a.leased_pct));
    const avgTotalUnits = this.avg(recentActuals.map(a => a.total_units)) || 290;
    const avgVacantTotal = this.avg(recentActuals.map(a => a.vacant_total));
    const avgNoticeTotal = this.avg(recentActuals.map(a => a.notice_total));

    const trendGrowth = this.calculateTrend(actuals.map(a => a.traffic));

    const seasonalFactors = this.calculateSeasonalFactors(actuals);

    const weeklyPeriods: ProjectionPeriod[] = [];

    for (let i = 0; i < actualWeeks; i++) {
      const a = actuals[i];
      const traffic = a.traffic || 0;
      const tours = a.in_person_tours || 0;
      const website = a.website_leads || (traffic - tours > 0 ? traffic - tours : 0);
      const walkIn = tours;

      weeklyPeriods.push({
        label: this.formatWeekLabel(a.week_ending, i),
        index: i,
        isActual: true,
        baseTraffic: traffic,
        baseTours: tours,
        baseWebsite: website,
        baseWalkIn: walkIn,
        baseApps: a.apps || 0,
        baseCancellations: a.cancellations || 0,
        baseDenials: a.denials || 0,
        baseNetLeases: a.net_leases || 0,
        baseClosingRatio: a.closing_ratio || 0,
        baseOccPct: a.occ_pct || 0,
        baseLeasedPct: a.leased_pct || 0,
        demandFactor: 1.0,
        supplyFactor: 1.0,
        digitalFactor: 1.0,
        seasonalFactor: 1.0,
        combinedFactor: 1.0,
        adjTraffic: traffic,
        adjTours: tours,
        adjWebsite: website,
        adjWalkIn: walkIn,
        adjApps: a.apps || 0,
        adjNetLeases: a.net_leases || 0,
        adjClosingRatio: a.closing_ratio || 0,
        adjOccPct: a.occ_pct || 0,
        adjLeasedPct: a.leased_pct || 0,
        totalUnits: a.total_units || avgTotalUnits,
        vacantTotal: a.vacant_total,
        noticeTotal: a.notice_total,
      });
    }

    const lastActualDate = actualWeeks > 0 ? new Date(actuals[actualWeeks - 1].week_ending) : new Date();
    for (let i = 0; i < (totalWeeks - actualWeeks); i++) {
      const projWeek = i + 1;
      const projYear = projWeek / 52;
      const weekOfYear = (actualWeeks + i) % 52;

      const growthMultiplier = 1 + (trendGrowth * projWeek);
      const seasonal = seasonalFactors[weekOfYear] || 1.0;

      const yearDecay = Math.max(0.5, 1 - projYear * 0.02);
      const periodDemand = 1 + (demandFactor - 1) * yearDecay;
      const periodSupply = 1 - (1 - supplyFactor) * Math.min(1, projYear * 0.3 + 0.7);
      const periodDigital = 1 + (digitalFactor - 1) * Math.min(2, 1 + projYear * 0.1);

      const combined = periodDemand * periodSupply * periodDigital * seasonal;

      const baseTraffic = Math.round(avgTraffic * growthMultiplier);
      const baseTours = Math.round(avgTours * growthMultiplier);
      const baseWebsite = Math.round(avgWebsite * growthMultiplier);
      const baseWalkIn = baseTours;
      const baseApps = Math.round(avgApps * growthMultiplier);
      const baseCancellations = Math.round(avgCancellations * growthMultiplier * 0.95);
      const baseDenials = Math.round((avgDenials || 0) * growthMultiplier);
      const baseNetLeases = Math.round(avgNetLeases * growthMultiplier);
      const baseClosingRatio = avgClosingRatio;
      const baseOccPct = Math.min(0.99, avgOccPct + projYear * 0.002);
      const baseLeasedPct = Math.min(0.99, avgLeasedPct + projYear * 0.002);

      const adjTraffic = Math.round(baseTraffic * combined);
      const adjTours = Math.round(baseTours * combined);
      const adjWebsite = Math.round(baseWebsite * combined);
      const adjWalkIn = adjTours;
      const adjApps = Math.round(baseApps * combined);
      const adjNetLeases = Math.round(baseNetLeases * combined);
      const adjClosingRatio = Math.min(0.5, baseClosingRatio * (1 + (combined - 1) * 0.3));
      const adjOccPct = Math.min(0.99, baseOccPct * (1 + (combined - 1) * 0.1));
      const adjLeasedPct = Math.min(0.99, baseLeasedPct * (1 + (combined - 1) * 0.1));

      const projDate = new Date(lastActualDate);
      projDate.setDate(projDate.getDate() + projWeek * 7);

      weeklyPeriods.push({
        label: this.formatWeekLabel(projDate, actualWeeks + i),
        index: actualWeeks + i,
        isActual: false,
        baseTraffic, baseTours, baseWebsite, baseWalkIn, baseApps,
        baseCancellations, baseDenials, baseNetLeases, baseClosingRatio,
        baseOccPct, baseLeasedPct,
        demandFactor: Math.round(periodDemand * 1000) / 1000,
        supplyFactor: Math.round(periodSupply * 1000) / 1000,
        digitalFactor: Math.round(periodDigital * 1000) / 1000,
        seasonalFactor: Math.round(seasonal * 1000) / 1000,
        combinedFactor: Math.round(combined * 1000) / 1000,
        adjTraffic, adjTours, adjWebsite, adjWalkIn, adjApps,
        adjNetLeases, adjClosingRatio: Math.round(adjClosingRatio * 10000) / 10000,
        adjOccPct: Math.round(adjOccPct * 10000) / 10000,
        adjLeasedPct: Math.round(adjLeasedPct * 10000) / 10000,
        totalUnits: Math.round(avgTotalUnits),
        vacantTotal: null,
        noticeTotal: null,
      });
    }

    let periods: ProjectionPeriod[];
    if (view === 'weekly') {
      periods = weeklyPeriods;
    } else if (view === 'monthly') {
      periods = this.aggregateToMonthly(weeklyPeriods);
    } else {
      periods = this.aggregateToYearly(weeklyPeriods);
    }

    const overallAdj = demandFactor * supplyFactor * digitalFactor;
    const pctChange = Math.round((overallAdj - 1) * 100);
    const direction = pctChange >= 0 ? 'boosted' : 'reduced';

    const marketIntelligence: MarketIntelligence = {
      demandSummary: demandFactor >= 1
        ? `Strong demand signals detected — ${Math.round((demandFactor - 1) * 100)}% traffic boost from job growth & population trends`
        : `Weak demand signals — ${Math.round((1 - demandFactor) * 100)}% traffic drag from declining demand`,
      demandFactor,
      demandDirection: demandFactor >= 1.02 ? 'up' : demandFactor <= 0.98 ? 'down' : 'neutral',
      supplySummary: supplyFactor < 1
        ? `${Math.round((1 - supplyFactor) * 100)}% traffic dilution from new competing units in pipeline`
        : `Low supply pressure — limited new competition in the market`,
      supplyFactor,
      supplyDirection: supplyFactor <= 0.98 ? 'down' : supplyFactor >= 1.02 ? 'up' : 'neutral',
      digitalSummary: digitalFactor >= 1
        ? `Online interest trending +${Math.round((digitalFactor - 1) * 100)}% — website leads growing`
        : `Digital traffic declining ${Math.round((1 - digitalFactor) * 100)}%`,
      digitalFactor,
      digitalDirection: digitalFactor >= 1.02 ? 'up' : digitalFactor <= 0.98 ? 'down' : 'neutral',
      seasonalSummary: actualWeeks >= 52
        ? 'Seasonal patterns detected from your historical data — applied to projections'
        : 'Default seasonal patterns applied (insufficient history for custom patterns)',
      seasonalFactor: this.avgSeasonalFactor(seasonalFactors),
      seasonalDirection: this.avgSeasonalFactor(seasonalFactors) >= 1.02 ? 'up' : this.avgSeasonalFactor(seasonalFactors) <= 0.98 ? 'down' : 'neutral',
      overallAdjustment: Math.round(overallAdj * 100) / 100,
      overallSummary: `Net Market Impact: ${overallAdj.toFixed(2)}× — Your traffic is ${direction} ${Math.abs(pctChange)}% by market conditions`,
    };

    return {
      periods,
      marketIntelligence,
      actualsCount: actualWeeks,
      projectedCount: periods.filter(p => !p.isActual).length,
      view,
    };
  }

  private avg(values: (number | null)[]): number {
    const valid = values.filter((v): v is number => v !== null && !isNaN(v));
    if (valid.length === 0) return 0;
    return valid.reduce((sum, v) => sum + v, 0) / valid.length;
  }

  private calculateTrend(values: (number | null)[]): number {
    const valid = values.filter((v): v is number => v !== null && !isNaN(v));
    if (valid.length < 10) return 0.0005;
    const firstHalf = valid.slice(0, Math.floor(valid.length / 2));
    const secondHalf = valid.slice(Math.floor(valid.length / 2));
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    if (avgFirst === 0) return 0.0005;
    const totalGrowth = (avgSecond - avgFirst) / avgFirst;
    const weeklyGrowth = totalGrowth / valid.length;
    return Math.max(-0.005, Math.min(0.005, weeklyGrowth));
  }

  private calculateSeasonalFactors(actuals: WeeklySnapshot[]): number[] {
    const factors = new Array(52).fill(1.0);
    if (actuals.length < 52) return factors;

    const byWeek: number[][] = Array.from({ length: 52 }, () => []);
    const overallAvg = this.avg(actuals.map(a => a.traffic));
    if (overallAvg === 0) return factors;

    for (const a of actuals) {
      const d = new Date(a.week_ending);
      const weekNum = Math.floor((d.getMonth() * 4.33 + d.getDate() / 7)) % 52;
      if (a.traffic !== null) byWeek[weekNum].push(a.traffic);
    }

    for (let w = 0; w < 52; w++) {
      if (byWeek[w].length > 0) {
        const weekAvg = byWeek[w].reduce((a, b) => a + b, 0) / byWeek[w].length;
        factors[w] = Math.max(0.7, Math.min(1.3, weekAvg / overallAvg));
      }
    }

    return factors;
  }

  private formatWeekLabel(date: Date | string, index: number): string {
    const d = new Date(date);
    const month = d.toLocaleString('en-US', { month: 'short' });
    const day = d.getDate();
    const year = d.getFullYear().toString().slice(-2);
    return `W${index + 1} (${month} ${day}, '${year})`;
  }

  private aggregateToMonthly(weekly: ProjectionPeriod[]): ProjectionPeriod[] {
    const months: Map<string, ProjectionPeriod[]> = new Map();
    for (const w of weekly) {
      const labelParts = w.label.match(/\((\w+)\s+\d+,\s+'(\d+)\)/);
      const monthKey = labelParts ? `${labelParts[1]}'${labelParts[2]}` : `M${Math.floor(w.index / 4.33)}`;
      if (!months.has(monthKey)) months.set(monthKey, []);
      months.get(monthKey)!.push(w);
    }

    const result: ProjectionPeriod[] = [];
    let idx = 0;
    for (const [label, weeks] of months) {
      const hasActual = weeks.some(w => w.isActual);
      const allActual = weeks.every(w => w.isActual);

      result.push({
        label,
        index: idx++,
        isActual: allActual,
        baseTraffic: this.sumField(weeks, 'baseTraffic'),
        baseTours: this.sumField(weeks, 'baseTours'),
        baseWebsite: this.sumField(weeks, 'baseWebsite'),
        baseWalkIn: this.sumField(weeks, 'baseWalkIn'),
        baseApps: this.sumField(weeks, 'baseApps'),
        baseCancellations: this.sumField(weeks, 'baseCancellations'),
        baseDenials: this.sumField(weeks, 'baseDenials'),
        baseNetLeases: this.sumField(weeks, 'baseNetLeases'),
        baseClosingRatio: this.avgField(weeks, 'baseClosingRatio'),
        baseOccPct: this.avgField(weeks, 'baseOccPct'),
        baseLeasedPct: this.avgField(weeks, 'baseLeasedPct'),
        demandFactor: this.avgField(weeks, 'demandFactor'),
        supplyFactor: this.avgField(weeks, 'supplyFactor'),
        digitalFactor: this.avgField(weeks, 'digitalFactor'),
        seasonalFactor: this.avgField(weeks, 'seasonalFactor'),
        combinedFactor: this.avgField(weeks, 'combinedFactor'),
        adjTraffic: this.sumField(weeks, 'adjTraffic'),
        adjTours: this.sumField(weeks, 'adjTours'),
        adjWebsite: this.sumField(weeks, 'adjWebsite'),
        adjWalkIn: this.sumField(weeks, 'adjWalkIn'),
        adjApps: this.sumField(weeks, 'adjApps'),
        adjNetLeases: this.sumField(weeks, 'adjNetLeases'),
        adjClosingRatio: this.avgField(weeks, 'adjClosingRatio'),
        adjOccPct: this.avgField(weeks, 'adjOccPct'),
        adjLeasedPct: this.avgField(weeks, 'adjLeasedPct'),
        totalUnits: weeks[0].totalUnits,
        vacantTotal: hasActual ? weeks.find(w => w.isActual)?.vacantTotal ?? null : null,
        noticeTotal: hasActual ? weeks.find(w => w.isActual)?.noticeTotal ?? null : null,
      });
    }
    return result;
  }

  private aggregateToYearly(weekly: ProjectionPeriod[]): ProjectionPeriod[] {
    const years: ProjectionPeriod[][] = [];
    for (let i = 0; i < weekly.length; i += 52) {
      years.push(weekly.slice(i, i + 52));
    }

    return years.map((weeks, idx) => {
      const allActual = weeks.every(w => w.isActual);
      const hasActual = weeks.some(w => w.isActual);
      return {
        label: `Y${idx + 1}`,
        index: idx,
        isActual: allActual,
        baseTraffic: this.sumField(weeks, 'baseTraffic'),
        baseTours: this.sumField(weeks, 'baseTours'),
        baseWebsite: this.sumField(weeks, 'baseWebsite'),
        baseWalkIn: this.sumField(weeks, 'baseWalkIn'),
        baseApps: this.sumField(weeks, 'baseApps'),
        baseCancellations: this.sumField(weeks, 'baseCancellations'),
        baseDenials: this.sumField(weeks, 'baseDenials'),
        baseNetLeases: this.sumField(weeks, 'baseNetLeases'),
        baseClosingRatio: this.avgField(weeks, 'baseClosingRatio'),
        baseOccPct: this.avgField(weeks, 'baseOccPct'),
        baseLeasedPct: this.avgField(weeks, 'baseLeasedPct'),
        demandFactor: this.avgField(weeks, 'demandFactor'),
        supplyFactor: this.avgField(weeks, 'supplyFactor'),
        digitalFactor: this.avgField(weeks, 'digitalFactor'),
        seasonalFactor: this.avgField(weeks, 'seasonalFactor'),
        combinedFactor: this.avgField(weeks, 'combinedFactor'),
        adjTraffic: this.sumField(weeks, 'adjTraffic'),
        adjTours: this.sumField(weeks, 'adjTours'),
        adjWebsite: this.sumField(weeks, 'adjWebsite'),
        adjWalkIn: this.sumField(weeks, 'adjWalkIn'),
        adjApps: this.sumField(weeks, 'adjApps'),
        adjNetLeases: this.sumField(weeks, 'adjNetLeases'),
        adjClosingRatio: this.avgField(weeks, 'adjClosingRatio'),
        adjOccPct: this.avgField(weeks, 'adjOccPct'),
        adjLeasedPct: this.avgField(weeks, 'adjLeasedPct'),
        totalUnits: weeks[0].totalUnits,
        vacantTotal: hasActual ? weeks.find(w => w.isActual)?.vacantTotal ?? null : null,
        noticeTotal: hasActual ? weeks.find(w => w.isActual)?.noticeTotal ?? null : null,
      };
    });
  }

  private sumField(periods: ProjectionPeriod[], field: keyof ProjectionPeriod): number {
    return periods.reduce((sum, p) => sum + (Number(p[field]) || 0), 0);
  }

  private avgField(periods: ProjectionPeriod[], field: keyof ProjectionPeriod): number {
    const values = periods.map(p => Number(p[field]) || 0);
    if (values.length === 0) return 0;
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10000) / 10000;
  }

  private avgSeasonalFactor(factors: number[]): number {
    const sum = factors.reduce((a, b) => a + b, 0);
    return Math.round((sum / factors.length) * 100) / 100;
  }

  async updateSnapshot(dealId: string, weekEnding: string, updates: Partial<WeeklySnapshot>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [dealId, weekEnding];
    let paramIdx = 3;

    const updatable = [
      'traffic', 'in_person_tours', 'website_leads', 'apps', 'cancellations', 'denials',
      'net_leases', 'closing_ratio', 'beg_occ', 'move_ins', 'move_outs', 'transfers', 'end_occ',
      'occ_pct', 'leased_pct', 'avail_pct',
    ] as const;

    for (const field of updatable) {
      if (field in updates) {
        fields.push(`${field} = $${paramIdx}`);
        values.push((updates as any)[field]);
        paramIdx++;
      }
    }

    if (fields.length === 0) return;

    await pool.query(
      `UPDATE weekly_traffic_snapshots SET ${fields.join(', ')} WHERE deal_id = $1 AND week_ending = $2`,
      values
    );
  }

  async saveProjectionOverrides(dealId: string, periodLabel: string, overrides: Record<string, number>): Promise<void> {
    for (const [fieldName, value] of Object.entries(overrides)) {
      await pool.query(
        `INSERT INTO traffic_projection_overrides (deal_id, period_label, field_name, override_value, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (deal_id, period_label, field_name)
         DO UPDATE SET override_value = $4, updated_at = NOW()`,
        [dealId, periodLabel, fieldName, value]
      );
    }
  }

  async getProjectionOverrides(dealId: string): Promise<Record<string, Record<string, number>>> {
    const result = await pool.query(
      `SELECT period_label, field_name, override_value FROM traffic_projection_overrides WHERE deal_id = $1`,
      [dealId]
    );
    const overrides: Record<string, Record<string, number>> = {};
    for (const row of result.rows) {
      if (!overrides[row.period_label]) overrides[row.period_label] = {};
      overrides[row.period_label][row.field_name] = Number(row.override_value);
    }
    return overrides;
  }
}

export const weeklyReportParser = new WeeklyReportParserService();
