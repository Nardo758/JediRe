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

interface AvailableMarketDbRow {
  id: number;
  name: string;
  display_name: string;
  state: string | null;
  property_count: number | null;
  metro_area: string | null;
}

interface MarketVitalsDbRow {
  market_id: string;
  jedi_score: number | null;
  avg_rent_per_unit: number | null;
  occupancy_rate: string | null;
  vacancy_rate: string | null;
  population_growth_yoy: string | null;
  job_growth_yoy: string | null;
  rent_growth_yoy: string | null;
  absorption_rate: string | null;
  new_supply_units: number | null;
  median_income: number | null;
  date: string;
}

interface MetricTsDbRow {
  geography_id: string;
  geography_name: string;
  value: string;
  period_date: string;
}

interface M28HistoryDbRow {
  market_id: string;
  classified_phase: string | null;
  cap_rate: string | null;
  vacancy: string | null;
  absorption: string | null;
  deliveries: number | null;
}

interface SubmarketDbRow {
  id: number;
  name: string;
  msa_id: number;
  properties_count: number | null;
  total_units: number | null;
  avg_occupancy: string | null;
  avg_rent: string | null;
  avg_cap_rate: string | null;
  market_name: string;
  display_name: string;
  state: string | null;
}

interface PropertyDbRow {
  id: number;
  address: string | null;
  city: string | null;
  state: string | null;
  units: number | null;
  year_built: number | null;
  owner_name: string | null;
  neighborhood_code: string | null;
  assessed_value: string | null;
  market_display: string | null;
  market_state: string | null;
  market_name: string | null;
}

interface RentCompDbRow {
  building_name: string | null;
  address: string | null;
  occupancy_pct: string | null;
  rent_per_unit: string | null;
  neighborhood: string | null;
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
    const marketsRes = await this.pool.query<AvailableMarketDbRow>(
      `SELECT am.id, am.name, am.display_name, am.state, am.property_count,
              am.metro_area
       FROM available_markets am
       WHERE am.enabled = true
       ORDER BY am.name`
    );

    let trackedIds: Set<string> = new Set();
    if (userId) {
      const prefs = await this.pool.query<{ market_id: string }>(
        `SELECT market_id FROM user_market_preferences WHERE user_id = $1 AND is_active = true`,
        [userId]
      );
      trackedIds = new Set(prefs.rows.map(r => r.market_id));
    }

    const vitalsRes = await this.pool.query<MarketVitalsDbRow>(
      `SELECT DISTINCT ON (market_id) 
              market_id, jedi_score, avg_rent_per_unit, occupancy_rate, vacancy_rate,
              population_growth_yoy, job_growth_yoy, rent_growth_yoy,
              absorption_rate, new_supply_units, median_income, date
       FROM market_vitals
       ORDER BY market_id, date DESC`
    );
    const vitalsMap = new Map<string, MarketVitalsDbRow>(
      vitalsRes.rows.map(r => [r.market_id, r])
    );

    const rentIndexRes = await this.pool.query<MetricTsDbRow>(
      `SELECT DISTINCT ON (geography_id)
              geography_id, geography_name, value, period_date
       FROM metric_time_series
       WHERE metric_id = 'rent_index' AND geography_type = 'metro'
       ORDER BY geography_id, period_date DESC`
    );
    const rentMap = new Map<string, MetricTsDbRow>(
      rentIndexRes.rows.map(r => [r.geography_id, r])
    );

    const rentYoyRes = await this.pool.query<MetricTsDbRow>(
      `SELECT DISTINCT ON (geography_id)
              geography_id, value
       FROM metric_time_series
       WHERE metric_id = 'rent_index_yoy' AND geography_type = 'metro'
       ORDER BY geography_id, period_date DESC`
    );
    const rentYoyMap = new Map<string, MetricTsDbRow>(
      rentYoyRes.rows.map(r => [r.geography_id, r])
    );

    const prevVitalsRes = await this.pool.query<{ market_id: string; jedi_score: number }>(
      `SELECT market_id, jedi_score
       FROM market_vitals
       WHERE date <= (CURRENT_DATE - INTERVAL '30 days')
       AND date >= (CURRENT_DATE - INTERVAL '60 days')
       ORDER BY market_id, date DESC`
    );
    const prevJediMap = new Map<string, number>();
    for (const r of prevVitalsRes.rows) {
      if (!prevJediMap.has(r.market_id)) {
        prevJediMap.set(r.market_id, r.jedi_score);
      }
    }

    const trendRes = await this.pool.query<{ market_id: string; jedi_score: number }>(
      `SELECT market_id, jedi_score
       FROM market_vitals
       WHERE date >= (CURRENT_DATE - INTERVAL '8 months')
       ORDER BY market_id, date ASC`
    );
    const trendMap = new Map<string, number[]>();
    for (const r of trendRes.rows) {
      if (!trendMap.has(r.market_id)) trendMap.set(r.market_id, []);
      trendMap.get(r.market_id)!.push(r.jedi_score);
    }

    const m28Res = await this.pool.query<M28HistoryDbRow>(
      `SELECT DISTINCT ON (market_id)
              market_id, classified_phase, cap_rate, vacancy, absorption, deliveries
       FROM m28_market_metrics_history
       ORDER BY market_id, created_at DESC`
    );
    const m28Map = new Map<string, M28HistoryDbRow>(
      m28Res.rows.map(r => [r.market_id, r])
    );

    const rows: MarketRow[] = [];
    const emptyVitals: Partial<MarketVitalsDbRow> = {};
    const emptyM28: Partial<M28HistoryDbRow> = {};

    for (const mkt of marketsRes.rows) {
      const vitals = vitalsMap.get(mkt.name) ?? emptyVitals;
      const m28 = m28Map.get(mkt.name) ?? emptyM28;
      const metroSlug = METRO_SLUG_MAP[mkt.name];
      const rentTs = metroSlug ? rentMap.get(metroSlug) : undefined;
      const rentYoy = metroSlug ? rentYoyMap.get(metroSlug) : undefined;

      const rentNum = rentTs ? parseFloat(rentTs.value) : (vitals.avg_rent_per_unit ?? 0);
      const rentGrowth = rentYoy ? parseFloat(rentYoy.value) : parseFloat(vitals.rent_growth_yoy ?? '0');
      const occupancy = parseFloat(vitals.occupancy_rate ?? '93');
      const vacancy = m28.vacancy != null ? parseFloat(m28.vacancy)
        : (vitals.vacancy_rate ? parseFloat(vitals.vacancy_rate) : (100 - occupancy));
      const popGrowth = parseFloat(vitals.population_growth_yoy ?? '0');
      const jobGrowth = parseFloat(vitals.job_growth_yoy ?? '0');
      const medIncome = vitals.median_income ?? 0;
      const absorption = m28.absorption != null ? parseFloat(m28.absorption)
        : parseFloat(vitals.absorption_rate ?? '0');
      const newSupply = m28.deliveries ?? vitals.new_supply_units ?? 0;
      const propCount = mkt.property_count ?? 0;

      const jedi = vitals.jedi_score ?? computeMarketJedi(rentGrowth, vacancy, jobGrowth, popGrowth, occupancy);

      const cycle = m28.classified_phase
        ?? deriveCyclePhase(rentGrowth, vacancy, jobGrowth);

      const trendData = trendMap.get(mkt.name);
      const trend = trendData && trendData.length >= 2
        ? trendData.slice(-8)
        : Array.from({ length: 8 }, (_, i) =>
            Math.round(Math.max(40, jedi - 8) + ((jedi - Math.max(40, jedi - 8)) * (i + 1)) / 8)
          );

      const prevJedi = prevJediMap.get(mkt.name);
      const d30 = prevJedi != null ? jedi - prevJedi : 0;

      const totalUnits = propCount * 120;
      const pipelinePct = newSupply > 0 && totalUnits > 0
        ? (newSupply / totalUnits) * 100
        : Math.max(5, 20 - jedi * 0.15);
      const costPerUnit = Math.round(rentNum * 3.5 + 1000);
      const dApt = jedi > 0 ? Math.round(100 - (vacancy * 5) + (popGrowth * 10)) : 50;
      const capRate = m28.cap_rate != null ? parseFloat(m28.cap_rate)
        : (3.5 + (100 - jedi) * 0.04);

      rows.push({
        id: `${mkt.name}-${mkt.state?.toLowerCase() ?? 'us'}`,
        rank: 0,
        starred: trackedIds.has(mkt.name),
        msa: `${mkt.display_name}, ${mkt.state ?? ''}`.trim(),
        props: propCount,
        units: formatUnits(totalUnits),
        jedi,
        d30,
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
    const params: (string | number)[] = [];

    if (msaId) {
      const marketName = msaId.split('-')[0];
      const msa = await this.pool.query<{ id: number }>(
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

    const result = await this.pool.query<SubmarketDbRow>(
      `SELECT s.id, s.name, s.msa_id, s.properties_count, s.total_units,
              s.avg_occupancy, s.avg_rent, s.avg_cap_rate,
              am.name as market_name, am.display_name, am.state
       FROM submarkets s
       JOIN available_markets am ON am.id = s.msa_id
       ${whereClause}
       ORDER BY s.avg_rent DESC`,
      params
    );

    return result.rows.map((r: SubmarketDbRow) => {
      const occupancy = parseFloat(r.avg_occupancy ?? '92');
      const vacancy = 100 - occupancy;
      const rent = parseFloat(r.avg_rent ?? '0');
      const capRate = parseFloat(r.avg_cap_rate ?? '5.0');

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
        msa: `${r.display_name}, ${r.state ?? ''}`.trim(),
        msaId: `${r.market_name}-${(r.state ?? '').toLowerCase()}`,
        jedi: subJedi,
        rent: formatCurrency(rent),
        rentD: formatDelta(rentDelta),
        vac: formatPct(vacancy),
        props: r.properties_count ?? 0,
        units: formatUnits(r.total_units ?? 0),
        opp,
        cap: formatPct(capRate),
        cycle,
      };
    });
  }

  async getProperties(msaId?: string): Promise<PropertyRow[]> {
    let whereClause = '';
    const params: string[] = [];

    if (msaId) {
      const marketName = msaId.split('-')[0];
      whereClause = `WHERE LOWER(pr.city) LIKE $1 OR LOWER(am.name) = $2`;
      params.push(`%${marketName}%`, marketName);
    }

    const result = await this.pool.query<PropertyDbRow>(
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

    const rcRes = await this.pool.query<RentCompDbRow>(
      `SELECT building_name, address, occupancy_pct, rent_per_unit, neighborhood FROM rent_comps`
    );
    const rcByName = new Map<string, RentCompDbRow>(
      rcRes.rows.filter(r => r.building_name).map(r => [r.building_name!.toLowerCase(), r])
    );
    const rcByAddr = new Map<string, RentCompDbRow>(
      rcRes.rows.filter(r => r.address).map(r => [r.address!.toLowerCase(), r])
    );

    const marketVitalsRes = await this.pool.query<{ market_id: string; occupancy_rate: string | null }>(
      `SELECT DISTINCT ON (market_id) market_id, occupancy_rate
       FROM market_vitals ORDER BY market_id, date DESC`
    );
    const marketOccMap = new Map<string, number>(
      marketVitalsRes.rows.map(r => [r.market_id, parseFloat(r.occupancy_rate ?? '92')])
    );

    return result.rows.map((r: PropertyDbRow) => {
      const units = r.units ?? 0;
      const yearBuilt = r.year_built ?? 0;
      const assessed = r.assessed_value ? Number(r.assessed_value) : 0;
      const addrLower = r.address?.toLowerCase() ?? '';
      const rc = rcByName.get(addrLower) ?? rcByAddr.get(addrLower);

      let occupancy: number;
      if (rc?.occupancy_pct) {
        occupancy = parseFloat(rc.occupancy_pct);
      } else if (r.market_name && marketOccMap.has(r.market_name)) {
        occupancy = marketOccMap.get(r.market_name)!;
      } else {
        occupancy = 92.0;
      }

      const rentPerUnit = rc?.rent_per_unit ? parseFloat(rc.rent_per_unit)
        : (units > 0 && assessed > 0 ? Math.round(assessed / units / 12 * 0.08) : 0);
      const capRate = assessed > 0 && rentPerUnit > 0
        ? Math.round((rentPerUnit * 12 * units * 0.65 / assessed) * 100) / 100
        : 5.0;

      const propJedi = Math.round(
        Math.min(100, Math.max(0, occupancy * 0.5 + (rentPerUnit / 50) + (2026 - yearBuilt < 10 ? 15 : 0)))
      );

      const submarket = r.neighborhood_code ?? rc?.neighborhood ?? 'General';
      const msa = r.market_display
        ? `${r.market_display}, ${r.market_state ?? r.state ?? ''}`
        : `${r.city ?? 'Unknown'}, ${r.state ?? ''}`;

      const name = r.address ?? `Property ${r.id}`;

      return {
        name: name.length > 30 ? name.substring(0, 28) + '\u2026' : name,
        submarket,
        msa: msa.trim(),
        jedi: propJedi,
        units,
        rent: rentPerUnit > 0 ? formatCurrency(rentPerUnit) : '\u2014',
        occ: formatPct(occupancy),
        capRate: formatPct(capRate),
        vintage: yearBuilt,
        owner: (r.owner_name ?? 'Unknown').substring(0, 20),
      };
    });
  }

  async getAggregated(userId?: string, msaId?: string): Promise<{
    markets: MarketRow[];
    submarkets: SubmarketRow[];
    properties: PropertyRow[];
    timestamp: string;
  }> {
    const [markets, submarkets, properties] = await Promise.all([
      this.getMarkets(userId),
      this.getSubmarkets(msaId),
      this.getProperties(msaId),
    ]);
    return {
      markets,
      submarkets,
      properties,
      timestamp: new Date().toISOString(),
    };
  }

  async refreshMetricsSnapshot(): Promise<{ marketsProcessed: number; timestamp: Date }> {
    const marketsRes = await this.pool.query<{ name: string }>(
      `SELECT am.name FROM available_markets am WHERE am.enabled = true`
    );

    let processed = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const mkt of marketsRes.rows) {
      const metroSlug = METRO_SLUG_MAP[mkt.name];
      if (!metroSlug) continue;

      const rentRes = await this.pool.query<{ value: string }>(
        `SELECT value FROM metric_time_series
         WHERE metric_id = 'rent_index' AND geography_type = 'metro' AND geography_id = $1
         ORDER BY period_date DESC LIMIT 1`,
        [metroSlug]
      );
      const rentYoyRes = await this.pool.query<{ value: string }>(
        `SELECT value FROM metric_time_series
         WHERE metric_id = 'rent_index_yoy' AND geography_type = 'metro' AND geography_id = $1
         ORDER BY period_date DESC LIMIT 1`,
        [metroSlug]
      );

      const rentVal = rentRes.rows[0]?.value ? Math.round(parseFloat(rentRes.rows[0].value)) : null;
      const rentYoy = rentYoyRes.rows[0]?.value ? parseFloat(rentYoyRes.rows[0].value) : null;

      if (rentVal == null) continue;

      const existing = await this.pool.query<MarketVitalsDbRow>(
        `SELECT market_id, jedi_score, occupancy_rate, vacancy_rate, population_growth_yoy, job_growth_yoy,
                rent_growth_yoy, median_income, absorption_rate, new_supply_units, avg_rent_per_unit, date
         FROM market_vitals WHERE market_id = $1 ORDER BY date DESC LIMIT 1`,
        [mkt.name]
      );

      const prev = existing.rows[0];
      const occupancy = parseFloat(prev?.occupancy_rate ?? '93');
      const vacancy = prev?.vacancy_rate ? parseFloat(prev.vacancy_rate) : (100 - occupancy);
      const popGrowth = parseFloat(prev?.population_growth_yoy ?? '0');
      const jobGrowth = parseFloat(prev?.job_growth_yoy ?? '0');
      const rentGrowth = rentYoy ?? parseFloat(prev?.rent_growth_yoy ?? '0');

      const jedi = computeMarketJedi(rentGrowth, vacancy, jobGrowth, popGrowth, occupancy);

      await this.pool.query(
        `INSERT INTO market_vitals (market_id, date, avg_rent_per_unit, rent_growth_yoy, jedi_score, jedi_rating,
                                    occupancy_rate, vacancy_rate, population_growth_yoy, job_growth_yoy,
                                    median_income, absorption_rate, new_supply_units, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'aggregator_refresh')
         ON CONFLICT (market_id, date) DO UPDATE SET
           avg_rent_per_unit = EXCLUDED.avg_rent_per_unit,
           rent_growth_yoy = EXCLUDED.rent_growth_yoy,
           jedi_score = EXCLUDED.jedi_score,
           jedi_rating = EXCLUDED.jedi_rating,
           occupancy_rate = EXCLUDED.occupancy_rate,
           vacancy_rate = EXCLUDED.vacancy_rate,
           population_growth_yoy = EXCLUDED.population_growth_yoy,
           job_growth_yoy = EXCLUDED.job_growth_yoy,
           median_income = EXCLUDED.median_income,
           absorption_rate = EXCLUDED.absorption_rate,
           new_supply_units = EXCLUDED.new_supply_units,
           source = EXCLUDED.source`,
        [
          mkt.name, today, rentVal, rentGrowth, jedi,
          jedi >= 80 ? 'Strong Buy' : jedi >= 60 ? 'Buy' : jedi >= 40 ? 'Hold' : 'Sell',
          occupancy, vacancy, popGrowth, jobGrowth,
          prev?.median_income ?? null,
          prev?.absorption_rate ?? null,
          prev?.new_supply_units ?? null,
        ]
      );

      processed++;
    }

    console.log(`[MarketMetricsAggregator] Refreshed ${processed} market vitals from metric_time_series`);
    return { marketsProcessed: processed, timestamp: new Date() };
  }
}
