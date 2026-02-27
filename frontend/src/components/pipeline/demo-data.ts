/**
 * Demo data generator for Pipeline Map View
 * Use this for testing and development before real geocoding is implemented
 */

import { PipelineDeal } from '@/types/grid';

const ATLANTA_BOUNDS = {
  minLat: 33.6,
  maxLat: 34.0,
  minLng: -84.6,
  maxLng: -84.2,
};

const STAGES = [
  'sourcing',
  'underwriting',
  'due diligence',
  'under contract',
  'closing',
  'passed',
];

const ASSET_TYPES = [
  'Multifamily',
  'Single Family',
  'Mixed Use',
  'Retail',
  'Office',
  'Industrial',
];

const STRATEGIES = [
  'build_to_sell',
  'flip',
  'rental',
  'hold',
];

const SOURCES = [
  'LoopNet',
  'CoStar',
  'Direct Outreach',
  'Broker Network',
  'MLS',
  'Off Market',
];

const PROPERTY_NAMES = [
  'Buckhead Towers',
  'Peachtree Plaza',
  'Midtown Commons',
  'Virginia Highlands Lofts',
  'Decatur Square Apartments',
  'East Atlanta Village Flats',
  'Brookhaven Heights',
  'Sandy Springs Estates',
  'Chamblee Station Residences',
  'Inman Park Terraces',
  'Westside Provisions',
  'Old Fourth Ward Lofts',
  'Poncey-Highland Residences',
  'Grant Park Manor',
  'Candler Park Apartments',
];

/**
 * Generate random coordinates within Atlanta bounds
 */
function randomCoords(): { lat: number; lng: number } {
  const lat = ATLANTA_BOUNDS.minLat + Math.random() * (ATLANTA_BOUNDS.maxLat - ATLANTA_BOUNDS.minLat);
  const lng = ATLANTA_BOUNDS.minLng + Math.random() * (ATLANTA_BOUNDS.maxLng - ATLANTA_BOUNDS.minLng);
  return { lat, lng };
}

/**
 * Generate random number in range
 */
function randomRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate random date in range
 */
function randomDate(start: Date, end: Date): string {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().split('T')[0];
}

/**
 * Pick random item from array
 */
function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a single demo pipeline deal
 */
export function generateDemoDeal(index: number): PipelineDeal {
  const coords = randomCoords();
  const stage = randomPick(STAGES);
  const assetType = randomPick(ASSET_TYPES);
  const strategy = randomPick(STRATEGIES);
  const source = randomPick(SOURCES);
  const unitCount = randomRange(10, 500);
  const askPrice = randomRange(2, 50) * 1000000;
  const jediAdjustedPrice = askPrice * (0.85 + Math.random() * 0.1);
  const brokerIRR = 8 + Math.random() * 12;
  const jediIRR = brokerIRR + (Math.random() - 0.3) * 5;
  const aiScore = randomRange(40, 100);
  const daysInStage = randomRange(1, 120);
  const supplyRisk = Math.random() < 0.15; // 15% have supply risk
  const imbalanceScore = randomRange(30, 90);
  const ddPct = stage === 'due diligence' || stage === 'under contract' || stage === 'closing'
    ? randomRange(0, 100)
    : 0;
  
  const propertyName = index < PROPERTY_NAMES.length 
    ? PROPERTY_NAMES[index]
    : `${randomPick(['The', 'New', 'Park', 'River', 'Lake', 'Summit'])} ${randomPick(['Heights', 'Plaza', 'Towers', 'Commons', 'Gardens', 'Estates'])} ${index}`;
  
  const neighborhood = randomPick([
    'Buckhead',
    'Midtown',
    'Virginia Highland',
    'Decatur',
    'East Atlanta',
    'Brookhaven',
    'Sandy Springs',
  ]);
  
  return {
    id: `demo-deal-${index}`,
    property_name: propertyName,
    address: `${randomRange(100, 9999)} ${neighborhood} ${randomPick(['St', 'Ave', 'Rd', 'Blvd', 'Pkwy'])}, ${neighborhood}, GA 30${randomRange(300, 399)}`,
    asset_type: assetType,
    unit_count: unitCount,
    pipeline_stage: stage,
    days_in_stage: daysInStage,
    ai_opportunity_score: aiScore,
    ask_price: askPrice,
    jedi_adjusted_price: jediAdjustedPrice,
    broker_projected_irr: brokerIRR,
    jedi_adjusted_irr: jediIRR,
    noi: askPrice * 0.05, // 5% cap rate approximation
    best_strategy: strategy,
    strategy_confidence: randomRange(60, 95),
    supply_risk_flag: supplyRisk,
    imbalance_score: imbalanceScore,
    source: source,
    loi_deadline: stage === 'underwriting' || stage === 'due diligence' 
      ? randomDate(new Date(), new Date(Date.now() + 30 * 86400000))
      : '',
    closing_date: stage === 'under contract' || stage === 'closing'
      ? randomDate(new Date(), new Date(Date.now() + 90 * 86400000))
      : '',
    dd_checklist_pct: ddPct,
    created_at: randomDate(new Date(Date.now() - 180 * 86400000), new Date()),
    
    // Add coordinates for map view
    lat: coords.lat,
    lng: coords.lng,
    geocoded_at: new Date().toISOString(),
  };
}

/**
 * Generate array of demo deals
 */
export function generateDemoDeals(count: number = 50): PipelineDeal[] {
  return Array.from({ length: count }, (_, i) => generateDemoDeal(i));
}

/**
 * Generate demo deals with specific characteristics for testing
 */
export function generateTestScenarios(): {
  allClustered: PipelineDeal[];
  allSpread: PipelineDeal[];
  mixedStages: PipelineDeal[];
  highValueOnly: PipelineDeal[];
  withSupplyRisk: PipelineDeal[];
} {
  // All clustered in one area (Buckhead)
  const allClustered = Array.from({ length: 20 }, (_, i) => {
    const deal = generateDemoDeal(i);
    return {
      ...deal,
      lat: 33.84 + (Math.random() - 0.5) * 0.05, // Tight cluster
      lng: -84.38 + (Math.random() - 0.5) * 0.05,
    };
  });

  // All spread out across Atlanta
  const allSpread = generateDemoDeals(50);

  // Mixed stages with good distribution
  const mixedStages = STAGES.flatMap((stage, stageIdx) => 
    Array.from({ length: 8 }, (_, i) => ({
      ...generateDemoDeal(stageIdx * 8 + i),
      pipeline_stage: stage,
    }))
  );

  // Only high-value deals (>$10M)
  const highValueOnly = Array.from({ length: 25 }, (_, i) => ({
    ...generateDemoDeal(i),
    ask_price: randomRange(10, 50) * 1000000,
    ai_opportunity_score: randomRange(70, 100), // High scores
  }));

  // Only deals with supply risk
  const withSupplyRisk = Array.from({ length: 15 }, (_, i) => ({
    ...generateDemoDeal(i),
    supply_risk_flag: true,
    imbalance_score: randomRange(20, 50), // Low scores = high risk
  }));

  return {
    allClustered,
    allSpread,
    mixedStages,
    highValueOnly,
    withSupplyRisk,
  };
}

/**
 * Generate deals along a specific route (for testing radius tool)
 */
export function generateDealsAlongRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  count: number = 10
): PipelineDeal[] {
  return Array.from({ length: count }, (_, i) => {
    const progress = i / (count - 1);
    const lat = startLat + (endLat - startLat) * progress;
    const lng = startLng + (endLng - startLng) * progress;
    
    // Add some random offset
    const offsetLat = lat + (Math.random() - 0.5) * 0.01;
    const offsetLng = lng + (Math.random() - 0.5) * 0.01;
    
    return {
      ...generateDemoDeal(i),
      lat: offsetLat,
      lng: offsetLng,
    };
  });
}

/**
 * Generate deals in a circular pattern (for testing clustering)
 */
export function generateDealsInCircle(
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  count: number = 20
): PipelineDeal[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * 2 * Math.PI;
    const radiusDeg = radiusKm / 111; // 1 degree ≈ 111 km
    
    const lat = centerLat + radiusDeg * Math.sin(angle);
    const lng = centerLng + radiusDeg * Math.cos(angle);
    
    return {
      ...generateDemoDeal(i),
      lat,
      lng,
    };
  });
}

/**
 * Sample usage:
 * 
 * // Generate 50 random deals
 * const deals = generateDemoDeals(50);
 * 
 * // Generate specific test scenarios
 * const { allClustered, mixedStages } = generateTestScenarios();
 * 
 * // Generate deals along a route (e.g., I-85 corridor)
 * const i85Deals = generateDealsAlongRoute(33.749, -84.388, 33.920, -84.340, 15);
 * 
 * // Generate deals in a circle around Buckhead
 * const buckheadDeals = generateDealsInCircle(33.84, -84.38, 5, 25);
 */
