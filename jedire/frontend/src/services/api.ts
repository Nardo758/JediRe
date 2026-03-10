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
  
  return {
    id: deal.id,
    name: deal.name,
    address: addressParts[0] || deal.address,
    city: addressParts[1] || '',
    state: stateZip[0] || '',
    zip: stateZip[1] || '',
    
    // Basic Info
    propertyType: formatPropertyType(deal.projectType),
    units,
    
    // Financial
    askingPrice: budget,
    estimatedValue: budget ? budget * 1.1 : undefined, // Mock 10% markup
    capRate: calculateMockCapRate(budget, units),
    occupancyRate: 95, // Mock data - would come from real source
    
    // Metadata
    createdAt: deal.createdAt,
    updatedAt: deal.updatedAt,
    dataSource: 'JediRe Platform API',
    
    // Status
    status: deal.status,
    state: deal.state,
    tier: deal.tier,
    dealCategory: deal.dealCategory,
  };
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

function calculateMockCapRate(budget?: number, units?: number): number | undefined {
  if (!budget || !units) return undefined;
  
  // Mock cap rate calculation based on property size
  const pricePerUnit = budget / units;
  
  if (pricePerUnit < 100000) return 6.5;
  if (pricePerUnit < 200000) return 5.5;
  if (pricePerUnit < 300000) return 4.8;
  return 4.2;
}

export default {
  fetchDeals,
  fetchDealById,
  fetchDealByName,
  checkHealth,
  runAnalysis,
  getAgentTask,
  mapDealToProperty,
};
