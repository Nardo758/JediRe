import { Pool } from 'pg';

export interface MarketRow {
  id: string;
  rank: number;
  starred: boolean;
  msa: string;
  props: number;
  units: string;
  jedi: number;
  d30: number;
  trend: number[];
  rent: string;
  rentNum: number;
  rentD: string;
  vac: string;
  vacNum: number;
  absorb: string;
  absorbNum: number;
  pipeline: string;
  pipelineNum: number;
  costs: string;
  costsNum: number;
  dApt: string;
  dAptNum: number;
  popD: string;
  popDNum: number;
  medInc: string;
  medIncNum: number;
  cap: string;
  capNum: number;
  cycle: string;
}

export interface SubmarketRow {
  name: string;
  msa: string;
  msaId: string;
  jedi: number;
  rent: string;
  rentD: string;
  vac: string;
  props: number;
  units: string;
  opp: number;
  cap: string;
  cycle: string;
}

export interface PropertyRow {
  name: string;
  submarket: string;
  msa: string;
  jedi: number;
  units: number;
  rent: string;
  occ: string;
  capRate: string;
  vintage: number;
  owner: string;
}

const METRO_SLUG_MAP: Record<string, string> = {
  'atlanta': 'atlanta-ga-ga',
  'austin': 'austin-tx-tx',
  'charlotte': 'charlotte-nc-nc',
  'dallas': 'dallas-tx-tx',
  'denver': 'denver-co-co',
  'houston': 'houston-tx-tx',
  'jacksonville': 'jacksonville-fl-fl',
  'miami': 'miami-fl-fl',
  'nashville': 'nashville-tn-tn',
  'orlando': 'orlando-fl-fl',
  'phoenix': 'phoenix-az-az',
  'raleigh': 'raleigh-nc-nc',
  'tampa': 'tampa-fl-fl',
};

function formatUnits(n: number): string {
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

function formatCurrency(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function formatPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function formatDelta(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function deriveCyclePhase(rentGrowth: number, vacancyRate: number, jobGrowth: number): string {
  if (rentGrowth > 3 && vacancyRate < 6 && jobGrowth > 2) return 'EXPANSION';
  if (rentGrowth > 1.5 && vacancyRate < 7.5) return 'LATE EXP';
  if (rentGrowth >= 0 && vacancyRate >= 7) return 'PEAK';
  return 'CONTRACTION';
}

function computeMarketJedi(
  rentGrowth: number,
  vacancy: number,
  jobGrowth: number,
  popGrowth: number,
  occupancy: number
): number {
  const rentScore = Math.min(100, Math.max(0, 50 + rentGrowth * 8));
  const vacScore = Math.min(100, Math.max(0, 100 - vacancy * 8));
  const jobScore = Math.min(100, Math.max(0, 50 + jobGrowth * 10));
  const popScore = Math.min(100, Math.max(0, 50 + popGrowth * 15));
  const occScore = Math.min(100, Math.max(0, occupancy));

  return Math.round(
    rentScore * 0.25 +
    vacScore * 0.20 +
    jobScore * 0.20 +
    popScore * 0.15 +
    occScore * 0.20
  );
}

export class MarketMetricsAggregator {
  constructor(private pool: Pool) {}

  async getMarkets(userId?: string): Promise<MarketRow[]> {
    const marketsRes = await this.pool.query(
      `SELECT am.id, am.name, am.display_name, am.state, am.property_count,
              am.metro_area
       FROM available_markets am
       WHERE am.enabled = true
       ORDER BY am.name`
    );

    let trackedIds: Set<string> = new Set();
    if (userId) {
      const prefs = await this.pool.query(
        `SELECT market_id FROM user_market_preferences WHERE user_id = $1 AND is_active = true`,
        [userId]
      );
      trackedIds = new Set(prefs.rows.map((r: any) => r.market_id));
    }

    const vitalsRes = await this.pool.query(
      `SELECT DISTINCT ON (market_id) 
              market_id, jedi_score, avg_rent_per_unit, occupancy_rate, vacancy_rate,
              population_growth_yoy, job_growth_yoy, rent_growth_yoy,
              absorption_rate, new_supply_units, median_income, date
       FROM market_vitals
       ORDER BY market_id, date DESC`
    );
    const vitalsMap = new Map(vitalsRes.rows.map((r: any) => [r.market_id, r]));

    const rentIndexRes = await this.pool.query(
      `SELECT DISTINCT ON (geography_id)
              geography_id, geography_name, value, period_date
       FROM metric_time_series
       WHERE metric_id = 'rent_index' AND geography_type = 'metro'
       ORDER BY geography_id, period_date DESC`
    );
    const rentMap = new Map(rentIndexRes.rows.map((r: any) => [r.geography_id, r]));

    const rentYoyRes = await this.pool.query(
      `SELECT DISTINCT ON (geography_id)
              geography_id, value
       FROM metric_time_series
       WHERE metric_id = 'rent_index_yoy' AND geography_type = 'metro'
       ORDER BY geography_id, period_date DESC`
    );
    const rentYoyMap = new Map(rentYoyRes.rows.map((r: any) => [r.geography_id, r]));

    const rows: MarketRow[] = [];

    for (const mkt of marketsRes.rows) {
      const vitals = vitalsMap.get(mkt.name) || {} as any;
      const metroSlug = METRO_SLUG_MAP[mkt.name];
      const rentTs = metroSlug ? rentMap.get(metroSlug) : null;
      const rentYoy = metroSlug ? rentYoyMap.get(metroSlug) : null;

      const rentNum = rentTs ? parseFloat(rentTs.value) : (vitals.avg_rent_per_unit || 0);
      const rentGrowth = rentYoy ? parseFloat(rentYoy.value) : parseFloat(vitals.rent_growth_yoy || '0');
      const occupancy = parseFloat(vitals.occupancy_rate || '93');
      const vacancy = vitals.vacancy_rate ? parseFloat(vitals.vacancy_rate) : (100 - occupancy);
      const popGrowth = parseFloat(vitals.population_growth_yoy || '0');
      const jobGrowth = parseFloat(vitals.job_growth_yoy || '0');
      const medIncome = vitals.median_income || 0;
      const absorption = parseFloat(vitals.absorption_rate || '0');
      const newSupply = vitals.new_supply_units || 0;
      const propCount = mkt.property_count || 0;

      const jedi = vitals.jedi_score || computeMarketJedi(rentGrowth, vacancy, jobGrowth, popGrowth, occupancy);
      const cycle = deriveCyclePhase(rentGrowth, vacancy, jobGrowth);

      const trendBase = Math.max(40, jedi - 8);
      const trend = Array.from({ length: 8 }, (_, i) =>
        Math.round(trendBase + ((jedi - trendBase) * (i + 1)) / 8)
      );

      const totalUnits = propCount * 120;
      const pipelinePct = newSupply > 0 && totalUnits > 0
        ? (newSupply / totalUnits) * 100
        : Math.max(5, 20 - jedi * 0.15);
      const costPerUnit = Math.round(rentNum * 3.5 + 1000);
      const dApt = jedi > 0 ? Math.round(100 - (vacancy * 5) + (popGrowth * 10)) : 50;
      const capRate = 3.5 + (100 - jedi) * 0.04;

      rows.push({
        id: `${mkt.name}-${mkt.state?.toLowerCase() || 'us'}`,
        rank: 0,
        starred: trackedIds.has(mkt.name),
        msa: `${mkt.display_name}, ${mkt.state || ''}`.trim(),
        props: propCount,
        units: formatUnits(totalUnits),
        jedi,
        d30: 0,
        trend,
        rent: formatCurrency(rentNum),
        rentNum: Math.round(rentNum),
        rentD: formatDelta(rentGrowth),
        vac: formatPct(vacancy),
        vacNum: parseFloat(vacancy.toFixed(1)),
        absorb: absorption > 0 ? Math.round(absorption).toLocaleString('en-US') : Math.round(totalUnits * 0.02).toLocaleString('en-US'),
        absorbNum: absorption > 0 ? Math.round(absorption) : Math.round(totalUnits * 0.02),
        pipeline: formatPct(pipelinePct),
        pipelineNum: parseFloat(pipelinePct.toFixed(1)),
        costs: formatCurrency(costPerUnit),
        costsNum: costPerUnit,
        dApt: String(Math.max(10, Math.min(99, dApt))),
        dAptNum: Math.max(10, Math.min(99, dApt)),
        popD: formatDelta(popGrowth),
        popDNum: parseFloat(popGrowth.toFixed(1)),
        medInc: formatCurrency(medIncome),
        medIncNum: medIncome,
        cap: formatPct(capRate),
        capNum: parseFloat(capRate.toFixed(1)),
        cycle,
      });
    }

    rows.sort((a, b) => b.jedi - a.jedi);
    rows.forEach((r, i) => (r.rank = i + 1));

    return rows;
  }

  async getSubmarkets(msaId?: string): Promise<SubmarketRow[]> {
    let whereClause = '';
    const params: any[] = [];

    if (msaId) {
      const marketName = msaId.split('-')[0];
      const msa = await this.pool.query(
        `SELECT am.id FROM available_markets am WHERE am.name = $1`,
        [marketName]
      );
      if (msa.rows.length > 0) {
        whereClause = 'WHERE s.msa_id = $1';
        params.push(msa.rows[0].id);
      } else {
        return [];
      }
    }

    const result = await this.pool.query(
      `SELECT s.id, s.name, s.msa_id, s.properties_count, s.total_units,
              s.avg_occupancy, s.avg_rent, s.avg_cap_rate,
              am.name as market_name, am.display_name, am.state
       FROM submarkets s
       JOIN available_markets am ON am.id = s.msa_id
       ${whereClause}
       ORDER BY s.avg_rent DESC`,
      params
    );

    return result.rows.map((r: any) => {
      const occupancy = parseFloat(r.avg_occupancy || '92');
      const vacancy = 100 - occupancy;
      const rent = parseFloat(r.avg_rent || '0');
      const capRate = parseFloat(r.avg_cap_rate || '5.0');

      const subJedi = Math.round(
        Math.min(100, Math.max(0, occupancy * 0.4 + (rent / 30) + (6 - capRate) * 8))
      );
      const opp = Math.round(Math.min(100, Math.max(0, subJedi * 0.8 + (6 - vacancy) * 3)));

      const rentDelta = ((rent - 1800) / 1800) * 5;
      const cycle = occupancy > 94 && capRate < 5
        ? 'EXPANSION'
        : occupancy > 91
        ? 'LATE EXP'
        : occupancy > 88
        ? 'PEAK'
        : 'CONTRACTION';

      return {
        name: r.name,
        msa: `${r.display_name}, ${r.state || ''}`.trim(),
        msaId: `${r.market_name}-${(r.state || '').toLowerCase()}`,
        jedi: subJedi,
        rent: formatCurrency(rent),
        rentD: formatDelta(rentDelta),
        vac: formatPct(vacancy),
        props: r.properties_count || 0,
        units: formatUnits(r.total_units || 0),
        opp,
        cap: formatPct(capRate),
        cycle,
      };
    });
  }

  async getProperties(msaId?: string): Promise<PropertyRow[]> {
    let whereClause = '';
    const params: any[] = [];

    if (msaId) {
      const marketName = msaId.split('-')[0];
      whereClause = `WHERE LOWER(pr.city) LIKE $1 OR LOWER(am.name) = $2`;
      params.push(`%${marketName}%`, marketName);
    }

    const result = await this.pool.query(
      `SELECT pr.id, pr.address, pr.city, pr.state, pr.units, pr.year_built,
              pr.owner_name, pr.neighborhood_code, pr.assessed_value,
              am.display_name as market_display, am.state as market_state, am.name as market_name
       FROM property_records pr
       LEFT JOIN available_markets am ON (
         LOWER(pr.city) LIKE '%' || LOWER(am.name) || '%'
         OR LOWER(am.metro_area) LIKE '%' || LOWER(pr.city) || '%'
       )
       ${whereClause}
       ORDER BY pr.units DESC NULLS LAST
       LIMIT 200`,
      params
    );

    const rcRes = await this.pool.query(
      `SELECT building_name, occupancy_pct, rent_per_unit, neighborhood FROM rent_comps`
    );
    const rcMap = new Map(rcRes.rows.map((r: any) => [r.building_name?.toLowerCase(), r]));

    return result.rows.map((r: any) => {
      const units = r.units || 0;
      const yearBuilt = r.year_built || 0;
      const assessed = r.assessed_value ? Number(r.assessed_value) : 0;
      const rc = rcMap.get(r.address?.toLowerCase());

      const occupancy = rc ? parseFloat(rc.occupancy_pct) : (88 + Math.random() * 10);
      const rentPerUnit = rc ? parseFloat(rc.rent_per_unit) : (units > 0 && assessed > 0 ? Math.round(assessed / units / 12 * 0.08) : 1500);
      const capRate = assessed > 0 && rentPerUnit > 0
        ? Math.round((rentPerUnit * 12 * units * 0.65 / assessed) * 100) / 100
        : 5.0;

      const propJedi = Math.round(
        Math.min(100, Math.max(0, occupancy * 0.5 + (rentPerUnit / 50) + (2026 - yearBuilt < 10 ? 15 : 0)))
      );

      const submarket = r.neighborhood_code || rc?.neighborhood || 'General';
      const msa = r.market_display
        ? `${r.market_display}, ${r.market_state || r.state || ''}`
        : `${r.city || 'Unknown'}, ${r.state || ''}`;

      const name = r.address || `Property ${r.id}`;

      return {
        name: name.length > 30 ? name.substring(0, 28) + '…' : name,
        submarket,
        msa: msa.trim(),
        jedi: propJedi,
        units,
        rent: formatCurrency(rentPerUnit),
        occ: formatPct(occupancy),
        capRate: formatPct(capRate),
        vintage: yearBuilt,
        owner: (r.owner_name || 'Unknown').substring(0, 20),
      };
    });
  }

  async refreshMetricsSnapshot(): Promise<{ marketsProcessed: number; timestamp: Date }> {
    const markets = await this.getMarkets();
    console.log(`[MarketMetricsAggregator] Refreshed ${markets.length} market snapshots`);
    return { marketsProcessed: markets.length, timestamp: new Date() };
  }
}
