/**
 * Strategy Defaults Service
 * Maps property types to investment strategies with default financial assumptions
 */

export interface StrategyDefaults {
  holdPeriod: string;
  exitStrategy: string;
  keyMetrics: string[];
  assumptions: {
    capRate?: number;
    rentGrowth?: number;
    expenseGrowth?: number;
    occupancy?: number;
    renovationBudget?: number;
    timeToStabilize?: number;
  };
}

export interface PropertyTypeStrategy {
  name: string;
  strength: 'Strong' | 'Moderate' | 'Weak';
  defaults: StrategyDefaults;
}

/**
 * Property Type to Strategy Matrix
 * Maps property type keys to applicable strategies with strength ratings
 */
const PROPERTY_TYPE_STRATEGIES: Record<string, PropertyTypeStrategy[]> = {
  // ===== MULTIFAMILY =====
  garden_apartments: [
    {
      name: 'Rental (Core)',
      strength: 'Strong',
      defaults: {
        holdPeriod: '7-10 years',
        exitStrategy: 'Cap Rate',
        keyMetrics: ['price_per_unit', 'rent_per_sf', 'cap_rate', 'occupancy'],
        assumptions: {
          capRate: 5.5,
          rentGrowth: 3.0,
          expenseGrowth: 2.5,
          occupancy: 95,
        },
      },
    },
    {
      name: 'Rental (Value-Add)',
      strength: 'Strong',
      defaults: {
        holdPeriod: '5-7 years',
        exitStrategy: 'Cap Rate',
        keyMetrics: ['price_per_unit', 'rent_per_sf', 'cap_rate', 'renovation_cost'],
        assumptions: {
          capRate: 6.0,
          rentGrowth: 5.0,
          expenseGrowth: 3.0,
          occupancy: 92,
          renovationBudget: 18000,
          timeToStabilize: 24,
        },
      },
    },
    {
      name: 'Fix & Flip',
      strength: 'Moderate',
      defaults: {
        holdPeriod: '1-2 years',
        exitStrategy: 'Direct Sale',
        keyMetrics: ['purchase_price', 'renovation_cost', 'arv', 'profit_margin'],
        assumptions: {
          renovationBudget: 25000,
          timeToStabilize: 12,
        },
      },
    },
  ],
  midrise_apartments: [
    {
      name: 'Rental (Core)',
      strength: 'Strong',
      defaults: {
        holdPeriod: '7-10 years',
        exitStrategy: 'Cap Rate',
        keyMetrics: ['price_per_unit', 'rent_per_sf', 'cap_rate', 'occupancy'],
        assumptions: {
          capRate: 5.0,
          rentGrowth: 3.5,
          expenseGrowth: 2.5,
          occupancy: 96,
        },
      },
    },
    {
      name: 'Rental (Value-Add)',
      strength: 'Strong',
      defaults: {
        holdPeriod: '5-7 years',
        exitStrategy: 'Cap Rate',
        keyMetrics: ['price_per_unit', 'rent_per_sf', 'cap_rate', 'renovation_cost'],
        assumptions: {
          capRate: 5.5,
          rentGrowth: 5.5,
          expenseGrowth: 3.0,
          occupancy: 93,
          renovationBudget: 22000,
          timeToStabilize: 24,
        },
      },
    },
    {
      name: 'Condo Conversion',
      strength: 'Moderate',
      defaults: {
        holdPeriod: '2-3 years',
        exitStrategy: 'Unit Sales',
        keyMetrics: ['price_per_unit', 'conversion_cost', 'sale_price_per_unit', 'absorption_rate'],
        assumptions: {
          renovationBudget: 35000,
          timeToStabilize: 18,
        },
      },
    },
  ],
  highrise_apartments: [
    {
      name: 'Rental (Core)',
      strength: 'Strong',
      defaults: {
        holdPeriod: '7-10 years',
        exitStrategy: 'Cap Rate',
        keyMetrics: ['price_per_unit', 'rent_per_sf', 'cap_rate', 'occupancy'],
        assumptions: {
          capRate: 4.5,
          rentGrowth: 4.0,
          expenseGrowth: 2.5,
          occupancy: 97,
        },
      },
    },
    {
      name: 'Rental (Value-Add)',
      strength: 'Moderate',
      defaults: {
        holdPeriod: '5-7 years',
        exitStrategy: 'Cap Rate',
        keyMetrics: ['price_per_unit', 'rent_per_sf', 'cap_rate', 'renovation_cost'],
        assumptions: {
          capRate: 5.0,
          rentGrowth: 6.0,
          expenseGrowth: 3.0,
          occupancy: 94,
          renovationBudget: 28000,
          timeToStabilize: 30,
        },
      },
    },
    {
      name: 'Condo Conversion',
      strength: 'Strong',
      defaults: {
        holdPeriod: '2-4 years',
        exitStrategy: 'Unit Sales',
        keyMetrics: ['price_per_unit', 'conversion_cost', 'sale_price_per_unit', 'absorption_rate'],
        assumptions: {
          renovationBudget: 45000,
          timeToStabilize: 24,
        },
      },
    },
  ],
  student_housing: [
    {
      name: 'Rental (Core)',
      strength: 'Strong',
      defaults: {
        holdPeriod: '7-10 years',
        exitStrategy: 'Cap Rate',
        keyMetrics: ['price_per_bed', 'rent_per_bed', 'cap_rate', 'occupancy'],
        assumptions: {
          capRate: 5.5,
          rentGrowth: 3.5,
          expenseGrowth: 3.0,
          occupancy: 98,
        },
      },
    },
    {
      name: 'Rental (Value-Add)',
      strength: 'Moderate',
      defaults: {
        holdPeriod: '5-7 years',
        exitStrategy: 'Cap Rate',
        keyMetrics: ['price_per_bed', 'rent_per_bed', 'cap_rate', 'renovation_cost'],
        assumptions: {
          capRate: 6.0,
          rentGrowth: 5.0,
          expenseGrowth: 3.5,
          occupancy: 96,
          renovationBudget: 15000,
          timeToStabilize: 18,
        },
      },
    },
  ],

  // ===== COMMERCIAL OFFICE =====
  office_class_abc: [
    {
      name: 'Rental (Core)',
      strength: 'Strong',
      defaults: {
        holdPeriod: '7-10 years',
        exitStrategy: 'Cap Rate',
        keyMetrics: ['price_per_sf', 'rent_per_sf', 'cap_rate', 'occupancy'],
        assumptions: {
          capRate: 6.5,
          rentGrowth: 2.5,
          expenseGrowth: 2.0,
          occupancy: 90,
        },
      },
    },
    {
      name: 'Rental (Value-Add)',
      strength: 'Moderate',
      defaults: {
        holdPeriod: '5-7 years',
        exitStrategy: 'Cap Rate',
        keyMetrics: ['price_per_sf', 'rent_per_sf', 'cap_rate', 'renovation_cost'],
        assumptions: {
          capRate: 7.0,
          rentGrowth: 4.0,
          expenseGrowth: 2.5,
          occupancy: 85,
          renovationBudget: 50,
          timeToStabilize: 24,
        },
      },
    },
    {
      name: 'Multifamily Conversion',
      strength: 'Weak',
      defaults: {
        holdPeriod: '3-5 years',
        exitStrategy: 'Cap Rate',
        keyMetrics: ['conversion_cost', 'price_per_unit', 'rent_per_sf', 'stabilized_cap'],
        assumptions: {
          renovationBudget: 120,
          timeToStabilize: 36,
        },
      },
    },
  ],
  medical_office: [
    {
      name: 'Rental (Core)',
      strength: 'Strong',
      defaults: {
        holdPeriod: '7-10 years',
        exitStrategy: 'Cap Rate',
        keyMetrics: ['price_per_sf', 'rent_per_sf', 'cap_rate', 'occupancy'],
        assumptions: {
          capRate: 6.0,
          rentGrowth: 2.5,
          expenseGrowth: 2.0,
          occupancy: 92,
        },
      },
    },
    {
      name: 'Rental (Value-Add)',
      strength: 'Moderate',
      defaults: {
        holdPeriod: '5-7 years',
        exitStrategy: 'Cap Rate',
        keyMetrics: ['price_per_sf', 'rent_per_sf', 'cap_rate', 'renovation_cost'],
        assumptions: {
          capRate: 6.5,
          rentGrowth: 4.0,
          expenseGrowth: 2.5,
          occupancy: 88,
          renovationBudget: 60,
          timeToStabilize: 24,
        },
      },
    },
  ],

  // ===== RETAIL =====
  strip_centers: [
    {
      name: 'Rental (Core)',
      strength: 'Strong',
      defaults: {
        holdPeriod: '7-10 years',
        exitStrategy: 'Cap Rate',
        keyMetrics: ['price_per_sf', 'rent_per_sf', 'cap_rate', 'occupancy'],
        assumptions: {
          capRate: 7.0,
          rentGrowth: 2.0,
          expenseGrowth: 2.0,
          occupancy: 92,
        },
      },
    },
    {
      name: 'Rental (Value-Add)',
      strength: 'Strong',
      defaults: {
        holdPeriod: '5-7 years',
        exitStrategy: 'Cap Rate',
        keyMetrics: ['price_per_sf', 'rent_per_sf', 'cap_rate', 'renovation_cost'],
        assumptions: {
          capRate: 7.5,
          rentGrowth: 3.5,
          expenseGrowth: 2.5,
          occupancy: 88,
          renovationBudget: 35,
          timeToStabilize: 18,
        },
      },
    },
  ],
  regional_malls: [
    {
      name: 'Rental (Value-Add)',
      strength: 'Moderate',
      defaults: {
        holdPeriod: '5-7 years',
        exitStrategy: 'Cap Rate',
        keyMetrics: ['price_per_sf', 'rent_per_sf', 'cap_rate', 'renovation_cost'],
        assumptions: {
          capRate: 8.5,
          rentGrowth: 3.0,
          expenseGrowth: 3.0,
          occupancy: 80,
          renovationBudget: 60,
          timeToStabilize: 36,
        },
      },
    },
    {
      name: 'Mixed-Use Redevelopment',
      strength: 'Weak',
      defaults: {
        holdPeriod: '5-10 years',
        exitStrategy: 'Mixed Exit',
        keyMetrics: ['redevelopment_cost', 'stabilized_noi', 'blended_cap', 'irr'],
        assumptions: {
          renovationBudget: 150,
          timeToStabilize: 60,
        },
      },
    },
  ],

  // ===== INDUSTRIAL =====
  warehouse_distribution: [
    {
      name: 'Rental (Core)',
      strength: 'Strong',
      defaults: {
        holdPeriod: '7-10 years',
        exitStrategy: 'Cap Rate',
        keyMetrics: ['price_per_sf', 'rent_per_sf', 'cap_rate', 'occupancy'],
        assumptions: {
          capRate: 5.5,
          rentGrowth: 3.5,
          expenseGrowth: 2.0,
          occupancy: 95,
        },
      },
    },
    {
      name: 'Rental (Value-Add)',
      strength: 'Moderate',
      defaults: {
        holdPeriod: '5-7 years',
        exitStrategy: 'Cap Rate',
        keyMetrics: ['price_per_sf', 'rent_per_sf', 'cap_rate', 'renovation_cost'],
        assumptions: {
          capRate: 6.0,
          rentGrowth: 5.0,
          expenseGrowth: 2.5,
          occupancy: 90,
          renovationBudget: 25,
          timeToStabilize: 18,
        },
      },
    },
  ],
  data_centers: [
    {
      name: 'Rental (Core)',
      strength: 'Strong',
      defaults: {
        holdPeriod: '7-10 years',
        exitStrategy: 'Cap Rate',
        keyMetrics: ['price_per_mw', 'revenue_per_mw', 'cap_rate', 'uptime'],
        assumptions: {
          capRate: 6.5,
          rentGrowth: 4.0,
          expenseGrowth: 3.0,
          occupancy: 98,
        },
      },
    },
  ],

  // ===== HOSPITALITY =====
  limited_service_hotels: [
    {
      name: 'Rental (Value-Add)',
      strength: 'Strong',
      defaults: {
        holdPeriod: '5-7 years',
        exitStrategy: 'Cap Rate',
        keyMetrics: ['price_per_key', 'revpar', 'cap_rate', 'occupancy'],
        assumptions: {
          capRate: 8.0,
          rentGrowth: 4.0,
          expenseGrowth: 3.0,
          occupancy: 70,
          renovationBudget: 25000,
          timeToStabilize: 18,
        },
      },
    },
    {
      name: 'Multifamily Conversion',
      strength: 'Moderate',
      defaults: {
        holdPeriod: '3-5 years',
        exitStrategy: 'Cap Rate',
        keyMetrics: ['conversion_cost', 'price_per_unit', 'rent_per_sf', 'stabilized_cap'],
        assumptions: {
          renovationBudget: 80000,
          timeToStabilize: 24,
        },
      },
    },
  ],

  // ===== SPECIAL PURPOSE =====
  self_storage: [
    {
      name: 'Rental (Core)',
      strength: 'Strong',
      defaults: {
        holdPeriod: '7-10 years',
        exitStrategy: 'Cap Rate',
        keyMetrics: ['price_per_sf', 'revenue_per_sf', 'cap_rate', 'occupancy'],
        assumptions: {
          capRate: 6.5,
          rentGrowth: 3.0,
          expenseGrowth: 2.0,
          occupancy: 88,
        },
      },
    },
    {
      name: 'Rental (Value-Add)',
      strength: 'Strong',
      defaults: {
        holdPeriod: '5-7 years',
        exitStrategy: 'Cap Rate',
        keyMetrics: ['price_per_sf', 'revenue_per_sf', 'cap_rate', 'renovation_cost'],
        assumptions: {
          capRate: 7.0,
          rentGrowth: 5.0,
          expenseGrowth: 2.5,
          occupancy: 82,
          renovationBudget: 15,
          timeToStabilize: 18,
        },
      },
    },
  ],

  // ===== LAND =====
  raw_undeveloped: [
    {
      name: 'Build & Sell (Ground-Up)',
      strength: 'Strong',
      defaults: {
        holdPeriod: '3-5 years',
        exitStrategy: 'Direct Sale',
        keyMetrics: ['land_cost', 'development_cost', 'sale_price', 'profit_margin'],
        assumptions: {
          renovationBudget: 0,
          timeToStabilize: 48,
        },
      },
    },
    {
      name: 'Land Banking',
      strength: 'Moderate',
      defaults: {
        holdPeriod: '5-10 years',
        exitStrategy: 'Direct Sale',
        keyMetrics: ['price_per_acre', 'appreciation_rate', 'holding_cost', 'exit_price'],
        assumptions: {},
      },
    },
  ],
  entitled_approved: [
    {
      name: 'Build & Sell (Ground-Up)',
      strength: 'Strong',
      defaults: {
        holdPeriod: '2-4 years',
        exitStrategy: 'Direct Sale',
        keyMetrics: ['land_cost', 'development_cost', 'sale_price', 'profit_margin'],
        assumptions: {
          timeToStabilize: 36,
        },
      },
    },
  ],

  // ===== MIXED-USE =====
  vertical_mixed_use: [
    {
      name: 'Rental (Core)',
      strength: 'Moderate',
      defaults: {
        holdPeriod: '7-10 years',
        exitStrategy: 'Mixed Exit',
        keyMetrics: ['blended_cap', 'noi', 'debt_yield', 'dscr'],
        assumptions: {
          capRate: 5.5,
          rentGrowth: 3.5,
          expenseGrowth: 2.5,
          occupancy: 93,
        },
      },
    },
    {
      name: 'Condo Conversion',
      strength: 'Weak',
      defaults: {
        holdPeriod: '3-5 years',
        exitStrategy: 'Unit Sales',
        keyMetrics: ['conversion_cost', 'price_per_unit', 'absorption_rate', 'profit_margin'],
        assumptions: {
          renovationBudget: 55000,
          timeToStabilize: 36,
        },
      },
    },
  ],
};

/**
 * Get applicable strategies for a given property type
 */
export const getStrategiesForPropertyType = (propertyTypeKey: string): PropertyTypeStrategy[] => {
  return PROPERTY_TYPE_STRATEGIES[propertyTypeKey] || [];
};

/**
 * Get default financial assumptions for a specific property type + strategy combination
 */
export const getStrategyDefaults = (
  propertyTypeKey: string,
  strategyName: string
): StrategyDefaults | null => {
  const strategies = getStrategiesForPropertyType(propertyTypeKey);
  const match = strategies.find(s => s.name === strategyName);
  return match ? match.defaults : null;
};

/**
 * Get all property type keys that have strategy mappings
 */
export const getSupportedPropertyTypes = (): string[] => {
  return Object.keys(PROPERTY_TYPE_STRATEGIES);
};
