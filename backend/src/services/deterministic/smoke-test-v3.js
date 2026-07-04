// Smoke test v3: W3c — split vacancy channels (structural vs turn)
// Two required tests: lease-up shape (climbs) and Highlands shape (holds steady)

const DEF_STANDARD_TURN_DOWNTIME_DAYS = 14;
const DEF_NEW_LEASE_CONCESSION_MONTHS = 1;
const DEF_ANNUAL_TURNOVER_RATE = 0.50;

function createState(a) {
  const occupiedAtInPlace = a.occupancyAtClose != null ? a.units * a.occupancyAtClose : a.units;
  const vacantStructural = a.units - occupiedAtInPlace;
  return {
    occupiedAtInPlace,
    occupiedAtMarket: 0,
    turning: 0,
    vacantStructural,
    vacantTurn: 0,
    concession: 0,
    cumulativeGrowth: 1.0,
    turnEntries: [],
    concessionEntries: [],
    initialVacantUnits: vacantStructural,
  };
}

function getDowntimeMonths(a) {
  if (a.renoTurnDowntimeWeeks != null && a.renoTurnDowntimeWeeks > 0) {
    return a.renoTurnDowntimeWeeks * 7 / 30;
  }
  return (a.standardTurnDowntimeDays ?? DEF_STANDARD_TURN_DOWNTIME_DAYS) / 30;
}

function computeMonth(monthIdx, year, a, state, taxMonth) {
  const totalUnits = a.units;
  const monthlyTurnover = (a.annualTurnoverRate ?? DEF_ANNUAL_TURNOVER_RATE) / 12;
  const downtimeMonths = getDowntimeMonths(a);
  const concessionMonths = a.newLeaseConcessionMonths ?? DEF_NEW_LEASE_CONCESSION_MONTHS;

  if (monthIdx > 0 && monthIdx % 12 === 0) {
    const growthIdx = Math.min(year - 1, a.rentGrowth.length - 1);
    state.cumulativeGrowth *= (1 + (a.rentGrowth[growthIdx] ?? 0.03));
  }

  const marketRent = a.marketRent * state.cumulativeGrowth;
  const inPlaceRent = a.inPlaceRent * state.cumulativeGrowth;

  // STEP 1 -- Lease expiries: draw proportionally from both pools
  const expiringInPlace = state.occupiedAtInPlace * monthlyTurnover;
  const expiringMarket = state.occupiedAtMarket * monthlyTurnover;
  state.occupiedAtInPlace -= expiringInPlace;
  state.occupiedAtMarket -= expiringMarket;
  const totalExpiring = expiringInPlace + expiringMarket;
  state.turning += totalExpiring;
  state.turnEntries[monthIdx] = totalExpiring;

  // STEP 2 -- Turn completion: become vacantTurn (re-leased in full)
  const completedMonth = Math.floor(monthIdx - downtimeMonths);
  const completingTurn = completedMonth >= 0 ? (state.turnEntries[completedMonth] ?? 0) : 0;
  state.turning -= completingTurn;
  state.vacantTurn += completingTurn;

  // STEP 3 -- New leases: split channels
  const pace = a.monthsToStabilize != null && a.monthsToStabilize > 0
    ? Math.ceil(state.initialVacantUnits / a.monthsToStabilize)
    : Math.ceil(state.initialVacantUnits / 24);
  const structuralLeases = Math.min(state.vacantStructural, pace);
  state.vacantStructural -= structuralLeases;
  const turnLeases = state.vacantTurn;
  state.vacantTurn = 0;
  const newLeases = structuralLeases + turnLeases;
  state.concession += newLeases;
  state.concessionEntries[monthIdx] = newLeases;

  // STEP 4 -- Concession expiry
  const concessionCompleteMonth = Math.floor(monthIdx - concessionMonths);
  const concessionCompleting = concessionCompleteMonth >= 0
    ? (state.concessionEntries[concessionCompleteMonth] ?? 0)
    : 0;
  state.concession -= concessionCompleting;
  state.occupiedAtMarket += concessionCompleting;

  // STEP 5 -- Revenue
  const gpr = totalUnits * marketRent;
  const lossToLease = state.occupiedAtInPlace * (marketRent - inPlaceRent);
  const vacancyUnits = state.turning + state.vacantStructural + state.vacantTurn;
  const vacancy = totalUnits > 0 ? vacancyUnits / totalUnits : 0;
  const concessions = state.concession * marketRent;
  const badDebt = gpr * a.badDebt;
  const vacancyLoss = vacancyUnits * marketRent;
  const baseRevenue = gpr - lossToLease - vacancyLoss - concessions - badDebt;

  const expenseGrowthFactor = Math.pow(1 + a.expenseGrowth, year - 1);
  const otherIncome = a.otherIncomePerUnit * totalUnits * expenseGrowthFactor;
  const egi = baseRevenue + otherIncome;

  const payroll = a.payrollPerUnit * totalUnits * expenseGrowthFactor;
  const maintenance = a.maintenancePerUnit * totalUnits * expenseGrowthFactor;
  const contractServices = a.contractServicesPerUnit * totalUnits * expenseGrowthFactor;
  const marketing = a.marketingPerUnit * totalUnits * expenseGrowthFactor;
  const utilities = a.utilitiesPerUnit * totalUnits * expenseGrowthFactor;
  const admin = a.adminPerUnit * totalUnits * expenseGrowthFactor;
  const insurance = a.insurancePerUnit * totalUnits * expenseGrowthFactor;
  const managementFee = egi * a.managementFee;
  const replacementReserves = a.replacementReserves * totalUnits * expenseGrowthFactor;

  const totalExpenses = payroll + maintenance + contractServices + marketing +
    utilities + admin + insurance + taxMonth + managementFee + replacementReserves;

  const noi = egi - totalExpenses;
  const occupiedCount = state.occupiedAtInPlace + state.occupiedAtMarket + state.concession;
  const occupancy = totalUnits > 0 ? occupiedCount / totalUnits : 0;

  return { month: monthIdx + 1, year, noi, occupancy, vacancy, gpr, egi, state: { ...state } };
}

function runSmoke(label, a) {
  const state = createState(a);
  const monthly = [];
  for (let m = 0; m < 36; m++) {
    const year = Math.floor(m / 12) + 1;
    monthly.push(computeMonth(m, year, a, state, 0));
  }

  console.log(`\n=== ${label} ===`);
  const targets = [1, 6, 12, 19, 24, 36];
  for (const t of targets) {
    const row = monthly[t - 1];
    console.log(`  m${String(t).padStart(2)}: NOI=${Math.round(row.noi).toLocaleString().padStart(6)} ` +
      `occ=${(row.occupancy*100).toFixed(1)}% vac=${(row.vacancy*100).toFixed(1)}% ` +
      `inPlace=${row.state.occupiedAtInPlace.toFixed(1)} market=${row.state.occupiedAtMarket.toFixed(1)} ` +
      `turn=${row.state.turning.toFixed(1)} strVac=${row.state.vacantStructural.toFixed(1)} turnVac=${row.state.vacantTurn.toFixed(1)} conc=${row.state.concession.toFixed(1)}`);
  }

  for (let y = 1; y <= 3; y++) {
    const yRows = monthly.filter(r => r.year === y);
    const noi = yRows.reduce((s, r) => s + r.noi, 0);
    const occ = yRows.reduce((s, r) => s + r.occupancy, 0) / yRows.length;
    const vac = yRows.reduce((s, r) => s + r.vacancy, 0) / yRows.length;
    console.log(`  Y${y}: annual NOI=${Math.round(noi).toLocaleString()} avg occ=${(occ*100).toFixed(1)}% avg vac=${(vac*100).toFixed(1)}%`);
  }
}

const baseA = {
  units: 100,
  marketRent: 2500,
  inPlaceRent: 1800,
  rentGrowth: [0.03, 0.03, 0.03, 0.03, 0.03],
  badDebt: 0.01,
  otherIncomePerUnit: 50,
  expenseGrowth: 0.025,
  payrollPerUnit: 180,
  maintenancePerUnit: 120,
  contractServicesPerUnit: 80,
  marketingPerUnit: 40,
  utilitiesPerUnit: 60,
  adminPerUnit: 50,
  insurancePerUnit: 30,
  managementFee: 0.03,
  replacementReserves: 25,
  standardTurnDowntimeDays: 14,
  renoTurnDowntimeWeeks: null,
  newLeaseConcessionMonths: 1,
  annualTurnoverRate: 0.50,
  holdYears: 5,
};

// Test 1: Lease-up shape — 70% occupied at close, mts=19
// Expected: occupancy CLIMBS from ~70% toward mid-90s, structural vacants exhausted ≈ m19
runSmoke('LEASE-UP SHAPE (70% at close, mts=19)', {
  ...baseA,
  occupancyAtClose: 0.70,
  monthsToStabilize: 19,
});

// Test 2: Highlands shape — fully occupied at close (no occupancyAtClose)
// Expected: occupancy HOLDS near steady state (~mid-90s), flat NOI trend
runSmoke('HIGHLANDS SHAPE (100% occupied, no mts)', {
  ...baseA,
  // no occupancyAtClose → fully occupied default
  // no monthsToStabilize → no structural vacants
});
