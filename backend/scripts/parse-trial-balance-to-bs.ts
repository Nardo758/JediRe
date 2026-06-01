/**
 * parse-trial-balance-to-bs.ts
 *
 * Reads Trial Balance Excel files (stored locally) for Highlands (p2122),
 * parses them using the existing parseTrialBalance function, and inserts
 * derived balance sheet rows into `balance_sheets`.
 *
 * Usage: npx ts-node --transpile-only scripts/parse-trial-balance-to-bs.ts [--dry-run]
 */

import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import { parseTrialBalance } from '../src/services/document-extraction/parsers/trial-balance-parser';
import { TrialBalanceRow } from '../src/services/document-extraction/types';

const DEAL_ID = 'eaabeb9f-830e-44f9-a923-56679ad0329d';
const DRY_RUN = process.argv.includes('--dry-run');
// file_path in deal_files is relative to backend/ (process.cwd() when the server runs)
// __dirname = .../backend/scripts → ../ = backend/
const WORKSPACE_ROOT = path.resolve(__dirname, '..');

function findByKeyword(rows: TrialBalanceRow[], keywords: string[]): number {
  return rows
    .filter(r => keywords.some(k => r.accountName.toLowerCase().includes(k)))
    .reduce((s, r) => s + (r.netBalance ?? 0), 0);
}

function deriveBalanceSheet(rows: TrialBalanceRow[], period: string) {
  const assets      = rows.filter(r => r.category === 'Assets');
  const liabilities = rows.filter(r => r.category === 'Liabilities');
  const equity      = rows.filter(r => r.category === 'Equity');
  const revenue     = rows.filter(r => r.category === 'Revenue');
  const expenses    = rows.filter(r => r.category === 'Expenses' || r.category === 'Other Expense');

  const cash                = findByKeyword(assets, ['cash', 'bank', 'operating account', 'petty']);
  const accounts_receivable = findByKeyword(assets, ['receivable', 'tenant receivable', 'ar ']);
  const prepaid_expenses    = findByKeyword(assets, ['prepaid', 'deposit paid', 'escrow']);
  const fixed_assets_raw    = findByKeyword(assets, ['building', 'land', 'equipment', 'improvement', 'furniture', 'fixture', 'accum', 'depreciat']);
  const total_assets        = assets.reduce((s, r) => s + (r.netBalance ?? 0), 0);
  const other_current_assets = total_assets - cash - accounts_receivable - prepaid_expenses - fixed_assets_raw;

  // Liability accounts are credit-normal: their netBalance is negative in this trial balance.
  // We negate so that the balance sheet stores positive liability values.
  const accounts_payable  = -findByKeyword(liabilities, ['payable', 'ap ', 'vendor', 'trade payable']);
  const accrued_expenses  = -findByKeyword(liabilities, ['accrued', 'accrual']);
  const security_deposits = -findByKeyword(liabilities, ['deposit', 'security', 'pet deposit']);
  const prepaid_rent      = -findByKeyword(liabilities, ['prepaid rent', 'unearned', 'deferred rent']);
  const total_liabilities = -liabilities.reduce((s, r) => s + (r.netBalance ?? 0), 0);
  const other_liabilities = total_liabilities - accounts_payable - accrued_expenses - security_deposits - prepaid_rent;

  // Equity accounts are also credit-normal; retain signed values so negative book equity is preserved.
  const contributed_capital   = -findByKeyword(equity, ['capital', 'contribution', 'partner', 'member', 'paid-in', 'paid in']);
  const retained_earnings     = -findByKeyword(equity, ['retained', 'prior year', 'beginning balance', 'surplus']);
  const netRevenue            = revenue.reduce((s, r)  => s + (r.netBalance ?? 0), 0);
  const netExpenses           = expenses.reduce((s, r) => s + (r.netBalance ?? 0), 0);
  const current_year_earnings = netRevenue - netExpenses;
  // Total equity from equity section only (Revenue/Expense are P&L, not balance sheet equity accounts)
  const total_equity          = -(equity.reduce((s, r) => s + (r.netBalance ?? 0), 0));

  const rnd = (n: number) => Math.round(n * 100) / 100;
  return {
    report_month:          period,
    cash:                  rnd(cash),
    accounts_receivable:   rnd(accounts_receivable),
    prepaid_expenses:      rnd(prepaid_expenses),
    other_current_assets:  rnd(other_current_assets),
    fixed_assets:          rnd(fixed_assets_raw),
    total_assets:          rnd(total_assets),
    accounts_payable:      rnd(accounts_payable),
    accrued_expenses:      rnd(accrued_expenses),
    security_deposits:     rnd(security_deposits),
    prepaid_rent:          rnd(prepaid_rent),
    other_liabilities:     rnd(other_liabilities),
    total_liabilities:     rnd(total_liabilities),
    contributed_capital:   rnd(contributed_capital),
    retained_earnings:     rnd(retained_earnings),
    current_year_earnings: rnd(current_year_earnings),
    total_equity:          rnd(total_equity),
  };
}

async function main() {
  const db = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log(`[TB→BS] Starting${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`[TB→BS] Workspace root: ${WORKSPACE_ROOT}`);

  const filesRes = await db.query(
    `SELECT id, filename, file_path
     FROM deal_files
     WHERE deal_id = $1 AND folder_path = '/Trial_Balance'
     ORDER BY created_at`,
    [DEAL_ID]
  );

  const files = filesRes.rows;
  console.log(`[TB→BS] Found ${files.length} trial balance file(s)`);

  let inserted = 0;
  let skipped  = 0;

  for (const file of files) {
    const localPath = path.join(WORKSPACE_ROOT, file.file_path as string);
    console.log(`\n[TB→BS] Processing: ${file.filename}`);
    console.log(`  Path: ${localPath}`);

    if (!fs.existsSync(localPath)) {
      console.error(`  ✗ File not found on disk: ${localPath}`);
      skipped++;
      continue;
    }

    const buffer = fs.readFileSync(localPath);
    console.log(`  Read ${buffer.length} bytes`);

    const result = parseTrialBalance(buffer, file.filename);
    if (!result.success || !result.data) {
      console.error(`  ✗ Parse failed: ${result.error}`);
      if (result.warnings?.length) console.warn(`  Warnings: ${result.warnings.join(', ')}`);
      skipped++;
      continue;
    }

    const tbData = result.data as any;
    const { rows, reportPeriod } = tbData;
    console.log(`  Period: ${reportPeriod}  |  Rows: ${rows.length}`);
    if (result.warnings?.length) console.warn(`  Warnings: ${result.warnings.join('; ')}`);

    // Print a sample of account names to validate mapping
    const assetRows = rows.filter((r: TrialBalanceRow) => r.category === 'Assets').slice(0, 5);
    const liabRows  = rows.filter((r: TrialBalanceRow) => r.category === 'Liabilities').slice(0, 3);
    console.log(`  Asset accounts (sample): ${assetRows.map((r: TrialBalanceRow) => r.accountName).join(', ')}`);
    console.log(`  Liability accounts (sample): ${liabRows.map((r: TrialBalanceRow) => r.accountName).join(', ')}`);

    const bs = deriveBalanceSheet(rows, reportPeriod);
    console.log(`  Total Assets:      $${bs.total_assets.toLocaleString()}`);
    console.log(`  Total Liabilities: $${bs.total_liabilities.toLocaleString()}`);
    console.log(`  Cash:              $${bs.cash.toLocaleString()}`);
    console.log(`  Security Deposits: $${bs.security_deposits.toLocaleString()}`);
    console.log(`  Total Equity:      $${bs.total_equity.toLocaleString()}`);

    if (DRY_RUN) {
      console.log('  [DRY RUN] Skipping insert');
      continue;
    }

    await db.query(
      `INSERT INTO balance_sheets (
         deal_id, report_month,
         cash, accounts_receivable, prepaid_expenses, other_current_assets, fixed_assets, total_assets,
         accounts_payable, accrued_expenses, security_deposits, prepaid_rent, other_liabilities, total_liabilities,
         contributed_capital, retained_earnings, current_year_earnings, total_equity,
         source
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (deal_id, report_month) DO UPDATE SET
         cash                  = EXCLUDED.cash,
         accounts_receivable   = EXCLUDED.accounts_receivable,
         prepaid_expenses      = EXCLUDED.prepaid_expenses,
         other_current_assets  = EXCLUDED.other_current_assets,
         fixed_assets          = EXCLUDED.fixed_assets,
         total_assets          = EXCLUDED.total_assets,
         accounts_payable      = EXCLUDED.accounts_payable,
         accrued_expenses      = EXCLUDED.accrued_expenses,
         security_deposits     = EXCLUDED.security_deposits,
         prepaid_rent          = EXCLUDED.prepaid_rent,
         other_liabilities     = EXCLUDED.other_liabilities,
         total_liabilities     = EXCLUDED.total_liabilities,
         contributed_capital   = EXCLUDED.contributed_capital,
         retained_earnings     = EXCLUDED.retained_earnings,
         current_year_earnings = EXCLUDED.current_year_earnings,
         total_equity          = EXCLUDED.total_equity,
         source                = EXCLUDED.source,
         updated_at            = NOW()`,
      [
        DEAL_ID, bs.report_month,
        bs.cash, bs.accounts_receivable, bs.prepaid_expenses, bs.other_current_assets, bs.fixed_assets, bs.total_assets,
        bs.accounts_payable, bs.accrued_expenses, bs.security_deposits, bs.prepaid_rent, bs.other_liabilities, bs.total_liabilities,
        bs.contributed_capital, bs.retained_earnings, bs.current_year_earnings, bs.total_equity,
        'trial_balance_parse',
      ]
    );
    console.log(`  ✓ Upserted balance sheet for ${reportPeriod}`);
    inserted++;
  }

  console.log(`\n[TB→BS] Done — ${inserted} upserted, ${skipped} skipped`);
  await db.end();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
