import { Pool } from 'pg';

const DEAL_ID = 'highlands-2789-satellite';

const OLD_SEASONALITY: Record<number, number> = {
  1: 0.85, 2: 0.90, 3: 1.15, 4: 1.20, 5: 1.25, 6: 1.20,
  7: 1.15, 8: 1.10, 9: 1.00, 10: 0.95, 11: 0.85, 12: 0.80
};

const NEW_SEASONALITY: Record<number, number> = {
  1: 1.09, 2: 1.12, 3: 1.19, 4: 1.09, 5: 0.97, 6: 1.50,
  7: 1.26, 8: 0.97, 9: 0.59, 10: 0.95, 11: 0.97, 12: 0.49
};

const BASELINE_TRAFFIC = 11;
const BASELINE_UNITS = 290;

function oldOccMultiplier(occ: number): number {
  if (occ > 0.95) return 0.6;
  if (occ < 0.85) return 1.3;
  return 1.0;
}

function newOccMultiplier(occ: number): number {
  const anchors: [number, number][] = [
    [0.80, 1.60], [0.85, 1.40], [0.88, 1.25], [0.91, 1.10],
    [0.94, 1.00], [0.96, 0.88], [0.98, 0.78], [1.00, 0.70],
  ];
  if (occ <= anchors[0][0]) return anchors[0][1];
  if (occ >= anchors[anchors.length - 1][0]) return anchors[anchors.length - 1][1];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [o1, m1] = anchors[i];
    const [o2, m2] = anchors[i + 1];
    if (occ >= o1 && occ <= o2) {
      const t = (occ - o1) / (o2 - o1);
      return m1 + t * (m2 - m1);
    }
  }
  return 1.0;
}

function newClosingRatio(occ: number, month: number): number {
  const BASE = 0.204;
  const occFactor = occ < 0.88 ? 1.30
    : occ < 0.91 ? 1.20
    : occ < 0.94 ? 1.10
    : occ < 0.96 ? 1.05
    : 1.00;
  const seasonalFactors: Record<number, number> = {
    1: 0.95, 2: 1.05, 3: 1.10, 4: 1.30, 5: 1.25, 6: 1.50,
    7: 1.30, 8: 0.95, 9: 1.20, 10: 0.85, 11: 0.90, 12: 0.95,
  };
  return Math.min(0.50, Math.max(0.08, BASE * occFactor * (seasonalFactors[month] || 1.0)));
}

function predictOld(units: number, occ: number, month: number) {
  const base = (units / BASELINE_UNITS) * BASELINE_TRAFFIC;
  const traffic = Math.round(base * (OLD_SEASONALITY[month] || 1.0) * oldOccMultiplier(occ));
  const leases = Math.round(traffic * 0.99 * 0.207 * 10) / 10;
  return { traffic, leases, closeRatio: 0.207 };
}

function predictNew(units: number, occ: number, month: number) {
  const base = (units / BASELINE_UNITS) * BASELINE_TRAFFIC;
  const traffic = Math.round(base * (NEW_SEASONALITY[month] || 1.0) * newOccMultiplier(occ));
  const cr = newClosingRatio(occ, month);
  const leases = Math.round(traffic * 0.99 * cr * 10) / 10;
  return { traffic, leases, closeRatio: cr };
}

async function backtest() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const result = await pool.query(
    `SELECT week_ending, total_units, traffic, in_person_tours, net_leases,
            closing_ratio, occ_pct, effective_rent, avg_market_rent
     FROM weekly_traffic_snapshots
     WHERE deal_id = $1 AND traffic IS NOT NULL
     ORDER BY week_ending`,
    [DEAL_ID]
  );

  const rows = result.rows;
  console.log(`Backtesting ${rows.length} weeks of data\n`);

  let oldTrafficErrors: number[] = [];
  let newTrafficErrors: number[] = [];
  let oldLeaseErrors: number[] = [];
  let newLeaseErrors: number[] = [];
  let oldTrafficAbsErrors: number[] = [];
  let newTrafficAbsErrors: number[] = [];

  const monthlyOld: Record<number, { trafficErr: number[], leaseErr: number[] }> = {};
  const monthlyNew: Record<number, { trafficErr: number[], leaseErr: number[] }> = {};
  const yearlyOld: Record<number, { trafficErr: number[], leaseErr: number[] }> = {};
  const yearlyNew: Record<number, { trafficErr: number[], leaseErr: number[] }> = {};

  for (const row of rows) {
    const date = new Date(row.week_ending);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const units = row.total_units || 290;
    const occ = parseFloat(row.occ_pct) || 0.95;
    const actualTraffic = parseInt(row.traffic) || 0;
    const actualLeases = parseInt(row.net_leases) || 0;

    if (actualTraffic === 0) continue;

    const old = predictOld(units, occ, month);
    const nw = predictNew(units, occ, month);

    const oldTE = old.traffic - actualTraffic;
    const newTE = nw.traffic - actualTraffic;
    const oldLE = old.leases - actualLeases;
    const newLE = nw.leases - actualLeases;

    oldTrafficErrors.push(oldTE);
    newTrafficErrors.push(newTE);
    oldLeaseErrors.push(oldLE);
    newLeaseErrors.push(newLE);
    oldTrafficAbsErrors.push(Math.abs(oldTE));
    newTrafficAbsErrors.push(Math.abs(newTE));

    if (!monthlyOld[month]) monthlyOld[month] = { trafficErr: [], leaseErr: [] };
    if (!monthlyNew[month]) monthlyNew[month] = { trafficErr: [], leaseErr: [] };
    monthlyOld[month].trafficErr.push(Math.abs(oldTE));
    monthlyNew[month].trafficErr.push(Math.abs(newTE));
    monthlyOld[month].leaseErr.push(Math.abs(oldLE));
    monthlyNew[month].leaseErr.push(Math.abs(newLE));

    if (!yearlyOld[year]) yearlyOld[year] = { trafficErr: [], leaseErr: [] };
    if (!yearlyNew[year]) yearlyNew[year] = { trafficErr: [], leaseErr: [] };
    yearlyOld[year].trafficErr.push(Math.abs(oldTE));
    yearlyNew[year].trafficErr.push(Math.abs(newTE));
    yearlyOld[year].leaseErr.push(Math.abs(oldLE));
    yearlyNew[year].leaseErr.push(Math.abs(newLE));
  }

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const mape = (errors: number[], actuals: number[]) => {
    let sum = 0; let count = 0;
    for (let i = 0; i < errors.length; i++) {
      if (actuals[i] !== 0) { sum += Math.abs(errors[i]) / Math.abs(actuals[i]); count++; }
    }
    return count > 0 ? sum / count : 0;
  };

  const actualTraffics = rows.filter(r => parseInt(r.traffic) > 0).map(r => parseInt(r.traffic));
  const actualLeases = rows.filter(r => parseInt(r.traffic) > 0).map(r => parseInt(r.net_leases));

  console.log('=== OVERALL ACCURACY ===');
  console.log(`Metric              | Old Model    | New Model    | Improvement`);
  console.log(`--------------------|-------------|-------------|------------`);

  const oldMAE_T = avg(oldTrafficAbsErrors);
  const newMAE_T = avg(newTrafficAbsErrors);
  console.log(`Traffic MAE         | ${oldMAE_T.toFixed(2).padStart(11)} | ${newMAE_T.toFixed(2).padStart(11)} | ${((1 - newMAE_T/oldMAE_T) * 100).toFixed(1)}%`);

  const oldMAPE_T = mape(oldTrafficErrors, actualTraffics) * 100;
  const newMAPE_T = mape(newTrafficErrors, actualTraffics) * 100;
  console.log(`Traffic MAPE        | ${oldMAPE_T.toFixed(1).padStart(10)}% | ${newMAPE_T.toFixed(1).padStart(10)}% | ${((1 - newMAPE_T/oldMAPE_T) * 100).toFixed(1)}%`);

  const oldMAE_L = avg(oldLeaseErrors.map(Math.abs));
  const newMAE_L = avg(newLeaseErrors.map(Math.abs));
  console.log(`Lease MAE           | ${oldMAE_L.toFixed(2).padStart(11)} | ${newMAE_L.toFixed(2).padStart(11)} | ${((1 - newMAE_L/oldMAE_L) * 100).toFixed(1)}%`);

  const oldMAPE_L = mape(oldLeaseErrors, actualLeases) * 100;
  const newMAPE_L = mape(newLeaseErrors, actualLeases) * 100;
  console.log(`Lease MAPE          | ${oldMAPE_L.toFixed(1).padStart(10)}% | ${newMAPE_L.toFixed(1).padStart(10)}% | ${((1 - newMAPE_L/oldMAPE_L) * 100).toFixed(1)}%`);

  console.log('\n=== TRAFFIC MAE BY MONTH ===');
  console.log('Month | Old MAE | New MAE | Improvement');
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  for (let m = 1; m <= 12; m++) {
    if (!monthlyOld[m]) continue;
    const oMAE = avg(monthlyOld[m].trafficErr);
    const nMAE = avg(monthlyNew[m].trafficErr);
    const imp = ((1 - nMAE/oMAE) * 100).toFixed(0);
    console.log(`${monthNames[m-1].padEnd(5)} | ${oMAE.toFixed(1).padStart(7)} | ${nMAE.toFixed(1).padStart(7)} | ${imp}%`);
  }

  console.log('\n=== TRAFFIC MAE BY YEAR ===');
  console.log('Year | Old MAE | New MAE | Improvement');
  for (const year of Object.keys(yearlyOld).sort()) {
    const oMAE = avg(yearlyOld[Number(year)].trafficErr);
    const nMAE = avg(yearlyNew[Number(year)].trafficErr);
    const imp = ((1 - nMAE/oMAE) * 100).toFixed(0);
    console.log(`${year} | ${oMAE.toFixed(1).padStart(7)} | ${nMAE.toFixed(1).padStart(7)} | ${imp}%`);
  }

  console.log('\n=== SAMPLE PREDICTIONS (last 10 weeks) ===');
  console.log('Week Ending  | Actual Traffic | Old Pred | New Pred | Actual Leases | Old Leases | New Leases');
  const lastRows = rows.filter(r => parseInt(r.traffic) > 0).slice(-10);
  for (const row of lastRows) {
    const date = new Date(row.week_ending);
    const month = date.getMonth() + 1;
    const units = row.total_units || 290;
    const occ = parseFloat(row.occ_pct) || 0.95;
    const old = predictOld(units, occ, month);
    const nw = predictNew(units, occ, month);
    const dateStr = date.toISOString().split('T')[0];
    console.log(`${dateStr} | ${String(row.traffic).padStart(14)} | ${String(old.traffic).padStart(8)} | ${String(nw.traffic).padStart(8)} | ${String(row.net_leases).padStart(13)} | ${String(old.leases).padStart(10)} | ${String(nw.leases).padStart(10)}`);
  }

  await pool.end();
}

backtest().catch(err => {
  console.error('Backtest failed:', err);
  process.exit(1);
});
