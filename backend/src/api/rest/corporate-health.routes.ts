import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { corporateHealthService } from '../../services/corporate-health.service';
import { employerConcentrationService } from '../../services/employer-concentration.service';
import { earningsNLPService } from '../../services/earnings-transcript-nlp.service';
import { logger } from '../../utils/logger';

const router = Router();

router.use(requireAuth);

router.get('/submarket/:submarketId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const submarketId = parseInt(req.params.submarketId);
    if (isNaN(submarketId) || submarketId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid submarket ID' });
    }

    const schi = await corporateHealthService.computeSCHI(submarketId);
    const employers = await employerConcentrationService.getEmployers(submarketId);

    const { getPool } = await import('../../database/connection');
    const pool = getPool();
    const trend = await pool.query(
      `SELECT quarter, schi_score, divergence_score, divergence_signal
       FROM submarket_corporate_health
       WHERE submarket_id = $1 ORDER BY quarter DESC LIMIT 8`,
      [submarketId],
    );

    res.json({
      success: true,
      data: {
        schi: schi.schiScore,
        divergence: schi.divergenceScore,
        signal: schi.divergenceSignal,
        reHealth: schi.reHealthScore,
        quarter: schi.quarter,
        herfindahl: schi.herfindahlIndex,
        top5Share: schi.top5Share,
        publicCoverage: schi.publicCoverage,
        employers: employers.map((e: Record<string, string>) => ({
          company: e.company_name,
          ticker: e.ticker,
          isPublic: e.is_public,
          employees: e.estimated_local_employees,
          share: parseFloat(e.employment_share),
          chs: e.composite_chs ? parseFloat(e.composite_chs) : null,
          tier: e.health_tier,
          delta: e.chs_delta_qoq ? parseFloat(e.chs_delta_qoq) : null,
        })),
        trend: trend.rows.map((r: Record<string, string>) => ({
          quarter: r.quarter,
          schi: parseFloat(r.schi_score),
          divergence: parseFloat(r.divergence_score),
          signal: r.divergence_signal,
        })),
        sectorBreakdown: schi.sectorBreakdown,
      },
    });
  } catch (error) {
    logger.error('[CorporateHealth] Error fetching submarket health:', error);
    next(error);
  }
});

router.get('/company/:ticker', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ticker } = req.params;
    const detail = await corporateHealthService.getCompanyDetail(ticker.toUpperCase());

    res.json({
      success: true,
      data: detail,
    });
  } catch (error) {
    logger.error('[CorporateHealth] Error fetching company detail:', error);
    next(error);
  }
});

router.get('/deal/:dealId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dealId } = req.params;
    const overlay = await corporateHealthService.getDealOverlay(dealId);

    res.json({
      success: true,
      data: overlay,
    });
  } catch (error) {
    logger.error('[CorporateHealth] Error fetching deal overlay:', error);
    next(error);
  }
});

router.get('/portfolio', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const portfolio = await corporateHealthService.getPortfolioDivergence();

    res.json({
      success: true,
      data: portfolio,
    });
  } catch (error) {
    logger.error('[CorporateHealth] Error fetching portfolio divergence:', error);
    next(error);
  }
});

router.get('/sector-rotation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rotation = await corporateHealthService.getSectorRotation();

    res.json({
      success: true,
      data: rotation,
    });
  } catch (error) {
    logger.error('[CorporateHealth] Error fetching sector rotation:', error);
    next(error);
  }
});

router.get('/alerts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const alerts = await corporateHealthService.getAlerts();

    res.json({
      success: true,
      data: {
        alerts,
        count: alerts.length,
      },
    });
  } catch (error) {
    logger.error('[CorporateHealth] Error fetching alerts:', error);
    next(error);
  }
});

router.post('/refresh/:ticker', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ticker } = req.params;
    const chs = await corporateHealthService.refreshTicker(ticker.toUpperCase());

    res.json({
      success: true,
      data: {
        updated: true,
        chs,
      },
    });
  } catch (error) {
    logger.error('[CorporateHealth] Error refreshing ticker:', error);
    next(error);
  }
});

router.get('/concentration/:submarketId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const submarketId = parseInt(req.params.submarketId);
    if (isNaN(submarketId)) {
      return res.status(400).json({ success: false, error: 'Invalid submarket ID' });
    }

    const concentration = await employerConcentrationService.computeConcentration(submarketId);
    const employers = await employerConcentrationService.getEmployers(submarketId);

    res.json({
      success: true,
      data: {
        herfindahl: concentration.herfindahlIndex,
        top5Share: concentration.top5Share,
        publicCoverage: concentration.publicCompanyCoverage,
        maxShare: concentration.singleEmployerMaxShare,
        diversityScore: concentration.industryDiversityScore,
        employerCount: concentration.employerCount,
        publicEmployerCount: concentration.publicEmployerCount,
        sectorBreakdown: concentration.sectorBreakdown,
        employers: employers.map((e: Record<string, string>) => ({
          company: e.company_name,
          ticker: e.ticker,
          isPublic: e.is_public,
          naics: e.naics_code,
          facilityType: e.facility_type,
          employees: e.estimated_local_employees,
          share: parseFloat(e.employment_share),
          chs: e.composite_chs ? parseFloat(e.composite_chs) : null,
          tier: e.health_tier,
        })),
      },
    });
  } catch (error) {
    logger.error('[CorporateHealth] Error fetching concentration:', error);
    next(error);
  }
});

router.post('/transcript/:ticker', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ticker } = req.params;
    const { transcript, fiscalQuarter } = req.body;

    if (!transcript) {
      return res.status(400).json({ success: false, error: 'Transcript text required' });
    }

    const quarter = fiscalQuarter || (() => {
      const now = new Date();
      const q = Math.ceil((now.getMonth() + 1) / 3);
      return `${now.getFullYear()}-Q${q}`;
    })();

    const result = await earningsNLPService.analyzeAndStore(transcript, ticker.toUpperCase(), quarter);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('[CorporateHealth] Error analyzing transcript:', error);
    next(error);
  }
});

export default router;
