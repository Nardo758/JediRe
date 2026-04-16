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
  // ── Prefer active deal_comp_sets if they exist (user-curated selections) ──
  const activeComps = await pool.query(`
    SELECT id, comp_name AS name, comp_property_address AS address,
           class_code AS class, year_built AS built_year, units AS total_units, NULL AS source_url
    FROM deal_comp_sets
    WHERE deal_id = $1 AND status = 'active'
    ORDER BY match_score DESC NULLS LAST
  `, [dealId]);

  let propsQuery: string;
  let params: string[];

  if (activeComps.rows.length > 0) {
    // Use active comp_set addresses to look up unit type data from comp_properties
    const addresses = activeComps.rows.map((r: any) => r.address.toLowerCase());
    const cpResult = await pool.query(`
      SELECT cp.id, cp.name, cp.address, cp.class, cp.built_year, cp.total_units, cp.source_url
      FROM comp_properties cp
      WHERE LOWER(cp.address) = ANY($1) AND cp.is_subject = false
    `, [addresses]);

    // Merge: for addresses found in comp_properties, use those; for others, use deal_comp_sets row
    const cpByAddr = new Map<string, any>();
    for (const r of cpResult.rows) cpByAddr.set(r.address.toLowerCase(), r);

    const mergedProps = activeComps.rows.map((cs: any) => {
      const cp = cpByAddr.get(cs.address.toLowerCase());
      return cp || { id: cs.id, name: cs.name, address: cs.address, class: cs.class, built_year: cs.built_year, total_units: cs.total_units, source_url: null };
    });

    if (mergedProps.length === 0) return [];

    const compIds = mergedProps.filter((p: any) => p.id && !p.id.startsWith('00000000')).map((p: any) => p.id);
    const { rows: unitRows } = compIds.length > 0
      ? await pool.query(`
          SELECT comp_id, unit_type, mix_pct, avg_sf, avg_rent, vacancy_pct, days_on_market, concessions
          FROM comp_unit_types WHERE comp_id = ANY($1)
        `, [compIds])
      : { rows: [] };

    return mergedProps.map((prop: any) => {
      const units: Record<string, CompUnit> = {};
      for (const ut of UNIT_TYPES) {
        const row = unitRows.find((r: any) => r.comp_id === prop.id && r.unit_type === ut);
        units[ut] = row
          ? { mix: Number(row.mix_pct) || 0, sf: Number(row.avg_sf) || 0, rent: Number(row.avg_rent) || 0, vac: Number(row.vacancy_pct) || 0, dom: Number(row.days_on_market) || 0, conc: Number(row.concessions) || 0 }
          : { mix: 0, sf: 0, rent: 0, vac: 0, dom: 0, conc: 0 };
      }
      return { id: prop.id, name: prop.name, cls: prop.class as string | null, built: prop.built_year as number | null, total: prop.total_units as number | null, sourceUrl: prop.source_url as string | null, units };
    });
  }

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

export async function pushProgramToProforma(
  pool: Pool,
  dealId: string,
  userId: string,
  program: { totalUnits: number; units: Record<string, { mix: number; sf: number; rent: number }> },
  amenityBudget?: { totalCost: number; estLiftPerUnit: number; items: { name: string; cost: number; lift: number; tier: string }[] },
) {
  const modulesUpdated: string[] = [];
  const errors: string[] = [];

  const savedProgram = await saveProgram(pool, dealId, userId, program);
  modulesUpdated.push('deal_unit_programs');

  const unitMixBreakdown = Object.entries(program.units).map(([unitType, u]) => ({
    unitType,
    count: Math.round(program.totalUnits * u.mix / 100),
    avgSF: u.sf,
    avgRent: u.rent,
    percent: u.mix,
  }));

  try {
    const modelResult = await pool.query(
      'SELECT id, assumptions FROM financial_models WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1',
      [dealId]
    );

    if (modelResult.rows.length > 0) {
      const model = modelResult.rows[0];
      const assumptions = model.assumptions || {};

      assumptions.unitMix = unitMixBreakdown.filter(item => item.count > 0);
      assumptions.totalUnits = program.totalUnits;
      assumptions.totalSF = savedProgram.totalNetSf;
      assumptions.avgSF = program.totalUnits > 0 ? Math.round(savedProgram.totalNetSf / program.totalUnits) : 0;
      assumptions.grossRevPA = savedProgram.grossRevPA;

      assumptions.rentRoll = unitMixBreakdown
        .filter(item => item.count > 0)
        .map(item => ({
          unitType: item.unitType,
          count: item.count,
          avgSF: item.avgSF,
          monthlyRent: item.avgRent,
          annualRev: item.count * item.avgRent * 12,
          psfRent: item.avgSF > 0 ? +(item.avgRent / item.avgSF).toFixed(2) : 0,
        }));

      if (amenityBudget) {
        assumptions.amenityPackage = {
          totalCost: amenityBudget.totalCost,
          estLiftPerUnit: amenityBudget.estLiftPerUnit,
          items: amenityBudget.items,
          appliedAt: new Date().toISOString(),
        };
      }

      assumptions._programPushedAt = new Date().toISOString();
      assumptions._programPushedBy = userId;

      await pool.query(
        `UPDATE financial_models
         SET assumptions = $1, status = 'draft', updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(assumptions), model.id]
      );
      modulesUpdated.push('financial_model');
    }
  } catch (err: any) {
    errors.push(`Financial model: ${err.message}`);
  }

  try {
    await pool.query(
      `UPDATE deals
       SET module_outputs = jsonb_set(
         jsonb_set(
           COALESCE(module_outputs, '{}'::jsonb),
           '{unitMix}',
           $1::jsonb
         ),
         '{unitMixStatus}',
         $2::jsonb
       ),
       target_units = $3,
       updated_at = NOW()
       WHERE id = $4`,
      [
        JSON.stringify({
          program: unitMixBreakdown,
          totalUnits: program.totalUnits,
          totalSF: savedProgram.totalNetSf,
          grossRevPA: savedProgram.grossRevPA,
        }),
        JSON.stringify({
          applied: true,
          source: 'program_push',
          appliedAt: new Date().toISOString(),
          pushedBy: userId,
        }),
        program.totalUnits,
        dealId,
      ]
    );
    modulesUpdated.push('deal_metadata');
  } catch (err: any) {
    errors.push(`Deal metadata: ${err.message}`);
  }

  try {
    const designResult = await pool.query(
      'SELECT id FROM building_designs_3d WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1',
      [dealId]
    );
    if (designResult.rows.length > 0) {
      await pool.query(
        `UPDATE building_designs_3d
         SET metadata = jsonb_set(
           COALESCE(metadata, '{}'::jsonb),
           '{unitMix}',
           $1::jsonb
         ),
         updated_at = NOW()
         WHERE id = $2`,
        [
          JSON.stringify({
            breakdown: unitMixBreakdown,
            total: program.totalUnits,
            totalSF: savedProgram.totalNetSf,
            updatedAt: new Date().toISOString(),
          }),
          designResult.rows[0].id,
        ]
      );
      modulesUpdated.push('3d_design');
    }
  } catch (err: any) {
    errors.push(`3D design: ${err.message}`);
  }

  return {
    success: errors.length === 0,
    modulesUpdated,
    errors,
    program: savedProgram,
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
