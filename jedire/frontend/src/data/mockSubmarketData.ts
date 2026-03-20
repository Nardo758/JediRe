/**
 * Mock data for Submarket Performance Table
 * Realistic Atlanta metro multifamily data
 */

export const mockSubmarketData = [
  {
    id: 'buckhead',
    name: 'Buckhead',
    rank: 1,
    totalUnits: 12504,
    rents: {
      all: 1850,
      y2020plus: 2100,
      y2010s: 1920,
      y2000s: 1650,
      pre2000: 1480,
    },
    occupancy: {
      all: 94.5,
      y2020plus: 96.2,
      y2010s: 94.8,
      y2000s: 93.1,
      pre2000: 91.5,
    },
    demand: 250,
    underConstruction: 425,
    compositeScore: 88,
    properties: [
      { id: 'p1', name: 'Park Avenue Apartments', units: 240, yearBuilt: 2020, avgRent: 2100, occupancy: 96.2, owner: 'CPI LLC', distance: 0.8, propertyClass: 'A' as const },
      { id: 'p2', name: 'Skyline Towers', units: 180, yearBuilt: 2018, avgRent: 1950, occupancy: 94.5, owner: 'Equity Residential', distance: 1.2, propertyClass: 'A' as const },
      { id: 'p3', name: 'Riverside Commons', units: 320, yearBuilt: 2015, avgRent: 1850, occupancy: 93.8, owner: 'Greystar', distance: 1.5, propertyClass: 'A' as const },
      { id: 'p4', name: 'Peachtree Heights', units: 156, yearBuilt: 2021, avgRent: 2250, occupancy: 97.1, owner: 'MAA', distance: 0.6, propertyClass: 'A' as const },
      { id: 'p5', name: 'Buckhead Station', units: 280, yearBuilt: 2012, avgRent: 1780, occupancy: 92.4, owner: 'Camden', distance: 1.8, propertyClass: 'B' as const },
      { id: 'p6', name: 'Lenox Village', units: 195, yearBuilt: 2008, avgRent: 1620, occupancy: 91.2, owner: 'Alliance Residential', distance: 2.1, propertyClass: 'B' as const },
    ],
  },
  {
    id: 'midtown',
    name: 'Midtown',
    rank: 2,
    totalUnits: 14415,
    rents: {
      all: 1780,
      y2020plus: 2050,
      y2010s: 1850,
      y2000s: 1600,
      pre2000: 1450,
    },
    occupancy: {
      all: 92.3,
      y2020plus: 94.1,
      y2010s: 92.7,
      y2000s: 91.2,
      pre2000: 89.8,
    },
    demand: 180,
    underConstruction: 320,
    compositeScore: 82,
    properties: [
      { id: 'p7', name: 'Metropolis at Midtown', units: 310, yearBuilt: 2019, avgRent: 2000, occupancy: 93.8, owner: 'Arium', distance: 0.5, propertyClass: 'A' as const },
      { id: 'p8', name: 'Atlantic Station Lofts', units: 225, yearBuilt: 2016, avgRent: 1880, occupancy: 92.1, owner: 'JPI', distance: 0.9, propertyClass: 'A' as const },
      { id: 'p9', name: 'Brickworks', units: 180, yearBuilt: 2013, avgRent: 1750, occupancy: 91.5, owner: 'Cortland', distance: 1.2, propertyClass: 'B' as const },
      { id: 'p10', name: 'Tech Square Apartments', units: 265, yearBuilt: 2022, avgRent: 2180, occupancy: 95.2, owner: 'Asset Living', distance: 0.3, propertyClass: 'A' as const },
      { id: 'p11', name: 'Colony Square', units: 142, yearBuilt: 2007, avgRent: 1590, occupancy: 89.7, owner: 'Post Properties', distance: 1.5, propertyClass: 'B' as const },
    ],
  },
  {
    id: 'sandy-springs',
    name: 'Sandy Springs',
    rank: 3,
    totalUnits: 9204,
    rents: {
      all: 1650,
      y2020plus: 1920,
      y2010s: 1720,
      y2000s: 1480,
      pre2000: 1350,
    },
    occupancy: {
      all: 90.8,
      y2020plus: 93.2,
      y2010s: 90.5,
      y2000s: 89.1,
      pre2000: 88.2,
    },
    demand: 120,
    underConstruction: 245,
    compositeScore: 74,
    properties: [
      { id: 'p12', name: 'Glenridge Heights', units: 198, yearBuilt: 2020, avgRent: 1900, occupancy: 92.8, owner: 'Lincoln Property', distance: 0.7, propertyClass: 'A' as const },
      { id: 'p13', name: 'Perimeter Place', units: 285, yearBuilt: 2014, avgRent: 1750, occupancy: 90.3, owner: 'Related', distance: 1.3, propertyClass: 'B' as const },
      { id: 'p14', name: 'Riverside Park', units: 156, yearBuilt: 2009, avgRent: 1520, occupancy: 88.9, owner: 'Fairfield Residential', distance: 1.9, propertyClass: 'B' as const },
      { id: 'p15', name: 'Hammond Woods', units: 220, yearBuilt: 2017, avgRent: 1820, occupancy: 91.4, owner: 'BH Management', distance: 1.1, propertyClass: 'A' as const },
    ],
  },
  {
    id: 'downtown',
    name: 'Downtown',
    rank: 4,
    totalUnits: 11892,
    rents: {
      all: 1580,
      y2020plus: 1890,
      y2010s: 1650,
      y2000s: 1420,
      pre2000: 1280,
    },
    occupancy: {
      all: 87.2,
      y2020plus: 90.5,
      y2010s: 88.1,
      y2000s: 85.8,
      pre2000: 83.4,
    },
    demand: -45,
    underConstruction: 580,
    compositeScore: 62,
    properties: [
      { id: 'p16', name: 'Five Points Lofts', units: 175, yearBuilt: 2021, avgRent: 1950, occupancy: 91.2, owner: 'NRP', distance: 0.4, propertyClass: 'A' as const },
      { id: 'p17', name: 'Centennial Tower', units: 310, yearBuilt: 2015, avgRent: 1680, occupancy: 88.5, owner: 'Wood Partners', distance: 0.8, propertyClass: 'A' as const },
      { id: 'p18', name: 'Underground Atlanta Apartments', units: 142, yearBuilt: 2010, avgRent: 1520, occupancy: 85.3, owner: 'Mill Creek', distance: 1.2, propertyClass: 'B' as const },
      { id: 'p19', name: 'Peachtree Center Residences', units: 228, yearBuilt: 2018, avgRent: 1750, occupancy: 89.1, owner: 'Crescent', distance: 0.6, propertyClass: 'A' as const },
    ],
  },
  {
    id: 'decatur',
    name: 'Decatur',
    rank: 5,
    totalUnits: 6845,
    rents: {
      all: 1620,
      y2020plus: 1880,
      y2010s: 1680,
      y2000s: 1450,
      pre2000: 1320,
    },
    occupancy: {
      all: 91.5,
      y2020plus: 94.0,
      y2010s: 91.8,
      y2000s: 90.2,
      pre2000: 88.6,
    },
    demand: 85,
    underConstruction: 185,
    compositeScore: 68,
    properties: [
      { id: 'p20', name: 'Decatur Square', units: 164, yearBuilt: 2019, avgRent: 1850, occupancy: 93.5, owner: 'Trammell Crow', distance: 0.5, propertyClass: 'A' as const },
      { id: 'p21', name: 'Oakhurst Village', units: 118, yearBuilt: 2016, avgRent: 1720, occupancy: 91.2, owner: 'Pollack Shores', distance: 1.0, propertyClass: 'A' as const },
      { id: 'p22', name: 'Agnes Scott Apartments', units: 195, yearBuilt: 2011, avgRent: 1580, occupancy: 89.8, owner: 'Benchmark', distance: 1.4, propertyClass: 'B' as const },
    ],
  },
];

export const mockTransactionData = {
  topSales: [
    { id: 's1', property: '3500 Peachtree Rd', submarket: 'Buckhead', size: 25800, price: 24230000, buyer: 'CPI Phipps LLC', seller: 'Kansas City Life Insurance', buildingClass: 'A' },
    { id: 's2', property: 'Park Avenue Complex', submarket: 'Midtown', size: 30392, price: 19181000, buyer: 'Greystone', seller: 'Gilco Development', buildingClass: 'A' },
    { id: 's3', property: 'Multiple A2 locations', submarket: 'Sandy Springs', size: 24700, price: 15300000, buyer: 'Lincoln Prop', seller: 'Westcore Properties', buildingClass: 'B' },
  ],
  topLeases: [
    { id: 'l1', property: '1115 W Alameda Dr', submarket: 'Buckhead', size: 479207, tenant: 'Lucid Motors', landlord: 'Harrison Properties', industry: 'Automotive' },
    { id: 'l2', property: '3405 E McQueen Rd', submarket: 'Midtown', size: 201784, tenant: 'Amazon', landlord: 'Ryan Companies', industry: 'E-Commerce' },
    { id: 'l3', property: '2850 N Nevada St', submarket: 'Downtown', size: 184484, tenant: 'Amazon', landlord: 'Westcore Properties', industry: 'E-Commerce' },
  ],
};

export const mockMarketIndicators = {
  netAbsorption: 420,
  vacancyRate: 6.8,
  avgRent: 1725,
  pipeline: 1755,
  rentGrowth: 5.2, // YoY %
  newDeliveries: 285,
};
