import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { ParcelIngestionService } from '../../services/parcel-ingestion.service';
import { ZoningTriangulationService } from '../../services/zoning-triangulation.service';
import { ConfirmationChainService } from '../../services/confirmation-chain.service';
import { ZoningRecommendationOrchestrator } from '../../services/zoning-recommendation-orchestrator.service';
import { BenchmarkEnrichmentService } from '../../services/benchmark-enrichment.service';
import { DealPropertyLinkerService } from '../../services/deal-property-linker.service';

const router = Router();
const pool = getPool();
const parcelService = new ParcelIngestionService(pool);
const triangulationService = new ZoningTriangulationService(pool);
const chainService = new ConfirmationChainService(pool);
const recommendationOrchestrator = new ZoningRecommendationOrchestrator(pool);
const enrichmentService = new BenchmarkEnrichmentService(pool);
const dealPropertyLinker = new DealPropertyLinkerService();

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

router.get('/deals/:dealId/properties', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const properties = await dealPropertyLinker.getDealProperties(dealId);
    res.json({ success: true, data: properties });
  } catch (error: any) {
    console.error('Get deal properties error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/deals/:dealId/properties/:propertyId/link', async (req: Request, res: Response) => {
  try {
    const { dealId, propertyId } = req.params;
    const { relationship = 'subject', notes } = req.body || {};
    await dealPropertyLinker.linkProperty(dealId, propertyId, relationship, notes);
    res.json({ success: true, message: 'Property linked to deal' });
  } catch (error: any) {
    console.error('Link property error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/deals/:dealId/properties/:propertyId', async (req: Request, res: Response) => {
  try {
    const { dealId, propertyId } = req.params;
    const deleted = await dealPropertyLinker.unlinkProperty(dealId, propertyId);
    res.json({ success: true, deleted });
  } catch (error: any) {
    console.error('Unlink property error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/deal-property-autolink', async (req: Request, res: Response) => {
  try {
    const summary = await dealPropertyLinker.autoLinkAll();
    res.json({ success: true, data: summary });
  } catch (error: any) {
    console.error('Auto-link error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/benchmark-enrichment/run', async (req: Request, res: Response) => {
  try {
    const { county } = req.query;
    const result = await enrichmentService.enrichBenchmarkProjects(county as string | undefined);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Benchmark enrichment error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/properties/:id/enrich', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await enrichmentService.enrichProperty(id);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Property enrichment error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/deals/:dealId/density-benchmarks', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;

    const profileResult = await pool.query(
      `SELECT base_district_code, municipality, state, max_density_per_acre, lot_area_sf
       FROM deal_zoning_profiles WHERE deal_id = $1 LIMIT 1`,
      [dealId]
    );

    const dealResult = await pool.query(
      `SELECT name, address, state FROM deals WHERE id = $1`,
      [dealId]
    );

    if (profileResult.rows.length === 0 && dealResult.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          currentCode: null,
          zonedMaxDensity: null,
          dataAvailability: 'none',
          benchmarks: [],
          projects: [],
          utilizationPct: null,
          rezoneFromCurrent: null,
          searchScope: null,
        },
      });
    }

    const profile = profileResult.rows[0] || {};
    const deal = dealResult.rows[0] || {};
    const currentCode = profile.base_district_code || null;
    const zonedMaxDensity = (profile.max_density_per_acre !== null && profile.max_density_per_acre !== undefined)
      ? parseFloat(profile.max_density_per_acre) : null;
    const municipality = profile.municipality || null;
    const state = profile.state || deal.state || null;

    let county: string | null = null;
    if (municipality) {
      const countyLookup = await pool.query(
        `SELECT DISTINCT county FROM benchmark_projects
         WHERE UPPER(municipality) = UPPER($1) AND county IS NOT NULL LIMIT 1`,
        [municipality]
      );
      county = countyLookup.rows[0]?.county || null;
    }

    const benchmarkFields = `address, land_acres, unit_count, building_sf, total_sf, density_achieved, far_achieved,
                assessed_value, appraised_value, entitlement_type, zoning_from, zoning_to,
                total_entitlement_days, municipality, county`;

    let projects: any[] = [];
    let searchScope: string | null = null;

    if (currentCode) {
      if (municipality) {
        const muniResult = await pool.query(
          `SELECT ${benchmarkFields}
           FROM benchmark_projects
           WHERE zoning_to = $1 AND density_achieved IS NOT NULL AND density_achieved > 0
             AND density_achieved < 500 AND land_acres > 0.01
             AND UPPER(municipality) = UPPER($2)
           ORDER BY density_achieved DESC`,
          [currentCode, municipality]
        );
        if (muniResult.rows.length >= 3) {
          projects = muniResult.rows;
          searchScope = 'municipality';
        }
      }

      if (projects.length < 3 && county) {
        const countyResult = await pool.query(
          `SELECT ${benchmarkFields}
           FROM benchmark_projects
           WHERE zoning_to = $1 AND density_achieved IS NOT NULL AND density_achieved > 0
             AND density_achieved < 500 AND land_acres > 0.01
             AND UPPER(county) = UPPER($2)
           ORDER BY density_achieved DESC`,
          [currentCode, county]
        );
        if (countyResult.rows.length > projects.length) {
          projects = countyResult.rows;
          searchScope = 'county';
        }
      }

      if (projects.length < 3 && state) {
        const stateResult = await pool.query(
          `SELECT ${benchmarkFields}
           FROM benchmark_projects
           WHERE zoning_to = $1 AND density_achieved IS NOT NULL AND density_achieved > 0
             AND density_achieved < 500 AND land_acres > 0.01
             AND UPPER(state) = UPPER($2)
           ORDER BY density_achieved DESC`,
          [currentCode, state]
        );
        if (stateResult.rows.length > projects.length) {
          projects = stateResult.rows;
          searchScope = 'state';
        }
      }

      if (projects.length === 0) {
        const codePrefix = currentCode.replace(/-\d+$/, '').replace(/-[A-Z]$/, '');
        if (codePrefix !== currentCode) {
          const prefixResult = await pool.query(
            `SELECT ${benchmarkFields}
             FROM benchmark_projects
             WHERE zoning_to LIKE $1 AND density_achieved IS NOT NULL AND density_achieved > 0
             AND density_achieved < 500 AND land_acres > 0.01
             ${state ? 'AND UPPER(state) = UPPER($2)' : ''}
             ORDER BY density_achieved DESC
             LIMIT 20`,
            state ? [`${codePrefix}%`, state] : [`${codePrefix}%`]
          );
          projects = prefixResult.rows;
          searchScope = projects.length > 0 ? 'state' : null;
        }
      }
    }

    const dataAvailability = projects.length >= 3 ? 'rich' : projects.length > 0 ? 'sparse' : 'none';

    const benchmarkMap: Record<string, any[]> = {};
    for (const p of projects) {
      const code = p.zoning_to || 'unknown';
      if (!benchmarkMap[code]) benchmarkMap[code] = [];
      benchmarkMap[code].push(p);
    }

    const benchmarks = Object.entries(benchmarkMap).map(([code, ps]) => {
      const densities = ps.map(p => p.density_achieved != null ? parseFloat(p.density_achieved) : NaN).filter(d => !isNaN(d) && d > 0);
      const lotAcres = ps.map(p => p.land_acres != null ? parseFloat(p.land_acres) : NaN).filter(a => !isNaN(a) && a > 0);
      const units = ps.map(p => p.unit_count != null ? parseInt(p.unit_count) : NaN).filter(u => !isNaN(u) && u > 0);
      const buildingSfs = ps.map(p => p.building_sf != null ? parseInt(p.building_sf) : (p.total_sf != null ? parseInt(p.total_sf) : NaN)).filter(s => !isNaN(s) && s > 0);
      const assessedVals = ps.map(p => p.assessed_value != null ? parseInt(p.assessed_value) : NaN).filter(v => !isNaN(v) && v > 0);

      return {
        code,
        projectCount: ps.length,
        avgDensityAchieved: densities.length > 0 ? Math.round((densities.reduce((a, b) => a + b, 0) / densities.length) * 100) / 100 : null,
        minDensity: densities.length > 0 ? Math.min(...densities) : null,
        maxDensity: densities.length > 0 ? Math.max(...densities) : null,
        avgLotAcres: lotAcres.length > 0 ? Math.round((lotAcres.reduce((a, b) => a + b, 0) / lotAcres.length) * 1000) / 1000 : null,
        avgUnits: units.length > 0 ? Math.round(units.reduce((a, b) => a + b, 0) / units.length) : null,
        avgBuildingSf: buildingSfs.length > 0 ? Math.round(buildingSfs.reduce((a, b) => a + b, 0) / buildingSfs.length) : null,
        avgAssessedValue: assessedVals.length > 0 ? Math.round(assessedVals.reduce((a, b) => a + b, 0) / assessedVals.length) : null,
      };
    });

    const allDensities = projects.map(p => parseFloat(p.density_achieved)).filter(d => d > 0);
    const avgAchieved = allDensities.length > 0 ? allDensities.reduce((a, b) => a + b, 0) / allDensities.length : null;
    const utilizationPct = avgAchieved && zonedMaxDensity && zonedMaxDensity > 0
      ? Math.round((avgAchieved / zonedMaxDensity) * 10000) / 100
      : null;

    const projectsClean = projects.map(p => ({
      address: p.address,
      landAcres: p.land_acres != null ? parseFloat(p.land_acres) : null,
      unitCount: p.unit_count != null ? parseInt(p.unit_count) : null,
      buildingSf: p.building_sf != null ? parseInt(p.building_sf) : (p.total_sf != null ? parseInt(p.total_sf) : null),
      densityAchieved: p.density_achieved != null ? parseFloat(p.density_achieved) : null,
      farAchieved: p.far_achieved != null ? parseFloat(p.far_achieved) : null,
      assessedValue: p.assessed_value != null ? parseInt(p.assessed_value) : null,
      appraisedValue: p.appraised_value != null ? parseInt(p.appraised_value) : null,
      entitlementType: p.entitlement_type,
      zoningFrom: p.zoning_from,
      zoningTo: p.zoning_to,
      totalEntitlementDays: p.total_entitlement_days ? parseInt(p.total_entitlement_days) : null,
    }));

    let rezoneFromCurrent: any = null;
    if (currentCode) {
      const rezoneResult = await pool.query(
        `SELECT address, land_acres, unit_count, building_sf, total_sf, density_achieved, far_achieved,
                assessed_value, appraised_value, entitlement_type, zoning_from, zoning_to,
                total_entitlement_days
         FROM benchmark_projects
         WHERE zoning_from = $1 AND density_achieved IS NOT NULL AND density_achieved > 0
         ORDER BY density_achieved DESC
         LIMIT 20`,
        [currentCode]
      );

      if (rezoneResult.rows.length > 0) {
        const rezoneProjects = rezoneResult.rows.map(p => ({
          address: p.address,
          landAcres: p.land_acres ? parseFloat(p.land_acres) : null,
          unitCount: p.unit_count ? parseInt(p.unit_count) : null,
          buildingSf: p.building_sf ? parseInt(p.building_sf) : (p.total_sf ? parseInt(p.total_sf) : null),
          densityAchieved: p.density_achieved ? parseFloat(p.density_achieved) : null,
          entitlementType: p.entitlement_type,
          zoningTo: p.zoning_to,
          totalEntitlementDays: p.total_entitlement_days ? parseInt(p.total_entitlement_days) : null,
        }));

        const targetCodes = [...new Set(rezoneResult.rows.map(r => r.zoning_to))];
        rezoneFromCurrent = {
          projectCount: rezoneResult.rows.length,
          targetCodes,
          projects: rezoneProjects,
        };
      }
    }

    res.json({
      success: true,
      data: {
        currentCode,
        zonedMaxDensity,
        dataAvailability,
        benchmarks,
        projects: projectsClean,
        utilizationPct,
        rezoneFromCurrent,
        searchScope,
      },
    });
  } catch (error: any) {
    console.error('Density benchmarks error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
