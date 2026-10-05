import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { SITE_COUNTIES } from '../../types/site-finder';
import { SiteFinderRuns, siteCatalog } from '../../services/site-finder/runs';
import { validateCriteria, interpretText } from '../../services/site-finder/criteria';
import { requireAuth } from '../../middleware/auth';
import { createRateLimiter } from '../../middleware/rateLimit';
import { logger } from '../../utils/logger';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createSiteFinderRoutes(pool: Pool) {
  const router = Router();
  const runs = new SiteFinderRuns(pool);
  router.use(requireAuth);
  // A public allowlist bypass never becomes a Site Finder identity.
  router.use((req: any,res,next) => req.user?.userId ? next() : res.status(401).json({success:false,error:'Sign in to use Site Finder.'}));
  const limited = createRateLimiter({windowMs:60000,maxRequests:30});
  const owner = (req: Request) => (req as any).user.userId as string;
  function handler(fn: (req: Request,res: Response) => Promise<any>) {
    return (req: Request,res: Response) => void fn(req,res).catch(e => {
      logger.warn('Site Finder request failed', { error: e.message });
      res.status(/already active|limit reached/.test(e.message) ? 429 : 503).json({success:false,error:'Site Finder could not complete this request. Retry shortly.'});
    });
  }
  router.get('/catalog',handler(async (_req,res) => res.json({success:true,data:{propertyTypes:await siteCatalog(pool),counties:SITE_COUNTIES}})));
  router.post('/interpret',limited,handler(async (req,res) => {
    try {
      const result = interpretText(req.body.text,req.body.criteria || {},await siteCatalog(pool));
      res.json({success:true,data:result});
    } catch (e: any) { res.status(422).json({success:false,error:e.message}); }
  }));
  router.post('/runs',limited,handler(async (req,res) => {
    let criteria;
    try { criteria = validateCriteria(req.body.criteria,await siteCatalog(pool)); }
    catch (e: any) { return res.status(422).json({success:false,error:e.message}); }
    try { res.status(202).json({success:true,data:await runs.create(owner(req),criteria)}); }
    catch (e: any) { if (/already active|limit reached/.test(e.message)) return res.status(429).json({success:false,error:e.message}); throw e; }
  }));
  router.get('/runs',handler(async (req,res) => res.json({success:true,data:await runs.list(owner(req))})));
  router.use('/runs/:id',(req,res,next) => uuid.test(req.params.id) ? next() : res.status(400).json({success:false,error:'Invalid search run ID.'}));
  router.get('/runs/:id',handler(async (req,res) => {
    const run = await runs.get(req.params.id,owner(req));
    res.status(run ? 200 : 404).json(run ? {success:true,data:run} : {success:false,error:'Search run not found.'});
  }));
  router.post('/runs/:id/retry',limited,handler(async (req,res) => {
    const run = await runs.get(req.params.id,owner(req));
    if (!run) return res.status(404).json({success:false,error:'Search run not found.'});
    res.status(202).json({success:true,data:await runs.create(owner(req),run.criteria)});
  }));
  router.post('/runs/:id/parcels/:key/review',limited,handler(async (req,res) => {
    const review = await runs.updateReview(owner(req),req.params.id,req.params.key);
    res.status(review ? 200 : 404).json(review ? {success:true,data:review} : {success:false,error:'Parcel or run not found.'});
  }));
  return router;
}