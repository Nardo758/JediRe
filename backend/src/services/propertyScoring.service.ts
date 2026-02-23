import { Pool } from 'pg';

export interface SellerPropensityResult {
  parcelId: string;
  address: string;
  ownerName: string;
  ownerAddress: string | null;
  units: number;
  yearBuilt: string | null;
  neighborhoodCode: string | null;
  assessedValue: number | null;
  appraisedValue: number | null;
  score: number;
  factors: SellerFactor[];
}

export interface SellerFactor {
  name: string;
  points: number;
  maxPoints: number;
  reason: string;
}

export interface ValueAddResult {
  parcelId: string;
  address: string;
  ownerName: string;
  units: number;
  yearBuilt: string | null;
  neighborhoodCode: string | null;
  assessedPerUnit: number | null;
  density: number | null;
  neighborhoodAvgDensity: number | null;
  score: number;
  factors: ValueAddFactor[];
  recommendation: 'renovate' | 'redevelop' | 'hold';
}

export interface ValueAddFactor {
  name: string;
  points: number;
  maxPoints: number;
  reason: string;
}

export interface HiddenGemResult {
  buildingName: string;
  address: string;
  units: number;
  yearBuilt: number | null;
  rentPerSf: number | null;
  occupancyPct: number | null;
  concessionPct: number | null;
  adLevel: string | null;
  commonViews60d: number | null;
  overlapPct: number | null;
  neighborhood: string | null;
  score: number;
  factors: HiddenGemFactor[];
  insight: string;
}

export interface HiddenGemFactor {
  name: string;
  points: number;
  maxPoints: number;
  reason: string;
}

export interface CapRateEstimate {
  neighborhoodCode: string;
  propertyCount: number;
  totalUnits: number;
  avgAssessedPerUnit: number;
  impliedCapRate: number;
  estimatedNOIPerUnit: number;
  avgRentPerSfProxy: number | null;
  tier: 'premium' | 'standard' | 'value';
}

export interface TaxBurdenResult {
  parcelId: string;
  address: string;
  ownerName: string;
  units: number;
  neighborhoodCode: string | null;
  assessedValue: number;
  appraisedValue: number;
  effectiveTaxRate: number;
  neighborhoodMedianRate: number;
  deviationPct: number;
  flag: 'overtaxed' | 'undertaxed' | 'normal';
}

export class PropertyScoringService {
  constructor(private pool: Pool) {}

  async getSellerPropensityScores(limit: number = 50): Promise<SellerPropensityResult[]> {
    const ownerCounts = await this.pool.query(
      `SELECT owner_name, COUNT(*) as cnt FROM property_records
       WHERE owner_name IS NOT NULL GROUP BY owner_name`
    );
    const ownerCountMap = new Map<string, number>();
    ownerCounts.rows.forEach((r: any) => ownerCountMap.set(r.owner_name, Number(r.cnt)));

    const neighborhoodAvgs = await this.pool.query(
      `SELECT neighborhood_code,
              AVG(CASE WHEN land_acres > 0 THEN units::numeric / land_acres END) as avg_density,
              PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CASE WHEN units > 0 THEN assessed_value::numeric / units END) as median_per_unit
       FROM property_records
       WHERE neighborhood_code IS NOT NULL
       GROUP BY neighborhood_code`
    );
    const neighborhoodMap = new Map<string, { avgDensity: number; medianPerUnit: number }>();
    neighborhoodAvgs.rows.forEach((r: any) => {
      neighborhoodMap.set(r.neighborhood_code, {
        avgDensity: Number(r.avg_density) || 0,
        medianPerUnit: Number(r.median_per_unit) || 0,
      });
    });

    const props = await this.pool.query(
      `SELECT parcel_id, address, owner_name, owner_address_1, owner_address_2,
              units, year_built, neighborhood_code, assessed_value, appraised_value,
              assessed_land, land_acres, building_sqft
       FROM property_records
       WHERE units > 0 AND owner_name IS NOT NULL
       ORDER BY units DESC`
    );

    const scored: SellerPropensityResult[] = props.rows.map((p: any) => {
      const factors: SellerFactor[] = [];
      let score = 0;

      const addr2 = (p.owner_address_2 || '').toUpperCase();
      const isOutOfState = addr2.length > 0 && !addr2.includes(' GA ') && !addr2.includes(' GA,') && !addr2.includes(',GA') && !addr2.startsWith('ATLANTA') && !addr2.includes('GEORGIA');
      if (isOutOfState) {
        factors.push({ name: 'Out-of-State Owner', points: 20, maxPoints: 20, reason: `Mailing address: ${p.owner_address_2}` });
        score += 20;
      } else {
        factors.push({ name: 'Out-of-State Owner', points: 0, maxPoints: 20, reason: 'Local owner' });
      }

      const ownerCount = ownerCountMap.get(p.owner_name) || 1;
      if (ownerCount === 1) {
        factors.push({ name: 'Single-Property Owner', points: 15, maxPoints: 15, reason: 'Owns only 1 property' });
        score += 15;
      } else if (ownerCount <= 3) {
        factors.push({ name: 'Small Portfolio', points: 8, maxPoints: 15, reason: `Owns ${ownerCount} properties` });
        score += 8;
      } else {
        factors.push({ name: 'Large Portfolio', points: 0, maxPoints: 15, reason: `Owns ${ownerCount} properties` });
      }

      const yearBuilt = parseInt(p.year_built);
      const age = yearBuilt ? 2026 - yearBuilt : 0;
      if (age >= 40) {
        factors.push({ name: 'Building Age', points: 15, maxPoints: 15, reason: `Built ${p.year_built} (${age} years old)` });
        score += 15;
      } else if (age >= 30) {
        factors.push({ name: 'Building Age', points: 10, maxPoints: 15, reason: `Built ${p.year_built} (${age} years old)` });
        score += 10;
      } else if (age >= 20) {
        factors.push({ name: 'Building Age', points: 5, maxPoints: 15, reason: `Built ${p.year_built} (${age} years old)` });
        score += 5;
      } else {
        factors.push({ name: 'Building Age', points: 0, maxPoints: 15, reason: yearBuilt ? `Built ${p.year_built} (${age} years old)` : 'Unknown year' });
      }

      const nb = neighborhoodMap.get(p.neighborhood_code);
      const density = p.land_acres > 0 ? p.units / Number(p.land_acres) : 0;
      const avgDensity = nb?.avgDensity || 0;
      if (avgDensity > 0 && density < avgDensity * 0.7) {
        factors.push({ name: 'Below-Market Density', points: 10, maxPoints: 10, reason: `${density.toFixed(1)} u/acre vs ${avgDensity.toFixed(1)} avg` });
        score += 10;
      } else if (avgDensity > 0 && density < avgDensity) {
        factors.push({ name: 'Below-Market Density', points: 5, maxPoints: 10, reason: `${density.toFixed(1)} u/acre vs ${avgDensity.toFixed(1)} avg` });
        score += 5;
      } else {
        factors.push({ name: 'Below-Market Density', points: 0, maxPoints: 10, reason: density > 0 ? `${density.toFixed(1)} u/acre vs ${avgDensity.toFixed(1)} avg` : 'No density data' });
      }

      const assessed = Number(p.assessed_value) || 0;
      const appraised = Number(p.appraised_value) || 0;
      if (assessed > 0 && appraised > 0) {
        const gap = (appraised - assessed) / appraised;
        if (gap > 0.2) {
          factors.push({ name: 'Assessed/Appraised Gap', points: 10, maxPoints: 10, reason: `Assessed ${Math.round(gap * 100)}% below appraised` });
          score += 10;
        } else if (gap > 0.1) {
          factors.push({ name: 'Assessed/Appraised Gap', points: 5, maxPoints: 10, reason: `Assessed ${Math.round(gap * 100)}% below appraised` });
          score += 5;
        } else {
          factors.push({ name: 'Assessed/Appraised Gap', points: 0, maxPoints: 10, reason: `Gap: ${Math.round(gap * 100)}%` });
        }
      } else {
        factors.push({ name: 'Assessed/Appraised Gap', points: 0, maxPoints: 10, reason: 'No valuation data' });
      }

      if (p.units >= 100 && p.units <= 200) {
        factors.push({ name: 'Manageable Unit Count', points: 10, maxPoints: 10, reason: `${p.units} units (sweet spot 100-200)` });
        score += 10;
      } else if (p.units >= 50 && p.units < 100) {
        factors.push({ name: 'Small Property', points: 7, maxPoints: 10, reason: `${p.units} units` });
        score += 7;
      } else if (p.units > 200 && p.units <= 350) {
        factors.push({ name: 'Mid-Size Property', points: 5, maxPoints: 10, reason: `${p.units} units` });
        score += 5;
      } else {
        factors.push({ name: 'Unit Count', points: 0, maxPoints: 10, reason: `${p.units} units` });
      }

      const medianPerUnit = nb?.medianPerUnit || 0;
      const perUnit = p.units > 0 ? assessed / p.units : 0;
      if (medianPerUnit > 0 && perUnit > 0 && perUnit > medianPerUnit * 1.1) {
        factors.push({ name: 'High Tax Burden', points: 10, maxPoints: 10, reason: `$${Math.round(perUnit).toLocaleString()}/unit vs $${Math.round(medianPerUnit).toLocaleString()} median` });
        score += 10;
      } else if (medianPerUnit > 0 && perUnit > medianPerUnit) {
        factors.push({ name: 'Above-Avg Tax Burden', points: 5, maxPoints: 10, reason: `$${Math.round(perUnit).toLocaleString()}/unit vs $${Math.round(medianPerUnit).toLocaleString()} median` });
        score += 5;
      } else {
        factors.push({ name: 'Tax Burden', points: 0, maxPoints: 10, reason: perUnit > 0 ? `$${Math.round(perUnit).toLocaleString()}/unit` : 'No data' });
      }

      return {
        parcelId: p.parcel_id,
        address: p.address,
        ownerName: p.owner_name,
        ownerAddress: p.owner_address_2,
        units: p.units,
        yearBuilt: p.year_built,
        neighborhoodCode: p.neighborhood_code,
        assessedValue: assessed || null,
        appraisedValue: appraised || null,
        score,
        factors,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  async getValueAddScores(limit: number = 100): Promise<ValueAddResult[]> {
    const neighborhoodAvgs = await this.pool.query(
      `SELECT neighborhood_code,
              AVG(CASE WHEN land_acres > 0 THEN units::numeric / land_acres END) as avg_density,
              PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CASE WHEN units > 0 THEN assessed_value::numeric / units END) as median_per_unit,
              COUNT(*) as cnt
       FROM property_records WHERE neighborhood_code IS NOT NULL
       GROUP BY neighborhood_code`
    );
    const nbMap = new Map<string, { avgDensity: number; medianPerUnit: number; count: number }>();
    neighborhoodAvgs.rows.forEach((r: any) => {
      nbMap.set(r.neighborhood_code, {
        avgDensity: Number(r.avg_density) || 0,
        medianPerUnit: Number(r.median_per_unit) || 0,
        count: Number(r.cnt),
      });
    });

    const props = await this.pool.query(
      `SELECT parcel_id, address, owner_name, units, year_built, neighborhood_code,
              assessed_value, appraised_value, assessed_land, land_acres, building_sqft
       FROM property_records WHERE units > 0`
    );

    const scored: ValueAddResult[] = props.rows.map((p: any) => {
      const factors: ValueAddFactor[] = [];
      let score = 0;
      const nb = nbMap.get(p.neighborhood_code);

      const yearBuilt = parseInt(p.year_built);
      const age = yearBuilt ? 2026 - yearBuilt : 0;
      if (age >= 35) {
        factors.push({ name: 'Property Age', points: 25, maxPoints: 25, reason: `${age} years old — significant renovation potential` });
        score += 25;
      } else if (age >= 25) {
        factors.push({ name: 'Property Age', points: 18, maxPoints: 25, reason: `${age} years old — moderate renovation potential` });
        score += 18;
      } else if (age >= 15) {
        factors.push({ name: 'Property Age', points: 10, maxPoints: 25, reason: `${age} years old — light refresh potential` });
        score += 10;
      } else {
        factors.push({ name: 'Property Age', points: 0, maxPoints: 25, reason: yearBuilt ? `${age} years old — too new for value-add` : 'Unknown year' });
      }

      const density = p.land_acres > 0 ? p.units / Number(p.land_acres) : 0;
      const avgDensity = nb?.avgDensity || 0;
      if (avgDensity > 0 && density > 0) {
        const ratio = density / avgDensity;
        if (ratio < 0.5) {
          factors.push({ name: 'Density Gap', points: 20, maxPoints: 20, reason: `${density.toFixed(1)} u/acre vs ${avgDensity.toFixed(1)} avg — could 2x+ units` });
          score += 20;
        } else if (ratio < 0.75) {
          factors.push({ name: 'Density Gap', points: 14, maxPoints: 20, reason: `${density.toFixed(1)} u/acre vs ${avgDensity.toFixed(1)} avg — room to add units` });
          score += 14;
        } else if (ratio < 1.0) {
          factors.push({ name: 'Density Gap', points: 7, maxPoints: 20, reason: `${density.toFixed(1)} u/acre vs ${avgDensity.toFixed(1)} avg — slight upside` });
          score += 7;
        } else {
          factors.push({ name: 'Density Gap', points: 0, maxPoints: 20, reason: `${density.toFixed(1)} u/acre — at or above market` });
        }
      } else {
        factors.push({ name: 'Density Gap', points: 0, maxPoints: 20, reason: 'Insufficient data' });
      }

      const assessed = Number(p.assessed_value) || 0;
      const appraised = Number(p.appraised_value) || 0;
      if (assessed > 0 && appraised > 0) {
        const ratio = assessed / appraised;
        if (ratio < 0.6) {
          factors.push({ name: 'Valuation Gap', points: 15, maxPoints: 15, reason: `Assessed at ${Math.round(ratio * 100)}% of appraised — significantly undervalued` });
          score += 15;
        } else if (ratio < 0.75) {
          factors.push({ name: 'Valuation Gap', points: 10, maxPoints: 15, reason: `Assessed at ${Math.round(ratio * 100)}% of appraised — undervalued` });
          score += 10;
        } else if (ratio < 0.9) {
          factors.push({ name: 'Valuation Gap', points: 5, maxPoints: 15, reason: `Assessed at ${Math.round(ratio * 100)}% of appraised` });
          score += 5;
        } else {
          factors.push({ name: 'Valuation Gap', points: 0, maxPoints: 15, reason: `Assessed at ${Math.round(ratio * 100)}% of appraised — fairly valued` });
        }
      } else {
        factors.push({ name: 'Valuation Gap', points: 0, maxPoints: 15, reason: 'No valuation data' });
      }

      const landRatio = assessed > 0 && Number(p.assessed_land) > 0 ? Number(p.assessed_land) / assessed : 0;
      if (landRatio > 0.6) {
        factors.push({ name: 'Land Value Dominance', points: 15, maxPoints: 15, reason: `Land is ${Math.round(landRatio * 100)}% of value — improvements are low-value` });
        score += 15;
      } else if (landRatio > 0.4) {
        factors.push({ name: 'Land Value Dominance', points: 10, maxPoints: 15, reason: `Land is ${Math.round(landRatio * 100)}% of value` });
        score += 10;
      } else if (landRatio > 0.25) {
        factors.push({ name: 'Land Value Dominance', points: 5, maxPoints: 15, reason: `Land is ${Math.round(landRatio * 100)}% of value` });
        score += 5;
      } else {
        factors.push({ name: 'Land Value Dominance', points: 0, maxPoints: 15, reason: landRatio > 0 ? `Land is ${Math.round(landRatio * 100)}% of value` : 'No data' });
      }

      const nbCount = nb?.count || 0;
      if (nbCount >= 20) {
        factors.push({ name: 'Location Quality', points: 15, maxPoints: 15, reason: `${nbCount} properties in neighborhood — established submarket` });
        score += 15;
      } else if (nbCount >= 10) {
        factors.push({ name: 'Location Quality', points: 10, maxPoints: 15, reason: `${nbCount} properties in neighborhood` });
        score += 10;
      } else if (nbCount >= 5) {
        factors.push({ name: 'Location Quality', points: 5, maxPoints: 15, reason: `${nbCount} properties in neighborhood` });
        score += 5;
      } else {
        factors.push({ name: 'Location Quality', points: 0, maxPoints: 15, reason: `Only ${nbCount} properties in neighborhood — thin market` });
      }

      const perUnit = p.units > 0 ? assessed / p.units : 0;
      const medianPerUnit = nb?.medianPerUnit || 0;
      if (medianPerUnit > 0 && perUnit > 0 && perUnit < medianPerUnit * 0.7) {
        factors.push({ name: 'Below-Market Value', points: 10, maxPoints: 10, reason: `$${Math.round(perUnit).toLocaleString()}/unit vs $${Math.round(medianPerUnit).toLocaleString()} median — buy low potential` });
        score += 10;
      } else if (medianPerUnit > 0 && perUnit < medianPerUnit) {
        factors.push({ name: 'Below-Market Value', points: 5, maxPoints: 10, reason: `$${Math.round(perUnit).toLocaleString()}/unit vs $${Math.round(medianPerUnit).toLocaleString()} median` });
        score += 5;
      } else {
        factors.push({ name: 'Below-Market Value', points: 0, maxPoints: 10, reason: perUnit > 0 ? `$${Math.round(perUnit).toLocaleString()}/unit` : 'No data' });
      }

      let recommendation: 'renovate' | 'redevelop' | 'hold' = 'hold';
      if (score >= 70 && age >= 30 && density < avgDensity * 0.6) {
        recommendation = 'redevelop';
      } else if (score >= 45) {
        recommendation = 'renovate';
      }

      return {
        parcelId: p.parcel_id,
        address: p.address,
        ownerName: p.owner_name,
        units: p.units,
        yearBuilt: p.year_built,
        neighborhoodCode: p.neighborhood_code,
        assessedPerUnit: p.units > 0 ? Math.round(assessed / p.units) : null,
        density: density > 0 ? Math.round(density * 10) / 10 : null,
        neighborhoodAvgDensity: avgDensity > 0 ? Math.round(avgDensity * 10) / 10 : null,
        score,
        factors,
        recommendation,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  async getHiddenGems(): Promise<HiddenGemResult[]> {
    const summary = await this.pool.query(
      `SELECT AVG(occupancy_pct) as avg_occ, AVG(concession_pct) as avg_conc,
              AVG(rent_per_sf) as avg_rent, AVG(common_views_60d) as avg_views
       FROM rent_comps`
    );
    const mkt = summary.rows[0];
    const avgOcc = Number(mkt.avg_occ) || 0;
    const avgConc = Number(mkt.avg_conc) || 0;
    const avgViews = Number(mkt.avg_views) || 0;

    const comps = await this.pool.query(
      `SELECT building_name, address, units, year_built, rent_per_sf, occupancy_pct,
              concession_pct, ad_level, common_views_60d, overlap_pct, neighborhood, stories
       FROM rent_comps ORDER BY occupancy_pct DESC`
    );

    const scored: HiddenGemResult[] = comps.rows.map((c: any) => {
      const factors: HiddenGemFactor[] = [];
      let score = 0;

      const occ = Number(c.occupancy_pct) || 0;
      if (occ >= 97) {
        factors.push({ name: 'High Occupancy', points: 30, maxPoints: 30, reason: `${occ}% occupancy — near full` });
        score += 30;
      } else if (occ >= 95) {
        factors.push({ name: 'High Occupancy', points: 25, maxPoints: 30, reason: `${occ}% occupancy — very strong` });
        score += 25;
      } else if (occ >= 93) {
        factors.push({ name: 'Good Occupancy', points: 15, maxPoints: 30, reason: `${occ}% occupancy — above average` });
        score += 15;
      } else {
        factors.push({ name: 'Occupancy', points: 0, maxPoints: 30, reason: `${occ}% occupancy — below threshold` });
      }

      const adLevel = (c.ad_level || '').toLowerCase();
      if (adLevel === 'basic' || adLevel === 'free' || adLevel === '') {
        factors.push({ name: 'Low Marketing Spend', points: 25, maxPoints: 25, reason: `Ad level: ${c.ad_level || 'None'} — filling without ads` });
        score += 25;
      } else if (adLevel === 'silver' || adLevel === 'bronze') {
        factors.push({ name: 'Moderate Marketing', points: 15, maxPoints: 25, reason: `Ad level: ${c.ad_level}` });
        score += 15;
      } else if (adLevel === 'gold') {
        factors.push({ name: 'Standard Marketing', points: 5, maxPoints: 25, reason: `Ad level: ${c.ad_level}` });
        score += 5;
      } else {
        factors.push({ name: 'Heavy Marketing', points: 0, maxPoints: 25, reason: `Ad level: ${c.ad_level} — high spend` });
      }

      const conc = Number(c.concession_pct) || 0;
      if (conc <= 0.5) {
        factors.push({ name: 'No Concessions Needed', points: 15, maxPoints: 15, reason: `${conc}% concession — doesn't need to discount` });
        score += 15;
      } else if (conc <= avgConc) {
        factors.push({ name: 'Below-Avg Concessions', points: 10, maxPoints: 15, reason: `${conc}% vs ${avgConc.toFixed(1)}% market avg` });
        score += 10;
      } else {
        factors.push({ name: 'Above-Avg Concessions', points: 0, maxPoints: 15, reason: `${conc}% vs ${avgConc.toFixed(1)}% market avg` });
      }

      const views = Number(c.common_views_60d) || 0;
      if (occ >= 95 && views < avgViews * 0.5) {
        factors.push({ name: 'Low Online Traffic + Full', points: 15, maxPoints: 15, reason: `${views} views (avg: ${Math.round(avgViews)}) — organic demand, not online` });
        score += 15;
      } else if (views < avgViews) {
        factors.push({ name: 'Below-Avg Traffic', points: 8, maxPoints: 15, reason: `${views} views vs ${Math.round(avgViews)} avg` });
        score += 8;
      } else {
        factors.push({ name: 'Online Traffic', points: 0, maxPoints: 15, reason: `${views} views — relies on online presence` });
      }

      const overlap = Number(c.overlap_pct) || 0;
      if (overlap >= 50) {
        factors.push({ name: 'Direct Competitor', points: 15, maxPoints: 15, reason: `${overlap}% overlap — directly comparable, learnable` });
        score += 15;
      } else if (overlap >= 20) {
        factors.push({ name: 'Adjacent Competitor', points: 8, maxPoints: 15, reason: `${overlap}% overlap — partially comparable` });
        score += 8;
      } else {
        factors.push({ name: 'Low Overlap', points: 3, maxPoints: 15, reason: `${overlap}% overlap — different market segment` });
        score += 3;
      }

      let insight = '';
      if (score >= 70) {
        insight = `True hidden gem — ${c.building_name} achieves ${occ}% occupancy with minimal marketing (${c.ad_level || 'Basic'}). Study their location advantage, product quality, and word-of-mouth strategy.`;
      } else if (score >= 50) {
        insight = `Strong performer — ${c.building_name} outperforms marketing spend. ${occ >= 95 ? 'High occupancy suggests location or product advantage.' : 'Good fundamentals worth studying.'}`;
      } else {
        insight = `Standard performer — ${c.building_name} relies on marketing for results. Not a hidden gem.`;
      }

      return {
        buildingName: c.building_name,
        address: c.address,
        units: c.units,
        yearBuilt: c.year_built,
        rentPerSf: c.rent_per_sf ? Number(c.rent_per_sf) : null,
        occupancyPct: occ,
        concessionPct: conc,
        adLevel: c.ad_level,
        commonViews60d: views,
        overlapPct: overlap,
        neighborhood: c.neighborhood,
        score,
        factors,
        insight,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  async getCapRateEstimates(): Promise<CapRateEstimate[]> {
    const result = await this.pool.query(
      `SELECT 
        neighborhood_code,
        COUNT(*) as property_count,
        SUM(units) as total_units,
        ROUND(AVG(CASE WHEN units > 0 THEN assessed_value::numeric / units END)) as avg_assessed_per_unit
       FROM property_records
       WHERE neighborhood_code IS NOT NULL AND units > 0 AND assessed_value > 0
       GROUP BY neighborhood_code
       HAVING COUNT(*) >= 3
       ORDER BY SUM(units) DESC`
    );

    const rentSummary = await this.pool.query(
      `SELECT AVG(rent_per_sf) as avg_rent, AVG(avg_sf) as avg_sf, AVG(occupancy_pct) as avg_occ
       FROM rent_comps`
    );
    const rm = rentSummary.rows[0];
    const avgRentPerSf = Number(rm.avg_rent) || 3.80;
    const avgSf = Number(rm.avg_sf) || 850;
    const avgOcc = (Number(rm.avg_occ) || 93) / 100;

    return result.rows.map((r: any) => {
      const avgAssessed = Number(r.avg_assessed_per_unit);
      const estimatedAnnualRent = avgRentPerSf * avgSf * 12 * avgOcc;
      const operatingExpenseRatio = 0.45;
      const estimatedNOI = estimatedAnnualRent * (1 - operatingExpenseRatio);
      const impliedCapRate = avgAssessed > 0 ? (estimatedNOI / avgAssessed) * 100 : 0;

      let tier: 'premium' | 'standard' | 'value' = 'standard';
      if (avgAssessed > 150000) tier = 'premium';
      else if (avgAssessed < 80000) tier = 'value';

      return {
        neighborhoodCode: r.neighborhood_code,
        propertyCount: Number(r.property_count),
        totalUnits: Number(r.total_units),
        avgAssessedPerUnit: avgAssessed,
        impliedCapRate: Math.round(impliedCapRate * 100) / 100,
        estimatedNOIPerUnit: Math.round(estimatedNOI),
        avgRentPerSfProxy: avgRentPerSf,
        tier,
      };
    });
  }

  async getTaxBurdenAnalysis(limit: number = 50): Promise<TaxBurdenResult[]> {
    const medians = await this.pool.query(
      `SELECT neighborhood_code,
              PERCENTILE_CONT(0.5) WITHIN GROUP (
                ORDER BY CASE WHEN appraised_value > 0 THEN assessed_value::numeric / appraised_value END
              ) as median_rate
       FROM property_records
       WHERE neighborhood_code IS NOT NULL AND appraised_value > 0
       GROUP BY neighborhood_code
       HAVING COUNT(*) >= 3`
    );
    const medianMap = new Map<string, number>();
    medians.rows.forEach((r: any) => {
      medianMap.set(r.neighborhood_code, Number(r.median_rate) || 0);
    });

    const props = await this.pool.query(
      `SELECT parcel_id, address, owner_name, units, neighborhood_code,
              assessed_value, appraised_value
       FROM property_records
       WHERE units > 0 AND assessed_value > 0 AND appraised_value > 0`
    );

    const results: TaxBurdenResult[] = props.rows.map((p: any) => {
      const assessed = Number(p.assessed_value);
      const appraised = Number(p.appraised_value);
      const effectiveRate = appraised > 0 ? assessed / appraised : 0;
      const medianRate = medianMap.get(p.neighborhood_code) || 0;
      const deviation = medianRate > 0 ? ((effectiveRate - medianRate) / medianRate) * 100 : 0;

      let flag: 'overtaxed' | 'undertaxed' | 'normal' = 'normal';
      if (deviation > 25) flag = 'overtaxed';
      else if (deviation < -25) flag = 'undertaxed';

      return {
        parcelId: p.parcel_id,
        address: p.address,
        ownerName: p.owner_name,
        units: p.units,
        neighborhoodCode: p.neighborhood_code,
        assessedValue: assessed,
        appraisedValue: appraised,
        effectiveTaxRate: Math.round(effectiveRate * 10000) / 100,
        neighborhoodMedianRate: Math.round(medianRate * 10000) / 100,
        deviationPct: Math.round(deviation * 10) / 10,
        flag,
      };
    });

    results.sort((a, b) => b.deviationPct - a.deviationPct);
    return results.slice(0, limit);
  }

  async getSupplyIntelligence(): Promise<any> {
    const [vintageRes, densityRes, concentrationRes] = await Promise.all([
      this.pool.query(
        `SELECT
          CASE
            WHEN CAST(NULLIF(regexp_replace(year_built, '[^0-9]', '', 'g'), '') AS int) >= 2020 THEN '2020+'
            WHEN CAST(NULLIF(regexp_replace(year_built, '[^0-9]', '', 'g'), '') AS int) >= 2015 THEN '2015-2019'
            WHEN CAST(NULLIF(regexp_replace(year_built, '[^0-9]', '', 'g'), '') AS int) >= 2010 THEN '2010-2014'
            WHEN CAST(NULLIF(regexp_replace(year_built, '[^0-9]', '', 'g'), '') AS int) >= 2000 THEN '2000-2009'
            WHEN CAST(NULLIF(regexp_replace(year_built, '[^0-9]', '', 'g'), '') AS int) >= 1990 THEN '1990-1999'
            ELSE 'Pre-1990'
          END as vintage,
          COUNT(*) as property_count,
          SUM(units) as total_units,
          AVG(units) as avg_units
         FROM property_records
         WHERE year_built IS NOT NULL AND units > 0
           AND regexp_replace(year_built, '[^0-9]', '', 'g') != ''
         GROUP BY vintage
         ORDER BY vintage`
      ),
      this.pool.query(
        `SELECT
          neighborhood_code,
          COUNT(*) as properties,
          SUM(units) as total_units,
          AVG(CASE WHEN land_acres > 0 THEN units::numeric / land_acres END) as avg_density,
          SUM(land_acres) as total_acres
         FROM property_records
         WHERE units > 0 AND neighborhood_code IS NOT NULL
         GROUP BY neighborhood_code
         ORDER BY SUM(units) DESC
         LIMIT 15`
      ),
      this.pool.query(
        `SELECT owner_name, COUNT(*) as properties, SUM(units) as total_units
         FROM property_records
         WHERE units > 0
         GROUP BY owner_name
         ORDER BY SUM(units) DESC
         LIMIT 10`
      ),
    ]);

    const totalUnits = vintageRes.rows.reduce((s: number, r: any) => s + Number(r.total_units || 0), 0);
    const newSupply = vintageRes.rows.filter((r: any) => r.vintage === '2020+' || r.vintage === '2015-2019')
      .reduce((s: number, r: any) => s + Number(r.total_units || 0), 0);

    const safePct = (n: number, d: number) => d > 0 ? Math.round((n / d) * 100) : 0;
    const safeShare = (n: number, d: number) => d > 0 ? Math.round((n / d) * 1000) / 10 : 0;

    return {
      deliveryPipeline: vintageRes.rows.map((r: any) => ({
        vintage: r.vintage,
        properties: Number(r.property_count),
        units: Number(r.total_units || 0),
        avgUnits: Math.round(Number(r.avg_units) || 0),
        pctOfTotal: safePct(Number(r.total_units || 0), totalUnits),
      })),
      submarketSaturation: densityRes.rows.map((r: any) => ({
        neighborhood: r.neighborhood_code,
        properties: Number(r.properties),
        units: Number(r.total_units || 0),
        avgDensity: Number(r.avg_density) ? Math.round(Number(r.avg_density) * 10) / 10 : null,
        totalAcres: Math.round(Number(r.total_acres || 0) * 10) / 10,
      })),
      ownerConcentration: concentrationRes.rows.map((r: any) => ({
        owner: r.owner_name,
        properties: Number(r.properties),
        units: Number(r.total_units || 0),
        marketShare: safeShare(Number(r.total_units || 0), totalUnits),
      })),
      summary: {
        totalProperties: vintageRes.rows.reduce((s: number, r: any) => s + Number(r.property_count || 0), 0),
        totalUnits,
        newSupplyUnits: newSupply,
        newSupplyPct: safePct(newSupply, totalUnits),
        submarketCount: densityRes.rows.length,
      },
    };
  }

  async getDesignInputs(neighborhoodCode?: string): Promise<any> {
    const densityQuery = neighborhoodCode
      ? this.pool.query(
          `SELECT
            AVG(CASE WHEN land_acres > 0 THEN units::numeric / land_acres END) as avg_density,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY CASE WHEN land_acres > 0 THEN units::numeric / land_acres END) as top_quartile_density,
            MAX(CASE WHEN land_acres > 0 THEN units::numeric / land_acres END) as max_density,
            AVG(units) as avg_units, AVG(stories) as avg_stories, AVG(building_sqft::numeric / NULLIF(units, 0)) as avg_sf_per_unit
           FROM property_records WHERE neighborhood_code = $1 AND units > 0`,
          [neighborhoodCode]
        )
      : this.pool.query(
          `SELECT
            AVG(CASE WHEN land_acres > 0 THEN units::numeric / land_acres END) as avg_density,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY CASE WHEN land_acres > 0 THEN units::numeric / land_acres END) as top_quartile_density,
            MAX(CASE WHEN land_acres > 0 THEN units::numeric / land_acres END) as max_density,
            AVG(units) as avg_units, AVG(stories) as avg_stories, AVG(building_sqft::numeric / NULLIF(units, 0)) as avg_sf_per_unit
           FROM property_records WHERE units > 0`
        );

    const unitMixQuery = this.pool.query(
      `SELECT
        AVG(avg_sf) as avg_unit_sf,
        AVG(studio_rent) as avg_studio_rent, AVG(one_bed_rent) as avg_1br_rent,
        AVG(two_bed_rent) as avg_2br_rent, AVG(three_bed_rent) as avg_3br_rent,
        SUM(studio_count) as total_studios, SUM(one_bed_count) as total_1br,
        SUM(two_bed_count) as total_2br, SUM(three_bed_count) as total_3br,
        AVG(CASE WHEN stories >= 20 THEN rent_per_sf END) as highrise_rent,
        AVG(CASE WHEN stories < 10 THEN rent_per_sf END) as midrise_rent
       FROM rent_comps`
    );

    const assemblageQuery = neighborhoodCode
      ? this.pool.query(
          `SELECT parcel_id, address, owner_name, units, land_acres, year_built,
                  CASE WHEN land_acres > 0 THEN units::numeric / land_acres END as density
           FROM property_records
           WHERE neighborhood_code = $1 AND units > 0 AND land_acres > 2
           ORDER BY CASE WHEN land_acres > 0 THEN units::numeric / land_acres END ASC
           LIMIT 10`,
          [neighborhoodCode]
        )
      : this.pool.query(
          `SELECT parcel_id, address, owner_name, units, land_acres, year_built,
                  CASE WHEN land_acres > 0 THEN units::numeric / land_acres END as density
           FROM property_records
           WHERE units > 0 AND land_acres > 5
           ORDER BY CASE WHEN land_acres > 0 THEN units::numeric / land_acres END ASC
           LIMIT 10`
        );

    const [densityRes, mixRes, assembRes] = await Promise.all([densityQuery, unitMixQuery, assemblageQuery]);

    const d = densityRes.rows[0] || {};
    const m = mixRes.rows[0] || {};
    const totalUnitsByType = Number(m.total_studios || 0) + Number(m.total_1br || 0) + Number(m.total_2br || 0) + Number(m.total_3br || 0);

    return {
      benchmarks: {
        avgDensity: Number(d.avg_density) || 0,
        topQuartileDensity: Number(d.top_quartile_density) || 0,
        maxDensity: Number(d.max_density) || 0,
        avgStories: Math.round(Number(d.avg_stories) || 0),
        avgSfPerUnit: Math.round(Number(d.avg_sf_per_unit) || 0),
      },
      optimalUnitMix: {
        studio: totalUnitsByType > 0 ? Math.round((Number(m.total_studios || 0) / totalUnitsByType) * 100) : 10,
        oneBed: totalUnitsByType > 0 ? Math.round((Number(m.total_1br || 0) / totalUnitsByType) * 100) : 60,
        twoBed: totalUnitsByType > 0 ? Math.round((Number(m.total_2br || 0) / totalUnitsByType) * 100) : 25,
        threeBed: totalUnitsByType > 0 ? Math.round((Number(m.total_3br || 0) / totalUnitsByType) * 100) : 5,
      },
      rentByUnitType: {
        studio: Number(m.avg_studio_rent) || null,
        oneBed: Number(m.avg_1br_rent) || null,
        twoBed: Number(m.avg_2br_rent) || null,
        threeBed: Number(m.avg_3br_rent) || null,
      },
      rentPremiums: {
        highriseRentPerSf: Number(m.highrise_rent) || null,
        midriseRentPerSf: Number(m.midrise_rent) || null,
        premium: (Number(m.highrise_rent) || 0) - (Number(m.midrise_rent) || 0),
      },
      avgUnitSf: Math.round(Number(m.avg_unit_sf) || 850),
      assemblageOpportunities: assembRes.rows.map((r: any) => ({
        parcelId: r.parcel_id,
        address: r.address,
        ownerName: r.owner_name,
        units: r.units,
        acres: Number(r.land_acres),
        density: Number(r.density) || 0,
        yearBuilt: r.year_built,
      })),
    };
  }
}
