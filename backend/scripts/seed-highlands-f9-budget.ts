/**
 * seed-highlands-f9-budget.ts
 *
 * Task #1744 — Replace hardcoded T1719 budget baseline with real F9 pro-forma
 *              model output for Highlands at Sweetwater Creek.
 *
 * What it does:
 *   1. Deletes T1719 approximated budget rows (derived from actuals heuristics).
 *   2. Inserts real acquisition pro-forma values sourced from the eCFM tab of the
 *      APINV export (Myers Apartment Group / Highlands at Sweetwater Creek).
 *
 * The XLS pro-forma starts June 2021 (Month 1).  Actuals span Dec 2021–Apr 2026
 * (proforma months 7–59).  Only those months are seeded so every budget row has
 * a corresponding actual for variance analysis.
 *
 * Run: cd backend && npx ts-node --transpile-only scripts/seed-highlands-f9-budget.ts
 *      Add --dry-run to preview without writing.
 */

import { query, getClient } from '../src/database/connection';
import { logger } from '../src/utils/logger';

const PROPERTY_ID = '7ea31caf-f070-43eb-9fd1-fe08f7123701';
const DEAL_ID     = 'eaabeb9f-830e-44f9-a923-56679ad0329d';
const TOTAL_UNITS = 290;

const DRY_RUN = process.argv.includes('--dry-run');

// ── F9 Pro-forma monthly data ──────────────────────────────────────────────────
// Source: attached_assets/20260531211538_APINVExport_1780368774750.xls (eCFM tab)
// Month index 0 = June 2021.  We use months 6–58 (Dec 2021–Apr 2026) to align
// with the actuals series already in deal_monthly_actuals.

interface ProformaMonth {
  month: string;           // YYYY-MM-01
  occupiedUnits: number;
  occupancyRate: number;
  grossPotentialRent: number;
  lossToLease: number;
  vacancyLoss: number;     // subtotal vacancy/collection (incl. bad debt)
  badDebt: number;
  concessions: number;     // subtotal rent discount
  otherIncome: number;
  effectiveGrossIncome: number;
  payroll: number;
  utilities: number;
  repairsMaintenance: number;
  serviceContracts: number;
  turnoverCosts: number;
  marketing: number;
  adminGeneral: number;
  managementFee: number;
  insurance: number;
  propertyTax: number;
  replacementReserve: number;
  totalOpex: number;
  noi: number;
}

// Data extracted programmatically from the eCFM sheet.
// Arrays are indexed 0..71 (months 1..72 = Jun 2021..May 2027).
// Only indices 6..58 (Dec 2021..Apr 2026) are used below.

const MONTHS: string[] = [
  '2021-06-01','2021-07-01','2021-08-01','2021-09-01','2021-10-01','2021-11-01',
  '2021-12-01','2022-01-01','2022-02-01','2022-03-01','2022-04-01','2022-05-01',
  '2022-06-01','2022-07-01','2022-08-01','2022-09-01','2022-10-01','2022-11-01',
  '2022-12-01','2023-01-01','2023-02-01','2023-03-01','2023-04-01','2023-05-01',
  '2023-06-01','2023-07-01','2023-08-01','2023-09-01','2023-10-01','2023-11-01',
  '2023-12-01','2024-01-01','2024-02-01','2024-03-01','2024-04-01','2024-05-01',
  '2024-06-01','2024-07-01','2024-08-01','2024-09-01','2024-10-01','2024-11-01',
  '2024-12-01','2025-01-01','2025-02-01','2025-03-01','2025-04-01','2025-05-01',
  '2025-06-01','2025-07-01','2025-08-01','2025-09-01','2025-10-01','2025-11-01',
  '2025-12-01','2026-01-01','2026-02-01','2026-03-01','2026-04-01',
];

// Row 13: Units Occupied (all stabilized months at 290 per proforma)
const UNITS_OCCUPIED = [
  209,234,254,269,284,290,
  290,290,290,290,290,290,
  290,290,290,290,290,290,
  290,290,290,290,290,290,
  290,290,290,290,290,290,
  290,290,290,290,290,290,
  290,290,290,290,290,290,
  290,290,290,290,290,290,
  290,290,290,290,290,290,
  290,290,290,290,290,
];

// Row 14: % Occupied
const PCT_OCCUPIED = [
  0.6847,0.7666,0.8321,0.8812,0.9303,0.9500,
  0.9500,0.9500,0.9500,0.9500,0.9500,0.9500,
  0.9500,0.9500,0.9500,0.9500,0.9500,0.9500,
  0.9500,0.9500,0.9500,0.9500,0.9500,0.9500,
  0.9500,0.9500,0.9500,0.9500,0.9500,0.9500,
  0.9500,0.9500,0.9500,0.9500,0.9500,0.9500,
  0.9500,0.9500,0.9500,0.9500,0.9500,0.9500,
  0.9500,0.9500,0.9500,0.9500,0.9500,0.9500,
  0.9500,0.9500,0.9500,0.9500,0.9500,0.9500,
  0.9500,0.9500,0.9500,0.9500,0.9500,
];

// Row 25: Base Rent Potential (GPR)
const GPR = [
  485826.28,485826.28,485826.28,486598.78,487371.28,488143.78,
  488916.28,489688.78,490461.28,491233.78,492006.28,492778.78,
  508357.82,508941.31,508941.31,508941.31,508941.31,508941.31,
  508941.31,508941.31,508941.31,508941.31,508941.31,508941.31,
  524209.55,524209.55,524209.55,524209.55,524209.55,524209.55,
  524209.55,524209.55,524209.55,524209.55,524209.55,524209.55,
  539935.84,539935.84,539935.84,539935.84,539935.84,539935.84,
  539935.84,539935.84,539935.84,539935.84,539935.84,539935.84,
  556133.91,556133.91,556133.91,556133.91,556133.91,556133.91,
  556133.91,556133.91,556133.91,556133.91,556133.91,
];

// Row 30: Loss to Lease
const LOSS_TO_LEASE = [
  15005.02,14843.09,14843.09,15568.08,16293.07,17018.06,
  17540.97,16648.37,14081.90,11994.36,9327.26,5026.61,
  11416.43,10096.26,8573.32,7510.46,6405.91,6035.56,
  5983.04,5382.18,4052.40,3016.79,1919.76,298.70,
  8878.99,7552.57,6631.12,5835.06,5095.64,4763.97,
  4709.87,4290.12,3368.49,2550.72,1570.13,0.00,
  9145.36,7779.15,6830.05,6010.12,5248.51,4906.89,
  4851.17,4418.82,3469.54,2627.24,1617.23,0.00,
  9419.72,8012.52,7034.95,6190.42,5405.97,5054.09,
  4996.71,4551.38,3573.63,2706.06,1665.75,
];

// Row 36: Subtotal Vacancy / Collection (vacancy + employee units + bad debt)
const VACANCY_LOSS = [
  172237.36,128429.22,96661.79,69305.41,43878.48,32467.96,
  32515.47,32562.98,32671.67,32719.18,32766.69,32814.19,
  33772.30,33808.19,33808.19,33808.19,33808.19,33808.19,
  33808.19,33808.19,33808.19,33808.19,33808.19,33808.19,
  34762.89,34762.89,34762.89,34762.89,34762.89,34762.89,
  34762.89,34762.89,34762.89,34762.89,34762.89,34762.89,
  35742.12,35742.12,35742.12,35742.12,35742.12,35742.12,
  35742.12,35742.12,35742.12,35742.12,35742.12,35742.12,
  36749.23,36749.23,36749.23,36749.23,36749.23,36749.23,
  36749.23,36749.23,36749.23,36749.23,36749.23,
];

// Row 35: Bad Debt
const BAD_DEBT = [
  2628.08,2628.08,2628.08,2631.95,2635.81,2639.67,
  2643.53,2647.40,2656.23,2660.10,2663.96,2667.82,
  2745.72,2748.63,2748.63,2748.63,2748.63,2748.63,
  2748.63,2748.63,2753.73,2753.73,2753.73,2753.73,
  2830.07,2830.07,2830.07,2830.07,2830.07,2830.07,
  2830.07,2830.07,2835.30,2835.30,2835.30,2835.30,
  2913.93,2913.93,2913.93,2913.93,2913.93,2913.93,
  2913.93,2913.93,2919.29,2919.29,2919.29,2919.29,
  3000.28,3000.28,3000.28,3000.28,3000.28,3000.28,
  3000.28,3005.77,3005.77,3005.77,3005.77,
];

// Row 41: Subtotal Rent Discount (concession + renewal discount)
const CONCESSIONS = [
  140418.66,40787.33,29390.47,25670.78,23741.34,10883.86,
  233.83,546.35,1086.60,1505.39,2009.01,2694.39,
  2509.33,2495.93,2495.93,2495.93,2495.93,2495.93,
  2495.93,2495.93,2495.93,2495.93,2495.93,2495.93,
  2569.83,2569.83,2569.83,2569.83,2569.83,2569.83,
  2569.83,2569.83,2569.83,2569.83,2569.83,2569.83,
  2646.93,2646.93,2646.93,2646.93,2646.93,2646.93,
  2646.93,2646.93,2646.93,2646.93,2646.93,2646.93,
  2726.33,2726.33,2726.33,2726.33,2726.33,2726.33,
  2726.33,2726.33,2726.33,2726.33,2726.33,
];

// Row 26: Other Income 1 Potential
const OTHER_INCOME = [
  39790.58,39790.58,39790.58,39790.58,39790.58,39790.58,
  39790.58,39790.58,40785.35,40785.35,40785.35,40785.35,
  40785.35,40785.35,40785.35,40785.35,40785.35,40785.35,
  40785.35,40785.35,41804.98,41804.98,41804.98,41804.98,
  41804.98,41804.98,41804.98,41804.98,41804.98,41804.98,
  41804.98,41804.98,42850.11,42850.11,42850.11,42850.11,
  42850.11,42850.11,42850.11,42850.11,42850.11,42850.11,
  42850.11,42850.11,43921.36,43921.36,43921.36,43921.36,
  43921.36,43921.36,43921.36,43921.36,43921.36,43921.36,
  43921.36,45019.39,45019.39,45019.39,45019.39,
];

// Row 43: Total Effective Gross Income
const EGI = [
  197955.83,341557.23,384721.52,415845.09,443249.07,467564.48,
  478416.60,479721.67,483406.46,485800.20,488688.67,493028.94,
  501445.10,503326.28,504849.22,505911.52,507017.42,507386.92,
  507475.15,508376.91,511179.73,512629.90,514230.69,516537.03,
  522285.79,523612.63,524534.25,525329.94,526068.77,526400.82,
  526455.47,526885.97,528812.41,529634.86,530614.70,532185.10,
  537798.87,539164.84,540115.33,540933.63,541695.73,542037.63,
  542092.77,542526.09,544479.94,545322.64,546332.67,547950.29,
  553732.27,555138.97,556117.41,556961.07,557745.78,558098.49,
  558154.82,558599.76,560608.76,561475.53,562516.64,
];

// Row 51: Payroll
const PAYROLL = [
  38666.67,38666.67,38666.67,38666.67,38666.67,38666.67,
  38666.67,38666.67,39826.67,39826.67,39826.67,39826.67,
  39826.67,39826.67,39826.67,39826.67,39826.67,39826.67,
  39826.67,39826.67,40989.47,40989.47,40989.47,40989.47,
  40989.47,40989.47,40989.47,40989.47,40989.47,40989.47,
  40989.47,40989.47,42159.13,42159.13,42159.13,42159.13,
  42159.13,42159.13,42159.13,42159.13,42159.13,42159.13,
  42159.13,42159.13,43363.88,43363.88,43363.88,43363.88,
  43363.88,43363.88,43363.88,43363.88,43363.88,43363.88,
  43363.88,44605.30,44605.30,44605.30,44605.30,
];

// Row 47: Utility Cost
const UTILITIES = [
  21750.00,21750.00,21750.00,21750.00,21750.00,21750.00,
  21750.00,21750.00,22185.00,22185.00,22185.00,22185.00,
  22185.00,22185.00,22185.00,22185.00,22185.00,22185.00,
  22185.00,22185.00,22628.70,22628.70,22628.70,22628.70,
  22628.70,22628.70,22628.70,22628.70,22628.70,22628.70,
  22628.70,22628.70,23081.27,23081.27,23081.27,23081.27,
  23081.27,23081.27,23081.27,23081.27,23081.27,23081.27,
  23081.27,23081.27,23542.90,23542.90,23542.90,23542.90,
  23542.90,23542.90,23542.90,23542.90,23542.90,23542.90,
  23542.90,24013.76,24013.76,24013.76,24013.76,
];

// Row 48: Maintenance Repairs
const REPAIRS_MAINTENANCE = [
  6041.67,6041.67,6041.67,6041.67,6041.67,6041.67,
  6041.67,6041.67,6132.29,6132.29,6132.29,6132.29,
  6132.29,6132.29,6132.29,6132.29,6132.29,6132.29,
  6132.29,6132.29,6254.94,6254.94,6254.94,6254.94,
  6254.94,6254.94,6254.94,6254.94,6254.94,6254.94,
  6254.94,6254.94,6380.04,6380.04,6380.04,6380.04,
  6380.04,6380.04,6380.04,6380.04,6380.04,6380.04,
  6380.04,6380.04,6507.64,6507.64,6507.64,6507.64,
  6507.64,6507.64,6507.64,6507.64,6507.64,6507.64,
  6507.64,6637.79,6637.79,6637.79,6637.79,
];

// Row 49: Service Contracts
const SERVICE_CONTRACTS = [
  3625.00,3625.00,3625.00,3625.00,3625.00,3625.00,
  3625.00,3625.00,3697.50,3697.50,3697.50,3697.50,
  3697.50,3697.50,3697.50,3697.50,3697.50,3697.50,
  3697.50,3697.50,3771.45,3771.45,3771.45,3771.45,
  3771.45,3771.45,3771.45,3771.45,3771.45,3771.45,
  3771.45,3771.45,3846.88,3846.88,3846.88,3846.88,
  3846.88,3846.88,3846.88,3846.88,3846.88,3846.88,
  3846.88,3846.88,3923.82,3923.82,3923.82,3923.82,
  3923.82,3923.82,3923.82,3923.82,3923.82,3923.82,
  3923.82,4002.29,4002.29,4002.29,4002.29,
];

// Row 50: Turnover
const TURNOVER = [
  4833.33,4833.33,4833.33,4833.33,4833.33,4833.33,
  4833.33,4833.33,4905.83,4905.83,4905.83,4905.83,
  4905.83,4905.83,4905.83,4905.83,4905.83,4905.83,
  4905.83,4905.83,5003.95,5003.95,5003.95,5003.95,
  5003.95,5003.95,5003.95,5003.95,5003.95,5003.95,
  5003.95,5003.95,5104.03,5104.03,5104.03,5104.03,
  5104.03,5104.03,5104.03,5104.03,5104.03,5104.03,
  5104.03,5104.03,5206.11,5206.11,5206.11,5206.11,
  5206.11,5206.11,5206.11,5206.11,5206.11,5206.11,
  5206.11,5310.23,5310.23,5310.23,5310.23,
];

// Row 52: Marketing
const MARKETING = [
  8579.17,8579.17,8579.17,8579.17,8579.17,8579.17,
  8579.17,8579.17,8750.75,8750.75,8750.75,8750.75,
  8750.75,8750.75,8750.75,8750.75,8750.75,8750.75,
  8750.75,8750.75,8925.77,8925.77,8925.77,8925.77,
  8925.77,8925.77,8925.77,8925.77,8925.77,8925.77,
  8925.77,8925.77,9104.28,9104.28,9104.28,9104.28,
  9104.28,9104.28,9104.28,9104.28,9104.28,9104.28,
  9104.28,9104.28,9286.37,9286.37,9286.37,9286.37,
  9286.37,9286.37,9286.37,9286.37,9286.37,9286.37,
  9286.37,9472.10,9472.10,9472.10,9472.10,
];

// Row 53: Admin
const ADMIN = [
  6283.33,6283.33,6283.33,6283.33,6283.33,6283.33,
  6283.33,6283.33,6409.00,6409.00,6409.00,6409.00,
  6409.00,6409.00,6409.00,6409.00,6409.00,6409.00,
  6409.00,6409.00,6537.18,6537.18,6537.18,6537.18,
  6537.18,6537.18,6537.18,6537.18,6537.18,6537.18,
  6537.18,6537.18,6667.92,6667.92,6667.92,6667.92,
  6667.92,6667.92,6667.92,6667.92,6667.92,6667.92,
  6667.92,6667.92,6801.28,6801.28,6801.28,6801.28,
  6801.28,6801.28,6801.28,6801.28,6801.28,6801.28,
  6801.28,6937.31,6937.31,6937.31,6937.31,
];

// Row 57: Management Fee (2.5% of EGI)
const MGMT_FEE = [
  4948.90,8538.93,9618.04,10396.13,11081.22,11689.11,
  11960.41,11993.04,12085.16,12145.01,12217.22,12325.72,
  12536.13,12583.16,12621.23,12647.79,12675.44,12684.67,
  12686.88,12709.42,12779.49,12815.75,12855.77,12913.43,
  13057.14,13090.32,13113.36,13133.25,13151.72,13160.02,
  13161.39,13172.15,13220.31,13240.87,13265.37,13304.63,
  13444.97,13479.12,13502.88,13523.34,13542.39,13550.94,
  13552.32,13563.15,13611.00,13633.07,13658.32,13698.76,
  13843.31,13878.47,13902.94,13924.03,13943.64,13952.46,
  13953.87,13964.99,14015.22,14036.89,14062.92,
];

// Row 58: Insurance
const INSURANCE = [
  9666.67,9666.67,9666.67,9666.67,9666.67,9666.67,
  9666.67,9666.67,9666.67,9666.67,9666.67,9666.67,
  10150.00,10150.00,10150.00,10150.00,10150.00,10150.00,
  10150.00,10150.00,10150.00,10150.00,10150.00,10150.00,
  10657.50,10657.50,10657.50,10657.50,10657.50,10657.50,
  10657.50,10657.50,10657.50,10657.50,10657.50,10657.50,
  11190.38,11190.38,11190.38,11190.38,11190.38,11190.38,
  11190.38,11190.38,11190.38,11190.38,11190.38,11190.38,
  11749.89,11749.89,11749.89,11749.89,11749.89,11749.89,
  11749.89,12337.39,12337.39,12337.39,12337.39,
];

// Row 59: Property Taxes
const PROPERTY_TAX = [
  65792.31,65792.31,65792.31,65792.31,65792.31,65792.31,
  65792.31,88819.62,88819.62,88819.62,88819.62,88819.62,
  88819.62,88819.62,88819.62,88819.62,88819.62,88819.62,
  88819.62,88819.62,88819.62,88819.62,88819.62,88819.62,
  93260.60,93260.60,93260.60,93260.60,93260.60,93260.60,
  93260.60,93260.60,93260.60,93260.60,93260.60,93260.60,
  97923.63,97923.63,97923.63,97923.63,97923.63,97923.63,
  97923.63,97923.63,97923.63,97923.63,97923.63,97923.63,
  102819.81,102819.81,102819.81,102819.81,102819.81,102819.81,
  102819.81,107960.80,107960.80,107960.80,107960.80,
];

// Row 62: Replacement Reserve ($200/unit/yr = $4,833/mo, flat)
const REPL_RESERVE = [
  4833.33,4833.33,4833.33,4833.33,4833.33,4833.33,
  4833.33,4833.33,4833.33,4833.33,4833.33,4833.33,
  4833.33,4833.33,4833.33,4833.33,4833.33,4833.33,
  4833.33,4833.33,4833.33,4833.33,4833.33,4833.33,
  4833.33,4833.33,4833.33,4833.33,4833.33,4833.33,
  4833.33,4833.33,4833.33,4833.33,4833.33,4833.33,
  4833.33,4833.33,4833.33,4833.33,4833.33,4833.33,
  4833.33,4833.33,4833.33,4833.33,4833.33,4833.33,
  4833.33,4833.33,4833.33,4833.33,4833.33,4833.33,
  4833.33,4833.33,4833.33,4833.33,4833.33,
];

// Row 63: Total Project Operating Expenses (controllable + non-controllable + reserve)
const TOTAL_OPEX = [
  175020.37,178610.41,179689.51,180467.60,181152.70,181760.59,
  182031.89,205091.83,207311.82,207371.66,207443.88,207552.38,
  208246.12,208293.15,208331.22,208358.12,208385.02,208394.25,
  208396.46,209752.09,212002.57,212039.16,212079.24,212136.80,
  212788.33,212821.09,212844.03,212864.12,212883.07,212891.38,
  212892.45,214254.63,216540.24,216559.92,216584.81,216623.92,
  216977.04,217011.85,217035.24,217056.22,217075.05,217083.65,
  217085.00,218467.57,220809.22,220829.71,220854.97,220896.46,
  221258.19,221293.29,221316.91,221338.69,221358.09,221367.18,
  221368.55,222773.43,225173.40,225193.95,225220.00,
];

// Row 65: Net Operating Income
const NOI = [
  22935.46,162946.82,205032.00,235377.48,262096.27,285803.89,
  296384.71,274629.84,276094.63,278428.54,281244.80,285476.56,
  293198.98,295033.13,296517.99,297553.40,298631.40,298992.67,
  299078.69,298624.82,299177.16,300590.74,302150.45,304400.23,
  309497.46,310791.54,311690.22,312465.82,313186.70,313509.44,
  313563.02,312631.34,312272.17,313075.94,314030.89,315561.18,
  320821.83,322152.99,323079.09,323877.41,324620.68,324954.98,
  325007.77,324058.52,323670.72,324492.93,325477.70,327053.83,
  332474.08,333845.68,334800.50,335622.38,336387.69,336731.31,
  336786.27,335826.33,335435.36,336281.58,337296.64,
];

// ── Build proforma records ─────────────────────────────────────────────────────
function buildProformaMonths(): ProformaMonth[] {
  // Index 6 = Dec 2021, index 58 = Apr 2026 (59 months total, aligned with actuals)
  const START_IDX = 6;
  const END_IDX   = 58;

  const result: ProformaMonth[] = [];
  for (let i = START_IDX; i <= END_IDX; i++) {
    const occ    = UNITS_OCCUPIED[i] ?? 275;
    const occPct = PCT_OCCUPIED[i] ?? 0.95;

    // avg_market_rent = GPR / TOTAL_UNITS
    // avg_effective_rent = (EGI - otherIncome) / occupied_units
    const egi      = EGI[i] ?? 0;
    const other    = OTHER_INCOME[i] ?? 0;
    const avgEffRent = occ > 0 ? Math.round((egi - other) / occ) : 0;

    result.push({
      month:              MONTHS[i],
      occupiedUnits:      occ,
      occupancyRate:      occPct,
      grossPotentialRent: GPR[i] ?? 0,
      lossToLease:        LOSS_TO_LEASE[i] ?? 0,
      vacancyLoss:        VACANCY_LOSS[i] ?? 0,
      badDebt:            BAD_DEBT[i] ?? 0,
      concessions:        CONCESSIONS[i] ?? 0,
      otherIncome:        other,
      effectiveGrossIncome: egi,
      payroll:            PAYROLL[i] ?? 0,
      utilities:          UTILITIES[i] ?? 0,
      repairsMaintenance: REPAIRS_MAINTENANCE[i] ?? 0,
      serviceContracts:   SERVICE_CONTRACTS[i] ?? 0,
      turnoverCosts:      TURNOVER[i] ?? 0,
      marketing:          MARKETING[i] ?? 0,
      adminGeneral:       ADMIN[i] ?? 0,
      managementFee:      MGMT_FEE[i] ?? 0,
      insurance:          INSURANCE[i] ?? 0,
      propertyTax:        PROPERTY_TAX[i] ?? 0,
      replacementReserve: REPL_RESERVE[i] ?? 0,
      totalOpex:          TOTAL_OPEX[i] ?? 0,
      noi:                NOI[i] ?? 0,
    });
  }
  return result;
}

// ── Step 1: Delete T1719 budget rows ─────────────────────────────────────────
async function deleteT1719Rows(): Promise<number> {
  console.log('\n=== STEP 1: Delete T1719 heuristic budget rows ===');

  const countRes = await query(
    `SELECT COUNT(*) AS n FROM deal_monthly_actuals
     WHERE property_id = $1
       AND is_budget = true
       AND notes = 'T1719 pro-forma budget seed from actuals baseline'`,
    [PROPERTY_ID]
  );
  const n = parseInt(String(countRes.rows[0]?.n ?? '0'), 10);
  console.log(`  Found ${n} T1719 budget rows`);

  if (n === 0) {
    console.log('  ✓ Nothing to delete');
    return 0;
  }

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would delete ${n} rows`);
    return n;
  }

  const delRes = await query(
    `DELETE FROM deal_monthly_actuals
     WHERE property_id = $1
       AND is_budget = true
       AND notes = 'T1719 pro-forma budget seed from actuals baseline'`,
    [PROPERTY_ID]
  );
  console.log(`  ✓ Deleted ${delRes.rowCount} T1719 budget rows`);
  return delRes.rowCount ?? 0;
}

// ── Step 2: Insert real F9 budget rows ────────────────────────────────────────
async function insertF9BudgetRows(months: ProformaMonth[]): Promise<void> {
  console.log('\n=== STEP 2: Insert real F9 pro-forma budget rows ===');
  console.log(`  Inserting ${months.length} months (Dec 2021 – Apr 2026)`);

  if (DRY_RUN) {
    months.slice(0, 3).forEach(m => {
      console.log(`  [DRY-RUN] ${m.month}: GPR=${m.grossPotentialRent.toFixed(0)}, EGI=${m.effectiveGrossIncome.toFixed(0)}, OpEx=${m.totalOpex.toFixed(0)}, NOI=${m.noi.toFixed(0)}`);
    });
    console.log('  [DRY-RUN] ... (skipping remaining months)');
    return;
  }

  const client = await getClient();
  let inserted = 0;
  let skipped  = 0;

  try {
    await client.query('BEGIN');

    for (const m of months) {
      const avgMktRent  = Math.round(m.grossPotentialRent / TOTAL_UNITS);

      const res = await client.query(
        `INSERT INTO deal_monthly_actuals (
           property_id, deal_id, report_month,
           total_units, occupied_units, occupancy_rate,
           avg_market_rent, avg_effective_rent,
           gross_potential_rent, loss_to_lease, vacancy_loss,
           bad_debt, concessions,
           other_income, effective_gross_income,
           payroll, utilities, repairs_maintenance,
           contract_services, turnover_costs,
           marketing, admin_general, management_fee,
           insurance, property_tax, capex_reserves,
           total_opex, noi,
           is_budget, is_proforma, is_portfolio_asset,
           data_source, notes
         ) VALUES (
           $1, $2, $3,
           $4, $5, $6,
           $7, $8,
           $9, $10, $11,
           $12, $13,
           $14, $15,
           $16, $17, $18,
           $19, $20,
           $21, $22, $23,
           $24, $25, $26,
           $27, $28,
           true, false, true,
           'f9_proforma', 'T1744 real F9 acquisition pro-forma (Myers Apartment Group APINV export)'
         )
         ON CONFLICT (property_id, report_month, is_budget, is_proforma) DO UPDATE SET
           total_units          = EXCLUDED.total_units,
           occupied_units       = EXCLUDED.occupied_units,
           occupancy_rate       = EXCLUDED.occupancy_rate,
           avg_market_rent      = EXCLUDED.avg_market_rent,
           avg_effective_rent   = EXCLUDED.avg_effective_rent,
           gross_potential_rent = EXCLUDED.gross_potential_rent,
           loss_to_lease        = EXCLUDED.loss_to_lease,
           vacancy_loss         = EXCLUDED.vacancy_loss,
           bad_debt             = EXCLUDED.bad_debt,
           concessions          = EXCLUDED.concessions,
           other_income         = EXCLUDED.other_income,
           effective_gross_income = EXCLUDED.effective_gross_income,
           payroll              = EXCLUDED.payroll,
           utilities            = EXCLUDED.utilities,
           repairs_maintenance  = EXCLUDED.repairs_maintenance,
           contract_services    = EXCLUDED.contract_services,
           turnover_costs       = EXCLUDED.turnover_costs,
           marketing            = EXCLUDED.marketing,
           admin_general        = EXCLUDED.admin_general,
           management_fee       = EXCLUDED.management_fee,
           insurance            = EXCLUDED.insurance,
           property_tax         = EXCLUDED.property_tax,
           capex_reserves       = EXCLUDED.capex_reserves,
           total_opex           = EXCLUDED.total_opex,
           noi                  = EXCLUDED.noi,
           data_source          = EXCLUDED.data_source,
           notes                = EXCLUDED.notes,
           updated_at           = now()
         RETURNING id, xmax`,
        [
          PROPERTY_ID, DEAL_ID, m.month,
          TOTAL_UNITS, m.occupiedUnits, m.occupancyRate,
          avgMktRent, m.occupiedUnits > 0
            ? Math.round((m.effectiveGrossIncome - m.otherIncome) / m.occupiedUnits)
            : 0,
          Math.round(m.grossPotentialRent),
          Math.round(m.lossToLease),
          Math.round(m.vacancyLoss),
          Math.round(m.badDebt),
          Math.round(m.concessions),
          Math.round(m.otherIncome),
          Math.round(m.effectiveGrossIncome),
          Math.round(m.payroll),
          Math.round(m.utilities),
          Math.round(m.repairsMaintenance),
          Math.round(m.serviceContracts),
          Math.round(m.turnoverCosts),
          Math.round(m.marketing),
          Math.round(m.adminGeneral),
          Math.round(m.managementFee),
          Math.round(m.insurance),
          Math.round(m.propertyTax),
          Math.round(m.replacementReserve),
          Math.round(m.totalOpex),
          Math.round(m.noi),
        ]
      );

      const row = res.rows[0];
      if (row && Number(row.xmax) === 0) inserted++;
      else skipped++;
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  console.log(`  ✓ Budget rows: ${inserted} inserted, ${skipped} updated (upserted)`);
}

// ── Validation ─────────────────────────────────────────────────────────────────
async function validate(): Promise<void> {
  console.log('\n=== Validation ===');

  const [budgetRes, sampleRes] = await Promise.all([
    query(
      `SELECT COUNT(*) AS n FROM deal_monthly_actuals
       WHERE property_id = $1 AND is_budget = true`,
      [PROPERTY_ID]
    ),
    query(
      `SELECT report_month,
              gross_potential_rent::float AS gpr,
              effective_gross_income::float AS egi,
              total_opex::float AS opex,
              noi::float,
              notes
       FROM deal_monthly_actuals
       WHERE property_id = $1 AND is_budget = true
       ORDER BY report_month
       LIMIT 5`,
      [PROPERTY_ID]
    ),
  ]);

  const budgetN = parseInt(String(budgetRes.rows[0]?.n), 10);
  console.log(`  Budget rows total: ${budgetN} ${budgetN >= 53 ? '✓' : '✗ EXPECTED >= 53'}`);

  console.log('\n  Sample budget rows:');
  sampleRes.rows.forEach(r => {
    console.log(`    ${r.report_month?.toISOString?.().slice(0, 10) ?? r.report_month}: GPR=${Math.round(r.gpr).toLocaleString()}, EGI=${Math.round(r.egi).toLocaleString()}, OpEx=${Math.round(r.opex).toLocaleString()}, NOI=${Math.round(r.noi).toLocaleString()}`);
  });

  // Confirm T1719 rows are gone
  const oldRes = await query(
    `SELECT COUNT(*) AS n FROM deal_monthly_actuals
     WHERE property_id = $1
       AND is_budget = true
       AND notes = 'T1719 pro-forma budget seed from actuals baseline'`,
    [PROPERTY_ID]
  );
  const oldN = parseInt(String(oldRes.rows[0]?.n), 10);
  console.log(`\n  T1719 legacy rows remaining: ${oldN} ${oldN === 0 ? '✓' : '✗ SHOULD BE 0'}`);

  if (budgetN < 53 || oldN > 0) {
    console.error('\n  ✗ Validation failed');
    process.exit(1);
  }
  console.log('\n  All checks passed ✓');
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Highlands F9 Budget Seeder — Task #1744');
  console.log(`Property: ${PROPERTY_ID}`);
  console.log(`Deal:     ${DEAL_ID}`);
  if (DRY_RUN) console.log('MODE:     DRY-RUN (no DB writes)');

  try {
    const proformaMonths = buildProformaMonths();
    console.log(`\nBuilt ${proformaMonths.length} pro-forma months (Dec 2021 – Apr 2026)`);

    await deleteT1719Rows();
    await insertF9BudgetRows(proformaMonths);

    if (!DRY_RUN) {
      await validate();
    }

    console.log('\nDone.\n');
    process.exit(0);
  } catch (err) {
    logger.error('Seed script error:', err);
    console.error('\n✗ Script failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
