/**
   * Highlands golden fixture — seed path. PINNED 2026-07-05.
   *
   * FINDING K RULING (operator-ratified):
   * Highlands is `owned_import` — it entered at Owned/Operate, was never underwritten
   * on-platform. Hand-creating acquisition/financing/exit assumptions to force an
   * underwriting that never happened (Option 1) is REJECTED — that would violate
   * origin-class honesty.
   *
   * FINDING N RESOLUTION (operator-ratified 2026-07-05):
   * `GoldenFixture` is now a discriminated union keyed on `fixtureClass`
   * (golden.types.ts). `seed_path` fixtures get a narrower `SeedExpected` shape
   * (targetYear, egiAnnual, noiMargin, opexRatio, boundary) instead of the
   * 12-field build/synthetic proforma-return shape. No fabricated
   * acquisition/financing/exit inputs were introduced.
   *
   * Bridge-inclusive philosophy, seed edition: this fixture pins a raw SNAPSHOT of
   * `deal_monthly_actuals` rows (all 93 rows for this deal, budget and proforma
   * rows included exactly as stored, values copy-pasted programmatically from a
   * live psql query result — never hand-typed) and expects the REAL production
   * aggregator (`aggregateSeedActuals`, seed-actuals-aggregator.ts) to reduce that
   * snapshot to the annual metrics below — including correctly excluding
   * is_budget/is_proforma rows itself. The test does not hand-compute the
   * aggregates and compare them to themselves; it runs real aggregation code over
   * pinned real data, the same relationship build_path fixtures have to
   * `runModel()`.
   *
   * Snapshot query (captured 2026-07-05):
   *   SELECT report_month, effective_gross_income, noi, total_opex, is_budget, is_proforma
   *   FROM deal_monthly_actuals
   *   WHERE deal_id = 'eaabeb9f-830e-44f9-a923-56679ad0329d'
   *   ORDER BY report_month ASC, is_budget ASC
   *
   * Verified independently against the live DB before pinning:
   *   - EGI 2025 (12 non-budget, non-proforma months): $6,315,308.53
   *   - NOI margin 2025: 57.16742%
   *   - Opex ratio 2025: 42.83261%
   *   - Boundary (latest non-budget, non-proforma month, any year): 2026-04-01
   *
   * rawAssumptions remains null and there is no snapshotRows analogue for
   * acquisition/financing/exit terms — those inputs genuinely don't exist for an
   * already-owned asset that was never acquired-and-underwritten on-platform, and
   * this fixture makes no claim about them. A build-path Highlands golden does not
   * exist and should not be created for that reason; Bishop alone is the
   * build-path golden (separately blocked by Finding M, W5-DISPATCH.md).
   */

  import type { SeedPathFixture, SeedActualsRow } from './golden.types';

  const snapshotRows: SeedActualsRow[] = [
  { report_month: '2021-12-01', effective_gross_income: 507107, noi: 379895, total_opex: 127212, is_budget: true, is_proforma: false },
  { report_month: '2022-01-01', effective_gross_income: 516144, noi: 319626, total_opex: 196518, is_budget: true, is_proforma: false },
  { report_month: '2022-02-01', effective_gross_income: 505119, noi: 334450, total_opex: 170669, is_budget: true, is_proforma: false },
  { report_month: '2022-03-01', effective_gross_income: 531288, noi: 337262, total_opex: 194026, is_budget: true, is_proforma: false },
  { report_month: '2022-04-01', effective_gross_income: 533228, noi: 346942, total_opex: 186286, is_budget: true, is_proforma: false },
  { report_month: '2022-05-01', effective_gross_income: 543805, noi: 350452, total_opex: 193353, is_budget: true, is_proforma: false },
  { report_month: '2022-06-01', effective_gross_income: 556667, noi: 351001, total_opex: 205666, is_budget: true, is_proforma: false },
  { report_month: '2022-07-01', effective_gross_income: 558008, noi: 338657, total_opex: 219351, is_budget: true, is_proforma: false },
  { report_month: '2022-08-01', effective_gross_income: 552659, noi: 327740, total_opex: 224919, is_budget: true, is_proforma: false },
  { report_month: '2022-09-01', effective_gross_income: 563541, noi: 355206, total_opex: 208335, is_budget: true, is_proforma: false },
  { report_month: '2022-10-01', effective_gross_income: 569100, noi: 380636, total_opex: 188464, is_budget: true, is_proforma: false },
  { report_month: '2022-11-01', effective_gross_income: 562447, noi: 345793, total_opex: 216654, is_budget: true, is_proforma: false },
  { report_month: '2022-12-01', effective_gross_income: 545653, noi: 341035, total_opex: 204618, is_budget: true, is_proforma: false },
  { report_month: '2023-01-01', effective_gross_income: 560278, noi: 342984, total_opex: 217294, is_budget: false, is_proforma: false },
  { report_month: '2023-01-01', effective_gross_income: 565281, noi: 363198, total_opex: 202083, is_budget: true, is_proforma: false },
  { report_month: '2023-02-01', effective_gross_income: 524683, noi: 304752, total_opex: 219931, is_budget: false, is_proforma: false },
  { report_month: '2023-02-01', effective_gross_income: 549189, noi: 344653, total_opex: 204536, is_budget: true, is_proforma: false },
  { report_month: '2023-03-01', effective_gross_income: 527953, noi: 296397, total_opex: 231556, is_budget: false, is_proforma: false },
  { report_month: '2023-03-01', effective_gross_income: 556780, noi: 341433, total_opex: 215347, is_budget: true, is_proforma: false },
  { report_month: '2023-04-01', effective_gross_income: 533856, noi: 298538, total_opex: 235319, is_budget: false, is_proforma: false },
  { report_month: '2023-04-01', effective_gross_income: 565272, noi: 346425, total_opex: 218847, is_budget: true, is_proforma: false },
  { report_month: '2023-05-01', effective_gross_income: 535264, noi: 286774, total_opex: 248489, is_budget: false, is_proforma: false },
  { report_month: '2023-05-01', effective_gross_income: 565791, noi: 334696, total_opex: 231095, is_budget: true, is_proforma: false },
  { report_month: '2023-06-01', effective_gross_income: 534040, noi: 298896, total_opex: 235144, is_budget: false, is_proforma: false },
  { report_month: '2023-06-01', effective_gross_income: 577863, noi: 359179, total_opex: 218684, is_budget: true, is_proforma: false },
  { report_month: '2023-07-01', effective_gross_income: 474023, noi: 251670, total_opex: 222354, is_budget: false, is_proforma: false },
  { report_month: '2023-07-01', effective_gross_income: 551028, noi: 344239, total_opex: 206789, is_budget: true, is_proforma: false },
  { report_month: '2023-08-01', effective_gross_income: 569738, noi: 565781, total_opex: 3958, is_budget: false, is_proforma: false },
  { report_month: '2023-08-01', effective_gross_income: 561342, noi: 557661, total_opex: 3681, is_budget: true, is_proforma: false },
  { report_month: '2023-09-01', effective_gross_income: 529238, noi: 325919, total_opex: 203319, is_budget: false, is_proforma: false },
  { report_month: '2023-09-01', effective_gross_income: 559259, noi: 370172, total_opex: 189087, is_budget: true, is_proforma: false },
  { report_month: '2023-10-01', effective_gross_income: 530068, noi: 276409, total_opex: 253659, is_budget: false, is_proforma: false },
  { report_month: '2023-10-01', effective_gross_income: 563442, noi: 327539, total_opex: 235903, is_budget: true, is_proforma: false },
  { report_month: '2023-11-01', effective_gross_income: 528184, noi: 314313, total_opex: 213871, is_budget: false, is_proforma: false },
  { report_month: '2023-11-01', effective_gross_income: 550107, noi: 351207, total_opex: 198900, is_budget: true, is_proforma: false },
  { report_month: '2023-12-01', effective_gross_income: 531145.03, noi: 325273.09, total_opex: 205871.94, is_budget: false, is_proforma: false },
  { report_month: '2023-12-01', effective_gross_income: 557667, noi: 366206, total_opex: 191461, is_budget: true, is_proforma: false },
  { report_month: '2024-01-01', effective_gross_income: 521152, noi: 319782, total_opex: 201370, is_budget: false, is_proforma: false },
  { report_month: '2024-01-01', effective_gross_income: 558782, noi: 371508, total_opex: 187274, is_budget: true, is_proforma: false },
  { report_month: '2024-02-01', effective_gross_income: 525169, noi: 291154, total_opex: 234015, is_budget: false, is_proforma: false },
  { report_month: '2024-02-01', effective_gross_income: 554415, noi: 336781, total_opex: 217634, is_budget: true, is_proforma: false },
  { report_month: '2024-03-01', effective_gross_income: 525677, noi: 301882, total_opex: 223795, is_budget: false, is_proforma: false },
  { report_month: '2024-03-01', effective_gross_income: 556244, noi: 348115, total_opex: 208129, is_budget: true, is_proforma: false },
  { report_month: '2024-04-01', effective_gross_income: 532287, noi: 310159, total_opex: 222128, is_budget: false, is_proforma: false },
  { report_month: '2024-04-01', effective_gross_income: 557110, noi: 350531, total_opex: 206579, is_budget: true, is_proforma: false },
  { report_month: '2024-05-01', effective_gross_income: 546197, noi: 302173, total_opex: 244023, is_budget: false, is_proforma: false },
  { report_month: '2024-05-01', effective_gross_income: 566570, noi: 339629, total_opex: 226941, is_budget: true, is_proforma: false },
  { report_month: '2024-06-01', effective_gross_income: 537374, noi: 315035, total_opex: 222339, is_budget: false, is_proforma: false },
  { report_month: '2024-06-01', effective_gross_income: 566182, noi: 359407, total_opex: 206775, is_budget: true, is_proforma: false },
  { report_month: '2024-07-01', effective_gross_income: 508320, noi: 268190, total_opex: 240130, is_budget: false, is_proforma: false },
  { report_month: '2024-07-01', effective_gross_income: 560803, noi: 337482, total_opex: 223321, is_budget: true, is_proforma: false },
  { report_month: '2024-08-01', effective_gross_income: 512219, noi: 290354, total_opex: 221865, is_budget: false, is_proforma: false },
  { report_month: '2024-08-01', effective_gross_income: 555840, noi: 349506, total_opex: 206334, is_budget: true, is_proforma: false },
  { report_month: '2024-09-01', effective_gross_income: 541228, noi: 312334, total_opex: 228894, is_budget: false, is_proforma: false },
  { report_month: '2024-09-01', effective_gross_income: 552816, noi: 339945, total_opex: 212871, is_budget: true, is_proforma: false },
  { report_month: '2024-10-01', effective_gross_income: 503529, noi: 276587, total_opex: 226941, is_budget: false, is_proforma: false },
  { report_month: '2024-10-01', effective_gross_income: 545203, noi: 334148, total_opex: 211055, is_budget: true, is_proforma: false },
  { report_month: '2024-11-01', effective_gross_income: 537414, noi: 326539, total_opex: 210875, is_budget: false, is_proforma: false },
  { report_month: '2024-11-01', effective_gross_income: 556705, noi: 360591, total_opex: 196114, is_budget: true, is_proforma: false },
  { report_month: '2024-12-01', effective_gross_income: 525755.41, noi: 318333.38, total_opex: 207422, is_budget: false, is_proforma: false },
  { report_month: '2024-12-01', effective_gross_income: 545081, noi: 352179, total_opex: 192902, is_budget: true, is_proforma: false },
  { report_month: '2025-01-01', effective_gross_income: 522147, noi: 305628, total_opex: 216519, is_budget: false, is_proforma: false },
  { report_month: '2025-01-01', effective_gross_income: 552959, noi: 351596, total_opex: 201363, is_budget: true, is_proforma: false },
  { report_month: '2025-02-01', effective_gross_income: 532326, noi: 308369, total_opex: 223958, is_budget: false, is_proforma: false },
  { report_month: '2025-02-01', effective_gross_income: 565716, noi: 357435, total_opex: 208281, is_budget: true, is_proforma: false },
  { report_month: '2025-03-01', effective_gross_income: 514852, noi: 265117, total_opex: 249736, is_budget: false, is_proforma: false },
  { report_month: '2025-03-01', effective_gross_income: 548895, noi: 316641, total_opex: 232254, is_budget: true, is_proforma: false },
  { report_month: '2025-04-01', effective_gross_income: 534993.39, noi: 297243.98, total_opex: 237749.41, is_budget: false, is_proforma: false },
  { report_month: '2025-04-01', effective_gross_income: 882360, noi: 661253, total_opex: 221107, is_budget: true, is_proforma: false },
  { report_month: '2025-05-01', effective_gross_income: 538297.9, noi: 299190.84, total_opex: 239107.06, is_budget: false, is_proforma: false },
  { report_month: '2025-05-01', effective_gross_income: 865132, noi: 642762, total_opex: 222370, is_budget: true, is_proforma: false },
  { report_month: '2025-06-01', effective_gross_income: 601461.42, noi: 361493.52, total_opex: 239967.9, is_budget: false, is_proforma: false },
  { report_month: '2025-06-01', effective_gross_income: 878332, noi: 655162, total_opex: 223170, is_budget: true, is_proforma: false },
  { report_month: '2025-07-01', effective_gross_income: 488240.32, noi: 241955.59, total_opex: 246284.73, is_budget: false, is_proforma: false },
  { report_month: '2025-07-01', effective_gross_income: 838104, noi: 609059, total_opex: 229045, is_budget: true, is_proforma: false },
  { report_month: '2025-08-01', effective_gross_income: 533852.44, noi: 302184.29, total_opex: 231668.15, is_budget: false, is_proforma: false },
  { report_month: '2025-08-01', effective_gross_income: 845261, noi: 629810, total_opex: 215451, is_budget: true, is_proforma: false },
  { report_month: '2025-09-01', effective_gross_income: 506057.33, noi: 320227.25, total_opex: 185830.08, is_budget: false, is_proforma: false },
  { report_month: '2025-09-01', effective_gross_income: 748591, noi: 575769, total_opex: 172822, is_budget: true, is_proforma: false },
  { report_month: '2025-10-01', effective_gross_income: 516806.28, noi: 281649.59, total_opex: 235156.69, is_budget: false, is_proforma: false },
  { report_month: '2025-10-01', effective_gross_income: 870500, noi: 651804, total_opex: 218696, is_budget: true, is_proforma: false },
  { report_month: '2025-11-01', effective_gross_income: 514061.14, noi: 364351.36, total_opex: 149709.78, is_budget: false, is_proforma: false },
  { report_month: '2025-11-01', effective_gross_income: 841921, noi: 702691, total_opex: 139230, is_budget: true, is_proforma: false },
  { report_month: '2025-12-01', effective_gross_income: 512213.31, noi: 262888.73, total_opex: 249324.58, is_budget: false, is_proforma: false },
  { report_month: '2025-12-01', effective_gross_income: 772163, noi: 540291, total_opex: 231872, is_budget: true, is_proforma: false },
  { report_month: '2026-01-01', effective_gross_income: 504062.13, noi: 277186.66, total_opex: 226875.47, is_budget: false, is_proforma: false },
  { report_month: '2026-01-01', effective_gross_income: 793467, noi: 582473, total_opex: 210994, is_budget: true, is_proforma: false },
  { report_month: '2026-02-01', effective_gross_income: 516716.91, noi: 315074.44, total_opex: 201642.47, is_budget: false, is_proforma: false },
  { report_month: '2026-02-01', effective_gross_income: 767174, noi: 579647, total_opex: 187527, is_budget: true, is_proforma: false },
  { report_month: '2026-03-01', effective_gross_income: 490508.16, noi: 262556.24, total_opex: 227951.92, is_budget: false, is_proforma: false },
  { report_month: '2026-03-01', effective_gross_income: 834997, noi: 623002, total_opex: 211995, is_budget: true, is_proforma: false },
  { report_month: '2026-04-01', effective_gross_income: 491296.5, noi: 258143.11, total_opex: 233153.39, is_budget: false, is_proforma: false },
  { report_month: '2026-04-01', effective_gross_income: 774155, noi: 557322, total_opex: 216833, is_budget: true, is_proforma: false },
  ];

  export const highlandsFixture: SeedPathFixture = {
    dealId: 'eaabeb9f',
    dealIdFull: 'eaabeb9f-830e-44f9-a923-56679ad0329d',
    dealName: 'Highlands',
    fixtureClass: 'seed_path',
    rawAssumptions: null, // Seed path: no ProFormaAssumptions — values are post-engine
    snapshotRows,
    expected: {
      targetYear: 2025,
      egiAnnual: 6315308.529999999,
      noiMargin: 0.5716742314092452,
      opexRatio: 0.4283260852815373,
      boundary: '2026-04-01',
    },
    provenance: {
      captureDate: '2026-07-05T00:00:00Z',
      source: 'seed_actuals',
      buildEndpoint: 'deal_monthly_actuals (direct query) → aggregateSeedActuals() — seed-actuals-aggregator.ts',
      inputSnapshot: 'highlands-snapshot-2026-07-05 (93 rows, deal_id eaabeb9f-830e-44f9-a923-56679ad0329d)',
      bodySource: 'Raw table snapshot, budget/proforma rows included as-stored; aggregator excludes them.',
      originClass: 'owned_import',
      pathBoundRule: true,
    },
  };
  