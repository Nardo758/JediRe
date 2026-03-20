import { Pool } from 'pg';

export interface PropertyMetrics {
  assessedPerUnit: number | null;
  appraisedPerUnit: number | null;
  unitsPerAcre: number | null;
  landValueRatio: number | null;
  taxRatePct: number | null;
  buildingSfPerUnit: number | null;
  totalUnits: number;
  landAcres: number | null;
  assessedValue: number | null;
  appraisedValue: number | null;
}

export interface NeighborhoodBenchmarks {
  neighborhoodCode: string;
  propertyCount: number;
  totalUnits: number;
  medianPerUnit: number | null;
  avgPerUnit: number | null;
  minPerUnit: number | null;
  maxPerUnit: number | null;
  avgDensity: number | null;
  minDensity: number | null;
  maxDensity: number | null;
  medianDensity: number | null;
  avgTaxRate: number | null;
  avgLandValueRatio: number | null;
  avgBuildingSfPerUnit: number | null;
}

export interface OwnerPortfolio {
  ownerName: string;
  propertyCount: number;
  totalUnits: number;
  totalAssessedValue: number;
  neighborhoods: string[];
}

export interface RentCompMetrics {
  buildingName: string;
  address: string;
  units: number;
  yearBuilt: number | null;
  avgSf: number | null;
  rentPerSf: number | null;
  rentPerUnit: number | null;
  occupancyPct: number | null;
  concessionPct: number | null;
  milesAway: number | null;
  overlapPct: number | null;
  studioRent: number | null;
  oneBedRent: number | null;
  twoBedRent: number | null;
  threeBedRent: number | null;
  studioCount: number | null;
  oneBedCount: number | null;
  twoBedCount: number | null;
  threeBedCount: number | null;
  effectiveRentPerSf: number | null;
  neighborhood: string | null;
  adLevel: string | null;
  stories: number | null;
}

export interface MarketSummary {
  avgRentPerSf: number;
  medianRentPerSf: number;
  avgOccupancy: number;
  avgConcession: number;
  totalUnits: number;
  propertyCount: number;
  avgYearBuilt: number;
  avgUnitSize: number;
  rentRange: { min: number; max: number };
  occupancyRange: { min: number; max: number };
}

export interface DensityMetrics {
  propertyDensity: number | null;
  neighborhoodAvg: number | null;
  neighborhoodMax: number | null;
  neighborhoodMin: number | null;
  percentileRank: number | null;
  landUtilization: number | null;
  comparables: Array<{
    address: string;
    units: number;
    acres: number;
    density: number;
  }>;
}

export class PropertyMetricsService {
  constructor(private pool: Pool) {}

  async getPropertyMetrics(parcelId: string): Promise<PropertyMetrics | null> {
    const result = await this.pool.query(
      `SELECT units, land_acres, assessed_value, appraised_value, 
              assessed_land, assessed_improvements, building_sqft,
              CASE WHEN units > 0 THEN assessed_value::numeric / units END as assessed_per_unit,
              CASE WHEN units > 0 THEN appraised_value::numeric / units END as appraised_per_unit,
              CASE WHEN land_acres > 0 THEN units::numeric / land_acres END as units_per_acre,
              CASE WHEN assessed_value > 0 THEN assessed_land::numeric / assessed_value END as land_value_ratio,
              CASE WHEN units > 0 THEN building_sqft::numeric / units END as building_sf_per_unit
       FROM property_records WHERE parcel_id = $1`,
      [parcelId]
    );
    if (result.rows.length === 0) return null;
    const r = result.rows[0];
    return {
      assessedPerUnit: r.assessed_per_unit ? Math.round(Number(r.assessed_per_unit)) : null,
      appraisedPerUnit: r.appraised_per_unit ? Math.round(Number(r.appraised_per_unit)) : null,
      unitsPerAcre: r.units_per_acre ? Math.round(Number(r.units_per_acre) * 10) / 10 : null,
      landValueRatio: r.land_value_ratio ? Math.round(Number(r.land_value_ratio) * 1000) / 10 : null,
      taxRatePct: null,
      buildingSfPerUnit: r.building_sf_per_unit ? Math.round(Number(r.building_sf_per_unit)) : null,
      totalUnits: r.units,
      landAcres: r.land_acres ? Number(r.land_acres) : null,
      assessedValue: r.assessed_value ? Number(r.assessed_value) : null,
      appraisedValue: r.appraised_value ? Number(r.appraised_value) : null,
    };
  }

  async getNeighborhoodBenchmarks(neighborhoodCode?: string): Promise<NeighborhoodBenchmarks[]> {
    const whereClause = neighborhoodCode ? `WHERE neighborhood_code = $1` : '';
    const params = neighborhoodCode ? [neighborhoodCode] : [];

    const result = await this.pool.query(
      `SELECT 
        neighborhood_code,
        COUNT(*) as property_count,
        SUM(units) as total_units,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CASE WHEN units > 0 THEN assessed_value::numeric / units END) as median_per_unit,
        AVG(CASE WHEN units > 0 THEN assessed_value::numeric / units END) as avg_per_unit,
        MIN(CASE WHEN units > 0 THEN assessed_value::numeric / units END) as min_per_unit,
        MAX(CASE WHEN units > 0 THEN assessed_value::numeric / units END) as max_per_unit,
        AVG(CASE WHEN land_acres > 0 THEN units::numeric / land_acres END) as avg_density,
        MIN(CASE WHEN land_acres > 0 THEN units::numeric / land_acres END) as min_density,
        MAX(CASE WHEN land_acres > 0 THEN units::numeric / land_acres END) as max_density,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CASE WHEN land_acres > 0 THEN units::numeric / land_acres END) as median_density,
        AVG(CASE WHEN assessed_value > 0 THEN assessed_land::numeric / assessed_value END) as avg_land_value_ratio,
        AVG(CASE WHEN units > 0 THEN building_sqft::numeric / units END) as avg_building_sf_per_unit
       FROM property_records
       ${whereClause}
       GROUP BY neighborhood_code
       HAVING COUNT(*) >= 3
       ORDER BY SUM(units) DESC`,
      params
    );

    return result.rows.map((r: any) => ({
      neighborhoodCode: r.neighborhood_code || 'Unknown',
      propertyCount: Number(r.property_count),
      totalUnits: Number(r.total_units),
      medianPerUnit: r.median_per_unit ? Math.round(Number(r.median_per_unit)) : null,
      avgPerUnit: r.avg_per_unit ? Math.round(Number(r.avg_per_unit)) : null,
      minPerUnit: r.min_per_unit ? Math.round(Number(r.min_per_unit)) : null,
      maxPerUnit: r.max_per_unit ? Math.round(Number(r.max_per_unit)) : null,
      avgDensity: r.avg_density ? Math.round(Number(r.avg_density) * 10) / 10 : null,
      minDensity: r.min_density ? Math.round(Number(r.min_density) * 10) / 10 : null,
      maxDensity: r.max_density ? Math.round(Number(r.max_density) * 10) / 10 : null,
      medianDensity: r.median_density ? Math.round(Number(r.median_density) * 10) / 10 : null,
      avgTaxRate: null,
      avgLandValueRatio: r.avg_land_value_ratio ? Math.round(Number(r.avg_land_value_ratio) * 1000) / 10 : null,
      avgBuildingSfPerUnit: r.avg_building_sf_per_unit ? Math.round(Number(r.avg_building_sf_per_unit)) : null,
    }));
  }

  async getOwnerPortfolio(ownerName: string): Promise<OwnerPortfolio | null> {
    const result = await this.pool.query(
      `SELECT owner_name, COUNT(*) as property_count, SUM(units) as total_units,
              SUM(assessed_value) as total_assessed,
              ARRAY_AGG(DISTINCT neighborhood_code) as neighborhoods
       FROM property_records
       WHERE owner_name ILIKE $1
       GROUP BY owner_name`,
      [`%${ownerName}%`]
    );
    if (result.rows.length === 0) return null;
    const r = result.rows[0];
    return {
      ownerName: r.owner_name,
      propertyCount: Number(r.property_count),
      totalUnits: Number(r.total_units),
      totalAssessedValue: Number(r.total_assessed),
      neighborhoods: r.neighborhoods?.filter(Boolean) || [],
    };
  }

  async getTopOwners(limit: number = 20): Promise<OwnerPortfolio[]> {
    const result = await this.pool.query(
      `SELECT owner_name, COUNT(*) as property_count, SUM(units) as total_units,
              SUM(assessed_value) as total_assessed,
              ARRAY_AGG(DISTINCT neighborhood_code) as neighborhoods
       FROM property_records
       WHERE owner_name IS NOT NULL
       GROUP BY owner_name
       ORDER BY SUM(units) DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map((r: any) => ({
      ownerName: r.owner_name,
      propertyCount: Number(r.property_count),
      totalUnits: Number(r.total_units),
      totalAssessedValue: Number(r.total_assessed),
      neighborhoods: r.neighborhoods?.filter(Boolean) || [],
    }));
  }

  async getDensityMetrics(parcelId: string): Promise<DensityMetrics | null> {
    const prop = await this.pool.query(
      `SELECT units, land_acres, building_sqft, parcel_area_sqft, neighborhood_code,
              CASE WHEN land_acres > 0 THEN units::numeric / land_acres END as density
       FROM property_records WHERE parcel_id = $1`,
      [parcelId]
    );
    if (prop.rows.length === 0) return null;
    const p = prop.rows[0];
    const density = p.density ? Number(p.density) : null;
    const nc = p.neighborhood_code;

    const benchmarks = await this.pool.query(
      `SELECT 
        AVG(CASE WHEN land_acres > 0 THEN units::numeric / land_acres END) as avg_density,
        MAX(CASE WHEN land_acres > 0 THEN units::numeric / land_acres END) as max_density,
        MIN(CASE WHEN land_acres > 0 THEN units::numeric / land_acres END) as min_density
       FROM property_records WHERE neighborhood_code = $1`,
      [nc]
    );

    let percentileRank: number | null = null;
    if (density) {
      const pctResult = await this.pool.query(
        `SELECT COUNT(*) FILTER (WHERE CASE WHEN land_acres > 0 THEN units::numeric / land_acres END <= $1)::numeric 
                / NULLIF(COUNT(*) FILTER (WHERE land_acres > 0), 0) * 100 as pct
         FROM property_records`,
        [density]
      );
      percentileRank = pctResult.rows[0]?.pct ? Math.round(Number(pctResult.rows[0].pct)) : null;
    }

    const landUtil = p.building_sqft && p.parcel_area_sqft && Number(p.parcel_area_sqft) > 0
      ? Math.round(Number(p.building_sqft) / Number(p.parcel_area_sqft) * 1000) / 10
      : null;

    const comps = await this.pool.query(
      `SELECT address, units, land_acres, 
              CASE WHEN land_acres > 0 THEN units::numeric / land_acres END as density
       FROM property_records 
       WHERE neighborhood_code = $1 AND parcel_id != $2 AND land_acres > 0
       ORDER BY CASE WHEN land_acres > 0 THEN units::numeric / land_acres END DESC
       LIMIT 5`,
      [nc, parcelId]
    );

    const b = benchmarks.rows[0] || {};
    return {
      propertyDensity: density ? Math.round(density * 10) / 10 : null,
      neighborhoodAvg: b.avg_density ? Math.round(Number(b.avg_density) * 10) / 10 : null,
      neighborhoodMax: b.max_density ? Math.round(Number(b.max_density) * 10) / 10 : null,
      neighborhoodMin: b.min_density ? Math.round(Number(b.min_density) * 10) / 10 : null,
      percentileRank,
      landUtilization: landUtil,
      comparables: comps.rows.map((c: any) => ({
        address: c.address,
        units: c.units,
        acres: Number(c.land_acres),
        density: Math.round(Number(c.density) * 10) / 10,
      })),
    };
  }

  async getRentComps(market?: string): Promise<RentCompMetrics[]> {
    const where = market ? `WHERE market = $1` : '';
    const params = market ? [market] : [];
    const result = await this.pool.query(
      `SELECT building_name, address, units, year_built, avg_sf, rent_per_sf, rent_per_unit,
              occupancy_pct, concession_pct, miles_away, overlap_pct,
              studio_rent, one_bed_rent, two_bed_rent, three_bed_rent,
              studio_count, one_bed_count, two_bed_count, three_bed_count,
              neighborhood, ad_level, stories,
              CASE WHEN occupancy_pct > 0 THEN rent_per_sf * occupancy_pct / 100 END as effective_rent_per_sf
       FROM rent_comps ${where}
       ORDER BY rent_per_sf DESC`,
      params
    );
    return result.rows.map((r: any) => ({
      buildingName: r.building_name,
      address: r.address,
      units: r.units,
      yearBuilt: r.year_built,
      avgSf: r.avg_sf ? Number(r.avg_sf) : null,
      rentPerSf: r.rent_per_sf ? Number(r.rent_per_sf) : null,
      rentPerUnit: r.rent_per_unit ? Number(r.rent_per_unit) : null,
      occupancyPct: r.occupancy_pct ? Number(r.occupancy_pct) : null,
      concessionPct: r.concession_pct ? Number(r.concession_pct) : null,
      milesAway: r.miles_away ? Number(r.miles_away) : null,
      overlapPct: r.overlap_pct ? Number(r.overlap_pct) : null,
      studioRent: r.studio_rent ? Number(r.studio_rent) : null,
      oneBedRent: r.one_bed_rent ? Number(r.one_bed_rent) : null,
      twoBedRent: r.two_bed_rent ? Number(r.two_bed_rent) : null,
      threeBedRent: r.three_bed_rent ? Number(r.three_bed_rent) : null,
      studioCount: r.studio_count,
      oneBedCount: r.one_bed_count,
      twoBedCount: r.two_bed_count,
      threeBedCount: r.three_bed_count,
      effectiveRentPerSf: r.effective_rent_per_sf ? Math.round(Number(r.effective_rent_per_sf) * 100) / 100 : null,
      neighborhood: r.neighborhood,
      adLevel: r.ad_level,
      stories: r.stories,
    }));
  }

  async getMarketSummary(market?: string): Promise<MarketSummary> {
    const where = market ? `WHERE market = $1` : '';
    const params = market ? [market] : [];
    const result = await this.pool.query(
      `SELECT 
        AVG(rent_per_sf) as avg_rent,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rent_per_sf) as median_rent,
        AVG(occupancy_pct) as avg_occ,
        AVG(concession_pct) as avg_conc,
        SUM(units) as total_units,
        COUNT(*) as prop_count,
        AVG(year_built) as avg_year,
        AVG(avg_sf) as avg_sf,
        MIN(rent_per_sf) as min_rent,
        MAX(rent_per_sf) as max_rent,
        MIN(occupancy_pct) as min_occ,
        MAX(occupancy_pct) as max_occ
       FROM rent_comps ${where}`,
      params
    );
    const r = result.rows[0];
    return {
      avgRentPerSf: Math.round(Number(r.avg_rent) * 100) / 100,
      medianRentPerSf: Math.round(Number(r.median_rent) * 100) / 100,
      avgOccupancy: Math.round(Number(r.avg_occ) * 10) / 10,
      avgConcession: Math.round(Number(r.avg_conc) * 10) / 10,
      totalUnits: Number(r.total_units),
      propertyCount: Number(r.prop_count),
      avgYearBuilt: Math.round(Number(r.avg_year)),
      avgUnitSize: Math.round(Number(r.avg_sf)),
      rentRange: { min: Number(r.min_rent), max: Number(r.max_rent) },
      occupancyRange: { min: Number(r.min_occ), max: Number(r.max_occ) },
    };
  }

  async getSubmarketComparison(): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT 
        neighborhood_code,
        COUNT(*) as properties,
        SUM(units) as total_units,
        ROUND(AVG(CASE WHEN units > 0 THEN assessed_value::numeric / units END)) as avg_value_per_unit,
        ROUND(AVG(CASE WHEN land_acres > 0 THEN units::numeric / land_acres END)::numeric, 1) as avg_density,
        ROUND(AVG(CASE WHEN assessed_value > 0 THEN assessed_land::numeric / assessed_value END)::numeric * 100, 1) as avg_land_pct,
        ROUND(AVG(CASE WHEN units > 0 THEN building_sqft::numeric / units END)) as avg_sf_per_unit
       FROM property_records
       WHERE neighborhood_code IS NOT NULL
       GROUP BY neighborhood_code
       HAVING COUNT(*) >= 3
       ORDER BY SUM(units) DESC`
    );
    return result.rows.map((r: any) => ({
      neighborhoodCode: r.neighborhood_code,
      properties: Number(r.properties),
      totalUnits: Number(r.total_units),
      avgValuePerUnit: Number(r.avg_value_per_unit),
      avgDensity: Number(r.avg_density),
      avgLandPct: Number(r.avg_land_pct),
      avgSfPerUnit: Number(r.avg_sf_per_unit),
    }));
  }
}
