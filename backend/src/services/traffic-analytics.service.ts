import { Pool } from 'pg';
import { getPool } from '../database/connection';

export interface SigningVelocity {
  trailing3mo: { newLeases: number; renewals: number; totalSignings: number; avgPerMonth: number };
  trailing6mo: { newLeases: number; renewals: number; totalSignings: number; avgPerMonth: number };
  trailing12mo: { newLeases: number; renewals: number; totalSignings: number; avgPerMonth: number };
  confidence: number;
  dataMonths: number;
}

export interface SeasonalityBucket {
  month: number;
  label: string;
  normalizedFactor: number;
  signings: number;
  expirations: number;
}

export interface ExpirationWaterfallBucket {
  month: string;
  expiringUnits: number;
  mtmUnits: number;
  cumulativeExposure: number;
  renewalCliffFlag: boolean;
}

export interface VelocityVariance {
  month: string;
  expectedSignings: number;
  actualSignings: number;
  variance: number;
  variancePct: number;
}

export interface LeaseTermBucket {
  termMonths: number;
  label: string;
  count: number;
  pct: number;
  avgRent: number;
}

export interface TradeOutMetrics {
  newLeases: {
    count: number;
    avgRent: number;
    avgMarketRent: number;
    avgTradeOutDollar: number;
    avgTradeOutPct: number;
    avgConcession: number;
    concessionAdjustedRent: number;
  };
  renewals: {
    count: number;
    avgRent: number;
    avgPriorRent: number;
    avgIncreaseDollar: number;
    avgIncreasePct: number;
  };
  overallLossToLease: number;
  overallLossToLeasePct: number;
}

export interface MtmExposure {
  mtmUnitCount: number;
  mtmPctOfTotal: number;
  avgMtmRent: number;
  preLeasedCount: number;
  preLeasedAvgDaysOut: number;
  totalUnits: number;
}

export interface ConversionFunnel {
  channels: Array<{
    channel: string;
    firstContacts: number;
    shows: number;
    applied: number;
    approved: number;
    leased: number;
    contactToShowPct: number;
    showToLeasePct: number;
    overallConversionPct: number;
  }>;
  totalFirstContacts: number;
  totalLeased: number;
  overallConversionPct: number;
}

export interface TrafficSnapshot {
  dealId: string;
  snapshotDate: string;
  signingVelocity: SigningVelocity;
  seasonalityCurve: SeasonalityBucket[];
  expirationWaterfall: ExpirationWaterfallBucket[];
  velocityVariance: VelocityVariance[];
  leaseTermDistribution: LeaseTermBucket[];
  tradeOutAnalytics: TradeOutMetrics;
  mtmExposure: MtmExposure;
  conversionFunnel: ConversionFunnel | null;
  summary: {
    totalUnits: number;
    occupiedUnits: number;
    vacantUnits: number;
    occupancyPct: number;
    avgSigningsPerMonth: number;
    mtmExposurePct: number;
    renewalCliffMonths: string[];
    lossToLeasePct: number;
    dataCompleteness: number;
  };
  sourceDocumentTypes: string[];
}

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export async function computeTrafficSnapshot(dealId: string): Promise<TrafficSnapshot> {
  const pool = getPool();

  const leaseRows = await pool.query(
    `SELECT unit_number, unit_type, sqft, lease_type, lease_start, lease_end,
            move_in_date, move_out_date, tenant_name, market_rent, prior_rent,
            new_rent, effective_rent, concession_amount, rent_change_dollar,
            rent_change_pct, loss_to_lease, loss_to_lease_pct, rent_psf,
            lease_status, source_type, source_ref
     FROM deal_lease_transactions
     WHERE deal_id = $1
     ORDER BY unit_number, lease_start`,
    [dealId]
  );

  const boxScoreFunnelRows = await pool.query(
    `SELECT lease_status FROM deal_lease_transactions
     WHERE deal_id = $1 AND lease_type = 'conversion_funnel'`,
    [dealId]
  );

  const allLeases = leaseRows.rows;
  const funnelRows = boxScoreFunnelRows.rows;

  const currentLeases = allLeases.filter((r: any) =>
    r.lease_type !== 'conversion_funnel' &&
    !r.unit_number?.startsWith('box_score_') &&
    !r.unit_number?.startsWith('funnel_')
  );

  const sourceTypes = new Set<string>();
  currentLeases.forEach((r: any) => { if (r.source_type) sourceTypes.add(r.source_type); });
  const sourceDocumentTypes = Array.from(sourceTypes);

  const signingVelocity = computeSigningVelocity(currentLeases);
  const seasonalityCurve = computeSeasonalityCurve(currentLeases);
  const expirationWaterfall = computeExpirationWaterfall(currentLeases);
  const velocityVariance = computeVelocityVariance(currentLeases, seasonalityCurve);
  const leaseTermDistribution = computeLeaseTermDistribution(currentLeases);
  const tradeOutAnalytics = computeTradeOutAnalytics(currentLeases);
  const mtmExposure = computeMtmExposure(currentLeases);
  const conversionFunnel = computeConversionFunnel(funnelRows);

  const occupiedUnits = currentLeases.filter((r: any) =>
    r.lease_status === 'occupied' || r.lease_status === 'active' || r.lease_status === 'current'
  ).length;
  const vacantUnits = currentLeases.filter((r: any) =>
    r.lease_status === 'vacant' || r.lease_status === 'available'
  ).length;
  const totalUnits = occupiedUnits + vacantUnits;
  const occupancyPct = totalUnits > 0 ? occupiedUnits / totalUnits : 0;

  const renewalCliffMonths = expirationWaterfall
    .filter(b => b.renewalCliffFlag)
    .map(b => b.month);

  const dataFields = [
    signingVelocity.dataMonths > 0 ? 1 : 0,
    seasonalityCurve.some(b => b.signings > 0) ? 1 : 0,
    expirationWaterfall.length > 0 ? 1 : 0,
    leaseTermDistribution.length > 0 ? 1 : 0,
    tradeOutAnalytics.newLeases.count > 0 || tradeOutAnalytics.renewals.count > 0 ? 1 : 0,
    mtmExposure.totalUnits > 0 ? 1 : 0,
    conversionFunnel ? 1 : 0,
  ];
  const dataCompleteness = dataFields.reduce((s, v) => s + v, 0) / dataFields.length;

  const snapshotDate = new Date().toISOString().split('T')[0];

  return {
    dealId,
    snapshotDate,
    signingVelocity,
    seasonalityCurve,
    expirationWaterfall,
    velocityVariance,
    leaseTermDistribution,
    tradeOutAnalytics,
    mtmExposure,
    conversionFunnel,
    summary: {
      totalUnits,
      occupiedUnits,
      vacantUnits,
      occupancyPct: Math.round(occupancyPct * 1000) / 10,
      avgSigningsPerMonth: signingVelocity.trailing12mo.avgPerMonth,
      mtmExposurePct: mtmExposure.mtmPctOfTotal,
      renewalCliffMonths,
      lossToLeasePct: tradeOutAnalytics.overallLossToLeasePct,
      dataCompleteness: Math.round(dataCompleteness * 100),
    },
    sourceDocumentTypes,
  };
}

function computeSigningVelocity(leases: any[]): SigningVelocity {
  const now = new Date();
  const cutoffs = [3, 6, 12].map(months => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - months);
    return d;
  });

  const signedLeases = leases.filter((r: any) => r.lease_start);
  const buckets = cutoffs.map(cutoff => {
    const inRange = signedLeases.filter((r: any) => new Date(r.lease_start) >= cutoff);
    const newL = inRange.filter((r: any) =>
      r.lease_type === 'new' || r.lease_type === 'new_lease' || r.lease_type === 'current'
    ).length;
    const renewalsCount = inRange.filter((r: any) =>
      r.lease_type === 'renewal' || r.lease_type === 'renew'
    ).length;
    return { newLeases: newL, renewals: renewalsCount, totalSignings: newL + renewalsCount };
  });

  const dataMonths = getDataSpanMonths(signedLeases);
  const confidence = Math.min(1, dataMonths / 12);

  return {
    trailing3mo: { ...buckets[0], avgPerMonth: round2(buckets[0].totalSignings / 3) },
    trailing6mo: { ...buckets[1], avgPerMonth: round2(buckets[1].totalSignings / 6) },
    trailing12mo: { ...buckets[2], avgPerMonth: round2(buckets[2].totalSignings / 12) },
    confidence,
    dataMonths,
  };
}

function computeSeasonalityCurve(leases: any[]): SeasonalityBucket[] {
  const monthCounts = new Array(12).fill(0);
  const expirationCounts = new Array(12).fill(0);

  for (const lease of leases) {
    if (lease.lease_start) {
      const m = new Date(lease.lease_start).getMonth();
      monthCounts[m]++;
    }
    if (lease.lease_end) {
      const m = new Date(lease.lease_end).getMonth();
      expirationCounts[m]++;
    }
  }

  const totalSignings = monthCounts.reduce((s: number, v: number) => s + v, 0);
  const avgPerMonth = totalSignings > 0 ? totalSignings / 12 : 1;

  return monthCounts.map((count: number, i: number) => ({
    month: i + 1,
    label: MONTH_LABELS[i],
    normalizedFactor: round2(count / avgPerMonth) || 0,
    signings: count,
    expirations: expirationCounts[i],
  }));
}

function computeExpirationWaterfall(leases: any[]): ExpirationWaterfallBucket[] {
  const now = new Date();
  const buckets: ExpirationWaterfallBucket[] = [];

  const occupiedLeases = leases.filter((r: any) =>
    r.lease_status === 'occupied' || r.lease_status === 'active' || r.lease_status === 'current'
  );

  const mtmLeases = occupiedLeases.filter((r: any) => {
    if (!r.lease_end) return true;
    return new Date(r.lease_end) < now;
  });

  let cumulativeExposure = 0;
  const totalOccupied = occupiedLeases.length || 1;

  for (let i = 0; i < 24; i++) {
    const targetDate = new Date(now);
    targetDate.setMonth(targetDate.getMonth() + i);
    const monthStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;

    const expiringThisMonth = occupiedLeases.filter((r: any) => {
      if (!r.lease_end) return false;
      const end = new Date(r.lease_end);
      return end.getFullYear() === targetDate.getFullYear() &&
             end.getMonth() === targetDate.getMonth();
    }).length;

    const mtmThisMonth = i === 0 ? mtmLeases.length : 0;
    cumulativeExposure += expiringThisMonth + mtmThisMonth;

    const exposurePct = cumulativeExposure / totalOccupied;
    const renewalCliffFlag = expiringThisMonth >= totalOccupied * 0.08;

    buckets.push({
      month: monthStr,
      expiringUnits: expiringThisMonth,
      mtmUnits: mtmThisMonth,
      cumulativeExposure,
      renewalCliffFlag,
    });
  }

  return buckets;
}

function computeVelocityVariance(leases: any[], seasonality: SeasonalityBucket[]): VelocityVariance[] {
  const signedLeases = leases.filter((r: any) => r.lease_start);
  if (signedLeases.length === 0) return [];

  const now = new Date();
  const results: VelocityVariance[] = [];
  const totalSignings = signedLeases.length;
  const avgPerMonth = totalSignings / 12;

  for (let i = 11; i >= 0; i--) {
    const targetDate = new Date(now);
    targetDate.setMonth(targetDate.getMonth() - i);
    const monthStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;

    const actualInMonth = signedLeases.filter((r: any) => {
      const start = new Date(r.lease_start);
      return start.getFullYear() === targetDate.getFullYear() &&
             start.getMonth() === targetDate.getMonth();
    }).length;

    const seasonalBucket = seasonality[targetDate.getMonth()];
    const expected = round2(avgPerMonth * (seasonalBucket?.normalizedFactor || 1));
    const variance = actualInMonth - expected;
    const variancePct = expected > 0 ? round2(variance / expected * 100) : 0;

    results.push({
      month: monthStr,
      expectedSignings: expected,
      actualSignings: actualInMonth,
      variance: round2(variance),
      variancePct,
    });
  }

  return results;
}

function computeLeaseTermDistribution(leases: any[]): LeaseTermBucket[] {
  const leasesWithDates = leases.filter((r: any) => r.lease_start && r.lease_end);
  if (leasesWithDates.length === 0) return [];

  const termCounts: Record<number, { count: number; totalRent: number }> = {};

  for (const lease of leasesWithDates) {
    const start = new Date(lease.lease_start);
    const end = new Date(lease.lease_end);
    const termMonths = Math.round((end.getTime() - start.getTime()) / (30.44 * 24 * 60 * 60 * 1000));
    if (termMonths <= 0 || termMonths > 60) continue;

    const bucket = termMonths <= 1 ? 1 :
                   termMonths <= 3 ? 3 :
                   termMonths <= 6 ? 6 :
                   termMonths <= 9 ? 9 :
                   termMonths <= 12 ? 12 :
                   termMonths <= 15 ? 15 :
                   termMonths <= 18 ? 18 : 24;

    if (!termCounts[bucket]) termCounts[bucket] = { count: 0, totalRent: 0 };
    termCounts[bucket].count++;
    termCounts[bucket].totalRent += Number(lease.effective_rent || lease.new_rent || 0);
  }

  const total = leasesWithDates.length;
  const labels: Record<number, string> = {
    1: 'MTM', 3: '1-3 mo', 6: '4-6 mo', 9: '7-9 mo',
    12: '10-12 mo', 15: '13-15 mo', 18: '16-18 mo', 24: '19-24 mo',
  };

  return Object.entries(termCounts)
    .map(([term, data]) => ({
      termMonths: Number(term),
      label: labels[Number(term)] || `${term} mo`,
      count: data.count,
      pct: round2(data.count / total * 100),
      avgRent: round2(data.totalRent / data.count),
    }))
    .sort((a, b) => a.termMonths - b.termMonths);
}

function computeTradeOutAnalytics(leases: any[]): TradeOutMetrics {
  const newLeases = leases.filter((r: any) =>
    (r.lease_type === 'new' || r.lease_type === 'new_lease' || r.lease_type === 'current') &&
    r.effective_rent != null
  );

  const renewals = leases.filter((r: any) =>
    (r.lease_type === 'renewal' || r.lease_type === 'renew') &&
    r.effective_rent != null
  );

  const allWithLtl = leases.filter((r: any) =>
    r.market_rent != null && r.effective_rent != null &&
    Number(r.market_rent) > 0
  );

  const totalLtl = allWithLtl.reduce((s: number, r: any) =>
    s + (Number(r.market_rent) - Number(r.effective_rent)), 0);
  const totalMarket = allWithLtl.reduce((s: number, r: any) =>
    s + Number(r.market_rent), 0);

  const newAvgRent = avg(newLeases.map((r: any) => Number(r.effective_rent)));
  const newAvgMarket = avg(newLeases.filter((r: any) => r.market_rent).map((r: any) => Number(r.market_rent)));
  const newAvgConcession = avg(newLeases.filter((r: any) => r.concession_amount).map((r: any) => Number(r.concession_amount)));

  const renewalAvgRent = avg(renewals.map((r: any) => Number(r.effective_rent)));
  const renewalAvgPrior = avg(renewals.filter((r: any) => r.prior_rent).map((r: any) => Number(r.prior_rent)));

  return {
    newLeases: {
      count: newLeases.length,
      avgRent: newAvgRent,
      avgMarketRent: newAvgMarket,
      avgTradeOutDollar: round2(newAvgRent - newAvgMarket),
      avgTradeOutPct: newAvgMarket > 0 ? round2((newAvgRent - newAvgMarket) / newAvgMarket * 100) : 0,
      avgConcession: newAvgConcession,
      concessionAdjustedRent: round2(newAvgRent - newAvgConcession),
    },
    renewals: {
      count: renewals.length,
      avgRent: renewalAvgRent,
      avgPriorRent: renewalAvgPrior,
      avgIncreaseDollar: round2(renewalAvgRent - renewalAvgPrior),
      avgIncreasePct: renewalAvgPrior > 0 ? round2((renewalAvgRent - renewalAvgPrior) / renewalAvgPrior * 100) : 0,
    },
    overallLossToLease: round2(totalLtl),
    overallLossToLeasePct: totalMarket > 0 ? round2(totalLtl / totalMarket * 100) : 0,
  };
}

function computeMtmExposure(leases: any[]): MtmExposure {
  const now = new Date();
  const occupiedLeases = leases.filter((r: any) =>
    r.lease_status === 'occupied' || r.lease_status === 'active' || r.lease_status === 'current'
  );

  const mtmLeases = occupiedLeases.filter((r: any) => {
    if (!r.lease_end) return true;
    return new Date(r.lease_end) < now;
  });

  const preLeasedLeases = leases.filter((r: any) => {
    if (!r.lease_start) return false;
    const start = new Date(r.lease_start);
    return start > now && (r.lease_status === 'future' || r.lease_status === 'pre-leased' ||
      r.lease_type === 'new' || r.lease_type === 'new_lease');
  });

  const avgDaysOut = preLeasedLeases.length > 0
    ? preLeasedLeases.reduce((s: number, r: any) => {
        const start = new Date(r.lease_start);
        return s + Math.round((start.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      }, 0) / preLeasedLeases.length
    : 0;

  const totalUnits = occupiedLeases.length + leases.filter((r: any) =>
    r.lease_status === 'vacant' || r.lease_status === 'available'
  ).length;

  return {
    mtmUnitCount: mtmLeases.length,
    mtmPctOfTotal: totalUnits > 0 ? round2(mtmLeases.length / totalUnits * 100) : 0,
    avgMtmRent: avg(mtmLeases.map((r: any) => Number(r.effective_rent || r.new_rent || 0))),
    preLeasedCount: preLeasedLeases.length,
    preLeasedAvgDaysOut: Math.round(avgDaysOut),
    totalUnits,
  };
}

function computeConversionFunnel(funnelRows: any[]): ConversionFunnel | null {
  if (funnelRows.length === 0) return null;

  const channels: ConversionFunnel['channels'] = [];
  let totalFirstContacts = 0;
  let totalLeased = 0;

  for (const row of funnelRows) {
    try {
      const data = typeof row.lease_status === 'string' ? JSON.parse(row.lease_status) : row.lease_status;
      if (!data || !data.channel) continue;

      const fc = Number(data.firstContacts) || 0;
      const shows = Number(data.shows) || 0;
      const leased = Number(data.leased) || 0;

      channels.push({
        channel: data.channel,
        firstContacts: fc,
        shows,
        applied: Number(data.applied) || 0,
        approved: Number(data.approved) || 0,
        leased,
        contactToShowPct: fc > 0 ? round2(shows / fc * 100) : 0,
        showToLeasePct: shows > 0 ? round2(leased / shows * 100) : 0,
        overallConversionPct: fc > 0 ? round2(leased / fc * 100) : 0,
      });

      totalFirstContacts += fc;
      totalLeased += leased;
    } catch {
      continue;
    }
  }

  if (channels.length === 0) return null;

  return {
    channels,
    totalFirstContacts,
    totalLeased,
    overallConversionPct: totalFirstContacts > 0 ? round2(totalLeased / totalFirstContacts * 100) : 0,
  };
}

export async function persistTrafficSnapshot(snapshot: TrafficSnapshot): Promise<void> {
  const pool = getPool();

  await pool.query(
    `INSERT INTO deal_traffic_snapshots (
      deal_id, snapshot_date, signing_velocity, seasonality_curve,
      expiration_waterfall, velocity_variance, lease_term_distribution,
      trade_out_analytics, mtm_exposure, conversion_funnel,
      summary, source_document_types
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (deal_id, snapshot_date) DO UPDATE SET
      signing_velocity = EXCLUDED.signing_velocity,
      seasonality_curve = EXCLUDED.seasonality_curve,
      expiration_waterfall = EXCLUDED.expiration_waterfall,
      velocity_variance = EXCLUDED.velocity_variance,
      lease_term_distribution = EXCLUDED.lease_term_distribution,
      trade_out_analytics = EXCLUDED.trade_out_analytics,
      mtm_exposure = EXCLUDED.mtm_exposure,
      conversion_funnel = EXCLUDED.conversion_funnel,
      summary = EXCLUDED.summary,
      source_document_types = EXCLUDED.source_document_types`,
    [
      snapshot.dealId,
      snapshot.snapshotDate,
      JSON.stringify(snapshot.signingVelocity),
      JSON.stringify(snapshot.seasonalityCurve),
      JSON.stringify(snapshot.expirationWaterfall),
      JSON.stringify(snapshot.velocityVariance),
      JSON.stringify(snapshot.leaseTermDistribution),
      JSON.stringify(snapshot.tradeOutAnalytics),
      JSON.stringify(snapshot.mtmExposure),
      snapshot.conversionFunnel ? JSON.stringify(snapshot.conversionFunnel) : null,
      JSON.stringify(snapshot.summary),
      snapshot.sourceDocumentTypes,
    ]
  );
}

export async function updateCapsuleTrafficModule(dealId: string, snapshot: TrafficSnapshot): Promise<void> {
  const pool = getPool();

  const moduleOutput = {
    weekly_walk_ins: 0,
    monthly_walk_ins: 0,
    revenue_estimate_weekly: 0,
    revenue_estimate_monthly: 0,
    base_forecast: snapshot.signingVelocity.trailing12mo.avgPerMonth,
    calibrated_forecast: snapshot.signingVelocity.trailing3mo.avgPerMonth,
    calibration_factor: snapshot.signingVelocity.trailing3mo.avgPerMonth > 0 && snapshot.signingVelocity.trailing12mo.avgPerMonth > 0
      ? round2(snapshot.signingVelocity.trailing3mo.avgPerMonth / snapshot.signingVelocity.trailing12mo.avgPerMonth)
      : null,
    confidence: snapshot.signingVelocity.confidence,
    confidence_range: {
      min: Math.max(0, snapshot.signingVelocity.trailing3mo.avgPerMonth - 2),
      max: snapshot.signingVelocity.trailing3mo.avgPerMonth + 2,
    },
    signing_velocity: snapshot.signingVelocity,
    seasonality_curve: snapshot.seasonalityCurve,
    expiration_waterfall_summary: {
      next3moExposure: snapshot.expirationWaterfall.slice(0, 3).reduce((s, b) => s + b.expiringUnits, 0),
      next6moExposure: snapshot.expirationWaterfall.slice(0, 6).reduce((s, b) => s + b.expiringUnits, 0),
      renewalCliffMonths: snapshot.summary.renewalCliffMonths,
      mtmUnits: snapshot.mtmExposure.mtmUnitCount,
    },
    trade_out: {
      newLeaseAvgRent: snapshot.tradeOutAnalytics.newLeases.avgRent,
      renewalAvgIncrease: snapshot.tradeOutAnalytics.renewals.avgIncreasePct,
      lossToLeasePct: snapshot.tradeOutAnalytics.overallLossToLeasePct,
    },
    conversion_funnel: snapshot.conversionFunnel ? {
      overallConversionPct: snapshot.conversionFunnel.overallConversionPct,
      channelCount: snapshot.conversionFunnel.channels.length,
    } : null,
    data_completeness: snapshot.summary.dataCompleteness,
    last_calculated: new Date().toISOString(),
  };

  await pool.query(
    `UPDATE deals SET
       deal_data = jsonb_set(
         jsonb_set(
           COALESCE(deal_data, '{}'::jsonb),
           '{module_outputs}',
           COALESCE(deal_data->'module_outputs', '{}'::jsonb)
         ),
         '{module_outputs,traffic}',
         $2::jsonb
       ),
       updated_at = NOW()
     WHERE id = $1`,
    [dealId, JSON.stringify(moduleOutput)]
  );
}

export async function updateDataLibraryTrafficAttribution(dealId: string, snapshot: TrafficSnapshot): Promise<void> {
  const pool = getPool();

  try {
    await pool.query(
      `UPDATE data_library_assets SET
        extraction_data = COALESCE(extraction_data, '{}'::jsonb) || $2::jsonb,
        updated_at = NOW()
      WHERE source_deal_id = $1`,
      [dealId, JSON.stringify({
        TRAFFIC_SNAPSHOT: {
          document_type: 'TRAFFIC_SNAPSHOT',
          extracted_at: new Date().toISOString(),
          summary: snapshot.summary,
          source_document_types: snapshot.sourceDocumentTypes,
        }
      })]
    );
  } catch {
  }
}

export async function computeAndPersistTrafficSnapshot(dealId: string): Promise<TrafficSnapshot> {
  const snapshot = await computeTrafficSnapshot(dealId);
  await persistTrafficSnapshot(snapshot);
  await updateCapsuleTrafficModule(dealId, snapshot);
  await updateDataLibraryTrafficAttribution(dealId, snapshot);
  return snapshot;
}

function getDataSpanMonths(leases: any[]): number {
  let min = Infinity;
  let max = -Infinity;
  for (const r of leases) {
    if (!r.lease_start) continue;
    const t = new Date(r.lease_start).getTime();
    if (t < min) min = t;
    if (t > max) max = t;
  }
  if (min === Infinity) return 0;
  return Math.round((max - min) / (30.44 * 24 * 60 * 60 * 1000));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return round2(arr.reduce((s, v) => s + v, 0) / arr.length);
}
