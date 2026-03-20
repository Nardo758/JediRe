import { Pool } from "pg";

const UNIT_TYPES = ["studio", "oneBR", "twoBR", "threeBR"] as const;
type UnitType = typeof UNIT_TYPES[number];

interface CompUnit {
  mix: number;
  sf: number;
  rent: number;
  vac: number;
  dom: number;
  conc: number;
}

interface CompResult {
  id: string;
  name: string;
  cls: string | null;
  built: number | null;
  total: number | null;
  sourceUrl: string | null;
  units: Record<string, CompUnit>;
}

export async function getCompSet(pool: Pool, dealId: string, tradeAreaId?: string): Promise<CompResult[]> {
  let propsQuery: string;
  let params: string[];

  if (tradeAreaId) {
    propsQuery = `
      SELECT id, name, address, class, built_year, total_units, source_url
      FROM comp_properties
      WHERE deal_id = $1 AND trade_area_id = $2 AND is_subject = false
      ORDER BY built_year
    `;
    params = [dealId, tradeAreaId];
  } else {
    propsQuery = `
      SELECT id, name, address, class, built_year, total_units, source_url
      FROM comp_properties
      WHERE deal_id = $1 AND is_subject = false
      ORDER BY built_year
    `;
    params = [dealId];
  }

  const { rows: props } = await pool.query(propsQuery, params);

  if (props.length === 0) return [];

  const compIds = props.map((p: any) => p.id);
  const unitsQuery = `
    SELECT comp_id, unit_type, mix_pct, avg_sf, avg_rent, vacancy_pct, days_on_market, concessions
    FROM comp_unit_types
    WHERE comp_id = ANY($1)
  `;
  const { rows: unitRows } = await pool.query(unitsQuery, [compIds]);

  return props.map((prop: any) => {
    const units: Record<string, CompUnit> = {};
    for (const ut of UNIT_TYPES) {
      const row = unitRows.find((r: any) => r.comp_id === prop.id && r.unit_type === ut);
      units[ut] = row
        ? {
            mix: Number(row.mix_pct) || 0,
            sf: Number(row.avg_sf) || 0,
            rent: Number(row.avg_rent) || 0,
            vac: Number(row.vacancy_pct) || 0,
            dom: Number(row.days_on_market) || 0,
            conc: Number(row.concessions) || 0,
          }
        : { mix: 0, sf: 0, rent: 0, vac: 0, dom: 0, conc: 0 };
    }
    return {
      id: prop.id,
      name: prop.name,
      cls: prop.class,
      built: prop.built_year,
      total: prop.total_units,
      sourceUrl: prop.source_url,
      units,
    };
  });
}

export async function getTrends(pool: Pool, tradeAreaId: string): Promise<Record<string, any[]>> {
  const query = `
    SELECT unit_type, month_label, avg_vacancy, avg_dom, avg_rent, avg_conc
    FROM unit_type_trends
    WHERE trade_area_id = $1
    ORDER BY period_date
  `;
  const { rows } = await pool.query(query, [tradeAreaId]);

  const result: Record<string, any[]> = {};
  for (const ut of UNIT_TYPES) {
    result[ut] = rows
      .filter((r: any) => r.unit_type === ut)
      .slice(-12)
      .map((r: any) => ({
        mo: r.month_label,
        vac: Number(r.avg_vacancy) || 0,
        dom: Number(r.avg_dom) || 0,
        rent: Number(r.avg_rent) || 0,
        conc: Number(r.avg_conc) || 0,
      }));
  }
  return result;
}

export function computeDemandScores(compSet: CompResult[]) {
  return UNIT_TYPES.map(ut => {
    const active = compSet.filter(c => c.units[ut].mix > 0);
    if (!active.length) {
      return { unitType: ut, demandScore: 0, avgVac: 0, avgDom: 0, avgRent: 0, avgConc: 0 };
    }

    const avg = (fn: (c: CompResult) => number) =>
      active.reduce((s, c) => s + fn(c), 0) / active.length;

    const avgVac = avg(c => c.units[ut].vac);
    const avgDom = avg(c => c.units[ut].dom);
    const avgRent = avg(c => c.units[ut].rent);
    const avgConc = avg(c => c.units[ut].conc);

    const vacScore = Math.max(0, 100 - avgVac * 6);
    const domScore = Math.max(0, 100 - avgDom * 2);
    const concScore = Math.max(0, 100 - avgConc * 10);
    const demandScore = Math.round(vacScore * 0.4 + domScore * 0.35 + concScore * 0.25);

    return { unitType: ut, demandScore, avgVac, avgDom, avgRent, avgConc };
  });
}

export async function saveProgram(
  pool: Pool,
  dealId: string,
  userId: string,
  program: { totalUnits: number; units: Record<string, { mix: number; sf: number; rent: number }> }
) {
  const totalNetSf = Object.entries(program.units).reduce((s, [, u]) => {
    return s + Math.round(program.totalUnits * u.mix / 100) * u.sf;
  }, 0);

  const grossRevPA = Object.entries(program.units).reduce((s, [, u]) => {
    return s + Math.round(program.totalUnits * u.mix / 100) * u.rent * 12 * 0.95;
  }, 0);

  const mixTotal = Object.values(program.units).reduce((s, u) => s + u.mix, 0);

  const query = `
    INSERT INTO deal_unit_programs (deal_id, total_units, unit_config, total_net_sf, gross_rev_pa, mix_total, updated_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (deal_id)
    DO UPDATE SET
      total_units = EXCLUDED.total_units,
      unit_config = EXCLUDED.unit_config,
      total_net_sf = EXCLUDED.total_net_sf,
      gross_rev_pa = EXCLUDED.gross_rev_pa,
      mix_total = EXCLUDED.mix_total,
      updated_by = EXCLUDED.updated_by,
      updated_at = now()
  `;

  await pool.query(query, [
    dealId,
    program.totalUnits,
    JSON.stringify(program.units),
    totalNetSf,
    grossRevPA,
    mixTotal,
    userId,
  ]);

  return { dealId, totalNetSf, grossRevPA, mixTotal };
}

export async function getProgram(pool: Pool, dealId: string) {
  const query = `
    SELECT total_units, unit_config, total_net_sf, gross_rev_pa
    FROM deal_unit_programs
    WHERE deal_id = $1
  `;
  const { rows } = await pool.query(query, [dealId]);
  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    totalUnits: row.total_units,
    units: row.unit_config,
    totalNetSf: row.total_net_sf,
    grossRevPA: Number(row.gross_rev_pa),
  };
}

export async function getZoningForUnitMix(pool: Pool, dealId: string) {
  const query = `
    SELECT base_district_code, max_stories, max_lot_coverage_pct,
           residential_far, applied_far, max_density_per_acre,
           lot_area_sf, buildable_area_sf
    FROM deal_zoning_profiles
    WHERE deal_id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(query, [dealId]);
  if (rows.length === 0) return null;

  const row = rows[0];
  const maxUnits = row.max_density_per_acre && row.lot_area_sf
    ? Math.floor(row.max_density_per_acre * row.lot_area_sf / 43560)
    : null;
  const maxNetSf = row.applied_far && row.lot_area_sf
    ? Math.floor(row.applied_far * row.lot_area_sf)
    : null;

  return {
    zoningCode: row.base_district_code,
    maxUnits,
    maxNetSF: maxNetSf,
    excludesParking: null,
    maxHeight: row.max_stories,
    maxLotCoverage: row.max_lot_coverage_pct ? Number(row.max_lot_coverage_pct) : null,
    source: null,
    sourceUrl: null,
    confidence: null,
  };
}
