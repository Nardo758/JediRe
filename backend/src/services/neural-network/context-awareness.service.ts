/**
 * Context Awareness Service
 * 
 * THE BRAIN THAT THINKS LIKE A REAL ESTATE ANALYST
 * 
 * When the UI shows "Units Under Construction: 2,400"...
 * A real analyst IMMEDIATELY wants to know:
 * - WHERE exactly? Which submarkets?
 * - WHO is building? What developers?
 * - WHEN do they deliver? Timing matters!
 * - WHAT class? Competing with our deal or not?
 * - HOW does this affect our deal specifically?
 * 
 * This service:
 * 1. Detects what the user is looking at (UI context)
 * 2. Identifies GAPS - what data is missing that they WILL want
 * 3. Proactively fetches or surfaces those gaps
 * 4. Triggers research agents to fill gaps autonomously
 * 5. Presents data the way a real estate person thinks
 * 
 * MENTAL MODEL OF A REAL ESTATE ANALYST:
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  "I see 2,400 units under construction..."                             │
 * │                                                                         │
 * │  IMMEDIATE QUESTIONS (within 2 seconds):                               │
 * │  ├── Where? → Map view, submarket breakdown                            │
 * │  ├── Competitor? → Same class? Same tenant profile?                    │
 * │  ├── Timing? → Delivers before/during/after my hold period?            │
 * │  └── Impact? → Will this hurt my rent growth assumptions?              │
 * │                                                                         │
 * │  DEEPER QUESTIONS (if they click):                                      │
 * │  ├── Developer track record? On-time delivery history?                 │
 * │  ├── Pre-leasing velocity? Already absorbed?                           │
 * │  ├── Amenities comparison? Will they steal tenants?                    │
 * │  └── Rent positioning? Above/below our deal?                           │
 * │                                                                         │
 * │  AUTONOMOUS RESEARCH (agent should already be doing):                   │
 * │  ├── Scrape permit data for exact specs                                │
 * │  ├── Check developer's other projects                                  │
 * │  ├── Monitor for pre-leasing announcements                             │
 * │  └── Calculate absorption rate impact on our proforma                  │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import { Pool } from 'pg';
import { getKnowledgeGraphService, NodeType, EdgeType, GraphNode } from './knowledge-graph.service';
import { generateCompletion, isLLMAvailable } from '../llm.service';

// ============================================================================
// CONTEXT TYPES - What the user is looking at
// ============================================================================

export type UIContext = 
  | 'deal_overview'        // Looking at a deal capsule
  | 'market_dashboard'     // F4 Markets view
  | 'submarket_deep_dive'  // Drilling into a submarket
  | 'property_card'        // Individual property
  | 'comp_analysis'        // Comparing properties
  | 'supply_pipeline'      // Units under construction
  | 'rent_trends'          // Rent growth charts
  | 'cap_rates'            // Investment metrics
  | 'employer_intel'       // Corporate health
  | 'traffic_analysis'     // Lead/tour data
  | 'proforma_review';     // Cash flow modeling

export interface UserFocus {
  context: UIContext;
  
  // What entity they're focused on
  dealId?: string;
  propertyId?: string;
  marketId?: string;
  submarketId?: string;
  
  // What metric/data point caught their attention
  focusedMetric?: string;  // e.g., "units_under_construction", "rent_growth", "vacancy"
  focusedValue?: any;      // The actual value they're seeing
  
  // Time context
  timeHorizon?: 'current' | '1yr' | '3yr' | '5yr' | '10yr';
  
  // User's role/persona (affects what questions they'd ask)
  userRole?: 'acquisitions' | 'asset_manager' | 'investor' | 'lender' | 'analyst';
}

// ============================================================================
// GAP TYPES - What data is missing
// ============================================================================

export interface DataGap {
  id: string;
  type: 'missing' | 'stale' | 'incomplete' | 'needs_enrichment';
  
  // What's missing
  entity: string;           // e.g., "development_project:123"
  missingFields: string[];  // e.g., ["units", "delivery_date", "developer"]
  
  // Why it matters
  relevance: 'critical' | 'important' | 'nice_to_have';
  userQuestion: string;     // Natural language: "Where exactly is this development?"
  analystThought: string;   // "Need to know timing to assess rent competition"
  
  // How to fill it
  suggestedAction: 'fetch_permit' | 'scrape_listing' | 'call_api' | 'agent_research' | 'user_input';
  suggestedAgent?: string;  // Which agent should handle this
  
  // Priority
  priority: number;         // 1-100, higher = more urgent
}

export interface ContextAnalysis {
  focus: UserFocus;
  
  // Immediate questions (what they're thinking right now)
  immediateQuestions: Array<{
    question: string;
    dataNeeded: string[];
    available: boolean;
    source?: string;
    value?: any;
  }>;
  
  // Data gaps that need filling
  gaps: DataGap[];
  
  // Proactive suggestions (what they'll want next)
  suggestions: Array<{
    type: 'drill_down' | 'compare' | 'forecast' | 'alert';
    title: string;
    description: string;
    action: string;
    data?: any;
  }>;
  
  // Agent tasks to trigger
  agentTasks: Array<{
    agentType: string;
    task: string;
    priority: 'immediate' | 'background' | 'scheduled';
    context: Record<string, any>;
  }>;
}

// ============================================================================
// ANALYST MENTAL MODELS - How real estate people think
// ============================================================================

interface AnalystMentalModel {
  context: UIContext;
  
  // Immediate questions by metric
  questionsByMetric: Record<string, string[]>;
  
  // What data points must be available
  requiredData: string[];
  
  // What enrichment adds value
  valuableEnrichment: string[];
  
  // Related concepts to surface
  relatedConcepts: string[];
}

const ANALYST_MENTAL_MODELS: AnalystMentalModel[] = [
  {
    context: 'supply_pipeline',
    questionsByMetric: {
      'units_under_construction': [
        'Where exactly are these projects located?',
        'What class are they? A, B, or C?',
        'When do they deliver? What quarter/year?',
        'Who is the developer? Track record?',
        'What rents are they targeting?',
        'How does this compare to historical supply?',
        'Which submarkets have the most exposure?'
      ],
      'units_planned': [
        'How likely are these to actually break ground?',
        'Developer financing secured?',
        'Zoning approved?',
        'What is typical plan-to-start conversion rate here?'
      ],
      'units_delivered_ytd': [
        'How fast are they leasing up?',
        'What concessions are being offered?',
        'Impact on submarket vacancy?'
      ]
    },
    requiredData: [
      'project_name', 'address', 'submarket', 'units', 'stories', 
      'delivery_date', 'developer', 'asset_class', 'target_rents'
    ],
    valuableEnrichment: [
      'developer_track_record', 'permit_history', 'pre_leasing_velocity',
      'comparable_rents', 'absorption_forecast', 'financing_status'
    ],
    relatedConcepts: ['absorption_rate', 'rent_growth', 'vacancy_trend', 'cap_rate_compression']
  },
  {
    context: 'deal_overview',
    questionsByMetric: {
      'asking_price': [
        'What does this imply for price per unit?',
        'How does this compare to recent sales?',
        'What cap rate does this represent?',
        'Is this above or below replacement cost?'
      ],
      'cap_rate': [
        'How does this compare to submarket average?',
        'What is the risk premium for this asset?',
        'Where do comps trade?',
        'What does DCF suggest for fair value?'
      ],
      'occupancy': [
        'Is this stabilized or lease-up?',
        'What is submarket average?',
        'Any known tenant issues?',
        'What is historical occupancy for this property?'
      ],
      'rent_per_unit': [
        'Is this at market or below?',
        'What is rent growth potential?',
        'How do comps compare?',
        'Loss-to-lease opportunity?'
      ]
    },
    requiredData: [
      'units', 'year_built', 'asking_price', 'noi', 'occupancy',
      'avg_rent', 'submarket', 'asset_class', 'seller', 'broker'
    ],
    valuableEnrichment: [
      'rent_comps', 'sale_comps', 'expense_benchmarks', 'capital_needs',
      'market_rent_forecast', 'vacancy_forecast', 'neighborhood_trends'
    ],
    relatedConcepts: ['rent_growth', 'value_add_potential', 'exit_cap', 'irr']
  },
  {
    context: 'submarket_deep_dive',
    questionsByMetric: {
      'vacancy_rate': [
        'Is this rising or falling?',
        'How does this compare to MSA average?',
        'What is driving the trend?',
        'Historical range for this submarket?'
      ],
      'rent_growth': [
        'Is this accelerating or decelerating?',
        'How does this compare to inflation?',
        'Which class is performing best?',
        'Concession trends?'
      ],
      'absorption': [
        'Supply/demand balance?',
        'Months of supply?',
        'Net effective rent trends?'
      ]
    },
    requiredData: [
      'submarket_name', 'property_count', 'total_units', 'avg_occupancy',
      'avg_rent', 'rent_growth_yoy', 'vacancy_rate', 'under_construction'
    ],
    valuableEnrichment: [
      'demographic_trends', 'employment_by_sector', 'major_employers',
      'crime_trends', 'school_ratings', 'walkability_score', 'transit_access'
    ],
    relatedConcepts: ['employment_growth', 'population_growth', 'income_growth', 'migration']
  }
];

// ============================================================================
// SERVICE
// ============================================================================

export class ContextAwarenessService {
  private graphService: ReturnType<typeof getKnowledgeGraphService>;
  
  constructor(private pool: Pool) {
    this.graphService = getKnowledgeGraphService(pool);
  }
  
  /**
   * Analyze what the user is looking at and identify gaps
   */
  async analyzeContext(focus: UserFocus): Promise<ContextAnalysis> {
    // Find the relevant mental model
    const mentalModel = ANALYST_MENTAL_MODELS.find(m => m.context === focus.context);
    
    // Get immediate questions based on what they're focused on
    const immediateQuestions = await this.generateImmediateQuestions(focus, mentalModel);
    
    // Identify data gaps
    const gaps = await this.identifyGaps(focus, mentalModel, immediateQuestions);
    
    // Generate proactive suggestions
    const suggestions = await this.generateSuggestions(focus, mentalModel, gaps);
    
    // Determine what agent tasks should be triggered
    const agentTasks = this.prioritizeAgentTasks(focus, gaps);
    
    return {
      focus,
      immediateQuestions,
      gaps,
      suggestions,
      agentTasks
    };
  }
  
  /**
   * Generate questions a real analyst would immediately have
   */
  private async generateImmediateQuestions(
    focus: UserFocus, 
    mentalModel?: AnalystMentalModel
  ): Promise<ContextAnalysis['immediateQuestions']> {
    const questions: ContextAnalysis['immediateQuestions'] = [];
    
    // Get questions from mental model
    if (mentalModel && focus.focusedMetric) {
      const modelQuestions = mentalModel.questionsByMetric[focus.focusedMetric] || [];
      
      for (const q of modelQuestions) {
        // Check if we have data to answer this
        const { available, source, value } = await this.checkDataAvailability(focus, q);
        
        questions.push({
          question: q,
          dataNeeded: this.extractDataNeeds(q),
          available,
          source,
          value
        });
      }
    }
    
    // Add universal questions based on context
    if (focus.context === 'supply_pipeline' && focus.focusedValue) {
      questions.unshift({
        question: `What are the specific ${focus.focusedValue} units being built?`,
        dataNeeded: ['development_projects', 'permits', 'delivery_dates'],
        available: false, // Will check
        source: undefined,
        value: undefined
      });
    }
    
    return questions;
  }
  
  /**
   * Identify gaps in the data
   */
  private async identifyGaps(
    focus: UserFocus,
    mentalModel?: AnalystMentalModel,
    questions?: ContextAnalysis['immediateQuestions']
  ): Promise<DataGap[]> {
    const gaps: DataGap[] = [];
    
    // Check for unanswered questions
    if (questions) {
      for (const q of questions.filter(q => !q.available)) {
        gaps.push({
          id: `gap-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: 'missing',
          entity: this.determineEntityFromQuestion(focus, q.question),
          missingFields: q.dataNeeded,
          relevance: this.assessRelevance(q.question, focus),
          userQuestion: q.question,
          analystThought: this.generateAnalystThought(q.question),
          suggestedAction: this.suggestAction(q.dataNeeded),
          suggestedAgent: this.suggestAgent(q.dataNeeded),
          priority: this.calculatePriority(q.question, focus)
        });
      }
    }
    
    // Check for stale data in the graph
    if (focus.marketId || focus.submarketId) {
      const staleNodes = await this.graphService.getStaleNodes(
        focus.submarketId ? 'Property' : 'Market',
        10
      );
      
      for (const node of staleNodes) {
        gaps.push({
          id: `stale-${node.id}`,
          type: 'stale',
          entity: node.id,
          missingFields: ['all'],
          relevance: 'important',
          userQuestion: `Is the data for ${node.name} still accurate?`,
          analystThought: `Data last updated ${node.updatedAt.toLocaleDateString()}, may be outdated`,
          suggestedAction: 'agent_research',
          suggestedAgent: 'research',
          priority: 60
        });
      }
    }
    
    // Check required data from mental model
    if (mentalModel && focus.dealId) {
      const dealData = await this.getDealData(focus.dealId);
      
      for (const field of mentalModel.requiredData) {
        if (!dealData || dealData[field] === undefined || dealData[field] === null) {
          gaps.push({
            id: `required-${field}`,
            type: 'incomplete',
            entity: `deal:${focus.dealId}`,
            missingFields: [field],
            relevance: 'critical',
            userQuestion: `What is the ${this.humanizeField(field)}?`,
            analystThought: `This is core data needed for analysis`,
            suggestedAction: 'user_input',
            priority: 90
          });
        }
      }
    }
    
    // Sort by priority
    return gaps.sort((a, b) => b.priority - a.priority);
  }
  
  /**
   * Generate proactive suggestions
   */
  private async generateSuggestions(
    focus: UserFocus,
    mentalModel?: AnalystMentalModel,
    gaps?: DataGap[]
  ): Promise<ContextAnalysis['suggestions']> {
    const suggestions: ContextAnalysis['suggestions'] = [];
    
    // If looking at supply, suggest drilling into specific projects
    if (focus.context === 'supply_pipeline' && focus.submarketId) {
      suggestions.push({
        type: 'drill_down',
        title: 'View Development Projects',
        description: 'See individual projects with specs, timing, and developer info',
        action: 'show_development_projects',
        data: { submarketId: focus.submarketId }
      });
      
      suggestions.push({
        type: 'compare',
        title: 'Compare to Historical Supply',
        description: 'How does current pipeline compare to past cycles?',
        action: 'show_supply_history',
        data: { submarketId: focus.submarketId, yearsBack: 10 }
      });
      
      suggestions.push({
        type: 'forecast',
        title: 'Project Absorption Impact',
        description: 'Model how new supply affects vacancy and rent growth',
        action: 'run_absorption_model',
        data: { submarketId: focus.submarketId }
      });
    }
    
    // If looking at a deal, suggest comps
    if (focus.context === 'deal_overview' && focus.dealId) {
      suggestions.push({
        type: 'compare',
        title: 'Find Comparable Sales',
        description: 'Recent transactions with similar characteristics',
        action: 'show_sale_comps',
        data: { dealId: focus.dealId }
      });
      
      suggestions.push({
        type: 'compare',
        title: 'Analyze Rent Comps',
        description: 'How do rents compare to nearby properties?',
        action: 'show_rent_comps',
        data: { dealId: focus.dealId }
      });
    }
    
    // Add suggestions based on gaps
    if (gaps && gaps.length > 0) {
      const criticalGaps = gaps.filter(g => g.relevance === 'critical');
      if (criticalGaps.length > 0) {
        suggestions.unshift({
          type: 'alert',
          title: `${criticalGaps.length} Critical Data Gaps`,
          description: criticalGaps.map(g => g.userQuestion).join('; '),
          action: 'show_gaps',
          data: { gaps: criticalGaps }
        });
      }
    }
    
    return suggestions;
  }
  
  /**
   * Determine what agent tasks should run
   */
  private prioritizeAgentTasks(
    focus: UserFocus,
    gaps: DataGap[]
  ): ContextAnalysis['agentTasks'] {
    const tasks: ContextAnalysis['agentTasks'] = [];
    
    // Immediate tasks for critical gaps
    for (const gap of gaps.filter(g => g.relevance === 'critical' && g.suggestedAgent)) {
      tasks.push({
        agentType: gap.suggestedAgent!,
        task: `Fill data gap: ${gap.userQuestion}`,
        priority: 'immediate',
        context: {
          entity: gap.entity,
          missingFields: gap.missingFields,
          action: gap.suggestedAction
        }
      });
    }
    
    // Background tasks for enrichment
    for (const gap of gaps.filter(g => g.relevance === 'important' && g.suggestedAgent)) {
      tasks.push({
        agentType: gap.suggestedAgent!,
        task: `Enrich: ${gap.userQuestion}`,
        priority: 'background',
        context: {
          entity: gap.entity,
          missingFields: gap.missingFields
        }
      });
    }
    
    // Context-specific automatic research
    if (focus.context === 'supply_pipeline' && focus.submarketId) {
      tasks.push({
        agentType: 'supply',
        task: 'Fetch latest permit data and development pipeline',
        priority: 'background',
        context: {
          submarketId: focus.submarketId,
          includePermits: true,
          includeProposed: true
        }
      });
    }
    
    if (focus.context === 'deal_overview' && focus.dealId) {
      tasks.push({
        agentType: 'research',
        task: 'Ensure comp set is fresh and complete',
        priority: 'background',
        context: {
          dealId: focus.dealId,
          compTypes: ['rent', 'sale', 'expense']
        }
      });
    }
    
    return tasks;
  }
  
  // ==========================================================================
  // SUPPLY PIPELINE SPECIFIC - "What are those 2,400 units?"
  // ==========================================================================
  
  /**
   * When user sees "Units Under Construction: 2,400" - give them the full picture
   */
  async expandSupplyPipeline(
    marketId: string,
    submarketId?: string
  ): Promise<{
    totalUnits: number;
    projects: Array<{
      id: string;
      name: string;
      address: string;
      submarket: string;
      units: number;
      stories?: number;
      assetClass?: string;
      developer?: string;
      deliveryDate?: Date;
      deliveryQuarter?: string;
      constructionStatus: 'planned' | 'permitted' | 'under_construction' | 'lease_up';
      targetRents?: number;
      preLeasingPct?: number;
      permitDate?: Date;
      dataSource: string;
      dataFreshness: 'fresh' | 'stale' | 'expired';
      gaps: string[]; // What we don't know
    }>;
    bySubmarket: Record<string, { units: number; projects: number }>;
    byQuarter: Record<string, { units: number; projects: number }>;
    byDeveloper: Record<string, { units: number; projects: number }>;
    byClass: Record<string, { units: number; projects: number }>;
    gaps: DataGap[];
  }> {
    // Query for development projects
    const projectsQuery = `
      SELECT 
        dp.id,
        dp.name,
        dp.address,
        dp.submarket,
        dp.units,
        dp.stories,
        dp.asset_class,
        dp.developer,
        dp.expected_delivery,
        dp.construction_status,
        dp.target_rents,
        dp.pre_leasing_pct,
        dp.permit_date,
        dp.data_source,
        dp.updated_at,
        CASE 
          WHEN dp.updated_at > NOW() - INTERVAL '7 days' THEN 'fresh'
          WHEN dp.updated_at > NOW() - INTERVAL '30 days' THEN 'stale'
          ELSE 'expired'
        END as data_freshness
      FROM development_projects dp
      WHERE dp.market_id = $1
        AND dp.construction_status IN ('planned', 'permitted', 'under_construction', 'lease_up')
        ${submarketId ? 'AND dp.submarket = $2' : ''}
      ORDER BY dp.expected_delivery ASC, dp.units DESC
    `;
    
    const params = submarketId ? [marketId, submarketId] : [marketId];
    
    try {
      const result = await this.pool.query(projectsQuery, params);
      
      const projects = result.rows.map(row => ({
        id: row.id,
        name: row.name || 'Unknown Project',
        address: row.address || 'Address TBD',
        submarket: row.submarket || 'Unknown',
        units: row.units || 0,
        stories: row.stories,
        assetClass: row.asset_class,
        developer: row.developer,
        deliveryDate: row.expected_delivery ? new Date(row.expected_delivery) : undefined,
        deliveryQuarter: row.expected_delivery ? this.dateToQuarter(new Date(row.expected_delivery)) : undefined,
        constructionStatus: row.construction_status,
        targetRents: row.target_rents ? parseFloat(row.target_rents) : undefined,
        preLeasingPct: row.pre_leasing_pct ? parseFloat(row.pre_leasing_pct) : undefined,
        permitDate: row.permit_date ? new Date(row.permit_date) : undefined,
        dataSource: row.data_source || 'manual',
        dataFreshness: row.data_freshness,
        gaps: this.identifyProjectGaps(row)
      }));
      
      // Aggregate by dimensions
      const bySubmarket: Record<string, { units: number; projects: number }> = {};
      const byQuarter: Record<string, { units: number; projects: number }> = {};
      const byDeveloper: Record<string, { units: number; projects: number }> = {};
      const byClass: Record<string, { units: number; projects: number }> = {};
      
      for (const p of projects) {
        // By submarket
        if (!bySubmarket[p.submarket]) bySubmarket[p.submarket] = { units: 0, projects: 0 };
        bySubmarket[p.submarket].units += p.units;
        bySubmarket[p.submarket].projects += 1;
        
        // By quarter
        if (p.deliveryQuarter) {
          if (!byQuarter[p.deliveryQuarter]) byQuarter[p.deliveryQuarter] = { units: 0, projects: 0 };
          byQuarter[p.deliveryQuarter].units += p.units;
          byQuarter[p.deliveryQuarter].projects += 1;
        }
        
        // By developer
        const dev = p.developer || 'Unknown';
        if (!byDeveloper[dev]) byDeveloper[dev] = { units: 0, projects: 0 };
        byDeveloper[dev].units += p.units;
        byDeveloper[dev].projects += 1;
        
        // By class
        const cls = p.assetClass || 'Unknown';
        if (!byClass[cls]) byClass[cls] = { units: 0, projects: 0 };
        byClass[cls].units += p.units;
        byClass[cls].projects += 1;
      }
      
      // Identify overall gaps
      const gaps: DataGap[] = [];
      const unknownSubmarkets = projects.filter(p => p.submarket === 'Unknown').length;
      const unknownDelivery = projects.filter(p => !p.deliveryDate).length;
      const unknownDeveloper = projects.filter(p => !p.developer).length;
      
      if (unknownSubmarkets > 0) {
        gaps.push({
          id: 'gap-unknown-submarkets',
          type: 'incomplete',
          entity: `market:${marketId}`,
          missingFields: ['submarket'],
          relevance: 'important',
          userQuestion: `Where are the ${unknownSubmarkets} projects with unknown location?`,
          analystThought: 'Location is critical for assessing competitive impact',
          suggestedAction: 'agent_research',
          suggestedAgent: 'supply',
          priority: 80
        });
      }
      
      if (unknownDelivery > 0) {
        gaps.push({
          id: 'gap-unknown-delivery',
          type: 'incomplete',
          entity: `market:${marketId}`,
          missingFields: ['delivery_date'],
          relevance: 'critical',
          userQuestion: `When do the ${unknownDelivery} projects without delivery dates complete?`,
          analystThought: 'Timing drives absorption impact on existing properties',
          suggestedAction: 'fetch_permit',
          suggestedAgent: 'supply',
          priority: 90
        });
      }
      
      return {
        totalUnits: projects.reduce((sum, p) => sum + p.units, 0),
        projects,
        bySubmarket,
        byQuarter,
        byDeveloper,
        byClass,
        gaps
      };
      
    } catch (error) {
      console.warn('[ContextAwareness] Error expanding supply pipeline:', error);
      
      // Return structured empty response with gap indicating data needed
      return {
        totalUnits: 0,
        projects: [],
        bySubmarket: {},
        byQuarter: {},
        byDeveloper: {},
        byClass: {},
        gaps: [{
          id: 'gap-no-pipeline-data',
          type: 'missing',
          entity: `market:${marketId}`,
          missingFields: ['development_projects'],
          relevance: 'critical',
          userQuestion: 'What are the specific development projects?',
          analystThought: 'Need to fetch pipeline data from permits and CoStar',
          suggestedAction: 'agent_research',
          suggestedAgent: 'supply',
          priority: 100
        }]
      };
    }
  }
  
  // ==========================================================================
  // HELPERS
  // ==========================================================================
  
  private async checkDataAvailability(
    focus: UserFocus,
    question: string
  ): Promise<{ available: boolean; source?: string; value?: any }> {
    // This would check actual data sources
    // For now, return false to indicate gap
    return { available: false };
  }
  
  private extractDataNeeds(question: string): string[] {
    const keywords: Record<string, string[]> = {
      'where': ['location', 'address', 'submarket'],
      'who': ['developer', 'owner', 'broker'],
      'when': ['delivery_date', 'timing', 'quarter'],
      'what': ['units', 'specs', 'class', 'amenities'],
      'how': ['method', 'velocity', 'rate'],
      'rents': ['target_rents', 'asking_rents', 'effective_rents'],
      'compare': ['comps', 'benchmark', 'average']
    };
    
    const needs: string[] = [];
    const lowerQ = question.toLowerCase();
    
    for (const [keyword, fields] of Object.entries(keywords)) {
      if (lowerQ.includes(keyword)) {
        needs.push(...fields);
      }
    }
    
    return [...new Set(needs)];
  }
  
  private determineEntityFromQuestion(focus: UserFocus, question: string): string {
    if (focus.dealId) return `deal:${focus.dealId}`;
    if (focus.propertyId) return `property:${focus.propertyId}`;
    if (focus.submarketId) return `submarket:${focus.submarketId}`;
    if (focus.marketId) return `market:${focus.marketId}`;
    return 'unknown';
  }
  
  private assessRelevance(question: string, focus: UserFocus): 'critical' | 'important' | 'nice_to_have' {
    const criticalKeywords = ['where', 'when', 'how many', 'price', 'units', 'delivery'];
    const importantKeywords = ['who', 'developer', 'compare', 'trend'];
    
    const lowerQ = question.toLowerCase();
    
    if (criticalKeywords.some(k => lowerQ.includes(k))) return 'critical';
    if (importantKeywords.some(k => lowerQ.includes(k))) return 'important';
    return 'nice_to_have';
  }
  
  private generateAnalystThought(question: string): string {
    const thoughts: Record<string, string> = {
      'where': 'Location determines competitive overlap with our deal',
      'when': 'Timing impacts rent growth assumptions during hold period',
      'who': 'Developer track record indicates execution risk',
      'class': 'Asset class determines if they compete for same tenants',
      'rent': 'Rent positioning reveals their market strategy'
    };
    
    const lowerQ = question.toLowerCase();
    
    for (const [keyword, thought] of Object.entries(thoughts)) {
      if (lowerQ.includes(keyword)) return thought;
    }
    
    return 'This information helps complete the analysis';
  }
  
  private suggestAction(dataNeeded: string[]): DataGap['suggestedAction'] {
    if (dataNeeded.includes('permit') || dataNeeded.includes('delivery_date')) {
      return 'fetch_permit';
    }
    if (dataNeeded.includes('target_rents') || dataNeeded.includes('amenities')) {
      return 'scrape_listing';
    }
    if (dataNeeded.includes('developer') || dataNeeded.includes('specs')) {
      return 'agent_research';
    }
    return 'user_input';
  }
  
  private suggestAgent(dataNeeded: string[]): string | undefined {
    if (dataNeeded.some(d => ['delivery_date', 'units', 'permit', 'construction'].includes(d))) {
      return 'supply';
    }
    if (dataNeeded.some(d => ['comps', 'rents', 'comparable'].includes(d))) {
      return 'research';
    }
    if (dataNeeded.some(d => ['cap_rate', 'noi', 'price'].includes(d))) {
      return 'cashflow';
    }
    return 'research';
  }
  
  private calculatePriority(question: string, focus: UserFocus): number {
    let priority = 50;
    
    // Critical questions get higher priority
    if (this.assessRelevance(question, focus) === 'critical') priority += 30;
    if (this.assessRelevance(question, focus) === 'important') priority += 15;
    
    // Questions about user's current focus get higher priority
    if (focus.focusedMetric && question.toLowerCase().includes(focus.focusedMetric)) {
      priority += 20;
    }
    
    return Math.min(100, priority);
  }
  
  private async getDealData(dealId: string): Promise<Record<string, any> | null> {
    try {
      const result = await this.pool.query(
        'SELECT deal_data FROM deal_capsules WHERE id = $1',
        [dealId]
      );
      return result.rows[0]?.deal_data || null;
    } catch {
      return null;
    }
  }
  
  private humanizeField(field: string): string {
    return field
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
  
  private dateToQuarter(date: Date): string {
    const q = Math.floor(date.getMonth() / 3) + 1;
    return `Q${q} ${date.getFullYear()}`;
  }
  
  // ==========================================================================
  // ASK-THE-NETWORK — natural-language Q&A over the knowledge graph
  // ==========================================================================

  /**
   * Free-form question answering powered by the knowledge graph and an LLM.
   *
   * Flow:
   *   1. Hybrid search (BM25 + embeddings) over knowledge_graph_nodes,
   *      optionally constrained to a deal/market scope.
   *   2. Build a compact context block from the top results.
   *   3. Ask the configured LLM to synthesize an answer grounded in that
   *      context, citing source node names.
   *   4. Return { text, sources } with the nodes the model was given.
   *
   * Falls back gracefully when no LLM key or no matching nodes are present
   * — the caller (Hub UI) is told plainly so the operator can act.
   */
  async answer(
    question: string,
    opts: { dealId?: string; marketId?: string; submarketId?: string; limit?: number } = {}
  ): Promise<{
    text: string;
    sources: Array<{ id: string; type: NodeType; name: string; score: number }>;
    matched: number;
  }> {
    const trimmed = (question || '').trim();
    if (!trimmed) {
      return { text: 'Please provide a question.', sources: [], matched: 0 };
    }

    const limit = Math.max(1, Math.min(20, opts.limit ?? 8));

    // 1. Pull relevant nodes from the graph
    let matches: Array<{ node: GraphNode; score: number; matchType: string }> = [];
    try {
      matches = await this.graphService.hybridSearch(trimmed, undefined, undefined, limit);
    } catch (e: any) {
      console.warn('[ContextAwareness] hybridSearch failed in answer():', e?.message || e);
    }

    const sources = matches.map(m => ({
      id: m.node.id,
      type: m.node.type,
      name: m.node.name,
      score: m.score,
    }));

    // 2. If no LLM, return a useful structured fallback
    if (!isLLMAvailable()) {
      const lines = matches.length
        ? matches.map(m => `- [${m.node.type}] ${m.node.name}`).join('\n')
        : '- (no matching entities)';
      return {
        text:
          `LLM is not configured.\nFound ${matches.length} relevant node(s):\n${lines}`,
        sources,
        matched: matches.length,
      };
    }

    // 3. Build a small grounded context block
    const contextBlock = matches.length
      ? matches
          .map((m, i) => {
            const propsPreview = JSON.stringify(m.node.properties || {}).slice(0, 400);
            return `[${i + 1}] (${m.node.type}) ${m.node.name}\n    props: ${propsPreview}`;
          })
          .join('\n')
      : '(no entities matched in the knowledge graph)';

    const scopeBits: string[] = [];
    if (opts.dealId)      scopeBits.push(`dealId=${opts.dealId}`);
    if (opts.marketId)    scopeBits.push(`marketId=${opts.marketId}`);
    if (opts.submarketId) scopeBits.push(`submarketId=${opts.submarketId}`);
    const scope = scopeBits.length ? `Scope: ${scopeBits.join(', ')}` : 'Scope: none';

    const prompt = `You are JediRe's neural network analyst. Answer the user's question
using ONLY the knowledge graph context below. If the context is insufficient,
say so plainly — do not fabricate.  Cite sources by their bracket number, e.g. [1].

${scope}

Knowledge graph context:
${contextBlock}

User question:
${trimmed}

Answer (concise, real-estate-analyst tone, max ~6 sentences):`;

    // 4. Call the LLM
    try {
      const llm = await generateCompletion({
        prompt,
        maxTokens: 500,
        temperature: 0.2,
      });
      return { text: llm.text.trim(), sources, matched: matches.length };
    } catch (e: any) {
      console.error('[ContextAwareness] LLM call failed in answer():', e?.message || e);
      return {
        text: `LLM call failed: ${e?.message || 'unknown error'}.`,
        sources,
        matched: matches.length,
      };
    }
  }

  private identifyProjectGaps(row: any): string[] {
    const gaps: string[] = [];
    
    if (!row.name || row.name === 'Unknown') gaps.push('project_name');
    if (!row.address) gaps.push('address');
    if (!row.submarket || row.submarket === 'Unknown') gaps.push('submarket');
    if (!row.units) gaps.push('units');
    if (!row.expected_delivery) gaps.push('delivery_date');
    if (!row.developer) gaps.push('developer');
    if (!row.asset_class) gaps.push('asset_class');
    if (!row.target_rents) gaps.push('target_rents');
    
    return gaps;
  }
}

// Singleton
let contextAwarenessInstance: ContextAwarenessService | null = null;

export function getContextAwarenessService(pool: Pool): ContextAwarenessService {
  if (!contextAwarenessInstance) {
    contextAwarenessInstance = new ContextAwarenessService(pool);
  }
  return contextAwarenessInstance;
}
