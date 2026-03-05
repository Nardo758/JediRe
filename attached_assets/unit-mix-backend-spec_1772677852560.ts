// ═══════════════════════════════════════════════════════════════════════
//  UNIT MIX INTELLIGENCE — BACKEND SPEC
//  Powers: comp-unit-intelligence.jsx (all 5 tabs)
//  Stack: Node/TypeScript · Express · Drizzle ORM · PostgreSQL
// ═══════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────────
//  SECTION 1: DATABASE SCHEMA (Drizzle)
//  File: backend/src/db/schema/unitMix.schema.ts
// ───────────────────────────────────────────────────────────────────────

import {
  pgTable, uuid, text, numeric, integer, boolean,
  timestamp, jsonb, index, pgEnum,
} from "drizzle-orm/pg-core";

// ── 1A. COMP PROPERTIES ─────────────────────────────────────────────────
// One row per tracked comp property in a trade area.
// Source: M05 Apartments.com scraper (weekly refresh)

export const compProperties = pgTable("comp_properties", {
  id:          uuid("id").defaultRandom().primaryKey(),
  dealId:      uuid("deal_id").notNull(),          // which deal's comp set
  tradeAreaId: uuid("trade_area_id").notNull(),     // M05 trade area
  name:        text("name").notNull(),
  address:     text("address"),
  class:       text("class"),                       // A, B+, B, C
  builtYear:   integer("built_year"),
  totalUnits:  integer("total_units"),
  isSubject:   boolean("is_subject").default(false),
  sourceUrl:   text("source_url"),                  // apartments.com listing
  scrapedAt:   timestamp("scraped_at"),
  createdAt:   timestamp("created_at").defaultNow(),
  updatedAt:   timestamp("updated_at").defaultNow(),
}, (t) => ({
  dealIdx:  index("comp_deal_idx").on(t.dealId),
  areaIdx:  index("comp_area_idx").on(t.tradeAreaId),
}));

// ── 1B. COMP UNIT TYPE DATA ──────────────────────────────────────────────
// One row per (property × unit_type) — the core comp data model.
// Source: M05 Apartments.com scraper
// Refresh: Weekly (or on-demand via scrape trigger)

export const compUnitTypes = pgTable("comp_unit_types", {
  id:           uuid("id").defaultRandom().primaryKey(),
  compId:       uuid("comp_id").notNull().references(() => compProperties.id, { onDelete: "cascade" }),
  unitType:     text("unit_type").notNull(),       // studio | oneBR | twoBR | threeBR
  mixPct:       numeric("mix_pct", { precision: 5, scale: 2 }),    // % of property inventory
  avgSf:        integer("avg_sf"),                 // avg unit SF for this type
  avgRent:      numeric("avg_rent", { precision: 10, scale: 2 }),  // avg asking rent/mo
  vacancyPct:   numeric("vacancy_pct", { precision: 5, scale: 2 }), // % vacant
  daysOnMarket: numeric("days_on_market", { precision: 5, scale: 1 }),
  concessions:  numeric("concessions", { precision: 4, scale: 1 }), // weeks free rent
  scrapedAt:    timestamp("scraped_at"),
  createdAt:    timestamp("created_at").defaultNow(),
}, (t) => ({
  compIdx:    index("cut_comp_idx").on(t.compId),
  typeIdx:    index("cut_type_idx").on(t.unitType),
  compTypeUq: index("cut_comp_type_uq").on(t.compId, t.unitType),
}));

// ── 1C. UNIT TYPE TRENDS (12-month history) ──────────────────────────────
// One row per (trade_area × unit_type × month) for trend charts.
// Aggregated across all comps in trade area. Appended weekly.

export const unitTypeTrends = pgTable("unit_type_trends", {
  id:          uuid("id").defaultRandom().primaryKey(),
  tradeAreaId: uuid("trade_area_id").notNull(),
  unitType:    text("unit_type").notNull(),
  monthLabel:  text("month_label").notNull(),       // "Jan", "Feb" etc
  periodDate:  timestamp("period_date").notNull(),  // actual date for ordering
  avgVacancy:  numeric("avg_vacancy",   { precision: 5, scale: 2 }),
  avgDom:      numeric("avg_dom",       { precision: 5, scale: 1 }),
  avgRent:     numeric("avg_rent",      { precision: 10, scale: 2 }),
  avgConc:     numeric("avg_conc",      { precision: 4, scale: 1 }),
  compCount:   integer("comp_count"),               // how many comps sampled
  createdAt:   timestamp("created_at").defaultNow(),
}, (t) => ({
  areaTypeIdx: index("utt_area_type_idx").on(t.tradeAreaId, t.unitType),
  dateIdx:     index("utt_date_idx").on(t.periodDate),
}));

// ── 1D. USER PROGRAM (saved unit program per deal) ───────────────────────
// Persists user edits from the Program Editor tab.
// One row per deal. Upserted on every editor save.

export const dealUnitPrograms = pgTable("deal_unit_programs", {
  id:          uuid("id").defaultRandom().primaryKey(),
  dealId:      uuid("deal_id").notNull().unique(),
  totalUnits:  integer("total_units").notNull(),
  // Units stored as JSONB: { studio: {mix,sf,rent}, oneBR: {...}, ... }
  unitConfig:  jsonb("unit_config").notNull(),
  // Downstream outputs (pre-calculated, passed to M09 ProForma)
  totalNetSf:  integer("total_net_sf"),
  grossRevPA:  numeric("gross_rev_pa", { precision: 14, scale: 2 }),
  mixTotal:    numeric("mix_total",    { precision: 5, scale: 2 }),
  updatedBy:   uuid("updated_by"),
  createdAt:   timestamp("created_at").defaultNow(),
  updatedAt:   timestamp("updated_at").defaultNow(),
});

// ── 1E. ZONING CONSTRAINTS (M02 feed — already exists, ensure these cols) ─
// Your M02 zoning table should expose these fields.
// This is the SELECT shape the unit mix module reads:
//
//   SELECT zoning_code, max_units, max_net_sf, excludes_parking,
//          max_height_stories, max_lot_coverage_pct,
//          source_citation, source_url, confidence_score
//   FROM   deal_zoning
//   WHERE  deal_id = $1
//   AND    data_type = 'entitlement'


// ═══════════════════════════════════════════════════════════════════════
//  SECTION 2: SERVICE LAYER
//  File: backend/src/services/unitMixIntelligence.service.ts
// ═══════════════════════════════════════════════════════════════════════

import { db } from "../db";
import { eq, and, desc, sql } from "drizzle-orm";
import { compProperties, compUnitTypes, unitTypeTrends, dealUnitPrograms } from "../db/schema/unitMix.schema";

const UNIT_TYPES = ["studio", "oneBR", "twoBR", "threeBR"] as const;
type UnitType = typeof UNIT_TYPES[number];

// ── 2A. GET COMP SET FOR A DEAL ─────────────────────────────────────────
// Returns all comps + their unit type data in the shape the frontend expects.

export async function getCompSet(dealId: string, tradeAreaId: string) {
  const props = await db
    .select()
    .from(compProperties)
    .where(and(
      eq(compProperties.dealId, dealId),
      eq(compProperties.isSubject, false),
    ))
    .orderBy(compProperties.builtYear);

  const compIds = props.map(p => p.id);

  const unitRows = await db
    .select()
    .from(compUnitTypes)
    .where(sql`${compUnitTypes.compId} = ANY(${compIds})`);

  // Shape into nested structure: comp → { units: { studio: {...}, ... } }
  return props.map(prop => {
    const units: Record<string, object> = {};
    for (const ut of UNIT_TYPES) {
      const row = unitRows.find(r => r.compId === prop.id && r.unitType === ut);
      units[ut] = row
        ? { mix: Number(row.mixPct), sf: row.avgSf, rent: Number(row.avgRent),
            vac: Number(row.vacancyPct), dom: Number(row.daysOnMarket), conc: Number(row.concessions) }
        : { mix: 0, sf: 0, rent: 0, vac: 0, dom: 0, conc: 0 };
    }
    return {
      id: prop.id, name: prop.name, cls: prop.class, built: prop.builtYear,
      total: prop.totalUnits, sourceUrl: prop.sourceUrl, units,
    };
  });
}

// ── 2B. GET 12-MONTH TRENDS FOR TRADE AREA ──────────────────────────────

export async function getTrends(tradeAreaId: string) {
  const rows = await db
    .select()
    .from(unitTypeTrends)
    .where(eq(unitTypeTrends.tradeAreaId, tradeAreaId))
    .orderBy(unitTypeTrends.periodDate);

  // Group by unit type → array of 12 monthly points
  const result: Record<string, object[]> = {};
  for (const ut of UNIT_TYPES) {
    result[ut] = rows
      .filter(r => r.unitType === ut)
      .slice(-12)
      .map(r => ({
        mo:   r.monthLabel,
        vac:  Number(r.avgVacancy),
        dom:  Number(r.avgDom),
        rent: Number(r.avgRent),
        conc: Number(r.avgConc),
      }));
  }
  return result;
}

// ── 2C. COMPUTE DEMAND SCORES (server-side, matches frontend formulas) ───
// Runs on the aggregated comp data. Returns per-unit-type demand metrics.

export function computeDemandScores(compSet: Awaited<ReturnType<typeof getCompSet>>) {
  return UNIT_TYPES.map(ut => {
    const active = compSet.filter(c => (c.units[ut] as any).mix > 0);
    if (!active.length) return { unitType: ut, demandScore: 0, avgVac: 0, avgDom: 0, avgRent: 0, avgConc: 0 };

    const avg = (fn: (c: typeof active[0]) => number) =>
      active.reduce((s, c) => s + fn(c), 0) / active.length;

    const avgVac  = avg(c => (c.units[ut] as any).vac);
    const avgDom  = avg(c => (c.units[ut] as any).dom);
    const avgRent = avg(c => (c.units[ut] as any).rent);
    const avgConc = avg(c => (c.units[ut] as any).conc);

    const vacScore  = Math.max(0, 100 - avgVac * 6);
    const domScore  = Math.max(0, 100 - avgDom * 2);
    const concScore = Math.max(0, 100 - avgConc * 10);
    const demandScore = Math.round(vacScore * 0.4 + domScore * 0.35 + concScore * 0.25);

    return { unitType: ut, demandScore, avgVac, avgDom, avgRent, avgConc };
  });
}

// ── 2D. SAVE / GET PROGRAM ───────────────────────────────────────────────

export async function saveProgram(dealId: string, userId: string, program: {
  totalUnits: number;
  units: Record<string, { mix: number; sf: number; rent: number }>;
}) {
  // Compute derived fields
  const totalNetSf = Object.entries(program.units).reduce((s, [, u]) => {
    return s + Math.round(program.totalUnits * u.mix / 100) * u.sf;
  }, 0);
  const grossRevPA = Object.entries(program.units).reduce((s, [, u]) => {
    return s + Math.round(program.totalUnits * u.mix / 100) * u.rent * 12 * 0.95;
  }, 0);
  const mixTotal = Object.values(program.units).reduce((s, u) => s + u.mix, 0);

  // Upsert — one program row per deal
  await db.insert(dealUnitPrograms)
    .values({ dealId, totalUnits: program.totalUnits, unitConfig: program.units,
      totalNetSf, grossRevPA, mixTotal, updatedBy: userId })
    .onConflictDoUpdate({
      target: dealUnitPrograms.dealId,
      set: { totalUnits: program.totalUnits, unitConfig: program.units,
        totalNetSf, grossRevPA, mixTotal, updatedBy: userId,
        updatedAt: sql`now()` },
    });

  // !! DOWNSTREAM WIRE — push to M09 ProForma !!
  // await proformaService.updateRentAssumptions(dealId, { totalNetSf, grossRevPA, unitConfig: program.units });
  // Uncomment when M09 ProForma is wired.

  return { dealId, totalNetSf, grossRevPA, mixTotal };
}

export async function getProgram(dealId: string) {
  const [row] = await db.select().from(dealUnitPrograms).where(eq(dealUnitPrograms.dealId, dealId));
  if (!row) return null;
  return { totalUnits: row.totalUnits, units: row.unitConfig as Record<string, any>, totalNetSf: row.totalNetSf, grossRevPA: Number(row.grossRevPA) };
}


// ═══════════════════════════════════════════════════════════════════════
//  SECTION 3: API ROUTES
//  File: backend/src/api/rest/unitMix.routes.ts
// ═══════════════════════════════════════════════════════════════════════

import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import * as svc from "../../services/unitMixIntelligence.service";

const router = Router();

// GET /api/v1/unit-mix/:dealId/comps
// Returns: comp set + unit type data
// Used by: all 5 tabs (COMPS array)
router.get("/:dealId/comps", authenticate, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const { tradeAreaId } = req.query as { tradeAreaId: string };
    const comps = await svc.getCompSet(dealId, tradeAreaId);
    const demandScores = svc.computeDemandScores(comps);
    res.json({ comps, demandScores });
  } catch (err) {
    res.status(500).json({ error: "Failed to load comp set" });
  }
});

// GET /api/v1/unit-mix/:dealId/trends
// Returns: 12-month trend series per unit type
// Used by: Trends tab
router.get("/:dealId/trends", authenticate, async (req: Request, res: Response) => {
  try {
    const { tradeAreaId } = req.query as { tradeAreaId: string };
    const trends = await svc.getTrends(tradeAreaId);
    res.json({ trends });
  } catch (err) {
    res.status(500).json({ error: "Failed to load trend data" });
  }
});

// GET /api/v1/unit-mix/:dealId/program
// Returns: saved user program (or null → frontend falls back to PROGRAM_SEED)
// Used by: Program tab on load
router.get("/:dealId/program", authenticate, async (req: Request, res: Response) => {
  try {
    const program = await svc.getProgram(req.params.dealId);
    res.json({ program });
  } catch (err) {
    res.status(500).json({ error: "Failed to load program" });
  }
});

// POST /api/v1/unit-mix/:dealId/program
// Body: { totalUnits, units: { studio: {mix,sf,rent}, ... } }
// Persists user edits + fires downstream M09 ProForma update
// Used by: Program Editor (debounced on input change, or explicit Save)
router.post("/:dealId/program", authenticate, async (req: Request, res: Response) => {
  try {
    const result = await svc.saveProgram(req.params.dealId, req.user!.id, req.body);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: "Failed to save program" });
  }
});

// GET /api/v1/unit-mix/:dealId/zoning
// Returns: M02 zoning constraints for the deal
// Used by: Zoning panel (Program tab)
// NOTE: Reads from existing deal_zoning table — no new table needed
router.get("/:dealId/zoning", authenticate, async (req: Request, res: Response) => {
  try {
    // Pull from existing M02 zoning table
    const [row] = await db
      .select()
      .from(dealZoning)  // import from M02 schema
      .where(and(eq(dealZoning.dealId, req.params.dealId), eq(dealZoning.dataType, "entitlement")));
    if (!row) return res.json({ zoning: null });
    res.json({
      zoning: {
        zoningCode:      row.zoningCode,
        maxUnits:        row.maxUnits,
        maxNetSF:        row.maxNetSf,
        excludesParking: row.excludesParking,
        maxHeight:       row.maxHeightStories,
        maxLotCoverage:  row.maxLotCoveragePct,
        source:          row.sourceCitation,
        sourceUrl:       row.sourceUrl,
        confidence:      row.confidenceScore,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load zoning" });
  }
});

export default router;

// Mount in index.ts:
// app.use("/api/v1/unit-mix", unitMixRouter);


// ═══════════════════════════════════════════════════════════════════════
//  SECTION 4: SCRAPER INTEGRATION
//  File: backend/src/services/apartmentsScraper.service.ts  (existing)
//  ADD: scrapeAndStoreCompUnitTypes()
// ═══════════════════════════════════════════════════════════════════════

// This function should be called:
//   - When a comp is first added to a deal's comp set
//   - Weekly via cron for all active comp sets
//   - On-demand via POST /api/v1/unit-mix/:dealId/comps/refresh

export async function scrapeAndStoreCompUnitTypes(compId: string, listingUrl: string) {
  // 1. Fetch listing page (Apartments.com property page)
  const html = await fetchWithProxy(listingUrl);

  // 2. Parse floor plan sections — each floor plan = one unit type
  //    Apartments.com groups listings as: Studio, 1 Bed, 2 Bed, 3+ Bed
  //    Each section shows: SF range, price range, available units, total units

  const parsed = parseApartmentsListing(html);
  // Returns: [{ type: "oneBR", sfMin, sfMax, rentMin, rentMax, available, total }]

  // 3. Calculate vacancy from available/total
  //    vac% = (available / total) * 100
  //    DOM: scrape from "Listed X days ago" badges if present
  //    Concessions: look for "X weeks free" or "X month free" text

  for (const fp of parsed) {
    const mixPct  = (fp.total / totalPropertyUnits) * 100;
    const avgSf   = Math.round((fp.sfMin + fp.sfMax) / 2);
    const avgRent = Math.round((fp.rentMin + fp.rentMax) / 2);
    const vac     = fp.total > 0 ? (fp.available / fp.total) * 100 : 0;

    await db.insert(compUnitTypes)
      .values({ compId, unitType: fp.type, mixPct, avgSf, avgRent,
        vacancyPct: vac, daysOnMarket: fp.dom, concessions: fp.concessions,
        scrapedAt: new Date() })
      .onConflictDoUpdate({
        target: [compUnitTypes.compId, compUnitTypes.unitType],
        set: { mixPct, avgSf, avgRent, vacancyPct: vac,
          daysOnMarket: fp.dom, concessions: fp.concessions, scrapedAt: new Date() },
      });
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 5: TREND AGGREGATION JOB
//  File: backend/src/jobs/unitTrendAggregation.job.ts
//  Schedule: Weekly (e.g., Sunday 2am via pg_cron or node-cron)
// ═══════════════════════════════════════════════════════════════════════

// After each weekly scrape cycle, aggregate across all comps in each
// trade area and append one row per (tradeArea × unitType) to unit_type_trends.

export async function aggregateWeeklyTrends() {
  const tradeAreas = await getActiveTradeAreas();

  for (const ta of tradeAreas) {
    const comps = await getCompSet("", ta.id); // pass tradeAreaId
    const scores = computeDemandScores(comps);

    for (const score of scores) {
      const mo = new Date().toLocaleString("en-US", { month: "short" });
      await db.insert(unitTypeTrends).values({
        tradeAreaId: ta.id,
        unitType:    score.unitType,
        monthLabel:  mo,
        periodDate:  new Date(),
        avgVacancy:  score.avgVac,
        avgDom:      score.avgDom,
        avgRent:     score.avgRent,
        avgConc:     score.avgConc,
        compCount:   comps.length,
      });
    }
  }
}


// ═══════════════════════════════════════════════════════════════════════
//  SECTION 6: FRONTEND INTEGRATION
//  File: frontend/src/hooks/useUnitMix.ts
// ═══════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback, useRef } from "react";

export function useUnitMixIntelligence(dealId: string, tradeAreaId: string) {
  const [comps,        setComps]        = useState(null);
  const [demandScores, setDemandScores] = useState(null);
  const [trends,       setTrends]       = useState(null);
  const [zoning,       setZoning]       = useState(null);
  const [program,      setProgram]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [compsRes, trendsRes, zoningRes, programRes] = await Promise.all([
          fetch(`/api/v1/unit-mix/${dealId}/comps?tradeAreaId=${tradeAreaId}`).then(r => r.json()),
          fetch(`/api/v1/unit-mix/${dealId}/trends?tradeAreaId=${tradeAreaId}`).then(r => r.json()),
          fetch(`/api/v1/unit-mix/${dealId}/zoning`).then(r => r.json()),
          fetch(`/api/v1/unit-mix/${dealId}/program`).then(r => r.json()),
        ]);
        setComps(compsRes.comps);
        setDemandScores(compsRes.demandScores);
        setTrends(trendsRes.trends);
        setZoning(zoningRes.zoning);
        setProgram(programRes.program ?? PROGRAM_SEED); // fallback to seed
      } catch (e) {
        setError(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dealId, tradeAreaId]);

  // Debounced auto-save: fires 1.5s after user stops editing
  const handleProgramChange = useCallback((newProgram) => {
    setProgram(newProgram);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`/api/v1/unit-mix/${dealId}/program`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProgram),
      });
    }, 1500);
  }, [dealId]);

  return { comps, demandScores, trends, zoning, program, loading, error, handleProgramChange };
}


// ═══════════════════════════════════════════════════════════════════════
//  SECTION 7: MIGRATION FILE
//  File: backend/src/db/migrations/0XXX_unit_mix_intelligence.sql
// ═══════════════════════════════════════════════════════════════════════

/*
CREATE TABLE IF NOT EXISTS comp_properties (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id       UUID NOT NULL,
  trade_area_id UUID NOT NULL,
  name          TEXT NOT NULL,
  address       TEXT,
  class         TEXT,
  built_year    INT,
  total_units   INT,
  is_subject    BOOLEAN DEFAULT false,
  source_url    TEXT,
  scraped_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX comp_deal_idx ON comp_properties(deal_id);
CREATE INDEX comp_area_idx ON comp_properties(trade_area_id);

CREATE TABLE IF NOT EXISTS comp_unit_types (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id        UUID NOT NULL REFERENCES comp_properties(id) ON DELETE CASCADE,
  unit_type      TEXT NOT NULL,                 -- studio | oneBR | twoBR | threeBR
  mix_pct        NUMERIC(5,2),
  avg_sf         INT,
  avg_rent       NUMERIC(10,2),
  vacancy_pct    NUMERIC(5,2),
  days_on_market NUMERIC(5,1),
  concessions    NUMERIC(4,1),
  scraped_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comp_id, unit_type)
);

CREATE INDEX cut_comp_idx  ON comp_unit_types(comp_id);
CREATE INDEX cut_type_idx  ON comp_unit_types(unit_type);

CREATE TABLE IF NOT EXISTS unit_type_trends (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL,
  unit_type     TEXT NOT NULL,
  month_label   TEXT NOT NULL,
  period_date   TIMESTAMPTZ NOT NULL,
  avg_vacancy   NUMERIC(5,2),
  avg_dom       NUMERIC(5,1),
  avg_rent      NUMERIC(10,2),
  avg_conc      NUMERIC(4,1),
  comp_count    INT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX utt_area_type_idx ON unit_type_trends(trade_area_id, unit_type);
CREATE INDEX utt_date_idx      ON unit_type_trends(period_date);

CREATE TABLE IF NOT EXISTS deal_unit_programs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id      UUID NOT NULL UNIQUE,
  total_units  INT NOT NULL,
  unit_config  JSONB NOT NULL,
  total_net_sf INT,
  gross_rev_pa NUMERIC(14,2),
  mix_total    NUMERIC(5,2),
  updated_by   UUID,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
*/


// ═══════════════════════════════════════════════════════════════════════
//  SUMMARY: WHAT POWERS EACH TAB
// ═══════════════════════════════════════════════════════════════════════

/*
  TAB           ENDPOINT(S)                        DATA SOURCE
  ─────────────────────────────────────────────────────────────────────
  Demand        GET /comps → computeDemandScores() comp_unit_types (weekly scrape)
  Program       GET /program, GET /zoning           deal_unit_programs + deal_zoning (M02)
                POST /program (auto-save)
  Inventory     GET /comps                          comp_properties + comp_unit_types
  Trends        GET /trends                         unit_type_trends (aggregation job)
  Comps         GET /comps                          comp_unit_types (same as Demand)

  DOWNSTREAM WIRES (when ready):
  ─────────────────────────────────────────────────────────────────────
  POST /program → M09 ProForma.updateRentAssumptions()
  GET  /zoning  → reads M02 deal_zoning (already exists in your schema)
  comp scraper  → extends existing M05 apartments.com scraper service
*/
