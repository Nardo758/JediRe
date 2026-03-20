import {
  pgTable, uuid, text, numeric, integer, boolean,
  timestamp, jsonb, index, uniqueIndex,
} from "drizzle-orm/pg-core";

export const compProperties = pgTable("comp_properties", {
  id:          uuid("id").defaultRandom().primaryKey(),
  dealId:      uuid("deal_id").notNull(),
  tradeAreaId: uuid("trade_area_id").notNull(),
  name:        text("name").notNull(),
  address:     text("address"),
  class:       text("class"),
  builtYear:   integer("built_year"),
  totalUnits:  integer("total_units"),
  isSubject:   boolean("is_subject").default(false),
  sourceUrl:   text("source_url"),
  scrapedAt:   timestamp("scraped_at"),
  createdAt:   timestamp("created_at").defaultNow(),
  updatedAt:   timestamp("updated_at").defaultNow(),
}, (t) => ({
  dealIdx: index("comp_deal_idx").on(t.dealId),
  areaIdx: index("comp_area_idx").on(t.tradeAreaId),
}));

export const compUnitTypes = pgTable("comp_unit_types", {
  id:           uuid("id").defaultRandom().primaryKey(),
  compId:       uuid("comp_id").notNull().references(() => compProperties.id, { onDelete: "cascade" }),
  unitType:     text("unit_type").notNull(),
  mixPct:       numeric("mix_pct", { precision: 5, scale: 2 }),
  avgSf:        integer("avg_sf"),
  avgRent:      numeric("avg_rent", { precision: 10, scale: 2 }),
  vacancyPct:   numeric("vacancy_pct", { precision: 5, scale: 2 }),
  daysOnMarket: numeric("days_on_market", { precision: 5, scale: 1 }),
  concessions:  numeric("concessions", { precision: 4, scale: 1 }),
  scrapedAt:    timestamp("scraped_at"),
  createdAt:    timestamp("created_at").defaultNow(),
}, (t) => ({
  compIdx:    index("cut_comp_idx").on(t.compId),
  typeIdx:    index("cut_type_idx").on(t.unitType),
  compTypeUq: uniqueIndex("cut_comp_type_uq").on(t.compId, t.unitType),
}));

export const unitTypeTrends = pgTable("unit_type_trends", {
  id:          uuid("id").defaultRandom().primaryKey(),
  tradeAreaId: uuid("trade_area_id").notNull(),
  unitType:    text("unit_type").notNull(),
  monthLabel:  text("month_label").notNull(),
  periodDate:  timestamp("period_date").notNull(),
  avgVacancy:  numeric("avg_vacancy", { precision: 5, scale: 2 }),
  avgDom:      numeric("avg_dom", { precision: 5, scale: 1 }),
  avgRent:     numeric("avg_rent", { precision: 10, scale: 2 }),
  avgConc:     numeric("avg_conc", { precision: 4, scale: 1 }),
  compCount:   integer("comp_count"),
  createdAt:   timestamp("created_at").defaultNow(),
}, (t) => ({
  areaTypeIdx: index("utt_area_type_idx").on(t.tradeAreaId, t.unitType),
  dateIdx:     index("utt_date_idx").on(t.periodDate),
}));

export const dealUnitPrograms = pgTable("deal_unit_programs", {
  id:          uuid("id").defaultRandom().primaryKey(),
  dealId:      uuid("deal_id").notNull().unique(),
  totalUnits:  integer("total_units").notNull(),
  unitConfig:  jsonb("unit_config").notNull(),
  totalNetSf:  integer("total_net_sf"),
  grossRevPA:  numeric("gross_rev_pa", { precision: 14, scale: 2 }),
  mixTotal:    numeric("mix_total", { precision: 5, scale: 2 }),
  updatedBy:   uuid("updated_by"),
  createdAt:   timestamp("created_at").defaultNow(),
  updatedAt:   timestamp("updated_at").defaultNow(),
});
