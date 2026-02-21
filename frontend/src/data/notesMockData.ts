/**
 * Mock Data for Dual-Mode Notes Section
 * Provides realistic note data for both acquisition and performance modes
 */

export interface Note {
  id: number;
  title: string;
  content: string;
  author: string;
  authorAvatar: string;
  createdAt: string;
  updatedAt?: string;
  category: string;
  tags: string[];
  isPinned: boolean;
  priority?: 'high' | 'medium' | 'low';
  type: 'note' | 'observation' | 'follow-up' | 'update' | 'maintenance' | 'tenant-issue';
  attachments?: number;
  mentions?: string[];
}

export interface NoteCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  count: number;
}

export interface NoteStats {
  label: string;
  value: number | string;
  icon: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
  };
}

// ==================== ACQUISITION MODE DATA ====================

export const acquisitionNotes: Note[] = [
  {
    id: 1,
    title: 'Lender Call - Wells Fargo Terms Discussion',
    content: 'Discussed financing terms with Wells Fargo. They offered 70% LTV at 4.5% interest with 10-year IO period. Rate is competitive but we should negotiate the IO period to 5 years to match our value-add timeline. They mentioned flexibility on recourse if we provide additional collateral from portfolio. Follow up with Rebecca on structuring options.',
    author: 'Leon D',
    authorAvatar: 'LD',
    createdAt: '2 hours ago',
    category: 'Deal Notes',
    tags: ['financing', 'lender', 'terms'],
    isPinned: true,
    priority: 'high',
    type: 'note',
    attachments: 1,
    mentions: ['Rebecca Williams']
  },
  {
    id: 2,
    title: 'Site Inspection - Deferred Maintenance Identified',
    content: 'Completed property walkthrough with Michael and broker. Key findings:\n\n• Roof shows significant wear - estimate $150K replacement needed within 18 months\n• HVAC systems are 12+ years old, functioning but near end of life\n• Parking lot needs resurfacing - $45K estimate\n• Elevator modernization recommended - $80K\n\nOverall condition better than expected given age. Seller agreed to $200K credit at closing for deferred maintenance. This works in our favor for the underwriting.',
    author: 'Leon D',
    authorAvatar: 'LD',
    createdAt: '1 day ago',
    category: 'Observations',
    tags: ['inspection', 'capex', 'maintenance'],
    isPinned: true,
    priority: 'high',
    type: 'observation',
    mentions: ['Michael Torres']
  },
  {
    id: 3,
    title: 'Environmental Phase I - Minor Concerns',
    content: 'Phase I environmental report delivered. Overall good news:\n\n✅ No major contamination issues\n⚠️ Minor soil staining in maintenance area - recommending Phase II soil testing\n✅ No underground storage tanks\n✅ Asbestos survey clean\n\nThe Phase II will add $15K to due diligence costs and require 2-week extension. Seller is cooperative and agreed to extension at no penalty. Should complete Phase II by end of month.',
    author: 'Michael Torres',
    authorAvatar: 'MT',
    createdAt: '3 hours ago',
    category: 'Deal Notes',
    tags: ['environmental', 'due-diligence', 'phase-i'],
    isPinned: false,
    priority: 'medium',
    type: 'note',
    attachments: 2
  },
  {
    id: 4,
    title: 'Follow-Up: Update Investment Memo with New Rent Comps',
    content: 'Need to revise pro forma rent assumptions based on latest market comps that Sarah pulled. New developments in submarket achieving $50-75/unit premium over our initial projections. This improves our stabilized NOI by ~$120K annually. Update memo before IC meeting on Friday.',
    author: 'Leon D',
    authorAvatar: 'LD',
    createdAt: '5 hours ago',
    category: 'Follow-Ups',
    tags: ['action-item', 'underwriting', 'ic-meeting'],
    isPinned: false,
    priority: 'high',
    type: 'follow-up',
    mentions: ['Sarah Johnson']
  },
  {
    id: 5,
    title: 'Seller Motivation - Deal Context',
    content: 'Background from broker on seller motivation:\n\nSeller is family-owned REIT doing portfolio rationalization. They acquired this asset in 2015 and achieved their target returns. Not distressed but want to close by Q1 end for tax planning. This explains their flexibility on price and willingness to provide maintenance credits. They care more about certainty of close than squeezing last dollar.\n\nStrategy: Position us as reliable, well-capitalized buyer. Avoid aggressive re-trading.',
    author: 'John Smith',
    authorAvatar: 'JS',
    createdAt: '2 days ago',
    category: 'Deal Notes',
    tags: ['seller', 'strategy', 'negotiation'],
    isPinned: true,
    priority: 'medium',
    type: 'note'
  },
  {
    id: 6,
    title: 'Market Rent Analysis - Upside Potential',
    content: 'Completed detailed rent comp analysis:\n\n• Current avg rent: $1,680/unit\n• Market rent (comparable assets): $1,825/unit\n• Premium new construction: $1,950-2,100/unit\n\nOur value-add plan includes:\n- Unit interior upgrades ($8K/unit)\n- Common area improvements ($500K)\n- Amenity additions (fitness center, co-working)\n\nPro forma rent target: $1,875/unit achievable within 24 months based on renovation pace. Conservative estimate provides 15% rent growth buffer.',
    author: 'Sarah Johnson',
    authorAvatar: 'SJ',
    createdAt: '1 day ago',
    category: 'Observations',
    tags: ['market-analysis', 'rent-comps', 'value-add'],
    isPinned: false,
    priority: 'medium',
    type: 'observation',
    attachments: 1
  },
  {
    id: 7,
    title: 'Legal Review - Purchase Agreement Updates',
    content: 'Reviewed seller\'s redlines on purchase agreement. Two material points:\n\n1. Earnest money release: Seller wants non-refundable after inspection period. Negotiated to keep refundable until all due diligence conditions satisfied.\n\n2. Inspection period: We requested 75 days (15-day extension), seller agreed.\n\nMinor language updates on representations and warranties. Overall agreement is in good shape. Aiming to have fully executed PSA by end of week.',
    author: 'Emily Chen',
    authorAvatar: 'EC',
    createdAt: '4 hours ago',
    category: 'Deal Notes',
    tags: ['legal', 'psa', 'negotiation'],
    isPinned: false,
    priority: 'medium',
    type: 'note'
  },
  {
    id: 8,
    title: 'Follow-Up: Schedule Investment Committee Presentation',
    content: 'IC meeting scheduled for Friday, Jan 29 at 2:00 PM. Need to finalize:\n\n• Investment memo (Sarah - due Thursday)\n• Market analysis slides (Sarah - due Thursday)\n• Financial model final version (Leon - due Thursday)\n• Environmental summary (Michael - due Wednesday)\n• Legal status update (Emily - due Thursday)\n\nSend full package to IC members by Thursday 5 PM for review.',
    author: 'Leon D',
    authorAvatar: 'LD',
    createdAt: '6 hours ago',
    category: 'Follow-Ups',
    tags: ['ic-meeting', 'action-item', 'deadline'],
    isPinned: true,
    priority: 'high',
    type: 'follow-up',
    mentions: ['Sarah Johnson', 'Michael Torres', 'Emily Chen']
  },
  {
    id: 9,
    title: 'Competition Analysis - Other Bidders',
    content: 'Broker provided intel on competitive landscape:\n\n• Originally 8 bidders in first round\n• Now down to 3 in best-and-final\n• One competitor is all-cash private buyer (strong)\n• Other is regional REIT with reputation for aggressive re-trading (weak)\n\nOur position: Middle on price but strongest on certainty and seller-friendly terms. Broker recommends we stay at current price and emphasize execution certainty. Likelihood of winning: 60-70%.',
    author: 'John Smith',
    authorAvatar: 'JS',
    createdAt: '3 days ago',
    category: 'Observations',
    tags: ['competition', 'bidding', 'strategy'],
    isPinned: false,
    priority: 'medium',
    type: 'observation'
  },
  {
    id: 10,
    title: 'Property Management - Greystar Proposal Review',
    content: 'Reviewed Greystar proposal for property management takeover:\n\n• Management fee: 3% of gross revenue\n• Performance bonus: 10% of NOI growth above budget\n• Leasing fees: $500/new lease, $250/renewal\n• Initial term: 3 years with 1-year extensions\n\nGreystar has strong track record in this submarket (manage 4 comparable assets nearby). References were excellent. Their systems and reporting align well with our asset management approach. Recommend proceeding with engagement.',
    author: 'Michael Torres',
    authorAvatar: 'MT',
    createdAt: '5 days ago',
    category: 'Deal Notes',
    tags: ['property-management', 'greystar', 'vendor'],
    isPinned: false,
    priority: 'low',
    type: 'note'
  }
];

export const acquisitionCategories: NoteCategory[] = [
  {
    id: 'deal-notes',
    label: 'Deal Notes',
    icon: '📝',
    color: 'blue',
    count: 6
  },
  {
    id: 'observations',
    label: 'Observations',
    icon: '👁️',
    color: 'purple',
    count: 3
  },
  {
    id: 'follow-ups',
    label: 'Follow-Ups',
    icon: '⏰',
    color: 'orange',
    count: 2
  }
];

export const acquisitionStats: NoteStats[] = [
  {
    label: 'Total Notes',
    value: 10,
    icon: '📋',
    trend: {
      direction: 'up',
      value: '+3 this week'
    }
  },
  {
    label: "Today's Notes",
    value: 4,
    icon: '📝'
  },
  {
    label: 'Pinned',
    value: 4,
    icon: '📌'
  },
  {
    label: 'High Priority',
    value: 5,
    icon: '🔴'
  },
  {
    label: 'With Attachments',
    value: 4,
    icon: '📎'
  }
];

// ==================== PERFORMANCE MODE DATA ====================

export const performanceNotes: Note[] = [
  {
    id: 1,
    title: 'Roof Replacement Project - Approved',
    content: 'Roof replacement project approved for $285K with ABC Roofing. Key details:\n\n• Start date: February 10, 2025\n• Duration: 6-8 weeks\n• Scope: Full tear-off and replacement of Building A & B roofs\n• Warranty: 20-year manufacturer warranty\n\nNeed to notify affected tenants about construction noise and staging areas. Expect minimal disruption but will offer rent credits if excessive noise. Lisa coordinating logistics.',
    author: 'Jennifer Lee',
    authorAvatar: 'JL',
    createdAt: '1 day ago',
    category: 'Property Updates',
    tags: ['capital-project', 'roof', 'construction'],
    isPinned: true,
    priority: 'high',
    type: 'update',
    mentions: ['Lisa Brown']
  },
  {
    id: 2,
    title: 'Tenant Issue - Unit 305 Water Leak',
    content: 'Received urgent call from tenant in Unit 305 reporting water leak from ceiling. Ahmed dispatched immediately and identified source as failed supply line in Unit 405 above.\n\nStatus:\n• Emergency plumber on-site within 2 hours\n• Leak stopped, lines replaced\n• Water damage assessment: Minor ceiling staining in 305, some carpet damage\n• Insurance claim filed\n• Temp housing offered to 305 tenant (declined)\n\nRepairs scheduled for next week. Tenant satisfied with response. Good save on what could have been major complaint.',
    author: 'Marcus Williams',
    authorAvatar: 'MW',
    createdAt: '4 hours ago',
    category: 'Tenant Issues',
    tags: ['maintenance', 'emergency', 'water-damage'],
    isPinned: true,
    priority: 'high',
    type: 'tenant-issue',
    mentions: ['Ahmed Hassan']
  },
  {
    id: 3,
    title: 'Monthly Performance - December 2024 Summary',
    content: 'December performance summary:\n\n📊 Occupancy: 95% (target 93%) ✅\n💵 Collections: 98.5% (target 97%) ✅\n📈 Avg Rent: $1,825 (budget $1,800) ✅\n💰 NOI: $267K (budget $283K) ⚠️\n\nNOI variance driven by higher-than-expected maintenance costs ($18K over budget) due to HVAC repairs and winter storm damage. Revenue side exceeding expectations. Q4 overall tracking well despite December maintenance spike.',
    author: 'Rachel Kim',
    authorAvatar: 'RK',
    createdAt: '2 hours ago',
    category: 'Property Updates',
    tags: ['performance', 'financials', 'monthly-report'],
    isPinned: true,
    priority: 'medium',
    type: 'update',
    attachments: 1
  },
  {
    id: 4,
    title: 'Maintenance Note - HVAC System Optimization',
    content: 'Completed HVAC optimization project with new vendor TechCool:\n\n• Installed smart thermostats in all common areas\n• Optimized system schedules for off-peak efficiency\n• Replaced aging filters and components\n• Set up preventive maintenance program\n\nExpected savings: $1,200/month in utility costs. New preventive maintenance agreement should reduce emergency repairs. System monitoring dashboards installed for real-time alerts. Great partnership so far with new vendor.',
    author: 'Lisa Brown',
    authorAvatar: 'LB',
    createdAt: '1 day ago',
    category: 'Maintenance Notes',
    tags: ['hvac', 'utilities', 'vendor', 'efficiency'],
    isPinned: false,
    priority: 'medium',
    type: 'maintenance',
    mentions: ['Ahmed Hassan']
  },
  {
    id: 5,
    title: 'Leasing Update - Rent Increase Strategy Working',
    content: 'Rent increase implementation showing positive results:\n\n• Implemented 4% renewal increases, 6% new lease premiums\n• Renewal acceptance rate: 78% (above 75% target)\n• New lease velocity: 8 leases in last 2 weeks\n• Prospect traffic up 25% from digital marketing push\n\nMarket supporting our pricing strategy. Competition raising rents similarly. Should hit 96-97% occupancy by end of Q1. Recommend maintaining current strategy.',
    author: 'David Park',
    authorAvatar: 'DP',
    createdAt: '3 hours ago',
    category: 'Property Updates',
    tags: ['leasing', 'revenue', 'occupancy'],
    isPinned: true,
    priority: 'high',
    type: 'update'
  },
  {
    id: 6,
    title: 'Tenant Issue - Parking Complaint Resolution',
    content: 'Resolved ongoing parking complaint from residents in Building C:\n\nIssue: Non-residents parking in assigned spots due to inadequate signage and towing enforcement.\n\nResolution:\n• Installed clearer signage ($800)\n• Updated towing policy and communicated to all residents\n• Implemented parking permit stickers\n• Hired parking patrol service (2x/week for first month)\n\nResidents satisfied with response. Complaint volume dropped significantly. Will monitor for next 30 days then adjust patrol frequency.',
    author: 'Marcus Williams',
    authorAvatar: 'MW',
    createdAt: '2 days ago',
    category: 'Tenant Issues',
    tags: ['parking', 'amenities', 'resident-satisfaction'],
    isPinned: false,
    priority: 'medium',
    type: 'tenant-issue'
  },
  {
    id: 7,
    title: 'Capital Planning - 2025 Budget Review',
    content: 'Reviewed 2025 capital improvement plan with asset management:\n\nApproved Projects:\n• Pool resurfacing - $45K (Q2)\n• Fitness center equipment upgrade - $35K (Q1)\n• Exterior painting (Buildings A-C) - $120K (Q2-Q3)\n• Parking lot seal coating - $28K (Q3)\n\nDeferred:\n• Clubhouse renovation - $180K (deferred to 2026)\n• Dog park expansion - $25K (deferred)\n\nTotal 2025 capex budget: $513K including roof replacement. On track with business plan.',
    author: 'Jennifer Lee',
    authorAvatar: 'JL',
    createdAt: '3 days ago',
    category: 'Property Updates',
    tags: ['capital-planning', 'budget', '2025'],
    isPinned: false,
    priority: 'medium',
    type: 'update'
  },
  {
    id: 8,
    title: 'Maintenance Note - Elevator Inspection Passed',
    content: 'Annual elevator inspection completed by state inspector:\n\n✅ All 4 elevators passed inspection\n✅ No violations or safety issues\n✅ Certificates renewed for 12 months\n\nInspector noted elevators are well-maintained and complimented preventive maintenance program. Recommended cab interior refresh in next 18-24 months for aesthetic purposes only (not safety issue). Will add to future capex planning.',
    author: 'Ahmed Hassan',
    authorAvatar: 'AH',
    createdAt: '5 hours ago',
    category: 'Maintenance Notes',
    tags: ['elevator', 'inspection', 'compliance'],
    isPinned: false,
    priority: 'low',
    type: 'maintenance'
  },
  {
    id: 9,
    title: 'Tenant Issue - Noise Complaint Mediation',
    content: 'Mediated noise complaint between Units 208 and 308 (downstairs/upstairs):\n\nIssue: Unit 208 complaining about excessive noise from Unit 308 (hardwood floors, late-night activity).\n\nAction taken:\n• Met with both parties separately\n• Educated 308 on lease quiet hours policy\n• Provided area rugs at no cost to 308 tenant\n• Documented complaint and resolution in tenant files\n\nBoth parties agreed to solution. 308 tenant was cooperative and appreciative of rugs. Will monitor situation but expect issue resolved.',
    author: 'Marcus Williams',
    authorAvatar: 'MW',
    createdAt: '1 day ago',
    category: 'Tenant Issues',
    tags: ['noise', 'mediation', 'resident-relations'],
    isPinned: false,
    priority: 'medium',
    type: 'tenant-issue'
  },
  {
    id: 10,
    title: 'Property Update - Q1 2025 Goals Set',
    content: 'Quarterly business review completed. Q1 2025 priorities:\n\n1. Maintain 95%+ occupancy through winter\n2. Execute roof replacement on schedule\n3. Launch resident retention program\n4. Complete HVAC vendor transition\n5. Reduce maintenance response time to under 24hrs\n\nTeam aligned on priorities. Monthly check-ins scheduled. Looking to build on strong Q4 performance and address maintenance efficiency opportunities identified in tenant surveys.',
    author: 'Jennifer Lee',
    authorAvatar: 'JL',
    createdAt: '1 day ago',
    category: 'Property Updates',
    tags: ['goals', 'strategy', 'quarterly-review'],
    isPinned: true,
    priority: 'medium',
    type: 'update'
  }
];

export const performanceCategories: NoteCategory[] = [
  {
    id: 'property-updates',
    label: 'Property Updates',
    icon: '🏢',
    color: 'green',
    count: 5
  },
  {
    id: 'maintenance-notes',
    label: 'Maintenance Notes',
    icon: '🔧',
    color: 'blue',
    count: 3
  },
  {
    id: 'tenant-issues',
    label: 'Tenant Issues',
    icon: '👥',
    color: 'orange',
    count: 4
  }
];

export const performanceStats: NoteStats[] = [
  {
    label: 'Total Notes',
    value: 10,
    icon: '📋',
    trend: {
      direction: 'up',
      value: '+5 this week'
    }
  },
  {
    label: "Today's Notes",
    value: 3,
    icon: '📝'
  },
  {
    label: 'Pinned',
    value: 4,
    icon: '📌'
  },
  {
    label: 'Open Issues',
    value: 2,
    icon: '⚠️'
  },
  {
    label: 'Resolved',
    value: 8,
    icon: '✅'
  }
];
