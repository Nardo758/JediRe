// ============================================================================
// JEDI RE Feature Showcase - Mock Data Generator
// ============================================================================

import type {
  Deal, TeamMember, TimelineEvent, Document, Task, Note,
  Property, FinancialSnapshot, RiskFlag, Decision, Strategy,
  MarketSignal, SupplyPipelineUnit, NewsEvent, Contact, Module,
  Comparable, FinancialChange, StrategyMetric
} from '../types/showcase.types';

const DEAL_NAMES = [
  'Riverside Apartments',
  'Downtown Mixed-Use Development',
  'Oakwood Garden Complex'
];

const ADDRESSES = [
  { address: '1234 River Street', city: 'Austin', state: 'TX', zip: '78701', lat: 30.2672, lng: -97.7431 },
  { address: '567 Main Street', city: 'Denver', state: 'CO', zip: '80202', lat: 39.7392, lng: -104.9903 },
  { address: '890 Oak Avenue', city: 'Phoenix', state: 'AZ', zip: '85001', lat: 33.4484, lng: -112.0740 }
];

// ============================================================================
// MOCK DATA GENERATORS
// ============================================================================

export class ShowcaseDataService {
  
  // Generate 3 complete deals with all data
  static getDeals(): Deal[] {
    return [0, 1, 2].map(i => this.generateDeal(i));
  }

  static getDealById(id: string): Deal | undefined {
    const deals = this.getDeals();
    return deals.find(d => d.id === id);
  }

  static generateDeal(index: number): Deal {
    const dealId = `deal-${index + 1}`;
    const location = ADDRESSES[index];
    const team = this.generateTeamMembers(dealId);
    
    return {
      id: dealId,
      name: DEAL_NAMES[index],
      ...location,
      status: ['analyzing', 'due-diligence', 'closing'][index] as any,
      stage: ['Underwriting', 'Due Diligence', 'Contract Negotiation'][index],
      purchasePrice: [2500000, 8500000, 4200000][index],
      currentValue: [2650000, 8800000, 4300000][index],
      targetIRR: [18.5, 22.3, 16.8][index],
      actualIRR: [19.2, undefined, 17.1][index],
      capRate: [6.8, 7.2, 6.5][index],
      noi: [170000, 612000, 273000][index],
      cashOnCash: [12.5, 15.8, 11.2][index],
      closingDate: [undefined, '2025-04-15', '2025-03-30'][index],
      daysInDeal: [45, 87, 23][index],
      primaryStrategy: ['Value-Add Repositioning', 'Ground-Up Development', 'Opportunistic Acquisition'][index],
      riskScore: [42, 68, 35][index],
      confidence: [85, 72, 91][index],
      propertyType: ['Multifamily', 'Mixed-Use', 'Multifamily'][index],
      units: [24, 86, 32][index],
      sqft: [18500, 95000, 28000][index],
      yearBuilt: [1978, 2025, 1985][index],
      occupancy: [78, 0, 92][index],
      imageUrl: `https://picsum.photos/seed/${dealId}/800/600`,
      team,
      timeline: this.generateTimeline(dealId, 30),
      documents: this.generateDocuments(dealId, 35),
      tasks: this.generateTasks(dealId, 42),
      notes: this.generateNotes(dealId, 8),
      activities: this.generateActivities(dealId, 50),
      properties: this.generateProperties(location, 1),
      financials: this.generateFinancialSnapshot(index),
      risks: this.generateRiskFlags(dealId, 8),
      decisions: this.generateDecisions(dealId, 6)
    };
  }

  static generateTeamMembers(dealId: string): TeamMember[] {
    const roles: TeamMember['role'][] = ['broker', 'lender', 'attorney', 'inspector', 'contractor', 'property-manager'];
    const names = ['Sarah Johnson', 'Michael Chen', 'Emily Rodriguez', 'David Kim', 'Jessica Williams', 'Robert Taylor'];
    const companies = ['Cushman & Wakefield', 'Wells Fargo', 'Thompson Law Group', 'BuildRight Inspections', 'ProConstruction LLC', 'Premier Property Mgmt'];
    
    return roles.map((role, i) => ({
      id: `${dealId}-contact-${i + 1}`,
      name: names[i],
      role,
      email: `${names[i].toLowerCase().replace(' ', '.')}@${companies[i].toLowerCase().replace(/\s+/g, '')}.com`,
      phone: `(555) ${100 + i * 111}-${1000 + i * 234}`,
      company: companies[i],
      responsiveness: (['high', 'high', 'medium', 'high', 'low', 'medium'][i] as any),
      lastContact: this.randomDate(3),
      dealCount: Math.floor(Math.random() * 20) + 5,
      avgResponseTime: ['2 hours', '4 hours', '1 day', '6 hours', '2 days', '8 hours'][i],
      reliability: [95, 88, 92, 96, 78, 85][i]
    }));
  }

  static generateTimeline(dealId: string, count: number): TimelineEvent[] {
    const types: TimelineEvent['type'][] = ['email', 'call', 'meeting', 'document', 'task', 'milestone', 'status-change', 'note'];
    const events: TimelineEvent[] = [];
    
    for (let i = 0; i < count; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      events.push({
        id: `${dealId}-event-${i + 1}`,
        date: this.randomDate(count - i),
        type,
        title: this.getEventTitle(type, i),
        description: this.getEventDescription(type),
        icon: this.getEventIcon(type),
        color: this.getEventColor(type),
        actor: ['Sarah Johnson', 'You', 'Michael Chen', 'System'][Math.floor(Math.random() * 4)],
        expandable: Math.random() > 0.5
      });
    }
    
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  static generateActivities(dealId: string, count: number): Activity[] {
    const timeline = this.generateTimeline(dealId, count);
    return timeline.map(event => ({
      ...event,
      dealId
    }));
  }

  static generateDocuments(dealId: string, count: number): Document[] {
    const categories: Document['category'][] = ['financial', 'legal', 'due-diligence', 'property', 'other'];
    const types = ['PDF', 'Excel', 'Word', 'Image', 'CAD'];
    const names = [
      'Operating Statement Q4 2024', 'Purchase Agreement', 'Inspection Report', 'Property Photos',
      'Rent Roll', 'Title Report', 'Environmental Assessment', 'Appraisal Report',
      'Loan Documents', 'Lease Agreement', 'Zoning Report', 'Survey',
      'Financial Pro Forma', 'Estoppel Certificates', 'Insurance Binder', 'HOA Documents',
      'Property Tax Records', 'Utility Bills', 'Cap Ex Plan', 'Marketing Materials',
      'Building Plans', 'Permits', 'Vendor Contracts', 'Management Agreement',
      'Bank Statements', 'Legal Opinion', 'Phase I ESA', 'Structural Report',
      'Market Analysis', 'Comparable Sales', 'Traffic Study', 'Soil Report',
      'Engineering Report', 'Roof Inspection', 'HVAC Report'
    ];
    
    return Array.from({ length: count }, (_, i) => ({
      id: `${dealId}-doc-${i + 1}`,
      name: names[i % names.length],
      category: categories[Math.floor(Math.random() * categories.length)],
      type: types[Math.floor(Math.random() * types.length)],
      size: Math.floor(Math.random() * 5000000) + 100000,
      uploadedBy: ['You', 'Sarah Johnson', 'Michael Chen', 'System'][Math.floor(Math.random() * 4)],
      uploadedAt: this.randomDate(count - i),
      version: Math.floor(Math.random() * 3) + 1,
      status: (['approved', 'review', 'pending', 'approved'][Math.floor(Math.random() * 4)] as any),
      aiExtracted: Math.random() > 0.3,
      url: `#doc-${i + 1}`
    }));
  }

  static generateTasks(dealId: string, count: number): Task[] {
    const categories: Task['category'][] = ['financial', 'legal', 'inspection', 'environmental', 'title', 'zoning', 'other'];
    const statuses: Task['status'][] = ['completed', 'in-progress', 'pending', 'blocked'];
    const priorities: Task['priority'][] = ['low', 'medium', 'high', 'critical'];
    
    const taskNames = [
      'Review purchase agreement', 'Order appraisal', 'Schedule property inspection',
      'Obtain financing commitment', 'Review title report', 'Environmental assessment',
      'Zoning compliance review', 'Insurance quote', 'HOA document review',
      'Tenant estoppel collection', 'Property survey', 'Structural engineer report',
      'Roof inspection', 'HVAC system evaluation', 'Plumbing inspection',
      'Electrical review', 'Fire safety compliance', 'ADA compliance check',
      'Pest inspection', 'Pool inspection', 'Parking lot assessment',
      'Signage approval', 'Business license verification', 'Tax assessment review',
      'Utility transfer', 'Lease review', 'Rent roll verification',
      'Operating expense analysis', 'Capital expenditure planning', 'Reserve study',
      'Market rent analysis', 'Comparable sales review', 'Financial model update',
      'Lender documentation', 'Legal entity formation', 'Partnership agreement',
      'Property management bid', 'Contractor estimates', 'Architect consultation',
      'Due diligence checklist', 'Closing preparation', 'Walk-through inspection'
    ];
    
    return Array.from({ length: count }, (_, i) => ({
      id: `${dealId}-task-${i + 1}`,
      title: taskNames[i % taskNames.length],
      description: `Complete ${taskNames[i % taskNames.length].toLowerCase()} for ${dealId}`,
      category: categories[Math.floor(Math.random() * categories.length)],
      status: statuses[Math.floor(i / 10) % statuses.length],
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      assignee: Math.random() > 0.3 ? ['You', 'Sarah Johnson', 'Michael Chen'][Math.floor(Math.random() * 3)] : undefined,
      dueDate: Math.random() > 0.2 ? this.randomFutureDate(30) : undefined,
      completedAt: i < 15 ? this.randomDate(i + 5) : undefined,
      contextual: Math.random() > 0.4,
      aiGenerated: Math.random() > 0.6
    }));
  }

  static generateNotes(dealId: string, count: number): Note[] {
    const notes: Note[] = [];
    const authors = ['You', 'Sarah Johnson', 'Michael Chen', 'Emily Rodriguez'];
    
    for (let i = 0; i < count; i++) {
      notes.push({
        id: `${dealId}-note-${i + 1}`,
        content: `This is note #${i + 1} with important information about the deal. ${Math.random() > 0.5 ? '@sarah.johnson can you review this?' : ''}`,
        author: authors[Math.floor(Math.random() * authors.length)],
        createdAt: this.randomDate(count - i),
        updatedAt: this.randomDate(count - i - 2),
        mentions: Math.random() > 0.5 ? ['sarah.johnson'] : [],
        attachments: Math.random() > 0.7 ? [`doc-${i + 1}`] : [],
        comments: this.generateComments(3),
        tags: ['important', 'review', 'follow-up', 'question'].filter(() => Math.random() > 0.6)
      });
    }
    
    return notes;
  }

  static generateComments(count: number) {
    return Array.from({ length: Math.floor(Math.random() * count) }, (_, i) => ({
      id: `comment-${i + 1}`,
      content: `Comment #${i + 1} on this note.`,
      author: ['Sarah Johnson', 'Michael Chen'][i % 2],
      createdAt: this.randomDate(i + 1)
    }));
  }

  static generateProperties(location: any, count: number): Property[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `prop-${i + 1}`,
      ...location,
      propertyType: ['Multifamily', 'Retail', 'Office'][i % 3],
      units: Math.floor(Math.random() * 50) + 10,
      sqft: Math.floor(Math.random() * 50000) + 15000,
      yearBuilt: 1960 + Math.floor(Math.random() * 60),
      condition: (['excellent', 'good', 'fair'][Math.floor(Math.random() * 3)] as any),
      estimatedValue: Math.floor(Math.random() * 5000000) + 2000000,
      capRate: Math.random() * 3 + 5,
      noi: Math.floor(Math.random() * 400000) + 150000,
      lat: location.lat + (Math.random() - 0.5) * 0.1,
      lng: location.lng + (Math.random() - 0.5) * 0.1,
      comps: this.generateComparables(location, 5),
      images: Array.from({ length: 4 }, (_, j) => `https://picsum.photos/seed/prop-${i}-${j}/800/600`)
    }));
  }

  static generateComparables(location: any, count: number): Comparable[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `comp-${i + 1}`,
      address: `${Math.floor(Math.random() * 9999)} ${['Main', 'Oak', 'Elm', 'Pine'][i % 4]} St`,
      distance: Math.random() * 2 + 0.1,
      propertyType: 'Multifamily',
      units: Math.floor(Math.random() * 30) + 15,
      sqft: Math.floor(Math.random() * 30000) + 12000,
      salePrice: Math.floor(Math.random() * 3000000) + 1500000,
      saleDate: this.randomDate(180),
      capRate: Math.random() * 2 + 5.5,
      pricePerUnit: Math.floor(Math.random() * 50000) + 80000,
      pricePerSqft: Math.floor(Math.random() * 100) + 120,
      similarity: Math.floor(Math.random() * 30) + 70
    }));
  }

  static generateFinancialSnapshot(index: number): FinancialSnapshot {
    const prices = [2500000, 8500000, 4200000];
    const purchasePrice = prices[index];
    
    return {
      purchasePrice,
      closingCosts: purchasePrice * 0.03,
      rehabBudget: purchasePrice * 0.15,
      totalInvestment: purchasePrice * 1.18,
      currentNOI: purchasePrice * 0.068,
      projectedNOI: purchasePrice * 0.082,
      currentCapRate: 6.8,
      projectedCapRate: 8.2,
      currentCashOnCash: 12.5,
      projectedCashOnCash: 16.8,
      irr: 18.5,
      equity: purchasePrice * 0.25,
      debt: purchasePrice * 0.75,
      ltv: 75,
      dscr: 1.45,
      changes: this.generateFinancialChanges(6)
    };
  }

  static generateFinancialChanges(count: number): FinancialChange[] {
    const metrics = ['NOI', 'Cap Rate', 'Cash-on-Cash', 'IRR', 'Occupancy', 'Rent/Unit'];
    return Array.from({ length: count }, (_, i) => ({
      date: this.randomDate(count - i),
      metric: metrics[i % metrics.length],
      previousValue: 150000 + Math.random() * 50000,
      newValue: 170000 + Math.random() * 50000,
      variance: Math.random() * 15 - 5,
      reason: ['Market adjustment', 'Rent increase', 'Expense reduction', 'Occupancy improvement'][i % 4]
    }));
  }

  static generateRiskFlags(dealId: string, count: number): RiskFlag[] {
    const categories: RiskFlag['category'][] = ['financial', 'market', 'property', 'legal', 'environmental', 'operational'];
    const severities: RiskFlag['severity'][] = ['low', 'medium', 'high', 'critical'];
    
    const risks = [
      { title: 'Deferred Maintenance', desc: 'Significant capital expenditures required for roof and HVAC systems' },
      { title: 'Market Oversupply', desc: '800+ units under construction within 2-mile radius' },
      { title: 'Below-Market Rents', desc: 'Current rents 15% below market average' },
      { title: 'Environmental Concern', desc: 'Former gas station nearby, Phase II ESA recommended' },
      { title: 'Title Issue', desc: 'Unresolved easement dispute with adjacent property' },
      { title: 'Zoning Restriction', desc: 'Current use is non-conforming, expansion limitations' },
      { title: 'High Tenant Turnover', desc: 'Annual turnover rate of 45%, above market average' },
      { title: 'Insurance Cost', desc: 'Property in flood zone, elevated insurance premiums' }
    ];
    
    return Array.from({ length: count }, (_, i) => ({
      id: `${dealId}-risk-${i + 1}`,
      category: categories[i % categories.length],
      severity: severities[Math.floor(Math.random() * severities.length)],
      title: risks[i % risks.length].title,
      description: risks[i % risks.length].desc,
      detectedAt: this.randomDate(count - i),
      status: (['open', 'monitoring', 'mitigated', 'resolved'][Math.floor(Math.random() * 4)] as any),
      mitigation: Math.random() > 0.5 ? 'Mitigation plan in place' : undefined,
      impact: Math.floor(Math.random() * 40) + 10,
      probability: Math.floor(Math.random() * 60) + 20,
      aiDetected: Math.random() > 0.4,
      dataSources: ['CoStar', 'Public Records', 'Inspection Report'].filter(() => Math.random() > 0.5)
    }));
  }

  static generateDecisions(dealId: string, count: number): Decision[] {
    const decisions = [
      { title: 'Financing Structure', ai: 'Recommend 75% LTV bridge loan', actual: '70% LTV conventional', reason: 'Lower risk profile preferred' },
      { title: 'Renovation Scope', ai: 'Full interior renovation', actual: 'Cosmetic updates only', reason: 'Budget constraints' },
      { title: 'Purchase Price', ai: '$2.4M based on comps', actual: '$2.5M', reason: 'Competitive bidding situation' },
      { title: 'Closing Timeline', ai: '60-day due diligence', actual: '45-day close', reason: 'Seller motivation' },
      { title: 'Property Management', ai: 'Third-party management', actual: 'Self-manage', reason: 'Cost savings opportunity' },
      { title: 'Exit Strategy', ai: '5-year hold, then sell', actual: '3-year refinance', reason: 'Faster value realization' }
    ];
    
    return Array.from({ length: count }, (_, i) => ({
      id: `${dealId}-decision-${i + 1}`,
      title: decisions[i % decisions.length].title,
      description: `Key decision regarding ${decisions[i % decisions.length].title.toLowerCase()}`,
      date: this.randomDate(count - i),
      decidedBy: 'You',
      aiRecommendation: decisions[i % decisions.length].ai,
      actualChoice: decisions[i % decisions.length].actual,
      reasoning: decisions[i % decisions.length].reason,
      dataSources: ['Market Analysis', 'Pro Forma', 'Lender Feedback'].filter(() => Math.random() > 0.5),
      outcome: i < 3 ? (['positive', 'neutral'][Math.floor(Math.random() * 2)] as any) : undefined,
      impactScore: i < 3 ? Math.floor(Math.random() * 40) + 60 : undefined
    }));
  }

  // Strategy Data
  static getStrategies(): Strategy[] {
    const strategies = [
      { name: 'Value-Add Repositioning', cat: 'value-add', desc: 'Interior renovations and unit upgrades', roi: 24.5, cost: 450000, time: '12-18 months', risk: 'medium' },
      { name: 'Rent Optimization', cat: 'operational', desc: 'Bring rents to market rate through unit turns', roi: 18.2, cost: 25000, time: '6-12 months', risk: 'low' },
      { name: 'Expense Reduction', cat: 'operational', desc: 'Renegotiate contracts and improve efficiency', roi: 15.8, cost: 10000, time: '3-6 months', risk: 'low' },
      { name: 'Add Amenities', cat: 'value-add', desc: 'Dog park, fitness center, co-working space', roi: 21.3, cost: 180000, time: '6-9 months', risk: 'medium' },
      { name: 'Unit Mix Conversion', cat: 'value-add', desc: 'Convert 1BR to studios for higher rent/sqft', roi: 19.7, cost: 320000, time: '9-15 months', risk: 'medium' },
      { name: 'Master Metering', cat: 'operational', desc: 'Transfer utility costs to tenants', roi: 28.4, cost: 85000, time: '3-6 months', risk: 'low' },
      { name: 'Density Bonus Development', cat: 'development', desc: 'Add units through zoning bonus program', roi: 32.1, cost: 1200000, time: '24-36 months', risk: 'high' },
      { name: 'Tax Appeal', cat: 'financial', desc: 'Challenge property tax assessment', roi: 42.6, cost: 15000, time: '6-12 months', risk: 'low' },
      { name: 'Parking Monetization', cat: 'operational', desc: 'Charge for parking or lease excess spaces', roi: 16.9, cost: 5000, time: '1-3 months', risk: 'low' },
      { name: 'Short-Term Rental Mix', cat: 'arbitrage', desc: 'Convert 20% of units to corporate housing', roi: 26.3, cost: 95000, time: '3-6 months', risk: 'medium' }
    ];
    
    return strategies.slice(0, 10).map((s, i) => ({
      id: `strategy-${i + 1}`,
      name: s.name,
      category: s.cat as any,
      description: s.desc,
      applicability: Math.floor(Math.random() * 30) + 70,
      projectedROI: s.roi,
      implementationCost: s.cost,
      timeframe: s.time,
      riskLevel: s.risk as any,
      confidence: Math.floor(Math.random() * 20) + 75,
      requirements: ['Market analysis', 'Financial modeling', 'Contractor bids'].filter(() => Math.random() > 0.5),
      keyMetrics: [
        { name: 'NOI', current: 150000, projected: 195000, change: 30, unit: '$' },
        { name: 'Occupancy', current: 78, projected: 95, change: 17, unit: '%' },
        { name: 'Rent/Unit', current: 1250, projected: 1475, change: 18, unit: '$' }
      ]
    }));
  }

  // Market Signals
  static getMarketSignals(): MarketSignal[] {
    return Array.from({ length: 15 }, (_, i) => ({
      id: `signal-${i + 1}`,
      type: (['supply', 'demand', 'pricing', 'regulatory', 'economic', 'competition'][i % 6] as any),
      severity: (['info', 'warning', 'alert'][Math.floor(Math.random() * 3)] as any),
      title: ['New Development Announced', 'Rent Growth Accelerating', 'Zoning Change Proposed'][i % 3],
      description: 'Detailed description of the market signal and its implications',
      detectedAt: this.randomDate(i + 1),
      location: ['Austin, TX', 'Denver, CO', 'Phoenix, AZ'][i % 3],
      impact: (['positive', 'neutral', 'negative'][Math.floor(Math.random() * 3)] as any),
      confidence: Math.floor(Math.random() * 30) + 70,
      dataSources: ['CoStar', 'Public Records', 'News'],
      relatedDeals: ['deal-1', 'deal-2'].filter(() => Math.random() > 0.5)
    }));
  }

  // Supply Pipeline
  static getSupplyPipeline(): SupplyPipelineUnit[] {
    return Array.from({ length: 25 }, (_, i) => ({
      id: `pipeline-${i + 1}`,
      name: `Project ${i + 1}`,
      address: `${Math.floor(Math.random() * 9999)} Development Way`,
      units: Math.floor(Math.random() * 200) + 50,
      status: (['planned', 'approved', 'under-construction', 'completed'][Math.floor(Math.random() * 4)] as any),
      completionDate: this.randomFutureDate(365 * 3),
      developer: ['ABC Development', 'XYZ Builders', 'MegaCorp Properties'][i % 3],
      targetRent: Math.floor(Math.random() * 500) + 1200,
      distance: Math.random() * 5 + 0.5,
      lat: 30.2672 + (Math.random() - 0.5) * 0.2,
      lng: -97.7431 + (Math.random() - 0.5) * 0.2,
      impactScore: Math.floor(Math.random() * 60) + 40
    }));
  }

  // News Events
  static getNewsEvents(): NewsEvent[] {
    return Array.from({ length: 15 }, (_, i) => ({
      id: `news-${i + 1}`,
      title: ['Major Employer Announces Expansion', 'New Transit Line Approved', 'Rent Control Proposed'][i % 3],
      source: ['Austin Business Journal', 'The Denver Post', 'Phoenix Chronicle'][i % 3],
      publishedAt: this.randomDate(i + 1),
      category: (['market', 'regulatory', 'economic', 'development'][i % 4] as any),
      sentiment: (['positive', 'neutral', 'negative'][Math.floor(Math.random() * 3)] as any),
      relevance: Math.floor(Math.random() * 40) + 60,
      summary: 'Brief summary of the news event and its potential market impact',
      url: `#news-${i + 1}`,
      relatedDeals: ['deal-1'].filter(() => Math.random() > 0.5),
      keyTopics: ['employment', 'infrastructure', 'regulation'].filter(() => Math.random() > 0.5)
    }));
  }

  // Contacts
  static getContacts(): Contact[] {
    return Array.from({ length: 50 }, (_, i) => ({
      id: `contact-${i + 1}`,
      name: `Contact ${i + 1}`,
      email: `contact${i + 1}@example.com`,
      phone: `(555) ${100 + i}-${1000 + i}`,
      company: ['Firm A', 'Company B', 'Organization C'][i % 3],
      role: ['Broker', 'Lender', 'Attorney', 'Contractor', 'Inspector'][i % 5],
      responsiveness: (['high', 'medium', 'low'][i % 3] as any),
      reliability: Math.floor(Math.random() * 30) + 70,
      deals: ['deal-1', 'deal-2'].filter(() => Math.random() > 0.5),
      lastContact: this.randomDate(i + 1),
      totalInteractions: Math.floor(Math.random() * 50) + 10,
      avgResponseTime: ['2 hours', '4 hours', '1 day', '2 days'][i % 4],
      preferredContact: (['email', 'phone'][i % 2] as any),
      notes: 'Additional contact notes and history'
    }));
  }

  // Modules
  static getModules(): Module[] {
    const modules = [
      { name: 'Financial Modeling Pro', cat: 'financial', desc: '13-component financial modeling suite', features: ['Monte Carlo', 'Sensitivity Analysis', 'Waterfall'], price: 199 },
      { name: 'Strategy Arbitrage Engine', cat: 'analysis', desc: '39 strategies with ROI comparison', features: ['Strategy Matrix', 'Risk Scoring', 'Custom Builder'], price: 299 },
      { name: 'Due Diligence Suite', cat: 'operations', desc: 'Smart checklist with 40+ contextual tasks', features: ['Auto Tasks', 'Risk Dashboard', 'Timeline'], price: 149 },
      { name: 'Market Signals', cat: 'market', desc: 'Supply pipeline and competitive intelligence', features: ['Pipeline Map', 'Early Warnings', 'Absorption Tracking'], price: 249 },
      { name: 'Development Tracker', cat: 'operations', desc: 'Construction and permit management', features: ['Gantt Charts', 'Budget Tracking', 'Permit Status'], price: 179 }
    ];
    
    return modules.map((m, i) => ({
      id: `module-${i + 1}`,
      name: m.name,
      category: m.cat as any,
      tier: 'pro' as any,
      description: m.desc,
      features: m.features,
      price: m.price,
      enabled: Math.random() > 0.5,
      icon: ['📊', '🎯', '✅', '📡', '🏗️'][i],
      color: ['blue', 'purple', 'green', 'orange', 'red'][i]
    }));
  }

  // Utility Functions
  static randomDate(daysAgo: number): string {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString();
  }

  static randomFutureDate(daysAhead: number): string {
    const date = new Date();
    date.setDate(date.getDate() + Math.floor(Math.random() * daysAhead));
    return date.toISOString();
  }

  static getEventTitle(type: string, index: number): string {
    const titles: Record<string, string[]> = {
      email: ['Email sent to broker', 'Received financing proposal', 'Lender question answered'],
      call: ['Phone call with seller', 'Lender discussion', 'Contractor estimate call'],
      meeting: ['Property walkthrough', 'Team meeting', 'Lender meeting'],
      document: ['Purchase agreement uploaded', 'Inspection report received', 'Appraisal completed'],
      task: ['Inspection scheduled', 'Financial model updated', 'Due diligence item completed'],
      milestone: ['LOI accepted', 'Under contract', 'Due diligence period started'],
      'status-change': ['Deal moved to Analyzing', 'Status updated', 'Stage advanced'],
      note: ['Added note about property', 'Updated deal notes', 'Recorded conversation']
    };
    return titles[type][index % titles[type].length];
  }

  static getEventDescription(type: string): string {
    return `Detailed description of this ${type} event with additional context and information.`;
  }

  static getEventIcon(type: string): string {
    const icons: Record<string, string> = {
      email: '📧',
      call: '📞',
      meeting: '👥',
      document: '📄',
      task: '✅',
      milestone: '🎯',
      'status-change': '🔄',
      note: '📝'
    };
    return icons[type] || '•';
  }

  static getEventColor(type: string): string {
    const colors: Record<string, string> = {
      email: 'blue',
      call: 'green',
      meeting: 'purple',
      document: 'orange',
      task: 'cyan',
      milestone: 'pink',
      'status-change': 'yellow',
      note: 'gray'
    };
    return colors[type] || 'gray';
  }
}

export default ShowcaseDataService;
