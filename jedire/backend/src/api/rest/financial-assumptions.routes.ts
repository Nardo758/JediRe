import { Express } from 'express';
import { Pool } from 'pg';
import FinancialAssumptionsAPI from './FinancialAssumptionsAPI';
import DesignToFinancialService from './DesignToFinancialService';

/**
 * Configure financial API routes
 */
export function configureFinancialRoutes(app: Express, pool: Pool) {
  // Initialize APIs
  const assumptionsAPI = new FinancialAssumptionsAPI(pool);
  const designService = new DesignToFinancialService();
  
  // Register assumption API routes
  app.use(assumptionsAPI.getRouter());
  
  // Additional integration endpoints
  
  // Link design to financial model
  app.post('/api/v1/financial/link-design', async (req, res) => {
    try {
      const { designId, financialId } = req.body;
      
      if (!designId || !financialId) {
        return res.status(400).json({ 
          error: 'Both designId and financialId are required' 
        });
      }
      
      await designService.linkDesignToFinancial(designId, financialId);
      
      res.json({ 
        success: true, 
        message: 'Design and financial models linked successfully' 
      });
    } catch (error) {
      console.error('Error linking design to financial:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Get linked models
  app.get('/api/v1/financial/linked/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { type } = req.query; // 'design' or 'financial'
      
      let linkedId;
      if (type === 'design') {
        linkedId = await designService.getLinkedFinancialId(id);
      } else if (type === 'financial') {
        linkedId = await designService.getSourceDesignId(id);
      } else {
        return res.status(400).json({ 
          error: 'Type parameter must be "design" or "financial"' 
        });
      }
      
      res.json({ 
        linkedId,
        hasLink: !!linkedId 
      });
    } catch (error) {
      console.error('Error getting linked model:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Export design for financial analysis
  app.post('/api/v1/financial/export-design', async (req, res) => {
    try {
      const { design3D } = req.body;
      
      if (!design3D) {
        return res.status(400).json({ 
          error: 'Design data is required' 
        });
      }
      
      const financialInputs = await designService.exportDesignData(design3D);
      const proForma = designService.calculateProForma(financialInputs);
      
      res.json({
        inputs: financialInputs,
        proForma,
        exportedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error exporting design:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Compare design to targets
  app.post('/api/v1/financial/compare-to-targets', async (req, res) => {
    try {
      const { design3D, targets } = req.body;
      
      if (!design3D || !targets) {
        return res.status(400).json({ 
          error: 'Both design3D and targets are required' 
        });
      }
      
      const comparison = designService.compareDesignToTargets(design3D, targets);
      
      res.json(comparison);
    } catch (error) {
      console.error('Error comparing to targets:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Health check endpoint
  app.get('/api/v1/financial/health', (req, res) => {
    res.json({ 
      status: 'healthy',
      service: 'financial-integration',
      version: '1.0.0'
    });
  });
}

// Export for use in main app
export default configureFinancialRoutes;