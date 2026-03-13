import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  serial,
  numeric,
  boolean,
  date,
  timestamp,
  jsonb,
  bigint,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

export const propertyTypeEnum = pgEnum('property_type', [
  'single_family', 'multi_family', 'commercial', 'industrial', 'land', 'mixed_use', 'other'
]);

export const msas = pgTable('msas', {
  id: serial('id').primaryKey(),
  cbsaCode: varchar('cbsa_code', { length: 10 }).unique(),
  name: varchar('name', { length: 200 }).notNull(),
  stateCodes: varchar('state_codes', { length: 20 }),
  geometry: jsonb('geometry'),
  centroid: jsonb('centroid'),
  population: integer('population'),
  medianHouseholdIncome: numeric('median_household_income', { precision: 12, scale: 2 }),
  totalProperties: integer('total_properties'),
  totalUnits: integer('total_units'),
  avgOccupancy: numeric('avg_occupancy', { precision: 5, scale: 3 }),
  avgRent: numeric('avg_rent', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const submarkets = pgTable('submarkets', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  msaId: integer('msa_id').notNull().references(() => msas.id),
  geometry: jsonb('geometry'),
  centroid: jsonb('centroid'),
  source: varchar('source', { length: 100 }),
  externalId: varchar('external_id', { length: 100 }),
  propertiesCount: integer('properties_count'),
  totalUnits: integer('total_units'),
  avgOccupancy: numeric('avg_occupancy', { precision: 5, scale: 3 }),
  avgRent: numeric('avg_rent', { precision: 10, scale: 2 }),
  avgCapRate: numeric('avg_cap_rate', { precision: 5, scale: 3 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  msaIdx: index('idx_submarkets_msa').on(table.msaId),
}));

export const properties = pgTable('properties', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 300 }),
  addressLine1: varchar('address_line1', { length: 500 }),
  city: varchar('city', { length: 100 }),
  stateCode: varchar('state_code', { length: 2 }),
  zip: varchar('zip', { length: 10 }),
  county: varchar('county', { length: 100 }),
  propertyType: propertyTypeEnum('property_type'),
  productType: varchar('product_type', { length: 50 }),
  yearBuilt: integer('year_built'),
  units: integer('units'),
  totalSf: numeric('total_sf', { precision: 12, scale: 2 }),
  lotAcres: numeric('lot_acres', { precision: 10, scale: 4 }),
  stories: integer('stories'),
  lat: numeric('lat', { precision: 10, scale: 7 }),
  lng: numeric('lng', { precision: 10, scale: 7 }),
  submarketId: varchar('submarket_id', { length: 100 }),
  msaId: integer('msa_id').references(() => msas.id),
  ownershipStatus: varchar('ownership_status', { length: 20 }).default('pipeline'),
  pipelineStage: varchar('pipeline_stage', { length: 30 }),
  acquisitionDate: date('acquisition_date'),
  acquisitionPrice: numeric('acquisition_price', { precision: 14, scale: 2 }),
  jediScore: numeric('jedi_score', { precision: 5, scale: 2 }),
  jediScoreUpdated: timestamp('jedi_score_updated', { withTimezone: true }),
  recommendedStrategy: varchar('recommended_strategy', { length: 20 }),
  arbitrageFlag: boolean('arbitrage_flag').default(false),
  arbitrageDelta: numeric('arbitrage_delta', { precision: 5, scale: 2 }),
  buildingClass: varchar('building_class', { length: 10 }),
  sqft: integer('sqft'),
  rent: numeric('rent', { precision: 10, scale: 2 }),
  beds: integer('beds'),
  baths: numeric('baths', { precision: 3, scale: 1 }),
  currentOccupancy: numeric('current_occupancy', { precision: 5, scale: 3 }),
  avgRent: numeric('avg_rent', { precision: 10, scale: 2 }),
  marketRent: numeric('market_rent', { precision: 10, scale: 2 }),
  leaseExpirationDate: date('lease_expiration_date'),
  currentLeaseAmount: numeric('current_lease_amount', { precision: 10, scale: 2 }),
  leaseStartDate: date('lease_start_date'),
  renewalStatus: varchar('renewal_status', { length: 50 }),
  assessorUrl: text('assessor_url'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const dealMonthlyActuals = pgTable('deal_monthly_actuals', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
  reportMonth: date('report_month').notNull(),
  totalUnits: integer('total_units'),
  occupiedUnits: integer('occupied_units'),
  occupancyRate: numeric('occupancy_rate', { precision: 5, scale: 3 }),
  avgMarketRent: numeric('avg_market_rent', { precision: 10, scale: 2 }),
  avgEffectiveRent: numeric('avg_effective_rent', { precision: 10, scale: 2 }),
  grossPotentialRent: numeric('gross_potential_rent', { precision: 14, scale: 2 }),
  lossToLease: numeric('loss_to_lease', { precision: 12, scale: 2 }),
  vacancyLoss: numeric('vacancy_loss', { precision: 12, scale: 2 }),
  concessions: numeric('concessions', { precision: 12, scale: 2 }),
  badDebt: numeric('bad_debt', { precision: 12, scale: 2 }),
  netRentalIncome: numeric('net_rental_income', { precision: 14, scale: 2 }),
  otherIncome: numeric('other_income', { precision: 12, scale: 2 }),
  utilityReimbursement: numeric('utility_reimbursement', { precision: 12, scale: 2 }),
  lateFees: numeric('late_fees', { precision: 10, scale: 2 }),
  miscIncome: numeric('misc_income', { precision: 10, scale: 2 }),
  effectiveGrossIncome: numeric('effective_gross_income', { precision: 14, scale: 2 }),
  payroll: numeric('payroll', { precision: 12, scale: 2 }),
  repairsMaintenance: numeric('repairs_maintenance', { precision: 12, scale: 2 }),
  turnoverCosts: numeric('turnover_costs', { precision: 12, scale: 2 }),
  marketing: numeric('marketing', { precision: 12, scale: 2 }),
  adminGeneral: numeric('admin_general', { precision: 12, scale: 2 }),
  managementFee: numeric('management_fee', { precision: 12, scale: 2 }),
  managementFeePct: numeric('management_fee_pct', { precision: 5, scale: 3 }),
  utilities: numeric('utilities', { precision: 12, scale: 2 }),
  contractServices: numeric('contract_services', { precision: 12, scale: 2 }),
  propertyTax: numeric('property_tax', { precision: 12, scale: 2 }),
  insurance: numeric('insurance', { precision: 12, scale: 2 }),
  hoaCondoFees: numeric('hoa_condo_fees', { precision: 12, scale: 2 }),
  totalOpex: numeric('total_opex', { precision: 14, scale: 2 }),
  opexPerUnit: numeric('opex_per_unit', { precision: 10, scale: 2 }),
  opexRatio: numeric('opex_ratio', { precision: 5, scale: 3 }),
  noi: numeric('noi', { precision: 14, scale: 2 }),
  noiPerUnit: numeric('noi_per_unit', { precision: 10, scale: 2 }),
  debtService: numeric('debt_service', { precision: 12, scale: 2 }),
  debtServiceInterest: numeric('debt_service_interest', { precision: 12, scale: 2 }),
  capex: numeric('capex', { precision: 12, scale: 2 }),
  capexReserves: numeric('capex_reserves', { precision: 12, scale: 2 }),
  cashFlowBeforeTax: numeric('cash_flow_before_tax', { precision: 14, scale: 2 }),
  newLeases: integer('new_leases'),
  renewals: integer('renewals'),
  moveOuts: integer('move_outs'),
  leaseTradeOut: numeric('lease_trade_out', { precision: 10, scale: 2 }),
  renewalRate: numeric('renewal_rate', { precision: 5, scale: 3 }),
  avgDaysToLease: numeric('avg_days_to_lease', { precision: 7, scale: 2 }),
  adr: numeric('adr', { precision: 10, scale: 2 }),
  revpar: numeric('revpar', { precision: 10, scale: 2 }),
  strOccupancy: numeric('str_occupancy', { precision: 5, scale: 3 }),
  strRevenue: numeric('str_revenue', { precision: 12, scale: 2 }),
  dataSource: varchar('data_source', { length: 50 }),
  uploadId: uuid('upload_id'),
  isBudget: boolean('is_budget').default(false),
  isProforma: boolean('is_proforma').default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  propertyIdx: index('idx_actuals_property').on(table.propertyId),
  monthIdx: index('idx_actuals_month').on(table.reportMonth),
  propertyMonthIdx: index('idx_actuals_property_month').on(table.propertyId, table.reportMonth),
  uploadIdx: index('idx_actuals_upload').on(table.uploadId),
  uniqueMonthly: uniqueIndex('idx_actuals_unique')
    .on(table.propertyId, table.reportMonth, table.isBudget, table.isProforma),
}));

export const dataUploads = pgTable('data_uploads', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull(),
  propertyId: uuid('property_id').references(() => properties.id),
  originalFilename: varchar('original_filename', { length: 500 }).notNull(),
  fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
  fileType: varchar('file_type', { length: 20 }).notNull(),
  storagePath: varchar('storage_path', { length: 1000 }),
  status: varchar('status', { length: 20 }).default('pending'),
  columnMapping: jsonb('column_mapping').notNull().default({}),
  sourceFormat: varchar('source_format', { length: 50 }),
  rowsTotal: integer('rows_total').default(0),
  rowsSucceeded: integer('rows_succeeded').default(0),
  rowsFailed: integer('rows_failed').default(0),
  errorLog: jsonb('error_log').default([]),
  dataStartDate: date('data_start_date'),
  dataEndDate: date('data_end_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => ({
  userIdx: index('idx_uploads_user').on(table.userId),
  propertyIdx: index('idx_uploads_property').on(table.propertyId),
  statusIdx: index('idx_uploads_status').on(table.status),
}));

export const uploadTemplates = pgTable('upload_templates', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 100 }).notNull(),
  sourceFormat: varchar('source_format', { length: 50 }).unique().notNull(),
  columnMapping: jsonb('column_mapping').notNull(),
  description: text('description'),
  isSystem: boolean('is_system').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const proformaTemplates = pgTable('proforma_templates', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  propertyType: varchar('property_type', { length: 50 }),
  productType: varchar('product_type', { length: 50 }),
  strategy: varchar('strategy', { length: 20 }),
  holdYears: integer('hold_years').default(5),
  rentGrowthYr1: numeric('rent_growth_yr1', { precision: 5, scale: 3 }).default('0.03'),
  rentGrowthYr2_5: numeric('rent_growth_yr2_5', { precision: 5, scale: 3 }).default('0.025'),
  rentGrowthYr6_10: numeric('rent_growth_yr6_10', { precision: 5, scale: 3 }).default('0.02'),
  vacancyRate: numeric('vacancy_rate', { precision: 5, scale: 3 }).default('0.05'),
  vacancyTrend: numeric('vacancy_trend', { precision: 5, scale: 3 }).default('0'),
  concessionPct: numeric('concession_pct', { precision: 5, scale: 3 }).default('0.01'),
  badDebtPct: numeric('bad_debt_pct', { precision: 5, scale: 3 }).default('0.015'),
  otherIncomePerUnit: numeric('other_income_per_unit', { precision: 10, scale: 2 }).default('150'),
  opexRatio: numeric('opex_ratio', { precision: 5, scale: 3 }).default('0.45'),
  opexGrowth: numeric('opex_growth', { precision: 5, scale: 3 }).default('0.025'),
  managementFeePct: numeric('management_fee_pct', { precision: 5, scale: 3 }).default('0.05'),
  capexPerUnit: numeric('capex_per_unit', { precision: 10, scale: 2 }).default('300'),
  propertyTaxGrowth: numeric('property_tax_growth', { precision: 5, scale: 3 }).default('0.02'),
  insuranceGrowth: numeric('insurance_growth', { precision: 5, scale: 3 }).default('0.03'),
  ltv: numeric('ltv', { precision: 5, scale: 3 }).default('0.70'),
  interestRate: numeric('interest_rate', { precision: 5, scale: 4 }).default('0.065'),
  amortizationYears: integer('amortization_years').default(30),
  loanTermYears: integer('loan_term_years').default(10),
  ioPeriodMonths: integer('io_period_months').default(0),
  exitCapRate: numeric('exit_cap_rate', { precision: 5, scale: 3 }).default('0.055'),
  exitCapSpread: numeric('exit_cap_spread', { precision: 5, scale: 3 }).default('0.001'),
  sellingCostsPct: numeric('selling_costs_pct', { precision: 5, scale: 3 }).default('0.02'),
  targetIrr: numeric('target_irr', { precision: 5, scale: 3 }).default('0.15'),
  targetCoc: numeric('target_coc', { precision: 5, scale: 3 }).default('0.08'),
  targetEquityMult: numeric('target_equity_mult', { precision: 5, scale: 2 }).default('2.0'),
  targetDscrMin: numeric('target_dscr_min', { precision: 5, scale: 2 }).default('1.25'),
  isDefault: boolean('is_default').default(false),
  isSystem: boolean('is_system').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userIdx: index('idx_templates_user').on(table.userId),
  strategyIdx: index('idx_templates_strategy').on(table.strategy),
}));

export const proformaSnapshots = pgTable('proforma_snapshots', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
  templateId: uuid('template_id').references(() => proformaTemplates.id),
  strategy: varchar('strategy', { length: 20 }).notNull(),
  layer1Baseline: jsonb('layer1_baseline').notNull().default({}),
  layer2Adjusted: jsonb('layer2_adjusted').notNull().default({}),
  layer3User: jsonb('layer3_user').notNull().default({}),
  activeLayer: varchar('active_layer', { length: 10 }).default('layer2'),
  year1Noi: numeric('year1_noi', { precision: 14, scale: 2 }),
  goingInCap: numeric('going_in_cap', { precision: 5, scale: 4 }),
  cocReturn: numeric('coc_return', { precision: 5, scale: 4 }),
  irr: numeric('irr', { precision: 5, scale: 4 }),
  equityMultiple: numeric('equity_multiple', { precision: 5, scale: 2 }),
  dscr: numeric('dscr', { precision: 5, scale: 2 }),
  debtYield: numeric('debt_yield', { precision: 5, scale: 4 }),
  annualProjections: jsonb('annual_projections'),
  optimalExitYear: integer('optimal_exit_year'),
  exitValue: numeric('exit_value', { precision: 14, scale: 2 }),
  generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow(),
  generatedBy: varchar('generated_by', { length: 20 }).default('platform'),
  notes: text('notes'),
}, (table) => ({
  propertyIdx: index('idx_proforma_property').on(table.propertyId),
  strategyIdx: index('idx_proforma_strategy').on(table.strategy),
}));

export const msasRelations = relations(msas, ({ many }) => ({
  submarkets: many(submarkets),
}));

export const submarketsRelations = relations(submarkets, ({ one }) => ({
  msa: one(msas, { fields: [submarkets.msaId], references: [msas.id] }),
}));

export const dealMonthlyActualsRelations = relations(dealMonthlyActuals, ({ one }) => ({
  property: one(properties, { fields: [dealMonthlyActuals.propertyId], references: [properties.id] }),
}));

export const dataUploadsRelations = relations(dataUploads, ({ one }) => ({
  property: one(properties, { fields: [dataUploads.propertyId], references: [properties.id] }),
}));

export const proformaTemplatesRelations = relations(proformaTemplates, ({ many }) => ({
  snapshots: many(proformaSnapshots),
}));

export const proformaSnapshotsRelations = relations(proformaSnapshots, ({ one }) => ({
  property: one(properties, { fields: [proformaSnapshots.propertyId], references: [properties.id] }),
  template: one(proformaTemplates, {
    fields: [proformaSnapshots.templateId],
    references: [proformaTemplates.id],
  }),
}));

export const dealLeaseTransactions = pgTable('deal_lease_transactions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  dealId: uuid('deal_id').notNull(),
  unitNumber: varchar('unit_number', { length: 20 }),
  unitType: varchar('unit_type', { length: 30 }),
  sqft: integer('sqft'),
  leaseType: varchar('lease_type', { length: 20 }).notNull(),
  leaseStart: date('lease_start'),
  marketRent: numeric('market_rent', { precision: 10, scale: 2 }),
  priorRent: numeric('prior_rent', { precision: 10, scale: 2 }),
  newRent: numeric('new_rent', { precision: 10, scale: 2 }),
  rentChangeDollar: numeric('rent_change_dollar', { precision: 10, scale: 2 }),
  rentChangePct: numeric('rent_change_pct', { precision: 7, scale: 4 }),
  lossToLease: numeric('loss_to_lease', { precision: 10, scale: 2 }),
  lossToLeasePct: numeric('loss_to_lease_pct', { precision: 7, scale: 4 }),
  rentPsf: numeric('rent_psf', { precision: 7, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  dealIdx: index('idx_lease_tx_deal').on(table.dealId),
  leaseStartIdx: index('idx_lease_tx_start').on(table.leaseStart),
  unitTypeIdx: index('idx_lease_tx_unit_type').on(table.unitType),
  typeIdx: index('idx_lease_tx_type').on(table.leaseType),
}));

export type Msa = typeof msas.$inferSelect;
export type NewMsa = typeof msas.$inferInsert;
export type Submarket = typeof submarkets.$inferSelect;
export type NewSubmarket = typeof submarkets.$inferInsert;
export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
export type DealMonthlyActual = typeof dealMonthlyActuals.$inferSelect;
export type NewDealMonthlyActual = typeof dealMonthlyActuals.$inferInsert;
export type DataUpload = typeof dataUploads.$inferSelect;
export type NewDataUpload = typeof dataUploads.$inferInsert;
export type UploadTemplate = typeof uploadTemplates.$inferSelect;
export type ProformaTemplate = typeof proformaTemplates.$inferSelect;
export type NewProformaTemplate = typeof proformaTemplates.$inferInsert;
export type ProformaSnapshot = typeof proformaSnapshots.$inferSelect;
export type NewProformaSnapshot = typeof proformaSnapshots.$inferInsert;
export type DealLeaseTransaction = typeof dealLeaseTransactions.$inferSelect;
export type NewDealLeaseTransaction = typeof dealLeaseTransactions.$inferInsert;
