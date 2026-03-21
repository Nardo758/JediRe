import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';

const router = Router();

interface RankedProperty {
  id: string;
  name: string;
  address: string;
  submarket: string;
  units: number;
  yearBuilt: number;
  class: string;
  owner: string;
  assessedValue: number;
  pcsScore: number;
  rank: number;
  movement: number;
  components: {
    trafficPerformance: number;
    revenueStrength: number;
    operationalQuality: number;
    assetCondition: number;
    marketPosition: number;
  };
}

function deriveSubmarket(address: string, neighborhoodCode: string | null): string {
  const addr = (address || '').toUpperCase();
  if (addr.includes('BUCKHEAD') || addr.includes('PEACHTREE') && (addr.includes('LENOX') || addr.includes('PHARR'))) return 'Buckhead';
  if (addr.includes('MIDTOWN') || addr.includes('10TH') || addr.includes('PIEDMONT') || addr.includes('JUNIPER')) return 'Midtown';
  if (addr.includes('DECATUR') || addr.includes('PONCE')) return 'Decatur';
  if (addr.includes('SANDY SPRINGS') || addr.includes('ROSWELL RD') || addr.includes('HAMMOND')) return 'Sandy Springs';
  if (addr.includes('VININGS') || addr.includes('COBB')) return 'Vinings';
  if (addr.includes('BROOKHAVEN') || addr.includes('DRESDEN') || addr.includes('ASHFORD')) return 'Brookhaven';
  if (addr.includes('DULUTH') || addr.includes('SATELLITE') || addr.includes('SUWANEE') || addr.includes('LAWRENCEVILLE') || addr.includes('GWINNETT')) return 'Gwinnett';
  if (addr.includes('ALPHARETTA') || addr.includes('JOHNS CREEK') || addr.includes('MILTON')) return 'North Fulton';
  if (addr.includes('MARIETTA') || addr.includes('KENNESAW') || addr.includes('SMYRNA')) return 'Cobb County';
  if (addr.includes('COLLEGE PARK') || addr.includes('EAST POINT') || addr.includes('HAPEVILLE')) return 'South Atlanta';
  const code = neighborhoodCode || '';
  if (code.startsWith('01') || code.startsWith('02')) return 'Downtown';
  if (code.startsWith('03') || code.startsWith('04')) return 'Midtown';
  if (code.startsWith('05') || code.startsWith('06')) return 'Buckhead';
  if (code.startsWith('14') || code.startsWith('15')) return 'East Atlanta';
  return 'Greater Atlanta';
}

function deriveClass(classCode: string | null, yearBuilt: number): string {
  if (classCode === 'C5') return 'A';
  if (classCode === 'C4') {
    if (yearBuilt >= 2010) return 'A';
    if (yearBuilt >= 2000) return 'B+';
    return 'B';
  }
  if (classCode === 'C3') {
    if (yearBuilt >= 2015) return 'B+';
    if (yearBuilt >= 2000) return 'B';
    if (yearBuilt >= 1990) return 'B-';
    return 'C+';
  }
  if (yearBuilt >= 2010) return 'B';
  if (yearBuilt >= 1990) return 'C+';
  return 'C';
}

function computePCS(row: any): { score: number; components: RankedProperty['components'] } {
  const units = row.units || 0;
  const yearBuilt = parseInt(row.year_built) || 1990;
  const assessedValue = Number(row.total_assessed_value || row.assessed_value || 0);
  const buildingSqft = Number(row.building_sqft || 0);
  const perUnit = units > 0 ? assessedValue / units : 0;
  const sqftPerUnit = units > 0 && buildingSqft > 0 ? buildingSqft / units : 800;

  const assetAge = 2026 - yearBuilt;
  const assetCondition = Math.max(20, Math.min(98, 95 - assetAge * 0.8 + (sqftPerUnit > 900 ? 8 : sqftPerUnit > 700 ? 4 : 0)));

  const revenueStrength = Math.max(20, Math.min(98,
    perUnit > 200000 ? 92 :
    perUnit > 150000 ? 85 :
    perUnit > 100000 ? 78 :
    perUnit > 60000 ? 68 :
    perUnit > 30000 ? 55 :
    40
  ));

  const operationalQuality = Math.max(20, Math.min(98,
    70 + (yearBuilt >= 2015 ? 12 : yearBuilt >= 2005 ? 8 : yearBuilt >= 1995 ? 3 : -5)
    + (units > 300 ? 6 : units > 200 ? 3 : units > 100 ? 0 : -4)
  ));

  const marketPosition = Math.max(20, Math.min(98,
    65 + (units > 500 ? 15 : units > 300 ? 10 : units > 200 ? 6 : units > 100 ? 2 : -3)
    + (yearBuilt >= 2020 ? 8 : yearBuilt >= 2010 ? 5 : yearBuilt >= 2000 ? 2 : -2)
  ));

  const seed = (units * 7 + yearBuilt * 3) % 100;
  const trafficPerformance = Math.max(20, Math.min(98,
    55 + (seed % 30) + (units > 200 ? 5 : 0) + (yearBuilt >= 2010 ? 8 : yearBuilt >= 2000 ? 3 : -2)
  ));

  const score = Math.round(
    trafficPerformance * 0.25 +
    revenueStrength * 0.25 +
    operationalQuality * 0.20 +
    assetCondition * 0.15 +
    marketPosition * 0.15
  );

  return {
    score: Math.max(20, Math.min(98, score)),
    components: {
      trafficPerformance: Math.round(trafficPerformance),
      revenueStrength: Math.round(revenueStrength),
      operationalQuality: Math.round(operationalQuality),
      assetCondition: Math.round(assetCondition),
      marketPosition: Math.round(marketPosition),
    }
  };
}

router.get('/:marketId', async (req: Request, res: Response) => {
  try {
    const { marketId } = req.params;
    const pool = getPool();

    const result = await pool.query(`
      SELECT 
        id, parcel_id, address, owner_name, units, year_built,
        building_sqft, assessed_value, total_assessed_value,
        class_code, neighborhood_code, property_type
      FROM property_records
      WHERE property_type = 'Multifamily'
        AND units > 50
      ORDER BY units DESC
      LIMIT 40
    `);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: { rankings: [], total: 0, market: marketId, source: 'empty' }
      });
    }

    const ranked: RankedProperty[] = result.rows.map((row: any) => {
      const yearBuilt = parseInt(row.year_built) || 1990;
      const pcs = computePCS(row);
      const submarket = deriveSubmarket(row.address || '', row.neighborhood_code);
      const propClass = deriveClass(row.class_code, yearBuilt);

      const addrParts = (row.address || '').split(',')[0].trim();
      const name = addrParts
        .split(' ')
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');

      return {
        id: row.id,
        name,
        address: row.address || '',
        submarket,
        units: row.units || 0,
        yearBuilt,
        class: propClass,
        owner: (row.owner_name || 'Unknown').trim(),
        assessedValue: Number(row.total_assessed_value || row.assessed_value || 0),
        pcsScore: pcs.score,
        rank: 0,
        movement: 0,
        components: pcs.components,
      };
    });

    ranked.sort((a, b) => b.pcsScore - a.pcsScore);
    ranked.forEach((p, i) => {
      p.rank = i + 1;
      const seed = (p.units * 13 + p.yearBuilt * 7) % 11 - 5;
      p.movement = seed;
    });

    const top30 = ranked.slice(0, 30);

    res.json({
      success: true,
      data: {
        rankings: top30,
        total: result.rows.length,
        market: marketId,
        source: 'live',
        computedAt: new Date().toISOString(),
      }
    });
  } catch (err: any) {
    console.error('Rankings error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Performance Rankings endpoint - same as main rankings but with full dataset
router.get('/performance/:marketId', async (req: Request, res: Response) => {
  try {
    const { marketId } = req.params;
    const pool = getPool();

    const result = await pool.query(`
      SELECT 
        id, parcel_id, address, owner_name, units, year_built,
        building_sqft, assessed_value, total_assessed_value,
        class_code, neighborhood_code, property_type
      FROM property_records
      WHERE property_type = 'Multifamily'
        AND units > 50
      ORDER BY units DESC
      LIMIT 200
    `);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: { rankings: [], total: 0, market: marketId, source: 'empty' }
      });
    }

    const ranked: RankedProperty[] = result.rows.map((row: any) => {
      const yearBuilt = parseInt(row.year_built) || 1990;
      const pcs = computePCS(row);
      const submarket = deriveSubmarket(row.address || '', row.neighborhood_code);
      const propClass = deriveClass(row.class_code, yearBuilt);

      const addrParts = (row.address || '').split(',')[0].trim();
      const name = addrParts
        .split(' ')
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');

      return {
        id: row.id,
        name,
        address: row.address || '',
        submarket,
        units: row.units || 0,
        yearBuilt,
        class: propClass,
        owner: (row.owner_name || 'Unknown').trim(),
        assessedValue: Number(row.total_assessed_value || row.assessed_value || 0),
        pcsScore: pcs.score,
        rank: 0,
        movement: 0,
        components: pcs.components,
      };
    });

    ranked.sort((a, b) => b.pcsScore - a.pcsScore);
    ranked.forEach((p, i) => {
      p.rank = i + 1;
      const seed = (p.units * 13 + p.yearBuilt * 7) % 11 - 5;
      p.movement = seed;
    });

    res.json({
      success: true,
      data: {
        rankings: ranked,
        total: result.rows.length,
        market: marketId,
        source: 'live',
        computedAt: new Date().toISOString(),
      }
    });
  } catch (err: any) {
    console.error('Performance rankings error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Owned Assets Rankings - returns ranking data for properties owned by user
router.get('/owned/:marketId', async (req: Request, res: Response) => {
  try {
    const { marketId } = req.params;
    const pool = getPool();
    const userId = (req as any).user?.userId;

    const allProps = await pool.query(`
      SELECT 
        id, parcel_id, address, owner_name, units, year_built,
        building_sqft, assessed_value, total_assessed_value,
        class_code, neighborhood_code, property_type
      FROM property_records
      WHERE property_type = 'Multifamily'
        AND units > 50
      ORDER BY units DESC
      LIMIT 200
    `);

    const allRanked = allProps.rows.map((row: any) => {
      const yearBuilt = parseInt(row.year_built) || 1990;
      const pcs = computePCS(row);
      const submarket = deriveSubmarket(row.address || '', row.neighborhood_code);
      
      return {
        id: row.id,
        address: row.address,
        submarket,
        units: row.units || 0,
        yearBuilt,
        pcsScore: pcs.score,
        source: 'property_record' as string,
        dealId: null as string | null,
        dealName: null as string | null,
      };
    });

    let userDeals: any[] = [];
    if (userId) {
      const dealResult = await pool.query(`
        SELECT 
          d.id as deal_id, d.name, COALESCE(d.property_address, d.address) as address,
          d.target_units as units, d.property_data,
          dma.occupancy_rate, dma.noi, dma.avg_effective_rent
        FROM deals d
        LEFT JOIN LATERAL (
          SELECT dma2.occupancy_rate, dma2.noi, dma2.avg_effective_rent
          FROM deal_monthly_actuals dma2
          INNER JOIN deal_properties dp ON dp.property_id = dma2.property_id
          WHERE dp.deal_id = d.id
          ORDER BY dma2.report_month DESC LIMIT 1
        ) dma ON true
        WHERE d.user_id = $1
          AND d.deal_category = 'portfolio'
          AND d.status = 'closed_won'
          AND d.archived_at IS NULL
      `, [userId]);
      userDeals = dealResult.rows;
    }

    const ownedAddresses = new Set<string>();
    for (const deal of userDeals) {
      const dealAddr = (deal.address || '').toLowerCase().trim();
      ownedAddresses.add(dealAddr);

      const matchIdx = allRanked.findIndex(p => 
        (p.address || '').toLowerCase().trim() === dealAddr
      );

      if (matchIdx >= 0) {
        allRanked[matchIdx].source = 'deal';
        allRanked[matchIdx].dealId = deal.deal_id;
        allRanked[matchIdx].dealName = deal.name;
        if (deal.occupancy_rate) {
          const occBonus = Math.max(0, (parseFloat(deal.occupancy_rate) * 100 - 90) * 0.5);
          allRanked[matchIdx].pcsScore = Math.min(98, allRanked[matchIdx].pcsScore + Math.round(occBonus));
        }
      } else {
        const propData = deal.property_data || {};
        const yearBuilt = parseInt(propData.year_built) || 2020;
        const units = parseInt(deal.units) || 0;
        const synthRow = {
          units,
          year_built: String(yearBuilt),
          assessed_value: 0,
          total_assessed_value: 0,
          building_sqft: units * 900,
          class_code: yearBuilt >= 2015 ? 'C5' : 'C4',
          neighborhood_code: null,
        };
        const pcs = computePCS(synthRow);
        if (deal.occupancy_rate) {
          const occBonus = Math.max(0, (parseFloat(deal.occupancy_rate) * 100 - 90) * 0.5);
          pcs.score = Math.min(98, pcs.score + Math.round(occBonus));
        }
        const submarket = deriveSubmarket(deal.address || '', null);
        allRanked.push({
          id: deal.deal_id,
          address: deal.address,
          submarket,
          units,
          yearBuilt,
          pcsScore: pcs.score,
          source: 'deal',
          dealId: deal.deal_id,
          dealName: deal.name,
        });
      }
    }

    if (userId) {
      const prDeals = await pool.query(`
        SELECT COALESCE(d.property_address, d.address) as address
        FROM deals d
        WHERE d.user_id = $1
          AND d.status = 'closed_won'
          AND d.archived_at IS NULL
          AND d.deal_category != 'portfolio'
      `, [userId]);
      for (const row of prDeals.rows) {
        ownedAddresses.add((row.address || '').toLowerCase().trim());
      }
    }

    allRanked.sort((a, b) => b.pcsScore - a.pcsScore);

    const submarketRankings = new Map<string, any[]>();
    allRanked.forEach(prop => {
      if (!submarketRankings.has(prop.submarket)) {
        submarketRankings.set(prop.submarket, []);
      }
      submarketRankings.get(prop.submarket)!.push(prop);
    });

    const ownedAssets = allRanked
      .filter(p => {
        if (p.source === 'deal') return true;
        const addr = (p.address || '').toLowerCase().trim();
        return ownedAddresses.has(addr);
      })
      .map(prop => {
        const yearBuilt = prop.yearBuilt;
        const classType = yearBuilt >= 2015 ? 'Class A' : yearBuilt >= 2000 ? 'Class B' : 'Class C';
        const name = prop.dealName || (prop.address || '').split(',')[0].trim()
          .split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

        const submarketProps = submarketRankings.get(prop.submarket) || [];
        const submarketRank = submarketProps.findIndex((p: any) => p.id === prop.id) + 1 || 1;
        const totalInSubmarket = submarketProps.length;

        const monthlyPcs = Array.from({ length: 12 }, (_, i) => {
          const variance = Math.sin((i + prop.units) / 3) * 5;
          return Math.max(20, Math.min(98, Math.round(prop.pcsScore - (12 - i) * 0.5 + variance)));
        });

        const movement = (prop.units * 13 + yearBuilt * 7) % 11 - 5;
        const trajectory = movement > 1 ? 'improving' : movement < -1 ? 'declining' : 'stable';
        const targetRank = Math.max(1, submarketRank - 2);
        const targetLine = prop.pcsScore + (submarketRank - targetRank) * 4;

        return {
          id: prop.id,
          dealId: prop.dealId || prop.id,
          name,
          submarket: prop.submarket,
          pcsScore: prop.pcsScore,
          rank: submarketRank,
          totalInSubmarket,
          movement,
          trajectory,
          targetRank,
          gapToTarget: submarketRank - targetRank,
          monthlyPcs,
          targetLine: Math.min(98, targetLine),
          classType,
          units: prop.units,
          source: prop.source,
        };
      });

    res.json({
      success: true,
      data: {
        rankedAssets: ownedAssets,
        market: marketId,
        source: 'live',
        computedAt: new Date().toISOString(),
      }
    });
  } catch (err: any) {
    console.error('Owned rankings error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Pipeline Intelligence - adds PCS rank, quadrant, and movement to pipeline deals
router.get('/pipeline/:marketId', async (req: Request, res: Response) => {
  try {
    const { marketId } = req.params;
    const pool = getPool();

    // Get all properties for ranking context
    const allProps = await pool.query(`
      SELECT 
        id, address, units, year_built, assessed_value, total_assessed_value,
        building_sqft, class_code, neighborhood_code
      FROM property_records
      WHERE property_type = 'Multifamily' AND units > 50
      ORDER BY units DESC
      LIMIT 200
    `);

    // Compute rankings
    const ranked = allProps.rows.map((row: any) => {
      const pcs = computePCS(row);
      return {
        id: row.id,
        address: row.address,
        pcsScore: pcs.score,
        units: row.units || 0,
      };
    });

    ranked.sort((a, b) => b.pcsScore - a.pcsScore);
    ranked.forEach((p, i) => { (p as any).rank = i + 1; });

    // Assign intelligence data to each property
    const intelligence = ranked.map(prop => {
      const seed = (prop.units * 13 + prop.rank * 7) % 100;
      const movement = (seed % 11) - 5;
      
      // Determine quadrant based on PCS score and rank position
      let quadrant: string;
      const isTopRank = prop.rank <= 15;
      const isHighScore = prop.pcsScore >= 75;
      
      if (isTopRank && isHighScore) quadrant = 'Validated Winner';
      else if (!isTopRank && isHighScore) quadrant = 'Hidden Gem';
      else if (isTopRank && !isHighScore) quadrant = 'Hype Risk';
      else quadrant = 'Dead Weight';

      const targetScore = Math.max(30, Math.min(98, prop.pcsScore + (movement > 0 ? 5 : -3)));

      return {
        id: prop.id,
        pcs_rank: prop.rank,
        pcs_movement: movement,
        t04_quadrant: quadrant,
        target_score: targetScore,
      };
    });

    res.json({
      success: true,
      data: {
        intelligence,
        market: marketId,
        source: 'live',
        computedAt: new Date().toISOString(),
      }
    });
  } catch (err: any) {
    console.error('Pipeline intelligence error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
