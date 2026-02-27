import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { ParcelIngestionService } from '../../services/parcel-ingestion.service';
import { ZoningTriangulationService } from '../../services/zoning-triangulation.service';
import { ConfirmationChainService } from '../../services/confirmation-chain.service';
import { ZoningRecommendationOrchestrator } from '../../services/zoning-recommendation-orchestrator.service';

const router = Router();
const pool = getPool();
const parcelService = new ParcelIngestionService(pool);
const triangulationService = new ZoningTriangulationService(pool);
const chainService = new ConfirmationChainService(pool);
const recommendationOrchestrator = new ZoningRecommendationOrchestrator(pool);

router.post('/parcels/ingest/geojson', async (req: Request, res: Response) => {
  try {
    const { geojson, county, state, mappingKey, sourceUrl } = req.body;

    if (!geojson || !county || !state) {
      return res.status(400).json({ error: 'geojson, county, and state are required' });
    }

    const result = await parcelService.ingestGeoJSON(
      geojson, county, state, mappingKey, sourceUrl
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Parcel ingestion error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/parcels/ingest/batch', async (req: Request, res: Response) => {
  try {
    const { records, batchId } = req.body;

    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ error: 'records array is required' });
    }

    const result = await parcelService.ingestBatch(records, batchId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Batch ingestion error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/parcels/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await parcelService.getIngestionStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/parcels/nearby', async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radius = parseFloat(req.query.radius as string) || 50;

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'lat and lng query params required' });
    }

    const parcels = await parcelService.findNearby(lat, lng, radius);
    res.json({ success: true, data: parcels });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/parcels/:parcelId', async (req: Request, res: Response) => {
  try {
    const { parcelId } = req.params;
    const county = req.query.county as string;
    const state = req.query.state as string;

    if (!county || !state) {
      return res.status(400).json({ error: 'county and state query params required' });
    }

    const parcel = await parcelService.getParcel(parcelId, county, state);
    if (!parcel) {
      return res.status(404).json({ error: 'Parcel not found' });
    }

    res.json({ success: true, data: parcel });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/zoning/triangulate', async (req: Request, res: Response) => {
  try {
    const { dealId, parcelId, lat, lng, municipality, state, userProvidedZoningCode } = req.body;

    if (!municipality || !state) {
      return res.status(400).json({ error: 'municipality and state are required' });
    }

    const result = await triangulationService.triangulate({
      dealId,
      parcelId,
      lat,
      lng,
      municipality,
      state,
      userProvidedZoningCode,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Triangulation error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/zoning/triangulation/:dealId', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const result = await triangulationService.getForDeal(dealId);

    if (!result) {
      return res.status(404).json({ error: 'No triangulation found for this deal' });
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/zoning/triangulation/:id/confirm', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { overrides } = req.body;

    await triangulationService.userConfirm(id, overrides);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/zoning/outcome', async (req: Request, res: Response) => {
  try {
    const {
      triangulationId, dealId,
      actualZoningCode, actualEntitlementPath, actualTimelineMonths,
      actualApprovedUnits, actualApprovedFar, actualOutcome,
      reportedBy, notes,
    } = req.body;

    if (!triangulationId || !actualOutcome || !reportedBy) {
      return res.status(400).json({
        error: 'triangulationId, actualOutcome, and reportedBy are required',
      });
    }

    const outcomeId = await triangulationService.recordOutcome({
      triangulationId,
      dealId,
      actualZoningCode,
      actualEntitlementPath,
      actualTimelineMonths,
      actualApprovedUnits,
      actualApprovedFar,
      actualOutcome,
      reportedBy,
      notes,
    });

    res.json({ success: true, data: { outcomeId } });
  } catch (error: any) {
    console.error('Outcome recording error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/zoning/calibrate/:municipality', async (req: Request, res: Response) => {
  try {
    const { municipality } = req.params;
    const { state } = req.body;

    if (!state) {
      return res.status(400).json({ error: 'state is required in body' });
    }

    await triangulationService.recalibrate(municipality, state);
    
    const result = await pool.query(
      'SELECT * FROM jurisdiction_calibration WHERE LOWER(municipality) = LOWER($1) AND state = $2',
      [municipality, state.toUpperCase()]
    );

    res.json({ success: true, data: result.rows[0] || null });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/zoning/calibration', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM jurisdiction_calibration ORDER BY total_outcomes DESC, municipality`
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/zoning/chain/execute', async (req: Request, res: Response) => {
  try {
    const {
      dealId, parcelId, lat, lng, municipality, state,
      userProvidedZoningCode, propertyType, targetUses,
      marketData, demandScore, supplyPressureScore, momentumScore,
    } = req.body;

    if (!dealId || !municipality || !state) {
      return res.status(400).json({ error: 'dealId, municipality, and state are required' });
    }

    const result = await chainService.execute({
      dealId,
      parcelId,
      lat,
      lng,
      municipality,
      state,
      userProvidedZoningCode,
      propertyType,
      targetUses,
      marketData,
      demandScore,
      supplyPressureScore,
      momentumScore,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Chain execution error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/zoning/chain/:dealId', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const result = await chainService.getForDeal(dealId);

    if (!result) {
      return res.status(404).json({ error: 'No chain result found for this deal' });
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/zoning/recommendations/:dealId/analyze', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const result = await recommendationOrchestrator.analyzeAndRecommend(dealId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Recommendation analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/zoning/recommendations/:dealId', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const fresh = req.query.fresh === 'true';

    const result = fresh
      ? await recommendationOrchestrator.analyzeAndRecommend(dealId)
      : await recommendationOrchestrator.getOrAnalyze(dealId);

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Recommendation fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/deals/:dealId/nearby-entitlements', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;

    const dealResult = await pool.query(
      `SELECT d.address, dzc.zoning_code, dzc.municipality, dzc.state
       FROM deals d
       LEFT JOIN deal_zoning_confirmations dzc ON dzc.deal_id = d.id
       WHERE d.id = $1`,
      [dealId]
    );
    const deal = dealResult.rows[0];
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    let municipality = deal.municipality || '';
    let state = deal.state || '';
    if (!municipality && deal.address) {
      const cityPatterns = [
        /,\s*([A-Za-z\s]+),\s*(?:GA|Georgia)/i,
        /,\s*([A-Za-z\s]+),\s*(?:FL|Florida)/i,
        /,\s*([A-Za-z\s]+),\s*[A-Z]{2}\s+\d{5}/,
      ];
      for (const pat of cityPatterns) {
        const m = deal.address.match(pat);
        if (m) { municipality = m[1].trim(); break; }
      }
      const stateMatch = deal.address.match(/,\s*([A-Z]{2})\s+\d{5}/) || deal.address.match(/,\s*(Georgia|Florida|GA|FL)/i);
      if (stateMatch) {
        const s = stateMatch[1].toUpperCase();
        state = s === 'GEORGIA' ? 'GA' : s === 'FLORIDA' ? 'FL' : s;
      }
    }

    if (!municipality) {
      return res.json({ success: true, data: { scope: 'municipality', scopeName: 'Unknown', totalRecords: 0, summary: {}, insights: [], commonTransitions: [], projects: [] } });
    }

    let muniResult = await pool.query(
      `SELECT address, project_name, entitlement_type, zoning_from, zoning_to,
              unit_count, stories, outcome, total_entitlement_days, docket_number,
              ordinance_url, municipality, county
       FROM benchmark_projects
       WHERE UPPER(municipality) = UPPER($1)
         AND ($2 = '' OR UPPER(COALESCE(state, '')) = UPPER($2))
       ORDER BY application_date DESC NULLS LAST, created_at DESC
       LIMIT 50`,
      [municipality, state]
    );

    let scope: 'municipality' | 'county' = 'municipality';
    let scopeName = municipality;
    let projects = muniResult.rows;

    if (projects.length < 5) {
      const countyLookup = await pool.query(
        `SELECT DISTINCT county FROM benchmark_projects
         WHERE UPPER(municipality) = UPPER($1) AND county IS NOT NULL
         LIMIT 1`,
        [municipality]
      );
      let county = countyLookup.rows[0]?.county;

      if (!county) {
        const nearbyCounty = await pool.query(
          `SELECT DISTINCT county FROM benchmark_projects
           WHERE UPPER(state) = UPPER($1) AND county IS NOT NULL
           ORDER BY county LIMIT 1`,
          [state]
        );
        county = nearbyCounty.rows[0]?.county;
      }

      if (county) {
        const countyResult = await pool.query(
          `SELECT address, project_name, entitlement_type, zoning_from, zoning_to,
                  unit_count, stories, outcome, total_entitlement_days, docket_number,
                  ordinance_url, municipality, county
           FROM benchmark_projects
           WHERE UPPER(county) = UPPER($1)
             AND ($2 = '' OR UPPER(COALESCE(state, '')) = UPPER($2))
           ORDER BY application_date DESC NULLS LAST, created_at DESC
           LIMIT 50`,
          [county, state]
        );
        if (countyResult.rows.length > projects.length) {
          projects = countyResult.rows;
          scope = 'county';
          scopeName = county;
        }
      }
    }

    const totalRecords = projects.length;

    const summary: Record<string, { count: number; approved: number; approvalRate: number; totalDays: number; daysCount: number; avgDays: number | null; totalUnits: number; unitsCount: number; avgUnits: number | null }> = {};
    for (const p of projects) {
      const t = p.entitlement_type || 'unknown';
      if (!summary[t]) summary[t] = { count: 0, approved: 0, approvalRate: 0, totalDays: 0, daysCount: 0, avgDays: null, totalUnits: 0, unitsCount: 0, avgUnits: null };
      summary[t].count++;
      if (p.outcome === 'approved' || p.outcome === 'modified') summary[t].approved++;
      if (p.total_entitlement_days && p.total_entitlement_days > 0) {
        summary[t].totalDays += p.total_entitlement_days;
        summary[t].daysCount++;
      }
      if (p.unit_count && p.unit_count > 0) {
        summary[t].totalUnits += p.unit_count;
        summary[t].unitsCount++;
      }
    }
    const summaryClean: Record<string, { count: number; approvalRate: number; avgDays: number | null; avgUnits: number | null }> = {};
    for (const [type, s] of Object.entries(summary)) {
      summaryClean[type] = {
        count: s.count,
        approvalRate: s.count > 0 ? Math.round((s.approved / s.count) * 100) : 0,
        avgDays: s.daysCount > 0 ? Math.round(s.totalDays / s.daysCount) : null,
        avgUnits: s.unitsCount > 0 ? Math.round(s.totalUnits / s.unitsCount) : null,
      };
    }

    const rezoneProjects = projects.filter(p => p.entitlement_type === 'rezone' && p.zoning_from && p.zoning_to);
    const transitionMap = new Map<string, { count: number; approved: number; totalDays: number; daysCount: number; addresses: string[]; ordinanceUrls: string[] }>();
    for (const p of rezoneProjects) {
      const key = `${p.zoning_from}→${p.zoning_to}`;
      if (!transitionMap.has(key)) transitionMap.set(key, { count: 0, approved: 0, totalDays: 0, daysCount: 0, addresses: [], ordinanceUrls: [] });
      const t = transitionMap.get(key)!;
      t.count++;
      if (p.outcome === 'approved' || p.outcome === 'modified') t.approved++;
      if (p.total_entitlement_days > 0) { t.totalDays += p.total_entitlement_days; t.daysCount++; }
      if (p.address) t.addresses.push(p.address);
      if (p.ordinance_url) t.ordinanceUrls.push(p.ordinance_url);
    }
    const commonTransitions = Array.from(transitionMap.entries())
      .map(([key, v]) => {
        const [fromCode, toCode] = key.split('→');
        return {
          fromCode, toCode,
          count: v.count,
          approvalRate: v.count > 0 ? Math.round((v.approved / v.count) * 100) : 0,
          avgDays: v.daysCount > 0 ? Math.round(v.totalDays / v.daysCount) : null,
          exampleAddress: v.addresses[0] || null,
          exampleOrdinanceUrl: v.ordinanceUrls[0] || null,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const insights: { type: 'trend' | 'opportunity' | 'caution'; text: string }[] = [];

    if (totalRecords === 0) {
      // no insights
    } else if (totalRecords < 5) {
      insights.push({ type: 'caution', text: `Limited data: Only ${totalRecords} entitlement record${totalRecords !== 1 ? 's' : ''} found in ${scopeName}. Patterns may not be statistically significant.` });
    } else {
      const types = Object.entries(summaryClean).sort((a, b) => b[1].count - a[1].count);
      const totalApproved = projects.filter(p => p.outcome === 'approved' || p.outcome === 'modified').length;
      const totalDenied = projects.filter(p => p.outcome === 'denied').length;
      const overallRate = totalRecords > 0 ? Math.round((totalApproved / totalRecords) * 100) : 0;

      if (totalDenied === 0 && totalRecords >= 5) {
        insights.push({ type: 'opportunity', text: `Zero denials in the dataset — ${overallRate}% of ${totalRecords} entitlements approved. This corridor is very developer-friendly.` });
      } else if (overallRate >= 80) {
        insights.push({ type: 'opportunity', text: `Strong approval environment: ${overallRate}% of ${totalRecords} entitlements approved (${totalDenied} denied).` });
      }

      const cupStats = summaryClean['cup'];
      if (cupStats && cupStats.count >= 3) {
        const cupProjects = projects.filter(p => p.entitlement_type === 'cup');
        const corridorAddresses = cupProjects.filter(p => p.address).map(p => p.address).slice(0, 3);
        insights.push({
          type: 'opportunity',
          text: `CUP is the proven corridor play — ${cupStats.count} approvals, ${cupStats.approvalRate}% success rate, ${cupStats.avgDays ? Math.round(cupStats.avgDays / 30) + '-month' : ''} avg timeline. Recent: ${corridorAddresses.join(', ')}.`,
        });
      }

      if (commonTransitions.length > 0) {
        const top = commonTransitions[0];
        const topToProjects = rezoneProjects.filter(p => p.zoning_to === top.toCode);
        const topUnits = topToProjects.filter(p => p.unit_count > 0).map(p => p.unit_count);
        const avgUnitsStr = topUnits.length > 0 ? ` averaging ${Math.round(topUnits.reduce((a, b) => a + b, 0) / topUnits.length)} units` : '';
        insights.push({
          type: 'trend',
          text: `Most common rezone target is ${top.toCode} — ${top.count} project${top.count !== 1 ? 's' : ''} (${top.approvalRate}% approved)${top.avgDays ? `, ${Math.round(top.avgDays / 30)}-month avg timeline` : ''}${avgUnitsStr}. Example: ${top.exampleAddress || 'N/A'}.`,
        });
      }

      const industrialRezones = rezoneProjects.filter(p => /^I-/.test(p.zoning_from));
      if (industrialRezones.length >= 2) {
        const avgDays = industrialRezones.filter(p => p.total_entitlement_days > 0);
        const avg = avgDays.length > 0 ? Math.round(avgDays.reduce((s, p) => s + p.total_entitlement_days, 0) / avgDays.length) : null;
        insights.push({
          type: 'opportunity',
          text: `Industrial conversions get fast-tracked — ${industrialRezones.length} I-class rezones${avg ? ` averaging ${avg} days (${Math.round(avg / 30)} months)` : ''}. The city encourages converting industrial land to mixed-use.`,
        });
      }

      const typesWithDays = types.filter(([, s]) => s.avgDays != null && s.count >= 2);
      if (typesWithDays.length >= 2) {
        const fastest = typesWithDays.reduce((a, b) => (a[1].avgDays! < b[1].avgDays! ? a : b));
        const slowest = typesWithDays.reduce((a, b) => (a[1].avgDays! > b[1].avgDays! ? a : b));
        const typeLabels: Record<string, string> = { rezone: 'Rezone', cup: 'CUP', variance: 'Variance', by_right: 'By-Right', site_plan: 'Site Plan' };
        if (fastest[0] !== slowest[0]) {
          insights.push({
            type: 'trend',
            text: `${typeLabels[fastest[0]] || fastest[0]} is the fastest path at ${Math.round(fastest[1].avgDays! / 30)} months avg; ${typeLabels[slowest[0]] || slowest[0]} is the slowest at ${Math.round(slowest[1].avgDays! / 30)} months avg.`,
          });
        }
      }

      const largeScale = projects.filter(p => p.unit_count >= 200);
      const midScale = projects.filter(p => p.unit_count > 0 && p.unit_count < 200);
      if (largeScale.length >= 2 && midScale.length >= 2) {
        insights.push({
          type: 'trend',
          text: `Unit counts cluster in two tiers: mid-scale (${midScale.length} projects under 200 units, typically by-right/variance) and large-scale (${largeScale.length} projects at 200+ units, typically requiring rezone).`,
        });
      }

      const varianceStats = summaryClean['variance'];
      if (varianceStats && varianceStats.count >= 2 && varianceStats.approvalRate >= 80) {
        insights.push({
          type: 'opportunity',
          text: `Variance path shows strong precedent — ${varianceStats.count} approvals, ${varianceStats.approvalRate}% success rate${varianceStats.avgDays ? `, ${Math.round(varianceStats.avgDays / 30)}-month avg timeline` : ''}.`,
        });
      }
    }

    const projectsClean = projects.map(p => ({
      address: p.address,
      projectName: p.project_name,
      entitlementType: p.entitlement_type,
      zoningFrom: p.zoning_from,
      zoningTo: p.zoning_to,
      unitCount: p.unit_count ? parseInt(p.unit_count) : null,
      stories: p.stories ? parseInt(p.stories) : null,
      outcome: p.outcome,
      totalDays: p.total_entitlement_days ? parseInt(p.total_entitlement_days) : null,
      docketNumber: p.docket_number,
      ordinanceUrl: p.ordinance_url,
      municipality: p.municipality,
    }));

    res.json({
      success: true,
      data: {
        scope,
        scopeName,
        totalRecords,
        summary: summaryClean,
        insights,
        commonTransitions,
        projects: projectsClean,
      },
    });
  } catch (error: any) {
    console.error('Nearby entitlements error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
