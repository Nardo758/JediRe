/**
 * Market Intelligence API Routes
 * Exposes Apartment Locator AI market data to JEDI RE frontend
 */

import { Router } from 'express';
import { getApartmentLocatorIntegration } from '../../services/apartmentLocatorIntegration';

const router = Router();

/**
 * GET /api/market-intel/data
 * Get complete market intelligence for a location
 */
router.get('/data', async (req, res) => {
  try {
    const { city, state } = req.query;

    if (!city || !state) {
      return res.status(400).json({
        success: false,
        error: 'City and state are required',
      });
    }

    const integration = getApartmentLocatorIntegration();
    const data = await integration.getMarketData({
      city: city as string,
      state: state as string,
    });

    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Market intel API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch market data',
    });
  }
});

/**
 * GET /api/market-intel/rent-comps
 * Get rent comparables for underwriting
 */
router.get('/rent-comps', async (req, res) => {
  try {
    const { city, state, unit_type, max_distance_miles } = req.query;

    if (!city || !state) {
      return res.status(400).json({
        success: false,
        error: 'City and state are required',
      });
    }

    const integration = getApartmentLocatorIntegration();
    const data = await integration.getRentComps(
      { city: city as string, state: state as string },
      {
        unit_type: unit_type as string | undefined,
        max_distance_miles: max_distance_miles ? parseInt(max_distance_miles as string) : undefined,
      }
    );

    res.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error: any) {
    console.error('Rent comps API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch rent comps',
    });
  }
});

/**
 * GET /api/market-intel/summary
 * Get market summary (combines multiple endpoints)
 */
router.get('/summary', async (req, res) => {
  try {
    const { city, state } = req.query;

    if (!city || !state) {
      return res.status(400).json({
        success: false,
        error: 'City and state are required',
      });
    }

    const integration = getApartmentLocatorIntegration();
    const data = await integration.getMarketSummary({
      city: city as string,
      state: state as string,
    });

    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Market summary API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch market summary',
    });
  }
});

/**
 * GET /api/market-intel/investment-metrics
 * Get investment metrics for underwriting
 */
router.get('/investment-metrics', async (req, res) => {
  try {
    const { city, state } = req.query;

    if (!city || !state) {
      return res.status(400).json({
        success: false,
        error: 'City and state are required',
      });
    }

    const integration = getApartmentLocatorIntegration();
    const data = await integration.getInvestmentMetrics({
      city: city as string,
      state: state as string,
    });

    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Investment metrics API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch investment metrics',
    });
  }
});

/**
 * GET /api/market-intel/supply-pipeline
 * Get supply pipeline (properties coming online)
 */
router.get('/supply-pipeline', async (req, res) => {
  try {
    const { city, state, days } = req.query;

    if (!city || !state) {
      return res.status(400).json({
        success: false,
        error: 'City and state are required',
      });
    }

    const integration = getApartmentLocatorIntegration();
    const data = await integration.getSupplyPipeline(
      { city: city as string, state: state as string },
      days ? parseInt(days as string) : 180
    );

    res.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error: any) {
    console.error('Supply pipeline API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch supply pipeline',
    });
  }
});

/**
 * GET /api/market-intel/absorption-rate
 * Get absorption rate for market
 */
router.get('/absorption-rate', async (req, res) => {
  try {
    const { city, state } = req.query;

    if (!city || !state) {
      return res.status(400).json({
        success: false,
        error: 'City and state are required',
      });
    }

    const integration = getApartmentLocatorIntegration();
    const data = await integration.getAbsorptionRate({
      city: city as string,
      state: state as string,
    });

    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Absorption rate API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch absorption rate',
    });
  }
});

/**
 * GET /api/market-intel/properties
 * Get scraped properties for a location
 */
router.get('/properties', async (req, res) => {
  try {
    const { city, state, zip, class: propertyClass } = req.query;

    const integration = getApartmentLocatorIntegration();
    const data = await integration.getProperties({
      city: city as string | undefined,
      state: state as string | undefined,
      zip: zip as string | undefined,
      class: propertyClass as 'A' | 'B' | 'C' | 'D' | undefined,
    });

    res.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error: any) {
    console.error('Properties API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch properties',
    });
  }
});

/**
 * GET /api/market-intel/check
 * Check if market data is available for a location
 */
router.get('/check', async (req, res) => {
  try {
    const { city, state } = req.query;

    if (!city || !state) {
      return res.status(400).json({
        success: false,
        error: 'City and state are required',
      });
    }

    const integration = getApartmentLocatorIntegration();
    const hasData = await integration.hasMarketData({
      city: city as string,
      state: state as string,
    });

    res.json({
      success: true,
      hasData,
    });
  } catch (error: any) {
    console.error('Market data check API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check market data',
    });
  }
});

export default router;
