/**
 * JediRe Platform API Service
 * Connects Terminal UI components to real property data
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev';
const API_TOKEN = import.meta.env.VITE_API_TOKEN || '69295404e382acd00de4facdaa053fd20ae0a1cf15dc63c0b8a55cffc0e088b6';

interface Deal {
  id: string;
  name: string;
  projectType: string;
  status: string;
  state: string;
  tier: string;
  budget: string | null;
  targetUnits: number | null;
  dealCategory: string;
  address: string;
  createdAt: string;
  updatedAt: string;
  propertyCount: number;
  pendingTasks: number;
}

interface DealsResponse {
  success: boolean;
  result: {
    deals: Deal[];
    total: number;
    limit: number;
    offset: number;
  };
}

interface CommandResponse {
  success: boolean;
  timestamp: string;
  result?: any;
  error?: string;
  message?: string;
}

/**
 * Fetch all deals from the platform
 */
export async function fetchDeals(): Promise<Deal[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/clawdbot/command`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ command: 'get_deals' }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: DealsResponse = await response.json();
    
    if (!data.success) {
      throw new Error('Failed to fetch deals');
    }

    return data.result.deals;
  } catch (error) {
    console.error('Error fetching deals:', error);
    throw error;
  }
}

/**
 * Fetch a single deal by ID
 * Note: get_deal command has SQL error, so we filter from get_deals instead
 */
export async function fetchDealById(dealId: string): Promise<Deal | null> {
  try {
    const deals = await fetchDeals();
    return deals.find(d => d.id === dealId) || null;
  } catch (error) {
    console.error('Error fetching deal by ID:', error);
    throw error;
  }
}

/**
 * Fetch a single deal by name
 */
export async function fetchDealByName(name: string): Promise<Deal | null> {
  try {
    const deals = await fetchDeals();
    return deals.find(d => d.name.toLowerCase().includes(name.toLowerCase())) || null;
  } catch (error) {
    console.error('Error fetching deal by name:', error);
    throw error;
  }
}

/**
 * Check API health status
 */
export async function checkHealth(): Promise<{ status: string; webhookConfigured: boolean }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/clawdbot/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error checking health:', error);
    throw error;
  }
}

/**
 * Run an analysis task
 */
export async function runAnalysis(
  dealId: string, 
  taskType: 'zoning' | 'supply' | 'cashflow' | 'full',
  inputData?: any
): Promise<{ taskId: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/clawdbot/command`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        command: 'run_analysis',
        dealId,
        taskType,
        inputData 
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: CommandResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to run analysis');
    }

    return data.result;
  } catch (error) {
    console.error('Error running analysis:', error);
    throw error;
  }
}

/**
 * Get agent task status
 */
export async function getAgentTask(taskId: string): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/clawdbot/command`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        command: 'get_agent_task',
        taskId 
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: CommandResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to get task');
    }

    return data.result;
  } catch (error) {
    console.error('Error getting agent task:', error);
    throw error;
  }
}

/**
 * Map Deal to PropertyData interface used by PropertyDetailsPage
 */
export function mapDealToProperty(deal: Deal): any {
  const budget = deal.budget ? parseFloat(deal.budget) : undefined;
  const units = deal.targetUnits || 0;
  
  // Parse address
  const addressParts = deal.address.split(',').map(s => s.trim());
  const stateZip = (addressParts[2] || '').split(' ').filter(Boolean);
  
  // Enhanced calculations with market intelligence
  const propertyMetrics = calculatePropertyMetrics(deal.projectType, units, budget);
  
  return {
    id: deal.id,
    name: deal.name,
    address: addressParts[0] || deal.address,
    city: addressParts[1] || '',
    state: stateZip[0] || '',
    zip: stateZip[1] || '',
    
    // Basic Info (some estimated based on market data)
    propertyType: formatPropertyType(deal.projectType),
    units,
    yearBuilt: estimateYearBuilt(deal.state), // Estimated based on deal stage
    totalSqft: propertyMetrics.totalSqft, // Calculated from units * avg unit size
    lotSize: propertyMetrics.lotAcres, // Calculated from units / density
    
    // Financial (mix of real and calculated)
    askingPrice: budget, // REAL from API
    estimatedValue: budget ? budget * 1.05 : undefined, // 5% over budget (conservative)
    monthlyRent: propertyMetrics.avgRentPerUnit * units, // Calculated
    annualIncome: propertyMetrics.annualIncome, // Calculated
    noi: propertyMetrics.noi, // Calculated
    capRate: propertyMetrics.capRate, // Calculated from NOI / budget
    occupancyRate: propertyMetrics.occupancyRate, // Market average
    
    // Metadata
    createdAt: deal.createdAt,
    updatedAt: deal.updatedAt,
    dataSource: 'JediRe Platform API (Enhanced with Market Estimates)',
    dataQuality: {
      real: ['id', 'name', 'address', 'budget', 'units', 'projectType'],
      calculated: ['noi', 'capRate', 'monthlyRent', 'annualIncome'],
      estimated: ['yearBuilt', 'totalSqft', 'lotSize', 'occupancyRate'],
    },
    
    // Status (REAL from API)
    status: deal.status,
    state: deal.state,
    tier: deal.tier,
    dealCategory: deal.dealCategory,
  };
}

/**
 * Calculate property metrics based on market intelligence
 * Uses industry standards and market data for missing fields
 */
function calculatePropertyMetrics(propertyType: string, units: number, budget?: number) {
  // Average unit sizes by property type (sq ft)
  const avgUnitSizes: Record<string, number> = {
    'multifamily': 900,
    'residential': 1200,
    'townhome': 1400,
    'senior_living': 750,
    'mixed_use': 950,
  };
  
  // Average density (units per acre)
  const avgDensity: Record<string, number> = {
    'multifamily': 30, // Mid-rise
    'residential': 8,
    'townhome': 12,
    'senior_living': 25,
    'mixed_use': 35,
  };
  
  // Average rent per unit per month (national averages, adjust by market)
  const avgRentPerUnit: Record<string, number> = {
    'multifamily': 1850,
    'residential': 2200,
    'townhome': 2400,
    'senior_living': 3500,
    'mixed_use': 2000,
  };
  
  // Occupancy rates by type
  const avgOccupancy: Record<string, number> = {
    'multifamily': 95.0,
    'residential': 96.5,
    'townhome': 94.0,
    'senior_living': 92.0,
    'mixed_use': 93.0,
  };
  
  // Operating expense ratios (% of gross income)
  const opexRatio: Record<string, number> = {
    'multifamily': 0.45, // 45% of gross income
    'residential': 0.40,
    'townhome': 0.42,
    'senior_living': 0.55, // Higher due to services
    'mixed_use': 0.48,
  };
  
  const unitSize = avgUnitSizes[propertyType] || 900;
  const density = avgDensity[propertyType] || 30;
  const rentPerUnit = avgRentPerUnit[propertyType] || 1850;
  const occupancyRate = avgOccupancy[propertyType] || 95.0;
  const opex = opexRatio[propertyType] || 0.45;
  
  // Calculations
  const totalSqft = units * unitSize;
  const lotAcres = units / density;
  const grossMonthlyIncome = rentPerUnit * units * (occupancyRate / 100);
  const annualIncome = grossMonthlyIncome * 12;
  const operatingExpenses = annualIncome * opex;
  const noi = annualIncome - operatingExpenses;
  const capRate = budget ? (noi / budget) * 100 : 5.0; // Default 5% if no budget
  
  return {
    totalSqft,
    lotAcres: parseFloat(lotAcres.toFixed(2)),
    avgRentPerUnit: rentPerUnit,
    annualIncome: Math.round(annualIncome),
    operatingExpenses: Math.round(operatingExpenses),
    noi: Math.round(noi),
    capRate: parseFloat(capRate.toFixed(2)),
    occupancyRate,
  };
}

/**
 * Estimate year built based on deal stage
 * New development = future year, existing = recent year
 */
function estimateYearBuilt(dealState: string): number {
  const currentYear = new Date().getFullYear();
  
  // If in early stages, assume new development (future completion)
  if (['SIGNAL_INTAKE', 'INTELLIGENCE_ASSEMBLY', 'TRIAGE'].includes(dealState)) {
    return currentYear + 2; // 2 years from now
  }
  
  // If in underwriting/packaging, assume near-term
  if (['UNDERWRITING', 'DEAL_PACKAGING'].includes(dealState)) {
    return currentYear + 1;
  }
  
  // Post-close, assume recently built
  return currentYear;
}

function formatPropertyType(type: string): string {
  const types: Record<string, string> = {
    'multifamily': 'Multifamily',
    'residential': 'Residential',
    'retail': 'Retail',
    'office': 'Office',
    'industrial': 'Industrial',
    'mixed_use': 'Mixed-Use',
    'townhome': 'Townhome',
    'senior_living': 'Senior Living',
  };
  return types[type] || type;
}

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('auth_token');
  return token
    ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
};

export const api = {
  async get(path: string) {
    const res = await fetch(`${API_BASE_URL}/api/v1${path}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return { data: await res.json() };
  },
  async post(path: string, body?: any) {
    const res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return { data: await res.json() };
  },
  async put(path: string, body?: any) {
    const res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return { data: await res.json() };
  },
  async delete(path: string) {
    const res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return { data: await res.json() };
  },
};

export const authAPI = {
  async login(email: string, password: string) {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Login failed');
    return res.json();
  },
  async register(email: string, password: string, name: string) {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) throw new Error('Registration failed');
    return res.json();
  },
  async me() {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Not authenticated');
    return res.json();
  },
  async logout() {
    await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  },
};

export default {
  fetchDeals,
  fetchDealById,
  fetchDealByName,
  checkHealth,
  runAnalysis,
  getAgentTask,
  mapDealToProperty,
};
