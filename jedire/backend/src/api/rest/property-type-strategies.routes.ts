/**
 * Property Type Strategies API Routes
 * Map property types to applicable investment strategies
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { logger } from '../../utils/logger';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Strategy definitions with applicable property types
const STRATEGIES = [
  {
    slug: 'value_add',
    name: 'Value-Add',
    description: 'Renovate and reposition underperforming assets',
    color: 'blue',
    propertyTypes: {
      'garden_apartments': { strength: 'strong', rationale: 'High renovation upside in older garden communities' },
      'midrise_apartments': { strength: 'strong', rationale: 'Interior and amenity upgrades drive rent growth' },
      'office_class_abc': { strength: 'moderate', rationale: 'TI improvements and building upgrades' },
      'strip_centers': { strength: 'moderate', rationale: 'Facade and tenant improvements' },
      'warehouse_distribution': { strength: 'weak', rationale: 'Limited value-add opportunities in industrial' },
      'limited_service_hotels': { strength: 'moderate', rationale: 'Room and common area renovations' },
    }
  },
  {
    slug: 'core_plus',
    name: 'Core+',
    description: 'Stable assets with modest upside potential',
    color: 'green',
    propertyTypes: {
      'highrise_apartments': { strength: 'strong', rationale: 'Premium locations with stable cashflow' },
      'office_class_abc': { strength: 'strong', rationale: 'Class A properties in prime markets' },
      'regional_malls': { strength: 'weak', rationale: 'Declining retail format' },
      'single_tenant_nnn': { strength: 'strong', rationale: 'Long-term credit tenant leases' },
      'full_service_hotels': { strength: 'moderate', rationale: 'Established properties in good locations' },
      'self_storage': { strength: 'strong', rationale: 'Recession-resistant with stable demand' },
    }
  },
  {
    slug: 'opportunistic',
    name: 'Opportunistic',
    description: 'High-risk development and repositioning plays',
    color: 'purple',
    propertyTypes: {
      'raw_undeveloped': { strength: 'strong', rationale: 'Ground-up development opportunities' },
      'entitled_approved': { strength: 'strong', rationale: 'Development-ready land' },
      'infill_parcels': { strength: 'strong', rationale: 'Urban densification plays' },
      'vertical_mixed_use': { strength: 'strong', rationale: 'Complex development with high returns' },
      'build_to_rent': { strength: 'moderate', rationale: 'Emerging asset class with development risk' },
      'life_sciences_lab': { strength: 'moderate', rationale: 'Specialized development with tenant risk' },
    }
  },
  {
    slug: 'conversion',
    name: 'Conversion',
    description: 'Adaptive reuse and property type conversion',
    color: 'orange',
    propertyTypes: {
      'office_class_abc': { strength: 'strong', rationale: 'Office-to-residential conversions in urban cores' },
      'medical_office': { strength: 'moderate', rationale: 'Can convert to multifamily or mixed-use' },
      'flex_creative_office': { strength: 'strong', rationale: 'Easily converted to creative live-work' },
      'regional_malls': { strength: 'moderate', rationale: 'Redevelop as mixed-use or logistics' },
      'limited_service_hotels': { strength: 'weak', rationale: 'Difficult conversions, limited buyers' },
      'warehouse_distribution': { strength: 'weak', rationale: 'Purpose-built, hard to repurpose' },
    }
  },
  {
    slug: 'distressed',
    name: 'Distressed / NPL',
    description: 'Non-performing loans and distressed acquisitions',
    color: 'red',
    propertyTypes: {
      'garden_apartments': { strength: 'strong', rationale: 'Frequent distressed multifamily deals' },
      'strip_centers': { strength: 'strong', rationale: 'Challenged retail with vacancy' },
      'office_class_abc': { strength: 'strong', rationale: 'Post-pandemic office distress' },
      'limited_service_hotels': { strength: 'strong', rationale: 'High leverage and operational challenges' },
      'raw_undeveloped': { strength: 'moderate', rationale: 'Stalled development projects' },
      'single_tenant_nnn': { strength: 'weak', rationale: 'Credit tenants rarely default' },
    }
  },
  {
    slug: 'income_core',
    name: 'Income / Core',
    description: 'Stabilized assets for steady income',
    color: 'teal',
    propertyTypes: {
      'single_tenant_nnn': { strength: 'strong', rationale: 'Investment-grade tenants, long-term leases' },
      'self_storage': { strength: 'strong', rationale: 'High NOI margins and stable demand' },
      'medical_office': { strength: 'strong', rationale: 'Healthcare tenants with long leases' },
      'data_centers': { strength: 'strong', rationale: 'Critical infrastructure with long contracts' },
      'manufactured_mobile': { strength: 'moderate', rationale: 'Affordable housing with stable tenancy' },
      'student_housing': { strength: 'moderate', rationale: 'Near-campus properties with reliable demand' },
    }
  },
  {
    slug: 'redevelopment',
    name: 'Redevelopment',
    description: 'Major renovation or rebuild projects',
    color: 'indigo',
    propertyTypes: {
      'strip_centers': { strength: 'strong', rationale: 'Tear down and rebuild modern retail' },
      'neighborhood_centers': { strength: 'strong', rationale: 'Grocery-anchored redevelopment' },
      'garden_apartments': { strength: 'moderate', rationale: 'Significant capital for gut rehab' },
      'flex_industrial': { strength: 'moderate', rationale: 'Modernize industrial/office mix' },
      'parking': { strength: 'weak', rationale: 'Extremely expensive to redevelop structured parking' },
      'single_tenant_nnn': { strength: 'weak', rationale: 'Leases prevent redevelopment' },
    }
  },
  {
    slug: 'lease_up',
    name: 'Lease-Up',
    description: 'Stabilize newly delivered or vacant properties',
    color: 'yellow',
    propertyTypes: {
      'garden_apartments': { strength: 'strong', rationale: 'New construction lease-up' },
      'midrise_apartments': { strength: 'strong', rationale: 'Common lease-up strategy for multifamily' },
      'office_class_abc': { strength: 'moderate', rationale: 'Spec office requiring tenant backfill' },
      'flex_industrial': { strength: 'moderate', rationale: 'Newly built flex space lease-up' },
      'coworking': { strength: 'weak', rationale: 'High competition, difficult to stabilize' },
      'self_storage': { strength: 'strong', rationale: 'New storage facilities stabilize quickly' },
    }
  },
];

/**
 * GET /api/v1/property-type-strategies
 * Get all strategies with property type applicability
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: STRATEGIES
    });
  } catch (error) {
    logger.error('Error fetching property type strategies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch strategies'
    });
  }
});

/**
 * GET /api/v1/property-type-strategies/:propertyTypeKey
 * Get applicable strategies for a specific property type
 */
router.get('/:propertyTypeKey', async (req: Request, res: Response) => {
  try {
    const { propertyTypeKey } = req.params;

    const applicableStrategies = STRATEGIES
      .map(strategy => {
        const match = strategy.propertyTypes[propertyTypeKey];
        if (!match) return null;
        
        return {
          slug: strategy.slug,
          name: strategy.name,
          description: strategy.description,
          color: strategy.color,
          strength: match.strength,
          rationale: match.rationale
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        // Sort by strength: strong > moderate > weak
        const order = { strong: 0, moderate: 1, weak: 2 };
        return (order[a!.strength as keyof typeof order] || 999) - (order[b!.strength as keyof typeof order] || 999);
      });

    res.json({
      success: true,
      propertyType: propertyTypeKey,
      strategies: applicableStrategies,
      count: applicableStrategies.length
    });
  } catch (error) {
    logger.error('Error fetching strategies for property type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch strategies'
    });
  }
});

export default router;
